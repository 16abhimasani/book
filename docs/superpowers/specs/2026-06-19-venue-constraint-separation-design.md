# Design — Venue/Constraint Separation + Disciplined Re-entry (shadow-first)

- **Date:** 2026-06-19 · **Owner:** Ash (binding decisions) · design by the trading-loop agent
- **Status:** approved (brainstorming + `/autoplan` dual-voice review). Re-entry ships
  **shadow-only**; POLICY §3.9 is **NOT binding** until shadow evidence earns it.
- **Scope (owner):** readiness hygiene. Formalize the seam, build re-entry as a
  measured (logged, no-order) strategy, document the on-chain swap. On-chain adapter
  parked until order tools exist.

## 0. Why shadow-first (review outcome)

Two independent adversarial reviews converged: §3.9 as originally drafted was a
*brake-removal with zero empirical basis*, guarded by a self-graded `thesisIntact`
flag, that degrades into "buy the 9% dip on a parabola" in a scenario already in
today's journal (SNDK). Every other POLICY diff in this repo cited a backtest or a
journaled outcome; §3.9 cited none. **Decision:** build the machinery, run it in
shadow (log what it *would* re-enter to `data/shadow-reentry.csv`, place nothing),
and ratify §3.9 into binding POLICY only after ~10–15 shadowed re-entries (or a
backtest) show positive expectancy — the same discipline as the §6a measurement gate
and the existing `shadow.csv`.

## 1. The seam

| Layer | Members | Venue-dependent? |
|---|---|---|
| **Strategy math** (pure fns) | `gate` · `trail` · `scaleout` · `reentry` (new) · `sizeFromRisk` R-math | **No** |
| **Risk appetite** (POLICY §2) | `RISK_PCT`, `SLOT_PCT`, `THEME_PCT`, `MAX_POSITIONS`, … | **No** — loss tolerance |
| **Venue mechanics** (`venue.ts`, new) | settled-funds, fractional units (live); the rest are doc facts | **Yes** |

## 2. Component A — `src/trading/venue.ts` (trimmed descriptor)

The review caught two things: the §2 constants are risk-appetite (correct, stays out),
**but** seven "facts" fields were typed dead weight that *look* enforced and aren't.
So the runtime type carries **only what code branches on**; every other venue fact
lives in the VENUES.md matrix (Component C) as documentation.

```ts
export interface Venue {
  id: string;
  settledFundsRequired: boolean; // gates checkLimits #8 (buy-side cash check)
  fractionalUnits: boolean;      // false → sizeFromRisk floors to whole shares
}
export const CASH_EQUITY: Venue = { id: "cash-equity", settledFundsRequired: true, fractionalUnits: false };
```

