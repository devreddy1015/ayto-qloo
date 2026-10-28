# AYTO — Are You The One

**Full application plan. v1, 28 Oct 2026.** Nothing here is built unless it says *exists*.
Qloo Agentic Hackathon. Deadline 30 Oct 2026 11:45 pm ET (31 Oct 09:15 IST). Target submit: 30 Oct 11 pm IST.

---

## 0. One line

**Tell AYTO what you're making and where. Qloo reads what that city's people love and finds the gap. Your own LLM writes the idea into that gap.**

- Making a crime short film in Hyderabad → a title, a lane, a story, references, a composer shortlist.
- Making a reel in Las Vegas → a hook, a title, the song, the spot, the caption.
- Making a kidswear drop in Tiruppur → a design brief, brands to study, first cities.

One input. One engine. The output changes with the format. Every name on the page comes from a Qloo call you can open. It never says "hit"; it says "built on what this city already loves".

**Lead audience (decided 28 Oct 2026 from the research report):** the Hyderabad short-film maker and the production house behind them. The reel and the drop are the same engine in other formats and stay as showcases. See reports/AYTO market ideas and clients.md.

---

## 1. Why we are rebuilding

What the current build gets wrong (seen in the recorded live runs, 27 Oct):

| Problem | Effect |
|---|---|
| Fashion hard-coded into the form and all 11 stages | "I want to make a movie" has nowhere to go |
| 11 fixed stages, 9 of them pure LLM | Judges' warning: "would work the same without Qloo" |
| LLM key invalid since day one | Every kit is placeholder text |
| Free text with no confirmation | "i wana make a film in delhi" became a TV show and shipped a page |
| Tag used as a *signal* with a location | Location swamps the tag: "crime + Hyderabad" returned Borat and Little Women |
| Raw affinity used as ranking | Flat at 0.98–1.00; ranking is noise |
| Fashion heatmap mostly empty | "Gap" collapsed to "culture lift" |
| Noisy place names | "Mangaluru taluk", "Car Heaven", an ambulance phone number |

What we keep: the runner (state machine, SSE, edit-and-rerun), the receipts ledger, the Qloo access layer, the city snapping, the lift maths, the design system, the Ask box.

---

## 2. Judging fit

| Criterion | How AYTO answers it |
|---|---|
| Uses Qloo deeply | Every step is a Qloo move: locality resolve, tag resolve, city vs country vs contrast city lists, flavour over-index, supply count, audience, audio, spots, heatmap lift. Receipts for each. |
| Complete product | Input → confirm → run → written output → share page. Three showcases. BYOK LLM. MCP door. Caps. Sample mode. |
| Real problem, real audience | **Lead audience: the Hyderabad short-film maker and the production house behind them.** India greenlit ~1,972 films and 274 streaming originals in 2025; only six Telugu releases succeeded; the research they already buy (Ormax) starts after a film is announced. AYTO works before greenlight: loved here, under-made. Reel creators and small makers are the same engine in other formats, shown as demos. |
| Non-obvious | The gap: what a city loves and is not getting. City vs city difference (Hyderabad ≠ Mumbai). Hidden gems: high affinity, low popularity. |

Organisers' test: *"If your submission would work the same without Qloo, you're building the wrong thing."* The with/without diff stays in, as a card, because it answers exactly that.

---

## 3. Three showcase runs

| Showcase | Input sentence | Format | Theme | City |
|---|---|---|---|---|
| Crime film · Hyderabad | "I'm making a crime short film in Hyderabad." | film | crime | Hyderabad, India |
| Reel · Las Vegas | "I make reels in Las Vegas. Nightlife and food." | reel | nightlife, food | Las Vegas, United States |
| Kidswear · Tiruppur | "I run a small kidswear unit in Tiruppur. KPop Demon Hunters is everywhere." | fashion | (loves: KPop Demon Hunters) | Tiruppur, India |

Prewarmed at boot so judges never wait. Recorded as synthetic samples for no-key mode.

---

## 4. The user's journey

