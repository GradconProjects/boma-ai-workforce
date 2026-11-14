import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPolicy } from "@boma/core";
import { lintBot } from "./lint";
import { BotFileError, listBotFiles, loadBotFile, parseBotFile } from "./load";
import { ROOT, readRepoFile } from "./testutil";

const botsDir = fileURLToPath(new URL("bots", ROOT));
const policy = loadPolicy(fileURLToPath(new URL("config/policy.yaml", ROOT)));

describe("G0.3 bot files load and validate", () => {
  it("finds the Release 1 bots and skips the template", () => {
    const slugs = listBotFiles(botsDir).map((p) => loadBotFile(p).frontmatter.slug);
    expect(slugs).toEqual(["chief-of-staff", "facebook-page-poster"]);
  });

  it.each(["chief-of-staff", "facebook-page-poster"])("%s loads and passes lint", (slug) => {
    const bot = loadBotFile(`${botsDir}/${slug}.md`);
    expect(bot.frontmatter.slug).toBe(slug);
    expect(bot.instructions.length).toBeGreaterThan(50);
    expect(bot.fileSha).toMatch(/^[0-9a-f]{64}$/);
    expect(lintBot(bot, { policy })).toEqual({ ok: true, errors: [] });
  });

  it("the template itself is a valid bot file", () => {
    expect(parseBotFile(readRepoFile("bots/_TEMPLATE.md")).frontmatter.enabled).toBe(false);
  });

  it("parses publisher settings", () => {
    const poster = loadBotFile(`${botsDir}/facebook-page-poster.md`).frontmatter;
    expect(poster.posting_window).toEqual({ start: "07:00", end: "21:00", tz: "Australia/Sydney" });
    expect(poster.daily_post_limit).toBe(3);
  });

  it("rejects unknown fields, bad levels and missing frontmatter", () => {
    expect(() => parseBotFile("no frontmatter")).toThrow(BotFileError);
    const raw = readRepoFile("bots/chief-of-staff.md");
    expect(() => parseBotFile(raw.replace("enabled: true", "enabled: true\nsuperpowers: true"))).toThrow(
      /superpowers/,
    );
    expect(() => parseBotFile(raw.replace("message_owner: 5", "message_owner: 6"))).toThrow(
      /actions\.message_owner/,
    );
  });

  it("rejects a hard-coded model ID in place of an env key", () => {
    const raw = readRepoFile("bots/chief-of-staff.md").replace(
      "model_env: ANTHROPIC_MODEL_CHEAP",
      "model_env: claude-haiku-5-5",
    );
    expect(() => parseBotFile(raw)).toThrow(/model_env/);
  });
});
