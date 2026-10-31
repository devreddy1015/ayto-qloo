// Captures the live app for the video: element cutouts and viewport shots at 2x, plus layout.json with each
// element's box. Adapted from video-shotcraft's capture-template.mjs, on playwright-core with the cached Chromium.
//
//   node scripts/capture.mjs [only-page-name]
//
// The runs are the live showcase runs of 31 Oct (London film, Las Vegas reel, Paris drop). The home page's poster
// wall is emptied (its /api/mosaic answer is replaced), so no real poster reaches the video.

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../public/textures");
const LAYOUT = path.resolve(here, "../src/layout.json");
const BASE = process.env.AYTO_BASE ?? "https://ayto-ocx1.onrender.com";
// Runs live on the free plan only until it sleeps, so a later capture needs fresh run ids (AYTO_RUNS="key:id,…").
const RUNS = {
  london: "r_II8RRiQ", vegas: "r_v1UPYbI", paris: "r_zMOGrbI",
  // The second pass (31 Oct, 05:20): a fresh Paris drop and five more formats.
  // The drop-led video (31 Oct, 06:05): a streetwear drop in Los Angeles.
  la: "r_ftChx5Q",
  paris2: "r__YIcZgo", podcast: "r_0VEYXak", cafe: "r_2JR1XV0", night: "r_2HLTtTI", novel: "r_RYJLaBw", game: "r_vlWXKdk",
  ...Object.fromEntries((process.env.AYTO_RUNS ?? "").split(",").filter(Boolean).map((kv) => kv.split(":"))),
};
const CHROME = process.env.CHROME ?? path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome");
const only = process.argv[2];

