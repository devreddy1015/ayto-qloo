# Qloo product landscape: API capabilities, customers, hackathon field, and alternative/extension ideas for AYTO

Research date: 2026-10-28. Older material is labelled with its year. "Documented" = read on docs.qloo.com or a Qloo-owned page; "reported" = third-party press or participant repos; "inference" = my reasoning.

Fetch problems to know about: Devpost pages (2025 and 2026) and npmjs returned HTTP 403, Forbes 403, JCDecaux PR and Startup Grants India timed out, and `docs.qloo.com/reference/entity-type-parameter-guide` returned 404 at that path. Where a Devpost fact is cited below it came through a search-engine snippet of the Devpost page or a mirror, and is marked as such.

---

## KQ1. What exactly does Qloo's Insights API expose (filters, signals, heatmaps, demographics, explainability, limits, harness/MCP)?

### Takeaway
Qloo is one GET endpoint (`/v2/insights`) that returns ranked entities of one `filter.type` given weighted signals (entities, tags, demographics, location), plus heatmap, demographics and tag "output modes", and four supporting endpoints (`/search`, `/v2/tags`, `/v2/audiences`, `/v2/analysis/compare`, `/v2/trending`). Location is first-class on both the filter side (where results are) and the signal side (whose taste), which is exactly the pair AYTO's "city vs rest of country" read depends on. Rate limits are not published; an official CLI+MCP "harness" exists but I could only confirm it through participant repos.

### Cited Findings

