// Server-rendered share page for a finished run. All text is escaped and the
// page carries no scripts, so published content can't run code.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hex = (h) => (/^#[0-9a-f]{6}$/i.test(String(h)) ? h : "#3b4a8c");
const chips = (list = []) => (list.length ? `<div class="chips">${list.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : "");
const section = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
const para = (s) => (s ? `<p>${esc(s)}</p>` : "");

function filmBody(p) {
  return [
    section("Logline", para(p.logline)),
    section("Theme", para(p.theme)),
    p.lane ? section("The lane", para(`${p.lane.flavour}. ${p.lane.why ?? ""}`)) : "",
    p.synopsis ? section("Synopsis", ["act1", "act2", "act3"].map((k, i) => (p.synopsis[k] ? `<p><strong>Act ${i + 1}.</strong> ${esc(p.synopsis[k])}</p>` : "")).join("")) : "",
    p.characters?.length ? section("Characters", `<ul>${p.characters.map((c) => `<li><strong>${esc(c.role)}</strong> ${esc(c.note)}</li>`).join("")}</ul>`) : "",
    p.references?.length ? section("Study these", `<ul>${p.references.map((c) => `<li><strong>${esc(c.title)}</strong> ${esc(c.take)}</li>`).join("")}</ul>`) : "",
    p.soundtrack?.length ? section("Soundtrack", chips(p.soundtrack.map((s) => `${s.artist}${s.use ? ` · ${s.use}` : ""}`))) : "",
    p.travels_next?.length ? section("Travels next", chips(p.travels_next)) : "",
    p.avoid?.length ? section("Avoid", `<ul>${p.avoid.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`) : "",
  ].join("");
}

function reelBody(p) {
  return [
    section("Hook", para(p.hook)),
    p.beats?.length ? section("Beats", `<ol>${p.beats.map((b) => `<li>${esc(b)}</li>`).join("")}</ol>`) : "",
    p.audio?.artist ? section("Audio", para(`${p.audio.artist}. ${p.audio.why ?? ""}`)) : "",
    p.spots?.length ? section("Shoot at", `<ul>${p.spots.map((s) => `<li><strong>${esc(s.name)}</strong> ${esc(s.why)}</li>`).join("")}</ul>`) : "",
    p.references?.length ? section("Nod to", chips(p.references)) : "",
    section("Caption", para(p.caption)),
    p.hashtags?.length ? chips(p.hashtags) : "",
    p.alternates?.length ? section("Or", `<ul>${p.alternates.map((a) => `<li><strong>${esc(a.title)}</strong> ${esc(a.hook)}</li>`).join("")}</ul>`) : "",
  ].join("");
}

function fashionBody(p, pg) {
  return [
    section("Positioning", para(p.positioning)),
    p.palette?.length ? `<div class="pal">${p.palette.slice(0, 6).map((c) => `<span style="background:${hex(c.hex)}">${esc(c.name)}</span>`).join("")}</div>` : "",
    p.styles?.length ? section("The pieces", `<div class="grid">${p.styles.map((s) => `<article class="card${s.hero ? " hero" : ""}"><h3>${esc(s.name)}</h3><p>${esc(s.category)}${s.garment ? ` · ${esc(String(s.garment).replace(/_/g, " "))}` : ""}</p>${s.cues?.length ? `<p>${esc(s.cues.join(" · "))}</p>` : ""}${s.print?.type && s.print.type !== "none" ? `<p>${esc(s.print.type)} print, ${esc(String(s.print.placement ?? "").replace(/_/g, " "))}${s.print.motif ? `: ${esc(s.print.motif)}` : ""}</p>` : ""}${s.colourways?.length ? `<p>${esc(s.colourways.join(" · "))}</p>` : ""}</article>`).join("")}</div>`) : "",
    p.brands_to_study?.length ? section("Study these", chips(p.brands_to_study)) : "",
    p.first_cities?.length ? section("Land first in", chips(p.first_cities)) : "",
    p.soundtrack?.length ? section("Launch soundtrack", chips(p.soundtrack)) : "",
    p.channels?.length ? section("Channels", chips(p.channels)) : "",
    pg.produce?.mrp ? section("First run (editable assumptions)", para(`MRP ₹${pg.produce.mrp} incl. ${Math.round((pg.produce.gstRate ?? 0) * 100)}% GST · ${pg.produce.totalUnits} units` + (pg.produce.allocation?.length ? ` · ${pg.produce.allocation.map((a) => `${a.city} ${a.units}`).join(", ")}` : ""))) : "",
  ].join("");
}

const LABEL = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const SKIP = new Set(["titles", "names", "fallback", "lane"]);
/** Any format: strings as paragraphs, string lists as chips, object lists as bullet lists, objects as lines. */
function genericBody(p) {
  const out = [];
  if (p.lane?.flavour) out.push(section("The lane", para(`${p.lane.flavour}. ${p.lane.why ?? ""}`)));
  for (const [k, v] of Object.entries(p)) {
    if (SKIP.has(k) || v === undefined || v === null || v === "") continue;
    if (typeof v === "string") out.push(section(LABEL(k), para(v)));
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out.push(v.length ? section(LABEL(k), chips(v)) : "");
    else if (Array.isArray(v)) out.push(v.length ? section(LABEL(k), `<ul>${v.map((x) => `<li>${Object.entries(x ?? {}).map(([kk, vv], i) => (i === 0 ? `<strong>${esc(vv)}</strong>` : esc(String(vv ?? "")))).join(" ")}</li>`).join("")}</ul>`) : "");
    else if (typeof v === "object") out.push(section(LABEL(k), para(Object.values(v).filter((x) => typeof x === "string" && x).join(". "))));
  }
  return out.join("");
}

export function renderSharePage(run) {
  const pg = run.publish?.page;
  if (!pg) return undefined;
  const p = pg.plan ?? {};
  const body = pg.format === "reel" ? reelBody(p) : pg.format === "fashion" ? fashionBody(p, pg) : pg.format === "film" ? filmBody(p) : genericBody(p);
  const NOUN = { film: "A film", reel: "A reel", fashion: "A drop", podcast: "A podcast", game: "A game", cafe: "A café", event: "A night", book: "A book" };
  const kicker = `${NOUN[pg.format] ?? "An idea"} for ${pg.city}`;
  const fine = `Built with AYTO on Qloo taste signals (${pg.ledgerCount} requests)${pg.grounded ? `; ${pg.grounded.grounded} of ${pg.grounded.checked} names trace to Qloo` : ""}. Qloo describes aggregate taste, not individuals and not sales. ${pg.fallback ? "Written from the evidence template without a language model." : `Written with ${pg.llm?.provider ?? "a language model"}${pg.llm?.model ? ` (${pg.llm.model})` : ""}.`}${pg.usage?.calls ? ` Model tokens: ${pg.usage.input + pg.usage.output} over ${pg.usage.calls} call${pg.usage.calls === 1 ? "" : "s"}${pg.usage.byok ? ", on the maker's own key" : ""}.` : ""}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pg.title)} · AYTO</title>
