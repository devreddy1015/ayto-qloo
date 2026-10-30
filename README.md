<img src="public/icon.svg" width="72" height="72" alt="The AYTO mark: a ring open at the top right, with a yellow dot in the opening">

# AYTO — Are You The One

**Tell AYTO what you're making and where. Qloo reads what that city's people love and finds the gap. Your own LLM writes the idea into it.**

Live demo: **[ayto-ocx1.onrender.com](https://ayto-ocx1.onrender.com)** (free plan: the first visit after a quiet spell wakes it, about a minute) · Source: [github.com/devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) · Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com).

**An agent with taste.** It plans its Qloo reads for the format you're making, calls Qloo's tools, writes, checks its own output against the evidence and rewrites what it can't trace. It is also an MCP server that other agents can call (`/mcp`).

**Who it's for.** The filmmaker in Hyderabad, and the production house behind them, deciding what to make next. Everything else is the same engine in another format.

- Making a **crime short film in Hyderabad**? You get the lanes the city loves and isn't getting (Folk, Finance, Revenge and Justice: Hyderabad ranks each 15 to 17 places higher than India does and than the median of Bengaluru, Chennai and Kolkata, and not one recent crime film carries them), the look its crime crowd leans to (Cinematic, Moody, Atmospheric, Gritty; not Observational or Clinical), three titles, a logline, three acts, five or six beats, characters (what each wants and hides, their look, their arc), the films to study with the shot to borrow from each, the actors Hyderabad favours beyond India, a shoot base and locations from the places this crowd goes, camera and light notes for your budget, a palette, a composer shortlist, and the cities that lean the same way.
- Not sure **where** yet? Say "a crime short film in India" and click **Let AYTO compare cities**. AYTO reads the theme across the country's ten largest cities, measures each city against the country and against the other nine, and maps where the widest open lane is: Kolkata's is Crime Lord, Bengaluru's Documentary, Mumbai's Gender Violence, while Martial Arts leans high in all ten cities and Biographical in nine. One click runs the full treatment for the city you pick.
- Same engine, seven other formats: a **reel** (hook, beats, song, spots, caption), a **fashion drop** (styles you can turn in 3D, a palette, brands to study, a first production run with costing), a **podcast**, an **indie game**, a **café menu and playlist**, a **live event night**, a **book or web novel**. Say which, or let AYTO read it from the sentence.

- **See it.** Under any finished brief, one click asks OpenAI to draw a concept image from it: a film's mood still, a café's room, a drop's hero garment, a book cover. The picture is built from the look words and palette Qloo's read gave, set in the city and area AYTO found, and every Qloo name is kept out of the prompt, so it is original art, never a real poster, logo or person. Optional: it needs `OPENAI_API_KEY` on the server (capped at 40 images a day, 6 an hour per visitor).
- **Read it simply, shoot it beat by beat.** A film brief opens with **the story, simply**: 120 to 200 plain words on who wants what, what stands in the way, how it turns and how it ends. Under a finished film, **Build the shot deck** draws one storyboard frame per beat (up to six, about a minute), each with a shot line (size, lens, light, movement) and the Qloo-traced film to study for it, and downloads as one HTML file. Frames are original art with every Qloo name kept out of the prompt; no still from a real film is ever fetched. Same `OPENAI_API_KEY`; capped at 15 decks a day (`MAX_SHOT_DECKS_PER_DAY`) and 3 an hour per visitor.

Every name on the page comes from a Qloo request you can open. It never says "hit"; it says "built on what this city already loves".

---

## Judging, in one table

| Criterion | How AYTO answers it |
|---|---|
| **Technological implementation** (how deeply it uses Qloo) | Every step is a Qloo move and every one is a receipt: locality resolve, tag resolve, the three-column read (city vs country vs a contrast city), flavour over-index, a tagged catalogue read for supply, audience skew, artists, places, and a heatmap with lift. Nothing on the page exists without Qloo. |
| **Design** (a complete product) | Sentence → confirm what Qloo found → run → the written film, reel or drop → a share page. Three showcases, synthetic sample mode, bring-your-own-key for 12 LLM providers, an MCP door for agents, abuse caps. |
| **Potential impact** (a real problem for a real audience) | The filmmaker in Hyderabad deciding what to make. India released 1,972 films in 2025 (313 Telugu) and only six Telugu releases succeeded; producers say on record they no longer know what "commercial" means; the research they buy today starts only after a film is announced. AYTO works before greenlight. Reel creators and small makers are the same engine in other formats. |
| **Quality of the idea** (non-obvious) | The gap: what a city loves and is under-served in. City vs city difference (Hyderabad's crime list is not Mumbai's). Hidden gems: high affinity, low popularity. |

The organisers' test: *"If your submission would work the same without Qloo, you're building the wrong thing."* The **with vs without Qloo** card runs the same sentence through the same model with no evidence and counts how many of its names trace to anything. It is the one-card answer.

---

## How the engine works

1. **Resolve.** The city becomes a Qloo locality (id, coordinates, country). The theme becomes Qloo tags (`crime` → `urn:tag:genre:qloo:crime`). A contrast city is picked: the country's largest other city.
2. **Read the city, three columns.** For each entity type the format needs: the same `qloo_recommend` request for the city, the country and the contrast city. The theme is a **filter** (`include_tags`) and the location is the **signal**. Signalling the tag instead lets the location swamp it: "crime + Hyderabad" returned *Borat* and *Little Women*. From the three lists: **only here** (in the city's, in neither other), **hidden gems** (near the top on affinity, small on popularity). Raw affinity is never the sort key: it comes back flat at 0.98–1.00.
3. **Flavours: demand, with control cities.** A tag read for the city and for the country (`filter.type=urn:tag`, `signal.interests.tags=<theme>`, `signal.location.query=<city>`, `filter.parents.types=urn:entity:movie`). **Demand lift** of a flavour = country rank − city rank. But a country baseline behaves like its largest city, so a lift over the country is often shared by every other big city: Biographical reads +22 for Hyderabad and +22 for Chennai. So the same read runs for three control cities and **specific lift** = the city's lift − the controls' median (a control that does not list a flavour counts as no lift). A lane's **strength** is the smaller of the two: above the country, and above comparable cities. Lanes rank on strength. For crime in Hyderabad: Folk +17, Finance +16, Revenge and Justice +15, while Biographical, Travel and Social Issues turn out to be shared by most big cities.
4. **Supply, inside one response.** The films with the theme that the city favours, with their own tags (`filter.type=urn:entity:movie`, `filter.tags=<theme>`, `signal.location.query=<city>`, 50 titles). A flavour's supply is how many of those titles carry it; recent means the last four years. (Filtering by the flavour tag returns nothing for most affinity tags: they are not entity tags.)
5. **The gap.** `demand = lift / 30` (the specific lift when controls were read), `fill = min(recent, 10) / 10`, `gap = demand × (1 − fill)`. A lane must exist in the catalogue at least once, unless it is strongly specific to the city, in which case zero supply is the open lane and the card says so. Top three lanes, with the titles. Formats without release years (reels) get demand-only lanes, and the card says so.
6. **The look.** Film: the share of the city's themed catalogue carrying each Qloo style tag versus the country's (Hyderabad crime: Cinematic +10 points, Moody +8, Atmospheric, Gritty, Neon noir; Observational and Clinical below), plus Qloo's own style descriptions of the city's picks. Fashion: aesthetic and personal-style tag lift (`filter.tag.types=urn:tag:aesthetic_property:qloo` on brand parents), and materials, age groups and segments counted on the city's fashion labels versus the country's (Tiruppur: Denim and Leather up, Silk 40 points down; Hyderabad: Intricate Embroidery, Organza, Velvet up, Cotton and Teens down), the labels themselves, and the loves' own style motifs. For kidswear the card says plainly that Qloo has no children's age tag, so the read is the parents' taste.
7. **Audience, audio, spots, where it travels.** Aggregate skew of the city's own picks. Artists the crowd favours here and not nationally. Places, with junk names dropped. A geohash heatmap across the country, cells snapped to Qloo's localities, lift = affinity percentile − popularity percentile, so big cities don't win by size.
8. **Write.** The format's writer gets a compact evidence digest, never raw Qloo, and returns JSON. **Check** looks up every named claim in the names Qloo returned during the run and removes the rest; if anything was removed and a model is available, the writer runs once more with those names banned and the card shows both passes. **Diff** asks the same question with no evidence. **Share** renders a static page with no scripts.
9. **Produce** (fashion only). A first production run as editable assumptions, never forecasts: a minimum tech pack per style with blank points of measure for the sampling room, unit economics per channel at today's take rates (Flipkart, Meesho and Myntra's emerging-brand scheme at 0%, Ajio 20%), the ₹2,500 GST cliff, MOQ, size curves, a city split by taste lean, and the Legal Metrology declarations.
10. **See it in 3D** (fashion only). Each written style becomes a garment on a mannequin in the browser: nine garment types, the drop's own palette as colourways, the print placed from the cues, drag to orbit, snapshot to PNG. A silhouette-and-colour preview, not a cloth simulation; a flat croquis when WebGL is off.

---

## What makes it Qloo-powered

Nothing on the page exists without Qloo. Every step is a request you can open in the receipts panel:

| Step | Qloo request | What AYTO reads from it |
|---|---|---|
| Resolve | `/search` (locality), `qloo_find_tags`, `qloo_describe` | the city with its id and coordinates; the theme as a tag; the loves as entities |
| Read | `qloo_recommend` with `include_tags` + `signal_location`, three times (city, country, contrast city) | only-here picks, hidden gems, what the country prefers instead |
| Flavours | `/v2/insights` `filter.type=urn:tag` with `signal.interests.tags` + `signal.location.query`, for the city, the country and three control cities | demand lift and specific lift: how much higher the city ranks each flavour than the country, and than comparable cities |
| Look | `filter.tag.types=urn:tag:aesthetic_property:qloo` and `personal_style` tag reads on brand parents; style and material tags counted on tagged entity reads; `/entities` for the loves' own tags | the style words, materials, ages and motifs a design can use, each a receipt |
| Supply | `/v2/insights` `filter.type=urn:entity:<type>` with `filter.tags` + `signal.location.query`, 50 titles with their own tags and years | how many recent titles carry each flavour: the gap |
| Audience | `qloo_audience_demographics` | aggregate age and gender skew of the city's picks |
| Audio, spots | `qloo_recommend` for artists and places with the city's picks as signals | the shortlist and the venues |
| Travels | `/v2/insights` `filter.type=urn:heatmap` with `urn:geohash`, snapped to localities | cities that lean the same way, lift against popularity |

The **with vs without Qloo** card runs the same sentence through the same model with no evidence and counts how many of its names trace to anything. Remove Qloo and the product is a prompt.

---

## Bring your own key

Twelve providers, eleven on the same OpenAI-compatible wire format plus an Anthropic adapter that also carries tool calls for the analyst: Groq, OpenAI, Anthropic, Gemini, Mistral, OpenRouter, Together, Fireworks, DeepSeek, xAI, Cerebras, SambaNova. The showcase buttons use your key too. The key travels once in the run request, lives in memory for that run, and is never written to a run file, an event, the cache or a log. Error text passes through a redactor. `POST /api/llm/check` makes one 8-token call so a bad key fails before the run. The server's own key is capped per IP and per day (runs, rewrites, analyst questions and MCP writes); your key skips the LLM cap and still counts against the Qloo cap. A model call that doesn't answer inside its stage gives the evidence template instead of a failed run.

## The agent door

`POST /mcp` is a stateless Model Context Protocol server (Streamable HTTP) with four tools that call the same engine: `ayto_where_to_make` (rank a market's cities for a theme), `ayto_read_city`, `ayto_find_gap`, `ayto_write`. Discovery at `/.well-known/ayto.json`. A key passed to `ayto_write` (with its `provider`) is used for that call only. A run that fails comes back as a tool error with its reason.

---

## What the live API taught us (28 Oct 2026)

- Keys work only on `hackathon.api.qloo.com`; about 5 requests a second, about 10k a month. Responses are cached privately on the server (allowed), never committed (not allowed).
- `qloo_recommend`: `include_tags` filters, `signal_location` signals, and both together give the richest read. The tool rejects `include_tags_operator: and`; raw Insights takes `operator.filter.tags=intersection`.
- Recommend results carry no tags; raw entity Insights results do (2,690 tag ids across 30 crime films). That is what makes the supply read possible.
- Affinity tags (`genre:qloo:docudrama`, `suspense`) are not entity tags, so `filter.tags` on them returns nothing; keyword tags (`keyword:media:courtroom`) do filter.
- Heatmaps: `output.heatmap.boundary` accepts `urn:geohash` or `urn:entity:locality`; the locality form returns every polygon in the country (India: 125 MB). Geohash, snapped to localities found by search, is the way.
- Locality search often has only the district ("Mysuru District", "Mangaluru taluk"); AYTO shows a display name and keeps Qloo's on the receipt.
- Location text can fail silently: `"Mumbai, India"` returns zero artists and `needs_input` for places, while `"Mumbai, Maharashtra, India"` works. AYTO sends the locality id on raw Insights reads and a state-qualified name on the workflow tools.
- Tags are typed: a film genre tag (`genre:media:hip_hop`) filters no artists; a music or Qloo genre tag does. The theme is resolved per entity type.
- An empty answer is never cached on disk, so a passing hiccup does not stick.
- `/v2/trending` is a frozen weekly snapshot in the hackathon data, so momentum is not a feature.
- Place recommendations include noisy names (phone numbers, emoji, nail salons); a name filter drops them and the card says how many.

## Build challenges

- **The model is not the source.** Every name must trace to a Qloo call or it is removed. The check runs after the writer, and the diff card shows what a model does with no evidence.
- **Nonsense in, confidence out.** "i wana make a film in delhi" once became a TV show with a shipped page. Now the confirm step shows what Qloo found before anything runs, and a city Qloo cannot place blocks the run.
- **Flat affinity.** Ranking by affinity is noise at the top. The useful reads are set differences (only here) and affinity minus popularity (hidden gems).
- **A gap needs supply.** Filtered intersections returned zeros; reading the catalogue with its tags in one response gave real counts and the titles to show.

## Honest limits

- Qloo describes aggregate taste across large groups. It does not know any individual and it is not sales data. AYTO never claims a hit.
- The fashion numbers (MOQ, unit cost, markup, take rates) are directory asking prices and seller pages read in October 2026, shown as editable assumptions. The 3D view shows silhouette and colour, not fit or drape. Supply for reels, cafés and events is demand-only because those entities carry no release year.
- Trend data in the hackathon API is frozen; there is no "rising now".
- Supply is counted inside Qloo's catalogue for the city, not the market's full release slate.
- The quality of the written output depends on the model you bring. The server default is capped.
- Sample mode (`CULTURE_GAP_MODE=fake`) is synthetic and labelled; it exists so the app runs with no keys.
- A run changes only for whoever started it (their browser keeps its edit key). Picking another lane or writing again on someone else's run, a showcase or a page from the gallery, makes your own copy with the same receipts; the original stays as it was.

## Run it

```bash
npm install
cp .env.example .env     # QLOO_API_KEY, optional GROQ_API_KEY
npm start                # live if a Qloo key is set
CULTURE_GAP_MODE=fake npm start   # synthetic sample data, no keys
npm test
```

`PORT` (default 8080), `PREWARM=1` runs the three showcases at boot, `MAX_RUNS_PER_DAY`, `MAX_LLM_RUNS_PER_DAY`, `SCANS_PER_IP_PER_HOUR`, `PUBLIC_URL` for the discovery document. The server's own model comes from the first key it finds: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, or `LLM_PROVIDER` + `LLM_API_KEY` (for example `deepseek`). A local OpenAI-compatible model (Ollama, LM Studio) works for the server only: `LLM_PROVIDER=local LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=qwen2.5:7b`; it is never offered to visitors. Docker: `docker build -t ayto . && docker run -p 8080:8080 --env-file .env ayto`. The app runs Qloo's official harness (`qloo mcp`) as a child process, so it needs a long-running container, not serverless: Render (`render.yaml` is a ready blueprint on the free plan, which sleeps when idle and has no disk, so share links and the Qloo cache reset at each wake; on Starter, uncomment its disk block to keep them), Railway or Fly.io from the Dockerfile all work. With no Qloo key and no recorded samples, the app runs on labelled synthetic data.

## What changed

Every change, with the bug or test that prompted it, is in [CHANGELOG.md](CHANGELOG.md).

## Ethics

No personal data is sent to Qloo and none is inferred: the audience card is an aggregate skew of a city's own picks. The analyst prompt refuses to infer sensitive traits. Keys are never stored. Qloo response data is never committed.

## Licence

MIT. Not affiliated with or endorsed by Qloo.
