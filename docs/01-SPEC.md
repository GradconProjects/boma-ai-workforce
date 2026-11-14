# 01 — System Specification (v1.0, 14 Nov 2026)

## 1. Purpose

A personal AI workforce for Boma: one editable bot per part of his workflow, coordinated by a Chief of Staff, doing real work (not just chat) under strict permissions, approvals and a monthly budget under A$50. Two AI providers — Anthropic Claude and OpenAI — check each other's work before any final output.

## 2. Structure

```
Owner (Boma)
  └─ Chief of Staff  (plans, delegates, supervises, reports)
       ├─ Departments: Marketing · Creative · Engineering · Business · Personal Ops · Intelligence
       │     └─ Bots (one per workflow), assigned to Workspaces
       └─ Shared platform: task engine · policy engine · budget gateway · approvals
                           · dual review · memory · audit log · workers (cloud / browser / Windows)
```

**Workspaces** group work by project (OnGroundPM, MyPadiForum, Boma Scans, Personal, each future SaaS). A bot can serve several workspaces but only sees the accounts and data of the workspace a task belongs to.

## 3. Foundation rules

1. Every bot is editable, versioned, clonable and deletable.
2. One bot per workflow; several bots can collaborate on one job.
3. Each bot can use a different AI model.
4. **Writing and publishing are separate.** Content bots create; only publisher bots post or send.
5. Five autonomy levels, set **per action, per account, per workspace**.
6. **Protected actions** can only be unlocked by the owner path, never by a bot or a message.
7. Least privilege: each bot gets only the accounts, tools and machines it needs.
8. All email accounts go through one hub; each mailbox keeps its own identity.
9. Every task ends with **evidence of completion** or a clear failure report.
10. Route preference for doing a task: **API → browser → desktop.**
11. Every external-facing output passes the **Claude ↔ OpenAI dual review** (`02-DUAL-REVIEW.md`).

## 4. Bots

### 4.1 A bot is a file

Each bot is `bots/<slug>.md`: YAML frontmatter (settings) + markdown body (instructions). Files are versioned in git; `packages/bots` validates them (zod), security-lints them, and syncs them to the `bots` / `bot_versions` tables. A task pins the bot version it started with.

Frontmatter fields (see `bots/_TEMPLATE.md`):

| Field | Meaning |
|---|---|
| `slug`, `name`, `department`, `enabled` | Identity |
| `purpose` | One line |
| `workspaces` | Which workspaces it may work in |
| `models.maker` / `models.checker` | Provider + model env key for producing / reviewing |
| `models.planner` | Optional stronger maker for multi-step planning/drafting; counts as a maker for the different-provider rule |
| `tools` | Allowed tools (deny by default) |
| `accounts` | Allowed account IDs (deny by default) |
| `triggers` | schedule (cron, Sydney time), events, owner message |
| `actions` | Map of action → autonomy level (1–5) |
| `budget.monthly_aud`, `budget.max_task_aud`, `budget.max_concurrency`, `budget.max_retries` | Spend limits |
| `reports_to` | Usually `chief-of-staff` |
| `memory.scope` | `bot` / `workspace` / `owner-profile` (read-only) |
| `review` | `required` / `optional` / `off` (forced `required` for external outputs) |
| `posting_window`, `daily_post_limit` | Optional, publisher bots only: `{start, end, tz}` (HH:MM) and max posts per day |

Unknown fields are rejected (catches typos). `model_env` must name an env key, never a model ID.

**Security lint on save** rejects: a non-owner tool granting itself new tools/accounts; protected actions set above level 3 without an owner unlock record; secrets pasted into a bot file; tools not on the allowed list.

### 4.2 Roster

Release 1 (enabled): **Chief of Staff, Facebook Page Poster.** Dual review acts as the Quality Controller.

Templates (disabled until their phase): Email Manager, Research, SaaS Growth (per workspace), Social Publisher X, Creative (video/design), Customer Support, Analytics, Admin, Developer, Web/Desktop Operator, Construction Estimator, Career, Markets (read-only), Forum Manager, Finance & Records, Automation Engineer.

## 5. Chief of Staff (summary — full file `bots/chief-of-staff.md`)

- Inputs: owner's Telegram (only the owner's Telegram user ID; others ignored + logged), schedules (07:30 brief, 18:00 report), system events.
- Loop: classify → plan (tasks, owners, order, cost estimate) → policy check → dispatch → monitor → retry ≤2 → dual review → report with evidence.
- Asks exactly one clarifying question when unclear.
- Can: create/assign/cancel tasks, read status, message owner, propose bot edits, **draft post text** (Option B draft-writer skill — cannot publish).
- Cannot: touch accounts, post, send email, spend beyond budget, change any permissions.
- Commands: `/status /approvals /budget /bots /pause_all /resume /edit <bot>` + plain English.

## 6. Facebook Page Poster (summary — full file `bots/facebook-page-poster.md`)

