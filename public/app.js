// Culture Gap front end: one run = eleven stage cards, a stage rail, receipts,
// edit-and-rerun. Vanilla JS; everything from Qloo or the model is inserted as text.

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const MAX_MARKETS = 3;
const state = { markets: new Set(), run: null, stages: [], source: null, maps: new Map() };

// ---------- setup ----------

async function init() {
  let presets = { examples: [], markets: [], stages: [], mode: "live", llm: true };
  try {
    presets = await (await fetch("/api/presets")).json();
  } catch {}
  state.stages = presets.stages;

  const chips = $("#market-chips");
  for (const market of presets.markets) {
    chips.append(el("button", { type: "button", class: "chip", "aria-pressed": "false", "data-market": market, text: market, onclick: () => toggleMarket(market) }));
  }
  const list = $("#example-list");
  for (const example of presets.examples) {
    list.append(el("button", { type: "button", class: "example", title: example.text, text: example.label, onclick: () => startRun({ example: example.id }, example) }));
  }
  if (presets.mode === "samples") {
    const note = $("#mode-note");
    note.hidden = false;
    note.textContent = "Demo mode: replaying recorded Qloo responses, so only the showcase runs work right now.";
  }
  if (!presets.llm) $("#mode-note").textContent += " The language model is off; stages fall back to templates.";

  $("#run-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("#text-input").value.trim();
    if (!text) return;
    startRun({ text, markets: [...state.markets], maker: $("#maker").value || undefined, city: $("#city").value.trim() || undefined });
  });
  $("#ask-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("#ask-input").value.trim();
    if (q) ask(q);
  });

  const match = location.pathname.match(/^\/run\/([A-Za-z0-9_-]+)/);
  if (match) attach(match[1]);
}

function toggleMarket(market) {
  if (state.markets.has(market)) state.markets.delete(market);
  else if (state.markets.size < MAX_MARKETS) state.markets.add(market);
  for (const chip of document.querySelectorAll(".chip[data-market]")) {
    const on = state.markets.has(chip.dataset.market);
    chip.setAttribute("aria-pressed", String(on));
    chip.disabled = !on && state.markets.size >= MAX_MARKETS;
  }
}

// ---------- runs ----------

async function startRun(payload, example) {
  if (example) $("#text-input").value = example.text;
  const button = $("#run-button");
  button.disabled = true;
  button.textContent = "Starting…";
  try {
    const response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
    history.pushState(null, "", `/run/${json.id}`);
    attach(json.id);
  } catch (error) {
    resetResults();
    showError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Run the agents";
  }
}

function resetResults() {
  state.run = null;
  for (const map of state.maps.values()) map.remove();
  state.maps.clear();
  $("#results").hidden = false;
  $("#error-box").hidden = true;
  $("#ask").hidden = true;
  $("#trace-list").replaceChildren();
  $("#ask-thread").replaceChildren();
  $("#stage-cards").replaceChildren(...state.stages.map((s) => stageCard(s)));
  $("#stage-rail").replaceChildren(
    ...state.stages.map((s, i) =>
      el("li", { class: "rail-item pending", "data-stage": s.id }, el("a", { href: `#stage-${s.id}` }, el("span", { class: "rail-num", text: i + 1 }), el("span", {}, el("strong", { text: s.label }), el("small", { text: s.output })))),
    ),
  );
  $("#results").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
}

function attach(runId) {
  resetResults();
  state.source?.close();
  const source = new EventSource(`/api/runs/${runId}/events`);
  state.source = source;
  source.onmessage = (message) => {
    let event;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }
    onEvent(event);
    if (event.type === "end") source.close();
  };
  source.onerror = () => {
    // EventSource reconnects on its own with Last-Event-ID; nothing to do unless the run is over.
    if (state.run?.status && state.run.status !== "running") source.close();
  };
}

