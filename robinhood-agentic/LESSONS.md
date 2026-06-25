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
  FOMO. *MU 2026-06-25: a +18% liquid-large-cap earnings gap declined across ~8
  runs round-tripped intraday (1255 high → 1136, −9.5%, in 25 min) — a gap with
  no buyers above it distributes. The rule: wait for a multi-session base that
  builds a higher-low to rest a −8% stop under; an opening spike-and-fade is a
  do-not-chase, not a setup.*
- **Gate-ON permits the Lane-2 lane, it does not trigger an entry.** A fresh
  gate-ON read means re-evaluate, not buy.
- **Verify a catalyst's DATE before calling it fresh — never inherit a prior
  run's "<48h" tag.** AVGO carried a "<48h earnings" label across three 06-17
  journals while the report was actually June 3 (14 days stale); pulling the
  date killed a +4.9% momentum-chase. Freshness is computed from the event
  date every run, not copied forward.

## Exits & gain protection

- **Stops protect entries, not profits — ratchet to breakeven early.** A winner
  still carrying its -8%-from-entry stop can round-trip a +5% gain into a -13%
  loss. The +5% → breakeven rung exists for exactly this. *Retro 06-18 (AMD + DAL,
  both 0R BE scratches): the rung is NOT cutting winners short — each faded from its
  peak, scratched at BE, then traded BELOW the exit and never re-took its prior high
  (AMD 536 < 558, DAL 84 < 87); the later pop was macro beta, not single-name
  follow-through. A 0R scratch on a faded thesis is the rung working, not a leak. The
  one real gap — AMD tagging +8.4% then giving it back — is what v0.3.5's +8%→lock-+3%
  already closes.*
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

## Venue rules (what's actually allowed)

- **Cash account = unlimited day trades with SETTLED funds; only GFV gates
  (verified 2026-06-17 via broker + research).** The agentic account
  (••••5686) is a CASH account. There is NO pattern-day-trader limit — PDT is
  margin-only, and it was eliminated for margin in 2026 anyway. You can buy and
  sell as often as you like *as long as you use settled cash*. The ONE gate is
  the Good Faith Violation: never sell a position bought with UNSETTLED proceeds
  before those proceeds settle (T+1); 5 GFVs in 12 months → 90-day closing-only
  restriction. POLICY §3.7 settled-funds rule already enforces this. So
  disciplined re-entry on a pullback IS allowed (settled cash). Short-term tax
  is the owner's concern, not the bot's optimization target. On-chain (future):
  none of this applies — no settlement, no GFV, no PDT.

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
- **A gate flip can be stale the instant it confirms — re-check after a major
  after-hours catalyst.** 2026-06-24: `bun run gate` confirmed risk-OFF on the
  4pm close at the exact moment MU's blowout earnings (+14% AH) reversed the
  whole semi complex risk-ON (SOXL +12% / QQQ +1.8% AH). The gate is a lagging
  close-based signal; a binary AH catalyst can reprice the regime the gate just
  stamped. Don't rush Lane-3 mean-reversion off a gate that flipped OFF as the
  tape flipped back ON — let the next confirmed close settle it.

---

_Update mechanism wired into `.claude/skills/trading-loop` (read at step 1,
curated at step 7, synthesized in the weekend retro)._
