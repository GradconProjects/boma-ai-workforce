-- Chat with the Chief across the app and Telegram: conversations (recents) and messages.
create table chat_conversations (
  -- Created by the app (also offline), so the id comes from the client.
  id uuid primary key,
  title text not null default 'New chat',
  channel text not null default 'app' check (channel in ('app', 'telegram')),
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_conversations_recent_idx on chat_conversations (archived, updated_at desc);

create table chat_messages (
  id bigserial primary key,
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text not null check (role in ('owner', 'chief')),
  channel text not null check (channel in ('app', 'telegram')),
  text text not null,
  buttons jsonb,
  -- [{ id, name, mime, size }] pointing at rows in uploads
  attachments jsonb,
  -- Set by the app for messages typed (possibly offline); makes resending idempotent.
  client_id text unique,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on chat_messages (conversation_id, id);

-- Chat attachments: allow documents as well as images (types are checked by the upload route).
alter table uploads drop constraint uploads_mime_check;
alter table uploads add constraint uploads_mime_check check (mime in (
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
  'text/plain', 'text/markdown', 'text/csv', 'application/json'));
alter table uploads add column purpose text not null default 'library'
  check (purpose in ('library', 'chat'));

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
