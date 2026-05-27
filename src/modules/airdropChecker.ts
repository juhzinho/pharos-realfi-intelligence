export interface Criterion {
  label: string;
  passed: boolean;
  actual: string;
  required: string;
}

export interface AirdropResult {
  score: number;
  maxScore: number;
  criteria: Criterion[];
  verdict: "HIGHLY ELIGIBLE" | "ELIGIBLE" | "LOW ELIGIBILITY";
}

export interface AirdropInput {
  txCount: number;
  uniqueContracts: number;
  receivedTokenSymbols: string[];
  hasLpPositions: boolean;
  firstActivity: string;
  gasSpent: number;
}

const RWA_PATTERNS = ["palpha", "s-palpha", "aq-palpha", "p-palpha", "ss-palpha", "rwa"];

export function checkAirdropEligibility(input: AirdropInput): AirdropResult {
  const rwaTokens = input.receivedTokenSymbols.filter(s =>
    RWA_PATTERNS.some(p => s.toLowerCase().includes(p))
  );
  const holdsRwa = rwaTokens.length > 0;

  let walletAgeDays = 0;
  if (input.firstActivity && input.firstActivity !== "N/A") {
    const ms = Date.now() - new Date(input.firstActivity).getTime();
    walletAgeDays = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }

  const criteria: Criterion[] = [
    {
      label:    "Active user",
      passed:   input.txCount > 50,
      actual:   `${input.txCount} transactions`,
      required: "> 50 transactions",
    },
    {
      label:    "Multi-protocol user",
      passed:   input.uniqueContracts >= 3,
      actual:   `${input.uniqueContracts} protocols`,
      required: ">= 3 protocols",
    },
    {
      label:    "RWA token holder",
      passed:   holdsRwa,
      actual:   holdsRwa ? rwaTokens.slice(0, 3).join(", ") : "none",
      required: "holds pALPHA / S-pALPHA / etc.",
    },
    {
      label:    "Liquidity provider",
      passed:   input.hasLpPositions,
      actual:   input.hasLpPositions ? "yes" : "no",
      required: "has aqLP or UNI-V3-POS",
    },
    {
      label:    "Early user",
      passed:   walletAgeDays > 30,
      actual:   `${walletAgeDays} days old`,
      required: "wallet age > 30 days",
    },
    {
      label:    "Real contributor",
      passed:   input.gasSpent > 0.5,
      actual:   `${input.gasSpent.toFixed(4)} PROS spent`,
      required: "> 0.5 PROS gas spent",
    },
  ];

  const score = criteria.filter(c => c.passed).length;
  const verdict: AirdropResult["verdict"] =
    score >= 5 ? "HIGHLY ELIGIBLE" : score >= 3 ? "ELIGIBLE" : "LOW ELIGIBILITY";

  return { score, maxScore: criteria.length, criteria, verdict };
}
