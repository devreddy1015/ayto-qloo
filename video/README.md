# AYTO demo video

Two cuts, one project:
- **AytoDrop** (1:41) leads with a streetwear drop in Los Angeles. Script: [docs/YOUTUBE_SCRIPT_DROP.md](../docs/YOUTUBE_SCRIPT_DROP.md).
  Render it with `npx remotion render src/index.ts AytoDrop out/ayto-drop.mp4`. Its timeline and scenes are in
  `src/drop/`, its captions are built with `node scripts/cues.mjs src/drop/timeline.ts src/drop/cues.json`, and its
  voice is in `public/vo/drop/`.
- **AytoDemo** (2:12) leads with a crime film in London (below).

The 2-minute YouTube demo, in Remotion, made with the video-shotcraft workflow: real screens of the live app, a 2.5D
camera, shot cards from its gallery, its sound library. The script it follows is [docs/YOUTUBE_SCRIPT.md](../docs/YOUTUBE_SCRIPT.md).

## Build it

```bash
npm install
npm run capture          # screens of the live showcase runs → public/textures/ and src/layout.json
npm run dev              # Remotion Studio, to watch and scrub
node scripts/cues.mjs    # captions cut at the voice's own pauses → src/cues.json
npm run render           # out/ayto-demo.mp4 (1920×1080, 30 fps)
ffmpeg -i out/ayto-demo.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/ayto-demo-master.mp4
```

Captions as a file, for the YouTube upload or an editor: `node scripts/srt.mjs out/ayto-demo.srt` (every voice line,
cut where the video cuts it). For DaVinci Resolve on Linux, whose free build reads neither AAC nor H.264 exports:
`ffmpeg -i out/ayto-demo.mp4 -c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p -c:a pcm_s16le out/ayto-demo.mov`.

New voice lines: `SARVAM_API_KEY=… node scripts/sarvam.mjs public/vo/shubh s17="…"` (speaker shubh, bulbul:v3).

A version without music: `npx remotion render src/index.ts AytoDemo out/ayto-demo-nobgm.mp4 --props='{"bgm":false,"captions":true}'`.

## What's where

- `src/timeline.ts`: the one timeline. Scenes, voice clips, captions and sound effects are all placed from `SHOTS`.
- `src/scenes-a.tsx`, `src/scenes-b.tsx`, `src/scenes-c.tsx`: the 17 scenes (the London film, then where, the Las Vegas
  reel, the Paris drop, five more formats, the MCP door, the close). `src/ui.tsx`: the app's tokens, type and shared pieces.
- `scripts/capture.mjs`: the screen capture (playwright-core with the cached Chromium). It empties the home page's
  poster wall, so no real poster gets into the video.
- The voice: Sarvam Bulbul v3, speaker "shubh" (Indian English), picked from 11 voices. The video reads
  `public/vo/shubh/`; three lines (s06, s12, s13) are cut at their pauses so the picture lands on the words.
  `public/vo/lines.json` holds the lines and `tts-lines.json` the spellings read aloud ("Clue" for Qloo, "Ayto" for
  AYTO). `scripts/voice.py` makes a local Kokoro version (`public/vo/af_heart/`, set `VOICE_DIR` in src/timeline.ts).

## Not in git

Screens of the live app carry Qloo response data, so `public/textures/` stays out of git (the repo's hard rules), as
do the voice clips, the audio and the renders. Rebuild them with the steps above. The music and sound effects come from
video-shotcraft's `assets/audio/`, which is free for commercial use (its ATTRIBUTION.md). Copy them into `public/audio/`.
