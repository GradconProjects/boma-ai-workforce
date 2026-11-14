import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { botFrontmatterSchema, type BotDefinition } from "./schema";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export class BotFileError extends Error {}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Parse and validate one bot file's text. Throws BotFileError with readable issues. */
export function parseBotFile(raw: string, path = "<memory>"): BotDefinition {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) throw new BotFileError(`${path}: missing YAML frontmatter (--- ... ---)`);
  let data: unknown;
  try {
    data = parse(m[1] ?? "");
  } catch (err) {
    throw new BotFileError(`${path}: invalid YAML: ${(err as Error).message}`);
  }
  const result = botFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new BotFileError(`${path}: invalid bot settings:\n${issues.join("\n")}`);
  }
  const fileName = basename(path, ".md");
  if (path !== "<memory>" && result.data.slug !== fileName) {
    throw new BotFileError(`${path}: slug "${result.data.slug}" must match file name "${fileName}"`);
  }
  return {
    frontmatter: result.data,
    instructions: (m[2] ?? "").trim(),
    raw,
    fileSha: sha256(raw),
    path,
  };
}

/** Bot files in a directory. Files starting with "_" (templates) are skipped. */
export function listBotFiles(dir = "bots"): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort()
    .map((f) => join(dir, f));
}

export function loadBotFile(path: string): BotDefinition {
  return parseBotFile(readFileSync(path, "utf8"), path);
}
