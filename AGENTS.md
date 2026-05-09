# AGENTS.md — book

Cross-agent guidance for this repo. Read alongside `~/.agents/AGENTS.md`
(global) and the project `README.md`.

## Project at a glance

- **Focus:** Sui DeepBook Predict (oracle-driven prediction markets,
  testnet) wrapped in a **native iOS app**.
- **Two surfaces, one repo:**
  - `ios/` — Swift package + (forthcoming) iOS App target. Product surface.
  - `src/` — Bun + TypeScript sandbox for research / strategy experiments.
- **Status:** scaffolding both surfaces; no live trading; testnet only.

## Read order on cold start

1. `README.md` — what this repo is.
2. `docs/STRATEGY.md` — current thesis + the strategic pivots (t2000 /
   Audric finding, iOS-first decision, compose-vs-cherry-pick choice).
3. `docs/DEEPBOOK_PREDICT.md` — protocol primitives + open questions.
4. `docs/IOS.md` — Swift / iOS specifics, SDK choice (SuiKit), zkLogin
   path, Xcode prereq, App Store risks.
5. `docs/STACK.md` — local AI / dev tooling reference.
6. `docs/v1-base-bot/` — archived V1 plan (Base + CDP + Uniswap).

## Reality checks before doing work

- `pwd` should be `~/dev/book`.
- `git status --short` — confirm what's actually staged.
- **TS sandbox:** `bun --version` (≥ 1.3.x) + `bun run start` — confirms
  `@mysten/sui` connects to testnet.
- **Swift package:** `cd ios && swift build && swift run book-cli` —
  confirms SuiKit connects to testnet.
- **Xcode prereq for iOS work:** `xcode-select -p` should print
  `/Applications/Xcode.app/Contents/Developer`. If it prints
  `/Library/Developer/CommandLineTools`, the user must run
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
  once — agents should NOT run sudo on their behalf. Until switched,
  `swift build` works for macOS but iOS Simulator + `xcodebuild` don't.

## Conventions

- **No secrets in repo.** Use `.env` (gitignored). `SUI_NETWORK=testnet`
  is the default for both TS and Swift; never default to mainnet.
- **Indexer-first.** Read from the public DeepBook Predict server when
  possible; fall back to direct on-chain reads only for confirmation-
  critical state.
- **Loose coupling to addresses.** Testnet package IDs will change
  before mainnet — keep them in config, not inlined.
- **Swift package mode is `.v5`** because SuiKit 1.4.0 predates Swift 6
  strict concurrency. Revisit when SuiKit ships Sendable conformances.
- **Don't pull `@t2000/sdk` as a dep.** We chose cherry-pick over
  compose (see `docs/STRATEGY.md` §1). Read t2000 source for patterns
  if useful, but don't take the dependency.
- **Cross-reference money-movement.** `~/dev/money-movement/packages/web-demo/src/sui-dapp-kit.ts`
  has working `@mysten/sui` client setup; `docs/integrations/{stripe,plaid,bridge}.md`
  are the onramp specs for Phase 6.

## Memory protocol (recap of `~/.agents/AGENTS.md`)

- Update `~/.agents/memory/ACTIVE.md` on start / pause / handoff.
- Use `~/.agents/bin/agent-memory checkpoint "..."` for handoff lines.
- Use `~/.agents/bin/agent-memory learn "..."` for durable lessons.
- Use `~/.agents/bin/agent-memory decision "..."` for explicit choices.

## Known competitive context

- **DeepBook App** (waitlist.deepbook.tech) — official Mysten team
  consumer app, likely web-first. Our wedge is mobile-native.
- **t2000 / Audric** — `@audricai`'s agentic finance stack on Sui.
  Covers wallet + DeFi + agent harness; doesn't cover prediction
  markets or native mobile. Inspiration, not dependency.
- **No native iOS prediction-market app on Sui exists.** That's the
  open lane.
