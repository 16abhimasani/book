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

**Verified capability matrix (this connection, 2026-06-11):**

| Instrument | Trade | Read/watchlist | Notes |
|---|---|---|---|
| US equities/ETFs | ✅ | ✅ | live — the current book |
| Options | ❌ | ✅ (option watchlist tools) | acct approved L2; order tools "rolling out" |
| Crypto | ❌ | ✅ (`search currency_pair`, watchlist) | order/quote tools referenced in tool guides but not exposed yet |
| Event contracts | ❌ | ❌ | search tool says "events, futures … added as tools land" |
| Futures | ❌ | ❌ | app-only |

The heartbeat checks the tool list every run and journals the moment a
new category lands → owner ratifies the prepped POLICY lane → trading
begins same-day. This is the zero-work path to 24/7.

### Tier 1.5 — RH Crypto Trading API (parallel path, available TODAY)

[docs.robinhood.com/crypto/trading](https://docs.robinhood.com/crypto/trading/) —
official, US, 24/7, API-key + Ed25519-signed requests, USD pairs with
`is_api_tradable=true`. **Separate pot**: trades the RH *Crypto* account,
not the Agentic account.

- Setup: RH web classic → crypto account settings → create API
  credentials (owner generates keypair; scope permissions minimally).
- **Secrets constraint**: Claude Code cloud sessions/routines have NO
  secure secrets store (env config explicitly warns against credentials)
  → the signing key must NOT go in routine env. Run options:
  a. **Local heartbeat** (laptop-on): key in `book/.env` (gitignored),
     loop via Cowork scheduled task. Zero new infra.
  b. **Serverless worker** (laptop-off): Vercel/Supabase cron with
     encrypted env vars runs a deterministic executor; Claude edits
     strategy params in-repo (no LLM in the live API loop — trading-bot
     lesson). Build only if (a) proves the strategy.
- Decision 2026-06-11: PARKED in favor of Tier-1 crypto (no split pot,
  no key handling, same policy/journal). Revisit if agentic crypto
  hasn't shipped by ~July or owner wants 24/7 sooner.

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
