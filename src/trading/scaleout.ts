// POLICY §3 Lane-1 scale-out (profit-taking) ladder as code (owner ratified
// 2026-06-19). The trail ladder (`trail.ts`) answers "where is my stop?"; this
// answers "how many shares do I bank here?" — the other half of the exit.
//
// Bank into strength so a winner's gain is realized, not just paper that the
// trail might give back: peak gain ≥ +15% → sell the first 1/3; ≥ +25% → sell
// the second 1/3; the final 1/3 rides the trail for the fat tail. Fractions are
// of the ORIGINAL quantity and cumulative, so re-running never double-sells.
//
// Shares are whole and floored (num × qty ÷ den, integer-exact — `2/3 × 3`
// floats to 1.999…). Floor preserves the tail: a position only banks a third
// once it actually holds ≥ 3 shares, so 1–2 share positions just trail.
//
// CLI: bun run scaleout -- <entry> <peak> <originalQty> [alreadySold]

export interface ScaleTarget {
  minGain: number; // peak gain that arms this target
  num: number; // cumulative fraction sold by here = num/den of original qty
  den: number;
  label: string;
}

export const SCALE_TARGETS: ScaleTarget[] = [
  { minGain: 0.15, num: 1, den: 3, label: "+15% → bank 1/3" },
  { minGain: 0.25, num: 2, den: 3, label: "+25% → bank 2/3 (final 1/3 rides)" },
];

export interface ScaleOutResult {
  originalQty: number;
  peakGainPct: number;
  targetSoldShares: number; // cumulative shares that SHOULD be banked by this peak
  alreadySold: number;
  sellNow: number; // shares to sell on THIS run = max(0, target − alreadySold)
  remainingAfter: number; // shares still held after hitting the target (rides the trail)
  activeTarget: string | null; // which target is armed, or null below the first
}

/** How many shares to scale out of a long, given entry, the true session high, and original size. */
export function computeScaleOut(
  entry: number,
  peak: number,
  originalQty: number,
  alreadySold = 0,
): ScaleOutResult {
  if (!(entry > 0) || !(peak > 0) || !(originalQty > 0)) {
    throw new Error("entry, peak, and originalQty must be > 0");
  }
  const peakGain = peak / entry - 1;
  let targetSoldShares = 0;
  let activeTarget: string | null = null;
  for (const t of SCALE_TARGETS) {
    if (peakGain + 1e-9 >= t.minGain) {
      // integer-exact floor of (num/den × qty); never trust float thirds
      const shares = Math.floor((t.num * originalQty) / t.den);
      if (shares > targetSoldShares) targetSoldShares = shares;
      activeTarget = t.label;
    }
  }
  const sellNow = Math.max(0, targetSoldShares - alreadySold);
  return {
    originalQty,
    peakGainPct: peakGain * 100,
    targetSoldShares,
    alreadySold,
    sellNow,
    remainingAfter: originalQty - targetSoldShares,
    activeTarget,
  };
}

if (import.meta.main) {
  const [entry, peak, qty, sold] = process.argv.slice(2).filter((a) => a !== "--").map(Number);
  if (!entry || !peak || !qty) {
    console.error("usage: bun run scaleout -- <entry> <peak> <originalQty> [alreadySold]");
    process.exit(1);
  }
  const r = computeScaleOut(entry, peak, qty, sold || 0);
  if (r.sellNow > 0) {
    console.log(
      `SCALE OUT: sell ${r.sellNow} of ${r.originalQty} sh now (${r.activeTarget}); ` +
        `${r.remainingAfter} ride the trail. Peak +${r.peakGainPct.toFixed(1)}%.`,
    );
  } else {
    const why = !r.activeTarget
      ? `below +15% (peak +${r.peakGainPct.toFixed(1)}%)`
      : r.targetSoldShares === 0
        ? `${r.originalQty}-share lot too small to bank a third (peak +${r.peakGainPct.toFixed(1)}%)`
        : `already banked ${r.alreadySold}/${r.targetSoldShares} for this target`;
    console.log(`No scale-out: ${why}. ${r.remainingAfter} sh ride the trail.`);
  }
}