<meta name="description" content="${esc(p.logline ?? p.hook ?? p.positioning ?? kicker)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:;">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet">
<style>
:root{--ink:#19234d;--paper:#fafbfd;--tape:#f2be22;--soft:#4a557f;--line:#d5d9e6}
@media(prefers-color-scheme:dark){:root{--ink:#e9ecf7;--paper:#111936;--soft:#a9b1d2;--line:#2c376a}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Archivo,system-ui,sans-serif;line-height:1.5}
main{max-width:860px;margin:0 auto;padding:1.5rem 1rem 4rem}
.k{display:inline-block;background:var(--tape);color:#19234d;font-weight:800;padding:.2rem .6rem;border-radius:4px;font-size:.85rem}
h1{font-size:clamp(2.2rem,6.5vw,4.4rem);line-height:.98;letter-spacing:-.03em;margin:.6rem 0 .6rem;font-variation-settings:"wdth" 125;font-weight:850}
h2{margin-top:2rem;font-size:1.3rem;font-variation-settings:"wdth" 125}
p,li{max-width:66ch;font-size:1.05rem}ul,ol{padding-left:1.2rem}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}.chips span{border:1.5px solid var(--ink);border-radius:999px;padding:.3rem .8rem;font-weight:650}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;color:var(--soft);font-size:.95rem}
.pal{display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap}.pal span{width:64px;height:64px;border-radius:8px;border:1.5px solid var(--line);display:grid;align-items:end;font-size:.65rem;padding:.3rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-top:1rem}
.card{border:1.5px solid var(--line);border-radius:10px;padding:1rem}.card h3{margin:0 0 .3rem}.card p{margin:0;color:var(--soft);font-size:.9rem}.hero{outline:2px solid var(--tape)}
.lanes{margin-top:1rem}.lane{display:flex;align-items:center;gap:.8rem;margin:.4rem 0}.lane b{min-width:10rem}.bar{height:10px;background:var(--tape);border-radius:5px}
.fine{margin-top:3rem;font-size:.85rem;color:var(--soft);max-width:70ch;border-top:1.5px solid var(--line);padding-top:1rem}
</style></head><body><main>
<span class="k">${esc(kicker)}</span>
<h1>${esc(pg.title)}</h1>
<div class="meta">${[...(pg.theme ?? []), ...(pg.loves ?? [])].map((x) => `<span>${esc(x)}</span>`).join(" · ")}</div>
${pg.lanes?.length ? `<h2>The gap</h2><div class="lanes">${pg.lanes.map((l) => `<div class="lane"><b>${esc(l.name)}</b><div class="bar" style="width:${Math.round((l.gap ?? 0) * 220)}px"></div><span>${esc(pg.city)} #${esc(l.cityRank)} · ${esc(pg.country)} #${esc(l.countryRank ?? "–")}${l.supplyCount !== undefined ? ` · ${esc(l.supplyCount)} recent` : ""}</span></div>`).join("")}</div>` : ""}
${body}
<p class="fine">${esc(fine)}</p>
</main></body></html>`;
}
