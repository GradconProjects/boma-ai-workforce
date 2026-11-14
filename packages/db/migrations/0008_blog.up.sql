-- Public blogs, one per workspace. Articles are written by the bots, dual-reviewed, approved
-- (by the owner or his autopilot rule) and then published here.
create table blog_posts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  task_id       uuid unique references tasks(id) on delete set null,
  slug          text not null check (slug ~ '^[a-z0-9-]+$'),
  title         text not null,
  excerpt       text not null default '',
  body_md       text not null,
  published_at  timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index blog_posts_recent_idx on blog_posts (workspace_id, published_at desc);
alter table blog_posts enable row level security;
