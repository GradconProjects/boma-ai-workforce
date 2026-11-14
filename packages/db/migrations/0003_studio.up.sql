-- 0003_studio: Boma Creative Studio (brands, designs with version history, campaigns).

create table brands (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  workspace_id  uuid references workspaces(id) on delete set null,
  data          jsonb not null,           -- name, tagline, colours, fonts, features, ...
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete restrict,
  name          text not null,
  objective     text not null,
  audience      text not null,
  cta           text not null default '',
  channels      text[] not null default '{}',
  status        text not null default 'draft' check (status in ('draft', 'in_production', 'ready', 'archived')),
  starts_on     date,
  ends_on       date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table designs (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete restrict,
  campaign_id   uuid references campaigns(id) on delete set null,
  title         text not null,
  format_id     text not null,
  template_id   text not null,
  doc           jsonb not null,
  revision      int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index designs_brand_idx on designs (brand_id, updated_at desc) where deleted_at is null;

-- Version history: a snapshot per explicit save / AI change, immutable.
create table design_versions (
  id          bigint generated always as identity primary key,
  design_id   uuid not null references designs(id) on delete cascade,
  revision    int not null,
  doc         jsonb not null,
  note        text not null,
  actor       text not null,
  created_at  timestamptz not null default now(),
  unique (design_id, revision)
);

create table campaign_items (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  design_id     uuid not null references designs(id) on delete cascade,
  position      int not null default 0,
  task_id       uuid references tasks(id) on delete set null,
  copy          jsonb,
  copy_status   text not null default 'none'
                check (copy_status in ('none', 'drafting', 'awaiting_approval', 'approved', 'rejected', 'failed', 'needs_decision')),
  simulated     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index campaign_items_task_idx on campaign_items (task_id);

do $$
declare t text;
begin
  foreach t in array array['brands', 'campaigns', 'designs', 'design_versions', 'campaign_items'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
