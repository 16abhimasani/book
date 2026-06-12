# Owner checklist — one sitting, ~15 minutes (weekend of 06-13)

Output of the 06-12 /autoplan review (two model voices + audit trail in
`~/.gstack/projects/16abhimasani-book/main-autoplan-next-move-20260612-110647.md`).
Everything below is pre-staged; you ratify/edit, the agent wires defaults.
POLICY edits are yours alone — proposed text is copy-paste-ready.

## 1. Governance patch (~5 min) — do this first

Both reviewers independently caught: POLICY §6a ("Adding capital requires:
≥10 closed trades…") doesn't exempt owner deposits, so **your 06-12
deposit (~$1,585) reads as a breach of your own binding doc** and
contaminates §6a's "zero limit breaches" leg.

a. Append to JOURNAL.md (or tell the agent to):
   > OWNER OVERRIDE NOTE: the 2026-06-12 deposit (~$1,585 → account
   > ~$4,725) was an owner action, outside §6a's intended scope (which
   > governs agent-recommended adds). Not a limit breach. §6a amended to
   > scope this explicitly (see POLICY v0.2.1).

b. POLICY §6a — append one sentence (PROPOSED TEXT):
   > This gate governs *agent-recommended* capital adds. Owner deposits
   > are always permitted but must be journaled at deposit time.

c. POLICY §1 — update the stale figure (PROPOSED TEXT):
   > Capital: ~$4,700 (initial $3,000 + owner deposit 2026-06-12;
   > deposits journaled per §6a).

## 2. Ratify B2 — gate flip confirmation (~3 min)

Evidence (3y backtest, `docs/BACKTEST-REGIME-GATE.md`, reproducible via
`bun run backtest`):

| Variant | CAGR | Max DD | Flips/3y |
|---|---|---|---|
| Current POLICY gate | 39.7% | −24.5% | 288 |
| **+ 2-day confirmation (proposed)** | **38.2%** | **−24.1%** | **98** |
| Entries-only confirmation (tested, REJECTED) | 26.7% | −25.7% | 154 |

Same profile, one-third the churn; at realistic friction it likely wins
net. The "confirm entries only" alternative was tested 06-12 and failed
(see doc). Trade-off you're accepting: exits are also delayed one close.

POLICY §3 Lane 2 — append (PROPOSED TEXT):
   > Gate flips (both directions) act only after the same state prints on
   > 2 consecutive closes (`bun run gate` reports raw and confirmed state).

On your "ratified": the agent flips `gate.ts` defaults to confirmDays 2,
updates the trading-loop skill wording, and journals the version bump.

## 3. Parked until you choose (no action needed now)

- **Cloud-routine cutover** — your call stands (keep Cowork). When ready:
  create routine at claude.ai/code → one verification run (expects
  journal-only) → delete Cowork task → bundle a dead-man alert. Worth
  doing before a travel weekend; MU's 06-18 time stop depends on a live
  heartbeat.
- **Third-party skills: install REJECTED** by both reviewers (untrusted
  prompt text next to order authority). When you want calendars, the
  agent builds ~20-line in-house fetchers instead. The catalog doc
  remains as reference.

## Standing posture (no signature needed)

Measurement freeze: no new lanes, no new skills, no event triggers
mid-sample. The agent's §6a verdict now reads per-lane (`bun run stats`):
L1 (catalyst singles — the actual LLM-edge hypothesis) vs L2 (mechanical
gate). `bun run book` prints the full invariant panel any time.
