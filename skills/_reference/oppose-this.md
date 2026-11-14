---
name: Oppose This
description: Executes the visual and voice generation for a video on Boma's "Oppose This" YouTube channel, consuming a finished shot list from social-media-content-boss and producing actual images, video clips, and narration audio. Routes to free-tier providers first (Google AI Studio / Nano Banana free quota, Bing Image Creator) before touching any paid API, reserves paid AI video generation for a small number of hero shots only, always voices narration through ElevenLabs with emotion direction, enforces character and style consistency on every call, tracks spend against a near-zero budget cap, and logs every generation to a per-video manifest and local gallery folder. Trigger whenever Boma says "generate the shots", "run Oppose This", "execute this shot list", "produce the assets for this video", or otherwise wants a finished shot list actually turned into images/video/audio for the Oppose This channel — never for writing the script or shot list itself, that stays in social-media-content-boss.
---

# Oppose This — production execution skill

## What this skill is and isn't

This skill is a pure **execution layer**. It never invents a shot, a script beat, a thumbnail concept, or a CTA. It only takes a shot list that social-media-content-boss has already produced and turns each shot into a real asset (image, video clip, or narration audio) as cheaply as possible without looking amateurish.

If no shot list exists yet, stop and say so — don't improvise one.

## Required input: the shot list

Each shot must arrive with:
- `shot_id` (e.g. `sc03`)
- `prompt` — the detailed visual description
- `style` — `cartoon` or `photoreal` (must be the same value for every shot in one video — never mixed)
- `medium` — `still` (gets Ken Burns treatment later in CapCut) or `video` (needs an AI video clip)
- `hero` — `true`/`false` — hero shots (cold open, biggest reveal) are the only ones allowed to use paid AI video generation
- narration line(s) for that beat, if any, with emotion direction (e.g. "measured, slightly grim", "sudden excitement")

If a shot is missing `style` or `medium`, ask rather than guess.

## Pipeline

### 1. Pre-flight cost estimate
Sum the expected cost of the batch before generating anything:
- Stills routed to free providers: $0
- Stills that fall through to a paid provider: a few cents each
- Hero video clips (paid, capped at 2–3 per video): the bulk of any real spend
- Voiceover: ElevenLabs, against Boma's existing credit balance — not a per-video cash cost, but still worth reporting character count used

Budget cap default: **$1.00 per video** for image/video generation (excludes ElevenLabs, which draws down existing credits, not new spend). If the estimate exceeds the cap, stop and show the breakdown — don't generate until Boma confirms going over.

### 2. Style lock
Attach on every single call, no exceptions:
- The channel's style bible (`references/style-bible-template.md` — fill this in once per recurring character/visual identity and keep it updated)
- Reference image(s) for any recurring character
- The `style` value locked for this video (cartoon or photoreal — reject any prompt that tries to mix)

### 3. Provider routing — stills
Try in this order, falling through only on failure or unavailability:
1. **Google AI Studio (Nano Banana), free tier** — use the free daily quota first, always
2. **Bing Image Creator** — free, no API, so this path is manual: hand Boma the prompt to paste in if the free API quota is exhausted
3. **Kie.ai** — cheapest paid fallback (~3–8¢/image depending on resolution)
4. **Fal.ai** — reliability fallback if Kie is unavailable or a needed model isn't there

See `references/provider-routing.md` for the actual API call patterns and current price points to check before each session (prices and free-tier limits drift — verify, don't assume).

### 4. Provider routing — video (hero shots only)
Non-hero shots marked `video` get downgraded to `still` + a Ken Burns note for CapCut — don't spend on AI video for anything that isn't a hero shot, full stop.

For hero shots:
1. **Kie.ai** — cheapest
2. **Fal.ai** — reliability fallback

### 5. Voiceover — ElevenLabs, full narration
Every narration line goes through ElevenLabs, not a free TTS fallback (Boma has 10,000+ credits and wants full emotional range). For each line:
- Apply the emotion direction from the shot list to ElevenLabs' style/stability settings — flatter delivery for data-heavy exposition, more exaggerated for the cold open and the closing verdict
- Track character count consumed per video and report the running total against his balance so he doesn't get caught mid-series
- Never fall back to a free TTS engine for this project — that tradeoff was explicitly rejected

### 6. Generate
Call the routed provider for each shot per the branching above. Retry once on failure before falling to the next provider in the chain.

### 7. Quality gate
After each batch, do a quick self-check of each generated image against the style bible (character likeness, cartoon/photoreal consistency, no forbidden elements) and flag anything that looks off before it goes in front of Boma — don't silently pass through a drifted asset.

### 8. Version, log, save
- Never overwrite: a regenerate becomes `_v2`, `_v3`, etc. Keep every version until Boma says to delete one.
- Naming: `videoID_sceneNN_vX.ext`
- Output folder: `/videos/YYYY-MM-DD_video-title/assets/`
- Append one row per generation to `manifest.csv` in that folder: shot_id, prompt, provider, model, cost, emotion_direction (if audio), output_path, version, timestamp
- Everything in that folder is what a simple local gallery (a basic HTML page reading the folder) should render for review

## Hard rules recap

- Cartoon and photoreal never mix within one video
- Paid AI video generation only for hero shots (max 2–3 per video)
- ElevenLabs for all narration, no exceptions
- Budget cap $1.00/video for image/video spend — always show the estimate before generating, always stop and ask if it's exceeded
- Script, shot list, thumbnail strategy, and editing decisions stay out of this skill entirely

## Known limitation

This environment has no live network access, so the actual API calls in `references/provider-routing.md` can't be executed from here — they're written to be run wherever Boma has API keys configured and network access (e.g. Claude Code locally, or this chat once outbound network is enabled). Treat this SKILL.md as the finished spec to test there.