**Wiring (the only two seams):**
1. `sizeFromRisk(account, entry, stop, venue = CASH_EQUITY)` → `qty = venue.fractionalUnits ? raw : Math.floor(raw)`.
2. `checkLimits(book, venue = CASH_EQUITY)` → the "settled funds only" check (#8) runs only when `venue.settledFundsRequired`.

**Honest caveats (must be in the `venue.ts` doc comment AND the VENUES.md contract):**
- `fractionalUnits` gates `sizeFromRisk` **only**. [scaleout.ts](../../src/trading/scaleout.ts)
  independently floors thirds (`Math.floor(num*qty/den)`) and assumes integer shares —
  a fractional venue MUST also thread `venue` through `computeScaleOut`. Not delivered here; a documented blocker on the contract.
- `settledFundsRequired` gates the **buy-side** cash check only. The GFV **sell-side**
  rule (POLICY §2, the rule with a real 3-GFV loss history) is **not** in `risk.ts` —
  it stays loop discipline on every venue. The descriptor does not own GFV.

**Success criterion:** 119 existing tests green (CASH_EQUITY ≡ today) + 2 consumption
tests: a `{fractionalUnits:true}` fixture yields un-floored qty; a `{settledFundsRequired:false}`
fixture makes check #8 **absent** from `report.checks` (assert absence, not `pass:true`).

## 3. Component B — `src/trading/reentry.ts` (SHADOW-ONLY)

Pure function. **Returns a decision, not an order** — no stop, no size — so it is
structurally impossible to mistake for a placeable, gate-skipping order.

```
type ExitReason = "scaleout" | "trail" | "laggard" | "stop" | "be-scratch";

eligible  = exitReason ∈ {scaleout, trail}          // banked because it RAN (laggard/be-scratch/stop excluded)
            && sessionsSinceExit ≤ WINDOW            // default 5 trading sessions (holidays don't count); matches §3 time-stop
            && thesisIntact                          // §3 two-source bar, NOT a single grok line (see provenance rule)
            && !rollingOver                          // directional disqualifier: down ≥2 sessions OR lower-highs OR broke prior structural low
inBand    = pullbackPct ∈ [MIN, MAX] (±1e-9)         // MIN=0.04, MAX=0.12; pullbackPct = (recentHigh − price)/recentHigh
triggered = eligible && inBand && tapeConfirms       // tapeConfirms = broker-verifiable reclaim, loop-supplied; never defaults true
→ { eligible, triggered, reasons[] }                 // reasons[] names every failed gate (like risk.ts formatReport)
```

- **No `suggestedStop`.** When ratified, a real re-entry sizes via `sizeFromRisk` and
  stops via `computeTrailStop(fill, fill)` — one source of the −8%-from-entry truth,
  lane-correct (−12% lev), and it cannot lower a surviving lot's ratcheted stop.
- **Constants** `REENTRY_WINDOW=5`, `BAND_MIN=0.04`, `BAND_MAX=0.12` exported; the
  `policy-sync` test couples them to the §3.9 (shadow) prose so they can't drift.
- Input validation parity with trail/scaleout: throw on non-positive `price`/`recentHigh`,
  or `recentHigh < price`.

**Provenance rule (injection surface):** `thesisIntact` and `tapeConfirms` are the
loop's own judgments and MUST come from broker-verifiable price action (tape) + the §3
two-source rule (thesis) — never from a single grok/news assertion. The function is
pure (can't be injected); the rule is named where the ingested text actually lands.

**Shadow ledger** `data/shadow-reentry.csv` (mirrors `shadow.csv`): each run that sees
a banked-{scaleout,trail} winner pull back appends a row — date, symbol, exitReason,
sessionsSinceExit, pullbackPct, thesisIntact, tapeConfirms, eligible, triggered,
reasons, hypothetical entry/recentHigh. A later resolver (extend `shadow.ts`) scores
would-be outcomes. **No order is ever placed.**

**Loop wiring:** trading-loop SKILL manage step — for a banked winner whose thesis is
live, run `bun run reentry -- …` and append the shadow row. Explicitly: SHADOW ONLY,
no order, until §3.9 is ratified.

**Success criterion:** ~12 tests, one per gate, asserting `reasons[]` content (not just
the boolean, so no vacuous pass): wrong exit reason (`stop`, `be-scratch`, `laggard`) →
ineligible; `sessionsSinceExit` = 5 eligible / = 6 not; `thesisIntact:false` → ineligible;
`rollingOver:true` → ineligible; pullback exactly 4.00% and 12.00% in-band (epsilon),
3.99%/12.01% out; `tapeConfirms:false` → triggered:false; all-met → triggered; a
monotone/property test pinning the band; input-validation throws.

## 4. Component C — readiness doc (extend `docs/VENUES.md`, fold into Tier 3)

Add to the existing roadmap (no parallel doc; fold into the Tier-3 / Integration-pattern
sections rather than restating them): the seam table, the constraint-swap matrix, the
venue-integration contract. **Vendor the 8 security controls inline** (the
`llm-trading-agent-security` skill isn't on disk — the doc must be self-contained):
spend guard, pre-send simulation, mandatory `min_amount_out`, circuit breaker, key
isolation (session-funds hot wallet), MEV/private RPC, slippage+deadline, LLM-never-signs.

Matrix rows carry the honest caveats from §2 (scaleout also floors; GFV-sell is prose-only).
Keep the correction that lands the mental model: **on-chain is not "no rules" — it trades
regulatory rules (GFV/PDT/tax) for self-custody/execution rules that are *less* forgiving;
an injection or bad tool path is direct asset loss.** Contract closes with the 8-point
checklist as the on-chain venue's "before first trade" gate.

## 5. POLICY — §3.9 SHADOW (not binding)

Add §3.9 marked **SHADOW / pending ratification**: re-entry is being measured in
`data/shadow-reentry.csv`; it places no orders; ratify into binding POLICY only after
≥10–15 shadowed re-entries with positive hypothetical expectancy (or a backtest), same
bar as §6a. Document the eventual relaxation (drops only the <48h fresh-catalyst gate,
for eligible re-entries) so the intent is on record — but it is inert until ratified.
No live limit changes ship in this pass.

## 6. Build plan (each step verified before the next)

1. `venue.ts` (2 live fields) + wire `risk.ts` two seams + doc caveats → **verify:** 119 green + 2 consumption tests.
2. `reentry.ts` (decision-only) + `shadow-reentry.csv` + tests + SKILL shadow wiring → **verify:** ~12 reentry tests green, typecheck.
3. Extend `VENUES.md` (matrix + contract + 8 security points inline) → **verify:** covers all fns/facts + the 8 controls.
4. POLICY §3.9 SHADOW note + extend `policy-sync.test.ts` for reentry constants → **verify:** policy-sync green.
5. Full suite + typecheck → commit → **`/code-review`** final pass.

## 7. Ratification gate (what earns §3.9 going live — NOT this pass)

- ≥10–15 shadowed re-entries logged + positive hypothetical expectancy (or a backtest).
- The integration test: a triggered re-entry, fed as a normal candidate, still rejected
  on any §2 breach — proving the relaxation is scoped to only the <48h gate.
- Owner ratifies §3.9 into binding POLICY with that evidence cited.

## 8. Out of scope (say so to pull in)

- Placing real re-entry orders (shadow-only until ratified).
- Threading `venue` through `scaleout.ts` (fractional-venue blocker; documented).
- GFV sell-side as code (stays loop discipline).
- On-chain code (executor/sim/spend-guard) — lands with a real venue.
- `Venue` as a method-interface — upgrade only if a 2nd venue demands.
