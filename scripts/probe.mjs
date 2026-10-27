// Explore what the Qloo hackathon API returns for the calls Culture Gap relies on.
// Usage: node scripts/probe.mjs [step ...]
// Writes each response to probe-out/ (git-ignored: Qloo data must not be published).
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../src/config.js";
import { closeQloo, qlooInsights, qlooStatus, qlooTool } from "../src/qloo.js";

const out = new URL("../probe-out/", import.meta.url);
await mkdir(out, { recursive: true });

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(today.getTime() - n * 864e5));

const steps = {
  status: () => qlooStatus(),
  tags_fashion: () => qlooTool("qloo_find_tags", { query: "fashion clothing brand", limit: 15 }),
  tags_streetwear: () => qlooTool("qloo_find_tags", { query: "streetwear", limit: 15 }),
  tags_apparel: () => qlooTool("qloo_find_tags", { query: "apparel retailer", limit: 15 }),
  describe_wave: () => qlooTool("qloo_describe", { entity: "Squid Game", type: "tv_show" }),
  wave_tags: () => qlooTool("qloo_entity_tags", { entities: ["Squid Game"], entity_type: "tv_show", limit: 20 }),
  wave_trend: () =>
    qlooTool("qloo_trends", {
      entities: ["Squid Game"],
      entity_type: "tv_show",
      start_date: daysAgo(180),
      end_date: daysAgo(2),
      limit: 20,
    }),
  brands_india: () =>
    qlooTool("qloo_recommend", { target_type: "brand", signals: ["Squid Game"], signal_location: "India", limit: 20 }),
  brands_us: () =>
    qlooTool("qloo_recommend", {
      target_type: "brand",
      signals: ["Squid Game"],
      signal_location: "United States",
      limit: 20,
    }),
  heat_wave_india: () => qlooTool("qloo_where_popular", { entity: "Squid Game", entity_type: "tv_show", within: "India", limit: 20 }),
  heat_city_raw: async () => {
    const d = await qlooTool("qloo_describe", { entity: "Squid Game", type: "tv_show" });
    const id = d.results?.[0]?.entity_id;
    return qlooInsights({
      "filter.type": "urn:heatmap",
      "signal.interests.entities": id,
      "filter.location.query": "India",
      "output.heatmap.boundary": "city",
      take: 50,
    });
  },
  artist_trend: () =>
    qlooTool("qloo_trends", {
      entities: ["NewJeans", "Diljit Dosanjh"],
      entity_type: "artist",
      start_date: daysAgo(180),
      end_date: daysAgo(2),
      limit: 20,
    }),
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(steps);
console.log(`mode=${config.mode} key=${config.hasQlooKey ? "set" : "missing"} base=${process.env.QLOO_BASE_URL}`);
for (const name of wanted) {
  const started = Date.now();
  try {
    const value = await steps[name]();
    await writeFile(new URL(`${name}.json`, out), JSON.stringify(value, null, 2));
    const count = value?.result_count ?? value?.results?.length ?? value?.results?.entities?.length ?? "";
    console.log(`ok   ${name} (${Date.now() - started}ms) status=${value?.status ?? "-"} n=${count}`);
  } catch (error) {
    console.log(`FAIL ${name}: ${error.code ?? ""} ${error.message}`);
  }
}
await closeQloo();
