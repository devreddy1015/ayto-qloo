# Changelog

What changed in AYTO (Are You The One), newest first. Times are IST. Each entry names the pull request on
[devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) that carried it.

## PR #29 (31 Oct, 01:20): the submission covers all eight formats

- **The pitch is for anyone making something for a city**, not only filmmakers: "An agent with taste for anyone making
  something for a city. Tell AYTO what and where: Qloo finds what that city loves and isn't getting, and your AI writes
  it into the gap." (172 characters.)
- **"About the project" opens with all eight formats** and what AYTO writes for each, then walks through the Hyderabad
  film as one run. It adds the live with-vs-without numbers (17 of 17 against 4 of 10), the security pass, and a
  next step for formats without release years.
- **The gallery** is ten 3:2 images from the live site, film, reel and fashion drop, in `submission/gallery/`.
- The Devpost draft carries all of this; images and the final submit are the user's.

## PR #28 (31 Oct, 00:47): a security check of the live site

- **Per-visitor limits work on Render.** Behind Cloudflare and Render's proxy, the address Express saw changed with
  every request: 21 requests to a 20-an-hour route all passed live, so one visitor could spend the day's budget (150
  runs, 100 written) and the demo would refuse every new sentence until midnight UTC. Limits now read
  `CF-Connecting-IP`, which Cloudflare sets and won't take from a client (a forged one gets a 403). Elsewhere,
  `CLIENT_IP_HEADER` names the header, and without it `req.ip` is used as before.
- **Security headers on every response:** `nosniff`, no framing (`X-Frame-Options: DENY`, `frame-ancestors 'none'`),
  and `strict-origin-when-cross-origin` referrers.
- **Dependencies:** Express 4.21.2 → 4.22.3 (body-parser, qs and path-to-regexp denial-of-service advisories), MCP SDK
  1.30.1 → 1.32.2. The four advisories left (undici, brace-expansion) sit inside Qloo's harness, which talks only to
  Qloo, and have no fix yet.
- **Checked and fine:** no XSS sink in the front end (no `innerHTML`); the share page escapes every field and carries a
  CSP with no scripts; run ids and slugs are validated before any file read; `.env`, `.git` and the source aren't
  served; the container runs as an unprivileged user; keys stay in memory and are redacted from errors.

## PR #27 (31 Oct, 00:29): DeepSeek back on the model that writes

- **`deepseek-chat` again.** After #26 switched the live site to `deepseek-flash` (V4.1, thinking off), a fresh
  Hyderabad run came back with every written section empty: no titles, no beats, no characters, 10 sections filled from
  the evidence, though the model returned 1,889 tokens. An hour earlier, `deepseek-chat` wrote a full treatment on the
  same site (The Clock Tower Ledger, 25 of 25 names traced). The retired name still answers, so it stays until the newer
  model is checked against the writers. The `extraBody` switch is gone with it.
- **The live site doesn't autodeploy.** The blueprint was made from the public repo URL, without Render's GitHub app,
  so each merge needs Manual Deploy → Deploy latest commit (CLAUDE.md says so).

## PR #26 (31 Oct, 00:14): live on Render, with DeepSeek

- **Live at https://ayto-ocx1.onrender.com** (Render, free plan). The README, the repo's About and the Devpost text link it.
- **DeepSeek uses its current model.** DeepSeek retired the name `deepseek-chat` on 24 Jul 2026 (it still answers for
  now). The entry now asks for `deepseek-flash` with thinking off: thinking is on by default, slow inside the write
  stage's budget, and expects its reasoning passed back on tool calls, which the analyst doesn't do. A per-provider
  `extraBody` carries the switch.
- **The video script quotes the live run**: the treatment DeepSeek wrote (The Clock Tower Ledger) and the
  with-vs-without card (17 of 17 against 4 of 10).

## PR #25 (30 Oct, 23:50): the submission pack

- **docs/VIDEO_SCRIPT.md**: a 60-second animated video for the animators, scene by scene (picture, on-screen text,
  voiceover), the app's palette, type and logo story, what must stay exact, and a 30-second cut. Every number is
  from a live run on 30 Oct.
- **docs/SUBMISSION.md** rewritten as a paste-ready Devpost pack: the rules' checklist, the Render deploy steps, the
  elevator pitch (168 characters), "About the project" with how AYTO is agentic, built-with tags, links and a
  gallery order with captions.
