import { ethers } from "ethers";

export const RPC_URL = "https://rpc.pharos.xyz";
export const CHAIN_ID = 1672;
export const EXPLORER_API = "https://api.socialscan.io/pharos-mainnet/v1/explorer";

export const TOKENS = {
  USDC: { address: "0xc879c018db60520f4355c26ed1a6d572cdac1815", decimals: 6, symbol: "USDC" },
  WPROS: { address: "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0", decimals: 18, symbol: "WPROS" },
  WETH: { address: "0x5ed00449a0d0b6a9f26fd6af05832808a8b96bbe", decimals: 18, symbol: "WETH" },
  LINK: { address: "0x15a808e1a9d738c60c2a65b58c4aa8416acb49e6", decimals: 18, symbol: "LINK" },
};

export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  pALPHA: 18,
  "S-pALPHA": 18,
  "P-pALPHA": 18,
  "AQ-pALPHA": 18,
  "SS-pAlpha": 18,
  aqLP: 18,
  PROS: 18,
  WPROS: 18,
  WETH: 18,
  LINK: 18,
};

export const RWA_PROTOCOLS = {
  pAlpha: {
    name: "pAlpha High Yield RWA Vault",
    tokens: ["pALPHA", "S-pALPHA", "P-pALPHA", "SS-pAlpha", "AQ-pALPHA", "aqLP"],
    url: "https://port.pharos.xyz",
  },
  faroswap: {
    name: "FaroSwap DEX",
    tokens: ["WPROS", "USDC"],
    url: "https://faroswap.xyz",
  },
  zonapharos: {
    name: "Zona Pharos",
    tokens: ["zProsWPROS", "zProsUSDC"],
    url: "https://port.pharos.xyz",
  },
  openfi: {
    name: "OpenFi",
    tokens: ["bUSDC"],
    url: "https://port.pharos.xyz",
  },
};

export interface WalletData {
  address: string;
  prosBalance: number;
  tokens: TokenBalance[];
  transactions: Transaction[];
  tokenTransfers: TokenTransfer[];
}

export interface TokenBalance {
  symbol: string;
  balance: number;
  address: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  transaction_fee: string;
  block_timestamp: string;
  receipt_status: number;
}

export interface TokenTransfer {
  token_symbol: string;
  token_address: string;
  from_address: string;
  to_address: string;
  value: string;
  block_timestamp: string;
}