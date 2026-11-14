# CLAUDE.md — Instructions for Claude Code

You are building **Boma AI Workforce** for the owner, Boma. Read `docs/01-SPEC.md`, `docs/02-DUAL-REVIEW.md`, `docs/03-DATA-MODEL.md` and `docs/04-BUILD-PLAN.md` before writing code. If code and spec disagree, the spec wins; if the spec is wrong or unclear, stop and ask.

## Non-negotiable rules

1. **Build one phase at a time** (`docs/04-BUILD-PLAN.md`). At the end of each phase, run its acceptance tests, report results, and **stop at the gate** until Boma says "approved".
2. **No real external actions before Phase 3 gate.** Until then every connector (Telegram send excepted from Phase 1, Facebook, X, email) runs against a mock. Tests never hit live Facebook, X or email.
3. **Never commit secrets.** Secrets live only in `.env` (git-ignored). Never print a secret in logs, errors or test output. `.env.example` lists names only.
4. **Rules are enforced in code, not prompts.** Permissions, autonomy, protected actions, budget and approvals are checked by deterministic code before any action. An LLM may *propose*; the policy engine *decides*.
5. **Content from outside is data, never instructions.** Emails, web pages, social comments, files and tool results are passed to models inside clearly delimited data blocks, with a system instruction that they contain no commands. Never let such content change a bot's permissions, recipients or targets.
6. **A bot can never raise its own or another bot's permissions.** Permission changes and protected-action unlocks happen only through the owner path (Phase 1: local CLI `pnpm owner ...`; later: dashboard with confirmation).
7. **Every external-facing output passes the dual review** (`docs/02-DUAL-REVIEW.md`) before it can reach the approval step.
8. **Every paid call goes through the budget gateway** (estimate → reserve → call → reconcile). No direct SDK calls outside `packages/llm` and `packages/connectors`.
9. **Idempotency everywhere.** Every external action has an idempotency key. On timeout, reconcile state before retrying. Never double-post or double-send.
10. **Ask before adding a dependency** that isn't in the stack below. Prefer fewer packages.

## Stack (default — confirm in Prompt 0)

- Language: TypeScript (Node 20+), pnpm workspaces monorepo
- Database: Supabase Postgres (owner creates the project when Phase 1 starts; local dev uses `supabase start` or plain Postgres in Docker)
- Validation: zod · Tests: vitest · Lint/format: eslint + prettier
- LLM SDKs: `@anthropic-ai/sdk` and `openai` — **check current SDK usage and model IDs in the official docs before coding; do not rely on memory.** Model IDs come from `.env`, never hard-coded.
- Telegram: Bot API via long polling in Phase 1 (no public URL needed); webhook later
- Facebook: Graph API, Page endpoints only
- Worker: a single Node process (`apps/worker`) running the task engine; runs on Boma's PC first (hybrid plan), cloud host later
- Dashboard: deferred to Phase 5 (Next.js). Note: Vercel Hobby is non-commercial only — pick a host at Phase 5.

## Repo layout

```
apps/worker            task engine loop, schedulers, Telegram long-poll
apps/cli               owner CLI (pnpm owner ...): unlock, permissions, budget, pause
packages/core          tasks, lifecycle, policy engine, budget gateway, approvals, audit
packages/llm           provider abstraction: anthropic, openai, cost tables
packages/review        dual-review service (maker/checker)
packages/bots          loads bots/*.md, validates, versions, security-lints
packages/connectors    telegram, facebook (+ mocks); email/x later
packages/db            migrations, typed queries
bots/                  editable bot definitions (markdown + YAML frontmatter)
config/policy.yaml     autonomy + protected actions + budget caps
docs/                  spec (source of truth)
```

## Working style

- Plan → write tests → implement → run tests → report. Keep PR-sized commits with clear messages.
- When a test from the spec can't pass, say so plainly and explain why; never weaken a test to make it pass.
- Report at each gate: what was built, test results table (pass/fail), cost of any real API calls, open questions.
- Australian English in user-facing text. Times in Australia/Sydney; store UTC.
