// Culture Gap front end. Vanilla JS; every piece of text from Qloo or the model
// is inserted as text, never as HTML.

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

const MAX_MARKETS = 3;
const state = { markets: new Set(["India", "United States"]), report: null, partial: {}, scanning: false };

// ---------- streaming ----------

async function streamPost(url, body, onEvent) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    let message = `Request failed (${response.status}).`;
    try {
      message = (await response.json()).error ?? message;
    } catch {}
    throw new Error(message);
  }
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
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
}

// ---------- setup ----------

async function init() {
  let presets = { examples: [], markets: [], mode: "live" };
  try {
    presets = await (await fetch("/api/presets")).json();
  } catch {}

  const chips = $("#market-chips");
  for (const market of presets.markets) {
    chips.append(
      el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(state.markets.has(market)),
        "data-market": market,
        text: market,
        onclick: () => toggleMarket(market),
      }),
    );
  }
  refreshChips();

  const list = $("#example-list");
  for (const example of presets.examples) {
    list.append(
      el("button", { type: "button", class: "example", title: example.blurb, text: example.label, onclick: () => runExample(example) }),
    );
  }

  if (presets.mode === "samples") {
    const note = $("#mode-note");
    note.hidden = false;
    note.textContent = "Demo mode: replaying recorded Qloo responses, so only the example waves work right now.";
  }
  if (!presets.llm) {
    $("#wave-input").placeholder = "A show, artist or film, e.g. Squid Game";
  }

  $("#scan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("#wave-input").value.trim();
    if (!text) return;
    const looksLikeQuestion = text.includes("?") || text.split(/\s+/).length > 6;
    startScan({
      ...(looksLikeQuestion ? { question: text } : { waves: text.split(/\s*[,;+]\s*|\s+and\s+/i).filter(Boolean).slice(0, 3) }),
      markets: looksLikeQuestion && state.markets.size === 0 ? undefined : [...state.markets],
      persona: $("#persona").value,
      angle: $("#angle").value.trim() || undefined,
    });
  });

  $("#ask-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("#ask-input").value.trim();
    if (q) ask(q);
  });

  const params = new URLSearchParams(location.search);
  const exampleId = params.get("example");
  const preset = presets.examples.find((e) => e.id === exampleId);
  if (preset) runExample(preset);
}

function toggleMarket(market) {
  if (state.markets.has(market)) state.markets.delete(market);
  else if (state.markets.size < MAX_MARKETS) state.markets.add(market);
  refreshChips();
}

function refreshChips() {
  for (const chip of document.querySelectorAll(".chip[data-market]")) {
    const on = state.markets.has(chip.dataset.market);
    chip.setAttribute("aria-pressed", String(on));
    chip.disabled = !on && state.markets.size >= MAX_MARKETS;
  }
}

function runExample(example) {
  $("#wave-input").value = example.waves.map((w) => w.name).join(", ");
  state.markets = new Set(example.markets);
  refreshChips();
  $("#persona").value = example.persona;
  $("#angle").value = example.angle ?? "";
  history.replaceState(null, "", `?example=${encodeURIComponent(example.id)}`);
  startScan({ waves: example.waves, markets: example.markets, persona: example.persona, angle: example.angle });
}

// ---------- scan ----------

function resetResults() {
  state.report = null;
  state.partial = {};
  $("#results").hidden = false;
  for (const id of ["waves", "aesthetic", "brief", "markets", "ask"]) $(`#${id}`).hidden = true;
  $("#error-box").hidden = true;
  $("#trace-list").replaceChildren();
  $("#wave-cards").replaceChildren();
  $("#tag-swatches").replaceChildren();
  $("#brief-body").replaceChildren();
  $("#market-tabs").replaceChildren();
  $("#market-panels").replaceChildren();
  $("#ask-thread").replaceChildren();
}

