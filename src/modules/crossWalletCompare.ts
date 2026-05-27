import { EXPLORER_API } from "../types";

export interface WalletMetrics {
  address: string;
  txCount: number;
  gasSpentPros: number;
  rwaExposurePct: number;
  tokenVariety: number;
  lpPositions: number;
  riskScore: number;
  walletScore: number;
}

export interface CompareResult {
  w1: WalletMetrics;
  w2: WalletMetrics;
  winner: "Wallet 1" | "Wallet 2" | "Tie";
}

async function fetchPages(baseUrl: string): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}&page=${page}`).catch(() => null);
    if (!res?.ok) break;
    const data = await res.json();
    const batch: any[] = data.data ?? [];
    if (batch.length === 0) break;
    items.push(...batch);
    if (items.length >= (data.total ?? items.length)) break;
    page++;
  }
  return items;
}

function buildMetrics(address: string, txs: any[], transfers: any[], nfts: any[]): WalletMetrics {
  const lower   = address.toLowerCase();
  const RWA     = ["palpha", "s-palpha", "aq-palpha", "p-palpha", "ss-palpha"];
  const LP_SYMS = ["aqLP", "zProsWPROS", "zProsUSDC"];

  const txCount     = txs.length;
  const gasSpentPros = txs.reduce((s, t) => s + parseFloat(t.transaction_fee || "0"), 0);

  const tokenSet = new Set<string>();
  let rwaCount = 0;
  for (const t of transfers) {
    const sym = (t.token_symbol || "").toLowerCase();
    if (sym) tokenSet.add(sym);
    if (RWA.some(r => sym.includes(r))) rwaCount++;
  }
  const tokenVariety    = tokenSet.size;
  const rwaExposurePct  = tokenVariety > 0 ? (rwaCount / tokenVariety) * 100 : 0;

  let erc20Lp = 0;
  const v3In  = new Set<string>();
  const v3Out = new Set<string>();
  for (const t of transfers) {
    if (LP_SYMS.includes(t.token_symbol || "")) erc20Lp++;
  }
  for (const t of nfts) {
    if ((t.token_symbol ?? t.symbol) === "UNI-V3-POS") {
      const id = String(t.token_id ?? "");
      if (t.to_address?.toLowerCase() === lower)   v3In.add(id);
      if (t.from_address?.toLowerCase() === lower) v3Out.add(id);
    }
  }
  const v3Active   = Array.from(v3In).filter(id => !v3Out.has(id)).length;
  const lpPositions = (erc20Lp > 0 ? 1 : 0) + v3Active;

  const failed   = txs.filter(t => t.status === "0" || t.status === false).length;
  const failPct  = txCount > 0 ? (failed / txCount) * 100 : 0;
  const riskScore = Math.min(Math.round(failPct * 3 + (tokenVariety > 15 ? 20 : 0)), 100);

  let score = 0;
  score += Math.min(txCount / 2, 30);
  score += Math.min(gasSpentPros * 10, 20);
  score += Math.min(rwaExposurePct, 20);
  score += Math.min(lpPositions * 5, 15);
  score += Math.min(tokenVariety * 2, 15);
  const walletScore = Math.round(Math.min(score, 100));

  return { address, txCount, gasSpentPros, rwaExposurePct, tokenVariety, lpPositions, riskScore, walletScore };
}

export async function compareWallets(
  w1: string, w1Txs: any[], w1Transfers: any[], w1Nfts: any[],
  w2: string
): Promise<CompareResult> {
  const [w2Txs, w2Transfers, w2Nfts] = await Promise.all([
    fetchPages(`${EXPLORER_API}/address/${w2}/transactions?limit=25`),
    fetchPages(`${EXPLORER_API}/address/${w2}/token_transfers?limit=25`),
    fetchPages(`${EXPLORER_API}/address/${w2}/nft_transfers?limit=25`),
  ]);

  const m1 = buildMetrics(w1, w1Txs, w1Transfers, w1Nfts);
  const m2 = buildMetrics(w2, w2Txs, w2Transfers, w2Nfts);

  const winner: CompareResult["winner"] =
    m1.walletScore > m2.walletScore ? "Wallet 1"
    : m2.walletScore > m1.walletScore ? "Wallet 2"
    : "Tie";

  return { w1: m1, w2: m2, winner };
}
