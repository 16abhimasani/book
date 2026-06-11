# Strategy review — 2026-06-11 (day 1 of live trading)

Read-only research session (Claude Code cloud, owner-initiated:
"figure out how to improve trading strategy and maximize profit").
No orders placed. All numbers pulled live from the Robinhood MCP at
~22:20 UTC (after-hours). Proposed POLICY changes are **diffs for the
owner to approve** per OPERATIONS §D — nothing here changes behavior
until POLICY.md is edited by the owner.

## 1. Ground truth at review time

- Account **$3,097.89** (+3.26% vs $3,000 start) · cash $481.40
- MU 1 @ 941.50 — close 995.65 (**+5.75%**, +$54.15) · stop 866 GTC
- INTC 6 @ 114.15 — close 116.99 (**+2.49%**, +$17.04) · stop 105 GTC
- TQQQ 12 @ 74.35 — close 76.00 (**+2.22%**, +$19.80) · stop 63.20 GTC
- Day 1 verdict: thesis (ORCL-capex → silicon order books rotation)
  worked; execution friction (second-trade gate, stale limits) cost
  ~2% on TQQQ entry but was journaled and codified.

## 2. Findings (ranked by expected impact)

### F1 — Risk per trade is uneven and untracked (highest impact)

Position sizing is %-of-account (25–40%), but stop distances differ
per lane, so **dollar risk at stop varies 2.4×** across the book:

| Position | Size | Stop distance | $ at risk | % of acct |
|---|---|---|---|---|
| MU | 31% | −8.0% | $75.50 | 2.5% |
| INTC | 23% | −8.0% | $54.90 | 1.8% |
| TQQQ | 30% | −15.0% | $133.80 | 4.5% |
| **Total open risk** | | | **$264.20** | **8.8%** |

TQQQ carries 2.4× INTC's risk for a similar-size slot. Sizing should
start from risk, not slot size: `qty = (account × risk%) / (entry −
stop)`. With a 2.5%/position risk budget the same TQQQ idea is ~7
shares, or the same 12 shares with a −8.5% stop. **Two bad runs under
the current scheme can take ~18% of the account; the −15% daily halt
can be blown through by stops alone.**

### F2 — The whole book is one trade (correlation)

MU, INTC, TQQQ are all the same position: semis/Nasdaq momentum off
one catalyst. Beta-adjusted exposure (TQQQ at 3×) is **~$4,430 ≈ 143%
of account**. POLICY caps single positions (40%) and leveraged-ETF
notional (50%) but has no theme or beta-adjusted cap, so a fully
"legal" book can still be a single leveraged bet. One adverse
overnight headline (e.g. the journaled Iran/oil tail risk) hits all
three positions at once, gapping below all three stops simultaneously.

### F3 — Winner management is all-or-nothing

Exits today: hard stop −8%, trail only after +10%. Between entry and
+10% there is no profit protection. Live example at review time: MU is
+5.75% and its stop is still −8% below entry — from the current price
a stop-out realizes **−13.7%**, i.e. the position is risking ~$130 of
real value to chase the last +4.25% before the trail arms. Aggregate:
if all three stops were hit from current marks the account gives back
**$355 (−11.5%)** — more than the original entry risk, because none of
today's +$91 is protected.

### F4 — Regime gate inputs are vibes, not data

Lane 2's gate is "QQQ above 20-day MA AND VIX < 25", but the MCP
exposes no history and no VIX index — both legs are currently
estimated from news. Verified today: **VIX is not quotable, but VIXY /
VXX / UVXY / SVIX are** (VIXY closed 24.42, −4.9% — consistent with
gate ON). The fix is to make the repo the data feed: the EOD run
appends one CSV row per session (`data/marks.csv`, scaffolded in this
commit), and after 20 sessions the 20-day MA is computed, not guessed.
Until then, the gate additionally uses VIXY day-over-day direction as
the vol leg (falling = risk-on confirm).

### F5 — Cash-account mechanics are unmodeled (silent killer)

The Agentic account is a **cash account**. An hourly momentum loop
that sells and redeploys risks **good-faith violations** (buying with
unsettled T+1 proceeds and selling before settlement — 3 GFVs in 12
months = 90-day restriction, which kills the experiment). POLICY has
no settled-funds rule. Note `get_portfolio` buying power ($481.40)
already reflects holds, but GFV is about *selling* a position bought
with unsettled funds — the loop must track which cash is settled
before recycling proceeds same-day/next-day.

### F6 — Stop mechanics on the 3x lane

