export interface MonthBucket {
  month: string;
  txCount: number;
  gasSpent: number;
  topContract: string;
}

export interface TimelineResult {
  buckets: MonthBucket[];
  mostActiveMonth: string;
  trend: "increasing" | "decreasing" | "stable";
}

export function getTransactionTimeline(transactions: any[]): TimelineResult {
  type Acc = { txCount: number; gasSpent: number; contracts: Record<string, number> };
  const map: Record<string, Acc> = {};

  for (const tx of transactions) {
    const ts: string = tx.block_timestamp ?? "";
    if (!ts) continue;
    const month = ts.slice(0, 7); // "YYYY-MM"
    if (!map[month]) map[month] = { txCount: 0, gasSpent: 0, contracts: {} };
    map[month].txCount++;
    map[month].gasSpent += parseFloat(tx.transaction_fee || "0");
    const to = (tx.to_address || "").toLowerCase();
    if (to) map[month].contracts[to] = (map[month].contracts[to] || 0) + 1;
  }

  const sortedKeys = Object.keys(map).sort();
  const last12Keys = sortedKeys.slice(-12);

  const buckets: MonthBucket[] = last12Keys.map(month => {
    const d = map[month];
    const topEntries = Object.entries(d.contracts).sort(([, a], [, b]) => b - a);
    const topFull = topEntries[0]?.[0] ?? "";
    const topContract = topFull
      ? `${topFull.slice(0, 6)}...${topFull.slice(-4)}`
      : "—";
    return { month, txCount: d.txCount, gasSpent: d.gasSpent, topContract };
  });

  const mostActive = buckets.reduce(
    (m, b) => b.txCount > m.txCount ? b : m,
    { month: "—", txCount: 0, gasSpent: 0, topContract: "—" }
  );

  let trend: TimelineResult["trend"] = "stable";
  if (buckets.length >= 2) {
    const half      = Math.floor(buckets.length / 2);
    const firstSum  = buckets.slice(0, half).reduce((s, b) => s + b.txCount, 0);
    const secondSum = buckets.slice(half).reduce((s, b) => s + b.txCount, 0);
    if (secondSum > firstSum * 1.1)      trend = "increasing";
    else if (secondSum < firstSum * 0.9) trend = "decreasing";
  }

  return { buckets, mostActiveMonth: mostActive.month, trend };
}
