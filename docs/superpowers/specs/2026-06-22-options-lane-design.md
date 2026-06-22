# Design — Lane 4: Options (directional speculation, autonomous, defined-risk)

- **Date:** 2026-06-22 · **Owner:** Ash (binding decisions) · design by the trading-loop agent
- **Status:** approved in brainstorming; pending spec sign-off + a pre-live review gate.
- **Trigger event:** option order tools live on the agentic MCP; account ••••5686 is
  `option_level_2` (long calls/puts, covered calls, cash-secured puts — no spreads, no
  naked). POLICY Lane 4 was PARKED ("owner specs the lane first"); this is that spec.

## 0. Owner decisions (the forks, already chosen)

| Fork | Choice |
|---|---|
| Role of options | **Directional speculation** — loosen the entry gate; discipline moves to risk containment |
| Risk budget | **Moderate** — ≤5% premium-at-risk/position (~$238), ≤15% total open (~$714) |
| Rollout | **Live + autonomous** — the heartbeat places option orders itself within the budget |
| Trigger | **Conviction score** — a computed 0–1 confluence, not LLM vibes |

Because there is **no human checkpoint and no strict catalyst gate**, the hard caps +
mechanical rules below are fully load-bearing. They are the only thing between a cold
streak and the account. Every number is computed and tested, like the rest of the engine.

## 1. Instruments

**Long calls (bullish) / long puts (bearish) only.** L2 ceiling, and it makes the lane
defined-risk by construction: max loss = premium paid. No covered calls / cash-secured
puts to start (capital-heavy at $4.7k, and the chosen role is speculation not income).
No spreads/naked (needs L3/L4).

## 2. The conviction-score trigger (centerpiece)

`src/trading/options.ts` → `convictionScore(signals)`. A pure, weighted aggregation of
signals the loop already produces — deterministic given its inputs, auditable (logged
like every other number). Some inputs are computed (tape, regime); some are loop
judgments under the §3 two-source rule (catalyst, sentiment) — same pattern as
`reentry.ts`'s `thesisIntact`.

```
inputs (each 0–1 unless noted), all loop-supplied:
  catalystStrength   // named directional catalyst, ANY freshness (the speculation loosening)
  tapeStrength       // computed: magnitude of confirming tape in the bet's direction
  sentimentScore     // grok X/web two-source agreement with the direction (§3 second source)
  regimeAligned      // computed bool: bet direction matches the regime gate
  direction          // 'call' | 'put'

score = 0.35·catalystStrength + 0.30·tapeStrength + 0.25·sentimentScore
        + 0.10·(regimeAligned ? 1 : 0)
        − (regimeAligned ? 0 : 0.15)        // counter-regime penalty
trade if score ≥ THRESHOLD                  // v1 default 0.70 (selective start; see §9 ramp)
```

Weights + threshold are owner-tunable constants, **policy-sync-coupled** to the POLICY
§Lane-4 prose (same drift guard as §2 / §3.9). They are v1 guesses — §9 starts the
threshold high (selective) and only loosens once the score proves calibrated against
logged outcomes.

## 3. Risk engine — `src/trading/options.ts` (tested money math)

- `sizeOption(account, premium, maxRiskPct = 0.05)` → `contracts = Math.floor((account × maxRiskPct) / (premium × 100))`.
  Premium-at-risk = `contracts × premium × 100` (≤ 5% by construction). Returns 0 when
  one contract already exceeds the per-position cap (skip — too expensive).
- `optionsBookOk(openPositions, account)` → total open premium-at-risk ≤ **15%** of account.
  A new buy that would breach it is rejected.
