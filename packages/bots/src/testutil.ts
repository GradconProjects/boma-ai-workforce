import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { parseBotFile } from "./load";
import type { BotDefinition } from "./schema";

export const ROOT = new URL("../../../", import.meta.url);

export function readRepoFile(rel: string): string {
  return readFileSync(new URL(rel, ROOT), "utf8");
}

/** Load a real bot file, apply a frontmatter change, and re-parse it. */
export function variant(
  rel: string,
  mutate: (fm: Record<string, any>) => void,
  extraBody = "",
): BotDefinition {
  const raw = readRepoFile(rel);
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)!;
  const fm = parse(m[1]!);
  mutate(fm);
  return parseBotFile(`---\n${stringify(fm)}---\n${m[2]}${extraBody}`);
}
