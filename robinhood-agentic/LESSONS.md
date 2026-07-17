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

- **The universe is the WHOLE MARKET, not the watchlist — discover candidates
  market-wide every run (POLICY §3.1a).** Two weeks flat in a ripping tape
  because the loop only evaluated a 10-name watchlist: GLW ran +50% and
  AMBA/CRDO/NBIS/HSAI/WOLF ran +10–17% in our exact AI-infra theme — never seen,
  never filtered, just *invisible*. Source Lane-1 candidates from `bun run
  discover` (over a `run_scan` gainers scan) + `get_earnings_calendar`; the
  watchlist is a priority seed, not the boundary. Breadth is the stated edge; a
  fixed watchlist throws it away. (Discovery only widens what we SEE — the §3
  gate + §2 limits still decide every entry, so don't-chase-parabolic below
  still applies to whatever it surfaces.)
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
  do-not-chase, not a setup. RIVN 2026-07-02: a +13% Day-0 gap on a genuinely
  strong catalyst (Q2 delivery BEAT + FY guidance RAISE) that was HOLDING near
  highs (buyers above, not fading) STILL filtered — the binding test is stop
  placement, not the fade: a −8% stop from 19.43 lands at 17.88, at the breakout
  pivot with no higher-low above the gap, so a routine breakout-retest full-loses
  it. Even the best holding gap waits for the base; enter the continuation
  (trigger b) on the pullback-to-rising-support, not the Day-0 first leg.*
- **The daily-gainers scan only surfaces Day-0 gaps — trigger-(b) pullback
  entries need a maintained post-gap watch.** ~2.5 weeks 100% cash (since the
  06-17 DAL BE-stop) while discovery correctly filtered dozens of names (07-02
  alone: GPC +13%, AVAV +14%, RIVN +13%, plus a screen of biotech/healthcare
  pops) — nearly all Day-0 gaps with no placeable −8% stop under a higher-low.
  Breadth finds the move on its gap day, but the *buyable* setup (trigger-b
  continuation) is the pullback-to-rising-support 1–3 sessions LATER, which a
  gainers scan won't resurface (a pulling-back name isn't a top gainer). So
  carry the filtered-but-trending names on an explicit watch and re-quote them
  each session for the pullback — otherwise the breadth edge only ever produces
  correctly-filtered chases and zero fills. (Discovery working ≠ entering;
  don't relax the stop-placement filter to force a fill.)
- **A post-gap "in-band + stop-placeable" read is still a don't-chase when the
  reference high was a failed gap-and-fade spike — tapeReclaims is the real gate
  once placeability passes.** 2026-07-17 UNH: the +31.5% earnings BEAT gapped to
  461.62 then faded the whole move to close near lows (the beat was SOLD); next
  day it reclaimed the top of its 414–434 month range, which made `bun run
  postgap` mechanically IN-band (5.8% off 461.62) with the −8% stop resting under
  the 434 pivot = `stopPlaceable` TRUE — unlike RIVN, where placeability itself
  failed. The discretionary `tapeReclaims=false` is what correctly held it: a
  range-top reclaim of a sold earnings gap is not a pullback-to-rising-support in
  an established uptrend, and measuring a pullback off a failed single-print
  earnings spike is an artifact. The reference "post-gap high" must be a HELD
  high; when the engine's mechanical placeability passes, the loop's
  tape/uptrend-quality judgment is the binding filter.
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
- **Gate inputs matter to the cent — reconcile the provisional EOD print to the
  official SIP close before the next session scores the regime.** A Lane-2 re-arm
  once came down to 16¢. 2026-06-30: the 06-29 EOD row carried the provisional
  19:59:59Z print (QQQ 723.97) which scored the close risk-OFF by 1¢, but the
  official SIP close (724.08, +11¢) was risk-ON — flipping the raw gate to
  ON-pending and making 06-29 the **1st** risk-ON close (not the prospective one).
  A stale provisional can misstate the re-arm clock by a whole session; two
  agreeing close sources + sanity bounds keep a bad print from triggering an
  accidental leveraged entry.
- **marks.csv must be ONE row per date — dedupe before trusting the gate; an
  official-close correction EDITS the date's row, it never appends a new one.**
  2026-07-01: five separate regular-session runs each APPENDED a fresh "06-30
  official-close correction" row; union-merge (`.gitattributes`) kept all six, so
  the gate compared 06-30 (VIXY 21.29) against a *duplicate* 06-30 (21.29) → vol
  leg "≥ prior → FAIL" and the duplicated 736.40 rows dragged the MA20 up to
  725.17, spuriously flipping the CONFIRMED gate ON→OFF. `bun run verify` exit 0
  did NOT catch it (it validates row shape, not duplicate dates). Rule: at step 3,
  if `cut -d, -f1 marks.csv | sort | uniq -d` is non-empty, dedupe keeping the last
  (most-corrected) row per date and re-run `bun run gate` before acting on it.
- **On a fresh gate-ON, read the LIVE index + a lev-ETF before deploying — not
  the discover gainers list.** 2026-07-01: the gate was CONFIRMED ON from the
  06-30 close and the scan showed a screen of +10–19% gainers
  (RDDT/META/DLO/FRHC/COIN/MSTR), which reads like a melt-up — but live QQQ was
  −1.1% and SOXL −16% (a rotation OUT of semis into social/fintech/crypto). Green
  single-names over a red index is a rotation, not risk-on confirmation; chasing
  TQQQ/SOXL into it would have bought a −3%/−16% down-day. Gate-ON permits the
  lane; the live index/lev tape decides whether it's a safe entry.
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
