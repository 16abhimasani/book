# Backtest — Lane-2 regime gate (P3, overnight 2026-06-12)

**Question:** does the POLICY §3/§4 regime gate (QQQ > 20-session MA AND
VIXY below prior close) actually earn its keep before we trust it with
more capital?

**Verdict in one line:** the gate is a real drawdown-control device — it
roughly halves TQQQ's max drawdown while keeping ~40% CAGR — but the
VIXY-direction leg churns violently (a flip every ~2.4 sessions), and in
a one-way bull sample it gives up a lot of upside vs buy-and-hold. Keep
it for survival, don't expect it to beat holding in a melt-up.

## Method

- Data: 753 daily sessions, 2023-06-12 → 2026-06-11, QQQ/VIXY/TQQQ
  (`data/history/*.csv`, Yahoo v8 chart API — same source and raw-close
  basis as the live `marks.csv`; anchors verified to the cent).
- Signals computed on **raw closes** at close *t* (identical code path to
  the live gate: `src/trading/gate.ts` `computeGate`); position held for
  the *t → t+1* close-to-close return. Returns use **adjusted closes** so
  distributions don't read as losses.
- Gate ON → 100% TQQQ; OFF → cash at 0%. No slippage, no spread, no
  taxes, no interest on cash.
- Engine: `src/trading/backtest.ts` (`bun run backtest` reproduces the
  table below deterministically from the committed CSVs).

## Results (3y, growth of $1)

| Strategy | CAGR | Max DD | Time in mkt | Worst held day | Flips | $1 → |
|---|---|---|---|---|---|---|
| Buy & hold QQQ | 28.3% | -22.8% | 100.0% | -6.2% | 1 | 2.01 |
| Buy & hold TQQQ | 66.3% | -58.0% | 100.0% | -18.3% | 1 | 4.13 |
| Gate MA10 + VIXY dir | 40.4% | -32.2% | 41.6% | -14.3% | 276 | 2.72 |
| Gate MA10 + no vol leg | 25.4% | -43.9% | 62.4% | -14.3% | 124 | 1.95 |
| **Gate MA20 + VIXY dir** (current POLICY) | **39.7%** | **-24.5%** | **43.8%** | **-14.3%** | **288** | **2.65** |
| Gate MA20 + no vol leg | 36.9% | -39.7% | 68.2% | -14.3% | 84 | 2.49 |
| Gate MA50 + VIXY dir | 34.5% | -28.3% | 44.5% | -14.3% | 278 | 2.29 |
| Gate MA50 + no vol leg | 51.2% | -33.5% | 73.4% | -14.3% | 43 | 3.17 |

## Reading the sensitivity grid

1. **The current policy variant (MA20 + VIXY dir) is the best
   drawdown-controller in the grid**: −24.5% max DD is better than even
   *unleveraged* QQQ buy-and-hold (−22.8% — effectively equal), on a 3x
   product. That is the gate doing its actual job.
2. **The VIXY-direction leg is doing the drawdown work but causes the
   churn.** Without it, MA20 drawdown balloons to −39.7%. With it, the
   strategy flips ~288 times in 700 tradable sessions — ~144 round trips.
   At even ~0.05–0.10% cost per round trip (TQQQ spread is ~1–2¢, but
   slippage on stop/market entries is real), that's roughly **3–5% of
   CAGR in friction not modeled here**. The daily-direction signal is
   noisy: one down-tick in VIXY re-arms the lane, one up-tick kills it.
3. **MA50 with no vol leg is the dark horse**: 51.2% CAGR, −33.5% DD,
   only 43 flips. It rides trends longer and trades 6x less. Its DD is
   meaningfully worse than the policy variant though.
4. **Worst held day is −14.3% for every gate variant** — a reminder that
   the gate is a *regime* filter, not gap protection. The −12% hard stop
   (POLICY §3 Lane 2) plus this backtest's worst-held-day suggest a
   single bad held session can consume a year's worth of edge. All
   variants did sidestep TQQQ's worst sample day (−18.3%).

## Honest caveats

- **One regime.** The sample is a strong AI-led bull with two
  corrections. The gate's value proposition (avoiding −50%+ leveraged
  bleed-outs) is exactly the scenario *not* in sample. CAGR comparisons
  flatter buy-and-hold; drawdown comparisons probably flatter the gate
  less than a 2022-style year would.
