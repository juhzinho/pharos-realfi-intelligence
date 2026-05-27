// Only override symbols where the Pharos explorer API returns the wrong name.
// USDC and WETH are NOT listed here because the API returns their symbols correctly,
// and those addresses collide with other Pharos-native contracts (e.g. S-pALPHA vault).
const TOKEN_ADDRESS_TO_SYMBOL: Record<string, string> = {
  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0": "WPROS",
};

export function resolveTokenSymbol(address: string, apiSymbol: string): string {
  if (!address) return apiSymbol;
  return TOKEN_ADDRESS_TO_SYMBOL[address.toLowerCase()] ?? apiSymbol;
}
