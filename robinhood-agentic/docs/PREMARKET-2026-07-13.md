# PREMARKET — Monday 2026-07-13 (written 10:25 UTC / 06:25 ET; research only, no orders placed)

## 1. Header
- **Account (Agentic ••••5686):** $4,769.30 · 100% settled cash · **FLAT 0/6** · no open orders · +4.02% vs $4,585 contributed.
- **Gate:** CONFIRMED **ON** (07-10 close; QQQ 725.54 > MA20 722.51, VIXY 20.34 < 20.81). **Live VIX 16.26** (direct index feed, 06:13 ET) — quiet in absolute terms.
- **But the LIVE tape is risk-OFF pre-market:** QQQ 718.45 (−0.97%), SPY −0.30%, **SOXL −8.4%**, TQQQ −2.9%. Semis-led gap-down: SK Hynix −10% pre-market after Friday's Nasdaq debut, MU −6.2%, SNDK −7.1% (sector supply/sentiment shock, not single-name news on our watch).
- **§2 binding today:** slot cap $1,907.72 (40%) binds before the 5% risk budget on every candidate below; settled cash caps the book at ~**2 full-size entries** today. All limits currently PASS (`bun run risk` 10:15Z).
- **First trade-eligible run:** 11:36Z (07:36 ET, §3.7 LIMIT-only + 1% spread guard). Regular session 13:30Z. **POLICY v0.4.1 §3.1b post-gap watch is LIVE as of this morning** — the seeded watch is the candidate engine today.

## 2. Do this at 8:30 (and every entry-eligible run)
1. **Correct the 07-10 marks row** to the official SIP close (posted: QQQ 725.51 / VIXY 20.34 — QQQ −3¢ vs provisional 725.54) and re-run `bun run gate`; ON holds (MA20 722.51 vs close 725.51). [POLICY §4, LESSONS gate-inputs-to-the-cent]
2. **Lane 2: DO NOT deploy at the open despite gate-ON.** LESSONS live-tape check fails — QQQ −1% under its MA20 (~722.6) with SOXL −8.4% is rotation/risk-off, not risk-on. Re-evaluate ONLY if QQQ reclaims ~723+ intraday with semis stabilizing; then TQQQ ~$75 entry, −12% stop $66 resting at fill, **25 sh** (slot-capped from risk qty 26; $1,875 ≤ lev cap $2,384). [§3 Lane 2 + LESSONS]
3. **Lane 1 via §3.1b post-gap watch — the gap-down IS the pullback.** Friday's leaders are opening 3–9% off their post-gap highs, i.e. entering the 4–12% band. **Entry requires the printed reclaim level, never the falling knife**; run `bun run postgap` with the TRUE post-gap high (pre-filled in `data/postgap-watch.csv`), then full §3 gate + `bun run risk -- size` + stop from `bun run trail`. Candidates pre-chewed in §5.
4. **Spread guard pre-market:** LASR (2.4%), WDFC (~5%), CBRS (wide) FAIL the 1% §3.7 guard right now — regular session only for those.
5. **Shadow-log every evaluation** (triggered or filtered) per §3.1b; update `postgap-watch.csv` status fields.
6. **EOD run:** append marks row **+ record live VIX in the note** (first datapoint for the proposed direct-VIX vol leg — advisory until owner ratifies).

