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

Film shows the cost most sharply. A filmmaker in London knows crime travels. Nobody can tell them which kind of crime story London loves and isn't getting, and the audience research a producer can buy mostly tests films that already exist, after they're announced.

Qloo knows what a city loves. AYTO finds what it isn't getting, and writes your idea into that gap.

## What it does

AYTO is an agent with taste. You tell it, in one sentence, what you're making and where. It reads the city through Qloo, finds the gap, and writes your thing into it. Eight formats run on the same engine:

| You're making | AYTO writes |
|---|---|
| **A film** (short, feature, series) | the story told simply, then a treatment you can shoot: titles, logline, three acts, beats, characters, films to study with the shot to borrow, cast ideas, locations, camera notes, palette |
| **A reel** | the hook, beats, song, spots and caption |
| **A fashion drop** | styles you can turn in 3D, a palette, labels to study (and, for makers in India, a first production run costed for India's marketplaces) |
| **A podcast** | premise, episodes, guests, intro music |
| **An indie game** | pitch, core loop, mechanics, art style, soundtrack, platforms |
| **A café** | concept, menu, brands to stock, playlist, neighbourhood |
| **A live event night** | concept, lineup, venue, run sheet, promo hook |
| **A book or web novel** | premise, logline, chapters, comparable titles |

Every format gets the same Qloo read underneath: the city against the country and control cities, the gap, the look, the audience, artists, places, and where the taste travels next.

Here is one run, start to finish, for the sentence *"I'm making a crime short film in London."* (live, 31 Oct, written by Claude Sonnet 5.5):

**1. It confirms what Qloo found, before anything runs.** The city as a Qloo locality (a typo still finds it, and AYTO says so), the theme as Qloo tags, and each title you named. When a title exists twice, an original and its remake, AYTO picks the original and lets you switch.

**2. It reads the city and finds the gap.** Same theme, read for London, for the UK and for three control cities (Glasgow, Liverpool and Leeds). A lane counts only if the city ranks it far above the country *and* above comparable cities. Then AYTO counts how many recent titles in the city's own catalogue carry each lane.
- **Autobiographical, Indietronica, Tragedy.** London ranks each in its top 15; the UK doesn't rank them in its top 30, and the control cities, taken together, don't share the lean.
- **Zero** recent titles in the catalogue carry them. That's the gap: loved here, under-served.
- **The look** London's crime crowd leans to: Naturalistic +6, Intimate +6, Documentary-like +6, Gritty +4. Less Cinematic and Polished.
- **The rest of the read:** 12 titles London favours that the UK doesn't; artists it favours beyond the UK (Azealia Banks, Tinashe, Dua Lipa, Janelle Monáe); a shoot base in Westminster, where 4 of the crowd's 8 places sit; an audience that skews under 25 and leans female; and the cities that lean the same way (Derby, Bradford, Bristol, Oxford).

**3. A language model writes into lane 1.** The site's own model is Claude Sonnet 5.5, or bring yours (12 providers; the key is never stored). The film opens with the story told simply: Amara, 22, records an audio memoir about her family and finds her brother has been rewriting the tapes. Then *Fourteen Minutes* as a treatment you can shoot:
- titles, a logline and three acts;
- beats, and characters with what each wants and hides, their look and their arc;
- the films to study, from Qloo's read, with the shot to borrow from each (*Queen & Slim*, *The Hate U Give*, *The Good Liar*);
- cast ideas from the people this city favours;
- locations by beat, camera and light notes for your budget, and a palette ("Thames Slate", "Wet Pavement", "Tape Hiss Amber").

For a city in India it can write in the city's own language (Telugu, Tamil, Hindi and more), with every Qloo name kept checkable.

**4. It checks itself.** Every name in the output is looked up in what Qloo returned during the run. Anything made up is removed, and the writer tries once more with those names banned. Every name on the page opens the Qloo request it came from. In the live London run, 27 of 27 names trace to Qloo.

**5. It proves Qloo is the difference.** The with-vs-without card asks the same model the same question with no Qloo evidence, and counts how many of its names trace to anything. For London: with Qloo, 13 of 13 trace. Without it, 0 of 10: the model reached for the London crime films everyone already knows (*Mona Lisa*, *Nil by Mouth*, *Top Boy*).

**Not sure where yet?** Say "a crime short film in the UK" and click *Let AYTO compare cities*. AYTO reads the theme across the country's ten largest cities. Each city is measured against the country and against the other nine, so a lane counts only where few others share it. The map shows where the widest open lane is:
- Glasgow's is Consequences of Crime (+26), London's is Autobiographical and Tragedy, and Liverpool's is the Entertainment Industry.
- Social Issues, Occult, Horror and Science Fiction lean high almost everywhere, so they're nobody's gap.

One click runs the full treatment for the city you pick. It works for the US, the UK, France, Germany, Spain, Canada, Australia, Japan, South Korea, Brazil, Mexico, India and more.

**The other showcases** run the same way:
- **A Las Vegas reel** about nightlife and food: lanes Club-like (+23) and Party-oriented (+18), written as *Last Call Is a Moving Target*.
- **A Paris streetwear drop**, with lanes Artistic Community (Paris #10, France #26), Avant-Garde Artists and Intellectual.
  - The look is Creative, Minimalist Silhouettes and Neutral Palettes, more Leather and Wool, less Viscose, Lace and Polyester.
  - The labels to study are Maison Kitsuné, Ami, A.P.C. and Acne Studios.
  - Five styles you can turn in 3D, from a Salon Leather Jacket to a Cloister Cashmere Cape.
  - 43 of 43 names trace to Qloo. Without Qloo, 1 of 10.

**Three pages per run.** *The brief* (the story, the treatment, the check, with vs without Qloo, and a share page), *The evidence* (every Qloo read and its receipt; the London run makes 45 requests), and *Make it* (the studio below).

**See it.** One click asks OpenAI to draw a concept image from the brief: a film's mood still, a café's room, a drop's hero garment. The prompt is built from Qloo's look words, the brief's palette and the area AYTO found, with every Qloo name kept out, so the picture is original art in the city's taste, never a real poster, logo or person.

**Shoot it beat by beat.** For a film, one click builds a shot deck: a storyboard frame per beat with its shot line (size, lens, light, movement) and the Qloo-traced film to study, drawn as original art and downloadable as one file.

**Turn it in 3D.** A drop's styles stand on a mannequin you can orbit, including maxi dresses, a saree with its pallu, a cape and an original cosplay set. One click has OpenAI draw a style's print onto the garment. For a hero style, Stability's Stable Fast 3D makes a real `.glb` model to download. Under the preview, a strip of pictures Qloo returned shows the labels the city favours, each with its receipt.

**Hear the story.** Sarvam's Bulbul reads the brief aloud in its own words and language: English with an Indian voice, or Telugu, Tamil or Hindi when the brief is written in one. A music tone from Google's Lyria, described only by the genres, moods and instruments the city's favoured artists carry on Qloo, is offered when the server's key has Lyria quota.

**Agents can use it too.** AYTO is an MCP server at `/mcp` with four tools: `ayto_where_to_make`, `ayto_read_city`, `ayto_find_gap` and `ayto_write`. Claude, or any other MCP client, can ask where to make something and get back lanes with receipts.

**How to try it:** open the live link (no login) and click a showcase (the London film, the Las Vegas reel or the Paris drop), or type your own sentence for any of the eight formats and any city.

## How it's agentic

- **It plans per format.** Each format has its own stage plan: a film reads the look and locations, a podcast skips them, and a fashion drop adds production.
- **It reads with tools.** Every stage calls Qloo's tools through the official harness (`qloo mcp`) or raw Insights.
- **It writes, then checks its own output** against the evidence, and rewrites once with the invented names banned.
- **It answers follow-ups.** The "Ask the analyst" box calls Qloo tools itself, for example `qloo_describe`, `qloo_audience_demographics` and `qloo_where_popular`, up to 12 calls per question.
- **It is a tool for other agents** through the MCP door.

## What makes it Qloo-powered

Nothing on the page exists without Qloo. The London film run makes 45 Qloo requests, and each one is a receipt you can open. For a fashion drop you can see it too: the with vs without Qloo card stands the two hero pieces side by side in 3D, the one written from the city's read next to the one the same model makes with nothing to go on.

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
- Claude Sonnet 5.5 writes on the live site. OpenAI's image API (`gpt-image-2.5-flare`) draws the concept images, shot decks and prints. Sarvam's Bulbul reads the story aloud.
- One Docker image, deployed on Render.
- 163 tests, including every showcase end to end on synthetic data, and a security pass on the live site (rate limits keyed on the real visitor, security headers, patched dependencies).

## Challenges we ran into

**The maths.**
- Signalling a tag with a location lets the location swamp it: crime plus a city returned *Borat*. The theme had to be a filter, not a signal.
- Affinity comes back flat at the top (0.98–1.00), so ranking by it is noise. AYTO ranks by set differences and by affinity minus popularity.
- A country baseline behaves like its largest city, so a lift over the country is often shared by every big city. Control cities fixed that: a lane has to beat them too.

**The live API's quiet traps.**
- Some "City, Country" queries return zero artists without an error; the state-qualified name works.
- Tags are typed: a film genre tag filters no artists, and of twelve hip hop tags only three filter artists, one of them named " Hip Hop" with a leading space.
- An original film and its remake share an alias, and the describe tool picks the remake.
- Recommendation results carry no aliases, no tags and no dates.

**The models.** Replies come back after a thinking block, in code fences, cut off mid-word, or in the wrong shape. The writer repairs the reply, and fills empty sections from the evidence, never from guesswork.

## Accomplishments that we're proud of

- A lane you can check. Autobiographical crime in London isn't a vibe: it's rank 14 against "not in the UK's top 30", ahead of Glasgow, Liverpool and Leeds, with zero recent supply, and every step is a receipt.
- 27 of 27 names traced in the live London run, and 43 of 43 for Paris. Without Qloo, none of the same model's 10 London names trace.
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
- Production costing for Europe and the US, not only India's marketplaces.
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

Twelve 3:2 JPEGs from the live site on 31 Oct, in `submission/gallery-v2/` (kept out of git) and in `~/Downloads/ayto-gallery-v2/`, named in upload order. `00-thumbnail.jpg` is also the project thumbnail. Captions are 140 characters or fewer.

| # | File | Caption |
|---|---|---|
| 0 | `00-thumbnail.jpg` | AYTO, an agent with taste: Qloo finds what a city loves and isn't getting, and your AI writes into the gap. |
| 1 | `01-london-gap.jpg` | The gap for a crime short film in London: Autobiographical, Indietronica, Tragedy. Loved in London, not in the UK's top 30. |
| 2 | `02-london-brief.jpg` | The story, simply, then Fourteen Minutes: a treatment Claude wrote into the gap, 27 of 27 names traced to Qloo. |
| 3 | `03-london-with-without.jpg` | The same question without Qloo: Mona Lisa, Nil by Mouth, Top Boy, and 0 of 10 names trace. With Qloo: 13 of 13. |
| 4 | `04-london-shot-deck.jpg` | A shot deck: one storyboard frame per beat, with its shot line and a Qloo-traced film to study. |
| 5 | `05-london-read.jpg` | What London favours that the UK doesn't: the three-column read, with Birmingham as the contrast city. |
| 6 | `06-london-look.jpg` | The look London's crime crowd leans to, from Qloo's style tags: Naturalistic, Intimate, Documentary-like, Gritty. |
| 7 | `07-london-concept.jpg` | A concept image OpenAI drew from the brief: its look, palette and place, with no Qloo name in the prompt. |
| 8 | `08-paris-3d.jpg` | A Paris streetwear drop in 3D: five styles on a mannequin you can orbit, coloured from the drop's palette. |
| 9 | `09-paris-drop.jpg` | Quiet Atelier: a drop for Paris's Artistic Community lane, with labels to study from Qloo. |
| 10 | `10-vegas-reel.jpg` | Last Call Is a Moving Target: a Las Vegas reel written into the city's Club-like lane. |
| 11 | `11-uk-compare.jpg` | Where should I make it? Ten UK cities, each against the other nine: Glasgow's open lane is Consequences of Crime. |
