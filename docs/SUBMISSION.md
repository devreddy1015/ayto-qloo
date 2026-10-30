# Devpost submission pack

Everything the Devpost form asks for, ready to paste. Deadline: **30 Oct 2026, 11:45 pm ET = 31 Oct, 9:15 am IST**.
The app must stay up, free and with no login, until judging ends on **5 Nov 2026, 11:45 pm ET**.

## Checklist

| Required by the rules | Status |
|---|---|
| A live, working app judges can try end to end, hosted externally | Done: https://ayto-ocx1.onrender.com (Render, free plan, DeepSeek as the server model). Checked on 31 Oct: a real model wrote the Hyderabad treatment, 25 of 25 names traced |
| A public repo with all source and instructions | Done: [github.com/devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) |
| An open-source licence visible in the repo's About section | Done: MIT, shown in About |
| A text description of the features and what makes it Qloo-powered | Done: "About the project" below |
| Video (optional, but judges may score on text, images and video alone) | Script ready: [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) |
| Gallery images | Done: 10 images in `submission/gallery/` (kept out of git), film, reel and fashion drop, all from the live site |

**Once the live URL exists, put it in:**
1. the README's "Live demo" line;
2. the repo's About website field;
3. the Devpost "Try it out" links;
4. the closing frame of the video.

## Deploy

Render, from the blueprint in `render.yaml` (Docker, one web service). The blueprint is tested at the free plan's limits: 0.1 CPU,
512 MB and an empty cache, with all three showcases done about 85 s after boot.

1. Go to https://render.com/deploy?repo=https://github.com/devreddy1015/ayto-qloo and sign in with GitHub.
2. Paste the secrets when Render asks:
   - `QLOO_API_KEY`: the hackathon key.
   - The model: `LLM_PROVIDER` = `deepseek` and `LLM_API_KEY` = your DeepSeek key (or `GROQ_API_KEY`, free from console.groq.com). Without a server model, judges get a template instead of a written treatment unless they bring their own key.
3. Pick the plan:
   - **Free** works. It sleeps after 15 idle minutes (the first visit then waits about a minute), and share links reset on each wake.
   - **Starter** ($7/month) never sleeps. With the disk block in `render.yaml` uncommented, share links survive restarts. Recommended for the judging week (2–5 Nov).
4. When it's live, check these three things:
   - `/api/health` shows Qloo `live` and the model `available`;
   - the three showcases open from the home page;
   - one fresh sentence runs end to end.

---

## Project name

AYTO — Are You The One

## Elevator pitch (200 characters max)

An agent with taste for anyone making something for a city. Tell AYTO what and where: Qloo finds what that city loves and isn't getting, and your AI writes it into the gap.

## About the project

Paste everything between the lines into Devpost's "About the project" box.

---

## Inspiration

Everyone who makes something for a place starts from a blank page and a guess. That covers a filmmaker, a reel creator, a small clothing label, a podcaster, a game studio, a café, a promoter and a writer.

Film shows the cost most sharply. In 2025 India released 1,972 films, 313 of them in Telugu, and only six Telugu releases succeeded. Producers say on record that they no longer know what "commercial" means, and the audience research they can buy starts after a film is announced. A filmmaker in Hyderabad knows crime does well. Nobody can tell them which kind of crime film Hyderabad loves and isn't getting.

Qloo knows what a city loves. AYTO finds what it isn't getting, and writes your idea into that gap.

## What it does

AYTO is an agent with taste. You tell it, in one sentence, what you're making and where. It reads the city through Qloo, finds the gap, and writes your thing into it. Eight formats run on the same engine:

| You're making | AYTO writes |
|---|---|
| **A film** (short, feature, series) | a treatment you can shoot: titles, logline, three acts, beats, characters, films to study with the shot to borrow, cast ideas, locations, camera notes, palette |
| **A reel** | the hook, beats, song, spots and caption |
| **A fashion drop** | styles you can turn in 3D, a palette, brands to study, and a first production run (tech packs, costing, sizes, city split) |
| **A podcast** | premise, episodes, guests, intro music |
| **An indie game** | pitch, core loop, mechanics, art style, soundtrack, platforms |
| **A café** | concept, menu, brands to stock, playlist, neighbourhood |
| **A live event night** | concept, lineup, venue, run sheet, promo hook |
| **A book or web novel** | premise, logline, chapters, comparable titles |

