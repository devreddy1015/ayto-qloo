// Stage: share. Builds the public page data for the run and a stable slug.
export async function share(run) {
  const r = run.stages.resolve.output;
  const w = run.stages.write.output;
  const c = run.stages.check?.output;
  const p = w.plan ?? {};
  // The first title as text, whether the model gave a string, a list, or { title }.
  const first = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : Array.isArray(v) ? first(v[0]) : v && typeof v === "object" ? first(v.title ?? v.name ?? Object.values(v)[0]) : "");
  const title = first(p.titles) || first(p.names) || first(p.title) || first(p.drop_name) || `${r.city.name} ${run.input.format}`;
  const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || run.input.format;
  const slug = `${base}-${run.id.replace(/[^a-z0-9]/gi, "").slice(-5).toLowerCase()}`;
  run.publish = {
    slug,
    url: `/s/${slug}`,
    publishedAt: new Date().toISOString(),
    page: {
      format: run.input.format,
      city: r.city.name,
      country: r.city.market ?? r.city.country,
      theme: (r.theme?.tags ?? []).map((t) => t.name),
      loves: (r.loves ?? []).map((l) => l.name),
      title,
      plan: p,
      lanes: (run.stages.gap?.output?.lanes ?? []).map((l) => ({ name: l.name, cityRank: l.cityRank, countryRank: l.countryRank, supplyCount: l.supplyCount, gap: l.gap })),
      grounded: c ? { grounded: c.grounded, checked: c.checked } : undefined,
      produce: run.stages.produce?.output ? { mrp: run.stages.produce.output.economics?.mrp, totalUnits: run.stages.produce.output.totalUnits, gstRate: run.stages.produce.output.economics?.gstRate, allocation: run.stages.produce.output.allocation } : undefined,
      ledgerCount: run.ledger?.length ?? 0,
      llm: w.llm,
      fallback: w.fallback,
      language: w.fallback ? undefined : w.language,
      usage: run.usage ? { calls: run.usage.calls, input: run.usage.input, output: run.usage.output, byok: run.usage.byok, provider: run.usage.provider, model: run.usage.model } : undefined,
    },
  };
  return { slug, url: run.publish.url, summary: `Share page at ${run.publish.url}.` };
}
