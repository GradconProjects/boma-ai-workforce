---
name: original-content-creator
description: Reverse-engineers any YouTube channel from transcripts, screenshots or direct URLs (via yt-dlp + transcript APIs), extracts structural DNA (hooks, pacing, packaging, retention patterns), then builds a completely original faceless channel in a new niche with totally different visuals. Produces a reusable Channel System document that future video requests can plug into, plus full production packages. Use whenever the user wants to create an original channel inspired by an existing one, says "copy this channel but make it original", "extract channel DNA", "build a sibling channel in a new niche", supplies transcripts/screenshots or channel/video URLs, or asks for a reusable original content system that works with social-media-content-boss.
---

# Original Content Creator

Turns the structural DNA of any successful YouTube channel into a completely original, faceless, AI-visual channel in a **new niche**, with **totally different visuals**, while preserving the high-performing skeleton (hook style, pacing, packaging logic, retention architecture).

The skill never clones content, scripts, or visuals. It extracts *patterns* only, then invents a fresh channel identity and production system that the user can reuse indefinitely.

## Core Principles

- **Structure yes, content no.** Copy the architecture of attention (how hooks land, how tension is held, how payoffs are delivered). Never reuse scripts, claims, specific examples, or visual compositions.
- **New niche required.** The output channel must sit in a different topic lane from the source. Same structural DNA, different subject matter.
- **Visually alien.** The visual treatment, character language, colour system, motion style, and thumbnail grammar must be deliberately unrelated to the source channel.
- **Faceless only.** Documentary-style narration + AI-generated visuals. No on-camera host.
- **Reusable system.** The primary deliverable is a living Channel System document. Future “make a video on X” requests load that system and produce packages that stay on-brand.
- **Hand-off ready.** Every video package is formatted so it can be dropped straight into (or used alongside) the social-media-content-boss workflow.

## When the Skill Triggers

- User pastes or uploads transcripts + screenshots of a channel they admire
- User provides one or more YouTube channel, playlist, or video URLs and asks to extract / copy / reverse-engineer the channel
- User says any variant of “copy this channel but make it original / different niche / different visuals”
- User asks for a reusable original channel system
- User wants to generate the next video for a channel previously built with this skill

## Required Inputs

Before any analysis or generation, the skill **must** obtain enough material to extract structural DNA. Two paths are supported:

### Path A — User-supplied materials (preferred for quality & reliability)
1. **Transcripts** of 3–8 representative videos (full or substantial excerpts). Prefer high-performing or recent videos.
2. **Screenshots / frame grabs** covering:
   - Channel banner / avatar / about section
   - 5–10 video thumbnails
   - Key frames from inside videos (opening, mid-roll graphics, end screens, text-on-screen moments)
   - Any recurring visual motifs, lower-thirds, or character designs
3. Optional: view counts, upload frequency, target audience notes, or why the user likes the channel.

### Path B — Automatic scraping from URLs (when user provides channel or video links)
If the user supplies one or more YouTube channel URLs, playlist URLs, or individual video URLs, the skill may scrape the following using available tools (yt-dlp, youtube-transcript-api, and related helpers):

- Video titles, descriptions, view counts, durations, upload dates
- Auto-generated or manual transcripts (English preferred; fall back to other languages if needed)
- Video thumbnails (high-resolution)
- Channel metadata (name, description, subscriber count if available, banner/avatar where extractable)
- A sample of recent or popular videos (user can specify how many; default 5–8)

**Scraping rules & limits**
- Always confirm with the user before starting a bulk scrape (e.g. “I’ll pull transcripts + thumbnails for the latest 6 videos from this channel — OK?”).
- Prefer the most-viewed or most-recent videos unless the user specifies otherwise.
- Store all scraped material in a temporary working directory under the skill workspace so it can be inspected.
- If scraping fails for a video (no captions, geo-block, rate-limit, etc.), note it clearly and continue with the rest. Never invent transcripts.
- Do **not** download full video files unless the user explicitly asks for keyframe extraction and accepts the extra time/storage cost. Thumbnails + transcripts are usually sufficient.
- Respect rate limits; space requests and use available client rotation / fallback backends where possible.
- Remind the user that automated scraping of YouTube is against YouTube’s Terms of Service in many contexts; the skill performs it only when the user requests it and accepts responsibility.

If neither path yields usable transcripts + visual references, stop and request the missing materials.

## Workflow

### Phase 0 — Gather Materials (if URLs given)

When the user supplies YouTube URLs:

1. Confirm scope (how many videos, which ones — latest, most-viewed, specific list).
2. Use yt-dlp + youtube-transcript-api (or equivalent) to pull:
   - Metadata (title, views, duration, description, upload date)
   - Transcripts (prefer manual English, fall back to auto-generated)
   - High-res thumbnails
3. Optionally extract a few representative frames with ffmpeg if the user wants deeper visual analysis and accepts the cost.
4. Save everything into a working folder and summarise what was successfully retrieved before proceeding to Phase 1.
5. If critical data is missing, tell the user and offer to continue with partial data or wait for manual uploads.