## 3. Do NOTHING if
- QQQ stays below its 20d MA (~722.6) **and** SOXL stays < −5% through the morning → semis complex unstable; no Lane-1 semi/photonics entries, no Lane-2. A flat day here is a WIN (that's the tape that round-trips chases).
- A candidate gaps below its higher-low (structure broken) and doesn't reclaim → it's not a pullback anymore; leave `watching` or prune if it closes broken.
- Spread > 1% of mid at decision time (extended hours) → stand down on that name.
- **After ~15:00 ET, prefer NOT initiating brand-new full-size positions into tomorrow's 8:30 ET CPI + mega-bank earnings** unless the entry has already confirmed intraday — posture C accepts overnight gap risk, but a binary macro print 18 hours after entry with no active stop overnight is the worst-case shape (POLICY §3.7 sizing rule: assume ≥2% slip through the stop).
- SNDK: NO entry today regardless of band position — it IS the sector-shock name (memory comp to SK Hynix −10%); thesis leg fails this morning.

## 4. Positions & gap risk
FLAT — no positions, no resting orders, no stop registry, no gap exposure. Worst case today is opportunity cost only.

## 5. Candidates (Lane-1 §3.1b unless noted; sizes via `bun run risk -- size 4769.30 <entry> <stop>`, then 40% slot cap $1,907.72)

| # | Sym | Setup (post-gap high → pre-mkt) | Reclaim trigger (no entry below it) | Entry ~ | Stop (−8%) | Risk qty → slot-capped | Notional | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | **LITE** | 806.56 → 777.00 (−3.7%, band at <774.3) | Hold/reclaim **761.62** (Fri low) after tagging band | 772 | 710.24 | 3 → **2 sh** | $1,544 | Strongest name on watch (closed near highs Fri +2.1%); photonics leadership; higher-low 761.62 sits above stop ✓ |
| 2 | **WDC** | 601.50 → 550.00 (−8.6%, IN band) | Reclaim **562.76** (Fri low) | 565 | 519.80 | 5 → **3 sh** | $1,695 | Memory-adjacent — demand semis stabilize first (SOXL > −5%); higher-low 526 above stop ✓ |
| 3 | **ARM** | 339.44 → 315.00 (−7.2%, IN band) | Reclaim **317.88** (Fri low) | 319 | 293.48 | 9 → **5 sh** | $1,595 | Cleaner than direct-memory names; higher-low 311.15 ✓ |
| 4 | **LASR** | 76.43 → 70.17 (−8.2%, IN band, sitting ON the 69.66 Fri low) | Hold **69.66** + reclaim 71+ | 71 | 65.32 | 41 → **26 sh** | $1,846 | REGULAR SESSION ONLY (2.4% pre-mkt spread); thinner name — one chase max |
| 5 | **CBRS** | 216.46 → 209.20 (−3.4%, band at <207.8) | If band-entry, hold **191.22**-197 zone | 208 | 191.36 | 14 → **9 sh** | $1,872 | Strongest uptrend on watch (closed AT highs Fri +8.4%); stop ≈ at the Fri low — borderline placement, demand a clean intraday higher-low |
| L2 | TQQQ | Lane-2, gate ON | QQQ reclaims ~723 + semis stabilize | 75 | 66.00 (−12%) | 26 → **25 sh** | $1,875 | Resting stop AT fill, regular session only per Do-this #2 |
| — | WDFC | 298.90 → 264.91 (−11.4%, deep band) | NO base yet (Fri = huge fade 298.9→264.9) | — | — | — | — | Fresh 07-09 earnings beat is real, but wait for a multi-session higher-low; re-check Tue+ |
| — | SNDK | 1952.59 → 1787.68 (−8.4%, in band) | **SKIP TODAY** — sector-shock epicenter | — | — | — | — | Keep `watching`; only after the SK-Hynix shock settles AND a higher-low forms |
| — | AMD/AMBA/ALAB/CRDO | −3.2% / −6.5% / −8.5% / −10.4% | Below Fri lows (AMBA/ALAB/CRDO) — need reclaims; AMD not yet in band (<537.8) | — | — | — | — | Evaluate at run time with `bun run postgap`; all higher-lows clear their −8% stops ✓ |

**Two-source status:** these are structure/momentum trigger-(b) candidates — the second source is broker-verifiable price structure (higher-low + reclaim + volume at the reclaim), per POLICY §3 Entry(b). No fresh <48h named catalysts on the watch except WDFC (07-09 earnings, verified via `get_earnings_results` print 272.14 vs est) and the NEGATIVE sector catalyst (SK Hynix debut fade — CNBC, today). Settled cash caps today at ~2 of the above.

## 6. Calendar (ET)
- **Today:** no tier-1 US econ prints found for Monday (quiet pre-CPI session); FBK earnings PM (small, ignore). Treasury 3/6-mo bills 11:30.
- **Tue 07-14, 8:30:** **June CPI** (BLS confirmed) — the week's macro binary. Same morning **pre-open:** JPM, GS, C, BAC, WFC, FAST, ERIC.
- **Wed–Fri:** bank earnings continue; TSMC Q2 report later this week (June sales +67.9% y/y already out — bullish AI-capex datapoint sitting under today's semis fear).

## 7. Tail risks + invalidations
- **SK Hynix hangover deepens** → memory/semi complex (WDC/SNDK/MU) keeps bleeding; invalidates candidates 2 + the semi side of the watch. TSMC's blowout June sales is the counter-signal — watch which one the tape believes by ~10:30 ET.
- **CPI landmine tomorrow 8:30 ET** — any position opened today carries it overnight with no active stop (§3.7); sized for ≥2% slip. Hot print + long semis = the bad path; that's why reclaim-confirmation is mandatory today, not optional.
- **Gate math:** QQQ closing < ~722.6 = 1st risk-OFF close (gate stays CONFIRMED ON, B2 needs 2). Two closes down here flips Lane 2 OFF Wednesday.
- Middle-East headlines still cited by futures coverage — no fresh escalation found this morning; treat as background vol risk.

## 8. Sources
- CNBC live pre-market (SK Hynix −10.4%, MU −6.16%, SNDK −7.09%, futures: Dow +0.02% / SPX −0.31% / NDX −1.07%; TSMC June sales +67.9%): https://www.cnbc.com/2026/07/12/stock-market-today-live-updates.html (fetched 10:15Z)
- BLS CPI schedule (June CPI = Tue 2026-07-14 8:30 ET): https://www.bls.gov/schedule/news_release/cpi.htm · https://www.financecalendar.com/us-cpi-report/ (fetched 10:20Z)
- Robinhood MCP (all quotes/closes/bars/VIX/earnings-calendar timestamps 10:10–10:22Z this doc): `get_equity_quotes`, `get_equity_historicals` (day bars 07-06→07-10), `get_index_quotes` (VIX 16.26 @ 06:13 ET), `get_earnings_calendar` (days 2, high_mcap: FBK today PM; WFC/BAC/C/JPM/GS/FAST/ERIC Tue AM).
- Earnings-cal + banks Tue: Robinhood `get_earnings_calendar` (verified=true rows).
- Grok second-source: NOT called this brief (no fresh named single-name catalyst required it; structure candidates use price-action as the second source; xAI spend reserved for entry-time checks per docs/GROK.md).
