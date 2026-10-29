# Changelog

What changed in AYTO (Are You The One), newest first. Times are IST. Each entry names the pull request on
[devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) that carried it.

## Unreleased: "Where should I make it?"

- **A new question before the usual one.** "Let AYTO compare cities" (home page, and the confirm step when a city
  can't be placed) reads one theme across a market's ten largest cities with one Qloo tag read each. Every city
  is measured against the country and against the other cities (the 70th percentile of their lifts, so a
  flavour three other cities share is never one city's lane). A map shows where the widest open lane is, each
  city lists its own lanes, a line names what's crowded everywhere, and "Make it in <city>" hands the city to the
  usual confirm and run. Qloo only, no model key; 22 requests, under a second once cached.
- Live, crime films in India: Kolkata Crime Lord, Delhi Finance, Mumbai Gender Violence, Bengaluru Documentary;
  Martial Arts, Travel and Biographical crowded in nearly every city. Street-food reels: Kolkata chowmein,
  Bengaluru masala dosa, Ahmedabad mukhwas; pizza and dessert crowded everywhere.
- **The MCP door gets a fourth tool**, `ayto_where_to_make`, so an agent can ask the same question.
- "Adult" and other content ratings are never a lane.

## Unreleased: ready for a real model and a deploy

- **Model replies that arrive broken still give a full page.** The writer reads the JSON after a thinking block,
  inside code fences or after a line of prose, and repairs a reply cut off by the token limit (the half-written
  last item is dropped). Every field is coerced to the shape the page expects, and a section the model left
  empty is filled from the Qloo evidence; the write card says which. Tested end to end against a fake model that
  answers badly on purpose (test/llm-e2e.test.js).
- **A local model for the server.** `LLM_PROVIDER=local` with `LLM_BASE_URL` points the server's writer at any
  OpenAI-compatible endpoint (Ollama, LM Studio). Visitors are never offered it.
- **Deploy.** The Render blueprint defaults to the free plan, takes a Groq, Anthropic or any provider's key, and
  caps the server key at 60 model runs a day. The discovery document uses Render's own URL. The image was rebuilt
  and boots.
- **Devpost text and a click-by-click video script** for what the app does now.

## PR #15 (29 Oct, 17:00): every section fits the input

A check of 13 live runs against what each one asked for found sections that ignored the theme. Fixed:

- **Sections the theme can't filter.** When Qloo's theme tag filters nothing for a kind (people, podcasts,
  games, some films), the read used to fall back to the city's general favourites. Now it tries the theme's
  other tags for that kind first (for films, "cricket" as a media keyword returns '83, Jersey and Ghoomer).
  Then it seeds the section: films, series, books, podcasts and games from Qloo's search for the theme
  (startup podcasts: How I Built This, Masters of Scale), people from the picks of a section that is on theme.
  Austin's horror cast is now Hunter Schafer, Maya Hawke and Florence Pugh, not a quarterback and a senator.
  The startups podcast's guests are Guy Kawasaki, Seth Godin and Shradha Sharma, not film stars.
  Each column says how it was read. Music keeps the city's own taste.
- **Stray spaces in Qloo's names.** The hip hop music tag is named " Hip Hop", so it was missed and Chennai's
  lineup lost the theme. Names now match loosely, and the tag whose id is the word itself wins
  (only that one filters artists, verified live). The lineup is now Shan Vincent de Paul, Blaaze, Cartel Madras.
- **Lanes from the theme's own kind.** A street-food or nightlife reel read its lanes from music tags, so its
  hashtags were #Jumpstyle and #Hardstyle. Lanes now come from the first kind the theme belongs to: food for
  street food, places for nightlife, films for love, music for hip hop.
- **Shoot spots follow the theme** when it is a place kind of theme: the street-food reel shoots at Gokul Chat,
  not a gym.
- **Kidswear reads children's labels** (Catimini, Jacadi, Bob & Blossom) through Qloo's kidswear segment, not
  watches and motorcycle gear.
- **The music no longer changes run to run.** It was seeded in the order the reads happened to finish.
- **Smaller.** A name with no stated kind takes the kind the format reads first (a reel's "Sid Sriram" is the
  singer). "An indie game" no longer sets a budget. "Coffee and books" keeps "books" (a Library lane appeared).
  Names in another script are looked up for an English alias, and ranked after readable names when there is none.
  The reel template's references are titles, not artists.

**Correction.** The PR #13 entry said people who have died never reach a cast list. It did not work on live
data: recommendation results carry no date of death. The read now looks the top people up on /entities, and
Dilip Kumar is out of the Mumbai cast. This entry is the fix.

## PR #14 (29 Oct, 15:57): a new logo

- **The mark.** A ring (what a city already loves) open at the upper right (the gap: loved here, under-served),
  with a tape-yellow dot in the opening: the maker, placed into it. It replaces the measuring tape left over from
  the fashion-only first build.
- In the header the ring is the O of AYTO; the dot nudges toward the gap on hover (no motion when the system asks
  for less). It is the tab icon (public/icon.svg), the home-screen icon (icon-180.png, icon-512.png), the top of
  every share page, and the top of the README.

## PR #13 (29 Oct, 15:40): fixes from a full live test

A test of every format on live Qloo data (film in Hyderabad, Mumbai and Austin; the Las Vegas reel; the Tiruppur
kidswear drop; a podcast, an indie game, a café, a live night and a web novel; a typo city) found these, now fixed:

- **Typo city names.** "Hydrabad" stopped the run. When Qloo can't place a name, AYTO tries the closest known city
  (two letters off at most, or an old name such as Bangalore or Bombay), runs on it, and says so on the confirm step
  and the Resolve card. A town Qloo does know is never swapped.
- **One lane per name.** Qloo can list two tags with the same name; the Pune cricket game got "Survival" twice.
- **Avoid list.** Never a sibling of the theme (a cricket game is not told to avoid Sports, a horror film Darkness,
  a startups podcast Entrepreneurial Spirit, a café Cappuccino), never "Sports" and "Sport" as two entries, never a
  word too broad to mean anything (Film, Music, Art).
- **Lanes.** Words too broad to be a lane are dropped ("Music" for a hip hop night). Tag names are tidied:
  "underground  rap" reads "Underground Rap".
- **Places.** Adult venues, self-storage, petrol pumps and parking are dropped with the homes, clinics and consulates.
  Wards and islands are never a neighbourhood ("K/E Ward", "Salsette Island"). "Juhu Juhu" reads "Juhu".
- **Cast.** Meant to keep people who have died out of cast lists. It did not work on live data; see the correction above.
- **Names.** The check stage matches names whatever their spacing, not only their case.
- **Background.** A finished run's page loaded its image mosaic two or three times; now once.
- Small copy: "1 junk or private place dropped".

## PR #12 (29 Oct, 15:02): a full film treatment, the right title, an avoid list that fits

From a side-by-side with a friend's Qloo film tool on the same Hyderabad briefs.

- **Titles shared by an original and its remake.** Qloo lists the Telugu "HIT" (2020) with the alias
  "Hit: The First Case", the name of its 2022 Hindi remake, and its describe tool took the remake. AYTO now
  searches and ranks: a year the maker typed, then the original over a remake, then the city's own language
  (by state in India, by country elsewhere). The confirm step lists each title's options. With the right title,
  Hyderabad's cast is Telugu, led by Ramya Krishnan, instead of Hindi.
- **Avoid list.** A flavour that a fifth of the themed catalogue carries (Thriller for crime), a sibling genre, or
  a word the maker typed (Short, for a short film) is never "avoid". The gap card says why each was kept out.
- **Film locations.** The film plan gets the locations stage. Venues carry their area, Qloo's short description
  and price level. The shoot base is the area with the most of this crowd's places. The heatmap names its hot cells
  by the nearest small locality instead of ranking admin zones.
- **Budget.** Shoestring, indie or premium, from the confirm step or the sentence ("on a shoestring").
- **Treatment.** The film writer returns beats, characters (wants, hides, look, arc, archetype), a shot to borrow
  from each reference, locations by beat, camera and light notes for the budget, and a palette to copy. The check
  stage grounds every name in beats and locations and keeps the beat when a name is removed. Run page, share page
  and brief render all of it.
- **Parser.** Reads "after X", "inspired by X" and "X fans", and keeps a theme and a love together.

## PR #11 (29 Oct, 12:25): silent failures and lane maths

- **Locations that failed silently.** "Mumbai, India" returned zero artists without an error. Reads now send the
  locality id, and the workflow tools a state-qualified name ("Mumbai, Maharashtra, India").
- **Typed theme tags.** A film genre tag filters no artists, so each entity type picks the theme tag of its own family.
- **Empty answers** are kept in memory for ten minutes and never written to disk.
- **Lane maths.** A control city that doesn't list a flavour counted as −31 and inflated every specific lift by
  about 31. It now counts as no lift. Lanes rank on strength: the smaller of the lift over the country and the lift
  over comparable cities. Hyderabad crime: Folk +17, Finance +16, Revenge and Justice +15.
- **Server.** Reruns answer at once and report failures; the share-slug lookup no longer loads every run; the run
  cache is bounded; health is cached for a minute; HTML, JS and CSS revalidate on every load.

## PR #10 (29 Oct, 11:06): home walkthrough, gallery, receipt chips

- "Watch it work": one real run shown in four steps on the home page.
- "Now showing": a gallery of finished pieces from this server.
- Every Qloo name chip carries its receipt: rank, affinity, popularity, only-here and hidden-gem flags.
- The film look reads the character archetypes and themes the city leans to; the writer draws characters from them.

## PR #9 (29 Oct, 10:59): control cities, the look stage, beta formats

- **Specific lift.** The same flavour read runs for three control cities; a lane says whether it belongs to this
  city, leans here, or is shared by most big cities.
- **Look stage.** Film: the style tags the city's catalogue carries more than the country's, with Qloo's own style
  notes. Fashion: aesthetics, personal styles, materials, age groups and segments on the city's fashion labels.
- Film, reel and fashion lead; podcast, game, café, event and book are marked beta.

## PR #8 (29 Oct, 10:19): share page restyle

- Fraunces headings and Instrument Sans body, with CSS-only entrance animations. The page still runs no scripts.

## PR #7 (29 Oct, 04:01): casting, brief download, editable assumptions

- Film runs read Qloo's people for the city, the country and the contrast city; the writer gets cast ideas.
- Every share page offers a Markdown brief and a print stylesheet.
- Fashion's production run takes your own MOQ, quantities, costs and price tier, and recomputes on the spot.

## PR #6 (29 Oct, 03:50): token receipts

- Every model call's input and output tokens are counted against its run and shown live, with whose key paid.

## PR #5 (29 Oct, 03:44): read stage timing

- The read stage gets its own time budget, country reads run in parallel, and places are read inside the city.
  A Barcelona reel went from timing out to under four seconds.

## PR #4 (29 Oct, 03:33): parser and category filters

- A format or everyday word ("cafe") is never taken as the city.
- Brand and place reads carry category tags, so a café run lists cafés, not museums.

## PR #3 (29 Oct, 03:21): docs

- README and Devpost draft: eight formats, the produce and 3D steps, what Qloo powers, honest limits.

## PR #2 (29 Oct, 03:15): eight formats, 3D garments, production run

- Podcast, indie game, café, live event night and book join film, reel and fashion.
- A Three.js garment viewer for fashion, with an SVG fallback.
- A production stage for fashion: tech packs, unit economics per channel, the ₹2,500 GST cliff, size curves,
  a city split, and the Legal Metrology declarations, all as editable assumptions.
- The writer rewrites once when the check finds names Qloo never returned.

## PR #1 (28 Oct, 23:25): AYTO

The rebuild around one sentence: "I'm making ___ in ___".

- Qloo reads what the city loves beyond the country and beyond a contrast city, and finds the gap: flavours the
  city ranks high that few recent titles carry.
- The maker's own LLM writes the film, reel or fashion drop into that gap. Twelve providers; keys stay in memory
  for one run.
- Every name in the output traces to a Qloo request, and a card asks the same question without Qloo to show the
  difference.
- An MCP door, so other agents can use the same engine.

## Before AYTO (27 Oct): Culture Gap

The first build was a fashion-only, eleven-stage pipeline (later replaced by PR #1). It established
the pieces AYTO kept:

- lift-based heatmaps, read as geohash cells and named by Qloo's own localities
- typed tag reads
- receipts for every Qloo call
- edit-and-rerun
- fake sample mode
