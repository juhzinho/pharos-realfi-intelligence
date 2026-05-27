# Pharos RealFi Intelligence Engine

AI-powered onchain intelligence for Pharos Network (Pacific Mainnet, chain 1672).
13 modules covering wallet analytics, RWA yield, whale detection, portfolio advice,
risk scoring, liquidity positions, gas fees, top holders, price tracking, airdrop
eligibility, NFT portfolio, transaction timeline, and cross-wallet comparison.

## Installation

```bash
git clone https://github.com/juhzinho/pharos-realfi-intelligence
cd pharos-realfi-intelligence
npm install
```

## Usage

```bash
npx ts-node src/index.ts <wallet> <flag>
```

## Modules

| Flag | Module | Description |
|------|--------|-------------|
| `--stats` | Ecosystem Stats | Transactions, tokens, contracts, gas, activity dates |
| `--yield` | RWA Yield | Yield by protocol: pAlpha, FaroSwap, Zona Pharos, OpenFi |
| `--whale` | Whale Detection | Large transfers and suspicious activity alerts |
| `--portfolio` | Portfolio Advisor | RWA exposure % with AI recommendations |
| `--risk` | Risk Engine | Risk score/100, failed txs, suspicious pattern flags |
| `--liquidity` | Liquidity Positions | ERC-20 LP tokens + FaroSwap V3 NFT positions |
| `--gas` | Gas Fees | Total/average PROS spent, most expensive tx |
| `--holders` | Top Holders | Native PROS + WPROS leaderboards with wallet rank |
| `--price` | Price Tracker | Live on-chain balances + full portfolio USD value |
| `--timeline` | Transaction Timeline | Monthly activity buckets and trend |
| `--airdrop` | Airdrop Checker | 6-criteria eligibility score and verdict |
| `--nft` | NFT Portfolio | All NFTs held, grouped by collection |
| `--compare` | Cross-Wallet Compare | Side-by-side comparison of two wallets |
| `--all` | Full Report | All 13 modules in one comprehensive report |

## Examples

```bash
# Full wallet report
npx ts-node src/index.ts 0xYourWallet --all

# Check airdrop eligibility
npx ts-node src/index.ts 0xYourWallet --airdrop

# Track RWA yield
npx ts-node src/index.ts 0xYourWallet --yield

# Compare two wallets
npx ts-node src/index.ts 0xWallet1 --compare 0xWallet2

# Start web dashboard
npm run server   # then open http://localhost:3000
```

## Web Dashboard

Run `npm run server` and open `http://localhost:3000` for a dark-theme SPA showing
all 13 modules with charts, gauges, and live data for any wallet address.

## Stack

- TypeScript + ethers.js v6
- Express.js web server
- Direct RPC: `https://rpc.pharos.xyz`
- Explorer API: `https://api.socialscan.io/pharos-mainnet`
- No API keys required — all public endpoints

## Network

| Network | Chain ID | RPC | Explorer |
|---------|----------|-----|----------|
| Pharos Mainnet | 1672 | https://rpc.pharos.xyz | https://www.pharosscan.xyz |

## License

MIT-0 — Free to use, modify, and redistribute.