Every format gets the same Qloo read underneath: the city against the country and control cities, the gap, the look, the audience, artists, places, and where the taste travels next.

Here is one run, start to finish, for the sentence *"A crime short film in Hyderabad, after HIT, on a shoestring."*

**1. It confirms what Qloo found, before anything runs.**
- The city: a typo like "Hydrabad" still finds Hyderabad, and AYTO says so.
- The theme, as Qloo tags.
- Each title you named. When a title exists twice, AYTO picks the original in the city's language: "HIT" in Hyderabad is the 2020 Telugu film, not its 2022 Hindi remake. You can switch it.

**2. It reads the city and finds the gap.** Same theme, read for Hyderabad, for India and for three control cities (Bengaluru, Chennai and Kolkata). A lane counts only if the city ranks it far above the country *and* above comparable cities. Then AYTO counts how many recent films in the city's own catalogue carry each lane. For crime films in Hyderabad, from the live run:
- **Folk +17, Finance +16, Revenge and Justice +15.** Hyderabad ranks each in its top 16; India doesn't rank them in its top 30.
- **Zero** recent titles in the catalogue carry them. That's the gap: loved here, under-served.
- **The look** the city's crime crowd leans to: Cinematic +10, Moody +8, Atmospheric +4, Gritty +4. Less Observational and Clinical.
- **The rest of the read:** the artists, the places this crowd goes, the shoot base (Monda Market, Secunderabad), the audience skew, and where the taste travels next (Mysuru, Tirupati, Nellore, Mangaluru).

**3. Your own language model writes into lane 1.** You bring the model (12 providers; the key is never stored), or the site's own model is used. For a film the result is a treatment you can shoot:
- titles, a logline and three acts;
- beats, and characters with what each wants and hides, their look and their arc;
- the films to study, with the shot to borrow from each;
- cast ideas from the people this city favours;
- locations by beat, camera and light notes for your budget, and a palette.

It can write in the city's own language (Telugu for Hyderabad), with every Qloo name kept checkable.

**4. It checks itself.** Every name in the output is looked up in what Qloo returned during the run. Anything made up is removed, and the writer tries once more with those names banned. Every name on the page opens the Qloo request it came from. In the live Hyderabad run, 25 of 25 names trace to Qloo.

**5. It proves Qloo is the difference.** The with-vs-without card asks the same model the same question with no Qloo evidence, and counts how many of its names trace to anything. On the live site, 17 of 17 names traced with Qloo. Without Qloo, 4 of 10 did, and the model guessed *Pulp Fiction* and A.R. Rahman.

**Not sure where yet?** Say "a crime short film in India" and click *Let AYTO compare cities*. AYTO reads the theme across India's ten largest cities. Each city is measured against the country and against the other nine, so a lane counts only where few others share it. The map shows where the widest open lane is:
- Kolkata's open lane is Crime Lord, Bengaluru's is Documentary, Mumbai's is Gender Violence.
- Martial Arts leans high in all ten cities, so it is nobody's gap.

One click runs the full treatment for the city you pick.

**The other showcases** run the same way: a Las Vegas reel about nightlife and food, and a Tiruppur kidswear drop riding KPop Demon Hunters that you can turn in 3D, with its first production run costed.

**See it.** Under any finished brief, one click asks OpenAI to draw a concept image from it: a film's mood still, a café's room, a drop's hero garment. The prompt is built from Qloo's look words, the brief's palette and the area AYTO found, with every Qloo name kept out, so the picture is original art in the city's taste, never a real poster, logo or person.

**Read it simply, shoot it beat by beat.** A film brief opens with the story told simply in plain words, and one click builds a shot deck: a storyboard frame per beat with its shot line and the Qloo-traced film to study, drawn as original art and downloadable as one file.

**Hear it.** One more click asks Google's Lyria for a 30-second instrumental music tone, described only by the genres, moods and instruments that the city's favoured artists carry on Qloo, the lane and the look, never by an artist or song name; play it on the page or download it.

**See what the crowd loves.** Under the 3D preview, a strip of three or four pictures slides left: the love the maker named and the labels the city favours, each an image Qloo returned in the run, with its receipt.

