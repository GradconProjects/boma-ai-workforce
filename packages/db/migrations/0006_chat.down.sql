drop table if exists chat_messages;
drop table if exists chat_conversations;
delete from uploads where mime not in ('image/png', 'image/jpeg', 'image/webp');
alter table uploads drop column if exists purpose;
alter table uploads drop constraint uploads_mime_check;
alter table uploads add constraint uploads_mime_check check (mime in ('image/png', 'image/jpeg', 'image/webp'));
