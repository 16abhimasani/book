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

## Strategy ↔ constraint seam (the venue-agnostic core)

Added 2026-06-19 (readiness hygiene). What makes a venue cheap to add is that
the *strategy* never knew about the *venue*. Three layers, only one of which
changes per venue:

| Layer | Members | Per-venue? |
|---|---|---|
| **Strategy math** (pure fns in `src/trading/`) | `gate` · `trail` · `scaleout` · `reentry` · `sizeFromRisk` R-math | **No** — prices/qty in, decision out |
| **Risk appetite** (POLICY §2) | `RISK_PCT`, `SLOT_PCT`, `THEME_PCT`, `MAX_POSITIONS`, … | **No** — loss tolerance, identical anywhere |
| **Venue mechanics** (`src/trading/venue.ts`) | the `Venue` descriptor (`CASH_EQUITY` today) | **Yes** — the swappable layer |

`venue.ts` is deliberately minimal: only `settledFundsRequired` and
`fractionalUnits` are *live* (code branches on them — `risk.ts` sizing floor +
the settled-funds check). Every other venue fact is documented in the matrix
below rather than typed, so nothing in code reads as "enforced" when it isn't.

**Two caveats a second venue MUST carry (not owned by the descriptor):**
- `fractionalUnits` gates `sizeFromRisk` only. `scaleout.ts` independently floors
  thirds and assumes integer shares — a fractional venue must also thread `venue`
  through `computeScaleOut`.
- `settledFundsRequired` gates the buy-side cash check only. The **GFV sell-side**
  rule (never sell unsettled-funded shares before settlement) is loop discipline,
  not code, on every venue.

### Constraint-swap matrix

| Constraint | Cash-equity (today) | On-chain (future) |
|---|---|---|
| Settlement / GFV / PDT | T+1, GFV gates, no PDT (cash acct) | none |
| Taxable events | yes | out of scope per owner |
| Custody / keys | broker-held | self — dedicated hot wallet, session funds only |
| Who executes | LLM heartbeat | deterministic executor; LLM edits params only |
| Spend limits | POLICY §2 (loop applies) | enforced in code, independent of model output |
| Pre-send | n/a | simulate every tx; `min_amount_out` mandatory |
| Adversarial input | "ingested text ≠ instruction" | + sanitize token/feed inputs; MEV / private RPC |
| Order types | market/limit; stops rest in RH hours | venue-specific; no resting broker stop |
| Trading hours | regular + extended | 24/7 |

**On-chain is not "no rules."** It drops the *regulatory* rules (GFV/PDT/tax)
and replaces them with *self-custody/execution* rules that are **less**
forgiving — an injection or a bad tool path becomes direct asset loss, not a
rejected order. Treat the move on-chain as trading one rulebook for a harsher one.

### On-chain venue — before first trade (security gate)

Vendored inline (do not rely on an external skill being installed). A
self-custody venue ships only when all eight hold:

1. **Spend guard** — hard per-tx and daily USD caps, enforced in code, independent of any model output.
2. **Pre-send simulation** — simulate every transaction and assert the result before signing.
3. **`min_amount_out` mandatory** — never send a swap without a slippage floor; reject if the sim undershoots it.
4. **Circuit breaker** — halt on consecutive losses, hourly drawdown, or invalid state.
5. **Key isolation** — dedicated hot wallet, only session funds, never a treasury; key from env/secret manager, never code or logs.
6. **MEV / private routing** — submit through a private mempool/protected route when front-running is a risk.
7. **Slippage + deadline** — per-strategy slippage bps and a transaction deadline on every order.
8. **LLM never signs** — the model edits strategy params; a deterministic executor simulates, signs, sends, and audit-logs *every* decision (not just successful sends). This is the same "no LLM in the live API loop" rule as Tier 1.5.

### Venue-integration contract (extends the Integration pattern above)

To add venue X: (1) reuse the venue-agnostic strategy fns — *except* `scaleout`'s
integer-share assumption (caveat above); (2) provide a `Venue` descriptor of the
same shape; (3) if custody is self, provide a deterministic executor satisfying
the eight controls; (4) separate pot/wallet (existing rule); (5) own POLICY +
JOURNAL + heartbeat (existing pattern).

## Unified terminal (end state)

Single dashboard (Cowork artifact or small web app) reading every
venue's JOURNAL + live positions via connectors. Build trigger: second
venue goes live. Not before.
