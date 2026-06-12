# Handoff — overnight build session → 2026-06-12 morning run

Session per `docs/OVERNIGHT-BRIEF-2026-06-12.md` (verified against the
pasted prompt — matched). **Zero orders placed/cancelled; POLICY.md and
the three live stops untouched** (all three verified against the broker at
~03:00 UTC: MU `6a2b62e1` queued, INTC `6a2af32a` confirmed, TQQQ
`6a2b6887` queued). All work on `main`, pushed.

## What shipped (all tested: 28 tests pass, `bun test src/trading`)

| WS | Deliverable | Where |
|---|---|---|
| P0 | Pre-market pack (phone-skimmable) | `docs/PREMARKET-2026-06-12.md` |
| P1 | marks.csv backfilled 2→45 sessions (anchors match to the cent) + deterministic gate CLI | `data/marks.csv`, `src/trading/gate.ts`, `bun run gate` |
| P2 | POLICY §2 risk engine (sizing, full limits checker, R-multiple) | `src/trading/risk.ts`, `bun run risk`, snapshot `data/book.json` |
| P3 | 3y gate backtest + report | `src/trading/backtest.ts`, `docs/BACKTEST-REGIME-GATE.md` |
| P4 | §6a expectancy CLI + earnings watch | `src/trading/stats.ts`, `bun run stats`, `docs/EARNINGS-WATCH.md` |
| Extra | Owner-requested skills survey | `docs/SKILLS-CATALOG-2026-06-12.md` |
| Stretch | premarket-brief skill draft + event-driven-runs design | `.claude/skills/premarket-brief/`, `docs/DESIGN-EVENT-DRIVEN-RUNS.md` |

Data source note: stooq (the brief's example) is behind a JS proof-of-work
wall; **Yahoo v8 chart API** used instead — raw closes matched both
marks.csv anchor rows and the broker's official SIP closes exactly.

## What the 8:30 run should DO (details in PREMARKET doc)

1. Verify the 3 stops flipped to confirmed at open; replace any missing.
2. **Exit TQQQ — the gate is OFF** (QQQ 717.12 < 20d MA 721.42, computed,
   not estimated). Cancel `6a2b6887` then immediately sell-limit at quote.
   Proceeds settle Monday → today's buys stay capped at $481.40 settled.
3. INTC ≥ 119.86 → ratchet stop to breakeven 114.15.
4. New entries only per the candidates table (RH/MMM/DAL, cash-bound
   qtys 2/3/5) and only if no DO-NOTHING criterion fires. Run
   `bun run risk` on the refreshed book before any order.

## Findings the owner should read (5 min)

1. **The estimated gate was wrong.** 01:58Z journal: "ON … est. mid-690s
   MA". Real MA20 = 721.42 → gate was OFF at Thursday's close, and was
   also OFF at Wednesday's close — **the TQQQ entry itself wouldn't have
   passed the data-driven gate**. Not a breach (estimation was the
   policy-sanctioned method until 20 rows existed), but the era of
   estimating is over: `bun run gate`.
2. **The journaled "~$192 ≈ 5.6%" book risk is unreproducible.** Code says
   post-ratchet risk-to-stops = **$161.94 (5.2%)** (the 02:10Z figure
   mixed the old TQQQ stop with AH account value). Entry-time risk
   $264.20 reproduces exactly. Tests pin both.
3. **The current book violates two v0.2 caps it predates** (TQQQ
   per-position risk 3.4% > 2.5%; theme ai-capex 84.1% > 65%). Both
   grandfathered (entered pre-ratification), both now visible on every
   `bun run risk` — and the theme cap **hard-blocks any semis/AI add**
   until MU/INTC shrink.
4. **Backtest** (3y): the policy gate variant roughly halves TQQQ maxDD
   (−24.5% vs −58%) at the cost of upside and ~144 round trips of churn
   from the VIXY day-direction leg. Proposals B1–B4 in the report.
5. **MU reports 06-24 AMC (confirmed).** Time stop 06-18 forces the exit
   decision first. Never hold into the print.

## Proposals awaiting owner ratification (nothing applied)

- **SKILL.md step-5 one-liner (P2 contract):** in
  `.claude/skills/trading-loop/SKILL.md` step 5, after "Enforce POLICY §2
  before any order", insert:
  > Run `bun run risk -- robinhood-agentic/data/book.json` (with the
  > book refreshed from ground truth) and `bun run risk -- size <account>
  > <entry> <stop>` for any candidate — orders proceed only if the
  > checker passes or the violation is a pre-existing grandfathered one;
  > never do sizing arithmetic in-head.
- **Backtest proposals B1–B4** (`docs/BACKTEST-REGIME-GATE.md`): keep
  MA20+VIXY gate (B1); 2-day flip confirmation to cut churn (B2 — needs
  follow-up backtest, harness exists); plan Lane-2 gap risk at −14.3%
  worst-held-day (B3); backtest ≠ §6a evidence (B4).
- **Gate semantics codified:** `gate.ts` reads POLICY's "VIXY below prior
  close" strictly (flat day = OFF). Tests document it; owner may prefer ≤.
- **marks.csv schema kept as-is** (no tqqq column despite brief wording) —
  the live EOD append contract per POLICY §4 would silently misalign;
  TQQQ history lives in `data/history/tqqq.csv`. Ratify or amend.
- **Skills install shortlist** (`docs/SKILLS-CATALOG-2026-06-12.md`):
  tradermonty's earnings-calendar / economic-calendar-fetcher /
  market-news-analyst / backtest-expert, by file copy at pinned SHA,
  analysis-only. staskh `ib-*` execution skills: never.

## Blockers / anomalies (honest log)

- **Research workflow hit the session usage cap** (~22:03 CT) mid-flight;
  one of four researchers (positions/overnight) completed with full
  sourced output pre-cap; macro/catalysts/earnings were finished via
  direct foreground searches after the 00:30 CT reset. The formal
  adversarial-verify stage ran only for the Iran claim (the load-bearing
  one — it got STRONGER: joint framework released late Thu). Calendar
  items in the P0 doc are marked "verify pre-open" where single-sourced.
- UMich 10:00 ET timing inferred from the second-Friday pattern +
  May-print reporting; not independently confirmed overnight.
- Workflow harness leaves the orphaned run wf_0b413524 in session state;
  harmless (its salvageable output was extracted from transcripts).
- trades.csv TQQQ note was stale (still cited cancelled stop `6a2af57f`);
  fixed to `6a2b6887`.

## For the next overnight session (pattern that worked)

Broker-verified ground truth first → compute (gate/risk CLIs) before
research → background research while building code → salvage transcripts
if agents die → adversarially verify only the load-bearing claim. The
CLIs killed three "known" numbers in one night; trust code over journal
arithmetic.