**Turn it in 3D.** A drop's styles stand on a mannequin you can orbit, now including maxi dresses, a saree with its pallu, a cape and an original cosplay set; one click has OpenAI draw a style's print onto the garment, and for a hero style, Stability's Stable Fast 3D makes a real `.glb` model to download.

**Agents can use it too.** AYTO is an MCP server at `/mcp` with four tools: `ayto_where_to_make`, `ayto_read_city`, `ayto_find_gap` and `ayto_write`. Claude, or any other MCP client, can ask where to make something and get back lanes with receipts.

**How to try it:** open the live link (no login) and click a showcase (the Hyderabad film, the Las Vegas reel or the Tiruppur drop), or type your own sentence for any of the eight formats.

## How it's agentic

- **It plans per format.** Each format has its own stage plan: a film reads the look and locations, a podcast skips them, and a fashion drop adds production.
- **It reads with tools.** Every stage calls Qloo's tools through the official harness (`qloo mcp`) or raw Insights.
- **It writes, then checks its own output** against the evidence, and rewrites once with the invented names banned.
- **It answers follow-ups.** The "Ask the analyst" box calls Qloo tools itself, for example `qloo_describe`, `qloo_audience_demographics` and `qloo_where_popular`, up to 12 calls per question.
- **It is a tool for other agents** through the MCP door.

## What makes it Qloo-powered

Nothing on the page exists without Qloo. The Hyderabad film run makes 44 Qloo requests, and each one is a receipt you can open. For a fashion drop you can see it too: the with vs without Qloo card stands the two hero pieces side by side in 3D, the one written from the city's read next to the one the same model makes with nothing to go on.

- **Resolve.** Locality search, `qloo_find_tags` for the theme, and `qloo_describe` plus `/entities` for the titles. The aliases pick the original over the remake, and death dates keep people who have died out of a cast list.
- **Read.** `qloo_recommend` with the theme as `include_tags` and the location as the signal, for the city, the country and a contrast city. That gives the only-here picks and the hidden gems: high affinity, low popularity.
- **Demand.** A `urn:tag` Insights read with `signal.interests.tags` and `signal.location.query`, for the city, the country and three control cities. That gives each flavour's lift over the country and its specific lift over comparable cities.
- **Supply.** An entity Insights read with `filter.tags` and the city as signal, returning 50 titles with their own tags and years. Supply is how many recent titles carry each flavour.
- **The look.** Style and aesthetic tag families (`filter.tag.types`), counted on the city's catalogue against the country's, plus Qloo's own style descriptions of the films to study.
- **The rest.** Audience demographics; artist and place recommendations signalled by the city's picks; and a geohash heatmap snapped to Qloo localities for where the taste travels.
- **Where should I make it?** One tag read per city across the ten largest cities, which act as each other's controls.

Without Qloo there is no lane, no list and no map: only a prompt.

## How we built it

- Node 22 and Express, a vanilla JS front end, and live progress streamed over SSE.
- Qloo through the official `@qloo/qloo-harness` for the workflow tools, and raw HTTP for search, Insights heatmaps, tag reads and tagged entity reads. An evidence ledger wraps every call.
- A provider table for 12 LLM providers, OpenAI-compatible plus an Anthropic adapter. Keys stay in memory for one run and are redacted from errors.
- A stateless MCP server.
- A three.js garment viewer for the fashion drop.
- Claude Sonnet 5.5 writes on the live site, and OpenAI's image API (`gpt-image-2.5-flare`) draws the concept images.
- One Docker image, deployed on Render.
- 126 tests, including every showcase end to end on synthetic data, and a security pass on the live site (rate limits keyed on the real visitor, security headers, patched dependencies).

## Challenges we ran into

**The maths.**
- Signalling a tag with a location lets the location swamp it: crime plus Hyderabad returned *Borat*. The theme had to be a filter, not a signal.
- Affinity comes back flat at the top (0.98–1.00), so ranking by it is noise. AYTO ranks by set differences and by affinity minus popularity.
- A country baseline behaves like its largest city: Biographical reads +22 in Hyderabad and +22 in Chennai. Control cities fixed that.

