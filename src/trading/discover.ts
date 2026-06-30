// Market-wide candidate discovery. The loop was blind: it only ever looked at a
// 10-name watchlist, so names like GLW (+50%) or AMBA/CRDO/NBIS (+10–17% in their
// theme) were never even evaluated. This filters a raw Robinhood gainers scan down
// to QUALITY movers (liquid, real market cap, a real move) for the loop to run
// through the normal §3 entry gate. It SURFACES candidates only — it relaxes no §2
// limit and forces no trade; every candidate still faces the full gate + sizing +
// review before any order. "Compute, never estimate": the filtering is tested.
//
// The scan's "% Change" column is a FRACTION (0.17 = +17%, 3.70 = +370%).
//
// CLI: bun run discover -- <scan-result.json>   (the file run_scan saves when large)

import { readFileSync } from "node:fs";

export interface ScanRow {
  ticker: string;
  columns: Record<string, string>; // "% Change", "Market cap", "Last", "Relative volume", "Name", …
}

export interface Candidate {
  ticker: string;
  name: string;
  pctChange: number; // percent, e.g. 17.0
  last: number;
  marketCap: number;
  relVol: number;
  score: number; // ranking score (move, weighted up by relative volume)
}

export interface DiscoverOpts {
  minMarketCap?: number; // default $1B — drop micro-cap pump noise
  minPrice?: number; // default $10 — drop penny stocks (no clean stop)
  minPctChange?: number; // default 3% — a real move, not drift
  limit?: number; // default 20
}

const num = (s: string | undefined): number => {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};

/** Filter + rank raw scan rows into quality candidates. Surfaces; never trades. */
export function rankCandidates(rows: ScanRow[], opts: DiscoverOpts = {}): Candidate[] {
  const minMarketCap = opts.minMarketCap ?? 1e9;
  const minPrice = opts.minPrice ?? 10;
  const minPctChange = opts.minPctChange ?? 3;
  const limit = opts.limit ?? 20;

  const out: Candidate[] = [];
  for (const r of rows) {
    const c = r.columns ?? {};
    const pctChange = num(c["% Change"]) * 100;
    const last = num(c["Last"]);
    const marketCap = num(c["Market cap"]);
    const relVol = num(c["Relative volume"]);
    if (marketCap < minMarketCap || last < minPrice || pctChange < minPctChange) continue;
    // weight the move up by relative volume (a real catalyst trades heavy), capped
    const score = pctChange * (1 + Math.min(relVol, 10) / 10);
    out.push({ ticker: r.ticker, name: c["Name"] ?? "", pctChange, last, marketCap, relVol, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Pull the results[] array out of a run_scan / create_scan payload, whatever the wrapper. */
export function extractScanRows(json: unknown): ScanRow[] {
  const j = json as Record<string, any>;
  const arr = j?.data?.result?.results ?? j?.result?.results ?? j?.results;
  if (!Array.isArray(arr)) throw new Error("could not find a scan results array in the JSON");
  return arr as ScanRow[];
}

if (import.meta.main) {
  const file = process.argv.slice(2).filter((a) => a !== "--")[0];
  if (!file) {
    console.error("usage: bun run discover -- <scan-result.json>  (file run_scan saves when large)");
    process.exit(1);
  }
  const rows = extractScanRows(JSON.parse(readFileSync(file, "utf8")));
  const cands = rankCandidates(rows);
  console.log(`Discovery: ${cands.length} quality candidate(s) from ${rows.length} scan rows (mcap≥$1B, price≥$10, move≥3%):\n`);
  console.log(`  ${"TICKER".padEnd(7)} ${"%CHG".padStart(5)}  ${"LAST".padStart(8)}  ${"RVOL".padStart(5)}  NAME`);
  for (const c of cands) {
    console.log(
      `  ${c.ticker.padEnd(7)} ${("+" + c.pctChange.toFixed(0) + "%").padStart(5)}  ${("$" + c.last.toFixed(2)).padStart(8)}  ${(c.relVol.toFixed(0) + "x").padStart(5)}  ${c.name.slice(0, 34)}`,
    );
  }
  console.log("\nNOTE: candidates only — each must still clear the §3 entry gate (fresh <48h catalyst, confirming tape, clean stop, two-source, not parabolic) + §2 limits before any order.");
}
