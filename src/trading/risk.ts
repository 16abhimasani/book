// POLICY §2 as code. Pure functions — no broker calls, no I/O except the CLI.
// The point: no agent ever does sizing or limit arithmetic in its head again.
//
// CLI:
//   bun run risk -- <book.json>            full §2 limits check
//   bun run risk -- size <account> <entry> <stop>   qty precompute
//
// book.json shape: { accountValue, cash, positions: [...], candidates: [...] }
// position/candidate: { symbol, qty, entry, stop, price?, levMultiplier?, theme? }
//   price defaults to entry (candidates have no mark yet); levMultiplier
//   defaults to 1; theme groups the §2 concentration check.

import { readFileSync } from "node:fs";

export const RISK_PCT = 0.025; // max risk per position at entry
export const BOOK_RISK_PCT = 0.08; // max total open risk to stops
export const SLOT_PCT = 0.4; // max single position at entry
export const LEV_PCT = 0.5; // max combined leveraged-ETF exposure
export const BETA_GROSS_PCT = 1.5; // beta-adjusted gross exposure
export const THEME_PCT = 0.65; // single theme/catalyst concentration
export const MIN_CASH_PCT = 0.025; // min cash buffer (v0.2.1: 5% → 2.5%, owner directive 2026-06-12)
export const MAX_POSITIONS = 4;

export interface PositionInput {
  symbol: string;
  qty: number;
  entry: number;
  stop: number | null;
  price?: number; // current mark; defaults to entry
  levMultiplier?: number; // 3 for TQQQ/SOXL-class; default 1
  theme?: string; // concentration bucket; defaults to its own symbol
}

export interface BookInput {
  accountValue: number;
  cash: number; // settled cash
  positions: PositionInput[];
  candidates?: PositionInput[]; // hypothetical entries, evaluated at entry price
}

export interface Sizing {
  qty: number;
  riskPerShare: number;
  riskUsd: number; // qty * riskPerShare (post-floor)
  notional: number; // qty * entry
}

/** POLICY §2: qty = floor(account × 2.5% ÷ (entry − stop)). */
export function sizeFromRisk(accountValue: number, entry: number, stop: number): Sizing {
  if (!(accountValue > 0) || !(entry > 0) || !(stop > 0)) throw new Error("inputs must be > 0");
  if (stop >= entry) throw new Error(`stop (${stop}) must be below entry (${entry}) for a long`);
  const riskPerShare = entry - stop;
  const qty = Math.floor((accountValue * RISK_PCT) / riskPerShare);
  return {
    qty,
    riskPerShare: round2(riskPerShare),
    riskUsd: round2(qty * riskPerShare),
    notional: round2(qty * entry),
  };
}

/** R-multiple of a (closed or hypothetical) round trip. */
export function rMultiple(entry: number, stop: number, exit: number, qty = 1) {
  if (stop >= entry) throw new Error(`stop (${stop}) must be below entry (${entry}) for a long`);
  const riskUsd = (entry - stop) * qty;
  const pnlUsd = (exit - entry) * qty;
  return { r: round2(pnlUsd / riskUsd), pnlUsd: round2(pnlUsd), riskUsd: round2(riskUsd) };
}

export interface LimitCheck {
  limit: string;
  actual: string;
  bound: string;
  pass: boolean;
  detail?: string;
}

