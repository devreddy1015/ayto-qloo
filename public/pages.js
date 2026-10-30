// The run page as three pages, so a maker finds things fast: the brief (what to make), the evidence (what Qloo
// read, with every receipt) and the studio ("Make it": pictures, a shot deck, sound, 3D, made on demand).
// A thin layer over app.js. app.js still builds every stage card into #stage-cards and appends its on-demand extras
// to the write card; this module moves each card into its page by data-stage, and each extra into the studio by
// class, as soon as app.js has drawn them. Each page has its own hash (#brief, #evidence, #make); a stage's own
// anchor (#stage-gap) opens that stage's page. Nothing here runs at import, so node can test the mapping.

export const PAGES = [
  { id: "brief", label: "The brief", meta: "what to make" },
  { id: "evidence", label: "The evidence", meta: "Qloo", note: "What Qloo read for this run, stage by stage. The receipts list every request behind it." },
  { id: "make", label: "Make it", meta: "studio", note: "Turn the brief into something to show. Each one runs only when you ask." },
];

/** The stages that aren't Qloo reads. Every other stage, a new one included, is evidence. */
const STAGE_PAGE = { write: "brief", check: "brief", diff: "brief", share: "brief", produce: "make" };
export const pageOf = (stage) => STAGE_PAGE[stage] ?? "evidence";

/**
 * The extras app.js adds to the write card that belong in the studio. Anything after the write card's actions row
 * counts too, so the next on-demand extra lands in the studio without a change here.
 */
export const MAKE_BLOCKS = [".concept-image", ".shot-deck", ".music-tone", ".spoken-pitch", ".sect.garment", ".sect.refs"].join(", ");

/** What a location hash asks for: a page by its id, or a stage card's own anchor. Null for any other hash (#how). */
export function pageFromHash(hash) {
  const h = String(hash ?? "").replace(/^#/, "");
  if (PAGES.some((p) => p.id === h)) return { page: h };
  const stage = h.match(/^stage-([a-z0-9_-]+)$/i)?.[1];
  return stage ? { page: pageOf(stage), stage } : null;
}

/** The page to open when the URL names none: the evidence while Qloo is still reading, the brief once it's written. */
export const defaultPage = (status) => (status === "done" ? "brief" : "evidence");

// ---------- the DOM side ----------

const ui = {
  built: false,
  current: null,
  auto: true, // the open page was our pick, not the maker's: a live run may move it to the brief when it's done
  settled: false, // the first status of this run has been seen
  status: null,
  stage: null, // a #stage-<id> from the URL, to scroll to once its card is drawn
  seen: "",
};

const node = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) k === "text" ? (n.textContent = v) : n.setAttribute(k, v);
  n.append(...children);
  return n;
};