**The live API's quiet traps.**
- "Mumbai, India" returns zero artists without an error; the state-qualified name works.
- Tags are typed: a film genre tag filters no artists, and of twelve hip hop tags only three filter artists, one of them named " Hip Hop" with a leading space.
- An original film and its remake share an alias, and the describe tool picks the remake.
- Recommendation results carry no aliases, no tags and no dates.

**The models.** Replies come back after a thinking block, in code fences, cut off mid-word, or in the wrong shape. The writer repairs the reply, and fills empty sections from the evidence, never from guesswork.

## Accomplishments that we're proud of

- A lane you can check. Folk crime in Hyderabad isn't a vibe: it's rank 14 against "not in the top 30", above three control cities, with zero recent supply, and every step is a receipt.
- 25 of 25 names traced in the live run.
- The original, not the remake: "HIT" means the Telugu film in Hyderabad.
- Eight formats and 12 model providers on one engine, plus an MCP door for agents.
- It fits a free host: at 0.1 CPU and 512 MB with an empty cache, all three showcases finish within about 85 seconds of boot.
- Before the deploy, a bug hunt reproduced and fixed about 90 bugs and grew the suite from 79 to 118 tests.

## What we learned

- Qloo is strongest as a difference engine: the same read for the city and for the country, and the gap between them, beats any single affinity score.
- Every claim has to be checkable. Once each name on the page opened its Qloo request, it was obvious which parts were evidence and which were the model.

## What's next for AYTO

- A supply read across a market's full release slate, not just the themed catalogue.
- Momentum, once Qloo's trend data moves.
- A team view, where a production house compares lanes across its cities.
- Supply for the formats Qloo gives no release years (reels, drops, cafés, nights), so their lanes weigh what's already out there too.
- A deeper casting read, with each actor's recent work.

---

## Built with

`node.js` · `express` · `javascript` · `qloo` · `qloo-insights-api` · `mcp` · `model-context-protocol` · `groq` · `anthropic` ·
`openai` · `deepseek` · `three.js` · `leaflet` · `docker` · `render` · `server-sent-events`

## Try it out (links)

- Live app: https://ayto-ocx1.onrender.com
- Source: https://github.com/devreddy1015/ayto-qloo
- MCP endpoint: https://ayto-ocx1.onrender.com/mcp (discovery at https://ayto-ocx1.onrender.com/.well-known/ayto.json)

## Video demo link

`<YouTube or Vimeo link>`. Script: [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md).

## Image gallery (in this order)

Ten 3:2 JPEGs in `submission/gallery/` (kept out of git), named in upload order. Every one is from the live site on
31 Oct, written by DeepSeek. Use `01-the-gap.jpg` as the thumbnail too.

| # | File | Caption |
|---|---|---|
| 1 | `01-the-gap.jpg` | The gap: Folk, Finance, Revenge and Justice. Loved in Hyderabad, not in India's top 30, and no recent film carries them. |
| 2 | `02-one-sentence.jpg` | One sentence. AYTO shows what Qloo found: the city, the Crime tag, and HIT (2020, Telugu) over its Hindi remake. |
| 3 | `03-film-treatment.jpg` | The Clock Tower Ledger: a film treatment written into the gap, every name traced to Qloo. |
| 4 | `04-with-vs-without-qloo.jpg` | The same question without Qloo: 4 of 10 names trace. With Qloo: 17 of 17. |
| 5 | `05-reel.jpg` | Vegas After Dark: a reel for Las Vegas, every venue and artist from Qloo. |
| 6 | `06-fashion-drop.jpg` | Kinetic Kin: a kidswear drop for Tiruppur's buyers, with styles you can turn in 3D. |
| 7 | `07-production-run.jpg` | The drop's first production run: 1,500 units across 5 styles, costed as editable assumptions. |
| 8 | `08-compare-cities.jpg` | "Where should I make it?" Ten cities, each against the other nine. |
| 9 | `09-the-look.jpg` | The look Hyderabad's crime crowd leans to, from Qloo's own style tags. |
| 10 | `10-locations.jpg` | Locations from the places this crowd goes, and a shoot base. |
| 11 | `11-concept-image.jpg` | A concept image OpenAI drew from the Hyderabad brief: the look, the palette and the place, with no real names. |
