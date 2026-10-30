// The reference strip under a fashion drop's 3D preview: three or four pictures, every one from Qloo's own read of
// this run, never from a web search. The love the maker named comes first (its Qloo entity's image), then the fashion
// labels the city favours, those missing from the country's top list first. Each picture is a receipt: its name
// traces to a Qloo request. Pure, so it runs in the browser and in tests.

const lower = (s) => String(s ?? "").trim().toLowerCase();
// Only an https picture: Qloo's image hosts. Nothing else (data:, javascript:, http) reaches an <img>.
const isImage = (url) => typeof url === "string" && /^https:\/\/[^\s"'<>]+$/.test(url);

/** Up to `max` references for a fashion run: [{ name, image, kind, why }]. Fewer than two means no strip. */
export function pickReferences(run, max = 4) {
  const city = run?.stages?.resolve?.output?.city?.name || String(run?.input?.city?.query ?? "").split(",")[0].trim() || "this city";
  const loves = (run?.stages?.resolve?.output?.loves ?? [])
    .filter((l) => l?.name && isImage(l.image))
    .map((l) => ({ name: l.name, image: l.image, kind: l.type || "love", why: "The love you named, as Qloo knows it" }));
  const brandRows = run?.stages?.read?.output?.columns?.brand?.rows ?? [];
  const onlyHere = new Set(brandRows.filter((r) => r?.onlyHere).map((r) => lower(r.name)));
  const labels = (run?.stages?.look?.output?.labels ?? [])
    .filter((l) => l?.name && isImage(l.image))
    .map((l, i) => ({ l, i, only: onlyHere.has(lower(l.name)) }))
    .sort((a, b) => Number(b.only) - Number(a.only) || a.i - b.i)
    .map(({ l, only }) => ({ name: l.name, image: l.image, kind: "brand", why: only ? `${city} favours it; the country's top list doesn't` : `A label ${city} favours` }));
  const seen = new Set();
  const out = [];
  for (const r of [...loves.slice(0, 1), ...labels]) {
    if (seen.has(lower(r.name))) continue;
    seen.add(lower(r.name));
    out.push(r);
    if (out.length === max) break;
  }
  return out.length >= 2 ? out : [];
}
