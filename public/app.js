// AYTO front end. One sentence in; Qloo confirms the city and theme; a run of
// 4-11 stages streams in as cards, with a receipt for every Qloo request.
// Vanilla JS; everything from Qloo or the model is inserted as text.

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
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const post = async (url, body) => {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
  return json;
};

const FORMAT_CHIPS = [
  ["reel", "Reel"],
  ["film", "Short film"],
  ["fashion", "Fashion drop"],
];
const SESSION_KEY = "ayto.llm";

const state = {
  presets: { showcases: [], formats: [], providers: [], mode: "live", llm: {} },
  format: "",
  confirm: null, // the last /api/parse answer
  run: null,
  plan: [], // [{ id, label, output }] for the run's format
  source: null,
  maps: new Map(),
  live: false, // true while the attached run is still working
  mosaicRun: null, // the run whose images the background shows
};

// ---------- the infinite canvas behind everything ----------
// A wrapping grid of image tiles that drifts on its own, follows the wheel,
// a drag or a touch, and leans a little with the mouse. Positions wrap modulo
// the grid, so it never ends. Reduced motion: no drift, drag still works.

function createCanvas(root, host) {
  const phone = () => innerWidth < 720;
  const still = () => reduced();
  let tiles = [];
  let images = [];
  let words = [];
  let cols = 0;
  let rows = 0;
  let cell = 0;
  let size = 0;
  let W = 0;
  let H = 0;
  let ox = 0;
  let oy = 0;
  let ivx = 0; // inertia after a drag, px/s
  let ivy = 0;
  let px = 0; // parallax target and current
  let py = 0;
  let cpx = 0;
  let cpy = 0;
  let raf = 0;
  let last = 0;
  let dragging = false;
  let swapTimer = 0;
  const mod = (a, n) => ((a % n) + n) % n;

  function layout() {
    const vw = innerWidth;
    const vh = innerHeight;
    size = Math.round(vw * (phone() ? 0.4 : 0.18));
    const gap = Math.round(vw * 0.05);
    cell = size + gap;
    cols = Math.ceil(vw / cell) + 1;
    rows = Math.ceil(vh / cell) + 1;
    W = cols * cell;
    H = rows * cell;
    root.style.setProperty("--tile", `${size}px`);
    build();
    place(true);
  }

  function build() {
    root.replaceChildren();
    tiles = [];
    for (let i = 0; i < cols * rows; i += 1) {
      const fig = el("figure", { class: "tile" }, el("img", { alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", draggable: "false" }), el("figcaption"));
      fill(fig, i);
      root.append(fig);
      tiles.push({ el: fig, c: i % cols, r: Math.floor(i / cols) });
    }
  }

  function fill(fig, i) {
    const img = fig.querySelector("img");
    const cap = fig.querySelector("figcaption");
    if (images.length) {
      const pick = images[i % images.length];
      fig.className = `tile t-${pick.type ?? "x"} ${pick.type === "fashion" ? "arch" : ""} ${pick.onlyHere || pick.hiddenGem ? "bright" : ""}`;
      fig.style.background = "";
      img.hidden = false;
      if (img.src !== pick.url) img.src = pick.url;
      cap.textContent = pick.name ?? "";
      return;
    }
    // No images (sample mode): abstract tiles seeded by index, some carrying a flavour name.
    const h1 = (i * 47) % 360;
    const h2 = (h1 + 50) % 360;
    const worded = words.length && i % 3 === 0;
    fig.className = `tile abstract ${worded ? "worded" : ""}`;
    fig.style.background = `linear-gradient(${(i * 37) % 360}deg, hsl(${h1} 35% 16%), hsl(${h2} 45% 28%))`;
    img.hidden = true;
    img.removeAttribute("src");
    cap.textContent = worded ? words[(i / 3) % words.length] : "";
  }

  function place(force) {
    for (const t of tiles) {
      const x = mod(t.c * cell + ox, W) - cell;
      const y = mod(t.r * cell + oy, H) - cell;
      t.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
    if (force || Math.abs(px - cpx) > 0.05 || Math.abs(py - cpy) > 0.05) root.style.transform = `translate3d(${cpx.toFixed(1)}px,${cpy.toFixed(1)}px,0)`;
  }

  function frame(t) {
    raf = 0;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
    last = t;
    let moving = false;
    if (!dragging) {
      if (!still()) {
        const speed = phone() ? 5 : 11; // px/s, diagonal
        ox -= speed * dt;
        oy -= speed * 0.7 * dt;
        moving = true;
      }
      if (Math.abs(ivx) > 1 || Math.abs(ivy) > 1) {
        ox += ivx * dt;
        oy += ivy * dt;
        const k = Math.exp(-dt * 3.5);
        ivx *= k;
        ivy *= k;
        moving = true;
      } else ivx = ivy = 0;
    } else moving = true;
    if (!still()) {
      const k = Math.min(1, dt * 5);
      cpx += (px - cpx) * k;
      cpy += (py - cpy) * k;
      if (Math.abs(px - cpx) > 0.05 || Math.abs(py - cpy) > 0.05) moving = true;
    }
    place();
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const kick = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };

  // Inputs: wheel, pointer drag (mouse or touch), mouse parallax.
  addEventListener("wheel", (e) => {
    ox -= e.deltaX * 0.4;
    oy -= e.deltaY * 0.4;
    kick();
  }, { passive: true });
  let lx = 0;
  let ly = 0;
  let lt = 0;
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true;
    ivx = ivy = 0;
    lx = e.clientX;
    ly = e.clientY;
    lt = performance.now();
    host.setPointerCapture?.(e.pointerId);
    host.classList.add("dragging");
    kick();
  });
  host.addEventListener("pointermove", (e) => {
    if (dragging) {
      const now = performance.now();
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      const dt = Math.max(1, now - lt) / 1000;
      ox += dx;
      oy += dy;
      ivx = ivx * 0.5 + (dx / dt) * 0.5;
      ivy = ivy * 0.5 + (dy / dt) * 0.5;
      lx = e.clientX;
      ly = e.clientY;
      lt = now;
      kick();
    }
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    host.classList.remove("dragging");
    if (performance.now() - lt > 80) ivx = ivy = 0;
    ivx = Math.max(-900, Math.min(900, ivx));
    ivy = Math.max(-900, Math.min(900, ivy));
    kick();
  };
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);
  host.addEventListener("lostpointercapture", release);
  addEventListener("mousemove", (e) => {
    if (still() || dragging) return;
    px = -(e.clientX / innerWidth - 0.5) * 24;
    py = -(e.clientY / innerHeight - 0.5) * 24;
    kick();
  }, { passive: true });
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? (last = 0) : kick()));

  /** Show a new set of images, crossfading tile by tile. Empty list = abstract tiles. */
  function setImages(list, labels = []) {
    const next = Array.isArray(list) ? list.filter((x) => x?.url) : [];
    const same = next.length === images.length && next.every((x, i) => x.url === images[i].url);
    images = next;
    words = labels.filter(Boolean).slice(0, 12);
    if (same && (images.length || !tiles.length)) return;
    if (!tiles.length) return;
    clearTimeout(swapTimer);
    const stagger = still() ? 0 : 22;
    tiles.forEach((t, i) => {
      setTimeout(() => {
        if (still()) {
          fill(t.el, i);
          return;
        }
        t.el.classList.add("swap");
        setTimeout(() => {
          fill(t.el, i);
          requestAnimationFrame(() => t.el.classList.remove("swap"));
        }, 420);
      }, i * stagger);
    });
  }

  layout();
  kick();
  return { setImages, layout };
}

