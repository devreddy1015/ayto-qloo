// The home page's "Now showing" cards and the "Watch it work" walkthrough,
// built from finished runs on this server (the prewarmed showcases first).
import { FORMATS } from "./formats.js";
import { recentRuns } from "./pipeline/store.js";
import { SHOWCASES } from "./presets.js";

const NOUN = { film: "A film", reel: "A reel", fashion: "A drop", podcast: "A podcast", game: "A game", cafe: "A café", event: "A night", book: "A book" };

function card(run) {
  const o = (id) => run.stages?.[id]?.output;
  const r = o("resolve");
  const w = o("write");
  const g = o("gap");
  const l = o("look");
  const p = w?.plan ?? {};
  const type = (FORMATS[run.input?.format] ?? FORMATS.film).types[0];
  const col = o("read")?.columns?.[type];
  return {
    id: run.id,
    url: run.publish?.url,
    showcase: run.showcase,
    format: run.input?.format,
    kicker: `${NOUN[run.input?.format] ?? "An idea"} for ${r?.city?.name ?? ""}`,
    city: r?.city?.name,
    country: r?.city?.market ?? r?.city?.country,
    theme: (r?.theme?.tags ?? []).map((t) => t.name),
    loves: (r?.loves ?? []).map((x) => x.name),
    title: p.titles?.[0] || p.names?.[0] || p.title || p.drop_name || run.publish?.page?.title || `${r?.city?.name ?? ""} ${run.input?.format ?? ""}`.trim(),
    line: p.logline || p.hook || p.positioning || p.premise || p.pitch || p.concept || "",
    lanes: (g?.lanes ?? []).slice(0, 3).map((x) => ({ name: x.name, cityRank: x.cityRank, countryRank: x.countryRank, specific: x.specific, scope: x.scope, supplyCount: x.supplyCount, supplyTotal: x.supplyTotal })),
    look: l ? (l.kind === "fashion" ? [...(l.aesthetics ?? []).slice(0, 3), ...(l.materials?.over ?? []).slice(0, 2)] : (l.styles ?? []).slice(0, 5)).map((x) => ({ name: x.name, lift: x.lift })) : [],
    onlyHere: (col?.onlyHere ?? []).slice(0, 6),
    hiddenGems: (col?.hiddenGems ?? []).slice(0, 3),
    cast: (p.cast_ideas ?? []).slice(0, 3).map((c) => c.name),
    palette: (p.palette ?? []).slice(0, 6).map((c) => ({ name: c.name, hex: c.hex })),
    written: !w?.fallback,
    llm: w?.llm,
    tokens: run.usage ? run.usage.input + run.usage.output : undefined,
    calls: run.ledger?.length ?? 0,
    grounded: o("check") ? { grounded: o("check").grounded, checked: o("check").checked } : undefined,
    at: run.updatedAt,
  };
}

export async function gallery({ limit = 9 } = {}) {
  const runs = (await recentRuns({ limit: 30 })).filter((r) => r.status === "done" && r.stages?.write?.status === "done" && r.publish?.url);
  // One card per showcase (the newest finished one), then other finished runs, newest first.
  const picked = [];
  for (const s of SHOWCASES) {
    const hit = runs.find((r) => r.showcase === s.id);
    if (hit) picked.push(hit);
  }
  for (const r of runs) if (!picked.includes(r) && picked.length < limit) picked.push(r);
  // The same city and format twice is one card: keep the newest.
  const seen = new Set();
  const cards = picked.map(card).filter((c) => {
    const key = `${c.format}|${(c.city ?? "").toLowerCase()}|${c.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const walkthrough = cards.find((c) => c.format === "film" && c.showcase) ?? cards.find((c) => c.format === "film") ?? cards[0];
  return { cards, walkthrough };
}
