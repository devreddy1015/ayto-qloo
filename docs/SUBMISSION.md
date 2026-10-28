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
One sentence in: "I'm making a crime short film in Hyderabad." AYTO resolves the city and the theme with Qloo and shows what it found before anything runs. Then it reads the city three ways (city vs country vs a contrast city), finds the flavours the city ranks far above the country, counts how many recent titles actually carry them, and ranks the lanes: loved here, under-served. It reads the audience skew, the artists and places the crowd favours, and where the taste travels next. Finally your own language model (12 providers, key never stored) writes the thing into lane 1: a film with titles, logline and three acts; a reel with a hook, beats, audio and spots; a fashion drop you can turn in 3D with a first production run costed as editable assumptions; or a podcast, an indie game, a café menu and playlist, a live event night, a book. A check stage removes any name the model made up and, if it removed anything, has the writer try once more with those names banned. Every name on the page opens the Qloo request it came from.

## What makes it Qloo-powered
Every step is a Qloo request with a receipt: locality search and tag resolve; `qloo_recommend` with the theme as `include_tags` and the location as the signal, run for the city, the country and a contrast city, which gives the only-here picks; a `urn:tag` Insights read with `signal.location.query` for the city and the country, which gives demand lift per flavour; an entity Insights read with `filter.tags` and the city as signal, returning 50 titles with their own tags and years, which gives supply; audience demographics; artist and place recommendations signalled by the city's picks; a geohash heatmap snapped to Qloo localities for where the taste travels. The with-vs-without card runs the same sentence with no evidence and counts the names that trace. Without Qloo there is no lane, no list, no map: only a prompt.

## How we built it
Node + Express, vanilla JS, SSE streaming. Qloo through the official harness for workflow tools, raw Insights for heatmaps, tag reads and tagged entity reads. An evidence ledger wraps every Qloo call. The gap formula compares only within one response. A stateless MCP server exposes the same engine to agents.

## Challenges
Signalling a tag with a location lets the location swamp it (crime + Hyderabad gave Borat). Affinity comes back flat at the top, so ranking by it is noise. Filtering by affinity tags returns nothing because they are not entity tags; the tagged catalogue read fixed supply. Free text without a confirm step shipped nonsense once; now a city Qloo cannot place blocks the run.

## What we learned
Documented in the README under "What the live API taught us".

## What's next
More formats (a café, a tour, a podcast) on the same engine; a real supply read across the market's release slate; momentum once trend data is live.

## Links
- Live: _fill in_
- Repo: https://github.com/devreddy1015/ayto-qloo (MIT)
- Video: _fill in_

## Video script (3 minutes)
0:00 The problem: a blank page and invisible local taste. (20 s)
0:20 Hyderabad crime film: the sentence, the confirm strip, the three-column read, the lanes card, the written film. (60 s)
1:20 Las Vegas reel: hook, audio, spots. (40 s)
2:00 Receipts: open a request. With vs without Qloo. (30 s)
2:30 Bring your own key, the MCP door. (20 s)
2:50 Honest limits. (10 s)
