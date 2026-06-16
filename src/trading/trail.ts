// POLICY §3 Lane-1 exit ladder as code (ratified v0.3.5, owner 2026-06-16).
// Given an entry and the TRUE session high (peak), returns the exact stop —
// so the loop never eyeballs the ratchet. Tiered: loose early so winners run,
// tightening as the gain extends (where a pullback is more likely the top),
// plus a +3% rung that stops a mid-size gain round-tripping to breakeven.
//
//   peak gain ≥ +5%  → breakeven (entry)
//   peak gain ≥ +8%  → lock +3% (entry × 1.03)   ← dead-zone fix (AMD)
//   peak gain ≥ +10% → trail −8% from the high
//   peak gain ≥ +15% → trail −6%
//   peak gain ≥ +20% → trail −5%
//   peak gain ≥ +25% → trail −4%                  ← lock hard when extended (MU)
// Stops ratchet UP only: the stop is the MAX of every triggered rung, so it
// never drops as peak rises (monotonic by construction).
//
// CLI: bun run trail -- <entry> <peak> [currentPrice]

export interface TrailRung {
  minGain: number; // peak gain that arms this rung
  stopOf: (entry: number, peak: number) => number;
  label: string;
}

export const LADDER: TrailRung[] = [
  { minGain: 0.05, stopOf: (e) => e, label: "+5% → breakeven" },
  { minGain: 0.08, stopOf: (e) => e * 1.03, label: "+8% → lock +3%" },
  { minGain: 0.1, stopOf: (_e, p) => p * 0.92, label: "+10% → −8% from high" },
  { minGain: 0.15, stopOf: (_e, p) => p * 0.94, label: "+15% → −6% from high" },
  { minGain: 0.2, stopOf: (_e, p) => p * 0.95, label: "+20% → −5% from high" },
  { minGain: 0.25, stopOf: (_e, p) => p * 0.96, label: "+25% → −4% from high" },
];

export interface TrailResult {
  stop: number; // rounded to cents
  lockedGainPct: number; // (stop/entry − 1) × 100
  activeRung: string; // which rung set the stop
  peakGainPct: number;
}

/** The correct ratcheted stop for a long, given entry and the true session high. */
export function computeTrailStop(entry: number, peak: number): TrailResult {
  if (!(entry > 0) || !(peak > 0)) throw new Error("entry and peak must be > 0");
  const peakGain = peak / entry - 1;
  // floor = the initial −8%-from-entry hard stop; every armed rung competes above it
  let stop = entry * 0.92;
  let activeRung = "−8% hard stop (entry)";
  for (const r of LADDER) {
    if (peakGain + 1e-9 >= r.minGain) {
      const s = r.stopOf(entry, peak);
      if (s > stop) {
        stop = s;
        activeRung = r.label;
      }
    }
  }
  stop = Math.round(stop * 100) / 100;
  return { stop, lockedGainPct: (stop / entry - 1) * 100, activeRung, peakGainPct: peakGain * 100 };
}

if (import.meta.main) {
  const [entry, peak, current] = process.argv.slice(2).filter((a) => a !== "--").map(Number);
  if (!entry || !peak) {
    console.error("usage: bun run trail -- <entry> <peak> [currentPrice]");
    process.exit(1);
  }
  const r = computeTrailStop(entry, peak);
  console.log(`Trail stop: ${r.stop.toFixed(2)}  (locks ${r.lockedGainPct >= 0 ? "+" : ""}${r.lockedGainPct.toFixed(1)}%; peak was +${r.peakGainPct.toFixed(1)}%; rung: ${r.activeRung})`);
  if (current && current > 0) {
    const dist = ((current - r.stop) / current) * 100;
    console.log(`  current ${current.toFixed(2)} is ${dist.toFixed(1)}% above the stop${current <= r.stop ? " — AT/THROUGH STOP" : ""}`);
  }
}
