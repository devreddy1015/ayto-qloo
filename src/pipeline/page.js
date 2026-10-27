// Server-rendered drop page for a finished run. All text is escaped; the page
// carries no scripts beyond none, so published content can't run code.
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const hex = (h) => (/^#[0-9a-f]{6}$/i.test(String(h)) ? h : "#3b4a8c");

export function renderDropPage(run) {
  const p = run.publish?.page;
  if (!p) return undefined;
  const palette = (p.palette ?? []).slice(0, 6);
  const styles = (p.styles ?? []).slice(0, 6);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.brand)} · ${esc(p.dropName)}</title>
<meta name="description" content="${esc(p.tagline)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:;">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet">
<style>
:root{--ink:#19234d;--paper:#fafbfd;--tape:#f2be22;--soft:#4a557f;--line:#d5d9e6}
@media(prefers-color-scheme:dark){:root{--ink:#e9ecf7;--paper:#111936;--soft:#a9b1d2;--line:#2c376a}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Archivo,system-ui,sans-serif;line-height:1.5}
main{max-width:920px;margin:0 auto;padding:1.5rem 1rem 4rem}
.k{display:inline-block;background:var(--tape);color:#19234d;font-weight:800;padding:.2rem .6rem;border-radius:4px;font-size:.85rem}
h1{font-size:clamp(2.4rem,7vw,4.8rem);line-height:.98;letter-spacing:-.03em;margin:.6rem 0 .4rem;font-variation-settings:"wdth" 125;font-weight:850}
.tag{font-size:1.25rem;color:var(--soft);max-width:40ch}
.story{margin-top:1.5rem;max-width:62ch;font-size:1.05rem}
.pal{display:flex;gap:.5rem;margin-top:1.5rem;flex-wrap:wrap}.pal span{width:64px;height:64px;border-radius:8px;border:1.5px solid var(--line);display:grid;align-items:end;font-size:.65rem;padding:.3rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-top:1.5rem}
.card{border:1.5px solid var(--line);border-radius:10px;padding:1rem;background:color-mix(in srgb,var(--paper) 92%,var(--ink))}
.card h3{margin:0 0 .3rem;font-size:1.05rem}.card p{margin:0;color:var(--soft);font-size:.9rem}.price{margin-top:.6rem;font-weight:800}
.hero{outline:2px solid var(--tape)}
h2{margin-top:2.5rem;font-size:1.4rem;font-variation-settings:"wdth" 125}
.cities{display:flex;flex-wrap:wrap;gap:.5rem}.cities span{border:1.5px solid var(--ink);border-radius:999px;padding:.3rem .8rem;font-weight:650}
.cta{display:inline-block;margin-top:1.5rem;background:var(--ink);color:var(--paper);padding:.9rem 1.4rem;border-radius:6px;font-weight:800;text-decoration:none}
.fine{margin-top:3rem;font-size:.85rem;color:var(--soft);max-width:70ch;border-top:1.5px solid var(--line);padding-top:1rem}
</style></head><body><main>
<span class="k">${esc(p.dropName)}</span>
<h1>${esc(p.brand)}</h1>
<p class="tag">${esc(p.tagline)}</p>
<p class="story">${esc(p.story)}</p>
${palette.length ? `<div class="pal">${palette.map((c) => `<span style="background:${hex(c.hex)}">${esc(c.name)}</span>`).join("")}</div>` : ""}
<h2>The pieces</h2>
<div class="grid">${styles
    .map(
      (s) => `<article class="card${s.hero ? " hero" : ""}"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p>${
        s.colourways?.length ? `<p>${esc(s.colourways.join(" · "))}</p>` : ""
      }<div class="price">₹${esc(s.mrp)}</div></article>`,
    )
    .join("")}</div>
<h2>Landing first in</h2>
<div class="cities">${(p.firstCities ?? []).map((c) => `<span>${esc(c)}</span>`).join("")}</div>
${p.findUs?.length ? `<h2>Find us around</h2><div class="cities">${p.findUs.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
${p.soundtrack?.length ? `<h2>On the speakers</h2><div class="cities">${p.soundtrack.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
<span class="cta">Pre-order on WhatsApp</span>
<p class="fine">Made with Culture Gap for fans of ${esc((p.waves ?? []).join(" and "))}. Taste signals from Qloo (${esc(p.ledgerCount)} requests): ${esc((p.tags ?? []).join(", "))}. Affinity describes aggregate taste, not sales. Prices are the maker's own. The pre-order button is a placeholder until the maker connects a number.</p>
</main></body></html>`;
}
