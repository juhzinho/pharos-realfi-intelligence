# Pharos RealFi Intelligence Engine

AI-powered onchain intelligence skill for Pharos Network (Pacific Mainnet, chain 1672).

## Features

- Ecosystem Stats — transactions, gas spent, unique tokens and contracts
- RWA Yield Tracker — yield earned per protocol (pAlpha, FaroSwap, Zona Pharos, OpenFi)
- Whale Detector — large transfer detection and suspicious activity alerts
- Portfolio Advisor — RWA exposure analysis with AI recommendations
- Risk Engine — failed tx analysis, contract risk, suspicious pattern detection

## Installation

git clone https://github.com/YOUR_USERNAME/pharos-realfi-intelligence
cd pharos-realfi-intelligence
npm install

## Run Demo

npx ts-node src/index.ts 0xYourWalletAddress

## Example Output

================================================================
   PHAROS REALFI INTELLIGENCE ENGINE
   Network: Mainnet (chain 1672)
================================================================

1. ECOSYSTEM STATS
   Total Transactions:    275
   Unique Tokens Used:    9
   Total Gas Spent:       4.88 PROS

2. RWA YIELD BY PROTOCOL
   pAlpha High Yield RWA Vault
     Received:   1,847.23
     Net:        +184.72

3. WHALE DETECTION
   Status: Normal wallet activity
   Largest Transfer: 569.90 WETH

4. PORTFOLIO ADVISOR
   RWA Exposure: 67.3%
   Summary: RWA-focused portfolio — well aligned with Pharos RealFi

5. RISK ENGINE
   Risk Level: LOW
   Risk Score: 10/100

## Stack

TypeScript + ethers.js v6
Direct RPC: https://rpc.pharos.xyz
No API keys required

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Mainnet | 1672 | https://rpc.pharos.xyz |

## License

MIT-0 — Free to use, modify, and redistribute.