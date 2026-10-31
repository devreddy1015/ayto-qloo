// AYTO motion. One small system on top of app.js and pages.js, which it never calls: it watches the page they draw and
// adds motion to it. One set of tokens (the --dur-*, --ease-* and --stagger in styles.css, "Motion pass"), one reveal
// (rise and fade; a heading comes into focus on wide screens; pictures and bars wipe or grow), each element once,
// through one IntersectionObserver. Transform, opacity and clip-path only, apart from that small blur. Nothing here
// blocks input or moves the layout: what waits is only transparent, and every animation is short.
// Reduced motion: only the example sentences are wired (they fill at once) and the gallery still gets its posters.
// Hover effects need a fine pointer.

const $ = (sel, root = document) => root.querySelector(sel);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const phone = () => innerWidth < 720;

const token = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;
const FAST = token("--dur-fast", 150);
const BASE = token("--dur-base", 240);
const SLOW = token("--dur-slow", 600);
const STAGGER = token("--stagger", 50);
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // --ease-out
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"; // --ease-in-out

const FRAMES = {
  rise: [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
  focus: [{ opacity: 0, transform: "translateY(8px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  growX: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
  growY: [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
  wipe: [{ opacity: 0.3, clipPath: "inset(0 100% 0 0)", transform: "scale(1.08)" }, { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "none" }],
  open: [{ opacity: 0, clipPath: "inset(0 0 100% 0)", transform: "translateY(-4px)" }, { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "none" }],
};
// Phones get no blur: a big blurred area is the costly kind.
const headingFrames = () => (phone() ? FRAMES.rise : FRAMES.focus);

/** Animate a node in; `fill: backwards` holds the first frame through the delay, so nothing flashes before it starts. */
const enter = (node, frames, { delay = 0, duration = SLOW, at = 0, easing = EASE } = {}) => {
  const a = node.animate(frames, { duration, delay, easing, fill: "backwards" });
  if (at) a.currentTime = at;
  return a;
};

// ---------- the one observer: everything that waits to be seen goes through whenSeen ----------

const waiting = new Map();
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const fn = waiting.get(entry.target);
    forget(entry.target);
    fn?.();
  }
}, { rootMargin: "0px 0px -10% 0px" });
function whenSeen(node, fn) {
  waiting.set(node, fn);
  io.observe(node);
}
function forget(node) {
  waiting.delete(node);
  io.unobserve(node);
}

/** The one reveal: a section waits (styles.css keeps it transparent), then its heading focuses and its items rise. */
function reveal(root, { heads = "h2", items, whole = false, after } = {}) {
  if (!root) return;
  root.dataset.reveal = "wait";
  whenSeen(root, () => {
    root.dataset.reveal = "in";
    if (whole) enter(root, FRAMES.fade, { duration: SLOW });
    root.querySelectorAll(heads).forEach((h) => enter(h, headingFrames(), { duration: SLOW }));
    const list = items ? [...root.querySelectorAll(items)] : [];
    list.forEach((node, i) => enter(node, FRAMES.rise, { delay: 90 + Math.min(i, 8) * STAGGER }));
    after?.(list);
  });
}

// ---------- the field: example sentences type themselves in ----------

function wireExamples() {
  const field = $("#text-input");
  if (!field) return;
  let typing = 0;
  const put = (text) => {
    cancelAnimationFrame(typing);
    field.focus({ preventScroll: true });
    const done = () => {
      field.value = text;
      field.setSelectionRange(text.length, text.length);
      field.dispatchEvent(new Event("input", { bubbles: true })); // app.js marks an old confirm step stale on input
    };
    if (still) return done();
    // About half a second whatever the length: long enough to read as typed, short enough never to wait on.
    const start = performance.now();
    const total = Math.min(520, text.length * 16);
    const step = (now) => {
      const n = Math.min(text.length, Math.ceil(((now - start) / total) * text.length));
      field.value = text.slice(0, n);
      if (n < text.length) typing = requestAnimationFrame(step);
      else done();
    };
    typing = requestAnimationFrame(step);
  };
  for (const chip of document.querySelectorAll(".try-chip")) chip.addEventListener("click", () => put(chip.dataset.text ?? chip.textContent));
  field.addEventListener("keydown", () => cancelAnimationFrame(typing)); // the maker's own key takes over
}

// ---------- home: How it works, and Watch it work as a timeline that lights up step by step ----------

function homeSections() {
  reveal($("#how"), { whole: true, items: ".how-grid > div, .fine" });
  const steps = $("#watch-steps");
  let lit = false;
  reveal($("#watch"), {
    whole: true,
    items: "#watch-sub, .watch-step",
    after: (list) => {
      const all = list.filter((n) => n.classList.contains("watch-step"));
      // One real finished run, replayed: each step lights after the one before it, about a third of a second apart.
      all.forEach((step, i) =>
        setTimeout(() => {
          all.forEach((s, k) => k < i && (s.dataset.lit = "1"));
          step.dataset.lit = i === all.length - 1 ? "1" : "now";
          if (i === all.length - 1) lit = true;
        }, 380 + i * 360),
      );
    },
  });
  // The steps are drawn again on the way back home: once the timeline has played, the new ones arrive lit.
  if (steps) new MutationObserver(() => lit && steps.querySelectorAll(".watch-step").forEach((s) => (s.dataset.lit = "1"))).observe(steps, { childList: true });
  reveal($("#showing"), { heads: "h2", items: ".showing-head .block-note, .showing-card" });
}

// ---------- Now showing: posters from each run's own Qloo reads, tilt and a border light on hover ----------

function gallery() {
  const host = $("#showing-cards");
  if (!host) return;
  const cache = new Map(); // run id → its pictures (one request per run, kept for the visit)
  const pictures = (id) => {
    if (!cache.has(id)) {
      cache.set(id, fetch(`/api/mosaic?run=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j?.images ?? []).filter((x) => /^https:\/\//.test(x?.url ?? "")).slice(0, 3)).catch(() => []));
    }
    return cache.get(id);
  };
  // The strip goes in as the card is drawn (a microtask before the first paint), so its height never shifts the page.
  const posters = (card) => {
    if (card.classList.contains("yours") || card.querySelector(".showing-posters")) return;
    const id = card.getAttribute("href")?.match(/^\/run\/([A-Za-z0-9_-]+)/)?.[1];
    if (!id) return;
    const strip = document.createElement("div");
    strip.className = "showing-posters";
    strip.setAttribute("aria-hidden", "true");
    card.prepend(strip);
    pictures(id).then((list) =>
      list.forEach((p, i) => {
        const img = new Image();
        img.alt = "";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        // A loaded picture waits, transparent, until it is seen; then it wipes in.
        img.onload = () => (still ? img.classList.add("in") : whenSeen(img, () => {
          img.classList.add("in");
          enter(img, FRAMES.wipe, { delay: i * 90, duration: SLOW, easing: EASE_IN_OUT });
        }));
        img.src = p.url;
        strip.append(img);
      }),
    );
  };
  const scan = () => host.querySelectorAll(".showing-card").forEach(posters);
  new MutationObserver(scan).observe(host, { childList: true });
  scan();
  if (still || !finePointer) return;
  // A small 3D tilt toward the pointer (6° at most) and the border light, one frame at a time.
  let active = null;
  let raf = 0;
  const rest = (card) => card && ["--rx", "--ry"].forEach((k) => card.style.removeProperty(k));
  host.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".showing-card");
    if (card !== active) rest(active);
    active = card;
    if (!card) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      card.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
      card.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
    });
  });
  host.addEventListener("pointerleave", () => {
    cancelAnimationFrame(raf);
    rest(active);
    active = null;
  });
}

// ---------- the run: each stage unfolds like a report when it is really done and on screen ----------

const UNFOLD_WINDOW = 1600; // a re-render inside this window carries on the same unfold instead of starting over

function unfoldStages() {
  const results = $("#results");
  if (!results) return;
  const memo = new WeakMap(); // card → { done, start }
  const played = new WeakSet(); // nodes already brought in

  const play = (card, at) => {
    const body = card.querySelector(".stage-body");
    if (!body) return;
    const items = [...body.children];
    items.forEach((node, i) => {
      if (played.has(node) || node.classList.contains("skeleton")) return;
      played.add(node);
      enter(node, FRAMES.rise, { delay: Math.min(i, 8) * STAGGER, duration: SLOW * 0.7, at });
    });
    // Bars grow from zero to their own value, after the row that holds them. The value is the real one, set by app.js.
    const rowOf = (bar) => Math.max(0, items.findIndex((n) => n.contains(bar)));
    body.querySelectorAll(".lane-bars .bar, .bar-fill, .agefill").forEach((bar) => {
      if (played.has(bar)) return;
      played.add(bar);
      const row = bar.closest(".lane, li, .ageband");
      const k = row ? [...row.parentElement.children].indexOf(row) : 0;
      enter(bar, bar.classList.contains("agefill") ? FRAMES.growY : FRAMES.growX, { delay: Math.min(rowOf(bar), 8) * STAGGER + 140 + Math.min(k, 8) * 70, duration: SLOW, at });
    });
    body.querySelectorAll(".title-option.first").forEach((t) => {
      if (played.has(t)) return;
      played.add(t);
      enter(t, headingFrames(), { delay: 120, duration: SLOW, at });
    });
  };
  // The brief's main results panel (.highlights, drawn by app.js): the same reveal as a section, once per run (an
  // emptied panel is ready again), and its numbers count up to the values already in it.
  const panels = new WeakSet();
  const highlights = (panel) => {
    if (!panel.children.length) return panels.delete(panel);
    if (panels.has(panel)) return;
    panels.add(panel);
    panel.dataset.reveal = "wait";
    whenSeen(panel, () => {
      panel.dataset.reveal = "in";
      [...panel.children].forEach((n, i) => enter(n, FRAMES.rise, { delay: Math.min(i, 8) * STAGGER, duration: SLOW * 0.7 }));
      panel.querySelectorAll(".hl-num").forEach((n, i) => countUp(n, 120 + Math.min(i, 8) * STAGGER));
    });
  };
  const start = (card) => {
    const m = memo.get(card);
    if (!m?.done) return;
    m.start = performance.now();
    card.dataset.unfold = "in";
    play(card, 0);
  };
  const check = (card) => {
    const m = memo.get(card) ?? { done: false, start: null };
    memo.set(card, m);
    // app.js rewrites the card's class on every render, so the state lives in a data attribute it never touches.
    if (!card.classList.contains("done")) {
      m.done = false;
      m.start = null;
      delete card.dataset.unfold;
      forget(card);
      return;
    }
    if (!m.done) {
      m.done = true;
      card.dataset.unfold = "wait";
    }
    // Still waiting (also after pages.js moved the card to its page): the observer lets it in when it is seen.
    if (m.start === null) return whenSeen(card, () => start(card));
    // Drawn again while unfolding (the snapshot, then the stream): the new nodes pick up where the old ones were.
    const at = performance.now() - m.start;
    if (at < UNFOLD_WINDOW) play(card, at);
  };
  new MutationObserver((records) => {
    const cards = new Set();
    for (const r of records) {
      const t = r.target;
      if (r.type === "attributes") {
        if (t.classList?.contains("stage")) cards.add(t);
        continue;
      }
      if (t.classList?.contains("stage-body")) cards.add(t.closest(".stage"));
      for (const n of r.addedNodes) if (n.classList?.contains("stage")) cards.add(n);
      if (t.classList?.contains("highlights")) highlights(t);
      for (const n of r.addedNodes) if (n.nodeType === 1) (n.matches(".highlights") ? [n] : n.querySelectorAll(".highlights")).forEach((p) => highlights(p));
      for (const n of r.removedNodes) if (n.classList?.contains("stage") && !n.isConnected) forget(n);
    }
    for (const card of cards) if (card?.isConnected) check(card);
  }).observe(results, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

// ---------- accordions: receipts and every other details open and close with a short clip ----------

function accordions() {
  const parts = (details) => [...details.children].filter((n) => n.tagName !== "SUMMARY");
  // Opening: the browser opens it, then its content unrolls from the top.
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d.tagName !== "DETAILS" || !d.open || d.dataset.closing) return;
    parts(d).forEach((n) => n.animate(FRAMES.open, { duration: BASE, easing: EASE }));
  }, true);
  // Closing: roll the content up first, then close. Clicks during a close are ignored; input is never held longer.
  document.addEventListener("click", (e) => {
    const summary = e.target.closest?.("summary");
    const d = summary?.parentElement;
    if (!d || d.tagName !== "DETAILS" || !d.open || e.defaultPrevented || summary.contains(e.target.closest("a, button"))) return; // a link or button in the summary does its own thing
    const list = parts(d);
    if (!list.length) return;
    e.preventDefault();
    if (d.dataset.closing) return;
    d.dataset.closing = "1";
    const anims = list.map((n) => n.animate([...FRAMES.open].reverse(), { duration: FAST, easing: EASE, fill: "forwards" }));
    Promise.all(anims.map((a) => a.finished)).catch(() => {}).then(() => {
      d.open = false;
      anims.forEach((a) => a.cancel());
      delete d.dataset.closing;
    });
  });
}

// ---------- city comparison: bars, numbers and markers from what /api/where returned ----------

/**
 * Counts a number up from 0 to the value already in the page: data-count, or else the one whole number in its text
 * ("+23", "35", "1,204 calls"; "20/20" has two and is left alone). Its width is held so nothing beside it moves, and
 * if app.js writes a new value mid-count the count stops and the new value stays.
 */
function countUp(node, delay) {
  if (node.dataset.counted) return;
  const text = node.textContent;
  const m = node.dataset.count !== undefined ? ["", "", node.dataset.count, ""] : text.match(/^(\D*?)(-?\d{1,3}(?:,\d{3})*|-?\d+)(\D*)$/);
  const to = m ? Number(m[2].replace(/,/g, "")) : NaN;
  if (!Number.isFinite(to)) return;
  node.dataset.counted = "1";
  const [pre, post] = node.dataset.count !== undefined ? ["", ""] : [m[1], m[3]];
  const show = (v) => `${pre}${m[2].includes(",") ? v.toLocaleString("en-US") : v}${post}`;
  node.style.display = "inline-block";
  node.style.minWidth = `${show(to).length}ch`;
  const begin = performance.now() + delay;
  let wrote = show(0);
  const tick = (now) => {
    if (node.textContent !== wrote) return; // app.js drew a new value: it wins
    const t = Math.min(1, Math.max(0, (now - begin) / SLOW));
    wrote = show(Math.round(to * (1 - (1 - t) ** 3)));
    node.textContent = wrote;
    if (t < 1) requestAnimationFrame(tick);
  };
  node.textContent = wrote;
  requestAnimationFrame(tick);
}

function compareCities() {
  const box = $("#where");
  if (!box) return;
  const seen = new WeakSet();
  let marks = 0;
  new MutationObserver((records) => {
    const list = box.querySelector(".where-list");
    if (list && !seen.has(list)) {
      seen.add(list);
      list.dataset.reveal = "wait";
      whenSeen(list, () => {
        list.dataset.reveal = "in";
        marks = 0;
        [...list.children].forEach((li, i) => {
          const d = 80 + Math.min(i, 10) * STAGGER;
          enter(li, FRAMES.rise, { delay: d });
          const fill = li.querySelector(".where-bar-fill");
          if (fill) enter(fill, FRAMES.growX, { delay: d + 160, duration: SLOW });
          li.querySelectorAll("[data-count]").forEach((n) => countUp(n, d + 160));
        });
      });
    }
    // The map's markers arrive a moment later (Leaflet draws them): each fades in, in the order of the list.
    for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains("leaflet-interactive")) enter(n, FRAMES.fade, { delay: 120 + Math.min(marks++, 10) * STAGGER * 1.6, duration: SLOW });
  }).observe(box, { childList: true, subtree: true });
}

// ---------- panels that come and go: home ↔ run, the confirm step, errors; the receipts count ----------

function softSwaps() {
  const shown = (node, fn) => node && new MutationObserver(() => !node.hidden && fn()).observe(node, { attributes: true, attributeFilter: ["hidden"] });
  shown($("#results"), () => ["#results .rail", "#results .page-tabs", "#results .trace"].forEach((sel, i) => {
    const n = $(sel);
    if (n) enter(n, FRAMES.rise, { delay: i * STAGGER * 1.5, duration: SLOW * 0.7 });
  }));
  // Back home from a run (the first load is the hero's own reveal): a quick rise, no replay of the intro.
  shown($("#home"), () => [".hero", ".composer"].forEach((sel, i) => {
    const n = $(sel);
    if (n) enter(n, FRAMES.rise, { delay: i * STAGGER, duration: SLOW * 0.7 });
  }));
  for (const sel of ["#confirm", "#where", "#error-box"]) shown($(sel), () => enter($(sel), FRAMES.rise, { duration: SLOW * 0.7 }));
  // The receipts count is a real number that moves as calls stream in: each change ticks, at most every 120 ms.
  const count = $("#trace-status");
  let last = 0;
  if (count) new MutationObserver(() => {
    const now = performance.now();
    if (now - last < 120 || !count.textContent) return;
    last = now;
    count.animate([{ opacity: 0.4, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: BASE, easing: EASE });
  }).observe(count, { childList: true, characterData: true, subtree: true });
}

// ---------- the poster wall: one slow crossfade at a time, on screen, desktop, tab visible ----------

function wallCrossfades() {
  const grid = $("#canvas-grid");
  if (!grid) return;
  const onScreen = (n) => {
    const r = n.getBoundingClientRect();
    return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  setInterval(() => {
    if (document.hidden || phone()) return;
    const tiles = [...grid.querySelectorAll(".tile:not(.abstract)")].filter((t) => t.querySelector("img")?.naturalWidth);
    const shown = tiles.filter(onScreen);
    const away = tiles.filter((t) => !onScreen(t));
    if (!shown.length || !away.length) return;
    // A poster on screen trades places with one off screen: no picture is ever shown twice, and each keeps its name.
    const a = shown[Math.floor(Math.random() * shown.length)];
    const b = away[Math.floor(Math.random() * away.length)];
    const img = a.querySelector("img");
    const out = img.animate(FRAMES.fade.slice().reverse(), { duration: 1200, easing: EASE_IN_OUT, fill: "forwards" });
    out.finished.then(() => {
      if (!a.isConnected || !b.isConnected) return out.cancel();
      const ia = a.querySelector("img");
      const ib = b.querySelector("img");
      const ca = a.querySelector("figcaption");
      const cb = b.querySelector("figcaption");
      [a.className, b.className] = [b.className, a.className];
      [ia.src, ib.src] = [ib.src, ia.src];
      if (ca && cb) [ca.textContent, cb.textContent] = [cb.textContent, ca.textContent];
      ia.animate(FRAMES.fade, { duration: 1200, easing: EASE_IN_OUT });
      out.cancel();
    }).catch(() => {});
  }, 5000);
}

// ---------- the main CTA leans toward a pointer near it (desktop) ----------

function magneticCta() {
  const cta = $("#parse-button");
  const zone = cta?.closest(".row");
  if (!cta || !zone) return;
  let raf = 0;
  zone.addEventListener("pointermove", (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = cta.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // Up to about 5 px. `translate` composes with the hero's own transforms.
      cta.style.translate = Math.hypot(dx, dy) < Math.max(r.width, 120) ? `${(dx * 0.08).toFixed(1)}px ${(dy * 0.12).toFixed(1)}px` : "";
    });
  });
  zone.addEventListener("pointerleave", () => {
    cancelAnimationFrame(raf);
    cta.style.translate = "";
  });
}

wireExamples();
gallery();
if (!still) {
  homeSections();
  unfoldStages();
  accordions();
  compareCities();
  softSwaps();
  wallCrossfades();
  if (finePointer) magneticCta();
}
