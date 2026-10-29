# AYTO (Are You The One) — project context for Claude Code

Hackathon entry for the Qloo Agentic Hackathon (qloo.devpost.com). Deadline **30 Oct 2026, 11:45 pm ET = 31 Oct, 9:15 am IST**.
The full design is in PLAN.md (28 Oct 2026). README.md is the public write-up. The repo/folder is still named culture-gap.

## The idea (one line)
Tell AYTO what you're making and where. Qloo reads what that city's people love beyond the rest of the country and finds the gap
(loved here, under-served). Your own LLM writes the idea into that gap: a film, a reel, or a fashion drop. Every name traces to a
Qloo request (receipts). Never "hit"; always "built on what this city already loves".
Lead audience (28 Oct 2026, from reports/AYTO market ideas and clients.md): the Hyderabad short-film maker and the production house
behind them; reel and fashion are the same engine in other formats. The with/without Qloo card is never cut (it answers the judges' test).

## Judging (4 equal criteria)
Uses Qloo deeply · complete product · real problem for a real audience · non-obvious idea.
Organisers: "If your submission would work the same without Qloo, you're building the wrong thing."
Must ship: live hosted app (no login), public repo with OSS licence visible in About, text description.

## Stack
Node 22 + Express, vanilla JS front end (public/), SSE streaming, file cache (.cache/, git-ignored).
Qloo via `@qloo/qloo-harness` (`qloo mcp` stdio for workflow tools, `qloo api search` for localities, raw HTTP Insights for
heatmaps, tag reads and tagged entity reads). LLM: provider table in src/llm.js (12 providers, OpenAI-compatible + Anthropic adapter);
server default is Groq. MCP door in src/mcp.js. Hackathon host: https://hackathon.api.qloo.com.

## Code map
- src/formats.js: formats (film, reel, fashion, podcast, game, cafe, event, book), their entity types and stage plans, stage labels, parse hints.
- src/parse.js: sentence → input (model or rules) + Qloo candidates for the confirm step.
- src/engine/: resolve, read (three columns), gap (demand lift + supply from a tagged catalogue read), audio, spots, audience, travels;
  where.js ("Where should I make it?": one theme across a market's 10 largest cities, peerLift = lift − 70th pct of the others; POST /api/where, MCP ayto_where_to_make).
- src/writers/: one prompt per format + evidence digest + grounding paths (shared.js). src/pipeline/produce.js: fashion production path.
- src/pipeline/: runner (per-run plan, edit-and-rerun, regenerate), store, evidence (ledger), write, check, diff, share, page.
- src/llm.js (providers, redactor, boot probe), src/keys.js (per-run credentials, memory only), src/mcp.js, src/server.js.
- src/analysis.js: heat/lift maths from the first build + threeColumns, demandLift, laneGap, averageSkew, cleanPlaceName.
- src/fake-qloo.js: synthetic data for CULTURE_GAP_MODE=fake (labelled, never real Qloo data).
- test/: node --test; pipeline.test.js runs all showcases end to end in fake mode.

## Gap formula (src/engine/gap.js, src/analysis.js)
demand lift = country rank − city rank of a flavour tag (tag read with the theme as signal, parents = the format's entity type).
supply = recent (last 4 years) titles in the city's themed catalogue (raw entity Insights, with tags) that carry the flavour.
Control cities (3 from CANDIDATE_CITIES, not the city or contrast): specific lift = lift − median(control lifts); lanes rank on it
(scope "this city" ≥ 8, "leans here" ≥ 3, else "most cities"). gap = (lift/30) × (1 − min(recent,10)/10). A lane must exist in the
catalogue at least once unless specific ≥ 10 (then zero supply is the open lane). A control that does not list a flavour
counts as lift (countryRank ?? 31) − 31, i.e. 0 when the country lacks it too (specificLift in src/analysis.js). Compare only within one response.
Look stage (src/engine/look.js): film = style-tag share lift between city and country catalogues + style_description quotes;
fashion = aesthetic/personal_style typed tag lift + material/age/segment share lift on fashion labels + the loves' own tags.
Research behind this: /home/dev/hackthons/culture-gap/research.txt (29 Oct 2026, another session; verified live).

## Hard rules
- Never commit keys. `.env` is git-ignored. Never commit Qloo response data (.cache/, samples/qloo/, probe-out/ are ignored).
- User LLM keys live in memory for one run (src/keys.js) and never reach a run file, event, cache or log. Redact errors.
- Every name in the written output must come from a Qloo request (check stage removes the rest).
- No personal data to Qloo. Aggregate taste only. Say "signal"/"affinity", never "will sell"/"hit".

## Known API facts (verified live 27–28 Oct 2026)
- `qloo_recommend`: `include_tags` = filter, `signal_location` = signal; tag as a signal gets swamped by the location. The tool rejects
  `include_tags_operator: "and"`; raw Insights takes `operator.filter.tags=intersection`.
- Recommend results carry no `tags`; raw entity Insights results do. Affinity tags (genre:qloo:*) mostly are not entity tags, so
  `filter.tags` on them returns nothing; keyword:media:* tags do filter.
- Affinity is flat at the top (0.98–1.00): rank by set differences and affinity − popularity, never raw affinity.
- Heatmaps: `output.heatmap.boundary` = `urn:geohash` (the locality form returns the whole country, 125 MB). Snap cells to
  localities found by search (src/cities.js). Search often has only districts; displayName() cleans for display, Qloo's name stays.
- Tag reads: `filter.type=urn:tag` + `filter.parents.types=urn:entity:<type>` + `signal.location.query` works; `signal.interests.tags`
  for the theme, or `signal.interests.entities` for loves.
- `/v2/trending` is frozen (flat series). Unsupported params return 200 with empty results.
- Place recommendations include junk names; cleanPlaceName() drops them and the card reports how many.
- Location text fails silently for some cities and types ("Mumbai, India": 0 artists, needs_input for places). placeLabel() adds the
  state ("Mumbai, Maharashtra, India"); raw Insights use the locality id (signalLocation()). The recommend tool rejects ids (400).
- Tags are typed: genre:media:* filters no artists; genre:music:* / genre:qloo:* do. themeTagIdsFor(run, type) picks per type.
- Empty answers (results [], needs_input) are cached in memory for 10 minutes only, never on disk (isEmptyAnswer in qloo.js).
- Lane strength = min(lift over country, specific lift over controls); lanes rank on it.
- Qloo names carry stray spaces (" Hip Hop" is genre:music:hip_hop). Of the 12 hip hop tags only genre:music:hip_hop,
  genre:qloo:hip_hop and subgenre:qloo:hip_hop filter artists. For films "cricket" filters only as keyword:media.
  The read tries up to five of the theme's tags per kind (themeTagOptions), then seeds the section (seedOffTheme in
  read.js): search for content kinds, on-theme picks for people. Music is never seeded.
- Recommendation results carry no akas and no date_of_death; /entities has both (latinNames, markDeaths in read.js).
- Lanes are read on laneTypeFor(run, types): the first type whose families hold a tag with the theme's own name.
- Titles share names across an original and its remake: Telugu "HIT" (2020) carries the alias "Hit: The First Case", the name of
  its 2022 Hindi remake, and qloo_describe picks the exact name (the remake). resolve searches and ranks hits (rankTitleOptions in
  src/engine/resolve.js): typed year, original over remake ("remake of" in the description), the city's language
  ("<Language>-language" in the description, cityLanguages by state/market), then name. The confirm step lists the options.
- Place recommendations carry no coordinates and no tags; address, geocode.name, short_description and price_level are there.
  spots reads the area from the address (areaOf), the shoot base is the area with most venues, homes/clinics/consulates are dropped.
- Avoid list (gap.js avoidFrom): never a flavour carried by >=20% of the themed catalogue, a sibling genre of the theme, or a word
  the maker typed (a short film is never told to avoid "Short").

## Run
npm install · npm start (live if QLOO_API_KEY) · CULTURE_GAP_MODE=fake npm start · npm test · PORT=8787 locally (8080 is taken on
this machine; .claude/launch.json starts it). Showcases: POST /api/runs {showcase:"hyderabad-crime-film"|"vegas-reel"|"tiruppur-kidswear"}.
PREWARM=1 runs them at boot. Scratch probes live outside the repo.

## Status (29 Oct 2026, 03:30 IST)
Done and on GitHub main (devreddy1015/ayto-qloo, MIT detected): engine, eight formats (film, reel, fashion, podcast, game, cafe,
event, book), writers with a rewrite-once loop, check, diff, share, produce stage (fashion), 3D garment viewer (public/garment3d.js),
BYOK with 12 providers (Anthropic adapter carries tool calls), MCP door, fake mode, 77 tests, dark infinite-canvas UI. Writers survive broken model replies (parseModelJson, normalizePlan; test/llm-e2e.test.js). LLM_PROVIDER=local + LLM_BASE_URL for a server-side local model. CHANGELOG.md lists every change by PR.
29 Oct 14:30 IST: after a side-by-side with itsgiving (a friend's Qloo film tool), the film writer returns a full treatment (beats,
characters, borrow per reference, shoot base, locations, camera, palette; budget aware) and the film plan has the spots stage.
Blocked on the user: an LLM key on this box (every attempt to add ANTHROPIC_API_KEY to the worktree .env left the file unchanged;
the user's terminal and my tools are both on host voldmart, cause unknown) and the deploy (no host account yet; Render blueprint,
Railway or Fly from the Dockerfile). The writers have never run against a real provider. Next: deploy with the key as a secret,
read the showcases from the live API, fix prompts, live URL into README, Devpost form from docs/SUBMISSION.md.
