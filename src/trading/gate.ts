// Lane-2 regime gate, computed from robinhood-agentic/data/marks.csv.
// POLICY §3 Lane 2 + §4 (v0.5.0, owner ratified 2026-07-13): gate ON ⟺ QQQ
// close > 20-session MA AND the vol leg is quiet. The vol leg scores the
// PRIMARY spec — direct VIX close < 25 (marks.csv `vix_close`, from the MCP
// index feed) — whenever the row carries a VIX value; dates without one fall
// back to the VIXY-direction proxy (VIXY close strictly below prior session
// close — POLICY says "below", so a flat VIXY day reads OFF). VIXY is
// direction-only in the fallback; its absolute level is never compared to 25
// (decaying ETP, POLICY §4).
//
// CLI: bun run gate [YYYY-MM-DD]
// With no date, uses the latest row in marks.csv — which is the correct
// semantic for a pre-market run: the gate for today's open is computed at
// yesterday's close.

import { readFileSync } from "node:fs";
import { parseCsvObjects } from "./csv";
import { validateMarkRow } from "./validate";

// POLICY Lane 2 "VIX < 25" — gate.test.ts couples this to the prose.
export const VIX_MAX = 25;

export interface MarkRow {
  date: string;
  qqq: number;
  vixy: number;
  vix?: number | null; // direct VIX close (v0.5.0); null/absent = pre-feed row → VIXY fallback
}

export interface GateOptions {
  maLen?: number; // default 20
  // default "auto" (POLICY v0.5.0): direct VIX < 25 when the row has vix_close,
  // else VIXY-direction. Explicit modes force one leg (research/backtests).
  volLeg?: "auto" | "vix-level" | "vixy-direction" | "vixy-5d-avg" | "none";
  // research-only until ratified (PROPOSAL B2): raw state must persist this
  // many consecutive closes before the effective gate flips. 1 = POLICY today.
  confirmDays?: number;
  // research-only: "entries-only" confirms OFF→ON flips (re-entries) but acts
  // on ON→OFF flips (exits) immediately — keeps the churn reduction without
  // delaying risk-off. Default "both" (symmetric, matches confirmDays alone).
  confirmDirection?: "both" | "entries-only";
}

export type GateResult =
  | {
      status: "ok";
      asOf: string; // session whose close the gate is computed from
      gate: "ON" | "OFF";
      qqqClose: number;
      ma: number;
      maLen: number;
      maLeg: boolean; // QQQ close > MA
      vixyClose: number;
      vixyPrior: number;
      vixClose: number | null; // direct VIX close when the row has one
      volLegSource: "vix-level" | "vixy-direction" | "vixy-5d-avg" | "none";
      volLegPass: boolean;
    }
  | { status: "insufficient-data"; asOf: string | null; have: number; need: number };

