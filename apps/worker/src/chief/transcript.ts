import type { InlineButton } from "@boma/connectors";
import { wrapUntrusted, type Queryable } from "@boma/core";
import { redactPasscode } from "./chief";
import type { Notifier } from "./notifier";

/**
 * Conversations with the Chief across the app and Telegram. Every Chief message is stored (so
 * the app shows it, online or after reconnecting) and also goes to Telegram when connected.
 * Owner messages are stored by whichever channel received them. Passcodes are never stored.
 *
 * Chief messages are filed under the conversation of the owner's latest message: there is one
 * owner, so the reply belongs to whatever they last asked, wherever they asked it.
 */

/** All Telegram messages live in one conversation. */
export const TELEGRAM_CONVERSATION = "00000000-0000-4000-8000-000000000001";

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string | null;
  role: "owner" | "chief";
  channel: "app" | "telegram";
  text: string;
  buttons: InlineButton[][] | null;
  attachments: Attachment[] | null;
  client_id: string | null;
  created_at: Date;
}

export interface Conversation {
  id: string;
  title: string;
  channel: "app" | "telegram";
  pinned: boolean;
  updated_at: Date;
  last_text: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || "New chat";
};

async function ensureConversation(
  db: Queryable,
  id: string,
  channel: "app" | "telegram",
  firstText: string,
): Promise<void> {
  await db.query(
    `insert into chat_conversations (id, title, channel) values ($1, $2, $3)
     on conflict (id) do update set updated_at = now(), archived = false,
       title = case when chat_conversations.title = 'New chat' then excluded.title else chat_conversations.title end`,
    [id, channel === "telegram" ? "Telegram" : titleFrom(firstText), channel],
  );
}

export async function logChat(
  db: Queryable,
  m: {
    role: "owner" | "chief";
    channel: "app" | "telegram";
    text: string;
    buttons?: InlineButton[][];
    clientId?: string;
    conversationId?: string;
    attachments?: Attachment[];
  },
): Promise<{ id: string; duplicate: boolean; conversationId: string | null }> {
  const text = m.role === "owner" ? redactPasscode(m.text) : m.text;
  let conversationId = m.conversationId ?? null;
  if (m.role === "owner") {
    conversationId ??= m.channel === "telegram" ? TELEGRAM_CONVERSATION : null;
    if (!conversationId || !isUuid(conversationId)) throw new Error("conversation id required");
    await ensureConversation(db, conversationId, m.channel, text);
  } else if (!conversationId) {
    const last = await db.query<{ conversation_id: string | null }>(
      "select conversation_id from chat_messages where role = 'owner' order by id desc limit 1",
    );
    conversationId = last.rows[0]?.conversation_id ?? TELEGRAM_CONVERSATION;
    await ensureConversation(db, conversationId, "telegram", "Telegram");
  }
  const { rows } = await db.query<{ id: string }>(
    `insert into chat_messages (conversation_id, role, channel, text, buttons, attachments, client_id)
     values ($1, $2, $3, $4, $5, $6, $7) on conflict (client_id) do nothing returning id`,
    [
      conversationId,
      m.role,
      m.channel,
      text,
      m.buttons ? JSON.stringify(m.buttons) : null,
      m.attachments?.length ? JSON.stringify(m.attachments) : null,
      m.clientId ?? null,
    ],
  );
  await db.query("update chat_conversations set updated_at = now() where id = $1", [
    conversationId,
  ]);
  if (rows[0]) return { id: rows[0].id, duplicate: false, conversationId };
  const existing = await db.query<{ id: string }>(
    "select id from chat_messages where client_id = $1",
    [m.clientId],
  );
  return { id: existing.rows[0]!.id, duplicate: true, conversationId };
}

export async function chatHistory(
  db: Queryable,
  o: { conversationId?: string; afterId?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const limit = Math.min(o.limit ?? 100, 300);
  const conv = o.conversationId && isUuid(o.conversationId) ? o.conversationId : null;
  const after = o.afterId && /^\d+$/.test(o.afterId) ? o.afterId : "0";
  const { rows } = await db.query<ChatMessage>(
    `select * from (
       select * from chat_messages
        where ($1::uuid is null or conversation_id = $1) and id > $2
        order by id desc limit $3
     ) m order by id`,
    [conv, after, limit],
  );
  return rows;
}

export async function listConversations(
  db: Queryable,
  o: { limit?: number; search?: string } = {},
): Promise<Conversation[]> {
  const q = o.search?.trim().slice(0, 100);
  const { rows } = await db.query<Conversation>(
    `select c.id, c.title, c.channel, c.pinned, c.updated_at,
            (select left(text, 140) from chat_messages m where m.conversation_id = c.id order by id desc limit 1) as last_text
       from chat_conversations c
      where not c.archived
        and ($2::text is null or c.title ilike '%' || $2 || '%'
             or exists (select 1 from chat_messages m where m.conversation_id = c.id and m.text ilike '%' || $2 || '%'))
      order by c.pinned desc, c.updated_at desc limit $1`,
    [Math.min(o.limit ?? 50, 200), q || null],
  );
  return rows;
}

export async function updateConversation(
  db: Queryable,
  id: string,
  patch: { title?: string; pinned?: boolean; archived?: boolean },
): Promise<void> {
  if (!isUuid(id)) return;
  await db.query(
    `update chat_conversations set
       title = coalesce($2, title), pinned = coalesce($3, pinned), archived = coalesce($4, archived)
     where id = $1`,
    [id, patch.title ? titleFrom(patch.title) : null, patch.pinned ?? null, patch.archived ?? null],
  );
}

/** Text the Chief sees for attachments: names always; contents of small text files as data. */
export async function describeAttachments(db: Queryable, list: Attachment[]): Promise<string> {
  if (!list.length) return "";
  const parts: string[] = [];
  for (const a of list.slice(0, 10)) {
    const { rows } = await db.query<{ filename: string; mime: string; bytes: Buffer }>(
      "select filename, mime, bytes from uploads where id = $1",
      [a.id],
    );
    const f = rows[0];
    if (!f) continue;
    if (f.mime.startsWith("text/") || f.mime === "application/json") {
      parts.push(
        `Attached file "${f.filename}":\n${wrapUntrusted(`attachment:${f.filename}`, f.bytes.toString("utf8").slice(0, 20_000))}`,
      );
    } else {
      parts.push(
        `Attached file "${f.filename}" (${f.mime}); its contents are not readable here yet.`,
      );
    }
  }
  return parts.join("\n\n");
}

/** Wrap the Telegram (or console) notifier so every Chief message is also kept in the chat. */
export function withTranscript(db: Queryable, inner: Notifier): Notifier {
  return {
    async send(text, buttons, opts) {
      try {
        await logChat(db, {
          role: "chief",
          channel: "app",
          text,
          buttons,
          conversationId: isUuid(opts?.conversationId) ? opts!.conversationId! : undefined,
        });
      } catch (err) {
        console.error("chat log failed:", (err as Error).message);
      }
      return inner.send(text, buttons);
    },
    edit: (id, text) => inner.edit(id, text),
    // App messages use negative ids: there is nothing on Telegram to delete for them.
    deleteOwnerMessage: inner.deleteOwnerMessage
      ? async (id) => {
          if (id > 0) await inner.deleteOwnerMessage!(id);
        }
      : undefined,
  };
}
