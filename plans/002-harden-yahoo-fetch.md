# Plan 002: Harden yahoo.ts (schema + bounds + tests) and fix the backfill sanity carry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before the next step. If
> a "STOP conditions" item occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f099511..HEAD -- src/trading/yahoo.ts src/trading/backfill.ts`
> If either file changed since `f099511`, compare the "Current state" excerpts to
> the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (the backfill change alters which bars enter `marks.csv`, which
  feeds the live regime gate — verify the gate output is unchanged on real data).
- **Depends on**: 001 (soft — reuse its `validateNumber` if present; otherwise
  inline a local guard).
- **Category**: security / tests / bug
- **Planned at**: commit `f099511`, 2026-06-14

## Why this matters

`yahoo.ts` is the **only** data-ingestion path for QQQ/VIXY/TQQQ closes, and
those closes drive a regime gate that triggers REAL position exits (POLICY §3
Lane 2). The fetcher casts the HTTP response to `any` and pulls fields with
optional chaining only, so a silent shape change at the unofficial endpoint
returns an empty array instead of an error — the gate would then read stale or
missing data with no signal that anything broke. It has zero test coverage.
Separately, the backfill's sanity-bounds guard (which exists precisely to keep a
bad print from flipping the gate) compares each bar against the last *accepted*
close rather than the last *actual* one, so a second consecutive bad bar whose
jump from the last-good close is under the threshold slips through. After this
plan the fetch validates its response shape and numeric bounds, the carry bug is
fixed, and both paths have tests.

## Current state

`src/trading/yahoo.ts:21-43` (the unguarded parse):
```ts
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`yahoo ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo ${symbol}: ${JSON.stringify(json?.chart?.error ?? "empty result")}`);
  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const adj: (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose ?? closes;
  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;            // null bar silently skipped
    const date = new Date(ts[i]! * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    bars.push({ date, close: Math.round(c * 100) / 100, adjclose: Math.round((adj[i] ?? c) * 10000) / 10000 });
  }
  return bars;
```
`DailyBar` is `{ date: string; close: number; adjclose: number }`.

`src/trading/backfill.ts:38-57` (the carry bug — `prevQ`/`prevV` only update on
an ACCEPTED bar, so a `continue` leaves them pointing at the last good close):
```ts
  let prevQ: number | null = null;
  let prevV: number | null = null;
  for (const bar of window) {
    const existing = ours.get(bar.date);
    const v = vixyByDate.get(bar.date)!;             // non-null assertion — can throw
    if (prevQ != null && Math.abs(bar.close / prevQ - 1) > 0.15) {
      rejected.push(`${bar.date}: QQQ ${bar.close} vs prior ${prevQ} (>15% jump) — REJECTED, gate holds prior state`);
      continue;                                       // prevQ NOT updated
    }
    if (prevV != null && Math.abs(v.close / prevV - 1) > 0.4) {
      rejected.push(`${bar.date}: VIXY ${v.close} vs prior ${prevV} (>40% jump) — REJECTED`);
      continue;
    }
    prevQ = bar.close;
    prevV = v.close;
    ...
```

Conventions to MATCH: pure helpers + `if (import.meta.main)` CLI; `bun:test`;
throw `new Error("yahoo <sym>: <what>")` style. The repo has NO test for yahoo.ts
yet — `src/trading/gate.test.ts` is the closest structural exemplar for a
data-shaped module (pure-function tests + a real-data describe block).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0              |
| Tests     | `bun test src/trading`   | all pass            |
| Backtest  | `bun run backtest`       | table prints; rows numerically unchanged vs `f099511` |

NOTE: do NOT run `bun run backfill` as a verification step — it performs live
network writes to `marks.csv`/`history/`. Test the logic with injected bars
instead (see Test plan).

## Scope

**In scope**:
- `src/trading/yahoo.ts` — add response-shape validation + numeric bounds; make
  the parse a pure, testable function.
- `src/trading/yahoo.test.ts` (create) — tests with injected/mocked responses.
- `src/trading/backfill.ts` — fix the sanity-carry bug and the `vixyByDate.get()!`
  assertion; extract the bar-filter into a pure exported function so it's testable.
- `src/trading/backfill.test.ts` (create) — tests for the filter logic.

**Out of scope** (do NOT touch):
- `robinhood-agentic/POLICY.md` (owner-only); any file under
  `robinhood-agentic/data/` (no live data edits — backfill must remain the only
  writer, and only when the operator runs it).
- `src/trading/gate.ts` math, `src/trading/risk.ts` — unchanged.
- The choice of Yahoo as the source (documented tradeoff in `yahoo.ts:8-12`; a
  second data source is a separate, larger effort — out of scope here).

## Git workflow

- Branch: `advisor/002-harden-yahoo`.
- Commit per logical unit; conventional-commit style from `git log`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Make the yahoo response-parse a pure, validated function

Refactor `fetchDailyBars` so the parsing logic lives in an exported pure function
`parseChartResponse(json: unknown, symbol: string): DailyBar[]` that:
- narrows `json` with explicit shape checks instead of `as any` (check
  `chart.result[0].timestamp` is an array, `indicators.quote[0].close` is an
  array, lengths align) and throws `new Error(\`yahoo ${symbol}: malformed response (<which field>)\`)` when not.
- applies numeric bounds per bar: reject (throw) if a non-null `close` is `≤ 0`
  or `> 100000` (a sane absolute guard against a garbage print); keep the
  existing "skip null bars" behavior for genuine holiday gaps.
- keeps the ET-calendar date conversion and the rounding exactly as-is.
`fetchDailyBars` then does the `fetch` + `res.ok` check and calls
`parseChartResponse(await res.json(), symbol)`.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Fix the backfill sanity-carry and the non-null assertion

Extract an exported pure function
`filterSaneBars(bars: { date: string; close: number }[], vixyByDate: Map<string, number>, opts?: { qqqJump?: number; vixyJump?: number }): { kept: {...}[]; rejected: string[] }`
that mirrors the current bounds (defaults QQQ 0.15, VIXY 0.40) but fixes BOTH
defects:
- **Carry bug**: after a rejection, advance the "previous" reference to the
  rejected bar's close (so two consecutive bad bars are each measured against
  their immediate predecessor and both get rejected) — OR, equivalently and more
  conservatively, reject the bar AND skip the next comparison by treating a
  rejected close as the new baseline. Pick the conservative reading: the
  comment at `backfill.ts:49` says "gate holds prior state", so the baseline for
  the *next* comparison should be the most recent ACTUAL close, not the last
  accepted one. Implement: always set `prevQ = bar.close; prevV = v.close;`
  before the `continue`.
- **Missing-VIXY guard**: if `vixyByDate.get(bar.date)` is undefined, skip the
  bar (push a `rejected` note `"<date>: no VIXY close — skipped"`) instead of
  the `!` assertion that throws.
Rewire `main()` to call `filterSaneBars` and then do the existing
anchor-merge/write on `kept`.

**Verify**: `bun run typecheck` → exit 0. `bun run backtest` → the table's
numeric columns are identical to a run at `f099511` (the backtest reads
committed `history/*.csv`, which this step does not change — this confirms you
didn't accidentally alter the read path).

### Step 3: Tests

`src/trading/yahoo.test.ts` — call `parseChartResponse` with hand-built JSON:
- a well-formed two-bar response → two `DailyBar`s with correct dates/rounding;
- `adjclose` missing → falls back to `close`;
- a `null` close in the middle → that bar skipped, others kept;
- `chart.result` absent / `timestamp` not an array → throws "malformed";
- a `close` of `0` or `-5` or `1e9` → throws bounds.

`src/trading/backfill.test.ts` — call `filterSaneBars` with injected bars:
- a clean ascending series → all kept, no rejections;
- a single +20% QQQ spike → that bar rejected;
- **two consecutive bad bars** (100 → 150 → 114): assert BOTH are rejected (this
  is the carry-bug regression — at `f099511` the third bar 114 is wrongly kept
  because 114/100−1 = 14% < 15%);
- a date missing from `vixyByDate` → skipped with a note.

**Verify**: `bun test src/trading` → all pass, including the new files.

## Test plan

- New tests as in Step 3 (yahoo.test.ts ~5 cases, backfill.test.ts ~4).
- The single most important assertion is the **two-consecutive-bad-bars** case —
  it is the regression this plan fixes; it must FAIL against the `f099511` logic
  and PASS after.
- Structural pattern: `src/trading/gate.test.ts`.
- Verification: `bun test src/trading` → all pass.

## Done criteria

ALL must hold:
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test src/trading` exits 0; `yahoo.test.ts` and `backfill.test.ts`
      exist and pass.
- [ ] `grep -n "as any" src/trading/yahoo.ts` returns nothing.
- [ ] `grep -n "vixyByDate.get(bar.date)!" src/trading/backfill.ts` returns
      nothing (the throwing assertion is gone).
- [ ] `bun run backtest` numeric output matches a `f099511` run (committed
      history unchanged).
- [ ] No files outside the in-scope list modified (`git status`); no writes to
      `robinhood-agentic/data/`.
- [ ] `plans/README.md` status row for 002 updated.

## STOP conditions

Stop and report if:
- The "Current state" excerpts don't match the live code (drift since `f099511`).
- Fixing the carry bug would change which bars are in the committed
  `history/*.csv` or `marks.csv` — it must not (this plan only changes the
  filter function + adds tests; it does not re-run the live backfill).
- A bounds threshold you add would reject any row currently in `marks.csv`
  (means the bound is too tight — report, don't widen silently).
- A verification step fails twice after a reasonable fix attempt.

## Maintenance notes

- If a second data source is added later, `parseChartResponse` is the seam to
  generalize; keep the bounds check provider-agnostic.
- The QQQ/VIXY jump thresholds (0.15 / 0.40) now live in one function — if the
  gate's behavior in a real volatility spike ever needs tuning, change them
  there with a test.
- Reviewer should scrutinize: the two-consecutive-bad-bars test genuinely
  reproduces the old bug, and the backtest numbers are unchanged (no accidental
  read-path change).
- Deferred (out of scope, note for owner): cross-checking the EOD Yahoo close
  against the broker's `get_equity_quotes` for QQQ/VIXY before it locks into
  `marks.csv` — a skill-level change, not code.