- **README**: the judging table uses the official criteria names; "compare cities" quotes today's read (Delhi's lane
  is no longer Finance); a line says how AYTO is an agent.
- `submission/` (frames and video assets) is git-ignored: the frames show Qloo output and film posters.

## PR #24 (30 Oct, 22:59): v0.2.0, ready for the deploy (bug hunt, batch 5)

Version 0.2.0: batches 1 to 5 of the bug hunt (30 Oct), about 75 bugs, each reproduced before it was fixed.

- **Qloo searches no longer start a process each.** Every city, love and title lookup ran `qloo api search` as a
  new process; on Render's free plan (0.1 CPU) one took about 10 s to start and four at once ran past the 30 s
  timeout, so showcases could fail to place their city. Search is now the same `GET /search` the harness makes,
  over HTTP (about 0.4 s), with the same results in the same order and the same cache keys.
- **Without a Qloo key the app now runs on labelled synthetic data** instead of a "samples" mode with no samples,
  where every run failed to place its city while health said ok.
- **render.yaml says what the free plan costs a judged demo**: it sleeps, and with no disk every sleep wipes the
  share links and the cache. A disk block is ready to uncomment with the Starter plan.
- **The home page**: one run whose titles came as objects made `/api/gallery` fail for everyone; a card that
  can't be built is now left out. A world wall that came back empty at boot is tried again, not kept all day.
- **The analyst** makes at most 4 Qloo lookups per model turn and 12 per question (a model asking for 40 at once
  made 240), stops when the visitor leaves, counts against the server model's daily cap, and keeps its tools on
  the last call (Anthropic refused that call without them).
