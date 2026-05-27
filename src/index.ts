import { getRwaYield } from "./modules/rwaYield";
import { detectWhales } from "./modules/whaleDetector";
import { getPortfolioAdvice } from "./modules/portfolioAdvisor";
import { analyzeRisk } from "./modules/riskEngine";
import { getEcosystemStats } from "./modules/ecosystemStats";
import { getLiquidityPositions } from "./modules/liquidityPositions";
import { getNativeTopHolders, getWprosTopHolders } from "./modules/topHolders";
import { getPriceTracker } from "./modules/priceTracker";
import { getTransactionTimeline } from "./modules/transactionTimeline";
import { checkAirdropEligibility } from "./modules/airdropChecker";
import { getNftPortfolio } from "./modules/nftPortfolio";
import { compareWallets } from "./modules/crossWalletCompare";
import { EXPLORER_API } from "./types";

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter(a => !a.startsWith("--"));
const wallet  = positional[0] || "";
const wallet2 = (positional[1] && positional[1].startsWith("0x") && positional[1].length === 42) ? positional[1] : null;

const FLAGS = [
  "--all", "--stats", "--yield", "--whale", "--portfolio", "--risk",
  "--liquidity", "--gas", "--holders", "--price", "--timeline",
  "--airdrop", "--nft", "--compare",
] as const;

const has = (f: string) => rawArgs.includes(f);
const activeFlag = FLAGS.find(f => has(f));

function showHelp() {
  console.log(`
================================================================
  PHAROS REALFI INTELLIGENCE ENGINE v1.0.0
  Usage: npx ts-node src/index.ts <wallet> [flag]
================================================================
  Flags:
  --all          Run all 13 modules
  --stats        Ecosystem Stats
  --yield        RWA Yield by Protocol
  --whale        Whale Detection
  --portfolio    Portfolio Advisor
  --risk         Risk Engine
  --liquidity    Liquidity Positions
  --gas          Gas Fees
  --holders      Top 20 Holders (PROS & WPROS)
  --price        Price Tracker & Portfolio USD Value
  --timeline     Transaction Timeline
  --airdrop      Airdrop Eligibility Checker
  --nft          NFT Portfolio
  --compare <w2> Cross-Wallet Compare
================================================================
`);
}

if (!wallet || !activeFlag) {
  showHelp();
  process.exit(0);
}
const run = (f: string) => has(f) || has("--all");