function onEvent(event) {
  switch (event.type) {
    case "snapshot":
      state.run = event.run;
      renderInput(event.run.input);
      for (const s of state.stages) renderStage(s.id, event.run.stages[s.id]);
      for (const entry of event.run.ledger ?? []) upsertCall(entry);
      updateStatus();
      break;
    case "run":
      state.run.status = event.status;
      if (event.publish) state.run.publish = event.publish;
      if (event.status === "error") showError(event.message);
      updateStatus();
      if (event.status !== "running") for (const s of state.stages) renderStage(s.id, state.run.stages[s.id]);
      if (event.status === "done") setupAsk();
      break;
    case "stage": {
      const current = state.run.stages[event.id] ?? {};
      state.run.stages[event.id] = { ...current, status: event.status, output: event.output ?? (event.status === "done" ? current.output : undefined), error: event.error };
      if (event.status === "running") for (const s of state.stages.slice(state.stages.findIndex((x) => x.id === event.id) + 1)) state.run.stages[s.id] = { status: "stale" };
      for (const s of state.stages) renderStage(s.id, state.run.stages[s.id]);
      break;
    }
    case "call":
      upsertCall(event);
      break;
    case "thought":
      addThought(event);
      break;
    case "end":
      updateStatus();
      break;
  }
}

function updateStatus() {
  const run = state.run;
  if (!run) return;
  const done = state.stages.filter((s) => run.stages[s.id]?.status === "done").length;
  $("#run-status").textContent =
    run.status === "running" ? `Working… ${done} of ${state.stages.length} stages done` : run.status === "error" ? "Stopped on an error" : `Done: ${done} stages, ${run.ledger?.length ?? 0} Qloo requests`;
  $("#trace-status").textContent = `${run.ledger?.length ?? 0} requests`;
}

function showError(message) {
  const box = $("#error-box");
  box.hidden = false;
  box.replaceChildren(el("strong", { text: "The run stopped. " }), message);
}

function renderInput(input) {
  if (!input) return;
  $("#text-input").value = input.text || input.loves.map((w) => w.name).join(", ");
  state.markets = new Set(input.markets);
  toggleMarket("__none__");
  if (input.city) $("#city").value = input.city;
}

// ---------- stage cards ----------

function stageCard(stage) {
  return el(
    "section",
    { class: "stage pending", id: `stage-${stage.id}`, "data-stage": stage.id },
    el(
      "header",
      { class: "stage-head" },
      el("span", { class: "stage-state", "aria-hidden": "true" }),
      el("div", {}, el("h2", { text: stage.label }), el("p", { class: "stage-output-label", text: stage.output })),
      el("span", { class: "stage-summary" }),
    ),
    el("div", { class: "stage-body" }),
    el("div", { class: "stage-edit" }),
  );
}

function renderStage(id, s = {}) {
  const card = document.getElementById(`stage-${id}`);
  const rail = document.querySelector(`.rail-item[data-stage="${id}"]`);
  if (!card) return;
  const status = s.status ?? "pending";
  card.className = `stage ${status}`;
  if (rail) rail.className = `rail-item ${status}`;
  const summary = card.querySelector(".stage-summary");
  summary.textContent = status === "error" ? "failed" : status === "running" ? "working…" : status === "stale" ? "will rerun" : s.output?.summary ?? "";
  const body = card.querySelector(".stage-body");
  const edit = card.querySelector(".stage-edit");
  if (status === "error") {
    body.replaceChildren(el("p", { class: "error-inline", text: s.error ?? "Failed." }));
    edit.replaceChildren();
    return;
  }
  if (status !== "done" || !s.output) {
    body.replaceChildren(status === "running" ? el("div", { class: "skeleton" }) : el("p", { class: "stage-wait", text: status === "stale" ? "Waiting to rerun." : "Waiting for the stages before it." }));
    edit.replaceChildren();
    return;
  }
  const renderer = RENDER[id];
  let nodes;
  try {
    nodes = renderer ? renderer(s.output, state.run) : [pre(s.output)];
  } catch (error) {
    console.error(`render ${id}`, error);
    nodes = [pre(s.output)];
  }
  body.replaceChildren(...nodes.flat().filter(Boolean));
  if (s.output.edited) body.prepend(el("p", { class: "edited-note", text: "Edited by you. Stages after this were rerun with your changes." }));
  edit.replaceChildren(editControls(id, s.output));
}

const pre = (obj) => el("pre", { class: "json", text: JSON.stringify(obj, null, 2) });
const h3 = (text) => el("h3", { text });
const note = (text) => el("p", { class: "block-note", text });
const list = (items, cls = "plain-list") => el("ul", { class: cls }, (items ?? []).map((t) => el("li", {}, t)));
const chipRow = (items, cls = "swatches") => el("div", { class: cls }, (items ?? []).map((t) => el("span", { class: "swatch", text: t })));
const typeLabel = (t) => ({ tv_show: "TV show", movie: "Film", artist: "Music artist", person: "Person", videogame: "Video game", podcast: "Podcast", book: "Book", brand: "Brand" })[t] ?? t;
const momentumLabel = (l) => ({ rising: "Rising", peaking: "At its peak", steady: "Holding steady", cooling: "Cooling off", unknown: "No trend data" })[l] ?? l;

