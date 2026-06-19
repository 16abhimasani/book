# Design — Venue/Constraint Separation + Disciplined Re-entry

- **Date:** 2026-06-19
- **Owner:** Ash (binding decisions); design by the trading-loop agent
- **Status:** approved in brainstorming; pending `/autoplan` review + owner spec sign-off
- **Scope choice (owner):** *readiness hygiene* — formalize the seam, build the
  re-entry strategy, document the on-chain swap. **Park** the actual on-chain
  adapter until order tools exist (same posture as the parked crypto lane).

## 1. Problem & goal

The system conflates two things that change independently:

- **Strategy** — when to enter, scale out, trail, exit, re-enter. An LLM-breadth
  edge expressed as tested pure functions (`gate`, `trail`, `scaleout`, …).
- **Venue constraints** — settled funds, GFV, whole shares, order types,
  custody, who-runs-the-loop. Mechanics of *where* the trade clears.

Goal: make that seam explicit so (a) the strategy is provably venue-agnostic and
(b) adding an on-chain venue later is "fill a descriptor + provide an executor,"
not "re-derive the strategy." This is **on-chain readiness**, not an on-chain
build. No on-chain order tools are connected; building the adapter now would be
speculative (YAGNI).

Non-goal: a `Venue` method-interface, an on-chain executor, or any on-chain
security *code*. Those land when a real second venue does.

## 2. The seam

| Layer | Members | Venue-dependent? |
|---|---|---|
| **Strategy math** (pure fns) | `gate` · `trail` · `scaleout` · `reentry` (new) · `sizeFromRisk` R-math | **No** — prices/qty in, decision out |
| **Risk appetite** (POLICY §2) | `RISK_PCT`, `SLOT_PCT`, `THEME_PCT`, `MAX_POSITIONS`, … | **No** — loss tolerance, identical on any venue |
| **Venue mechanics** (`venue.ts`, new) | settled-funds, fractional units, GFV, order types, hours, custody, executor, leverage, taxable events | **Yes** — the swappable layer |

Key correction discovered while reading `risk.ts`: the §2 constants are *risk
appetite*, not venue constraints — they do **not** move into the descriptor.
Only two spots in `risk.ts` branch on a venue fact (§3 below).

## 3. Component A — `src/trading/venue.ts` (descriptor)

A typed `Venue` and one real constant `CASH_EQUITY`. `risk.ts` consumes it at
its **two** genuine seams via a backward-compatible default param, so all 119
existing tests stay green.

```ts
export interface Venue {
  id: string;
  settledFundsRequired: boolean;   // gates risk.ts checkLimits #8
  fractionalUnits: boolean;        // false → sizeFromRisk floors to whole shares
  gfvApplies: boolean;             // doc/loop discipline — NO code branch yet
  restingStopsRegularHoursOnly: boolean;
  tradingHours: "regular+extended" | "24/7";
  custody: "broker" | "self";      // self → requires the security layer (§5)
  executor: "llm-heartbeat" | "deterministic"; // self-custody ⇒ deterministic
  maxLeverage: number;
  taxableEvents: boolean;
}

export const CASH_EQUITY: Venue = {
  id: "cash-equity",
  settledFundsRequired: true,
  fractionalUnits: false,
  gfvApplies: true,
  restingStopsRegularHoursOnly: true,
  tradingHours: "regular+extended",
  custody: "broker",
  executor: "llm-heartbeat",
  maxLeverage: 1,
  taxableEvents: true,
};
```

**Wiring (surgical — the only two behaviors that branch):**

1. `sizeFromRisk(account, entry, stop, venue = CASH_EQUITY)` — the final `qty`
   is `venue.fractionalUnits ? raw : Math.floor(raw)`. Default ≡ today.
