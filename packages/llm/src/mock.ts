import type { LlmProvider, LlmRequest, ProviderName, RawResult, StopReason } from "./types";

export interface MockReply {
  text?: string;
  json?: unknown;
  usage?: { inputTokens: number; outputTokens: number };
  stopReason?: StopReason;
  error?: Error;
}

export type MockHandler = (
  req: LlmRequest<unknown>,
  callIndex: number,
) => MockReply | Promise<MockReply>;

/** Scripted provider for tests and simulation mode. Never touches the network. */
export class MockProvider implements LlmProvider {
  readonly calls: LlmRequest<unknown>[] = [];

  constructor(
    readonly name: ProviderName,
    private handler: MockHandler,
  ) {}

  setHandler(handler: MockHandler) {
    this.handler = handler;
  }

  async complete(req: LlmRequest<unknown>): Promise<RawResult> {
    this.calls.push(req);
    const reply = await this.handler(req, this.calls.length - 1);
    if (reply.error) throw reply.error;
    return {
      text: reply.text ?? JSON.stringify(reply.json ?? {}),
      model: req.model,
      usage: reply.usage ?? { inputTokens: 500, outputTokens: 200 },
      stopReason: reply.stopReason ?? "end",
    };
  }
}
