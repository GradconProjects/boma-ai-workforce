import { redact } from "@boma/core";

/** The subset of the Telegram Bot API we use. Plain text only (no parse_mode) to avoid escaping bugs. */

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type?: string };
  text?: string;
  date?: number;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramApi {
  getUpdates(offset: number, timeoutSeconds: number): Promise<TgUpdate[]>;
  sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<number>;
  editMessage(
    chatId: number,
    messageId: number,
    text: string,
    buttons?: InlineButton[][],
  ): Promise<void>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
}

export class TelegramError extends Error {}

/** Telegram allows 4096 characters per message. */
export const TG_MAX = 4096;
export const clip = (text: string) =>
  text.length > TG_MAX ? `${text.slice(0, TG_MAX - 20)}\n…(truncated)` : text;

/** Real Bot API over HTTPS. The token is only ever placed in the request URL, never logged. */
export class HttpTelegramApi implements TelegramApi {
  private base: string;

  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.base = `https://api.telegram.org/bot${token}`;
  }

  private async call<T>(
    method: string,
    body: Record<string, unknown>,
    timeoutMs = 15_000,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new TelegramError(`Telegram ${method} failed: ${this.scrub((err as Error).message)}`);
    }
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok) {
      throw new TelegramError(
        `Telegram ${method} ${res.status}: ${this.scrub(data.description ?? "unknown error")}`,
      );
    }
    return data.result as T;
  }

  private scrub(text: string): string {
    return redact(text.split(this.token).join("[REDACTED]"));
  }

  getUpdates(offset: number, timeoutSeconds: number): Promise<TgUpdate[]> {
    return this.call(
      "getUpdates",
      { offset, timeout: timeoutSeconds, allowed_updates: ["message", "callback_query"] },
      (timeoutSeconds + 10) * 1000,
    );
  }

  async sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<number> {
    const msg = await this.call<TgMessage>("sendMessage", {
      chat_id: chatId,
      text: clip(text),
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
    return msg.message_id;
  }

  async editMessage(
    chatId: number,
    messageId: number,
    text: string,
    buttons?: InlineButton[][],
  ): Promise<void> {
    await this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: clip(text),
      reply_markup: { inline_keyboard: buttons ?? [] },
    });
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.call("answerCallbackQuery", {
      callback_query_id: callbackId,
      ...(text ? { text } : {}),
    });
  }
}

/** In-memory Telegram for tests and simulation. Records everything sent. */
export class MockTelegramApi implements TelegramApi {
  sent: { chatId: number; messageId: number; text: string; buttons?: InlineButton[][] }[] = [];
  edits: { chatId: number; messageId: number; text: string }[] = [];
  answered: { id: string; text?: string }[] = [];
  queue: TgUpdate[] = [];
  private nextId = 1000;

  async getUpdates(offset: number): Promise<TgUpdate[]> {
    const out = this.queue.filter((u) => u.update_id >= offset);
    this.queue = [];
    return out;
  }
  async sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<number> {
    const messageId = this.nextId++;
    this.sent.push({ chatId, messageId, text, buttons });
    return messageId;
  }
  async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    this.edits.push({ chatId, messageId, text });
  }
  async answerCallback(id: string, text?: string): Promise<void> {
    this.answered.push({ id, text });
  }
  lastText(): string {
    return this.sent.at(-1)?.text ?? "";
  }
}
