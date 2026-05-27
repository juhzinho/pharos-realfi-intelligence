import { ethers } from "ethers";
import { EXPLORER_API, RPC_URL, TOKENS } from "../types";

// ── WPROS (ERC-20) top holders ──────────────────────────────────────────────

export interface WprosHolder {
  rank: number;
  address: string;
  balance: number;
  percentage: number;
  isWallet: boolean;
  displayName: string | null;
  isContract: boolean;
}

export interface WprosHoldersResult {
  totalSupply: number;
  totalHolders: number;
  top20: WprosHolder[];
  walletRank: number | null;
  walletBalance: number;
  walletPct: number;
}

const WPROS_ADDRESS = "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0";
const RANK_PAGE_SIZE = 50;

async function fetchWprosBalanceRpc(wallet: string): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      TOKENS.WPROS.address,
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    const raw: bigint = await contract.balanceOf(wallet);
    return Number(ethers.formatUnits(raw, TOKENS.WPROS.decimals));
  } catch {
    return 0;
  }
}

export async function getWprosTopHolders(wallet: string): Promise<WprosHoldersResult> {
  const walletLower = wallet.toLowerCase();

  // Fetch profile, top-20 list, and RPC balance all in parallel
  const [profileRes, holdersRes, rpcBalance] = await Promise.all([
    fetch(`${EXPLORER_API}/token/${WPROS_ADDRESS}/profile`),
    fetch(`${EXPLORER_API}/token/${WPROS_ADDRESS}/top_holders?size=20&page=1`),
    fetchWprosBalanceRpc(wallet),
  ]);

  let totalSupply = 0;
  let totalHolders = 0;
  if (profileRes.ok) {
    const p = await profileRes.json();
    totalSupply  = parseFloat(p.total_supply ?? "0");
    totalHolders = p.extra_info?.total_holders ?? p.total_holders ?? 0;
  }

  const raw: any[] = holdersRes.ok ? ((await holdersRes.json()).data ?? []) : [];

  const top20: WprosHolder[] = raw.slice(0, 20).map((h, i) => {
    const addr = (h.wallet_address ?? "").toLowerCase();
    const bal  = parseFloat(h.balance ?? "0");
    const rawName: string = h.wallet_address_display_name ?? "";
    const displayName = rawName && rawName.toLowerCase() !== addr ? rawName : null;
    return {
      rank:        i + 1,
      address:     addr,
      balance:     bal,
      percentage:  totalSupply > 0 ? (bal / totalSupply) * 100 : 0,
      isWallet:    addr === walletLower,
      displayName,
      isContract:  h.wallet_address_is_contract ?? false,
    };
  });

  // RPC balance is authoritative; API value used as fallback when wallet is in top 20
  const top20Entry    = top20.find(h => h.isWallet) ?? null;
  const walletBalance = rpcBalance > 0 ? rpcBalance : (top20Entry?.balance ?? 0);
  const walletPct     = totalSupply > 0 && walletBalance > 0 ? (walletBalance / totalSupply) * 100 : 0;

  if (top20Entry) {
    return { totalSupply, totalHolders, top20, walletRank: top20Entry.rank, walletBalance, walletPct };
  }

  // Not in top 20 — scan ALL holder pages in parallel to find the wallet's rank
  let walletRank: number | null = null;

  if (walletBalance > 0 && totalHolders > 20) {
    const numPages = Math.min(Math.ceil(totalHolders / RANK_PAGE_SIZE), 40); // cap 2 000 holders
    const pages = await Promise.all(
      Array.from({ length: numPages }, (_, i) =>
        fetch(`${EXPLORER_API}/token/${WPROS_ADDRESS}/top_holders?size=${RANK_PAGE_SIZE}&page=${i + 1}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    for (let pi = 0; pi < pages.length && walletRank === null; pi++) {
      const batch: any[] = pages[pi]?.data ?? [];
      const idx = batch.findIndex((h: any) => h.wallet_address?.toLowerCase() === walletLower);
      if (idx !== -1) walletRank = pi * RANK_PAGE_SIZE + idx + 1;
    }
  }

  return { totalSupply, totalHolders, top20, walletRank, walletBalance, walletPct };
}

// ── Native PROS top holders ─────────────────────────────────────────────────

export interface NativeHolder {
  rank: number;
  address: string;
  balance: number;
  percentage: number;
  isWallet: boolean;
  displayName: string | null;
}

export interface TopHoldersResult {
  top20: NativeHolder[];
  walletRank: number | null;
  walletBalance: number;
  walletPct: number;
  totalTracked: number;
}

export async function getNativeTopHolders(wallet: string): Promise<TopHoldersResult> {
  const walletLower = wallet.toLowerCase();

  // Fetch enough pages to cover top 20 display + find wallet if present
  const PAGE_SIZE = 25;
  const PAGES_TO_SCAN = 2; // covers top 50; wallet with ~4 PROS won't be in top 1000
  const allAccounts: any[] = [];
  let serverTotal = 0;

  for (let page = 1; page <= PAGES_TO_SCAN; page++) {
    const res = await fetch(
      `${EXPLORER_API}/top-accounts?size=${PAGE_SIZE}&page=${page}`
    );
    if (!res.ok) break;
    const data = await res.json();
    serverTotal = data.total ?? 0;
    const batch: any[] = data.data ?? [];
    if (batch.length === 0) break;
    allAccounts.push(...batch);
  }

  const walletEntry = allAccounts.find(a => a.address?.toLowerCase() === walletLower);
  const top20: NativeHolder[] = allAccounts.slice(0, 20).map(a => ({
    rank:        a.rank,
    address:     a.address ?? "",
    balance:     parseFloat(a.balance ?? "0"),
    percentage:  parseFloat(a.percentage ?? "0"),
    isWallet:    a.address?.toLowerCase() === walletLower,
    displayName: a.address_display_name ?? null,
  }));

  // Fetch wallet's native balance from profile if not found in the scanned pages
  let walletBalance = walletEntry ? parseFloat(walletEntry.balance ?? "0") : 0;
  let walletPct     = walletEntry ? parseFloat(walletEntry.percentage ?? "0") : 0;

  if (!walletEntry) {
    const profileRes = await fetch(`${EXPLORER_API}/address/${wallet}/profile`);
    if (profileRes.ok) {
      const profile = await profileRes.json();
      walletBalance = parseFloat(profile.balance ?? "0");
      // Calculate pct from first-page data (top holder gives us total supply context)
      // top #1 pct + balance lets us back-calculate total supply
      if (allAccounts.length > 0 && parseFloat(allAccounts[0].percentage) > 0) {
        const impliedSupply = parseFloat(allAccounts[0].balance) / (parseFloat(allAccounts[0].percentage) / 100);
        walletPct = impliedSupply > 0 ? (walletBalance / impliedSupply) * 100 : 0;
      }
    }
  }

  return {
    top20,
    walletRank:    walletEntry ? walletEntry.rank : null,
    walletBalance,
    walletPct,
    totalTracked:  serverTotal,
  };
}
