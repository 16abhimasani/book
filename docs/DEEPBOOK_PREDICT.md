# DeepBook Predict — research notes

Source: https://docs.sui.io/onchain-finance/deepbook-predict/
Branch: `predict-testnet-4-16` (testnet only).
Last live state captured: 2026-05-12 (PT).

## What it is

Expiry-based prediction market protocol on Sui. Markets are constructed
against **admin-created** `OracleSVI` objects; users open directional or
range-bound positions with a defined expiry and strike configuration.
Liquidity providers deposit quote assets into a shared vault and receive
**PLP** share tokens in return.

**Important framing correction (post-research):** DBP is positioned as a
hedging primitive for **crypto price markets at short-dated expiries**,
not a consumer prediction-market surface. Live testnet has 2,159 oracles
configured at writing — all BTC, hourly granularity. The official
DeepBook App is most likely Deribit-mobile-flavored, not
Polymarket-flavored.

## Primitives

- **Binary positions** — directional bet keyed by
  `(oracle_id, expiry, strike, is_up)`. Pays out if settlement is on the
  asserted side of the strike.
- **Vertical ranges** — bounded position keyed by
  `(oracle_id, expiry, lower_strike, higher_strike)`. Pays out if
  settlement falls in `(lower, higher]`. Differentiator vs Polymarket-style
  binary-only platforms.

## Onchain components (all in package `0xf5ea2b37...`)

- `Predict` — top-level shared object. Holds vault balances, pricing
  config, risk config, quote-asset allowlist, oracle strike grids,
  withdrawal-limiter config, and the PLP treasury cap.
- `PredictManager` — per-user shared object. Wraps a DeepBook
  `BalanceManager`, stores deposited balances, tracks binary/range
  quantities keyed by `MarketKey`/`RangeKey` (positions are NOT
  standalone objects).
- `OracleSVI` — per-market state. Stores spot, forward, SVI parameters,
  lifecycle status, and settlement price. Lifecycle: `Inactive` →
  `Active` → `Pending settlement` → `Settled`.
- `Vault` — shared liquidity + exposure state machine. Quote balances,
  mark-to-market liability, max payout, PLP supply/withdraw flows.

## Testnet integration targets

