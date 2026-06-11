# POLICY.md — Robinhood Agentic trading policy

- **Version:** 0.1 (2026-06-11) · **Owner:** Ash
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
| Min cash buffer | 5% |
| Daily loss halt | −15% vs prior close → no new buys today, postmortem entry required |
| Drawdown checkpoint | account < $2,000 → pause new entries until owner ACK (journal or chat) |
| Averaging down | max once per position |
| Order hygiene | `review_equity_order` before every `place_equity_order`, no exceptions |
| Order type default | limit orders; market orders only for exits in fast moves |

## 3. Lanes

### Lane 1 — Momentum / catalyst singles (primary)
- Thesis: an LLM agent's edge is breadth — reading news, filings, sector
  heat, and sentiment faster and wider than a human. Trade fresh catalysts
  (earnings reactions, guidance, product/regulatory news, sector rotations),
  not stale charts.
- Entry: named catalyst < 48h old + confirming tape (price above prior-day
  high or reclaiming VWAP-equivalent). Position 25–40%.
- Exit: hard stop −8% from entry (tracked in journal; execute as orders);
  after +10%, trail at the larger of breakeven or −10% from peak. Time stop:
  thesis hasn't started working in 5 sessions → exit.

### Lane 2 — Leveraged ETF rotation (secondary, regime-gated)
- Universe: TQQQ / SOXL / SPXL-class long-leverage ETFs.
- Regime gate ON (allowed): QQQ above its 20-day average AND VIX < 25
  (estimate from quotes/news if no direct feed). Gate OFF → exit lane
  entirely, no new entries.
- Sizing within the 50% combined cap. Exit any holding on a −20% intraday
  move; re-enter only on a fresh gate check next run.

### Lane 3 — Mean reversion (conditional tactic, not a standing lane)
- Active ONLY when the Lane-2 regime gate is OFF (chop/fear). Buy quality
  large-caps down ≥ 2 consecutive sessions and ≥ 8% below 10-session high
  on no thesis-breaking news; sell into the snap-back (+5–8%) or stop −7%.
- Rationale: momentum and mean reversion on the same book at the same time
  cancel each other. The regime gate decides which one is live.

### Lane 4 — Options (PARKED)
- Blocked until options tools appear on the MCP connection. When they do:
  journal the discovery, do NOT trade; owner will spec the lane first.

## 4. Cadence

- Pre-market run (~8:30 ET): scan catalysts, plan the day, queue entries.
- Hourly during market hours: manage positions, execute plan, react.
- EOD run (~16:15 ET): reconcile fills, P&L, journal lessons.
- Weekend run: research + propose policy diffs (NO trades, ever).
- 24/7 cadence activates only when 24/7 instruments (crypto/event
  contracts) ship on the MCP and the owner adds lanes for them.

## 5. Per-run process

1. Ground truth first: `get_accounts` → `get_portfolio` →
   `get_equity_positions` → open `get_equity_orders`. Trust tools over memory.
2. Read the last 5 entries of `JOURNAL.md`.
3. Enforce §2 limits and §1 status BEFORE considering any order.
4. Act per lanes (§3). Every order: review → place → confirm status.
5. Append a journal entry (format §6) **even for NO-TRADE runs**, commit.
6. If Robinhood tools are unavailable or erroring: append a `TOOLS-DOWN`
   entry and stop. No retries, no workarounds, no trading from cache.

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