async function startScan(payload) {
  if (state.scanning) return;
  state.scanning = true;
  const button = $("#scan-button");
  button.disabled = true;
  button.textContent = "Scanning…";
  resetResults();
  const started = performance.now();
  const status = $("#trace-status");
  status.textContent = "Working…";
  $("#results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  showBriefPlaceholder();
  try {
    await streamPost("/api/scan", payload, (event) => onScanEvent(event, $("#trace-list")));
  } catch (error) {
    showError(error.message);
  } finally {
    state.scanning = false;
    button.disabled = false;
    button.textContent = "Run the scan";
    const calls = document.querySelectorAll("#trace-list .trace-item:not(.thought)").length;
    status.textContent = `${calls} Qloo requests, ${((performance.now() - started) / 1000).toFixed(1)}s`;
  }
}

function onScanEvent(event, traceList) {
  switch (event.type) {
    case "plan":
      addThought(traceList, planText(event.value));
      break;
    case "thought":
      addThought(traceList, event.text);
      break;
    case "call":
      upsertCall(traceList, event);
      break;
    case "partial":
      onPartial(event.key, event.value);
      break;
    case "report":
      state.report = event.value;
      renderReport(event.value);
      break;
    case "error":
      showError(event.message);
      break;
  }
}

function planText(p) {
  const waves = p.waves.map((w) => w.name).join(", ");
  return `Plan: read ${waves} across ${p.markets.join(", ")} for ${personaText(p.persona)}${p.angle ? ` (${p.angle})` : ""}.`;
}
const personaText = (p) =>
  ({ maker: "a garment maker", boutique: "a boutique", brand: "a small fashion brand", designer: "an independent designer" })[p] ??
  "a small fashion brand";

function showError(message) {
  const box = $("#error-box");
  box.hidden = false;
  box.replaceChildren(el("strong", { text: "The scan stopped. " }), message);
  $("#brief").hidden = $("#brief-body").dataset.filled !== "1";
}

// ---------- trace ----------

function addThought(list, text) {
  list.append(
    el(
      "li",
      { class: "trace-item thought" },
      el("details", {}, el("summary", {}, el("span", { class: "state" }), el("span", { text }), el("span"))),
    ),
  );
}

function upsertCall(list, event) {
  let item = list.querySelector(`[data-call="${CSS.escape(event.id)}"]`);
  if (!item) {
    item = el("li", { class: "trace-item", "data-call": event.id });
    list.append(item);
  }
  const title = event.title ?? item.dataset.title ?? event.tool;
  item.dataset.title = title;
  item.className = `trace-item ${event.status}`;
  const meta = event.status === "running" ? "…" : event.status === "error" ? "failed" : `${event.count ?? 0} · ${event.ms}ms`;
  const query = event.provenance?.requests?.map((r) => ({ [r.method + " " + r.path]: r.query })) ?? (event.args ? [{ args: event.args }] : []);
  const detailText =
    event.status === "error" ? event.error : JSON.stringify(query.length === 1 ? query[0] : query, null, 2) || "";
  if (event.status === "running" && event.args) item.dataset.args = JSON.stringify(event.args, null, 2);
  item.replaceChildren(
    el(
      "details",
      {},
      el(
        "summary",
        {},
        el("span", { class: "state", "aria-hidden": "true" }),
        el("span", {}, title, el("span", { class: "tool", text: event.tool })),
        el("span", { class: "meta", text: meta }),
      ),
      el("pre", { text: detailText || item.dataset.args || "" }),
    ),
  );
}

// ---------- partial renders ----------

function onPartial(key, value) {
  state.partial[key] = value;
  if (key === "waves") renderWaves(value, state.partial.momentum);
  else if (key === "momentum") renderWaves(state.partial.waves ?? [], value);
  else if (key === "tags") renderTags(value);
  else if (key.startsWith("brands:") || key.startsWith("gap:")) {
    const market = key.split(":").slice(1).join(":");
    renderMarket(market, {
      market,
      brands: state.partial[`brands:${market}`] ?? null,
      gap: state.partial[`gap:${market}`] ?? null,
      notes: [],
    });
  }
}

function renderWaves(waves, momentumById = {}) {
  if (!waves?.length) return;
  $("#waves").hidden = false;
  $("#wave-cards").replaceChildren(
    ...waves.map((w) => {
      const m = momentumById?.[w.id];
      return el(
        "article",
        { class: "wave-card" },
        w.image ? el("img", { src: w.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : el("div", { class: "no-img" }),
        el(
          "div",
          {},
          el("h3", { text: w.name }),
          el("p", { class: "wave-meta", text: [typeLabel(w.type), w.year].filter(Boolean).join(", ") }),
          w.description ? el("p", { class: "wave-desc", text: w.description }) : null,
          el(
            "div",
            { class: "momentum" },
            m?.series?.length ? sparkline(m.series) : state.partial.momentum ? null : el("div", { class: "skeleton", style: "width:180px" }),
            m ? el("span", { class: `badge ${m.label}`, text: momentumLabel(m.label) }) : null,
            m?.series?.length ? el("span", { class: "wave-meta", text: "Qloo popularity, last 6 months" }) : null,
          ),
        ),
      );
    }),
  );
}

const typeLabel = (t) =>
  ({ tv_show: "TV show", movie: "Film", artist: "Music artist", person: "Person", videogame: "Video game", podcast: "Podcast", book: "Book", brand: "Brand" })[
    t
  ] ?? t;
const momentumLabel = (l) =>
  ({ rising: "Rising", peaking: "At its peak", steady: "Holding steady", cooling: "Cooling off", unknown: "No trend data" })[l] ?? l;

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
  svg.append(
    svgEl("path", { class: "area", d: `M${points[0]} L${points.join(" L")} L${x(series.length - 1)},${h} L${x(0)},${h} Z` }),
    svgEl("polyline", { class: "line", points: points.join(" ") }),
  );
  return svg;
}

const SWATCH_COLORS = ["#3b4a8c", "#e4505e", "#c99a06", "#2f8f83", "#8a4fb3", "#d9822b", "#5b6b2f", "#b03a6b"];

function renderTags(tags) {
  if (!tags?.length) return;
  $("#aesthetic").hidden = false;
  $("#tag-swatches").replaceChildren(
    ...tags.slice(0, 18).map((t, i) =>
      el(
        "span",
        { class: "swatch", style: `--swatch:${SWATCH_COLORS[i % SWATCH_COLORS.length]}` },
        t.name,
        t.type ? el("small", { text: tagTypeLabel(t.type) }) : null,
      ),
    ),
  );
}
const tagTypeLabel = (type) =>
  String(type)
    .replace(/^urn:tag:/, "")
    .split(":")[0]
    .replace(/_/g, " ");

// ---------- markets ----------

function ensureMarketPanel(market) {
  const id = `panel-${market.replace(/\W+/g, "-")}`;
  let panel = document.getElementById(id);
  if (panel) return panel;
  $("#markets").hidden = false;
  const tabs = $("#market-tabs");
  const first = tabs.children.length === 0;
  const tab = el("button", {
    class: "tab",
    role: "tab",
    type: "button",
    id: `tab-${id}`,
    "aria-controls": id,
    "aria-selected": String(first),
    text: market,
    onclick: () => selectTab(id),
  });
  tabs.append(tab);
  panel = el("div", { class: "panel", role: "tabpanel", id, "aria-labelledby": `tab-${id}`, hidden: !first });
  $("#market-panels").append(panel);
  return panel;
}

function selectTab(id) {
  for (const tab of document.querySelectorAll("#market-tabs .tab")) tab.setAttribute("aria-selected", String(tab.getAttribute("aria-controls") === id));
  for (const panel of document.querySelectorAll("#market-panels .panel")) panel.hidden = panel.id !== id;
  const map = maps.get(id);
  if (map) setTimeout(() => map.invalidateSize(), 50);
}

const maps = new Map();

function renderMarket(market, data) {
  const panel = ensureMarketPanel(market);
  const brands = data.brands;
  const gap = data.gap;

  const gapSection = el(
    "section",
    {},
    el("h3", { text: `Where the gap is in ${market}` }),
    el("p", {
      class: "block-note",
      text: "Each tape compares how hot the wave is in a city (filled dot) with how hot the brands its fans favour are (open dot), ranked against other cities. A red stretch means the culture is ahead of the fashion.",
    }),
  );
  if (gap === null) gapSection.append(el("div", { class: "skeleton", style: "margin-top:1rem" }));
  else if (!gap.length) gapSection.append(el("p", { class: "notes", text: "Qloo has no city-level data for this wave here." }));
  else gapSection.append(gapList(gap.filter((g) => g.name).slice(0, 10).length ? gap.filter((g) => g.name).slice(0, 10) : gap.slice(0, 10)));

  const mapBox = el("div", { class: "map", role: "img", "aria-label": `Map of culture and fashion heat in ${market}` });

  const brandSection = el(
    "section",
    {},
    el("h3", { text: `Brands this wave's fans favour in ${market}` }),
    el("p", {
      class: "block-note",
      text: "Outlined tags only show up with the wave, not in the country's usual favourites. Those are the brands riding it.",
    }),
  );
  if (brands === null) brandSection.append(el("div", { class: "skeleton", style: "margin-top:1rem" }));
  else if (!brands.length) brandSection.append(el("p", { class: "notes", text: "No brand affinities came back for this market." }));
  else brandSection.append(brandTags(brands.slice(0, 12)));

  const notes = (data.notes ?? []).map((n) => el("p", { class: "notes", text: n }));
  panel.replaceChildren(el("div", { class: "panel-grid" }, gapSection, mapBox), brandSection, ...notes);

  if (gap?.some((g) => g.lat !== undefined)) drawMap(panel.id, mapBox, gap);
}

function gapList(rows) {
  return el(
    "ul",
    { class: "gap-list" },
    rows.map((g) => {
      const c = (g.culture ?? 0) * 100;
      const f = (g.fashion ?? 0) * 100;
      const left = Math.min(c, f);
      const width = Math.abs(c - f);
      return el(
        "li",
        { class: "gap-row" },
        el("span", { class: "gap-city", title: g.name ?? g.key, text: g.name ?? approxPlace(g) }),
        el(
          "div",
          {
            class: "mini-tape",
            role: "img",
            "aria-label": `Culture heat ${Math.round(c)}, fashion heat ${Math.round(f)}`,
          },
          el("span", { class: `span ${g.gap < 0 ? "ahead" : ""}`, style: `left:${left}%;width:${width}%` }),
          el("span", { class: "dot f", style: `left:${f}%` }),
          el("span", { class: "dot c", style: `left:${c}%` }),
        ),
        el("span", { class: `gap-signal ${g.signal}`, text: signalLabel(g) }),
      );
    }),
  );
}
const approxPlace = (g) => (g.lat !== undefined ? `${g.lat.toFixed(1)}, ${g.lon.toFixed(1)}` : g.key);
const signalLabel = (g) =>
  g.signal === "opportunity" ? `Gap ${Math.round(g.gap * 100)}` : g.signal === "fashion-ahead" ? "Fashion ahead" : "In step";

function brandTags(brands) {
  return el(
    "div",
    { class: "tags-row" },
    brands.map((b) =>
      el(
        "div",
        { class: `hangtag ${b.waveSpecific ? "wave-specific" : ""}` },
        el("strong", { text: b.name }),
        b.waveSpecific
          ? el("span", { class: "ride", text: "Rides the wave" })
          : el("span", { text: b.baselineRank ? `Also #${b.baselineRank} in the country overall` : "Strong here overall" }),
      ),
    ),
  );
}

function drawMap(panelId, box, gap) {
  if (!window.L) return;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const map = L.map(box, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 10,
  }).addTo(map);
  const pts = gap.filter((g) => g.lat !== undefined);
  const color = (g) => (g.signal === "opportunity" ? "#e4505e" : g.signal === "fashion-ahead" ? "#3b4a8c" : "#8a93b5");
  for (const g of pts) {
    const marker = L.circleMarker([g.lat, g.lon], {
      radius: 5 + (g.culture ?? 0) * 10,
      color: color(g),
      weight: 2,
      fillColor: color(g),
      fillOpacity: 0.35,
    }).addTo(map);
    const label = document.createElement("div");
    label.append(
      el("strong", { text: g.name ?? approxPlace(g) }),
      el("br"),
      `Culture heat ${Math.round((g.culture ?? 0) * 100)}, fashion heat ${Math.round((g.fashion ?? 0) * 100)}`,
    );
    marker.bindPopup(label);
  }
  map.fitBounds(L.latLngBounds(pts.map((g) => [g.lat, g.lon])).pad(0.15));
  maps.set(panelId, map);
}

// ---------- brief ----------

function showBriefPlaceholder() {
  const body = $("#brief-body");
  body.dataset.filled = "0";
  body.replaceChildren(
    el("p", { class: "block-note", text: "The agent writes this once the Qloo evidence is in." }),
    el("div", { class: "skeleton", style: "height:34px;width:70%" }),
    el("div", { class: "skeleton" }),
    el("div", { class: "skeleton", style: "width:85%" }),
  );
  $("#brief").hidden = false;
}

function renderReport(report) {
  renderWaves(report.waves, report.momentum);
  renderTags(report.tags);
  for (const m of report.markets) renderMarket(m.market, m);
  renderBrief(report.brief, report);
  setupAsk(report);
}

function renderBrief(brief, report) {
  const body = $("#brief-body");
  body.dataset.filled = "1";
  const parts = [];
  if (brief.headline) parts.push(el("p", { class: "brief-headline", text: brief.headline }));
  if (brief.summary) parts.push(el("p", { class: "brief-summary", text: brief.summary }));
  if (brief.timing?.call) {
    parts.push(
      el(
        "div",
        { class: "brief-timing" },
        el("span", { class: `badge ${brief.timing.call.replace(/\s+/g, "-")}`, text: capital(brief.timing.call) }),
        el("span", { text: brief.timing.why ?? "" }),
      ),
    );
  }
  if (brief.design_cues?.length) {
    parts.push(
      el(
        "div",
        {},
        el("h3", { text: "What to make" }),
        el(
          "div",
          { class: "cues" },
          brief.design_cues.map((c) =>
            el(
              "div",
              { class: "cue" },
              el("strong", { text: c.cue }),
              c.product ? el("p", { text: c.product }) : null,
              el("p", { class: "from", text: `From Qloo tags: ${c.from_tags.join(", ")}` }),
            ),
          ),
        ),
      ),
    );
  }
  if (brief.markets?.length) {
    parts.push(
      el(
        "div",
        {},
        el("h3", { text: "Where to go first" }),
        el(
          "div",
          { class: "moves" },
          brief.markets.map((m) =>
            el(
              "div",
              { class: "move" },
              el("span", { class: "move-market", text: m.market }),
              el(
                "div",
                {},
                m.move ? el("p", { text: m.move }) : null,
                el(
                  "ul",
                  {},
                  m.where_first?.length ? el("li", { text: `Cities: ${m.where_first.join(", ")}` }) : null,
                  m.brands_to_study?.length ? el("li", { text: `Brands to study: ${m.brands_to_study.join(", ")}` }) : null,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
  if (brief.collab_ideas?.length) {
    parts.push(
      el(
        "div",
        {},
        el("h3", { text: "Collab ideas" }),
        el("ul", { class: "plain-list" }, brief.collab_ideas.map((c) => el("li", {}, el("strong", { text: c.idea }), c.why ? ` ${c.why}` : ""))),
      ),
    );
  }
  if (brief.watch_outs?.length) {
    parts.push(el("div", {}, el("h3", { text: "Watch out for" }), el("ul", { class: "plain-list" }, brief.watch_outs.map((w) => el("li", { text: w })))));
  }
  parts.push(
    el("p", {
      class: "provenance-note",
      text: "Brands, cities and tags in this brief come from the Qloo requests listed beside it. The wording and design ideas are the agent's interpretation.",
    }),
  );
  body.replaceChildren(...parts);
  $("#brief").hidden = false;
}
const capital = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

// ---------- ask ----------

function askContext(report) {
  return {
    waves: report.waves.map((w) => ({ id: w.id, name: w.name, type: w.type, momentum: report.momentum?.[w.id]?.label })),
    markets: report.markets.map((m) => ({
      market: m.market,
      brands: m.brands.slice(0, 8).map((b) => ({ id: b.id, name: b.name, rides_wave: b.waveSpecific })),
      opportunity_cities: m.gap.filter((g) => g.signal === "opportunity").slice(0, 5).map((g) => g.name ?? approxPlace(g)),
    })),
    tags: report.tags.slice(0, 12).map((t) => t.name),
    persona: report.plan.persona,
    angle: report.plan.angle,
  };
}

function setupAsk(report) {
  $("#ask").hidden = false;
  const first = report.waves[0]?.name ?? "this wave";
  const m0 = report.markets[0]?.market ?? "India";
  const m1 = report.markets[1]?.market;
  const brand = report.markets[0]?.brands?.find((b) => b.waveSpecific)?.name;
  const suggestions = [
    `What else do fans of ${first} in ${m0} watch and listen to?`,
    brand ? `Is ${brand} rising or cooling?` : `Which of these brands is rising fastest?`,
    m1 ? `How do ${first} fans in ${m0} and ${m1} differ in fashion taste?` : `Where in ${m0} should I open a pop-up?`,
  ];
  $("#ask-suggestions").replaceChildren(
    ...suggestions.map((s) => el("button", { type: "button", class: "chip", text: s, onclick: () => ask(s) })),
  );
}

async function ask(question) {
  if (!state.report) return;
  const input = $("#ask-input");
  input.value = "";
  const steps = el("ul", { class: "qa-steps" });
  const answer = el("div", { class: "qa-a" }, el("div", { class: "skeleton", style: "width:60%" }));
  const card = el("div", { class: "qa" }, el("p", { class: "qa-q", text: question }), steps, answer);
  $("#ask-thread").prepend(card);
  const trace = $("#trace-list");
  addThought(trace, `Follow-up: ${question}`);
  try {
    await streamPost("/api/ask", { question, context: askContext(state.report) }, (event) => {
      if (event.type === "call") {
        upsertCall(trace, { ...event, id: `ask-${event.id}` });
        if (event.status === "running") steps.append(el("li", { text: `Asked Qloo: ${event.title}` }));
      } else if (event.type === "answer") {
        answer.replaceChildren(event.text || "No answer came back.");
      } else if (event.type === "error") {
        answer.replaceChildren(el("strong", { text: "Couldn't answer. " }), event.message);
      }
    });
  } catch (error) {
    answer.replaceChildren(el("strong", { text: "Couldn't answer. " }), error.message);
  }
}

init();