async function fetchAllPages(baseUrl: string): Promise<{ items: any[]; total: number }> {
  const items: any[] = [];
  let serverTotal = 0;
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}&page=${page}`);
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = data.data ?? [];
    if (batch.length === 0) break;
    items.push(...batch);
    serverTotal = data.total ?? items.length;
    if (items.length >= serverTotal) break;
    page++;
  }
  return { items, total: serverTotal };
}

async function main() {
  console.log("\n================================================================");
  console.log("   PHAROS REALFI INTELLIGENCE ENGINE v1.0.0");
  console.log("   Network: Mainnet (chain 1672)");
  console.log(`   Wallet: ${wallet}`);
  if (wallet2) console.log(`   Compare: ${wallet2}`);
  console.log("================================================================\n");

  // Determine which data sources are needed
  const needTx       = run("--stats") || run("--risk") || run("--gas") || run("--timeline") || run("--airdrop") || run("--compare");
  const needTransfer = run("--stats") || run("--yield") || run("--whale") || run("--portfolio") || run("--risk") || run("--liquidity") || run("--price") || run("--airdrop") || run("--compare");
  const needNft      = run("--liquidity") || run("--nft") || run("--compare");

  console.log("Fetching data from Pharos mainnet...\n");

  const [txData, transferData, nftData] = await Promise.all([
    needTx       ? fetchAllPages(`${EXPLORER_API}/address/${wallet}/transactions?limit=25`)    : Promise.resolve({ items: [], total: 0 }),
    needTransfer ? fetchAllPages(`${EXPLORER_API}/address/${wallet}/token_transfers?limit=25`) : Promise.resolve({ items: [], total: 0 }),
    needNft      ? fetchAllPages(`${EXPLORER_API}/address/${wallet}/nft_transfers?limit=25`)   : Promise.resolve({ items: [], total: 0 }),
  ]);

  // ── MODULE 1: ECOSYSTEM STATS ──
  if (run("--stats")) {
    const ecosystem = await getEcosystemStats(wallet, txData, transferData);
    console.log("----------------------------------------------------------------");
    console.log("  1. ECOSYSTEM STATS");
    console.log("----------------------------------------------------------------");
    console.log(`  Total Transactions:      ${ecosystem.totalTransactions}`);
    console.log(`  Total Token Transfers:   ${ecosystem.totalTokenTransfers}`);
    console.log(`  Unique Tokens Used:      ${ecosystem.uniqueTokensUsed}`);
    console.log(`  Unique Contracts:        ${ecosystem.uniqueContractsInteracted}`);
    console.log(`  Total Gas Spent:         ${ecosystem.totalGasSpent} PROS`);
    console.log(`  Latest Block:            ${ecosystem.latestBlock}`);
    console.log(`  First Activity:          ${ecosystem.firstActivity}`);
    console.log(`  Last Activity:           ${ecosystem.lastActivity}`);
    console.log(`  Most Active Token:       ${ecosystem.mostActiveToken} (${ecosystem.mostActiveTokenTransfers} transfers)\n`);
  }

  // ── MODULE 2: RWA YIELD ──
  if (run("--yield")) {
    const rwaYield = getRwaYield(wallet, transferData.items);
    console.log("----------------------------------------------------------------");
    console.log("  2. RWA YIELD BY PROTOCOL");
    console.log("----------------------------------------------------------------");
    const sortedProtocols = Object.entries(rwaYield).sort(([a], [b]) =>
      a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)
    );
    for (const [protocolName, tokens] of sortedProtocols) {
      const tokenEntries = Object.entries(tokens);
      if (tokenEntries.length === 0) continue;
      console.log(`\n  ${protocolName}:`);
      for (const [symbol, data] of tokenEntries) {
        const recv  = data.received.toFixed(6).padStart(16);
        const sent  = data.sent.toFixed(6).padStart(16);
        const net   = data.net.toFixed(6).padStart(16);
        const count = String(data.transfers).padStart(4);
        console.log(`    ${symbol.padEnd(16)} recv ${recv}  sent ${sent}  net ${net}  txs ${count}`);
      }
    }
    console.log("");
  }

  // ── MODULE 3: WHALE DETECTION ──
  if (run("--whale")) {
    const whales = detectWhales(wallet, transferData.items);
    console.log("----------------------------------------------------------------");
    console.log("  3. WHALE DETECTION");
    console.log("----------------------------------------------------------------");
    console.log(`  Status:          ${whales.alert}`);
    console.log(`  Whale Transfers: ${whales.whaleTransferCount}`);
    console.log(`  Suspicious:      ${whales.suspiciousCount}`);
    if (whales.largestTransfer) {
      console.log(`  Largest:         ${whales.largestTransfer.value.toFixed(2)} ${whales.largestTransfer.token}`);
      console.log(`  Date:            ${whales.largestTransfer.date}`);
    }
    console.log("");
  }

  // ── MODULE 4: PORTFOLIO ADVISOR ──
  if (run("--portfolio")) {
    const portfolio = getPortfolioAdvice(wallet, transferData.items);
    console.log("----------------------------------------------------------------");
    console.log("  4. PORTFOLIO ADVISOR");
    console.log("----------------------------------------------------------------");
    console.log(`  Total Tokens:      ${portfolio.totalTokens}`);
    console.log(`  RWA Exposure:      ${portfolio.rwaExposurePercent}%`);
    console.log(`  Summary:           ${portfolio.summary}`);
    console.log("  Top Tokens:");
    for (const token of portfolio.topTokens) {
      console.log(`    - ${token.symbol}: received ${token.received.toFixed(4)}`);
    }
    console.log("  Recommendations:");
    for (const rec of portfolio.recommendations) {
      console.log(`    * ${rec}`);
    }
    console.log("");
  }

  // ── MODULE 5: RISK ENGINE ──
  if (run("--risk")) {
    const risk = analyzeRisk(wallet, txData.items, transferData.items);
    console.log("----------------------------------------------------------------");
    console.log("  5. RISK ENGINE");
    console.log("----------------------------------------------------------------");
    console.log(`  Risk Level:      ${risk.riskLevel}`);
    console.log(`  Risk Score:      ${risk.riskScore}/100`);
    console.log(`  Failed Txs:      ${risk.failedTransactions} (${risk.failRate}%)`);
    console.log(`  Unique Contracts:${risk.uniqueContracts}`);
    console.log(`  Summary:         ${risk.summary}`);
    if (risk.riskFlags.length > 0) {
      console.log("  Flags:");
      for (const flag of risk.riskFlags) {
        console.log(`    ! ${flag}`);
      }
    }
    console.log("");
  }

  // ── MODULE 6: LIQUIDITY POSITIONS ──
  if (run("--liquidity")) {
    const liquidity = getLiquidityPositions(wallet, transferData.items, nftData.items);
    console.log("----------------------------------------------------------------");
    console.log("  6. LIQUIDITY POSITIONS");
    console.log("----------------------------------------------------------------");
    if (liquidity.erc20Positions.length === 0 && liquidity.v3ActiveTokenIds.length === 0) {
      console.log("  No liquidity positions found.");
    }
    if (liquidity.erc20Positions.length > 0) {
      console.log("\n  ERC-20 LP Tokens:");
      for (const pos of liquidity.erc20Positions) {
        console.log(`\n    ${pos.lpToken}  —  ${pos.pool}  (${pos.pair})`);
        console.log(`      Received:   ${pos.received.toFixed(6)}`);
        console.log(`      Sent:       ${pos.sent.toFixed(6)}`);
        console.log(`      Net held:   ${pos.net.toFixed(6)}`);
        console.log(`      Transfers:  ${pos.transfers}`);
      }
    }
    if (liquidity.v3TotalMinted > 0) {
      console.log(`\n  Uniswap V3 Positions (FaroSwap V3):`);
      console.log(`    Active positions: ${liquidity.v3ActiveTokenIds.length} / ${liquidity.v3TotalMinted} minted`);
      console.log(`    Token IDs:        ${liquidity.v3ActiveTokenIds.map(id => `#${id}`).join("  ")}`);
    }
    console.log("");
  }

  // ── MODULE 7: GAS FEES ──
  if (run("--gas")) {
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
    console.log("----------------------------------------------------------------");
    console.log("  7. TOTAL GAS FEES");
    console.log("----------------------------------------------------------------");
    console.log(`  Transactions with fees: ${gasFees.length} / ${txData.total}`);
    console.log(`  Total gas paid:         ${totalGas.toFixed(6)} PROS  (~$${totalGasUsd.toFixed(4)} USD)`);
    console.log(`  Average per tx:         ${avgGas.toFixed(6)} PROS`);
    if (topGasTx.hash) {
      console.log(`  Highest single tx:      ${topGasTx.fee.toFixed(6)} PROS  (~$${topGasTx.feeUsd.toFixed(4)} USD)`);
      console.log(`    Hash: ${topGasTx.hash}`);
      console.log(`    Date: ${topGasTx.date}`);
    }
    console.log("");
  }

  // ── MODULE 8: TOP HOLDERS ──
  if (run("--holders")) {
    const [nativeHolders, wprosHolders] = await Promise.all([
      getNativeTopHolders(wallet),
      getWprosTopHolders(wallet),
    ]);

    console.log("----------------------------------------------------------------");
    console.log("  8A. NATIVE PROS  —  TOP 20 HOLDERS");
    console.log("----------------------------------------------------------------");
    console.log(`  Total tracked: ${nativeHolders.totalTracked.toLocaleString("en-US")} holders`);
    if (nativeHolders.walletRank !== null) console.log(`  Your rank:     #${nativeHolders.walletRank}`);
    console.log(`  Your balance:  ${nativeHolders.walletBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} PROS`);
    console.log(`  Your %:        ${nativeHolders.walletPct.toFixed(6)}%`);
    console.log(`\n  ${"Rank".padEnd(6)} ${"Address / Label".padEnd(44)} ${"Balance".padStart(22)}  ${"% Supply".padStart(10)}`);
    console.log(`  ${"─".repeat(88)}`);
    for (const h of nativeHolders.top20) {
      const rankStr = `#${h.rank}`.padEnd(6);
      const addrStr = (h.displayName ?? `${h.address.slice(0, 10)}...${h.address.slice(-6)}`).padEnd(44);
      const balStr  = h.balance.toLocaleString("en-US", { maximumFractionDigits: 4 }).padStart(22);
      const pctStr  = h.percentage.toFixed(6).padStart(10) + "%";
      const tag     = h.isWallet ? "  ← YOUR WALLET" : "";
      if (h.isWallet && h.rank > 20) console.log(`  ${"─".repeat(88)}`);
      console.log(`  ${rankStr} ${addrStr} ${balStr}  ${pctStr}${tag}`);
    }

    console.log("\n----------------------------------------------------------------");
    console.log("  8B. WPROS (WRAPPED PROS)  —  TOP 20 HOLDERS");
    console.log("----------------------------------------------------------------");
    console.log(`  Token:         0x52c4...f0b0`);
    console.log(`  Total supply:  ${wprosHolders.totalSupply.toLocaleString("en-US", { maximumFractionDigits: 4 })} WPROS`);
    console.log(`  Total holders: ${wprosHolders.totalHolders.toLocaleString("en-US")}`);
    if (wprosHolders.walletBalance > 0) {
      console.log(`  Your balance:  ${wprosHolders.walletBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} WPROS`);
      console.log(`  Your %:        ${wprosHolders.walletPct.toFixed(6)}%`);
      if (wprosHolders.walletRank !== null) {
        console.log(`  Your rank:     #${wprosHolders.walletRank}`);
      } else {
        console.log(`  Your rank:     not found in holders list`);
      }
    } else {
      console.log(`  Your wallet:   0 WPROS`);
    }
    console.log(`\n  ${"Rank".padEnd(6)} ${"Address / Label".padEnd(44)} ${"Balance".padStart(22)}  ${"% Supply".padStart(10)}`);
    console.log(`  ${"─".repeat(88)}`);
    for (const h of wprosHolders.top20) {
      const rankStr = `#${h.rank}`.padEnd(6);
      const addrStr = (h.displayName ?? `${h.address.slice(0, 10)}...${h.address.slice(-6)}`).padEnd(44);
      const balStr  = h.balance.toLocaleString("en-US", { maximumFractionDigits: 4 }).padStart(22);
      const pctStr  = h.percentage.toFixed(6).padStart(10) + "%";
      const tag     = h.isWallet ? "  ← YOUR WALLET" : "";
      console.log(`  ${rankStr} ${addrStr} ${balStr}  ${pctStr}${tag}`);
    }
    console.log("");
  }

  // ── MODULE 9: PRICE TRACKER ──
  if (run("--price")) {
    const priceResult = await getPriceTracker(wallet, transferData.items);
    console.log("----------------------------------------------------------------");
    console.log("  9. PRICE TRACKER & PORTFOLIO USD VALUE");
    console.log("----------------------------------------------------------------");
    if (priceResult.prosUsd > 0) {
      console.log(`  PROS price: $${priceResult.prosUsd.toFixed(6)}  (source: ${priceResult.priceSource})`);
    } else {
      console.log(`  PROS price: unavailable  (${priceResult.priceSource})`);
    }
    if (priceResult.balances.length > 0) {
      console.log(`\n  ${"Token".padEnd(16)} ${"Net Balance".padStart(18)}  ${"Price USD".padStart(12)}  ${"Value USD".padStart(12)}`);
      console.log(`  ${"─".repeat(64)}`);
      for (const b of priceResult.balances) {
        const sym   = b.symbol.padEnd(16);
        const bal   = b.netBalance.toFixed(6).padStart(18);
        const price = b.priceUsd !== null ? `$${b.priceUsd.toFixed(6)}`.padStart(12) : "N/A".padStart(12);
        const val   = b.valueUsd > 0 ? `$${b.valueUsd.toFixed(4)}`.padStart(12) : "—".padStart(12);
        console.log(`  ${sym} ${bal}  ${price}  ${val}`);
      }
      console.log(`  ${"─".repeat(64)}`);
      console.log(`  ${"TOTAL".padEnd(16)} ${"".padStart(18)}  ${"".padStart(12)}  ${"$" + priceResult.totalUsd.toFixed(4)}`.padStart(12));
    } else {
      console.log("  No token balances found in transfer history.");
    }
    console.log("");
  }

  // ── MODULE 10: TRANSACTION TIMELINE ──
  if (run("--timeline")) {
    const timeline = getTransactionTimeline(txData.items);
    console.log("----------------------------------------------------------------");
    console.log("  10. TRANSACTION TIMELINE  (last 12 months)");
    console.log("----------------------------------------------------------------");
    if (timeline.buckets.length === 0) {
      console.log("  No transaction history found.");
    } else {
      console.log(`  ${"Month".padEnd(10)} ${"Txs".padStart(6)}  ${"Gas (PROS)".padStart(12)}  Top Contract`);
      console.log(`  ${"─".repeat(54)}`);
      for (const b of timeline.buckets) {
        const mon = b.month.padEnd(10);
        const txs = String(b.txCount).padStart(6);
        const gas = b.gasSpent.toFixed(6).padStart(12);
        console.log(`  ${mon} ${txs}  ${gas}  ${b.topContract}`);
      }
      console.log(`\n  Most active month: ${timeline.mostActiveMonth}`);
      console.log(`  Activity trend:    ${timeline.trend}`);
    }
    console.log("");
  }

  // ── MODULE 11: AIRDROP CHECKER ──
  if (run("--airdrop")) {
    const ecosystem = await getEcosystemStats(wallet, txData, transferData);
    const liquidity = getLiquidityPositions(wallet, transferData.items, nftData.items);
    const receivedTokens: string[] = Array.from(new Set<string>(
      transferData.items
        .filter((t: any) => t.to_address?.toLowerCase() === wallet.toLowerCase())
        .map((t: any) => (t.token_symbol || "") as string)
        .filter((s: string) => s.length > 0)
    ));
    const airdrop = checkAirdropEligibility({
      txCount:              ecosystem.totalTransactions,
      uniqueContracts:      ecosystem.uniqueContractsInteracted,
      receivedTokenSymbols: receivedTokens,
      hasLpPositions:       liquidity.erc20Positions.length > 0 || liquidity.v3ActiveTokenIds.length > 0,
      firstActivity:        ecosystem.firstActivity,
      gasSpent:             Number(ecosystem.totalGasSpent) || 0,
    });
    console.log("----------------------------------------------------------------");
    console.log("  11. AIRDROP ELIGIBILITY CHECKER");
    console.log("----------------------------------------------------------------");
    for (const c of airdrop.criteria) {
      const mark = c.passed ? "[✓]" : "[✗]";
      const label  = c.label.padEnd(24);
      const actual = c.actual.padEnd(28);
      console.log(`  ${mark} ${label} ${actual} (${c.required})`);
    }
    console.log(`\n  Score:   ${airdrop.score} / ${airdrop.maxScore}`);
    console.log(`  Verdict: ${airdrop.verdict}`);
    console.log("");
  }

  // ── MODULE 12: NFT PORTFOLIO ──
  if (run("--nft")) {
    const nftResult = getNftPortfolio(wallet, nftData.items);
    console.log("----------------------------------------------------------------");
    console.log("  12. NFT PORTFOLIO");
    console.log("----------------------------------------------------------------");
    if (nftResult.totalHeld === 0) {
      console.log(`  No NFTs held.  (${nftResult.totalReceived} received, all transferred out)`);
    } else {
      console.log(`  Total held: ${nftResult.totalHeld}  (${nftResult.totalReceived} received)`);
      for (const col of nftResult.collections) {
        console.log(`\n  ${col.symbol}  —  ${col.contractAddress.slice(0, 10)}...${col.contractAddress.slice(-6)}`);
        for (const h of col.holdings) {
          const date = h.receivedDate ? h.receivedDate.slice(0, 10) : "unknown";
          console.log(`    #${h.tokenId.padEnd(10)}  received ${date}`);
        }
      }
    }
    console.log("");
  }

  // ── MODULE 13: CROSS-WALLET COMPARE ──
  if (run("--compare") && wallet2) {
    const compareResult = await compareWallets(wallet, txData.items, transferData.items, nftData.items, wallet2);
    const { w1, w2, winner } = compareResult;
    const w1Short = `${w1.address.slice(0, 6)}...${w1.address.slice(-4)}`;
    const w2Short = `${w2.address.slice(0, 6)}...${w2.address.slice(-4)}`;
    const col1 = w1Short.padEnd(20);
    const col2 = w2Short.padEnd(20);

    console.log("----------------------------------------------------------------");
    console.log("  13. CROSS-WALLET COMPARE");
    console.log("----------------------------------------------------------------");
    console.log(`  ${"Metric".padEnd(26)} ${col1} ${col2}`);
    console.log(`  ${"─".repeat(68)}`);
    console.log(`  ${"Transactions".padEnd(26)} ${String(w1.txCount).padEnd(20)} ${w2.txCount}`);
    console.log(`  ${"Gas Spent (PROS)".padEnd(26)} ${w1.gasSpentPros.toFixed(4).padEnd(20)} ${w2.gasSpentPros.toFixed(4)}`);
    console.log(`  ${"RWA Exposure".padEnd(26)} ${(w1.rwaExposurePct.toFixed(1) + "%").padEnd(20)} ${w2.rwaExposurePct.toFixed(1)}%`);
    console.log(`  ${"Token Variety".padEnd(26)} ${String(w1.tokenVariety).padEnd(20)} ${w2.tokenVariety}`);
    console.log(`  ${"LP Positions".padEnd(26)} ${String(w1.lpPositions).padEnd(20)} ${w2.lpPositions}`);
    console.log(`  ${"Risk Score".padEnd(26)} ${(w1.riskScore + "/100").padEnd(20)} ${w2.riskScore}/100`);
    console.log(`  ${"Wallet Score".padEnd(26)} ${(w1.walletScore + "/100").padEnd(20)} ${w2.walletScore}/100`);
    console.log(`  ${"─".repeat(68)}`);
    console.log(`\n  WINNER: ${winner}  (${winner === "Wallet 1" ? w1.address : winner === "Wallet 2" ? w2.address : "both equal"})`);
    console.log("");
  } else if (has("--compare") && !wallet2) {
    console.log("----------------------------------------------------------------");
    console.log("  13. CROSS-WALLET COMPARE");
    console.log("----------------------------------------------------------------");
    console.log("  ERROR: --compare requires a second wallet address.");
    console.log("  Usage: npx ts-node src/index.ts <wallet1> --compare <wallet2>");
    console.log("");
  }

  console.log("================================================================");
  console.log(`  Explorer: https://www.pharosscan.xyz/address/${wallet}`);
  console.log("================================================================\n");
}

main().catch(console.error);
