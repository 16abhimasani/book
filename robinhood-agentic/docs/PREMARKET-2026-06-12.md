# Pre-market — Friday 2026-06-12

*Built overnight (research as of ~02:00 ET). Account $3,103.50 (AH) · cash
$481.40 settled (15.5%) · 3 of 4 slots · book risk to stops $161.94 (5.2%).*
***Gate: OFF (deterministic — first real computation).*** *Binding limits:
theme ai-capex 84.1% (>65% → NO semis/AI adds) · settled cash $481.40.*

## Do this at 8:30 (in order)

1. **Verify stops at open**: MU 941.50 (`6a2b62e1`, queued→should confirm),
   INTC 105.00 (`6a2af32a`, confirmed), TQQQ 65.43 (`6a2b6887`, queued).
   Any missing → replace immediately (skill step 3).
2. **EXIT TQQQ (12 sh) — regime gate is OFF.** `bun run gate` on 45 real
   sessions: QQQ 717.12 < 20d MA **721.42** (vol leg quiet, but gate is
   AND). The old "est. mid-690s" was wrong — the estimate anchored on the
   pullback and missed mid-May ~740 closes still in the window. POLICY §3
   Lane 2: gate OFF → exit lane entirely. Holding would be *looser* than
   policy (owner override only). Mechanics: cancel stop `6a2b6887`, then
   immediately sell-limit at the live quote (one chase max ≤ +1%).
   ⚠️ Proceeds (~$915) settle Monday — Friday buys still capped at
   **$481.40 settled cash** (POLICY §2).
   Re-entry: gate flips back ON only if QQQ **closes > 721.51** today.
3. **INTC ratchet check**: AH 118.51. If ≥ **119.86** (+5%) → raise stop
   105.00 → 114.15 (breakeven), per L1 ladder. Likely triggers today.
4. **MU plan**: stop already breakeven. +10% trail trigger 1,035.65.
   **Time stop 06-18** and **earnings 06-24 AMC (confirmed)** — exit by
   06-18 close unless trailing; never hold into the print.
5. **Before ANY order**: refresh `data/book.json` → `bun run risk -- robinhood-agentic/data/book.json`.

## Do NOTHING (no new entries) if

- **Iran deal claim wobbles** — Trump says "approved/signable this
  weekend"; **Iran says no MOU agreed; Israel unaware**. Tell: oil
  reversing > +3% pre-open. Thursday's whole +3.4% rally rests on this.
- QQQ gaps < −2% (manage exits only; no knife-catching first hour).
- Within 30 min of **UMich 10:00 ET** (see calendar — May printed a
  record-low 44.8; the inflation-expectations line is the mover).
- Candidate opens below its prior-day high (Lane-1 confirming-tape rule).
- Structural: only $481.40 settled, 1 free slot, nothing in ai-capex.

## Positions & gap risk (researcher-verified, sources at bottom)

| Pos | Close → AH | Stop (dist) | Gap note |
|---|---|---|---|
| MU 1 @ 941.50 | 995.87 → 998.88 | 941.50 BE (−5.5%) | **Most exposed**: highest-beta after +11.7% day; ordinary −3–4% profit-taking puts stop in range. A stop-out = position mgmt, NOT thesis failure ($0 loss ex-gap). Wolfe PT $1,250, Daiwa $1,600. |
| INTC 6 @ 114.15 | 116.96 → 118.51 | 105.00 (−10.2%) | Strongest AH of the three (BofA double-upgrade follow-through; Google/Nvidia foundry reports). Watch: capital-raise speculation (TipRanks); foundry wins are press reports, not POs — a denial is the thesis headline. Stop needs macro shock + thesis hit. |
| TQQQ 12 @ 74.35 | 76.01 → 76.81 | 65.43 (−13.9%) | Exiting per gate anyway. Stop needs QQQ −4.6% (worse than strike night). |

**Bear case** (deal denial hardens, ~20-30%): QQQ −2 to −3.5% gap — no
stop reached at the open; MU's straddles the range intraday.

**ORCL-capex thesis: INTACT, arguably stronger.** ORCL fell ~11% on
*funding* (FCF −$23.7B, $40B raise), not capex walk-back — CEO defended
the $95B FY27 plan; backlog $638B (+363%). Receivers rallied as predicted
(SOX +7.9%, best day in a year) and Asia followed (Tokyo Electron +10%,
Advantest +8.7%, Nikkei +4%). Watch the second-order bear: "can't fund
$95B" hardening into "AI capex unfundable" — nothing overnight supports it.

## Lane-1 candidates (pre-sized by `bun run risk`; cash binds everything)

| # | Sym | Catalyst (age @ open) | Entry zone | Stop | Qty | Risk | Binds | Invalidate if |
|---|---|---|---|---|---|---|---|---|
| 1 | RH | FY26 guide RAISED, AH +8% → ~172 (16h). EPS missed ($1.97 vs $2.07) — quality mixed | 170–174 on tape confirm | 158.24 (−8%) | **2** (budget: 5) | $27.52 (0.9%) | settled cash | fades <165 pre-open; opens < prior-day high |
| 2 | MMM | legacy-liability settlement update, +3.7% → 148.62 (18h) | 147–150 confirm | 136.73 (−8%) | **3** (budget: 6) | $35.67 (1.1%) | settled cash | settlement detail unwinds; opens red |
| 3 | DAL | oil −3.9% to $86.51 (April lows) on deal claim (~12h) | green confirm only | 74.81 (−8%) | **5** (budget: 11) | $32.50 (1.0%) | settled cash | ANY Iran wobble; oil +3% reversal — highest invalidation risk of the three |

**Explicitly blocked / skip:** INTC add (theme 84% > 65% cap) · WDC ($505 >
cash) · SpaceX IPO debut today (no tape history — entry hygiene fails) ·
ADBE −5.5% AH (falling knife; CFO exit + "AI eats software" = the news IS
quasi-thesis-breaking, fails Lane-3 criteria too).

## Calendar (Fri 2026-06-12, ET)

- **10:00 UMich June prelim sentiment** — May was a record-low 44.8 with
  1-yr inflation expectations 4.8%; with oil collapsing, a surprise either
  way moves rate-cut odds. *(Second-Friday slot — verify time pre-open.)*
- Earnings: **sparse** — nothing semis/tech material today.
- Fed: FOMC next week → blackout, no speakers. (PPI printed cool Thursday.)
- SpaceX $75B IPO debuts today — sentiment positive, possible flow diversion.
- Asia closed strongly risk-on (Nikkei +4%, chips led). NQ +0.21% @ 22:30 ET.

## Stop-of-the-day reminder

Gate exit (item 2) is the only *required* action. Everything else is
conditional. If in doubt on any candidate: the DO-NOTHING list wins —
expectancy gate needs clean trades, not busy ones (`bun run stats`).

---
*Sources: stockanalysis.com (MU/INTC/RH AH), Yahoo NQ=F, CNBC (ORCL
funding, oil), Axios/Al Jazeera/CBS (Iran deal status), Trading Economics
(Asia session), stocktitan/GlobeNewswire (MU 6/24 confirmed), marketbeat
(ACN 6/18), investing.com (MMM, airlines), umich/FRED (sentiment). Gate,
sizing and limits computed by `src/trading/{gate,risk}.ts` — not estimated.*
