# book

Canonical repo for all of Ash's **automated trading**. Three surfaces:

- **`robinhood-agentic/`** — **live agentic trading** on Robinhood's
  Agentic platform (real money). Claude trades a dedicated account under
  a binding `POLICY.md`, journaling every run. Start here.
- **`ios/`** — native iOS / Swift app (in progress) for **DeepBook
  Predict** (Sui, testnet). Mobile-first prediction-market UX as the
  wedge against the DeepBook team's likely web-first official app.
- **`src/`** — TypeScript sandbox. Research scripts, indexer prototypes,
  programmatic strategy experiments.

**Status:** robinhood-agentic live with real capital (POLICY-governed).
DBP surfaces scaffolding, Sui testnet only, no public release. Venue
expansion (prediction markets, more crypto) parked but mapped in
[`docs/VENUES.md`](docs/VENUES.md).

## Why "book"

Two readings, both intended:
- **DeepBook** — the Sui-native CLOB the predict market sits on top of.
- **A trader's book** — the set of positions, hedges, and PnL the repo
  is meant to grow into.

## Quick orient (read in this order)

0. [`robinhood-agentic/README.md`](robinhood-agentic/README.md) — the
   live-money surface. Its `POLICY.md` is binding on agents;
   [`docs/VENUES.md`](docs/VENUES.md) is the venue-expansion roadmap.
1. [`docs/STRATEGY.md`](docs/STRATEGY.md) — current thesis (V1: iOS app
   on top of DeepBook Predict), t2000 / Audric finding, iOS pivot.
2. [`docs/STRATEGY-V2.md`](docs/STRATEGY-V2.md) — expanded vision:
   user-generated markets + LLM oracle as a separate protocol layer
   beside DBP. Contains 4 design decisions marked TODO.
3. [`docs/DEEPBOOK_PREDICT.md`](docs/DEEPBOOK_PREDICT.md) — protocol
   research notes with **concrete testnet integration targets** (package
   IDs, server endpoints, Move public API, live state snapshot).
4. [`docs/IOS.md`](docs/IOS.md) — Swift / iOS choices: SuiKit (community
   SDK), zkLogin path, Xcode prereq, App Store gauntlet.
5. [`AGENTS.md`](AGENTS.md) — cross-agent guidance + memory protocol.
6. [`docs/STACK.md`](docs/STACK.md) — local AI / dev tooling reference
   (Ollama, Cursor, opencode, Goose, etc).
7. [`docs/v1-base-bot/`](docs/v1-base-bot/) — archived original V1 plan
   (Base + Coinbase CDP + Uniswap V3 rebalancer). Parked, not deleted —
   chain/protocol research is still useful.

## Stack

**TypeScript sandbox** (`src/`):
- Bun + TypeScript
- [`@mysten/sui`](https://www.npmjs.com/package/@mysten/sui) `^2.16.0`
  (matches `~/dev/money-movement` for cross-project consistency)

**iOS app** (`ios/`):
- Swift 6.3 / SwiftPM
- [SuiKit](https://github.com/opendive/SuiKit) `^1.4.0` — community
  Swift SDK; native BCS, zkLogin, GraphQL via apollo-ios. Mysten doesn't
  ship a first-party Swift SDK.
- iOS 17+ / macOS 14+ targets
- iOS App target lives in Xcode (added Phase 2 — see `docs/STRATEGY.md`)

## Run

**TypeScript sandbox:**
```sh
bun install
bun run start                       # connects to Sui testnet, prints chain info
SUI_NETWORK=devnet bun run start    # override network
bun run typecheck
```

**iOS / Swift package** (compiles for macOS today; iOS requires Xcode):
```sh
cd ios
swift build
swift run book-cli                  # same Sui testnet smoke test as TS
SUI_NETWORK=devnet swift run book-cli
```

## Adjacent / inspiration

- **DeepBook App (official, in development).** Waitlist:
  https://waitlist.deepbook.tech (announced
  [@aslan_web3](https://x.com/aslan_web3/status/2052751520072892624)).
  Likely web-first. Our wedge is **native mobile + onramp**.
- **t2000 / Audric** ([t2000.ai](https://t2000.ai),
  [audric.ai](https://audric.ai)) — `@audricai`'s open-source agentic
  finance infra on Sui (wallet / send / save / borrow / swap / MCP +
  LLM agent harness). Doesn't cover prediction markets or native mobile.
  We're cherry-picking patterns, not depending on the SDK.
- **money-movement** (`~/dev/money-movement`) — Stripe / Plaid / Bridge
  onramp integration docs that fold into this app's onboarding (Phase 6
  per `docs/STRATEGY.md`).
- **DeepBook Predict docs** — https://docs.sui.io/onchain-finance/deepbook-predict/

## What's NOT in scope (yet) — DBP lane

(Scoped to the Sui/DeepBook lane. The robinhood-agentic lane *does* run
an LLM in the live loop — by design, governed by its POLICY.md.)

- **Mainnet anything** until DeepBook Predict ships there.
- **LLM in the DBP trade loop.** Models iterate strategy code and
  parse signals offline; on-chain execution stays deterministic.
- **Cross-chain.** Sui-only. Hyperliquid hedging is research-only.
- **Public release / TestFlight.** Local builds only — see
  `docs/IOS.md` §App Store reality check for the regulatory gauntlet.

## Owner

Ash Bhimasani — ex-Phantom Cash team. Personal sandbox. The Tempo /
Paradigm Fellowship anchor lives in `~/dev/money-movement/`.
