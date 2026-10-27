// Run every example scan against live Qloo and save the responses to samples/qloo/
// so the app can replay them (CULTURE_GAP_MODE=samples) when the key or quota is
// unavailable. samples/qloo/ is git-ignored: Qloo data must not be published.
// Usage: node scripts/record-samples.mjs [example-id ...]
process.env.RECORD_SAMPLES = "1";
const { runScan } = await import("../src/agent.js");
const { EXAMPLES } = await import("../src/presets.js");
const { closeQloo } = await import("../src/qloo.js");

const ids = process.argv.slice(2);
for (const example of EXAMPLES.filter((e) => !ids.length || ids.includes(e.id))) {
  const started = Date.now();
  let calls = 0;
  let failed = 0;
  try {
    const report = await runScan(example, (event) => {
      if (event.type === "call" && event.status === "done") calls += 1;
      if (event.type === "call" && event.status === "error") {
        failed += 1;
        console.log(`   ! ${event.title}: ${event.error}`);
      }
    });
    const summary = report.markets
      .map((m) => `${m.market}: ${m.brands.length} brands, ${m.gap.length} places, ${m.gap.filter((g) => g.signal === "opportunity").length} gaps`)
      .join(" | ");
    console.log(`ok   ${example.id} (${calls} calls, ${failed} failed, ${((Date.now() - started) / 1000).toFixed(1)}s)\n     ${summary}\n     brief: ${report.brief.headline}`);
  } catch (error) {
    console.log(`FAIL ${example.id}: ${error.message}`);
  }
}
await closeQloo();