**Core endpoint, auth, entity types (documented)**
- Endpoint is `GET https://api.qloo.com/v2/insights`, key in `X-Api-Key` header; described as "taste insights that reflect audience preferences and cultural alignment" — [Qloo Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- `filter.type` (required) enum: artist, book, brand, movie, person, place, podcast, tv_show, videogame; `locality` partially supported (`signal.interests.entities` only when the entities are localities); `urn:heatmap`; `urn:entity:audience` deprecated — [Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- Hackathon guide lists `filter.type` values as `urn:entity:artist, book, brand, destination, movie, person, place, podcast, tv_show, video_game`; a 403 means unsupported type; music must be `urn:entity:artist`, food/drink places must be `place` or `brand` — [Qloo LLM Hackathon Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)
- "Taste Analysis is a way of using the Insights API, for example for retrieving tag metadata. 'Taste AI' is its older name." — [Hackathon Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)
- API overview lists use-case pages: Basic Insights (recommendations), Demographic Insights ("how audiences align with an entity or tag"), Heatmaps, Location-Based Insights, Taste Analysis (tags); lookup APIs: Entity Search `/search`, Entities by ID, Audiences, Audience Types, Tag Search, Tag Types; analysis: Analysis Compare, Get Trending Data — [Qloo API overview](https://docs.qloo.com/reference/api-overview)

**Filter parameters (documented, Insights deep dive)** — [source](https://docs.qloo.com/reference/insights-api-deep-dive)
- Location: `filter.location` (lat/lon, WKT, or Qloo locality UUID), `filter.location.query` (fuzzy locality name), `filter.location.radius` (metres, default 15000, max 800000), `filter.location.geohash`, `filter.location.metro`, `filter.geocode.name/admin1_region/admin2_region/country_code`, `filter.address`
- Exclusions: `filter.exclude.location`, `filter.exclude.location.query`, `filter.exclude.location.geohash`, `filter.exclude.location.radius`, `filter.exclude.tags`, `filter.exclude.entities`
- Tags: `filter.tags`, `filter.results.tags`, `operator.filter.exclude.tags` (union/intersection)
- Popularity/rating: `filter.popularity.min/max` (0–1 percentile), `filter.rating.min/max`, TripAdvisor/Resy rating and count filters, `filter.properties.business_rating`
- Price: `filter.price_level.min/max` (1–4), `filter.price_range.from/to` (places only); `filter.hotel_class.min/max` (1–5)
- Places only: `filter.references_brand` (+ operator), `filter.hours` (day of week), `filter.external.exists` (resy, michelin, tablet)
- Film/TV: `filter.content_rating`, `filter.release_year.min/max`, `filter.release_date`, `filter.release_country` (+ operator), `filter.latest_known_year`, `filter.finale_year`; Books: `filter.publication_year`; People: `filter.date_of_birth`, `filter.date_of_death`, `filter.gender`
- `filter.exists` (`properties.image` / `properties.description`), `filter.parents.types`

**Signal parameters (documented)** — [source](https://docs.qloo.com/reference/insights-api-deep-dive)
- `signal.location` (WKT POINT/POLYGON or locality ID), `signal.location.query`, `signal.location.radius` (max 800000; page recommends avoiding it), `signal.location.weight`
- `signal.interests.entities` (+ `.query` on POST with `resolve_to` place/brand/both, `.include`, `.weight`); `signal.interests.tags` (GET comma-separated; POST tag/weight objects), `operator.signal.interests.tags` (union/intersection), `.weight`
- `signal.demographics.age` values: `24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older, 35_and_younger, 36_to_55`; `signal.demographics.gender` male/female; `signal.demographics.audiences` (IDs from `/v2/audiences`); each with `.weight`
- Weights accept a number ≥ 0 or `very_low, low, mid, medium, high, very_high`
- `bias.trends` (off → very_high, default medium); `bias.content_based` 0–1 default 0.5; `bias.quality` and `sort_by=quality` for places (places without quality score filtered out); `diversify.by` / `diversify.take`

**Heatmaps (documented)**
- Request: `filter.type=urn:heatmap` + one location (`filter.location.query` or `filter.location`) + at least one of `signal.interests.entities` / `signal.interests.tags`; optional `bias.trends`, `output.heatmap.boundary`, `signal.demographics.*` — [Heatmaps use case](https://docs.qloo.com/reference/heatmaps-use-case)
- Response: `results.heatmap[]` each with `location{latitude, longitude, geohash}` and `query{affinity, affinity_rank, popularity}`; `affinity` = "relative interest or similarity for the signal at that location", `affinity_rank` = affinity normalised by rank within the result set, `popularity` = "overall engagement or prevalence of the signal at that location"; resolved locality echoed under `query.localities` — [Heatmaps use case](https://docs.qloo.com/reference/heatmaps-use-case)
- `output.heatmap.boundary` defaults to geohashes, with city or neighbourhood options; `heatmap.dimensions` accepts `quality, popularity, hotel_class, price_level` and adds `<dim>_affinity_rank` / `<dim>_affinity` columns (geohash boundary only); `filter.dimensions.price_level` / `.hotel_class` add count-affinity fields — [Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)

**Explainability (documented)**
- `feature.explainability` (default false): per-recommendation `query.explainability` with normalised 0–1 scores per input entity (≥0.1 always included); aggregate section shows average input-entity influence across top-3/5/10/all; failure yields `query.explainability.warning` while results still return — [Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)

**Compare (documented)**
- `GET /v2/analysis/compare`: "Analyze and compare two groups of entities"; required `a.signal.interests.entities` and `b.signal.interests.entities`; optional `filter.type`, `filter.location.query` (+ radius, `0` = locality boundary), `filter.exclude.location.query`, `filter.subtype` (`urn:tag:occupation` or `urn:tag:genre`), `model` (`descriptive` | `predictive`), `take` max 50; 404 "No results" and 429 rate-limit error shapes; location queries are fuzzy text and do not accept UUIDs — [Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1)

**Trending (documented)**
- `GET /v2/trending`: weekly rows `date, population_percentile, population_rank, population_rank_velocity, velocity_fold_change, population_percent_delta`; required `filter.type, filter.start_date, filter.end_date`; optional `signal.interests.entities`; `take` max 50 — [Get Trending Data](https://docs.qloo.com/reference/get-trending)

**Limits, quotas, hackathon gateway (documented)**
- `take` default 20 max 50; `page` 1–100; `backfill.cross_domain.take` max 20; `backfill.content_based.take` max 10; 400 when a locality/entity query matches nothing; deep-dive page does not document rate limits or free-tier quotas — [Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- Hackathon base URL is `https://hackathon.api.qloo.com`; hackathon keys fail on staging/production hosts ("the most common cause of 401 errors"); `/recommendations` and `/recs` are blocked legacy endpoints; `/v2/insights/search` is not valid; invalid parameters are "silently ignored"; keys have rate and monthly quota limits "set high enough to support typical hackathon projects" with no numbers published, raised via #api-help on Discord; private server-side caching allowed with no time limit; do not store Qloo response data in a public repo; no field filtering (responses verbose, e.g. `akas`); keys deactivated after the hackathon closes — [Hackathon Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)
- Recommended workflow: `/search` for entity IDs or `/v2/tags` for tag IDs, then pass IDs into `/v2/insights`; "Tags and audiences must be valid Qloo IDs or URNs, not freeform strings" — [Hackathon Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)

**Demographics / tag output modes (reported by participant repos; not on the pages I could fetch)**
- NoBanks/qloo-mcp calls `/v2/insights` with "the `urn:demographics` and `urn:tag` insight variants" to get age/gender affinity and descriptive taste tags — [NoBanks/qloo-mcp](https://github.com/NoBanks/qloo-mcp)
- TasteRouter uses `filter.type` set to `urn:tag` (taste DNA), `urn:demographics` (audience), `urn:heatmap`, and `urn:entity:place` with `filter.location=POINT(..)` — [happy520ai/taste-router](https://github.com/happy520ai/taste-router)

**Harness / MCP (reported; no official page fetched)**
- Multiple 2026 entries install `npm install --global @qloo/qloo-harness`, described as the official Qloo CLI + MCP server, started with `qloo mcp`; tools named `qloo_describe` (name → entity ID; returns `needs_input` when ambiguous), `qloo_rank` (score options against signals; scores from separate calls not comparable), `qloo_compare_audiences`, `qloo_trends`; one repo pins harness ≥ 0.1.26 and Node ≥ 22.19 — [search summary of SponsorMatch, Qloo-Agentic-Hack, TasteCase, Opener, Advance](https://github.com/alexespinoza28/sponsormatch)
- A hosted third-party MCP exposes seven tools (`qloo_search_entities`, `qloo_recommend`, `qloo_explain`, …) over Streamable HTTP, fixed to the hackathon base URL — [search result summary](https://github.com/hgyu-mech/qloo-workbench)
- The npm page for `@qloo/qloo-harness` returned 403 and the hackathon developer guide does not mention the harness, CLI or MCP — [npm (403)](https://www.npmjs.com/package/@qloo/qloo-harness); [Hackathon Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)

**Data scale (reported, conflicting)**
- "more than 575 million cultural entities" and "trillions of data points" (Feb 2024) — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/)
- "3.7 billion lifestyle entities and trillions of anonymized behavioral signals" (Feb 2024, Forbes, as cited by Wikipedia) — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)
- 2026 hackathon brief: "250M+ entities across music, film, dining, fashion, and more" — [AINave mirror of the Devpost page](https://ainave.com/events/hackathons/qloo-agentic-hackathon)

### Inferences
- AYTO's core read ("what this city loves beyond the rest of the country") maps onto documented primitives: `signal.location.query=<city>` for the city's taste, `filter.exclude.location.query` or a country-level `signal.location` for the baseline, `filter.popularity` to separate affinity from mainstream popularity, and `feature.explainability` to make each name traceable. Nothing in the docs gives a native "lift vs country" number, so the lift is necessarily AYTO's own computation from two or more calls (this matches the repo's commit "Brand lift read inside the one wave response").
- "Under-served" has a documented supply measure only for places (`filter.tags` + `filter.location` + radius gives a count of existing venues); for media types (film, book, podcast, game) "under-served" must be proxied by affinity-high/popularity-low, which the API supports via `filter.popularity.max` and the heatmap's separate `affinity` vs `popularity` fields.
- `heatmap.dimensions` (quality/price_level/hotel_class) and `filter.references_brand` are documented but rarely used by hackathon entries, so ideas built on them will read as non-obvious to judges.
- The 429 error schema on the compare endpoint confirms rate limiting exists even though numbers are unpublished; cache aggressively (explicitly allowed).

### Gaps
- No official page describing `@qloo/qloo-harness` tools or the `urn:demographics` / `urn:tag` output modes was fetchable; the Entity Type Parameter Guide URL I tried was 404 (the API overview links it as "Entity Type Parameter Guide", so it exists under another slug).
- No published rate-limit or quota numbers anywhere.
- The compare endpoint's result fields (delta, per-group affinity) are defined in referenced YAML files not shown on the page.

---

## KQ2. Who are Qloo's known customers and what do they use it for?

### Takeaway
Qloo's named customers are concentrated in media (Netflix, UMG), hospitality/travel (Michelin, Tablet Hotels), out-of-home advertising (JCDecaux), CPG/retail (PepsiCo, Hershey's, Starbucks, a jewellery brand), live events (Live Nation, Ticketmaster), finance (American Express) and real estate (Clarion Partners). The documented use cases are overwhelmingly "decide what to put where" (playlists, assortments, merchandising, ad placement, leasing), which is the same shape as AYTO, not consumer recommendation feeds.

### Cited Findings
- **Netflix**: identifies actors who resonate with certain demographics for merchandising (Inc., 2024, via Wikipedia) — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo); Qloo's own case study "Netflix and Qloo elevate merchandising with AI-driven audience insights" — [qloo.com](https://www.qloo.com/resources/netflix-and-qloo-elevate-merchandising-with-ai-driven-audience-insights)
- **Michelin**: recommendations in the Michelin Guide app (martech.org via Wikipedia) — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo); Michelin's Tablet Hotels saw a "273% booking increase during A/B testing" (Qloo's own case study, marketing claim) — [qloo.com Michelin case study](https://www.qloo.com/resources/michelin-case-study)
- **JCDecaux**: has used Qloo Taste AI since 2020 to plan hyper-localised OOH campaigns; Qloo data built into JCDecaux's Displayce platform for digital ad placement (April 2025 PR) — [PR Newswire, Apr 2025](https://www.prnewswire.com/news-releases/qloo-and-jcdecaux-use-ai-powered-taste-data-to-deliver-hyper-localized-dooh-campaigns-302419224.html); Qloo client story claims "10x ROI improvement in ad targeting accuracy and efficiency" (marketing claim) — [qloo.com JCDecaux client story](https://www.qloo.com/resources/client-stories/jcdecaux-out-of-home-targeting)
- **Starbucks**: in-store playlists tailored to neighbourhoods (TechCrunch 2024 via Wikipedia) — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)
- **Hershey's**: customises the content of assorted candy bags (TechCrunch 2024 via Wikipedia) — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)
- **Clarion Partners**: used location-level affinity data to persuade an athleisure retailer to lease on Chicago's Magnificent Mile — [qloo.com Clarion client story](https://www.qloo.com/resources/client-stories/clarion-magnificent-mile)
- **Jewellery brand (unnamed)**: enriched first-party customer data to inform marketing and expansion — [qloo.com](https://www.qloo.com/resources/unlocking-radiant-growth-for-a-leading-jewelry-brand-with-qloos-taste-ai)
- **Unnamed film studio**: layered Qloo into all media buys via a DMP; found a film would appeal to electronic-music and anime fans; "double-digit percentage increase" in trailer view-through and lower media costs (Feb 2024) — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/)
- **Unnamed advertisers**: asked "which Walmarts nationwide correlate most with Jarritos versus LaCroix" to inform distribution and media buying (Feb 2024) — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/)
- **Named without detail**: Samsung, Universal Music Group, PepsiCo (2024) — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/); NY Mets, BuzzFeed, Ticketmaster; earlier Twitter and BMW — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)
- **2026 list**: Live Nation, American Express, Match Group, Michelin, Netflix, JCDecaux (Sept 2026 Gartner press release; Samsung absent) — [PR Newswire, Sept 15 2026](https://www.prnewswire.com/news-releases/qloo-recognized-in-the-set-diamonds-category-in-the-2026-gartner-emerging-tech-ai-to-watch-in-synthetic-popular-simulation-research-302878163.html)
- Gartner 2026 profiled Qloo as one of two "Set Diamonds (Front Runners)" among 33 companies in *Emerging Tech: AI Vendor Race: Startups to Watch in Synthetic Population and Behavioral Simulation*; COO Jay Alger: "Knowing what someone may like should not require knowing who they are"; described use cases: personalised offers, digital concierges, discovery and commerce, on-device personalisation — [PR Newswire, Sept 2026](https://www.prnewswire.com/news-releases/qloo-recognized-in-the-set-diamonds-category-in-the-2026-gartner-emerging-tech-ai-to-watch-in-synthetic-popular-simulation-research-302878163.html)
- Qloo industries pages: Banking and Finance, CPG, Entertainment, Media, Real Estate, Retail, Technology; retail pitch "centers on assortment and merchandising tied to local neighborhoods" — [qloo.com/industries/retail](https://www.qloo.com/industries/retail)
- Qloo has a published policy page "How Qloo can and can't be used for ad targeting by brands and agencies" — [qloo.com](https://www.qloo.com/resources/how-qloo-can-and-cant-be-used-for-ad-targeting-by-brands-and-agencies)
- Funding: $25M Series C (Feb 2024, AI Ventures lead; AXA VP, Eldridge, Moderne); >$56M total; funds earmarked for a self-serve tool for SMBs and solo developers — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/); [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)
- CEO Alex Elias on LLMs (2024): "We see [LLMs] as a new interface over data. You still need quality data underlying that."; results are "informed guesses" — [AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/)
- Privacy: no PII; audience segments built from co-occurrences between lifestyle entities and anonymised signals — [Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)

### Inferences
- The strongest commercial precedents for AYTO are Starbucks (neighbourhood playlists = "city → creative output"), Hershey's (assortment by taste), Netflix merchandising (person entities by demographic), and the film-studio media-buy story (film → taste tribes). Citing these in the pitch lets AYTO say "we are the self-serve version of what Qloo already sells to Netflix and Starbucks".
- Live Nation is both a customer and the employer of a 2026 judge (Michael Abrams), so live-event/tour angles will be read knowledgeably — a risk for shallow tour-routing demos and an opportunity for a sharp one.

### Gaps
- Hearst: no source found naming Hearst as a Qloo customer.
- No independent (non-Qloo, non-press-release) verification of the 273% and 10x figures.
- Forbes 2024 article (customer detail, bias controls) returned 403; its claims are only available second-hand via Wikipedia.

---

## KQ3. What did the 2025 Qloo LLM Hackathon winners build, what pattern do they share, and which patterns are overdone?

### Takeaway
The 2025 winners were all decision tools for a professional, not consumer recommenders: GeoTaste (location → business consulting), Alloy (cultural due diligence for M&A), Resonance AI (political campaign messaging), Zesty (an "unrecommendation" engine). Travel/dating/dinner-planner apps were plentiful in the gallery but did not place.

### Cited Findings
- 2025 event: "Qloo's first global hackathon, a month-long event" on Devpost; ran July 1 – August 1, 2025; $10K grand prize, $5K runner-ups; judges listed as Jason Calacanis, Todd Boehly, Cedric the Entertainer, Nicole Seligman "+ more" — [Qloo on X, July 2025](https://x.com/Qloo/status/1943015473031029181); [Devpost rules page (title snippet)](https://qloo-hackathon.devpost.com/rules)
- Winners announced Sept 8, 2025: "From 2,893 global participants, four projects stood out: 1st Place: GeoTaste" ($10,000); honourable mentions Alloy, Resonance AI, Zesty ($5,000 each); the rules had originally set the announcement for ~Aug 18, then Aug 25 — [Qloo on X, Sept 2025](https://x.com/Qloo/status/1965110790400151775)
- **GeoTaste** — "Your Business Consultant Agent": turns location data into business insights; "market analysis, competitive intelligence and interactive visualizations from your AI agent, powered by Qloo's global business database" (Devpost gallery snippet) — [Devpost project gallery](https://qloo-hackathon.devpost.com/project-gallery)
- **Alloy** — "Cultural Due Diligence 2.0": a "financial-grade intelligence platform" for M&A, VC and corporate strategy; a "Cultural Compatibility Score" "calculated from millions of audience taste data points" via Qloo Taste AI; Gemini ReAct agent plus Tavily web grounding; dashboard, report-aware chat, PDF reports; repo About says "Winner Qloo LLM Hackathon" — [MR-GREEN1337/alloy](https://github.com/MR-GREEN1337/alloy)
- **Resonance AI** — described in the Devpost gallery as political campaign messaging (a separate GitHub "resonance-qloo" is a senior-living engagement planner and may be unrelated) — [search summary of Devpost gallery](https://qloo-hackathon.devpost.com/project-gallery); [P00NSMASHER/resonance-qloo](https://github.com/P00NSMASHER/resonance-qloo)
- **Zesty** — an "unrecommendation engine" meant to flip a user's feed; a developer profile lists a Qloo honourable mention for an "Opposite Taste Engine" (link to Zesty unconfirmed) — [search summary of Devpost gallery](https://qloo-hackathon.devpost.com/project-gallery)
- A sample 2025 entry, "taste-concierge": "Agentic cultural outing planner built on Qloo's Taste AI API" — [Abhi4899/taste-concierge](https://github.com/Abhi4899/taste-concierge)

### Inferences
- Pattern among winners: (1) a named professional buyer (consultant, M&A analyst, campaign strategist), (2) Qloo used to produce a *score or comparison* rather than a list of recommendations, (3) a contrarian or counter-intuitive twist (Zesty inverts the recommender). Only one of four (GeoTaste) is location-centred; none is a travel itinerary, dating or group-dinner app, though those genres dominate the gallery.
- Overdone (2025 gallery + 2026 repos found): evening/outing concierges (two separate "taste-concierge" repos, "weekend city concierge"), two-person taste overlap/dating, group dinner negotiators, generic cross-domain recommenders, gift finders. These are also exactly the ideas the 2026 third-party guides suggest, so expect a crowded field there.
- AYTO already matches the winning shape (a professional creator, a gap score, a traceable receipt). Its risk is being read as "another location recommender" if the gap maths is not visibly central.

### Gaps
- 2025 judging criteria and judge commentary: the Devpost rules/gallery pages returned 403, and no article quotes judge feedback. Whether judges "praised" particular aspects is unknown.
- Team names and tech stacks for GeoTaste, Resonance AI and Zesty were not retrievable.

---

## KQ4. The 2026 Qloo Agentic Hackathon: themes, judging, prizes, agentic expectations, organiser hints, and the field so far

### Takeaway
"Agents, but with taste": $25K cash (15/6/4) plus a reported $25K Calacanis investment, deadline Oct 30 2026 11:45pm EDT, no demo video but a hosted live demo and open-source repo required, four equally weighted criteria, and one organiser test that appears everywhere: would the project work just as well without Qloo? The 2026 field already contains at least three entries adjacent to AYTO (TasteRouter, Open Slot, Taste Match), so AYTO's differentiation must be the gap maths and the creative writer, not "Qloo + place".

### Cited Findings
- Event: "Qloo Agentic Hackathon: Agents, but with taste." on Devpost; runs Sept 30 2026 9:30am EDT to Oct 30 2026 11:45pm EDT; online — [qloo.devpost.com (title)](https://qloo.devpost.com/); [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon)
- Task: build a working application that integrates the Qloo API and either "functions as an agentic tool, is built using an agent framework, or wires Qloo into an agent you already have" — [search summary of Devpost page](https://qloo.devpost.com/)
- Organiser expectation: "Qloo should be central to the project's value… apps whose results are meaningfully better because they use Qloo, not demos that would work just as well without it" — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon); the central test is "whether the project would work just as well without Qloo" — [The GenAI Magazine, Oct 20 2026](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas)
- Prizes: $25,000 cash — 1st $15,000, 2nd $6,000, 3rd $4,000; one winner per placement — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon); a further "$25,000 bonus investment from Jason Calacanis" is listed by a GitHub mirror and described by GenAI Magazine as an investment with no published terms; I could not confirm it on Devpost directly — [kevin9327/DevpostQlooTasteAgent2026](https://github.com/kevin9327/DevpostQlooTasteAgent2026); [The GenAI Magazine](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas)
- Judges: Jason Calacanis; Mike Diolosa (Qloo); Nicole Seligman (OpenAI board); Todd Boehly (Eldridge); Cedric the Entertainer; Michael Abrams (Live Nation Entertainment) — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon)
- Finals: "On November 5th, the Top 3 Finalists will appear on air with Jason Calacanis, Cedric the Entertainer, and Alex Elias, who will pick the winner" (Devpost snippet) — [search summary of qloo.devpost.com](https://qloo.devpost.com/); GenAI Magazine instead reports judging Nov 2–16 and winners ~Nov 23 — [The GenAI Magazine](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas) (conflict; Devpost snippet is the more primary source)
- Judging criteria (no weights on the mirror): "Technological implementation and use of Qloo"; "Completeness and coherence of the product experience"; "Potential impact for a real audience"; "Creativity and quality of the idea" — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon); GenAI Magazine says an initial viability check (uses the required API) then four equally weighted criteria — [The GenAI Magazine](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas)
- Submission requirements: live working demo judges can use end to end; public GitHub/GitLab/Bitbucket repo with source, run instructions and an open-source licence; written explanation of "what makes the project Qloo-powered"; externally hosted and fully published (live site, hosted APK or TestFlight); local-only or private-access demos do not qualify; "NOTE: Demo videos are not required. Instead of asking for a recording, we're requiring something judges can actually use." — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon); [kevin9327 mirror quoting the rule](https://github.com/kevin9327/DevpostQlooTasteAgent2026)
- Example ideas on the official page: room lighting suited to a customer's mood and taste; meal recommendations for seniors with constraints; helping people on rare-disease journeys find information and community; no formal tracks or themes — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon)
- Eligibility: age of majority; excludes Brazil, Crimea, Cuba, Iran, North Korea, Quebec, Russia; multiple submissions must be "unique and substantially different"; existing projects qualify if substantially updated during the competition — [The GenAI Magazine](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas)
- Participant counts reported between 2,283 and 2,660 at different capture times — [search summary](https://qloo.devpost.com/)
- Ten suggested ideas from a third-party guide (not Qloo): weekend city concierge; group dinner negotiator; book-to-film club planner; podcast discovery for readers; brand partnership research assistant; neighbourhood fit explorer for travellers; gift research agent; game-night agent; cafe soundtrack curator; film-inspired trip agent — [The GenAI Magazine](https://thegenaimagazine.com/qloo-agentic-hackathon-2026-prizes-deadline-ideas)

**2026 entries already public on GitHub (the field AYTO is judged against)**
- **TasteRouter** (closest to AYTO): "find the neighbourhood that already loves your idea"; input a free-text brief (concept, city, references); outputs a Taste-Fit Score 0–100 = 40% taste depth (mean heatmap affinity within 1.5 km) + 30% audience overlap (top-3 taste-matched venues within 900 m) + 30% white space (1 − category saturation); three "regulars" portraits, opening-night story, competitor counts, tour mode ranking cities for an artist; custom agent loop (plan, ground, reflect, fan out, adapt, scout, score, write, story); Llama 3.3 70B / gpt-oss-120b on Cloudflare Workers AI or any OpenAI-compatible endpoint; MCP server with `scout_location`, `plan_tour`, `resolve_seeds`, `concept_tags`, `taste_dna`, `audience`, `hotspots`, `scout_hotspot`, `programming`; auditable trace with live call counter; "A grounding validator rejects names not present in that run's Qloo results"; permalinks kept 120 days; PDF; limitation: "Affinity measures taste concentration, not rent, zoning, or foot traffic" — [happy520ai/taste-router](https://github.com/happy520ai/taste-router)
- **Open Slot**: a venue gives 2–6 acts that sold well; agent finds acts whose audiences overlap, using `/v2/insights` with `feature.explainability=true` (up to 50 candidates), `/v2/trending` per candidate labelled rising/steady/fading, `/v2/tags`; evidence cards, "not a score"; "No language model runs inside the app"; five human-only actions not registered as agent tools; MCP stdio relay; README says not yet run with a real key — [guptachetan1995/open-slot](https://github.com/guptachetan1995/open-slot)
- **Taste Match / qloo-mcp**: MCP tools `search_entities, search_tags, list_audiences, get_insights, get_demographics, get_taste_analysis, taste_match`; for independent artists: description → seven parallel insight calls (artists, places in a city, brands, books, movies, demographics, tags) → audience report and pitch; optional OpenAI-compatible LLM with deterministic fallback — [NoBanks/qloo-mcp](https://github.com/NoBanks/qloo-mcp)
- **SponsorMatch**: ranks brands an event's audience loves and drafts sponsor pitches via the Qloo harness (`qloo_describe`, `qloo_rank`) — [alexespinoza28/sponsormatch](https://github.com/alexespinoza28/sponsormatch)
- **Advance**: tour routing for indie bands and comedians — [JoeProAI/advance](https://github.com/JoeProAI/advance); **Opener** — [softalpha0/Opener](https://github.com/softalpha0/Opener)
- **TasteCase**: release testing for AI restaurant concierges; Qloo finds cases where guests with different tastes split; approved cases become regression tests — [CryptoZephyr/tastecase](https://github.com/CryptoZephyr/tastecase)
- **miawab/qloo**: helps theatre producers pick which film to adapt into a stage musical using audience taste data — [miawab/qloo](https://github.com/miawab/qloo)
- **Adjacent Cinema**: "Comparables Audit, Impact Lab, Audience Pulse and MCP" — [Sohamgaonkhadkar/adjacent-cinema PR #21](https://github.com/Sohamgaonkhadkar/adjacent-cinema/pull/21)
- **TasteOps**: "Cultural Intelligence Operating System for Physical Spaces" — [maitray-agrawal/TasteOps](https://github.com/maitray-agrawal/TasteOps)
- **Then & There**: reminiscence session planner for caregivers — [midexol/then-and-there](https://github.com/midexol/then-and-there); **QlooTasteWeaver**: senior culinary concierge, room-mood lighting, rare-disease navigator (mirrors the three official example ideas) — [kevin9327/DevpostQlooTasteAgent2026](https://github.com/kevin9327/DevpostQlooTasteAgent2026)
- **Taste Overlap** (two people → shared places) — [Sooonic008/taste-overlap](https://github.com/Sooonic008/taste-overlap); **Taste Check** (MCP + Reddit Devvit taste-guessing game) — [iromath/qloo-taste-check](https://github.com/iromath/qloo-taste-check); **Qloo Workbench** (MCP: resolve a taste phrase, confirm a tag, grounded shortlist) — [hgyu-mech/qloo-workbench](https://github.com/hgyu-mech/qloo-workbench); **TastePilot** (taste-aware planning agent) — [ToniAdreal/tastepilot](https://github.com/ToniAdreal/tastepilot); **CultureHub** — [Devpost](https://devpost.com/software/culturehub-qloo); **drip-ai-sneaker-stylist** (issue mentions "original-moat test, 5-judge acceptance gates") — [vaibhav4046 issue](https://github.com/vaibhav4046/drip-ai-sneaker-stylist/issues/1)

### Inferences
- The field has converged on three motifs: (a) evidence/receipts and grounding validators (TasteRouter, Open Slot), (b) human-in-the-loop approvals (Open Slot, TasteCase), (c) an MCP surface (TasteRouter, Taste Match, Open Slot, Workbench). AYTO's "every name traces to a Qloo request" and "MCP door" are therefore table stakes in 2026, not differentiators.
- What nobody in the found set does: compute a *city-vs-country lift* and write the creative work *into* the gap. TasteRouter answers "where does my idea fit" (idea → place); AYTO answers "what should I make here" (place → idea). That inversion is the clearest thing to state on the Devpost page.
- Judge mix (a VC, an OpenAI board member, a Live Nation exec, a comedian/actor, Qloo's own) favours entries with a plausible buyer and a visible, operable demo over clever architecture; "Completeness and coherence of the product experience" is a quarter of the score, so an unfinished format is worse than one fewer format.
- The on-air finals (Nov 5, per Devpost snippet) reward a demo that is legible in 60 seconds: one city, one theme, one output, one receipt.

### Gaps
- Official Devpost rules text (weights, exact criteria wording, Calacanis investment terms) could not be fetched directly (403); all of the above is from mirrors and snippets.
- No organiser blog post or Qloo interview specifically about what they want from "agentic" entries beyond the page copy; no 2026 Alex Elias interview found.

---

## KQ5. Catalogue of alternative or extension ideas that use Qloo deeply

Each entry uses the same fields. "Qloo calls" use documented parameter names. Difficulty is for a two-person, two-day build on top of AYTO's existing engine (place + theme → gap → LLM writer, receipts, MCP). Non-obvious = how far it is from the crowded concierge/tour/dating cluster. "Status in field" says whether a 2026 entry already does it.

### Takeaway
Sixteen ideas; six are drop-in AYTO formats that reuse the city-gap read with a different `filter.type` or output, five are mid-size extensions that add one more Qloo endpoint (compare, trending, heatmap dimensions, person entity), and five are genuinely different products already represented in the field.

### Cited Findings (the capability each idea leans on is cited; the idea itself is inference)

1. **Casting & cameo localiser** — For: a short-film / web-series maker. Qloo calls: `/v2/insights` `filter.type=urn:entity:person` with `signal.location.query=<city>`, `signal.interests.tags` from the film's genre, `filter.gender`, `feature.explainability`; baseline run with country-level location for lift. Why not without Qloo: an LLM cannot know which actors, hosts or comedians over-index in Hyderabad vs India; Netflix pays Qloo for exactly this read ([Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)). Difficulty: Low (new entity type in the existing engine). Non-obvious: High. Status: not seen. Extension.

2. **Two-city port ("make it work in Las Vegas")** — For: a creator moving a finished idea between cities. Qloo calls: `/v2/analysis/compare` with `a.signal.interests.entities` = city-A top entities, `b.` = city-B, `filter.subtype=urn:tag:genre`; per-city insights for analogue names ([Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1)). Why not without Qloo: analogues ("the Hyderabad biryani joint is the Vegas late-night taco stand") need affinity data, not vibes. Difficulty: Medium (compare response shape not fully documented). Non-obvious: High. Status: not seen. Extension (uses AYTO's existing diff/edit-and-rerun UI).

3. **Gap watch (agentic, scheduled)** — For: a creator who wants to know when a gap opens or closes. Qloo calls: `/v2/trending` weekly `population_rank_velocity` / `velocity_fold_change` for the gap's anchor entities ([Get Trending](https://docs.qloo.com/reference/get-trending)); re-run the gap read and diff. Why not without Qloo: trend series per entity is the data. Difficulty: Medium (cron + diff already exists in repo). Non-obvious: High; also the only idea here that is "agentic" in the autonomous sense. Status: Open Slot labels rising/steady/fading per candidate but does not watch over time ([open-slot](https://github.com/guptachetan1995/open-slot)). Extension.

4. **Multi-city ad-creative localiser** — For: a brand marketer with one campaign and N cities. Qloo calls: per-city insights across artist/movie/tv_show/brand with `signal.location.query`, `feature.explainability`; `/v2/analysis/compare` between city pairs. Why not without Qloo: JCDecaux's DOOH placement is Qloo-powered; creative localisation is the unbuilt half ([Qloo JCDecaux client story](https://www.qloo.com/resources/client-stories/jcdecaux-out-of-home-targeting)). Difficulty: Low-Medium (N× existing run + a table view). Non-obvious: Medium. Status: not seen. Extension.

5. **Release-city plan for a film or series** — For: an indie distributor. Qloo calls: `urn:heatmap` with `signal.interests.entities` = comparable films/tags over a country-scale `filter.location` ([Heatmaps use case](https://docs.qloo.com/reference/heatmaps-use-case)); `filter.release_country`, `bias.trends`; rank cities, write a per-city hook. Why not without Qloo: the film-studio case (anime + electronic fans, double-digit trailer lift) is the precedent ([AdExchanger](https://www.adexchanger.com/ai/qloo-snags-25-million-in-series-c-funding-to-unravel-the-mystery-of-consumer-tastes/)). Difficulty: Medium (many localities). Non-obvious: Medium-High. Status: Adjacent Cinema's "Comparables Audit" is near but film-side, not city-side ([adjacent-cinema](https://github.com/Sohamgaonkhadkar/adjacent-cinema/pull/21)). Extension.

6. **Café / bar menu + playlist gap** — For: a café owner. Qloo calls: place insights with `filter.tags` (cuisine tag from `/v2/tags`) + `filter.location` + radius for supply count; artist insights with `signal.location.query` for the playlist; `urn:demographics`. Why not without Qloo: Starbucks' neighbourhood playlists are the precedent ([Wikipedia: Qloo](https://en.wikipedia.org/wiki/Qloo)). Difficulty: Low. Non-obvious: Low-Medium ("cafe soundtrack curator" is on the third-party idea list; AYTO already has Campaign Soundtrack). Status: TasteRouter covers the venue-fit half. Extension format.

7. **Retail assortment by city (generalised Tiruppur drop)** — For: a D2C brand. Qloo calls: brand insights with `signal.location.query`, `urn:tag` taste analysis of the locality, `urn:demographics` by age band. Why not without Qloo: Qloo's retail page sells "assortment and merchandising tied to local neighborhoods" ([qloo.com retail](https://www.qloo.com/industries/retail)); Hershey's bags are the CPG precedent. Difficulty: Low (already a preset). Non-obvious: Medium. Status: not seen in field. Existing AYTO format; keep.

8. **Hotel / stay concept finder using heatmap dimensions** — For: a boutique-stay developer. Qloo calls: `urn:heatmap` with `heatmap.dimensions=quality,hotel_class,price_level` and `filter.dimensions.hotel_class` to find cells with high quality affinity and low hotel-class supply ([Insights deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)); `filter.external.exists=tablet` for benchmarks. Why not without Qloo: the dimension columns are unique to Qloo. Difficulty: Medium-High (undocumented edge cases). Non-obvious: High (documented feature nobody uses). Status: not seen. Different product (real-estate), but same engine shape.

9. **Festival / line-up builder for a city** — For: a promoter. Qloo calls: artist insights with `signal.location.query`, `signal.demographics.age`, `/v2/analysis/compare` headliner audience vs city audience, `/v2/trending`. Why not without Qloo: Live Nation and Ticketmaster are customers ([PR Newswire Sept 2026](https://www.prnewswire.com/news-releases/qloo-recognized-in-the-set-diamonds-category-in-the-2026-gartner-emerging-tech-ai-to-watch-in-synthetic-popular-simulation-research-302878163.html)). Difficulty: Medium. Non-obvious: Low-Medium. Status: crowded — Open Slot (venue), SponsorMatch (sponsors), Advance/Opener/TasteRouter tour mode. Different product.

10. **Local podcast / newsletter episode planner** — For: a city podcaster. Qloo calls: podcast insights with `signal.location.query`; `urn:tag` taste analysis; `filter.popularity.max` to find under-served topics. Why not without Qloo: local podcast affinity vs national. Difficulty: Low. Non-obvious: Low-Medium. Status: "podcast discovery for readers" is on the suggested list (consumer side). Extension format.

11. **Indie game theme by region** — For: a game-jam team. Qloo calls: `urn:entity:video_game` insights with `signal.location.query`, cross-domain backfill (`backfill.cross_domain.take`), `bias.trends`. Why not without Qloo: regional game affinity. Difficulty: Low. Non-obvious: Medium. Status: not seen (one "game-night agent" on the consumer side). Extension format.

12. **Book / novel setting and genre gap** — For: an author or small press. Qloo calls: book insights with `signal.location.query`, `filter.publication_year`, `filter.popularity.max`; `urn:tag:genre` subtype via compare. Why not without Qloo: genre affinity per city. Difficulty: Low. Non-obvious: Medium. Status: "book-to-film club planner" and the stage-musical picker ([miawab/qloo](https://github.com/miawab/qloo)) are adjacent. Extension format.

13. **Creative-brief QA ("off-taste reference detector")** — For: an agency reviewing a script or brief before shoot. Qloo calls: resolve every named reference via `/search`, then `/v2/insights` with `signal.location.query` + `feature.explainability` to score each reference's local affinity; flag the weak ones. Why not without Qloo: per-name affinity scores. Difficulty: Medium (entity resolution of free text). Non-obvious: High. Status: TasteCase does regression tests for concierges, not briefs ([tastecase](https://github.com/CryptoZephyr/tastecase)). Extension (reverse mode of AYTO's writer).

14. **Show-to-merch line by city** — For: a studio's consumer-products team. Qloo calls: brand and person insights with `signal.interests.entities` = the show, `signal.location.query`. Why not without Qloo: this is Netflix's documented use ([qloo.com Netflix case study](https://www.qloo.com/resources/netflix-and-qloo-elevate-merchandising-with-ai-driven-audience-insights)). Difficulty: Low. Non-obvious: Medium. Status: not seen. Extension format.

15. **Site selection ("where does this concept's crowd live")** — For: a founder choosing a neighbourhood. Qloo calls: heatmap + place supply count + anchor venues. Why not without Qloo: street-level affinity ([Clarion client story](https://www.qloo.com/resources/client-stories/clarion-magnificent-mile)). Difficulty: Medium. Non-obvious: Low in 2026. Status: TasteRouter and TasteOps already do this well. Different product; avoid.

16. **Cultural due diligence / brand-fit score** — For: VC/M&A or partnership teams. Qloo calls: compare two brands' audiences, demographics. Why not without Qloo: audience overlap. Difficulty: Medium. Non-obvious: Low (Alloy won with it in 2025 ([MR-GREEN1337/alloy](https://github.com/MR-GREEN1337/alloy)); SponsorMatch does the event version). Different product; avoid.

### Inferences
- Ideas 1, 2, 3, 4, 5 and 13 add something the 2026 field lacks and stay inside AYTO's three inputs (place, theme, LLM writer). Ideas 6, 7, 10, 11, 12, 14 are cheap new formats (a different `filter.type` through the same gap read) and mainly add breadth. Ideas 8, 9, 15, 16 are different products, and three of them are already crowded.

### Gaps
- Difficulty ratings assume the `urn:demographics` / `urn:tag` output modes and `heatmap.dimensions` behave on the hackathon gateway as third-party READMEs describe; not verified.

---

## KQ6. Which 3–5 ideas are the strongest extensions to AYTO's engine, versus different products?

### Takeaway
Strongest extensions, in order: Casting localiser (1), Two-city port via compare (2), Gap watch via trending (3), Multi-city ad-creative localiser (4), Creative-brief QA (13). Site selection, venue booking, tour routing, sponsor matching and cultural due diligence are different products that are already represented in the 2025 winners or 2026 repos and should be named as "not us" on the submission page.

### Cited Findings
- Judging emphasises "use of Qloo", "completeness and coherence of the product experience", "potential impact for a real audience", "creativity and quality of the idea" — [AINave mirror](https://ainave.com/events/hackathons/qloo-agentic-hackathon)
- The field's closest neighbour, TasteRouter, routes an idea to a place and explicitly disclaims "rent, zoning, or foot traffic" — [happy520ai/taste-router](https://github.com/happy520ai/taste-router)
- Compare, trending, explainability and person-type insights are documented endpoints/params — [Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1); [Get Trending](https://docs.qloo.com/reference/get-trending); [Insights deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)

### Inferences
- **Casting localiser (idea 1)** is the best single addition: one new `filter.type`, a buyer judges understand (Cedric the Entertainer is an actor; Netflix precedent), and every name is a Qloo entity with an explainability score — it makes "every name traces to a Qloo request" visible on screen.
- **Two-city port (idea 2)** is the most "agentic-feeling" for a demo: the agent carries an idea from Hyderabad to Las Vegas and shows the analogue table; it reuses AYTO's diff view and the `/v2/analysis/compare` endpoint that almost no entry touches.
- **Gap watch (idea 3)** is the only idea that is agentic in the "runs without you" sense and uses the one endpoint (`/v2/trending`) with time in it; even a stubbed weekly re-run with a diff screenshot answers "why an agent?".
- **Ad-creative localiser (idea 4)** scales the existing run across cities and has the clearest paying customer (JCDecaux-adjacent agencies), but adds less new Qloo surface.
- **Creative-brief QA (idea 13)** is the strongest "reverse mode" and would let AYTO claim both directions (write into the gap; check against the gap), but free-text entity resolution is the riskiest part in two days.
- Different products to name and exclude: site selection (TasteRouter/TasteOps), venue booking (Open Slot), tour routing (Advance/Opener/TasteRouter tour mode), sponsor matching (SponsorMatch), due diligence (Alloy, 2025 winner), concierge/dating/group-dinner (many).

### Gaps
- No judge commentary exists to confirm which of these would score highest; the ranking is inference from the published criteria and the observed field.
