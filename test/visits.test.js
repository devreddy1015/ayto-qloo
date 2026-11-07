// The visit counter: one log line per page a person opens and per run started, so a log search counts them after
// the free host's restarts. The lines say what kind of page or run it was and nothing about who: no address, no
// user agent, no sentence the maker typed.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-visits-test-${process.pid}`;
process.env.PORT = String(22000 + (process.pid % 20000));
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";
import { looksLikeCrawler, pageKind, runLine, visitLine } from "../src/visits.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";

test("only the three pages a person opens count: home, a run and a share page", () => {
  assert.equal(pageKind("/"), "home");
  assert.equal(pageKind("/index.html"), "home");
  assert.equal(pageKind("/run/r_vswzY-c"), "run");
  assert.equal(pageKind("/s/quiet-hour-fvl0s"), "share");
  assert.equal(pageKind("/s/quiet-hour-fvl0s.md"), "share");
  for (const other of ["/app.js", "/styles.css", "/api/runs", "/api/health", "/run/r_x/extra", "/s/", "/mcp", "/favicon.ico"]) assert.equal(pageKind(other), null, other);
});

test("a visit line names the page and flags a crawler, and nothing else", () => {
  assert.equal(visitLine("GET", "/", CHROME), "visit home");
  assert.equal(visitLine("GET", "/run/r_abc", "LinkedInBot/1.0 (compatible; Mozilla/5.0)"), "visit run (crawler)");
  assert.equal(visitLine("GET", "/s/a-page", ""), "visit share (crawler)", "no user agent at all is not a person's browser");
  assert.equal(visitLine("HEAD", "/", CHROME), null, "uptime checks don't count");
  assert.equal(visitLine("POST", "/", CHROME), null);
  assert.equal(visitLine("GET", "/app.js", CHROME), null);
  for (const ua of [CHROME, "curl/8.9.1", "Mozilla/5.0 (compatible; Googlebot/2.1)", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 HeadlessChrome/156.0"]) {
    const line = visitLine("GET", "/run/r_abc", ua);
    assert.match(line, /^visit (home|run|share)( \(crawler\))?$/, ua);
    assert.ok(!line.includes(ua), "the user agent never reaches the log");
  }
  assert.equal(looksLikeCrawler(CHROME), false);
  assert.equal(looksLikeCrawler("facebookexternalhit/1.1"), true);
});

test("a run line says the format and whether it was a showcase, never what was typed", () => {
  assert.equal(runLine({ format: "film", text: "I'm making a crime short film in London." }, "london-crime-film"), "run started film (showcase london-crime-film)");
  assert.equal(runLine({ format: "reel", text: "My name is Asha and I live at 4 Park Road" }), "run started reel (typed)");
  assert.equal(runLine({ format: "../../etc" }), "run started unknown (typed)", "only a plain format name is written");
  assert.equal(runLine(undefined), "run started unknown (typed)");
});

// ---------- in the running server ----------

let server;
let base;
const lines = [];
const realLog = console.log;

before(async () => {
  console.log = (...args) => {
    lines.push(args.join(" "));
    realLog(...args);
  };
  ({ server } = await import("../src/server.js"));
  await new Promise((r) => (server.listening ? r() : server.once("listening", r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  console.log = realLog;
  await new Promise((r) => server.close(r));
  const { closeQloo } = await import("../src/qloo.js");
  await closeQloo?.();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

test("the server logs a line for each page opened and each run started, and none for scripts or data", async () => {
  const headers = { "user-agent": CHROME };
  lines.length = 0;
  await (await fetch(`${base}/`, { headers })).text();
  await (await fetch(`${base}/app.js`, { headers })).text();
  await (await fetch(`${base}/api/presets`, { headers })).text();
  const started = await fetch(`${base}/api/runs`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ showcase: "london-crime-film" }) });
  const { id } = await started.json();
  await (await fetch(`${base}/run/${id}`, { headers })).text();
  await (await fetch(`${base}/api/runs`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ text: "I'm making a crime short film in London. Call me on 555 0100." }) })).text();
  const counted = lines.filter((l) => /^(visit|run started) /.test(l));
  assert.deepEqual(counted, ["visit home", "run started film (showcase london-crime-film)", "visit run", "run started film (typed)"]);
  assert.ok(!lines.some((l) => l.includes("555 0100") || l.includes("127.0.0.1") || l.includes("Chrome/")), "no typed text, address or user agent in the log");
});
