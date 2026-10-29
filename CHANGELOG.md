# Changelog

What changed in AYTO (Are You The One), newest first. Times are IST. Each entry names the pull request on
[devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) that carried it.

## Unreleased (29 Oct, evening): fixes from a full live test

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
- **Cast.** People Qloo marks as having died stay in the read (they are part of the taste) but never reach a cast list.
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
