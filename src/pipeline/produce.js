// Stage: produce (fashion only). The path from a written drop to a first
// production run: a minimum tech pack per style, unit economics per channel,
// a size curve, a city split by taste lean, and the Indian compliance list.
// Every number here is an editable ASSUMPTION, shown as such, never a forecast.
// Defaults come from directory asking prices and seller pages read on 28 Oct 2026
// (see research_notes/AYTO fashion visuals and more formats/fashion_deliverable.md).
import { getRunCredential } from "../keys.js";
import { chatJson, llmAvailable, redact } from "../llm.js";
import { memo } from "../qloo.js";
import { RULES } from "../writers/shared.js";
import { emitEvent } from "./store.js";

export const ASSUMPTIONS = {
  currency: "INR",
  tier: "mid", // value | mid | premium
  moqPerStylePerColour: 100, // common domestic quote for a Tiruppur unit (Optima, IndiaMART, Jul 2026)
  heroQuantity: 300,
  otherQuantity: 150,
  sizeCurve: { S: 1, M: 2, L: 3, XL: 2, XXL: 1 }, // bell-curve ratio pack; no Indian norm exists
  kidsSizeCurve: { "2-3": 1, "4-5": 2, "6-7": 3, "8-9": 2, "10-11": 1 },
  unitCost: { fabric: 120, cmt: 60, print: 30, trimsAndPacking: 20 }, // ≈ ₹230: between a ₹190 plain tee and ₹375 bio-washed at 100 MOQ
  logisticsPerUnit: 60,
  returnsReserveShare: 0.08,
  markupByTier: { value: 2.2, mid: 2.8, premium: 3.5 }, // cost-to-MRP; no Indian benchmark, US rule is 2–2.5x wholesale
  homeCityShare: 0.2,
  // Marketplace take rates as of 28 Oct 2026. Flipkart 0% on fashion (Jul 2026), Meesho 0% (all categories),
  // Myntra 0% for eligible emerging Made-in-India D2C brands (Jan 2026; otherwise ~20%), Ajio 15–25%, own site ≈ 2% gateway.
  channels: {
    "Instagram + WhatsApp": { fee: 0.02, note: "payment gateway only" },
    Meesho: { fee: 0, note: "0% commission, Enrolment ID ok for intra-state" },
    Flipkart: { fee: 0, note: "0% on fashion since Jul 2026" },
    Myntra: { fee: 0, note: "0% for eligible emerging D2C brands (Jan 2026); needs GSTIN + trademark/NOC" },
    Ajio: { fee: 0.2, note: "15–25%; needs regular GSTIN and a cm size chart" },
    "Own site": { fee: 0.02, note: "payment gateway only" },
    Boutiques: { fee: 0.35, note: "consignment or wholesale margin" },
  },
  gst: { lowRate: 0.05, highRate: 0.18, cliff: 2500 }, // per piece MRP, from 22 Sep 2025; MRP includes GST
};

const POM = ["Full length", "Shoulder to shoulder", "½ chest", "½ hem", "Full sleeve", "Armhole", "Neck width", "Neckband width"];

const TECH_PACK = `You write minimum tech packs for a small Indian garment maker. Keep it practical and buildable in a Tiruppur or Surat unit. Points of measure stay blank: the sampling room fills them.
${RULES}
Return JSON:
{"packs":[{"style":"must match a style name exactly","fabric":{"composition":"","gsm":0,"finish":""},
  "construction":["3-5 short points"],"print_or_embroidery":{"type":"","placement":"","size_cm":""},
  "trims":["main label","care label","size label","MRP sticker"],
  "fit_notes":"","packaging":"loose|pre-packed polybag"}]}`;

const channelKey = (name) => Object.keys(ASSUMPTIONS.channels).find((k) => String(name).toLowerCase().includes(k.toLowerCase().split(" ")[0])) ?? Object.keys(ASSUMPTIONS.channels).find((k) => new RegExp(k.split(/\W+/)[0], "i").test(String(name)));

