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

// Edit keys of the runs started in this browser. A change to any other run (a showcase someone else opened, a page
// from the gallery) comes back as the visitor's own copy.
// Kept in memory too, for a browser that blocks storage: its own changes then don't make a copy each time.
const sessionKeys = new Map();
const editKeyOf = (id) => {
  try {
    return localStorage.getItem(`ayto-edit:${id}`) || sessionKeys.get(id);
  } catch {
    return sessionKeys.get(id);
  }
};
const keepEditKey = (id, key) => {
  if (!id || !key) return;
  sessionKeys.set(id, key);
  try {
    localStorage.setItem(`ayto-edit:${id}`, key);
  } catch {}
};

/** Change the open run (edit, regenerate, assumptions) and show the result: the run itself, or the copy made for this visitor. */
async function changeRun(action, body) {
  const id = state.run.id;
  const out = await post(`/api/runs/${id}/${action}`, { ...body, editKey: editKeyOf(id) });
  const next = out.forked?.id ?? id;
  if (out.forked) {
    keepEditKey(next, out.forked.editKey);
    history.pushState({}, "", `/run/${next}`);
  }
  attach(next);
  return out;
}

const FORMAT_CHIPS = [
  ["reel", "Reel"],
  ["film", "Short film"],
  ["fashion", "Fashion drop"],
];
/** [id, label] for every format the server offers; the three above only when presets failed to load. */
const formats = () => (state.presets.formats?.length ? state.presets.formats.map((f) => [f.id, f.label ?? f.id]) : FORMAT_CHIPS);
const formatLabel = (id) => formats().find(([k]) => k === id)?.[1] ?? id;
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
  viewer: null, // the 3D garment viewer on the fashion write card, one per run view
  garmentPick: null, // { index, colourway } the user chose on it, kept across re-renders of the card
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
  state.mosaicImages = json.images ?? [];
  canvas.setImages(state.mosaicImages, mosaicWords(runId));
}

function mosaicWords(runId) {
  const flavours = runId ? (state.run?.stages?.gap?.output?.flavours ?? []).map((f) => f.name) : [];
  return flavours.length ? flavours : runId ? [state.run?.stages?.resolve?.output?.city?.name].filter(Boolean) : (state.presets.showcases ?? []).map((s) => s.label.split(" · ")[1] ?? s.label);
}

// ---------- setup ----------

async function init() {
  try {
    state.presets = await (await fetch("/api/presets")).json();
  } catch {}
  const presets = state.presets;
  loadMosaic();

  const PRIMARY = ["film", "reel", "fashion"];
  const chip = ([id, label]) => el("button", { type: "button", class: `chip ${PRIMARY.includes(id) ? "" : "beta"}`, "aria-pressed": "false", "data-format": id, text: PRIMARY.includes(id) ? label : `${label} · beta`, onclick: () => setFormat(state.format === id ? "" : id) });
  const primary = formats().filter(([id]) => PRIMARY.includes(id)).map(chip);
  const more = formats().filter(([id]) => !PRIMARY.includes(id)).map(chip);
  const toggle = more.length ? el("button", { type: "button", class: "chip ghost", text: `More formats (${more.length}, beta)`, "aria-expanded": "false", onclick: (e) => { const open = e.currentTarget.getAttribute("aria-expanded") !== "true"; e.currentTarget.setAttribute("aria-expanded", String(open)); e.currentTarget.textContent = open ? "Fewer formats" : `More formats (${more.length}, beta)`; for (const m of more) m.hidden = !open; } }) : null;
  for (const m of more) m.hidden = true;
  $("#format-chips").replaceChildren(...primary, toggle, ...more);

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
  $("#where-button").addEventListener("click", () => findWhere());
  $("#text-input").addEventListener("input", () => markConfirmStale());
  // Enter sends the sentence and Shift+Enter starts a new line; Enter that ends an IME word (Telugu, Hindi) stays with the IME.
  $("#text-input").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    $("#run-form").requestSubmit();
  });
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
  // A rail link (#stage-gap) also fires popstate: the run on screen stays, the browser just scrolls.
  if (match && match[1] === state.run?.id && !$("#results").hidden) return;
  if (match) attach(match[1]);
  else showHome();
}

