// Event watcher — OBSERVER MODE (no order authority, does not wake the loop).
// Polls free quotes for held + watchlist names and logs when something moves
// fast enough to care about between scheduled runs. Week one it only writes to
// data/events.log so we can measure the false-positive rate before it ever
// triggers a real loop run. The design: docs/DESIGN-EVENT-DRIVEN-RUNS.md.
//
// CLI: bun run watch            one scan, append fired triggers to the log
//      bun run watch -- --dry   one scan, print only (no write)
//
// ponytail: quotes come from Yahoo (delayed-ish), which is fine for OBSERVING.
// When this graduates to waking the loop, the loop re-pulls real-time broker
// quotes before acting, so feed latency here doesn't reach an order.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fetchQuote, type Quote } from "./yahoo";

const DATA = new URL("../../robinhood-agentic/data/", import.meta.url).pathname;
const LOG = DATA + "events.log";
const STATE = DATA + "events-state.json";

export interface WatchConfig {
  symbols: string[]; // watchlist names to scan
  moveAlertPct: number; // |move vs prior close| ≥ this → MOVE trigger
  stopProximityPct: number; // held within this % of its stop → STOP-ADJACENT
}

export interface HeldPosition {
  symbol: string;
  stop: number | null;
}

export interface Trigger {
  key: string; // stable id (symbol + kind) for dedupe across scans
  price: number;
  text: string;
}

/** Pure: given quotes, the fired triggers. No I/O — tested directly. */
export function detectTriggers(held: HeldPosition[], cfg: WatchConfig, quotes: Map<string, Quote>): Trigger[] {
  const out: Trigger[] = [];
  const pct = (q: Quote) => (q.prevClose > 0 ? (q.price / q.prevClose - 1) * 100 : 0);

  for (const sym of cfg.symbols) {
    const q = quotes.get(sym);
    if (!q) continue;
    const move = pct(q);
    if (Math.abs(move) >= cfg.moveAlertPct) {
      out.push({ key: `MOVE:${sym}`, price: q.price, text: `MOVE ${sym} ${move >= 0 ? "+" : ""}${move.toFixed(1)}% (${q.price.toFixed(2)}) — watchlist mover` });
    }
  }
  for (const p of held) {
    const q = quotes.get(p.symbol);
    if (!q) continue;
    const move = pct(q);
    if (Math.abs(move) >= cfg.moveAlertPct) {
      out.push({ key: `MOVE-HELD:${p.symbol}`, price: q.price, text: `MOVE-HELD ${p.symbol} ${move >= 0 ? "+" : ""}${move.toFixed(1)}% (${q.price.toFixed(2)})` });
    }
    if (p.stop != null && q.price > 0) {
      const distPct = ((q.price - p.stop) / q.price) * 100;
      if (distPct <= cfg.stopProximityPct && distPct >= -50) {
        out.push({ key: `STOP-ADJ:${p.symbol}`, price: q.price, text: `STOP-ADJACENT ${p.symbol} ${q.price.toFixed(2)} vs stop ${p.stop.toFixed(2)} (${distPct.toFixed(1)}% away)` });
      }
    }
  }
  return out;
}

/**
 * Pure dedupe: keep only triggers that are NEW or whose price moved ≥ 1.5%
 * since the last time that key was logged. Kills the every-2-minutes repeat of
 * the same trigger (especially off-hours when prices are static). Returns the
 * triggers to log and the next state map to persist.
 */
export function dedupe(triggers: Trigger[], lastState: Record<string, number>): { toLog: Trigger[]; nextState: Record<string, number> } {
  const nextState = { ...lastState };
  const toLog = triggers.filter((t) => {
    const last = lastState[t.key];
    return last == null || Math.abs(t.price / last - 1) >= 0.015;
  });
  for (const t of toLog) nextState[t.key] = t.price;
  return { toLog, nextState };
}

if (import.meta.main) {
  const dry = process.argv.includes("--dry");
  const cfg = JSON.parse(readFileSync(DATA + "watch.json", "utf8")) as WatchConfig;
  const book = JSON.parse(readFileSync(DATA + "book.json", "utf8")) as { positions: HeldPosition[] };
  const held = book.positions.map((p) => ({ symbol: p.symbol, stop: p.stop }));

  const symbols = [...new Set([...cfg.symbols, ...held.map((h) => h.symbol)])];
  const quotes = new Map<string, Quote>();
  await Promise.all(
    symbols.map(async (s) => {
      try {
        quotes.set(s, await fetchQuote(s));
      } catch {
        // a single bad symbol shouldn't kill the scan
      }
    }),
  );

  const fired = detectTriggers(held, cfg, quotes);
  const lastState: Record<string, number> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const { toLog, nextState } = dedupe(fired, lastState);
  const ts = new Date().toISOString();
  if (!dry) {
    if (toLog.length) appendFileSync(LOG, toLog.map((t) => `${ts} ${t.text}`).join("\n") + "\n");
    writeFileSync(STATE, JSON.stringify(nextState));
  }
  console.log(`[watch ${ts}] scanned ${quotes.size}/${symbols.length} · ${fired.length} firing · ${toLog.length} new${dry ? " (dry)" : toLog.length ? " → events.log" : ""}`);
  for (const t of toLog) console.log("  " + t.text);
}
