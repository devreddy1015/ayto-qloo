# Devpost submission draft

## Title
AYTO — Are You The One

## Tagline
Tell AYTO what you're making and where. Qloo finds the gap in what the city loves. Your own LLM writes you into it.

## Who it's for
The filmmaker in Hyderabad, and the production house behind them, deciding what to make next. India released 1,972 films in 2025 and only six Telugu releases succeeded; the audience research producers buy today (Ormax) starts after a film is announced. AYTO works before greenlight. Reel creators and small fashion makers run on the same engine and are shown as the other two formats.

## Inspiration
Everyone making something for a place starts from a blank page and a guess. A filmmaker in Hyderabad knows crime films do well; nobody can tell them which kind of crime film Hyderabad loves and isn't getting. Qloo knows the first half. AYTO does the second.

## What it does
One sentence in: "I'm making a crime short film in Hyderabad, after HIT, on a shoestring." AYTO shows what Qloo made of it before anything runs: the city (a typo like "Hydrabad" is read as Hyderabad, and says so), the theme as Qloo tags, and each title you named. When a title exists twice, AYTO picks the original in the city's own language. "HIT" in Hyderabad is the 2020 Telugu film, not its 2022 Hindi remake, and you can switch.

Then it reads the city three ways (city vs country vs a contrast city). It finds the flavours the city ranks far above the country and above three control cities, so a lane belongs to this city, not just "not the country". It counts how many recent titles actually carry each flavour, and ranks the lanes: loved here, under-served. A look stage reads the style words the city leans to from Qloo's own tag families: Cinematic, Moody and Gritty for Hyderabad's crime crowd; Denim and Leather up, Silk down for Tiruppur's buyers. It reads the audience skew, the artists, the places this crowd goes and the area where most of them sit (the shoot base), and where the taste travels next.

Finally your own language model (12 providers, key never stored) writes the thing into lane 1. For a film that means a treatment you can shoot:
- titles, a logline and three acts
- five or six beats, and characters with what they want and hide, their look and their arc
- the films to study, with the shot to borrow from each
- cast ideas from the people this city favours
- locations by beat, with Qloo's own description of each place
- camera and light notes for your budget, and a palette

Not sure where yet? "Let AYTO compare cities" reads the same theme across the country's ten largest cities. Each city is measured against the country and against the other nine, so a lane counts only where few other cities share it. AYTO maps where the widest open lane is, lists what's crowded everywhere, and runs the full treatment for the city you pick. For crime films in India, Kolkata's lane is Crime Lord, Delhi's is Finance and Mumbai's is Gender Violence, while Martial Arts and Biographical lean high almost everywhere. Agents get the same ranking through the MCP door.

Seven more formats run on the same engine: a reel (hook, beats, song, spots, caption), a fashion drop you can turn in 3D with a first production run costed as editable assumptions, a podcast, an indie game, a café, a live event night and a book.

A check stage removes any name the model made up and has the writer try once more with those names banned. Every name on the page opens the Qloo request it came from.

## What makes it Qloo-powered
Every step is a Qloo request with a receipt: locality search and tag resolve; `qloo_recommend` with the theme as `include_tags` and the location as the signal, run for the city, the country and a contrast city, which gives the only-here picks; a `urn:tag` Insights read with `signal.location.query` for the city, the country and three control cities, which gives demand lift and specific lift per flavour; typed tag reads (`filter.tag.types`) and tagged entity reads for the look (style, aesthetic, material and age tags); an entity Insights read with `filter.tags` and the city as signal, returning 50 titles with their own tags and years, which gives supply; audience demographics; artist and place recommendations signalled by the city's picks; a geohash heatmap snapped to Qloo localities for where the taste travels. Place recommendations come with Qloo's own short description and price level, which become the shoot locations. When the theme's tag can't filter a kind (people, podcasts, games), AYTO tries the theme's other tags for that kind, then seeds the read with Qloo's search for the theme or with the picks of a section that is on theme. That's how a horror film's cast comes back as Hunter Schafer and Florence Pugh, not a local quarterback. /entities supplies the aliases that pick the right title and the dates that keep people who have died out of a cast list. "Where should I make it?" runs one tag read per city for the country's ten largest cities and treats them as each other's controls: a city's lane is its lift over the country minus the 70th percentile of the other cities' lifts. The with-vs-without card runs the same sentence with no evidence and counts the names that trace. Without Qloo there is no lane, no list, no map: only a prompt.