export function loadMarks(path: string): MarkRow[] {
  const { rows } = parseCsvObjects(readFileSync(path, "utf8"));
  return rows
    .filter((r) => r.date) // drop fully-blank trailing rows; a date with blank closes now throws
    .map((r, i) => validateMarkRow(r, `marks.csv row ${i + 1}`))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeGate(
  rows: MarkRow[],
  asOfDate?: string,
  opts: GateOptions = {},
): GateResult {
  const maLen = opts.maLen ?? 20;
  const volLeg = opts.volLeg ?? "auto";
  // latest session at or before asOfDate (rows are sorted ascending)
  let i = rows.length - 1;
  if (asOfDate !== undefined) {
    while (i >= 0 && rows[i]!.date > asOfDate) i--;
  }
  const have = i + 1;
  const need = Math.max(maLen, 2); // MA window + a prior row for VIXY direction
  if (i < 0 || have < need) {
    return { status: "insufficient-data", asOf: i >= 0 ? rows[i]!.date : null, have, need };
  }
  let sum = 0;
  for (let k = i - maLen + 1; k <= i; k++) sum += rows[k]!.qqq;
  const ma = sum / maLen;
  const qqqClose = rows[i]!.qqq;
  const maLeg = qqqClose > ma;
  const vixyClose = rows[i]!.vixy;
  const vixyPrior = rows[i - 1]!.vixy;
  const vixClose = rows[i]!.vix ?? null;
  let volLegPass: boolean;
  let volLegSource: "vix-level" | "vixy-direction" | "vixy-5d-avg" | "none";
  if (volLeg === "none") {
    volLegPass = true;
    volLegSource = "none";
  } else if (volLeg === "vixy-5d-avg") {
    const n = Math.min(5, i + 1);
    let vSum = 0;
    for (let k = i - n + 1; k <= i; k++) vSum += rows[k]!.vixy;
    volLegPass = vixyClose < vSum / n;
    volLegSource = "vixy-5d-avg";
  } else if (volLeg === "vix-level" || (volLeg === "auto" && vixClose != null)) {
    // POLICY v0.5.0 primary spec: direct VIX close < 25. Forced "vix-level"
    // on a row without vix_close fails loudly rather than silently proxying.
    if (vixClose == null) throw new Error(`marks.csv ${rows[i]!.date}: volLeg "vix-level" forced but row has no vix_close`);
    volLegPass = vixClose < VIX_MAX;
    volLegSource = "vix-level";
  } else {
    volLegPass = vixyClose < vixyPrior; // fallback proxy: "below prior close", strict
    volLegSource = "vixy-direction";
  }
  return {
    status: "ok",
    asOf: rows[i]!.date,
    gate: maLeg && volLegPass ? "ON" : "OFF",
    qqqClose,
    ma: Math.round(ma * 100) / 100,
    maLen,
    maLeg,
    vixyClose,
    vixyPrior,
    vixClose,
    volLegSource,
    volLegPass,
  };
}

export interface GateSeriesPoint {
  date: string;
  raw: "ON" | "OFF";
  effective: "ON" | "OFF";
}

/**
 * Gate state for every computable session, with optional flip confirmation
 * (PROPOSAL B2): the effective state changes only after the raw state has
 * disagreed with it for `confirmDays` consecutive closes. confirmDays 1 (or
 * unset) reproduces POLICY behavior exactly: effective === raw.
 */
export function computeGateSeries(rows: MarkRow[], opts: GateOptions = {}): GateSeriesPoint[] {
  const confirmDays = opts.confirmDays ?? 1;
  const out: GateSeriesPoint[] = [];
  let effective: "ON" | "OFF" | null = null;
  let streak = 0; // consecutive raw readings disagreeing with effective
  for (let i = 0; i < rows.length; i++) {
    const g = computeGate(rows.slice(0, i + 1), undefined, opts);
    if (g.status !== "ok") continue;
    const raw = g.gate;
    if (effective === null) {
      effective = raw;
    } else if (raw !== effective) {
      const isExit = effective === "ON" && raw === "OFF";
      if (isExit && opts.confirmDirection === "entries-only") {
        effective = raw; // exits act immediately
        streak = 0;
      } else {
        streak++;
        if (streak >= confirmDays) {
          effective = raw;
          streak = 0;
        }
      }
    } else {
      streak = 0;
    }
    out.push({ date: g.asOf, raw, effective });
  }
  return out;
}

export interface ConfirmedGate {
  status: "ok" | "insufficient-data";
  confirmed: "ON" | "OFF" | null; // the state we ACT on (B2: holds 2 closes)
  raw: "ON" | "OFF" | null; // today's single-session state
  pending: boolean; // raw differs from confirmed → a flip is mid-confirmation
  detail: Extract<GateResult, { status: "ok" }> | null;
  have?: number;
  need?: number;
  asOf?: string | null;
}

/**
 * The LIVE Lane-2 gate (POLICY §3 B2, ratified 2026-06-15): the regime state
 * only flips after it holds for `confirmDays` consecutive closes — cuts the
 * single-close whipsaw (~288 → ~98 flips/3y at equal return/drawdown). The loop
 * acts on `confirmed`; `raw`/`pending` are shown for transparency.
 */
export function confirmedGate(rows: MarkRow[], asOfDate?: string, confirmDays = 2): ConfirmedGate {
  const g = computeGate(rows, asOfDate);
  if (g.status !== "ok") {
    return { status: "insufficient-data", confirmed: null, raw: null, pending: false, detail: null, have: g.have, need: g.need, asOf: g.asOf };
  }
  const upTo = asOfDate ? rows.filter((r) => r.date <= asOfDate) : rows;
  const confirmed = computeGateSeries(upTo, { confirmDays }).at(-1)?.effective ?? g.gate;
  return { status: "ok", confirmed, raw: g.gate, pending: g.gate !== confirmed, detail: g };
}

const MARKS_PATH = new URL("../../robinhood-agentic/data/marks.csv", import.meta.url).pathname;

if (import.meta.main) {
  const asOf = process.argv[2];
  const cg = confirmedGate(loadMarks(MARKS_PATH), asOf);
  if (cg.status === "insufficient-data") {
    console.log(`GATE: INSUFFICIENT DATA (${cg.have}/${cg.need} sessions${cg.asOf ? ` through ${cg.asOf}` : ""}).`);
    console.log("Fall back to POLICY §4 estimation until marks.csv has enough rows.");
    process.exit(2);
  }
  const g = cg.detail!;
  if (asOf && (Date.parse(asOf) - Date.parse(g.asOf)) / 86400_000 > 6) {
    console.log(`WARNING: latest marks.csv session (${g.asOf}) is >6 days before queried ${asOf} — inputs stale; treat as UNVERIFIABLE, hold state until data lands.`);
  }
  console.log(`Regime gate (confirmed, 2-day · POLICY §3 B2): ${cg.confirmed}  (at ${g.asOf} close${asOf ? `, queried ${asOf}` : ""})`);
  if (cg.pending) console.log(`  NOTE: raw gate just flipped to ${cg.raw} — UNCONFIRMED, needs one more close. Act on the confirmed state.`);
  console.log(`  MA leg : QQQ ${g.qqqClose.toFixed(2)} ${g.maLeg ? ">" : "≤"} ${g.maLen}d MA ${g.ma.toFixed(2)}  → ${g.maLeg ? "pass" : "FAIL"}`);
  if (g.volLegSource === "vix-level") {
    console.log(`  Vol leg: VIX ${g.vixClose!.toFixed(2)} ${g.volLegPass ? "<" : "≥"} ${VIX_MAX} (direct feed, v0.5.0)  → ${g.volLegPass ? "quiet (pass)" : "elevated (FAIL)"}`);
  } else {
    console.log(`  Vol leg: VIXY ${g.vixyClose.toFixed(2)} ${g.volLegPass ? "<" : "≥"} prior ${g.vixyPrior.toFixed(2)} (proxy fallback — no vix_close on this row)  → ${g.volLegPass ? "quiet (pass)" : "rising (FAIL)"}`);
  }
  if (cg.confirmed === "OFF") console.log("  Lane 2: exit entirely, no new entries (POLICY §3).");
}