function showHome() {
  state.attachTicket = (state.attachTicket ?? 0) + 1; // a run still loading must not draw over the home page
  state.askAbort?.abort();
  loadGallery();
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

// ---------- where should I make it ----------

/** One theme across the market's largest cities: which has the widest open lane. Qloo only, no key needed. */
async function findWhere() {
  const text = $("#text-input").value.trim();
  const theme = $("#theme-input").value.trim();
  const city = $("#city-input").value.trim();
  const box = $("#where");
  const button = $("#where-button");
  if (!text && !theme) {
    box.hidden = false;
    box.replaceChildren(el("p", { class: "confirm-error", text: "Say what you're making and what it's about first, e.g. “a crime short film in India”." }));
    return;
  }
  button.disabled = true;
  box.hidden = false;
  box.replaceChildren(el("p", { class: "confirm-wait", text: "Reading the theme across ten cities in Qloo…" }));
  try {
    const body = { text };
    if (state.format) body.format = state.format;
    if (theme) body.theme = theme;
    if (city) body.city = city;
    const out = await post("/api/where", body);
    state.where = out;
    renderWhere(out);
    box.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  } catch (error) {
    box.replaceChildren(el("p", { class: "confirm-error", text: error.message }));
  } finally {
    button.disabled = false;
  }
}

function renderWhere(out) {
  const box = $("#where");
  const read = out.cities.filter((c) => c.coverage !== "none");
  const mapBox = el("div", { class: "map where-map", role: "img", "aria-label": `Map of ${out.market}'s cities by how wide their open lane is for ${out.theme}` });
  setTimeout(() => drawWhereMap(mapBox, out), 0);
  box.replaceChildren(
    el(
      "div",
      { class: "where-inner" },
      el("p", { class: "where-lead" }, el("strong", { text: out.summary })),
      el("p", { class: "block-note", text: `${formatLabel(out.format)} · ${out.theme} · ${out.market}. One Qloo tag read per city on ${({ movie: "film", tv_show: "series", artist: "music", place: "place", brand: "brand", book: "book", podcast: "podcast", videogame: "game", person: "people" })[out.type] ?? out.type} tags; each city is measured against ${out.market} and against the other ${Math.max(0, read.length - 1)} cities, so a lane counts only where few others share it.` }),
      mapBox,
      el(
        "ol",
        { class: "where-list" },
        out.cities.map((c, i) =>
          el(
            "li",
            { class: `where-city ${i === 0 && c.lanes.length ? "first" : ""}` },
            el("div", { class: "where-head" }, el("span", { class: "where-rank", text: `#${i + 1}` }), el("strong", { class: "where-name", text: c.name }), c.state ? el("span", { class: "sub", text: ` ${c.state}` }) : null),
            c.lanes.length
              ? el("ul", { class: "where-lanes" }, c.lanes.map((l) => el("li", {}, el("strong", { text: l.name }), el("span", { class: "sub", text: ` ${signed(l.lift)} vs ${out.market} · ${signed(l.specific ?? "?")} vs the other cities`}))))
              : el("p", { class: "muted small", text: c.coverage === "none" ? "Qloo returned no flavours for this city." : "Nothing here the other cities don't share." }),
            el("button", { type: "button", class: i === 0 && c.lanes.length ? "primary small" : "secondary small", text: `Make it in ${c.name}`, onclick: () => makeItHere(c, out) }),
          ),
        ),
      ),
      out.shared?.length ? el("p", { class: "where-shared" }, el("strong", { text: "Crowded everywhere: " }), `${out.shared.map((s) => `${s.name} (${s.cities} of ${s.of} cities)`).join(", ")}.`, el("span", { class: "sub", text: "Every big city already leans to these, so none of them is one city's gap." })) : null,
      el("p", { class: "footnote", text: "The full run for a city reads deeper (recent supply, its own control cities, the look, the places), so its lanes can differ a little from this overview." }),
      el("details", { class: "where-receipts" }, el("summary", { text: `${out.ledger.length} Qloo requests behind this` }), el("ul", {}, out.ledger.map((e) => el("li", {}, `${e.title} · ${e.count ?? 0} result${e.count === 1 ? "" : "s"} · ${e.ms ?? 0} ms`)))),
    ),
  );
}

function drawWhereMap(box, out) {
  if (!window.L || !box.isConnected) return;
  state.maps.get("where")?.remove();
  const map = L.map(box, { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 10, className: "tiles-dark" }).addTo(map);
  const pts = out.cities.filter((c) => c.lat !== undefined && c.lon !== undefined);
  const best = Math.max(1, ...pts.map((c) => c.lanes[0]?.strength ?? 0));
  pts.forEach((c, i) => {
    const s = c.lanes[0]?.strength ?? 0;
    const color = i === 0 && s > 0 ? "#f2be22" : s > 0 ? "#dfe3ff" : "#5d6382";
    const marker = L.circleMarker([c.lat, c.lon], { radius: 5 + (s / best) * 16, color, weight: 2, fillColor: color, fillOpacity: i === 0 ? 0.75 : 0.35 }).addTo(map);
    const label = document.createElement("div");
    label.append(el("strong", { text: `#${i + 1} ${c.name}` }), el("br"), c.lanes[0] ? `${c.lanes[0].name} · ${signed(c.lanes[0].lift)}` : "no open lane");
    marker.bindPopup(label);
  });
  if (pts.length) map.fitBounds(L.latLngBounds(pts.map((c) => [c.lat, c.lon])).pad(0.15));
  state.maps.set("where", map);
}

/** From the overview to the full run: the picked city goes into the brief and Qloo confirms it as usual. */
function makeItHere(c, out) {
  $("#city-input").value = `${c.name}, ${out.market}`;
  if (!$("#theme-input").value.trim()) $("#theme-input").value = out.theme;
  if (!$("#text-input").value.trim()) $("#text-input").value = `A ${out.format} in ${c.name} about ${out.theme}`;
  if (out.format && state.format !== out.format) setFormat(out.format);
  parseSentence();
  $("#confirm").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}

// ---------- languages ----------

/** "Telugu · తెలుగు": a language as the pickers show it. */
const languageLabel = (l) => (l.native && l.native !== l.name ? `${l.name} · ${l.native}` : l.name);
const fontsLoaded = new Set();
/** Load one script's web font (Noto Sans Telugu…) the first time a brief or a picker needs it. */
function useFont(family) {
  if (!family || fontsLoaded.has(family)) return;
  fontsLoaded.add(family);
  document.head.append(el("link", { rel: "stylesheet", href: `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400..700&display=swap` }));
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
  const formatSelect = el("select", { id: "confirm-format", "aria-label": "Format", onchange: (e) => setFormat(e.target.value) }, formats().map(([id, label]) => el("option", { value: id, text: label, selected: id === (input.format || "film") })));
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
  // Each love as Qloo lists it. Titles can share a name (an original and its remake), so the maker picks.
  const optionLabel = (o) => `${o.name}${o.year ? ` (${o.year}` : ""}${o.language ? `${o.year ? ", " : " ("}${o.language}` : ""}${o.year || o.language ? ")" : ""}${o.remake ? " · remake" : ""}`;
  const loveOptions = new Map((found.loves ?? []).map((l) => [l.name, l.options ?? []]));
  const loveItems = loves.map((l, i) => {
    const options = loveOptions.get(l.name) ?? [];
    if (options.length < 2) return el("div", { class: "confirm-item" }, el("span", { class: "confirm-key", text: i ? "Also loves" : "Loves" }), el("div", { class: "chips" }, el("span", { class: "swatch", text: options[0] ? optionLabel(options[0]) : l.name })));
    return el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: `“${l.name}”` }), el("select", { class: "confirm-love", "data-index": i, "aria-label": `Which ${l.name}` }, options.map((o, j) => el("option", { value: o.id, text: optionLabel(o), selected: j === 0 }))));
  });
  const fmt = input.format || "film";
  const budgetSelect = ["film", "reel"].includes(fmt) ? el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "Budget" }), el("select", { id: "confirm-budget", "aria-label": "Budget" }, [["", "not stated (indie)"], ["shoestring", "Shoestring"], ["indie", "Indie"], ["premium", "Premium"]].map(([v, t]) => el("option", { value: v, text: t, selected: v === (input.budget ?? "") })))) : null;
  // The language the brief is written in: English, or the picked city's own (Telugu for Hyderabad).
  const languageSelect = el("select", { id: "confirm-language", "aria-label": "Write the brief in" });
  const languageItem = el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "Write in" }), languageSelect);
  const fillLanguages = () => {
    const city = cities.find((c) => c.id === citySelect.value) ?? cities[0];
    const list = [...(city?.languages?.length ? city.languages : [{ name: "English" }])];
    if (input.language && !list.some((l) => l.name === input.language)) list.push({ name: input.language });
    const keep = languageSelect.value || input.language || "English";
    for (const l of list) useFont(l.font);
    languageSelect.replaceChildren(...list.map((l) => el("option", { value: l.name, text: languageLabel(l), selected: l.name === keep })));
    languageItem.hidden = list.length < 2;
  };
  citySelect.addEventListener("change", fillLanguages);
  fillLanguages();
  const runButton = el("button", { id: "confirm-run", type: "button", class: "primary run", text: "Run", disabled: !found.cityFound, onclick: runFromConfirm });
  box.replaceChildren(el(
    "div",
    { class: "confirm-inner" },
    el("p", { class: "confirm-lead" }, el("strong", { text: "Qloo found → " }), found.cityFound ? el("strong", { class: "confirm-city", text: cities[0]?.name ?? input.city?.query }) : el("span", { class: "confirm-missing", text: input.city?.query || "no city" }), found.cityFound && cities[0]?.qlooName ? el("span", { class: "confirm-sub", text: ` (${cities[0].qlooName})` }) : null, (found.themes ?? []).length ? el("span", {}, " · Theme: ", (found.themes ?? []).map((t, i) => el("strong", { text: (i ? ", " : "") + (t.candidates[0]?.name ?? t.word) }))) : null, " · Format: ", el("strong", { text: formatLabel(input.format || "film") })),
    !found.cityFound ? el("p", { class: "confirm-error" }, "Qloo couldn't place that city. Try its common English name with the country, e.g. “Hyderabad, India”, or ", el("button", { type: "button", class: "linkish", text: "let AYTO pick the city", onclick: () => findWhere() }), ".") : null,
    found.corrected ? el("p", { class: "confirm-note", text: `Qloo has no “${found.corrected.from}”, so AYTO read it as ${found.corrected.to}. Pick another city below or change the sentence if that's wrong.` }) : null,
    el(
      "div",
      { class: "confirm-grid" },
      found.cityFound ? el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "City" }), citySelect) : null,
      ...themeSelects,
      el("label", { class: "confirm-item" }, el("span", { class: "confirm-key", text: "Format" }), formatSelect),
      ...loveItems,
      budgetSelect,
      found.cityFound ? languageItem : null,
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
    loves: (input.loves ?? []).map((l, i) => {
      const picked = document.querySelector(`.confirm-love[data-index="${i}"]`)?.value;
      return picked ? { ...l, id: picked } : l;
    }),
  };
  const budgetBox = $("#confirm-budget");
  const budget = budgetBox ? budgetBox.value : input.budget;
  if (budget) body.budget = budget;
  body.language = $("#confirm-language")?.value || "English";
  const c = credential();
  if (c) body.llm = c;
  const status = $("#confirm-status");
  const button = $("#confirm-run");
  button.disabled = true;
  status.textContent = "Starting…";
  try {
    const run = await post("/api/runs", body);
    keepEditKey(run.id, run.editKey);
    // Ready for the next one when the maker comes back to this card.
    status.textContent = "";
    button.disabled = false;
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
    keepEditKey(run.id, run.editKey);
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
  state.askAbort?.abort();
  // The run's maps go; the home page's "Where should I make it?" map stays for the way back.
  for (const [key, map] of state.maps) {
    if (key === "where") continue;
    map.remove();
    state.maps.delete(key);
  }
  destroyViewer();
  state.garmentPick = null;
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
  // Only the latest call may draw: two quick clicks (or a click then Back) must not leave the slower run on screen.
  const ticket = (state.attachTicket = (state.attachTicket ?? 0) + 1);
  resetResults();
  state.source?.close();
  state.source = null;
  // The run itself first (so a bad id fails plainly), then the stream: a snapshot, then live events.
  try {
    const response = await fetch(`/api/runs/${runId}`);
    if (!response.ok) throw new Error(response.status === 404 ? "No such run. It may have been cleared from this server." : `Couldn't load the run (${response.status}).`);
    const run = await response.json();
    if (ticket !== state.attachTicket) return;
    applySnapshot(run);
  } catch (error) {
    if (ticket !== state.attachTicket) return;
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
  state.index = nameIndex(run);
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
  const format = formatLabel(input.format);
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
        // Only the stages the server reruns go stale (new assumptions keep the with/without card), and their old
        // receipts leave the list: the server replaced them.
        const from = state.plan.findIndex((s) => s.id === event.from);
        const rerun = event.rerun ?? state.plan.slice(from + 1).map((s) => s.id);
        for (const id of rerun) if (id !== event.from) state.run.stages[id] = { status: "stale" };
        for (const item of [...$("#trace-list").children]) if (rerun.includes(item.dataset.stage)) item.remove();
        for (const s of state.plan) renderStage(s.id, state.run.stages[s.id]);
      }
      if (event.status === "error") showError(event.at_stage ? `${stageInfo(event.at_stage, state.run.input?.format).label} failed: ${event.message ?? "unknown error"}` : event.message ?? "The run failed.");
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
      if (event.output) state.index = nameIndex(state.run);
      renderStage(event.id, state.run.stages[event.id]);
      if (event.status === "running" && state.live) document.getElementById(`stage-${event.id}`)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
      if (event.id === "read" && event.status === "done") loadMosaic(state.run.id);
      if (event.id === "gap" && event.status === "done" && state.mosaicRun === state.run.id && state.mosaicImages) {
        // Flavour names arrive after the read: refresh the words on abstract tiles with the images already loaded.
        canvas.setImages(state.mosaicImages, mosaicWords(state.run.id));
      }
      break;
    }
    case "call":
      upsertCall(event);
      break;
    case "usage":
      if (state.run) state.run.usage = event.usage;
      updateStatus();
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
  const u = run.usage;
  const meter = u?.calls ? ` Model tokens so far: ${(u.input + u.output).toLocaleString()} over ${u.calls} call${u.calls === 1 ? "" : "s"}${u.byok ? " on your key" : ""}.` : "";
  $("#run-status").textContent = `${head} ${mode[0].toUpperCase() + mode.slice(1)}; writing with ${llm}.${meter}`;
  // The list, not the snapshot: calls stream in after the snapshot and only the list hears them.
  const calls = $("#trace-list").children.length;
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
    nodes = renderer ? renderer(s.output, state.run) : [s.output.summary ? note(s.output.summary) : null, el("details", { class: "raw" }, el("summary", { text: "Raw output" }), pre(s.output))];
  } catch (error) {
    console.error(`render ${id}`, error);
    nodes = [pre(s.output)];
  }
  body.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  if (id === "write") body.append(conceptImage(state.run) ?? "");
  if (s.output.edited) body.prepend(el("p", { class: "edited-note", text: "Edited by you. Stages after this were rerun with your changes." }));
}

/**
 * One picture drawn from this brief by OpenAI, on demand: the look, the palette and the place, with every Qloo name
 * kept out of the prompt. Not a stage, so the run is complete without it.
 */
function conceptImage(run) {
  if (!state.presets.images || !run?.id || run.status !== "done") return null;
  const box = el("figure", { class: "concept-image" });
  let polling;
  const show = (s) => {
    clearTimeout(polling);
    if (!box.isConnected && s.status !== "none") return; // the card was redrawn; its new box takes over
    if (s.status === "done") {
      box.replaceChildren(
        el("img", { src: s.url, alt: "Concept image drawn from this brief", loading: "lazy" }),
        el("figcaption", {}, "Concept image, drawn by OpenAI from this brief: the look, the palette and the place. Not a real place, product or person. ", el("a", { href: s.url, download: `${run.id}-concept.jpg`, text: "Download" })),
      );
    } else if (s.status === "drawing") {
      box.replaceChildren(el("div", { class: "concept-wait skeleton" }), el("figcaption", { text: "Drawing… about 30 to 60 seconds." }));
      polling = setTimeout(() => fetch(`/api/runs/${run.id}/image`).then((r) => r.json()).then(show).catch(() => show({ status: "error", error: "Lost the connection. Try again." })), 4000);
    } else {
      const draw = el("button", { class: "secondary", type: "button", text: s.status === "error" ? "Try again" : "Draw a concept image" });
      draw.addEventListener("click", async () => {
        draw.disabled = true;
        try {
          show(await post(`/api/runs/${run.id}/image`, {}));
        } catch (error) {
          show({ status: "error", error: error.message });
        }
      });
      box.replaceChildren(
        draw,
        el("figcaption", { text: s.error ? `Couldn't draw it: ${s.error}` : "OpenAI draws one picture from this brief: the look, the palette, the place. Original art, with no real people, logos or titles." }),
      );
    }
  };
  show({ status: "none" });
  fetch(`/api/runs/${run.id}/image`).then((r) => r.json()).then((s) => s.status !== "none" && show(s)).catch(() => {});
  return box;
}

