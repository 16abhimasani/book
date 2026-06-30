import { describe, expect, test } from "bun:test";
import { rankCandidates, extractScanRows, type ScanRow } from "./discover";

// Market-wide candidate discovery: filter a raw RH gainers scan down to QUALITY movers
// (liquid, real market cap, a real move) so the loop evaluates the whole market each run
// instead of a static 10-name watchlist. This module ONLY surfaces candidates — every one
// still passes the full POLICY §2 limits + the §3 entry gate before any order. It never
// relaxes a limit; it removes the blind spot (e.g. GLW +50%, never on the watchlist).
//
// The scan's "% Change" column is a FRACTION (0.17 = +17%, 3.70 = +370%).

const row = (ticker: string, pctFrac: string, mcap: string, last: string, relvol: string, name: string): ScanRow => ({
  ticker,
  columns: { "% Change": pctFrac, "Market cap": mcap, Last: last, "Relative volume": relvol, Name: name },
});

const ROWS = [
  row("AMBA", "0.17", "3.5e9", "78.56", "2", "Ambarella"), // +17%, liquid → keep
  row("CELZ", "3.70", "2.99e6", "3.81", "100", "Creative Medical"), // +370% but $3M micro-cap → drop (mcap)
  row("BIGCO", "0.01", "5e10", "200", "1", "Big Co"), // +1% → drop (not a real mover)
  row("CRDO", "0.10", "4e10", "271", "1", "Credo"), // +10%, liquid → keep
  row("CHEAPO", "0.20", "2e9", "4.50", "3", "Cheap Co"), // +20% but $4.50 → drop (price)
];

describe("rankCandidates", () => {
  test("keeps only quality movers (mcap ≥ $1B, price ≥ $10, move ≥ 3%)", () => {
    expect(rankCandidates(ROWS).map((c) => c.ticker).sort()).toEqual(["AMBA", "CRDO"]);
  });

  test("ranks the stronger mover first and reads % as percent", () => {
    const c = rankCandidates(ROWS);
    expect(c[0]!.ticker).toBe("AMBA"); // +17% (and higher rel-vol) beats CRDO +10%
    expect(c[0]!.pctChange).toBeCloseTo(17, 5);
  });

  test("respects the limit", () => {
    expect(rankCandidates(ROWS, { limit: 1 })).toHaveLength(1);
  });

  test("tunable thresholds (e.g. demand higher rel-vol or a bigger move)", () => {
    expect(rankCandidates(ROWS, { minPctChange: 12 }).map((c) => c.ticker)).toEqual(["AMBA"]);
  });

  test("handles missing/empty fields without throwing (drops them)", () => {
    const bad: ScanRow[] = [{ ticker: "X", columns: { "% Change": "", "Market cap": "", Last: "", Name: "" } }];
    expect(() => rankCandidates(bad)).not.toThrow();
    expect(rankCandidates(bad)).toHaveLength(0);
  });
});

describe("extractScanRows", () => {
  const one = [row("A", "0.1", "2e9", "50", "1", "A")];
  test("finds the results array under any wrapper shape", () => {
    expect(extractScanRows({ data: { result: { results: one } } })).toHaveLength(1);
    expect(extractScanRows({ result: { results: one } })).toHaveLength(1);
    expect(extractScanRows({ results: one })).toHaveLength(1);
  });
  test("throws on an unrecognizable shape (never silently returns nothing)", () => {
    expect(() => extractScanRows({ nope: 1 })).toThrow();
  });
});
