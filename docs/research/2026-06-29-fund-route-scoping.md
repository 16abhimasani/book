# Scoping — `fund-route`: cross-chain USDC rail (Polygon/Polymarket-world ↔ Sui/DeepBook)

- **Date:** 2026-06-29 · Research/scoping only (no code, no keys, no trades).
- **Builds on:** `~/dev/money-movement` (the Money Movement SDK), `docs/VENUES.md`,
  `docs/research/2026-06-29-onchain-prediction-edge.md` (the "edge is dead → value is in infra" brief).
- **Note:** the build itself would live in `~/dev/money-movement`, not this repo. This is the strategic record.

## Bottom line

The trading edge is dead; the leverage is a **cross-chain USDC funding rail with prediction-market DX**,
and the owner already owns ~80% of it. The Money Movement SDK has a production-quality
`MovementSession` bridge state machine, a working CCTP plugin (EVM), Iris attestation polling, a pure
route planner, and chain-is-truth/idempotency discipline — **missing exactly one leg: Sui** (the CCTP
Sui route is declared but `cctpV2EvmChainConfig()` *throws* for `sui`). Filling that gap is the build.
And it sits **one `X-Builder-Code` header away** from Polymarket builder fees — a revenue line that needs
**zero personal trading** (compliance-clean + aligned with a Product role).

## 1. Money Movement SDK — current state (real, well-architected)

TS monorepo (`packages/{sdk,acme-server,web-demo}`), deployed on Fly.io. Three-layer
provider/capability/session design modeled on Stripe PaymentIntent:

- **`MovementSession`** (`packages/sdk/src/sessions/movement.ts`) — discriminated `status` + `nextAction`
  union; caller never names a provider. Already contains a full **`MovementBridgeState` machine**
  (`quoted → awaiting_signature → submitted → source_confirmed → destination_pending → destination_credited`)
  with multi-hop routes, per-step tx hashes, `signer: server|wallet_required`. **The cross-chain bridge
  state model already exists and is typed.**
- **Plugin registry** + `BridgeCapability` (`quote()/execute()` → prepared `wallet_sendCalls`).
- **Pure route planner** (`planBridgeRoute`/`planUsdcPath`) — composes two-hop USDC paths from route metadata.

| Component | State |
|---|---|
| ACME passkey wallet (testnet sign/submit/verify, 289 tests, chain-is-truth, replay index) | **LIVE** |
| Relay bridge (Base↔Tempo USDC) | executable (wallet signs) |
| Circle **CCTP V2** (EVM: ETH/Base/Arb/Polygon/Avax/…) — burn/approve + Iris polling + dest receiveMessage | **partial, real** |
| **CCTP Sui route** | **declared, NOT executable** (throws for `sui`) ← *the gap* |
| Sui in the lab (`web-demo/src/lab/sui-dapp-kit.ts`) — `@mysten/sui/grpc` + dapp-kit | scaffolded, **already gRPC** |
| coinbase/stripe/privy/phantom/mpp | mock/metadata-only |

## 2. The Polygon ↔ Sui rail (2026 facts)

- **Native USDC live on Sui** since Oct 2024 (Circle, 1:1 redeemable).
- **Polygon and Sui are both CCTP domains** → USDC moves **directly via CCTP burn-and-mint, no ETH hop**.
- **Caveat (drives the design):** CCTP on Sui is **V1-only** as of June 2026 (V2 "by H1 2026" *announced, not
  confirmed live*). So **no Fast Transfer (~8-20s) or hooks on Sui yet — only V1 hard finality (~13+ min)**.
  **Circle Gateway (instant unified balance) excludes Sui.** Verify live V2-on-Sui before promising Fast Transfer.
