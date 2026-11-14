-- 0005_skills: owner-imported skills (and owner overrides of built-in skills) and skill runs.
create table skills (
  slug         text primary key check (slug ~ '^[a-z0-9-]+$'),
  source       text not null check (source in ('import', 'override')),
  frontmatter  jsonb not null,
  body         text not null default '',
  refs         jsonb not null default '[]'::jsonb,   -- [{name, text}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table skill_runs (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete set null,
  slug        text not null,
  request     text not null,
  output      text,
  status      text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  channel     text not null default 'web' check (channel in ('web', 'telegram')),
  simulated   boolean not null default false,
  cost_aud    numeric(10,4) not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index skill_runs_created_idx on skill_runs (created_at desc);

alter table skills enable row level security;
alter table skill_runs enable row level security;
