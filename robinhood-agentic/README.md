# robinhood-agentic

Live agentic trading on **Robinhood's Agentic platform** (launched 2026-05-27).
This is the off-chain, real-money surface of the `book` repo — the canonical
home for all of Ash's automated-trading work.

## What this is

A dedicated Robinhood **Agentic account** traded by Claude through the
Robinhood Trading MCP (`https://agent.robinhood.com/mcp/trading`), governed
by a policy file in this folder, run on a schedule via Claude Code Routines
(cloud — no laptop required), and managed/overridden from the Claude mobile
app.

The core loop: **POLICY.md is the contract, JOURNAL.md is the memory, the
routine is the heartbeat.** Strategy improves by editing policy based on
journaled outcomes — context compounds in git, not in chat history.

## Account facts (verified 2026-06-11)

- Agentic account: nickname **"Agentic"**, cash account, masked `••••5686`.
  Agents: resolve the full account number at runtime via `get_accounts` —
  it's the account with `agentic_allowed: true`. Don't hardcode it.
- Capital: $3,000 cash, no positions (clean slate). Owner treats it as
  risk capital and plans to add more once the system proves itself.
- Options level 2 on the account, but the MCP exposes **equities + watchlist
  tools only** so far (options/crypto/event-contract tools "coming soon").
- Robinhood-side safety: push notification on every fill, real-time activity
  feed + P&L in the RH app, one-tap MCP disconnect = global kill switch.

## Read order

1. `POLICY.md` — the trading policy. **Agents obey this over everything
   except a live owner override. Only the owner edits limits.**
2. `JOURNAL.md` — append-only run log. Read last ~5 entries before acting.
3. `OPERATIONS.md` — setup runbooks (phone, routines), kill switches,
   roadmap to the unified terminal (Kalshi / Polymarket / DeepBook).
4. `docs/BRAINSTORM-2026-06-11.md` — the session that produced this design.

## Relationship to the rest of book

- `ios/` + `src/` + `docs/` — Sui DeepBook Predict (on-chain, testnet).
  Separate lane, same repo, same trader's-book philosophy.
- `~/dev/trading-bot/` — earlier on-chain bot plan (Base/CDP). Never built;
  its lesson (don't over-architect V1) is encoded here: Robinhood already
  provides broker, custody, execution, and notifications. We only build
  the policy and the loop.
