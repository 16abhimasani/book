# Design — event-driven trading-loop runs (architecture only, nothing built)

Stretch deliverable from OVERNIGHT-BRIEF-2026-06-12. Problem: the heartbeat
is time-driven (pre-market / hourly / EOD cron), so anything that happens
*between* runs — a stop fill at 9:35, a position −6% at 10:05, breaking
news — waits up to ~55 minutes for attention. This doc specifies how an
event could trigger a loop run. **Build nothing until the cloud-routine
heartbeat is verified and the one-heartbeat rule (OPERATIONS §B) is
settled — an event trigger is a second writer by construction.**

## Triggering surface (what exists today)

| Path | Mechanism | Latency | Creds needed where |
|---|---|---|---|
| Cloud routine (status quo) | cron prompt on claude.ai/code | up to 60 min | none (Anthropic-hosted) |
| Claude Dispatch | phone → task executes on the Mac | human-initiated | Mac keychain |
| Anthropic API session | `POST` a Claude Code session/agent run from any worker | seconds | API key in the worker |
| `/schedule run` | any Claude Code session can fire a routine immediately | seconds, but needs a session | n/a |

## Architecture: watcher → bridge → loop

```
[price/event source] → [watcher (pure code)] → [bridge (auth'd trigger)] → [/trading-loop run-type=event]
```

**1. Watcher — pure code, no LLM.** A ~50-line script polling every 1–5 min
during market hours. Inputs it can get WITHOUT broker creds: delayed/free
quotes (Yahoo v8, same source as `src/trading/yahoo.ts`) for held symbols +
QQQ. Trigger conditions (versioned in repo, e.g. `data/watch-rules.json`):
- any held symbol trades ≤ X (stop-adjacent: would mean a stop likely
  filled or is about to),
- QQQ crosses the gate-flip level (`bun run gate` prints it),
- |move| ≥ Y% in 15 min on a held name.
The watcher only answers "should the loop wake up?" — it makes zero
decisions. Hosting: launchd on the Mac (simplest, laptop-on) or a Railway
worker (always-on, ~$5/mo).

**2. Bridge — the only privileged piece.** On trigger: start ONE Claude Code
run of `/trading-loop` with an event payload (`event: stop-adjacent MU
941.80 @ 14:32Z`). Options, in order of preference:
   a. Anthropic API from the worker (key in worker env, never in repo).
   b. Dispatch-style local trigger on the Mac (keychain creds, laptop-on).
The payload is **information, not instruction** — the loop still does its
own ground-truth pulls and POLICY checks; a poisoned/buggy watcher can at
worst cause a pointless (journal-only) run.

**3. Safety rails (non-negotiable before building):**
- **Mutex**: one event run at a time, and never concurrent with the cron
  heartbeat — same rule as OPERATIONS §B. Simplest impl: the run starts by
  checking the last JOURNAL entry timestamp; if a run is in flight
  (< N min old without a closing commit), journal-only and exit.
- **Rate cap**: ≤ 4 event runs/day; the watcher de-arms a rule after it
  fires until a human or the EOD run re-arms it (no machine-gun wakeups in
  a fast market).
- **Event allowlist**: price-level and stop-adjacent events only at first.
  News-triggered wakeups invite prompt-injection-by-headline; defer.
- **No new authority**: an event run is an ordinary `/trading-loop` run —
  same POLICY, same limits, same journal. The event changes WHEN it runs,
  never WHAT it may do.

## Recommended sequencing

1. Verify cloud routine heartbeat (already queued for the owner).
2. Ship the watcher as a pure observer first: it only journals
   `EVENT-OBSERVED` lines via a git commit (no loop trigger) for ~a week —
   measures false-positive rate for free.
3. Then wire the bridge (option a) with the mutex + rate cap.
4. Revisit news triggers only after options/crypto lanes stabilize.

Non-goals: streaming market data, sub-minute reaction, intraday tick
storage, any execution authority outside the existing loop.
