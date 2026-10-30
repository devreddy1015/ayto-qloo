// The run's main results, first thing on the brief page, so a client sees the answer before the working: what to
// make, the gap it's written into, and the proof that the names came from Qloo (traced, and with vs without Qloo).
// Each tile opens the stage behind it. Only finished stages count; a live run fills the panel as they land.
// highlightData() is plain data, so node can test it; renderHighlights() builds the DOM from it.

const NOUN = { film: "A film", reel: "A reel", fashion: "A fashion drop", podcast: "A podcast", game: "A game", cafe: "A café", event: "A live night", book: "A book" };

// A model's plan can hold a string, a list or an object where text was asked for (as in src/pipeline/share.js).
const first = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : Array.isArray(v) ? first(v[0]) : v && typeof v === "object" ? first(v.title ?? v.name ?? Object.values(v)[0]) : "");
const line = (v) => (typeof v === "string" ? v.trim() : "");
// "the UK's top 30", not "United Kingdom's top 30".
const SHORT = { "United Kingdom": "the UK", "United States": "the US", "United States of America": "the US", Netherlands: "the Netherlands", Philippines: "the Philippines", "United Arab Emirates": "the UAE", "Czech Republic": "the Czech Republic" };
// Qloo's own label can carry a qualifier ("France (terres)"); the panel names the country plainly.
export const countryName = (c) => SHORT[c] ?? String(c ?? "").replace(/\s*\([^)]*\)$/, "");
const and = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0] ?? "");
const names = (list, n) => (Array.isArray(list) ? list.map((x) => first(x?.name ?? x)).filter(Boolean).slice(0, n) : []);

/** Cut long text at a clause when one ends late enough, else at a word, so the panel stays a glance. */
export function clip(text, max = 240) {
  const t = String(text ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const clause = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (clause > max * 0.5) return `${cut.slice(0, clause)}.`;
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** What the panel shows, from the run's finished stages. Null until there is something to show. */
export function highlightData(run) {
  const stages = run?.stages ?? {};
  const out = (id) => (stages[id]?.status === "done" ? stages[id].output ?? null : null);
  const city = out("resolve")?.city;
  const where = { city: city?.name ?? "", country: city?.country ?? city?.market ?? "" };

  const plan = out("write")?.plan;
  const idea = plan
    ? {
        kicker: `${NOUN[run.input?.format] ?? "An idea"}${where.city ? ` for ${where.city}` : ""}`,
        // A brief written without a model can have no title; the share page names it then ("London film").
        title: first(plan.titles) || first(plan.title) || first(plan.drop_name) || first(plan.names) || first(run.publish?.page?.title),
        line: clip(line(plan.logline) || line(plan.hook) || line(plan.positioning) || line(plan.premise) || line(plan.concept) || line(plan.pitch)),
      }
    : null;

  const g = out("gap");
  const lanes = (g?.lanes ?? []).slice(0, 3).map((l) => {
    // lift = country rank − city rank, with a flavour the country doesn't list counted at 31 (src/analysis.js).
    const countryRank = Number.isFinite(l.cityRank) && Number.isFinite(l.lift) ? l.cityRank + l.lift : null;
    return { name: l.name, cityRank: l.cityRank ?? null, countryRank: countryRank && countryRank <= 30 ? countryRank : null, recent: l.supplyRead && Number.isFinite(l.supplyCount) ? l.supplyCount : null };
  });
  const gap = lanes.length ? { lanes, controls: g.controls ?? [], since: g.supplyMinYear ?? null } : null;

  const c = out("check");
  const traced = c && Number.isFinite(c.checked) && c.checked > 0 ? { grounded: c.grounded ?? 0, checked: c.checked } : null;
  const b = out("diff")?.benchmark;
  const versus = b?.withQloo && b?.withoutQloo ? { with: b.withQloo, without: b.withoutQloo } : null;

  const look = out("look");
  const lookWords = look ? (look.kind === "fashion" || look.aesthetics ? [...names(look.aesthetics, 3), ...names(look.materials?.over, 2)] : names(look.styles, 4)) : [];
  const facts = [
    lookWords.length && { label: "The look", value: lookWords.join(" · "), stage: "look" },
    first(plan?.styles?.[0]?.name) && { label: "Hero piece", value: first(plan.styles[0].name), stage: "write" },
    out("spots")?.base?.name && { label: "Shoot base", value: out("spots").base.name, stage: "spots" },
    first(plan?.audio?.artist ?? plan?.audio) && { label: "The track", value: first(plan.audio.artist ?? plan.audio), stage: "audio" },
    line(out("audience")?.summary) && { label: "The crowd", value: out("audience").summary.replace(/\s*From \d+ of .*$/, "").replace(/\.$/, ""), stage: "audience" },
    line(out("travels")?.summary).startsWith("Leans the same way:") && { label: "Travels to", value: out("travels").summary.replace(/^Leans the same way:\s*/, "").replace(/\.$/, ""), stage: "travels" },
  ].filter(Boolean);

  if (!idea && !gap && !traced && !versus) return null;
  return { where, idea, gap, traced, versus, facts, done: run.status === "done" };
}

// ---------- the DOM side ----------

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) k === "text" ? (n.textContent = v) : n.setAttribute(k, v);
  n.append(...children.flat().filter((x) => x !== null && x !== undefined && x !== false && x !== ""));
  return n;
};
const score = (a, b, cls = "") => el("span", { class: `hl-num ${cls}` }, String(a), el("small", { text: `/${b}` }));