function build() {
  const results = document.getElementById("results");
  const main = results.querySelector(".results-main");
  const trace = results.querySelector(".trace");
  if (trace && !trace.id) trace.id = "receipts";
  ui.results = results;
  ui.bar = node("div", { class: "page-tabs", role: "tablist", "aria-label": "Pages of this run" });
  ui.tabs = {};
  ui.panels = {};
  for (const p of PAGES) {
    const tab = node(
      "button",
      { type: "button", role: "tab", id: `tab-${p.id}`, class: "page-tab", "aria-selected": "false", tabindex: "-1", "aria-controls": p.id === "evidence" && trace ? `page-${p.id} ${trace.id}` : `page-${p.id}`, "data-page": p.id },
      node("span", { class: "page-tab-label", text: p.label }),
      " ", // so the tab's name reads "The brief what to make", not "The briefwhat to make"
      node("span", { class: "page-tab-meta", text: p.meta }),
    );
    const panel = node("div", { class: "page", role: "tabpanel", id: `page-${p.id}`, "aria-labelledby": tab.id, tabindex: "0", hidden: "" });
    if (p.note) panel.append(node("p", { class: "block-note page-note", text: p.note }));
    const blocks = p.id === "make" ? node("div", { class: "page-blocks" }) : null;
    const stages = node("div", { class: "page-stages" });
    const empty = p.id === "make" ? node("p", { class: "block-note page-empty", hidden: "" }) : null;
    panel.append(...[blocks, stages, empty].filter(Boolean));
    ui.tabs[p.id] = tab;
    ui.panels[p.id] = { el: panel, blocks, stages, empty };
    ui.bar.append(tab);
  }
  main.prepend(ui.bar);
  document.getElementById("stage-cards").after(...PAGES.map((p) => ui.panels[p.id].el));
  const ask = document.getElementById("ask");
  if (ask) ui.panels.make.el.append(ask);

  ui.bar.addEventListener("click", (e) => {
    const tab = e.target.closest(".page-tab");
    if (tab) choose(tab.dataset.page);
  });
  ui.bar.addEventListener("keydown", (e) => {
    const at = PAGES.findIndex((p) => ui.tabs[p.id] === document.activeElement);
    const i = at < 0 ? PAGES.findIndex((p) => p.id === ui.current) : at;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: PAGES.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = PAGES[(to + PAGES.length) % PAGES.length].id;
    choose(next, { replace: true }); // arrows browse the tabs: one history entry, not one per key
    ui.tabs[next].focus();
  });
  // The rail opens the stage's page and lands on its card; the stage's anchor goes in the URL.
  document.getElementById("stage-rail").addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#stage-"]');
    if (!link) return;
    e.preventDefault();
    const want = pageFromHash(link.getAttribute("href"));
    ui.auto = false;
    show(want.page);
    if (location.hash !== `#stage-${want.stage}`) history.pushState(history.state, "", `#stage-${want.stage}`);
    toStage(want.stage);
  });
  addEventListener("popstate", fromLocation);
  addEventListener("hashchange", fromLocation);
  ui.observer = new MutationObserver(place);
  ui.observer.observe(results, { childList: true, subtree: true });
  ui.built = true;
}

function show(id) {
  // A page that opens skips the cards' fade-in (styles.css): a tab switch is instant.
  if (ui.current && id !== ui.current) {
    ui.results.classList.add("page-switch");
    requestAnimationFrame(() => requestAnimationFrame(() => ui.results.classList.remove("page-switch")));
  }
  ui.current = id;
  ui.results.dataset.page = id;
  for (const p of PAGES) {
    const on = p.id === id;
    ui.tabs[p.id].setAttribute("aria-selected", String(on));
    ui.tabs[p.id].tabIndex = on ? 0 : -1;
    ui.panels[p.id].el.hidden = !on;
  }
}

/** The maker picked a page: its hash goes in the history, and the page starts in view under the sticky tabs. */
function choose(id, { replace = false } = {}) {
  ui.auto = false;
  if (location.hash !== `#${id}`) history[replace ? "replaceState" : "pushState"](history.state, "", `#${id}`);
  show(id);
  toTop();
}

function toTop() {
  const top = ui.panels[ui.current].el.getBoundingClientRect().top - ui.bar.offsetHeight - 16;
  if (top < 0) scrollBy({ top, behavior: "instant" });
}

// A jump, like the rail's anchors were before the pages.
function toStage(id) {
  document.getElementById(`stage-${id}`)?.scrollIntoView({ block: "start" });
}

