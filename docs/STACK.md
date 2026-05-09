# Local Stack Reference

Everything installed on this Mac that's relevant to building the bot.
Last verified: 2026-04-21.

---

## Hardware

- MacBook Pro, Apple M1 Max, 64GB unified memory
- ~784GB free disk
- macOS Tahoe (Darwin 25.4.0)

---

## Local AI runtime

### Ollama 0.21.0 (with native MLX)

- Binary: `/opt/homebrew/bin/ollama`
- Server: `http://localhost:11434` (OpenAI-compatible)
- Models installed:
  - `qwen3-coder:30b` (~18GB, 52 tok/s)
- Auto-start: launchd via `~/Library/LaunchAgents/com.ash.ollama.plist`
  with perf flags `OLLAMA_FLASH_ATTENTION=1` and
  `OLLAMA_KV_CACHE_TYPE=q8_0`
- Logs: `~/Library/Logs/ollama.{out,err}.log`

Control:

```bash
launchctl print  gui/$(id -u)/com.ash.ollama | head     # status
launchctl bootout gui/$(id -u)/com.ash.ollama           # stop
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ash.ollama.plist  # start
launchctl kickstart -k gui/$(id -u)/com.ash.ollama      # restart
tail -f ~/Library/Logs/ollama.err.log                   # tail logs
```

⚠️ Don't run `brew services start ollama` — it would clash on :11434.

### Models worth pulling later for trading-bot work

| Model | Size | Use |
|---|---|---|
| `qwen3:30b` (general) | ~18GB | Strategy reasoning, news parsing |
| `deepseek-r1:14b` | ~9GB | Reasoning traces, nightly PnL review |
| `qwen3:8b` | ~5GB | Fast signal parsing (~120 tok/s) |
| `llama3.3:70b` Q4 | ~40GB | Slow async deep reasoning |

Two 30B-class models loaded simultaneously fits in 64GB. Skip the 70B
unless you hit a reasoning ceiling.

### Local-AI GUIs

- **Msty.app** — primary chat + model browser, reads Ollama's store
  directly (no separate cache)
- **LM Studio** 0.4.12 — installed but unused. Has its own model
  cache; don't pull models there unless you're specifically browsing
  MLX-only variants

---

## Coding agents (in priority order)

1. **Claude Code** CLI (`claude`) — Opus 4.x via Claude Max. Primary.
2. **Cursor.app + Cline** (saoudrizwan.claude-dev v3.79.0) — editor
   plus inline AI. Cline points at Ollama by default; add Anthropic
   API key if you want Claude inside Cursor.
3. **Conductor.app v0.1.0** + **Superconductor.app v0.48.2** — parallel
   Claude Code agents, each in its own git worktree. Superconductor is
   the actively developed one; Conductor looks abandoned.
4. **opencode** — `~/.opencode/bin/opencode`. Config at
   `~/.config/opencode/opencode.json` (Anthropic + Ollama providers).
   Auth: `opencode auth login --provider anthropic` (interactive).
5. **Goose** CLI v1.31.1 (`/opt/homebrew/bin/goose`) + **Goose.app**.
   Config: `goose configure`. Recipes are the killer feature.

---

## Terminal + dev tools

- **Ghostty** 1.3.1 — primary terminal (fast, GPU-accelerated). CLI
  symlinked to `~/.local/bin/ghostty`.
- `bun` at `~/.bun/bin/bun` — runtime + package manager
- `node` v24.15.0 via nvm
- `gh` CLI v2.90.0 — **needs auth** before first use:
  `gh auth login`
- `brew`, `python3`, `ripgrep` already present

---

## Memory architecture

Two layered systems:

### `~/.agents/` (cross-agent, canonical)

Plain Markdown that Codex / Claude / Cursor all read.

