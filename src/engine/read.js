// Stage 2: the three-column read. For each entity type the format needs, the
// same request runs for the city, the country and the contrast city. The theme
// tag is a FILTER (include_tags) and the location is the SIGNAL. Signalling the
// tag instead lets the location swamp it (crime + Hyderabad gave Borat).
import { threeColumns } from "../analysis.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";
import { qlooEntities } from "../qloo.js";
import { format, lovesIds, placeLabel, themeTagIdsFor, themeTagOptions } from "./common.js";

const TITLE = { movie: "films", tv_show: "series", artist: "artists", place: "places", brand: "brands", book: "books", podcast: "podcasts", videogame: "games", person: "people" };

/**
 * One column, trying the richest request first: theme filter + loves as signals,
 * then the filter alone, then the signals alone, then the location alone. The
 * mode that returned results is recorded so the country and contrast reads
 * use the very same shape.
 */
async function column(q, type, where, filterTags, signals, label, alternatives = []) {
  const base = { target_type: type, limit: 20, signal_location: where };
  // The first theme filter, then the theme's other tags for this kind (one per tag family, up to five), before
  // giving the theme up. Empty answers are cheap: they are kept in memory for ten minutes.
  const filters = [filterTags, ...alternatives.filter((o) => o.join() !== filterTags.join())].filter((o) => o.length).slice(0, 5);
  const attempts = [
    ...filters.flatMap((tags) => [signals.length ? ["tags+signals", { include_tags: tags, signals }] : undefined, ["tags", { include_tags: tags }]]),
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
        const tagIds = filterIds.place?.length ? filterIds.place : themeTagIdsFor(run, "place");
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
      const filterTags = filterIds[type]?.length ? filterIds[type] : themeTagIdsFor(run, type);
      // The country and contrast reads must use the same request shape as the city read so the lists are comparable.
      // They start at once with the richest shape; only if the city read had to fall back are they run again.
      const guess = filterTags.length && signals.length ? { include_tags: filterTags, signals } : filterTags.length ? { include_tags: filterTags } : signals.length ? { signals } : {};
      const others = (extra) =>
        Promise.all([
          q.tryTool(`Same read for ${countryWhere}`, "qloo_recommend", { target_type: type, limit: 20, ...extra, signal_location: countryWhere }),
          contrastWhere ? q.tryTool(`Same read for ${r.contrast.name} (contrast)`, "qloo_recommend", { target_type: type, limit: 20, ...extra, signal_location: contrastWhere }) : Promise.resolve(undefined),
        ]);
      const alternatives = filterIds[type]?.length ? [] : themeTagOptions(run, type);
      const [city, firstOthers] = await Promise.all([column(q, type, cityWhere, filterTags, signals, `in ${r.city.name}`, alternatives), others(guess)]);
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
        // False when the country read failed or came back empty: no row can then be "not in the country".
        baseline: Boolean(country?.results?.length),
        countryNames: (country?.results ?? []).slice(0, 20).map((x) => x.name),
        contrastNames: (contrast?.results ?? []).slice(0, 20).map((x) => x.name),
        onlyHere: rows.filter((x) => x.onlyHere).map((x) => x.name),
        hiddenGems: rows.filter((x) => x.hiddenGem).map((x) => x.name),
        coverage: rows.length === 0 ? "none" : rows.length < 8 ? "thin" : "ok",
      };
    }),
  );
  await seedOffTheme(q, run, f, r, columns, { cityWhere, countryWhere, contrastWhere });
  await markDeaths(q, columns.person);
  await latinNames(q, run, columns);
  const only = Object.values(columns).reduce((n, c) => n + c.onlyHere.length, 0);
  const gems = Object.values(columns).reduce((n, c) => n + c.hiddenGems.length, 0);
  const unread = Object.values(columns).filter((c) => c.baseline === false).map((c) => c.type.replace("_", " "));
  const note = unread.length ? ` Qloo's ${countryWhere} read came back empty for ${unread.join(", ")}, so nothing there is marked as only here.` : "";
  return { columns, city: r.city.name, country: countryWhere, contrast: r.contrast?.name, summary: `${only} pick${only === 1 ? "" : "s"} ${r.city.name} favours that the country doesn't, ${gems} hidden gem${gems === 1 ? "" : "s"}.${note}` };
}

