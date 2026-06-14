# Plan 001: Schema-validate every CSV/JSON load and add `bun run verify`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f099511..HEAD -- src/trading/stats.ts src/trading/gate.ts src/trading/book.ts src/trading/csv.ts robinhood-agentic/data`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / data-integrity
- **Planned at**: commit `f099511`, 2026-06-14

## Why this matters

This is a live-money trading engine. The data files under
`robinhood-agentic/data/` (`marks.csv`, `trades.csv`, `shadow.csv`,
`earnings.csv`, `book.json`) are appended to **hourly by an LLM "heartbeat"**,
and the engine trusts them with zero validation. The loaders coerce missing or
malformed fields into silent defaults: `Number(r.risk_usd || 0)` turns a blank
`risk_usd` into a real `0`, and `Number("garbage")` yields `NaN` that
propagates into the §6a expectancy math and the POLICY §2 limit checker without
any error. A single bad row written by a hung or confused heartbeat can make a
real trade look like it has $0 risk, or poison the capital-add gate. After this
plan, every load validates its rows against a schema and fails loudly, and a
single `bun run verify` command tells the owner "engine + data are both sound"
before any decision is made.

## Current state

Files and their roles:
- `src/trading/csv.ts` — `parseCsv` / `parseCsvObjects` / `serializeCsv`; the
  shared CSV layer. `parseCsvObjects` fills missing cells with `""`.
- `src/trading/stats.ts` — `loadTrades(path)`; the silent-zero is here.
- `src/trading/gate.ts` — `loadMarks(path)`; coerces `qqq_close`/`vixy_close`.
- `src/trading/shadow.ts` — `loadShadow(path)`; coerces entry/stop/qty/exit.
- `src/trading/book.ts` — `JSON.parse(readFileSync(... book.json ...))`,
  unvalidated; `earnings.csv` parsed inline in the `import.meta.main` block.
- `robinhood-agentic/data/*.csv`, `book.json` — the live data, currently valid.

The exact silent-coercion sites (confirm these match before editing):

`src/trading/stats.ts:29-38` —
```ts
    .map((r) => ({
      trade_id: r.trade_id!,
      symbol: r.symbol ?? "",
      lane: r.lane ?? "",
      entry_date: r.entry_date ?? "",
      risk_usd: Number(r.risk_usd || 0),   // blank → 0 silently
      exit_date: r.exit_date ?? "",
      pnl_usd: r.pnl_usd ? Number(r.pnl_usd) : null,
      r_multiple: r.r_multiple ? Number(r.r_multiple) : null,
    }));
```

`src/trading/gate.ts` `loadMarks` — maps `qqq: Number(r.qqq_close)`,
`vixy: Number(r.vixy_close)` with no NaN guard (a non-numeric cell → `NaN` →
the 20-session MA becomes `NaN` → the gate silently misbehaves).

Repo conventions to MATCH (study these before writing):
- Pure functions + a thin `if (import.meta.main)` CLI block per module; data
  paths via `new URL("../../robinhood-agentic/data/...", import.meta.url).pathname`.
  Exemplar: `src/trading/stats.ts` top-to-bottom.
- Tests are `bun:test` (`import { describe, expect, test } from "bun:test"`).
  Exemplar: `src/trading/stats.test.ts` (factory helper `t(over)` pattern, plus a
  "real file" describe block that loads the actual CSV).
- CLIs exit non-zero on a problem (e.g. `risk.ts` exits 3 on a limit failure,
  `book.ts` exits 4 on flags). `verify` should exit non-zero on any validation
  failure.
- Error style: throw `new Error("<context>: <what>")` with the offending
  `file:row` — see `yahoo.ts` (`throw new Error(\`yahoo ${symbol}: HTTP ${res.status}\`)`).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `bun run typecheck`                  | exit 0, no errors   |
| Tests     | `bun test src/trading`               | all pass            |
| New CLI   | `bun run verify`                     | prints checks, exit 0 on clean data |
| Run panel | `bun run book -- --as-of 2026-06-12` | unchanged behavior  |

