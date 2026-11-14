# 06 — Expansion requests (14 Nov 2026)

Owner requests received during Phase 1. Not yet scheduled into phases; see "Proposed plan".

## 1. Post to several Facebook Pages

**Feasible with the current design.** One Meta app and one user login can list every Page the
owner manages (`/{user-id}/accounts`) and give a separate Page access token per Page. Pages the
owner manages do not need Advanced Access; publishing for Pages owned by other people would.
Permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.

Design changes (Phase 2):
- Each Page becomes a row in `accounts` (`kind = facebook_page`, own workspace, own token stored
  encrypted via `secret_ref`) instead of the single `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN`
  in `.env`. The env pair stays only as a bootstrap for the first Page.
- `pnpm owner account sync-facebook` lists the Pages the owner manages and records them; the owner
  then grants each Page to the Poster per workspace (`pnpm owner grant ...`).
- Every approval and publish package already binds to one `target_account_id`, so a post approved
  for Page A can never be published to Page B (P7). Posting the same content to several Pages
  means one approval per Page.
- Daily post limit and posting window become per-Page settings.

## 2. TikTok

**Possible, with a hard platform limit until TikTok audits the app.** The Content Posting API
lets an app post videos and photo carousels, but:
- Until the app passes TikTok's Content Posting audit, every post is forced to private
  (SELF_ONLY), only a handful of accounts can use the app, and those accounts must be private.
- App review (for the `video.publish` scope) and the Content Posting audit are separate steps.
  Third-party guides put the audit at a few weeks; TikTok publishes no official timeline.
- TikTok requires its own posting UX for direct posts (creator info, privacy choice, consent),
  which fits our approval step.
- TikTok is video/photo-first, so it needs media production (see the Creative Studio item below)
  before it is useful.

Proposed: a `tiktok-publisher` bot (deterministic, like the Facebook Poster) behind the same
approval and content-hash binding, built and tested in simulation first. Going live needs the owner
to create a TikTok developer app and pass the audit.

## 3. "Master Development Prompt": Boma Creative Studio + Ads Manager

The prompt as received stops at Part 4 (technology table), so the full requirements are not yet
available. From Parts 1–3 it asks for:

- **Boma AI Workforce** (this repo's engine): Chief, agent registry, orchestrator, permissions,
  approvals, scheduler, memory, cost controller, audit. Phases 0–1 already build most of this.
- **Boma Creative Studio**: a Next.js web app with brand manager, design/flyer editor, document
  studio, social content studio, ad creative studio, video studio, asset/template libraries, export.
- **Boma Ads Manager**: campaign planning and building, ad accounts, audiences, budgets, publishing,
  content calendar, analytics, optimisation recommendations, client reports.
- **Integrations**: AI/image/video/voice providers, Meta, LinkedIn, Google Ads, TikTok, YouTube,
  Google Drive, Gmail, webhooks. Simulation mode clearly labelled where credentials are missing.
- Rules that match ours: build first, no deployment or charges without explicit authorisation,
  under A$50/month excluding ad spend, Australian English.

### Conflicts and risks to settle

| Topic | Existing spec | Master prompt | Note |
|---|---|---|---|
| Timezone | Australia/Sydney | Australia/Melbourne | Same offsets and DST rules; switch is trivial. |
| Hosting | Worker on owner's PC; Vercel Hobby flagged as non-commercial | Vercel + external workers | Vercel Pro (about US$20/month) alone takes a large share of the A$50 budget. |
| Budget | A$45 hard cap for all AI work | Under A$50 excluding ads | Image/video generation costs far more per item than text; caps per studio needed. |
| Ad spend | `spend_money` is a protected action | Campaign builder, budgets | Launching or raising ad spend stays protected: owner approval every time, never autonomous. |
| Repo layout | `packages/core, llm, review, bots, connectors, db` | `packages/ui, database, auth, agents, ai-providers, ...` | Keep current packages; add `apps/web`, `packages/ui`, `design-engine`, `video-engine`, `advertising`, `publishing`. |
| Approvals | Telegram first, dashboard in Phase 5 | Web Approval Centre | Web Approval Centre could move earlier; Telegram stays as the mobile channel. |
| Scope | 7 phases, 2 bots in Release 1 | Full platform | Many months of work; needs phasing so each step is usable and tested. |

### Proposed plan (pending the rest of the prompt and owner decisions)

1. Finish Phase 1 (engine, dual review, Chief on Telegram, owner CLI). Everything else depends on it.
2. Phase 2: publishing layer for **multiple Facebook Pages** + TikTok publisher, both in simulation.
3. Phase 3: live Facebook Pages + WF-001 pilot (as before).
4. New phase: `apps/web` foundation: Next.js app, owner login, workspaces, brands, Approval Centre,
   budget and audit views (absorbs old Phase 5).
5. New phases: Creative Studio modules one at a time (social content → design editor → documents →
   video), then Ads Manager (simulation first; live ad spend only with explicit authorisation).
6. Email hub (old Phase 4) slots in where the owner prefers.
