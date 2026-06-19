// Disciplined re-entry — SHADOW ONLY (owner-approved 2026-06-19, POLICY §3.9 is
// NOT yet binding). Re-buy a name we BANKED on a still-live thesis when it pulls
// back, instead of needing a brand-new <48h catalyst. This function only DECIDES;
// it returns no stop and no size, so it can never be mistaken for a placeable,
// gate-skipping order — sizing/stops/§2 limits stay with risk.ts + trail.ts when
// (if) §3.9 is ratified. Until then the loop logs would-be re-entries to
// data/shadow.csv and places nothing.
//
// Why shadow-first: §3.9 relaxes a gate (drops the <48h fresh-catalyst rule for
// re-entries). Every other POLICY diff cited a backtest or journaled outcome; this
// one has none yet. So we measure before we authorize — same bar as §6a / shadow.csv.
//
// CLI: bun run reentry -- <exitReason> <sessionsSinceExit> <thesisIntact> <rollingOver> <recentHigh> <price> <tapeConfirms>

export type ExitReason = "scaleout" | "trail" | "laggard" | "stop" | "be-scratch";

// Constants mirror POLICY §3.9 (SHADOW); policy-sync.test.ts couples them so prose
// and code can't drift.
export const REENTRY_WINDOW = 5; // max trading sessions since exit (holidays don't count)
export const BAND_MIN = 0.04; // min pullback off the recent high
export const BAND_MAX = 0.12; // max pullback off the recent high

// Banked because the name RAN. laggard (stalled), be-scratch (faded), stop (broke)
// are excluded — they must re-qualify through the full §3 gate like any other name.
const ELIGIBLE_EXITS: ExitReason[] = ["scaleout", "trail"];

export interface ReentryInput {
  exitReason: ExitReason;
  sessionsSinceExit: number;
  thesisIntact: boolean; // §3 two-source bar (broker-verifiable, not a single grok line) — loop-supplied
  rollingOver: boolean; // directional disqualifier: down ≥2 sessions / lower highs / broke prior structural low
  recentHigh: number;
  price: number;
  tapeConfirms: boolean; // broker-verifiable reclaim of the level — loop-supplied; never defaults true
}

export interface ReentryDecision {
  eligible: boolean; // passed the discipline gates (exit / window / thesis / not-rolling-over)
  triggered: boolean; // eligible AND pulled back into band AND tape reclaims
  pullbackPct: number;
  reasons: string[]; // every failed gate, named (empty when triggered)
}

/** Decide whether a banked winner is a disciplined re-entry right now. Decision only — no order. */
export function evaluateReentry(input: ReentryInput): ReentryDecision {
  const { exitReason, sessionsSinceExit, thesisIntact, rollingOver, recentHigh, price, tapeConfirms } = input;
  if (!(recentHigh > 0) || !(price > 0)) throw new Error("recentHigh and price must be > 0");
  if (recentHigh < price) throw new Error(`recentHigh (${recentHigh}) must be ≥ price (${price}) — a pullback is below the high`);

  // --- eligibility (the discipline gates) ---
  const eligReasons: string[] = [];
  if (!ELIGIBLE_EXITS.includes(exitReason)) eligReasons.push(`exit '${exitReason}' not a banked winner (need scaleout/trail)`);
  if (sessionsSinceExit > REENTRY_WINDOW) eligReasons.push(`${sessionsSinceExit} sessions since exit > window ${REENTRY_WINDOW} (thesis stale)`);
  if (!thesisIntact) eligReasons.push("thesis not intact (two-source check failed)");
  if (rollingOver) eligReasons.push("rolling over (down ≥2 sessions / lower highs / broke structure)");
  const eligible = eligReasons.length === 0;

  // --- trigger (pullback into band + tape reclaim) ---
  const pullbackPct = (recentHigh - price) / recentHigh;
  const inBand = pullbackPct + 1e-9 >= BAND_MIN && pullbackPct - 1e-9 <= BAND_MAX;
  const trigReasons: string[] = [];
  if (!inBand) trigReasons.push(`pullback ${(pullbackPct * 100).toFixed(1)}% outside band ${BAND_MIN * 100}–${BAND_MAX * 100}%`);
  if (!tapeConfirms) trigReasons.push("tape not confirming (no reclaim)");
  const triggered = eligible && inBand && tapeConfirms;

  return { eligible, triggered, pullbackPct, reasons: [...eligReasons, ...trigReasons] };
}

if (import.meta.main) {
  const a = process.argv.slice(2).filter((x) => x !== "--");
  if (a.length < 7) {
    console.error("usage: bun run reentry -- <exitReason> <sessionsSinceExit> <thesisIntact> <rollingOver> <recentHigh> <price> <tapeConfirms>");
    process.exit(1);
  }
  const bool = (s: string) => s === "true" || s === "1" || s === "yes";
  const r = evaluateReentry({
    exitReason: a[0] as ExitReason,
    sessionsSinceExit: Number(a[1]),
    thesisIntact: bool(a[2]!),
    rollingOver: bool(a[3]!),
    recentHigh: Number(a[4]),
    price: Number(a[5]),
    tapeConfirms: bool(a[6]!),
  });
  console.log(
    `SHADOW re-entry: ${r.triggered ? "TRIGGERED" : r.eligible ? "eligible, not triggered" : "ineligible"}` +
      ` (pullback ${(r.pullbackPct * 100).toFixed(1)}%)` +
      (r.reasons.length ? `\n  blocked by: ${r.reasons.join("; ")}` : "") +
      `\n  NOTE: shadow only — places no order; logs to data/shadow.csv. POLICY §3.9 not yet binding.`,
  );
}