## How we built it
Node + Express, vanilla JS, SSE streaming. Qloo through the official harness for workflow tools, raw Insights for heatmaps, tag reads and tagged entity reads. An evidence ledger wraps every Qloo call. The gap formula compares only within one response. A stateless MCP server exposes the same engine to agents.

## Challenges
Signalling a tag with a location lets the location swamp it (crime + Hyderabad gave Borat). Affinity comes back flat at the top, so ranking by it is noise. Filtering by affinity tags returns nothing because they are not entity tags; the tagged catalogue read fixed supply. Free text without a confirm step shipped nonsense once; now a city Qloo cannot place blocks the run. The live API had quieter traps:
- "Mumbai, India" returns zero artists without an error; the state-qualified name works.
- Qloo's tags are typed: a film genre tag filters no artists, and of twelve hip hop tags only three filter artists, one of them named " Hip Hop" with a leading space.
- For films, "cricket" filters only as a media keyword.
- An original and its remake share an alias, and the describe tool picks the remake.
- Recommendation results carry no aliases and no dates.

We found each of these by checking 13 live runs against what they were asked for, and the fixes are in the changelog. Model replies are another trap: the writer accepts a reply after a thinking block, in code fences or cut off by the token limit, and fills any section the model left empty from the evidence, never from guesswork.

## What we learned
Documented in the README under "What the live API taught us".

## What's next
- A supply read across a market's full release slate, not just the themed catalogue.
- Momentum, once Qloo's trend data moves.
- A team view, where a production house can compare lanes across its cities.
- A deeper casting read, with each actor's recent work.

## Links
- Live: _fill in_
- Repo: https://github.com/devreddy1015/ayto-qloo (MIT)
- Video: _fill in_

## Video script (3 minutes)
Record at 1080p from the live URL with a key set (server key or the drawer). Run the showcases once beforehand so they open instantly.

**0:00–0:15 The problem.** Narrate over the home page: "Making something for a city starts with a guess. Qloo knows what the city loves. AYTO finds what it loves and isn't getting."

**0:15–0:35 One sentence.** Type "A short film in Hyderabad about crime, after HIT: The First Case, on a shoestring" and click Check with Qloo. Point at the confirm strip: the city, the Crime tag, "HIT (2020, Telugu)" picked over the Hindi remake, and the budget.

**0:35–1:10 The read and the gap.** Click Run. Show:
- the three-column read: only-Hyderabad films against India's top
- the gap card: Folk, Finance and Revenge and Justice, specific to Hyderabad against three control cities, with no recent title carrying them
- the look: Cinematic, Moody, Gritty

Hover one chip to show its receipt.

**1:10–1:55 The treatment.** Scroll the write card:
- titles and logline
- the beats
- one character card (wants, hides)
- a reference with its "borrow" note
- the shoot base and its locations
- camera, and the palette (click a swatch to copy it)

**1:55–2:15 Grounded.** Show the check card ("every name traces to Qloo") and the with-vs-without card, where the same sentence without Qloo names nothing traceable. Open one receipt.

**2:15–2:25 Where?** Back on the home page, type "a crime short film in India" and click "Let AYTO compare cities". Point at the map, Kolkata's Crime Lord against Delhi's Finance, and the "crowded everywhere" line.

**2:25–2:35 Same engine.** Click the Las Vegas reel showcase, then the Tiruppur kidswear drop: the 3D garment and the costed first run.

**2:35–2:50 Yours.** Open the key drawer (your key, never stored), then the share page and its Markdown brief.

**2:50–3:00 Honest limits.** "Qloo describes taste, not sales. AYTO says lean and signal, never hit."
