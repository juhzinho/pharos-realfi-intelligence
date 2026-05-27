import { RPC_URL, TOKEN_DECIMALS } from "../types";
import { resolveTokenSymbol } from "../utils/tokenUtils";

export async function getEcosystemStats(
  wallet: string,
  txData: { items: any[]; total: number },
  transferData: { items: any[]; total: number }
) {
  const { items: transactions, total: totalTxs } = txData;
  const { items: transfers, total: totalTransfers } = transferData;

  const uniqueTokens = new Set(transfers.map((t: any) => resolveTokenSymbol(t.token_address || "", t.token_symbol || "UNKNOWN")).filter(Boolean));
  const uniqueContracts = new Set(transactions.map((t: any) => t.to_address).filter(Boolean));

  const totalGas = transactions.reduce((sum: number, t: any) => {
    const raw: string = t.transaction_fee || "0";
    const fee = raw.includes(".")
      ? parseFloat(raw)
      : parseFloat(raw) / Math.pow(10, TOKEN_DECIMALS["PROS"] ?? 18);
    return sum + fee;
  }, 0);

  // API returns items newest-first; last element is the oldest.
  const lastTx = transactions[0];
  const firstTx = transactions[transactions.length - 1];

  const tokenActivity: Record<string, number> = {};
  for (const t of transfers) {
    const symbol: string = resolveTokenSymbol(t.token_address || "", t.token_symbol || "UNKNOWN");
    tokenActivity[symbol] = (tokenActivity[symbol] ?? 0) + 1;
  }
  const mostActiveEntry = Object.entries(tokenActivity).sort((a, b) => b[1] - a[1])[0];

  const rpcRes = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
  });
  const rpcData = await rpcRes.json();
  const latestBlock = parseInt(rpcData.result, 16);

  return {
    totalTransactions: totalTxs,
    totalTokenTransfers: totalTransfers,
    uniqueTokensUsed: uniqueTokens.size,
    uniqueContractsInteracted: uniqueContracts.size,
    totalGasSpent: totalGas.toFixed(6),
    latestBlock,
    firstActivity: firstTx?.block_timestamp || "N/A",
    lastActivity: lastTx?.block_timestamp || "N/A",
    mostActiveToken: mostActiveEntry ? mostActiveEntry[0] : "N/A",
    mostActiveTokenTransfers: mostActiveEntry ? mostActiveEntry[1] : 0,
  };
}
