// AYTO motion. One small system on top of app.js, which it never calls: it watches the page app.js draws and adds
// reveals to it. Rise, fade and blur-to-focus only, transform and opacity only, each element once. The timings are the
// --dur-* and --stagger tokens in styles.css ("Motion pass"). Reduced motion: only the example sentences are wired, and
// they fill the field at once. Phones and touch screens get no pointer effects.

const $ = (sel, root = document) => root.querySelector(sel);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const token = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;
const D2 = token("--dur-2", 240);
const D3 = token("--dur-3", 420);
const D4 = token("--dur-4", 640);
const STAGGER = token("--stagger", 60);
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // --ease-out
const RISE = [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }];
const FOCUS = [{ opacity: 0, transform: "translateY(6px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }];
const FADE = [{ opacity: 0 }, { opacity: 1 }];

/** Animate a node in; `fill: backwards` holds the first frame through the delay, so nothing flashes before it starts. */
const enter = (node, frames, { delay = 0, duration = D3, at = 0 } = {}) => {
  const a = node.animate(frames, { duration, delay, easing: EASE, fill: "backwards" });
  if (at) a.currentTime = at;
  return a;
};

// ---------- example sentences that type themselves into the field ----------

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
  // Any key in the field takes over from a sentence still typing in.
  field.addEventListener("keydown", () => cancelAnimationFrame(typing));
}

// ---------- scroll reveals on the home page, once per section ----------

const SECTIONS = [
  // The glass panels fade as a whole (a parent's opacity would switch off a child's backdrop blur, so only these two).
  { root: "#how", whole: true, heads: "h2", items: ".how-grid > div, .fine" },
  { root: "#watch", whole: true, heads: "h2", items: "#watch-sub, .watch-step" },
  { root: "#showing", whole: false, heads: "h2", items: ".showing-head .block-note, .showing-card" },
];

function revealSections() {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      const spec = SECTIONS.find((s) => entry.target.matches(s.root));
      const root = entry.target;
      root.dataset.reveal = "in";
      if (spec.whole) enter(root, FADE, { duration: D3 });
      root.querySelectorAll(spec.heads).forEach((h) => enter(h, FOCUS, { duration: D4 }));
      [...root.querySelectorAll(spec.items)].forEach((node, i) => enter(node, RISE, { delay: 90 + Math.min(i, 8) * STAGGER }));
    }
  }, { rootMargin: "0px 0px -12% 0px" });
  for (const spec of SECTIONS) {
    const root = $(spec.root);
    if (!root) continue;
    root.dataset.reveal = "wait"; // styles.css hides it (or its items) until the observer lets it in
    io.observe(root);
  }
}

// ---------- the run: each stage unfolds like a report when it is really done and on screen ----------

const UNFOLD_WINDOW = 1600; // a re-render inside this window carries on the same unfold instead of starting over

