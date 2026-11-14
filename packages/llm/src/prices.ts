import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { UnpricedModelError, type ProviderName } from "./types";

const price = z.object({ input: z.number().min(0), output: z.number().min(0) }).strict();
const pricesSchema = z.object({
  anthropic: z.record(z.string(), price).default({}),
  openai: z.record(z.string(), price).nullable().default({}),
});

export type ModelPrice = z.infer<typeof price>;

export class PriceTable {
  constructor(private table: Record<ProviderName, Record<string, ModelPrice>>) {}

  static load(path = "config/prices.yaml"): PriceTable {
    const parsed = pricesSchema.parse(parse(readFileSync(path, "utf8")) ?? {});
    return new PriceTable({ anthropic: parsed.anthropic, openai: parsed.openai ?? {} });
  }

  get(provider: ProviderName, model: string): ModelPrice {
    const p = this.table[provider]?.[model];
    if (!p) {
      throw new UnpricedModelError(
        `No price for ${provider}/${model} in config/prices.yaml; refusing to call it`,
      );
    }
    return p;
  }

  /** Cost in AUD for a number of tokens. */
  costAud(
    provider: ProviderName,
    model: string,
    tokensIn: number,
    tokensOut: number,
    fx: number,
  ): number {
    const p = this.get(provider, model);
    return ((tokensIn * p.input + tokensOut * p.output) / 1_000_000) * fx;
  }
}

/** Conservative input-token estimate (real tokenisers average ~4 chars/token for English). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3) + 50;
}