const PAGES = [
  {
    name: "home",
    path: "/",
    ready: "#text-input",
    prep: async (page) => {
      await page.fill("#text-input", "I'm making a crime short film in London.");
    },
    shots: ["viewport"],
    cutouts: [{ name: "composer", selector: "#run-form" }],
  },
  {
    name: "compose",
    path: "/",
    ready: "#text-input",
    prep: async (page) => {
      const style = await page.$eval("#text-input", (e) => { const c = getComputedStyle(e); return { fontSize: c.fontSize, lineHeight: c.lineHeight, padding: c.padding, font: c.fontFamily, color: c.color }; });
      console.log("  textarea style", JSON.stringify(style));
    },
    shots: [],
    cutouts: [{ name: "empty", selector: "#run-form" }],
    boxes: [{ key: "form", selector: "#run-form" }, { key: "textarea", selector: "#text-input" }],
  },
  {
    name: "confirm",
    path: "/",
    ready: "#text-input",
    prep: async (page) => {
      await page.fill("#text-input", "I'm making a crime short film in London.");
      await page.click("#parse-button");
      await page.waitForSelector("#confirm:not([hidden])", { timeout: 90000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    },
    shots: ["viewport"],
    cutouts: [{ name: "confirm", selector: "#confirm" }, { name: "composer", selector: "#run-form" }],
  },
  {
    name: "where",
    path: "/",
    ready: "#text-input",
    prep: async (page) => {
      await page.fill("#text-input", "I'm making a crime short film in the US.");
      await page.click("#where-button");
      await page.waitForSelector(".where-map", { timeout: 150000 });
      await page.waitForTimeout(2500);
    },
    shots: ["viewport"],
    cutouts: [{ name: "map", selector: ".where-map" }, { name: "list", selector: ".where-list" }, { name: "where", selector: "#where" }],
  },
  {
    name: "evidence",
    path: `/run/${RUNS.london}#evidence`,
    ready: "#stage-gap.done, #stage-gap",
    shots: ["viewport", "full"],
    cutouts: [
      { name: "tabs", selector: ".page-tabs" },
      { name: "resolve", selector: "#stage-resolve" },
      { name: "read", selector: "#stage-read" },
      { name: "gap", selector: "#stage-gap" },
      { name: "look", selector: "#stage-look" },
      { name: "trace", selector: "#trace-list" },
    ],
    boxes: [{ key: "stages", selector: "#page-evidence .stage", all: true }, { key: "traceItems", selector: "#trace-list .trace-item", all: true }],
  },
  {
    name: "receipt",
    path: `/run/${RUNS.london}#evidence`,
    ready: "#trace-list .trace-item",
    prep: async (page) => {
      // Open the gap's supply read, the request the zero comes from.
      await page.evaluate(() => {
        const items = [...document.querySelectorAll("#trace-list .trace-item")];
        const pick = items.find((i) => i.dataset.stage === "gap") ?? items[0];
        pick.querySelector("details").open = true;
        pick.scrollIntoView({ block: "center" });
        pick.id = "picked-receipt";
      });
      await page.waitForTimeout(400);
    },
    shots: ["viewport"],
    cutouts: [{ name: "item", selector: "#picked-receipt" }],
  },
  {
    name: "brief",
    path: `/run/${RUNS.london}#brief`,
    ready: "#stage-write",
    shots: ["viewport", "full"],
    cutouts: [
      { name: "write", selector: "#stage-write" },
      { name: "check", selector: "#stage-check" },
      { name: "diff", selector: "#stage-diff" },
      { name: "chips", selector: "#stage-write .q", all: true, max: 6 },
    ],
  },
  {
    name: "make",
    path: `/run/${RUNS.london}#make`,
    ready: "#page-make",
    wait: 3000,
    shots: ["viewport", "full"],
    cutouts: [
      { name: "image", selector: ".concept-image" },
      { name: "deck", selector: ".shot-deck" },
      { name: "voice", selector: ".spoken-pitch" },
    ],
  },
  {
    name: "vegas",
    path: `/run/${RUNS.vegas}#brief`,
    ready: "#stage-write",
    shots: ["viewport"],
    cutouts: [{ name: "write", selector: "#stage-write" }],
  },
  {
    name: "vegas-gap",
    path: `/run/${RUNS.vegas}#evidence`,
    ready: "#stage-gap",
    shots: [],
    cutouts: [{ name: "gap", selector: "#stage-gap" }],
  },
  {
    name: "paris",
    path: `/run/${RUNS.paris}#make`,
    ready: "#page-make",
    wait: 5000,
    shots: ["viewport"],
    cutouts: [{ name: "garment", selector: ".sect.garment" }, { name: "refs", selector: ".sect.refs" }],
  },
  {
    name: "paris-gap",
    path: `/run/${RUNS.paris}#evidence`,
    ready: "#stage-gap",
    shots: [],
    cutouts: [{ name: "gap", selector: "#stage-gap" }],
  },
  {
    name: "paris2",
    path: `/run/${RUNS.paris2}#evidence`,
    ready: "#stage-look",
    shots: [],
    cutouts: [{ name: "look", selector: "#stage-look" }, { name: "gap", selector: "#stage-gap" }],
  },
  {
    name: "paris2-brief",
    path: `/run/${RUNS.paris2}#brief`,
    ready: "#stage-write",
    shots: [],
    cutouts: [{ name: "write", selector: "#stage-write" }, { name: "diff", selector: "#stage-diff" }],
  },
  {
    name: "paris2-make",
    path: `/run/${RUNS.paris2}#make`,
    ready: "#page-make",
    wait: 6000,
    shots: [],
    cutouts: [{ name: "garment", selector: ".sect.garment" }, { name: "refs", selector: ".sect.refs" }],
  },
  {
    name: "paris2-styles",
    path: `/run/${RUNS.paris2}#make`,
    ready: ".garment-tabs button",
    wait: 6000,
    shots: [],
    // One shot of the 3D viewer per style: each tab swaps the garment on the mannequin.
    prep: async (page) => {
      // The tabs redraw on each click, so look them up again every time.
      const count = Math.min(await page.locator(".garment-tabs button").count(), 4);
      for (let i = 0; i < count; i++) {
        await page.locator(".garment-tabs button").nth(i).click();
        await page.waitForTimeout(2000);
        await page.locator(".sect.garment").first().screenshot({ path: `${OUT}/paris2-style${i + 1}.png` });
        console.log(`  captured paris2-style${i + 1}.png`);
      }
    },
    cutouts: [],
  },
  // The Los Angeles drop: every screen the drop-led video uses.
  {
    name: "la-confirm",
    path: "/",
    ready: "#text-input",
    prep: async (page) => {
      await page.fill("#text-input", "I'm making a streetwear drop in Los Angeles.");
      await page.click("#parse-button");
      // The confirm box shows "Finding the city…" first; wait for its pickers.
      await page.waitForSelector("#confirm select", { timeout: 120000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    },
    shots: [],
    cutouts: [{ name: "confirm", selector: "#confirm" }],
  },
  {
    name: "la-evidence",
    path: `/run/${RUNS.la}#evidence`,
    ready: "#stage-gap",
    shots: [],
    cutouts: [
      { name: "tabs", selector: ".page-tabs" },
      { name: "resolve", selector: "#stage-resolve" },
      { name: "read", selector: "#stage-read" },
      { name: "gap", selector: "#stage-gap" },
      { name: "look", selector: "#stage-look" },
      { name: "trace", selector: "#trace-list" },
    ],
  },
  {
    name: "la-receipt",
    path: `/run/${RUNS.la}#evidence`,
    ready: "#trace-list .trace-item",
    prep: async (page) => {
      await page.evaluate(() => {
        const items = [...document.querySelectorAll("#trace-list .trace-item")];
        const pick = items.find((i) => i.dataset.stage === "gap") ?? items[0];
        pick.querySelector("details").open = true;
        pick.id = "picked-receipt";
      });
      await page.waitForTimeout(400);
    },
    shots: [],
    cutouts: [{ name: "item", selector: "#picked-receipt" }],
  },
  {
    name: "la-brief",
    path: `/run/${RUNS.la}#brief`,
    ready: "#stage-write",
    shots: [],
    cutouts: [{ name: "write", selector: "#stage-write" }, { name: "diff", selector: "#stage-diff" }, { name: "chips", selector: "#stage-write .q", all: true, max: 4 }],
    boxes: [{ key: "heads", selector: "#stage-write h3", all: true }],
  },
  {
    name: "la-make",
    path: `/run/${RUNS.la}#make`,
    ready: ".garment-tabs button",
    wait: 6000,
    shots: [],
    prep: async (page) => {
      const count = Math.min(await page.locator(".garment-tabs button").count(), 4);
      for (let i = 0; i < count; i++) {
        await page.locator(".garment-tabs button").nth(i).click();
        await page.waitForTimeout(2500);
        await page.locator(".sect.garment").first().screenshot({ path: `${OUT}/la-style${i + 1}.png` });
        console.log(`  captured la-style${i + 1}.png`);
      }
    },
    cutouts: [{ name: "image", selector: ".concept-image" }],
  },
  // Each other format: its gap card and its brief.
  ...["podcast", "cafe", "night", "novel", "game"].flatMap((key) => [
    { name: `${key}-gap`, path: `/run/${RUNS[key]}#evidence`, ready: "#stage-gap", shots: [], cutouts: [{ name: "gap", selector: "#stage-gap" }] },
    { name: `${key}-brief`, path: `/run/${RUNS[key]}#brief`, ready: "#stage-write", shots: [], cutouts: [{ name: "write", selector: "#stage-write" }] },
  ]),
];

fs.mkdirSync(OUT, { recursive: true });
const layout = fs.existsSync(LAYOUT) ? JSON.parse(fs.readFileSync(LAYOUT, "utf8")) : {};
layout.pageW = 1920;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce" });
await context.route("**/api/mosaic**", (route) => route.fulfill({ contentType: "application/json", body: '{"images":[]}' }));
const page = await context.newPage();

const box = (el) => el.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
});

for (const pg of PAGES) {
  if (only && pg.name !== only) continue;
  await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(pg.ready, { timeout: 120000 });
  // The run page's tab bar is sticky: unstick it, or a tall card's screenshot gets the bar painted over it.
  if (pg.path.startsWith("/run/")) await page.addStyleTag({ content: ".page-tabs { position: static !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(pg.wait ?? 1200);
  if (pg.prep) await pg.prep(page);
  const entry = { pageH: await page.evaluate(() => document.documentElement.scrollHeight), cutouts: {}, boxes: {} };
  layout[pg.name] = entry;

  for (const kind of pg.shots ?? []) {
    if (kind === "viewport") await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${pg.name}-${kind}.png`, fullPage: kind === "full" });
    console.log(`captured ${pg.name}-${kind}`);
  }
  for (const b of pg.boxes ?? []) {
    const els = await page.$$(b.selector);
    entry.boxes[b.key] = await Promise.all(els.slice(0, b.max ?? els.length).map(box));
  }
  for (const c of pg.cutouts ?? []) {
    const els = await page.$$(c.selector);
    const picked = c.all ? els.slice(0, c.max ?? els.length) : els.slice(0, 1);
    if (!picked.length) console.log(`  miss ${pg.name}/${c.name} (${c.selector})`);
    for (let i = 0; i < picked.length; i++) {
      const file = `${pg.name}-${c.name}${c.all ? i + 1 : ""}.png`;
      try {
        await picked[i].scrollIntoViewIfNeeded();
        entry.cutouts[c.all ? `${c.name}${i + 1}` : c.name] = { file, ...(await box(picked[i])) };
        await picked[i].screenshot({ path: `${OUT}/${file}`, omitBackground: !!c.omitBackground });
        console.log(`  captured ${file}`);
      } catch (error) {
        console.log(`  miss ${file}: ${error.message.split("\n")[0]}`);
      }
    }
  }
}

fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
console.log("wrote", LAYOUT);
await browser.close();
