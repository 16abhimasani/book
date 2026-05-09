# DeepBook Predict — research notes

Source: https://docs.sui.io/onchain-finance/deepbook-predict/
Branch referenced in docs: `predict-testnet-4-16` (testnet only).

## What it is

Expiry-based prediction market protocol on Sui. Markets are constructed against
specified oracles; users open directional or range-bound positions with a
defined expiry and strike configuration. Liquidity providers deposit quote
assets into a shared vault and receive **PLP** share tokens in return.

## Primitives

- **Binary positions** — directional bet on an oracle price at a specific
  expiry + strike (above/below the strike at expiry).
- **Vertical ranges** — bounded position defined by upper + lower strikes
  (pays out if oracle settles inside the range at expiry). The differentiated
  primitive vs Polymarket-style binary-only platforms.

## Onchain components

- `OracleSVI` — oracle objects holding spot prices and settlement values.
- `PredictManager` — per-user account: balances, positions, range holdings.
- **Shared vault** — single LP pot; PLP token = proportional claim.

## Off-chain surface

The docs recommend a **three-layer integration pattern** for apps:

1. **Public Predict server** (indexed) — for UI rendering, market lists,
   portfolio summaries, history.
2. **Sui checkpoints / event streaming** — for low-latency updates on fills,
   price moves, settlements.
3. **Direct on-chain reads** — for confirmation-critical state (e.g.
   verifying a settlement before paying out).

## Status caveat (verbatim from docs)

> "DeepBook Predict smart contracts might change before Mainnet deployment."

Treat package IDs, object layouts, and SDK shapes as **temporary** — the repo
should be loosely coupled to current addresses so we can swap on mainnet.

## Open questions (next research pass)

- [ ] Where is the SDK? (TS / Move) — the docs page didn't link one. Check
      `github.com/MystenLabs` org and `mysten-labs` Discord dev channel.
- [ ] Public Predict server endpoint URL + API shape (REST? GraphQL?).
- [ ] Current testnet package ID(s) for `OracleSVI`, `PredictManager`, vault.
- [ ] Which oracles are wired up on testnet? Pyth? Switchboard? Native Sui
      oracle?
- [ ] PLP fee mechanics — taker fee → vault? Maker rebates? Funding-rate-
      style accrual on open positions?
- [ ] Strike conventions — discrete grid (like options chains) or continuous?
- [ ] Settlement window — single-block at expiry, or TWAP over a window?
- [ ] Any caps on vault deposits / per-position size on testnet?

## Build ideas

Anchored against the **competitive context**: the DeepBook team is launching
an official consumer app (waitlist: https://waitlist.deepbook.tech, announced
by @aslan_web3). That likely covers the discovery/UX surface for retail.
We should aim **above** or **below** the consumer layer:

### Below the app (LP / underwriter side)
- **Delta-hedged PLP vault strategy.** Hold PLP, hedge net delta on
  Hyperliquid or Aftermath perps. Earn the vol risk premium, neutralize
  directional exposure.
- **PLP IV monitor.** Compare PLP-implied vol (from vault flow) vs realized
  vol on the underlying oracle. Allocate / withdraw based on edge.

### Above the app (taker / strategy side)
- **Vertical-range mispricing scanner.** Stream the indexer; flag ranges
  whose implied probability diverges from a model (e.g. log-normal on the
  oracle) by > N stddev.
- **Calendar / vertical spread builder.** Compose multi-leg positions the
  consumer UI may not expose (ratio spreads, condors, butterflies).
- **Auto-roller.** When a position approaches expiry, roll into the
  next strike/expiry per a rule.

### Adjacent infrastructure
- **Backtester.** Replay historical oracle prints + indexer events; simulate
  fills against the vault. Validates strategy before paper trade.
- **Read-only dashboard.** Per-market open interest, PLP NAV history,
  realized vs implied vol — useful even if the official app ships.

## Pivot anchors

We can recompose around these decisions later. Things that probably stay
true regardless of strategy:

- Sui testnet only until mainnet ships.
- `@mysten/sui` for chain interaction.
- Bun + TypeScript runtime.
- Indexer-first reads; on-chain reads only where confirmation matters.
- LP-side strategies need a hedging venue (Hyperliquid most likely — see
  `docs/v1-base-bot/CHAINS_AND_PROTOCOLS.md` for the rationale).
