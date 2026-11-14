import type { InlineButton } from "@boma/connectors";

/** How the Chief reaches the owner. Telegram in production; a recorder in tests/simulation. */
export interface Notifier {
  send(text: string, buttons?: InlineButton[][]): Promise<number>;
  edit(messageId: number, text: string): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  private id = 1;
  async send(text: string): Promise<number> {
    console.log(`\n[to owner]\n${text}\n`);
    return this.id++;
  }
  async edit(messageId: number, text: string): Promise<void> {
    console.log(`\n[edit ${messageId}]\n${text}\n`);
  }
}