function defaultPack(style) {
  const g = style.garment ?? "tee";
  const fleece = /hoodie|sweatshirt/.test(g);
  return {
    style: style.name,
    fabric: fleece ? { composition: "80% cotton 20% polyester fleece", gsm: 300, finish: "brushed" } : /dress|kurta/.test(g) ? { composition: "100% cotton", gsm: 140, finish: "soft wash" } : { composition: "100% cotton", gsm: 180, finish: "bio-washed" },
    construction: fleece ? ["Set-in sleeve, 1x1 rib cuff and hem", "Lined hood with flat drawcord", "Kangaroo pocket, bar-tacked"] : ["Set-in sleeve, overlock seams", "1x1 rib neckband", "Double-needle hem"],
    print_or_embroidery: style.print?.type && style.print.type !== "none" ? { type: style.print.type === "typographic" ? "screen print" : style.print.type === "stripe" ? "yarn-dyed stripe" : "screen print", placement: String(style.print.placement ?? "chest").replace(/_/g, " "), size_cm: style.print.placement === "all_over" ? "repeat" : "25 x 20" } : { type: "none", placement: "", size_cm: "" },
    trims: ["main label", "care label", "size label", "MRP sticker"],
    fit_notes: (style.cues ?? []).slice(0, 2).join(", "),
    packaging: "loose (customer can inspect)",
    fallback: true,
  };
}

