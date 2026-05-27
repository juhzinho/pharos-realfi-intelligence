import { RWA_PROTOCOLS } from "../types";
import { resolveTokenSymbol } from "../utils/tokenUtils";

export function getPortfolioAdvice(wallet: string, transfers: any[]) {
  const tokenMap: Record<string, { received: number; sent: number }> = {};

  for (const t of transfers) {
    const symbol = resolveTokenSymbol(t.token_address || "", t.token_symbol || "UNKNOWN");
    const value = parseFloat(t.value || "0");
    if (!tokenMap[symbol]) tokenMap[symbol] = { received: 0, sent: 0 };
    if (t.to_address?.toLowerCase() === wallet.toLowerCase()) tokenMap[symbol].received += value;
    if (t.from_address?.toLowerCase() === wallet.toLowerCase()) tokenMap[symbol].sent += value;
  }

  const totalReceived = Object.values(tokenMap).reduce((sum, t) => sum + t.received, 0);
  const rwaExposure = Object.entries(tokenMap)
    .filter(([symbol]) =>
      Object.values(RWA_PROTOCOLS).some(p =>
        p.tokens.some(t => t === symbol || symbol.startsWith(t) || t.startsWith(symbol))
      )
    )
    .reduce((sum, [, t]) => sum + t.received, 0);

  const rwaPercent = totalReceived > 0 ? (rwaExposure / totalReceived) * 100 : 0;
  const topTokens = Object.entries(tokenMap)
    .sort((a, b) => b[1].received - a[1].received)
    .slice(0, 3)
    .map(([symbol, data]) => ({ symbol, received: data.received, sent: data.sent }));

  const recommendations: string[] = [];
  if (rwaPercent < 20) recommendations.push("Consider increasing RWA exposure via pAlpha Vault for higher yield");
  if (rwaPercent > 80) recommendations.push("Portfolio heavily concentrated in RWA — consider diversifying");
  if (topTokens.length === 1) recommendations.push("Only 1 token detected — diversify across FaroSwap and pAlpha");
  if (rwaPercent >= 20 && rwaPercent <= 60) recommendations.push("Good RWA balance! Consider Zona Pharos for additional yield");

  return {
    totalTokens: Object.keys(tokenMap).length,
    rwaExposurePercent: rwaPercent.toFixed(1),
    topTokens,
    recommendations,
    summary:
      rwaPercent > 50
        ? "RWA-focused portfolio — well aligned with Pharos RealFi ecosystem"
        : "Diversified portfolio — good base for RealFi exposure",
  };
}
