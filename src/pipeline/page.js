// Server-rendered share page for a finished run. All text is escaped and the
// page carries no scripts, so published content can't run code.
import { WRITE_LANGUAGES } from "../languages.js";

// The AYTO mark (public/icon.svg) as a data URI, so the share page needs no request outside its own CSP.
const ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b0b0d"/><path d="M25.487 15.503A9.5 9.5 0 1 1 16.497 6.513" fill="none" stroke="#f5f5f7" stroke-width="4.4" stroke-linecap="round"/><circle cx="22.718" cy="9.282" r="2.7" fill="#f2be22"/></svg>')}`;
const BRAND = '<a class="brand" href="/" aria-label="AYTO home"><span aria-hidden="true">AYT</span><svg viewBox="4 4 24 24" aria-hidden="true"><path d="M25.487 15.503A9.5 9.5 0 1 1 16.497 6.513"/><circle cx="22.718" cy="9.282" r="2.7"/></svg></a>';
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hex = (h) => (/^#[0-9a-f]{6}$/i.test(String(h)) ? h : "#3b4a8c");
// A model's plan can hold a string where a list was asked for, a list of lists, or an object where text was.
// Every field is read through these, so nothing prints as [object Object] or one letter per line.
const arr = (v) => (Array.isArray(v) ? v.flat(Infinity) : v === undefined || v === null || v === "" ? [] : [v]);
const txt = (v) => (v === undefined || v === null || typeof v === "boolean" ? "" : typeof v === "string" ? v : typeof v === "number" ? String(v) : Array.isArray(v) ? v.map(txt).filter(Boolean).join(", ") : txt(v.title ?? v.name ?? v.artist ?? v.shot ?? v.text ?? Object.values(v).filter((x) => typeof x === "string" || typeof x === "number").join(" · ")));
/** A list item as an object: a plain string stands for its name or title. */
const rec = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : { title: txt(v), name: txt(v), artist: txt(v) });
const chips = (list = []) => {
  const items = arr(list).map(txt).filter(Boolean);
  return items.length ? `<div class="chips">${items.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : "";
};
const section = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
const para = (s) => (txt(s) ? `<p>${esc(txt(s))}</p>` : "");

function filmBody(p) {
  const li = (items) => (items.length ? `<ul>${items.join("")}</ul>` : "");
  const palette = arr(p.palette).filter((c) => /^#[0-9a-f]{6}$/i.test(String(c?.hex)));
  const synopsis = p.synopsis && typeof p.synopsis === "object" ? p.synopsis : undefined;
  const camera = p.camera && typeof p.camera === "object" ? p.camera : {};
  const base = p.shoot_base && typeof p.shoot_base === "object" ? p.shoot_base : p.shoot_base ? { name: txt(p.shoot_base) } : undefined;
  return [
    section("Logline", para(p.logline)),
    section("Theme", para(p.theme)),
    section("Look", para(p.look)),
    p.lane ? section("The lane", para(`${txt(p.lane.flavour ?? p.lane)}. ${txt(p.lane.why)}`)) : "",
    synopsis && Object.values(synopsis).some(Boolean) ? section("Synopsis", ["act1", "act2", "act3"].map((k, i) => (txt(synopsis[k]) ? `<p><strong>Act ${i + 1}.</strong> ${esc(txt(synopsis[k]))}</p>` : "")).join("")) : section("Synopsis", typeof p.synopsis === "string" ? para(p.synopsis) : ""),
    arr(p.beats).length ? section("Beats", `<ol>${arr(p.beats).map(rec).map((b) => `<li><strong>${esc(txt(b.title))}</strong> ${esc(txt(b.what))}${txt(b.where) || txt(b.after) ? `<br><small>${[txt(b.where) && `At ${esc(txt(b.where))}`, txt(b.after) && `after ${esc(txt(b.after))}`].filter(Boolean).join(" · ")}</small>` : ""}</li>`).join("")}</ol>`) : "",
    arr(p.characters).length ? section("Characters", li(arr(p.characters).map(rec).map((c) => `<li><strong>${esc(txt(c.name ?? c.role))}</strong>${c.name && c.role ? ` ${esc(txt(c.role))}` : ""}${[txt(c.wants) && `Wants: ${txt(c.wants)}`, txt(c.hides) && `Hides: ${txt(c.hides)}`, txt(c.look) && `Look: ${txt(c.look)}`, txt(c.arc) && `Arc: ${txt(c.arc)}`, txt(c.note)].filter(Boolean).map((x) => `<br><small>${esc(x)}</small>`).join("")}</li>`))) : "",
    arr(p.references).length ? section("Study these", li(arr(p.references).map(rec).map((c) => `<li><strong>${esc(txt(c.title ?? c.name))}</strong> ${esc(txt(c.borrow ?? c.take))}</li>`))) : "",
    arr(p.cast_ideas).length ? section("Cast ideas", li(arr(p.cast_ideas).map(rec).map((c) => `<li><strong>${esc(txt(c.name))}</strong>${txt(c.role) ? ` as ${esc(txt(c.role))}` : ""}${txt(c.why) ? ` · ${esc(txt(c.why))}` : ""}</li>`))) : "",
    base?.name || arr(p.locations).length ? section("Where to shoot", `${base?.name ? para(`Base: ${txt(base.name)}. ${txt(base.why)}`) : ""}${li(arr(p.locations).map(rec).map((l) => `<li><strong>${esc(txt(l.name))}</strong>${txt(l.beat) ? ` (beat ${esc(txt(l.beat))})` : ""} ${esc(txt(l.use))}</li>`))}`) : "",
    arr(camera.lighting).length || arr(camera.shots).length ? section("Camera and light", `${li(arr(camera.lighting).map((x) => `<li>${esc(txt(x))}</li>`))}${li(arr(camera.shots).map((x) => `<li>${esc(typeof x === "object" && x ? [txt(x.shot), txt(x.lens)].filter(Boolean).join(", ") : txt(x))}</li>`))}`) : "",
    palette.length ? section("Palette", `<div class="pal">${palette.slice(0, 6).map((c) => `<span style="background:${hex(c.hex)}">${esc(txt(c.name))} ${esc(c.hex)}</span>`).join("")}</div>`) : "",
    arr(p.soundtrack).length ? section("Soundtrack", chips(arr(p.soundtrack).map(rec).map((s) => `${txt(s.artist ?? s.name)}${txt(s.use) ? ` · ${txt(s.use)}` : ""}${txt(s.beat) ? ` · beat ${txt(s.beat)}` : ""}`))) : "",
    arr(p.travels_next).length ? section("Travels next", chips(p.travels_next)) : "",
    arr(p.avoid).length ? section("Avoid", li(arr(p.avoid).map((a) => `<li>${esc(txt(a))}</li>`))) : "",
  ].join("");
}

function reelBody(p) {
  const audio = p.audio && typeof p.audio === "object" ? p.audio : p.audio ? { artist: txt(p.audio) } : undefined;
  return [
    section("Hook", para(p.hook)),
    arr(p.beats).length ? section("Beats", `<ol>${arr(p.beats).map((b) => `<li>${esc(txt(b))}</li>`).join("")}</ol>`) : "",
    txt(audio?.artist) ? section("Audio", para(`${txt(audio.artist)}. ${txt(audio.why)}`)) : "",
    arr(p.spots).length ? section("Shoot at", `<ul>${arr(p.spots).map(rec).map((s) => `<li><strong>${esc(txt(s.name))}</strong> ${esc(txt(s.why))}</li>`).join("")}</ul>`) : "",
    arr(p.references).length ? section("Nod to", chips(p.references)) : "",
    section("Caption", para(p.caption)),
    chips(p.hashtags),
    arr(p.alternates).length ? section("Or", `<ul>${arr(p.alternates).map(rec).map((a) => `<li><strong>${esc(txt(a.title))}</strong> ${esc(txt(a.hook))}</li>`).join("")}</ul>`) : "",
  ].join("");
}

function fashionBody(p, pg) {
  const styles = arr(p.styles).filter((s) => s && typeof s === "object");
  return [
    section("Positioning", para(p.positioning)),
    arr(p.palette).length ? `<div class="pal">${arr(p.palette).slice(0, 6).map(rec).map((c) => `<span style="background:${hex(c.hex)}">${esc(txt(c.name))}</span>`).join("")}</div>` : "",
    styles.length ? section("The pieces", `<div class="grid">${styles.map((s) => `<article class="card${s.hero ? " hero" : ""}"><h3>${esc(txt(s.name))}</h3><p>${esc(txt(s.category))}${typeof s.garment === "string" ? ` · ${esc(s.garment.replace(/_/g, " "))}` : ""}</p>${arr(s.cues).length ? `<p>${esc(arr(s.cues).map(txt).join(" · "))}</p>` : ""}${s.print && typeof s.print === "object" && s.print.type && s.print.type !== "none" ? `<p>${esc(txt(s.print.type))} print, ${esc(txt(s.print.placement).replace(/_/g, " "))}${txt(s.print.motif) ? `: ${esc(txt(s.print.motif))}` : ""}</p>` : ""}${arr(s.colourways).length ? `<p>${esc(arr(s.colourways).map(txt).join(" · "))}</p>` : ""}</article>`).join("")}</div>`) : "",
    arr(p.brands_to_study).length ? section("Study these", chips(p.brands_to_study)) : "",
    arr(p.first_cities).length ? section("Land first in", chips(p.first_cities)) : "",
    arr(p.soundtrack).length ? section("Launch soundtrack", chips(p.soundtrack)) : "",
    arr(p.channels).length ? section("Channels", chips(p.channels)) : "",
    pg.produce?.mrp ? section("First run (editable assumptions)", para(`MRP ₹${pg.produce.mrp} incl. ${Math.round((pg.produce.gstRate ?? 0) * 100)}% GST · ${pg.produce.totalUnits} units` + (pg.produce.allocation?.length ? ` · ${pg.produce.allocation.map((a) => `${a.city} ${a.units}`).join(", ")}` : ""))) : "",
  ].join("");
}

const LABEL = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const SKIP = new Set(["titles", "names", "fallback", "lane"]);
/** Any format: strings as paragraphs, string lists as chips, object lists as bullet lists, objects as lines. */
function genericBody(p) {
  const out = [];
  if (p.lane?.flavour) out.push(section("The lane", para(`${txt(p.lane.flavour)}. ${txt(p.lane.why)}`)));
  for (const [k, v] of Object.entries(p)) {
    if (SKIP.has(k) || v === undefined || v === null || v === "" || typeof v === "boolean") continue;
    const list = arr(v);
    if (typeof v === "string" || typeof v === "number") out.push(section(LABEL(k), para(v)));
    else if (Array.isArray(v) && list.every((x) => typeof x === "string" || typeof x === "number")) out.push(list.length ? section(LABEL(k), chips(list)) : "");
    // A list of records: the first field bold, the rest as text; a plain string in the list stays whole.
    else if (Array.isArray(v)) out.push(list.length ? section(LABEL(k), `<ul>${list.map((x) => `<li>${x && typeof x === "object" ? Object.values(x).map((vv, i) => (i === 0 ? `<strong>${esc(txt(vv))}</strong>` : esc(txt(vv)))).join(" ") : esc(txt(x))}</li>`).join("")}</ul>`) : "");
    else if (typeof v === "object") out.push(section(LABEL(k), para(Object.values(v).map(txt).filter(Boolean).join(". "))));
  }
  return out.join("");
}

/** The same page as Markdown, for a producer's inbox or a sampling room. */
export function renderShareMarkdown(run) {
  const pg = run.publish?.page;
  if (!pg) return undefined;
  const p = pg.plan ?? {};
  const NOUN = { film: "A film", reel: "A reel", fashion: "A drop", podcast: "A podcast", game: "A game", cafe: "A café", event: "A night", book: "A book" };
  const lines = [`# ${pg.title}`, "", `${NOUN[pg.format] ?? "An idea"} for ${pg.city}${arr(pg.theme).length ? ` · ${arr(pg.theme).map(txt).join(", ")}` : ""}${arr(pg.loves).length ? ` · ${arr(pg.loves).map(txt).join(", ")}` : ""}`, ""];
  if (arr(pg.lanes).length) {
    lines.push("## The gap", "");
    for (const l of arr(pg.lanes).map(rec)) lines.push(`- **${l.name}**: ${pg.city} #${l.cityRank} · ${pg.country} #${l.countryRank ?? "–"}${l.supplyCount !== undefined ? ` · ${l.supplyCount} recent titles` : ""}`);
    lines.push("");
  }
  const label = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const present = (vv) => vv !== undefined && vv !== null && vv !== "" && typeof vv !== "boolean" && !(Array.isArray(vv) && !vv.length) && !(typeof vv === "object" && !Array.isArray(vv) && !Object.values(vv).some((x) => x !== undefined && x !== ""));
  // Nested values flatten to text: lists join, objects become "key value" pairs, so nothing prints as [object Object].
  const flat = (vv) => {
    if (Array.isArray(vv)) return vv.map(flat).join(", ");
    if (!vv || typeof vv !== "object") return String(vv);
    const entries = Object.entries(vv).filter(([, x]) => present(x));
    // A one-field object ({ title }, { name }) is just its value.
    return entries.length === 1 ? flat(entries[0][1]) : entries.map(([k, x]) => `${k.replace(/_/g, " ")} ${flat(x)}`).join(", ");
  };
  const skip = new Set(["titles", "names", "fallback", "title", "drop_name"]);
  for (const [k, v] of Object.entries(p)) {
    if (skip.has(k) || v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    lines.push(`## ${label(k)}`, "");
    if (typeof v === "string") lines.push(v, "");
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) lines.push(...v.map((x) => `- ${x}`), "");
    else if (Array.isArray(v)) lines.push(...v.flat(Infinity).map((x) => (x && typeof x === "object" ? `- ${Object.entries(x).filter(([, vv]) => present(vv)).map(([kk, vv], i) => (i === 0 ? `**${flat(vv)}**` : `${label(kk).toLowerCase()}: ${flat(vv)}`)).join(" · ")}` : `- ${flat(x)}`)), "");
    else if (typeof v === "object") lines.push(...Object.entries(v).filter(([, vv]) => present(vv)).map(([kk, vv]) => `- ${label(kk)}: ${flat(vv)}`), "");
  }
  if (pg.produce?.mrp) lines.push("## First run (editable assumptions)", "", `MRP ₹${pg.produce.mrp} incl. ${Math.round((pg.produce.gstRate ?? 0) * 100)}% GST · ${pg.produce.totalUnits} units${pg.produce.allocation?.length ? ` · ${pg.produce.allocation.map((a) => `${a.city} ${a.units}`).join(", ")}` : ""}`, "");
  lines.push("---", "", `Built with AYTO on Qloo taste signals (${pg.ledgerCount} requests)${pg.grounded ? `; ${pg.grounded.grounded} of ${pg.grounded.checked} names trace to Qloo` : ""}. Qloo describes aggregate taste, not individuals and not sales.${pg.usage?.calls ? ` Model tokens: ${pg.usage.input + pg.usage.output} over ${pg.usage.calls} calls.` : ""}`, "");
  return lines.join("\n");
}

