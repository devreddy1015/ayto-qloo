// Stages that build the launch kit from the evidence: Build, Backend, Test,
// Diff, Brand, Launch, Deploy. Only Build, Diff, Brand and Launch use the model.
import { chatJson, llmAvailable } from "../llm.js";
import { memo } from "../qloo.js";
import { isKnownName } from "./evidence.js";
import { BRAND, BUILD, LAUNCH, WITHOUT_QLOO } from "./prompts.js";
import { emitEvent } from "./store.js";

async function llmJson(run, stageId, system, evidence, opts = {}) {
  if (!llmAvailable()) return undefined;
  emitEvent(run, { type: "thought", stage: stageId, text: opts.thought ?? "Writing this stage from the evidence…" });
  try {
    return await memo("llm", `${stageId}-v2`, { system, evidence }, () =>
      chatJson({ system, user: JSON.stringify(evidence), temperature: opts.temperature ?? 0.4, maxTokens: opts.maxTokens ?? 1800 }),
    );
  } catch (error) {
    emitEvent(run, { type: "thought", stage: stageId, text: `Language model unavailable (${error.message}). Using a template.` });
    return undefined;
  }
}

// ---------- 4. Build ----------

export async function build(run) {
  const d = run.stages.design.output.plan;
  const evidence = {
    maker: run.input.maker,
    styles: (d.styles ?? []).map((s) => ({ name: s.name, category: s.category, description: s.description, colourways: s.colourways })),
    cues: (d.cues ?? []).slice(0, 6).map((c) => c.cue),
    palette: (d.palette ?? []).map((p) => `${p.name} ${p.hex}`),
  };
  const out = (await llmJson(run, "build", BUILD, evidence, { thought: "Writing tech packs…", temperature: 0.3 })) ?? { packs: [], fallback: true };
  const names = new Set(evidence.styles.map((s) => s.name));
  const packs = (out.packs ?? []).filter((p) => names.has(p.style));
  // Every style gets a pack, even if the model skipped it.
  for (const s of evidence.styles) {
    if (!packs.some((p) => p.style === s.name)) {
      packs.push({
        style: s.name,
        fabric: { composition: "100% cotton (default)", gsm: 180, finish: "bio-washed" },
        construction: ["Standard construction; pack not written by the model."],
        print_or_embroidery: { type: "screen print", placement: "front chest", size_cm: "25 x 20" },
        trims: ["main label", "care label", "size label", "MRP sticker"],
        sizes: ["S", "M", "L", "XL", "XXL"],
        fit_notes: "",
        packaging: "Polybag with Legal Metrology declarations",
        fallback: true,
      });
    }
  }
  return { packs, summary: `${packs.length} tech packs.` };
}

// ---------- 5. Backend (deterministic) ----------

// Editable assumptions. Shown in the UI as assumptions, not facts.
export const ASSUMPTIONS = {
  currency: "INR",
  moqPerStylePerColour: 100,
  heroQuantity: 300,
  otherQuantity: 150,
  sizeCurve: { S: 1, M: 2, L: 3, XL: 2, XXL: 1 },
  unitCost: { fabric: 120, cmt: 60, print: 30, trimsAndPacking: 20 },
  logisticsPerUnit: 60,
  marketplaceFeeShare: 0.18,
  markupByTier: { value: 2.2, mid: 2.8, premium: 3.5 },
  homeCityShare: 0.2,
};

