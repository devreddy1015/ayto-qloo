// The reference strip under a fashion drop's 3D preview: three or four pictures, every one from Qloo's own read of
// this run, never from a web search. Photos lead: the love the maker named (its Qloo entity's image), then up to two
// style icons the city's crowd follows (the audio stage's artists, which carry Qloo photos), then the fashion labels
// the city favours, those missing from the country's top list first (Qloo's picture of a label is its logo). Each
// picture is a receipt: its name traces to a Qloo request. Pure, so it runs in the browser and in tests.

const lower = (s) => String(s ?? "").trim().toLowerCase();
// Only an https picture: Qloo's image hosts. Nothing else (data:, javascript:, http) reaches an <img>.
const isImage = (url) => typeof url === "string" && /^https:\/\/[^\s"'<>]+$/.test(url);

/** Up to `max` references for a fashion run: [{ name, image, kind, tag, why }]. Fewer than two means no strip. */
export function pickReferences(run, max = 4) {
  const city = run?.stages?.resolve?.output?.city?.name || String(run?.input?.city?.query ?? "").split(",")[0].trim() || "this city";
  const loves = (run?.stages?.resolve?.output?.loves ?? [])
    .filter((l) => l?.name && isImage(l.image))
    .map((l) => ({ name: l.name, image: l.image, kind: "love", tag: "Your love", why: "as Qloo knows it" }));
  const icons = (run?.stages?.audio?.output?.shortlist ?? [])
    .filter((a) => a?.name && isImage(a.image))
    .map((a) => ({ name: a.name, image: a.image, kind: "artist", tag: "Style icon", why: String(a.why ?? "").trim() || `followed in ${city}` }));
  const brandRows = run?.stages?.read?.output?.columns?.brand?.rows ?? [];
  const onlyHere = new Set(brandRows.filter((r) => r?.onlyHere).map((r) => lower(r.name)));
  const labels = (run?.stages?.look?.output?.labels ?? [])
    .filter((l) => l?.name && isImage(l.image))
    .map((l, i) => ({ l, i, only: onlyHere.has(lower(l.name)) }))
    .sort((a, b) => Number(b.only) - Number(a.only) || a.i - b.i)
    .map(({ l, only }) => ({ name: l.name, image: l.image, kind: "brand", tag: "Label", why: only ? `${city} favours it; the country's top list doesn't` : `${city} favours it` }));
  const seen = new Set();
  const out = [];
  // Two icons before the labels; more icons only when there are too few labels to fill the strip.
  for (const r of [...loves.slice(0, 1), ...icons.slice(0, 2), ...labels, ...icons.slice(2)]) {
    if (seen.has(lower(r.name))) continue;
    seen.add(lower(r.name));
    out.push(r);
    if (out.length === max) break;
  }
  return out.length >= 2 ? out : [];
}
