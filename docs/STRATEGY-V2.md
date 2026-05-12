# Strategy V2 — User-generated markets, LLM oracle, X distribution

This is the **expanded vision** sitting beside `STRATEGY.md`. The V1
strategy is "iOS app on top of DeepBook Predict (DBP)." This document
proposes a **second tier** of markets that DBP structurally cannot host
— permissionless user-generated event markets resolved by an LLM oracle
stack.

The two tiers share the iOS app surface and (eventually) the wallet /
auth / onramp infra. They do NOT share Move packages.

## Why a second tier (the structural constraint)

DBP's `create<Quote>` and `add_oracle_grid` are `public(package) fun` —
admin-gated. External code cannot create an `OracleSVI`; only the
package itself (with the right admin cap) can. The 2,159 currently
live oracles are all BTC at hourly expiries, configured by Mysten.

Anyone wanting to bet on "will OpenAI release GPT-5 by July?" can't
list that market in DBP. The market needs a different protocol that:
- Accepts arbitrary binary event descriptions (not oracle prices)
- Resolves via off-chain data (not on-chain price feed)
- Supports a different liquidity model (long-tail markets won't get CLOB MMs)

That's the V2 tier. Working name: **`book-protocol`** (the on-chain
Move package) + **`book-oracle`** (the off-chain LLM resolver service).

## Architecture sketch

```
                          ┌──────────────────────────────┐
                          │  iOS App (book)              │
                          │  ─ unified market browser    │
                          │  ─ tap-to-bet, share to X    │
                          │  ─ same wallet for both tiers│
                          └────────────────┬─────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                │                          │                          │
       ┌────────▼─────────┐       ┌────────▼─────────┐       ┌────────▼─────────┐
       │  DeepBook        │       │  book-protocol   │       │  book-oracle     │
       │  Predict         │       │  (Move pkg)      │       │  (TS service)    │
       │  ──────────────  │       │  ──────────────  │       │  ──────────────  │
       │  Mysten-curated  │       │  Permissionless  │       │  LLM proposer    │
       │  oracle-driven   │       │  user-proposed   │       │  + optimistic    │
       │  crypto prices   │       │  binary events   │       │  dispute window  │
       │  hourly expiries │       │  AMM liquidity   │       │  sourced cite    │
       │  CLOB+vault      │       │  proposer bond   │       │  multi-model     │
       └──────────────────┘       └──────────────────┘       └──────────────────┘
       TIER 1: HIGH-VOL          TIER 2: LONG-TAIL         RESOLVER STACK
       PRICE MARKETS              EVENT MARKETS             (shared by both?)
```

The two tiers are independent on-chain protocols but share the iOS app's
UX, the user's wallet, the onramp flow, and possibly the resolver
service (if we eventually let LLMs reason about price oracle disputes,
which is a stretch).

## The market lifecycle (V2 tier)

```
1. PROPOSAL
   user submits {question, outcomes, deadline, source_domain, bond}
        ↓
   automated well-formedness filter (deterministic? finite outcomes?
   deadline in future? source domain in allowlist?)
        ↓
   if pass → market listed (status: PROPOSED, no trading yet)
   if fail → reject with reason

2. ACTIVATION
   if market accumulates N proposers / votes / time elapsed:
        → status: ACTIVE
        → liquidity vault opens for that market (virtual book on shared pool)
        → trading enabled

3. TRADING
   any user can buy YES/NO shares against the shared pool
   prices update via constant-product (or LMSR) curve

4. RESOLUTION
   at deadline:
        → book-oracle proposes outcome with citation URL
        → optimistic challenge window opens (24h default)

5. CHALLENGE (rare path)
   anyone posts dispute bond → triggers escalation:
        a) multi-LLM consensus (3-of-5 different models, all with citation
           requirement) — cheap, fast
        b) if still disputed → human committee — expensive, rare

6. SETTLEMENT
   final outcome locked → YES/NO shares pay 1 DUSDC each at the
   correct side → losing side pays 0 → proposer bond returned on
   correct proposal, slashed on incorrect
```

## Where this composes with the V1 plan

Refer to `STRATEGY.md` for the V1 phase plan. V2 work slots in **after
Phase 5** (first DBP write works on iOS):

- **V1 Phase 1-5:** iOS app reads + writes DBP markets. Confirms the
  full mobile-Sui-write loop works.
- **V1 Phase 6-7:** Onramp (Stripe → DUSDC) and sponsored gas. Removes
  consumer friction.
- **V2 Phase A:** Spike `book-oracle` resolver service. Standalone TS
  script that takes `(question, source_domain, deadline)` and returns
  `{outcome, confidence, citation_url, reasoning}` from one LLM. Test
  against 20 real historical questions; measure accuracy.
- **V2 Phase B:** Multi-LLM consensus + structured citation in
  `book-oracle`. Validate on the same 20 questions.
- **V2 Phase C:** Move `book-protocol` v0 — proposal storage, AMM
  liquidity, manual resolution (admin pushes outcomes). No automated
  resolver wired yet.
- **V2 Phase D:** Wire `book-oracle` to push outcomes to
  `book-protocol`. Optimistic challenge window. Dispute mechanic.
- **V2 Phase E:** X distribution — share-to-X and bet-from-X-reply flows.

