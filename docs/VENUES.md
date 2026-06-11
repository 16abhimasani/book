# VENUES.md — venue expansion roadmap

Parked-but-intended. This file preserves the context for expanding the
policy+journal trading pattern beyond Robinhood equities. One POLICY.md +
one JOURNAL.md per venue; a unified dashboard only after ≥ 2 venues are
journaling. (2026-06-11)

## Tier 0 — live

- **Robinhood Agentic — equities** (`robinhood-agentic/`). The reference
  implementation of the pattern.

## Tier 1 — arrives inside the existing loop (no new infra)

Robinhood has said options, crypto, **event contracts**, and futures are
coming to the Agentic MCP as it exits beta. Each lands as a new lane in
the existing `robinhood-agentic/POLICY.md` + routine — zero architecture.

- **Options** — account already approved level 2; lane spec'd-then-parked
  in POLICY §3.4.
- **Crypto (RH)** — unlocks the 24/7 cadence the owner wants.
- **Event contracts (RH Predict)** — *centralized prediction markets
  through the same MCP*. Likely the cheapest first prediction-market
  exposure; RH runs CFTC-regulated event contracts (often Kalshi-backed
  historically). Watch for these tools on the connection.

## Tier 2 — centralized prediction markets (own venue, own policy)

- **Kalshi** — CFTC-regulated, real API + official MCP ecosystem
  emerging. Candidate integration: connector/API + `venues/kalshi/`
  (POLICY, JOURNAL, routine). Edge thesis: LLM breadth on news →
  probability estimates vs market price.
- **Polymarket** — crypto rails (Polygon/USDC), deepest liquidity in
  event markets. US-access rules have been shifting — re-verify status
  and compliance before building.

## Tier 3 — on-chain (crypto-native)

- **DeepBook Predict (Sui)** — already in this repo (`ios/`, `src/`,
  `docs/DEEPBOOK_PREDICT.md`, `docs/STRATEGY*.md`). Testnet now; becomes
  a trading venue when it ships mainnet. The LLM-oracle work in
  STRATEGY-V2 may also make us a *market creator*, not just a trader.
- **Hyperliquid** — perps, best API in crypto. Leverage lane when wanted.
- **Solana + Jupiter** — owner is ex-Phantom; deep familiarity.
- **Bittensor SN8 / Taoshi** — paid AI signal feed, research only.

(Tier-3 candidates inherited from `~/dev/trading-bot/` V2+ research and
`docs/v1-base-bot/` — see `~/.agents/projects/trading-bot.md`.)

## Integration pattern (every venue)

1. Execution layer: MCP connector if one exists, else minimal SDK in
   `src/` (Bun/TS).
2. `venues/<name>/POLICY.md` — owner-edited limits, lanes, cadence.
3. `venues/<name>/JOURNAL.md` — append-only run log, committed.
4. A Claude Code Routine per venue (cloud heartbeat), phone as override.
5. Capital graduates from RH profits or explicit owner deposits — venues
   never share a wallet/account.

## Unified terminal (end state)

Single dashboard (Cowork artifact or small web app) reading every
venue's JOURNAL + live positions via connectors. Build trigger: second
venue goes live. Not before.
