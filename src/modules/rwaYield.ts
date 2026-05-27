import { RWA_PROTOCOLS } from "../types";
import { resolveTokenSymbol } from "../utils/tokenUtils";

type TokenData = { received: number; sent: number; net: number; transfers: number; protocol: string };
export type YieldByProtocol = Record<string, Record<string, TokenData>>;

export function getRwaYield(wallet: string, allTransfers: any[]): YieldByProtocol {
  const result: YieldByProtocol = {};

  for (const transfer of allTransfers) {
    const symbol: string = resolveTokenSymbol(transfer.token_address || "", transfer.token_symbol || "UNKNOWN");
    const value = parseFloat(transfer.value || "0");

    const isReceived = transfer.to_address?.toLowerCase() === wallet.toLowerCase();
    const isSent = transfer.from_address?.toLowerCase() === wallet.toLowerCase();

    if (!isReceived && !isSent) continue;

    let protocolName = "Other";
    for (const [, protocol] of Object.entries(RWA_PROTOCOLS)) {
      if (protocol.tokens.some(t => t === symbol || symbol.startsWith(t) || t.startsWith(symbol))) {
        protocolName = protocol.name;
        break;
      }
    }

    if (!result[protocolName]) result[protocolName] = {};
    if (!result[protocolName][symbol]) {
      result[protocolName][symbol] = { received: 0, sent: 0, net: 0, transfers: 0, protocol: protocolName };
    }

    const entry = result[protocolName][symbol];
    if (isReceived) entry.received += value;
    if (isSent) entry.sent += value;
    entry.net = entry.received - entry.sent;
    entry.transfers++;
  }

  return result;
}