const canvas = createCanvas($("#canvas-grid"), $("#canvas"));

/** Background images: the showcases' picks on the home page, a run's own once its read is done. */
async function loadMosaic(runId) {
  const key = runId ?? "home";
  if (state.mosaicRun === key) return;
  state.mosaicRun = key;
  let json = { images: [] };
  try {
    const response = await fetch(runId ? `/api/mosaic?run=${encodeURIComponent(runId)}` : "/api/mosaic");
    if (response.ok) json = await response.json();
  } catch {}
  if (state.mosaicRun !== key) return;
  const flavours = runId ? (state.run?.stages?.gap?.output?.flavours ?? []).map((f) => f.name) : [];
  const words = flavours.length ? flavours : runId ? [state.run?.stages?.resolve?.output?.city?.name].filter(Boolean) : (state.presets.showcases ?? []).map((s) => s.label.split(" · ")[1] ?? s.label);
  canvas.setImages(json.images ?? [], words);
}

// ---------- setup ----------

async function init() {
  try {
    state.presets = await (await fetch("/api/presets")).json();
  } catch {}
  const presets = state.presets;
  loadMosaic();

  $("#format-chips").replaceChildren(...FORMAT_CHIPS.map(([id, label]) => el("button", { type: "button", class: "chip", "aria-pressed": "false", "data-format": id, text: label, onclick: () => setFormat(state.format === id ? "" : id) })));

  $("#showcase-list").replaceChildren(...(presets.showcases ?? []).map((s) => el("button", { type: "button", class: "example", title: s.text, text: s.label, onclick: () => startShowcase(s) })));

  const providers = $("#llm-provider");
  providers.replaceChildren(...(presets.providers ?? []).map((p) => el("option", { value: p.id, text: `${p.label} · ${p.model}` })));
  providers.addEventListener("change", syncProviderHints);
  syncProviderHints();
  restoreCredential();
  $("#llm-check").addEventListener("click", checkKey);
  $("#llm-remember").addEventListener("change", persistCredential);
  for (const id of ["#llm-key", "#llm-model"]) $(id).addEventListener("input", persistCredential);

  renderModeNote();

  $("#run-form").addEventListener("submit", (event) => {
    event.preventDefault();
    parseSentence();
  });
  $("#text-input").addEventListener("input", () => markConfirmStale());
  $("#city-input").addEventListener("input", () => markConfirmStale());
  $("#theme-input").addEventListener("input", () => markConfirmStale());
  $("#ask-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("#ask-input").value.trim();
    if (q) ask(q);
  });
  $("#new-run-link").addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState({}, "", "/");
    showHome();
  });
  addEventListener("popstate", route);
  route();
}

function route() {
  const match = location.pathname.match(/^\/run\/([A-Za-z0-9_-]+)/);
  if (match) attach(match[1]);
  else showHome();
}

function showHome() {
  state.source?.close();
  state.source = null;
  $("#results").hidden = true;
  $("#home").hidden = false;
  loadMosaic();
}

function setFormat(id) {
  state.format = id;
  for (const chip of document.querySelectorAll("#format-chips .chip")) chip.setAttribute("aria-pressed", String(chip.dataset.format === id));
  const sel = $("#confirm-format");
  if (sel && sel.value !== id) sel.value = id;
}

function renderModeNote() {
  const { mode, llm = {} } = state.presets;
  const parts = [];
  if (mode === "samples") parts.push("Demo mode: replaying recorded Qloo responses, so only the showcase runs work right now.");
  else if (mode === "fake") parts.push("Synthetic sample data: the Qloo read is simulated.");
  else parts.push("Live Qloo data.");
  if (llm.available) parts.push(`Writing with ${llm.model ?? "the server's model"}.`);
  else parts.push("No language model on the server: add your key in the drawer to write. The Qloo read still runs.");
  $("#mode-note").textContent = parts.join(" ");
}

// ---------- the key drawer ----------

function providerInfo(id) {
  return (state.presets.providers ?? []).find((p) => p.id === id);
}

function syncProviderHints() {
  const p = providerInfo($("#llm-provider").value);
  $("#llm-key").placeholder = p?.keyHint ?? "…";
  $("#llm-model").placeholder = p?.model ?? "provider default";
  persistCredential();
}

/** The user's credential, or undefined. Lives in the form; sessionStorage only when asked. */
function credential() {
  const key = $("#llm-key").value.trim();
  if (!key) return undefined;
  const model = $("#llm-model").value.trim();
  return { provider: $("#llm-provider").value, key, model: model || undefined };
}

function persistCredential() {
  try {
    const c = credential();
    if ($("#llm-remember").checked && c) sessionStorage.setItem(SESSION_KEY, JSON.stringify(c));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

function restoreCredential() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const c = JSON.parse(raw);
    if (!c?.key) return;
    if (providerInfo(c.provider)) $("#llm-provider").value = c.provider;
    $("#llm-key").value = c.key;
    $("#llm-model").value = c.model ?? "";
    $("#llm-remember").checked = true;
    $("#key-drawer").open = true;
    $("#llm-check-result").textContent = "Remembered for this tab.";
    syncProviderHints();
  } catch {}
}

