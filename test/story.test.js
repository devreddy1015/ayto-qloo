// The story, simply: a plain telling of the film at the top of the brief. The model writes it; a plan without one
// gets its own logline and acts in a row; with no model it is the shape the evidence gives, never invented. The share
// page shows it first, escaped like everything else.
import assert from "node:assert/strict";
import { test } from "node:test";

const { film } = await import("../src/writers/film.js");
const { renderShareMarkdown, renderSharePage } = await import("../src/pipeline/page.js");

const EV = {
  city: "Hyderabad",
  country: "India",
  lanes: [{ flavour: "Neo-Noir", city_rank: 3, country_rank: 19, recent_supply: { count: 1, titles: [] } }],
  look: { style_this_city_leans_to: ["gritty (+12)", "rain-soaked (+8)"] },
  places_detail: [{ name: "Irani Café", area: "Abids" }, { name: "Clock Tower Bar", area: "Abids" }],
  shoot_base: { name: "Abids", venues: 2, of: 2, places: ["Irani Café", "Clock Tower Bar"] },
};

test("the model's own story is kept as written", () => {
  const plan = film.finish({ story: "Aruna wants one honest file.", logline: "x" }, EV);
  assert.equal(plan.story, "Aruna wants one honest file.");
});

test("a plan the model wrote without a story gets its logline and acts, in its own words", () => {
  const plan = film.finish({ logline: "A sub-inspector follows a song.", synopsis: { act1: "She logs it.", act2: "The guard remembers.", act3: "She sings it back." } }, EV);
  assert.equal(plan.story, "A sub-inspector follows a song. She logs it. The guard remembers. She sings it back.");
});

test("with no model the story is the shape the evidence gives, every name from the template", () => {
  const template = film.fallback(EV);
  assert.equal(template.story, "", "the template's story is empty so a model's plan never inherits it");
  const plan = film.finish(template, EV);
  assert.match(plan.story, /^No language model wrote this one/);
  assert.match(plan.story, /neo-noir film for Hyderabad/);
  assert.match(plan.story, /Hyderabad ranks it #3/);
  assert.match(plan.story, /The look leans gritty, rain-soaked\./);
  assert.match(plan.story, /around Abids, at Irani Café, Clock Tower Bar\./);
  assert.doesNotMatch(plan.story, /\(\+\d/, "lift numbers stay out of the prose");
});

test("the share page shows the story first, escaped", () => {
  const story = 'Aruna wants <script>alert("x")</script> one honest file & a quiet night.';
  const run = { publish: { url: "/s/late-shift-ab12c", page: { format: "film", city: "Hyderabad", country: "India", title: "Late Shift", plan: { titles: ["Late Shift"], story, logline: "A line." }, lanes: [], ledgerCount: 3, llm: { provider: "anthropic" } } } };
  const html = renderSharePage(run);
  assert.ok(!html.includes("<script>alert"), "no raw script from the story");
  assert.match(html, /The story, simply<\/h2><p>Aruna wants &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; one honest file &amp; a quiet night\.<\/p>/);
  assert.ok(html.indexOf("The story, simply") < html.indexOf("Logline"), "the story comes before the logline");
  const md = renderShareMarkdown(run);
  assert.match(md, /## The story, simply\n\nAruna wants/);
});