## Scope

**In scope** (the only files you may modify or create):
- `src/trading/validate.ts` (create) — the validation helpers + row schemas.
- `src/trading/validate.test.ts` (create) — unit tests for the validators.
- `src/trading/stats.ts` — call the trade-row validator in `loadTrades`.
- `src/trading/gate.ts` — call the mark-row validator in `loadMarks`.
- `src/trading/shadow.ts` — call the shadow-row validator in `loadShadow`.
- `src/trading/verify.ts` (create) — the `bun run verify` entry point.
- `src/trading/verify.test.ts` (create) — tests for verify on good/bad fixtures.
- `package.json` — add the `"verify"` script (match the existing scripts block).

**Out of scope** (do NOT touch):
- `robinhood-agentic/POLICY.md` — owner-only, never edit.
- Any file under `robinhood-agentic/data/` — do not "fix" live data; verify reads
  it read-only. If verify finds the live data invalid, that is a STOP condition
  (report it; the owner reconciles from the broker).
- `src/trading/risk.ts` limit math, `src/trading/book.ts` panel logic — unchanged
  (book.ts already surfaces staleness/missing-stop flags; do not duplicate).
- The Sui/iOS code (`src/index.ts`, `ios/`).

## Git workflow

- Branch: `advisor/001-validate-loads`.
- Commit per step; conventional-commit style matching `git log` (e.g.
  `feat(trading): schema-validate trade/mark/shadow rows on load`).
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Create the validation helpers and row schemas

Create `src/trading/validate.ts` exporting:
- `validateNumber(value: string, field: string, ctx: string, opts?: { min?: number; max?: number; allowBlank?: boolean }): number | null`
  — returns `null` when `allowBlank` and the raw value is `""`; otherwise parses
  with `Number`, throws `new Error(\`${ctx}: ${field} is not a finite number (got "${value}")\`)` on `NaN`/`Infinity`, and throws on out-of-range when `min`/`max` given.
- `MarkRowSchema`, `TradeRowSchema`, `ShadowRowSchema` validators: each takes the
  raw `Record<string,string>` + a row index and returns the typed object the
  existing loader produces, throwing on violation. Encode the real invariants:
  - mark: `qqq_close` and `vixy_close` required, finite, > 0; `date` non-empty.
  - trade: `trade_id`, `entry_date`, `symbol`, `lane` non-empty; `risk_usd`
    required and finite and **> 0** (a real entry always has positive risk);
    a row with non-empty `exit_date` MUST have finite `pnl_usd` AND `r_multiple`;
    a row with empty `exit_date` (open) must have empty `pnl_usd`/`r_multiple`.
  - shadow: `candidate_id`, `symbol`, `eval_date`, `status` non-empty; `status`
    ∈ {`filtered`,`triggered_shadow`,`resolved`}; if `triggered_shadow` or
    `resolved`, `entry`/`stop` finite and `stop < entry`.