export async function backend(run) {
  const a = run.stages.architect.output;
  const d = run.stages.design.output.plan;
  const A = { ...ASSUMPTIONS, ...(run.input.assumptions ?? {}) };
  const tier = a.plan.price_tier?.tier in A.markupByTier ? a.plan.price_tier.tier : "mid";
  const unitCost = Object.values(A.unitCost).reduce((s, v) => s + v, 0);
  const landed = unitCost + A.logisticsPerUnit;
  const mrp = Math.round((landed * A.markupByTier[tier]) / 10) * 10;
  const marketplaceNet = Math.round(mrp * (1 - A.marketplaceFeeShare));
  const economics = {
    tier,
    unitCost,
    landedCost: landed,
    mrp,
    marketplaceNet,
    marginDirect: Math.round(((mrp - landed) / mrp) * 100),
    marginMarketplace: Math.round(((marketplaceNet - landed) / mrp) * 100),
    breakEvenUnitsPerStyle: Math.ceil((A.moqPerStylePerColour * landed) / Math.max(marketplaceNet - landed, 1)),
  };

  const curveTotal = Object.values(A.sizeCurve).reduce((s, v) => s + v, 0);
  const styles = (d.styles ?? []).map((s) => {
    const qty = s.hero ? A.heroQuantity : A.otherQuantity;
    const colourways = s.colourways?.length ? s.colourways : ["core"];
    const perColour = Math.max(A.moqPerStylePerColour, Math.round(qty / colourways.length));
    return {
      style: s.name,
      sku: s.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16),
      colourways,
      quantityPerColour: perColour,
      total: perColour * colourways.length,
      sizes: Object.fromEntries(Object.entries(A.sizeCurve).map(([k, v]) => [k, Math.round((perColour * v) / curveTotal)])),
    };
  });
  const totalUnits = styles.reduce((s, x) => s + x.total, 0);

  // Split units across the gap cities, weighted by gap, keeping a share for home.
  const cities = a.markets.flatMap((m) => m.gap.filter((g) => g.name && g.signal === "opportunity").slice(0, 4).map((g) => ({ city: g.name, market: m.market, weight: g.gap })));
  const weightSum = cities.reduce((s, c) => s + c.weight, 0) || 1;
  const homeShare = run.input.city ? A.homeCityShare : 0;
  const allocation = [
    ...(run.input.city ? [{ city: run.input.city, market: run.input.homeMarket, share: homeShare, units: Math.round(totalUnits * homeShare), why: "Home market" }] : []),
    ...cities.map((c) => {
      const share = (1 - homeShare) * (c.weight / weightSum);
      return { city: c.city, market: c.market, share: Math.round(share * 100) / 100, units: Math.round(totalUnits * share), why: `Gap ${Math.round(c.weight * 100)}` };
    }),
  ];

  return {
    assumptions: A,
    economics,
    styles,
    totalUnits,
    investment: totalUnits * landed,
    allocation,
    summary: `${totalUnits} units across ${styles.length} styles, MRP ₹${mrp}, ${allocation.length} cities.`,
  };
}

// ---------- 6. Test (deterministic evidence check) ----------

const NAME_FIELDS = [
  ["architect", "plan.first_markets[].cities[]", "city"],
  ["design", "plan.cues[].from_tags[]", "tag"],
  ["design", "plan.cues[].from_brands[]", "brand"],
  ["design", "plan.styles[].from_tags[]", "tag"],
  ["design", "plan.palette[].from_tags[]", "tag"],
  ["entrepreneur", "plan.pricing.anchor_brands[]", "brand"],
  ["entrepreneur", "plan.collabs[]", "artist"],
  ["launch", "plan.first_cities[]", "city"],
  ["launch", "plan.first_cities[].start_in[]", "neighbourhood"],
  ["launch", "plan.first_cities[].seed_at[]", "place"],
  ["launch", "plan.soundtrack[]", "artist"],
];

function walk(obj, path, visit) {
  const [head, ...rest] = path.split(".");
  if (head === undefined) return;
  const key = head.replace("[]", "");
  const isArray = head.endsWith("[]");
  const value = key ? obj?.[key] : obj;
  if (value === undefined) return;
  const items = isArray ? (Array.isArray(value) ? value : []) : [value];
  items.forEach((item, i) => {
    if (!rest.length) visit(item, (replacement) => (isArray ? (key ? (obj[key][i] = replacement) : null) : (obj[key] = replacement)));
    else walk(item, rest.join("."), visit);
  });
}

export async function test(run) {
  return checkEvidence(run);
}

/** Check every named claim in the kit against the Qloo evidence; prune what fails. */
export function checkEvidence(run) {
  const checked = [];
  let grounded = 0;
  let removed = 0;
  for (const [stageId, path, kind] of NAME_FIELDS) {
    const output = run.stages[stageId]?.output;
    if (!output) continue;
    walk(output, path, (item, replace) => {
      const name = typeof item === "string" ? item : item?.city ?? item?.partner ?? item?.artist;
      if (!name) return;
      const ok = isKnownName(run, name);
      checked.push({ stage: stageId, kind, name, ok });
      if (ok) grounded += 1;
      else {
        removed += 1;
        replace(typeof item === "string" ? `[removed: not in Qloo evidence] ${name}` : { ...item, removed: true });
      }
    });
  }
  // Drop removed entries from arrays so the launch kit stays clean.
  for (const stageId of ["architect", "design", "entrepreneur", "launch"]) {
    const output = run.stages[stageId]?.output;
    if (output) prune(output);
  }
  const score = checked.length ? Math.round((grounded / checked.length) * 100) : 100;
  return {
    checked: checked.length,
    grounded,
    removed,
    score,
    stages: [...new Set(checked.map((c) => c.stage))],
    items: checked.filter((c) => !c.ok).slice(0, 30),
    summary: `${grounded} of ${checked.length} named claims trace to Qloo. ${removed} removed.`,
  };
}

