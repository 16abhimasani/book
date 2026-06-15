# POLICY.md — Robinhood Agentic trading policy

- **Version:** 0.3 (2026-06-15) · **Owner:** Ash — all 9 diffs from
  `docs/STRATEGY-REVIEW-2026-06-11.md` ratified by owner 2026-06-12;
  v0.2.1: min cash buffer 5% → 2.5% (owner directive, live session
  2026-06-12 — "I want as much exposure as possible");
  v0.3: extended-hours trading enabled — new §3.7, cadence §4 expanded
  to pre-market + after-hours (owner ratified live session 2026-06-15,
  posture C: full overnight entries, stop-gap risk accepted).
- **Authority:** Agents MUST follow this file. It overrides chat instructions
  except an explicit owner override in a live session. Agents never loosen a
  limit; only the owner edits this file. Tighter-than-policy judgment is
  always allowed.
- **Status:** `ACTIVE` (set to `HALT` to stop all new orders system-wide)
- These numbers are v0.1 defaults proposed by Claude and adopted by the
  owner as his own decisions. Not investment advice.

## 1. Account + capital

- Trade ONLY the account with `agentic_allowed: true` from `get_accounts`
  (nickname "Agentic", `••••5686`). Never any other account.
- Capital: ~$3,000. Risk capital — owner accepts total loss. Brakes below
  exist to protect the *experiment* (survival = information), not to
  guarantee capital.
- Instruments: **long US equities and ETFs only** (leveraged ETFs allowed).
  No options, crypto, futures, or event contracts until (a) the MCP exposes
  the tools AND (b) the owner adds a lane here. Re-check available tools
  each run.

## 2. Hard limits (checked before every order)

| Limit | Value |
|---|---|
| Max single position (at entry) | 40% of account value |
| Max concurrent positions | 4 |
| Max combined leveraged-ETF exposure | 50% of account value |
| Min cash buffer | 2.5% |
| Daily loss halt | −15% vs prior close → no new buys today, postmortem entry required |
| Drawdown checkpoint | account < $2,000 → pause new entries until owner ACK (journal or chat) |
| Averaging down | max once per position |
| Order hygiene | `review_equity_order` before every `place_equity_order`, no exceptions |
| Order type default | limit orders; market orders only for exits in fast moves |
| Max risk per position at entry ((entry−stop)×qty) | 2.5% of account |
| Max total open risk to stops, whole book | 8% of account |
| Beta-adjusted gross exposure (lev ETFs × multiplier) | ≤ 150% of account |
| Single theme/catalyst concentration at entry | ≤ 65% of account (lev at notional) |
| Settled funds (cash account) | buys with settled funds only; NEVER sell a position bought with unsettled proceeds before they settle (GFV); in doubt → skip the entry |

**Size from risk first**: `qty = (account × 2.5%) ÷ (entry − stop)`.
The 40% slot cap is a secondary bound. Stops only ever ratchet UP.

## 3. Lanes

### Lane 1 — Momentum / catalyst singles (primary)
- Thesis: an LLM agent's edge is breadth — reading news, filings, sector
  heat, and sentiment faster and wider than a human. Trade fresh catalysts
  (earnings reactions, guidance, product/regulatory news, sector rotations),
  not stale charts.
- Entry: named catalyst < 48h old + confirming tape (price above prior-day
  high or reclaiming VWAP-equivalent). Position 25–40%.
- Exit ladder: hard stop −8% from entry, placed with the fill. At **+5%**
  unrealized → raise stop to breakeven. At **+10%** → trail at
  max(breakeven, −8% from peak). At **+12%** → sell 1/3 to bank ≥ 1R,
  trail the rest. Stops ratchet up only. Time stop: thesis hasn't started
  working in 5 sessions → exit.

### Lane 2 — Leveraged ETF rotation (secondary, regime-gated)
- Universe: TQQQ / SOXL / SPXL-class long-leverage ETFs.
- Regime gate ON (allowed): QQQ above its 20-day average AND VIX < 25
  (estimate from quotes/news if no direct feed). Gate OFF → exit lane
  entirely, no new entries.
- Sizing within the 50% combined cap AND the §2 risk budget. Hard stop
  **−12%** from entry, placed with the fill; ratchets up only, re-checked
  every hourly run. Gate flipping OFF exits the lane regardless of stop.
  Re-enter only on a fresh gate check next run.
- Entry hygiene (all lanes): quote immediately before placement; place
  the marketable limit at decision time. Max ONE chase per order, ≤ +1%
  from the original limit; otherwise stand down until the next run.

### Lane 3 — Mean reversion (conditional tactic, not a standing lane)
- Active ONLY when the Lane-2 regime gate is OFF (chop/fear). Buy quality
  large-caps down ≥ 2 consecutive sessions and ≥ 8% below 10-session high
  on no thesis-breaking news; sell into the snap-back (+5–8%) or stop −7%.
- Rationale: momentum and mean reversion on the same book at the same time
  cancel each other. The regime gate decides which one is live.

### 3.7 — Extended-hours trading (owner ratified 2026-06-15, posture C)

Applies to ALL lanes during pre-market, after-hours, and the overnight
24-hour market. Regular-session rules are unchanged. **The §2 hard limits
and §3 entry hygiene / two-source rule all still bind** — this section
only governs the *extra* risk of trading when stops cannot rest.

