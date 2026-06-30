# Research — Can an autonomous LLM agent find a capturable edge in on-chain prediction markets?

- **Date:** 2026-06-29 · Research only (no code, no keys, no trades).
- **Framing constraint:** owner is joining Polymarket → Polymarket is a **data source only**,
  never a personal-trading target. Sui DeepBook Predict / Kalshi are the candidate *trading*
  venues. Design venue-agnostic.

## Bottom line

**There is a plausible edge worth *shadowing*, but it is almost certainly NOT
"LLM-estimates-probability-better-than-the-market."** Two independent June-2026 benchmarks
plus a Bloomberg wallet study converge: LLMs are **miscalibrated** vs prediction-market
prices, and naive "fade the price with my model" loses money net of execution. The profit
in this ecosystem is **microstructure** (speed, breadth, fills, market-making), **not
forecasting**. 14 of the 20 most-profitable Polymarket wallets are bots and agents are
>30% of activity — but they win on *speed/fills*, not predictions.

**The honest first build is a read-only SHADOW HARNESS designed to DISPROVE the forecasting
edge cheaply** — zero capital, zero keys, zero compliance exposure — before any venue/infra
work is justified.

## 1. Sui DeepBook Predict — current state (June 2026)

- **Still testnet. Mainnet not live, no date** ("later this year" per the May 2026 launch
  blog). Same package/registry/object/server addresses as the repo's 2026-05-12 snapshot —
  nothing rotated. Identifiers explicitly temporary; contracts may change pre-mainnet.
- **Oracle scope:** marketing now says "any asset, calls/puts/spreads coming"; *observed*
  reality is **BTC-dominant, hourly/short-dated binaries**, priced off an **admin-set SVI
  surface (Block Scholes partnership)**. Confirm with a live `/oracles` pull before assuming breadth.
- **Decisive fact — no taker volume.** Testnet vault: **$1M LP parked at 0.027% utilization,
  ~$270 total mark-to-market.** There is essentially nothing to trade against. DeepBook *spot*
  is healthy (~$15M/day); *Predict* is pre-liquidity. → **shadow-now, trade-maybe-later.**

## 2. Tooling / data layer

- **pmxt** ("CCXT for prediction markets", MIT, Python+TS+HTTP+CLI, MCP-native) — unified
  reads across 12+ venues (Polymarket, Polymarket US, Kalshi, Limitless, Myriad, Hyperliquid,
  SuiBets…). **Reads need only `api_key + wallet_address`, no signing key.** Execution needs a
  `private_key` (self-host). **No DeepBook Predict adapter** (SuiBets ≠ DeepBook) — DeepBook
  still needs the bespoke `predict-server` REST + Move calls the repo already specced.
- **PolyRouter** — read-only aggregator, 7 venues, no key for testing, "not production infra."
- **Rumor** — agentic terminal ("define edge in words → agent"); **simulates against live/historical
  markets before capital** (i.e. shadow-first is the industry-standard vetting). Polymarket-only.
- **Totalis** (YC S26) — cross-venue parlay/derivatives layer on Solana. Evidence cross-venue
  composition is an active product area.

## 3. Edge scorecard (skeptical)

| # | Edge | On a venue we can trade? | Real? | Capturable by us? | Rating |
|---|---|---|---|---|---|
| a | LLM prob vs price | Kalshi/DeepBook | weak | net-negative in 2 benchmarks (−16% to −31%) | ❌ illusory |
| b | Cross-venue arb | needs a Polymarket leg | yes (2–7%) | no — can't trade PM; Kalshi lockups 3–30d; ~30s windows | ⚠️ measure only |
| c | Resolution/settlement | UMA venues; N/A DeepBook | yes (UMA) | mechanism edge, not LLM; oracle-risk on DeepBook | ⚠️ park |
| d | Breaking-news speed | any | partial | no — LLM cycle 220ms–7.5s; repo bans LLM-in-loop | ❌ illusory |
| e | Range model-vs-oracle | **DeepBook (ours)** | unclear | low — arbitrage-free SVI forbids vertical-spread arb *by construction*; no liquidity | ⚠️→❌ |