async function checkKey() {
  const result = $("#llm-check-result");
  const c = credential();
  if (!c) {
    result.textContent = "Paste a key first.";
    return;
  }
  const button = $("#llm-check");
  button.disabled = true;
  result.textContent = "Checking…";
  try {
    // The server reads the credential from `llm`; the flat fields are the documented shape.
    const r = await post("/api/llm/check", { ...c, llm: c });
    result.className = `check-result ${r.ok ? "ok" : "bad"}`;
    result.textContent = r.ok ? `Works. ${r.model ?? c.provider} replied “${(r.reply ?? "").trim() || "ok"}”.` : `Didn't work: ${r.error ?? "the provider rejected it."}`;
  } catch (error) {
    result.className = "check-result bad";
    result.textContent = `Didn't work: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

// ---------- confirm ----------

async function parseSentence() {
  const text = $("#text-input").value.trim();
  if (!text) return;
  const button = $("#parse-button");
  button.disabled = true;
  button.textContent = "Asking Qloo…";
  const box = $("#confirm");
  box.hidden = false;
  box.replaceChildren(el("p", { class: "confirm-wait", text: "Finding the city and theme in Qloo…" }));
  try {
    const body = { text };
    if (state.format) body.format = state.format;
    const city = $("#city-input").value.trim();
    const theme = $("#theme-input").value.trim();
    if (city) body.city = city;
    if (theme) body.theme = theme;
    state.confirm = await post("/api/parse", body);
    renderConfirm(state.confirm);
  } catch (error) {
    state.confirm = null;
    box.replaceChildren(el("p", { class: "confirm-error", text: error.message }));
  } finally {
    button.disabled = false;
    button.textContent = "Check with Qloo";
  }
}

function markConfirmStale() {
  if (!state.confirm) return;
  const note = $("#confirm-stale");
  if (note) note.hidden = false;
  const run = $("#confirm-run");
  if (run) run.disabled = true;
}

function renderConfirm(found) {
  const box = $("#confirm");
  const input = found.input ?? {};
  const cities = found.cities ?? [];
  const citySelect = el("select", { id: "confirm-city", "aria-label": "City Qloo found" }, cities.map((c, i) => el("option", { value: c.id, text: `${c.name}${c.country ? ` (${c.qlooName || c.country})` : ""}`, selected: i === 0 })));
  const formatSelect = el("select", { id: "confirm-format", "aria-label": "Format", onchange: (e) => setFormat(e.target.value) }, FORMAT_CHIPS.map(([id, label]) => el("option", { value: id, text: label, selected: id === (input.format || "film") })));
  if (input.format && input.format !== state.format) setFormat(input.format);
  const themeSelects = (found.themes ?? []).map((t) =>
    el(
      "label",
      { class: "confirm-item" },
      el("span", { class: "confirm-key", text: `Theme “${t.word}”` }),
      el("select", { class: "confirm-theme", "data-word": t.word, "aria-label": `Qloo tag for ${t.word}` }, [...t.candidates.map((c, i) => el("option", { value: c.id, text: `${c.name} · ${String(c.type).replace(/^urn:tag:/, "").split(":")[0].replace(/_/g, " ")}`, selected: i === 0 })), el("option", { value: "", text: "none (skip this word)" })]),
    ),
  );
  const loves = input.loves ?? [];
  const runButton = el("button", { id: "confirm-run", type: "button", class: "primary run", text: "Run", disabled: !found.cityFound, onclick: runFromConfirm });
  box.replaceChildren(el(
    "div",
    { class: "confirm-inner" },
    el("p", { class: "confirm-lead" }, el("strong", { text: "Qloo found → " }), found.cityFound ? el("strong", { class: "confirm-city", text: cities[0]?.name ?? input.city?.query }) : el("span", { class: "confirm-missing", text: input.city?.query || "no city" }), found.cityFound && cities[0]?.qlooName ? el("span", { class: "confirm-sub", text: ` (${cities[0].qlooName})` }) : null, (found.themes ?? []).length ? el("span", {}, " · Theme: ", (found.themes ?? []).map((t, i) => el("strong", { text: (i ? ", " : "") + (t.candidates[0]?.name ?? t.word) }))) : null, " · Format: ", el("strong", { text: FORMAT_CHIPS.find(([id]) => id === (input.format || "film"))?.[1] ?? input.format })),
    !found.cityFound ? el("p", { class: "confirm-error", text: "Qloo couldn't place that city. Try its common English name with the country, e.g. “Hyderabad, India”." }) : null,
    el(
      "div",
      { class: "confirm-grid" },
      found.cityFound ? el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "City" }), citySelect) : null,
      ...themeSelects,
      el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "Format" }), formatSelect),
      loves.length ? el("div", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "Loves" }), el("div", { class: "chips" }, loves.map((l) => el("span", { class: "swatch", text: l.name })))) : null,
    ),
    el("div", { class: "confirm-actions" }, runButton, el("span", { id: "confirm-stale", class: "confirm-note", hidden: true, text: "You changed the sentence. Check with Qloo again." }), el("span", { id: "confirm-status", class: "confirm-note" })),
  ));
}

async function runFromConfirm() {
  const found = state.confirm;
  if (!found?.cityFound) return;
  const input = found.input ?? {};
  const cityId = $("#confirm-city")?.value;
  const city = (found.cities ?? []).find((c) => c.id === cityId) ?? found.cities?.[0];
  const ids = [...document.querySelectorAll(".confirm-theme")].map((s) => s.value).filter(Boolean);
  const themeWords = [...document.querySelectorAll(".confirm-theme")].filter((s) => s.value).map((s) => s.dataset.word);
  const body = {
    text: input.text,
    format: $("#confirm-format")?.value || input.format || "film",
    city: { query: city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : input.city?.query, id: city?.id },
    theme: { query: themeWords.join(", ") || (ids.length ? input.theme?.query : "") || "", ids },
    loves: input.loves ?? [],
  };
  const c = credential();
  if (c) body.llm = c;
  const status = $("#confirm-status");
  const button = $("#confirm-run");
  button.disabled = true;
  status.textContent = "Starting…";
  try {
    const run = await post("/api/runs", body);
    history.pushState({}, "", `/run/${run.id}`);
    attach(run.id);
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
}

async function startShowcase(showcase) {
  $("#text-input").value = showcase.text;
  setFormat(showcase.format ?? "");
  $("#mode-note").textContent = "Starting the showcase…";
  try {
    const run = await post("/api/runs", { showcase: showcase.id });
    history.pushState({}, "", `/run/${run.id}`);
    attach(run.id);
  } catch (error) {
    $("#mode-note").textContent = error.message;
  } finally {
    setTimeout(renderModeNote, 4000);
  }
}

// ---------- runs ----------

function stageInfo(id, format) {
  const plan = (state.presets.formats ?? []).find((f) => f.id === format)?.plan ?? [];
  return plan.find((s) => s.id === id) ?? { id, label: id, output: "" };
}

function resetResults() {
  state.run = null;
  state.plan = [];
  for (const map of state.maps.values()) map.remove();
  state.maps.clear();
  $("#home").hidden = true;
  $("#results").hidden = false;
  $("#error-box").hidden = true;
  $("#ask").hidden = true;
  $("#trace-list").replaceChildren();
  $("#ask-thread").replaceChildren();
  $("#stage-cards").replaceChildren(el("div", { class: "skeleton" }));
  $("#stage-rail").replaceChildren();
  $("#run-title").textContent = "";
  $("#run-status").textContent = "Loading the run…";
  $("#trace-status").textContent = "";
  scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
}

async function attach(runId) {
  resetResults();
  state.source?.close();
  // The run itself first (so a bad id fails plainly), then the stream, which replays everything.
  try {
    const response = await fetch(`/api/runs/${runId}`);
    if (!response.ok) throw new Error(response.status === 404 ? "No such run. It may have been cleared from this server." : `Couldn't load the run (${response.status}).`);
    applySnapshot(await response.json());
  } catch (error) {
    $("#stage-cards").replaceChildren();
    $("#run-status").textContent = "";
    showError(error.message);
    return;
  }
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

function applySnapshot(run) {
  const first = !state.run || state.run.id !== run.id;
  state.run = run;
  state.live = run.status === "running";
  state.plan = (run.plan ?? []).map((id) => stageInfo(id, run.input?.format));
  if (first || $("#stage-cards").children.length !== state.plan.length) buildRunView();
  for (const s of state.plan) renderStage(s.id, run.stages?.[s.id]);
  for (const entry of run.ledger ?? []) upsertCall(entry);
  if (run.stages?.read?.status === "done") loadMosaic(run.id);
  if (run.status === "error") {
    const failed = state.plan.find((s) => run.stages?.[s.id]?.status === "error");
    showError(failed ? `${failed.label} failed: ${run.stages[failed.id].error ?? "unknown error"}` : "The run failed.");
  }
  updateStatus();
}

function buildRunView() {
  const run = state.run;
  const input = run.input ?? {};
  const format = FORMAT_CHIPS.find(([id]) => id === input.format)?.[1] ?? input.format;
  $("#run-title").replaceChildren(el("strong", { text: format }), el("br"), el("span", { text: input.text ?? "" }));
  $("#stage-cards").replaceChildren(...state.plan.map((s) => stageCard(s)));
  $("#stage-rail").replaceChildren(
    ...state.plan.map((s, i) =>
      el("li", { class: "rail-item pending", "data-stage": s.id }, el("a", { href: `#stage-${s.id}` }, el("span", { class: "rail-num", text: i + 1 }), el("span", {}, el("strong", { text: s.label }), el("small", { text: s.output })))),
    ),
  );
}

function onEvent(event) {
  switch (event.type) {
    case "snapshot":
      applySnapshot(event.run);
      break;
    case "run":
      if (!state.run) break;
      state.run.status = event.status;
      if (event.publish) state.run.publish = event.publish;
      if (event.status === "running") {
        $("#error-box").hidden = true;
        const from = state.plan.findIndex((s) => s.id === event.from);
        if (from >= 0) state.plan.forEach((s, i) => i > from && (state.run.stages[s.id] = { status: "stale" }));
        for (const s of state.plan) renderStage(s.id, state.run.stages[s.id]);
      }
      if (event.status === "error") showError(`${stageInfo(event.at_stage, state.run.input?.format).label} failed: ${event.message ?? "unknown error"}`);
      updateStatus();
      if (event.status !== "running") for (const s of state.plan) renderStage(s.id, state.run.stages[s.id]);
      // The written piece is the point: land on it when a live run finishes.
      if (event.status === "done" && state.live) document.getElementById("stage-write")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
      if (event.status !== "running") state.live = false;
      break;
    case "stage": {
      if (!state.run) break;
      const prev = state.run.stages[event.id] ?? {};
      state.run.stages[event.id] = { ...prev, status: event.status, output: event.output ?? (event.status === "done" ? prev.output : undefined), error: event.error };
      renderStage(event.id, state.run.stages[event.id]);
      if (event.status === "running" && state.live) document.getElementById(`stage-${event.id}`)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
      if (event.id === "read" && event.status === "done") loadMosaic(state.run.id);
      if (event.id === "gap" && event.status === "done" && state.mosaicRun === state.run.id) {
        // Flavour names arrive after the read; refresh the words on abstract tiles (same images are left alone).
        state.mosaicRun = null;
        loadMosaic(state.run.id);
      }
      break;
    }
    case "call":
      upsertCall(event);
      break;
    case "thought":
      showThought(event);
      break;
    default:
      break;
  }
}

function updateStatus() {
  const run = state.run;
  if (!run) return;
  const done = state.plan.filter((s) => run.stages?.[s.id]?.status === "done").length;
  const llm = run.llm?.byok ? `your ${providerInfo(run.llm.provider)?.label ?? run.llm.provider} key${run.llm.model ? ` (${run.llm.model})` : ""}` : state.presets.llm?.available ? `the server's model (${state.presets.llm.model})` : "no language model";
  const mode = run.mode === "samples" ? "recorded samples" : run.mode === "fake" ? "synthetic sample data" : "live Qloo data";
  const head = run.status === "running" ? `Working: ${done} of ${state.plan.length} stages done.` : run.status === "error" ? "Stopped on an error." : `Done: ${state.plan.length} stages.`;
  $("#run-status").textContent = `${head} ${mode[0].toUpperCase() + mode.slice(1)}; writing with ${llm}.`;
  const calls = run.ledger?.length ?? $("#trace-list").children.length;
  $("#trace-status").textContent = `${calls} Qloo request${calls === 1 ? "" : "s"}`;
  if (run.status !== "running") setupAsk();
}

function showError(message) {
  const box = $("#error-box");
  box.hidden = false;
  box.replaceChildren(el("strong", { text: "Something went wrong. " }), message ?? "Unknown error.");
}

// ---------- stage cards ----------

function stageCard(stage) {
  return el(
    "section",
    { class: `stage pending ${stage.id === "write" ? "hero-card" : ""}`, id: `stage-${stage.id}`, "data-stage": stage.id },
    el(
      "header",
      { class: "stage-head" },
      el("span", { class: "stage-state", "aria-hidden": "true" }),
      el("div", {}, el("h2", { text: stage.label }), el("p", { class: "stage-output-label", text: stage.output })),
      el("span", { class: "stage-summary" }),
    ),
    el("p", { class: "stage-thought", hidden: true }),
    el("div", { class: "stage-body" }),
  );
}

function showThought(event) {
  const card = document.getElementById(`stage-${event.stage}`);
  if (!card) return;
  const line = card.querySelector(".stage-thought");
  line.hidden = false;
  line.textContent = event.text;
}

function renderStage(id, s = {}) {
  const card = document.getElementById(`stage-${id}`);
  const rail = document.querySelector(`.rail-item[data-stage="${id}"]`);
  if (!card) return;
  const status = s.status ?? "pending";
  card.className = `stage ${status} ${id === "write" ? "hero-card" : ""}`;
  if (rail) rail.className = `rail-item ${status}`;
  const summary = card.querySelector(".stage-summary");
  summary.textContent = status === "error" ? "failed" : status === "running" ? "working…" : status === "stale" ? "will rerun" : s.output?.summary ?? "";
  const body = card.querySelector(".stage-body");
  const thought = card.querySelector(".stage-thought");
  if (status === "pending" || status === "stale") thought.hidden = true;
  if (status === "error") {
    body.replaceChildren(el("p", { class: "error-inline", text: s.error ?? "Failed." }));
    return;
  }
  if (status !== "done" || !s.output) {
    body.replaceChildren(status === "running" ? el("div", { class: "skeleton" }) : el("p", { class: "stage-wait", text: status === "stale" ? "Waiting to rerun." : "Waiting for the stages before it." }));
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
  body.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  if (s.output.edited) body.prepend(el("p", { class: "edited-note", text: "Edited by you. Stages after this were rerun with your changes." }));
}

// ---------- small pieces ----------

const pre = (obj) => el("pre", { class: "json", text: JSON.stringify(obj, null, 2) });
const h3 = (text) => el("h3", { text });
const note = (text) => el("p", { class: "block-note", text });
const list = (items, cls = "plain-list") => el("ul", { class: cls }, (items ?? []).map((t) => el("li", {}, t)));
const chips = (items, cls = "") => el("div", { class: `swatches ${cls}` }, (items ?? []).map((t) => (t instanceof Node ? t : el("span", { class: "swatch", text: t }))));
/** A name that came from a Qloo request. */
const q = (name, extra) => el("span", { class: "q" }, name, extra ? el("span", { class: "q-extra", text: extra }) : null, el("i", { text: "Qloo", title: "This name came from a Qloo request in this run" }));
const tag = (text, cls = "") => el("span", { class: `tag ${cls}`, text });
const typeLabel = (t) => ({ tv_show: "TV shows", movie: "Films", artist: "Music artists", person: "People", videogame: "Video games", podcast: "Podcasts", book: "Books", brand: "Brands", place: "Places" })[t] ?? t;
const pct = (v) => `${Math.round((v ?? 0) * 100)}`;
const signed = (v) => (v > 0 ? "+" : "") + String(v);
const section = (title, ...children) => el("div", { class: "sect" }, h3(title), ...children);

// ---------- renderers, one per stage ----------

const RENDER = {
  resolve(o) {
    const city = o.city ?? {};
    return [
      el(
        "div",
        { class: "resolve-grid" },
        el("div", {}, el("span", { class: "k", text: "City" }), el("strong", { class: "big", text: city.name ?? "?" }), el("span", { class: "sub", text: city.qlooName ?? city.country ?? "" })),
        o.contrast ? el("div", {}, el("span", { class: "k", text: "Contrast city" }), el("strong", { class: "big", text: o.contrast.name }), el("span", { class: "sub", text: "the country's largest other city" })) : null,
      ),
      o.theme?.tags?.length ? section("Theme, as Qloo tags", chips(o.theme.tags.map((t) => t.name))) : o.theme?.query ? note(`Theme “${o.theme.query}”: no Qloo tag matched, so the read runs on the city alone.`) : null,
      o.loves?.length ? section("Loves", chips(o.loves.map((l) => `${l.name}${l.year ? ` (${l.year})` : ""}`))) : null,
    ];
  },

  read(o) {
    const cols = Object.values(o.columns ?? {});
    if (!cols.length) return [note("Qloo returned nothing to read for this city.")];
    return cols.map((c) => {
      const rows = [...(c.rows ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      const only = rows.filter((r) => r.onlyHere);
      const shared = rows.filter((r) => !r.onlyHere);
      const row = (r) => el("li", {}, el("span", { class: "rank", text: `#${r.rank ?? "–"}` }), " ", r.name, r.hiddenGem ? tag("hidden gem", "gem") : null);
      return el(
        "div",
        { class: "readcol" },
        el("div", { class: "readcol-head" }, h3(typeLabel(c.type)), el("span", { class: "block-note", text: `read by ${c.filter === "tags" ? "theme tags" : "the loves as signals"}${c.coverage && c.coverage !== "ok" ? ` · coverage ${c.coverage}` : ""}` })),
        c.coverage === "none" || !rows.length
          ? note("Qloo has no picks of this type for the city with this theme.")
          : el(
              "div",
              { class: "cols3" },
              el("div", { class: "col" }, el("span", { class: "col-head", text: `Only ${o.city}` }), only.length ? el("ol", { class: "ranked" }, only.map(row)) : el("p", { class: "muted", text: "Nothing the country doesn't also rank." })),
              el("div", { class: "col" }, el("span", { class: "col-head", text: `Also ${o.country}` }), shared.length ? el("ol", { class: "ranked" }, shared.map(row)) : el("p", { class: "muted", text: "Every pick here is the city's own." }), c.countryNames?.length ? el("p", { class: "muted small", text: `${o.country}'s own top: ${c.countryNames.slice(0, 6).join(", ")}` }) : null),
              el("div", { class: "col" }, el("span", { class: "col-head", text: `${o.contrast ?? "Contrast city"}` }), c.contrastNames?.length ? el("ol", { class: "ranked" }, c.contrastNames.slice(0, 10).map((n) => el("li", {}, n))) : el("p", { class: "muted", text: "No read for the contrast city." })),
            ),
        c.coverage === "thin" ? note("Thin coverage: few picks came back, so read this column as a hint, not a ranking.") : null,
      );
    });
  },

  gap(o, run) {
    const city = run?.stages?.resolve?.output?.city?.name ?? "the city";
    const country = run?.stages?.resolve?.output?.city?.country ?? "the country";
    const lanes = o.lanes ?? [];
    const editable = run?.status !== "running";
    return [
      !lanes.length ? note(o.coverage === "none" ? "No flavour ranked far enough above the country to make a lane." : "No lanes yet.") : null,
      el(
        "div",
        { class: "lanes" },
        lanes.map((l, i) =>
          el(
            "div",
            { class: `lane ${i === 0 ? "lane-1" : ""}` },
            el("div", { class: "lane-head" }, el("strong", { class: "lane-name" }, i === 0 ? tag("Lane 1", "lane-tag") : tag(`Lane ${i + 1}`, "lane-tag muted"), " ", l.name), editable && i > 0 ? el("button", { type: "button", class: "linkish", text: "Make this lane 1 and rewrite", onclick: () => makeLaneFirst(i) }) : null),
            el("div", { class: "lane-bars", role: "img", "aria-label": `Gap ${pct(l.gap)}, demand ${pct(l.demand)}` }, el("span", { class: "bar demand", style: `width:${pct(l.demand)}%` }), el("span", { class: "bar gap", style: `width:${pct(l.gap)}%` })),
            el("p", { class: "lane-meta" }, el("span", { text: `${city} #${l.cityRank ?? "–"}` }), " · ", el("span", { text: l.countryRank ? `${country} #${l.countryRank}` : `not in ${country}'s top 30` }), " · ", l.mode === "demand-only" ? el("span", { text: `demand ${pct(l.demand)}` }) : el("span", { text: `${l.supplyCount ?? 0} recent${(l.supplyTitles?.length ?? 0) > (l.supplyCount ?? 0) ? ` of ${l.supplyTitles.length} titles` : ` title${l.supplyCount === 1 ? "" : "s"}`} · gap ${pct(l.gap)}` })),
            l.supplyTitles?.length ? el("div", { class: "lane-titles" }, el("span", { class: "k", text: "Titles in this lane" }), chips(l.supplyTitles.map((t) => `${t.name}${t.year ? ` (${t.year})` : ""}`), "small")) : null,
          ),
        ),
      ),
      el("p", { class: "legend" }, el("i", { class: "key-bar gap" }), " the gap (loved here, under-served) ", el("i", { class: "key-bar demand" }), " demand (how far above the country the city ranks it)"),
      o.mode === "demand-only" ? note("Supply isn't readable for this format, so the bars show demand only: lift of the flavour in the city over the country.") : null,
      o.avoid?.length ? section("The country leans to these more", chips(o.avoid.map((a) => `${a.name} ${signed(a.lift)}`), "muted")) : null,
      o.flavours?.length ? section("Flavours the city leans to", chips(o.flavours.slice(0, 12).map((f) => `${f.name} ${signed(f.lift)}`), "small")) : null,
    ];
  },

  audio(o) {
    const rows = o.shortlist ?? [];
    if (!rows.length) return [note("No artists came back for this crowd.")];
    return [
      el(
        "ul",
        { class: "people" },
        rows.map((a) =>
          el(
            "li",
            {},
            a.image ? el("img", { src: a.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : el("span", { class: "no-img" }),
            el("div", {}, el("strong", { text: a.name }), /hidden gem/i.test(a.why ?? "") ? tag("hidden gem", "gem") : null, el("span", { class: "sub", text: a.why ?? "" }), el("span", { class: "sub small", text: `affinity ${pct(a.affinity)} · popularity ${pct(a.popularity)}` })),
          ),
        ),
      ),
    ];
  },

  spots(o) {
    const venues = o.venues ?? [];
    const hoods = o.neighbourhoods ?? [];
    return [
      venues.length ? section("Places", el("ul", { class: "venues" }, venues.map((v) => el("li", {}, el("strong", { text: v.name }), v.type && v.type !== "place" ? tag(v.type) : null, v.address ? el("span", { class: "sub", text: v.address }) : null)))) : note("No places came back for this crowd."),
      hoods.length ? section("Neighbourhoods", chips(hoods.map((n) => `${n.name} ${signed(n.lift)}`))) : null,
      o.skipped?.length ? el("p", { class: "footnote", text: `${o.skipped.length} junk name${o.skipped.length === 1 ? "" : "s"} dropped.` }) : null,
    ];
  },

  audience(o) {
    const age = o.skew?.age ?? {};
    const bands = Object.entries(age);
    const max = Math.max(...bands.map(([, v]) => Math.abs(v)), 0.01);
    const label = (k) => k.replace("_and_younger", " and under").replace("_and_older", "+").replace("_to_", "–");
    return [
      bands.length
        ? el(
            "div",
            { class: "agebars", role: "img", "aria-label": `Age skew: ${bands.map(([k, v]) => `${label(k)} ${signed(v)}`).join(", ")}` },
            bands.map(([k, v]) => el("div", { class: `ageband ${v < 0 ? "neg" : ""}` }, el("span", { class: "ageval", text: signed(v.toFixed(2)) }), el("span", { class: "agebar" }, el("span", { class: "agefill", style: `height:${(Math.abs(v) / max) * 100}%` })), el("span", { class: "agelabel", text: label(k) }))),
          )
        : note("No age read for this crowd."),
      el("p", {}, el("strong", { text: "Gender: " }), o.gender ?? "no read", o.leans?.length ? el("span", {}, " · ", el("strong", { text: "Leans: " }), o.leans.join(", ")) : null),
      o.basis?.length ? el("p", { class: "footnote" }, "Read from the fans of ", o.basis.join(", "), ". Aggregate taste, never individuals.") : null,
    ];
  },

  travels(o, run) {
    const cities = o.cities ?? [];
    const home = o.home;
    const mapBox = el("div", { class: "map", role: "img", "aria-label": "Map of cities that lean the same way" });
    if ((o.points ?? []).some((p) => p.lat !== undefined)) setTimeout(() => drawMap(`${run?.id}-travels`, mapBox, o.points, home), 0);
    return [
      el(
        "div",
        { class: "panel-grid" },
        el(
          "div",
          {},
          cities.length
            ? el("ol", { class: "citylist" }, cities.map((c) => el("li", { class: c.home ? "home" : "" }, el("span", { class: "city-name" }, c.name, c.home ? tag("home") : null), el("span", { class: "bar-track" }, el("span", { class: "bar-fill", style: `width:${Math.min(100, Math.max(0, (c.lift + 0.5) * 100))}%` })), el("span", { class: "bar-val", text: signed(c.lift) }))))
            : note("No city-level read for this market."),
          home && !cities.some((c) => c.home) ? el("p", { class: "footnote", text: `Home, ${home.name}: lift ${signed(home.lift)}.` }) : null,
          o.coverage && o.coverage !== "ok" ? note(`Coverage is ${o.coverage}; read this as a regional signal.`) : null,
        ),
        mapBox,
      ),
      o.gap?.length
        ? section(
            "Culture ahead of fashion",
            note("Where the crowd's taste runs hotter than the fashion it favours has landed."),
            el("table", { class: "table" }, el("thead", {}, el("tr", {}, ["City", "Culture lift", "Fashion lift", "Gap"].map((t) => el("th", { text: t })))), el("tbody", {}, o.gap.slice(0, 8).map((g) => el("tr", {}, [g.name ?? g.key, signed(g.cultureLift), signed(g.fashionLift), el("strong", { text: pct(g.gap) })].map((t) => el("td", {}, t)))))),
          )
        : null,
    ];
  },

  write(o, run) {
    const plan = o.plan ?? {};
    const writer = WRITE[o.writer] ?? ((p) => [pre(p)]);
    const llm = o.llm ?? run?.llm ?? {};
    const canRegenerate = run?.status !== "running";
    return [
      o.fallback
        ? el("div", { class: "banner" }, el("strong", { text: "No language model wrote this. " }), "What you see is the evidence laid out as a template. Add a key in the drawer and press Write again.", o.error ? el("span", { class: "sub", text: ` (${o.error})` }) : null)
        : el("p", { class: "footnote", text: `Written by ${llm.byok ? `your ${providerInfo(llm.provider)?.label ?? llm.provider} key` : llm.provider ?? "the server's model"}${llm.model ? ` · ${llm.model}` : ""}. Names marked Qloo came from a request in this run.` }),
      ...writer(plan, run),
      el(
        "div",
        { class: "write-actions" },
        el("button", { type: "button", class: "secondary", text: "Copy", onclick: (e) => copyPlan(o, e.target) }),
        el("button", { type: "button", class: "primary", text: "Write again", disabled: !canRegenerate, onclick: (e) => regenerate(e.target) }),
        run?.publish?.url ? el("a", { class: "secondary-link", href: run.publish.url, target: "_blank", rel: "noopener", text: "Open share page" }) : null,
        el("span", { class: "edit-status", id: "write-status" }),
      ),
    ];
  },

  check(o) {
    return [
      el("p", { class: "lead" }, el("strong", { text: `${o.grounded ?? 0} of ${o.checked ?? 0}` }), ` names trace to Qloo · ${o.removed ?? 0} removed`),
      o.removed > 0 && o.items?.length ? section("Removed", list(o.items.map((i) => `${i.kind ?? "name"}: ${i.name}`))) : note("Every name in the written piece traces to a Qloo request in this run."),
    ];
  },

  diff(o) {
    const without = o.withoutQloo ?? {};
    const unavailable = without.unavailable || !Object.keys(without).length;
    const b = o.benchmark ?? {};
    const col = (title, body, bench, cls) => el("div", { class: `diff-col ${cls}` }, h3(title), bench ? el("p", { class: "block-note", text: `${bench.grounded ?? 0} of ${bench.named ?? 0} names trace to evidence` }) : null, body);
    const withoutBody = unavailable
      ? el("p", { class: "muted", text: o.error ? `Not run: ${o.error}` : "No model was available to answer without evidence." })
      : el("dl", { class: "spec" }, ...Object.entries(without).flatMap(([k, v]) => [el("dt", { text: k.replace(/_/g, " ") }), el("dd", { text: (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : x?.name ?? x?.title ?? x?.artist ?? JSON.stringify(x))).join(", ") || "—" })]));
    return [
      note(`The same question, asked twice: “${o.question ?? ""}”`),
      el("div", { class: "diff" }, col("With Qloo", (o.withQloo ?? []).length ? chips((o.withQloo ?? []).map((n) => q(n))) : el("p", { class: "muted", text: "No names." }), b.withQloo, "with"), col("Without Qloo", withoutBody, b.withoutQloo, "")),
    ];
  },

  share(o) {
    return [el("p", {}, el("a", { class: "primary-link", href: o.url, target: "_blank", rel: "noopener", text: `Open ${location.origin}${o.url}` })), note("A static page: the written piece, the lanes, and how many names trace to Qloo. Send it.")];
  },
};

// ---------- the written piece, per format ----------

const kv = (label, value) => (value ? el("p", { class: "kv" }, el("strong", { text: `${label}: ` }), value) : null);

const WRITE = {
  film(p) {
    const titles = (p.titles ?? []).filter(Boolean);
    return [
      titles.length ? el("div", { class: "titles" }, titles.map((t, i) => el("span", { class: `title-option ${i === 0 ? "first" : ""}`, text: t }))) : el("p", { class: "muted", text: "No titles yet." }),
      p.lane?.flavour ? el("p", { class: "lane-line" }, tag("Lane", "lane-tag"), " ", q(p.lane.flavour), p.lane.why ? el("span", { class: "sub", text: ` ${p.lane.why}` }) : null) : null,
      p.logline ? el("p", { class: "lead", text: p.logline }) : null,
      kv("Theme", p.theme),
      p.synopsis && Object.values(p.synopsis).some(Boolean) ? el("div", { class: "acts" }, ["act1", "act2", "act3"].map((k, i) => el("div", { class: "act" }, el("span", { class: "k", text: `Act ${i + 1}` }), el("p", { text: p.synopsis[k] || "—" })))) : null,
      p.characters?.length ? section("Characters", list(p.characters.map((c) => el("span", {}, el("strong", { text: c.role ?? "" }), c.note ? ` ${c.note}` : "")))) : null,
      p.references?.length ? section("References", list(p.references.map((r) => el("span", {}, q(r.title), r.take ? ` · ${r.take}` : "")))) : null,
      p.soundtrack?.length ? section("Soundtrack", list(p.soundtrack.map((s) => el("span", {}, q(s.artist), s.use ? tag(s.use) : null)))) : null,
      p.audience?.who ? section("Audience", el("p", {}, el("strong", { text: p.audience.who }), p.audience.note ? ` ${p.audience.note}` : "")) : null,
      p.travels_next?.length ? section("Travels next", chips(p.travels_next.map((c) => q(c)))) : null,
      p.avoid?.length ? section("Avoid", chips(p.avoid.map((a) => q(a)), "muted")) : null,
    ];
  },
  reel(p) {
    return [
      p.title ? el("p", { class: "title-option first", text: p.title }) : null,
      p.hook ? el("p", { class: "hook", text: p.hook }) : el("p", { class: "muted", text: "No hook yet." }),
      p.beats?.length ? section("Beats", el("ol", { class: "beats" }, p.beats.map((b) => el("li", { text: b })))) : null,
      p.audio?.artist ? section("Audio", el("p", {}, q(p.audio.artist), p.audio.why ? ` · ${p.audio.why}` : "")) : null,
      p.spots?.length ? section("Spots", list(p.spots.map((s) => el("span", {}, q(s.name), s.why ? ` · ${s.why}` : "")))) : null,
      p.references?.length ? section("References", chips(p.references.map((r) => q(typeof r === "string" ? r : r.title ?? r.name)))) : null,
      p.caption ? section("Caption", el("p", { class: "caption", text: p.caption })) : null,
      p.hashtags?.length ? chips(p.hashtags.map((h) => q(h)), "small") : null,
      p.why_it_lands?.length ? section("Why it lands", list(p.why_it_lands.map((w) => el("span", {}, w.claim, w.from ? el("span", { class: "sub", text: ` (${w.from})` }) : null)))) : null,
      p.alternates?.length ? section("Alternates", list(p.alternates.map((a) => el("span", {}, el("strong", { text: a.title ?? "" }), a.hook ? ` — ${a.hook}` : "")))) : null,
    ];
  },
  fashion(p) {
    const hex = (h) => (/^#[0-9a-f]{6}$/i.test(h ?? "") ? h : "#888888");
    return [
      p.drop_name ? el("p", { class: "title-option first", text: p.drop_name }) : null,
      p.positioning ? el("p", { class: "lead", text: p.positioning }) : null,
      p.palette?.length ? section("Palette", el("div", { class: "palette" }, p.palette.map((c) => el("div", { class: "chip-color" }, el("span", { class: "chip-fill", style: `background:${hex(c.hex)}` }), el("strong", { text: c.name ?? c.hex }), el("small", { text: (c.from_tags ?? []).join(", ") }))))) : null,
      p.styles?.length ? section("Styles", el("div", { class: "styles" }, p.styles.map((s) => el("div", { class: `style-card ${s.hero ? "hero" : ""}` }, el("strong", { text: s.name ?? "" }), el("span", { class: "sub", text: `${s.category ?? ""}${s.hero ? " · hero" : ""}` }), s.cues?.length ? el("p", { class: "small", text: s.cues.join(" · ") }) : null, s.from_tags?.length ? chips(s.from_tags.map((t) => q(t)), "small") : null, s.colourways?.length ? el("span", { class: "sub small", text: s.colourways.join(" · ") }) : null)))) : null,
      p.brands_to_study?.length ? section("Brands to study", chips(p.brands_to_study.map((b) => q(b)))) : null,
      p.soundtrack?.length ? section("Soundtrack", chips(p.soundtrack.map((a) => q(typeof a === "string" ? a : a.artist ?? a.name)))) : null,
      p.first_cities?.length ? section("First cities", chips(p.first_cities.map((c) => q(c)))) : null,
      p.channels?.length ? section("Channels", list(p.channels)) : null,
      p.avoid?.length ? section("Avoid", chips(p.avoid.map((a) => q(a)), "muted")) : null,
    ];
  },
};

/** Plain text of the written piece, for the clipboard. */
function planText(o) {
  const p = o.plan ?? {};
  const lines = [];
  const add = (label, v) => v && lines.push(label ? `${label}: ${v}` : v);
  const names = (arr, f = (x) => x) => (arr ?? []).map((x) => (typeof x === "string" ? x : f(x))).filter(Boolean).join(", ");
  if (o.writer === "film") {
    add("Titles", names(p.titles));
    add("Lane", p.lane?.flavour && `${p.lane.flavour}${p.lane.why ? ` — ${p.lane.why}` : ""}`);
    add("Logline", p.logline);
    add("Theme", p.theme);
    for (const [i, k] of ["act1", "act2", "act3"].entries()) add(`Act ${i + 1}`, p.synopsis?.[k]);
    add("Characters", names(p.characters, (c) => `${c.role}${c.note ? ` (${c.note})` : ""}`));
    add("References", names(p.references, (r) => `${r.title}${r.take ? ` (${r.take})` : ""}`));
    add("Soundtrack", names(p.soundtrack, (s) => `${s.artist}${s.use ? ` (${s.use})` : ""}`));
    add("Audience", p.audience?.who && `${p.audience.who}${p.audience.note ? ` — ${p.audience.note}` : ""}`);
    add("Travels next", names(p.travels_next));
    add("Avoid", names(p.avoid));
  } else if (o.writer === "reel") {
    add("Title", p.title);
    add("Hook", p.hook);
    (p.beats ?? []).forEach((b, i) => add(`Beat ${i + 1}`, b));
    add("Audio", p.audio?.artist && `${p.audio.artist}${p.audio.why ? ` — ${p.audio.why}` : ""}`);
    add("Spots", names(p.spots, (s) => `${s.name}${s.why ? ` (${s.why})` : ""}`));
    add("References", names(p.references, (r) => r.title ?? r.name));
    add("Caption", p.caption);
    add("Hashtags", names(p.hashtags));
    add("Why it lands", names(p.why_it_lands, (w) => w.claim));
    add("Alternates", names(p.alternates, (a) => `${a.title} — ${a.hook}`));
  } else {
    add("Drop", p.drop_name);
    add("Positioning", p.positioning);
    add("Palette", names(p.palette, (c) => `${c.name} ${c.hex}`));
    add("Styles", names(p.styles, (s) => `${s.name} (${s.category}${s.hero ? ", hero" : ""})`));
    add("Brands to study", names(p.brands_to_study));
    add("Soundtrack", names(p.soundtrack, (a) => a.artist ?? a.name));
    add("First cities", names(p.first_cities));
    add("Channels", names(p.channels));
    add("Avoid", names(p.avoid));
  }
  lines.push("", `Made with AYTO on Qloo's taste graph. ${location.origin}/run/${state.run?.id ?? ""}`);
  return lines.join("\n");
}

async function copyPlan(o, button) {
  const text = planText(o);
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Couldn't copy";
  }
  setTimeout(() => (button.textContent = "Copy"), 1600);
}

async function regenerate(button) {
  if (!state.run) return;
  const status = $("#write-status");
  const c = credential();
  if (!c && !state.presets.llm?.available) {
    status.textContent = "No language model on the server. Add your key in the drawer on the home page, then press Write again.";
    return;
  }
  button.disabled = true;
  status.textContent = "Writing again…";
  try {
    await post(`/api/runs/${state.run.id}/regenerate`, c ? { llm: c } : {});
    attach(state.run.id);
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
}

// ---------- edit and rerun: pick lane 1 ----------

async function makeLaneFirst(index) {
  const run = state.run;
  const gap = run?.stages?.gap?.output;
  if (!gap?.lanes?.[index]) return;
  const lanes = [gap.lanes[index], ...gap.lanes.filter((_, i) => i !== index)];
  const card = document.getElementById("stage-gap");
  const buttons = card.querySelectorAll("button");
  for (const b of buttons) b.disabled = true;
  const body = { stage: "gap", edits: { lanes, summary: `Lane 1: ${lanes[0].name} (your pick).` } };
  const c = credential();
  if (c) body.llm = c;
  try {
    await post(`/api/runs/${run.id}/edit`, body);
    attach(run.id);
  } catch (error) {
    showError(error.message);
    for (const b of buttons) b.disabled = false;
  }
}

// ---------- map ----------

function drawMap(key, box, points, home) {
  if (!window.L || !box.isConnected) return;
  const map = L.map(box, { scrollWheelZoom: false });
  // OpenStreetMap's own tiles, inverted to the dark canvas in CSS.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 10, className: "tiles-dark" }).addTo(map);
  const pts = (points ?? []).filter((p) => p.lat !== undefined && p.lon !== undefined);
  for (const p of pts) {
    const isHome = home && p.name === home.name;
    const color = isHome ? "#ffffff" : p.lift > 0.2 ? "#dfe3ff" : p.lift > 0 ? "#9aa3c7" : "#5d6382";
    const marker = L.circleMarker([p.lat, p.lon], { radius: 4 + Math.max(0, p.lift ?? 0) * 16, color, weight: 2, fillColor: color, fillOpacity: isHome ? 0.8 : 0.35 }).addTo(map);
    const label = document.createElement("div");
    label.append(el("strong", { text: p.name }), el("br"), `lift ${signed(p.lift)}${isHome ? " · home" : ""}`);
    marker.bindPopup(label);
  }
  if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])).pad(0.2));
  state.maps.set(key, map);
}

// ---------- receipts ----------

function upsertCall(entry) {
  const trace = $("#trace-list");
  let item = trace.querySelector(`[data-call="${CSS.escape(entry.id)}"]`);
  if (!item) {
    item = el("li", { class: "trace-item", "data-call": entry.id });
    trace.append(item);
  }
  item.className = `trace-item ${entry.status}`;
  const meta = entry.status === "running" ? "…" : entry.status === "error" ? "failed" : `${entry.count ?? 0} · ${entry.ms ?? 0}ms`;
  const requests = entry.provenance?.requests ?? [];
  const detail = entry.status === "error" ? entry.error : JSON.stringify({ ...(entry.args ? { args: entry.args } : {}), ...(requests.length ? { requests: requests.map((r) => ({ [`${r.method ?? "GET"} ${r.path ?? entry.provenance?.endpoint ?? ""}`]: r.query ?? r.body ?? {} })) } : {}), ...(entry.provenance?.source ? { source: entry.provenance.source } : {}) }, null, 2);
  item.replaceChildren(el("details", {}, el("summary", {}, el("span", { class: "state", "aria-hidden": "true" }), el("span", {}, entry.title ?? entry.tool, el("span", { class: "tool", text: `${entry.stage ?? ""} · ${entry.tool ?? ""}` })), el("span", { class: "meta", text: meta })), el("pre", { text: detail || "" })));
  const count = trace.children.length;
  $("#trace-status").textContent = `${count} Qloo request${count === 1 ? "" : "s"}`;
}

// ---------- ask ----------

function askContext() {
  const run = state.run;
  const r = run.stages.resolve?.output;
  const g = run.stages.gap?.output;
  const read = run.stages.read?.output?.columns ?? {};
  return {
    making: run.input?.format,
    sentence: run.input?.text,
    city: r?.city ? { id: r.city.id, name: r.city.name, country: r.city.country } : run.input?.city,
    contrast: r?.contrast?.name,
    theme: (r?.theme?.tags ?? []).map((t) => t.name),
    lanes: (g?.lanes ?? []).map((l) => ({ name: l.name, cityRank: l.cityRank, countryRank: l.countryRank, gap: l.gap })),
    picks: Object.fromEntries(Object.entries(read).map(([k, c]) => [k, (c.rows ?? []).slice(0, 8).map((x) => ({ id: x.id, name: x.name, onlyHere: x.onlyHere }))])),
    artists: (run.stages.audio?.output?.shortlist ?? []).slice(0, 6).map((a) => ({ id: a.id, name: a.name })),
    travels: (run.stages.travels?.output?.cities ?? []).slice(0, 6).map((c) => c.name),
  };
}

function setupAsk() {
  const run = state.run;
  const r = run?.stages?.resolve?.output;
  if (!r?.city) return;
  $("#ask").hidden = false;
  const city = r.city.name;
  const lane = run.stages.gap?.output?.lanes?.[0]?.name;
  const artist = run.stages.audio?.output?.shortlist?.[0]?.name;
  const other = run.stages.travels?.output?.cities?.find((c) => !c.home)?.name;
  const suggestions = [
    lane ? `Why does ${city} rank ${lane} so far above the country?` : `What does ${city} love that the country doesn't?`,
    artist ? `Which of these artists is strongest in ${other ?? city}?` : `Which artists do fans in ${city} favour?`,
    other ? `What else do ${city} and ${other} share?` : `Which cities lean the same way as ${city}?`,
  ];
  $("#ask-suggestions").replaceChildren(...suggestions.map((s) => el("button", { type: "button", class: "chip", text: s, onclick: () => ask(s) })));
}

async function ask(question) {
  if (!state.run) return;
  $("#ask-input").value = "";
  const steps = el("ul", { class: "qa-steps" });
  const answer = el("div", { class: "qa-a" }, el("div", { class: "skeleton", style: "width:60%" }));
  $("#ask-thread").prepend(el("div", { class: "qa" }, el("p", { class: "qa-q", text: question }), steps, answer));
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
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
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
