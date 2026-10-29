// Stage: the look. The visual words a city leans to, read from Qloo's own tag
// families rather than invented by a model.
//   fashion: aesthetic and personal-style tag lift (city vs country), materials,
//            age groups and segments counted on the city's fashion labels vs the
//            country's, the labels themselves, and the loves' own style motifs.
//   film:    style-tag lift between the city's themed catalogue and the country's,
//            plus Qloo's style descriptions of the city's own picks.
import { demandLift, shareLift, tagPoints } from "../analysis.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { qlooEntities } from "../qloo.js";
import { crowdIds, format, lovesIds, signalLocation, themeTagIdsFor } from "./common.js";

const nameOf = (where) => (typeof where === "string" ? nameOf(where) : where?.name ?? "");

const TAKE = 30;
const FASHION_TAG = "urn:tag:genre:brand:fashion";

async function typedLift(q, run, { family, where, country, label }) {
  const read = (place, title) => q.tryInsights(title, { "filter.type": "urn:tag", "filter.tag.types": `urn:tag:${family}:qloo`, "filter.parents.types": "urn:entity:brand", ...signalLocation(place), take: TAKE });
  const [city, nation] = await Promise.all([read(where, `${label} ${nameOf(where)} leans to`), read(country, `Same ${label.toLowerCase()} for ${country}`)]);
  const cityTags = tagPoints(city ?? {});
  const countryTags = tagPoints(nation ?? {});
  const lift = demandLift(cityTags, countryTags, { take: TAKE });
  for (const t of lift) registerName(run, t.name, "tag", { id: t.id });
  const cityNames = new Set(cityTags.map((t) => String(t.name).toLowerCase()));
  const avoid = countryTags.filter((t) => t?.name && !cityNames.has(String(t.name).toLowerCase())).slice(0, 4).map((t) => ({ id: t.id, name: t.name }));
  for (const t of avoid) registerName(run, t.name, "tag", { id: t.id });
  return { over: lift.filter((t) => t.lift >= 1).slice(0, 8), avoid, coverage: cityTags.length ? "ok" : "none" };
}

async function fashionLook(q, run, where, country) {
  const [aesthetics, styles, cityCat, countryCat, loves] = await Promise.all([
    typedLift(q, run, { family: "aesthetic_property", where, country, label: "Aesthetics" }),
    typedLift(q, run, { family: "personal_style", where, country, label: "Personal styles" }),
    q.tryInsights(`Fashion labels ${nameOf(where)} favours, with their materials and ages`, { "filter.type": "urn:entity:brand", "filter.tags": FASHION_TAG, ...signalLocation(where), take: 50 }),
    q.tryInsights(`Same labels for ${country}`, { "filter.type": "urn:entity:brand", "filter.tags": FASHION_TAG, ...signalLocation(country), take: 50 }),
    lovesIds(run).length ? q.tryStep("The loves' own style and theme tags", "qloo api entities", { ids: lovesIds(run) }, async () => ({ results: (await qlooEntities(lovesIds(run))).results ?? [], provenance: { source: "Qloo API", endpoint: "/entities", requests: [{ method: "GET", path: "/entities", query: { entity_ids: lovesIds(run) } }] } })) : Promise.resolve(undefined),
  ]);
  const cityEnts = cityCat?.results?.entities ?? [];
  const countryEnts = countryCat?.results?.entities ?? [];
  const counts = shareLift(cityEnts, countryEnts, { families: ["material", "target_age_group", "fashion_segment", "aesthetic_property"], minAbs: 4, top: 10 });
  const byFamily = (fam) => ({ over: counts.over.filter((x) => x.family === fam).slice(0, 5), under: counts.under.filter((x) => x.family === fam).slice(0, 4) });
  const materials = byFamily("material");
  const ages = byFamily("target_age_group");
  const segments = byFamily("fashion_segment");
  const surface = byFamily("aesthetic_property");
  for (const x of [...counts.over, ...counts.under]) registerName(run, x.name, "tag", { id: x.id });
  const labels = cityEnts.slice(0, 8).map((e) => ({ id: e.entity_id, name: e.name, image: e.properties?.image?.url ?? e.properties?.image }));
  for (const l of labels) registerName(run, l.name, "brand", { id: l.id });
  const resolvedLoves = run.stages.resolve?.output?.loves ?? [];
  const motifs = (loves?.results ?? []).flatMap((e) => (e.tags ?? []).filter((t) => /^urn:tag:(style|theme|aesthetic_property|design_inspiration|motif):qloo:/.test(String(t.tag_id ?? t.id ?? ""))).slice(0, 8).map((t) => ({ id: t.tag_id ?? t.id, name: t.name, from: resolvedLoves.find((l) => l.id === e.entity_id)?.name ?? e.name })));
  for (const m of motifs) registerName(run, m.name, "tag", { id: m.id });
  const kids = /kid|child|boys|girls|toddler|baby/i.test(`${run.input.text} ${run.input.theme?.query ?? ""}`);
  const note = kids ? `Qloo has no children's age tag on fashion labels, so this is the taste of the adults who buy in ${nameOf(where)} (the parents), not of the children.` : undefined;
  const headline = [...aesthetics.over.slice(0, 3).map((t) => t.name), ...materials.over.slice(0, 2).map((t) => t.name)];
  return {
    kind: "fashion",
    aesthetics: aesthetics.over,
    personalStyles: styles.over,
    surface,
    materials,
    ages,
    segments,
    avoid: [...aesthetics.avoid, ...styles.avoid].slice(0, 6),
    labels,
    motifs,
    note,
    n: { city: cityEnts.length, country: countryEnts.length },
    coverage: aesthetics.coverage === "none" && !cityEnts.length ? "none" : "ok",
    summary: headline.length ? `${nameOf(where)} leans ${headline.join(", ")}${ages.over[0] ? `; skews ${ages.over[0].name}` : ""}${materials.under[0] ? `; below ${country} on ${materials.under.map((m) => m.name).join(", ")}` : ""}.` : "No fashion look could be read for this city.",
  };
}