- **`github.com/circlefin/sui-cctp`** exists — Move `message_transmitter` + `token_messenger_minter` + TS scripts
  for `deposit_for_burn`/`receive_message`. Flow: burn on source → **Iris attestation** (already polled by the
  SDK's `readCircleCctpStatus`) → `receive_message` Move call mints on Sui. Sharp edge: stuck-mint reports
  (MystenLabs/sui#24598) → **verify the mint receipt before crediting**.
- **CEX → Sui:** Coinbase/Binance/OKX support native USDC withdrawal *directly on the Sui network* — the
  simplest "fund from a CEX" leg is a direct withdrawal, no bridge.
- **Wormhole Connect** is a production-grade wrapper for native-USDC→Sui if hand-rolling Move calls is too raw.

## 3. Candidate builds rated

| # | Build | Leverage | Effort | Verdict |
|---|---|---|---|---|
| **(a)** | Sui↔Polygon CCTP funding rail in the SDK (fill the one gap) | **HIGHEST** — reuses session SM + Iris + planner; literal vision sentence; demoable in days | Low–Med | **THE build** |
| **(d)** | Polymarket Builder-Codes-aligned funding flow (`X-Builder-Code` on the deposit) | **HIGH** — fee revenue, **no personal trading**, fits a Product hire | Low (add-on to a) | **monetization seam** |
| (b) | pmxt multi-venue data/dashboard | MED — useful but crowded, doesn't use the SDK | Med | complement, defer |
| (c) | Full fund-and-trade orchestration | MED but premature — DeepBook has no volume + "LLM never signs" | High | after (a), gated |

## 4. Recommended first build — `fund-route`

**A one-call cross-chain funding rail moving native USDC between Polygon and Sui through the existing
`MovementSession`, so a DeepBook/Sui wallet can be funded from (and swept back to) the Polymarket/Polygon
world — builder attribution one header away.** Scoped to a rail + a working two-chain demo, not a platform.

Reuses (why it's days not months): `MovementSession`/`MovementBridgeState` SM (unchanged), `circle-cctp.ts`
EVM call-building + **Iris polling** (the off-chain half is done + shared both directions), `route-planner.ts`
(register two route capabilities → dispatch free), the bridge route pattern, `sui-dapp-kit.ts` (already gRPC),
`@circlefin/sui-cctp` Move packages, and the chain-is-truth/idempotency/replay discipline.

**Decomposition:** (1) `sui-cctp` plugin (`BridgeCapability` for polygon↔sui, build `deposit_for_burn`/
`receive_message` Move calls); (2) Sui executor + **receipt verifier** (gRPC, assert mint before credit,
idempotent); (3) bridge routes mirroring the CCTP ones; (4) sweep-back + the `X-Builder-Code` Polymarket
landing (monetization demo); (5) tests to the repo bar (route matrix, movement-session Sui path, real-fixture
attestation/receipt); (6) lab UI panel rendering the existing bridge state.

**The demo that proves it:** *"Polygon USDC → funded on Sui → trade-ready → swept back into Polymarket as
pUSD"* on real testnets/mainnet-USDC, ending in a builder-attributed deposit.

## 5. Risks

- **Compliance (works at Polymarket) — load-bearing.** Build the **public, permissionless USDC rail** only;
  never touch Polymarket non-public info/internal APIs/privileged access. **Polymarket US (CFTC fiat) is NOT a
  target.** Builder Codes are self-service/public, but **confirm the employment agreement permits earning
  builder fees + disclose** (quick counsel check before monetizing).
- **Keys/custody:** reuse `VENUES.md`'s 8 controls verbatim (caps in code, pre-send sim, min_amount_out,
  circuit breaker, dedicated hot wallet w/ secret-manager key, private routing, deadlines, **LLM never signs**).
  Cloud sessions have no secure secrets store → signing key lives in a local/serverless executor, never routine env.
- **Sui JSON-RPC deprecation (Jul 2026)** — largely pre-mitigated (`sui-dapp-kit.ts` already gRPC); audit any
  legacy reads, pin gRPC/GraphQL.
- **CCTP-on-Sui is V1-only today** — design honest V1 mechanics + a feature flag to flip to V2 Fast Transfer
  when Circle ships it. Don't claim Fast Transfer on Sui until verified.
- **Bridge risk** — CCTP native-both-ends avoids wrapped/lockup risk; **verify destination mint before
  crediting** (stuck-mint reports exist); Wormhole Connect as a battle-tested alternative wrapper.
- **DeepBook has no liquidity** — the *fund* rail is valuable regardless; gate any fund-and-trade extension on
  DeepBook mainnet + volume.

### Key sources
Sui native USDC [circle.com] · CCTP V1/V2 + Sui exclusion + V1 deprecation [circle.com/blog/cctp-version-updates] ·
Sui×CCTP [blog.sui.io] · circlefin/sui-cctp [github.com] · Wormhole→Sui [wormhole.com] · CEX→Sui [chaincatcher] ·
Polymarket Builder Codes [docs.polymarket.com/developers/builders] · Polymarket bridge `X-Builder-Code`
[docs.polymarket.com/trading/bridge/deposit] · Sui gRPC [docs.sui.io/concepts/data-access/grpc].
