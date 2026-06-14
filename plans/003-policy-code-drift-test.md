# Plan 003: Assert POLICY.md §2 limits match the risk.ts constants (drift test)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before the next step. If a
> "STOP conditions" item occurs, stop and report. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f099511..HEAD -- src/trading/risk.ts robinhood-agentic/POLICY.md`
> If either changed since `f099511`, compare the "Current state" excerpts to the
> live files before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds a test only; no runtime/behavior change).
- **Depends on**: none
- **Category**: tech-debt / tests
- **Planned at**: commit `f099511`, 2026-06-14

## Why this matters

`robinhood-agentic/POLICY.md` is the binding, owner-edited source of truth for
the §2 risk limits. The same numbers are also hardcoded as constants in
`src/trading/risk.ts`, which is what actually gates every order. Today nothing
checks that the two agree. When the owner edited the cash buffer 5% → 2.5%
(v0.2.1), the code constant was updated by hand to match — but a future POLICY
edit could silently desync, so the journal/owner would read one limit from the
prose while the engine enforces another. A tiny test that parses the POLICY §2
table and asserts each value equals its code constant makes drift impossible to
merge: change POLICY without changing code (or vice versa) and the suite fails.

## Current state

`src/trading/risk.ts:14-22` (the constants):
```ts
export const RISK_PCT = 0.025; // max risk per position at entry
export const BOOK_RISK_PCT = 0.08; // max total open risk to stops
export const SLOT_PCT = 0.4; // max single position at entry
export const LEV_PCT = 0.5; // max combined leveraged-ETF exposure
export const BETA_GROSS_PCT = 1.5; // beta-adjusted gross exposure
export const THEME_PCT = 0.65; // single theme/catalyst concentration
export const MIN_CASH_PCT = 0.025; // min cash buffer (v0.2.1: 5% → 2.5%, owner directive 2026-06-12)
export const MAX_POSITIONS = 4;
```

`robinhood-agentic/POLICY.md` §2 is a Markdown table. The rows that map to the
constants (confirm the live wording before writing the parser — match on the
stable phrase, not the whole line):
```
| Max single position (at entry) | 40% of account value |
| Max concurrent positions | 4 |
| Max combined leveraged-ETF exposure | 50% of account value |
| Min cash buffer | 2.5% |
| Max risk per position at entry ((entry−stop)×qty) | 2.5% of account |
| Max total open risk to stops, whole book | 8% of account |
| Beta-adjusted gross exposure (lev ETFs × multiplier) | ≤ 150% of account |
| Single theme/catalyst concentration at entry | ≤ 65% of account ... |
```

Conventions to MATCH: `bun:test`; the "real file" describe-block pattern at the
bottom of `src/trading/gate.test.ts` / `stats.test.ts` (read the actual repo file
via `new URL("../../robinhood-agentic/POLICY.md", import.meta.url).pathname`).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `bun run typecheck`              | exit 0              |
| Tests     | `bun test src/trading`           | all pass            |

## Scope

**In scope**:
- `src/trading/policy-sync.test.ts` (create) — the drift test. (Test-only; no
  source change needed.)

**Out of scope** (do NOT touch):
- `robinhood-agentic/POLICY.md` — owner-only, read it, never edit it.
- `src/trading/risk.ts` — the constants are correct as of `f099511`; do not
  change them. (If the test reveals a real mismatch, that is a STOP condition —
  report it; the owner decides which side is right.)

## Git workflow

- Branch: `advisor/003-policy-drift-test`.
- Single commit, conventional style: `test(trading): assert POLICY §2 limits match risk.ts constants`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the drift test

Create `src/trading/policy-sync.test.ts` that:
1. Reads `POLICY.md` from the repo path.
2. For each limit, extracts the percentage/number from the §2 table using a
   tolerant regex keyed on the stable phrase (e.g. match the line containing
   `Min cash buffer` and pull the first `\d+(\.\d+)?%`). Convert `%` to a
   fraction (`2.5%` → `0.025`); `Max concurrent positions` → integer `4`.
3. Asserts each parsed value `=== ` its imported constant from `risk.ts`
   (`RISK_PCT`, `BOOK_RISK_PCT`, `SLOT_PCT`, `LEV_PCT`, `BETA_GROSS_PCT`,
   `THEME_PCT`, `MIN_CASH_PCT`, `MAX_POSITIONS`).
4. Includes one guard assertion that the parser actually found every row (e.g.
   collect a `found` map and assert it has all 8 keys) — so a POLICY reformat
   that breaks the regex fails loudly instead of silently passing on zero
   comparisons.

Use a small table in the test mapping `{ phrase, constant, kind: "pct"|"int" }`
so adding a future limit is one line.

**Verify**: `bun test src/trading` → all pass, including the new file. Then
temporarily change a constant in a scratch copy in your head (do NOT edit
risk.ts) — the test logic must be such that a real mismatch would fail. Confirm
by reading the assertions, not by editing the source.

## Test plan

- The single new file `policy-sync.test.ts`, ~8 value assertions + 1
  completeness assertion.
- Structural pattern: the "real file" describe block in
  `src/trading/gate.test.ts`.
- Verification: `bun test src/trading` → all pass.

## Done criteria

ALL must hold:
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test src/trading` exits 0; `policy-sync.test.ts` exists and passes.
- [ ] The test asserts all 8 constants AND asserts the parser matched all 8 rows
      (no silent zero-comparison pass).
- [ ] `src/trading/risk.ts` and `robinhood-agentic/POLICY.md` are unmodified
      (`git status` shows only the new test file).
- [ ] `plans/README.md` status row for 003 updated.

## STOP conditions

Stop and report if:
- The parser cannot find a row because the POLICY wording differs from the
  excerpt above (drift since `f099511`) — report the actual wording; do not
  loosen the regex to the point it matches the wrong number.
- The test reveals a REAL mismatch between POLICY.md and risk.ts — do NOT "fix"
  either side; report it, because which value is authoritative is an owner
  decision (POLICY is owner-only).

## Maintenance notes

- When the owner adds or changes a §2 limit, this test is the tripwire: update
  the constant in `risk.ts` AND it will pass; forget one and CI fails.
- Reviewer should scrutinize: the completeness assertion (that the regex matched
  every expected row) — without it the test can pass vacuously after a POLICY
  reformat.
