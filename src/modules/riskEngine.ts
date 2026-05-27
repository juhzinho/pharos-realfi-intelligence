export function analyzeRisk(wallet: string, transactions: any[], transfers: any[]) {
  const failedTxs = transactions.filter((t: any) => t.receipt_status === 0);
  const failRate = transactions.length > 0 ? (failedTxs.length / transactions.length) * 100 : 0;

  const uniqueContracts = new Set(transactions.map((t: any) => t.to_address).filter(Boolean));
  const largeTransfers = transfers.filter((t: any) => parseFloat(t.value || "0") > 50000);

  let riskScore = 0;
  const riskFlags: string[] = [];

  if (failRate > 20) {
    riskScore += 30;
    riskFlags.push(`High failure rate: ${failRate.toFixed(1)}% of transactions failed`);
  }
  if (largeTransfers.length > 5) {
    riskScore += 25;
    riskFlags.push(`${largeTransfers.length} large transfers detected (over $50,000)`);
  }
  if (uniqueContracts.size > 20) {
    riskScore += 15;
    riskFlags.push(`Interacts with ${uniqueContracts.size} different contracts`);
  }
  if (transactions.length > 200) {
    riskScore += 10;
    riskFlags.push("Very high transaction volume");
  }

  const riskLevel =
    riskScore === 0 ? "LOW" :
    riskScore <= 20 ? "LOW" :
    riskScore <= 50 ? "MEDIUM" : "HIGH";

  return {
    riskScore,
    riskLevel,
    riskFlags,
    failedTransactions: failedTxs.length,
    failRate: failRate.toFixed(1),
    uniqueContracts: uniqueContracts.size,
    largeTransferCount: largeTransfers.length,
    summary:
      riskLevel === "LOW" ? "Wallet shows normal activity patterns" :
      riskLevel === "MEDIUM" ? "Some unusual patterns detected — review recommended" :
      "High risk indicators detected — detailed review strongly recommended",
  };
}