The TQQQ stop (−15%) sits inside a lane whose written rule is "exit on
−20% intraday" — the actual practice (tighter stop) is better than the
written policy; codify it. Stops are GTC stop-**market**, regular
hours only: a 3x ETF can gap through them overnight, which is another
reason F1's risk-based sizing matters more on Lane 2. Stops should
also **ratchet**: re-checked every hourly run, only ever moved up.

### F7 — Execution lessons not yet codified

Run #1 already produced two rules that live only in journal prose:
quote-at-placement (three TQQQ re-quotes cost +2.1%) and the
one-chase rule. They should be policy, not memory.

### F8 — No expectancy instrumentation

The 4-week capital-add gate ("positive expectancy") can't be evaluated
from journal prose. Scaffolded in this commit: `data/trades.csv` — one
row per round-trip with entry/stop/exit and **R-multiple** (P&L ÷
initial $ risk). Weekly review then computes: hit rate, avg win R, avg
loss R, expectancy/trade = `win% × avgWinR − loss% × avgLossR`.

## 3. Proposed POLICY v0.2 diff (owner approves & edits)

Each item is paste-ready. All are tightenings or process additions —
none loosen an existing limit.

1. **§2 add — risk budget:** "Max risk per position at entry
   ((entry − stop) × qty): **2.5% of account**. Max total open risk to
   stops across the book: **8%**. Size positions from risk first; the
   40% slot cap remains as a secondary bound."
2. **§2 add — beta-adjusted gross cap:** "Beta-adjusted gross exposure
   (leveraged ETFs counted at their multiplier) ≤ **150% of account**."
3. **§2 add — theme cap:** "Positions sharing one catalyst/theme ≤
   **65% of account** at entry (leveraged ETF counted at notional)."
4. **§2 add — settled funds:** "Cash account: new buys only with
   settled funds; never sell a position bought with unsettled proceeds
   before those proceeds settle (GFV). When in doubt, skip the entry —
   a missed trade costs less than a 90-day restriction."
5. **§3 Lane 1 exit ladder:** "At **+5%** unrealized: raise stop to
   breakeven. At **+10%**: trail at max(breakeven, −8% from peak). At
   **+12%**: sell 1/3 to bank ≥ 1R; trail the rest. Time stop
   unchanged (5 sessions)."
6. **§3 Lane 2 stops:** "Hard stop **−12%** from entry placed with the
   fill (replaces '−20% intraday' language). Stops ratchet up only;
   re-check at every hourly run."
7. **§3 entry hygiene (codify run-#1 lessons):** "Quote immediately
   before placement; place the marketable limit at decision time. Max
   **one** chase per order, ≤ +1% from original limit; otherwise stand
   down until the next run."
8. **§4 EOD run addition:** "Append one row to
   `robinhood-agentic/data/marks.csv`: date, QQQ close, VIXY close,
   account value. Regime gate = QQQ > 20-session MA from this file
   (estimate until 20 rows exist) AND vol leg: VIXY below prior close
   (or est. VIX < 25 while the series builds)."
9. **§7 new — measurement gate:** "Log every round-trip in
   `robinhood-agentic/data/trades.csv` with R-multiple. Adding capital
   requires: ≥ **10 closed trades**, expectancy > **+0.25R**, zero
   limit breaches, ≥ 4 weeks elapsed."

## 4. Profit opportunities deliberately NOT proposed

- **Deploying the 4th slot / the 16% cash.** With 143% beta-adjusted
  exposure on one theme and live geopolitical tail risk, the cash *is*
  a position.
- **Options lane.** Parked per POLICY until MCP tools exist; long
  premium on Lane-1 catalysts remains the right first spec when they do.
- **Overnight/extended-hours entries.** Order schema shows a
  `market_hours` field (current orders: `regular_hours`). If
  `review_equity_order` accepts extended hours, pre-market catalyst
  entries at the 8:30 run become possible — worth one probe via
  review (not place) on the next live run, journal the finding, then
  owner decides whether to add a lane rule.
- **More indicators/complexity.** At $3k and hourly cadence the edge
  comes from breadth of catalyst-reading (already the thesis), risk
  control (F1–F3), and surviving long enough to measure (F5, F8) —
  not from more signals.

## 5. Honest framing

One green day proves nothing about expectancy — the riskiest
assumption (positive expectancy after slippage at hourly cadence) is
still unproven and stays the #1 open question until `trades.csv` has
≥10 closed round-trips. The proposals above don't try to predict the
market better; they make the existing thesis **survivable** (F1, F2,
F5), **convex** (F3 — losers cut at −1R, winners banked in thirds),
and **measurable** (F4, F8). That is what maximizes profit at this
account size: maximizing the number of independent, risk-bounded bets
the experiment lives to take.
