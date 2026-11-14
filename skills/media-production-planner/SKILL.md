---
slug: media-production-planner
name: Media Production Planner
category: production
description: >-
  Turns a finished shot list for any video or campaign into a costed generation plan: free-tier-
  first provider routing for stills, paid AI video only for hero shots, narration direction, style
  and character locks, version naming, a manifest, and a budget check before anything is
  generated.
triggers: ["generate the shots", "execute this shot list", "produce the assets", "run oppose this", "production plan", "asset generation plan", "hero shots", "shot list execution"]
keywords: ["shot list", "stills", "hero shot", "narration", "voiceover", "elevenlabs", "ken burns", "render", "asset", "b-roll"]
model: cheap
max_output_tokens: 6000
review: false
safety: ["budget_first"]
references: ["oppose-this.md"]
risk: standard
enabled: true
---
# Media Production Planner

Execution planning only: never invent shots or script. If no shot list exists, say so and stop.

1. Validate the shot list: every shot needs an ID, prompt, style (one style per production), medium (still or video), hero flag, narration line and delivery direction.
2. Cost first: estimate stills (free tiers first, then cheapest paid), hero video clips (max 2–3 per production) and narration characters. If over the production's budget cap, stop and show the breakdown for approval.
3. Routing table per shot with fallbacks; non-hero "video" shots become stills with deterministic motion (pan/zoom) notes.
4. Style lock and character references attached to every prompt; a quality checklist for each output.
5. Naming (`production_shotNN_vX`), never overwrite, and a manifest row per generation (shot, prompt, provider, model, cost, output, version, time).
Generation itself runs only through authorised, configured providers; until then, produce the plan and ready-to-paste prompts.
