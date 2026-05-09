# Strategy

Living document. The first version (in `~/dev/trading-bot/docs/CONTEXT.md`,
now archived under `v1-base-bot/`) was a Base + Coinbase CDP + Uniswap V3
mean-reversion bot. This file captures the **current** thesis and how we
got here.

## Current thesis

**Build a mobile-first iOS app on top of DeepBook Predict (Sui prediction
markets) — primarily as a way to learn what building on Sui feels like
from native mobile, secondarily as a candidate consumer-facing product.**

## Map of the territory (May 2026)

- **DeepBook Predict** (`docs.sui.io/onchain-finance/deepbook-predict/`)
  is testnet-only on the `predict-testnet-4-16` branch. Primitives:
  oracle-driven binary positions + vertical ranges, shared LP vault,
  PLP shares. The protocol is the foundation we're betting on.
- **DeepBook App** (`waitlist.deepbook.tech`, announced by
  [@aslan_web3](https://x.com/aslan_web3)) — the official team is
  building a consumer-facing dapp. Likely web-first, polished, on-rails.
- **t2000 / Audric** (`t2000.ai`, `audric.ai`) — `@audricai`'s open
  source agentic-finance infra on Sui. Five npm packages
  (`@t2000/{sdk,engine,cli,mcp}` + `@suimpp/mpp`). Covers wallet,
  send, save (NAVI), borrow, swap (Cetus), liquid staking, MCP, an
  LLM agent harness. **Does not cover:** prediction markets, native
  mobile.
- **Existing onramp work** in `~/dev/money-movement/`: docs for Stripe,
  Plaid, Bridge integrations; design philosophy in `docs/TASTE.md` and
  `docs/CLAUDE-DESIGN-BRIEF.md`. The implementation is web-demo level.

## The wedge

> Nobody has shipped a **native mobile** prediction-market UX on Sui
> with a fiat onramp, end to end.

DeepBook team will probably ship web. Audric covers conversational
finance broadly but skips prediction markets and skips native mobile.
The open lane is mobile-native + onramp + DeepBook Predict.

## Strategic choices made

### 1. Compose vs cherry-pick vs upstream — picked **cherry-pick**

| Frame | What | Why not |
|---|---|---|
| **Compose** | `import @t2000/sdk`; depend on Audric's Passport / wallet / MPP wholesale | Locks us into Audric brand decisions and roadmap; adds drag tracking their breaking changes |
| **Cherry-pick** ✅ | Read t2000 source for patterns; build minimal Passport-equivalent in Swift; cherry-pick `@suimpp/mpp` for monetization later if needed | Independent product opinion; full control of UX; rebuilds zkLogin infra (~days) but gain end-to-end understanding |
| **Upstream** | Add a "Predict" surface to t2000/Audric directly via PR | No signal Audric wants this; zero brand of our own |

### 2. Web vs PWA vs React Native vs **native iOS** — picked **native iOS**

User explicitly chose iOS to "test the mobile experience of building on
Sui." The learning value is **what does Sui-on-iOS actually feel like**:
SuiKit ergonomics, zkLogin from Swift, Face ID confirmations, Sign-in
flow, the gap left by Enoki not having a Swift SDK. PWA would have
shipped faster but skipped the learning.

### 3. Where to start

**Phase 1 (now):** Swift Package + macOS CLI smoke test against Sui
testnet via SuiKit. Validates the SDK works end-to-end.

**Phase 2 (after `sudo xcode-select` switch):** Add an iOS App target
(SwiftUI). Same `BookCore` library; new App target consumes it. Single
screen showing Sui testnet info from a phone simulator.

**Phase 3:** Sign-in flow. zkLogin via Sign in with Google or Apple,
Mysten's public prover service, ephemeral key in memory.

**Phase 4:** Read DeepBook Predict markets. Locate the SDK / Move
package IDs (open question in `docs/DEEPBOOK_PREDICT.md`); render market
list in SwiftUI.

**Phase 5:** First write — open a binary position. Tap-to-confirm with
Face ID. Pay gas user-funded for now.

**Phase 6:** Onramp. Stripe Crypto Onramp → USDC on Sui (specs in
`~/dev/money-movement/docs/integrations/stripe.md`).

**Phase 7:** Sponsored gas. Tiny TS backend wrapping Enoki, or direct
Mysten gas station calls. Removes the "fund your own gas" friction.

## What's deliberately out of scope

- **Mainnet anything until the protocol ships there.** DeepBook Predict
  is testnet-only; we don't pretend otherwise.
- **Strategy automation in the iOS app.** The "agentic/programmatic"
  layer (LP underwriting, scanners, multi-leg builders) lives in the TS
  sandbox at the repo root, not on a phone. Two surfaces, one repo.
- **Cross-chain.** Sui-only. Hedging-on-Hyperliquid stays on the
  research list (`docs/v1-base-bot/CHAINS_AND_PROTOCOLS.md`) but isn't
  built into Phase 1-7.
- **Public release / TestFlight.** Local builds only until App Store
  guidelines (see `docs/IOS.md` §App Store reality check) get a real
  answer.

## Reach-out: Audric

There's an open question about whether to DM `@audricai` once we've got
something to show. Not blocking; revisit after Phase 4.