export interface LimitsReport {
  pass: boolean;
  checks: LimitCheck[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Full POLICY §2 limits check over positions + candidates.
 * Entry-basis where POLICY says "at entry" (per-position risk, slot, book
 * risk — consistent with how the journal has used the 8% figure);
 * mark-basis (price ?? entry) for exposure caps (lev, beta-gross, theme).
 * Open positions that violate an at-entry cap are reported honestly even if
 * they predate the cap — the morning agent needs to see them; the journal
 * records which are grandfathered.
 */
export function checkLimits(book: BookInput): LimitsReport {
  const acct = book.accountValue;
  if (!(acct > 0)) throw new Error("accountValue must be > 0");
  const candidates = book.candidates ?? [];
  const all = [...book.positions, ...candidates];
  const checks: LimitCheck[] = [];

  const mark = (p: PositionInput) => (p.price ?? p.entry) * p.qty;
  const entryNotional = (p: PositionInput) => p.entry * p.qty;
  const entryRisk = (p: PositionInput) =>
    p.stop == null ? null : Math.max(0, (p.entry - p.stop) * p.qty);

  // 1. max concurrent positions
  checks.push({
    limit: `max ${MAX_POSITIONS} concurrent positions`,
    actual: String(all.length),
    bound: `≤ ${MAX_POSITIONS}`,
    pass: all.length <= MAX_POSITIONS,
  });

  // 2. per-position risk at entry ≤ 2.5% (and every position must have a stop)
  const noStop = all.filter((p) => p.stop == null).map((p) => p.symbol);
  const over = all.filter((p) => {
    const r = entryRisk(p);
    return r != null && r > acct * RISK_PCT + 1e-9;
  });
  checks.push({
    limit: `risk/position at entry ≤ ${pct(RISK_PCT)}`,
    actual:
      over.length || noStop.length
        ? [...noStop.map((s) => `${s}: NO STOP`), ...over.map((p) => `${p.symbol}: $${round2(entryRisk(p)!)} (${pct(entryRisk(p)! / acct)})`)].join("; ")
        : "all within budget",
    bound: `≤ $${round2(acct * RISK_PCT)}`,
    pass: over.length === 0 && noStop.length === 0,
    detail: over.length ? "at-entry rule; pre-v0.2 entries may be grandfathered — see journal" : undefined,
  });

  // 3. total open risk to stops ≤ 8%
  const bookRisk = all.reduce((s, p) => s + (entryRisk(p) ?? 0), 0);
  checks.push({
    limit: `book risk to stops ≤ ${pct(BOOK_RISK_PCT)}`,
    actual: `$${round2(bookRisk)} (${pct(bookRisk / acct)})`,
    bound: `≤ $${round2(acct * BOOK_RISK_PCT)}`,
    pass: bookRisk <= acct * BOOK_RISK_PCT + 1e-9,
  });

  // 4. single-position slot ≤ 40% at entry
  const bigSlots = all.filter((p) => entryNotional(p) > acct * SLOT_PCT + 1e-9);
  checks.push({
    limit: `position slot at entry ≤ ${pct(SLOT_PCT)}`,
    actual: bigSlots.length
      ? bigSlots.map((p) => `${p.symbol}: ${pct(entryNotional(p) / acct)}`).join("; ")
      : "all within slot",
    bound: `≤ $${round2(acct * SLOT_PCT)}`,
    pass: bigSlots.length === 0,
  });

  // 5. combined leveraged-ETF exposure ≤ 50% (mark basis)
  const levExposure = all.filter((p) => (p.levMultiplier ?? 1) > 1).reduce((s, p) => s + mark(p), 0);
  checks.push({
    limit: `leveraged-ETF exposure ≤ ${pct(LEV_PCT)}`,
    actual: `$${round2(levExposure)} (${pct(levExposure / acct)})`,
    bound: `≤ $${round2(acct * LEV_PCT)}`,
    pass: levExposure <= acct * LEV_PCT + 1e-9,
  });

  // 6. beta-adjusted gross ≤ 150% (mark × multiplier)
  const betaGross = all.reduce((s, p) => s + mark(p) * (p.levMultiplier ?? 1), 0);
  checks.push({
    limit: `beta-adjusted gross ≤ ${pct(BETA_GROSS_PCT)}`,
    actual: `$${round2(betaGross)} (${pct(betaGross / acct)})`,
    bound: `≤ $${round2(acct * BETA_GROSS_PCT)}`,
    pass: betaGross <= acct * BETA_GROSS_PCT + 1e-9,
  });

  // 7. theme concentration ≤ 65% (mark basis, lev at notional)
  const themes = new Map<string, number>();
  for (const p of all) {
    const t = p.theme ?? p.symbol;
    themes.set(t, (themes.get(t) ?? 0) + mark(p));
  }
  const hotThemes = [...themes.entries()].filter(([, v]) => v > acct * THEME_PCT + 1e-9);
  checks.push({
    limit: `theme concentration ≤ ${pct(THEME_PCT)}`,
    actual: hotThemes.length
      ? hotThemes.map(([t, v]) => `${t}: ${pct(v / acct)}`).join("; ")
      : [...themes.entries()].map(([t, v]) => `${t}: ${pct(v / acct)}`).join("; "),
    bound: `≤ $${round2(acct * THEME_PCT)}`,
    pass: hotThemes.length === 0,
  });

  // 8. settled funds + min cash buffer after candidate entries
  const candidateCost = candidates.reduce((s, p) => s + entryNotional(p), 0);
  const cashAfter = book.cash - candidateCost;
  if (candidates.length > 0) {
    checks.push({
      limit: "settled funds only",
      actual: `cost $${round2(candidateCost)} vs settled cash $${round2(book.cash)}`,
      bound: `≤ $${round2(book.cash)}`,
      pass: candidateCost <= book.cash + 1e-9,
    });
  }
  checks.push({
    limit: `cash buffer ≥ ${pct(MIN_CASH_PCT)}`,
    actual: `$${round2(cashAfter)} (${pct(cashAfter / acct)})`,
    bound: `≥ $${round2(acct * MIN_CASH_PCT)}`,
    pass: cashAfter >= acct * MIN_CASH_PCT - 1e-9,
  });

  return { pass: checks.every((c) => c.pass), checks };
}

export function formatReport(report: LimitsReport): string {
  const lines = report.checks.map(
    (c) =>
      `  ${c.pass ? "PASS" : "FAIL"}  ${c.limit}\n        actual: ${c.actual}   bound: ${c.bound}${c.detail ? `\n        note: ${c.detail}` : ""}`,
  );
  return `POLICY §2 limits: ${report.pass ? "ALL PASS" : "VIOLATIONS PRESENT"}\n${lines.join("\n")}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args[0] === "size") {
    const [account, entry, stop] = args.slice(1).map(Number);
    if (!account || !entry || !stop) {
      console.error("usage: bun run risk -- size <account> <entry> <stop>");
      process.exit(1);
    }
    const s = sizeFromRisk(account!, entry!, stop!);
    console.log(
      `qty ${s.qty} @ ${entry} (stop ${stop}) → risk $${s.riskUsd} (${((s.riskUsd / account!) * 100).toFixed(2)}%), notional $${s.notional}`,
    );
    process.exit(0);
  }
  const path = args[0];
  if (!path) {
    console.error("usage: bun run risk -- <book.json>  |  bun run risk -- size <account> <entry> <stop>");
    process.exit(1);
  }
  const book = JSON.parse(readFileSync(path, "utf8")) as BookInput;
  const report = checkLimits(book);
  console.log(formatReport(report));
  process.exit(report.pass ? 0 : 3);
}
