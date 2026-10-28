// Stage 2: the three-column read. For each entity type the format needs, the
// same request runs for the city, the country and the contrast city. The theme
// tag is a FILTER (include_tags) and the location is the SIGNAL. Signalling the
// tag instead lets the location swamp it (crime + Hyderabad gave Borat).
import { threeColumns } from "../analysis.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";
import { format, lovesIds, placeLabel, themeTagIds } from "./common.js";

const TITLE = { movie: "films", tv_show: "series", artist: "artists", place: "places", brand: "brands", book: "books", podcast: "podcasts", videogame: "games", person: "people" };

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
  const filterIds = Object.fromEntries(Object.entries(r.filters ?? {}).map(([type, tags]) => [type, tags.map((t) => t.id)]));
  const cityWhere = placeLabel(r.city);
  const countryWhere = r.city.market ?? r.city.country;
  const contrastWhere = r.contrast ? placeLabel(r.contrast) : undefined;

  const columns = {};
  await Promise.all(
    f.types.map(async (type) => {
      // Places are local by nature, and Qloo's place index with category tags signalled at country scope is far too slow
      // (90 s timeouts for Spain). Read venues inside the city instead, with no country or contrast column.
      if (type === "place") {
        const tagIds = filterIds.place?.length ? filterIds.place : themeIds;
        const base = { target_type: "place", limit: 20, filter_location: cityWhere };
        // Richest first: category tags with the loves as signals; then the city itself as the taste signal; then plain venues in the city.
        const attempts = [
          tagIds.length && signals.length ? ["by category, for the loves", { include_tags: tagIds, signals }] : undefined,
          tagIds.length ? ["by category", { include_tags: tagIds, signal_location: cityWhere }] : undefined,
          signals.length ? ["for the loves", { signals }] : undefined,
          ["within the city", { signal_location: cityWhere }],
        ].filter(Boolean);
        let env;
        let mode = "none";
        for (const [label, extra] of attempts) {
          env = await q.tryTool(`places in ${r.city.name}, ${label}`, "qloo_recommend", { ...base, ...extra });
          if (env?.results?.length) {
            mode = label;
            break;
          }
        }
        const rows = threeColumns(env?.results ?? [], [], []).map((x) => ({ ...x, onlyHere: false, notCountry: undefined, notContrast: undefined }));
        for (const row of rows) {
          registerEntity(run, { id: row.id, name: row.name, type, source: "recommend" });
          registerName(run, row.name, type, { id: row.id });
        }
        columns.place = { type, filter: mode, rows, countryNames: [], contrastNames: [], onlyHere: [], hiddenGems: rows.filter((x) => x.hiddenGem).map((x) => x.name), coverage: rows.length === 0 ? "none" : rows.length < 8 ? "thin" : "ok" };
        return;
      }
      // A type with a category filter for this format (fashion brands, café places) uses it; everything else uses the theme tags.
      const filterTags = filterIds[type]?.length ? filterIds[type] : themeIds;
      // The country and contrast reads must use the same request shape as the city read so the lists are comparable.
      // They start at once with the richest shape; only if the city read had to fall back are they run again.
      const guess = filterTags.length && signals.length ? { include_tags: filterTags, signals } : filterTags.length ? { include_tags: filterTags } : signals.length ? { signals } : {};
      const others = (extra) =>
        Promise.all([
          q.tryTool(`Same read for ${countryWhere}`, "qloo_recommend", { target_type: type, limit: 20, ...extra, signal_location: countryWhere }),
          contrastWhere ? q.tryTool(`Same read for ${r.contrast.name} (contrast)`, "qloo_recommend", { target_type: type, limit: 20, ...extra, signal_location: contrastWhere }) : Promise.resolve(undefined),
        ]);
      const [city, firstOthers] = await Promise.all([column(q, type, cityWhere, filterTags, signals, `in ${r.city.name}`), others(guess)]);
      const [country, contrast] = JSON.stringify(city.extra) === JSON.stringify(guess) ? firstOthers : await others(city.extra);
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
