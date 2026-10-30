// The public server under abuse: a run changes only for whoever started it (anyone else gets a copy), the only
// edit is a lane order rebuilt from the run, a route that throws answers 500 and the server stays up, runs cut off
// by a restart say so, and keys never leak through errors.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-server-test-${process.pid}`;
process.env.PORT = String(20000 + (process.pid % 20000));
process.env.SCANS_PER_IP_PER_HOUR = "100";
process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";

let base;
let server;

before(async () => {
  ({ server } = await import("../src/server.js"));
  await new Promise((r) => (server.listening ? r() : server.once("listening", r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

const call = async (method, path, body, headers = {}) => {
  const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
};

async function finished(id) {
  for (let i = 0; i < 200; i += 1) {
    const { json } = await call("GET", `/api/runs/${id}`);
    if (json?.status && json.status !== "running") return json;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`run ${id} never finished`);
}

// First: the slug index is built from disk once per process, on the first share page asked for.
test("a share slug belongs to the run that published it, not to a plan that mentions it", async () => {
  const { findRunBySlug } = await import("../src/pipeline/store.js");
  const dir = join(process.env.CACHE_DIR, "runs");
  await mkdir(dir, { recursive: true });
  // The impostor's plan mentions the victim's slug before its own publish block; the files are only on disk.
  await writeFile(join(dir, "r_aaimpost.json"), JSON.stringify({ id: "r_aaimpost", stages: { write: { output: { plan: { slug: "victim-page-abcde" } } } }, publish: { slug: "impostor-page-fghij" } }));
  await writeFile(join(dir, "r_zzvictim.json"), JSON.stringify({ id: "r_zzvictim", stages: {}, publish: { slug: "victim-page-abcde" } }));
  assert.equal((await findRunBySlug("victim-page-abcde"))?.id, "r_zzvictim");
  assert.equal((await findRunBySlug("impostor-page-fghij"))?.id, "r_aaimpost");
});

test("a lane edit changes the owner's run; anyone else gets a copy and the original stays", async () => {
  const started = await call("POST", "/api/runs", { showcase: "london-crime-film" });
  assert.equal(started.status, 201);
  assert.ok(started.json.editKey, "the starter gets an edit key");
  const run = await finished(started.json.id);
  assert.equal(run.status, "done");
  assert.equal(run.editKey, undefined, "the key never goes out with the run");
  const lanes = run.stages.gap.output.lanes.map((l) => l.name);
  assert.ok(lanes.length >= 2);

  // A stranger: no key. The edit lands on a new run; the original's lanes don't move.
  const stranger = await call("POST", `/api/runs/${run.id}/edit`, { stage: "gap", lane: lanes[1] });
  assert.equal(stranger.status, 200, stranger.text);
  assert.ok(stranger.json.forked?.id && stranger.json.forked.id !== run.id);
  assert.ok(stranger.json.forked.editKey);
  const copy = await finished(stranger.json.forked.id);
  assert.equal(copy.status, "done");
  assert.equal(copy.forkedFrom, run.id);
  assert.equal(copy.stages.gap.output.lanes[0].name, lanes[1]);
  assert.notEqual(copy.publish.slug, run.publish.slug, "the copy publishes its own page");
  const untouched = await call("GET", `/api/runs/${run.id}`);
  assert.deepEqual(untouched.json.stages.gap.output.lanes.map((l) => l.name), lanes);

  // The owner: with the key, the run itself changes.
  const owner = await call("POST", `/api/runs/${run.id}/edit`, { stage: "gap", lane: lanes[1], editKey: started.json.editKey });
  assert.equal(owner.status, 200, owner.text);
  assert.equal(owner.json.forked, undefined);
  const changed = await finished(run.id);
  assert.equal(changed.stages.gap.output.lanes[0].name, lanes[1]);
  assert.match(changed.stages.gap.output.summary, /your pick/);
});

test("only the lane order can be edited, and only to one of the run's own lanes", async () => {
  const started = await call("POST", "/api/runs", { showcase: "vegas-reel" });
  const run = await finished(started.json.id);
  const key = started.json.editKey;
  for (const body of [
    { stage: "write", edits: { plan: { cast_ideas: "x", beats: "x", logline: "DEFACED" } } },
    { stage: "share", edits: { url: "javascript:alert(1)" } },
    { stage: "gap", edits: { lanes: [{ name: "Made Up Lane" }] } },
    { stage: "gap", lane: { toString: "x" } },
  ]) {
    const r = await call("POST", `/api/runs/${run.id}/edit`, { ...body, editKey: key });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  // The old request shape still works: the first lane's name is all that is read.
  const lanes = run.stages.gap.output.lanes;
  const r = await call("POST", `/api/runs/${run.id}/edit`, { stage: "gap", edits: { lanes: [{ ...lanes[1], name: lanes[1].name, why: "<b>typed</b>" }], summary: "typed" }, editKey: key });
  assert.equal(r.status, 200, r.text);
  const after = await finished(run.id);
  assert.equal(after.stages.gap.output.summary, `Lane 1: ${lanes[1].name} (your pick).`);
  assert.ok(!JSON.stringify(after.stages.gap.output).includes("<b>typed</b>"));
  assert.equal((await call("GET", "/api/gallery")).status, 200);
});

test("a route that throws answers 500 and the server stays up", async () => {
  // A run on disk with a plan the share page can't render (as an old bug could leave behind).
  const dir = join(process.env.CACHE_DIR, "runs");
  await mkdir(dir, { recursive: true });
  // A fashion page whose allocation isn't a list: the page's renderer throws on it.
  const bad = { id: "r_badplan", status: "done", input: { format: "fashion" }, plan: ["write"], stages: { write: { status: "done", output: { plan: {} } } }, publish: { slug: "bad-plan-zzzzz", url: "/s/bad-plan-zzzzz", page: { format: "fashion", city: "X", plan: {}, produce: { mrp: 499, totalUnits: 10, allocation: "oops" } } }, ledger: [], events: [] };
  const { saveRun } = await import("../src/pipeline/store.js");
  await saveRun(bad);
  const page = await call("GET", "/s/bad-plan-zzzzz");
  assert.equal(page.status, 500, `got ${page.status}: the renderer should have thrown`);
  assert.ok(!page.text.includes("TypeError"), "no stack to the browser");
  assert.equal((await call("GET", "/api/presets")).status, 200, "still serving");
});

test("a run cut off by a restart says so instead of saying it is running", async () => {
  const dir = join(process.env.CACHE_DIR, "runs");
  await mkdir(dir, { recursive: true });
  const cut = { id: "r_cutoff1", status: "running", input: { format: "film" }, plan: ["resolve", "read"], stages: { resolve: { status: "done", output: {} }, read: { status: "running" } }, ledger: [], events: [] };
  await writeFile(join(dir, "r_cutoff1.json"), JSON.stringify(cut));
  const r = await call("GET", "/api/runs/r_cutoff1");
  assert.equal(r.json.status, "error");
  assert.equal(r.json.stages.read.status, "error");
  assert.match(r.json.stages.read.error, /restarted/);
});

test("MCP takes one message per request", async () => {
  const r = await call("POST", "/mcp", [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ayto_read_city", arguments: {} } }], { accept: "application/json, text/event-stream" });
  assert.equal(r.status, 400);
});

test("keys never leak: control characters are refused and the redactor catches bearer and 32-character keys", async () => {
  const { credentialFrom, redact } = await import("../src/llm.js");
  assert.throws(() => credentialFrom({ provider: "mistral", key: "FAKEsecretPART1\u0000x" }), /doesn't look right/);
  const bearer = redact("authorization: Bearer abcdefghijklmnop123");
  assert.ok(!bearer.includes("abcdefghijklmnop123"), bearer);
  for (const k of ["Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z", "123e4567-e89b-12d3-a456-426614174000"]) assert.ok(!redact(`bad key ${k} here`).includes(k), k);
  assert.equal(redact("Qloo returned 400: unsupported parameter"), "Qloo returned 400: unsupported parameter");
  const r = await call("POST", "/api/runs", { showcase: "vegas-reel", llm: { provider: "mistral", key: "FAKEsecretPART1\u0000x" } });
  assert.equal(r.status, 400);
  assert.ok(!r.text.includes("FAKEsecret"));
});

test("limits count the visitor the proxy names, and a forged X-Forwarded-For doesn't reset them", async () => {
  // The key-check route allows 20 an hour and answers an empty request 400 without calling anyone.
  const check = (headers) => call("POST", "/api/llm/check", {}, headers).then((r) => r.status);
  for (let i = 0; i < 20; i += 1) assert.equal(await check({ "cf-connecting-ip": "203.0.113.5" }), 400);
  assert.equal(await check({ "cf-connecting-ip": "203.0.113.5" }), 429);
  assert.equal(await check({ "cf-connecting-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }), 429);
  assert.equal(await check({ "cf-connecting-ip": "203.0.113.6" }), 400, "another visitor has their own count");
});

test("every response forbids sniffing and framing", async () => {
  for (const path of ["/", "/api/health", "/s/no-such-page"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(res.headers.get("x-frame-options"), "DENY", path);
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/, path);
  }
});
