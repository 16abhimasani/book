// Post-gap watch — POLICY §3.1b (v0.4.1, enacted 2026-07-13). The §3.1a gainers
// scan only surfaces Day-0 gaps, and the §3 gate correctly filters most of them
// (no placeable −8% stop under a higher-low). The BUYABLE trigger-(b) setup is
// the pullback-to-rising-support 1–3 sessions later — and a pulling-back name is
// never a top gainer, so without a tracked watch it is structurally invisible
// (the 06-17→07-10 fill drought: 18 sessions flat, 300+ correctly-filtered
// shadow rows, zero follow-through). This function only DECIDES whether a
// watched name's pullback is buyable structure right now; sizing/stops/§2
// limits stay with risk.ts + trail.ts, and a TRIGGERED name still clears the
// FULL, UNCHANGED §3 entry gate (two-source, don't-chase-parabolic).
//
// CLI: bun run postgap -- <postGapHigh> <price> <higherLow> <tapeReclaims> <sessionsSinceGap>

// Constants mirror POLICY §3.1b; postgap.test.ts couples them to the prose so
// code and POLICY can't drift (same guard as policy-sync.test.ts).
export const WATCH_WINDOW = 5; // trading sessions a name stays on the watch (holidays don't count)
export const BAND_MIN = 0.04; // min pullback off the post-gap high (same band as §3.9)
export const BAND_MAX = 0.12; // max pullback off the post-gap high
export const STOP_PCT = 0.08; // Lane-1 protective stop (POLICY §3)

export interface PostgapInput {
  postGapHigh: number; // TRUE high since the gap day (get_equity_historicals — never the last-observed price)
  price: number; // current quote
  higherLow: number; // defined higher-low / rising support below price; 0 = none formed yet
  tapeReclaims: boolean; // broker-verifiable reclaim of the pullback — loop-supplied; never defaults true
  sessionsSinceGap: number; // trading sessions since the gap day (holidays don't count)
}

export interface PostgapDecision {
  stale: boolean; // past the watch window → prune
  inBand: boolean; // pullback within BAND_MIN–BAND_MAX off the post-gap high
  stopPlaceable: boolean; // a −8% stop from here rests UNDER the defined higher-low
  triggered: boolean; // fresh AND in band AND stop placeable AND tape reclaiming
  pullbackPct: number;
  stopPrice: number; // price × (1 − STOP_PCT) — the stop the entry would carry
  reasons: string[]; // every failed gate, named (empty when triggered)
}

/** Decide whether a watched post-gap name is a buyable trigger-(b) pullback right now. Decision only — no order. */
export function evaluatePostgap(input: PostgapInput): PostgapDecision {
  const { postGapHigh, price, higherLow, tapeReclaims, sessionsSinceGap } = input;
  if (!(postGapHigh > 0) || !(price > 0)) throw new Error("postGapHigh and price must be > 0");
  if (postGapHigh < price)
    throw new Error(`postGapHigh (${postGapHigh}) must be ≥ price (${price}) — a pullback is below the high`);
  if (higherLow < 0) throw new Error("higherLow must be ≥ 0 (0 = no higher-low formed yet)");

  const reasons: string[] = [];

  const stale = sessionsSinceGap > WATCH_WINDOW;
  if (stale)
    reasons.push(
      `${sessionsSinceGap} sessions since gap > watch window ${WATCH_WINDOW} (prune — re-qualifies only via full §3 discovery)`,
    );

  const pullbackPct = (postGapHigh - price) / postGapHigh;
  const inBand = pullbackPct + 1e-9 >= BAND_MIN && pullbackPct - 1e-9 <= BAND_MAX;
  if (!inBand) reasons.push(`pullback ${(pullbackPct * 100).toFixed(1)}% outside band ${BAND_MIN * 100}–${BAND_MAX * 100}%`);

  // "Placeable −8% stop under a defined higher-low": the higher-low must exist,
  // sit below the entry, and hold AT OR ABOVE the −8% level — so the stop rests
  // under structure and a routine retest of support can't full-lose the position
  // (the RIVN 07-02 filter: −8% landed at the breakout pivot, nothing above it).
  const stopPrice = price * (1 - STOP_PCT);
  const stopPlaceable = higherLow > 0 && higherLow < price && higherLow >= stopPrice - 1e-9;
  if (!stopPlaceable)
    reasons.push(
      higherLow > 0
        ? higherLow >= price
          ? `higher-low ${higherLow} not below price ${price} (not a pullback structure)`
          : `higher-low ${higherLow} sits below the −8% stop ${stopPrice.toFixed(2)} (stop would rest above structure — not placeable)`
        : "no defined higher-low yet (base still forming)",
    );

  if (!tapeReclaims) reasons.push("tape not confirming (no reclaim of the pullback)");

  const triggered = !stale && inBand && stopPlaceable && tapeReclaims;
  return { stale, inBand, stopPlaceable, triggered, pullbackPct, stopPrice, reasons };
}

if (import.meta.main) {
  const a = process.argv.slice(2).filter((x) => x !== "--");
  if (a.length < 5) {
    console.error("usage: bun run postgap -- <postGapHigh> <price> <higherLow> <tapeReclaims> <sessionsSinceGap>");
    process.exit(1);
  }
  const bool = (s: string) => s === "true" || s === "1" || s === "yes";
  const r = evaluatePostgap({
    postGapHigh: Number(a[0]),
    price: Number(a[1]),
    higherLow: Number(a[2]),
    tapeReclaims: bool(a[3]!),
    sessionsSinceGap: Number(a[4]),
  });
  console.log(
    `post-gap watch: ${r.triggered ? "TRIGGERED — real trigger-(b) candidate" : r.stale ? "STALE — prune from the watch" : "not triggered"}` +
      ` (pullback ${(r.pullbackPct * 100).toFixed(1)}% off the post-gap high; −8% stop from here ${r.stopPrice.toFixed(2)})` +
      (r.reasons.length ? `\n  blocked by: ${r.reasons.join("; ")}` : "") +
      `\n  NOTE: decision only — a TRIGGERED name still clears the FULL §3 gate (two-source, don't-chase-parabolic)` +
      `\n  + §2 sizing (bun run risk -- size) + stop (bun run trail) before any order; skips log to data/shadow.csv.`,
  );
}
