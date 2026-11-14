# 07 — Boma AI Film Studio (addendum received 14 Nov 2026)

A fourth application alongside Workforce, Creative Studio and Ads Manager: a professional
filmmaking department (15-second clips up to episodic and feature-length workflows), coordinated
by the Chief Bot, with its own UI, data model, editing tools and structured project memory.
Shares login, workspaces, storage, AI providers, background workers, approvals and cost tracking.

## Requirements (condensed from the owner's addendum)

1. **Platform**: four apps with separate UIs; shared services; no monolithic interface.
2. **Specialist roles** (roles inside the existing orchestration, not separate services):
   Executive Producer, Story Development, Screenwriter, Script Editor, Research & Fact-Check,
   Director, Cinematography, Character & Casting, Art & Production Design, Continuity Supervisor,
   Storyboard & Previs, Video Generation Specialist, Voice & Dialogue, Sound Design, Music
   Supervisor, Film Editor, Subtitles & Localisation, Production Scheduler, Credit & Budget
   Controller, Visual Quality Inspector, Final Delivery Supervisor. All work through the Chief with
   structured tasks, shared production state and permission-controlled tools.
3. **New Film Wizard**: ads, corporate, short narrative, documentary, mockumentary, explainer,
   social, music video (rights permitting), episodic, long-form, custom. Asks only relevant
   questions with defaults: genre, concept, audience, length, platform, aspect ratio, visual style,
   structure, dialogue style, language, budget, production method, narration, deliverables.
4. **Script workspace**: premise, synopsis, logline, treatment, outline, acts/sequences, scenes,
   dialogue, characters, scene numbering, sluglines, action, versions, revision compare, approval
   per section or whole script; AI revises single scenes without rewriting the rest; export.
5. **Character library**: stable IDs, appearance, approved reference images, costume variants,
   voice, personality, relationships, backstory, narrative state, appearances, continuity limits,
   generation reference settings; reusable across projects; pilot tests before full generation.
   Character identity is never regenerated per scene.
6. **World libraries**: locations, sets, conditions, lighting, time of day, vehicles, props,
   costumes, extras, camera styles, references, with approval and revision history.
7. **Production board**: scene/shot numbers, act/sequence, story time, location, characters,
   script ref, action, dialogue, duration, framing, movement, lighting, references, provider,
   estimated cost, status, output, QA, approved version. Reorder with stable IDs; storyboards,
   shot lists, tables, timeline.
8. **Continuity engine**: appearance, hair/clothing, injuries, props, location state, time,
   weather, lighting, screen direction, dialogue context, emotion, established events, cause and
   effect. Automated checks of a proposed shot against state; flags for human review; never
   silently rewrites approved story; change-impact analysis before regeneration.
9. **Workflow**: Concept → Research → Feasibility → Screenplay → Cast & World Bibles → Scene
   Matrix → Storyboard → Shot Specs → Prompts → Pilot Tests → Asset Generation → Voice & Sound →
   Editing → Continuity QA → Final Render → Delivery. Visible status, outputs, dependencies,
   optional approval gates; parallel independent scenes; unrelated approved content preserved.
10. **Google Flow**: preferred for difficult motion shots, but only through authorised access.
    Check official API/terms. Otherwise a structured external workflow: prompts, reference frames,
    manifests, instructions, clip import mapped to shot IDs, continuity check, assembly. Provider
    adapters for other video APIs. No undocumented auth or account automation.
11. **Credit optimisation**: minimum credit use by default; estimates before generation, provider
    comparison, shot complexity classes, reference reuse, image-to-video, still animation,
    deterministic camera moves, previews, pilots, selective regeneration, caching, batching,
    duplicate detection, estimated-vs-actual reports. No generative credits for zooms, pans, text
    or static backgrounds. Approval above a configured threshold.
12. **Audio**: ElevenLabs preferred (adapters for others); narration, voice casting, pronunciation,
    dialogue sequencing, delivery notes, previews, timing, volume, replacement, SFX, music, mixing,
    subtitles and caption timing. Natural restrained voices. Rights required; no unauthorised voice
    clones. External audio workflow supported.