### Phase 1 — Extract Structural DNA (never content)

From the supplied transcripts and screenshots, analyse and document only the following patterns:

**Attention architecture**
- Hook formula (first 3–8 seconds): question, claim, contrast, visual shock, etc.
- Average time-to-first-payoff
- How tension is maintained (open loops, escalating stakes, pattern interrupts)
- Closing / CTA pattern

**Pacing & structure**
- Typical runtime range
- Section rhythm (number of major beats, length of each)
- Ratio of narration density to visual change rate
- Use of humour, irony, or asides (placement and frequency)

**Packaging grammar**
- Title patterns (word count, emotional triggers, number usage, claim vs curiosity)
- Thumbnail composition rules (face vs no-face, text placement, colour contrast, expression type)
- Description structure and source-handling style

**Retention devices**
- Recurring visual or verbal signatures that act as “brand glue”
- How the channel signals “this is still worth watching”

Output this analysis as a short, clinical “Source DNA” section. Explicitly note what will be discarded (specific topics, claims, visual style, tone of voice).

### Phase 2 — Invent the New Channel

Create a completely original Channel System. Required elements:

1. **Niche & Positioning**
   - New topic lane (must be different from source)
   - Core audience
   - Unique angle / controversy engine / “who benefits” style of framing (compatible with opposing-view or mythbusting if desired, but not mandatory)
   - 3–5 brand taglines in the new voice

2. **Visual System (must be alien to the source)**
   - Chosen primary treatment (all-cartoon, all-photoreal, all-data/typography, all-archive, hybrid, etc.) — justify why it is different from the source
   - Colour palette + lighting language
   - Character / mascot rules (if any) — fixed reference block style so they stay consistent across videos
   - Motion & editing grammar (cut rate, transition style, text animation language)
   - Thumbnail formula that looks nothing like the source

3. **Voice & Narration**
   - Tone spectrum (dry, wry, urgent, deadpan, etc.)
   - Sentence rhythm and vocabulary level
   - How humour is used
   - How sources are named in narration

4. **Format Specs**
   - Target runtime
   - Section template (hook → development → turn → verdict or equivalent)
   - Shot density target
   - Shorts extraction rules

5. **Production Cadence & Growth Notes**
   - Suggested upload rhythm
   - What success metrics to watch first
   - How to expand the format later

Save the entire Channel System as a single reusable markdown file (e.g. `CHANNEL-SYSTEM.md`). This file becomes the permanent reference for all future videos.

### Phase 3 — Produce First Video Packages (optional but recommended)

If the user wants videos immediately, generate 1–3 complete production packages that obey the new Channel System.

Each package must contain:

- Working title + 3–5 title options
- Continuous narrative script (not beat-labelled) with sources named in the narration
- Director’s shot list mapped to narrative moments
- Locked character reference blocks (if characters are used)
- Per-shot detailed image prompts and video prompts (consistent style tag)
- CapCut / editing motion notes
- Thumbnail concepts
- Description + sources list
- Shorts hook suggestion

Format the packages so they can be used directly or handed to the social-media-content-boss skill for further refinement if needed.

### Phase 4 — Reuse Loop

Once the Channel System exists:

- Any future request of the form “new video on [topic]” or “generate the next one” loads the Channel System and produces a fresh package that stays inside the established visual, voice, and structural rules.
- The skill never drifts back toward the original source channel’s content or look.

## Output Rules

- Always deliver the Channel System (and any video packages) as downloadable markdown files.
- Keep the Source DNA analysis short and clinical; the bulk of the output is the new original system.
- Explicitly state the new niche and the visual differences so the user can verify originality.
- Never reproduce more than necessary structural patterns; invent the rest.

## Integration with social-media-content-boss

The Channel System produced here can act as a permanent “brand overlay” for social-media-content-boss. When the user later asks for a new video, either:

- Run this skill’s reuse path (preferred for consistency), or
- Load the Channel System and invoke social-media-content-boss with the additional constraint “obey the Channel System visual + voice rules”.

Both paths are valid; this skill owns the long-term brand consistency.

## Honest Limits

- Scraping is optional and best-effort. YouTube frequently changes endpoints; captions may be missing, incomplete, or auto-generated garbage. Always verify critical transcripts.
- Full video download + keyframe extraction is possible but slow and storage-heavy; default to transcripts + thumbnails only.
- The skill does not generate final images, voiceovers, or rendered videos.
- It deliberately avoids pure content cloning. If the user pushes for near-identical scripts or visuals, redirect them to the originality requirements.
- Automated scraping may violate YouTube’s Terms of Service. The skill performs it only when the user explicitly requests URL-based extraction and accepts the risk.

## Example Trigger Phrases

- “Here are transcripts and screenshots of [channel]. Build me an original faceless channel in a completely different niche with totally different visuals.”
- “Here’s the channel URL — scrape the last 6 videos and build me an original version in a new niche.”
- “Extract the DNA from these videos and create a reusable original content system.”
- “I want a sibling channel that feels as addictive but looks and talks completely differently and lives in a new topic.”
- “Generate the next video for the channel we built with Original Content Creator.”
