# Changelog

What changed in AYTO (Are You The One), newest first. Times are IST. Each entry names the pull request on
[devreddy1015/ayto-qloo](https://github.com/devreddy1015/ayto-qloo) that carried it.

## PR #48 (31 Oct, 05:34): main results first on the brief

- **A client opening a run met a long story before any result.** The brief page now opens on a "Main results"
  panel (public/highlights.js):
  - the title and logline (or hook, or positioning);
  - the gap: the top three lanes, each with its city rank, its country rank (or "outside the UK's top 30") and its
    recent titles, plus the control cities it was read against;
  - "Traced to Qloo" (30/30 for London);
  - "With vs without Qloo" (13/13 against 2/10);
  - a row of facts: the look, shoot base or hero piece, the track, the crowd, where it travels.
- Every tile and fact opens the stage behind it, on its own page; Back returns to the brief.
- Only finished stages count, so a live run fills the panel as stages land, and a stage waiting to rerun drops out.
  Yellow stays the gap's colour. Hover only on a mouse; nothing moves under reduced motion.
- Checked on copies of the live London, Vegas and Paris runs at 1440 px and 390 px: no overflow, no script errors.
  test/highlights.test.js runs every showcase through it.
## PR #43 (31 Oct, 05:34): a motion pass

- **One motion system.** One set of tokens (`--dur-fast` 150 ms, `--dur-base` 240 ms, `--dur-slow` 600 ms,
  `--dur-hero`; `--ease-out` and `--ease-in-out`; `--stagger` 50 ms) closes `styles.css`. There is one reveal: rise and
  fade, a heading coming into focus on wide screens, pictures and bars wiping or growing. Each element moves once,
  through one IntersectionObserver helper in the new `public/motion.js`. It watches the page `app.js` and `pages.js`
  draw and never calls into them. Transform, opacity and clip-path only. No new dependencies.
- **Hero.** The intro's mark lifts, then "Are you the one?" rises word by word from under its own line, out of focus
  and settling. The line under it, the composer and the button follow, in about 1.5 s, quicker when the intro has
  already played this visit. There is no second logo animation, and phones get no blur.
- **Background.** The poster wall gets depth (every third poster sits further back, smaller and dimmer), a slow warm
  and cool light with a fine grain, and one slow crossfade at a time: a poster on screen trades places with one off
  screen, so no picture shows twice and each keeps its name. It is desktop only and stops while the tab is hidden.
- **Watch it work** is a timeline. Each step's edge and node light in order, replaying the one real finished run.
  Under reduced motion they show lit.
- **Now showing** is a film gallery. Each card gets a strip of posters from its run's own Qloo reads (`/api/mosaic`),
  with its space held from the first frame. Each poster wipes in once loaded and seen. On a fine pointer the card
  tilts up to 6° toward the pointer and lights its border.
- **Receipts and every drawer** open by unrolling and close by rolling up, with a chevron, a tape hairline on the
  request and tabular figures.
- **Compare cities.** Each city gets a bar for its top lane's strength, on the same scale as the map's markers. The
  bar grows from zero, its number counts up to the value `/api/where` returned, and the markers fade in in rank order.
- **The run.** The rail is a network of the run's stages. A done node fills and lights its link to the next; the
  running node shows the mark with its dot circling, and a signal travels its link. All of it follows the stage states
  the stream sends, so nothing lights early. A stage's content unfolds when the stream marks it done and its card is
  on screen, including after `pages.js` moves it to its tab. Lane, travel and age bars grow from zero to their real
  values.
- **Ready for the main results panel:** a `.highlights` panel on the brief reveals like a section, once per run, and
  each `.hl-num` holding one whole number counts up to it. A value `app.js` redraws mid-count wins.
- **Smaller things:**
  - three example sentences under the field type themselves in;
  - the field glows on focus;
  - the Check button nudges its arrow and leans toward the pointer on desktop;
  - buttons, chips and tabs have pressed states;
  - header links draw their underline;
  - receipts slide in as they stream and their count ticks;
  - home and run, the confirm step and errors fade in.
- **Fixes:**
  - The Now showing cards and Watch it work's link could not be clicked. `main` passes clicks through to the poster
    wall and these two sections never took them back.
  - Under reduced motion, the intro's still frame waited for the 2.5 s backstop; it now leaves after 0.6 s.
## PR #49 (31 Oct, 05:32): the references strip leads with photos

- **The strip under a drop's 3D preview now opens with photos, not logos:** after the love the maker named, up to two
  style icons the city's crowd follows (the audio stage's artists, which carry Qloo photos: for the Las Vegas drop,
  Amber Rose and Dita Von Teese), then the labels it favours. More icons fill in when a run has few labels.
