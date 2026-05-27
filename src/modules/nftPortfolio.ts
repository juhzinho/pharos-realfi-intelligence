export interface NftHolding {
  tokenId: string;
  symbol: string;
  contractAddress: string;
  receivedDate: string;
}

export interface NftCollection {
  symbol: string;
  name: string;
  contractAddress: string;
  holdings: NftHolding[];
}

export interface NftPortfolioResult {
  collections: NftCollection[];
  totalHeld: number;
  totalReceived: number;
}

export function getNftPortfolio(wallet: string, nftTransfers: any[]): NftPortfolioResult {
  const walletLower = wallet.toLowerCase();

  type Meta = { symbol: string; name: string; contract: string; date: string };
  const received = new Map<string, Meta>(); // key = "contract:tokenId"
  const sent     = new Set<string>();

  for (const t of nftTransfers) {
    const contract = (
      t.token_contract_address ?? t.contract_address ?? t.address ?? t.token ?? ""
    ).toLowerCase();
    const tokenId  = String(t.token_id ?? t.tokenId ?? "");
    if (!tokenId) continue;

    const symbol = t.token_symbol ?? t.symbol ?? "NFT";
    const name   = t.token_name ?? t.name ?? symbol;
    const keyPrefix = contract || symbol.toLowerCase();
    const key = `${keyPrefix}:${tokenId}`;
    const date   = t.block_timestamp ?? "";

    if (t.to_address?.toLowerCase() === walletLower)   received.set(key, { symbol, name, contract, date });
    if (t.from_address?.toLowerCase() === walletLower) sent.add(key);
  }

  const activeKeys = Array.from(received.keys()).filter(k => !sent.has(k));
  const collMap = new Map<string, NftCollection>();

  for (const key of activeKeys) {
    const meta    = received.get(key)!;
    const tokenId = key.includes(":") ? key.split(":").slice(1).join(":") : key;
    if (!collMap.has(meta.contract)) {
      collMap.set(meta.contract, {
        symbol:          meta.symbol,
        name:            meta.name,
        contractAddress: meta.contract,
        holdings:        [],
      });
    }
    collMap.get(meta.contract)!.holdings.push({
      tokenId,
      symbol:          meta.symbol,
      contractAddress: meta.contract,
      receivedDate:    meta.date,
    });
  }

  const collections = Array.from(collMap.values()).sort((a, b) => b.holdings.length - a.holdings.length);

  return {
    collections,
    totalHeld:     activeKeys.length,
    totalReceived: received.size,
  };
}
