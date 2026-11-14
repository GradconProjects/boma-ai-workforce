---
name: social-media-content-boss
description: >
  Automated production system for a faceless, documentary-style "opposing view" social media channel.
  Turns a single topic into a complete video package (continuous narrative script with humour and
  inline-named sources, director's shot list, locked character reference blocks, per-shot detailed
  image and video prompts for OpenAI, Grok, Kling, Runway, and Higgsfield, CapCut motion notes,
  titles, thumbnails, description, sources). Use this skill whenever the user wants to generate a
  new video for their opposing-view, counter-argument, or mythbusting channel, says something like
  "new video" followed by a topic, or "generate" followed by a video number, asks for viral or
  controversial topic suggestions for the channel, or wants to update the channel's brand voice,
  visual style, or growth strategy. Always use this skill for any request touching the channel's
  production pipeline — never freehand a video package from memory.
---

# Social Media Content Boss

Turns one topic into a complete, ready-to-produce video package for a faceless, documentary-style channel whose format is: take a popular claim, give it a fair hearing, then oppose it with data — landing on who benefits from the claim being believed, not just whether it's technically true.

## Channel Identity (apply to every package)

**Format:** Documentary-style narration + AI-generated visuals. No on-camera presenter.

**Brand voice — pick or reuse a tagline in this register:**
- "Say it. We'll oppose it."
- "Whatever you believe, we're already arguing the other side."
- "No claim survives contact."
- "We don't agree with anything. That's the point."

**Controversy engine:** Every video needs a clear side to take and, ideally, a named beneficiary of the claim being believed (an industry, an incentive structure, a moving goalpost) — not just a gentle correction. "The number isn't wrong, but follow who profits when you believe the scariest version of it" is the house angle, not "well, actually, it's more nuanced."

**Niche default:** Business, finance, property, and economics — highest CPM/RPM in the faceless space, richest supply of checkable, sourced, genuinely contested claims, lowest political-landmine risk. Stay in this lane unless the user directs otherwise. Avoid claims tied to real tragedies, hate-motivated violence, or identity-group conflict — wrong tone for this format and real reputational/demonetization risk.

## The Workflow

When the user gives a topic (or asks you to pick one), research it with web search first — pull the actual current claim, the actual current counter-data, and named, quotable sources (organisations, studies, survey firms). Do not fabricate statistics or sources. Then produce the full package below as a single downloadable markdown file.

### 1. Pick ONE visual treatment for the whole video
Never mix styles within one video — variety happens across videos, not within one.
- **All-cartoon/illustrated** — topics with a clear villain or absurd claim; satire lands harder when the whole world is exaggerated
- **All-photoreal** — topics with real human stakes (housing, cost of living, retirement) where grounded imagery builds credibility
- **All-data/typography** — pure numbers-vs-numbers fights, claims getting struck through on screen
- **All-archive/found-footage look** — historical or "everyone knows this" claims

State the chosen treatment and why, at the top of the package.

### 2. Write the script as one continuous narrative
Not labelled "Beat 1/2/3" chunks — a single flowing piece with a clear arc:
- **Hook** — state the claim provocatively, cold open
- **Steelman** — a genuine, fair version of why people believe it (this isn't optional; skipping it makes the channel look sloppy, not tough)
- **Opposition** — the turn, the data, and the "who benefits" angle, woven as one flowing argument
- **Verdict** — a memorable closing line, not just a summary

Every source gets named IN the narration itself ("according to X," "researchers at Y found...") — not just footnoted in the description. Weave in a wry aside, callback, or comic comparison every 30–45 seconds so humour is threaded throughout, not saved for one joke beat.

### 3. Build the Director's Shot List
Map narrative moments to shots (roughly one shot per 20–45 seconds of narration). Note which shots feature which recurring characters.

### 4. Character Reference Blocks (write once per video, reuse verbatim)
Any character appearing in more than one shot gets a fixed, detailed reference block — build, face, outfit, colour palette, distinguishing features, art style — written out once at the top of the prompts section. If a character is meant to recur across MULTIPLE videos (a permanent channel mascot), save its reference block and reuse it unchanged in every future package for this channel.

### 5. Per-shot prompts — still AND video, fully detailed, never grouped
For every single shot, write out, in full, never abbreviated or shared with another shot:
- **Image prompt (OpenAI)** — literal, descriptive, composition-first. Include subject, pose/action, full composition/framing, lighting, colour palette, mood, aspect ratio (16:9 main / 9:16 Shorts). Repeat the full character reference block verbatim inside any prompt featuring that character.
- **Image prompt (Grok)** — same content, punchier/more stylistic phrasing, still fully detailed.
- **CapCut motion note** — the Ken Burns pan/zoom start/end frames and duration, or text-reveal/typing timing, or idle-loop note, to apply if the user generates a still.
- **Video prompt** — a separate, fully-detailed prompt for AI video tools (Kling, Runway, Higgsfield, Grok video), describing the same scene PLUS camera movement, action, pacing, and duration as part of the prompt itself — for shots the user would rather generate as real motion. Flag which shots most benefit from video over a still (usually ones built around a chase, a walk, or continuous physical motion) as a recommendation, but leave the still-vs-video choice to the user for every shot.

Use one consistent style tag across every image AND video prompt in the video, matching the chosen treatment from Step 1.

### 6. Captions & Packaging
- 3–5 title options (claim-forward, punchy)
- 2–3 thumbnail concepts
- A sourced description (list every named source again here for credibility/compliance)
- A Shorts-cut caption/hook (first 2 seconds must stop the scroll)

### 7. Sources
List every source used, matching what was named in the narration.

### 8. Hand-off line
Close every package with a one-line prompt for what to send next (the next topic, or "generate #[n+1]" with a suggested next claim from the same or an adjacent lane).

## Output format

Always deliver the package as a single downloadable markdown file (not inline chat text) — the person needs to save and reuse this while producing the video. Name the file after the video's working title. Use `create_file` (or `bash_tool`/`str_replace` if updating an existing package) and always `present_files` it after writing so it actually reaches the person.

## Growth strategy (reference when asked about strategy, cadence, or subscriber goals)

- **Phase 1 (videos 1–10):** 2x/week, consistent day/time. Goal is finding the format, not virality — watch average view duration as the only real early signal.
- **Phase 2 (videos 11–30):** identify the 2–3 best-performing videos, do 3 more in that exact lane before branching.
- **Phase 3 (videos 31+):** increase frequency only if retention holds; start cutting Shorts from long-form hits; consider a second recurring segment.
- **Checkpoints that matter more than subscriber count:** thumbnail CTR (aim 4%+), average view duration (aim 40%+ of runtime), returning-viewer %.
- **Weekly cadence:** topic → Claude generates package (Mon) → generate images/voiceover (Mon–Tue) → edit in CapCut (Wed) → upload (Wed/Thu) → cut a Short (Fri) → review retention data (Sun).

## Honest constraints (state plainly if asked)
This skill generates the complete content package per topic. It does not generate images itself, assemble/render video, or upload to YouTube — those remain manual steps for the user. It also cannot run autonomously in the background; a new package is produced each time the user brings a topic to a session.