- **A label's Qloo picture is its logo, so it shows whole** on a light card instead of cropped ("ettyLittleThi" no
  more); photos frame the face. Each card says what it is ("Style icon", "Label", "Your love") and why, in Qloo's own words.
- Still no web search and no new key: every picture is one Qloo returned in the run. Checked against the live Las
  Vegas run's data in a browser; tests cover the new order and the fill.

## PR #47 (31 Oct, 05:06): the shot deck fits a phone

- **On a phone, the "Make it" tab ran 51 px wider than the screen** (441 px on a 390 px phone), found in a layout pass
  on the live site at desktop and phone width. The shot deck's grid column sized itself to its widest content (407 px)
  instead of the screen, and its download link didn't wrap. The deck's column is now pinned to the available width,
  its frames shrink below 240 px when the screen does, and the link wraps.
- Every other page checked at 1440 px and 390 px: the home page, the brief, the evidence, Make it (London and Paris)
  and the share page. No overflow, no script errors, no failed requests.

## PR #46 (31 Oct, 04:42): the write-up leads with London and Paris

- **Devpost text (`docs/SUBMISSION.md`), README and video script** now walk through the live London crime film, using
  the run Claude Sonnet 5.5 wrote on 31 Oct:
  - lanes Autobiographical, Indietronica and Tragedy, with controls Glasgow, Liverpool and Leeds and zero recent supply;
  - the look Naturalistic, Intimate, Documentary-like and Gritty;
  - *Fourteen Minutes*, with 27 of 27 names traced;
  - without Qloo, 0 of 10 (*Mona Lisa*, *Nil by Mouth*, *Top Boy*).

  They also cover the Paris drop (43 of 43), the Las Vegas reel, the UK compare-cities read (Glasgow's Consequences of
  Crime, +26), the three-page run, and every extra (concept image, shot deck, 3D, Sarvam narration, and music when
  the key allows).
- **The gallery** is twelve new live images (London, Paris, Las Vegas, the UK map), with captions of 140 characters or
  fewer.

## PR #44 (31 Oct, 04:25): three pages on the run page

- **The run page is three tabs now, not one long page.** **The brief** has the written piece (the story, simply,
  then the treatment), the check, with vs without Qloo and the share link. **The evidence** has resolve, read, gap,
  look, audio, spots, audience and travels, with the receipts column beside them: what a judge opens to see that Qloo
  is the reason. **Make it** is the studio: the concept image, the shot deck, the music tone and the spoken story,
  and for a fashion drop the 3D garment and the produce card, with Ask the analyst at the foot.
- **It opens where you need it.** A run still working opens on the evidence, so you watch Qloo read, and moves to the
  brief when it's done (unless you picked a page meanwhile). A finished run opens on the brief. Write again, an edit
  or a recompute keeps you on the page you were on.
- **Every page has a link:** `/run/:id#brief`, `#evidence`, `#make`, and a stage's own `#stage-gap` opens its page at
  its card. Back and Forward move between pages. The rail opens a stage's page and jumps to the card.
- **The tabs say what's there:** the receipts count on the evidence tab, and the yellow running dot on any page with a
  stage at work. A proper tablist: arrow keys, Home and End, a visible focus ring. Tab switches are instant, the tab
  bar stays at the top as you scroll, and it fits a 375 px phone with no sideways scroll.
- **A thin layer** (`public/pages.js`): app.js still draws every card; pages.js moves each one to its page by its
  stage, and each on-demand extra out of the write card into the studio, by class or because it comes after the write
  card's actions row, so the next extra lands in the studio unchanged. A map drawn on a page that isn't open fits
  itself when the page opens. The share page `/s/:slug` stays one printable page. New test: the stage-to-page mapping
  for every format, and what each hash opens.

## PR #45 (31 Oct, 04:20): no rupee costing for a drop outside India

- **The Paris showcase was costed in rupees with Indian GST.** The production stage (tech packs, unit economics,
  channels, Legal Metrology) is built for India's marketplaces. A drop for another market now gets one plain line:
  "costed for India's marketplaces … a costing for France isn't built yet". The drop keeps its styles, look and 3D, and
  the share page shows no first-run section. Indian drops are unchanged.
- The costing tests use a Tiruppur drop of their own, since the fashion showcase is now Paris.

## PR #40 (31 Oct, 04:14): hear the story with Sarvam; music steps aside when the key has no quota