function prune(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i -= 1) {
      const v = node[i];
      if ((typeof v === "string" && v.startsWith("[removed:")) || (v && typeof v === "object" && v.removed)) node.splice(i, 1);
      else prune(v);
    }
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) prune(v);
  }
}

// ---------- 7. Diff (with vs without Qloo) ----------

export async function diff(run) {
  const a = run.stages.architect.output;
  const d = run.stages.design.output.plan;
  const e = run.stages.entrepreneur?.output?.plan;
  const input = run.input;
  const user = `I'm a ${input.maker ?? "clothing"} maker${input.city ? ` in ${input.city}` : ""}. I love ${input.loves.map((w) => w.name).join(" and ")}. I sell in ${input.markets.join(", ")}.${input.angle ? ` I want to make ${input.angle}.` : ""} What should I make, where should I sell first, which brands should I study, and which channels?`;
  const generic = (await llmJson(run, "diff", WITHOUT_QLOO, { message: user }, { thought: "Asking the same question with no Qloo evidence…", temperature: 0.4 })) ?? {
    categories: [],
    first_cities: [],
    brands_to_study: [],
    design_cues: [],
    channels: [],
    fallback: true,
  };
  const names = [...(generic.first_cities ?? []), ...(generic.brands_to_study ?? [])].filter((x) => typeof x === "string");
  const genericGrounded = names.filter((n) => isKnownName(run, n)).length;
  const withQloo = {
    cities: a.markets.flatMap((m) => m.opportunityCities).slice(0, 8),
    brands: a.markets.flatMap((m) => m.brands.filter((b) => b.waveSpecific).map((b) => b.name)).slice(0, 8),
    cues: (d.cues ?? []).slice(0, 5).map((c) => c.cue),
    channels: (e?.channels ?? []).map((c) => c.channel),
  };
  const withGrounded = [...withQloo.cities, ...withQloo.brands].filter((n) => isKnownName(run, n)).length;
  return {
    question: user,
    withoutQloo: generic,
    withQloo,
    benchmark: {
      withQloo: { named: withQloo.cities.length + withQloo.brands.length, grounded: withGrounded },
      withoutQloo: { named: names.length, grounded: genericGrounded },
    },
    summary: `With Qloo: ${withGrounded} of ${withQloo.cities.length + withQloo.brands.length} names trace to evidence. Without: ${genericGrounded} of ${names.length}.`,
  };
}

// ---------- 9. Brand ----------

export async function brand(run) {
  const t = run.stages.think.output;
  const d = run.stages.design.output.plan;
  const evidence = {
    maker: run.input.maker,
    home: run.input.city,
    markets: run.input.markets,
    waves: t.waves.map((w) => w.name),
    mood: d.mood,
    tags: t.tags.slice(0, 10).map((x) => x.name),
    positioning: run.stages.architect.output.plan.positioning,
  };
  const out = (await llmJson(run, "brand", BRAND, evidence, { thought: "Naming the label…", temperature: 0.8 })) ?? fallbackBrand(evidence);
  const protectedNames = Object.keys(run.names ?? {}).filter((n) => ["wave", "brand", "artist"].includes(run.names[n].kind));
  const names = (out.names ?? []).filter((n) => n?.name && !protectedNames.some((p) => n.name.toLowerCase().includes(p) || p.includes(n.name.toLowerCase())));
  return {
    ...out,
    names: names.slice(0, 3),
    checks: [
      "Trademark: search IP India (class 25 clothing, class 35 retail) before printing labels.",
      "Domain and Instagram handle availability.",
      "Udyam (MSME) registration is free; GST needed before Myntra/Ajio.",
      "Each pack needs Legal Metrology declarations: maker name and address, country of origin, net quantity, month/year, MRP, consumer-care contact.",
    ],
    summary: `${names.length} name options.`,
  };
}

function fallbackBrand(ev) {
  return {
    names: [{ name: "Thread & Signal", meaning: "Placeholder name; the language model was unavailable.", check: "Search IP India class 25" }],
    story: ev.positioning ?? "",
    voice: ["clear", "warm", "confident"],
    taglines: ev.markets.map((m) => ({ market: m, line: "Made for the people who got here first." })),
    fallback: true,
  };
}

// ---------- 10. Launch ----------

