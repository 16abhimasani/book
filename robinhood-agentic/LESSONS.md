# LESSONS.md — what the runs have learned

Distilled, durable lessons the trading loop reads **every run** (POLICY is the
contract, JOURNAL is the episodic log, this is the semantic memory). The
journal only surfaces the last few entries, so a lesson learned 10 runs ago
falls out of context — it lives here instead, and compounds.

**How to maintain this (loop does it, owner curates):**
- After a notable outcome — a closed trade, a stop-out, a missed mover, a
  surprise — add or sharpen ONE lesson. Evidence in one line.
- Curate, don't dump. Merge duplicates, prune the stale. Keep it under ~20
  lessons. If everything is a lesson, nothing is.
- A lesson is the insight + why we believe it + the rule it implies.

---

## Discipline

- **Compute, never estimate.** The regime-gate estimate and a "$192 book-risk"
  figure were both wrong within 24h of being journaled. Anything an agent could
  do in its head comes from a tested CLI instead (`bun run gate/risk/stats/book`).
- **POLICY-as-code makes trade-offs precise.** The cash-buffer edit flipped
  exactly one limit check and one blocked trade became allowed — the cost was
  visible before real money moved. Prefer a checkable rule over a vibe.

## Entries

- **Place the marketable limit at decision time; one chase max (≤ +1%).**
  Re-quoting TQQQ three times cost +2.1% vs the original plan. The move you
  chase has usually already left.
- **Don't chase parabolic / extended moves.** SPCX up 22% after-hours on a
  4-day-old IPO had no place to put a stop. Chasing the candle is the mistake;
  being positioned for the next leg is the trade. Aggression is readiness, not
  FOMO.
- **Gate-ON permits the Lane-2 lane, it does not trigger an entry.** A fresh
  gate-ON read means re-evaluate, not buy.

## Exits & gain protection

- **Stops protect entries, not profits — ratchet to breakeven early.** A winner
  still carrying its -8%-from-entry stop can round-trip a +5% gain into a -13%
  loss. The +5% → breakeven rung exists for exactly this.
- **Trail off the TRUE session high, not the last hourly observation.** MU's
  real high was ~9 points above the last-observed at the prior run, so the -8%
  trail had been set ~8 points too low. Pull intraday highs at manage time.
- **Lock harder as a winner gets extended (tiered trail).** 2026-06-16: a
  broad semis risk-off faded MU from a +19% peak; the flat -8% trail kept only
  +8.4%, and AMD round-tripped +8%→breakeven (the old +5%→+10% dead zone). Now
  (POLICY §3, v0.3.5): +8% locks +3%, and the trail tightens -8%/-6%/-5%/-4% as
  the peak gain grows. Always `bun run trail -- <entry> <peak>` for the exact
  stop — never compute it by hand. Tighter isn't free (MU bounced after its
  stop); the point is to lock more only once a name is extended, not to whipsaw
  normal winners.
- **Extended hours can't rest a stop (limit-only).** A position held overnight
  has no active stop until 9:30 ET; size for the gap, never assume protection.

## Regime gate

- **The gate churns near its moving average — so we confirm flips (B2, live).**
  First live use forced a correct exit but was nearly reversed intraday (QQQ
  tagged the MA within hours). The fix is ratified and live: the gate acts only
  after the new state holds 2 consecutive closes (POLICY §3 Lane 2). Act on the
  CONFIRMED state from `bun run gate`; a one-day flip shows as "raw … pending"
  and changes nothing.
- **Gate inputs matter to the cent.** A Lane-2 re-arm came down to 16 cents on
  the official close. Two agreeing close sources + sanity bounds are the only
  reason a bad print can't trigger an accidental leveraged entry.

---

_Update mechanism wired into `.claude/skills/trading-loop` (read at step 1,
curated at step 7, synthesized in the weekend retro)._
