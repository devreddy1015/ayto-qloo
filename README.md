# AYTO — Are You The One

**Tell AYTO what you're making and where. Qloo reads what that city's people love and finds the gap. Your own LLM writes the idea into it.**

Live demo: _coming before submission_ · Video: _coming before submission_ · Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com).

**Who it's for.** The filmmaker in Hyderabad, and the production house behind them, deciding what to make next. Everything else is the same engine in another format.

- Making a **crime short film in Hyderabad**? You get a lane the city loves and isn't getting (Biographical: Hyderabad ranks it #9 for crime fans, India doesn't rank it in its top 30, and one recent crime film carries it), three titles, a logline, three acts, the films to study, a composer shortlist, and the cities that lean the same way.
- Same engine, other formats: a **reel in Las Vegas** (the hook, the beats, the song, the spots, the caption) or a **kidswear drop in Tiruppur** (a design brief, the brands this crowd favours beyond the country, where to land first).

Every name on the page comes from a Qloo request you can open. It never says "hit"; it says "built on what this city already loves".

---

## Judging, in one table

| Criterion | How AYTO answers it |
|---|---|
| **Uses Qloo deeply** | Every step is a Qloo move and every one is a receipt: locality resolve, tag resolve, the three-column read (city vs country vs a contrast city), flavour over-index, a tagged catalogue read for supply, audience skew, artists, places, and a heatmap with lift. Nothing on the page exists without Qloo. |
| **Complete product** | Sentence → confirm what Qloo found → run → the written film, reel or drop → a share page. Three showcases, synthetic sample mode, bring-your-own-key for 12 LLM providers, an MCP door for agents, abuse caps. |
| **Real problem, real audience** | The filmmaker in Hyderabad deciding what to make. India released 1,972 films in 2025 (313 Telugu) and only six Telugu releases succeeded; producers say on record they no longer know what "commercial" means; the research they buy today starts only after a film is announced. AYTO works before greenlight. Reel creators and small makers are the same engine in other formats. |
| **Non-obvious** | The gap: what a city loves and is under-served in. City vs city difference (Hyderabad's crime list is not Mumbai's). Hidden gems: high affinity, low popularity. |

The organisers' test: *"If your submission would work the same without Qloo, you're building the wrong thing."* The **with vs without Qloo** card runs the same sentence through the same model with no evidence and counts how many of its names trace to anything. It is the one-card answer.

---

## How the engine works