/** Back, Forward, or a hash typed into the address bar. */
function fromLocation(event) {
  if (!ui.built || ui.results.hidden || !/^\/run\//.test(location.pathname)) return;
  if (event?.type === "hashchange" && ui.seen === location.href) return; // popstate already took this one
  ui.seen = location.href;
  if (!location.hash) {
    ui.auto = true;
    if (!ui.status) return void (ui.settled = false); // a run still loading: its status picks the page
    show(defaultPage(ui.status));
    return toTop();
  }
  const want = pageFromHash(location.hash);
  if (!want) return; // an anchor elsewhere on the page
  ui.auto = false;
  show(want.page);
  if (want.stage) toStage(want.stage);
  else toTop();
}

/** Moves what app.js just drew into its page. Runs after each batch of DOM changes in the results. */
function place(records) {
  const cards = document.getElementById("stage-cards");
  const fresh = [...cards.querySelectorAll(":scope > section.stage")];
  if (fresh.length) {
    // app.js rebuilt the run view: the old cards go and the new ones take their pages.
    for (const old of ui.results.querySelectorAll(".page-stages > .stage")) old.remove();
    for (const card of fresh) ui.panels[pageOf(card.dataset.stage)].stages.append(card);
  }
  const body = document.querySelector("#stage-write > .stage-body");
  const redrawn = fresh.length > 0 || records.some((r) => r.target === body && r.removedNodes.length);
  const blocks = ui.panels.make.blocks;
  if (redrawn) for (const old of blocks.querySelectorAll(":scope > [data-from='write']")) old.remove();
  if (body) {
    const kids = [...body.children];
    const actions = kids.findIndex((k) => k.classList.contains("write-actions"));
    for (const extra of kids.filter((k, i) => k.matches(MAKE_BLOCKS) || (actions >= 0 && i > actions))) {
      extra.dataset.from = "write";
      blocks.append(extra);
    }
  }
  if (ui.stage && document.getElementById(`stage-${ui.stage}`)?.closest(".page")) {
    toStage(ui.stage);
    ui.stage = null;
  }
  refresh();
  ui.observer.takeRecords(); // our own moves and words above: nothing new to place
}

const say = (n, text) => n.textContent !== text && (n.textContent = text);

/** The tabs say what's on each page: a running dot while a stage there works, and the receipts count. */
function refresh() {
  for (const p of PAGES) ui.tabs[p.id].classList.toggle("running", Boolean(ui.panels[p.id].el.querySelector(".stage.running")));
  const calls = document.getElementById("trace-list")?.children.length ?? 0;
  const meta = ui.tabs.evidence.querySelector(".page-tab-meta");
  if (meta.dataset.calls !== String(calls)) {
    meta.dataset.calls = calls;
    meta.replaceChildren(calls ? `Qloo · ${calls}` : "Qloo", calls ? node("span", { class: "page-tab-unit", text: ` request${calls === 1 ? "" : "s"}` }) : "");
  }
  const make = ui.panels.make;
  const ask = document.getElementById("ask");
  const nothing = !make.blocks.children.length && !make.stages.children.length && (!ask || ask.hidden);
  make.empty.hidden = !nothing;
  say(make.empty, ui.status === "done" ? "Nothing to make for this run: this site has no image or sound tools switched on." : "The studio opens when the brief is written.");
}

/**
 * A run is about to load, called before the results show: empty the pages and open the one the URL names. With no
 * page in the URL, a run opened from the home page waits on its status, and a run redrawn in place (an edit, Write
 * again, the visitor's own copy) keeps the page the maker is on.
 */
function reset() {
  const redrawn = ui.built && !ui.results.hidden;
  if (!ui.built) build();
  for (const old of ui.results.querySelectorAll(".page-stages > *, .page-blocks > *")) old.remove();
  const want = location.hash ? pageFromHash(location.hash) : null;
  ui.stage = want?.stage ?? null;
  ui.status = null;
  ui.seen = location.href;
  ui.settled = Boolean(want) || redrawn;
  if (want) ui.auto = false;
  else if (!redrawn) ui.auto = true;
  show(want?.page ?? (redrawn ? ui.current : "evidence"));
  refresh();
}

/** The run's status, from app.js: picks the first page, and moves to the brief when a live run is done. */
function sync(run) {
  if (!ui.built || !run) return;
  const was = ui.status;
  ui.status = run.status;
  if (!ui.settled) {
    ui.settled = true;
    if (ui.auto) show(defaultPage(run.status));
  } else if (ui.auto && was === "running" && run.status === "done" && ui.current === "evidence") show("brief");
  refresh();
}

export const pages = { reset, sync };
