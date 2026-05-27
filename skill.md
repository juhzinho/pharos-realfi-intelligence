---
name: pharos-realfi-intelligence
description: >
  Use this skill when the user wants AI-powered analysis of a wallet on Pharos Network.
  Invoke when the user mentions "realfi intelligence", "analyze my wallet", "portfolio advice",
  "whale detection", "risk analysis", "RWA yield", "ecosystem stats", "smart analysis",
  "portfolio score", or wants a comprehensive onchain intelligence report on Pharos mainnet.
version: 1.0.0
author: community
requires:
  skills:
    - pharos-skill-engine
  runtime:
    - node >= 18
  dependencies:
    - ethers@^6.0.0
    - chalk@^5.0.0
---

# Pharos RealFi Intelligence Engine

AI-powered onchain intelligence skill for Pharos Network mainnet.
Analyzes wallets across 5 modules using direct RPC calls — no API keys required.

## Modules

1. Ecosystem Stats — transactions, gas, tokens, activity timeline
2. RWA Yield Tracker — yield earned per protocol (pAlpha, FaroSwap, Zona Pharos, OpenFi)
3. Whale Detector — large transfer detection and suspicious activity alerts
4. Portfolio Advisor — RWA exposure analysis and AI recommendations
5. Risk Engine — failed transactions, contract risk, suspicious patterns

## Installation

git clone https://github.com/YOUR_USERNAME/pharos-realfi-intelligence
cd pharos-realfi-intelligence
npm install

## Usage

npx ts-node src/index.ts 0xYourWalletAddress

## Networks

Pharos Mainnet (chain 1672) — RPC: https://rpc.pharos.xyz

## Example Prompts

"Analyze wallet 0x... on Pharos mainnet with full intelligence report"
"Show me the RWA yield and risk score for 0x... on Pharos"
"Is wallet 0x... a whale on Pharos Network?"
"Give me portfolio advice for 0x... on Pharos mainnet"
"What is the risk level of wallet 0x... on Pharos?"

## Security Notes

- Read-only skill. No private key required.
- All data from public RPC and explorer API.
- No API keys needed.