1. **Resolve.** The city becomes a Qloo locality (id, coordinates, country). The theme becomes Qloo tags (`crime` → `urn:tag:genre:qloo:crime`). A contrast city is picked: the country's largest other city.
2. **Read the city, three columns.** For each entity type the format needs: the same `qloo_recommend` request for the city, the country and the contrast city. The theme is a **filter** (`include_tags`) and the location is the **signal**. Signalling the tag instead lets the location swamp it: "crime + Hyderabad" returned *Borat* and *Little Women*. From the three lists: **only here** (in the city's, in neither other), **hidden gems** (near the top on affinity, small on popularity). Raw affinity is never the sort key: it comes back flat at 0.98–1.00.
3. **Flavours: demand.** A tag read for the city and for the country (`filter.type=urn:tag`, `signal.interests.tags=<theme>`, `signal.location.query=<city>`, `filter.parents.types=urn:entity:movie`). **Demand lift** of a flavour = country rank − city rank. For crime in Hyderabad: Docudrama +19, Biographical +22, Social Issues +20.
4. **Supply, inside one response.** The films with the theme that the city favours, with their own tags (`filter.type=urn:entity:movie`, `filter.tags=<theme>`, `signal.location.query=<city>`, 50 titles). A flavour's supply is how many of those titles carry it; recent means the last four years. (Filtering by the flavour tag returns nothing for most affinity tags: they are not entity tags.)
5. **The gap.** `demand = lift / 30`, `fill = min(recent, 10) / 10`, `gap = demand × (1 − fill)`. A lane must exist in the catalogue at least once. Top three lanes, with the titles. Formats without release years (reels) get demand-only lanes, and the card says so.
6. **Audience, audio, spots, where it travels.** Aggregate skew of the city's own picks. Artists the crowd favours here and not nationally. Places, with junk names dropped. A geohash heatmap across the country, cells snapped to Qloo's localities, lift = affinity percentile − popularity percentile, so big cities don't win by size.
7. **Write.** The format's writer gets a compact evidence digest, never raw Qloo, and returns JSON. **Check** looks up every named claim in the names Qloo returned during the run and removes the rest. **Diff** asks the same question with no evidence. **Share** renders a static page with no scripts.

---

## Bring your own key

Twelve providers, eleven on the same OpenAI-compatible wire format plus an Anthropic adapter: Groq, OpenAI, Anthropic, Gemini, Mistral, OpenRouter, Together, Fireworks, DeepSeek, xAI, Cerebras, SambaNova. The key travels once in the run request, lives in memory for that run, and is never written to a run file, an event, the cache or a log. Error text passes through a redactor. `POST /api/llm/check` makes one 8-token call so a bad key fails before the run. The server's own key is capped per IP and per day; your key skips the LLM cap and still counts against the Qloo cap.

## The agent door

`POST /mcp` is a stateless Model Context Protocol server (Streamable HTTP) with three tools that call the same engine: `ayto_read_city`, `ayto_find_gap`, `ayto_write`. Discovery at `/.well-known/ayto.json`. A key passed to `ayto_write` is used for that call only.

---

## What the live API taught us (28 Oct 2026)

- Keys work only on `hackathon.api.qloo.com`; about 5 requests a second, about 10k a month. Responses are cached privately on the server (allowed), never committed (not allowed).
- `qloo_recommend`: `include_tags` filters, `signal_location` signals, and both together give the richest read. The tool rejects `include_tags_operator: and`; raw Insights takes `operator.filter.tags=intersection`.
- Recommend results carry no tags; raw entity Insights results do (2,690 tag ids across 30 crime films). That is what makes the supply read possible.
- Affinity tags (`genre:qloo:docudrama`, `suspense`) are not entity tags, so `filter.tags` on them returns nothing; keyword tags (`keyword:media:courtroom`) do filter.
- Heatmaps: `output.heatmap.boundary` accepts `urn:geohash` or `urn:entity:locality`; the locality form returns every polygon in the country (India: 125 MB). Geohash, snapped to localities found by search, is the way.
- Locality search often has only the district ("Mysuru District", "Mangaluru taluk"); AYTO shows a display name and keeps Qloo's on the receipt.
- `/v2/trending` is a frozen weekly snapshot in the hackathon data, so momentum is not a feature.
- Place recommendations include noisy names (phone numbers, emoji, nail salons); a name filter drops them and the card says how many.

## Build challenges

- **The model is not the source.** Every name must trace to a Qloo call or it is removed. The check runs after the writer, and the diff card shows what a model does with no evidence.
- **Nonsense in, confidence out.** "i wana make a film in delhi" once became a TV show with a shipped page. Now the confirm step shows what Qloo found before anything runs, and a city Qloo cannot place blocks the run.
- **Flat affinity.** Ranking by affinity is noise at the top. The useful reads are set differences (only here) and affinity minus popularity (hidden gems).
- **A gap needs supply.** Filtered intersections returned zeros; reading the catalogue with its tags in one response gave real counts and the titles to show.

## Honest limits

- Qloo describes aggregate taste across large groups. It does not know any individual and it is not sales data. AYTO never claims a hit.
- Trend data in the hackathon API is frozen; there is no "rising now".
- Supply is counted inside Qloo's catalogue for the city, not the market's full release slate.
- The quality of the written output depends on the model you bring. The server default is capped.
- Sample mode (`CULTURE_GAP_MODE=fake`) is synthetic and labelled; it exists so the app runs with no keys.

## Run it

```bash
npm install
cp .env.example .env     # QLOO_API_KEY, optional GROQ_API_KEY
npm start                # live if a Qloo key is set
CULTURE_GAP_MODE=fake npm start   # synthetic sample data, no keys
npm test
```

`PORT` (default 8080), `PREWARM=1` runs the three showcases at boot, `MAX_RUNS_PER_DAY`, `MAX_LLM_RUNS_PER_DAY`, `SCANS_PER_IP_PER_HOUR`, `PUBLIC_URL` for the discovery document. Docker: `docker build -t ayto . && docker run -p 8080:8080 --env-file .env ayto`. The app runs Qloo's official harness (`qloo mcp`) as a child process, so it needs a long-running container, not serverless.

## Ethics

No personal data is sent to Qloo and none is inferred: the audience card is an aggregate skew of a city's own picks. The analyst prompt refuses to infer sensitive traits. Keys are never stored. Qloo response data is never committed.

## Licence

MIT. Not affiliated with or endorsed by Qloo.
