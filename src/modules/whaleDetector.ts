import { resolveTokenSymbol } from "../utils/tokenUtils";

const WHALE_THRESHOLD = 10000;

export function detectWhales(wallet: string, transfers: any[]) {
  const whaleTransfers = transfers.filter((t: any) => parseFloat(t.value || "0") >= WHALE_THRESHOLD);

  const largestTransfer = transfers.reduce((max: any, t: any) => {
    return parseFloat(t.value || "0") > parseFloat(max?.value || "0") ? t : max;
  }, null);

  const suspicious = transfers.filter((t: any) => parseFloat(t.value || "0") >= WHALE_THRESHOLD * 5);

  return {
    isWhale: whaleTransfers.length > 0,
    whaleTransferCount: whaleTransfers.length,
    largestTransfer: largestTransfer
      ? {
          value: parseFloat(largestTransfer.value || "0"),
          token: resolveTokenSymbol(largestTransfer.token_address || "", largestTransfer.token_symbol || ""),
          date: largestTransfer.block_timestamp,
          hash: largestTransfer.transaction_hash,
        }
      : null,
    suspiciousCount: suspicious.length,
    alert: whaleTransfers.length > 0
      ? `Whale detected! ${whaleTransfers.length} transfers over $${WHALE_THRESHOLD}`
      : "Normal wallet activity",
  };
}
