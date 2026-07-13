// Schema validation for the data files the hourly heartbeat appends to.
// The engine makes real-money decisions off these rows, so a blank or
// malformed field must fail LOUDLY here rather than coerce to a silent 0/NaN
// downstream — e.g. Number("") === 0 turning a real entry into $0 risk that
// passes the POLICY §2 limit checker. Plan 001.

import type { MarkRow } from "./gate";
import type { TradeRow } from "./stats";
import type { ShadowRow } from "./shadow";
import type { BookInput } from "./risk";

export interface NumberOpts {
  min?: number; // n >= min
  max?: number; // n <= max
  gt?: number; // n > gt (strict — use for risk/entry/qty that must be positive)
  allowBlank?: boolean; // "" → null instead of throwing
}

/** Parse a CSV/JSON string field into a finite number, or throw with context. */
export function validateNumber(value: string, field: string, ctx: string, opts: NumberOpts = {}): number | null {
  if (value === "" || value == null) {
    if (opts.allowBlank) return null;
    throw new Error(`${ctx}: ${field} is required but blank`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${ctx}: ${field} is not a finite number (got "${value}")`);
  if (opts.gt != null && !(n > opts.gt)) throw new Error(`${ctx}: ${field} ${n} must be > ${opts.gt}`);
  if (opts.min != null && n < opts.min) throw new Error(`${ctx}: ${field} ${n} < min ${opts.min}`);
  if (opts.max != null && n > opts.max) throw new Error(`${ctx}: ${field} ${n} > max ${opts.max}`);
  return n;
}

/** Like validateNumber but never returns null — throws on blank. */
export function requireNumber(value: string, field: string, ctx: string, opts: NumberOpts = {}): number {
  return validateNumber(value, field, ctx, { ...opts, allowBlank: false }) as number;
}

function requireField(value: string | undefined, field: string, ctx: string): string {
  if (!value) throw new Error(`${ctx}: ${field} is required but blank`);
  return value;
}

/** A field that must be EMPTY (e.g. pnl on an open trade); returns null. */
function mustBeBlank(value: string | undefined, field: string, ctx: string): null {
  if (value) throw new Error(`${ctx}: ${field} must be blank here (got "${value}")`);
  return null;
}

export function validateMarkRow(r: Record<string, string>, ctx: string): MarkRow {
  return {
    date: requireField(r.date, "date", ctx),
    qqq: requireNumber(r.qqq_close ?? "", "qqq_close", ctx, { gt: 0 }),
    vixy: requireNumber(r.vixy_close ?? "", "vixy_close", ctx, { gt: 0 }),
    // v0.5.0: direct VIX close; blank on pre-feed rows → gate falls back to VIXY-direction
    vix: validateNumber(r.vix_close ?? "", "vix_close", ctx, { allowBlank: true, gt: 0 }),
  };
}

export function validateTradeRow(r: Record<string, string>, ctx: string): TradeRow {
  const exit_date = r.exit_date ?? "";
  const closed = exit_date !== "";
  return {
    trade_id: requireField(r.trade_id, "trade_id", ctx),
    symbol: requireField(r.symbol, "symbol", ctx),
    lane: requireField(r.lane, "lane", ctx),
    entry_date: requireField(r.entry_date, "entry_date", ctx),
    risk_usd: requireNumber(r.risk_usd ?? "", "risk_usd", ctx, { gt: 0 }),
    exit_date,
    // A closed trade MUST record both pnl and R; an open one must leave them blank.
    pnl_usd: closed ? requireNumber(r.pnl_usd ?? "", "pnl_usd", ctx) : mustBeBlank(r.pnl_usd, "pnl_usd", ctx),
    r_multiple: closed ? requireNumber(r.r_multiple ?? "", "r_multiple", ctx) : mustBeBlank(r.r_multiple, "r_multiple", ctx),
  };
}

const SHADOW_STATUSES = ["filtered", "triggered_shadow", "resolved"];

export function validateShadowRow(r: Record<string, string>, ctx: string): ShadowRow {
  const status = requireField(r.status, "status", ctx);
  if (!SHADOW_STATUSES.includes(status)) {
    throw new Error(`${ctx}: status "${status}" not in {${SHADOW_STATUSES.join(",")}}`);
  }
  const entry = validateNumber(r.entry ?? "", "entry", ctx, { allowBlank: true, gt: 0 });
  const stop = validateNumber(r.stop ?? "", "stop", ctx, { allowBlank: true, gt: 0 });
  const qty = validateNumber(r.qty ?? "", "qty", ctx, { allowBlank: true, gt: 0 });
  if (status === "triggered_shadow" || status === "resolved") {
    if (entry == null || stop == null) throw new Error(`${ctx}: status ${status} requires entry and stop`);
    if (!(stop < entry)) throw new Error(`${ctx}: stop ${stop} must be < entry ${entry}`);
  }
  return {
    candidate_id: requireField(r.candidate_id, "candidate_id", ctx),
    symbol: requireField(r.symbol, "symbol", ctx),
    eval_date: requireField(r.eval_date, "eval_date", ctx),
    status,
    entry,
    stop,
    qty,
    reason_skipped: r.reason_skipped ?? "",
    exit_date: r.exit_date ?? "",
    exit_price: validateNumber(r.exit_price ?? "", "exit_price", ctx, { allowBlank: true }),
    shadow_r: validateNumber(r.shadow_r ?? "", "shadow_r", ctx, { allowBlank: true }),
    notes: r.notes ?? "",
  };
}

/**
 * Validate the parsed book.json object. Deliberately does NOT require
 * stop < entry — a profit-locked trailing stop legitimately sits above entry;
 * plan 004 surfaces that case as an informational flag instead.
 */
export function validateBook(obj: unknown): BookInput & { asOf?: string } {
  const ctx = "book.json";
  if (typeof obj !== "object" || obj == null) throw new Error(`${ctx}: not an object`);
  const b = obj as Record<string, unknown>;
  requireNumber(String(b.accountValue ?? ""), "accountValue", ctx, { min: 0 });
  requireNumber(String(b.cash ?? ""), "cash", ctx, { min: 0 });
  if (b.asOf != null && !/^\d{4}-\d{2}-\d{2}/.test(String(b.asOf))) {
    throw new Error(`${ctx}: asOf "${String(b.asOf)}" is not a YYYY-MM-DD(...) date`);
  }
  if (!Array.isArray(b.positions)) throw new Error(`${ctx}: positions must be an array`);
  b.positions.forEach((p: Record<string, unknown>, i: number) => {
    const pctx = `${ctx} position ${i} (${String(p?.symbol ?? "?")})`;
    requireField(p?.symbol as string | undefined, "symbol", pctx);
    requireNumber(String(p.qty ?? ""), "qty", pctx, { gt: 0 });
    requireNumber(String(p.entry ?? ""), "entry", pctx, { gt: 0 });
    if (p.stop != null) requireNumber(String(p.stop), "stop", pctx, { gt: 0 });
  });
  return obj as BookInput & { asOf?: string };
}
