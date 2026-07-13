# OPERATIONS.md — runbooks

## A. Phone-native today (zero build)

The Robinhood Trading MCP is a **custom connector on the Claude account**, so
it runs from Anthropic's cloud — already usable from the Claude mobile app.

1. Verify: claude.ai → Settings → Connectors → Robinhood Trading is listed
   (it was added via desktop; account-level connectors appear on mobile).
2. From the phone, any chat can now do: "Morning scan: portfolio, overnight
   news on my positions, top 3 catalyst candidates per POLICY" or
   "Exit everything in the Agentic account now" (manual override surface).
3. Robinhood app push notifications fire on every agent fill — that's the
   monitoring layer, no build needed.

### A2. Phone command center (the full map)

| Surface | Use for |
|---|---|
| Claude app → chat (+RH connector) | status, overrides, ad-hoc trades, "liquidate now" |
| Claude app → Claude Code tab | cloud sessions on `book`: policy edits (commit+push from the VM), analysis, ops |
| claude.ai/code/routines (phone browser) | create / pause / "run now" the heartbeat |
| Robinhood app | ground truth: fills, P&L feed, **MCP disconnect = kill switch** |
| GitHub mobile (optional) | journal commits = audit-trail notifications |

POLICY edits from phone: open a Claude Code cloud session on the repo →
"change X in robinhood-agentic/POLICY.md, bump version, commit, push."
No laptop required for anything once the routine exists.

### A3. Auto-push (no manual git, verified 2026-06-11)

- **Local runs** (Cowork sessions + heartbeat task): after committing,
  push through the owner's Mac keychain via the Control-your-Mac tool:
  osascript `do shell script "cd ~/dev/book && git pull --rebase --autostash 2>&1 && git push 2>&1"`.
  No tokens on disk; uses the same creds as manual pushes.
- **Cloud routine**: commits/pushes natively via the Claude GitHub app —
  nothing to configure.
- **Two-writer hygiene**: every writer (local task, cloud routine, ad-hoc
  session) must `git pull --rebase --autostash` BEFORE reading journal /
  writing entries, so journals never fork.

## B. The heartbeat — Claude Code Routine (cloud, laptop-off)

Routines = prompt + repo + connectors running on Anthropic-managed cloud
(claude.ai/code/routines). Research preview since 2026-04-14.

Prereq (one-time, owner):
1. ~~Create a private GitHub repo and push~~ ✅ DONE 2026-06-11
   (`github.com/16abhimasani/book`, private).
1b. At claude.ai/code, start one session on the repo — this prompts the
   **Claude GitHub app install** for `16abhimasani/book` (one-time grant
   routines need to clone/commit).
2. On claude.ai/code/routines → New routine:
   - Repo: the private `book` repo
   - Connectors: Robinhood Trading (remove everything else)
   - Schedule (June/EDT): pre-market `30 12 * * 1-5`, market-hours hourly
     `30 13-19 * * 1-5`, EOD `15 20 * * 1-5`, weekend research
     `0 16 * * 6`. (Collapse into fewer routines if cron count is limited;
     a single hourly `30 12-20 * * 1-5` weekday routine is an acceptable v0
     — the prompt infers run-type from the clock.)
   - Prompt: see template below, verbatim.

### Routine prompt template

```
You are the trading loop for the Robinhood Agentic account.
1. Read robinhood-agentic/POLICY.md fully and the last 5 entries of
   robinhood-agentic/JOURNAL.md.
2. Verify tools: call get_accounts and identify the account with
   agentic_allowed=true. If Robinhood tools are missing or erroring,
   append a TOOLS-DOWN entry to JOURNAL.md, commit, and STOP.
3. Ground truth: get_portfolio, get_equity_positions, open equity orders.
4. Determine run-type from current UTC time (pre-market / market-hourly /
   EOD / weekend per POLICY §4). Weekend = research only, never trade.
5. Enforce POLICY §1 status and §2 limits before any order. Execute lane
   logic (§3). Always review_equity_order before place_equity_order.
6. Append a journal entry per POLICY §6 (even NO-TRADE), commit with
   message: journal: <UTC timestamp> <run-type>.
Never exceed POLICY limits. Only the owner edits POLICY.md.
```

### Live trigger record (audited 2026-07-13)

- **Name** `rh-trading-loop-cloud` (`trig_01MGG2kUUHB557dDAJvYTeRD`), created
  2026-06-30, **enabled**, model `claude-opus-4-8`, connectors: Robinhood +
  Claude-Code-Remote (+ Gmail/Calendar/Drive present but unused by the loop).
