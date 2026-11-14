import { audit, getState, setState, type Queryable } from "@boma/core";
import type { InlineButton, TelegramApi, TgUpdate } from "./api";

/**
 * Owner-only Telegram channel (spec §5, §9). Messages and button presses from anyone except the
 * owner's numeric user ID are ignored and logged (C2). Update offsets are persisted so a restart
 * never processes the same update twice.
 */

export type ApprovalAction = "approve" | "reject" | "edit";

export interface OwnerHandlers {
  onMessage(text: string, messageId: number): Promise<void>;
  onApprovalButton(approvalId: string, action: ApprovalAction): Promise<string>;
}

export const approvalButtons = (approvalId: string): InlineButton[][] => [
  [
    { text: "✅ Approve", callback_data: `appr:${approvalId}:approve` },
    { text: "✏️ Edit", callback_data: `appr:${approvalId}:edit` },
    { text: "❌ Reject", callback_data: `appr:${approvalId}:reject` },
  ],
];

const CALLBACK_RE = /^appr:([0-9a-f-]{36}):(approve|reject|edit)$/;

export class TelegramGateway {
  constructor(
    private api: TelegramApi,
    private db: Queryable,
    private ownerId: number,
    private handlers: OwnerHandlers,
  ) {}

  /** Send a message to the owner (the owner's private chat ID equals their user ID). */
  sendToOwner(text: string, buttons?: InlineButton[][]): Promise<number> {
    return this.api.sendMessage(this.ownerId, text, buttons);
  }

  editOwnerMessage(messageId: number, text: string): Promise<void> {
    return this.api.editMessage(this.ownerId, messageId, text);
  }

  /** One long-poll cycle. Returns the number of updates handled. */
  async pollOnce(timeoutSeconds = 25): Promise<number> {
    const offset = (await getState<number>(this.db, "telegram_offset")) ?? 0;
    const updates = await this.api.getUpdates(offset, timeoutSeconds);
    let handled = 0;
    for (const u of updates.sort((a, b) => a.update_id - b.update_id)) {
      if (u.update_id < offset) continue;
      // Advance the offset first: a poison update must not be retried forever.
      await setState(this.db, "telegram_offset", u.update_id + 1);
      await this.handle(u);
      handled++;
    }
    return handled;
  }

  async handle(u: TgUpdate): Promise<void> {
    const from = u.message?.from ?? u.callback_query?.from;
    if (!from || from.id !== this.ownerId) {
      await audit(this.db, {
        actor: `telegram:${from?.id ?? "unknown"}`,
        action: "telegram.ignored_non_owner",
        inputs: u,
        result: "ignored",
      });
      return; // never reply: don't confirm the bot exists to strangers
    }

    if (u.message?.text) {
      await this.handlers.onMessage(u.message.text.trim(), u.message.message_id);
      return;
    }

    const cb = u.callback_query;
    if (cb) {
      const m = CALLBACK_RE.exec(cb.data ?? "");
      if (!m) {
        await this.api.answerCallback(cb.id, "Unknown button");
        return;
      }
      const reply = await this.handlers.onApprovalButton(m[1]!, m[2] as ApprovalAction);
      await this.api.answerCallback(cb.id, reply.slice(0, 190));
    }
  }
}