// ---------- small pieces ----------

const pre = (obj) => el("pre", { class: "json", text: JSON.stringify(obj, null, 2) });
const h3 = (text) => el("h3", { text });
const note = (text) => el("p", { class: "block-note", text });
const list = (items, cls = "plain-list") => el("ul", { class: cls }, (items ?? []).map((t) => el("li", {}, t)));
const chips = (items, cls = "") => el("div", { class: `swatches ${cls}` }, (items ?? []).map((t) => (t instanceof Node ? t : el("span", { class: "swatch", text: t }))));
/** A name that came from a Qloo request. */
/** Where each name came from in this run: rank, affinity and popularity from the read, so a chip can carry its receipt line. */
function nameIndex(run) {
  const index = new Map();
  const put = (name, info) => { if (name && !index.has(String(name).toLowerCase())) index.set(String(name).toLowerCase(), info); };
  for (const [type, c] of Object.entries(run?.stages?.read?.output?.columns ?? {})) for (const r of c.rows ?? []) put(r.name, { kind: type, rank: r.rank, of: c.rows.length, affinity: r.affinity, popularity: r.popularity, onlyHere: r.onlyHere, hiddenGem: r.hiddenGem });
  for (const a of run?.stages?.audio?.output?.shortlist ?? []) put(a.name, { kind: "artist", affinity: a.affinity, popularity: a.popularity, why: a.why });
  for (const v of run?.stages?.spots?.output?.venues ?? []) put(v.name, { kind: "place" });
  for (const l of run?.stages?.gap?.output?.lanes ?? []) put(l.name, { kind: "flavour", cityRank: l.cityRank, countryRank: l.countryRank, specific: l.specific, scope: l.scope });
  for (const f of run?.stages?.gap?.output?.flavours ?? []) put(f.name, { kind: "flavour", cityRank: f.cityRank, countryRank: f.countryRank, specific: f.specific, scope: f.scope });
  for (const f of run?.stages?.gap?.output?.avoid ?? []) put(f.name, { kind: "flavour", cityRank: f.cityRank, countryRank: f.countryRank });
  // The look: style, archetype and theme tags with their share lift; fashion aesthetics with their rank lift.
  const look = run?.stages?.look?.output;
  const share = (x, label) => put(x.name, { kind: "share", label, lift: x.lift, cityShare: x.cityShare, countryShare: x.countryShare, n: look?.n });
  for (const x of look?.styles ?? []) share(x, "style tag");
  for (const x of look?.avoid ?? []) (typeof x.cityShare === "number" ? share(x, "style tag") : put(x.name, { kind: "tag", label: "the country prefers it" }));
  for (const x of look?.archetypes ?? []) share(x, "archetype tag");
  for (const x of look?.themes ?? []) share(x, "theme tag");
  for (const fam of ["materials", "ages", "segments", "surface"]) for (const x of [...(look?.[fam]?.over ?? []), ...(look?.[fam]?.under ?? [])]) share(x, `${fam === "ages" ? "age group" : fam === "segments" ? "segment" : fam === "surface" ? "aesthetic" : "material"} tag`);
  for (const x of [...(look?.aesthetics ?? []), ...(look?.personalStyles ?? [])]) put(x.name, { kind: "flavour", cityRank: x.cityRank, countryRank: x.countryRank });
  for (const m of look?.motifs ?? []) put(m.name, { kind: "tag", label: `on ${m.from} in Qloo` });
  for (const l of look?.labels ?? []) put(l.name, { kind: "tag", label: "fashion label this city favours" });
  const r = run?.stages?.resolve?.output;
  for (const t of r?.theme?.tags ?? []) put(t.name, { kind: "tag", label: `theme tag ${t.id}` });
  if (r?.city) put(r.city.name, { kind: "tag", label: `locality ${r.city.qlooName ?? r.city.name}` });
  for (const c of run?.stages?.travels?.output?.cities ?? []) put(c.name, { kind: "tag", label: `leans the same way: lift ${c.lift} (affinity percentile minus popularity percentile)` });
  return index;
}
const receiptLine = (info) => {
  if (!info) return "This name came from a Qloo request in this run";
  const city = state.run?.stages?.resolve?.output?.city?.name ?? "the city";
  if (info.kind === "flavour") return `Qloo tag · ${city} #${info.cityRank ?? "–"}${info.countryRank ? ` · country #${info.countryRank}` : " · not in the country's top 30"}${typeof info.specific === "number" ? ` · ${info.specific >= 0 ? "+" : ""}${info.specific} vs control cities` : ""}`;
  if (info.kind === "share") return `Qloo ${info.label} · on ${info.cityShare ?? "?"}% of ${city}'s titles vs ${info.countryShare ?? "?"}% of the country's (${info.lift > 0 ? "+" : ""}${info.lift} points${info.n ? `, n=${info.n.city}/${info.n.country}` : ""})`;
  if (info.kind === "tag") return `Qloo · ${info.label}`;
  const parts = [`Qloo ${String(info.kind).replace("_", " ")}`];
  if (info.rank) parts.push(`rank ${info.rank} of ${info.of} for ${city}`);
  if (typeof info.affinity === "number") parts.push(`affinity ${info.affinity.toFixed(2)}`);
  if (typeof info.popularity === "number") parts.push(`popularity ${info.popularity.toFixed(2)}`);
  if (info.onlyHere) parts.push("only here, not in the country's list");
  if (info.hiddenGem) parts.push("hidden gem");
  if (info.why) parts.push(info.why);
  return parts.join(" · ");
};
const q = (name, extra) => {
  const info = state.index?.get(String(name ?? "").toLowerCase());
  return el("span", { class: "q", title: receiptLine(info) }, name, extra ? el("span", { class: "q-extra", text: extra }) : null, info?.rank ? el("b", { class: "q-rank", text: `#${info.rank}` }) : null, el("i", { text: "Qloo", title: receiptLine(info) }));
};

// ---------- home page: Watch it work and Now showing, from finished runs on this server ----------

