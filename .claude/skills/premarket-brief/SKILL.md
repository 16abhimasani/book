---
name: premarket-brief
description: Generate the morning pre-market intelligence pack (PREMARKET-<date>.md) for the Robinhood Agentic book — overnight review of open positions, gap risk vs stops, fresh econ/earnings calendars, Lane-1 catalyst candidates with code-computed sizing, and explicit DO-NOTHING criteria. Use before the ~8:30 ET pre-market run, or whenever the owner asks for a morning brief. Research-only — this skill never places, modifies, or cancels orders.
---

# Pre-market brief — research only, never trades

Produces `robinhood-agentic/docs/PREMARKET-<YYYY-MM-DD>.md`, phone-skimmable
in 2 minutes, decisions pre-chewed. The trading-loop skill consumes it; this
skill must NOT call `place_equity_order` / `cancel_equity_order`, ever.

## Steps

0. **Sync**: `git pull --rebase --autostash`. Read POLICY.md, last 5
   JOURNAL.md entries, newest `docs/HANDOFF-*.md`, yesterday's
   PREMARKET doc if any.
1. **Ground truth** (read-only): `get_portfolio`, `get_equity_positions`,
   open `get_equity_orders` (verify the stop registry), `get_equity_quotes`
   for held symbols + QQQ/VIXY (pre-market marks + official closes).
2. **Compute, don't estimate**:
   - `bun run gate <today>` → deterministic Lane-2 gate (also note the
     QQQ level that would flip today's close-basis gate).
   - `bun run risk -- robinhood-agentic/data/book.json` after refreshing
     the snapshot with current values → which §2 limits bind today.
   - `bun run stats -- --as-of <today>` → §6a scoreboard one-liner.
3. **Research** (web): overnight/AH news per position + thesis check;
   today's econ + earnings calendars pulled fresh; live tail risks
   (currently: Iran/oil); index futures direction.
4. **Candidates**: 3–5 fresh Lane-1 catalysts (<48h, liquid). For each:
   catalyst + age, entry zone, stop, `bun run risk -- size <account>
   <entry> <stop>` for qty, which limit binds (cash? slots? theme?),
   pre-open invalidation. Respect reality: settled cash and free slots
   cap what's actually tradable — say so per candidate.
5. **DO-NOTHING criteria**: explicit conditions for the morning run to
   sit on hands (gap conditions, calendar landmines, gate state, cash).
6. **Gap-risk table**: per position — stop, distance from last close,
   overnight news pressure, what a -X% open does to the book.
7. **Write the doc** (format below), commit
   (`docs: premarket <date>`), push. If on a `claude/*` branch, PR
   immediately.

## Doc format (keep this order — phone reader)

1. Header: account value, cash, positions one-liner, gate state, §2
   binding limits — 5 lines max.
2. "Do this at 8:30" — numbered actions the trading loop should take,
   each with its POLICY clause.
3. "Do NOTHING if" — bullet criteria.
4. Positions & gap risk table.
5. Candidates table (pre-sized).
6. Calendar (econ + earnings, ET times).
7. Tail risks + invalidations.
8. Sources footnote (URLs + timestamps).

## Hard rules

- Read-only against the broker. No order tools, no exceptions.
- Numbers come from the CLIs (`gate`/`risk`/`stats`), not mental math.
- Every catalyst claim needs a source URL + age. Unconfirmed → say so.
- POLICY.md is binding; this skill never proposes loosening it.
