// Run every showcase against live Qloo and save the responses to samples/qloo/
// so the app can replay them (CULTURE_GAP_MODE=samples) when the key or quota is
// unavailable. samples/qloo/ is git-ignored: Qloo data must not be published.
// Usage: node scripts/record-samples.mjs [showcase-id ...]
process.env.RECORD_SAMPLES = "1";
const { parseInput } = await import("../src/parse.js");
const { createRun, startRun } = await import("../src/pipeline/runner.js");
const { SHOWCASES } = await import("../src/presets.js");
const { closeQloo } = await import("../src/qloo.js");

const ids = process.argv.slice(2);
for (const showcase of SHOWCASES.filter((s) => !ids.length || ids.includes(s.id))) {
  const started = Date.now();
  try {
    const run = await createRun(await parseInput(showcase), { showcase: showcase.id });
    await startRun(run, 0);
    const failed = run.ledger.filter((c) => c.status === "error").length;
    console.log(`${run.status === "done" ? "ok  " : "FAIL"} ${showcase.id} (${run.ledger.length} calls, ${failed} failed, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
    for (const id of run.plan) console.log(`     ${id.padEnd(9)} ${run.stages[id].status.padEnd(6)} ${run.stages[id].output?.summary ?? run.stages[id].error ?? ""}`);
  } catch (error) {
    console.log(`FAIL ${showcase.id}: ${error.message}`);
  }
}
await closeQloo();