- `~/.agents/AGENTS.md` — global rules
- `~/.agents/memory/ACTIVE.md` — current handoff
- `~/.agents/memory/LEARNINGS.md` — durable lessons
- `~/.agents/memory/DECISIONS.md` — explicit choices
- `~/.agents/memory/INDEX.md` — navigational
- `~/.agents/projects/<name>.md` — per-project notes
- `~/.agents/bin/agent-memory` — CLI:
  - `status` — print ACTIVE + INDEX
  - `checkpoint "..."` — append a dated handoff
  - `learn "..."` — append a durable lesson
  - `decision "..."` — append a decision

Hooks: Claude Code SessionStart hook injects ACTIVE+INDEX+recent
LEARNINGS/DECISIONS into every session. Stop hook nudges if ACTIVE.md
is >30 minutes stale.

### `~/.claude/projects/-Users-ash/memory/` (Claude-specific)

Auto-memory that persists across Claude Code sessions for this user.

- `MEMORY.md` — index
- `user_hardware.md`, `user_career.md`, `user_context.md`
- `project_stablecoin_sdk.md` — separate project (Tempo anchor)
- `reference_ai_coding_stack.md`, `reference_local_ai_playbook.md`,
  `reference_project_docs.md`
- `feedback_local_ai_priority.md` — Claude Max stays primary, local
  AI is insurance

---

## Plugin / MCP state

- Claude Code plugins: 40 (down from 82 after pruning)
- Marketplace catalog: 102 plugins available
- Backup of pre-prune state: `~/.claude/plugins/installed_plugins.json.bak-*`

### Currently installed Claude Code plugins (the ones that survived)

Core workflow / general utility:
- `superpowers`, `remember`, `claude-md-management`, `claude-code-setup`
- `commit-commands`, `code-review`, `code-simplifier`, `pr-review-toolkit`
- `feature-dev`, `skill-creator`, `plugin-dev`, `frontend-design`
- `playground`, `microsoft-docs`, `huggingface-skills`, `session-report`
- `explanatory-output-style`, `learning-output-style`
- `chrome-devtools-mcp`, `playwright`, `security-guidance`, `hookify`
- `coderabbit`, `agent-sdk-dev`, `atomic-agents`, `mcp-server-dev`

LSPs (kept):
- `typescript-lsp`, `pyright-lsp`, `rust-analyzer-lsp`

Crypto / data / docs (kept):
- `helius`, `mongodb`, `supabase`, `context7`, `linear`, `notion`
- `sourcegraph`, `figma`, `vercel`, `slack`, `atlassian`

### What was pruned (and why)

- **serena** — semantic code MCP; useful for large TS codebases but
  the bot will be tiny. Reinstall when needed.
- **posthog, sentry, postman, stripe** — relevant only when there's a
  deployed product; install before V2 launch.
- **imessage, discord, telegram** — not using push channels in V1.
- **github** — replaced with `gh` CLI.
- **semgrep** — security scanning; no codebase to scan yet.
- **AWS, Azure, Cloudflare, Firebase, Cockroach** — not used.
- **9 LSPs** for languages not in the stack (clangd, csharp, gopls,
  jdtls, kotlin, lua, php, ruby, swift).

To reinstall any: `claude plugin install <name>` (or whatever current
syntax is — see `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json`).

---

## Other globally-installed CLIs worth knowing about

- `@stripe/link-cli` 0.4.2 — for Tempo application research, NOT for
  this bot. Auth pending. Config at
  `~/Library/Preferences/link-cli-nodejs/config.json`.
- Tempo CLI bits sourced via `~/.zshenv` from `~/.tempo/env`.

---

## What's deliberately NOT installed

- Aider, Cline-as-CLI, Cursor's own CLI — opencode + Claude Code +
  Goose cover the same ground; more terminal agents = noise.
- LazyPi (Pi distro), emdash (multi-agent orchestrator), Factory.app,
  OpenClaw — bookmarked, not installed.
- HuggingFace direct downloads to disk — Ollama is the canonical model
  store.