const looseName = (n) => String(n ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
// Kinds of title a seed can be searched for, or taken from. People are seeded from them; music never is:
// a song or playlist should follow the city's own taste, and a seed from brands or games pulled it abroad.
const CONTENT = ["movie", "tv_show", "book", "podcast", "videogame"];
const SEEDABLE = [...CONTENT, "person"];

/**
 * A section the theme cannot filter falls back to the city's general favourites, which are off the theme
 * (a horror film's "cast" was a quarterback and a senator; a cricket game's games were fitness titles).
 * Such a section is read again with a seed, in two passes:
 *   1. films, series, books, podcasts and games: Qloo's search for the theme in that kind, keeping only hits
 *      whose name or description carries the theme (cricket films, startup podcasts, hip hop films);
 *   2. what is left, people included: the top picks of a section that is now on the theme
 *      ("people who love these horror films", "people who love these startup podcasts").
 * The country and contrast use the same seed, so the columns still compare. Music keeps the city's taste.
 */
async function seedOffTheme(q, run, f, r, columns, { cityWhere, countryWhere, contrastWhere }) {
  const word = String(r.theme?.words?.[0] ?? r.theme?.query ?? "").trim();
  const phrase = word.toLowerCase().replace(/\s+/g, " ");
  const offTheme = (t) => SEEDABLE.includes(t) && columns[t] && ["location", "none"].includes(columns[t].filter);
  // A source is a section on the theme: a title section read any way but the city alone, or a music section
  // the theme tag itself filtered (Chennai's hip hop artists can seed its hip hop films).
  const onTheme = (c) => c && c.rows.length && ((CONTENT.includes(c.type) && !["location", "none"].includes(c.filter)) || (c.type === "artist" && String(c.filter).startsWith("tags")));
  const reseed = async (type, seed) => {
    const ask = (where, title) => q.tryTool(title, "qloo_recommend", { target_type: type, limit: 20, signals: seed.ids, signal_location: where });
    const label = seed.kind === "picks" ? `the ${TITLE[seed.from] ?? seed.from} this read found` : `Qloo's search for “${seed.word}”`;
    const [city, country, contrast] = await Promise.all([
      ask(cityWhere, `${TITLE[type] ?? type} in ${r.city.name}, seeded by ${label}`),
      ask(countryWhere, `Same seeded read for ${countryWhere}`),
      contrastWhere ? ask(contrastWhere, `Same seeded read for ${r.contrast.name} (contrast)`) : Promise.resolve(undefined),
    ]);
    if (!city?.results?.length) return;
    const rows = threeColumns(city.results, country?.results ?? [], contrast?.results ?? []);
    for (const row of rows) {
      registerEntity(run, { id: row.id, name: row.name, type, source: "recommend" });
      registerName(run, row.name, type, { id: row.id });
    }
    columns[type] = {
      type,
      filter: "seeded",
      seed: { kind: seed.kind, from: seed.from, word: seed.word, names: seed.names },
      rows,
      countryNames: (country?.results ?? []).slice(0, 20).map((x) => x.name),
      contrastNames: (contrast?.results ?? []).slice(0, 20).map((x) => x.name),
      onlyHere: rows.filter((x) => x.onlyHere).map((x) => x.name),
      hiddenGems: rows.filter((x) => x.hiddenGem).map((x) => x.name),
      coverage: rows.length === 0 ? "none" : rows.length < 8 ? "thin" : "ok",
    };
  };
  // Pass 1: titles found by searching for the theme in their own kind.
  if (phrase) {
    await Promise.all(
      f.types.filter((t) => CONTENT.includes(t) && offTheme(t)).map(async (type) => {
        const env = await q.trySearch(`${TITLE[type] ?? type} about “${word}” in Qloo`, { query: word, type, take: 10 });
        // "hip-hop" in a description is "hip hop": both sides reduced to words.
        const words = (t) => ` ${String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
        const about = (x) => words(`${x.name} ${x.properties?.description ?? x.properties?.short_description ?? ""}`).includes(words(phrase));
        const hits = (env?.results ?? []).filter((x) => x?.entity_id && looseName(x.name) !== looseName(word) && about(x)).slice(0, 5);
        if (hits.length >= 2) await reseed(type, { ids: hits.map((x) => x.entity_id), kind: "search", word, names: hits.map((x) => x.name) });
      }),
    );
  }
  // Pass 2: the rest, from the top picks of a section that is on the theme now.
  await Promise.all(
    f.types.filter(offTheme).map(async (type) => {
      const from = [...CONTENT, "artist"].map((t) => columns[t]).find((c) => c?.type !== type && onTheme(c));
      if (!from) return;
      const picks = [...from.rows.filter((x) => x.onlyHere), ...from.rows.filter((x) => !x.onlyHere)].slice(0, 5);
      await reseed(type, { ids: picks.map((x) => x.id), kind: "picks", from: from.type, names: picks.map((x) => x.name) });
    }),
  );
}

/**
 * Recommendation results carry no death date, so the top people are looked up once on /entities and
 * marked. They stay in the read (they are part of the taste) but never reach a cast or guest list.
 */
async function markDeaths(q, column) {
  const ids = (column?.rows ?? []).slice(0, 10).map((x) => x.id).filter(Boolean);
  if (!ids.length) return;
  const env = await q.tryStep("Check the top people for a date of death (cast lists skip them)", "qloo api entities", { ids }, async () => ({ results: (await qlooEntities(ids)).results ?? [], provenance: { source: "Qloo API", endpoint: "/entities", requests: [{ method: "GET", path: "/entities", query: { entity_ids: ids } }] } }));
  const died = new Map((env?.results ?? []).filter((e) => e?.properties?.date_of_death).map((e) => [e.entity_id ?? e.id, e.properties.date_of_death]));
  for (const row of column.rows) if (died.has(row.id)) row.died = died.get(row.id);
}

const LATIN = (v) => Boolean(v) && !/[^\u0000-\u024F\u1E00-\u1EFF\s\d\p{P}\p{S}]/u.test(v);

/**
 * Recommendation results carry no aliases, so a name in another script (劉亦菲) would show as is to a reader
 * who can't read it. Up to ten such names are looked up once on /entities and shown by their English (else
 * Latin-script) alias; Qloo's own name is kept as qlooName and both are known names for the check.
 */
export async function latinNames(q, run, columns) {
  const rows = Object.values(columns).flatMap((c) => c.rows).filter((x) => !LATIN(x.name)).slice(0, 10);
  if (!rows.length) return;
  const ids = [...new Set(rows.map((x) => x.id))];
  const env = await q.tryStep("English names for names in another script", "qloo api entities", { ids }, async () => ({ results: (await qlooEntities(ids)).results ?? [], provenance: { source: "Qloo API", endpoint: "/entities", requests: [{ method: "GET", path: "/entities", query: { entity_ids: ids } }] } }));
  const alias = new Map(
    (env?.results ?? []).map((e) => {
      const akas = e?.properties?.akas ?? [];
      return [e.entity_id ?? e.id, akas.find((a) => a?.language === "en" && LATIN(a.value))?.value ?? akas.find((a) => LATIN(a?.value))?.value];
    }),
  );
  for (const c of Object.values(columns)) {
    for (const row of c.rows) {
      const en = alias.get(row.id);
      if (!en || LATIN(row.name)) continue;
      row.qlooName = row.name;
      row.name = en;
      registerName(run, en, c.type, { id: row.id });
    }
    c.onlyHere = c.rows.filter((x) => x.onlyHere).map((x) => x.name);
    c.hiddenGems = c.rows.filter((x) => x.hiddenGem).map((x) => x.name);
  }
}
