# AYTO: the YouTube video (draft 4, built)

A 2-minute demo for YouTube and the Devpost "Video demo link". 16:9, 1920×1080, AI voiceover plus burned-in captions
(judges may watch muted). Built with the **video-shotcraft** plugin: real screenshots of the live app, 2.5D camera moves
in Remotion, shot cards from its gallery, sound from its library.

**The one idea to land:** a city loves some things and isn't getting them. Qloo can see that, and a plain AI can't.
AYTO finds that gap and writes your film into it.

**Built (31 Oct):** the Remotion project is in `video/` (see video/README.md). Draft 2 moved the video to the showcases the home page leads with (a crime film in London, a Las Vegas reel, a
Paris streetwear drop) and a compare across ten US cities, for a US audience. Every number below comes from live runs
on ayto-ocx1.onrender.com on 31 Oct, 04:45 IST (London run `r_II8RRiQ`, US compare). Don't round or change them.

---

## Look and sound

- **Colours from the app:** background `#0b0b0d`, text `#f5f5f7`, soft text `#b6b6be`, lines white at 10%.
  **Yellow `#f2be22` means only the gap** (lanes, the open slot, the logo dot). Nothing else is yellow.
- **Type:** Archivo, wide (`wdth 125`, 800) for headings, normal width for captions.
- **Feel:** calm and precise, like an instrument, not an ad. Dark glass cards, 18 px radius, slow camera.
- **Music:** low steady pulse. Two hits only: when the gap lands (0:40) and when the dot lands (1:31).
- **Voice:** AI voice, Sarvam Bulbul v3 speaker "shubh" (Indian English), picked from 11 voices. The studio scene
  also plays two seconds of the app's own reading of the story (Sarvam, from the live run).
- **Never on screen:** real film posters or actor photos (blur the home poster wall), the Qloo logo, the words
  "hit", "will sell" or "guaranteed". Say "signal", "leans", "loved here".

---

## Scenes

### 1 · The guess (0:00–0:07)
- **See:** black. A field of small grey tiles builds out from the centre, row by row: every crime film anyone would
  guess. The build stops with one slot left empty in the middle, outlined in faint yellow.
- **Text:** `Every film starts with a guess.`
- **Say:** "Every film starts with a blank page and a guess. You know London loves crime. Everyone does."
- **Shot card:** `avatar-grid-radial-build-colorize` (tiles drawn in code, no posters)
- **Sound:** soft riser under the build.

### 2 · The real question (0:07–0:13)
- **See:** camera pushes into the empty slot until it fills the frame.
- **Text:** `Which kind of crime is London missing?`
- **Say:** "The real question is which kind of crime story London loves, and isn't getting."
- **Shot card:** `type-entrance-moves` (breathing card 1 of 3)

### 3 · AYTO (0:13–0:16)
- **See:** the white ring draws itself and stops short, leaving the opening. No dot yet. Hold 1 s.
- **Text:** `AYTO` · small: `an agent with taste`
- **Say:** "AYTO answers that before you write a word."
- **Shot card:** `draw-svg-trace` on `public/icon.svg`

### 4 · Tell it what and where (0:16–0:22)
- **See (real screen: home composer):** the sentence types itself. Then chips lift out of it and snap into the
  confirm row: **London, United Kingdom**, **Crime**, **Short film**.
- **Text:** the sentence itself, `I'm making a crime short film in London.`
- **Say:** "Tell it what you're making, and where. A crime short film in London."
- **Shot card:** `hashtag-to-pill-materialize` (words → chips)

### 5 · Qloo reads the city (0:22–0:31)
- **See (real screen: the Evidence tab):** stage cards land one by one (resolve, read, gap…), the receipts column fills
  beside them and the receipts count on the tab ticks up. Camera drifts across, then settles.
- **Text:** `London vs the UK vs Glasgow · Liverpool · Leeds`
- **Say:** "It plans its own reads on Qloo's taste graph: what London loves more than the UK, and more than Glasgow,
  Liverpool and Leeds."
- **Shot card:** `ai-stream-response`

### 6 · The gap (0:31–0:41)  ← the heart of the video
- **See (real screen: the gap card):** three yellow lanes grow one per beat: **Autobiographical +17**,
  **Indietronica +16**, **Tragedy +16**. Beside each, a counter "recent crime films carrying it" rolls down and stops
  at **0**. First music hit on the zero.
