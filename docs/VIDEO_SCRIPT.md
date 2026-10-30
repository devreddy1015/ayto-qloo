# AYTO: the 60-second video

A brief for the animators. One minute, 16:9, 1920×1080, English voiceover with burned-in captions (judges may watch muted).
Devpost doesn't require a video, but judges may score on the text, images and video alone, so this is the pitch.

**The one idea to land:** a city loves some things and isn't getting them. Qloo can see that, and a plain AI can't.
AYTO finds that gap and writes your film into it.

Every number on screen comes from a live run on 30 Oct 2026 (Hyderabad, crime, short film). Don't round or change them.
Reference frames from the real app are listed under each scene (the PNGs are in `submission/frames/`, kept out of git).

---

## Look and sound

- **Palette** (the app's own tokens):
  - background `#0b0b0d`
  - text `#f5f5f7`, soft text `#b6b6be`
  - accent yellow `#f2be22`, deeper yellow `#d9a70f`
  - lines are white at 10% opacity
  - The yellow means only one thing: **the gap**. Use it for lanes, the open slot and the logo dot. Nothing else is yellow.
- **Type:** Archivo (Google Fonts), wide for headings (`wdth 125`, weight 800) and normal width for body.
- **Shapes:** rounded cards (18 px radius), thin borders, dark glass. Calm and precise, like an instrument rather than an ad.
- **Logo:** a white ring, open at the top right, with a yellow dot in the opening (`public/icon.svg`). It means:
  - the ring is what a city already loves;
  - the opening is what it isn't getting;
  - the dot is the maker, placed into it.
  
  The closing shot animates exactly this.
- **Music:** low, steady pulse, minimal. One hit when the gap appears (0:27) and one when the dot lands (0:58).
- **Voice:** warm, unhurried, one person. About 150 words a minute.
- **Don't use:**
  - real film posters, stills, actor photos or studio logos. Draw posters as abstract tiles. Film titles as plain text are fine.
  - the Qloo logo, unless Qloo's brand kit allows it. "Powered by Qloo" as plain text is fine.
  - "hit", "will sell" or "guaranteed". AYTO says "signal", "leans", "loved here".

---

## Script

| Time | Picture | On screen | Voiceover |
|---|---|---|---|
| **0:00–0:05** | A dark field fills with tiny abstract poster tiles while a counter runs to 1,972. Then 313 of the tiles slide together into a cluster labelled Telugu. They all dim, except six that glow white. | `1,972 films. India, 2025.` then `313 in Telugu. 6 succeeded.` | In 2025, India released almost two thousand films. Over three hundred in Telugu. Six succeeded. |
| **0:05–0:10** | A blank white page with a blinking cursor. A small "?" floats up and fades. A calendar flips past a "Film announced" date stamp, then a "Research" stamp lands after it. | `Research starts after the film is announced.` | Every filmmaker starts with a guess. The research producers buy starts after the film's announced. |
| **0:10–0:16** | The AYTO composer (frame `01-home`). The sentence types itself, then four chips snap in under it: **Hyderabad**, **Crime**, **HIT (2020, Telugu)** and **Shoestring** (frame `02-confirm`). | `A crime short film in Hyderabad, after HIT, on a shoestring.` | AYTO starts before. It's an agent with taste: tell it what you're making, and where. |
| **0:16–0:22** | A map of India, dark. Hyderabad pulses. Three columns slide up: **Hyderabad**, **India** and **Mumbai**. Then three smaller rings, **Bengaluru**, **Chennai** and **Kolkata**, light up as "controls" (frame `03-read`). | `Hyderabad vs India vs three control cities` | Qloo reads what Hyderabad loves more than the rest of India, and more than Bengaluru, Chennai and Kolkata. |
| **0:22–0:31** | Three yellow bars grow, one per beat: **Folk +17**, **Finance +16**, **Revenge and Justice +15**. A counter beside each reads "recent crime films carrying it", ticks and stops at **0**. The bars lock, and the word **THE GAP** stamps on in yellow, with the music hit (frame `04-gap`). | `Folk +17 · Finance +16 · Revenge and Justice +15`, then `Recent films carrying them: 0`, then `THE GAP: loved here, under-served` | Folk crime. Finance. Revenge and justice. Then AYTO counts the recent films that carry them. Zero. That's the gap: loved here, under-served. |
| **0:31–0:43** | Cards fly in and stack like a treatment being built, one card a beat: **Logline**, **Three acts**, **Beats**, **Character** (wants / hides), **Study: V**, **Cast**, **Shoot base: Monda Market**, **The look** and **Palette**. On the look card the three words appear as chips (frame `05-look`). On the "Study" card the line "borrow: polished, high-contrast, kinetic, moody framing" types out. | `Cinematic +10 · Moody +8 · Gritty +4` and `Shoot base: Monda Market, Secunderabad` | Your own AI writes into it: a treatment you can shoot. Beats, characters, the films to study and the shot to borrow, a cast this city favours, locations, a look. |
| **0:43–0:50** | Split screen. On the right, **With Qloo**: the treatment's names each light up with a small receipt chip (a tiny ticket icon), and a counter fills to `25 of 25 names trace to Qloo` (frame `09-check`). On the left, **Without Qloo**: the same layout in grey, and its names show no chip. | `Every name traces to a Qloo request.` | Every name traces to a Qloo request. Without Qloo, the same AI is guessing. |
| **0:50–0:57** | Zoom out to the India map. Ten city circles appear, and three get labels: **Kolkata: Crime Lord**, **Bengaluru: Documentary** and **Mumbai: Gender Violence** (frame `10-where`). Wipe to a fast row of seven format icons: reel, fashion drop (a garment turning in 3D), podcast, game, café, live night and book. A small plug icon reads **MCP**. | `Not sure where? Compare 10 cities.`, then `Film · reel · fashion · podcast · game · café · live night · book`, then `Any agent can call it (MCP)` | Not sure where? AYTO compares ten cities. The same engine writes reels, fashion drops, podcasts and live nights. And any agent can call it. |
| **0:57–1:03** | Black. The white ring draws itself, but stops short of closing and leaves the opening at the top right. A yellow dot falls into the opening, with the second music hit. Under the logo, the wordmark settles. | `AYTO`, then `Are You The One?`, then `Built on what your city already loves.` and, small, `Powered by Qloo's taste graph · <live URL>` | AYTO. Are you the one? Built on what your city already loves. |

**Voiceover word count:** about 160 words, which runs 62 to 65 seconds at a natural pace. For a hard 50 seconds, cut the 0:05–0:10 scene and the format row at 0:50 (it then runs about 50 s).

---

## The voiceover on its own (for the recording)

> In 2025, India released almost two thousand films. Over three hundred in Telugu. Six succeeded.
>
> Every filmmaker starts with a guess. The research producers buy starts after the film's announced.
>
> AYTO starts before. It's an agent with taste: tell it what you're making, and where.
>
> Qloo reads what Hyderabad loves more than the rest of India, and more than Bengaluru, Chennai and Kolkata.
> Folk crime. Finance. Revenge and justice. Then AYTO counts the recent films that carry them. Zero.
> That's the gap: loved here, under-served.
>
> Your own AI writes into it: a treatment you can shoot. Beats, characters, the films to study and the shot to borrow,
> a cast this city favours, locations, a look.
>
> Every name traces to a Qloo request. Without Qloo, the same AI is guessing.
>
> Not sure where? AYTO compares ten cities. The same engine writes reels, fashion drops, podcasts and live nights.
> And any agent can call it.
>
> AYTO. Are you the one? Built on what your city already loves.

---

## Notes for the animators

- **What counts as fact.** These are real Qloo output and must stay exact:
  - the lanes and their numbers (+17, +16, +15)
  - "0" recent films
  - the look words and their numbers
  - the control cities
  - the shoot base, "Monda Market"
  - "25 of 25"
  - the three city lanes in the compare scene
  
  The treatment text in the 0:31 scene (logline, acts, beats, characters) is written by a language model. Use greeked lines or blurred text for it until there's a run from the live site with a model key, then take the real logline from that run's share page.
- **The study card.** The "borrow" line on it is Qloo's own description of the film V, so it can be shown as is.
- **Receipt chips.** In the app every name opens the Qloo request it came from. Draw a chip as a small rounded tag with a ticket icon. It's the visual proof of "traces to Qloo", so give it a moment of focus.
- **The 1,972 / 313 / 6 figures** are India's 2025 cinema releases, with Telugu at 313 (`reports/AYTO market ideas and clients.md`). The six is Siasat's count of "successful" Tollywood releases in 2025. Say "succeeded", not "hits" or "flops".
- **Real screen recording, if you want an insert.** Record from the live URL, not localhost:
  - Run the Hyderabad showcase once beforehand so it opens instantly.
  - Hide the poster wall behind the hero, or blur it, because it shows real posters.
- **Deliver:** an MP4 (H.264) at 1080p, uploaded to YouTube or Vimeo as public or unlisted. Devpost takes that link. Add English captions on the upload too.

## Optional 30-second cut (social or a finalist intro)

These four scenes run about 31 seconds of the main script's time, and the cut voiceover runs about 25 seconds.

1. 0:10–0:16, the sentence (shortened to "Tell AYTO what you're making, and where").
2. 0:22–0:31, the gap.
3. 0:43–0:50, with and without Qloo.
4. 0:57–1:03, the logo.
