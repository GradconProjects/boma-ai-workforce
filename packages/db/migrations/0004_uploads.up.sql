-- 0004_uploads: owner image uploads stored in Postgres (works on serverless hosting, no extra
-- storage credentials). Images are capped at 10 MB by the upload route.
create table uploads (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  mime        text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes  int not null check (size_bytes > 0 and size_bytes <= 10485760),
  bytes       bytea not null,
  created_at  timestamptz not null default now()
);
create index uploads_created_idx on uploads (created_at desc);
alter table uploads enable row level security;
