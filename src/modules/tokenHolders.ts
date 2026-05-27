import { EXPLORER_API, RPC_URL } from "../types";

export interface HolderEntry {
  rank: number;
  address: string;
  balance: number;
  pct: number;
  isWallet: boolean;
}

export interface TokenHoldersResult {
  symbol: string;
  tokenAddress: string;
  totalSupply: number;
  totalHolders: number;
  top20: HolderEntry[];
  walletRank: number;
  walletBalance: number;
  walletPct: number;
  scannedAddresses: number;
}

async function getTokenProfile(tokenAddress: string): Promise<{ totalSupply: number; totalHolders: number; symbol: string }> {
  const res = await fetch(`${EXPLORER_API}/token/${tokenAddress}/profile`);
  if (!res.ok) return { totalSupply: 0, totalHolders: 0, symbol: "?" };
  const d = await res.json();
  return {
    totalSupply:  parseFloat(d.total_supply ?? "0"),
    totalHolders: d.total_holders ?? 0,
    symbol:       d.symbol ?? "?",
  };
}

async function collectAddresses(tokenAddress: string, totalTransfers: number, wallet: string): Promise<string[]> {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const PAGE  = 25;
  const LAST  = Math.ceil(totalTransfers / PAGE);
  const seen  = new Set<string>([wallet.toLowerCase()]);

  // 60 newest pages + 60 oldest pages for broad address coverage
  const pages: number[] = [];
  for (let p = 1;        p <= 60;         p++) pages.push(p);
  for (let p = Math.max(61, LAST - 59); p <= LAST; p++) pages.push(p);

  for (const page of pages) {
    const res = await fetch(
      `${EXPLORER_API}/token/${tokenAddress}/token_transfers?limit=${PAGE}&page=${page}`
    );
    if (!res.ok) break;
    const data = await res.json();
    for (const t of (data.data ?? [])) {
      const from = (t.from_address ?? "").toLowerCase();
      const to   = (t.to_address   ?? "").toLowerCase();
      if (from && from !== ZERO) seen.add(from);
      if (to   && to   !== ZERO) seen.add(to);
    }
    if ((data.data ?? []).length === 0) break;
  }

  return Array.from(seen);
}

async function batchBalanceOf(addresses: string[], tokenAddress: string): Promise<Record<string, number>> {
  const CHUNK = 50;
  const balances: Record<string, number> = {};

  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK);
    const batch = chunk.map((addr, j) => ({
      jsonrpc: "2.0",
      method:  "eth_call",
      params:  [{ to: tokenAddress, data: "0x70a08231" + addr.slice(2).padStart(64, "0") }, "latest"],
      id:      i + j,
    }));

    const res = await fetch(RPC_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(batch),
    });
    const results: any[] = await res.json();

    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      if (!r?.result || r.result === "0x") continue;
      const bal = Number(BigInt(r.result)) / 1e18;
      if (bal > 0) balances[chunk[j]] = bal;
    }
  }

  return balances;
}

export async function getTokenHolders(tokenAddress: string, wallet: string): Promise<TokenHoldersResult> {
  const profile = await getTokenProfile(tokenAddress);
  // profile total_transfers is stored in extra_info; fall back to a large upper bound
  const totalTransfers = profile.totalHolders * 2730; // rough estimate: avg 2730 tx/holder for PROS

  const addresses  = await collectAddresses(tokenAddress, totalTransfers, wallet);
  const balances   = await batchBalanceOf(addresses, tokenAddress);

  const sorted = Object.entries(balances)
    .map(([addr, bal]) => ({ addr, bal }))
    .sort((a, b) => b.bal - a.bal);

  const walletLower  = wallet.toLowerCase();
  const walletIdx    = sorted.findIndex(e => e.addr === walletLower);
  const walletBal    = balances[walletLower] ?? 0;
  const walletRank   = walletIdx >= 0 ? walletIdx + 1 : sorted.length + 1;
  const walletPct    = profile.totalSupply > 0 ? (walletBal / profile.totalSupply) * 100 : 0;

  const top20: HolderEntry[] = sorted.slice(0, 20).map((e, i) => ({
    rank:     i + 1,
    address:  e.addr,
    balance:  e.bal,
    pct:      profile.totalSupply > 0 ? (e.bal / profile.totalSupply) * 100 : 0,
    isWallet: e.addr === walletLower,
  }));

  // If wallet not in top 20, append it so it's always visible
  if (walletIdx >= 20 || walletIdx < 0) {
    top20.push({
      rank:     walletRank,
      address:  walletLower,
      balance:  walletBal,
      pct:      walletPct,
      isWallet: true,
    });
  }

  return {
    symbol:           profile.symbol,
    tokenAddress,
    totalSupply:      profile.totalSupply,
    totalHolders:     profile.totalHolders,
    top20,
    walletRank,
    walletBalance:    walletBal,
    walletPct,
    scannedAddresses: addresses.length,
  };
}