13. **Editing**: multi-track timeline: import, sequence, durations, trim, split, rearrange,
    transitions, subtitles, text overlays, narration, music, SFX, volume, aspect ratio, preview,
    draft and final renders. Remotion where suitable, FFmpeg for media ops, background render jobs
    with safe retry. CapCut-style hand-off via media packages; no claimed native project export
    unless implemented and tested.
14. **Quality**: consistent characters, anatomy, framing, lighting, environments, physics, motion,
    pacing, narration, subtitles, audio levels; configurable styles (documentary, drama,
    illustration, animation…).
15. **Long-form**: stable project/scene IDs, story clock, character state, batches, episodes,
    reusable openers/closers, cross-episode continuity, memory, dashboard, forecasts, regeneration
    controls, exportable manifests. Never one giant prompt.
16. **Portability**: canonical state in the database; exportable package (config, brief, script,
    bibles, scene matrix, shot manifest, prompts, asset refs, media, narration, continuity, status,
    versions, costs, QA, open tasks, handover) as JSON + readable documents; backup/restore.
17. **Creative Studio link**: Film → posters, flyers, thumbnails, title cards, character promos,
    carousels, BTS graphics, brochures, decks. Creative → promo videos, animated ads, explainers,
    trailers, narration. Task-based; shared authorised brand/media assets; no duplicate engines.
18. **Ads Manager link**: approved distribution package (trailer, teaser, vertical clips,
    cut-downs, thumbnails, copy, creatives, schedule, budget proposal, audiences). Same approval
    rules; Film Studio can never activate paid ads.
19. **UI**: Film Dashboard, Wizard, Projects, Story, Script, Characters, Locations/Worlds,
    Storyboards, Scene Matrix, Shot Production, Video Generation, Voice & Audio, Timeline,
    Continuity, Budget, Quality Review, Exports & Delivery; quick switching script ↔ storyboard ↔
    scene ↔ timeline; status, dependencies and credit costs always visible.
20. **Acceptance film**: "original three-minute documentary-style film with a narrator, recurring
    characters, consistent locations, 16:9, restrained Australian-English voice-over, low AI cost,
    complete editable production package" → brief, script, characters/locations, scene matrix,
    storyboard, shot prompts, budget, sample assets, narration workflow, assembly from real assets,
    preview render, continuity review, package export, marketing assets (Creative Studio),
    publishing drafts (Ads Manager). Placeholders and stills are always labelled as such; an
    external scene is never "complete" until its media exists.
21. **Migration of the existing Film Studio framework** (master prompt, configuration, modules,
    registers, manifests, templates, workflow docs): import and preserve approved defaults, naming
    conventions and package compatibility; document differences; test round trips.
    **Status: files not yet supplied by the owner.**

## Build sequence

| Phase | Scope |
|---|---|
| Film A — Production management | Dashboard, project wizard, screenplay editor, character library, scenes/shots, continuity register, manifests, exportable project state |
| Film B — AI pre-production | Screenwriting roles via the Chief + dual review, storyboard assistance, shot prompts, QA checks, cost estimates |
| Film C — Editing & rendering | Timeline, media import, text/captions, sound, deterministic motion, MP4 export (worker renders) |
| Film D — Generative media | Video provider adapters, authorised Flow workflow, ElevenLabs, credit optimisation |
| Film E — Workforce integration | Cross-department tasks, marketing assets, distribution packages, approvals, reporting |

## How it fits what exists

- Roles become bot files (`bots/film-*.md`) with their own tools, budgets and autonomy, all
  dispatched by the Chief and gated by the policy engine; generation spend goes through the budget
  gateway (new `media` provider class with credit costs, not just tokens).
- Script text and other external-facing output pass the Claude ↔ OpenAI dual review.
- Billable generation above a threshold = approval required; paid ad activation stays protected.
- Owner priority (14 Nov): Creative Studio editor, campaigns and Chief integration first, then
  Film Phase A.
