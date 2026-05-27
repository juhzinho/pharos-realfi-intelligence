import { resolveTokenSymbol } from "../utils/tokenUtils";

const LP_POOLS: Record<string, { pool: string; pair: string }> = {
  aqLP:      { pool: "AquaFlux",    pair: "pALPHA / USDC"  },
  zProsWPROS:{ pool: "Zona Pharos", pair: "WPROS / PROS"   },
  zProsUSDC: { pool: "Zona Pharos", pair: "USDC / PROS"    },
};

export interface LPPosition {
  lpToken: string;
  pool: string;
  pair: string;
  received: number;
  sent: number;
  net: number;
  transfers: number;
}

export interface LiquidityResult {
  erc20Positions: LPPosition[];
  v3ActiveTokenIds: string[];
  v3TotalMinted: number;
}

export function getLiquidityPositions(
  wallet: string,
  transfers: any[],
  nftTransfers: any[]
): LiquidityResult {
  // --- ERC-20 LP tokens ---
  const lpAccum: Record<string, { received: number; sent: number; transfers: number }> = {};

  for (const t of transfers) {
    const symbol: string = resolveTokenSymbol(t.token_address || "", t.token_symbol || "");
    if (!LP_POOLS[symbol]) continue;

    const value = parseFloat(t.value || "0");
    if (!lpAccum[symbol]) lpAccum[symbol] = { received: 0, sent: 0, transfers: 0 };

    if (t.to_address?.toLowerCase() === wallet.toLowerCase())   lpAccum[symbol].received += value;
    if (t.from_address?.toLowerCase() === wallet.toLowerCase()) lpAccum[symbol].sent     += value;
    lpAccum[symbol].transfers++;
  }

  const erc20Positions: LPPosition[] = Object.entries(lpAccum).map(([symbol, d]) => ({
    lpToken:   symbol,
    pool:      LP_POOLS[symbol].pool,
    pair:      LP_POOLS[symbol].pair,
    received:  d.received,
    sent:      d.sent,
    net:       d.received - d.sent,
    transfers: d.transfers,
  }));

  // --- UNI-V3-POS NFT positions ---
  const v3Received = new Map<string, string>(); // tokenId → block_timestamp
  const v3Sent     = new Set<string>();

  for (const t of nftTransfers) {
    if ((t.token_symbol || t.symbol) !== "UNI-V3-POS") continue;
    const tokenId = String(t.token_id ?? "");
    if (!tokenId) continue;
    if (t.to_address?.toLowerCase()   === wallet.toLowerCase()) v3Received.set(tokenId, t.block_timestamp || "");
    if (t.from_address?.toLowerCase() === wallet.toLowerCase()) v3Sent.add(tokenId);
  }

  const v3ActiveTokenIds = Array.from(v3Received.keys()).filter(id => !v3Sent.has(id));

  return { erc20Positions, v3ActiveTokenIds, v3TotalMinted: v3Received.size };
}
