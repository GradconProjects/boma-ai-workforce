-- 0001_init: every table in docs/03-DATA-MODEL.md.
-- Timestamps are timestamptz (UTC). Money is AUD numeric(10,4).
-- RLS is enabled with no policies: anon/authenticated roles are denied; the worker uses the
-- service role (bypasses RLS on Supabase) or the table owner (plain Postgres).

create extension if not exists pgcrypto;

create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  rules       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table bots (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  current_version_id  uuid,
  enabled             boolean not null default false,
  department          text not null,
  created_at          timestamptz not null default now()
);

create table bot_versions (
  id            uuid primary key default gen_random_uuid(),
  bot_id        uuid not null references bots(id) on delete restrict,
  version       int  not null check (version > 0),
  file_sha      text not null,
  frontmatter   jsonb not null,
  instructions  text not null,
  lint_report   jsonb not null default '{}'::jsonb,
  created_by    text not null check (created_by in ('owner', 'git-sync')),
  created_at    timestamptz not null default now(),
  unique (bot_id, version)
);

alter table bots
  add constraint bots_current_version_fk
  foreign key (current_version_id) references bot_versions(id) deferrable initially deferred;

-- bot_versions are immutable: editing a bot inserts a new version.
create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is immutable (% blocked)', tg_table_name, tg_op;
end $$;

create trigger bot_versions_immutable
  before update or delete on bot_versions
  for each row execute function forbid_mutation();

create table accounts (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9-]+$'),
  kind                  text not null check (kind in (
                          'facebook_page', 'x', 'telegram', 'gmail_imap', 'yahoo_imap',
                          'domain_imap', 'outlook_graph')),
  label                 text not null,
  workspace_id          uuid references workspaces(id) on delete restrict,
  secret_ref            text,  -- pointer to an encrypted secret, never the secret itself
  status                text not null default 'ok' check (status in ('ok', 'expired', 'revoked')),
  last_health_check_at  timestamptz
);

create table bot_account_grants (
  bot_id              uuid not null references bots(id) on delete cascade,
  account_id          uuid not null references accounts(id) on delete cascade,
  granted_by_owner_at timestamptz not null default now(),
  primary key (bot_id, account_id)
);

create table tasks (
  id               uuid primary key default gen_random_uuid(),
  parent_task_id   uuid references tasks(id) on delete restrict,
  workspace_id     uuid references workspaces(id) on delete restrict,
  bot_id           uuid not null references bots(id) on delete restrict,
  bot_version_id   uuid not null references bot_versions(id) on delete restrict,
  from_bot_id      uuid references bots(id) on delete restrict,
  kind             text not null,
  status           text not null default 'queued' check (status in (
                     'queued', 'planned', 'running', 'in_review', 'revise', 'awaiting_approval',
                     'approved', 'executing', 'verifying', 'done', 'failed', 'expired',
                     'paused', 'cancelled')),
  inputs           jsonb not null default '{}'::jsonb,
  outputs          jsonb,
  evidence         jsonb,
  checkpoint       jsonb,
  attempts         int not null default 0 check (attempts >= 0),
  max_retries      int not null default 2 check (max_retries between 0 and 5),
  deadline_at      timestamptz,
  est_cost_aud     numeric(10,4) not null default 0,
  actual_cost_aud  numeric(10,4) not null default 0,
  approval_id      uuid,
  idempotency_key  text not null unique,
  locked_by        text,
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index tasks_claim_idx on tasks (status, locked_at);
create index tasks_parent_idx on tasks (parent_task_id);

create table task_events (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references tasks(id) on delete restrict,
  from_status  text,
  to_status    text not null,
  actor        text not null check (actor = 'owner' or actor = 'system' or actor ~ '^bot:[a-z0-9-]+$'),
  note         text,
  created_at   timestamptz not null default now()
);

create index task_events_task_idx on task_events (task_id, created_at);

create table reviews (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete restrict,
  round             int not null check (round between 1 and 3),
  maker_provider    text not null,
  maker_model       text not null,
  checker_provider  text not null,
  checker_model     text not null,
  output_hash       text not null,
  verdict           jsonb not null,
  cost_aud          numeric(10,4) not null default 0,
  created_at        timestamptz not null default now(),
  check (maker_provider <> checker_provider),
  unique (task_id, round)
);

create table approvals (
  id                   uuid primary key default gen_random_uuid(),
  task_id              uuid not null references tasks(id) on delete restrict,
  content_hash         text not null,
  target_account_id    uuid references accounts(id) on delete restrict,
  scheduled_at         timestamptz,
  preview              jsonb not null,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  decided_at           timestamptz,
  expires_at           timestamptz not null,
  telegram_message_id  bigint,
  created_at           timestamptz not null default now()
);

alter table tasks
  add constraint tasks_approval_fk foreign key (approval_id) references approvals(id);

create table publish_packages (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete restrict,
  account_id        uuid not null references accounts(id) on delete restrict,
  payload           jsonb not null,
  content_hash      text not null,
  approval_id       uuid not null references approvals(id) on delete restrict,
  idempotency_key   text not null unique,
  status            text not null default 'scheduled' check (status in ('scheduled', 'published', 'failed', 'cancelled')),
  provider_post_id  text,
  permalink         text,
  published_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table budget_ledger (
  id          bigint generated always as identity primary key,
  task_id     uuid references tasks(id) on delete restrict,
  bot_id      uuid references bots(id) on delete restrict,
  provider    text not null,
  kind        text not null check (kind in ('reserve', 'actual', 'release')),
  amount_aud  numeric(10,4) not null,
  tokens_in   int,
  tokens_out  int,
  created_at  timestamptz not null default now()
);

create index budget_ledger_month_idx on budget_ledger (created_at);

create table budget_limits (
  scope            text primary key check (scope = 'company' or scope ~ '^bot:[a-z0-9-]+$'),
  monthly_aud      numeric(10,4) not null check (monthly_aud >= 0),
  warn_aud         numeric(10,4) check (warn_aud >= 0),
  set_by_owner_at  timestamptz not null default now()
);

create table policy_unlocks (
  id                    uuid primary key default gen_random_uuid(),
  action                text not null,
  bot_id                uuid not null references bots(id) on delete restrict,
  workspace_id          uuid references workspaces(id) on delete restrict,
  new_level             int not null check (new_level between 1 and 5),
  reason                text not null,
  unlocked_by_owner_at  timestamptz not null default now(),
  expires_at            timestamptz
);

create table memory (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null check (scope in ('owner', 'workspace', 'bot')),
  scope_id        text,
  key             text not null,
  value           jsonb not null,
  source_task_id  uuid references tasks(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index memory_scope_idx on memory (scope, scope_id, key);

create table audit_log (
  id            bigint generated always as identity primary key,
  actor         text not null,
  action        text not null,
  target        text,
  inputs_hash   text,
  outputs_hash  text,
  cost_aud      numeric(10,4) not null default 0,
  result        text not null,
  created_at    timestamptz not null default now()
);

-- audit_log is append-only.
create trigger audit_log_append_only
  before update or delete on audit_log
  for each row execute function forbid_mutation();

create table system_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'workspaces', 'bots', 'bot_versions', 'accounts', 'bot_account_grants', 'tasks',
    'task_events', 'reviews', 'approvals', 'publish_packages', 'budget_ledger',
    'budget_limits', 'policy_unlocks', 'memory', 'audit_log', 'system_state'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
