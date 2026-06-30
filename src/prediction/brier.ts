// The shadow harness's headline metric. A prediction-market forecast is a probability
// p ∈ [0,1] paired with the realized binary outcome. The Brier score — mean((p−outcome)²)
// — scores calibration+resolution in one number (0 = perfect, 1 = maximally wrong, 0.25 =
// a no-information 50/50 guess). The whole on-chain question reduces to: does OUR probability
// beat the MARKET's? brierDelta answers it; NEGATIVE means our model won. Per the research
// brief, if the delta is ≥ 0 over a meaningful sample, the forecasting edge is dead and no
// downstream venue/capital/key work is justified. Pure + tested ("compute, never estimate").

export interface Forecast {
  p: number; // forecast probability of YES, in [0,1]
  outcome: 0 | 1; // realized outcome at settlement
}

function assertValid(fs: Forecast[]): void {
  if (fs.length === 0) throw new Error("need at least one forecast");
  for (const f of fs) {
    if (!(f.p >= 0 && f.p <= 1)) throw new Error(`probability ${f.p} out of [0,1]`);
    if (f.outcome !== 0 && f.outcome !== 1) throw new Error(`outcome ${f.outcome} must be 0 or 1`);
  }
}

/** Mean Brier score over a set of resolved forecasts. Lower is better. */
export function brierScore(fs: Forecast[]): number {
  assertValid(fs);
  const sum = fs.reduce((s, f) => s + (f.p - f.outcome) ** 2, 0);
  return sum / fs.length;
}

/** model − market. Negative ⇒ our model beat the market price (the edge exists). */
export function brierDelta(model: Forecast[], market: Forecast[]): number {
  return brierScore(model) - brierScore(market);
}

export interface CalibrationBin {
  lo: number; // bin lower edge (inclusive)
  hi: number; // bin upper edge
  meanP: number; // mean forecast probability of forecasts that landed here
  observedFreq: number; // fraction that actually resolved YES
  count: number;
}

/** Reliability diagram: bin forecasts by p, compare claimed probability to realized frequency.
 *  A well-calibrated forecaster has observedFreq ≈ meanP in every populated bin. */
export function calibrationBins(fs: Forecast[], nBins = 10): CalibrationBin[] {
  assertValid(fs);
  if (!Number.isInteger(nBins) || nBins < 1) throw new Error("nBins must be a positive integer");
  const buckets: Forecast[][] = Array.from({ length: nBins }, () => []);
  for (const f of fs) {
    // p === 1.0 lands in the last bin rather than overflowing
    const idx = Math.min(Math.floor(f.p * nBins), nBins - 1);
    buckets[idx]!.push(f);
  }
  return buckets.map((bucket, i) => {
    const count = bucket.length;
    const meanP = count ? bucket.reduce((s, f) => s + f.p, 0) / count : 0;
    const observedFreq = count ? bucket.reduce((s, f) => s + f.outcome, 0) / count : 0;
    return { lo: i / nBins, hi: (i + 1) / nBins, meanP, observedFreq, count };
  });
}