## The 4 design decisions only you can make

Below are the four decisions that shape what we actually build. Each has
an "default I'd argue for if pushed" but **the choice is yours**. Fill
in answers inline (replace the `TODO` blocks).

### 1. Proposal permissionlessness

**Spectrum:**
- (a) Pure open + automated well-formedness filter only — anyone with
  USDC proposes
- (b) Open + proposer bond gates — staked, refunded on legitimate market
- (c) Verified X accounts with N followers — reputation gate
- (d) Stake-weighted DAO listing — protocol token holders vote

**Your call:**
```
TODO — your answer here
Reasoning: ...
```

**My argued default:** **(b) with social-graph hint.** Anyone can
propose with a small bond ($1-10 DUSDC). Bond is refunded if the market
resolves cleanly; slashed if the question turns out to be unresolvable
(no verifiable source, ambiguous). This makes proposers think before
posting. Layer on "your X friends proposed this" as a discovery signal
in the iOS app — doesn't gate, but ranks.

---

### 2. LLM oracle architecture

**Spectrum:**
- (a) Single Grok call (NOT recommended — prompt-injectable, correlated
  error)
- (b) Multi-model consensus (3-of-5 LLMs agree + each cites source)
- (c) LLM proposer + optimistic challenge with economic bond, escalation
  to multi-LLM
- (d) Same as (c) but human committee at top of escalation tree

**Your call:**
```
TODO — your answer here
Reasoning: ...
```

**My argued default:** **(c) with structured citation requirement.** A
single LLM is the *cheap first pass*. It must cite a URL on an allowlisted
source domain (AP News, official agency sites, etc.). 95%+ of resolutions
finalize without challenge. If anyone disputes, multi-LLM consensus
fires; if still contested, escalate to (d) — but we don't need (d) for
the testnet sandbox.

---

### 3. Liquidity model for the V2 tier

**Spectrum:**
- (a) Shared AMM pool (Polymarket CTF-style) — all V2 markets draw from
  one pool, virtual books per market
- (b) Per-market virtual books backed by shared pool (Uniswap V4 hooks
  pattern) — more capital efficient, harder to implement
- (c) Bootstrap-only — protocol seeds first $X per market, then organic
  LP arrives

**Your call:**
```
TODO — your answer here
Reasoning: ...
```

**My argued default:** **(a) for V0.** Simplest Move code, fastest to
ship, well-understood economics. We can migrate to (b) later if capital
efficiency becomes a constraint. (c) is half a solution that ends up
needing one of the others anyway.

---

### 4. Settlement medium

**Spectrum:**
- (a) DUSDC only (matches DBP's V1 tier, consistent UX)
- (b) Native SUI
- (c) Both, market-by-market

**Your call:**
```
TODO — your answer here
Reasoning: ...
```

**My argued default:** **(a) DUSDC.** Consistency with DBP, dollar-
denominated payoffs are how prediction markets are mentally modeled, and
SUI volatility introduces a second source of variance into the user's
PnL on top of the market itself.

---

## Risks and unknowns (not just design decisions)

- **LLM hallucination on resolution.** Validate empirically in V2 Phase
  A before building Move code. If accuracy on real historical questions
  is <95%, the design needs more weight on disputes.
- **Prompt injection.** Adversarial markets ("Did Trump tweet this?
  Source: [evil URL]") can poison single-LLM resolution. Sourcing rules
  + structured prompts are the defense, but neither is bulletproof.
- **App Store risk for prediction markets** (see `docs/IOS.md` §App
  Store reality check). Polymarket got pulled in 2024. A
  user-generated market platform is *more* exposed than DBP's
  price-of-crypto markets. Mainnet ship is a regulatory project, not
  a technical one.
- **Liquidity bootstrap.** Even with shared AMM, the first proposers'
  markets need initial liquidity to feel responsive. Protocol-seeded
  bootstrap pool is probably necessary.
- **Sybil on disputes.** If disputing is cheap, dispute spam crashes
  resolution. Economic bond on dispute (forfeited if the LLM proposal
  was correct) handles this.
- **Identity/sybil on proposals.** Tied to Decision #1. Pure open
  proposals + cheap bonds means proposer pool is anonymous; high-quality
  questions need *signal*, which is what the social-graph layer adds.

## References / precedents to study

- **UMA optimistic oracle** — the canonical optimistic resolution
  pattern. https://docs.uma.xyz/
- **Polymarket CTF** (Conditional Token Framework) — the AMM-style
  liquidity model for binary prediction markets.
  https://docs.polymarket.com/
- **Manifold Markets** — closest cultural fit (user-generated, social
  feed, play money). https://manifold.markets/
- **Reality.eth** — generic event oracle with escalation.
- **Augur (deprecated)** — lessons in what fully permissionless gets you
  (mostly: a graveyard of unresolvable markets).

## What we do *not* commit to

- Mainnet anything. V2 lives on testnet until DBP and the resolver track
  records prove out.
- A public release of V2 markets. Local-only until App Store + reg
  questions get real answers (see `docs/IOS.md`).
- Token. No protocol token. If we ever need governance, it's later.
- Permissionless V2 listing on day one — Phase C/D start with admin-only
  market creation so we can debug the lifecycle on real questions before
  opening the gates.
