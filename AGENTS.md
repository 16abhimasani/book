# AGENTS.md — book

Cross-agent guidance for this repo. Read alongside `~/.agents/AGENTS.md`
(global) and the project `README.md`.

## Project at a glance

- **Focus:** Sui DeepBook Predict (oracle-driven prediction markets, testnet).
- **Secondary:** general on-chain auto-trading experiments.
- **Stack:** Bun + TypeScript, `@mysten/sui` for chain access.
- **Status:** scaffolding; no live trading.

## Read order on cold start

1. `README.md` — what this repo is.
2. `docs/DEEPBOOK_PREDICT.md` — what we know about the protocol + open
   questions.
3. `docs/STACK.md` — local AI / dev tooling reference (carried over).
4. `docs/v1-base-bot/` — archived V1 plan (Base + CDP + Uniswap). Useful
   for "what was considered and parked," not for current direction.

## Reality checks before doing work

- `pwd` should be `~/dev/book`.
- `git status --short` — confirm what's actually staged.
- `bun --version` — should be ≥ 1.3.x.
- `bun run start` — confirms `@mysten/sui` connects to Sui testnet.

## Conventions

- **No secrets in repo.** Use `.env` (gitignored). `SUI_NETWORK=testnet`
  is the default; never default to mainnet.
- **Indexer-first.** Read from the public Predict server when possible;
  fall back to direct on-chain reads only for confirmation-critical state.
- **Loose coupling to addresses.** Testnet package IDs will change before
  mainnet — keep them in config, not inlined.
- **Cross-reference money-movement.** `~/dev/money-movement/packages/web-demo/src/sui-dapp-kit.ts`
  has working `@mysten/sui` client setup we can crib.

## Memory protocol (recap of `~/.agents/AGENTS.md`)

- Update `~/.agents/memory/ACTIVE.md` on start / pause / handoff.
- Use `~/.agents/bin/agent-memory checkpoint "..."` for handoff lines.
- Use `~/.agents/bin/agent-memory learn "..."` for durable lessons.
- Use `~/.agents/bin/agent-memory decision "..."` for explicit choices
  (e.g. "we chose LP-side over taker-side because ...").

## Known competitive context

The DeepBook team is launching an official consumer app — waitlist at
https://waitlist.deepbook.tech (announced by @aslan_web3). This repo
deliberately targets the **agentic / programmatic / strategy** layer
above and below the consumer UX, not a competing front-end.
