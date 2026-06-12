# CLAUDE.md — book

Claude Code entrypoint. Full cross-agent guidance lives in `AGENTS.md` —
read it first. This file adds only what Claude Code sessions need.

## Non-negotiables

- `robinhood-agentic/POLICY.md` is **binding** (v0.2). Never loosen a
  limit; tighter-than-policy judgment is allowed (stops ratchet UP only).
  Only the owner edits POLICY.
- Real money. `review_equity_order` before every `place_equity_order`.
  Surface `market_data_disclosure` verbatim. Fresh UUID `ref_id` per order.
- Sync before reading state: `git pull --rebase --autostash`. Commit and
  push after journaling. If your runtime pushes to a `claude/*` branch,
  open a PR titled `journal: <ts>` immediately — never leave journal
  entries stranded on a side branch.

## Do the work via the committed skill

`/trading-loop` (in `.claude/skills/trading-loop/`) is the canonical
loop — scheduled runs, ad-hoc runs, and routines all use it so behavior
is identical on every surface (cloud session, local CLI, Cowork).

## Routine self-service

Manage the cloud heartbeat from any Claude Code session via `/schedule`
(`list` / `update` / `run`). One heartbeat at a time — see
`robinhood-agentic/OPERATIONS.md` §B before touching schedules.