- **Hear the story.** One click under any finished brief has Sarvam's Bulbul (`bulbul:v3`) read it aloud: a film reads
  its story ("the story, simply"), a drop its positioning, a café or a night its concept, a book its premise, each after
  the title. It reads the brief's own words, with markup the only thing taken out, in the brief's own language: write
  it in Telugu and Hyderabad hears Telugu; an English brief is read in Indian English, and the card says how to hear it
  in the city's language. A story longer than Bulbul takes in one request is read in pieces and joined into one file.
  A "What it reads" fold shows the text.
- **Same rules as the image and the music:** never a stage, one reading per brief (a brief written again is read
  again), 6 an hour per visitor and `MAX_VOICE_PER_DAY` (30) for the site, and no button without `SARVAM_API_KEY` or
  when a template brief (no model) has nothing to read. Routes: `POST /api/runs/:id/voice` (202),
  `GET /api/runs/:id/voice` (status; before a click it names the language), `GET /api/runs/:id/voice.mp3` (or `.wav`).
- **Music steps aside when the key has no Lyria quota.** On the live site Lyria answered "429 … limit: 0": the Gemini
  key's project has no billing, and Lyria isn't on the free tier. Now a quota or billing answer turns music off for the
  rest of the day: `/api/presets` says `music: false`, so the button goes, and a page loaded before it says plainly
  "Music isn't available on this site right now." instead of Google's message. Billing switched on brings it back
  after a restart or the next day.
- Tests run against a fake Sarvam API (read once in its own words, read again in Telugu after a rewrite, a long story
  in joined pieces, hidden with nothing to read, off without a key) and a fake Lyria 429.

## PR #41 (31 Oct, 04:05): showcases in London, Las Vegas and Paris

- **The home page leads with the cities Qloo knows best:**
  - a **crime short film in London**: lanes Autobiographical, Tragedy and Indietronica, specific to London; the look is
    Naturalistic, Intimate, Documentary-like and Gritty; the shoot base is Westminster;
  - the **Las Vegas reel** (kept);
  - a **streetwear drop in Paris**: lanes Artistic Community, Avant-Garde Artists and Intellectual; the look is
    Creative, Minimalist Silhouettes and Neutral Palettes in Leather and Wool; labels Maison Kitsuné, Ami, A.P.C. and
    Acne Studios.

  These replace the Hyderabad crime film and the Tiruppur kidswear drop, picked from live reads on 31 Oct. New York's
  crime lanes were too generic ("Fiction", "Travel"), and Glasgow's ("Consequences of Crime" +26) is a fine second
  choice.
- **Defaults follow:**
  - the sentence placeholder reads "a crime short film in London";
  - the city hint reads "London, United Kingdom";
  - "Where should I make it?" reads the United States when a sentence names no market;
  - the market list starts with the US, the UK and Europe.

  India and every other market still work as before, Telugu briefs included.
- **Fake mode** gains Paris, Marseille and Lyon. Tests follow the new showcases. The Telugu test builds its own
  Hyderabad run.

## PR #38 (31 Oct, 03:57): references from Qloo under a drop's 3D preview

- **Three or four pictures under "See it in 3D", in a strip that slides left** (swipe, scroll-snap, or the arrows; a
  short slide-in, still for reduced motion). The love the maker named comes first, as Qloo knows it, then the fashion
  labels the city favours, those missing from the country's top list first. Each card carries its Qloo receipt chip and
  one line on why it is there.
- **No web search, no crawling, no new key:** every picture is an image Qloo returned in this run's own reads (the
  look stage's labels, the resolved loves), so each one traces to a Qloo request. Only https pictures are shown; a
  picture that fails to load drops its card; fewer than two pictures means no strip.