- **Broker constraint (verified 2026-06-15):** extended/all-day sessions
  accept **LIMIT orders only** — Robinhood rejects stop/market orders
  outside regular hours (`EQUITY_ALL_DAY_TRADING_ERROR: order type must
  be limit`). Therefore **no protective stop can rest in extended hours.**
- **Orders:** marketable LIMIT at the inside quote only; never market.
  ONE chase max ≤ +1% from the original limit, then stand down (§3
  hygiene). Quote immediately before placement.
- **Stop still required:** every extended-hours entry MUST still get its
  regular-hours protective stop placed immediately after the fill
  (−8% singles / −12% lev), even though it only *activates* at the 9:30
  ET open. It is the floor and it is free — it does NOT protect against
  an intra-session or overnight gap. Stops ratchet UP only.
- **Overnight gap is accepted (posture C):** the owner accepts that a
  gap can blow through the stop (it triggers at the open; the fill may
  be worse than the stop price). Size with that in mind: the §2
  2.5%/position budget binds off (entry − stop) as always, AND for any
  position **carried overnight without an active stop** plan the
  worst-case fill as the stop price *plus slippage* — assume ≥ 2% through
  for singles, ≥ the −14.3% worst-held figure (BACKTEST §B3) for
  leveraged. If that worst case would breach the daily-loss halt or the
  drawdown checkpoint, do not size up.
- **Liquidity guard:** before any extended-hours order, check the
  bid/ask spread. If spread > **1.0% of mid**, stand down — thin
  extended books fill badly. (Regular-session spreads are not gated.)
- **Settled funds / GFV still bind:** extended-hours buys need settled
  cash; never sell shares bought with unsettled proceeds (cash account).
- **Daily-loss halt, drawdown checkpoint, max-positions, theme/lev/
  beta-gross/cash-buffer caps** all apply across every session.

### Lane 4 — Options (PARKED)
- Blocked until options tools appear on the MCP connection. When they do:
  journal the discovery, do NOT trade; owner will spec the lane first.

### Lane 5 — Crypto (PARKED, pre-spec'd for instant enable)
- Blocked until crypto order tools appear on the Agentic MCP (read/
  watchlist support already present; heartbeat checks every run and
  journals the moment order tools land).
- Pre-agreed terms, owner ratifies before first trade: majors only to
  start (BTC, ETH, SOL); combined crypto ≤ 35% of account; hard stop
  −10% per position; cadence extends to 24/7 (routine schedule change);
  no leverage. The §2 risk budget GOVERNS: at a −10% stop, 2.5%
  per-position risk implies ≤ 25% sizing — under the 35% combined cap,
  not beside it (reconciliation per HANDOFF-2026-06-12).
- Parallel RH Crypto *API* path (separate account/pot) documented in
  docs/VENUES.md §Tier 1.5 — parked by owner decision 2026-06-11.

## 4. Cadence

Schedule (v0.3): the heartbeat runs ~hourly **7:35 ET → 8:35 ET next
boundary, i.e. across pre-market, regular session, and after-hours**,
weekdays. Run-types by ET clock:

- **Pre-market extended (~7:00–9:30 ET):** scan catalysts, manage
  positions, and MAY enter/exit per §3.7 (LIMIT-only, liquidity guard,
  regular-hours stop placed with each fill).
- **Regular session (9:30–16:00 ET, hourly):** manage + execute, full
  lane logic, stops placed with fills (unchanged).
- **After-hours extended (~16:00–20:00 ET):** manage, react to news, and
  MAY enter/exit per §3.7 (LIMIT-only, liquidity guard).
- **EOD reconcile (~16:15 ET run):** reconcile fills, P&L, journal
  lessons; append one row to `data/marks.csv` (date, QQQ close, VIXY
  close, account value). Regime gate inputs come from this file:
  QQQ > 20-session MA AND vol leg = VIXY below prior close. Never use
  VIXY's absolute level as the VIX<25 leg — decaying ETP, direction only.
- **Weekend run:** research + propose policy diffs (NO trades, ever).
- True 24/7 cadence (crypto/event contracts) still activates only when
  those instruments ship on the MCP and the owner adds lanes; equities
  now trade the extended sessions above per §3.7.

## 5. Per-run process

1. Ground truth first: `get_accounts` → `get_portfolio` →
   `get_equity_positions` → open `get_equity_orders`. Trust tools over memory.
2. Read the last 5 entries of `JOURNAL.md`.
3. Enforce §2 limits and §1 status BEFORE considering any order.
4. Act per lanes (§3). Every order: review → place → confirm status.
5. Append a journal entry (format §6) **even for NO-TRADE runs**, commit.
6. If Robinhood tools are unavailable or erroring: append a `TOOLS-DOWN`
   entry and stop. No retries, no workarounds, no trading from cache.

## 6a. Measurement gate

Log every round-trip in `data/trades.csv` with its R-multiple
(P&L ÷ initial $ risk). Weekly review computes hit rate, avg win R,
avg loss R, expectancy/trade = `win% × avgWinR − loss% × avgLossR`.
**Adding capital requires: ≥ 10 closed trades, expectancy > +0.25R,
zero limit breaches, ≥ 4 weeks elapsed.**

## 6. Journal entry format

```
## 2026-06-12 13:30 UTC · run: market-hourly
- Account: $X,XXX (Δ day %, Δ total %) · cash $X,XXX
- Positions: TICKER qty @ avg (±%) [lane, stop]
- Actions: BUY/SELL/HOLD/NO-TRADE + 1-line reason each
- Catalysts considered: ...
- Limits check: OK | <which limit bound>
- Lesson (optional): ...
```