- `optionRMultiple(premiumPaid, premiumExit, contracts)` → R = P&L ÷ premium-at-risk
  (premium-at-risk is the denominator — an option's "1R" is the whole premium).
- All pure, all tested, parity with `risk.ts`/`trail.ts` (throw on bad inputs, epsilon on edges).

## 4. Mechanical guardrails (load-bearing)

- **DTE:** reject 0DTE / same-week expiry; **min 7 days**, target 2–6 weeks, **max ~90**.
  Kills the theta-lottery and most assignment risk.
- **Liquidity:** reject if bid/ask spread **> 10% of mid** OR open interest **< 500**.
  Wide option spreads are an instant loss on entry.
- **Earnings / IV crush:** earnings plays allowed (the juice — e.g. MU 06-24), but
  IV-aware: into a known earnings date within the contract's life, prefer **slightly-ITM**
  (less extrinsic to crush) and **half-size**. Flag extreme IV. Direction can be right and
  the option still lose to IV crush — the rule exists to blunt that.
- **Exit ladder (options-specific — NOT the share ladder):**
  - take-profit: scale half at **+60%** on premium, rest at **+120%** or trail;
  - hard stop: **−50%** of premium → close (never ride to zero);
  - time-stop: **DTE < 7 and not at take-profit → close** (theta cliff);
  - thesis-invalidation: underlying breaks the directional level → close.
  No diamond-hands to expiry.
- **`review_option_order` before every `place_option_order`**; fresh UUID `ref_id`;
  surface `market_data_disclosure` verbatim.

## 5. Portfolio integration

- Options premium-at-risk is added to the book view and counts toward the **§2
  daily-loss-halt (−15%)** and **drawdown checkpoint**: a bad options day halts new option
  buys, same as equities.
- Options round-trips logged to `data/trades.csv` (lane `L4`) with the option R-multiple,
  so §6a measures the sleeve and a track record accrues. `book.json` gains an
  `optionPositions[]` mirror for the risk/book CLIs.

## 6. POLICY Lane 4 rewrite (parked → live, owner-ratified)

Replace the parked Lane 4 with: instruments (long-only L2), the conviction-score trigger
+ THRESHOLD, the budget (5%/15% premium-at-risk), DTE/liquidity/IV rules, the options exit
ladder, the daily-halt/drawdown integration, autonomous authority + `review_option_order`
before every order. Version bump. Owner-ratified.

## 7. Loop-SKILL integration

A Lane-4 options step in the manage/execute block: scan optionable setups → score via
`convictionScore` → if ≥ threshold, pick the contract (DTE/liquidity/IV rules) → size via
`sizeOption` → check the 15% book budget → `review_option_order` → `place_option_order` →
log to trades.csv. Manage open options each run via the §4 exit ladder.

## 8. Testing

`options.test.ts`: `sizeOption` (floor, 0-when-too-expensive, 5% cap), `optionsBookOk`
(15% cap, boundary), `optionRMultiple`, `convictionScore` (each component, threshold
boundary, counter-regime penalty, direction), exit-ladder triggers (+60/+120/−50/time-stop).
Plus `policy-sync` coupling for the weights/threshold/budget constants.

## 9. Live-but-selective ramp (safety under autonomous)

You chose autonomous-live, so there's no human gate — but the conviction weights are
unvalidated v1 guesses. To keep the first autonomous bets from acting on a miscalibrated
score: **start THRESHOLD at 0.70 (very selective)** and first positions at the small end of
the budget; loosen the threshold only after logged option outcomes show the score
separates winners from losers (revisit at ~5–10 closed). This is a recommendation in the
spec, not a human checkpoint — the loop still trades autonomously, just selectively first.

## 10. Build plan (each step verified)

1. `options.ts` (sizeOption, optionsBookOk, optionRMultiple, convictionScore, exit-ladder) + tests → **verify:** suite green, typecheck.
2. Portfolio integration (trades.csv L4, book.json optionPositions, daily-halt) → **verify:** risk/book CLIs handle options.
3. POLICY Lane 4 rewrite + policy-sync coupling → **verify:** policy-sync green.
4. Loop-SKILL Lane-4 step.
5. **Pre-live review gate** (autoplan or a review subagent on the spec+code, like the re-entry lane) BEFORE Lane 4 goes binding-live — autonomous real-money options warrants it.
6. Owner ratifies POLICY Lane 4 → live.

## 11. Out of scope (say so to pull in)

- Covered calls / cash-secured puts / spreads / naked (income + L3/L4 strategies) — later/larger account.
- Multi-leg, rolling, assignment-handling automation — long single-leg only to start.
- A separate options watchlist universe — reuse the existing names/themes.