1. **Home.** One sentence. Three chips underneath: *Format* (Reel · Short film · Feature film · Fashion drop · Other), *City* (text, Qloo-resolved), *Theme* (optional, Qloo-resolved). A small "Use my own LLM key" drawer. Three showcase buttons.
2. **Confirm.** Before anything runs: "Qloo found → **Hyderabad** (Telangana, India) · **Crime** (genre) · Format: short film." Each is editable; a city or theme Qloo cannot find blocks the run with "Did you mean…". This kills the nonsense-in, confident-out failure.
3. **Run.** Left rail: the steps *for this format only* (4–7, not 11). Centre: one card per step as it lands. Right: receipts, every Qloo request, click to open.
4. **Result.** The written thing, big. Every name carries a chip "from Qloo". Buttons: Copy · Regenerate with my key · Share.
5. **Share page** `/s/:slug`. Static, no scripts, the output plus an evidence summary and the receipt count. (*exists* as the drop page; re-skinned.)
6. **Ask.** "Which of these composers is strongest in Vizag?" The tool-calling analyst (*exists*).

---

## 5. The engine (Qloo)

All calls go through `evidenceFor()` so they land in the ledger (*exists*). Parameter shapes below were verified live on 28 Oct.

### 5.1 Resolve
- **City** → `qloo api search {query, type: locality, take: 6}` → `pickLocality` (*exists*). Store id, Qloo name, lat/lon, country.
- **Theme** → `qloo_find_tags {query, limit: 12}`. Prefer `urn:tag:genre:qloo:*`, then `subgenre`, `theme`, `keyword`. Up to 2 theme tags. Tags are typed: a film genre tag does not filter artists or places. Resolve the theme **per target type** (the tag whose parent type matches), and where a type has no matching tag, drop `include_tags` for that type and use the loves or the top `onlyHere` entities as `signals` instead. The card says which it did.
- **Loves** → `qloo_describe {entity, type}` (*exists*). Up to 3.
- **Contrast city** → the country's largest city that is not the input (from `CANDIDATE_CITIES`, *exists*), resolved the same way. Mumbai for Hyderabad, Los Angeles for Las Vegas.

### 5.2 City read: three columns
For each target type the format needs (film: movie, tv_show, artist; reel: artist, place, tv_show, movie; fashion: brand, artist):

```
qloo_recommend { target_type, include_tags: [theme…], signal_location: "<City>, <Country>", limit: 20 }
```
Run three times: city, country, contrast city. The tag is a **filter** (`include_tags`), the location is the **signal**. Never the other way round.

From the three lists compute, per entity:
- `onlyHere`: in the city list, not in the country list (and/or not in the contrast list).
- `hiddenGem`: affinity ≥ 0.95 and popularity ≤ 0.5 (Hyderabad crime: *Maestro* 0.99/0.28).
- `shared`: everywhere.

Ranking uses only these sets and the affinity-minus-popularity gap. Raw affinity is never the sort key.

Verified example, crime films: Hyderabad-only vs India = V, Vettaiyan, Deva, Andhadhun, Drishyam 2, Kurup, KGF 2, Super Deluxe. Hyderabad-only vs Mumbai = V, Maestro, Salaar, Brochevarevarura, KGF 2, Evaru, Super Deluxe, Raja Raja Chora. Mumbai gets Raid, Article 15, Vikram Vedha instead.

