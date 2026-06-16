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

// Absolute sanity bound on a single close. Not a market guess — just a guard
// against a garbage print (negative, zero, or a parser-overflow value) silently
// becoming gate input. Real index/ETF closes sit far inside this.
const MAX_CLOSE = 100_000;

/**
 * Pure parse of a Yahoo v8 chart response into daily bars, with explicit
 * shape and numeric-bounds validation — the response is narrowed explicitly
 * rather than blindly cast, so a feed shape-change surfaces loudly instead of
 * returning [] that the gate would read as "no data".
 */
export function parseChartResponse(json: unknown, symbol: string): DailyBar[] {
  const root = json as { chart?: { result?: unknown[]; error?: unknown } } | null;
  const result = root?.chart?.result?.[0] as
    | { timestamp?: unknown; indicators?: { quote?: unknown[]; adjclose?: unknown[] } }
    | undefined;
  if (!result) {
    throw new Error(`yahoo ${symbol}: ${JSON.stringify(root?.chart?.error ?? "empty result")}`);
  }
  const ts = result.timestamp;
  const quote = result.indicators?.quote?.[0] as { close?: unknown } | undefined;
  if (!Array.isArray(ts)) throw new Error(`yahoo ${symbol}: malformed response (timestamp not an array)`);
  if (!quote || !Array.isArray(quote.close)) {
    throw new Error(`yahoo ${symbol}: malformed response (indicators.quote[0].close not an array)`);
  }
  const closes = quote.close as (number | null)[];
  if (closes.length !== ts.length) {
    throw new Error(`yahoo ${symbol}: malformed response (close length ${closes.length} != timestamp ${ts.length})`);
  }
  const adjRaw = (result.indicators?.adjclose?.[0] as { adjclose?: unknown } | undefined)?.adjclose;
  const adj = Array.isArray(adjRaw) ? (adjRaw as (number | null)[]) : closes;

  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue; // genuine holiday/null bar — skip, don't fail
    if (!Number.isFinite(c) || c <= 0 || c > MAX_CLOSE) {
      throw new Error(`yahoo ${symbol}: implausible close ${c} at ${new Date((ts[i] as number) * 1000).toISOString()}`);
    }
    const date = new Date((ts[i] as number) * 1000).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const a = adj[i];
    bars.push({
      date,
      close: Math.round(c * 100) / 100,
      adjclose: Math.round((a == null ? c : a) * 10000) / 10000,
    });
  }
  return bars;
}

export interface Quote {
  symbol: string;
  price: number; // current/last regular-market price
  prevClose: number;
}

/** Near-real-time quote from the chart endpoint's meta. For the watcher. */
export async function fetchQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`yahoo ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
  const meta = json.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) throw new Error(`yahoo ${symbol}: no live price`);
  const prev = typeof meta?.chartPreviousClose === "number" ? meta.chartPreviousClose
    : typeof meta?.previousClose === "number" ? meta.previousClose : price;
  return { symbol, price, prevClose: prev };
}

export async function fetchDailyBars(
  symbol: string,
  range: string, // e.g. "3mo", "3y"
): Promise<DailyBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`yahoo ${symbol}: HTTP ${res.status}`);
  return parseChartResponse(await res.json(), symbol);
}
