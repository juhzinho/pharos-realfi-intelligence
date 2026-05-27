import { ethers } from "ethers";
import { RPC_URL, TOKENS, TOKEN_DECIMALS } from "../types";
import { resolveTokenSymbol } from "../utils/tokenUtils";

export interface TokenBalance {
  symbol: string;
  netBalance: number;
  priceUsd: number | null;
  valueUsd: number;
}

export interface PriceTrackerResult {
  prosUsd: number;
  priceSource: string;
  balances: TokenBalance[];
  totalUsd: number;
}

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchProsPrice(): Promise<{ price: number; source: string }> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=pharos-network&vs_currencies=usd"
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.["pharos-network"]?.usd;
      if (typeof price === "number" && price > 0) return { price, source: "CoinGecko" };
    }
  } catch {}

  try {
    const res = await fetchWithTimeout(
      "https://api.dexscreener.com/latest/dex/tokens/0x52c48d4213107b20bc583832b0d951fb9ca8f0b0"
    );
    if (res.ok) {
      const data = await res.json();
      const pairs: any[] = data.pairs ?? [];
      const best = pairs.find((p: any) => p.priceUsd) ?? pairs[0];
      if (best?.priceUsd) return { price: parseFloat(best.priceUsd), source: "DexScreener" };
    }
  } catch {}

  return { price: 0, source: "unavailable" };
}

async function fetchAllOnChainBalances(
  wallet: string,
  transfers: any[]
): Promise<Array<{ symbol: string; balance: number }>> {
  // Build unique token map from transfer history
  const tokenMap = new Map<string, TokenInfo>();

  for (const t of transfers) {
    const addr = (t.token_address as string | undefined ?? "").toLowerCase();
    if (!addr || addr === "0x0000000000000000000000000000000000000000") continue;
    if (tokenMap.has(addr)) continue;
    const sym = resolveTokenSymbol(t.token_address || "", t.token_symbol || "UNKNOWN");
    const rawDec = t.token_decimals;
    const dec =
      typeof rawDec === "number" ? rawDec :
      typeof rawDec === "string" && rawDec !== "" ? parseInt(rawDec, 10) :
      TOKEN_DECIMALS[sym] ?? 18;
    tokenMap.set(addr, { address: addr, symbol: sym, decimals: isNaN(dec as number) ? 18 : (dec as number) });
  }

  // Always-check contracts — force-set symbol/decimals so transfer data can't corrupt them.
  // e.g. WPROS contract sometimes appears in transfers with symbol "PROS"; we correct that here.
  const always: TokenInfo[] = [
    { address: TOKENS.WPROS.address.toLowerCase(), symbol: "WPROS", decimals: TOKENS.WPROS.decimals },
    { address: TOKENS.USDC.address.toLowerCase(),  symbol: "USDC",  decimals: TOKENS.USDC.decimals  },
    { address: TOKENS.WETH.address.toLowerCase(),  symbol: "WETH",  decimals: TOKENS.WETH.decimals  },
  ];
  for (const t of always) {
    tokenMap.set(t.address, t); // always override — canonical symbol takes precedence
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const iface = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
  const calldata = iface.encodeFunctionData("balanceOf", [wallet]);

  const entries = Array.from(tokenMap.values());

  const [nativeRaw, erc20Raws] = await Promise.all([
    provider.getBalance(wallet).catch(() => 0n),
    Promise.all(
      entries.map(({ address }) =>
        provider.call({ to: address, data: calldata }).catch(() => null)
      )
    ),
  ]);

  const out: Array<{ symbol: string; balance: number }> = [];

  // Native PROS — always from eth_getBalance, never from an ERC-20
  const nativePros = Number(ethers.formatUnits(nativeRaw, 18));
  if (nativePros >= 0.000001) {
    out.push({ symbol: "PROS", balance: nativePros });
  }

  // ERC-20s — keyed by contract address to avoid cross-contract symbol collisions.
  // Any contract whose symbol is "PROS" is skipped: native is the canonical PROS.
  // After dedup-by-address we do a final dedup-by-symbol (keep highest balance).
  const addrMap = new Map<string, { symbol: string; balance: number }>();

  for (let i = 0; i < entries.length; i++) {
    const info = entries[i];
    const raw  = erc20Raws[i];
    if (!raw || raw === "0x") continue;
    try {
      const bn = iface.decodeFunctionResult("balanceOf", raw)[0] as bigint;
      if (bn === 0n) continue;
      const balance = Number(ethers.formatUnits(bn, info.decimals));
      if (balance < 0.000001) continue;
      // Skip ERC-20s that claim symbol "PROS" — native eth_getBalance is authoritative
      if (info.symbol.toUpperCase() === "PROS") continue;
      addrMap.set(info.address, { symbol: info.symbol, balance });
    } catch {}
  }

  // Collapse any remaining symbol duplicates (different addresses, same symbol) → highest balance
  const symMap = new Map<string, number>();
  for (const { symbol, balance } of addrMap.values()) {
    if (!symMap.has(symbol) || balance > symMap.get(symbol)!) {
      symMap.set(symbol, balance);
    }
  }
  for (const [symbol, balance] of symMap) {
    out.push({ symbol, balance });
  }

  return out;
}

export async function getPriceTracker(wallet: string, transfers: any[]): Promise<PriceTrackerResult> {
  const [{ price: prosUsd, source: priceSource }, onChainTokens] = await Promise.all([
    fetchProsPrice(),
    fetchAllOnChainBalances(wallet, transfers),
  ]);

  const PROS_LIKE = new Set(["PROS", "WPROS", "zProsWPROS"]);
  const STABLE: Record<string, number> = { USDC: 1, USDT: 1, DAI: 1, BUSD: 1, zProsUSDC: 1 };

  const balances: TokenBalance[] = onChainTokens
    .map(({ symbol, balance: netBalance }) => {
      let priceUsd: number | null = null;
      if (STABLE[symbol] !== undefined)  priceUsd = STABLE[symbol];
      else if (PROS_LIKE.has(symbol))    priceUsd = prosUsd > 0 ? prosUsd : null;
      const valueUsd = priceUsd !== null ? netBalance * priceUsd : 0;
      return { symbol, netBalance, priceUsd, valueUsd };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const totalUsd = balances.reduce((s, b) => s + b.valueUsd, 0);

  return { prosUsd, priceSource, balances, totalUsd };
}