- **Text:** beside the card, `Recent crime films in London's picks that carry these lanes`, a counter rolling 17 → **0**,
  then `17 recent crime titles read · 0 carry them`
- **Say:** "Autobiographical. Indietronica. Tragedy. Then it counts the recent crime films that carry them. Zero."
- **Shot card:** `dashboard-glow-highlight-pill` for the lanes, `odometer-digit-roll` for the 0

### 7 · Loved here, under-served (0:41–0:44)
- **See:** black. The words fill in, yellow.
- **Text:** `THE GAP` · `loved here, under-served`
- **Say:** "That's the gap. Loved here, under-served."
- **Shot card:** `outline-word-fill` (breathing card 2 of 3)

### 8 · The look (0:44–0:51)
- **See (real screen: the look card):** the style words float up as pills: **Naturalistic +6**, **Intimate +6**,
  **Documentary-like +6**, **Gritty +4**. **Cinematic −8** and **Polished −4** sink below the line.
- **Say:** "It reads the look this crowd leans to: naturalistic, intimate, gritty. Not glossy."
- **Shot card:** `floating-glossy-label-pills`

### 9 · Your AI writes into it (0:51–1:03)
- **See (real screen: the Brief tab):** "The story, simply" types in under the title **Fourteen Minutes**, then the
  treatment builds down the page: six beats, the character card for Amara Osei (wants / hides), **Study: Queen & Slim**
  with its borrow line, **Shoot base: Westminster**, the palette swatches sliding in. Camera reads down the page, slow.
- **Say:** "Then your own AI writes into the gap: the story, six beats, characters, films to study and the shot to
  borrow, a shoot base, a palette."
- **Shot card:** `document-typewriter-reveal`

### 10 · Receipts, and without Qloo (1:03–1:11)
- **See (real screen):** the cursor taps a name's receipt chip and it lifts open into the Qloo request it came from.
  Then the with vs without card: a slider wipes from **Without Qloo** (grey, the generic guesses) to **With Qloo**
  (every name chipped).
- **Text:** `With Qloo: 13 of 13 names trace` vs `Without Qloo: 0 of 10`
- **Say:** "Every name opens the Qloo request it came from. Ask the same AI without Qloo: zero of ten names trace."
- **Shot card:** `chip-lift-to-user-pill` → `before-after-slider-scrub`

### 11 · Make it (1:11–1:19)
- **See (real screen: the Make it tab):** the concept still fades up, the shot deck frames deal in one per beat, then
  then the "Hear the story" player with a waveform, and we hear the app read the story.
- **Text:** `Shot deck · a frame per beat`
- **Say:** "Then make it: a concept still, a storyboard frame for every beat, and the story, read aloud."
- **Note:** no music tone: Lyria has no quota on the live key, so the site hides it and the video doesn't claim it.
- **Shot card:** `deck-deal-flyin` → `voice-waveform-live`

### 12 · Not sure where? (1:19–1:24)
- **See (real screen):** the "Where should I make it?" map for "a crime short film in the US", pulses rippling out,
  then the row of three city cards under it: **San Diego: Science +16**, **New York: Art Pop +15**,
  **Philadelphia: Religion +14**.
- **Text:** `Not sure where? Compare 10 cities.`
- **Say:** "Not sure where? It compares ten US cities."
- **Shot card:** `radial-wave`