| Parameter | Value |
|---|---|
| Network | Testnet |
| Public server | `https://predict-server.testnet.mystenlabs.com` |
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Quote asset (DUSDC) | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` (6 dp) |
| PLP coin type | `0xf5ea2b37...::plp::PLP` |
| Source branch | [`predict-testnet-4-16`](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict) |

> Treat these as **temporary**. Mysten will redeploy at mainnet; pin them
> in config (`src/config.ts`, `BookCore/DeepBook.swift`), never inline.

## Move public API (predict.move)

**Trading (taker side):**
- `public fun mint<Quote>(...)` — open a binary position
- `public fun redeem<Quote>(...)` — close a binary position
- `public fun redeem_permissionless<Quote>(...)` — crank settled positions
  (anyone, in exchange for gas — see crank-bot opportunity below)
- `public fun mint_range<Quote>(...)` — open a vertical range
- `public fun redeem_range<Quote>(...)` — close a vertical range
- `public fun get_trade_amounts(...)` — preview mint price + payout
- `public fun get_range_trade_amounts(...)` — preview range price + payout
- `public fun ask_bounds(predict, oracle_id) -> (u64, u64)` — bid/ask

**LP side:**
- `public fun supply<Quote>(...)` — deposit, mint PLP
- `public fun withdraw<Quote>(...)` — burn PLP, withdraw

**Manager + housekeeping:**
- `public fun create_manager(ctx) -> ID` — create your PredictManager
- `public fun compact_settled_oracle(...)` — clean up storage post-settlement

**Admin (gated `public(package)`):**
- `create<Quote>`, `add_oracle_grid`, `enable_quote_asset<Quote>`,
  `set_oracle_ask_bounds`, withdrawal-limiter management, etc.
- **This is the architectural lock:** external code CANNOT create
  oracles or markets in DBP. User-generated markets need a separate
  protocol layer. See `STRATEGY-V2.md`.

## Public Predict server endpoints (REST, JSON)

Live and healthy (verified 2026-05-12, lag ~1s from chain head).

**Protocol + market state:**
- `GET /status` — server health, indexer pipeline lag
- `GET /predicts/:predict_id/state` — Predict object state + config
- `GET /predicts/:predict_id/oracles` — oracle list (returns large; paginate?)
- `GET /oracles/:oracle_id/state` — single oracle state
- `GET /oracles/:oracle_id/ask-bounds` — resolved bid/ask
- `GET /predicts/:predict_id/quote-assets` — accepted quotes

**Vault + LP:**
- `GET /predicts/:predict_id/vault/summary`
- `GET /predicts/:predict_id/vault/performance?range=ALL`
- `GET /lp/supplies` / `GET /lp/withdrawals`

**Manager + portfolio:**
- `GET /managers` / `GET /managers/:manager_id/summary`
- `GET /managers/:manager_id/positions/summary`
- `GET /managers/:manager_id/pnl?range=ALL`

**History:**
- `GET /oracles/:oracle_id/prices` + `/prices/latest`
- `GET /oracles/:oracle_id/svi` + `/svi/latest`
- `GET /positions/{minted,redeemed}` + `/ranges/{minted,redeemed}`
- `GET /trades/:oracle_id`

## Live event types (Sui checkpoint stream)

Filter by package `0xf5ea2b37...`:
- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

## Snapshot — testnet at 2026-05-12

```
oracles configured:       2,159 (all BTC, hourly expiries observed)
vault_balance:            $1,001,706.05  (DUSDC, 6dp)
plp_share_price:          1.00041 (~4 bps profit since launch)
total_mtm:                $270.68
total_max_payout:         $280.33
utilization:              0.027%
available_withdrawal:     $1,001,425.72
```

LP capital is parked with virtually no takers. Either (a) testnet is
quiet because there are no real consumers yet, or (b) the structural
shape (hourly BTC options for hedgers) doesn't have organic retail
demand. Both are likely; the consumer surface is open.

## Three-layer integration pattern (from the docs)

1. **Public Predict server (indexed)** — UI rendering, lists, portfolio
   summaries, vault summaries, history.
2. **Sui checkpoints / event streaming** — second-level oracle update
   freshness when a UI needs a live tape.
3. **Direct on-chain reads** — confirmation-critical state immediately
   before or after wallet flows (verify settlement before payout, etc.).

> "Avoid building the primary UI around raw chain scans. The server
> already exposes indexed surfaces for market state, portfolio state,
> vault state, and history."

## Build ideas (still open)

### LP / underwriter side (TS sandbox)
- **Delta-hedged PLP strategy.** Hold PLP, hedge net delta on Hyperliquid
  or Aftermath perps. Earn vol risk premium, neutralize directional exposure.
- **PLP IV monitor.** Compare PLP-implied vol vs realized vol on the
  underlying. Allocate/withdraw based on edge.

### Taker / strategy side (TS sandbox)
- **Vertical-range mispricing scanner.** Stream the indexer; flag ranges
  whose implied probability diverges from a model (log-normal on the
  oracle) by > N stddev.
- **Calendar / multi-leg spread builder.** Compose ratio spreads, condors,
  butterflies the consumer UI may not expose.
- **Auto-roller.** When a position approaches expiry, roll into the next
  strike/expiry per a rule.

### Adjacent infrastructure
- **Crank bot.** `redeem_permissionless` lets anyone redeem settled
  positions in exchange for gas. Could run a tiny daemon to auto-settle
  for our iOS users + push notifications when their positions resolve.
- **Backtester.** Replay historical oracle prints + indexer events;
  simulate fills against the vault.
- **Read-only dashboard.** OI, PLP NAV, realized vs implied vol —
  useful even if the official app ships.

### iOS / consumer side (ios/)
- **Mobile read of testnet markets.** Phase 4 in `STRATEGY.md`.
- **Tap-to-bet on a price-prediction market.** Phase 5.
- **Sponsored gas + Sign-in.** Phase 6-7.

## Pivot anchors (regardless of strategy)

- Sui testnet only until mainnet ships.
- Loose coupling to package IDs / object layouts — keep in config.
- Indexer-first reads; on-chain reads only for confirmation.
- LP-side strategies need a hedging venue (Hyperliquid likely — see
  `docs/v1-base-bot/CHAINS_AND_PROTOCOLS.md`).
- **DBP can't host user-generated event markets.** See
  `docs/STRATEGY-V2.md` for the separate-protocol design.