- `public/references.js` picks them (pure, tested: order, the four-picture cap, https only, repeats, the no-strip case).
  Checked in a browser at desktop and phone widths with test pictures (fake mode's synthetic labels have none).

## PR #37 (31 Oct, 03:57): with vs without Qloo, in 3D

- **The with vs without Qloo card now shows the difference for a fashion drop, not only counts it:** two small 3D
  viewers side by side. On the left, the drop's hero style as written from Qloo's read, in its palette, each colour
  captioned with the Qloo flavour it came from. On the right, the hero piece the same model makes from the same sentence
  with no evidence, in its own colours.
- **One question, not two:** the no-evidence fashion question now also asks for that hero piece (garment, print, 2-4
  colours), so no extra model call. The look is read safely (a known garment or a tee, no words drawn on it since a motif
  could name a real brand, valid colours or black and white) and kept out of the names the card counts. Other formats are
  unchanged; the fashion answer's cache key moves to v2.
- Tests: the look is pulled out of the count, odd answers still read, only fashion gets it (a fake model answers).
  Checked in a browser at desktop and phone widths; leaving the run tears both viewers down.

## PR #36 (31 Oct, 03:57): fashion in 3D (dresses, sarees, capes, cosplay; drawn prints; real 3D models)

- **Four new garments in the 3D viewer**, thirteen in all: a floor-length maxi dress with folds and a sash, a saree
  (a blouse in the accent colour, a pleated skirt with a woven border, the pallu across the front and over one shoulder),
  an open cape with a lining, a standing collar and a clasp, and a cosplay set (a long coat with trim, layered shoulder
  plates, a belt). The fashion writer picks them when the crowd leans that way, for example a fandom crowd riding
  KPop Demon Hunters. Cosplay stays original: the silhouette, materials and palette of the crowd's taste, never a
  character's costume, emblem or likeness. Check, the tech-pack fallback and the flat croquis know the new garments.
- **Draw the print:** under the viewer, one click asks OpenAI to draw the selected style's print (a square panel for a
  chest, back or sleeve print) or its fabric (a seamless tile for all-over prints, stripes, plain styles and sarees), and
  the viewer wraps it onto the garment. Downloadable. One per style, 8 an hour per visitor, 30 a day for the site
  (`MAX_PRINTS_PER_DAY`). On with `OPENAI_API_KEY`, like the concept image.
- **Make a 3D model** (hero styles): OpenAI draws a product shot of the style on a ghost mannequin, Stability's
  Stable Fast 3D lifts it into a GLB, and the viewer shows it on the turntable with a `.glb` download. OpenAI's API has
  no 3D model (checked in its docs, 31 Oct), so this needs `STABILITY_API_KEY`; without it there is no button. One per
  hero style, 3 an hour per visitor, 10 a day for the site (`MAX_MODELS_PER_DAY`); `MODEL_3D=stable-point-aware-3d`
  switches to the cheaper SPAR3D.
- **Every prompt drops every Qloo name** (the same scrub as the concept image) and asks for no text, logos, real people
  or existing characters. Never a stage: a run never waits on these. New module `src/fashion3d.js`; routes
  `GET /api/runs/:id/garment`, `POST|GET /api/runs/:id/styles/:index/print|model`, and the `print.jpg` / `model.glb`
  files. Tests build every garment headless (three.js as a dev dependency) and run the routes against fake OpenAI and
  Stability servers: one per style, the caps, off without a key, and no Qloo name in any prompt.

## PR #33 (31 Oct, 03:40): a music tone for every brief

- **One click under any finished brief composes a music tone:** a 30-second original instrumental from Google's Lyria
  (`lyria-3-clip-preview` on the Gemini API), with a player on the page and a Download link for the MP3. A "What we
  asked Lyria" fold under the player shows the exact prompt and the Qloo tags, lanes and look words behind it.
