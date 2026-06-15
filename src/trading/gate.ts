// Lane-2 regime gate, computed from robinhood-agentic/data/marks.csv.
// POLICY §3 Lane 2 + §4: gate ON ⟺ QQQ close > 20-session MA AND the vol
// leg is quiet (VIXY close strictly below prior session close — POLICY says
// "below", so a flat VIXY day reads OFF). VIXY is direction-only here; its
// absolute level is never compared to 25 (decaying ETP, POLICY §4).
//
// CLI: bun run gate [YYYY-MM-DD]
// With no date, uses the latest row in marks.csv — which is the correct
// semantic for a pre-market run: the gate for today's open is computed at
// yesterday's close.

import { readFileSync } from "node:fs";
import { parseCsvObjects } from "./csv";
import { validateMarkRow } from "./validate";

export interface MarkRow {
  date: string;
  qqq: number;
  vixy: number;
}

export interface GateOptions {
  maLen?: number; // default 20
  volLeg?: "vixy-direction" | "vixy-5d-avg" | "none"; // default vixy-direction (POLICY)
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
      volLegPass: boolean; // VIXY < prior close (or true when volLeg: "none")
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
  const volLeg = opts.volLeg ?? "vixy-direction";
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
  let volLegPass: boolean;
  if (volLeg === "none") {
    volLegPass = true;
  } else if (volLeg === "vixy-5d-avg") {
    const n = Math.min(5, i + 1);
    let vSum = 0;
    for (let k = i - n + 1; k <= i; k++) vSum += rows[k]!.vixy;
    volLegPass = vixyClose < vSum / n;
  } else {
    volLegPass = vixyClose < vixyPrior; // POLICY: "below prior close", strict
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

const MARKS_PATH = new URL("../../robinhood-agentic/data/marks.csv", import.meta.url).pathname;

if (import.meta.main) {
  const asOf = process.argv[2];
  const rows = loadMarks(MARKS_PATH);
  const g = computeGate(rows, asOf);
  if (g.status === "insufficient-data") {
    console.log(
      `GATE: INSUFFICIENT DATA (${g.have}/${g.need} sessions${g.asOf ? ` through ${g.asOf}` : ""}).`,
    );
    console.log("Fall back to POLICY §4 estimation until marks.csv has enough rows.");
    process.exit(2);
  }
  if (asOf && (Date.parse(asOf) - Date.parse(g.asOf)) / 86400_000 > 6) {
    console.log(
      `WARNING: latest marks.csv session (${g.asOf}) is >6 days before the queried date (${asOf}) — inputs stale; treat the gate as UNVERIFIABLE and hold state (no flips) until data lands.`,
    );
  }
  console.log(`Regime gate: ${g.gate}  (computed at ${g.asOf} close${asOf ? `, queried for ${asOf}` : ""})`);
  console.log(
    `  MA leg : QQQ ${g.qqqClose.toFixed(2)} ${g.maLeg ? ">" : "≤"} ${g.maLen}d MA ${g.ma.toFixed(2)}  → ${g.maLeg ? "pass" : "FAIL"}`,
  );
  console.log(
    `  Vol leg: VIXY ${g.vixyClose.toFixed(2)} ${g.volLegPass ? "<" : "≥"} prior ${g.vixyPrior.toFixed(2)}  → ${g.volLegPass ? "quiet (pass)" : "rising (FAIL)"}`,
  );
  if (g.gate === "OFF") console.log("  Lane 2: exit entirely, no new entries (POLICY §3).");
}