const RENDER = {
  think(o) {
    return [
      el(
        "div",
        { class: "wave-cards" },
        o.waves.map((w) => {
          const m = o.momentum?.[w.id];
          return el(
            "article",
            { class: "wave-card" },
            w.image ? el("img", { src: w.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : el("div", { class: "no-img" }),
            el(
              "div",
              {},
              h3(w.name),
              el("p", { class: "wave-meta", text: [typeLabel(w.type), w.year].filter(Boolean).join(", ") }),
              w.description ? el("p", { class: "wave-desc", text: w.description }) : null,
              m ? el("div", { class: "momentum" }, m.series?.length ? sparkline(m.series) : null, el("span", { class: `badge ${m.label}`, text: momentumLabel(m.label) }), el("span", { class: "wave-meta", text: "Qloo trend snapshot; hackathon trend data may be frozen" })) : null,
            ),
          );
        }),
      ),
      h3("What its fans share"),
      note("Qloo taste tags. These become design cues two stages down."),
      el("div", { class: "swatches" }, o.tags.slice(0, 18).map((t, i) => el("span", { class: "swatch", style: `--swatch:${SWATCH[i % SWATCH.length]}` }, t.name, t.type ? el("small", { text: String(t.type).replace(/^urn:tag:/, "").split(":")[0].replace(/_/g, " ") }) : null))),
      o.demographics?.length ? h3("Audience skew (aggregate)") : null,
      o.demographics?.length ? demographics(o.demographics) : null,
    ];
  },
  architect(o, run) {
    const p = o.plan ?? {};
    return [
      p.positioning ? el("p", { class: "lead", text: p.positioning }) : null,
      el(
        "div",
        { class: "two-col" },
        el("div", {}, h3("Product line"), list((p.categories ?? []).map((c) => el("span", {}, el("strong", { text: c.category }), c.why ? ` ${c.why}` : "")))),
        el("div", {}, h3("Price tier"), el("p", {}, el("span", { class: "badge", text: p.price_tier?.tier ?? "mid" }), " ", p.price_tier?.why ?? "")),
      ),
      ...o.markets.flatMap((m) => marketPanel(m, run)),
      p.avoid?.length ? el("div", {}, h3("Avoid"), list(p.avoid)) : null,
    ];
  },
  design(o) {
    const p = o.plan ?? {};
    return [
      p.mood ? el("p", { class: "lead", text: p.mood }) : null,
      p.palette?.length ? el("div", { class: "palette" }, p.palette.map((c) => el("div", { class: "chip-color" }, el("span", { class: "chip-fill", style: `background:${/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#888"}` }), el("strong", { text: c.name }), el("small", { text: (c.from_tags ?? []).join(", ") })))) : null,
      h3("Design cues"),
      el("div", { class: "cues" }, (p.cues ?? []).map((c) => el("div", { class: "cue" }, el("strong", { text: c.cue }), el("p", { class: "from", text: `From Qloo tags: ${(c.from_tags ?? []).join(", ")}${c.from_brands?.length ? ` · brands: ${c.from_brands.join(", ")}` : ""}` })))),
      h3("The collection"),
      el("div", { class: "tags-row" }, (p.styles ?? []).map((s) => el("div", { class: `hangtag ${s.hero ? "wave-specific" : ""}` }, el("strong", { text: s.name }), el("span", { text: `${s.category ?? ""}${s.hero ? " · hero" : ""}` }), el("span", { text: s.description ?? "" }), s.colourways?.length ? el("span", { text: s.colourways.join(" · ") }) : null))),
      p.avoid?.length ? el("div", {}, h3("Avoid"), list(p.avoid)) : null,
    ];
  },
  build(o) {
    return [
      el(
        "div",
        { class: "packs" },
        (o.packs ?? []).map((k) =>
          el(
            "details",
            { class: "pack", open: false },
            el("summary", {}, el("strong", { text: k.style }), el("span", { text: ` ${k.fabric?.composition ?? ""} ${k.fabric?.gsm ? k.fabric.gsm + " GSM" : ""}` })),
            el("dl", { class: "spec" }, ...spec("Fabric", `${k.fabric?.composition ?? ""}, ${k.fabric?.gsm ?? ""} GSM, ${k.fabric?.finish ?? ""}`), ...spec("Construction", (k.construction ?? []).join("; ")), ...spec("Print", `${k.print_or_embroidery?.type ?? ""}, ${k.print_or_embroidery?.placement ?? ""}, ${k.print_or_embroidery?.size_cm ?? ""} cm`), ...spec("Trims", (k.trims ?? []).join(", ")), ...spec("Sizes", (k.sizes ?? []).join(" ")), ...spec("Fit", k.fit_notes ?? ""), ...spec("Packaging", k.packaging ?? "")),
          ),
        ),
      ),
    ];
  },
  backend(o) {
    const e = o.economics;
    return [
      el(
        "div",
        { class: "tiles" },
        tile("MRP", `₹${e.mrp}`, `${e.tier} tier`),
        tile("Landed cost", `₹${e.landedCost}`, "per unit"),
        tile("Margin direct", `${e.marginDirect}%`, "Instagram / WhatsApp"),
        tile("Margin marketplace", `${e.marginMarketplace}%`, "after ~18% fees"),
        tile("Units", String(o.totalUnits), `${o.styles.length} styles`),
        tile("Investment", `₹${o.investment.toLocaleString("en-IN")}`, "first production"),
      ),
      h3("SKUs and sizes"),
      el(
        "table",
        { class: "table" },
        el("thead", {}, el("tr", {}, ["SKU", "Style", "Colourways", "Per colour", "Total", "S", "M", "L", "XL", "XXL"].map((t) => el("th", { text: t })))),
        el("tbody", {}, o.styles.map((s) => el("tr", {}, [s.sku, s.style, s.colourways.join(", "), s.quantityPerColour, s.total, s.sizes.S, s.sizes.M, s.sizes.L, s.sizes.XL, s.sizes.XXL].map((t) => el("td", { text: t }))))),
      ),
      h3("Where the units go"),
      el("table", { class: "table" }, el("thead", {}, el("tr", {}, ["City", "Market", "Share", "Units", "Why"].map((t) => el("th", { text: t })))), el("tbody", {}, o.allocation.map((a) => el("tr", {}, [a.city, a.market ?? "", `${Math.round(a.share * 100)}%`, a.units, a.why].map((t) => el("td", { text: t })))))),
      note(`Assumptions you can edit: MOQ ${o.assumptions.moqPerStylePerColour}/style/colour, size curve ${Object.values(o.assumptions.sizeCurve).join(":")}, unit cost ₹${e.unitCost} + ₹${o.assumptions.logisticsPerUnit} logistics, ${o.assumptions.markupByTier[e.tier]}× markup. These are starting assumptions, not Qloo data.`),
    ];
  },
  test(o) {
    return [
      el("div", { class: "tiles" }, tile("Grounded", `${o.score}%`, `${o.grounded} of ${o.checked} named claims`), tile("Removed", String(o.removed), "not in Qloo evidence")),
      o.items?.length ? el("div", {}, h3("Removed from the kit"), list(o.items.map((i) => `${i.stage}: ${i.kind} “${i.name}”`))) : note("Every named brand, city, tag and partner in the kit traces to a Qloo request."),
    ];
  },
  diff(o) {
    const w = o.withQloo;
    const g = o.withoutQloo ?? {};
    const col = (title, items, grounded) =>
      el(
        "div",
        { class: "diff-col" },
        h3(title),
        el("p", { class: "block-note", text: `${grounded.grounded} of ${grounded.named} named cities and brands trace to Qloo evidence` }),
        el("dl", { class: "spec" }, ...spec("Cities first", items.cities.join(", ") || "—"), ...spec("Brands to study", items.brands.join(", ") || "—"), ...spec("Design cues", items.cues.join("; ") || "—"), ...spec("Channels", items.channels.join(", ") || "—")),
      );
    return [
      note(`The same question, asked twice: “${o.question}”`),
      el(
        "div",
        { class: "diff" },
        col("With Qloo", w, o.benchmark.withQloo),
        col("Without Qloo", { cities: g.first_cities ?? [], brands: g.brands_to_study ?? [], cues: g.design_cues ?? [], channels: g.channels ?? [] }, o.benchmark.withoutQloo),
      ),
    ];
  },
  entrepreneur(o) {
    const p = o.plan ?? {};
    return [
      h3("Channels"),
      list((p.channels ?? []).map((c) => el("span", {}, el("strong", { text: c.channel }), c.first ? el("span", { class: "badge", text: "first" }) : null, ` ${c.why ?? ""}`))),
      el("div", { class: "two-col" }, el("div", {}, h3("Pricing"), el("p", { text: p.pricing?.note ?? "" }), p.pricing?.anchor_brands?.length ? chipRow(p.pricing.anchor_brands) : null), el("div", {}, h3("Collab ideas"), list((p.collabs ?? []).map((c) => el("span", {}, el("strong", { text: c.partner }), ` ${c.idea ?? ""} ${c.why ?? ""}`))))),
      o.passport?.length ? h3("City passports: where the fans are") : null,
      o.passport?.length ? note("Inside each first city: the neighbourhoods where the wave runs hotter than their size predicts, and venues its fans visit.") : null,
      o.passport?.length ? el("div", { class: "passports" }, o.passport.map((c) => passportCard(c))) : null,
      o.soundtrack?.length ? h3("Campaign soundtrack candidates") : null,
      o.soundtrack?.length ? note(`Artists whose fans overlap with the wave, below the superstar tier. Shared taste: ${o.soundtrack[0].sharedTags?.join(", ") || "n/a"}.`) : null,
      o.soundtrack?.length ? el("div", { class: "tags-row" }, o.soundtrack.map((s) => el("div", { class: `hangtag ${s.role !== "playlist" ? "wave-specific" : ""}` }, el("strong", { text: s.name }), el("span", { text: `${s.role}${s.popularity !== undefined ? ` · popularity ${Math.round(s.popularity * 100)}` : ""}` })))) : null,
      el("div", { class: "two-col" }, el("div", {}, h3("Risks"), list(p.risks)), el("div", {}, h3("Next 90 days"), list(p.next_90_days))),
    ];
  },
  brand(o) {
    return [
      el("div", { class: "names" }, (o.names ?? []).map((n, i) => el("div", { class: `name-card ${i === 0 ? "primary" : ""}` }, el("strong", { text: n.name }), el("p", { text: n.meaning ?? "" }), el("small", { text: n.check ?? "" })))),
      o.story ? el("p", { class: "lead", text: o.story }) : null,
      o.voice?.length ? chipRow(o.voice) : null,
      o.taglines?.length ? el("div", {}, h3("Taglines"), list(o.taglines.map((t) => `${t.market}: ${t.line}`))) : null,
      el("div", {}, h3("Before you print labels"), list(o.checks)),
    ];
  },
  launch(o) {
    const p = o.plan ?? {};
    return [
      p.drop_name ? el("p", { class: "lead", text: p.drop_name }) : null,
      h3("First cities"),
      el("div", { class: "weeks" }, (p.first_cities ?? []).map((c) => el("div", { class: "week" }, el("strong", { text: c.city ?? c }), el("p", { class: "block-note", text: c.why ?? "" }), c.start_in?.length ? el("p", { class: "block-note" }, el("strong", { text: "Start in: " }), c.start_in.join(", ")) : null, c.seed_at?.length ? el("p", { class: "block-note" }, el("strong", { text: "Seed at: " }), c.seed_at.join(", ")) : null))),
      p.soundtrack?.length ? h3("Campaign soundtrack") : null,
      p.soundtrack?.length ? list(p.soundtrack.map((s) => el("span", {}, el("strong", { text: s.artist }), el("span", { class: "badge", text: s.use ?? "" }), ` ${s.why ?? ""}`))) : null,
      h3("The 30 days"),
      el("div", { class: "weeks" }, (p.weeks ?? []).map((w) => el("div", { class: "week" }, el("strong", { text: `Week ${w.week}: ${w.focus ?? ""}` }), list(w.actions)))),
      p.creator_brief ? el("div", {}, h3("Creator brief"), el("p", { text: `${p.creator_brief.who ?? ""} ${p.creator_brief.hook ?? ""}` }), list(p.creator_brief.deliverables)) : null,
      el("div", { class: "two-col" }, el("div", {}, h3("Content ideas"), list(p.content_ideas)), el("div", {}, h3("What to measure"), list(p.success_signals))),
    ];
  },
  deploy(o) {
    return [
      el("p", { class: "lead", text: "Your drop page is live." }),
      el("p", {}, el("a", { class: "primary-link", href: o.url, target: "_blank", rel: "noopener", text: `Open ${location.origin}${o.url}` })),
      note("A public page built from this run: brand, story, palette, pieces, prices, first cities, neighbourhoods and soundtrack. Share it, or edit a stage above and it updates on rerun."),
      o.finalCheck ? el("div", { class: "tiles" }, tile("Final check", `${o.finalCheck.score}%`, `${o.finalCheck.grounded} of ${o.finalCheck.checked} claims across ${o.finalCheck.stages?.length ?? 0} stages trace to Qloo`), tile("Removed", String(o.finalCheck.removed), "invented names deleted")) : null,
    ];
  },
};

const SWATCH = ["#3b4a8c", "#e4505e", "#c99a06", "#2f8f83", "#8a4fb3", "#d9822b", "#5b6b2f", "#b03a6b"];
const spec = (k, v) => [el("dt", { text: k }), el("dd", { text: v })];
const tile = (label, value, sub) => el("div", { class: "tile" }, el("span", { class: "tile-value", text: value }), el("span", { class: "tile-label", text: label }), sub ? el("span", { class: "tile-sub", text: sub }) : null);

function demographics(rows) {
  const flat = [];
  for (const r of rows) {
    const q = r.query ?? r;
    for (const [group, values] of Object.entries(q)) {
      if (values && typeof values === "object") for (const [k, v] of Object.entries(values)) if (typeof v === "number") flat.push({ label: `${group} ${k}`.replace(/_/g, " "), value: v });
    }
  }
  if (!flat.length) return pre(rows.slice(0, 3));
  const max = Math.max(...flat.map((f) => Math.abs(f.value))) || 1;
  return el("div", { class: "bars" }, flat.slice(0, 12).map((f) => el("div", { class: "bar-row" }, el("span", { class: "bar-label", text: f.label }), el("span", { class: "bar-track" }, el("span", { class: `bar-fill ${f.value < 0 ? "neg" : ""}`, style: `width:${(Math.abs(f.value) / max) * 100}%` })), el("span", { class: "bar-val", text: (f.value > 0 ? "+" : "") + f.value.toFixed(2) }))));
}

function sparkline(series) {
  const w = 180;
  const h = 40;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i) => (i / Math.max(series.length - 1, 1)) * (w - 4) + 2;
  const y = (v) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
  const points = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": "Popularity trend" });
  svg.append(svgEl("path", { class: "area", d: `M${points[0]} L${points.join(" L")} L${x(series.length - 1)},${h} L${x(0)},${h} Z` }), svgEl("polyline", { class: "line", points: points.join(" ") }));
  return svg;
}

// ---------- markets (gap tapes, map, brands) ----------

function marketPanel(m, run) {
  const named = m.gap.filter((g) => g.name);
  const rows = (named.length ? named : m.gap).slice(0, 10);
  const mapBox = el("div", { class: "map", role: "img", "aria-label": `Map of culture and fashion heat in ${m.market}` });
  const panel = el(
    "section",
    { class: "market" },
    h3(`${m.market}: where the gap is`),
    note(`Each tape compares the wave's lift in a city (filled dot) with the lift of the brands its fans favour (open dot). Lift means "hotter than the city's size predicts". A red stretch is culture ahead of fashion.${m.coverage !== "ok" ? ` Coverage here is ${m.coverage}; read it as a regional signal.` : ""}${m.home ? ` Your home, ${m.home.name}, has lift ${m.home.lift}.` : ""}`),
    el("div", { class: "panel-grid" }, rows.length ? gapList(rows) : el("p", { class: "notes", text: "Qloo has no city-level data for this wave here." }), mapBox),
    h3(`Fashion brands this wave's fans favour in ${m.market}`),
    note(`Outlined tags only show up with the wave, not in the country's usual favourites.${m.brandsLocalised === false ? " Qloo returned the same brands with and without the location, so the local signal comes from the heatmap." : ""}`),
    m.brands.length ? el("div", { class: "tags-row" }, m.brands.slice(0, 12).map((b) => el("div", { class: `hangtag ${b.waveSpecific ? "wave-specific" : ""}` }, el("strong", { text: b.name }), b.waveSpecific ? el("span", { class: "ride", text: "Rides the wave" }) : el("span", { text: b.baselineRank ? `Also #${b.baselineRank} in the country overall` : "Strong here overall" })))) : el("p", { class: "notes", text: "No brand affinities came back for this market." }),
  );
  if (m.gap.some((g) => g.lat !== undefined)) setTimeout(() => drawMap(`${run.id}-${m.market}`, mapBox, m.gap), 0);
  return [panel];
}

function gapList(rows) {
  return el(
    "ul",
    { class: "gap-list" },
    rows.map((g) => {
      const c = ((g.cultureLift ?? 0) + 0.5) * 100;
      const f = ((g.fashionLift ?? 0) + 0.5) * 100;
      const left = Math.min(c, f);
      const width = Math.abs(c - f);
      return el(
        "li",
        { class: "gap-row" },
        el("span", { class: "gap-city", title: g.name ?? g.key, text: g.name ?? approxPlace(g) }),
        el("div", { class: "mini-tape", role: "img", "aria-label": `Culture lift ${g.cultureLift}, fashion lift ${g.fashionLift}` }, el("span", { class: `span ${g.gap < 0 ? "ahead" : ""}`, style: `left:${left}%;width:${width}%` }), el("span", { class: "dot f", style: `left:${f}%` }), el("span", { class: "dot c", style: `left:${c}%` })),
        el("span", { class: `gap-signal ${g.signal}`, text: g.signal === "opportunity" ? `Gap ${Math.round(g.gap * 100)}` : g.signal === "fashion-ahead" ? "Fashion ahead" : "In step" }),
      );
    }),
  );
}
const approxPlace = (g) => (g.lat !== undefined ? `${g.lat.toFixed(1)}, ${g.lon.toFixed(1)}` : g.key);

function passportCard(c) {
  return el(
    "div",
    { class: "passport" },
    el("strong", { class: "passport-city", text: c.city }),
    el("span", { class: "block-note", text: c.market }),
    c.coverage === "none" ? el("p", { class: "notes", text: "No neighbourhood or venue data here; use the regional signal." }) : null,
    c.neighbourhoods?.length ? el("div", {}, el("span", { class: "passport-label", text: "Start in" }), list(c.neighbourhoods.map((n) => `${n.name} (lift ${n.lift > 0 ? "+" : ""}${n.lift})`))) : null,
    c.venues?.length ? el("div", {}, el("span", { class: "passport-label", text: "Seed at" }), list(c.venues.map((v) => v.name))) : null,
  );
}

function drawMap(key, box, gap) {
  if (!window.L || !box.isConnected) return;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const map = L.map(box, { scrollWheelZoom: false });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>', maxZoom: 10 }).addTo(map);
  const pts = gap.filter((g) => g.lat !== undefined);
  const color = (g) => (g.signal === "opportunity" ? "#e4505e" : g.signal === "fashion-ahead" ? "#3b4a8c" : "#8a93b5");
  for (const g of pts) {
    const marker = L.circleMarker([g.lat, g.lon], { radius: 5 + Math.max(0, g.cultureLift ?? 0) * 14, color: color(g), weight: 2, fillColor: color(g), fillOpacity: 0.35 }).addTo(map);
    const label = document.createElement("div");
    label.append(el("strong", { text: g.name ?? approxPlace(g) }), el("br"), `Culture lift ${g.cultureLift}, fashion lift ${g.fashionLift}`);
    marker.bindPopup(label);
  }
  map.fitBounds(L.latLngBounds(pts.map((g) => [g.lat, g.lon])).pad(0.15));
  state.maps.set(key, map);
}

// ---------- edit and rerun ----------

const EDITABLE = {
  architect: (o) => ({ plan: o.plan }),
  design: (o) => ({ plan: o.plan }),
  build: (o) => ({ packs: o.packs }),
  backend: (o) => ({ assumptions: o.assumptions }),
  entrepreneur: (o) => ({ plan: o.plan }),
  brand: (o) => ({ names: o.names, story: o.story, taglines: o.taglines }),
  launch: (o) => ({ plan: o.plan }),
};

function editControls(id, output) {
  const pick = EDITABLE[id];
  if (!pick || state.run?.status === "running") return el("span");
  const wrap = el("details", { class: "edit" });
  const area = el("textarea", { rows: 10, spellcheck: "false" });
  area.value = JSON.stringify(pick(output), null, 2);
  const status = el("span", { class: "edit-status" });
  wrap.append(
    el("summary", { text: "Edit this stage and rerun from here" }),
    note("Change the JSON, then rerun. This stage keeps your edits; every stage after it runs again."),
    area,
    el("div", { class: "edit-actions" }, el("button", { type: "button", class: "primary", text: "Rerun from here", onclick: () => submitEdit(id, area, status) }), status),
  );
  return wrap;
}

async function submitEdit(id, area, status) {
  let edits;
  try {
    edits = JSON.parse(area.value);
  } catch {
    status.textContent = "That isn't valid JSON.";
    return;
  }
  status.textContent = "Rerunning…";
  const response = await fetch(`/api/runs/${state.run.id}/edit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: id, edits }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    status.textContent = json.error ?? "Couldn't rerun.";
    return;
  }
  status.textContent = "";
  attach(state.run.id);
}

// ---------- trace ----------

function addThought(event) {
  $("#trace-list").append(el("li", { class: "trace-item thought" }, el("details", {}, el("summary", {}, el("span", { class: "state" }), el("span", {}, event.text, event.stage ? el("span", { class: "tool", text: event.stage }) : null), el("span")))));
}

function upsertCall(entry) {
  const trace = $("#trace-list");
  let item = trace.querySelector(`[data-call="${CSS.escape(entry.id)}"]`);
  if (!item) {
    item = el("li", { class: "trace-item", "data-call": entry.id });
    trace.append(item);
  }
  item.className = `trace-item ${entry.status}`;
  const meta = entry.status === "running" ? "…" : entry.status === "error" ? "failed" : `${entry.count ?? 0} · ${entry.ms}ms`;
  const query = entry.provenance?.requests?.map((r) => ({ [r.method + " " + r.path]: r.query })) ?? (entry.args ? [{ args: entry.args }] : []);
  const detail = entry.status === "error" ? entry.error : JSON.stringify(query.length === 1 ? query[0] : query, null, 2);
  item.replaceChildren(el("details", {}, el("summary", {}, el("span", { class: "state", "aria-hidden": "true" }), el("span", {}, entry.title ?? entry.tool, el("span", { class: "tool", text: `${entry.stage ?? ""} · ${entry.tool}` })), el("span", { class: "meta", text: meta })), el("pre", { text: detail || "" })));
}

// ---------- ask ----------

function askContext() {
  const run = state.run;
  const t = run.stages.think?.output;
  const a = run.stages.architect?.output;
  return {
    waves: (t?.waves ?? []).map((w) => ({ id: w.id, name: w.name, type: w.type })),
    markets: (a?.markets ?? []).map((m) => ({ market: m.market, brands: m.brands.slice(0, 8).map((b) => ({ id: b.id, name: b.name, rides_wave: b.waveSpecific })), opportunity_cities: m.opportunityCities })),
    tags: (t?.tags ?? []).slice(0, 12).map((x) => x.name),
    maker: run.input.maker,
    home: run.input.city,
  };
}

function setupAsk() {
  const run = state.run;
  const t = run.stages.think?.output;
  const a = run.stages.architect?.output;
  if (!t || !a) return;
  $("#ask").hidden = false;
  const first = t.waves[0]?.name ?? "this wave";
  const m0 = a.markets[0]?.market ?? "India";
  const city = a.markets[0]?.opportunityCities?.[0];
  const brand = a.markets[0]?.brands?.find((b) => b.waveSpecific)?.name;
  const suggestions = [
    `What else do fans of ${first} in ${m0} watch and listen to?`,
    brand ? `Which smaller brands sit near ${brand} for these fans?` : `Which brands should I study for ${first} fans?`,
    city ? `Where in ${city} should I do a pop-up?` : `Where in ${m0} should I do a pop-up?`,
  ];
  $("#ask-suggestions").replaceChildren(...suggestions.map((s) => el("button", { type: "button", class: "chip", text: s, onclick: () => ask(s) })));
}

async function ask(question) {
  if (!state.run) return;
  $("#ask-input").value = "";
  const steps = el("ul", { class: "qa-steps" });
  const answer = el("div", { class: "qa-a" }, el("div", { class: "skeleton", style: "width:60%" }));
  $("#ask-thread").prepend(el("div", { class: "qa" }, el("p", { class: "qa-q", text: question }), steps, answer));
  addThought({ text: `Follow-up: ${question}` });
  try {
    const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context: askContext() }) });
    if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error ?? `Request failed (${response.status}).`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "call") {
            upsertCall({ ...event, id: `ask-${event.id}`, stage: "ask" });
            if (event.status === "running") steps.append(el("li", { text: `Asked Qloo: ${event.title}` }));
          } else if (event.type === "answer") answer.replaceChildren(event.text || "No answer came back.");
          else if (event.type === "error") answer.replaceChildren(el("strong", { text: "Couldn't answer. " }), event.message);
        }
      }
    }
  } catch (error) {
    answer.replaceChildren(el("strong", { text: "Couldn't answer. " }), error.message);
  }
}

init();
