# Overnight brief — 2026-06-12 (paste into Claude Code, leave running)

Committed copy of the owner's overnight session prompt. The session
should verify it is working from this same text (repo = truth).

---

You are running an overnight work session on `16abhimasani/book` (private). Goal: when the owner wakes up, the trading system is smarter, instrumented, and the morning run can ACT in minutes instead of researching. Work autonomously, parallelize with subagents where workstreams are independent, and keep going until the contract at the bottom is satisfied.

## Ground rules (non-negotiable)

1. Start: `git pull --rebase --autostash`. Read `CLAUDE.md`, `AGENTS.md`, `robinhood-agentic/README.md`, `POLICY.md` (v0.2 — BINDING), last 5 `JOURNAL.md` entries, `docs/HANDOFF-2026-06-12.md`, `docs/STRATEGY-REVIEW-2026-06-11.md`.
2. **Market is closed and this is a research/build session: you MUST NOT place or cancel any order.** No `place_equity_order`, no `cancel_equity_order`, under any reasoning. Read-only broker tools (`get_portfolio`, `get_equity_positions`, `get_equity_orders`, `get_equity_quotes`) are allowed if the Robinhood connector is attached; if it isn't, proceed — every workstream below works without it.
3. Do not edit `POLICY.md` (owner-only). Improvements = PROPOSALS in docs or PR description.
4. Live stop registry (do not touch): MU 1 @ 941.50 (6a2b62e1) · INTC 6 @ 105.00 (6a2af32a) · TQQQ 12 @ 65.43 (6a2b6887).
5. Commit per workstream with clear messages. If your runtime pushes to a `claude/*` branch, open ONE PR at the end titled `overnight: 2026-06-12 build + premarket pack` — never leave work stranded.
6. Runtime: prefer Bun (`bun install`, `bun test`); fall back to `npx tsx` / node if Bun is unavailable. New code lives under `src/trading/`. No new heavy deps; no secrets anywhere.
7. Timebox ~6h. If a workstream is blocked >30min, log the blocker in the handoff and move on. Priority order is P0 → P4.

## P0 — Pre-market intelligence pack → `robinhood-agentic/docs/PREMARKET-2026-06-12.md`

- Overnight + after-hours review of MU, INTC, TQQQ/QQQ futures context; any news that breaks the ORCL-capex-rotation thesis. Gap-risk note vs each stop.
- Tomorrow's (Fri 2026-06-12) econ calendar (pull it fresh — don't assume) + earnings calendar; flag anything that hits semis/tech.
- Iran/oil overnight status (the live tail risk per journal).
- 3–5 fresh Lane-1 catalyst candidates, EACH with: catalyst + age, entry zone, stop, qty precomputed via POLICY §2 risk formula (2.5% risk on current account value), which limit binds, and what would invalidate it pre-open. Plus explicit DO-NOTHING criteria (when the morning run should sit on hands).
- Format: skimmable on a phone in 2 minutes; decisions pre-chewed.

## P1 — Make the regime gate data-driven → `data/marks.csv` + `src/trading/gate.ts`

- Backfill `robinhood-agentic/data/marks.csv` with ≥40 trading sessions of QQQ, VIXY, TQQQ daily closes from a free no-auth source (e.g. stooq.com CSV endpoints); keep the existing 06-10/06-11 rows as verification anchors (values must match — if not, document the discrepancy, keep ours, note source basis).
- `src/trading/gate.ts` + CLI (`bun run gate`): computes 20-session QQQ MA, VIXY direction, prints gate state ON/OFF for a given date from the CSV. Unit tests.
- Write the computed gate state for 2026-06-12 into the P0 doc (replaces "est. mid-690s" guessing forever).

## P2 — Risk engine as code → `src/trading/risk.ts` (+ tests)

- Pure functions: `sizeFromRisk(account, entry, stop)` per POLICY §2; full limits checker taking a positions/candidates JSON → pass/fail per limit (2.5%/position, 8% book, 40% slot, 50% lev, 150% beta-gross, 65% theme, 5% cash); `rMultiple(entry, stop, exit, qty)`.
- Tests must reproduce the known book: 06-11 entry risk $264.20 → post-ratchet ~$192/5.6%. CLI: `bun run risk -- positions.json`.
- PROPOSAL (in PR/handoff, not applied): one-line change to `.claude/skills/trading-loop/SKILL.md` step 5 to run this before any order, so no agent ever does sizing arithmetic in its head.

## P3 — Validate the gate before we trust it more → `robinhood-agentic/docs/BACKTEST-REGIME-GATE.md`

- 2–3 years daily QQQ/TQQQ (same source as P1). Strategy: gate ON → hold TQQQ, OFF → cash. Compare vs buy-hold QQQ and buy-hold TQQQ: CAGR, max drawdown, time-in-market, worst single day held.
- Sensitivity: MA length 10/20/50 × vol-leg variants (VIXY-direction vs none). Honest caveats section (no slippage/taxes, regime fit, sample size). Findings as PROPOSALS only.

## P4 — Expectancy instrumentation + catalyst calendar

- `src/trading/stats.ts` + `bun run stats`: reads `data/trades.csv` → hit rate, avg win/loss R, expectancy, and a §6a gate scoreboard (≥10 trades / >+0.25R / breaches / weeks elapsed) printed as the weekly-review header.
- `robinhood-agentic/docs/EARNINGS-WATCH.md`: liquid US names reporting next 2 weeks that fit Lane 1 (web research), with date, expected-move context if findable, and which would qualify under entry hygiene.

## Stretch (only if P0–P4 are done)

- Draft `.claude/skills/premarket-brief/SKILL.md` (generates a P0-style doc any morning).
- Design doc: API-triggered routine for event-driven runs (price-alert webhook → routine) — architecture only.

## End-of-session contract (do not skip)

1. `robinhood-agentic/docs/HANDOFF-2026-06-12-morning.md`: what shipped per workstream, what the 8:30 pre-market run should DO (concretely), proposals awaiting owner ratification, blockers/anomalies.
2. JOURNAL.md entry (`run: overnight-research`, NO-TRADE) per POLICY §6.
3. Everything committed; pushed to main or single PR opened. Print the PR/commit URL as your final output, plus a 10-line summary the owner can read on his phone.
