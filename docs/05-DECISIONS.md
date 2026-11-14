# 05 — Decision Register (14 Nov 2026)

## Agreed

| Decision | Choice |
|---|---|
| System | Personal multi-agent workforce, Chief of Staff + one bot per workflow |
| Editable bots | Markdown files in git, synced to DB, versioned, clonable |
| First bots | Chief of Staff, then Facebook Page Poster |
| Facebook | Page (automatic posting via Graph API); personal profile not supported by Meta |
| Post text source | Option B — Chief drafts (cannot publish), owner approves |
| Quality control | Claude ↔ OpenAI dual review (maker/checker, different providers) |
| Autonomy | 5 levels, per action/account/workspace; default 2, external 3 |
| Protected actions | Owner-path unlock only; never by a bot or message |
| Budget | Under A$50/month; A$45 hard planning cap; warn A$35 |
| Deployment | Hybrid: worker on Boma's PC first; cloud later; Windows worker in a separate user account/VM |
| Email | IMAP/app passwords (Gmail, Yahoo, domain) + Microsoft Graph (Outlook) |
| Pilot | WF-001 on OnGroundPM (Boma Scans deferred pending advice on financial-product rules) |
| Approvals | Telegram first, dashboard in Phase 5; bound to content hash; expire |
| Build tool | Claude Code, phase by phase with gates |

## Defaults chosen — change if you disagree

- Language/stack: TypeScript monorepo, Supabase Postgres, vitest.
- Default maker = Claude, checker = OpenAI.
- Approval expiry: 24h after scheduled time / 72h unscheduled.
- Max 2 revision rounds before disagreement goes to owner.

## Phase 0 build decisions (14 Nov 2026) — review at the gate

- Bot schema adds `models.planner`, `posting_window`, `daily_post_limit` (the shipped bot files already used them). Unknown fields are rejected.
- `accounts.slug` added so bot files can reference accounts by a readable ID.
- `safety_buffer_below: 50` means the absolute ceiling: the company cap must stay below it.
- Migrations are plain SQL up/down files run by a small in-repo runner (no migration framework dependency).
- Extra dependencies beyond the stated stack: `yaml` (frontmatter + policy), `pg` (Postgres driver), `tsx` (run TS scripts), `typescript`, `typescript-eslint`, `@eslint/js`, `@types/node`, `@types/pg`.
- RLS is enabled on every table with no policies (deny by default). Owner-read policies come with the dashboard in Phase 5.

## Still open

1. Exact email account list (7–10 accounts, providers).
2. Supabase project: new project in the remaining free slot (owner creates it at Phase 1) or another Postgres host.
3. Cloud host for the worker after the PC phase.
4. Posting window hours for the Facebook Page (default 07:00–21:00 Sydney).
