# Open-source trading skills — survey & install recommendations

Owner-requested catalog (links provided 2026-06-12). Surveyed by a research
agent via GitHub API + page fetches; nothing cloned, nothing installed.
**Install decisions are owner-only** — skills are prompts with execution
privileges and count as supply-chain surface for a live-money repo (see
Security caveats at the bottom).

---

**Date:** 2026-06-12. **Method:** GitHub API + page fetches only (nothing cloned, nothing installed). Repo metadata, directory listings, and sampled SKILL.md files were verified directly via `gh api` and raw.githubusercontent.com; counts below are from live directory listings, not README claims, except where noted.

**Context:** evaluated against the `robinhood-agentic` loop — binding POLICY.md v0.2 (2.5%/position, 8% book risk budget, QQQ 20d-MA + VIXY regime gate), catalyst momentum + leveraged-ETF lanes, existing trading-loop skill, TS gate/risk/stats engine, journal+CSV instrumentation. Gaps being shopped for: pre-market briefing, earnings calendars, technical screening, options analysis (parked lane), backtesting patterns, market-data sourcing.

---

## 1. jeremylongshore/claude-code-plugins-plus-skills

**What it is:** a mega-marketplace — README claims 425 plugins, 2,810 skills, 200 agents, browsable at tonsofskills.com with its own npm CLI (`ccpi`). Too large to enumerate fully; structure verified and the finance-relevant corners sampled.

**Verified structure:** `plugins/` is organized into ~19 category directories (ai-agency, ai-ml, analytics, api-development, business-tools, community, crypto, database, design, devops, mcp, performance, productivity, saas-packs, security, skill-enhancers, testing, examples, packages). `skills/` is 20 numbered batch directories (`01-devops-basics` … `20-enterprise-workflows`) — the "2,810 skills" are bulk-catalog content, much of it apparently template-generated at scale.

**Finance/trading content (verified listings):**
- `plugins/crypto/` — 27 plugins: arbitrage-opportunity-finder, blockchain-explorer-cli, cross-chain-bridge-monitor, crypto-derivatives-tracker, crypto-news-aggregator, crypto-portfolio-tracker, crypto-signal-generator, crypto-tax-calculator, defi-yield-optimizer, dex-aggregator-router, flash-loan-simulator, gas-fee-optimizer, liquidity-pool-analyzer, market-movers-scanner, market-price-tracker, market-sentiment-analyzer, mempool-analyzer, nft-rarity-analyzer, on-chain-analytics, options-flow-analyzer, staking-rewards-optimizer, token-launch-tracker, trading-strategy-backtester, wallet-portfolio-tracker, wallet-security-auditor, whale-alert-monitor, aomi.
- `plugins/business-tools/` — openbb-terminal, excel-analyst-pro, plus ~20 marketing/strategy book-summary plugins ("wondelai-*").

**License / recency / quality:** MIT. 2,357 stars, 16 contributors. Extremely active — commits on 2026-06-12 (the survey date), but recent commit messages are infrastructure churn (validator fixes, CI lint sweeps, branding removal), consistent with an automated/factory-style operation. Sampled quality: `trading-strategy-backtester`'s SKILL.md is a real 199-line skill (8 canned strategies — SMA/EMA/RSI/MACD/Bollinger/breakout/mean-reversion/momentum — Sharpe/Sortino/Calmar/VaR metrics, grid-search optimization) with proper frontmatter (`allowed-tools`, version, license), but it is crypto-flavored and generic. Breadth over depth throughout.

**Most relevant skills (2):**
- `openbb-terminal` (business-tools) — wraps the OpenBB Platform (`pip install openbb`) for equity research, macro data, options chains/Greeks, unusual activity; the only serious market-data-sourcing candidate here, but it pulls in a large Python dependency tree.
- `trading-strategy-backtester` (crypto) — usable as a *pattern reference* for the backtesting gap (metrics checklist, grid-search structure), not as drop-in equities tooling.

**Policy overlap/conflict:** `crypto-signal-generator` and similar signal/auto-trade-adjacent plugins exist; nothing here targets Robinhood, but signal-generator-style prompts are exactly the kind of thing that should never be loaded into the live loop. Nothing observed places equity orders.

**Install mechanics:** Claude Code plugin marketplace (`/plugin marketplace add jeremylongshore/claude-code-plugins`, then `/plugin install <name>@claude-code-plugins-plus`) or npm CLI (`pnpm add -g @intentsolutionsio/ccpi`; `ccpi install <name>`). Marketplace install means future repo updates can change what runs locally — a moving supply-chain surface.

