# 03 — Data Model (Postgres / Supabase)

All timestamps `timestamptz` stored in UTC. Money in AUD as `numeric(10,4)`. Row Level Security on; only the worker's service role and the owner can read/write.

## Core tables

**workspaces** — `id, slug, name, rules jsonb (e.g. banned claims), created_at`

**bots** — `id, slug unique, current_version_id, enabled, department, created_at`

**bot_versions** — `id, bot_id, version int, file_sha, frontmatter jsonb, instructions text, lint_report jsonb, created_by ('owner'|'git-sync'), created_at` — immutable.

**accounts** — `id, slug unique (the account ID bot files reference, e.g. facebook-page-ongroundpm), kind ('facebook_page'|'x'|'telegram'|'gmail_imap'|'outlook_graph'|...), label, workspace_id, secret_ref (pointer to encrypted secret, never the secret), status ('ok'|'expired'|'revoked'), last_health_check_at`

**bot_account_grants** — `bot_id, account_id, granted_by_owner_at` (no row = no access)

**tasks** — `id, parent_task_id, workspace_id, bot_id, bot_version_id (pinned), from_bot_id, kind, status, inputs jsonb, outputs jsonb, evidence jsonb, checkpoint jsonb, attempts int, max_retries int, deadline_at, est_cost_aud, actual_cost_aud, approval_id, idempotency_key unique, locked_by, locked_at, created_at, updated_at`

**task_events** — `id, task_id, from_status, to_status, actor ('bot:<slug>'|'owner'|'system'), note, created_at`

**reviews** — `id, task_id, round int, maker_provider, maker_model, checker_provider, checker_model, output_hash, verdict jsonb, cost_aud, created_at`

**approvals** — `id, task_id, content_hash, target_account_id, scheduled_at, preview jsonb, status ('pending'|'approved'|'rejected'|'expired'), decided_at, expires_at, telegram_message_id`

**publish_packages** — `id, task_id, account_id, payload jsonb, content_hash, approval_id, idempotency_key unique, status ('scheduled'|'published'|'failed'|'cancelled'), provider_post_id, permalink, published_at`

**budget_ledger** — `id, task_id, bot_id, provider, kind ('reserve'|'actual'|'release'), amount_aud, tokens_in, tokens_out, created_at`

**budget_limits** — `scope ('company'|'bot:<slug>'), monthly_aud, warn_aud, set_by_owner_at`

**policy_unlocks** — `id, action, bot_id, workspace_id, new_level, reason, unlocked_by_owner_at, expires_at` (only written by owner CLI/dashboard)

**memory** — `id, scope ('owner'|'workspace'|'bot'), scope_id, key, value jsonb, source_task_id, created_at`

**audit_log** — `id, actor, action, target, inputs_hash, outputs_hash, cost_aud, result, created_at` (append-only)

**system_state** — `key, value` (e.g. `paused=true`, fx rate, last brief sent)

## Key constraints

- `tasks.idempotency_key` and `publish_packages.idempotency_key` unique → no double actions.
- `approvals` matched on `content_hash` at publish time; mismatch = block.
- `bot_versions` immutable; editing a bot inserts a new version.
- Worker claims tasks: `SELECT … WHERE status='queued' AND (locked_at IS NULL OR locked_at < now() - interval '10 min') FOR UPDATE SKIP LOCKED LIMIT 1`.