- **No LLM.** Deterministic code only. A$0 AI cost.
- Input: approved post package {text, media?, link?, page_id, scheduled_at, content_hash, approval_id, approval_expires_at, idempotency_key}.
- Pre-flight (all must pass): approval valid & unexpired · hash matches exactly · page matches · time future & within posting window · media spec + link resolves · not duplicate · daily limit · not paused.
- Publishes via our scheduler (not Facebook's native scheduling) so pause/expiry work to the last second.
- On timeout: check the Page for the post before retrying.
- Daily token health check; 24h/72h insights pull.
- Edit/delete live posts = protected.

## 7. Task engine

### 7.1 Lifecycle

```
queued → planned → running → in_review → awaiting_approval → approved → executing → verifying → done
                       ↘ failed      ↘ revise (back to running, max 2)        ↘ expired
any state → paused (by /pause_all) · cancelled (by owner/Chief)
```

- Tasks are rows; workers claim them with `SELECT … FOR UPDATE SKIP LOCKED`.
- Each step writes a checkpoint; after a crash the task resumes from the last checkpoint. Completed external actions are never repeated (idempotency key + reconciliation).
- Every state change appends to `task_events` and `audit_log`.

### 7.2 Bot-to-bot handoff contract

A handoff is a new task with: `parent_task_id`, `from_bot`, `to_bot`, `workspace`, `inputs` (typed JSON, validated by the receiving bot's input schema), `deadline`, `max_cost_aud`. Bots never call each other directly; everything goes through the task table.

## 8. Autonomy and protected actions

| Level | Name | Behaviour |
|---|---|---|
| 1 | Observe | Read/monitor only |
| 2 | Prepare | Create drafts/files; no external effect |
| 3 | Approval | Complete up to an approval checkpoint, then wait |
| 4 | Act & report | Execute, then notify owner |
| 5 | Autonomous | Execute within limits, include in daily report |

Default for every new action: **level 2**. External-facing actions start at **3**.

**Protected actions** (`config/policy.yaml`), capped at level 3 unless the owner unlocks via the owner path: payments/spending, trades, job applications, ATO/tax/legal/tribunal lodgements, deleting anything, editing/deleting live posts, first contact with a new recipient, changing any bot's permissions, raising any budget.

## 9. Approvals

- Delivered to Telegram (Phase 1) and dashboard (Phase 5): exact preview, target account, time, cost, both reviewers' verdicts. Buttons: Approve / Edit / Reject.
- An approval binds to `content_hash + target + scheduled_at`. Any change → new approval.
- Approvals expire (default: 24h after the scheduled time, or 72h if unscheduled). Expired → task `expired`.
- Approve callbacks are accepted only from the owner's Telegram user ID.

## 10. Budget

- Hard planning ceiling **A$45/month**; A$5 buffer below A$50. Warn at A$35; at A$45 stop all new billable work (monitoring and zero-cost actions continue).
- Gateway per paid call: estimate (token × price table in AUD) → reserve against bot + company budget → call → record actual → reconcile reservation.
- Bots cannot raise budgets. Provider-side caps/prepaid balances set wherever available.
- Initial allocation (AUD/month): Chief 3 · Dual review 5 · Email 7 · Research 4 · SaaS Growth 6 · Poster 0 · X API 5 · hosting 5 · contingency 10. Only Chief, review and Poster are active in Release 1.

## 11. Memory

- **Owner profile** (read-only to bots): locked facts, preferences, brand rules.
- **Workspace memory**: product facts, audience, claim register, what worked.
- **Bot memory**: lessons, rejected drafts and why.
- Every memory write records its source task. The Chief writes "lessons" after each completed job; owner can view/delete.

## 12. Safety

- Prompt-injection defence: external content in delimited data blocks; dual reviewer explicitly scans for embedded instructions; injection attempts are flagged and logged (test T11/T23).
- Per-bot credentials scoped to its accounts; secrets encrypted at rest; never in bot files or logs.
- `/pause_all` kill switch always works, regardless of budget state.
- Full audit log: who/what/when/why, inputs hash, outputs hash, cost.
- Workspace rule examples: Boma Scans → no profit/performance claims, educational only, general-advice warning; OnGroundPM → no licensing claims not held.

## 13. Email hub (Phase 4 — design locked)

- Connections: Gmail, Yahoo, domain mail → IMAP/SMTP with app passwords; Outlook/Hotmail → Microsoft Graph OAuth. Verify current provider rules at build time.
- Sync engine (no LLM): incremental fetch, dedupe, rules (known senders, newsletters, spam) → only messages needing interpretation reach the Email Manager.
- Routing: job → Career; client → Business Dev; SaaS signup/feedback → SaaS Growth / Support; invoice → Finance.
- Replies always from the receiving mailbox. Sending = level 3 by default; routine acknowledgements may be raised to 4 per mailbox.
- Personal/finance mailboxes: single provider processing only (no dual review) unless owner opts in — reduces data exposure.

## 14. Pilot (WF-001)

7-day text-led campaign for **OnGroundPM** (default; Boma Scans deferred for regulatory reasons): 3 Facebook Page posts (X added when its phase lands), drafted by Chief (Option B), dual-reviewed, approved on Telegram, published by the Poster, metrics collected. Pilot cap A$8.