- **Cron** `30 11-23 * * *` UTC = hourly at :30, 7:30–19:30 ET (EDT), **all 7
  days**. The routines platform floor is hourly, so POLICY §4's 30-minute
  cadence is not achievable with one trigger — accepted; weekend firings are
  research/journal-only by design. Coverage vs §4: nothing after ~19:30 ET,
  and the ~16:15 ET EOD reconcile lands on the 16:30 ET run — accepted.
  ⚠️ Cron is UTC: when DST ends (Nov), 11:30 UTC becomes 6:30 ET — revisit.
- Each firing opens a fresh cloud session that pushes `journal:` commits
  directly to main; the `claude/*` branch + PR path is the fallback. There is
  NO auto-merge workflow in the repo — a journal PR left open is stranded
  state, merge it promptly.

### ⚠️ One heartbeat at a time

The local Cowork scheduled task `rh-trading-loop-local` (created
2026-06-11) and the cloud routine run the SAME loop. Two heartbeats =
risk of duplicate position-taking. **As soon as the cloud routine's warm
run journals cleanly, disable the local task** (Cowork sidebar →
Scheduled). Keep it only as a manually-triggered fallback.

### Routine self-service + Dispatch (Claude Code-native ops)

- Any Claude Code session (incl. phone-triggered cloud sessions) can
  manage routines itself: `/schedule` → `list` / `update` / `run`.
  The agent maintains its own heartbeat — no dashboard needed.
- **Branch caveat**: routines/cloud sessions may push to `claude/*`
  branches instead of main. The loop skill opens a PR immediately when
  that happens; verify on the warm run and merge promptly so JOURNAL
  never forks.
- **Claude Dispatch** = remote trigger bridge: fire a Claude Code task
  from the phone that executes on the Mac (local runtime, keychain
  creds). Use when a task needs the Mac specifically (e.g. editing the
  Cowork scheduled task at ~/Claude/Scheduled/, osascript). Routines =
  cloud (laptop-off); Dispatch = phone-triggered local.
- The Cowork scheduled task (`rh-trading-loop-local`) is NOT repo state:
  cloud sessions can't edit it. Local sessions/Dispatch can (it's a file
  under ~/Claude/Scheduled/). It dies when the cloud routine is live.

### Known issue + mitigation

Cloud scheduled sessions sometimes start without MCP connectors loaded
(anthropic/claude-code #43397, #35899 — "tools not loaded until a user
message warms the session"). Mitigations: step 2 above hard-stops with a
TOOLS-DOWN journal entry (never trade blind); trigger the first run
manually to warm/verify; if TOOLS-DOWN entries appear repeatedly, re-add
the connector to the routine and re-test.

### Known first-day friction

- **Second-trade gate:** RH legally requires the investor-profile
  questionnaire (in-app) before the account's 2nd trade ever. Symptom:
  `place_equity_order` 400 "answer some questions about your investing
  goals". Fix: owner opens the applink from the error once.
- **Leveraged ETF orders** (TQQQ/SOXL) trigger an `EQUITY_SUITABILITY`
  review alert — informational, surface it, proceed per POLICY.

## C. Kill switches (fastest first)

1. **Robinhood app → disconnect the MCP** — instant, global, one tap.
2. Pause/disable the routine at claude.ai/code/routines.
3. Set `Status: HALT` in POLICY.md §0 and push — next run stands down.
4. From phone chat: "Cancel all open orders and liquidate the Agentic
   account" (manual override).

## D. Weekly review ritual (Cowork or phone)

- Read the week's JOURNAL entries; compute hit rate, avg win/loss, max
  drawdown; compare lanes.
- Propose POLICY diffs as a PR-style edit; owner approves; bump version.
- Update `~/.agents/memory/` checkpoint + `~/brain/daily/` if notable.

## E. Roadmap

1. **Options lane** — when option tools appear on the MCP (account is
   already level 2): spec Lane 4 (likely defined-risk long premium on
   Lane-1 catalysts), paper-walk a week in journal, then enable.
2. **24/7** — when RH ships crypto/event-contract tools: add lanes +
   flip routines to round-the-clock cadence.
3. **More capital** — owner adds funds only after ≥ 4 weeks of journaled
   edge (positive expectancy, limits respected on every run).
4. **Unified terminal** — same pattern per venue: one POLICY + one JOURNAL
   per venue (Kalshi, Polymarket, DeepBook testnet already in this repo),
   connectors/SDKs as the execution layer, and a single dashboard
   (Cowork artifact or web) reading all journals. The repo stays the
   single source of truth.
