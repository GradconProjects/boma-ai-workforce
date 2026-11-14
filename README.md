# Boma AI Workforce — Build Handoff Package

A personal "company" of editable AI bots, coordinated by a Chief of Staff, where **Claude and OpenAI check each other's work** before anything becomes a final output.

Status: **Phase 0 (skeleton) built, awaiting gate approval.** The docs in this folder remain the single source of truth.

## Developer quick start

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL at minimum
pnpm db:migrate               # apply migrations
pnpm bots:sync                # load bots/*.md into bot_versions
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm check
```

`pnpm check` runs lint, typecheck, tests, the secret scan and bot validation.

## What's in here

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing instructions Claude Code reads automatically. Rules, stack, gates. |
| `docs/01-SPEC.md` | The full system logic: bots, tasks, autonomy, approvals, budget, safety. |
| `docs/02-DUAL-REVIEW.md` | The Claude ↔ OpenAI cross-check protocol. |
| `docs/03-DATA-MODEL.md` | Database tables and fields. |
| `docs/04-BUILD-PLAN.md` | Phases, acceptance tests, and the exact prompts to paste into Claude Code. |
| `docs/05-DECISIONS.md` | Every decision made so far, and the few still open. |
| `bots/*.md` | Editable bot definitions (Chief, Facebook Poster, template). |
| `config/policy.yaml` | Autonomy levels, protected actions, budget caps. |
| `.env.example` | Every secret/setting the system needs (no real values). |

## How to start in Claude Code

1. Create an empty folder (or GitHub repo) called `boma-ai-workforce` and copy this package into it.
2. Open it in Claude Code.
3. Paste **Prompt 0** from `docs/04-BUILD-PLAN.md`.
4. Claude Code builds one phase at a time and **stops at each gate** for your approval.

Nothing connects to a real account until Phase 3, and only after you approve the gate.