export function renderSharePage(run) {
  const pg = run.publish?.page;
  if (!pg) return undefined;
  const p = pg.plan ?? {};
  const body = pg.format === "reel" ? reelBody(p) : pg.format === "fashion" ? fashionBody(p, pg) : pg.format === "film" ? filmBody(p) : genericBody(p);
  const NOUN = { film: "A film", reel: "A reel", fashion: "A drop", podcast: "A podcast", game: "A game", cafe: "A café", event: "A night", book: "A book" };
  const kicker = `${NOUN[pg.format] ?? "An idea"} for ${pg.city}`;
  const fine = `Built with AYTO on Qloo taste signals (${pg.ledgerCount} requests)${pg.grounded ? `; ${pg.grounded.grounded} of ${pg.grounded.checked} names trace to Qloo` : ""}. Qloo describes aggregate taste, not individuals and not sales. ${pg.fallback ? "Written from the evidence template without a language model." : `Written${pg.language && pg.language !== "English" ? ` in ${pg.language}` : ""} with ${pg.llm?.provider ?? "a language model"}${pg.llm?.model ? ` (${pg.llm.model})` : ""}.`}${pg.usage?.calls ? ` Model tokens: ${pg.usage.input + pg.usage.output} over ${pg.usage.calls} call${pg.usage.calls === 1 ? "" : "s"}${pg.usage.byok ? ", on the maker's own key" : ""}.` : ""}`;
  // Each section gets an index for its entrance delay; the title's words rise one by one.
  const staged = body.split(/(?=<h2)/).filter(Boolean).map((part, i) => `<section class="s" style="--i:${i + 1}">${part}</section>`).join("");
  const titleWords = String(pg.title).split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(" ");
  // A brief written in Telugu (or another language): the written parts carry its lang, and its script's web font loads.
  const lang = WRITE_LANGUAGES[pg.language];
  const langAttr = lang && lang.code !== "en" ? ` lang="${lang.code}"` : "";
  const font = lang?.font ? `,"${lang.font}"` : "";
  const fontLink = lang?.font ? `&family=${lang.font.replace(/ /g, "+")}:wght@400..700` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pg.title)} · AYTO</title>