### 5.3 Flavours: demand
```
GET /v2/insights { filter.type: urn:tag, signal.interests.tags: <theme>, signal.location.query: "<City>, <Country>",
                   filter.parents.types: urn:entity:<type>, take: 30 }
```
Same call for the country. **Demand lift** of a flavour = country rank − city rank (absent from the country's 30 = rank 31).

Verified, crime/Hyderabad: Travel +22, Biographical +22, Martial Arts +21, Social Issues +20, Docudrama +19, Non Fiction +17, Finance +17, Folk +16. Under-indexed: Motivation, Muslims, Indian Culture, Fiction, Inspirational.

### 5.4 Supply, and the gap formula
For each of the top 8 demand flavours `f`:
```
GET /v2/insights { filter.type: urn:entity:movie, filter.tags: "<theme>,<f>", operator.filter.tags: intersection,
                   filter.release_year.min: <this year − 4>, signal.location.query: "<City>, <Country>", take: 20 }
```
`supplyCount` = results returned (verified: crime ∩ courtroom, 2022+, Hyderabad = 2: Killers of the Flower Moon, Glass Onion).

```
demand = clamp(lift / 30, 0, 1)
fill   = min(supplyCount, 10) / 10
gap    = demand × (1 − fill)
```
Top 3 flavours by `gap` are the **lanes**. Each lane shows: name, city rank vs country rank, the recent titles found (names, years), and the count. The writer must write into lane 1 and may use 2 and 3.

Applies as is to film (movie), series (tv_show), book, podcast, videogame. For **reel** there is no release year on artists or places, so lanes are demand-only and the card says "demand only". For **fashion**, the lane list comes from brand style tags, and the city gap is the existing culture-vs-fashion heatmap read (*exists*).

Fallbacks: if the supply reads fail, show demand-only and say so. If fewer than 3 flavours have positive lift, show what there is. Never pad.

### 5.5 Audience
`qloo_audience_demographics {entity}` for the top 3 `onlyHere` entities; average the skews; show as "who shows up", aggregate only. (*exists* for one entity.)

### 5.6 Audio and soundtrack
```
qloo_recommend { target_type: artist, signals: <top onlyHere ids>, signal_location: "<City>, <Country>", limit: 15 }
```
Plus the same for the country. `onlyHere` + `hiddenGem` artists are the shortlist. Verified for Hyderabad crime: Devi Sri Prasad, Anirudh, Sid Sriram, Chinmayi, Geetha Madhuri; hidden gem Sreerama Chandra (0.89 / 0.06).

### 5.7 Spots (reel, fashion)
```
qloo_recommend { target_type: place, signals: <top onlyHere ids>, filter_location: "<City>, <Country>", limit: 12 }
```
(*exists* in the city passport.) New: a name filter drops phone numbers, emoji, ALL-CAPS junk, and names shorter than 3 letters. Keep hotels and chains out unless the format is fashion.

### 5.8 Where it travels next (film, fashion)
Heatmap of the top `onlyHere` ids across the country, geohash cells snapped to Qloo localities, lift = affinity percentile − popularity percentile (*exists*: `heat`, `snapCellsToPlaces`, `liftPoints`). Top 5 cities by lift, map with two layers. Skipped for reel.

### 5.9 Receipts
Every call: title, tool, args, ms, count, provenance (*exists*). New: each card's names carry the receipt id they came from, so a click on "Maestro" opens the request that returned it.

---

## 6. The writer (LLM layer, bring your own key)

### 6.1 Providers
One OpenAI-compatible client (*exists* for Groq) with a provider table. Each row: `baseUrl`, default model, auth header style, JSON-mode support.

| Provider | Base URL | Default model |
|---|---|---|
| groq (server default) | api.groq.com/openai/v1 | openai/gpt-oss-120b |
| openai | api.openai.com/v1 | gpt-4.1-mini |
| anthropic | api.anthropic.com/v1 (messages adapter) | claude-sonnet-5-5 |
| gemini | generativelanguage.googleapis.com/v1beta/openai | gemini-2.5-flash |
| mistral | api.mistral.ai/v1 | mistral-small-latest |
| openrouter | openrouter.ai/api/v1 | user's choice |
| together | api.together.xyz/v1 | meta-llama/Llama-3.3-70B-Instruct-Turbo |
| fireworks | api.fireworks.ai/inference/v1 | llama-v3p3-70b-instruct |
| deepseek | api.deepseek.com/v1 | deepseek-chat |
| xai | api.x.ai/v1 | grok-3-mini |
| cerebras | api.cerebras.ai/v1 | llama-3.3-70b |
| sambanova | api.sambanova.ai/v1 | Meta-Llama-3.3-70B-Instruct |

Twelve providers, eleven of them the same wire format. Default model names are overridable in the drawer and checked against each provider's model list on day 2. Anthropic gets a 40-line adapter.

### 6.2 Key handling
- The key travels once, in the `POST /api/runs` body, over HTTPS.
- Server keeps it in an in-memory `Map<runId, {provider, model, key}>`, deleted when the run finishes or after 30 minutes.
- Never written to the run file, the events, the cache, or logs. Error text is passed through a redactor (`sk-…`, `gsk_…`, `AIza…`, `xai-…` patterns).
- `POST /api/llm/check` makes one 10-token call so a bad key fails before the run, with the provider's message.
- Browser: the key lives in the form only; "remember for this tab" puts it in `sessionStorage`, nothing else.
- Server default key (Groq) is capped per IP and per day; BYOK runs skip the LLM cap but still count against the Qloo cap.

### 6.3 Writers, one per format
Every writer gets a compact evidence digest, never raw Qloo, and must return JSON. The shared rules block (*exists* as `RULES`) stays: only names from the evidence, aggregate not individuals, "signal" not "will sell", plain English.

**Film**
```json
{"titles":["",""," "],
 "lane":{"flavour":"lane 1 name","why":"cite city rank vs country rank and the supply count"},
 "logline":"1 sentence",
 "theme":"1 sentence",
 "synopsis":{"act1":"","act2":"","act3":""},
 "characters":[{"role":"","note":""}],
 "references":[{"title":"from evidence","take":"what to borrow"}],
 "soundtrack":[{"artist":"from evidence","use":"score|title track|montage"}],
 "audience":{"who":"from the skew","note":""},
 "travels_next":["cities from evidence"],
 "avoid":["from the under-indexed flavours"]}
```
**Reel**
```json
{"title":"","hook":"first 2 seconds, spoken or on-screen",
 "beats":["3-5 shots"],
 "audio":{"artist":"from evidence","why":""},
 "spots":[{"name":"from evidence","why":""}],
 "caption":"","hashtags":["from flavour tags"],
 "why_it_lands":[{"claim":"","from":"receipt id or evidence line"}],
 "alternates":[{"title":"","hook":""}]}
```
**Fashion** (*exists* as DESIGN + ARCHITECT, merged)
```json
{"positioning":"","styles":[{"name":"","category":"","cues":[""],"from_tags":[""],"colourways":[""]}],
 "palette":[{"name":"","hex":"","from_tags":[""]}],
 "brands_to_study":["from evidence"],"first_cities":["from evidence"],"channels":[""]}
```

### 6.4 Grounding check (*exists* as Test, generalised)
Paths per format list which fields must be Qloo names. Unknown names are removed and counted. The result card shows "23 of 24 names trace to Qloo · 1 removed". The share page carries the same line.

### 6.5 With vs without Qloo (*exists* as Diff, kept)
Same sentence to the same model with no evidence. Side by side. Count the names that trace to Qloo on each side. This is the one-card answer to the organisers' test.

---

## 7. Pipeline: a plan per format, not 11 fixed stages

The runner stays generic (*exists*). Each run carries `plan: [stageIds]` chosen at creation:

| Step | film | reel | fashion |
|---|---|---|---|
| resolve | ✓ | ✓ | ✓ |
| read (three columns + flavours) | ✓ | ✓ | ✓ |
| gap (lanes; supply for film) | ✓ | demand-only | heat gap |
| audio | ✓ | ✓ | – |
| spots | – | ✓ | ✓ |
| travels (heatmap lift) | ✓ | – | ✓ |
| audience | ✓ | ✓ | ✓ |
| write | ✓ | ✓ | ✓ |
| check | ✓ | ✓ | ✓ |
| diff | ✓ | ✓ | ✓ |
| share | ✓ | ✓ | ✓ |

Rail labels are plain: "Reading Hyderabad", "Finding the gap", "Writing your film", "Checking every name". Edit-and-rerun keeps working: edit the lane, rerun from write.

---

## 8. API

| Route | Purpose |
|---|---|
| `GET /api/health` | Qloo ready, **LLM actually probed at boot** (not "key exists") |
| `GET /api/presets` | showcases, formats, markets, providers |
| `POST /api/parse` | sentence → `{format, city, theme, loves}` + Qloo candidates for confirm |
| `POST /api/llm/check` | validate a BYOK key, no run |
| `POST /api/runs` | `{input, llm?}` → run id; key kept in memory only |
| `GET /api/runs/:id` · `/events` | run and SSE stream (*exists*) |
| `POST /api/runs/:id/edit` | edit a stage, rerun after it (*exists*) |
| `POST /api/runs/:id/regenerate` | rerun write→share with a (new) key |
| `POST /api/ask` | analyst (*exists*) |
| `GET /s/:slug` | share page |
| `POST /mcp` · `GET /.well-known/ayto.json` | agent door, section 9 |

---

## 9. MCP door (cut first if time runs out)

`@modelcontextprotocol/sdk` is already a dependency. Stateless Streamable HTTP server at `/mcp` with three tools that call the same engine functions:

- `ayto_read_city {city, theme, format}` → the three-column read and flavours.
- `ayto_find_gap {city, theme, format}` → lanes with evidence.
- `ayto_write {city, theme, format, provider, key}` → the written output (key used once, not stored).

Discovery JSON at `/.well-known/ayto.json` lists the tools and states `qloo: aggregate taste signals, no personal data`. Borrowed from Charter.

---

## 10. Sample mode

`CULTURE_GAP_MODE=fake` (*exists*) answers the three showcases with synthetic, clearly labelled data so the app runs with no keys at all. Extended to cover the new calls (three-column lists, flavours, supply, artists, places). Real Qloo responses are never committed.

---

## 11. Honesty, safety, caps

- Words: "built on what this city already loves", "signal", "affinity". Never "hit", "viral", "will sell".
- Aggregate only. No sensitive inference (health, religion, politics, ethnicity, sexuality). The analyst prompt already says so.
- Every name on the page traces to a receipt or is removed.
- Caps (*exists*): runs per IP per hour, runs per day. New: separate LLM cap for the server key.
- Keys: section 6.2. Qloo key never leaves the server.
- Share pages: no scripts, all text escaped (*exists*).

---

## 12. Front end

Keep the design system (*exists*: Archivo, ink on paper, tape yellow for the primary action and the gap). Change the content, not the skin.

- Hero line: "Are you the one? Tell AYTO what you're making and where. It finds the gap in what the city loves and writes you into it."
- The tape graphic stays: culture lands → the gap → the thing arrives. It is the gap formula in one picture.
- Composer: sentence + Format chips + City + Theme + key drawer. No "You make" dropdown.
- Confirm strip under the composer, then Run.
- Run layout (*exists*): rail · cards · receipts. Cards per format, written output as the hero card.
- Three-column "only here" table: City · Country · Contrast city, with hidden gems marked.
- Lanes card: three bars, demand vs fill, the gap in tape yellow.
- Map (*exists*, Leaflet) for travels.
- Mode note: live / synthetic; LLM: default (capped) / your key (provider name).
- Phone: single column, `grid-template-columns: minmax(0,1fr)` on every grid (known fix).

---

## 13. Code changes, file by file

**Keep as is:** `src/qloo.js`, `src/cities.js`, `src/pipeline/runner.js` (plus `plan`), `src/pipeline/store.js`, `src/pipeline/evidence.js`, `src/ask.js`, `src/config.js`, `public/styles.css` (edits only), `test/places.test.js`, `test/lift.test.js`.

**Rewrite:**
- `src/presets.js` → three showcases, formats, providers.
- `src/pipeline/prompts.js` → `src/writers/{film,reel,fashion}.js` with schemas and grounding paths.
- `src/pipeline/stages-evidence.js` → `src/engine/{resolve,read,flavours,gap,audio,spots,travels,audience}.js`.
- `src/pipeline/stages-plan.js` → `src/pipeline/{write,check,diff,share}.js`.
- `src/pipeline/page.js` → share page for the three formats.
- `src/llm.js` → provider table + Anthropic adapter + redactor + `check()`.
- `src/fake-qloo.js` → synthetic answers for the new calls.
- `public/index.html`, `public/app.js` → new flow (composer, confirm, cards per format).
- `src/server.js` → new routes, in-memory key map, boot-time LLM probe, MCP mount.

**Delete:** `src/agent.js` (old scan), Build / Backend / Brand / Launch / Deploy stages, tech packs, costing, assumptions.

**New:** `src/engine/*`, `src/writers/*`, `src/llm-providers.js`, `src/mcp.js`, `src/parse.js`, `test/gap.test.js`, `test/grounding.test.js`, `test/parse.test.js`.

`analysis.js` keeps `heatPoints`, `snapCellsToPlaces`, `liftPoints`, `cultureFashionGap`, `tagPoints`, `styleTags`; gains `threeColumns()`, `demandLift()`, `laneGap()`.

---

## 14. Tests (node --test, *exists*)

- `gap.test.js`: demand lift from two rank lists; lane gap with supply 0, 5, 10+; demand-only path.
- `grounding.test.js`: unknown names removed per format path; score.
- `parse.test.js`: sentence → format/city/theme; unresolved city blocks.
- `llm.test.js`: redactor never leaks a key pattern; provider table has baseUrl + model for every id.
- Existing: places, lift, analysis.

---

## 15. Deployment

- Dockerfile (*exists*): long-running Node container, `qloo mcp` as a child process. Serverless is out.
- Host: Render Starter (as planned) or Lightsail (as Charter). Render is fewer moving parts; pick it unless you prefer the Charter pipeline.
- Env: `QLOO_API_KEY`, `GROQ_API_KEY`, `PORT`, `PREWARM=1`, caps.
- Public GitHub repo, MIT licence visible in About, live URL in the description.
- Smoke after deploy: `/api/health` ok, one showcase run completes.

---

## 16. README and pitch

README borrows Charter's shape: one line · live demo · video · judging table · what we submitted · how the engine works (the gap formula with the real Hyderabad numbers) · what the live API taught us · build challenges · honest limits · setup · ethics · licence.

Video (3 min): 20 s the problem (blank page, invisible local taste) · 60 s Hyderabad crime film run, lanes card, written film · 40 s Las Vegas reel · 30 s receipts and with/without Qloo · 20 s BYOK and MCP · 10 s honest limits.

---

## 17. Timeline

| When (IST) | Build |
|---|---|
| 28 Oct night | Approve this plan. Working Groq key in `.env`. Engine: resolve, read, flavours, gap + tests. |
| 29 Oct day | Writers (film, reel). Provider table, key map, check route. Runner plans. Parse + confirm route. |
| 29 Oct night | Front end: composer, confirm, cards, result, share. Fashion writer from the old prompts. |
| 30 Oct day | Sample mode, MCP door, caps, health probe, README, deploy, prewarm, record video. |
| 30 Oct 11 pm | Submit. Buffer until 31 Oct 09:15. |

---

## 18. Risks and the cut order

| Risk | Answer |
|---|---|
| No working LLM key | Blocker one. Groq free tier, five minutes. BYOK means judges can also bring theirs. |
| Supply reads thin for some themes | Demand-only lanes, labelled. Never padded. |
| Qloo quota (~10k/month, ~5 req/s) | Memo cache (*exists*), caps, prewarm once, 4 concurrent. |
| Tool `include_tags_operator` rejects "and" | Use raw Insights with `operator.filter.tags=intersection` (verified). |
| Place names are junk | Name filter, section 5.7. Still Qloo data; still receipts. |
| Time | Cut in this order: MCP door → travels map → fashion format → Ask box. The with/without Qloo card is **never cut**: it answers the organisers' test and the tie-break (depth of Qloo use) directly. |

---

## 19. Open questions for you

1. **Groq key tonight?** Everything downstream of the engine waits on it.
2. **Host:** Render, or Lightsail like Charter?
3. **Repo name:** keep `culture-gap` as the engine name inside AYTO, or rename the repo to `ayto` before going public?
4. **Contrast city:** auto-pick the country's biggest other city, or let the user choose?
5. **Reel output:** caption and hashtags in, or idea only?
