---
name: trading-loop
description: Run one iteration of the Robinhood Agentic trading loop per robinhood-agentic/POLICY.md (binding). Use for scheduled heartbeat runs (pre-market, market-hourly, EOD, weekend research), routine executions, or ad-hoc "run the trading loop" requests. Requires the Robinhood Trading MCP connector and git access to this repo.
---

# Trading loop — one iteration

Identical on every surface (Claude Code cloud, local CLI, Cowork).
POLICY.md is the contract; JOURNAL.md is the memory; this skill is the
heartbeat.

## Steps

0. **Sync**: `git pull --rebase --autostash`. Never read stale state.
1. **Read** `robinhood-agentic/POLICY.md` (fully), last 5 entries of
   `robinhood-agentic/JOURNAL.md`, newest `robinhood-agentic/docs/HANDOFF-*.md`
   if present. POLICY status `HALT` → journal and stop.
2. **Verify tools**: `get_accounts` → trade ONLY the account with
   `agentic_allowed: true`. Tools missing/erroring → append `TOOLS-DOWN`
   journal entry, commit/push, STOP (never trade from memory). Check for
   newly-exposed tool categories (crypto/options/event-contract order
   tools) → journal `NEW-TOOLS`, do NOT trade them (owner ratifies the
   parked lane first).
3. **Ground truth**: `get_portfolio`, `get_equity_positions`, open
   `get_equity_orders`. Reconcile against the stop registry in the last
   journal entry; replace any missing stop immediately.
4. **Run-type** from ET clock: pre-market (~8:30–9:30) plan only;
   market-hourly (9:30–15:30) manage + execute; EOD (~16:15) reconcile,
   append `data/marks.csv` row, NO new entries; weekend/other =
   research/journal only, never trade.
5. **Enforce POLICY §2 before any order** (risk budget 2.5%/position &
   8% book, slot caps, beta-adjusted ≤150%, theme ≤65%, settled-funds
   rule, daily halt, drawdown checkpoint). **Compute, never estimate:**
   refresh `robinhood-agentic/data/book.json` from ground truth, then
   `bun run risk -- robinhood-agentic/data/book.json` (candidates
   included) must pass before any order — or fail only on journaled
   grandfathered violations; size entries with `bun run risk -- size
   <account> <entry> <stop>`; check the Lane-2 gate with `bun run gate`.
   Execute lanes per §3 incl.
   exit ladder (+5% → breakeven, +10% → trail, +12% → bank 1/3) and
   entry hygiene (quote at placement, ONE chase max ≤ +1%).
   `review_equity_order` before every `place_equity_order`; surface
   `market_data_disclosure` verbatim; fresh UUID `ref_id` per order.
6. **Data upkeep**: new fill → `data/trades.csv` row; round-trip close →
   fill exit/pnl/R columns; EOD → `data/marks.csv` row.
7. **Journal** per POLICY §6 (even NO-TRADE), commit
   (`journal: <UTC ts> <run-type>`), push. If the runtime pushes to a
   `claude/*` branch, open a PR immediately so main never lags.
8. **Output**: account value, positions P&L, actions, next watch items.

## Hard rules

- Never exceed POLICY limits; never loosen them; stops ratchet UP only.
- Owner-only: POLICY edits, capital adds, enabling parked lanes.
- One heartbeat at a time (OPERATIONS §B) — if another writer is
  actively journaling this window, go journal-only.
