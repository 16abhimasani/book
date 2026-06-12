// Daily-bar fetcher (Yahoo Finance v8 chart API — free, no auth).
// Chosen over stooq (the brief's example) because stooq now sits behind a
// JavaScript proof-of-work wall that curl/fetch can't pass. Yahoo raw closes
// matched the marks.csv verification anchors (QQQ 693.69 / 717.12,
// VIXY 25.68 / 24.41) to the cent, so raw `close` — not `adjclose` — is the
// basis that matches the broker's official SIP closes the live EOD run writes.

export interface DailyBar {
  date: string; // YYYY-MM-DD, exchange (ET) calendar date
  close: number; // raw close, 2dp — matches official SIP close
  adjclose: number; // dividend/split-adjusted, for return calculations
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export async function fetchDailyBars(
  symbol: string,
  range: string, // e.g. "3mo", "3y"
): Promise<DailyBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`yahoo ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo ${symbol}: ${JSON.stringify(json?.chart?.error ?? "empty result")}`);
  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const adj: (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose ?? closes;
  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue; // holiday/null bar
    const date = new Date(ts[i]! * 1000).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    bars.push({
      date,
      close: Math.round(c * 100) / 100,
      adjclose: Math.round((adj[i] ?? c) * 10000) / 10000,
    });
  }
  return bars;
}