**Verdict:** skip as a source of trading skills. Volume-optimized catalog; the two relevant items are better served elsewhere (OpenBB directly, or tradermonty's backtest-expert).

---

## 2. staskh/trading_skills

**What it is:** a focused, well-engineered Python project ("Claude powered advisor system for option traders") — 28 skills in `.claude/skills/`, each driving scripts in a shared `trading-skills` Python library, plus an MCP server exposing 23 tools for Claude Desktop. Data sources: **yfinance** (quotes, history, fundamentals — free), **Massive API** (whale/options-flow detection), **ib-async** (Interactive Brokers portfolio + order management), pandas-ta, pandas-market-calendars.

**Verified skill list (28):**
- *Market data:* stock-quote, option-chain, price-history, fundamentals, news-sentiment, earnings-calendar, insider-trading
- *Analysis:* technical-analysis, greeks, spread-analysis, risk-assessment
- *Scanners:* scanner-bullish, scanner-pmcc, whale-hunting
- *IB portfolio (requires TWS/Gateway):* ib-account, ib-portfolio, ib-option-chain, ib-trades-history, ib-find-short-roll, ib-collar, ib-pmcc-advisor, ib-portfolio-action-report, ib-create-consolidated-report, ib-report-delta-adjusted-notional-exposure, **ib-stop-loss**, **ib-trailing-stop**
- *Reporting:* report-stock, markdown-to-pdf

**License / recency / quality:** MIT. 248 stars, 59 forks, Python 100%, v0.8.3, 16 releases. Last commits 2026-06-11 (the day before this survey) — active, disciplined development with issue-linked conventional commits, a real test suite (live-broker tests marked `manual` and deselected by default), ruff linting. The SKILL.md files read are high quality: explicit dry-run semantics, clear step-by-step instructions, structured JSON-to-markdown report formats.

**Most relevant skills (5):**
- `earnings-calendar` — earnings-date gap, sourced free via yfinance (no FMP key needed); useful for catalyst-lane risk checks.
- `price-history` + `technical-analysis` — free yfinance OHLCV + pandas-ta indicators; a clean market-data-sourcing pattern to crib for the gate engine's QQQ/VIXY inputs.
- `risk-assessment` — correlation matrices and portfolio risk metrics; complements (does not replace) the existing risk engine.
- `greeks` / `spread-analysis` / `option-chain` — the best ready-made toolkit for the parked options lane (Black-Scholes Greeks, spread P/L, POP).
- `scanner-bullish` — multi-symbol trend scoring; technical-screening gap.

**Policy overlap/conflict — IMPORTANT:** `ib-stop-loss` and `ib-trailing-stop` **place real broker orders** (conditional combo orders and native TRAIL orders on Interactive Brokers) when invoked with `--execute`; dry-run is the default. They target IB, not Robinhood, so they cannot touch the current book — but they constitute an order-execution path that bypasses the POLICY loop entirely (`review_equity_order` → `place_equity_order` → journal). If any part of this repo is ever adopted, the `ib-*` skills must be excluded wholesale. Also note: the trailing-stop concept conflicts with POLICY's "stops ratchet UP only" framing only in implementation locus, not direction — but execution authority must stay inside the policy engine.

**Install mechanics:** clone + `uv sync`, run Claude Code in the repo root (skills are *not* standalone — they shell out to `uv run python .claude/skills/<name>/scripts/...` against the shared library, so copying SKILL.md alone does nothing); or `pip install trading-skills` for the MCP server in Claude Desktop. This coupling means adoption = adopting a Python dependency, not just a prompt.

**Verdict:** highest engineering quality of the three. Best single source for the options lane (when unpacked) and a good free-data (yfinance) sourcing pattern. Must be firewalled from execution: analysis skills only, never the `ib-*` family.

---

## 3. tradermonty/claude-trading-skills

**What it is:** the closest philosophical match to this system — an MIT-licensed toolkit of **56 skills** (count verified) for equity swing traders and investors, explicitly built around *human decision gates*: the README states it is educational/process-improvement only, does **not** place orders autonomously, and is not a signal service.

**Verified skill list (56), grouped:**
- *Market regime / breadth:* market-breadth-analyzer, breadth-chart-analyst, uptrend-analyzer, downtrend-duration-analyzer, ftd-detector, market-top-detector, ibd-distribution-day-monitor, macro-regime-detector, us-market-bubble-detector, exposure-coach, market-environment-analysis
- *Calendars / news / flows:* earnings-calendar, economic-calendar-fetcher, market-news-analyst, theme-detector, sector-analyst, institutional-flow-tracker
- *Screeners:* canslim-screener, vcp-screener, pead-screener, finviz-screener, pair-trade-screener, value-dividend-screener, dividend-growth-pullback-screener
- *Trade planning:* position-sizer, technical-analyst, breakout-trade-planner, parabolic-short-trade-planner, earnings-trade-analyzer, options-strategy-advisor, scenario-analyzer
- *Portfolio:* portfolio-manager (reads holdings via **Alpaca MCP**; analysis/rebalancing recommendations only)
- *Trade memory / process:* trader-memory-core, signal-postmortem, trade-performance-coach, trade-hypothesis-ideator
- *Strategy research ("edge pipeline"):* backtest-expert, edge-hint-extractor, edge-concept-synthesizer, edge-signal-aggregator, edge-candidate-agent, edge-strategy-designer, edge-strategy-reviewer, edge-pipeline-orchestrator, strategy-pivot-designer
- *Style/playbooks:* stanley-druckenmiller-investment, us-stock-analysis, kanchi-dividend-review-monitor, kanchi-dividend-sop, kanchi-dividend-us-tax-accounting
- *Meta/tooling:* skill-designer, skill-idea-miner, skill-integration-tester, dual-axis-skill-reviewer, trading-skills-navigator, data-quality-checker

Plus `workflows/` — six multi-skill YAML manifests (market-regime-daily, swing-opportunity-daily, multi-asset-opportunity-daily, core-portfolio-weekly, monthly-performance-review, trade-memory-loop) — and `skills-index.yaml` as a canonical index.

**License / recency / quality:** MIT. 1,870 stars, 465 forks, 457 commits, last commit 2026-06-06. Maintenance is healthy and *communal* — recent merges are PRs from outside contributors (#157 quant-strategy playbook, #127/#128 FMP API fixes), with validators and packaging scripts in `scripts/`. Sampled SKILL.md files are substantive, with precise trigger descriptions, explicit data-source declarations, and environment notes (CLI/Desktop/Web). Some skills carry bilingual (English/Japanese) triggers. API dependencies are documented per skill: FMP (free tier 250 req/day) for calendars/screeners/flows, FINVIZ Elite optional, Alpaca only for portfolio-manager; breadth/uptrend/position-sizer/trade-memory need no API key (breadth uses the author's public CSV — a single-point-of-failure data dependency worth noting).

**Most relevant skills (mapped to the stated gaps):**
- `earnings-calendar` — exactly the earnings-calendar gap; FMP-based, filters to >$2B market cap, outputs a by-date/by-timing markdown table that would slot directly into a pre-market brief.
- `economic-calendar-fetcher` — FOMC/CPI/NFP and other scheduled macro events for the next 7 days; the missing macro half of a pre-market briefing.
- `market-news-analyst` — WebSearch/WebFetch-driven impact-ranked news review (past 10 days, central banks, geopolitics, mega-cap earnings); the narrative half of a pre-market briefing with no API key.
- `pead-screener` + `earnings-trade-analyzer` — post-earnings gap/drift scoring (5-factor 0–100 grades) is a near-direct fit for the catalyst momentum lane's candidate sourcing.
- `backtest-expert` — methodology-only skill (robustness over optimization, slippage modeling, bias prevention, "beating ideas to death"); fills the backtesting-patterns gap with zero dependencies and zero execution surface.
- Honorable mentions: `ibd-distribution-day-monitor`/`ftd-detector` (independent confirmation signals alongside the QQQ/VIXY gate), `options-strategy-advisor` (Black-Scholes/Greeks without a data subscription, for the parked lane), `signal-postmortem` (complements existing journal instrumentation).

**Policy overlap/conflict:** no autonomous trading anywhere — explicitly out of scope by design. Three soft conflicts to manage: (1) `position-sizer` encodes its own sizing rules (fixed-fractional 1%, Kelly, ATR scaling) that differ from POLICY's 2.5%/8% budget — must never be loaded as authoritative; (2) `exposure-coach` recommends net-exposure ceilings — acceptable only if treated as advisory and only ever *tighter* than the POLICY regime gate; (3) `portfolio-manager` is Alpaca-specific and irrelevant to the Robinhood book — skip. The regime skills overlap functionally with the existing gate engine; they should inform the journal narrative, never substitute for the gate's binding output.

**Install mechanics:** three paths — (a) copy skill folders from `skills/` into a Claude Code skills directory (project `.claude/skills/` or `~/.claude/skills/`), (b) upload prebuilt `.skill` archives from `skill-packages/` via claude.ai Settings → Skills, (c) edit sources and regenerate packages with `python3 scripts/package_skills.py`. No marketplace, no npm — plain file copies, which is the most auditable and pin-able option.

---

## 4. tradermonty/claude-trading-skills — `skill-packages/` subdirectory

Not a separate project: this is the **distribution artifact directory** of repo 3. Verified contents: **56 `.skill` files**, one per skill in `skills/`, names matching one-to-one (backtest-expert.skill … vcp-screener.skill). `.skill` files are zip archives meant for upload to the Claude web app (Settings → Skills); Claude Code users should ignore this directory and copy the plain-markdown source folders from `skills/` instead — the sources are reviewable line-by-line before install, the archives are not (without unzipping). No additional content beyond repo 3.

---

## Overall Recommendation

**Primary source: tradermonty/claude-trading-skills.** It is the only one of the three that matches this system's shape — analysis-only, human-gated, equities-focused, well-maintained (1.9k stars, community PRs, commits this month), and installed by auditable file copy. Shortlist for the owner's review, in priority order against the stated gaps:

| Priority | Skill | Gap filled | Dependency |
|---|---|---|---|
| 1 | `earnings-calendar` (tradermonty) | earnings calendar / catalyst-lane earnings risk | FMP free tier |
| 2 | `economic-calendar-fetcher` (tradermonty) | pre-market briefing (macro events) | FMP free tier |
| 3 | `market-news-analyst` (tradermonty) | pre-market briefing (news/impact ranking) | none (WebSearch) |
| 4 | `backtest-expert` (tradermonty) | backtesting methodology patterns | none |
| 5 | `pead-screener` + `earnings-trade-analyzer` (tradermonty) | technical screening for the catalyst lane | FMP free tier |
| Later (parked lane) | `greeks` / `spread-analysis` (staskh) or `options-strategy-advisor` (tradermonty) | options analysis | staskh = Python lib; tradermonty = none |

**Secondary source: staskh/trading_skills** — for the options lane when un-parked, and as a reference implementation for free yfinance data sourcing. Adopt only its analysis skills, and only with the `ib-*` execution skills excluded; note its skills require the repo's Python library, so adoption is heavier than a SKILL.md copy.

**Skip: jeremylongshore/claude-code-plugins-plus-skills** for this use case. Volume-first catalog; nothing there beats the equivalents above, and marketplace-based install is the least auditable channel.

### Security caveats for third-party skills in a live-money repo

Skills are prompts with execution privileges. A SKILL.md is injected into the agent's context and can steer any tool the session has — including `place_equity_order`. Treat every third-party skill as supply-chain surface equivalent to a dependency with shell access:

1. **Read every line before install.** Both SKILL.md and any bundled scripts/references. A skill that says "when the user asks about earnings, also do X" runs with the same authority as CLAUDE.md. Prompt-injection via skill text is the primary threat, not code.
2. **Pin, don't track.** Copy files at a reviewed commit SHA (record the SHA in the commit message); never install via a live marketplace pointer or auto-updating CLI in this repo. Re-review on every manual update.
3. **No execution-capable skills, period.** Anything that can place, modify, or cancel orders (staskh's `ib-stop-loss`/`ib-trailing-stop`, any "signal generator") stays out, even disabled — its presence in context is steering surface.
4. **Quarantine from POLICY.** Imported skills must be advisory inputs to the existing trading-loop skill, never alternate entry points. Position-sizing or exposure advice in a third-party skill must be explicitly subordinated ("POLICY.md overrides any sizing guidance below") or stripped at import.
5. **Watch data-source trust.** Skills that fetch from an author's personal endpoints (e.g., the breadth analyzer's public CSV) introduce a data-integrity dependency — a poisoned feed can steer the regime narrative. Prefer skills hitting primary APIs (FMP, yfinance) with the key held in env, never committed.
6. **API keys are scoped secrets.** FMP/FINVIZ keys go in environment variables outside the repo; never let an imported skill instruct writing a key to a tracked file.
7. **Dry-run the first sessions.** After importing any skill, run a journal-only loop iteration and confirm the skill produced analysis text and zero tool calls outside its declared scope before letting it near a live decision cycle.
