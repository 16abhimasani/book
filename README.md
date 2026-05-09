# book

On-chain experiments on **Sui**. Primary focus: **DeepBook Predict** —
oracle-driven prediction markets, currently testnet-only. Secondary: a
sandbox for general auto-trading work that doesn't fit anywhere else.

**Status:** scaffolding. No live trading. Sui testnet only.

## Why "book"

Two readings, both intended:
- **DeepBook** — the Sui-native CLOB the predict market sits on top of.
- **A trader's book** — the set of positions, hedges, and PnL the repo
  is meant to grow into.

## Quick orient (read in this order)

1. [`docs/DEEPBOOK_PREDICT.md`](docs/DEEPBOOK_PREDICT.md) — what the
   protocol is, primitives, open questions, build ideas.
2. [`AGENTS.md`](AGENTS.md) — cross-agent guidance + memory protocol.
3. [`docs/STACK.md`](docs/STACK.md) — local AI + dev tooling (Ollama,
   Cursor, opencode, Goose, etc). Carried over from the V1 plan.
4. [`docs/v1-base-bot/`](docs/v1-base-bot/) — archived V1 plan
   (Base + Coinbase CDP + Uniswap V3 rebalancer). Parked, not deleted —
   the chain/protocol research in `CHAINS_AND_PROTOCOLS.md` is still
   useful when picking hedging venues.

## Stack

- **Runtime:** Bun + TypeScript (`tsconfig.json`, `src/`).
- **Sui SDK:** [`@mysten/sui`](https://www.npmjs.com/package/@mysten/sui)
  `^2.16.0` (matches `~/dev/money-movement` for cross-project consistency).
- **DeepBook Predict SDK:** TBD — not located yet, see open questions in
  `docs/DEEPBOOK_PREDICT.md`.

## Run

```sh
bun install
bun run start            # connects to Sui testnet, prints chain info
SUI_NETWORK=devnet bun run start   # override network
bun run typecheck
```

## Adjacent / inspiration

- **DeepBook App (official, in development).** Waitlist:
  https://waitlist.deepbook.tech (announced
  [@aslan_web3](https://x.com/aslan_web3/status/2052751520072892624)).
  This repo deliberately avoids competing on consumer UX — focus is on
  the **agentic / programmatic** layer (LP strategies, scanners,
  backtesting, multi-leg builders).
- **money-movement** (`~/dev/money-movement`) — has working Sui client
  setup (`packages/web-demo/src/sui-dapp-kit.ts`) and broader payments
  SDK that this repo can borrow from when we need wallet flows.
- **DeepBook Predict docs** — https://docs.sui.io/onchain-finance/deepbook-predict/

## What's NOT in scope (yet)

- Mainnet anything. Testnet only until DeepBook Predict ships to mainnet.
- LLM in the live trade loop. Claude/local models iterate strategy code
  and parse signals offline; execution is deterministic.
- Multi-chain. Sui-first. Hedging on Hyperliquid is on the table once
  there's an LP strategy worth hedging.
- A consumer UI. The DeepBook App will likely cover that surface.

## Owner

Ash Bhimasani — ex-Phantom Cash team. This is a personal sandbox; the
Tempo / Paradigm Fellowship anchor lives in `~/dev/money-movement/`.
