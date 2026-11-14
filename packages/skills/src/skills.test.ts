import { deflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoPath, setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { loadRepoSkills } from "./load";
import { parseSkillFile, parseSkillText } from "./parse";
import { isUnlocked, lockSkills, tryUnlock } from "./passcode";
import { buildSkillPrompt } from "./prompt";
import { createRun, finishRun, loadAllSkills, saveImportedSkill, setSkillSettings } from "./repo";
import { selectSections } from "./retrieve";
import { matchSkills } from "./route";
import { readZip } from "./zip";

/** Build a small zip in memory (deflate), the way .skill packages are made. */
function makeZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const repo = loadRepoSkills(repoPath("skills"));

describe("skills engine", () => {
  it("loads all curated skills with their references, none locked by default", () => {
    expect(repo.map((s) => s.fm.slug)).toEqual([
      "advisory-boards",
      "assessment-coach",
      "channel-dna-builder",
      "content-strategist",
      "media-production-planner",
      "referencing-checker",
      "strategic-tacticians",
      "the-council",
      "the-opposer",
    ]);
    expect(repo.every((s) => s.references.length > 0 && s.fm.risk === "standard")).toBe(true);
  });

  it("routes requests to the right skill by trigger phrase or keywords", () => {
    const top = (q: string) => matchSkills(q, repo)[0];
    expect(top("Ask the board: should I open a second OnGroundPM office in Geelong?")?.slug).toBe(
      "advisory-boards",
    );
    expect(top("Can you check my references are right in APA 7?")?.slug).toBe(
      "referencing-checker",
    );
    expect(top("Tear this apart, here is my tender response")?.slug).toBe("the-opposer");
    expect(top("council this: hire a VA or an intern?")?.slug).toBe("the-council");
    expect(top("what would Sun Tzu do about this landlord dispute")?.slug).toBe(
      "strategic-tacticians",
    );
    expect(top("Write a youtube script about interest rates")?.slug).toBe("content-strategist");
    expect(matchSkills("what's the weather tomorrow", repo).filter((m) => m.strong)).toEqual([]);
  });

  it("imports a .skill package and a plain .md, inferring triggers; risk is only suggested", () => {
    const zip = makeZip({
      "natural-medicine/SKILL.md": `---\nname: natural-medicine\ndescription: Herbal remedies and prescriptions. Trigger on "what can I take for", "herbal remedy for".\n---\n# Natural Medicine\nTriage first.`,
      "natural-medicine/references/herbs.md": "# Herbs\nGinger ...",
    });
    expect(readZip(zip).map((e) => e.name)).toContain("natural-medicine/SKILL.md");
    const s = parseSkillFile("natural-medicine.skill", zip);
    expect(s.fm.slug).toBe("natural-medicine");
    expect(s.fm.triggers).toEqual(["what can i take for", "herbal remedy for"]);
    expect(s.fm.risk).toBe("standard"); // the owner labels risk himself
    expect(s.fm.suggested_risk).toBe("high");
    expect(s.fm.safety).toContain("medical_information");
    expect(s.references.map((r) => r.name)).toEqual(["original.md", "herbs.md"]);

    const tact = parseSkillText(
      "---\nname: tactician\ndescription: THE TACTICIANS for any legal dispute, visa case or negotiation.\n---\n# T",
      "tactician",
    );
    expect(tact.fm.suggested_risk).toBe("standard");
    const plain = parseSkillText(
      "# Lead Research Assistant\n\nFinds and qualifies business leads for any company from public sources.",
      "Lead Research Assistant",
    );
    expect(plain.fm.slug).toBe("lead-research-assistant");
    expect(plain.warnings.join()).toMatch(/no trigger phrases/);
  });

  it("sends small references whole and picks relevant sections of large ones", () => {
    const big = {
      name: "big.md",
      text: Array.from(
        { length: 40 },
        (_, i) =>
          `## Section ${i}\n${i === 33 ? "tendering strategy for concrete subcontractors " : "filler text "}${"x".repeat(2000)}`,
      ).join("\n"),
    };
    const picked = selectSections([big], "tendering for concrete", 9000);
    expect(picked.length).toBeLessThan(10);
    expect(picked.some((s) => s.heading === "Section 33")).toBe(true);
    const small = selectSections([{ name: "s.md", text: "# A\nshort" }], "anything");
    expect(small).toHaveLength(1);
  });

  it("wraps every skill in the generalisation and safety layers", () => {
    const skill = repo.find((s) => s.fm.slug === "assessment-coach")!;
    const { system, input } = buildSkillPrompt(
      skill,
      "Help me plan my nursing reflection",
      selectSections(skill.references, "nursing reflection"),
    );
    expect(system).toMatch(/illustration of the method, not a limit on scope/);
    expect(system).toMatch(/no AI-detection evasion/);
    expect(input).toContain("<untrusted_data");
    expect(input.endsWith("Help me plan my nursing reflection")).toBe(true);
    expect(system).toMatch(/Never reply with only questions/);
    const withCtx = buildSkillPrompt(skill, "election video", [], "Workspace: Shadow Aussie Page");
    expect(withCtx.input).toContain("OWNER'S CONTEXT");
    expect(withCtx.input).toContain("Shadow Aussie Page");
  });
});

describe.skipIf(SKIP_DB)("skills storage and passcode", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await setupDb();
  });
  afterAll(async () => fx?.close());

  it("stores imports, refuses to shadow built-ins, and applies the owner's risk labels", async () => {
    const repoSlugs = new Set(repo.map((s) => s.fm.slug));
    const imported = parseSkillText(
      "---\nname: au-legal-guide\ndescription: Australian legal guide for tribunal matters.\n---\n# Guide",
      "au-legal-guide",
    );
    expect((await saveImportedSkill(fx.pool, imported, repoSlugs)).status).toBe("imported");
    expect((await saveImportedSkill(fx.pool, imported, repoSlugs)).status).toBe("updated");
    const dup = parseSkillText(
      "---\nname: the-opposer\ndescription: Opposer copy from Drive.\n---\n# O",
      "the-opposer",
    );
    expect((await saveImportedSkill(fx.pool, dup, repoSlugs)).status).toBe("built_in");

    let all = await loadAllSkills(fx.pool, repo);
    expect(all.find((s) => s.fm.slug === "au-legal-guide")?.fm.risk).toBe("standard");
    await setSkillSettings(fx.pool, "au-legal-guide", { risk: "high" }, false);
    await setSkillSettings(fx.pool, "the-council", { enabled: false }, true);
    all = await loadAllSkills(fx.pool, repo);
    expect(all.find((s) => s.fm.slug === "au-legal-guide")?.fm.risk).toBe("high");
    expect(all.find((s) => s.fm.slug === "the-council")?.fm.enabled).toBe(false);
    expect(all.filter((s) => s.fm.slug === "the-opposer")).toHaveLength(1);
  });

  it("unlocks only with the right passcode, expires, and locks out after repeated failures", async () => {
    const t0 = new Date("2026-11-14T00:00:00Z");
    expect(await tryUnlock(fx.pool, "telegram", "anything", undefined, t0)).toMatchObject({
      ok: false,
      reason: "not_configured",
    });
    expect(await tryUnlock(fx.pool, "telegram", "nope", "secret-123", t0)).toMatchObject({
      ok: false,
      reason: "wrong",
    });
    expect(await tryUnlock(fx.pool, "telegram", "secret-123", "secret-123", t0)).toMatchObject({
      ok: true,
    });
    expect(await isUnlocked(fx.pool, "telegram", new Date(t0.getTime() + 29 * 60_000))).toBe(true);
    expect(await isUnlocked(fx.pool, "telegram", new Date(t0.getTime() + 31 * 60_000))).toBe(false);
    expect(await isUnlocked(fx.pool, "web", t0)).toBe(false); // channels are separate
    await lockSkills(fx.pool);
    expect(await isUnlocked(fx.pool, "telegram", t0)).toBe(false);

    for (let i = 0; i < 4; i++) await tryUnlock(fx.pool, "web", "bad", "secret-123", t0);
    const fifth = await tryUnlock(fx.pool, "web", "bad", "secret-123", t0);
    expect(fifth).toMatchObject({ ok: false, reason: "locked_out" });
    // Even the right passcode is refused while locked out.
    expect(await tryUnlock(fx.pool, "web", "secret-123", "secret-123", t0)).toMatchObject({
      ok: false,
      reason: "locked_out",
    });
    expect(
      await tryUnlock(
        fx.pool,
        "web",
        "secret-123",
        "secret-123",
        new Date(t0.getTime() + 16 * 60_000),
      ),
    ).toMatchObject({ ok: true });
  });

  it("records runs", async () => {
    const id = await createRun(fx.pool, { slug: "the-council", request: "q", channel: "web" });
    await finishRun(fx.pool, id, { output: "verdict", costAud: 0.01 });
    const { rows } = await fx.pool.query("select status, output from skill_runs where id = $1", [
      id,
    ]);
    expect(rows[0]).toEqual({ status: "done", output: "verdict" });
  });
});