async function screenLook(q, run, where, country) {
  const f = format(run);
  const type = f.types[0];
  const themeIds = themeTagIdsFor(run, type);
  const base = themeIds.length ? { "filter.tags": themeIds[0] } : { "signal.interests.entities": crowdIds(run) };
  const [city, nation] = await Promise.all([
    q.tryInsights(`The ${type === "tv_show" ? "series" : "films"} ${nameOf(where)} favours, with their style tags`, { "filter.type": `urn:entity:${type}`, ...base, ...signalLocation(where), take: 50 }),
    q.tryInsights(`Same catalogue for ${country}, with style tags`, { "filter.type": `urn:entity:${type}`, ...base, ...signalLocation(country), take: 50 }),
  ]);
  const cityEnts = city?.results?.entities ?? [];
  const countryEnts = nation?.results?.entities ?? [];
  const styles = shareLift(cityEnts, countryEnts, { families: ["style"], minAbs: 4, top: 8 });
  const people = shareLift(cityEnts, countryEnts, { families: ["archetype", "theme"], minAbs: 4, top: 10 });
  const archetypes = people.over.filter((x) => x.family === "archetype").slice(0, 5);
  const themes = people.over.filter((x) => x.family === "theme").slice(0, 5);
  for (const x of [...styles.over, ...styles.under, ...archetypes, ...themes]) registerName(run, x.name, "tag", { id: x.id });
  const onlyHere = new Set((run.stages.read?.output?.columns?.[type]?.onlyHere ?? []).map((n) => n.toLowerCase()));
  const described = cityEnts.filter((e) => e.properties?.style_description);
  const picks = [...described.filter((e) => onlyHere.has(String(e.name).toLowerCase())), ...described].slice(0, 3);
  const descriptions = picks.map((e) => ({ title: e.name, text: String(e.properties.style_description).slice(0, 220) }));
  return {
    kind: "screen",
    styles: styles.over,
    avoid: styles.under,
    archetypes,
    themes,
    descriptions,
    n: { city: cityEnts.length, country: countryEnts.length },
    coverage: cityEnts.length ? "ok" : "none",
    summary: styles.over.length ? `The look ${nameOf(where)} leans to: ${styles.over.slice(0, 4).map((s) => `${s.name} +${s.lift}`).join(", ")}${styles.under.length ? `; less ${styles.under.slice(0, 2).map((s) => s.name).join(", ")}` : ""}.` : "No style lift could be read.",
  };
}

export async function look(run) {
  const q = evidenceFor(run, "look");
  const r = run.stages.resolve.output;
  const where = r.city;
  const country = r.city.market ?? r.city.country;
  return format(run).id === "fashion" ? fashionLook(q, run, where, country) : screenLook(q, run, where, country);
}