<link rel="icon" href="${ICON}" type="image/svg+xml"><meta name="theme-color" content="#0b0b0d">
<meta name="description" content="${esc(p.logline ?? p.hook ?? p.positioning ?? kicker)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:;">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700${fontLink}&display=swap" rel="stylesheet">
<style>
:root{--ink:#eef0f7;--paper:#0b0b0d;--tape:#f2be22;--soft:#aab0c4;--line:rgba(255,255,255,.12);--glow:rgba(242,190,34,.14);--rise:.9s;--ease:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Archivo"${font},system-ui,sans-serif;line-height:1.55;font-size:17px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:-20%;z-index:0;pointer-events:none;background:radial-gradient(60% 50% at 20% 10%,var(--glow),transparent 60%),radial-gradient(40% 40% at 85% 80%,rgba(120,140,255,.10),transparent 60%);animation:drift 28s ease-in-out infinite alternate}
main{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1,h2,h3{font-weight:700;text-wrap:balance}
.brand{display:inline-flex;align-items:baseline;margin-bottom:1.6rem;color:var(--ink);text-decoration:none;font-weight:700;font-size:1rem;animation:fade var(--rise) var(--ease) both}.brand svg{width:.8em;height:.8em;margin-left:0;overflow:visible;transform:translateY(.03em)}.brand path{fill:none;stroke:currentColor;stroke-width:4.8;stroke-linecap:round}.brand circle{fill:var(--tape)}.brand:hover{color:var(--tape)}
.k{display:inline-block;position:relative;color:#19234d;font-weight:700;padding:.3rem .7rem;border-radius:4px;font-size:.875rem;background:var(--tape);transform-origin:left center;animation:wipe .7s var(--ease) both}
h1{font-size:clamp(2.8rem,8vw,5.6rem);line-height:.96;margin:.7rem 0 1rem;font-weight:600}
h1 .w{display:inline-block;animation:rise var(--rise) var(--ease) both;animation-delay:calc(.15s + var(--i) * .07s)}
h2{margin:2.4rem 0 .6rem;font-size:1.6rem}
h2::before{content:"";display:inline-block;width:.55em;height:.55em;margin-right:.55rem;border-radius:999px;background:var(--tape);transform:translateY(-.1em)}
p,li{max-width:66ch;font-size:1rem}p{margin:.4rem 0 .8rem}ul,ol{padding-left:1.2rem}li{margin:.25rem 0}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;color:var(--soft);font-size:.875rem;animation:fade var(--rise) var(--ease) .4s both}
.meta span{border:1px solid var(--line);border-radius:999px;padding:.2rem .7rem}
.tools{display:flex;gap:.6rem;margin-top:1.1rem;flex-wrap:wrap;animation:fade var(--rise) var(--ease) .55s both}
.tools a{border:1.5px solid var(--ink);border-radius:8px;padding:.5rem .9rem;font-weight:600;text-decoration:none;color:var(--ink);transition:background .25s var(--ease),color .25s var(--ease),transform .25s var(--ease)}
.tools a:hover{background:var(--ink);color:var(--paper);transform:translateY(-1px)}
.s{animation:rise var(--rise) var(--ease) both;animation-delay:calc(.5s + var(--i) * .12s)}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
.chips span{border:1.5px solid var(--ink);border-radius:999px;padding:.35rem .85rem;font-weight:600;transition:transform .25s var(--ease),background .25s var(--ease),color .25s var(--ease)}
.chips span:hover{transform:translateY(-2px);background:var(--ink);color:var(--paper)}
.pal{display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap}.pal span{width:68px;height:68px;border-radius:10px;border:1.5px solid var(--line);display:grid;align-items:end;font-size:.875rem;padding:.3rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);transition:transform .3s var(--ease)}.pal span:hover{transform:scale(1.06) rotate(-2deg)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-top:1rem}
.card{border:1.5px solid var(--line);border-radius:12px;padding:1rem;background:rgba(255,255,255,.03);transition:transform .3s var(--ease),border-color .3s var(--ease)}.card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.3)}
.card h3{margin:0 0 .3rem;font-size:1.25rem}.card p{margin:0;color:var(--soft);font-size:.875rem}.hero{outline:2px solid var(--tape)}
.lanes{margin-top:1rem}.lane{display:grid;grid-template-columns:minmax(8rem,12rem) 1fr;align-items:center;gap:.8rem;margin:.5rem 0}.lane b{font-weight:600;font-size:1.25rem}
.lane .bar{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--tape),#ffd96a);transform-origin:left;animation:grow 1.1s var(--ease) 1s both}
.lane span{display:block;color:var(--soft);font-size:.875rem}
.fine{margin-top:3.5rem;font-size:.875rem;color:var(--soft);max-width:70ch;border-top:1px solid var(--line);padding-top:1rem}
@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(3%,2%,0) scale(1.06)}}
@media (max-width:560px){.lane{grid-template-columns:1fr;gap:.3rem}.lane b{font-size:1.25rem}main{padding:1.5rem 1rem 4rem}h2{font-size:1.6rem}}
@media (prefers-reduced-motion:reduce){h1 .w,.s,.meta,.tools,.k,.lane .bar{animation:fade .4s ease both}body::before{animation:none}.chips span,.card,.pal span,.tools a{transition:none}}
@media print{:root{--ink:#111;--paper:#fff;--soft:#444;--line:#bbb}.brand{animation:none}body{background:#fff;color:#111}body::before{display:none}main{max-width:none;padding:0}.tools{display:none}h1 .w,.s,.meta,.k,.lane .bar{animation:none;opacity:1;transform:none}.chips span,.card{border-color:#999}h1{font-size:2.4rem}a{color:inherit}}
</style></head><body><main>
${BRAND}<br>
<span class="k">${esc(kicker)}</span>
<h1${langAttr}>${titleWords}</h1>
<div class="meta">${[...arr(pg.theme), ...arr(pg.loves)].map((x) => `<span>${esc(txt(x))}</span>`).join(" · ")}</div>
<div class="tools"><a href="${esc(run.publish.url)}.md" download>Download as Markdown</a><a href="${esc(run.publish.url)}">Print or save as PDF: Ctrl+P</a></div>
${arr(pg.lanes).length ? `<section class="s" style="--i:0"><h2>The gap</h2><div class="lanes">${arr(pg.lanes).map(rec).map((l) => `<div class="lane"><b>${esc(l.name)}</b><div><div class="bar" style="width:${Math.max(8, Math.round((l.gap ?? 0) * 100))}%"></div><span>${esc(pg.city)} #${esc(l.cityRank)} · ${esc(pg.country)} #${esc(l.countryRank ?? "–")}${l.supplyCount !== undefined ? ` · ${esc(l.supplyCount)} recent` : ""}</span></div></div>`).join("")}</div></section>` : ""}
<div${langAttr}>${staged}</div>
<p class="fine">${esc(fine)}</p>
</main></body></html>`;
}