**Key structural insight on (e):** DeepBook range prices are *mechanically derived from the
SVI oracle*, not a crowd consensus you can fade. Arbitrage-free SVI is *built* to forbid
vertical-spread arbitrage, so "model vs oracle" is a **directional vol bet against the LP
vault**, not an arb. Still the best-*fitting* hypothesis (on our venue, clean on-chain ground
truth, high sample rate) — so it's the right thing to *shadow*, while expecting to disprove it.

## 4. Shadow-harness design (clone `src/trading/shadow.ts`)

Two read-only ledgers, pure tested resolution math, `--dry` mode, headline = **Brier-delta**:

- **Ledger A — Polymarket calibration** (data-source use): `pmxt.fetch_markets/order_book` →
  `llm_P = P(YES|question,news)` → flag `|llm_P − mid| ≥ k` → at settlement compute
  **Brier(llm_P) − Brier(mid)**, a calibration curve, and hypothetical PnL **at the real
  order-book fill, not mid**. If `Brier_llm − Brier_mid ≥ 0`, edge (a) is dead.
- **Ledger B — DeepBook range** (on-chain ground truth): `predict-server` reads → model
  range-prob (log-normal + fat-tailed from the oracle's own spot/forward/SVI) vs oracle-implied
  (`get_range_trade_amounts`/`ask_bounds`) → at `OracleSettled`, realized bucket → **Brier(model)
  − Brier(oracle)** over hundreds of hourly settlements (fast statistical power). If model can't
  beat the oracle, (e) is dead.

No keys, no money. If both Brier-deltas ≥ 0 over a meaningful sample, **stop — the harness just
saved a venue build.**

## 5. Access (read-only first; NO secrets)

- Polymarket data: pmxt (`api_key+wallet`, reads only) or PolyRouter (no key).
- DeepBook market state: `predict-server.testnet.mystenlabs.com` REST (keyless).
- Sui confirmation reads: full node RPC — **but see the gotcha.**
- **Operational gotcha (June 2026):** Sui is **deprecating public JSON-RPC** — testnet shutdown
  ~**July 6**, mainnet ~**July 20**, full deactivation **July 31 2026** → migrate to **gRPC/GraphQL**
  or a managed provider. `predict-server` REST is separate and likely unaffected. Pin in config.

## 6. Top risks

1. **LLM-calibration (core):** two benchmarks show net-negative returns + rigid 0.8–0.9 confidence.
2. **DeepBook has no volume** — even a real edge is uncapturable (gate capital on post-mainnet two-sided volume).
3. **Oracle risk on DeepBook** — you bet the institutional vol surface is wrong, vs the LP vault.
4. **Slippage destroys paper alpha** — "alpha decays rapidly at $1k lots"; PnL must use real fills.
5. **Cross-venue arb off-limits** (no Polymarket leg) + decaying windows.
6. **Latency** — LLM can't win speed; repo bans LLM-in-loop anyway.
7. **Infra churn** — Sui JSON-RPC deprecation; DeepBook addresses rotate at mainnet.

## Recommendation

Build the **two-ledger read-only shadow harness** (clone `shadow.ts`). It cheaply and
definitively tests the load-bearing assumption (does our probability beat the price?) on the
deepest data (Polymarket, as data) and the cleanest ground truth (DeepBook on-chain settlement).
**Designed to disprove.** Gate every downstream venue/capital/key decision on a *positive*
Brier-delta over a meaningful sample. The strongest near-term value is more likely in the
**builder/infra layer** (cross-chain money movement, prediction-market tooling) — owner's actual
edge + role — than in personal forecasting trades.

### Sources
Prediction Arena [arxiv 2604.07355] · PolyBench [arxiv 2604.14199] · Bloomberg/microstructure
[turbinefi.com] · DeepBook Predict [docs.sui.io/onchain-finance/deepbook-predict, blog.sui.io] ·
pmxt [github.com/pmxt-dev/pmxt] · arbitrage-free SVI [Gatheral-Jacquier arxiv 1204.0646] · Sui
RPC deprecation [docs.sui.io/references/sui-api/rpc-best-practices].