async function loadGallery() {
  let data;
  try {
    data = await (await fetch("/api/gallery")).json();
  } catch {
    return;
  }
  const w = data?.walkthrough;
  const steps = $("#watch-steps");
  if (steps && w && (w.onlyHere?.length || w.lanes?.length)) {
    // "A film for Hyderabad" → "a film for Hyderabad": only the first letter, the city keeps its capital.
    $("#watch-sub").textContent = `One real run, step by step: ${(w.kicker ?? "").replace(/^./, (c) => c.toLowerCase())}${w.theme?.length ? `, ${w.theme.join(", ").toLowerCase()}` : ""}. ${w.calls} Qloo calls${w.tokens ? `, ${w.tokens.toLocaleString()} model tokens` : ""}.`;
    const step = (n, title, body, note) => el("li", { class: "watch-step" }, el("span", { class: "step-n", text: `Step ${n} of 4` }), el("h3", { text: title }), note ? el("p", { class: "block-note", text: note }) : null, body);
    const lane = (l) => el("span", { class: "chip-inner" }, el("strong", { text: l.name }), el("small", { class: "sub", text: ` ${w.city} #${l.cityRank ?? "–"} · ${l.countryRank ? `${w.country} #${l.countryRank}` : `not in ${w.country}'s top 30`}${typeof l.specific === "number" ? ` · ${signed(l.specific)} vs control cities` : ""}${l.supplyTotal === 0 ? " · open lane" : ""}` }));
    steps.replaceChildren(
      step(1, `Read ${w.city}`, chips([...w.onlyHere.map((n) => el("span", { class: "chip-inner" }, el("strong", { text: n }))), ...w.hiddenGems.map((n) => el("span", { class: "chip-inner" }, el("strong", { text: n }), el("small", { class: "sub", text: " hidden gem" })))]), `Qloo lists what ${w.city} favours that ${w.country} doesn't, with a contrast city as a second check. Aggregate taste, never one person.`),
      step(2, "Find the gap", chips(w.lanes.map(lane)), "A flavour the city ranks far above the country and above three control cities, weighed by how few recent titles carry it."),
      step(3, "Read the look", chips(w.look.map((x) => el("span", { class: "chip-inner" }, el("strong", { text: x.name }), typeof x.lift === "number" ? el("small", { class: "lift", text: ` ${signed(x.lift)}` }) : null))), "Style words from Qloo's own tags on what the city favours; a model never invents them."),
      step(4, "Write into it", el("div", { class: "watch-write" }, el("p", { class: "title-option first", text: w.title }), w.line ? el("p", { class: "lead", text: w.line }) : el("p", { class: "muted", text: w.written ? "" : "Written from the evidence template; add a key for the model's version." }), w.cast?.length ? el("p", { class: "sub", text: `Cast ideas: ${w.cast.join(", ")}` }) : null, w.url ? el("a", { class: "secondary-link", href: w.url, target: "_blank", rel: "noopener", text: "Read the whole piece" }) : null, w.grounded ? el("p", { class: "footnote", text: `${w.grounded.grounded} of ${w.grounded.checked} names trace to Qloo.` }) : null), w.llm?.byok ? "Written with the maker's own key." : w.written ? "Written with the server's model." : undefined),
    );
    $("#watch").hidden = false;
  }
  const cards = $("#showing-cards");
  if (cards && data?.cards?.length) {
    cards.replaceChildren(
      ...data.cards.map((c) =>
        el("a", { class: "showing-card", href: `/run/${c.id}`, onclick: (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // a new tab or window, as the link says
          e.preventDefault();
          history.pushState({}, "", `/run/${c.id}`);
          attach(c.id);
        } },
          el("span", { class: "kicker", text: c.kicker }),
          el("strong", { class: "showing-title", text: c.title }),
          c.line ? el("p", { class: "sub", text: c.line.length > 120 ? `${c.line.slice(0, 117)}…` : c.line }) : null,
          c.lanes?.[0] ? el("p", { class: "small", text: `Lane: ${c.lanes[0].name}${typeof c.lanes[0].specific === "number" ? ` (${signed(c.lanes[0].specific)} vs controls)` : ""}` }) : null,
          c.palette?.length ? el("div", { class: "palette-strip" }, c.palette.map((p) => el("span", { style: `background:${/^#[0-9a-f]{6}$/i.test(p.hex ?? "") ? p.hex : "#555"}`, title: p.name ?? "" }))) : el("div", { class: "palette-strip ghost" }),
          el("span", { class: "footnote", text: `${c.calls} Qloo calls${c.grounded ? ` · ${c.grounded.grounded}/${c.grounded.checked} names traced` : ""}${c.written ? "" : " · template"}` }),
        ),
      ),
      el("div", { class: "showing-card yours" }, el("span", { class: "kicker", text: "yours" }), el("strong", { class: "showing-title", text: "Your city, your format" }), el("p", { class: "sub", text: "Type a sentence above. No sign-up." })),
    );
    $("#showing").hidden = false;
  }
}
const tag = (text, cls = "") => el("span", { class: `tag ${cls}`, text });
const typeLabel = (t) => ({ tv_show: "TV shows", movie: "Films", artist: "Music artists", person: "People", videogame: "Video games", podcast: "Podcasts", book: "Books", brand: "Brands", place: "Places" })[t] ?? t;
const pct = (v) => `${Math.round((v ?? 0) * 100)}`;
const signed = (v) => (v > 0 ? "+" : "") + String(v);
// A wide table scrolls inside its card on a phone instead of pushing the card past the screen.
const tableBox = (...args) => el("div", { class: "table-wrap" }, el(...args));
const section = (title, ...children) => el("div", { class: "sect" }, h3(title), ...children);

// ---------- renderers, one per stage ----------

/** The look card: style words with their lifts, labels, motifs, and Qloo's own style notes. */
function lookCard(o, run) {
  const liftChips = (list = [], cls = "") => chips(list.map((x) => el("span", { class: "chip-inner" }, q(x.name), typeof x.lift === "number" ? el("small", { class: "lift", text: ` ${x.lift > 0 ? "+" : ""}${x.lift}${x.cityShare !== undefined ? "pt" : ""}` }) : null)), cls);
  if (o.kind === "fashion") {
    return [
      o.note ? note(o.note) : null,
      o.aesthetics?.length ? section("Aesthetics this city leans to", liftChips(o.aesthetics)) : null,
      o.personalStyles?.length ? section("Personal styles", liftChips(o.personalStyles)) : null,
      o.materials?.over?.length || o.materials?.under?.length ? section("Materials", el("div", { class: "two-col" }, el("div", {}, el("span", { class: "sub small", text: `More than the country (n=${o.n?.city ?? 0} labels)` }), liftChips(o.materials.over)), el("div", {}, el("span", { class: "sub small", text: "Less than the country" }), liftChips(o.materials.under, "muted")))) : null,
      o.ages?.over?.length ? section("Age groups the labels skew to", liftChips(o.ages.over)) : null,
      o.segments?.over?.length ? section("Segments", liftChips(o.segments.over)) : null,
      o.avoid?.length ? section("The country prefers instead", chips(o.avoid.map((x) => q(x.name)), "muted")) : null,
      o.motifs?.length ? section("Motifs from the loves", chips(o.motifs.map((m) => el("span", { class: "chip-inner" }, q(m.name), el("small", { class: "sub", text: ` from ${m.from}` }))))) : null,
      o.labels?.length ? section("Labels this city favours", el("div", { class: "label-strip" }, o.labels.map((l) => el("figure", { class: "label" }, l.image ? el("img", { src: l.image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : el("span", { class: "label-blank" }), el("figcaption", {}, q(l.name)))))) : null,
    ];
  }
  return [
    o.styles?.length ? section("Style this city leans to", liftChips(o.styles)) : el("p", { class: "muted", text: "No style lift could be read." }),
    o.avoid?.length ? section("Cares less about", liftChips(o.avoid, "muted")) : null,
    o.archetypes?.length ? section("Character archetypes it leans to", liftChips(o.archetypes)) : null,
    o.themes?.length ? section("Themes it leans to", liftChips(o.themes)) : null,
    o.descriptions?.length ? section("Qloo's style notes on its own picks", list(o.descriptions.map((d) => el("span", {}, q(d.title), el("span", { class: "sub", text: ` · ${d.text}` }))))) : null,
    o.n ? el("p", { class: "footnote", text: `Shares over ${o.n.city} city titles and ${o.n.country} country titles; two points is one title, so small lifts are noise.` }) : null,
  ];
}

const RENDER = {
  look: lookCard,
  resolve(o) {
    const city = o.city ?? {};
    return [
      el(
        "div",
        { class: "resolve-grid" },
        el("div", {}, el("span", { class: "k", text: "City" }), el("strong", { class: "big", text: city.name ?? "?" }), el("span", { class: "sub", text: city.qlooName ?? city.country ?? "" }), city.correctedFrom ? el("span", { class: "sub block", text: `Read from “${city.correctedFrom}”, which Qloo doesn't list.` }) : null),
        o.contrast ? el("div", {}, el("span", { class: "k", text: "Contrast city" }), el("strong", { class: "big", text: o.contrast.name }), el("span", { class: "sub", text: "the country's largest other city" })) : null,
      ),
      o.theme?.tags?.length ? section("Theme, as Qloo tags", chips(o.theme.tags.map((t) => t.name))) : o.theme?.query ? note(`Theme “${o.theme.query}”: no Qloo tag matched, so the read runs on the city alone.`) : null,
      o.loves?.length
        ? section(
            "Loves",
            list(
              o.loves.map((l) =>
                el(
                  "span",
                  {},
                  el("strong", { text: `${l.name}${l.year ? ` (${l.year}${l.language ? `, ${l.language}` : ""})` : ""}` }),
                  l.alternatives?.length ? el("span", { class: "sub", text: ` · picked over ${l.alternatives.map((a) => `${a.name}${a.year ? ` (${a.year}${a.language ? `, ${a.language}` : ""}${a.remake ? ", remake" : ""})` : ""}`).join(", ")}: same name; the original and the city's own language win. Change it in the confirm step.` }) : null,
                ),
              ),
            ),
          )
        : null,
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
        el("div", { class: "readcol-head" }, h3(typeLabel(c.type)), el("span", { class: "block-note", text: `read by ${readMode(c)}${c.coverage && c.coverage !== "ok" ? ` · coverage ${c.coverage}` : ""}` })),
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
            el("p", { class: "lane-meta" }, el("span", { text: `${city} #${l.cityRank ?? "–"}` }), " · ", el("span", { text: l.countryRank ? `${country} #${l.countryRank}` : `not in ${country}'s top 30` }), " · ", l.scope && l.scope !== "unknown" ? el("span", { class: `scope ${l.scope.replace(/\s+/g, "-")}`, title: typeof l.specific === "number" ? `Lift over the country ${l.rawLift ?? l.lift}; over the controls' median ${l.specific}` : "", text: l.scope === "this city" ? `specific to ${city} (+${l.specific} vs controls)` : l.scope === "leans here" ? `leans here (+${l.specific} vs controls)` : "shared by most cities" }) : null, l.scope && l.scope !== "unknown" ? " · " : null, l.mode === "demand-only" ? el("span", { text: `demand ${pct(l.demand)}` }) : (l.supplyTotal ?? 0) === 0 && (l.supplyCount ?? 0) === 0 ? el("span", { class: "open-lane", text: "no title in the catalogue carries it: an open lane" }) : el("span", { text: `${l.supplyCount ?? 0} recent${(l.supplyTitles?.length ?? 0) > (l.supplyCount ?? 0) ? ` of ${l.supplyTitles.length} titles` : ` title${l.supplyCount === 1 ? "" : "s"}`} · gap ${pct(l.gap)}` })),
            l.supplyTitles?.length ? el("div", { class: "lane-titles" }, el("span", { class: "k", text: "Titles in this lane" }), chips(l.supplyTitles.map((t) => `${t.name}${t.year ? ` (${t.year})` : ""}`), "small")) : null,
          ),
        ),
      ),
      el("p", { class: "legend" }, el("i", { class: "key-bar gap" }), " the gap (loved here, under-served) ", el("i", { class: "key-bar demand" }), " demand (how far above the country the city ranks it)"),
      o.mode === "demand-only" ? note("Supply isn't readable for this format, so the bars show demand only: lift of the flavour in the city over the country.") : null,
      o.avoid?.length ? section("The country leans to these more", chips(o.avoid.map((a) => `${a.name} ${signed(a.lift)}`), "muted")) : null,
      o.avoidSkipped?.length ? el("p", { class: "footnote", text: `Not counted against you: ${o.avoidSkipped.map((a) => `${a.name} (${a.why})`).join(", ")}.` }) : null,
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
    const price = (n) => (n ? `price ${n} of 4` : null);
    return [
      o.base ? el("p", { class: "lane-line" }, tag("Shoot base", "lane-tag"), " ", q(o.base.name), el("span", { class: "sub", text: ` ${o.base.venues} of the ${o.base.of} places this crowd goes are here (${o.base.places.join(", ")}).` })) : null,
      venues.length ? section("Places", el("ul", { class: "venues" }, venues.map((v) => el("li", {}, el("strong", { text: v.name }), v.area ? el("span", { class: "sub", text: ` · ${v.area}` }) : null, v.price ? tag(price(v.price)) : null, v.about ? el("span", { class: "sub block", text: v.about }) : v.address ? el("span", { class: "sub block", text: v.address }) : null)))) : note("No places came back for this crowd."),
      hoods.length ? section("Where the taste runs hottest", chips(hoods.map((n) => `${n.name} ${signed(n.lift)}`))) : null,
      o.skipped?.length ? el("p", { class: "footnote", text: `${o.skipped.length} junk or private place${o.skipped.length === 1 ? "" : "s"} dropped (homes, clinics, consulates, broken names).` }) : null,
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
            tableBox("table", { class: "table" }, el("thead", {}, el("tr", {}, ["City", "Culture lift", "Fashion lift", "Gap"].map((t) => el("th", { text: t })))), el("tbody", {}, o.gap.slice(0, 8).map((g) => el("tr", {}, [g.name ?? g.key, signed(g.cultureLift), signed(g.fashionLift), el("strong", { text: pct(g.gap) })].map((t) => el("td", {}, t)))))),
          )
        : null,
    ];
  },

  write(o, run) {
    const plan = o.plan ?? {};
    const writer = WRITE[o.writer] ?? WRITE.generic;
    const llm = o.llm ?? run?.llm ?? {};
    const canRegenerate = run?.status !== "running";
    const written = o.language ?? "English";
    // The written parts carry the brief's language, so the browser picks the right script font (useFont loads it).
    const body = writer(plan, run);
    if (!o.fallback && o.languageCode && o.languageCode !== "en") {
      useFont(o.languageFont);
      for (const node of body) node?.setAttribute?.("lang", o.languageCode);
    }
    const languages = o.languages ?? [];
    const again = el("button", { type: "button", class: "primary", text: "Write again", disabled: !canRegenerate, onclick: (e) => regenerate(e.target) });
    const languagePick = languages.length > 1
      ? el("label", { class: "write-language" }, el("span", { text: "Write in" }), el("select", { id: "write-language", "aria-label": "Write it in", onchange: (e) => { useFont(languages.find((l) => l.name === e.target.value)?.font); again.textContent = e.target.value === written ? "Write again" : `Write it in ${e.target.value}`; } }, languages.map((l) => el("option", { value: l.name, text: languageLabel(l), selected: l.name === written }))))
      : null;
    return [
      o.fallback
        ? el("div", { class: "banner" }, el("strong", { text: "No language model wrote this. " }), "What you see is the evidence laid out as a template. Add a key in the drawer and press Write again.", o.error ? el("span", { class: "sub", text: ` (${o.error})` }) : null)
        : el("p", { class: "footnote", text: `Written by ${llm.byok ? `your ${providerInfo(llm.provider)?.label ?? llm.provider} key` : llm.provider ?? "the server's model"}${llm.model ? ` · ${llm.model}` : ""}${written !== "English" ? ` in ${written}` : ""}. Names marked Qloo came from a request in this run${written !== "English" ? " and keep Qloo's spelling" : ""}.` }),
      ...body,
      el(
        "div",
        { class: "write-actions" },
        el("button", { type: "button", class: "secondary", text: "Copy", onclick: (e) => copyPlan(o, e.target) }),
        languagePick,
        again,
        run?.publish?.url ? el("a", { class: "secondary-link", href: run.publish.url, target: "_blank", rel: "noopener", text: "Open share page" }) : null,
        run?.publish?.url ? el("a", { class: "secondary-link", href: `${run.publish.url}.md`, download: "", text: "Download brief (.md)" }) : null,
        el("span", { class: "edit-status", id: "write-status" }),
      ),
    ];
  },

  produce(o) {
    const e = o.economics ?? {};
    const inr = (v) => (typeof v === "number" ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");
    const pctOf = (v) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");
    const packs = o.packs ?? [];
    const cmp = o.compliance ?? {};
    const sizesText = (sizes) => Object.entries(sizes ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
    const dl = (pairs) => el("dl", { class: "spec" }, ...pairs.filter(([, v]) => v !== undefined && v !== null && v !== "").flatMap(([k, v]) => [el("dt", { text: k }), el("dd", {}, v)]));
    return [
      el("div", { class: "banner" }, el("strong", { text: "All figures are editable assumptions, not forecasts. " }), "Defaults from directory asking prices and seller pages. Change any number below and recompute."),
      assumptionsForm(o.assumptions ?? {}),
      e.mrp !== undefined
        ? section(
            "Unit economics",
            el("p", { class: "lead" }, el("strong", { text: `MRP ${inr(e.mrp)}` }), ` · ${pctOf(e.gstRate)} GST included · ex-GST ${inr(e.exGst)} · unit cost ${inr(e.unitCost)} · landed ${inr(e.landedCost)}${e.tier ? ` · ${e.tier} tier` : ""}`),
            e.gstNote ? note(e.gstNote) : null,
            (e.channels ?? []).length
              ? tableBox(
                  "table",
                  { class: "table" },
                  el("thead", {}, el("tr", {}, ["Channel", "Fee", "Net / unit", "Margin / unit", "Margin %", "Break-even units"].map((t) => el("th", { text: t })))),
                  el("tbody", {}, (e.channels ?? []).map((c) => el("tr", {}, el("td", {}, el("strong", { text: c.channel ?? "" }), c.note ? el("span", { class: "sub small", text: c.note }) : null), el("td", { text: pctOf(c.fee) }), el("td", { text: inr(c.netPerUnit) }), el("td", { text: inr(c.marginPerUnit) }), el("td", { text: typeof c.marginPct === "number" ? `${c.marginPct}%` : "—" }), el("td", { text: c.breakEvenUnitsPerStyle !== undefined ? String(c.breakEvenUnitsPerStyle) : "does not clear cost" })))),
                )
              : null,
          )
        : null,
      (o.styles ?? []).length
        ? section(
            "Styles and quantities",
            tableBox(
              "table",
              { class: "table" },
              el("thead", {}, el("tr", {}, ["SKU", "Style", "Colourways", "Per colour", "Total", "Sizes"].map((t) => el("th", { text: t })))),
              el("tbody", {}, o.styles.map((l) => el("tr", {}, el("td", {}, el("code", { text: l.sku ?? "" })), el("td", { text: l.style ?? "" }), el("td", { text: (l.colourways ?? []).join(", ") }), el("td", { text: String(l.quantityPerColour ?? "") }), el("td", {}, el("strong", { text: String(l.total ?? "") })), el("td", { class: "small", text: sizesText(l.sizes) })))),
            ),
            o.totalUnits !== undefined ? el("p", { class: "kv" }, el("strong", { text: `${o.totalUnits} units` }), o.investment !== undefined ? ` · ${inr(o.investment)} landed investment` : "") : null,
          )
        : null,
      (o.allocation ?? []).length ? section("City split", list(o.allocation.map((a) => el("span", {}, q(a.city ?? ""), ` · ${pctOf(a.share)} · ${a.units ?? 0} units`, a.why ? el("span", { class: "sub", text: ` ${a.why}` }) : null)))) : null,
      packs.length
        ? section(
            "Tech packs",
            o.packsBy === "defaults" ? note("Written from labelled defaults, not a model. Add a key and press Write again for packs written to the styles.") : null,
            el(
              "div",
              { class: "packs" },
              packs.map((p) =>
                el(
                  "details",
                  { class: "pack" },
                  el("summary", {}, el("strong", { text: p.style ?? "" }), el("span", { class: "sub small", text: `${p.fabric?.composition ?? ""}${p.fabric?.gsm ? ` · ${p.fabric.gsm} GSM` : ""}${p.fallback ? " · defaults" : ""}` })),
                  el(
                    "div",
                    { class: "pack-sheet" },
                    dl([
                      ["Fabric", [p.fabric?.composition, p.fabric?.gsm ? `${p.fabric.gsm} GSM` : "", p.fabric?.finish].filter(Boolean).join(" · ")],
                      ["Construction", (p.construction ?? []).length ? list(p.construction) : ""],
                      ["Print / embroidery", p.print_or_embroidery?.type && p.print_or_embroidery.type !== "none" ? [p.print_or_embroidery.type, p.print_or_embroidery.placement, p.print_or_embroidery.size_cm ? `${p.print_or_embroidery.size_cm} cm` : ""].filter(Boolean).join(" · ") : "none"],
                      ["Trims", (p.trims ?? []).length ? chips(p.trims, "small") : ""],
                      ["Fit notes", p.fit_notes],
                      ["Packaging", p.packaging],
                      ["Sizes", (p.sizes ?? []).join(" · ")],
                    ]),
                    (p.pointsOfMeasure ?? []).length
                      ? tableBox(
                          "table",
                          { class: "table pom" },
                          el("thead", {}, el("tr", {}, [["Point of measure", ""], ...(p.sizes ?? []).map((sz) => [sz, "cm"])].map(([t, u]) => el("th", {}, t, u ? el("span", { class: "sub small", text: u }) : null)))),
                          el("tbody", {}, p.pointsOfMeasure.map((m) => el("tr", {}, el("td", { text: m.name ?? "" }), ...(p.sizes ?? []).map(() => el("td", { class: "blank", text: m.cm || "" }))))),
                        )
                      : null,
                    note("Points of measure stay blank: the sampling room fills them."),
                  ),
                ),
              ),
            ),
          )
        : null,
      cmp.loose?.length || cmp.prePacked?.length || cmp.registrations?.length
        ? section(
            "Compliance",
            el("div", { class: "cols3" }, cmp.loose?.length ? el("div", {}, h3("Every label"), list(cmp.loose)) : null, cmp.prePacked?.length ? el("div", {}, h3("Pre-packed, also"), list(cmp.prePacked)) : null, cmp.registrations?.length ? el("div", {}, h3("Registrations"), list(cmp.registrations)) : null),
            cmp.source ? el("p", { class: "footnote", text: cmp.source }) : null,
          )
        : null,
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

/** The produce card's inputs: the maker's own numbers, recomputed on the server from the produce stage. */
function assumptionsForm(a) {
  const field = (label, name, value, step = 1) => el("label", { class: "afield" }, el("span", { text: label }), el("input", { type: "number", name, value: String(value ?? ""), step: String(step), min: "0", inputmode: "decimal" }));
  const form = el(
    "form",
    { class: "assumptions", onsubmit: (e) => recompute(e) },
    el("div", { class: "agrid" },
      field("MOQ per style & colour", "moqPerStylePerColour", a.moqPerStylePerColour),
      field("Hero style units", "heroQuantity", a.heroQuantity),
      field("Other style units", "otherQuantity", a.otherQuantity),
      field("Fabric ₹/unit", "unitCost.fabric", a.unitCost?.fabric),
      field("Cut-make-trim ₹/unit", "unitCost.cmt", a.unitCost?.cmt),
      field("Print ₹/unit", "unitCost.print", a.unitCost?.print),
      field("Trims & packing ₹/unit", "unitCost.trimsAndPacking", a.unitCost?.trimsAndPacking),
      field("Logistics ₹/unit", "logisticsPerUnit", a.logisticsPerUnit),
      field("Returns reserve (0–1)", "returnsReserveShare", a.returnsReserveShare, 0.01),
      field("Home city share (0–1)", "homeCityShare", a.homeCityShare, 0.05),
      el("label", { class: "afield" }, el("span", { text: "Price tier" }), el("select", { name: "tier" }, ["value", "mid", "premium"].map((t) => el("option", { value: t, text: t, selected: t === (a.tier ?? "mid") ? "selected" : null })))),
    ),
    el("div", { class: "actions" }, el("button", { type: "submit", class: "primary", text: "Recompute" }), el("span", { class: "sub small", text: "Reruns the produce stage with your numbers; nothing before it changes." })),
  );
  return form;
}

async function recompute(event) {
  event.preventDefault();
  const run = state.run;
  if (!run) return;
  const form = event.target;
  const data = new FormData(form);
  const assumptions = { unitCost: {} };
  for (const [name, raw] of data.entries()) {
    const v = name === "tier" ? String(raw) : Number(raw);
    if (name === "tier") assumptions.tier = v;
    else if (name.startsWith("unitCost.")) assumptions.unitCost[name.slice(9)] = v;
    else assumptions[name] = v;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await changeRun("assumptions", { assumptions });
  } catch (error) {
    showError(error.message);
    button.disabled = false;
  }
}

/** How a read column was asked, in words: the honest label for each of the read stage's modes. */
function readMode(c) {
  if (c.filter === "seeded" && c.seed?.kind === "picks") return `the ${typeLabel(c.seed.from).toLowerCase()} this read found, as signals (the theme can't filter ${typeLabel(c.type).toLowerCase()})`;
  if (c.filter === "seeded" && c.seed?.kind === "search") return `Qloo's search for “${c.seed.word}”: ${(c.seed.names ?? []).slice(0, 3).join(", ")}`;
  const MODES = { "tags+signals": "theme tags, with your titles as signals", tags: "theme tags", signals: "your titles as signals", location: "the city alone (no theme tag fits this kind)", none: "nothing came back" };
  return MODES[c.filter] ?? c.filter;
}

const WRITE = {
  film(p) {
    const titles = (p.titles ?? []).filter(Boolean);
    const hex = (h) => (/^#[0-9a-f]{6}$/i.test(h ?? "") ? h : null);
    const palette = (p.palette ?? []).filter((c) => hex(c?.hex));
    const charLine = (k, v) => (v ? el("p", { class: "char-line" }, el("span", { class: "k", text: k }), " ", v) : null);
    const lighting = p.camera?.lighting ?? [];
    const shots = p.camera?.shots ?? [];
    return [
      p.story ? el("div", { class: "story-simply" }, el("span", { class: "k", text: "The story, simply" }), el("p", { text: p.story })) : null,
      titles.length ? el("div", { class: "titles" }, titles.map((t, i) => el("span", { class: `title-option ${i === 0 ? "first" : ""}`, text: t }))) : el("p", { class: "muted", text: "No titles yet." }),
      p.lane?.flavour ? el("p", { class: "lane-line" }, tag("Lane", "lane-tag"), " ", q(p.lane.flavour), p.lane.why ? el("span", { class: "sub", text: ` ${p.lane.why}` }) : null) : null,
      p.logline ? el("p", { class: "lead", text: p.logline }) : null,
      kv("Theme", p.theme),
      kv("Look", p.look),
      p.synopsis && Object.values(p.synopsis).some(Boolean) ? el("div", { class: "acts" }, ["act1", "act2", "act3"].map((k, i) => el("div", { class: "act" }, el("span", { class: "k", text: `Act ${i + 1}` }), el("p", { text: p.synopsis[k] || "—" })))) : null,
      p.beats?.length
        ? section(
            "Beats",
            el(
              "ol",
              { class: "beats film-beats" },
              p.beats.map((b) =>
                typeof b === "string"
                  ? el("li", {}, el("p", { text: b }))
                  : el(
                  "li",
                  {},
                  el("strong", { text: b.title ?? "" }),
                  b.what ? el("p", { text: b.what }) : null,
                  el("p", { class: "sub" }, b.who?.length ? `With ${b.who.join(", ")}` : "", b.where?.name ? el("span", {}, b.who?.length ? " · at " : "At ", q(b.where.name)) : null, b.after?.title ? el("span", {}, " · after ", q(b.after.title)) : null),
                ),
              ),
            ),
          )
        : null,
      p.characters?.length
        ? section(
            "Characters",
            el(
              "div",
              { class: "char-grid" },
              p.characters.map((c) => {
                if (typeof c === "string") return el("div", { class: "char-card" }, el("p", { text: c }));
                const cast = (p.cast_ideas ?? []).filter((x) => x.role && c.name && x.role.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]));
                return el(
                  "div",
                  { class: "char-card" },
                  el("strong", { class: "char-name", text: c.name ?? c.role ?? "" }),
                  c.name && c.role ? el("p", { class: "sub", text: c.role }) : null,
                  charLine("Wants", c.wants),
                  charLine("Hides", c.hides),
                  charLine("Look", c.look),
                  charLine("Arc", c.arc),
                  c.note ? el("p", { text: c.note }) : null,
                  c.archetype ? el("p", { class: "sub" }, "Archetype ", q(c.archetype)) : null,
                  cast.length ? el("p", { class: "sub" }, "Reference for the part: ", cast.map((x, i) => el("span", {}, i ? ", " : "", q(x.name)))) : null,
                );
              }),
            ),
          )
        : null,
      p.references?.length ? section("References", list(p.references.map((r) => el("span", {}, q(r.title), r.borrow || r.take ? el("span", {}, el("span", { class: "k borrow" }, " Borrow "), r.borrow || r.take) : null)))) : null,
      p.cast_ideas?.length ? section("Cast ideas", list(p.cast_ideas.map((c) => el("span", {}, q(c.name), c.role ? ` as ${c.role}` : "", c.why ? el("span", { class: "sub", text: ` · ${c.why}` }) : null)))) : null,
      p.shoot_base?.name ? el("p", { class: "lane-line" }, tag("Shoot base", "lane-tag"), " ", q(p.shoot_base.name), p.shoot_base.why ? el("span", { class: "sub", text: ` ${p.shoot_base.why}` }) : null) : null,
      p.locations?.length ? section("Locations", list(p.locations.map((l) => el("span", {}, q(l.name), l.beat ? tag(`beat ${l.beat}`) : null, l.use ? el("span", { class: "sub", text: ` · ${l.use}` }) : null)))) : null,
      lighting.length || shots.length
        ? section(
            "Camera and light",
            el("div", { class: "camera-grid" }, lighting.length ? el("div", {}, el("span", { class: "k", text: "Lighting" }), el("ul", {}, lighting.map((x) => el("li", { text: x })))) : null, shots.length ? el("div", {}, el("span", { class: "k", text: "Shots" }), el("ul", {}, shots.map((x) => el("li", { text: x })))) : null),
          )
        : null,
      palette.length
        ? section(
            "Palette",
            el(
              "div",
              { class: "film-palette" },
              palette.map((c) =>
                el(
                  "button",
                  { type: "button", class: "swatch-chip", title: `Copy ${c.hex}`, onclick: (e) => { const b = e.currentTarget; navigator.clipboard?.writeText(c.hex).then(() => { b.dataset.copied = "1"; setTimeout(() => delete b.dataset.copied, 1200); }).catch(() => {}); } },
                  el("span", { class: "swatch-dot", style: `background:${hex(c.hex)}` }),
                  el("span", { text: c.name ?? "" }),
                  el("code", { text: c.hex }),
                ),
              ),
            ),
          )
        : null,
      p.soundtrack?.length ? section("Soundtrack", list(p.soundtrack.map((s) => el("span", {}, q(s.artist), s.use ? tag(s.use) : null, s.beat ? el("span", { class: "sub", text: ` · beat ${s.beat}` }) : null)))) : null,
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
      p.styles?.length ? garmentSection(p) : null,
      p.brands_to_study?.length ? section("Brands to study", chips(p.brands_to_study.map((b) => q(b)))) : null,
      p.soundtrack?.length ? section("Soundtrack", chips(p.soundtrack.map((a) => q(typeof a === "string" ? a : a.artist ?? a.name)))) : null,
      p.first_cities?.length ? section("First cities", chips(p.first_cities.map((c) => q(c)))) : null,
      p.channels?.length ? section("Channels", list(p.channels)) : null,
      p.avoid?.length ? section("Avoid", chips(p.avoid.map((a) => q(a)), "muted")) : null,
    ];
  },
};

// Keys whose strings are names that came from a Qloo request (they get the Qloo chip).
const NAME_KEY = /travel|cities|study|stock|brand|screening|theme|reference|comp|guest|avoid|artist|place|venue|soundtrack|lineup|playlist|names?$|title$|city$|neighbourhood|intro_music/i;
const NAME_FIELD = /^(name|title|artist|city|venue|item|place)$/i;
const titleCase = (k) => String(k).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v : v === null || v === undefined ? "" : typeof v === "object" ? "" : String(v));

/** Any writer without its own renderer: titles or names, the lane, then every other key in order. */
WRITE.generic = (p) => {
  const big = (p.titles ?? p.names ?? []).filter((t) => typeof t === "string" && t);
  const nodes = [
    big.length ? el("div", { class: "titles" }, big.map((t, i) => el("span", { class: `title-option ${i === 0 ? "first" : ""}`, text: t }))) : el("p", { class: "muted", text: p.titles || p.names ? "No titles yet." : "" }),
    p.lane?.flavour ? el("p", { class: "lane-line" }, tag("Lane", "lane-tag"), " ", q(p.lane.flavour), p.lane.why ? el("span", { class: "sub", text: ` ${p.lane.why}` }) : null) : null,
  ];
  let leadDone = false;
  for (const [key, value] of Object.entries(p)) {
    if (["titles", "names", "lane", "fallback"].includes(key) || value === null || value === undefined) continue;
    const title = titleCase(key);
    const named = NAME_KEY.test(key);
    if (typeof value === "string") {
      if (!value.trim()) continue;
      // A word or two ("interview", "PC") reads as a labelled line; sentences as paragraphs, the first one as the lead.
      if (value.trim().split(/\s+/).length <= 3) nodes.push(kv(title, value));
      else {
        nodes.push(leadDone ? section(title, el("p", { text: value })) : el("p", { class: "lead", text: value }));
        leadDone = true;
      }
    } else if (typeof value === "number" || typeof value === "boolean") nodes.push(kv(title, String(value)));
    else if (Array.isArray(value)) {
      const items = value.filter((v) => v !== null && v !== undefined && v !== "");
      if (!items.length) continue;
      if (items.every((v) => typeof v !== "object")) nodes.push(section(title, chips(items.map((v) => (named ? q(String(v)) : String(v))), key === "avoid" ? "muted" : "")));
      else
        nodes.push(
          section(
            title,
            list(
              items.map((v) => {
                if (!isPlainObject(v)) return String(v);
                const [first, ...rest] = Object.entries(v).filter(([, x]) => str(x) || typeof x === "number");
                if (!first) return "";
                const head = NAME_FIELD.test(first[0]) || named ? q(str(first[1])) : str(first[1]);
                return el("span", {}, el("strong", {}, head), ...rest.map(([k, x]) => (/^(why|take|note|hook|beat|what|slot|when|use)$/i.test(k) ? ` · ${str(x)}` : ` · ${titleCase(k)}: ${str(x)}`)));
              }),
            ),
          ),
        );
    } else if (isPlainObject(value)) {
      const entries = Object.entries(value).filter(([, x]) => str(x));
      if (!entries.length) continue;
      const [first, ...rest] = entries;
      const head = NAME_FIELD.test(first[0]) || named ? q(str(first[1])) : el("strong", { text: str(first[1]) });
      nodes.push(section(title, el("p", {}, head, rest.length ? ` · ${rest.map(([, x]) => str(x)).join(" · ")}` : "")));
    }
  }
  return nodes;
};

/** Plain text of the written piece, for the clipboard. */
function planText(o) {
  const p = o.plan ?? {};
  const lines = [];
  const add = (label, v) => v && lines.push(label ? `${label}: ${v}` : v);
  const names = (arr, f = (x) => x) => (arr ?? []).map((x) => (typeof x === "string" ? x : f(x))).filter(Boolean).join(", ");
  if (o.writer === "film") {
    add("Titles", names(p.titles));
    add("The story, simply", p.story);
    add("Lane", p.lane?.flavour && `${p.lane.flavour}${p.lane.why ? ` — ${p.lane.why}` : ""}`);
    add("Logline", p.logline);
    add("Theme", p.theme);
    for (const [i, k] of ["act1", "act2", "act3"].entries()) add(`Act ${i + 1}`, p.synopsis?.[k]);
    // A beat or a character the model wrote as plain text is copied as that text.
    (p.beats ?? []).forEach((b, i) => add(`Beat ${i + 1}`, typeof b === "string" ? b : [b.title, b.what, b.where?.name && `at ${b.where.name}`, b.after?.title && `after ${b.after.title}`].filter(Boolean).join(". ")));
    for (const c of p.characters ?? []) typeof c === "string" ? add("Character", c) : add(c.name ?? c.role, [c.name && c.role, c.wants && `wants ${c.wants}`, c.hides && `hides ${c.hides}`, c.look && `look: ${c.look}`, c.arc && `arc: ${c.arc}`, c.note].filter(Boolean).join("; "));
    add("References", names(p.references, (r) => `${r.title}${r.borrow || r.take ? ` (borrow: ${r.borrow || r.take})` : ""}`));
    add("Cast ideas", names(p.cast_ideas, (c) => `${c.name}${c.role ? ` as ${c.role}` : ""}`));
    add("Shoot base", p.shoot_base?.name && `${p.shoot_base.name}${p.shoot_base.why ? ` — ${p.shoot_base.why}` : ""}`);
    add("Locations", names(p.locations, (l) => `${l.name}${l.beat ? ` (beat ${l.beat})` : ""}${l.use ? `: ${l.use}` : ""}`));
    add("Lighting", (p.camera?.lighting ?? []).join(" | "));
    add("Shots", (p.camera?.shots ?? []).join(" | "));
    add("Palette", names(p.palette, (c) => `${c.name} ${c.hex}`));
    add("Soundtrack", names(p.soundtrack, (s) => `${s.artist}${s.use ? ` (${s.use}${s.beat ? `, beat ${s.beat}` : ""})` : ""}`));
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
  } else if (o.writer === "fashion") {
    add("Drop", p.drop_name);
    add("Positioning", p.positioning);
    add("Palette", names(p.palette, (c) => `${c.name} ${c.hex}`));
    add("Styles", names(p.styles, (s) => `${s.name} (${s.category}${s.hero ? ", hero" : ""})`));
    add("Brands to study", names(p.brands_to_study));
    add("Soundtrack", names(p.soundtrack, (a) => a.artist ?? a.name));
    add("First cities", names(p.first_cities));
    add("Channels", names(p.channels));
    add("Avoid", names(p.avoid));
  } else {
    for (const [k, v] of Object.entries(p)) {
      if (k === "fallback" || v === null || v === undefined) continue;
      if (Array.isArray(v)) add(titleCase(k), v.map((x) => (isPlainObject(x) ? Object.values(x).map(str).filter(Boolean).join(" — ") : str(x))).filter(Boolean).join(", "));
      else if (isPlainObject(v)) add(titleCase(k), Object.values(v).map(str).filter(Boolean).join(" — "));
      else add(titleCase(k), str(v));
    }
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
  const language = $("#write-language")?.value;
  button.disabled = true;
  status.textContent = language && language !== (state.run.stages?.write?.output?.language ?? "English") ? `Writing it in ${language}…` : "Writing again…";
  try {
    await changeRun("regenerate", { ...(c ? { llm: c } : {}), ...(language ? { language } : {}) });
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
  // The server rebuilds the order from its own lanes; only the name of the one to put first is sent.
  const body = { stage: "gap", lane: lanes[0].name };
  const c = credential();
  if (c) body.llm = c;
  try {
    await changeRun("edit", body);
  } catch (error) {
    showError(error.message);
    for (const b of buttons) b.disabled = false;
  }
}

// ---------- the 3D garment preview (fashion) ----------
// The viewer lives in garment3d.js and loads only when a fashion card renders.
// If WebGL or the module is missing, a flat SVG croquis stands in. The garment
// and print are read from the plan's fields when the writer gave them, else
// from the category and cues (older runs, sample mode); garment3d.js keeps the
// same rules.

const GARMENT_KINDS = ["tee", "oversized_tee", "hoodie", "sweatshirt", "dress", "kurta", "jacket", "shorts", "set"];
const hexOk = (h) => /^#[0-9a-f]{6}$/i.test(h ?? "");
const trim = (v) => String(v ?? "").trim();
const slug = (v) => trim(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "garment";

function garmentKind(style = {}) {
  const given = trim(style.garment).toLowerCase().replace(/[\s-]+/g, "_");
  if (GARMENT_KINDS.includes(given)) return given;
  const text = `${trim(style.category)} ${trim(style.name)}`.toLowerCase();
  if (/\b(co-?ord|set)\b/.test(text)) return "set";
  if (/hood/.test(text)) return "hoodie";
  if (/sweat|crew ?neck|jumper|pullover/.test(text)) return "sweatshirt";
  if (/dress|frock|gown/.test(text)) return "dress";
  if (/kurt[ai]|tunic/.test(text)) return "kurta";
  if (/jacket|bomber|blazer|shacket|overshirt|coat/.test(text)) return "jacket";
  if (/shorts/.test(text)) return "shorts";
  if (/oversiz|boxy|drop(ped)?[ -]?shoulder|relaxed/.test(text)) return "oversized_tee";
  return "tee";
}

function printSpec(style = {}) {
  const p = style.print;
  if (p && typeof p === "object") {
    const type = trim(p.type).toLowerCase();
    const placement = trim(p.placement).toLowerCase().replace(/[\s-]+/g, "_");
    return { type: ["graphic", "stripe", "typographic", "none"].includes(type) ? type : "none", placement: ["chest", "back", "all_over", "sleeve"].includes(placement) ? placement : "chest", motif: trim(p.motif).slice(0, 40) };
  }
  const text = (style.cues ?? []).map(trim).join(" ").toLowerCase();
  const placement = /\bback\b/.test(text) ? "back" : /sleeve/.test(text) ? "sleeve" : /all[ -]?over|repeat/.test(text) ? "all_over" : "chest";
  if (/stripe|breton/.test(text)) return { type: "stripe", placement: placement === "chest" ? "all_over" : placement, motif: "" };
  if (/typograph|slogan|wordmark|letter|\btext\b/.test(text)) return { type: "typographic", placement, motif: "" };
  if (/graphic|print|logo|artwork|motif|emblem|pattern/.test(text)) return { type: "graphic", placement, motif: "" };
  return { type: "none", placement: "chest", motif: "" };
}

const paletteHex = (name, palette) => {
  const key = trim(name).toLowerCase();
  const hit = key ? palette.find((c) => trim(c.name).toLowerCase() === key) : null;
  return (hit ?? palette[0])?.hex?.toLowerCase() ?? "#2b2f3a";
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** The palette hex that contrasts most with the base; white or ink when none does. */
function accentHex(base, palette) {
  const l = luminance(base);
  let best = null;
  let gap = 0;
  for (const c of palette) {
    const h = c.hex.toLowerCase();
    if (h === base) continue;
    const d = Math.abs(luminance(h) - l);
    if (d > gap) [best, gap] = [h, d];
  }
  return best && gap > 0.18 ? best : l > 0.35 ? "#15171c" : "#f5f5f7";
}

function destroyViewer() {
  try {
    state.viewer?.destroy();
  } catch (error) {
    console.warn("viewer teardown", error);
  }
  state.viewer = null;
}

/** "See it in 3D": style tabs, colourway chips, the viewer (or the croquis), a snapshot button and the caption. */
function garmentSection(p) {
  const styles = p.styles ?? [];
  const palette = (p.palette ?? []).filter((c) => hexOk(c?.hex));
  const paletteNames = palette.map((c) => trim(c.name)).filter(Boolean);
  const heroIndex = Math.max(0, styles.findIndex((s) => s.hero));
  const pick = state.garmentPick && styles[state.garmentPick.index] ? state.garmentPick : { index: heroIndex, colourway: "" };
  const waysFor = (s) => {
    const own = (s?.colourways ?? []).map(trim).filter((n) => paletteNames.some((pn) => pn.toLowerCase() === n.toLowerCase()));
    return own.length ? own : paletteNames;
  };
  const stage = el("div", { class: "garment-stage", "aria-busy": "true" });
  const tabs = el("div", { class: "chips garment-tabs", role: "group", "aria-label": "Styles" });
  const ways = el("div", { class: "chips garment-ways", role: "group", "aria-label": "Colourways" });
  const snap = el("button", { type: "button", class: "secondary garment-snap", text: "Snapshot PNG", disabled: true });
  const caption = el("p", { class: "garment-caption", text: "3D preview, not a cloth simulation. The shapes are procedural; the colours come from the palette and the print from the plan." });
  const box = el("div", { class: "sect garment" }, h3("See it in 3D"), tabs, stage, el("div", { class: "garment-foot" }, ways, snap), caption);
  let viewer = null;

  const renderTabs = () =>
    tabs.replaceChildren(...styles.map((s, i) => el("button", { type: "button", class: "chip", "aria-pressed": String(i === pick.index), onclick: () => select(i) }, s.name || `Style ${i + 1}`, s.hero ? el("span", { class: "chip-mark", text: "hero" }) : null)));
  const renderWays = () => {
    const list = waysFor(styles[pick.index]);
    if (!list.some((n) => n.toLowerCase() === pick.colourway.toLowerCase())) pick.colourway = list[0] ?? "";
    ways.replaceChildren(...list.map((n) => el("button", { type: "button", class: "chip chip-way", "aria-pressed": String(n === pick.colourway), onclick: () => way(n) }, el("span", { class: "chip-dot", style: `background:${paletteHex(n, palette)}` }), n)));
    ways.hidden = !list.length;
  };
  const draw = () => {
    const style = styles[pick.index];
    if (!style) return;
    if (viewer) {
      viewer.show(pick.index);
      viewer.setColourway(pick.colourway);
    } else stage.replaceChildren(croquis(style, paletteHex(pick.colourway, palette), palette));
  };
  const select = (i) => {
    pick.index = i;
    state.garmentPick = pick;
    renderTabs();
    renderWays();
    draw();
  };
  const way = (n) => {
    pick.colourway = n;
    state.garmentPick = pick;
    renderWays();
    draw();
  };
  snap.onclick = () => {
    if (!viewer) return;
    try {
      const link = el("a", { href: viewer.snapshot(), download: `${slug(p.drop_name)}-${slug(styles[pick.index]?.name)}.png` });
      document.body.append(link);
      link.click();
      link.remove();
      snap.textContent = "Saved";
    } catch (error) {
      console.warn("snapshot", error);
      snap.textContent = "Couldn't snapshot";
    }
    setTimeout(() => (snap.textContent = "Snapshot PNG"), 1600);
  };
  renderTabs();
  renderWays();
  // Mount once the card is in the document; the flat croquis stands in when WebGL or the module is missing.
  setTimeout(async () => {
    if (!stage.isConnected) return;
    destroyViewer();
    try {
      const mod = await import("./garment3d.js");
      if (!stage.isConnected) return;
      viewer = mod.createGarmentViewer(stage, { styles, palette, label: p.drop_name ?? "" });
      state.viewer = viewer;
      snap.disabled = false;
    } catch (error) {
      console.warn("3D preview unavailable; showing the flat croquis.", error);
      viewer = null;
      box.classList.add("flat");
      snap.hidden = true;
      caption.textContent = "Flat preview: 3D isn't available in this browser. The colours come from the palette and the print from the plan.";
    }
    stage.removeAttribute("aria-busy");
    draw();
  }, 0);
  return box;
}

// The flat fallback: a front-view outline per garment in a 200×260 box, filled with the colourway and marked with the print.
const SVG_NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...children) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  for (const child of children.flat(Infinity)) if (child) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};
const TEE = "60,60 80,52 95,62 105,62 120,52 140,60 152,98 132,104 132,200 68,200 68,104 48,98";
const LONG = "60,60 80,52 95,62 105,62 120,52 140,60 158,168 134,172 132,112 132,206 68,206 68,112 66,172 42,168";
const SHORTS = "66,128 134,128 142,192 106,192 100,156 94,192 58,192";
const CROQUIS = {
  tee: [TEE],
  oversized_tee: ["46,62 80,52 95,62 105,62 120,52 154,62 170,108 142,114 142,216 58,216 58,114 30,108"],
  hoodie: [LONG],
  sweatshirt: [LONG],
  dress: ["70,60 85,52 95,62 105,62 115,52 130,60 142,96 126,102 162,244 38,244 74,102 58,96"],
  kurta: ["60,60 80,52 95,62 105,62 120,52 140,60 158,168 134,172 132,112 132,236 68,236 68,112 66,172 42,168"],
  jacket: ["58,62 80,52 96,64 96,208 66,208 66,112 64,172 40,168", "142,62 120,52 104,64 104,208 134,208 134,112 136,172 160,168"],
  shorts: [SHORTS],
  set: ["60,60 80,52 95,62 105,62 120,52 140,60 152,98 132,104 132,150 68,150 68,104 48,98", "66,146 134,146 142,206 106,206 100,170 94,206 58,206"],
};

function croquis(style, hex, palette) {
  const kind = garmentKind(style);
  const print = printSpec(style);
  const accent = accentHex(hex, palette);
  const id = `cq-${Math.random().toString(36).slice(2, 8)}`;
  const shapes = CROQUIS[kind] ?? CROQUIS.tee;
  const line = "rgba(255,255,255,0.32)";
  const root = svg("svg", { viewBox: "0 0 200 260", class: "croquis", role: "img", "aria-label": `${style.name ?? 'Style'}: flat ${kind.replace('_', ' ')} preview` });
  root.append(svg("defs", {}, svg("clipPath", { id }, ...shapes.map((pts) => svg("polygon", { points: pts })))));
  if (kind === "hoodie") root.append(svg("path", { d: "M78,56 Q100,12 122,56 Z", fill: hex, stroke: line, "stroke-width": 1.5 }));
  for (const pts of shapes) root.append(svg("polygon", { points: pts, fill: hex, stroke: line, "stroke-width": 1.5, "stroke-linejoin": "round" }));
  const detail = (d) => root.append(svg("path", { d, fill: "none", stroke: line, "stroke-width": 1.2 }));
  if (kind === "hoodie") detail("M70,168 h60 v32 h-60 Z M68,194 h64");
  if (kind === "sweatshirt") detail("M68,194 h64 M42,160 l22,2 M136,162 l22,-2");
  if (kind === "kurta") detail("M100,62 v40 M94,62 v40 M68,206 v30 M132,206 v30");
  if (kind === "jacket") detail("M96,64 L100,54 L104,64 M72,120 h16 M112,120 h16");
  if (kind === "set" || kind === "shorts") detail(kind === "set" ? "M66,152 h68" : "M66,134 h68");
  const g = svg("g", { "clip-path": `url(#${id})` });
  const markAt = (cx, cy, w, h, dim = false) => {
    const text = (print.motif || style.name || "").toUpperCase();
    const m = svg("g", { opacity: dim ? 0.35 : 1 });
    if (print.type === "typographic") m.append(svg("text", { x: cx, y: cy, fill: accent, "font-family": "Archivo, system-ui, sans-serif", "font-weight": "900", "font-size": Math.min(16, h * 0.6), "text-anchor": "middle", "dominant-baseline": "middle", textLength: text.length > 6 ? w : undefined, lengthAdjust: "spacingAndGlyphs" }, text));
    else if (print.type === "stripe") for (let i = 0; i < 5; i += 2) m.append(svg("rect", { x: cx - w / 2, y: cy - h / 2 + (i * h) / 5, width: w, height: h / 5, fill: accent }));
    else {
      const seed = [...text].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 4;
      const r = Math.min(w, h) / 2;
      if (seed === 0) m.append(svg("circle", { cx, cy, r: r * 0.9, fill: accent }), svg("circle", { cx, cy, r: r * 0.5, fill: "none", stroke: hex, "stroke-width": r * 0.14 }));
      else if (seed === 1) for (let i = 0; i < 3; i += 1) m.append(svg("rect", { x: cx - (w * (1 - i * 0.22)) / 2, y: cy - h / 2 + (i * h) / 3, width: w * (1 - i * 0.22), height: h / 5, rx: h / 10, fill: accent }));
      else if (seed === 2) m.append(svg("path", { d: `M${cx - r * 0.7},${cy + r * 0.2} A${r * 0.7},${r * 0.7} 0 0 1 ${cx + r * 0.7},${cy + r * 0.2}`, fill: "none", stroke: accent, "stroke-width": r * 0.3, "stroke-linecap": "round" }), svg("circle", { cx, cy: cy + r * 0.5, r: r * 0.16, fill: accent }));
      else m.append(svg("rect", { x: cx - r * 0.62, y: cy - r * 0.62, width: r * 1.25, height: r * 1.25, fill: accent, transform: `rotate(45 ${cx} ${cy})` }), svg("rect", { x: cx - r * 0.22, y: cy - r * 0.22, width: r * 0.44, height: r * 0.44, fill: hex, transform: `rotate(45 ${cx} ${cy})` }));
    }
    return m;
  };
  if (print.type !== "none") {
    if (print.placement === "all_over") {
      if (print.type === "stripe") for (let y = 40; y < 260; y += 16) g.append(svg("rect", { x: 0, y, width: 200, height: 8, fill: accent }));
      else for (let y = 56; y < 256; y += 22) for (let x = 36 + ((y / 22) % 2) * 11; x < 170; x += 22) g.append(markAt(x, y, 9, 9));
    } else if (print.placement === "sleeve") g.append(svg("rect", { x: 40, y: 84, width: 30, height: 9, fill: accent, transform: "rotate(14 55 88)" }));
    else {
      const chest = kind === "jacket" ? [82, 118, 18, 18] : kind === "shorts" ? [80, 146, 16, 14] : kind === "set" ? [100, 112, 36, 24] : [100, 120, 44, 28];
      g.append(markAt(...chest, print.placement === "back"));
      if (print.placement === "back") g.append(svg("text", { x: chest[0], y: chest[1] + chest[3] / 2 + 10, fill: "rgba(255,255,255,0.6)", "font-size": 8, "text-anchor": "middle", "font-family": "Archivo, system-ui, sans-serif" }, "back print"));
    }
  }
  root.append(g);
  return root;
}

// ---------- map ----------

function drawMap(key, box, points, home) {
  if (!window.L || !box.isConnected) return;
  // A card redraws several times as a run streams; the last drawing of this map goes first.
  state.maps.get(key)?.remove();
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
    item = el("li", { class: "trace-item", "data-call": entry.id, "data-stage": entry.stage ?? "" });
    trace.append(item);
  }
  // A later update of the same call may come without its title (the analyst's "done"): keep the first one.
  const title = entry.title ?? item.dataset.title ?? entry.tool;
  item.dataset.title = title ?? "";
  entry = { ...entry, title, args: entry.args ?? (item.dataset.args ? JSON.parse(item.dataset.args) : undefined) };
  if (entry.args) item.dataset.args = JSON.stringify(entry.args);
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
  // An answer belongs to this run: leaving it (another run, the home page) stops the stream and its receipts.
  state.askAbort?.abort();
  const abort = (state.askAbort = new AbortController());
  try {
    const response = await fetch("/api/ask", { method: "POST", signal: abort.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context: askContext(), ...(credential() ? { llm: credential() } : {}) }) });
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
    if (error.name === "AbortError") answer.replaceChildren(el("span", { class: "sub", text: "Stopped: a newer question or another page took over." }));
    else answer.replaceChildren(el("strong", { text: "Couldn't answer. " }), error.message);
  }
}

init();