function unfoldStages() {
  const host = $("#stage-cards");
  if (!host) return;
  const memo = new WeakMap(); // card → { done, start }

  const play = (card, at) => {
    const body = card.querySelector(".stage-body");
    if (!body) return;
    const items = [...body.children];
    items.forEach((node, i) => {
      if (node.classList.contains("skeleton")) return;
      enter(node, RISE, { delay: Math.min(i, 8) * STAGGER, at });
    });
    // Bars grow from zero to their own value, after the row that holds them. The value is the real one, set by app.js.
    const rowOf = (bar) => items.findIndex((n) => n.contains(bar));
    body.querySelectorAll(".lane-bars .bar, .bar-fill").forEach((bar) => {
      const lane = bar.closest(".lane, li");
      const k = lane ? [...lane.parentElement.children].indexOf(lane) : 0;
      enter(bar, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: Math.min(rowOf(bar), 8) * STAGGER + 140 + Math.min(k, 8) * 70, duration: D4, at });
    });
    body.querySelectorAll(".agefill").forEach((bar, k) => {
      enter(bar, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { delay: Math.min(rowOf(bar), 8) * STAGGER + 140 + k * 50, duration: D4, at });
    });
    // The written piece: its first title comes into focus.
    body.querySelectorAll(".title-option.first").forEach((t) => enter(t, FOCUS, { delay: 120, duration: D4, at }));
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      const m = memo.get(entry.target);
      if (!m?.done) continue;
      m.start = performance.now();
      entry.target.dataset.unfold = "in";
      play(entry.target, 0);
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  const check = (card) => {
    const m = memo.get(card) ?? { done: false, start: null };
    memo.set(card, m);
    // app.js rewrites the card's class on every render, so the state lives in a data attribute it never touches.
    if (!card.classList.contains("done")) {
      m.done = false;
      m.start = null;
      delete card.dataset.unfold;
      io.unobserve(card);
      return;
    }
    if (!m.done) {
      m.done = true;
      card.dataset.unfold = "wait";
      io.observe(card);
      return;
    }
    // Drawn again while unfolding (the snapshot, then the stream): pick the new nodes up where the old ones were.
    if (m.start !== null) {
      const at = performance.now() - m.start;
      if (at < UNFOLD_WINDOW) play(card, at);
    }
  };

  new MutationObserver((records) => {
    const cards = new Set();
    for (const r of records) {
      if (r.target === host) {
        for (const n of r.addedNodes) if (n.classList?.contains("stage")) cards.add(n);
        for (const n of r.removedNodes) if (n.classList?.contains("stage")) io.unobserve(n);
      } else if (r.target.classList?.contains("stage")) cards.add(r.target);
      else if (r.target.classList?.contains("stage-body")) cards.add(r.target.parentElement);
    }
    for (const card of cards) check(card);
  }).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

// ---------- panels that come and go: home ↔ run, the confirm step, errors ----------

function softSwaps() {
  const shown = (node, fn) => {
    if (!node) return;
    new MutationObserver(() => !node.hidden && fn()).observe(node, { attributes: true, attributeFilter: ["hidden"] });
  };
  shown($("#results"), () => {
    ["#results .rail", "#results .trace"].forEach((sel, i) => {
      const n = $(sel);
      if (n) enter(n, RISE, { delay: i * STAGGER * 1.5, duration: D3 });
    });
  });
  // Back home from a run (the first load is the hero's own reveal): a quick fade, no replay of the intro.
  shown($("#home"), () => {
    [".hero", ".composer"].forEach((sel, i) => {
      const n = $(sel);
      if (n) enter(n, RISE, { delay: i * STAGGER, duration: D3 });
    });
  });
  for (const sel of ["#confirm", "#where", "#error-box"]) shown($(sel), () => enter($(sel), RISE, { duration: D3 }));

  // The receipts count is a real number that moves as calls stream in: let each change tick, at most every 120 ms.
  const count = $("#trace-status");
  let last = 0;
  if (count) {
    new MutationObserver(() => {
      const now = performance.now();
      if (now - last < 120 || !count.textContent) return;
      last = now;
      count.animate([{ opacity: 0.4, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: D2, easing: EASE });
    }).observe(count, { childList: true, characterData: true, subtree: true });
  }
}

// ---------- pointer effects, desktop only ----------

function pointerEffects() {
  // Magnetic main CTA: it leans up to 5 px toward a pointer near it. `translate` composes with the hero's transforms.
  const cta = $("#parse-button");
  const zone = cta?.closest(".row");
  if (cta && zone) {
    let raf = 0;
    zone.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = cta.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const near = Math.hypot(dx, dy) < Math.max(r.width, 120);
        cta.style.translate = near ? `${(dx * 0.08).toFixed(1)}px ${(dy * 0.12).toFixed(1)}px` : "";
      });
    });
    zone.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      cta.style.translate = "";
    });
  }
  // A soft light on the border of the card under the pointer (styles.css draws it from --mx and --my).
  const cards = $("#showing-cards");
  cards?.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".showing-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
    card.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
  });
}

wireExamples();
if (!still) {
  revealSections();
  unfoldStages();
  softSwaps();
  if (finePointer) pointerEffects();
}
