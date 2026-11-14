# 04 — Build Plan, Gates and Claude Code Prompts

Each phase ends at a **gate**: Claude Code runs the listed tests, reports a pass/fail table, and stops until Boma replies "approved".

| Phase | Result | Real accounts? |
|---|---|---|
| 0 | Repo skeleton, tooling, CI, DB migrations, bot loader + lint | No |
| 1 | Task engine, policy, budget gateway, dual review, Chief on Telegram, owner CLI | Telegram + LLM APIs only |
| 2 | Facebook Page Poster against a mock Graph API (simulation mode) | No |
| 3 | Live Facebook Page posting + WF-001 pilot (OnGroundPM) | Facebook Page |
| 4 | Email hub (IMAP + Microsoft Graph), Email Manager bot | Email accounts |
| 5 | Dashboard (bot editor, approvals, budget, logs) | — |
| 6+ | X publisher, SaaS Growth, Research, browser/Windows workers, specialist bots | As approved |

---

## Prompt 0 — paste this first

```
Read CLAUDE.md and everything in docs/ and bots/ and config/. Do not write code yet.

1. Summarise the system back to me in 10 bullet points so I know you understood it.
2. List anything in the spec that is contradictory, unclear or risky.
3. Check the official Anthropic and OpenAI docs for the current SDK usage and model IDs,
   and propose values for the model settings in .env.example (cheap + strong tier for each).
4. Confirm or challenge the stack in CLAUDE.md.
5. Give me the Phase 0 task list.
Then stop and wait for my "approved".
```

## Phase 0 — Skeleton

Build: pnpm monorepo per CLAUDE.md layout; eslint/prettier/vitest; GitHub Actions running lint + tests; `packages/db` migrations for every table in `03-DATA-MODEL.md`; `packages/bots` loader (frontmatter → zod → lint → sync to `bot_versions`); `.env` loading with validation; `config/policy.yaml` loader.

Gate tests:
- G0.1 `pnpm test` green in CI
- G0.2 Migrations apply cleanly to an empty database and roll back
- G0.3 `bots/chief-of-staff.md` and `bots/facebook-page-poster.md` load and validate
- G0.4 Lint rejects: a bot granting itself a protected action at level 4; same-provider maker/checker with review required (R8); a secret pasted in a bot file
- G0.5 No secret appears in any committed file (secret scan)

## Phase 1 — Engine, Chief, dual review

Build: task lifecycle + checkpoints + claiming; policy engine (autonomy per action, protected list, unlocks); budget gateway (estimate/reserve/reconcile, AUD, warn/stop thresholds); `packages/llm` (Anthropic + OpenAI adapters, cost tables, retries/backoff); `packages/review` (full `02-DUAL-REVIEW.md`); Telegram long-poll connector (owner ID allow-list, inline approval buttons); Chief bot (classify, plan, dispatch, brief, report, Option B drafting); owner CLI (`pnpm owner unlock|grant|budget|pause|resume`).

Gate tests: **C1–C7** (`bots/chief-of-staff.md`), **R1–R8** (`02-DUAL-REVIEW.md`), plus:
- E1 Worker killed mid-task → resumes from checkpoint, no repeated step
- E2 `/pause_all` stops new actions within one loop tick
- E3 Budget at A$45 (seeded) → new billable tasks blocked, monitoring continues
- E4 Morning brief sent at 07:30 Sydney (time-mocked), correct across a daylight-saving change (T25)
Report the actual API spend for the phase.

## Phase 2 — Facebook Poster (simulation)

Build: Poster as deterministic code; mock Graph API (success, timeout, error, expired token, rate-limit); publish packages; approval binding by content hash; our scheduler; reconciliation-before-retry; daily token check; insights pull (mocked).

Gate tests: **P1–P8** (`bots/facebook-page-poster.md`), plus T14 (timeout → reconcile), T22 (bot edited mid-task keeps pinned version), T24 (stale approval after failed slot → re-approval), T26 (rate limit → backoff, no budget-burning loop). Full WF-001 dry run end to end in simulation.

## Phase 3 — Live Facebook + pilot

Owner tasks first (Claude Code gives step-by-step instructions, never asks for secrets in chat): create Meta developer app, connect Page, generate long-lived Page token, put it in `.env`. Confirm whether app review is needed for own-Page posting.

Then: one live test post approved by Boma → verify on Page → run WF-001 (7 days, 3 posts, OnGroundPM). Gate: all P-tests pass live; 100% published posts match approved content and Page; zero duplicates; spend ≤ A$8; final report with "not measured" where metrics are missing.

## Phase 4 — Email hub

Build per spec §13. Gate tests: T07, T11, T12, T15, T19, T20, T23 + 95% routing accuracy on 50–100 emails Boma labels.

## Phase 5 — Dashboard

Next.js: bot editor (edits write new git-tracked versions), approvals inbox, budget view, task/audit log, pause/resume, owner unlocks with confirmation. Choose host (not Vercel Hobby — non-commercial).