export async function launch(run) {
  const t = run.stages.think.output;
  const a = run.stages.architect.output;
  const e = run.stages.entrepreneur.output;
  const b = run.stages.brand.output;
  const evidence = {
    brand: b.names?.[0]?.name,
    waves: t.waves.map((w) => w.name),
    tags: t.tags.slice(0, 8).map((x) => x.name),
    markets: a.markets.map((m) => ({ market: m.market, opportunity_cities: m.opportunityCities, in_step_cities: m.inStepCities })),
    home: run.input.city,
    channels: (e.plan.channels ?? []).map((c) => c.channel),
    city_passports: (e.passport ?? []).map((p) => ({ city: p.city, neighbourhoods: p.neighbourhoods.map((n) => n.name), venues: p.venues.map((v) => v.name) })),
    soundtrack: (e.soundtrack ?? []).map((s) => ({ artist: s.name, shared_tags: s.sharedTags })),
    audience_skew: t.demographics?.slice(0, 4),
  };
  const plan = (await llmJson(run, "launch", LAUNCH, evidence, { thought: "Writing the 30-day plan…" })) ?? fallbackLaunch(evidence);
  // Only Qloo-returned artists may appear in the soundtrack, whatever the model wrote.
  const allowed = new Set(evidence.soundtrack.map((s) => s.artist.toLowerCase()));
  plan.soundtrack = (plan.soundtrack ?? []).filter((s) => s?.artist && allowed.has(String(s.artist).toLowerCase())).slice(0, 4);
  return { plan, summary: `${plan.first_cities?.length ?? 0} first cities, ${plan.soundtrack.length} soundtrack artists, ${plan.weeks?.length ?? 0} weeks.` };
}

function fallbackLaunch(ev) {
  const byCity = new Map(ev.city_passports.map((p) => [p.city, p]));
  const cities = [...new Set([...ev.city_passports.map((p) => p.city), ...ev.markets.flatMap((m) => m.opportunity_cities)])].slice(0, 3);
  return {
    drop_name: "Drop 01",
    first_cities: cities.map((c) => ({ city: c, why: "Highest culture-minus-fashion gap.", start_in: byCity.get(c)?.neighbourhoods.slice(0, 2) ?? [], seed_at: byCity.get(c)?.venues.slice(0, 2) ?? [] })),
    soundtrack: ev.soundtrack.slice(0, 3).map((s, i) => ({ artist: s.artist, use: ["reel audio", "launch night", "playlist"][i], why: s.shared_tags?.length ? `Fans share: ${s.shared_tags.slice(0, 3).join(", ")}` : "Same fans, smaller audience." })),
    weeks: [1, 2, 3, 4].map((w) => ({ week: w, focus: ["Tease", "Pre-orders", "Drop", "Restock & learn"][w - 1], actions: [] })),
    creator_brief: { who: "", hook: "", deliverables: [] },
    content_ideas: [],
    success_signals: ["Pre-orders in week 2", "Sell-through by city in week 4"],
    fallback: true,
  };
}

// ---------- 11. Deploy ----------

export async function deploy(run) {
  // Final evidence pass over the stages that ran after Test.
  const finalCheck = checkEvidence(run);
  const b = run.stages.brand.output;
  const l = run.stages.launch.output.plan;
  const d = run.stages.design.output.plan;
  const be = run.stages.backend.output;
  const base = (b.names?.[0]?.name ?? "drop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "drop";
  const slug = `${base}-${run.id.replace(/[^a-z0-9]/gi, "").slice(-5).toLowerCase()}`;
  run.publish = {
    slug,
    url: `/d/${slug}`,
    publishedAt: new Date().toISOString(),
    page: {
      brand: b.names?.[0]?.name ?? "Untitled",
      tagline: b.taglines?.[0]?.line ?? "",
      story: b.story ?? "",
      mood: d.mood ?? "",
      palette: d.palette ?? [],
      styles: (d.styles ?? []).map((s) => ({ ...s, mrp: be.economics.mrp })),
      dropName: l.drop_name ?? "Drop 01",
      firstCities: (l.first_cities ?? []).map((c) => c.city ?? c),
      findUs: (l.first_cities ?? []).flatMap((c) => (c.start_in ?? []).slice(0, 2).map((n) => `${n}, ${c.city}`)).slice(0, 5),
      soundtrack: (l.soundtrack ?? []).map((s) => s.artist).slice(0, 3),
      waves: run.stages.think.output.waves.map((w) => w.name),
      tags: run.stages.think.output.tags.slice(0, 8).map((t) => t.name),
      ledgerCount: run.ledger?.length ?? 0,
    },
  };
  return { slug, url: run.publish.url, finalCheck, summary: `Live at ${run.publish.url}. Final check: ${finalCheck.grounded} of ${finalCheck.checked} claims grounded.` };
}