- **The MCP door**: a run that fails is a tool error with its reason; share links are absolute; a key without its
  provider is refused (it used to write on the server's model, uncounted); handshakes and listings no longer use
  up the hourly tool-call limit.
- A body that isn't JSON is a 400 (413 when too large), and a JSON-RPC parse error on `/mcp`; it used to be a 500
  with a stack in the log. The Qloo harness gets only its own settings, not the server's LLM keys. The in-memory
  Qloo cache is bounded (400 answers; the disk keeps the rest). The server model is probed again every ten minutes
  after a failed probe. `.dockerignore` keeps nested `.env` and `.cache` folders and `.claude` out of the build.
- **The run page**, from a review of the front end: the event stream sends a snapshot and then live events (it
  replayed the whole history on top, so finished stages flashed to "running", Recompute left the with/without
  card stuck as stale, and replaced receipts came back); a rerun marks only the stages it reruns; rail links
  scroll instead of reloading the run; a slower earlier load can't draw over the run you opened; the Where map
  survives a round trip; the confirm card is ready again when you come back; maps don't leak; Ask answers belong
  to their run; Ctrl/Cmd-click on a gallery card opens a new tab; Copy keeps plain-text beats; wide tables scroll
  inside their card on a phone; event numbers keep rising past the log's cap; a restart's error names its stage.
- Small engine ones: a country outside AYTO's markets still narrows the city pick; Coney Island and Dupont Circle
  are neighbourhoods, not admin units.
- **A review of the bug hunt's own diff** found seven regressions it had introduced, now fixed and tested:
  "Miami, US" went to Miami on the Gold Coast ("US" was read as a place, and "Australia" contains "us"; short
  codes are markets now, and any other place after the comma, "Portland, Maine", narrows by a whole name); an
  object in a list of names (`{ city: "Pune", why }`) was flattened to "Pune · why" and removed; the check read the
  first name key instead of the one its path names (`{ artist, title }` was checked by its title); the rules
  reader cut "Lost in Translation" to "Lost" and read "a film festival" as a film (the last format word of the
  first phrase names the thing now: festival, café, podcast); lowercase "usa" stopped meaning the US; a receipt
  said `take: 6` for requests of 8; and the 500 test passed without reaching the error path.
- **A second review, of that fix**, found seven more, now fixed. The rules reader kept tails ("fans of RRR in
  Telugu" → "RRR In Telugu") and cut titles ("Interview with the Vampire" → "Interview"); "set in winter" beat the
  city; a sentence's first word or "Netflix" counted as a title ("Reels in Mumbai about weddings in Udaipur" was
  Udaipur); "a podcast series" became a film and "a short story collection" fashion; "Anna Nagar, Chennai" went to
  Madurai (Qloo lists "Chennai District"); reel beats written as objects lost their text; an empty or odd
  `TRUST_PROXY` stopped the server booting. The reader now has a table of 51 sentences from all three reviews that
  every change must keep right (`test/reader.test.js`). US state codes narrow too ("Portland, ME", "Columbus, GA").
- The writers are asked for "avoid" flavour names copied exactly from the evidence, now that the list is checked.
  `TRUST_PROXY` accepts `true`, a hop count or addresses; edit keys survive a browser that blocks storage; new
  assumptions are refused before a copy is made when the stages before haven't finished.
- **"Avoid" is checked.** Every format's brief lists flavours the city cares less about, shown with the Qloo mark,
  but the check never looked at them, so an invented one stayed. They are checked now, and the gap stage
  registers them (many come from the country's own read), so the template's list traces in full. Found by running
  all eight formats against scrambled model replies with planted names, then live: a podcast in Mumbai, a café in
  Kochi, a game in Seoul, a club night in Bengaluru, a novel in Chennai, a film in Hyderabad and a drop in Mumbai
  all finish with every name traced.

## PR #23 (30 Oct, 22:59): every name traces, whatever shape the model writes it in (bug hunt, batch 4)

The writers had never met a real model. A fake one sending the shapes real models send found these.

- **Invented names passed the check.** It walked fixed paths (`references[].title`) and stopped when the key was
  missing, so a reference written as `{ name }`, a soundtrack pick as `{ name }`, a title given as a list, a beat's
  `after` or `where` as plain text, or a list of lists went unchecked: in one run, 7 of 7 invented names passed
  ("0 removed"). The check now walks to each list or object a path names and reads the name from whichever key
  holds it, flattening nested lists. Keys a writer's template doesn't have (`similar_shows`) are dropped instead
  of reaching the page unchecked, and a reply wrapped in one key (`{ "plan": { … } }`) is unwrapped.
- **Real names were removed.** The evidence shows a lane's recent titles with their year, and a title copied as
  "Quiet Hours (2022)" was removed and then banned. Names now match without a trailing year, without accents
  ("Beyonce" is "Beyoncé") and without punctuation ("Spider Man"). A script bracket counts only when the other
  side is another script: "HIT (హిట్)" and "హిట్ (HIT)" trace, "Gangs of Wasseypur — తెలుగు (HIT)" doesn't.
- **A slow model failed the run.** A call could retry for about three minutes inside a two-minute stage, so the
  write stage timed out and the run ended with no share page. Every model call now has a deadline inside its
  stage; a model that doesn't answer in time gives the template, and the run publishes. The sentence reader gives
  way to the rules after 20 seconds.
- **Odd shapes crashed the drop or garbled the page.** A style named `101`, cues sent as one string, colourways as
  one string: produce threw and the run ended. List items now take the shape of the template's items, produce
  reads text and lists whatever they arrive as, and the share page and the Markdown read every field the same
  way (no `[object Object]`, no "P i l o t", no `undefined · score`). A title given as `{ title }` no longer
  becomes the page title "[object Object]" and the slug "object-object".
- New assumptions on a drop keep the model's tech packs and the with/without card (they used to fall back to
  defaults and "No model to run the comparison"). A rerun replaces its stages' receipts instead of adding to them
  (one lane pick took a run from 34 to 49 "requests"); receipt ids stay unique.
- The with/without card reads names given as objects or nested lists (four names showed as "1 of 1"), and asks
  the no-evidence model with the city even when the city came from the picker.
- The model's JSON is found after prose that has braces of its own, isn't marked "cut off" because of braces
  after it, and a reply cut off at "fal" or "1e" keeps what came before. "Write again" without a key no longer
  says the brief was written on your key.

## PR #22 (30 Oct, 22:59): the engine on bad days (bug hunt, batch 3)

- **A failed country read made everything "this city's".** When Qloo's country read timed out or came back empty,
  every city flavour looked far above the country (lanes at +30, "specific to this city"), every pick was "only
  here", every style tag a lift and every place a fashion opportunity. Now there are no lifts without a
  baseline: the gap says the country read came back empty and to run it again, and the read says which kinds had
  no country list.
- **A cached plan leaked one run's check into the next.** The server's written plans are cached, and the check
  edits a plan in place; the next visitor got the already-cleaned plan, saw "0 removed" and skipped the rewrite.
  Each caller now gets its own copy.
- Answers with no result list at all (`{}`, `{results: {}}`, an unparseable tool reply) count as empty, so they
  are never written to disk for good; written plans are cached as before.
- The travels map found its home city by the first word of the name ("Las" matched Dallas); now by id or the
  exact name. A venue on "Connaught Place, New Delhi, Delhi" is in Connaught Place, not "New" (likewise North Las
  Vegas, Navi Mumbai).
- Equal heatmap values share a percentile (order no longer decided them); a point with a latitude but no
  longitude no longer fails the stage; an audience skew averages each key over the picks that carry it.
- Venue names: "...", "1234", "N/A" and bank branches are dropped; PVR INOX, IMAX, "Left Bank Bar" and "The
  Residency Club" are kept.
- Looked at and left: the control cities skip the next-largest city after the contrast (Delhi for Hyderabad).
  CLAUDE.md doesn't say whether that is meant, and changing it would move the showcase lanes.

## PR #21 (30 Oct, 22:59): the sentence reads right and the city is the city (bug hunt, batch 2)

- **Big cities resolved to villages that share their name.** Qloo lists "Jaipur" the city only as "Jaipur
  Municipal Corporation", next to a village called exactly "Jaipur" in Jharkhand (popularity 0.50), and the exact
  name won: a run "in Jaipur" read a village, and "Where should I make it?" showed Jaipur, Jharkhand with no
  flavours. Patna went to a village in Bangladesh, Ranchi to one in Italy, Jodhpur to a neighbourhood of
  Ahmedabad, and Glasgow, Edinburgh, Belfast and Leicester to towns in the US. One ranking now serves every
  lookup: hits that carry the name (the name, the city's own form, its metro, "<name> District"), then only those
  near the most popular, then the best form. Checked against Qloo's hits for 650 candidate cities in 12 markets:
  31 picks changed, every one to the right city or an equal one (Tokyo is found at all now). Searches take 8 hits
  everywhere, so "Glasgow City" is in reach. "Kansas City", "Quezon City" and "Benin City" keep their "City";
  the city picked in the confirm step always wins.
- **The format is the one the maker names.** "a short film about a bar fight" was a café, "a documentary about a
  music festival" an event, "a comic short film" a book, "a web series with 6 episodes" a podcast. Words that
  name the thing (film, reel, podcast, game, novel, drop) now beat words about the subject (bar, party, comic);
  "a short" is a film, "a short story" a book; games, TikToks, sneakers, sarees, pubs and stand-up nights are read.
- **The city reader.** "In Hyderabad, …" (capital I), "A CRIME FILM IN HYDERABAD", São Paulo, Montréal, "in
  Hyderabad but shot in Vizag", "at Charminar in Hyderabad", "in Telugu in Hyderabad", "in Hyderabad in 2026",
  "Hyderabad's Old City" and "the crowd in Mumbai nightlife" all read the city now.
- **Loves and themes.** "a love story set in Hyderabad" no longer adds a love called "Story Set In Hyderabad", nor
  "getting into filmmaking" one called "Filmmaking In Hyderabad"; "inspired by Drishyam in Hyderabad" is
  Drishyam. Themes lose their articles ("bar fight"), "true crime" no longer comes with "crime", "comedy" is no
  longer asked twice, and "themed around Diwali" is Diwali.
- When the request gives the format and the city, the sentence still fills the theme and loves (they were
  dropped); a theme or loves the confirm step sent, even "none", stay as sent. A model that returns only a
  country no longer picks a random city.
- "Blade Runner 2049" and "Cyberpunk 2077" keep their numbers (a year is split off when bracketed or after a
  comma, or when the full name finds nothing). "in Tamil Nadu" no longer asks for a Tamil brief. "Help us pick a
  city in India" is India, not the United States. Chandigarh offers Hindi as well as Punjabi.
- The "Crowded everywhere" line no longer breaks before its full stop.

## PR #20 (30 Oct, 22:59): the public server holds up (bug hunt, batch 1)

Found by a review of the server, the parser, the engine and the pipeline (30 Oct), each bug reproduced first.

- **One bad request could take the server down for good.** Express 4 lets a rejected async route escape and Node
  exits; an edit that stored a plan of the wrong shape then crashed it again on the next home page visit, after
  every restart. Every route is now guarded, errors answer 500 with no stack, and the server stays up.
- **Nobody can change a run they didn't start.** Each run gets an edit key, handed only to whoever started it
  (kept in that browser, never sent with the run). A lane pick or a "Write again" on anyone else's run (a
  showcase, a page from the gallery) makes the visitor their own copy, with the same receipts, and opens it; the
  original stays as its owner left it. Edits are only the lane order now, rebuilt from the run's own lanes, so no
  text from a request is stored. That also closes a share slug takeover and a replaceable share link.
- A run cut off by a restart says so ("The server restarted while this run was working") instead of saying
  "running" forever.
- Rate limits: one trusted proxy hop (a made-up X-Forwarded-For no longer resets the limit), the daily budget
  counts only valid runs, showcases have a per-address limit, the limiter's memory is pruned, and MCP takes one
  message per request (a batch skipped the budget); MCP writes on the server's model count against its cap.
- Keys: a key with control characters is refused (it used to surface inside an error), and the redactor now
  catches `Bearer` tokens and 32-character keys.
- In the app: Enter sends the sentence (Shift+Enter for a new line, IME Enter left alone), the receipts header
  counts every request (it showed the snapshot's 12 of 44), the walkthrough says "a film for Hyderabad" (not
  "hyderabad"), and negative lifts print as "-3", not "+-3".

## PR #19 (30 Oct, 14:29): briefs in the city's own language

- **"Write in": English, or the city's own language.** The confirm step offers English plus the languages of the
  city's own screen culture (Telugu for Hyderabad, Tamil for Chennai, Marathi or Hindi for Mumbai; English only
  for Las Vegas). "…in Hyderabad, in Telugu" picks it from the sentence; "a Telugu film" doesn't, because that
  names the film's language, not the brief's.