- **No slippage/taxes/borrow.** ~144 round trips/3y at the policy
  variant makes the no-friction assumption material (see #2 above).
  Short-term capital gains taxes would bite every flip in a taxable
  account.
- **Cash earns 0%** in this model; T-bill yield on the ~56% of days in
  cash would add ~2%/yr to gate variants (mildly flatters buy-and-hold
  comparisons in the other direction).
- **Execution boundary.** Signal at close *t*, return from close *t* —
  live execution would be at the 16:00 print or next open; the EOD run
  (~16:15) can't trade. Realistically the morning run executes at the
  *t+1 open*, which adds overnight slippage in both directions. Not
  modeled.
- **VIXY ex-distribution days** can flip the direction leg for
  non-market reasons (raw closes used, matching the live gate).
- **Sample size of flips is large (good) but the worst-case tail is
  thin** — three years contains ~2 real corrections.

## Findings worth acting on (PROPOSALS only — owner ratifies)

- **PROPOSAL B1 (keep, now evidenced):** keep MA20 + VIXY-direction as
  the Lane-2 gate. It was adopted on judgment; it now has data behind
  its drawdown profile. No POLICY change.
- **PROPOSAL B2 (anti-churn):** require the gate to hold its new state
  for 2 consecutive closes before acting on a flip (entry AND exit), OR
  replace the vol leg's "below prior close" with "below its own
  5-session average". Either materially cuts the ~144 round trips/3y;
  needs a follow-up backtest before ratification (one-line change in
  `gate.ts` opts — the harness exists now).
- **PROPOSAL B3 (worst-day realism):** treat the −14.3% worst-held-day
  as the planning number for Lane-2 gap risk (vs the −12% stop) when
  sizing — i.e., assume the stop fills ~2% through on a bad gap.
- **PROPOSAL B4 (no new capital on gate evidence alone):** this backtest
  does NOT satisfy POLICY §6a (that gate needs live closed trades). It
  validates the mechanism, not the implementation.

## B2 follow-up — anti-churn variants (added 2026-06-12 intraday)

Same harness, same data, three anti-churn variants on the policy gate
(`confirmDays` + `vixy-5d-avg` now exist as research-only options in
`gate.ts`; POLICY defaults unchanged):

| Strategy | CAGR | Max DD | Time in mkt | Worst held day | Flips | $1 → |
|---|---|---|---|---|---|---|
| Gate MA20 + VIXY dir (POLICY) | 39.7% | -24.5% | 43.8% | -14.3% | 288 | 2.65 |
| **B2: MA20 + VIXY dir + 2d confirm** | **38.2%** | **-24.1%** | **43.8%** | **-14.3%** | **98** | **2.56** |
| B2: MA20 + VIXY<5d avg | 39.4% | -25.6% | 49.1% | -14.3% | 164 | 2.63 |
| B2: MA20 + VIXY<5d avg + 2d confirm | 29.7% | -38.5% | 49.1% | -14.3% | 98 | 2.13 |

**Reading:** the 2-day confirmation is the clear winner — it gives up 1.5pt
of pre-friction CAGR and actually *improves* max drawdown slightly, while
cutting flips from 288 to 98 (−66%). At any realistic friction estimate
(≈3–5%/yr at 144 round trips), the confirmed variant likely **wins net**.
Swapping the vol leg to a 5d-average is neutral alone and harmful combined
(it delays exits the confirmation then delays again — drawdown balloons).

**Sharpened PROPOSAL B2 (owner ratifies):** amend POLICY §3/§4 Lane-2 gate
to act on a flip only after the same state prints on **2 consecutive
closes**; keep VIXY-direction as the vol leg. Note the asymmetry trade-off:
confirmation also delays *exits* by a day (max DD says this cost ~nothing
in sample, but a gap-down day one is the risk you're accepting).

**Asymmetric variant tested and REJECTED (2026-06-12, second pass):** the
obvious "confirm entries, act exits immediately" idea — which would have
removed the delayed-exit cost — collapses in practice: 26.7% CAGR, 24.3%
time-in-market, $1 → 1.99 (vs 38.2% / 43.8% / 2.56 symmetric). Reason: the
VIXY day-direction leg alternates noisily; immediate exits + confirmed
re-entries means every noise day ejects you and re-admission takes two
clean days — you end up out of the market more than half the time the
symmetric variant is in. Its one virtue (worst held day −9.1%) doesn't pay
for the foregone compounding. The open question on B2 is closed:
**symmetric 2-day confirmation is the recommendation.**

**Live illustration (2026-06-12):** the gate forced the TQQQ exit at the
open of this very session (+0.31R, fine), and QQQ tagged 723 — above the
re-arm level — within hours. Under B2, Monday-morning whipsaw re-entries
like the one now pending would be roughly 3x rarer.

## Reproduce

```
bun run backfill   # refresh data/history/*.csv (3y, Yahoo)
bun run backtest   # prints the table above
bun test src/trading
```
