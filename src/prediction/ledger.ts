// The prediction-market shadow ledger: one row per evaluated market. Mirrors the
// equity shadow ledger (src/trading/shadow.ts) — log what we WOULD do, resolve at
// settlement, measure. No money, no keys. summarizeLedger reduces the resolved rows
// to the one verdict that gates all downstream venue/capital/key work: does our model
// probability beat the market's price (Brier-delta < 0)? If not, the edge is dead.

import { brierDelta, brierScore, type Forecast } from "./brier";

export interface ShadowRow {
  id: string; // ledger key, e.g. "<date>-<venue>-<market>"
  venue: string; // "polymarket" (data only) | "deepbook" | "kalshi"
  market_id: string;
  question: string;
  eval_ts: string; // ISO when we snapshotted price + model_p
  market_p: number; // the market's implied P(YES) at eval time (mid)
  model_p: number; // our model's P(YES)
  status: "open" | "resolved";
  outcome: 0 | 1 | null; // realized at settlement; null while open
  settled_ts: string;
  notes: string;
}

export interface LedgerSummary {
  resolved: number;
  brierModel: number | null;
  brierMarket: number | null;
  brierDelta: number | null; // model − market; negative ⇒ our model wins
  verdict: string;
}

/** Reduce a ledger to its edge verdict over the rows that have settled. */
export function summarizeLedger(rows: ShadowRow[]): LedgerSummary {
  const resolved = rows.filter((r) => r.status === "resolved" && r.outcome != null);
  if (resolved.length === 0) {
    return { resolved: 0, brierModel: null, brierMarket: null, brierDelta: null, verdict: "no resolved markets yet — keep logging" };
  }
  const model: Forecast[] = resolved.map((r) => ({ p: r.model_p, outcome: r.outcome as 0 | 1 }));
  const market: Forecast[] = resolved.map((r) => ({ p: r.market_p, outcome: r.outcome as 0 | 1 }));
  const brierModel = brierScore(model);
  const brierMarket = brierScore(market);
  const delta = brierDelta(model, market);
  const verdict =
    delta < 0
      ? `edge PRESENT — model beats market by ${(-delta).toFixed(4)} Brier over ${resolved.length} resolved (keep sampling to confirm)`
      : `edge DEAD — market beats model by ${delta.toFixed(4)} Brier over ${resolved.length} resolved; no venue/capital work justified`;
  return { resolved: resolved.length, brierModel, brierMarket, brierDelta: delta, verdict };
}
