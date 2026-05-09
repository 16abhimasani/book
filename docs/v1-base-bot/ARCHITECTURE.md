# V1 Architecture

The simplest possible bot that actually trades real money on-chain. One
chain, one pair, one strategy, one TS file (almost).

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Chain | **Base** (Coinbase L2) | ~$0 gas, single chain, no bridging |
| Wallet + on-chain SDK | **`@coinbase/coinbase-sdk`** (CDP) | Wallet + onramp + Base in one package |
| EVM client | **`viem`** | Modern canonical TS EVM client; CDP plays well with it |
| Trading venue | **Uniswap V3 on Base** | Most context-rich AMM; LLMs know it cold |
| Onramp | **CDP Onramp widget** | First-party Coinbase, ~1% fee, anyone-with-Coinbase-can-use |
| Persistence | **SQLite** (`bun:sqlite`) | Local-only; no external service |
| Runtime | **Bun** + TypeScript | Fast, batteries-included, native TS |
| Interface | **CLI** (`bot start/status/stop`) | V1 only; web dashboard is V2 |
| LLM | **Claude Opus via Claude Max** in Cursor / Claude Code | Strategy iteration only; never in the trade loop |

---

## Wallet model

**V1: CDP managed wallet** (Coinbase MPC-secured HSM holds keys; bot
authenticates via CDP API key).

- Pro: nothing to back up; safer than a hot seed phrase on the laptop
- Con: Coinbase can technically freeze (TOS-level concern, not crypto)

**Plan to switch (when?)**: before scaling past ~$1k capital, flip to
externally-owned-wallet mode using a **12-word seed phrase, derivation
path 1** so the user's main Phantom account stays on path 0. Same code
either way — CDP SDK supports both.

---

## V1 strategy (placeholder, not the final product)

Mean-reversion rebalancing on **ETH/USDC** on Uniswap V3, Base.

```
loop every 30s:
  price = uniswap_quote(ETH, USDC, 1)
  if price <= last_action_price * 0.98:
      buy $10 of ETH
      last_action_price = price
  elif price >= last_action_price * 1.02:
      sell $10 of ETH
      last_action_price = price
  log decision + balance + pnl to sqlite
```

**Capital limits hard-coded in V1**: max $200 deployed, $10 per trade,
no leverage, no shorts. Single ETH/USDC pair only. Slippage cap 1%.

The strategy is intentionally dumb. The point of V1 is to prove the
plumbing (wallet → onramp → quote → swap → log) works end to end with
real money. Real strategy work comes after V1 ships.

---

## File tree (target)

```
trading-bot/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example                 # CDP_API_KEY, CDP_API_SECRET, etc.
├── docs/
│   ├── CONTEXT.md
│   ├── ARCHITECTURE.md
│   └── STACK.md
├── research/
│   └── CHAINS_AND_PROTOCOLS.md
└── src/
    ├── cli.ts                   # entry: bot start | status | stop
    ├── config.ts                # env, capital limits, pair, intervals
    ├── wallet.ts                # CDP wallet init / balance / sign
    ├── quotes.ts                # Uniswap V3 quote calls (viem)
    ├── trade.ts                 # swap execution
    ├── strategy.ts              # the rebalancing decision (5 lines)
    ├── risk.ts                  # capital + slippage + position checks
    ├── log.ts                   # SQLite append-only trade journal
    ├── notify.ts                # macOS terminal-notifier alerts
    └── onramp.ts                # CDP Onramp URL helper (opens browser)
```

---

## Risk gating (must-have before any swap goes live)

A `risk.ts` predicate runs before every `swap()` call. It rejects the
trade if any of these hold:

- Position would exceed total capital cap ($200)
- Single-trade size > 5% of total capital
- Quoted slippage > 1% of expected
- Last loss-event in the past 60s (cool-down)
- Wallet balance is below the gas reserve buffer

If any predicate fails, the bot logs the rejection, sends a desktop
notification, and skips the trade. No silent failures — every reject is
a row in the `trade_log` table with reason.

---

## Onramp UX

User flow when funds run low or first time:

1. Bot detects USDC balance below threshold
2. Bot prints onramp URL to terminal + opens browser tab via `open` cmd
3. CDP Onramp widget loads → user signs in to Coinbase → buys USDC →
   Coinbase sends USDC to wallet's Base address
4. Bot polls balance; resumes trading once funded

URL is built via the CDP SDK's `getOnrampUrl()` (or whatever the current
function is — verify against latest SDK docs at session start).

---

## Observability for V1

- All decisions, quotes, trades, and rejections → SQLite at
  `~/.trading-bot/journal.db` (append-only)
- CLI: `bot status` shows balance, current position, last 10 trades,
  rolling PnL
- Desktop notifications via `terminal-notifier` for: every trade,
  every rejection, every error
- No web dashboard, no Sentry, no Telegram. Add in V2.

---

## What pulls Claude into the loop

Claude Code is used as the **strategy editor**:

- User runs `bot status` + `cat journal.db dump` (or pipes recent trades
  into Claude Code session)
- Claude reads recent decisions, suggests changes to `strategy.ts`
- User reviews diff, accepts, restarts the bot

This is async, gated, and out of the live trade path. The bot itself
makes zero LLM calls during execution.

---

## Concrete next steps to leave V1

When V1 has been running for ~2 weeks and produced a useful trade log:

1. Add a second pair (e.g. cbBTC/USDC on Base) — proves the abstraction
2. Move trade journal to Supabase Postgres + add a Next.js dashboard
3. Switch wallet to externally-owned (self-custody)
4. Add Hyperliquid as a second venue, gated by the same risk layer
5. Layer in a real strategy (probably funding-rate or basis trade)