- **A finished run switches language without reading Qloo again.** The Write card has the same picker; "Write it
  in Telugu" reruns from the write stage on, with no new Qloo requests.
- **Every name still traces.** The writer is told to keep Qloo's names in Latin letters. If it writes one in
  Telugu with Qloo's spelling in brackets ("హిట్ (HIT)"), the check reads the bracket. Titles it invents come in
  Telugu script with the Latin spelling; character names stay in Latin letters so the beats and the cast line up.
  The English prompt is unchanged, so cached English writing still applies.
- The share page marks the written parts with their language and loads that script's Noto Sans font; the app
  loads it only when a brief or a picker needs it. The MCP `ayto_write` tool takes `language` too.
- Without a model, the template stays in English and the card says Telugu needs a model.
- Why: the client research (29 Oct) found Telugu output, along with a back-test, the biggest gap before a
  Hyderabad production house would take AYTO seriously.
- Fixes in the sentence reader: "a crime film in Telugu set in Hyderabad" finds Hyderabad (a language word is
  never a city), and "reels in Las Vegas. Nightlife and food." stops at the full stop (it used to read the city
  as "Las Vegas. Nightlife"); "St. Louis" stays whole.

## PR #18 (29 Oct, 20:04): an international home wall

- **The home background now speaks to an international jury.** A wall of 39 titles known worldwide across
  AYTO's themes, among them Oppenheimer, Parasite, Squid Game, Money Heist, Narcos, The Bear, Taylor Swift, BTS,
  Bad Bunny and Burna Boy. Each one is found through Qloo's search, with Qloo's image, and only titles above the
  popularity bar go on the wall. Runway photos stay woven in. The wall resolves in the background at boot and
  is refreshed daily.
- **India is about one tile in ten** on the home page (RRR, A.R. Rahman and a few of the Hyderabad showcase's
  picks), and never in the first screenful. A city's own run page still shows that city's own picks.
- A home wall without its world titles is never cached, so the first visitor after a restart isn't stuck with
  it for five minutes.

## PR #17 (29 Oct, 17:50): "Where should I make it?"

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

## PR #16 (29 Oct, 17:18): ready for a real model and a deploy

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
