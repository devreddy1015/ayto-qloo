// Stage 2: the three-column read. For each entity type the format needs, the
// same request runs for the city, the country and the contrast city. The theme
// tag is a FILTER (include_tags) and the location is the SIGNAL. Signalling the
// tag instead lets the location swamp it (crime + Hyderabad gave Borat).
import { threeColumns } from "../analysis.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";
import { format, lovesIds, placeLabel, themeTagIds } from "./common.js";

const TITLE = { movie: "films", tv_show: "series", artist: "artists", place: "places", brand: "brands", book: "books", podcast: "podcasts", videogame: "games" };

/**
 * One column, trying the richest request first: theme filter + loves as signals,
 * then the filter alone, then the signals alone, then the location alone. The
 * mode that returned results is recorded so the country and contrast reads
 * use the very same shape.
 */
async function column(q, type, where, filterTags, signals, label) {
  const base = { target_type: type, limit: 20, signal_location: where };
  const attempts = [
    filterTags.length && signals.length ? ["tags+signals", { include_tags: filterTags, signals }] : undefined,
    filterTags.length ? ["tags", { include_tags: filterTags }] : undefined,
    signals.length ? ["signals", { signals }] : undefined,
    ["location", {}],
  ].filter(Boolean);
  for (const [mode, extra] of attempts) {
    const env = await q.tryTool(`${TITLE[type] ?? type} ${mode === "location" ? `${label} favours` : `for this crowd, ${label}`}`, "qloo_recommend", { ...base, ...extra });
    if (env?.results?.length) return { results: env.results, mode, extra };
  }
  return { results: [], mode: "none", extra: {} };
}

export async function read(run) {
  const q = evidenceFor(run, "read");
  const f = format(run);
  const r = run.stages.resolve.output;
  const themeIds = themeTagIds(run);
  const signals = lovesIds(run);
  const fashionIds = (r.fashionTags ?? []).map((t) => t.id);
  const cityWhere = placeLabel(r.city);
  const countryWhere = r.city.market ?? r.city.country;
  const contrastWhere = r.contrast ? placeLabel(r.contrast) : undefined;

  const columns = {};
  await Promise.all(
    f.types.map(async (type) => {
      // Brands in a fashion run are filtered to Qloo's fashion categories; everything else uses the theme tags.
      const filterTags = type === "brand" && fashionIds.length ? fashionIds : themeIds;
      const city = await column(q, type, cityWhere, filterTags, signals, `in ${r.city.name}`);
      // The country and contrast reads use the same shape the city read ended up with, so the lists are comparable.
      const sameAs = city.extra;
      const [country, contrast] = await Promise.all([
        q.tryTool(`Same read for ${countryWhere}`, "qloo_recommend", { target_type: type, limit: 20, ...sameAs, signal_location: countryWhere }),
        contrastWhere ? q.tryTool(`Same read for ${r.contrast.name} (contrast)`, "qloo_recommend", { target_type: type, limit: 20, ...sameAs, signal_location: contrastWhere }) : Promise.resolve(undefined),
      ]);
      const rows = threeColumns(city.results, country?.results ?? [], contrast?.results ?? []);
      for (const row of rows) {
        registerEntity(run, { id: row.id, name: row.name, type, source: "recommend" });
        registerName(run, row.name, type, { id: row.id });
      }
      columns[type] = {
        type,
        filter: city.mode,
        rows,
        countryNames: (country?.results ?? []).slice(0, 20).map((x) => x.name),
        contrastNames: (contrast?.results ?? []).slice(0, 20).map((x) => x.name),
        onlyHere: rows.filter((x) => x.onlyHere).map((x) => x.name),
        hiddenGems: rows.filter((x) => x.hiddenGem).map((x) => x.name),
        coverage: rows.length === 0 ? "none" : rows.length < 8 ? "thin" : "ok",
      };
    }),
  );
  const only = Object.values(columns).reduce((n, c) => n + c.onlyHere.length, 0);
  const gems = Object.values(columns).reduce((n, c) => n + c.hiddenGems.length, 0);
  return { columns, city: r.city.name, country: countryWhere, contrast: r.contrast?.name, summary: `${only} picks ${r.city.name} favours that the country doesn't, ${gems} hidden gems.` };
}