- `BookSchema` validator for the `book.json` object: `accountValue` and `cash`
  finite ≥ 0; `asOf` present and matching `^\d{4}-\d{2}-\d{2}` (date or ISO
  prefix); each position has finite `entry > 0`, `qty > 0`, and `stop` either
  `null` or finite > 0. (Do NOT require `stop < entry` — a profit-locked
  trailing stop legitimately sits above entry; that case is plan 004's flag.)

Match the existing type shapes exactly: import and reuse `MarkRow` (gate.ts),
`TradeRow` (stats.ts), `ShadowRow` (shadow.ts) so the loaders' return types are
unchanged.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Wire the validators into the three CSV loaders

In `loadTrades` (stats.ts), `loadMarks` (gate.ts), `loadShadow` (shadow.ts),
replace the silent `.map((r) => ({...}))` coercion with a call to the matching
schema validator, passing the row index for error messages. Keep the public
function signatures and return types identical. The `.filter((r) => r.trade_id)`
style pre-filters stay (an entirely blank trailing row is skipped, not an error).

**Verify**: `bun test src/trading` → all existing tests still pass (the live data
is valid, so validation is a no-op on it). `bun run book -- --as-of 2026-06-12`
→ same output as before this plan.

### Step 3: Create the `verify.ts` entry point

Create `src/trading/verify.ts` (`if (import.meta.main)` CLI) that:
1. Loads `book.json` and runs `BookSchema`.
2. Loads marks/trades/shadow/earnings via the now-validating loaders.
3. Cross-checks: every `symbol` in `book.json` positions that is also a
   non-exited `trades.csv` row should have matching `entry`/`qty` (warn, don't
   throw, on mismatch — book.ts already flags staleness).
4. Prints a checklist (one line per file: `OK <file> (<n> rows)` or the error)
   and exits `0` when all pass, non-zero (use `5`) when any schema validation
   throws. Catch validation errors per file so the report lists all problems,
   not just the first.

Add `"verify": "bun src/trading/verify.ts"` to `package.json` scripts (match the
existing block formatting — see the `"book"`/`"shadow"` lines).

**Verify**: `bun run verify` → prints `OK` for each file and exits 0 on the
current (valid) repo data.

### Step 4: Tests

Create `src/trading/validate.test.ts`:
- `validateNumber`: finite passes; `""` with `allowBlank` → null; `""` without →
  throws; `"abc"` → throws; out-of-range with min/max → throws.
- each row schema: a good row passes; a blank required field throws; a closed
  trade missing `r_multiple` throws; a shadow `triggered_shadow` with `stop ≥
  entry` throws; a `book.json` position with `entry ≤ 0` throws.

Create `src/trading/verify.test.ts`: build an in-memory good book + rows → no
throw; a book with a blank `risk_usd` trade row → the validator throws and verify
reports it. Model structure after `src/trading/stats.test.ts` (factory helper +
describe blocks).

**Verify**: `bun test src/trading` → all pass, including the new files.

## Test plan

- New unit tests as in Step 4 (validate.test.ts ~12 cases, verify.test.ts ~3).
- Cases to cover explicitly: blank `risk_usd` (the original silent-zero bug),
  `NaN` close in marks, closed trade missing pnl/R, shadow stop ≥ entry, book
  position entry ≤ 0, missing `asOf`.
- Structural pattern: `src/trading/stats.test.ts`.
- Verification: `bun test src/trading` → all pass, N new tests green.

## Done criteria

ALL must hold:
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test src/trading` exits 0; `validate.test.ts` and `verify.test.ts`
      exist and pass.
- [ ] `bun run verify` exits 0 on the current repo data and prints one OK line
      per data file.
- [ ] `grep -n "Number(r.risk_usd || 0)" src/trading/stats.ts` returns nothing
      (the silent coercion is gone).
- [ ] `bun run book -- --as-of 2026-06-12` output is unchanged vs `f099511`.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 001 updated.

## STOP conditions

Stop and report (do not improvise) if:
- The live data under `robinhood-agentic/data/` fails your own new validators
  (this means there is already a bad row in production data — the owner must
  reconcile it from the broker; do NOT edit the data to make tests pass).
- The "Current state" excerpts don't match the live code (drift since `f099511`).
- Making validation pass appears to require changing a POLICY limit or the
  risk/gate math — it must not.
- A verification step fails twice after a reasonable fix attempt.

## Maintenance notes

- When a new data column or file is added, add its schema here and a verify
  check — this file is the one place that knows the data contract.
- If plan 002 lands first, reuse its numeric validator instead of duplicating.
- Reviewer should scrutinize: that `loadTrades`/`loadMarks`/`loadShadow` return
  types are byte-identical to before (no downstream type breakage), and that
  `verify` aggregates all errors rather than throwing on the first.
- Deferred: wiring `bun run verify` into the trading-loop skill's step 0 as a
  pre-run gate is a follow-up (skill edit, not code) — note it for the owner.
