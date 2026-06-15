// POLICY §6a measurement gate as code. Reads data/trades.csv, prints the
// weekly-review header: hit rate, avg win/loss R, expectancy, and the
// capital-add scoreboard (≥10 closed trades, expectancy > +0.25R, zero
// limit breaches, ≥4 weeks elapsed).
//
// Breaches have no machine-readable source yet (they live in journal
// entries), so the count is a CLI flag: bun run stats [--breaches N].
//
// CLI: bun run stats [--breaches N] [--as-of YYYY-MM-DD]

import { readFileSync } from "node:fs";
import { parseCsvObjects } from "./csv";
import { validateTradeRow } from "./validate";

export interface TradeRow {
  trade_id: string;
  symbol: string;
  lane: string; // L1 (catalyst singles — the LLM-edge hypothesis) / L2 (mechanical gate) / ...
  entry_date: string;
  risk_usd: number;
  exit_date: string; // "" while open
  pnl_usd: number | null;
  r_multiple: number | null;
}

export function loadTrades(path: string): TradeRow[] {
  const { rows } = parseCsvObjects(readFileSync(path, "utf8"));
  return rows
    .filter((r) => r.trade_id)
    .map((r, i) => validateTradeRow(r, `trades.csv row ${i + 1}`));
}

export interface Stats {
  openCount: number;
  closedCount: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  avgWinR: number | null;
  avgLossR: number | null; // positive magnitude
  expectancyR: number | null; // win% × avgWinR − loss% × avgLossR
  weeksElapsed: number | null;
  gate: {
    trades: { ok: boolean; actual: number; need: number };
    expectancy: { ok: boolean; actual: number | null; need: number };
    breaches: { ok: boolean; actual: number; need: number };
    weeks: { ok: boolean; actual: number | null; need: number };
    eligibleForCapitalAdd: boolean;
  };
}

/** R for a closed trade: prefer the recorded r_multiple, else pnl/risk. */
function tradeR(t: TradeRow): number | null {
  if (t.r_multiple != null) return t.r_multiple;
  if (t.pnl_usd != null && t.risk_usd > 0) return t.pnl_usd / t.risk_usd;
  return null;
}

export function computeStats(trades: TradeRow[], opts: { breaches?: number; asOf?: string } = {}): Stats {
  const breaches = opts.breaches ?? 0;
  const closed = trades.filter((t) => t.exit_date !== "");
  const rs = closed.map(tradeR).filter((r): r is number => r != null);
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r <= 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const hitRate = rs.length ? wins.length / rs.length : null;
  const avgWinR = avg(wins);
  const avgLossR = losses.length ? Math.abs(avg(losses)!) : null;
  const expectancyR = rs.length
    ? (wins.length / rs.length) * (avgWinR ?? 0) - (losses.length / rs.length) * (avgLossR ?? 0)
    : null;

  const firstEntry = trades.map((t) => t.entry_date).filter(Boolean).sort()[0];
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const weeksElapsed = firstEntry
    ? Math.round(((Date.parse(asOf) - Date.parse(firstEntry)) / (7 * 86400_000)) * 10) / 10
    : null;

  const gate = {
    trades: { ok: closed.length >= 10, actual: closed.length, need: 10 },
    expectancy: { ok: expectancyR != null && expectancyR > 0.25, actual: expectancyR, need: 0.25 },
    breaches: { ok: breaches === 0, actual: breaches, need: 0 },
    weeks: { ok: weeksElapsed != null && weeksElapsed >= 4, actual: weeksElapsed, need: 4 },
    eligibleForCapitalAdd: false,
  };
  gate.eligibleForCapitalAdd = gate.trades.ok && gate.expectancy.ok && gate.breaches.ok && gate.weeks.ok;

  return {
    openCount: trades.length - closed.length,
    closedCount: closed.length,
    wins: wins.length,
    losses: losses.length,
    hitRate,
    avgWinR,
    avgLossR,
    expectancyR,
    weeksElapsed,
    gate,
  };
}

/**
 * Per-lane breakdown. Lane 1 (catalyst singles) is the actual "LLM has edge"
 * hypothesis; Lane 2 (regime gate) is mechanical and backtestable. Pooling
 * them in one expectancy number would validate or damn the wrong thing —
 * the §6a verdict must be readable per lane.
 */
export function computeLaneStats(
  trades: TradeRow[],
  opts: { breaches?: number; asOf?: string } = {},
): Map<string, Stats> {
  const lanes = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const lane = t.lane || "unknown";
    if (!lanes.has(lane)) lanes.set(lane, []);
    lanes.get(lane)!.push(t);
  }
  return new Map(
    [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([lane, ts]) => [lane, computeStats(ts, opts)]),
  );
}

export function formatStats(s: Stats): string {
  const f = (n: number | null, d = 2) => (n == null ? "n/a" : n.toFixed(d));
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  return [
    `=== Weekly review — POLICY §6a ===`,
    `Trades: ${s.closedCount} closed / ${s.openCount} open · hit rate ${s.hitRate == null ? "n/a" : `${(s.hitRate * 100).toFixed(0)}%`}`,
    `Avg win ${f(s.avgWinR)}R · avg loss ${f(s.avgLossR)}R · expectancy ${f(s.expectancyR)}R/trade`,
    `Capital-add gate: ${s.gate.eligibleForCapitalAdd ? "ELIGIBLE" : "NOT ELIGIBLE"}`,
    `  ${mark(s.gate.trades.ok)} closed trades ≥ ${s.gate.trades.need} (${s.gate.trades.actual})`,
    `  ${mark(s.gate.expectancy.ok)} expectancy > +${s.gate.expectancy.need}R (${f(s.gate.expectancy.actual)})`,
    `  ${mark(s.gate.breaches.ok)} limit breaches = 0 (${s.gate.breaches.actual})`,
    `  ${mark(s.gate.weeks.ok)} weeks elapsed ≥ ${s.gate.weeks.need} (${f(s.gate.weeks.actual, 1)})`,
  ].join("\n");
}

const TRADES_PATH = new URL("../../robinhood-agentic/data/trades.csv", import.meta.url).pathname;

if (import.meta.main) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const trades = loadTrades(TRADES_PATH);
  const opts = { breaches: Number(flag("--breaches") ?? 0), asOf: flag("--as-of") };
  console.log(formatStats(computeStats(trades, opts)));
  for (const [lane, s] of computeLaneStats(trades, opts)) {
    const f = (n: number | null) => (n == null ? "n/a" : n.toFixed(2));
    console.log(
      `  ${lane}: ${s.closedCount} closed / ${s.openCount} open · expectancy ${f(s.expectancyR)}R · ` +
        `hit ${s.hitRate == null ? "n/a" : `${(s.hitRate * 100).toFixed(0)}%`}`,
    );
  }
}
