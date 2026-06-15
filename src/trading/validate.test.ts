import { describe, expect, test } from "bun:test";
import {
  validateNumber,
  requireNumber,
  validateMarkRow,
  validateTradeRow,
  validateShadowRow,
  validateBook,
} from "./validate";

describe("validateNumber", () => {
  test("parses a finite number", () => {
    expect(validateNumber("3.5", "f", "ctx")).toBe(3.5);
  });
  test("blank with allowBlank → null", () => {
    expect(validateNumber("", "f", "ctx", { allowBlank: true })).toBeNull();
  });
  test("blank without allowBlank throws", () => {
    expect(() => validateNumber("", "f", "ctx")).toThrow(/required but blank/);
  });
  test("non-numeric throws", () => {
    expect(() => validateNumber("abc", "f", "ctx")).toThrow(/not a finite number/);
  });
  test("gt is strict: 0 fails gt:0", () => {
    expect(() => validateNumber("0", "f", "ctx", { gt: 0 })).toThrow(/must be > 0/);
    expect(validateNumber("0.01", "f", "ctx", { gt: 0 })).toBe(0.01);
  });
  test("min/max bounds", () => {
    expect(() => validateNumber("5", "f", "ctx", { max: 4 })).toThrow(/> max/);
    expect(() => validateNumber("-1", "f", "ctx", { min: 0 })).toThrow(/< min/);
  });
  test("requireNumber never returns null", () => {
    expect(requireNumber("2", "f", "ctx")).toBe(2);
    expect(() => requireNumber("", "f", "ctx")).toThrow();
  });
});

describe("validateMarkRow", () => {
  test("good row", () => {
    expect(validateMarkRow({ date: "2026-06-11", qqq_close: "717.12", vixy_close: "24.41" }, "ctx")).toEqual({
      date: "2026-06-11",
      qqq: 717.12,
      vixy: 24.41,
    });
  });
  test("blank qqq_close throws (the silent-zero bug)", () => {
    expect(() => validateMarkRow({ date: "2026-06-11", qqq_close: "", vixy_close: "24.41" }, "ctx")).toThrow(
      /qqq_close is required/,
    );
  });
  test("NaN close throws", () => {
    expect(() => validateMarkRow({ date: "x", qqq_close: "oops", vixy_close: "24" }, "ctx")).toThrow(/not a finite/);
  });
});

describe("validateTradeRow", () => {
  const open = { trade_id: "t", symbol: "AAA", lane: "L1", entry_date: "2026-06-11", risk_usd: "50" };
  test("good open row leaves pnl/r null", () => {
    const r = validateTradeRow({ ...open, exit_date: "", pnl_usd: "", r_multiple: "" }, "ctx");
    expect(r.risk_usd).toBe(50);
    expect(r.pnl_usd).toBeNull();
    expect(r.r_multiple).toBeNull();
  });
  test("blank risk_usd throws (the silent-zero bug)", () => {
    expect(() => validateTradeRow({ ...open, risk_usd: "", exit_date: "" }, "ctx")).toThrow(/risk_usd/);
  });
  test("zero risk_usd throws (gt:0)", () => {
    expect(() => validateTradeRow({ ...open, risk_usd: "0", exit_date: "" }, "ctx")).toThrow(/must be > 0/);
  });
  test("closed trade missing r_multiple throws", () => {
    expect(() =>
      validateTradeRow({ ...open, exit_date: "2026-06-12", pnl_usd: "40", r_multiple: "" }, "ctx"),
    ).toThrow(/r_multiple/);
  });
  test("open trade with a pnl value throws", () => {
    expect(() => validateTradeRow({ ...open, exit_date: "", pnl_usd: "40" }, "ctx")).toThrow(/must be blank/);
  });
});

describe("validateShadowRow", () => {
  const base = { candidate_id: "c", symbol: "X", eval_date: "2026-06-12" };
  test("filtered row needs no entry/stop", () => {
    expect(validateShadowRow({ ...base, status: "filtered" }, "ctx").status).toBe("filtered");
  });
  test("triggered_shadow requires entry & stop with stop < entry", () => {
    expect(() => validateShadowRow({ ...base, status: "triggered_shadow", entry: "100", stop: "" }, "ctx")).toThrow(
      /requires entry and stop/,
    );
    expect(() =>
      validateShadowRow({ ...base, status: "triggered_shadow", entry: "100", stop: "110" }, "ctx"),
    ).toThrow(/must be < entry/);
    expect(
      validateShadowRow({ ...base, status: "triggered_shadow", entry: "100", stop: "92" }, "ctx").entry,
    ).toBe(100);
  });
  test("unknown status throws", () => {
    expect(() => validateShadowRow({ ...base, status: "bogus" }, "ctx")).toThrow(/not in/);
  });
});

describe("validateBook", () => {
  const good = {
    asOf: "2026-06-12T18:31:00Z",
    accountValue: 4729.84,
    cash: 143.13,
    positions: [{ symbol: "MU", qty: 1, entry: 941.5, stop: 941.5 }],
  };
  test("good book passes", () => {
    expect(validateBook(good).positions.length).toBe(1);
  });
  test("entry <= 0 throws", () => {
    expect(() => validateBook({ ...good, positions: [{ symbol: "X", qty: 1, entry: 0, stop: null }] })).toThrow(
      /entry .* must be > 0/,
    );
  });
  test("stop ABOVE entry is allowed (profit-locked trailing stop — plan 004 flags it)", () => {
    expect(() =>
      validateBook({ ...good, positions: [{ symbol: "INTC", qty: 6, entry: 114.15, stop: 116.34 }] }),
    ).not.toThrow();
  });
  test("malformed asOf throws", () => {
    expect(() => validateBook({ ...good, asOf: "yesterday" })).toThrow(/asOf/);
  });
  test("missing positions array throws", () => {
    expect(() => validateBook({ accountValue: 1, cash: 1 })).toThrow(/positions/);
  });
});
