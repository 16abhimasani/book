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

export interface MarkRow {
  date: string;
  qqq: number;
  vixy: number;
}

export interface GateOptions {
  maLen?: number; // default 20
  volLeg?: "vixy-direction" | "none"; // default vixy-direction
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
    .filter((r) => r.date && r.qqq_close && r.vixy_close)
    .map((r) => ({
      date: r.date!,
      qqq: Number(r.qqq_close),
      vixy: Number(r.vixy_close),
    }))
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
  const volLegPass = volLeg === "none" ? true : vixyClose < vixyPrior;
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
  console.log(`Regime gate: ${g.gate}  (computed at ${g.asOf} close${asOf ? `, queried for ${asOf}` : ""})`);
  console.log(
    `  MA leg : QQQ ${g.qqqClose.toFixed(2)} ${g.maLeg ? ">" : "≤"} ${g.maLen}d MA ${g.ma.toFixed(2)}  → ${g.maLeg ? "pass" : "FAIL"}`,
  );
  console.log(
    `  Vol leg: VIXY ${g.vixyClose.toFixed(2)} ${g.volLegPass ? "<" : "≥"} prior ${g.vixyPrior.toFixed(2)}  → ${g.volLegPass ? "quiet (pass)" : "rising (FAIL)"}`,
  );
  if (g.gate === "OFF") console.log("  Lane 2: exit entirely, no new entries (POLICY §3).");
}