export async function produce(run) {
  const plan = run.stages.write?.output?.plan ?? {};
  // A model can send a style's name as a number, its cues or colourways as one string: read them as text and lists.
  const text = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : v && typeof v === "object" && !Array.isArray(v) ? text(v.name ?? v.title ?? "") : "");
  const list = (v) => (Array.isArray(v) ? v.flat(Infinity) : typeof v === "string" ? v.split(/\s*[,;·|]\s*/) : v === undefined || v === null ? [] : [v]).map(text).filter(Boolean);
  const styles = (Array.isArray(plan.styles) ? plan.styles : plan.styles && typeof plan.styles === "object" ? [plan.styles] : [])
    .filter((s) => s && typeof s === "object" && text(s.name))
    .map((s) => ({ ...s, name: text(s.name), category: text(s.category), garment: typeof s.garment === "string" ? s.garment : undefined, cues: list(s.cues), colourways: list(s.colourways) }));
  if (!styles.length) return { packs: [], economics: {}, styles: [], allocation: [], summary: "No styles to produce." };
  // A maker may change one cost component; the others keep their defaults.
  const given = run.input.assumptions ?? {};
  const A = structuredClone({ ...ASSUMPTIONS, ...given, unitCost: { ...ASSUMPTIONS.unitCost, ...(given.unitCost ?? {}) } });
  const kids = /kid|child|boys|girls/i.test(`${run.input.text} ${run.input.theme?.query ?? ""} ${plan.positioning ?? ""}`);
  const curve = kids ? A.kidsSizeCurve : A.sizeCurve;

  // ---- tech packs: the model when there is one, labelled defaults otherwise
  const credential = getRunCredential(run.id);
  let packs = [];
  let packsBy = "defaults";
  // New assumptions only: the tech packs written last time still describe these styles.
  const carry = run.stages.produce?.carry;
  if (carry) {
    delete run.stages.produce.carry;
    const names = new Set(styles.map((s) => s.name));
    packs = carry.packs.filter((p) => names.has(p.style)).map(({ sizes, pointsOfMeasure, ...p }) => p);
    packsBy = carry.packsBy;
  } else if (credential || llmAvailable()) {
    emitEvent(run, { type: "thought", stage: "produce", text: "Writing minimum tech packs…" });
    const evidence = { styles: styles.map((s) => ({ name: s.name, category: s.category, garment: s.garment, cues: s.cues, print: s.print, colourways: s.colourways })), palette: (plan.palette ?? []).map((p) => `${p.name} ${p.hex}`), kids };
    try {
      const deadline = Date.now() + 90000; // inside the stage's two minutes; defaults stand in after it
      const call = () => chatJson({ credential, system: TECH_PACK, user: JSON.stringify(evidence), temperature: 0.3, maxTokens: 1800, deadline });
      const out = credential ? await call() : await memo("llm", "techpack-v1", { evidence }, call);
      const names = new Set(styles.map((s) => s.name));
      packs = (out.packs ?? []).filter((p) => names.has(p.style));
      packsBy = "model";
    } catch (e) {
      emitEvent(run, { type: "thought", stage: "produce", text: `Tech packs: model failed (${redact(e.message).slice(0, 120)}); using defaults.` });
    }
  }
  for (const s of styles) if (!packs.some((p) => p.style === s.name)) packs.push(defaultPack(s));
  for (const p of packs) {
    p.sizes = Object.keys(curve);
    p.pointsOfMeasure = POM.map((name) => ({ name, cm: "" })); // blank on purpose: measured by the sampling room
  }

  // ---- unit economics
  const unitCost = Object.values(A.unitCost).reduce((s, v) => s + v, 0);
  const landed = unitCost + A.logisticsPerUnit;
  const tier = A.tier in A.markupByTier ? A.tier : "mid";
  const mrp = Math.round((landed * A.markupByTier[tier]) / 10) * 10;
  const gstRate = mrp <= A.gst.cliff ? A.gst.lowRate : A.gst.highRate;
  const exGst = mrp / (1 + gstRate);
  const chosen = [...new Set((plan.channels ?? []).map(channelKey).filter(Boolean))];
  const channelList = chosen.length ? chosen : ["Instagram + WhatsApp", "Meesho"];
  const channels = channelList.map((name) => {
    const c = A.channels[name];
    const net = Math.round(exGst * (1 - c.fee) * (1 - A.returnsReserveShare));
    return { channel: name, fee: c.fee, note: c.note, netPerUnit: net, marginPerUnit: net - landed, marginPct: Math.round(((net - landed) / mrp) * 100), breakEvenUnitsPerStyle: net > landed ? Math.ceil((A.moqPerStylePerColour * landed) / (net - landed)) : undefined };
  });
  const economics = { tier, unitCost, landedCost: landed, mrp, gstRate, exGst: Math.round(exGst), gstNote: mrp <= A.gst.cliff ? `5% GST: MRP is at or below ₹${A.gst.cliff}.` : `18% GST: MRP is above ₹${A.gst.cliff}. Pricing at ₹${A.gst.cliff} or below would drop it to 5%.`, channels };

  // ---- quantities and sizes
  const curveTotal = Object.values(curve).reduce((s, v) => s + v, 0);
  const lines = styles.map((s) => {
    const qty = s.hero ? A.heroQuantity : A.otherQuantity;
    const colourways = s.colourways?.length ? s.colourways : [plan.palette?.[0]?.name ?? "core"];
    const perColour = Math.max(A.moqPerStylePerColour, Math.round(qty / colourways.length));
    return { style: s.name, sku: s.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16), garment: s.garment, colourways, quantityPerColour: perColour, total: perColour * colourways.length, sizes: Object.fromEntries(Object.entries(curve).map(([k, v]) => [k, Math.round((perColour * v) / curveTotal)])) };
  });
  const totalUnits = lines.reduce((s, x) => s + x.total, 0);

  // ---- city split by taste lean (the travels read), home city first
  const r = run.stages.resolve?.output;
  const leans = (run.stages.travels?.output?.cities ?? []).filter((c) => !c.home && c.lift > 0).slice(0, 4);
  const weightSum = leans.reduce((s, c) => s + c.lift, 0) || 1;
  const homeShare = r?.city ? A.homeCityShare : 0;
  const allocation = [
    ...(r?.city ? [{ city: r.city.name, share: homeShare, units: Math.round(totalUnits * homeShare), why: "Home city" }] : []),
    ...leans.map((c) => {
      const share = (1 - homeShare) * (c.lift / weightSum);
      return { city: c.name, share: Math.round(share * 100) / 100, units: Math.round(totalUnits * share), why: `Leans the same way (lift +${c.lift})` };
    }),
  ];

  const compliance = {
    loose: ["Maker / marketer / brand owner name and address, with country of origin", "Consumer-care email and phone", "Size (S–XXL or age band) with cm", "MRP inclusive of all taxes, in ₹"],
    prePacked: ["Generic name of the product", "Net quantity", "Month and year of manufacture or packing"],
    registrations: ["GST registration: compulsory for any inter-state sale and required by Myntra and Ajio regardless of turnover", "Udyam (MSME) registration: free, optional", "Myntra needs a trademark or NOC; Ajio needs a cm size chart per fit"],
    source: "Legal Metrology (Packaged Commodities) Rules, 2022 amendment in force 1 Jan 2023; GST slabs from 22 Sep 2025.",
  };

  return {
    assumptions: A,
    packs,
    packsBy,
    economics,
    styles: lines,
    totalUnits,
    investment: totalUnits * landed,
    allocation,
    compliance,
    summary: `${totalUnits} units across ${lines.length} styles at MRP ₹${mrp} (${Math.round(gstRate * 100)}% GST), ${channels.length} channels, ${allocation.length} cities. All figures are editable assumptions.`,
  };
}