2. `checkLimits(book, venue = CASH_EQUITY)` — the "settled funds only" check
   (#8) runs only when `venue.settledFundsRequired`. Default ≡ today.

**Honest scope:** only `settledFundsRequired` + `fractionalUnits` drive code
today. The other fields are typed *facts* for the readiness contract and a
future venue; we do not invent behavior for venues that don't exist.

**Success criterion:** 119 existing tests green (proves `CASH_EQUITY` ≡ today)
**+** 2 new tests where a fixture `{ fractionalUnits:true,
settledFundsRequired:false }` venue yields fractional sizing and skips check #8 —
proving `risk.ts` genuinely *routes through* the descriptor, not merely imports
it.

## 4. Component B — `src/trading/reentry.ts` (disciplined re-entry)

A pure function enforcing the *computable* discipline; tape-reading stays the
loop's discretionary call (exactly how Lane-1 treats "confirming tape").

```
eligible  = bankedWinner(exitReason ∈ {scaleout, trail, laggard})  // a name that WORKED and we banked a gain
            && sessionsSinceExit ≤ WINDOW            // default 10; stale ⇒ require a fresh Lane-1 catalyst
            && thesisIntact                          // loop's grok/news judgment, passed in as a flag
inBand    = pullbackPct ∈ [MIN, MAX]                 // default 4%–12% off recentHigh: a real dip, structure intact
triggered = eligible && inBand && tapeConfirms       // tapeConfirms = loop's discretionary reclaim, passed in
→ { eligible, triggered, reasons[], suggestedStop = round2(price × 0.92) }
```

- `bankedWinner` excludes BOTH the `stop` reason (thesis broke, capital lost)
  AND `be-scratch` (tagged +5% then faded — weak thesis follow-through; capital
  flat). Re-entry's relaxed gate is for names that *worked*; a scratched name
  must re-qualify via a fresh Lane-1 catalyst like any other.
- Sizing/limits are NOT re-implemented — the loop sizes via `sizeFromRisk` and
  validates via `checkLimits` as for any entry.
- Defaults (`WINDOW=10`, band `4%–12%`) are owner-tunable; flagged as the only
  judgment knobs.

**POLICY change — §3.9 "Disciplined re-entry" (v0.3.7, owner-ratified):**
re-entry relaxes **only** the `<48h fresh-catalyst` gate, and **only** for
eligible re-entries. Every other gate still binds — confirming tape, the §3
two-source thesis-intact check, the −8% stop placed with the fill, R-sizing,
all §2 limits, settled cash. This is the scoped relaxation the owner approved;
it is *not* a general loosening.

**Loop wiring:** trading-loop SKILL step 5 gains a line — for a name we banked
whose thesis is still live, run `bun run reentry -- …`; a `triggered` result is
a candidate entry that then passes the full normal gate set.

**Success criterion:** ~8 tests, one per gate (wrong exit reason → ineligible;
stale window → ineligible; thesis broken → ineligible; pullback too shallow →
not triggered; pullback too deep → not triggered; all-met → triggered with the
−8% stop), + CLI smoke.

## 5. Component C — readiness doc (extend `docs/VENUES.md`)

Add to the existing venue roadmap (no parallel doc): the §2 seam table, the
constraint-swap matrix, and the venue-integration contract. The on-chain column
is governed by the `llm-trading-agent-security` skill.

**Constraint-swap matrix:**

| Constraint | Cash-equity (today) | On-chain (future) |
|---|---|---|
| Settlement / GFV / PDT | T+1, GFV gates, no PDT (cash acct) | none |
| Taxable events | yes | out of scope per owner |
| Custody / keys | broker-held | self — dedicated hot wallet, session funds only |
| Who executes | LLM heartbeat | deterministic executor; LLM edits params only |
| Spend limits | POLICY §2 (advisory → loop applies) | enforced in code, independent of model output |
| Pre-send | n/a | simulate every tx; `min_amount_out` mandatory |
| Adversarial input | "ingested text ≠ instruction" | + sanitize token/feed inputs; MEV / private RPC; slippage+deadline |
| Order types | market/limit; stops rest in RH hours | venue-specific; no resting broker stop |
| Trading hours | regular + extended | 24/7 |

**Correction to capture in prose:** on-chain is **not "no rules."** It trades
*regulatory* rules (GFV/PDT/tax) for *self-custody/execution* rules that are
**less** forgiving — an injection or a bad tool path becomes direct asset loss.
The contract closes with the security skill's pre-deploy checklist as the
on-chain venue's "before first trade" gate.

**Venue-integration contract (to add venue X):**
1. Reuse the venue-agnostic strategy fns (they already exist).
2. Provide a `Venue` descriptor of the shape above.
3. If `custody:"self"` → provide a deterministic executor implementing the
   security checklist (spend guard, pre-send sim, circuit breaker, key
   isolation, MEV protection). LLM never signs.
4. Separate pot / wallet — venues never share capital (existing VENUES.md rule).
5. Own `POLICY.md` + `JOURNAL.md` + heartbeat (existing pattern).

**Success criterion:** every strategy fn and every venue fact appears in the
decomposition; the on-chain column reflects the 8-point security checklist.

## 6. Build plan (each step verified before the next)

1. `venue.ts` + wire `risk.ts`'s two seams → **verify:** 119 green + 2 consumption tests.
2. `reentry.ts` + tests + POLICY §3.9 + SKILL step 5 → **verify:** re-entry tests green, typecheck clean.
3. Extend `VENUES.md` (matrix + contract + security) → **verify:** covers all fns/facts.
4. Commit spec → **`/autoplan`** multi-voice review → fold adopted findings.
5. Implement, then **`/improve` or `/code-review`** final pass before commit/push.

## 7. Out of scope (say so to pull any in)

- On-chain *code* (sanitize / spend-guard / simulation / executor) — lands with a real venue.
- `Venue` as a method-interface — the data descriptor upgrades into it only if a 2nd venue demands.
- Any `risk.ts` refactor beyond the two seams.
- Re-entry param tuning beyond the stated defaults.
