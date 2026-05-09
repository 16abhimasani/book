# Session Handoff — trading-bot

Compaction of the planning conversation that produced this repo.
Last updated: 2026-04-21 (continuing into 2026-05-04 from updated date).

---

## TL;DR for the next agent / session

User wants to build a personal trading bot on a single chain, fund it via a
"works for anyone" onramp, and let Claude iterate on the strategy file. No
multi-chain heroics in V1. Decision after a long scoping conversation:

- **Chain**: Base (Coinbase's L2). Single chain only for V1.
- **SDK**: `@coinbase/coinbase-sdk` (Coinbase Developer Platform — wallet +
  on-chain calls + onramp in one package).
- **EVM client**: `viem`.
- **Trading venue**: Uniswap V3 on Base (or 0x aggregator if needed).
- **Onramp**: CDP Onramp widget (Coinbase-hosted, anyone with a Coinbase
  account can fund USD → USDC on Base).
- **Wallet**: CDP managed wallet (Coinbase-custodied via MPC) for V1. Plan
  to flip to externally-owned-wallet (12-word seed, derivation path 1) for
  full self-custody before scaling capital.
- **Strategy V1**: dumbest mean-reversion rebalancing on ETH/USDC. Buy $10
  when ETH drops 2% from last action; sell $10 when it rises 2%. Total
  capital cap: $200.
- **Runtime**: TypeScript + Bun, single file for V1.
- **Interface**: CLI + log file. Web dashboard is a Week-2/3 add.
- **LLM in the loop**: Claude Opus (via Claude Max) iterates the strategy
  file in Cursor + Claude Code. No LLM in the live trade loop. Local Qwen
  reserved for parsing news/social into features later.

Why not Hyperliquid / Sui / Solana for V1: see
`research/CHAINS_AND_PROTOCOLS.md`. They're V2+ candidates.

---

## How we got here

Conversation arc over a few sessions in April 2026:

1. **Local AI stack setup.** User had a fresh M1 Max 64GB MacBook Pro after
   leaving Phantom (April 2026). Wanted "the latest and greatest" AI
   tooling. Installed Ollama 0.21.0 (with native MLX), pulled
   `qwen3-coder:30b` (~52 tok/s), Msty.app as GUI manager, LM Studio,
   Ghostty, opencode CLI, Goose CLI, Conductor + Superconductor for
   Claude Code parallelism. Persisted Ollama's perf flags
   (`OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`) via a
   custom LaunchAgent at `~/Library/LaunchAgents/com.ash.ollama.plist`.
   Full reference in `STACK.md`.

2. **Tooling triage.** Looked at and parked: emdash (YC W26 multi-agent
   orchestrator), lazypi (Pi distro), Factory (enterprise droids),
   OpenClaw (personal-life assistant via chat apps). None blocked V1.

3. **Crypto exploration.** User wanted "weird crypto stuff" + AI in
   trading. Surveyed Bittensor / Taoshi SN8 (predictive trading signals,
   $30M+ TAO emissions pool), WaterX (AI-branded Sui perps DEX),
   Aftermath Finance (Sui on-chain DEX, TS SDK), Hyperliquid (best L1
   perps API in crypto, $1B+ TVL, programmable vaults), Sui DeepBook
   (native CLOB — underexplored opportunity but underdeveloped tooling).

4. **MCP / plugin prune.** Started with 82 Claude Code plugins + 49
   Cursor MCPs. Pruned aggressively to 40 Claude Code plugins. Removed:
   serena (and chased its 7 respawn vectors — very useful learning),
   posthog, postman, sentry, stripe, imessage, discord, semgrep,
   telegram, github (replaced with `gh` CLI), aws/azure/cloudflare/
   firebase/cockroachdb plus 9 unused LSPs. Kept: helius, mongodb,
   supabase, context7, linear, notion, typescript-lsp, pyright-lsp,
   superpowers, remember, sourcegraph, plus core workflow plugins.

5. **Scope narrowing.** User initially wanted multi-chain (Base + Solana
   + Hyperliquid + Sui), AI in the trade loop, cross-DEX arbitrage. We
   collapsed that to: one chain (Base), one venue (Uniswap V3), trivial
   strategy, single TS file. Multi-chain becomes V2.

---

## Local environment state at handoff

### Hardware

- MacBook Pro, Apple M1 Max, 64GB unified memory
- Home: `/Users/ash`
- ~784GB free disk

### Ollama (canonical local model backend)

- Binary: `/opt/homebrew/bin/ollama` (Ollama 0.21.0 with native MLX)
- Server: `http://localhost:11434` (OpenAI-compatible)
- Auto-starts via `~/Library/LaunchAgents/com.ash.ollama.plist` with
  `OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0`.
- Model installed: `qwen3-coder:30b` (~18GB, 52 tok/s)
- Logs: `~/Library/Logs/ollama.{out,err}.log`
- **Do NOT** also run `brew services start ollama` — it would clash on
  port 11434 with the launchd service.

### GUI managers

- **Msty.app** — primary chat + model browser, reads Ollama's store
- **LM Studio** — installed but unused (would use its own model store
  separate from Ollama; skip unless browsing MLX-only variants)

### Coding agents

- **Claude Code** (CLI `claude`) — primary, Opus via Claude Max
- **Conductor.app v0.1.0** + **Superconductor.app v0.48.2** — Superconductor
  is the actively developed parallel-agent orchestrator
- **Cursor.app + Cline extension** (saoudrizwan.claude-dev v3.79.0)
  installed; Cline points at Ollama (or your Anthropic API key if added)
- **opencode** at `~/.opencode/bin/opencode`; config at
  `~/.config/opencode/opencode.json` (Anthropic + Ollama providers).
  Auth: `opencode auth login --provider anthropic` (interactive; not
  yet completed at handoff).
- **Goose CLI** v1.31.1 at `/opt/homebrew/bin/goose`. Config wizard:
  `goose configure`. Killer feature: Recipes (YAML workflows).
- **Goose.app** — desktop variant of same

### Terminal

- **Ghostty** at `/Applications/Ghostty.app`, CLI symlinked to
  `~/.local/bin/ghostty`

### CLI tools

- `bun` at `~/.bun/bin/bun`
- `node` v24.15.0 (via nvm)
- `gh` CLI v2.90.0 (NOT yet authenticated — run `gh auth login` when
  starting the bot repo)
- `brew`, `python3`, `ripgrep` already present

### Memory bridges

- `~/.agents/` — cross-agent memory (Codex/Claude/Cursor) with
  ACTIVE.md / LEARNINGS.md / DECISIONS.md, CLI at
  `~/.agents/bin/agent-memory`
- `~/.claude/projects/-Users-ash/memory/` — Claude-specific auto-memory
  with hardware, career, life context, project notes, AI stack
  reference, local AI playbook

### Plugin/MCP state (after prune)

- Claude Code plugins: **40** (down from 82). See
  `~/.claude/plugins/installed_plugins.json`.
- Marketplace registry: 102 plugins available
- Cursor MCPs: pruned in parallel; the per-project stub directory at
  `~/.cursor/projects/Users-ash/mcps/` still holds tool schemas for
  what's currently connected
- Backup of pre-prune `installed_plugins.json` at
  `~/.claude/plugins/installed_plugins.json.bak-*`

### Other relevant installs

- `@stripe/link-cli` 0.4.2 globally (auth pending) — for Tempo
  application research, NOT for this bot
- Tempo CLI bits in `~/.tempo/env` (sourced from `~/.zshenv`)

---

## What's explicitly NOT in V1

- ❌ Hyperliquid, Sui (DeepBook or Aftermath), Solana — all parked for V2+
- ❌ Cross-chain arbitrage — V3+
- ❌ Bittensor SN8 / Taoshi signal consumption — interesting but adds a
  paid external dependency; revisit once V1 is profitable
- ❌ Prediction-market trading (Polymarket/Kalshi) — V3+
- ❌ Self-custody wallet (12-word seed on derivation path 1) — V1 uses
  CDP managed wallet for simplicity; flip later
- ❌ Web dashboard — Week-2/3 work, not V1
- ❌ Push notifications (Telegram/Discord/Slack) — terminal + macOS
  desktop notifications are enough for V1
- ❌ LLM in the live trade loop — Claude iterates the strategy file,
  classical code executes
- ❌ Cloud deployment — runs locally on the M1 Max only until V2
- ❌ Multi-pair, multi-strategy — single ETH/USDC pair, single strategy

---

## Open architectural questions still to resolve before V2

1. When we move off CDP managed wallet, do we use the same 12-word seed
   as Phantom (different derivation path) or a fully separate seed?
2. How much of the strategy iteration loop is automated (Claude proposes
   → backtest → auto-deploy if metric improves) vs gated (Claude
   proposes → human review → manual deploy)?
3. Where does the trade log live long-term? SQLite local-only is V1.
   For V2 dashboard, Supabase (Postgres) is a likely next step.
4. Funding rate / volatility-aware strategies — these dominate any
   mean-reversion bot. Plan to add as V2 after V1 proves the plumbing.

---

## Pointer trail to start V1 build

When you're ready to write code:

```bash
cd ~/dev/trading-bot
gh auth login                                         # if not yet authed
gh repo create trading-bot --private --source=. --remote=origin
bun init -y                                           # or pnpm init
bun add @coinbase/coinbase-sdk viem zod
bun add -d typescript @types/bun
```

Architecture target is in `docs/ARCHITECTURE.md`. The first executable
should be `src/cli.ts` exposing `bot start`, `bot status`, `bot stop`.

---

## Cross-references

- User profile: `~/.claude/projects/-Users-ash/memory/user_career.md`
- Hardware: `~/.claude/projects/-Users-ash/memory/user_hardware.md`
- AI stack: `~/.claude/projects/-Users-ash/memory/reference_ai_coding_stack.md`
- Local AI playbook: `~/.claude/projects/-Users-ash/memory/reference_local_ai_playbook.md`
- Other active project: `~/dev/stablecoin-sdk/` (Tempo application anchor)

---

## A note on memory

The user's primary memory architecture is `~/.agents/` (cross-agent,
machine-local). When you make a decision or learn something durable in
this project, append via:

```bash
~/.agents/bin/agent-memory checkpoint "trading-bot: <one-liner>"
~/.agents/bin/agent-memory decision "trading-bot: <decision + why>"
~/.agents/bin/agent-memory learn "trading-bot: <lesson>"
```

That keeps Codex, Claude, and Cursor in sync next session.
