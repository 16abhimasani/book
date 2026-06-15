// Real-time catalyst lookup via xAI Grok with live X (Twitter) + Web search.
// Returns the answer, its citations, and the per-call cost — so the caller
// sees what it spent. Use SELECTIVELY: each call runs server-side searches at
// ~$0.07/search (a typical query ≈ $0.20–0.25). It is a SECOND source for the
// POLICY §3 two-source rule and a discovery tool, not an every-heartbeat call.
//
// Needs XAI_API_KEY. Two sources, both work: ~/.zshenv (interactive shells)
// AND a gitignored repo-root `.env` (Bun auto-loads it). The .env is what makes
// the SCHEDULED Cowork loop work regardless of which shell it spawns — verified
// by running this with the ambient var stripped. Loop must run from repo root.
// CLI: bun run grok "<query>" [--handles a,b,c] [--days N] [--model ID]
//
// ponytail: x_search + web_search both on by default (owner wants both);
// scope X with --handles to cut cost/noise if needed.

const KEY = process.env.XAI_API_KEY;
const DEFAULT_MODEL = "grok-4-fast-non-reasoning"; // cheapest live-search-capable; alias of grok-4.3

interface GrokResult {
  text: string;
  citations: string[];
  costUsd: number;
  searches: number;
}

export async function grokSearch(
  query: string,
  opts: { handles?: string[]; days?: number; model?: string } = {},
): Promise<GrokResult> {
  if (!KEY) throw new Error("XAI_API_KEY not set (it lives in ~/.zshenv)");
  const xSearch: Record<string, unknown> = { type: "x_search" };
  if (opts.handles?.length) xSearch.allowed_x_handles = opts.handles.slice(0, 20);
  if (opts.days) xSearch.from_date = new Date(Date.now() - opts.days * 86400_000).toISOString().slice(0, 10);

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      input: [{ role: "user", content: query }],
      tools: [xSearch, { type: "web_search" }],
    }),
  });
  const j = (await res.json()) as any;
  if (!res.ok || j.error) throw new Error(`grok: ${JSON.stringify(j.error ?? `HTTP ${res.status}`)}`);

  const text =
    (j.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text).filter(Boolean).join("\n") ||
    j.output_text ||
    "(no text)";
  const citations: string[] = Array.isArray(j.citations) ? j.citations : [];
  return {
    text,
    citations,
    costUsd: (j.usage?.cost_in_usd_ticks ?? 0) / 1e9,
    searches: j.usage?.num_server_side_tools_used ?? 0,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (n: string) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const handles = flag("--handles")?.split(",").map((s) => s.trim());
  const days = flag("--days") ? Number(flag("--days")) : undefined;
  const model = flag("--model");
  const query = args.filter((a, i) => !a.startsWith("--") && args[i - 1]?.startsWith("--") !== true).join(" ");
  if (!query) {
    console.error('usage: bun run grok "<query>" [--handles a,b] [--days N] [--model ID]');
    process.exit(1);
  }
  const r = await grokSearch(query, { handles, days, model });
  console.log(r.text);
  if (r.citations.length) console.log("\nSOURCES:\n" + r.citations.map((c) => "  " + c).join("\n"));
  console.log(`\n[grok: ${r.searches} searches · ~$${r.costUsd.toFixed(3)}]`);
}