- **Built from what Qloo read, not made up.** The audio stage now looks up its shortlist on Qloo's `/entities` (one more
  receipt) and counts the genre, mood and instrument tags those artists carry: for six artists Hyderabad favours
  (checked live), Indian Classical, Playback Singing and Film Score; Energetic and Melodious; keyboard, piano and
  guitar. The audio card shows them. The prompt adds the gap's lanes, the look words, the city, the brief's own mood line, and a tempo per format (a film's
  titles at about 80 BPM, a reel's opener at 120).
- **No name reaches the model.** Every word taken from the run goes through the concept image's `scrub()`, so no artist,
  title, brand or venue is named, and a genre that shares a name with one drops out. Sung genres are left out of an
  instrumental, and the prompt asks for no vocals and nothing in the style of any artist or song.
- **It is never a stage**, so a run never waits on it or fails because of it. One tone per run: a second click plays
  the same one. Capped at 6 an hour per visitor and 40 a day for the site (`MAX_MUSIC_PER_DAY`). It is off, with no
  button, when the server has no `GEMINI_API_KEY`.
- **Routes:** `POST /api/runs/:id/music` (starts composing, 202), `GET /api/runs/:id/music` (status), and
  `GET /api/runs/:id/music.mp3` (sent as a file, so the player can seek). Tests run against a fake Gemini API (no Qloo
  name in the prompt, a refused prompt says why and can be retried, the file served with ranges, off without a key).

## PR #35 (31 Oct, 03:29): the story, simply, and a shot deck for films

- **Every film brief opens with the story, simply**: 120 to 200 plain words in the present tense on who wants what,
  what stands in the way, how it turns and how it ends, at the top of the write card, the share page and its Markdown.
  The model writes it naming only its invented characters and the city. A plan without one gets its own logline and
  acts in a row; with no model it is the shape the evidence gives (lane, look, where it would be shot), never invented.
- **Build the shot deck** under a finished film draws one storyboard frame per beat (up to six) with OpenAI
  (`gpt-image-2.5-flare`, falling back to `gpt-image-2`) at low quality, two at a time, in about a minute. Under each
  frame: the beat, a shot line (size, lens, light, movement) from the server's model or the plan's camera notes, and the
  film to study for it, only ever a title the check traced to Qloo, with its borrow note.
- **Every Qloo name is scrubbed out of every frame's prompt**, which asks for no text, logos, real people or stills from
  real films. No still is ever fetched from a real film or a site like ShotDeck: real films appear only as named references.
- **The whole deck downloads as one HTML file** with the frames inside, no scripts, ready to print to PDF.
- **Never a stage**: a run never waits on it or fails because of it. One deck per run; 3 an hour per visitor
  (`SHOT_DECKS_PER_IP_PER_HOUR`) and 15 a day for the site (`MAX_SHOT_DECKS_PER_DAY`, 0 switches it off); off, with no
  button, without `OPENAI_API_KEY`. Tests run against a fake model and a fake image API.

## PR #34 (31 Oct, 03:25): an intro from the mark, and one simple type style

- **An intro animation from the AYTO mark**, once per visit on the home page:
  - the ring (what a city loves) draws itself, leaving its opening (what it isn't getting);
  - the dot (you) settles into the gap;
  - the wordmark follows, and the page shows.

  It lasts about 1.2 s. Any click, key, scroll or touch skips it, and a 2.5 s backstop removes it whatever happens.
  Reduced motion gets a still mark that fades quickly. It's plain CSS keyframes (strong ease-out) and a few lines of
  inline script, and it never shows on a run page or share link.
- **One type style everywhere.** Archivo at its normal width only (the wide and narrow cuts are gone), three weights
  (400, 600, 700), one letter-spacing for uppercase labels, and one size scale (a new `--step--2` replaces about ten
  hard-coded small sizes). The font request asks for just those three weights.
- **The share page uses the same font** instead of Fraunces and Instrument Sans: no italics, the same weights, and the
  same small set of sizes.

## PR #31 (31 Oct, 02:59): a concept image for every brief

- **One click under any finished brief draws a concept image** with OpenAI (`gpt-image-2.5-flare`, falling back to
  `gpt-image-2` for an account without it): a film's mood still, a café's room from the doorway, a drop's hero garment, a
  reel's opening frame, a book or podcast cover, a game's key art.
- **The prompt is built from the run, not made up:** the brief's own logline or concept, Qloo's look words, the brief's
  palette, and the city and area AYTO found. Every name a Qloo read put in the run (titles, artists, brands, venues) is
  scrubbed out first, and the prompt asks for no text, logos, real people, real posters or real venues.
- **It is never a stage**, so a run never waits on it or fails because of it. One image per run: a second click shows
  the same one. Capped at 6 an hour per visitor and 40 a day for the site (`MAX_IMAGES_PER_DAY`). It is off, with no
  button, when the server has no `OPENAI_API_KEY`.
- **Routes:** `POST /api/runs/:id/image` (starts drawing, 202), `GET /api/runs/:id/image` (status), and
  `GET /api/runs/:id/image.jpg`. Tests run against a fake image API (model fallback, no Qloo name in the prompt, the
  file served, off without a key).

## PR #30 (31 Oct, 02:49): Claude writes on the live site; a café's lanes are tastes, not people

- **Claude (Sonnet 5.5) works as the writer.** With the live site switched to Anthropic, every call failed with
  "400: `temperature` is deprecated for this model": since 21 Oct 2026 Anthropic rejects sampling settings on every
  model, and the adapter still sent one. The adapter now:
  - sends no `temperature`;
  - runs adaptive thinking at `low` effort, so a write stays fast;
  - gives `max_tokens` room for the thinking as well as the reply (at least 16,000);
  - passes the assistant's blocks back unchanged in the analyst's tool loop, thinking blocks included;
  - turns on server-side refusal fallbacks (`fallbacks: "default"`) for the models that have them.
  Effort and fallbacks are scoped to the Claude 5.x models, so a key for an older model still works.
- **A group of people is never a lane.** A Hyderabad café came back with "Muslims" as lane 1 (a Qloo film-genre tag)
  and a menu "tuned to" it. Religions, castes and ethnicities named as groups, and Qloo's `customer_identity` family
  ("Young Professionals"), are now kept out of lanes and avoid lists. A café's or a brand's lanes are never film
  genres or keywords.

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
