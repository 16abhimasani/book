# Watchlist — AI + space basket

The candidate universe for Lane-1 entries. Mirrors the Robinhood "AI Watch"
list (`e4352f87`). Being on this list is not a buy signal. A name only gets
traded when ALL of these hold (POLICY §3 Lane 1):

1. A free slot exists (POLICY §2 caps concurrent positions — see §2).
2. A fresh catalyst < 48h old, confirmed by two independent sources
   (`bun run grok` scoped to the name is the fast second source).
3. Confirming tape: price above the prior-day high / reclaiming the level.
4. A real stop fits the 2.5%/position risk budget (`bun run risk -- size`).
5. Settled cash covers it (extended hours: limit-only, see POLICY §3.7).

Prices below are after-hours 2026-06-15 for orientation only; re-quote at
decision time. Built from a Grok X-search of the current zeitgeist.

## The basket

| Ticker | ~Price | Theme | Notes / entry posture |
|---|--:|---|---|
| SPCX | $197 | space | IPO 06-12 @ $161, +22% today. Parabolic — wait for the FIRST real base/pullback, never chase the candle. No clean stop yet on a 4-day IPO. |
| NVDA | $212 | AI compute | The core. Enter on a catalyst dip, not after a run. |
| AMD | held | AI compute | Already a position. |
| AVGO | $395 | AI networking | Full-stack AI. Chunky ($ per share). |
| TSM | $441 | AI foundry | CoWoS sold out, 2nm ramp. Chunky. |
| DELL | $410 | AI servers | Hardware beneficiary. Chunky. |
| MU | held | AI memory | Already a position; HBM sold out 2026. |
| SNDK | $2,101 | AI storage | NAND supercycle — but **1 share > our cash**; watch only unless we size up. |
| PLTR | $134 | AI software | Application layer. Liquid, affordable. |
| RKLB | $109 | space launch | Pure-play launch; SPCX-IPO halo. Affordable. |
| ASTS | $87 | space comms | Satellite-to-phone. Affordable. |
| LUNR | $26 | space services | Lunar; lagging the group today (−4%). Cheapest. |
| SMCI | — | AI servers | On the RH list from before. |
| VRT | — | AI power/cooling | On the RH list from before. |

## Affordability now ($1,076 settled cash, ~$122 risk budget/position)

Fits cleanly: SPCX, NVDA, PLTR, RKLB, ASTS, LUNR. Chunky (1-2 shares):
TSM, AVGO, DELL. Out of reach at 1 share: SNDK ($2,101).

## How the loop uses this

- **Discovery:** a pre-market `bun run grok` scan of this list for fresh
  catalysts (keep the query tight — searches cost ~$0.07 each; one scoped
  question, not a broad sweep).
- **Verify:** before any entry, a scoped `bun run grok "<name> catalyst last 24h"`
  as the §3 second source.
- **The hard truth on fast movers:** an hourly (or 30-min) loop cannot catch a
  move that happens between runs. The watchlist + tighter cadence + the
  event-watcher (`docs/DESIGN-EVENT-DRIVEN-RUNS.md`) are how we get reactive.
  Chasing an after-hours spike with no resting stop is not aggression, it's the
  mistake that gives the gains back.
