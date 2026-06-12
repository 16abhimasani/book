# Brainstorm capture — Claude Code-native workflow (2026-06-12)

Question: "move over to Claude Code and optimize for this workflow —
phone-triggered, repo-based, with my usual skills."

## Position taken

**It's a convergence, not a migration.** The repo was always the brain;
Claude Code cloud is simply the best *runtime* for it. Nothing about the
system was Cowork-specific except the interim heartbeat — which was
always scheduled to die. Today's two writer-collisions (HEAD.lock race,
journal interleave) are evidence FOR the cloud-routine model: every
routine run clones fresh and serializes through GitHub.

## Shipped (this session)

1. `CLAUDE.md` — Claude Code entrypoint: binding-POLICY rule, sync/push
   discipline, claude/* branch rule, points to the committed skill.
2. `.claude/skills/trading-loop/SKILL.md` — the loop as a **committed
   skill**: identical behavior from cloud session, local CLI, routine,
   or Cowork. Phone session → `/trading-loop` → same system.
3. OPERATIONS §B: routine self-service (`/schedule list|update|run` from
   any session — the agent maintains its own heartbeat), claude/*
   branch caveat (open PR immediately), Dispatch vs Routines distinction.
4. Cowork task slimmed to a shim that executes the repo skill (single
   source of truth); deleted once the cloud routine is verified.

## Surface map (end state)

| Surface | Runtime | Job |
|---|---|---|
| Cloud routine (`/schedule`) | Anthropic cloud | THE heartbeat — laptop-off |
| Claude Code cloud session (phone) | Anthropic cloud | ad-hoc loop runs, POLICY edits, research, PR review |
| Claude mobile chat + RH connector | Anthropic cloud | instant overrides ("liquidate", "status") |
| Dispatch | his Mac | phone-triggered LOCAL tasks (osascript, Cowork task file) |
| Cowork desktop | his Mac | supervisor sessions, future dashboard artifact |
| RH app | — | fills feed + master kill switch |

## Owner's usual-skills note

Cloud sessions see only **repo-committed** skills (`.claude/skills/`).
Personal `~/.claude/skills` and `~/.agents/skills` don't follow to the
cloud — commit the ones the trading workflow needs into `book` (pattern
established with trading-loop).

## Riskiest assumption

That routine runs reliably load the RH connector (known warm-up bug
#43397/#35899). Mitigation already in the skill: TOOLS-DOWN hard-stop +
manual warm run. Verify on routine run #1 before killing the shim.

## Parked

- API-triggered routines as event-driven intelligence (price-alert
  webhook → routine run) — revisit after the scheduled loop is proven.
- Unified dashboard artifact (build trigger unchanged: venue #2).
- Committing more personal skills into the repo as the workflow needs
  them.

## Next step (single)

Owner, from phone: claude.ai/code → one session on `book` (installs
GitHub app) → `/schedule` a routine that runs `/trading-loop` on the
OPERATIONS §B cadence → `run` it once → verify clean journal commit on
main (or PR) → delete `rh-trading-loop-local`.
