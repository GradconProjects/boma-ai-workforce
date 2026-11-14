"use server";

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { audit } from "@boma/core";
import {
  deleteImportedSkill,
  dispatchSkill,
  isUnlocked,
  loadAllSkills,
  loadRepoSkills,
  lockSkills,
  parseSkillFile,
  saveImportedSkill,
  setSkillSettings,
  tryUnlock,
  type ImportOutcome,
} from "@boma/skills";
import { cronTick } from "@boma/worker/hosted";
import { runtime } from "@/lib/runtime";
import { db, env, policy, requireOwner, ROOT } from "@/lib/server";

const repoSkills = () => loadRepoSkills(join(ROOT, "skills"));
const allSkills = () => loadAllSkills(db(), repoSkills());

/** Run queued work now instead of waiting for the next minute's cron. */
export async function kickWorker(ms = 55_000): Promise<void> {
  after(async () => {
    try {
      await cronTick(await runtime(), ms);
    } catch (err) {
      console.error("worker kick failed:", (err as Error).message);
    }
  });
}

export async function importSkillsAction(
  _: unknown,
  form: FormData,
): Promise<{ results: (ImportOutcome & { file: string; error?: string })[] }> {
  await requireOwner();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const repoSlugs = new Set(repoSkills().map((s) => s.fm.slug));
  const results = [];
  for (const f of files.slice(0, 100)) {
    try {
      if (f.size > 5_000_000) throw new Error("larger than 5 MB");
      const skill = parseSkillFile(f.name, Buffer.from(await f.arrayBuffer()));
      const r = await saveImportedSkill(db(), skill, repoSlugs);
      results.push({ ...r, file: f.name });
    } catch (err) {
      results.push({
        slug: "",
        status: "built_in" as const,
        warnings: [],
        file: f.name,
        error: (err as Error).message,
      });
    }
  }
  await audit(db(), {
    actor: "owner",
    action: "skills.import",
    inputs: results.map((r) => r.file).join(", "),
    result: `${results.filter((r) => !r.error).length} ok`,
  });
  revalidatePath("/skills");
  return { results };
}

/** The owner's risk label / on-off switch. Removing a high-risk label needs the passcode session. */
export async function setSkillAction(
  slug: string,
  patch: { risk?: "standard" | "high"; enabled?: boolean },
): Promise<{ error?: string }> {
  await requireOwner();
  const skill = (await allSkills()).find((s) => s.fm.slug === slug);
  if (!skill) return { error: "That skill no longer exists." };
  if (
    patch.risk === "standard" &&
    skill.fm.risk === "high" &&
    env().SKILLS_PASSCODE &&
    !(await isUnlocked(db(), "web"))
  ) {
    return { error: "Unlock with your passcode first to remove a high-risk label." };
  }
  await setSkillSettings(db(), slug, patch, skill.source === "repo");
  await audit(db(), {
    actor: "owner",
    action: "skills.settings",
    target: slug,
    inputs: patch,
    result: "saved",
  });
  revalidatePath("/skills");
  return {};
}

export async function deleteSkillAction(slug: string): Promise<void> {
  await requireOwner();
  await deleteImportedSkill(db(), slug);
  await audit(db(), { actor: "owner", action: "skills.delete", target: slug, result: "deleted" });
  revalidatePath("/skills");
}

export async function unlockAction(
  _: unknown,
  form: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireOwner();
  await new Promise((r) => setTimeout(r, 300));
  const r = await tryUnlock(db(), "web", String(form.get("passcode") ?? ""), env().SKILLS_PASSCODE);
  revalidatePath("/skills");
  if (r.ok) return { ok: true };
  return {
    error: {
      not_configured: "SKILLS_PASSCODE isn't set in the environment.",
      wrong: "That passcode isn't right.",
      locked_out: "Too many wrong attempts. Try again in 15 minutes.",
    }[r.reason],
  };
}

export async function lockAction(): Promise<void> {
  await requireOwner();
  await lockSkills(db(), "web");
  revalidatePath("/skills");
}

export async function runSkillAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  await requireOwner();
  const slug = String(form.get("slug") ?? "");
  const request = String(form.get("request") ?? "")
    .trim()
    .slice(0, 20_000);
  const key = String(form.get("key") ?? randomUUID());
  const skill = (await allSkills()).find((s) => s.fm.slug === slug);
  if (!skill) return { error: "Pick a skill." };
  if (request.length < 3) return { error: "Tell the skill what you need." };
  const r = await dispatchSkill(db(), policy(), {
    skill,
    request,
    channel: "web",
    idempotencyKey: `web:skill:${key}`,
    actor: "owner",
  });
  if (!r.ok) return { error: r.message };
  await kickWorker();
  redirect(`/skills/runs/${r.runId}`);
}
