# Brainstorm capture — 2026-06-11

Session: how to best use Robinhood Agentic + build a persistent,
phone-manageable, aggressive-return system. (Cowork, /brainstorm.)

## Key ideas

1. **Build nothing first.** RH Agentic already provides broker, custody,
   execution, notifications, and a kill switch. The only artifacts worth
   building are a policy file and a scheduled loop. (Direct lesson from
   the never-shipped `trading-bot` plan.)
2. **Policy-as-code, journal-as-memory.** POLICY.md is the contract the
   agent can't loosen; JOURNAL.md makes every run accountable and gives
   the weekly review something to learn from. Context compounds in git.
3. **Cloud routines are the persistence answer.** Claude Code Routines run
   prompt+repo+connectors on Anthropic infra — laptop closed. Phone is
   the override/monitoring surface via the same account-level connector.
4. **Regime gate resolves the lane conflict.** Momentum and mean reversion
   contradict each other simultaneously; gating by trend/vol regime makes
   them complementary instead.
5. **Venue-generic pattern.** One POLICY + JOURNAL per venue scales to
   Kalshi/Polymarket/DeepBook without new architecture — the future
   "unified terminal" is a dashboard over journals, not a platform build.

## Positions taken (Claude, accepted by owner)

- All four lanes at $3k is over-diversified → momentum primary,
  leveraged ETF secondary, mean reversion conditional, options parked.
- "No floor" ≠ no brakes: −15%/day halt + $2k owner-ACK checkpoint
  protect the experiment's ability to generate information, not capital.
- 24/7 cadence is aspirational until RH ships 24/7 instruments on the
  MCP; today the loop only has work during US market hours.

## Riskiest assumption

That an LLM-driven catalyst/momentum loop on hourly cadence has positive
expectancy after slippage on a $3k equities book. **Test:** 4 weeks of
journaled runs; measure hit rate, avg win/loss, expectancy; owner adds
capital only if positive and limits held on every run. Secondary risk:
routine sessions starting without connectors (known bug) — mitigated by
TOOLS-DOWN hard-stop in the prompt.

## Parked

- Options lane spec (account is level 2; MCP tools not live here yet)
- Agentic Credit Card (separate Banking MCP — unrelated to returns)
- Crypto / event contracts / futures lanes (await MCP support)
- Unified terminal dashboard (build after ≥ 2 venues are journaling)
- Backtesting harness in `src/` (only if a lane needs quantitative
  validation the journal can't provide)

## Next step (single)

Owner: push `book` to a private GitHub repo → create the routine
(OPERATIONS.md §B) → manually trigger run #1.