### 13 · A reel in Las Vegas (1:24–1:36)
- **See (real screens, the Las Vegas reel showcase):** the reel's gap card turns in, lanes **Club Like +23**,
  **Party Oriented +18**, **Party-Like +15** ("Club Like: Las Vegas #8, not in the US top 30", specific to Las Vegas
  against control cities). Then the reel brief, **Last Call Is a Moving Target**, and a white frame moves down it on
  the words: the on-screen hook ("Which Vegas are you eating in tonight?"), the five beats, the track (E-40), the spots
  (Binion's Gambling Hall & Hotel, Fremont Street Experience).
- **Say:** "Reels in Las Vegas? The crowd here leans club-like and party-oriented, far more than the rest of the country.
  So AYTO writes the reel: the hook, five beats, the track, and the spots to shoot."

### 14 · A streetwear drop in Paris (1:36–1:49)
- **See (real screens, a fresh Paris drop run):** left, the gap card (**Artistic Community +16**, **Avant-Garde
  Artists +15**, **Intellectual +14**), then the look card (**Creative +23**, **Minimalist Silhouettes +21**,
  **Intellectual +24**, Leather and Wool up), then the brief, **Quiet Atelier**, with its palette and four styles.
  Right, the 3D viewer, swaying, changing garment every few seconds: Studio Leather Jacket, Salon Wool Sweatshirt,
  Gallery Silk Maxi, Cashmere Oversized Tee.
- **Text:** `Every style, in 3D, in the drop's own palette`
- **Say:** "A streetwear drop in Paris? The city leans artistic, avant-garde and intellectual, and the look is creative and
  minimal, in leather and wool. AYTO writes the drop, and every style turns in 3D."
- **Not shown:** the "References from Qloo" strip under the 3D viewer (real brand logos).

### 15 · Same engine, any format (1:49–2:00)
- **See (real screens, five live runs of 31 Oct):** the top of each brief slides in on its words, the last one sliding
  away left: **Podcast · Los Angeles** *Feminism, Live at the Mic* (lane Feminism), **Café · Austin** *Back Patio
  Coffee Co.* (lane Hush Puppies), **Live night · Chicago** *Lovely Hour on the South Loop* (lane Lovely), **Novel ·
  New York** *Happy Place, Interrupted* (lane Literary Fiction), **Indie game · Seattle** *Margin Notes* (lane
  Journaling). A row of format chips under the cards lights the current one.
- **Text:** `Same engine, any format`
- **Say:** "Same engine, any format: a podcast in Los Angeles, a café in Austin, a live music night in Chicago, a novel in
  New York, an indie game in Seattle."
- **Shot card:** `word-relay-filmstrip`

### 16 · Any agent can call it (2:00–2:03)
- **See:** black. A plug chip **MCP**, then `Any agent can call it` and `ayto-ocx1.onrender.com/mcp`.
- **Say:** "And any agent can call it."

### 17 · Are you the one? (2:03–2:12)
- **See:** one element from each scene gathers round the centre (a yellow lane, a receipt chip, a palette swatch, a
  shot-deck frame, the waveform, "13 of 13 trace"), then they fall away and the ring from scene 3 is back. The yellow
  dot drops into the opening as "AYTO" is said. Second music hit. Hold.
- **Text:** `AYTO` → `Are You The One?` → `Built on what your city already loves.`
  then `Powered by Qloo's taste graph · ayto-ocx1.onrender.com · github.com/devreddy1015/ayto-qloo`
- **Say:** "AYTO. Are you the one? Built on what your city already loves."
- **Shot card:** `outro-group-photo-launch` → `logo-shrink-wordmark-lockup`

**Runtime:** 2:12 (3,950 frames at 30 fps). Voiceover about 300 words.

---

## The voiceover on its own (for recording)

> Every film starts with a blank page and a guess. You know London loves crime. Everyone does.
>
> The real question is which kind of crime story London loves, and isn't getting.
>
> AYTO answers that before you write a word.
>
> Tell it what you're making, and where. A crime short film in London.
>
> It plans its own reads on Qloo's taste graph: what London loves more than the UK, and more than Glasgow, Liverpool
> and Leeds.
>
> Autobiographical. Indietronica. Tragedy. Then it counts the recent crime films that carry them. Zero.
>
> That's the gap. Loved here, under-served.
>
> It reads the look this crowd leans to: naturalistic, intimate, gritty. Not glossy.
>
> Then your own AI writes into the gap: the story, six beats, characters, films to study and the shot to borrow, a
> shoot base, a palette.
>
> Every name opens the Qloo request it came from. Ask the same AI without Qloo: zero of ten names trace.
>
> Then make it: a concept still, a storyboard frame for every beat, and the story, read aloud.
>
> Not sure where? It compares ten US cities.
>
> Reels in Las Vegas? The crowd here leans club-like and party-oriented, far more than the rest of the country. So AYTO
> writes the reel: the hook, five beats, the track, and the spots to shoot.
>
> A streetwear drop in Paris? The city leans artistic, avant-garde and intellectual, and the look is creative and
> minimal, in leather and wool. AYTO writes the drop, and every style turns in 3D.
>
> Same engine, any format: a podcast in Los Angeles, a café in Austin, a live music night in Chicago, a novel in New
> York, an indie game in Seattle.
>
> And any agent can call it.
>
> AYTO. Are you the one? Built on what your city already loves.

---

## A 60-second cut (if we need it)

Drop scenes 2, 8, 11, 12, 14 and 15. Runs about 75 s. For a vertical Short, scenes 6, 7, 10 and 17 carry the idea in about 30 s.

---

## Screens to capture (from the live site)

Real screenshots at 2×, so the camera can push in without blur. The London showcase run gives most of these:

1. Home composer, empty, then with the sentence typed (poster wall hidden or blurred)
2. The confirm row with the chips
3. Evidence tab (stage cards, receipts column)
4. The gap card · 5. The look card · 6. The Brief tab, top to bottom
7. A receipt chip opened · 8. The with vs without card
9. Make it tab: concept still, shot deck, music and voice players
10. The "Where should I make it?" map for "a crime short film in the US"
11. The Las Vegas reel and the Paris drop (the drop's 3D garment)

## The live facts this draft uses

- **London crime film:** lanes Autobiographical +17 (London #14, not in the UK's top 30), Indietronica +16, Tragedy
  +16, all "this city" against Glasgow, Liverpool and Leeds; recent crime films carrying each: 0. Look: Naturalistic,
  Intimate and Documentary-like +6, Gritty +4; Cinematic −8, Polished −4. Brief: *Fourteen Minutes*, Amara Osei,
  six beats, study *Queen & Slim*, shoot base Westminster. Check: 27 of 27 names trace. With vs without: 13 of 13 vs
  0 of 10.
- **Las Vegas reel:** lanes Club Like +23 (Las Vegas #8, not in the US top 30), Party Oriented +18, Party-Like +15.
  Brief: *Last Call Is a Moving Target*, hook "Which Vegas are you eating in tonight?", five beats, track E-40, spots
  Binion's Gambling Hall & Hotel and Fremont Street Experience. With vs without: 7 of 7 vs 1 of 9.
- **Paris streetwear drop** (fresh run `r__YIcZgo`, 31 Oct 05:20): lanes Artistic Community +16, Avant-Garde Artists
  +15, Intellectual +14. Look: Creative +23, Minimalist Silhouettes +21, Neutral Color Palettes +21; personal style
  Intellectual +24; Leather and Wool up. Brief: *Quiet Atelier*, styles Studio Leather Jacket, Salon Wool Sweatshirt,
  Gallery Silk Maxi, Cashmere Oversized Tee. With vs without: 18 of 18 vs 1 of 10.
- **Five more formats** (live runs, 31 Oct 05:15, all written by Claude, every name traced): podcast in Los Angeles
  *Feminism, Live at the Mic* (Feminism +12, 16 of 16 names); café in Austin *Back Patio Coffee Co.* (Hush Puppies,
  18 of 18); live music night in Chicago *Lovely Hour on the South Loop* (Lovely +17, 13 of 13); romance web novel in
  New York *Happy Place, Interrupted* (Literary Fiction +20, 15 of 15); indie horror game in Seattle *Margin Notes*
  (Journaling +21, 16 of 16).
- **Ten US cities (crime short film):** San Diego Science +16, New York Art Pop +15, Philadelphia Religion +14 (the
  row shown), San Antonio Cult Classics +17, Los Angeles Occult +12. (Dallas's top lane is "Pimping" +26: true, but we leave it off screen.)

---

## For the YouTube upload

- **Title:** AYTO: find what your city loves and isn't getting (Qloo Agentic Hackathon)
- **Description:** Tell AYTO what you're making and where. Qloo reads what that city loves more than the rest of the
  country and finds the gap: loved here, under-served. Your own AI writes your film, reel or fashion drop into it, and
  every name traces to a Qloo request. Try it: https://ayto-ocx1.onrender.com · Code (MIT):
  https://github.com/devreddy1015/ayto-qloo
- **Chapters:**
  - 0:00 The guess
  - 0:16 Qloo reads the city
  - 0:31 The gap
  - 0:51 The brief and the receipts
  - 1:11 Make it
  - 1:24 A reel in Las Vegas
  - 1:36 A drop in Paris
  - 1:49 Any format, any agent
- **Captions:** upload the voiceover as an English .srt as well.
