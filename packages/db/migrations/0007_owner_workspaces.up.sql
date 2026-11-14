-- Workspaces the owner creates by instruction in chat (the Chief may use them).
alter table workspaces add column owner_added boolean not null default false;