/** The panel's children, or [] when the run has nothing to show yet. */
export function renderHighlights(run) {
  const d = highlightData(run);
  if (!d) return [];
  const { where, idea, gap, traced, versus } = d;
  const tiles = [];
  if (gap) {
    const country = countryName(where.country);
    const rank = (l) => [l.cityRank && `#${l.cityRank} in ${where.city || "the city"}`, country && (l.countryRank ? `#${l.countryRank} in ${country}` : `outside ${country}'s top 30`), l.recent !== null && `${l.recent} recent title${l.recent === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
    tiles.push(
      el(
        "a",
        { class: "hl-tile hl-gap", href: "#stage-gap" },
        el("span", { class: "hl-label", text: "The gap: loved here, under-served" }),
        el("ol", { class: "hl-lanes" }, gap.lanes.map((l) => el("li", {}, el("strong", { text: l.name }), el("span", { text: rank(l) })))),
        gap.controls.length ? el("span", { class: "hl-foot", text: `Read against ${country || "the country"} and ${and(gap.controls)}${gap.since && gap.lanes.some((l) => l.recent !== null) ? `; recent means since ${gap.since}` : ""}.` }) : null,
      ),
    );
  }
  if (traced)
    tiles.push(
      el(
        "a",
        { class: "hl-tile", href: "#stage-check" },
        el("span", { class: "hl-label", text: "Traced to Qloo" }),
        score(traced.grounded, traced.checked),
        el("span", { class: "hl-foot", text: traced.grounded === traced.checked ? "Every name in the brief comes from a Qloo request in this run." : "Names in the brief that come from a Qloo request in this run." }),
      ),
    );
  if (versus)
    tiles.push(
      el(
        "a",
        { class: "hl-tile", href: "#stage-diff" },
        el("span", { class: "hl-label", text: "With vs without Qloo" }),
        el("span", { class: "hl-vs" }, score(versus.with.grounded, versus.with.named), el("span", { class: "hl-vs-word", text: "vs" }), score(versus.without.grounded, versus.without.named, "hl-dim")),
        el("span", { class: "hl-foot", text: `Same question, same model. Without Qloo's evidence, ${versus.without.grounded} of ${versus.without.named} names trace.` }),
      ),
    );
  return [
    el("p", { class: "hl-kicker", text: d.done ? "Main results" : "Main results so far" }),
    idea?.title ? el("h2", { class: "hl-title", text: idea.title }) : null,
    idea ? el("p", { class: "hl-line" }, el("span", { class: "hl-what", text: idea.kicker }), idea.line ? ` ${idea.line}` : "") : null,
    tiles.length ? el("div", { class: `hl-grid hl-n${tiles.length}` }, tiles) : null,
    d.facts.length ? el("dl", { class: "hl-facts" }, d.facts.map((f) => el("div", {}, el("dt", { text: f.label }), el("dd", {}, el("a", { href: `#stage-${f.stage}`, text: f.value }))))) : null,
  ].filter(Boolean);
}
