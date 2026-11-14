# Boma Creative Studio (v1.0 prototype)

A reusable, local-first, multi-brand marketing content studio. This is a **working static web app** requiring no build step, paid API keys, database or hosting account.

## Running locally

From this directory, run:

```sh
python -m http.server 8080
```

Visit http://localhost:8080. (Or use `npx serve .` if you already have Node/npm.) Opening `index.html` directly may not load ES modules consistently on all browsers, so use a local server.

## Included

- Multiple brand kits, including a starter Concrete Estimating Platform and Cynthus Collections kit.
- Flyers, social posts, stories, display adverts, business documents and video storyboards.
- Editable text, colour themes and templates; live canvas previews; headline repositioning by dragging vertically.
- Brand-based campaign generator (five coordinated starter projects).
- PNG download; browser print-to-PDF; TXT document and storyboard export.
- Silent WebM video storyboard export using the browser's MediaRecorder (up to 120 seconds).
- Project duplication, renaming, deleting, browser local autosave and portable JSON backups.

## Important limits

- **This release uses brand-based templates, not paid generative AI.** The AI provider adapters, secure backend and image generation APIs are not connected yet. "Suggest alternate headline" uses local sample alternatives.
- Documents are edited via structured fields, not a full word processor. PDF export uses browser Print / Save as PDF.
- Video export produces silent animated title cards in WebM, not MP4 or generative footage.
- No social media accounts are connected; nothing is posted or scheduled.
- Data is saved only in this browser's localStorage (not synchronised). Export backups often, especially before clearing browser data.
- The included business features are starter reference content; verify claims, contact details and publication permissions before using commercially.

## Later Vercel hosting

Deploy this folder as a **static project** (Framework Preset: Other; build command: none; output directory: `.`). GitHub connection can be added when ready. For production, do not use browser-only localStorage as shared multi-device persistence. Implement user authentication, Supabase tenant isolation/storage, server-side AI credentials, queued renders and publishing approvals before launching publicly.

## Project files

- `index.html` — app entry point
- `style.css` — responsive interface styles
- `app.js` — editor, workflow, export and local persistence
- `src/data.js` — starter brand kits and project templates

No dependencies required.
