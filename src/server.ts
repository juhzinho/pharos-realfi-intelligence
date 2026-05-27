import express, { Request, Response } from "express";
import path from "path";
import { getEcosystemStats } from "./modules/ecosystemStats";
import { getRwaYield } from "./modules/rwaYield";
import { analyzeRisk } from "./modules/riskEngine";
import { getLiquidityPositions } from "./modules/liquidityPositions";
import { getNativeTopHolders, getWprosTopHolders } from "./modules/topHolders";
import { getPriceTracker } from "./modules/priceTracker";
import { getTransactionTimeline } from "./modules/transactionTimeline";
import { checkAirdropEligibility } from "./modules/airdropChecker";
import { getNftPortfolio } from "./modules/nftPortfolio";
import { EXPLORER_API } from "./types";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ── shared helpers ──────────────────────────────────────────────────────────

async function fetchAllPages(baseUrl: string): Promise<{ items: any[]; total: number }> {
  const items: any[] = [];
  let serverTotal = 0;
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}&page=${page}`).catch(() => null);
    if (!res?.ok) break;
    const data: any = await res.json();
    const batch: any[] = data.data ?? [];
    if (batch.length === 0) break;
    items.push(...batch);
    serverTotal = data.total ?? items.length;
    if (items.length >= serverTotal) break;
    page++;
  }
  return { items, total: serverTotal };
}

function computeScore(txs: any[], transfers: any[], nfts: any[], walletLower: string) {
  const RWA     = ["palpha", "s-palpha", "aq-palpha", "p-palpha", "ss-palpha"];
  const LP_SYMS = ["aqLP", "zProsWPROS", "zProsUSDC"];

  const txCount      = txs.length;
  const gasSpentPros = txs.reduce((s: number, t: any) => s + parseFloat(t.transaction_fee || "0"), 0);

  const tokenSet = new Set<string>();
  let rwaCount = 0;
  for (const t of transfers) {
    const sym = (t.token_symbol || "").toLowerCase();
    if (sym) tokenSet.add(sym);
    if (RWA.some(r => sym.includes(r))) rwaCount++;
  }
  const tokenVariety   = tokenSet.size;
  const rwaExposurePct = tokenVariety > 0 ? (rwaCount / tokenVariety) * 100 : 0;

  let erc20Lp = 0;
  const v3In  = new Set<string>();
  const v3Out = new Set<string>();
  for (const t of transfers) {
    if (LP_SYMS.includes(t.token_symbol || "")) erc20Lp++;
  }
  for (const t of nfts) {
    if ((t.token_symbol ?? t.symbol) === "UNI-V3-POS") {
      const id = String(t.token_id ?? "");
      if (t.to_address?.toLowerCase()   === walletLower) v3In.add(id);
      if (t.from_address?.toLowerCase() === walletLower) v3Out.add(id);
    }
  }
  const v3Active    = Array.from(v3In).filter(id => !v3Out.has(id)).length;
  const lpPositions = (erc20Lp > 0 ? 1 : 0) + v3Active;

  let score = 0;
  score += Math.min(txCount / 2,          30);
  score += Math.min(gasSpentPros * 10,    20);
  score += Math.min(rwaExposurePct,       20);
  score += Math.min(lpPositions * 5,      15);
  score += Math.min(tokenVariety * 2,     15);
  const walletScore = Math.round(Math.min(score, 100));

  const level =
    walletScore >= 80 ? "Diamond" :
    walletScore >= 60 ? "Gold"    :
    walletScore >= 40 ? "Silver"  : "Bronze";

  return { walletScore, level, txCount, gasSpentPros, rwaExposurePct, tokenVariety, lpPositions };
}

// ── endpoints ───────────────────────────────────────────────────────────────

app.get("/api/wallet/:address/stats", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [txData, transferData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
    ]);
    const data = await getEcosystemStats(address, txData, transferData);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/yield", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const transferData = await fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`);
    const data = getRwaYield(address, transferData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/score", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [txData, transferData, nftData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/nft_transfers?limit=25`),
    ]);
    const data = computeScore(txData.items, transferData.items, nftData.items, address.toLowerCase());
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/risk", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [txData, transferData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
    ]);
    const data = analyzeRisk(address, txData.items, transferData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/price", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const transferData = await fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`);
    const data = await getPriceTracker(address, transferData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/airdrop", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [txData, transferData, nftData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/nft_transfers?limit=25`),
    ]);
    const ecosystem = await getEcosystemStats(address, txData, transferData);
    const liquidity  = getLiquidityPositions(address, transferData.items, nftData.items);
    const received   = Array.from(new Set<string>(
      transferData.items
        .filter((t: any) => t.to_address?.toLowerCase() === address.toLowerCase())
        .map((t: any) => (t.token_symbol || "") as string)
        .filter((s: string) => s.length > 0)
    ));
    const data = checkAirdropEligibility({
      txCount:              ecosystem.totalTransactions,
      uniqueContracts:      ecosystem.uniqueContractsInteracted,
      receivedTokenSymbols: received,
      hasLpPositions:       liquidity.erc20Positions.length > 0 || liquidity.v3ActiveTokenIds.length > 0,
      firstActivity:        ecosystem.firstActivity,
      gasSpent:             parseFloat(ecosystem.totalGasSpent),
    });
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/nft", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const nftData = await fetchAllPages(`${EXPLORER_API}/address/${address}/nft_transfers?limit=25`);
    const data    = getNftPortfolio(address, nftData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/liquidity", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [transferData, nftData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/nft_transfers?limit=25`),
    ]);
    const data = getLiquidityPositions(address, transferData.items, nftData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/gas", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const txData = await fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`);
    const gasFees = txData.items
      .map((t: any) => ({
        fee:    parseFloat(t.transaction_fee || "0"),
        feeUsd: parseFloat(t.transaction_fee_usd || "0"),
        hash:   (t.hash || t.transaction_hash || "") as string,
        date:   (t.block_timestamp || "") as string,
      }))
      .filter(t => t.fee > 0);

    const totalGas    = gasFees.reduce((s, t) => s + t.fee, 0);
    const totalGasUsd = gasFees.reduce((s, t) => s + t.feeUsd, 0);
    const avgGas      = gasFees.length > 0 ? totalGas / gasFees.length : 0;
    const topGasTx    = gasFees.reduce(
      (max, t) => t.fee > max.fee ? t : max,
      { fee: 0, feeUsd: 0, hash: "", date: "" }
    );
    res.json({
      ok: true,
      data: {
        txCount: txData.total,
        txWithFees: gasFees.length,
        totalGas,
        totalGasUsd,
        avgGas,
        topTx: topGasTx.hash ? topGasTx : null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/timeline", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const txData = await fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`);
    const data   = getTransactionTimeline(txData.items);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/holders", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const [native, wpros] = await Promise.all([
      getNativeTopHolders(address),
      getWprosTopHolders(address),
    ]);
    res.json({ ok: true, data: { native, wpros } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/wallet/:address/all", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const lower = address.toLowerCase();

    const [txData, transferData, nftData] = await Promise.all([
      fetchAllPages(`${EXPLORER_API}/address/${address}/transactions?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/token_transfers?limit=25`),
      fetchAllPages(`${EXPLORER_API}/address/${address}/nft_transfers?limit=25`),
    ]);

    const liquidity = getLiquidityPositions(address, transferData.items, nftData.items);
    const received  = Array.from(new Set<string>(
      transferData.items
        .filter((t: any) => t.to_address?.toLowerCase() === lower)
        .map((t: any) => (t.token_symbol || "") as string)
        .filter((s: string) => s.length > 0)
    ));

    const [stats, price, holders] = await Promise.all([
      getEcosystemStats(address, txData, transferData),
      getPriceTracker(address, transferData.items),
      Promise.all([getNativeTopHolders(address), getWprosTopHolders(address)]),
    ]);

    const [airdrop, timeline, risk] = await Promise.all([
      Promise.resolve(checkAirdropEligibility({
        txCount:              stats.totalTransactions,
        uniqueContracts:      stats.uniqueContractsInteracted,
        receivedTokenSymbols: received,
        hasLpPositions:       liquidity.erc20Positions.length > 0 || liquidity.v3ActiveTokenIds.length > 0,
        firstActivity:        stats.firstActivity,
        gasSpent:             parseFloat(stats.totalGasSpent),
      })),
      Promise.resolve(getTransactionTimeline(txData.items)),
      Promise.resolve(analyzeRisk(address, txData.items, transferData.items)),
    ]);

    const gasFees = txData.items
      .map((t: any) => ({
        fee:    parseFloat(t.transaction_fee || "0"),
        feeUsd: parseFloat(t.transaction_fee_usd || "0"),
        hash:   (t.hash || t.transaction_hash || "") as string,
        date:   (t.block_timestamp || "") as string,
      }))
      .filter(t => t.fee > 0);

    const score = computeScore(txData.items, transferData.items, nftData.items, lower);

    res.json({
      ok: true,
      data: {
        score,
        stats,
        yield:     getRwaYield(address, transferData.items),
        risk,
        price,
        airdrop,
        nft:       getNftPortfolio(address, nftData.items),
        liquidity,
        gas: {
          txCount:    txData.total,
          txWithFees: gasFees.length,
          totalGas:   gasFees.reduce((s, t) => s + t.fee, 0),
          totalGasUsd:gasFees.reduce((s, t) => s + t.feeUsd, 0),
          avgGas:     gasFees.length > 0 ? gasFees.reduce((s, t) => s + t.fee, 0) / gasFees.length : 0,
          topTx:      gasFees.reduce((m, t) => t.fee > m.fee ? t : m, { fee: 0, feeUsd: 0, hash: "", date: "" }),
        },
        timeline,
        holders: { native: holders[0], wpros: holders[1] },
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Pharos RealFi Intelligence Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
});
