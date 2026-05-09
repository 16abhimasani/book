# Chains & Protocols Considered

Notes on what was researched during V1 scoping. Most of this was
parked for V2/V3 in service of getting V1 shipped on Base alone.

---

## Why Base wins V1

- **Single-chain simplicity.** Coinbase L2; no bridging. USDC native via CCTP.
- **First-party SDK in Coinbase CDP.** Wallet + onramp + on-chain calls
  in one package, with explicit AI-agent docs at `docs.base.org/ai-agents`.
- **Onramp accessible to anyone.** CDP Onramp widget + Coinbase
  account = USD → USDC on Base in minutes. Best onramp UX in crypto
  in 2026.
- **Cheap iteration.** ~$0.001 / swap. Can lose dozens of tries to
  bugs without hurting.
- **Uniswap V3 on Base** — the most LLM-context-rich AMM in crypto.
  Claude knows the ABIs, swap router, quoter, fee tiers, slippage
  patterns by heart.

---

## Hyperliquid (V2 candidate)

- **What it is.** Custom L1, fully on-chain perps + spot order book,
  HyperEVM for smart contracts, programmable vaults, native HYPE token.
- **Why interesting.** Best L1 perps API in crypto (REST + WS, official
  Python + TS SDKs), $1B+ TVL, deep liquidity.
- **Why not V1.** Onramp = bridge USDC from Arbitrum → HL. Not
  one-click for "anyone." User would need an existing crypto position
  somewhere first.
- **V2 fit.** Once V1 plumbing works on Base, copy the same wallet +
  risk + log layers and swap the venue adapter to Hyperliquid. Their
  vaults are also a clean way to LP / provide liquidity programmatically.

References to revisit:
- `https://hyperliquid.gitbook.io/hyperliquid-docs`
- Official TS SDK on npm

---

## Sui — DeepBook + Aftermath (V2/V3 candidate)

User's existing liquidity is on Sui, so this gets first-look priority
in V2.

### DeepBook

- **What it is.** Native, on-chain CLOB baked into the Sui protocol —
  the only general-purpose L1 with a first-class CLOB primitive.
- **Why interesting.** Underdeveloped tooling = real edge for an early
  market-making bot. Sui DeFi is broadly under-built vs Solana / Base.
- **Why not V1.** Funding requires buying SUI + USDC on an exchange
  and bridging. Onramp UX fails the "anyone can use" bar.

### Aftermath Finance

- **What it is.** Sui's mature on-chain DEX: aggregator, perps, afSUI
  liquid staking. TS SDK exists (`aftermath-ts-sdk` on npm).
- **Differentiator.** Fully on-chain settlement (auditable fills + liqs).
- **V2 fit.** The aggregator is the simpler entry point on Sui;
  DeepBook is the higher-edge play once the bot is mature.

### WaterX

- AI-branded perps DEX on Sui. 50x leverage, USDsui collateral, WLP
  liquidity pool. Newer / less proven than Aftermath. Worth tracking
  as a competitive reference rather than as an integration target.

---

## Solana — Jupiter + Drift + Kamino (V2 candidate)

- **Jupiter Aggregator.** Best DEX aggregator in crypto. Excellent TS
  SDK. Single API for all Solana liquidity.
- **Drift Protocol.** Solana perps with vaults.
- **Kamino.** Lending + leveraged yield strategies.
- **Why not V1.** User has Phantom expertise so this would be
  productive for them, but onramp paths are fragmented (Phantom built-in,
  Moonpay, Coinbase, etc.) — pick one and stitch. CDP Onramp wins on
  consolidation.
- **V2 fit.** Add Jupiter as a second venue; the abstractions built
  for Uniswap-on-Base map cleanly to Jupiter (quote → swap → log).

---

## Bittensor / Taoshi SN8 (signal source for V2/V3)

- **What it is.** Decentralized predictive trading marketplace on
  Bittensor's Subnet 8. Miners submit signals, validators score on
  risk-adjusted returns, top performers earn TAO emissions
  ($30M+ annualized pool).
- **Why interesting.** Commoditized alpha — pay for an API key, get
  signals, classical bot executes. Same pattern as Numerai but on-chain.
- **Why not V1.** Adds a paid external dependency before V1 plumbing
  is proven. Also, "is the signal good?" is its own research project.
- **V2/V3 fit.** Once V1 has a clean signal-in → trade-out abstraction,
  Taoshi becomes one possible signal feed among many (along with
  in-house news parsing via local Qwen).

References:
- `docs.taoshi.io`
- `github.com/taoshidev`

---

## Prediction markets (V3+ candidate)

- **Polymarket.** Polygon-based binary prediction markets.
- **Kalshi.** CFTC-regulated prediction markets in the US.
- **LimitLess.** EVM prediction markets.
- **Why later.** Prediction-market trading is its own deep rabbit
  hole (event resolution risk, slow markets, manual research-heavy
  flow). Doesn't share much code with a perp/spot trading bot.

---

## Stablecoin yield venues (V3+ candidate)

- **Spark.** Aave-style lending optimized for stablecoins.
- **Ethena.** sUSDe — synthetic dollar with funding-rate yield.
- **Why later.** Idle-USDC yield is a separate product loop from
  active trading. Worth adding once the bot has steady state and
  parked capital between trades.

---

## Headless onramp options (briefly evaluated)

| Onramp | Fee | "Anyone can use" | Chain coverage |
|---|---|---|---|
| **Coinbase CDP** ✅ | ~1% | Best — Coinbase has 100M+ accts | Base, Ethereum, Solana, Polygon, more |
| Stripe Crypto Onramp | ~1.5% | Strong — Stripe-backed KYC | Solana, Base, Ethereum |
| Moonpay | ~3-5% | OK | Many chains, widget UX is uneven |
| Transak | ~3-5% | OK | Many chains |
| Ramp | ~3-5% | OK | EU-friendly |
| Phantom built-in | varies | Solana-only audience | Solana |

**Winner for V1:** CDP Onramp. Lowest fee + cleanest UX + first-party SDK.

---

## What's NOT being considered (and why)

- Centralized exchange APIs (Binance, Coinbase Pro, Kraken). Goal is
  on-chain native; CEX adds custody risk and a different kind of API
  surface.
- Pumpfun-style speculative tokens. Risk profile doesn't match a
  $200-capital boring rebalancer.
- MEV / sandwich bots. Zero-sum, infrastructure-heavy, not a
  beginner-bot use case.
