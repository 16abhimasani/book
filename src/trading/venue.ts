// Venue descriptor — the swappable "where does this clear?" layer of the seam
// (strategy math · risk appetite · VENUE MECHANICS). Owner-approved readiness
// hygiene (2026-06-19): the strategy fns (gate/trail/scaleout/reentry/R-sizing)
// are venue-agnostic; the POLICY §2 limits are risk appetite (venue-independent);
// this holds the venue facts that code actually branches on.
//
// HONEST SCOPE — only the fields below are LIVE (code branches on them):
//   • fractionalUnits   → sizeFromRisk floors to whole shares when false
//   • settledFundsRequired → checkLimits #8 (buy-side cash check) runs when true
//
// Two caveats a future second venue MUST know (they are NOT owned here):
//   1. fractionalUnits gates sizeFromRisk ONLY. scaleout.ts independently floors
//      thirds (Math.floor(num*qty/den)) and assumes integer shares — a fractional
//      venue must ALSO thread `venue` through computeScaleOut. Not delivered here.
//   2. settledFundsRequired gates the BUY-side cash check only. The GFV sell-side
//      rule (POLICY §2: never sell unsettled-funded shares before settlement) is
//      loop discipline on every venue, NOT in code. The descriptor does not own GFV.
//
// Every other venue fact (GFV, custody, executor, trading hours, leverage, taxable
// events, order types) lives in docs/VENUES.md's constraint-swap matrix as a
// documented fact — deliberately NOT a typed field here, so nothing reads as
// "enforced" when it isn't.

export interface Venue {
  id: string;
  settledFundsRequired: boolean; // gates checkLimits #8 (settled-funds buy check)
  fractionalUnits: boolean; // false → sizeFromRisk floors qty to whole shares
}

/** The one venue that ships today: the Robinhood cash-equity account. */
export const CASH_EQUITY: Venue = {
  id: "cash-equity",
  settledFundsRequired: true,
  fractionalUnits: false,
};
