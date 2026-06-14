# Plan 004: Surface stop-above-entry as an informational panel flag

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before the next step. If a
> "STOP conditions" item occurs, stop and report. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f099511..HEAD -- src/trading/book.ts src/trading/book.test.ts`
> If either changed since `f099511`, compare the "Current state" excerpts to the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds one informational flag; does not change any limit math or
  pass/fail outcome).
- **Depends on**: none
- **Category**: correctness / observability
- **Planned at**: commit `f099511`, 2026-06-14

## Why this matters

A position whose stop sits ABOVE its entry is a *profit-locking trailing stop*
(the +10% exit ladder ratchets the stop up; e.g. INTC entered 114.15, stop now
116.34 = locked gain). The risk engine correctly treats its downside-to-entry as
$0 (`Math.max(0, (entry-stop)*qty)` at `risk.ts:105`). The problem is that a
*data-entry error* — a transposed-digit stop, or entry/stop written in the wrong
order by the hourly heartbeat — produces the **identical** $0-risk reading. The
two are indistinguishable today, so a typo that zeroes out a position's tracked
risk passes silently. This plan adds one informational line to the `bun run book`
panel that names every stop-above-entry position and the dollar gain it locks,
so the human (or agent) confirms it is an intentional trail, not corruption. It
does NOT fail any check — a legitimate trailing stop must keep passing.

## Current state

`src/trading/book.ts` assembles the panel. The positions loop (around lines
60-72) already prints each position and flags a missing stop:
```ts
  for (const p of book.positions) {
    const stop = p.stop == null ? "NO STOP" : p.stop.toFixed(2);
    const mark = p.price ?? p.entry;
    const pl = ((mark / p.entry - 1) * 100).toFixed(1);
    lines.push(`  ${p.symbol.padEnd(5)} ${String(p.qty).padStart(3)} @ ${p.entry.toFixed(2)}  stop ${stop}  mark ${mark.toFixed(2)} (${pl}%)`);
    if (p.stop == null) flags.push(`${p.symbol}: NO STOP on record`);
  }
```
`flags: string[]` is the panel's attention list; a non-empty `flags` makes the
CLI exit non-zero (exit 4). `assemblePanel` returns `{ lines, flags }`. Tests are
in `src/trading/book.test.ts` (factory `cleanBook`, `marks`, `trades`; describe
blocks asserting on `p.flags`).

The live data that exercises this: `robinhood-agentic/data/book.json` has INTC
with `entry: 114.15, stop: 116.34` (a real, intentional trailing stop) — so the
new flag SHOULD fire for INTC, and that is correct/expected, not a problem.

Conventions to MATCH: the existing flag-push style and the informational vs
hard-flag distinction. IMPORTANT design choice: a profit-lock is GOOD news, so
the message must read as a confirm-this, not an alarm — but it still belongs in
`flags` (the attention list) because the whole point is that a human should
glance at it. Word it so it is clearly "confirm intentional", and make the
dollar-locked explicit so a real typo (which would show an implausible locked
amount or a tiny/negative one) stands out.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `bun run typecheck`                  | exit 0              |
| Tests     | `bun test src/trading`               | all pass            |
| Panel     | `bun run book -- --as-of 2026-06-12` | now lists the INTC stop-above-entry confirm line |

## Scope

**In scope**:
- `src/trading/book.ts` — add the informational flag in the positions loop.
- `src/trading/book.test.ts` — add tests for the new flag.

**Out of scope** (do NOT touch):
- `src/trading/risk.ts` — the `Math.max(0, ...)` clamp is correct; do NOT change
  the risk math or make stop-above-entry FAIL a §2 check (that would break
  legitimate trailing stops). This is observability only.
- `robinhood-agentic/POLICY.md` (owner-only); `robinhood-agentic/data/book.json`
  (the INTC trailing stop is correct live data — do not "fix" it).

## Git workflow

- Branch: `advisor/004-stop-above-entry-flag`.
- Single commit, conventional style: `feat(trading): flag stop-above-entry positions in book panel`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the informational flag

In the `assemblePanel` positions loop in `src/trading/book.ts`, after the
existing `if (p.stop == null)` flag, add: when `p.stop != null && p.stop > p.entry`,
push a flag naming the locked gain:
```
${p.symbol}: stop ${stop} is ABOVE entry ${entry} — profit locked +$${((p.stop - p.entry) * p.qty).toFixed(2)}; confirm intentional trailing stop (not a data error)
```
Do NOT change any limit check or the exit code logic beyond it naturally
becoming non-zero because a flag is present (that is acceptable and desired — the
panel is meant to draw a glance to a profit-lock). Keep the existing `mark`/`pl`
line unchanged.

**Verify**: `bun run book -- --as-of 2026-06-12` → the output now contains a line
referencing INTC stop above entry with the locked dollar amount.

### Step 2: Tests

In `src/trading/book.test.ts`, add:
- a position with `entry < stop` (e.g. entry 50, stop 52, qty 10) → `flags`
  contains an entry referencing "ABOVE entry" and "+$20.00".
- a normal position (`stop < entry`) → no such flag.
- confirm the new flag does NOT change any §2 PASS/FAIL: a book that was "clean"
  except for a trailing stop now has exactly one flag (the confirm line) and no
  `§2` flags.

**Verify**: `bun test src/trading` → all pass including the new cases.

## Test plan

- New cases as in Step 2 (~3) in `src/trading/book.test.ts`.
- Structural pattern: the existing `describe("assemblePanel", ...)` block in the
  same file (it already asserts on `p.flags.some(f => f.includes(...))`).
- Verification: `bun test src/trading` → all pass.

## Done criteria

ALL must hold:
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test src/trading` exits 0; new stop-above-entry cases exist and pass.
- [ ] `bun run book -- --as-of 2026-06-12` lists the INTC profit-lock confirm
      line with `+$<amount>`.
- [ ] `git diff src/trading/risk.ts` is empty (risk math untouched).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row for 004 updated.

## STOP conditions

Stop and report if:
- The "Current state" excerpt of the positions loop doesn't match the live code
  (drift since `f099511`).
- Implementing the flag appears to require changing `risk.ts` or making a §2
  check fail on stop-above-entry — it must not; this is informational only.

## Maintenance notes

- This flag and plan 001's `book.json` schema (which deliberately does NOT
  require `stop < entry`) are complementary: 001 permits the state, 004 surfaces
  it for human confirmation. Keep them consistent — do not later make 001 reject
  stop-above-entry.
- Reviewer should scrutinize: that the flag is informational and a legitimate
  trailing-stop book is not reported as a §2 violation.
