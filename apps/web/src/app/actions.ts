"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decideApproval, getApproval } from "@boma/core";
import { FORMATS, TEMPLATES, type Design, type TemplateId } from "@boma/design-engine";
import {
  createCampaign,
  createDesign,
  deleteDesign,
  requestCampaignCopy,
  restoreVersion,
  saveBrand,
  saveDesign,
  StaleRevisionError,
  syncItemStatusesFromApprovals,
} from "@boma/studio";
import { checkPassword, db, endSession, policy, requireOwner, startSession } from "@/lib/server";

// ───────────── session ─────────────

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const password = String(form.get("password") ?? "");
  // Small constant delay blunts password guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(password)) return { error: "That password isn't right." };
  await startSession();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

// ───────────── designs ─────────────

const isTemplate = (t: string): t is TemplateId => TEMPLATES.some((x) => x.id === t);

export async function createDesignAction(form: FormData): Promise<void> {
  await requireOwner();
  const brandId = String(form.get("brandId"));
  const formatId = String(form.get("formatId"));
  const template = String(form.get("template"));
  if (!FORMATS.some((f) => f.id === formatId) || !isTemplate(template))
    throw new Error("Invalid format or template");
  const d = await createDesign(db(), { brandId, formatId, template, actor: "owner" });
  redirect(`/studio/${d.id}`);
}

export type SaveResult =
  { ok: true; revision: number } | { ok: false; conflict: boolean; error: string };

export async function saveDesignAction(o: {
  id: string;
  doc: Design;
  baseRevision: number;
  title?: string;
  note?: string;
  snapshot?: boolean;
}): Promise<SaveResult> {
  await requireOwner();
  try {
    const d = await saveDesign(db(), {
      id: o.id,
      doc: o.doc,
      baseRevision: o.baseRevision,
      title: o.title,
      note: o.note ?? "edited",
      snapshot: o.snapshot ?? false,
      actor: "owner",
    });
    return { ok: true, revision: d.revision };
  } catch (err) {
    if (err instanceof StaleRevisionError) return { ok: false, conflict: true, error: err.message };
    return { ok: false, conflict: false, error: (err as Error).message };
  }
}

export async function restoreVersionAction(designId: string, revision: number): Promise<void> {
  await requireOwner();
  await restoreVersion(db(), designId, revision, "owner");
  revalidatePath(`/studio/${designId}`);
}

export async function deleteDesignAction(designId: string): Promise<void> {
  await requireOwner();
  await deleteDesign(db(), designId);
  redirect("/studio");
}

// ───────────── campaigns ─────────────

export async function createCampaignAction(
  _: unknown,
  form: FormData,
): Promise<{ error?: string }> {
  await requireOwner();
  const name = String(form.get("name") ?? "").trim();
  const objective = String(form.get("objective") ?? "").trim();
  if (!name || !objective) return { error: "Give the campaign a name and an objective." };
  const deliverables = form
    .getAll("deliverable")
    .map(String)
    .map((v) => {
      const [formatId, template] = v.split(":");
      return { formatId: formatId!, template: template as TemplateId };
    })
    .filter((d) => FORMATS.some((f) => f.id === d.formatId) && isTemplate(d.template));
  if (!deliverables.length) return { error: "Pick at least one deliverable." };
  const c = await createCampaign(db(), {
    brandId: String(form.get("brandId")),
    name,
    objective,
    audience: String(form.get("audience") ?? "").trim(),
    cta: String(form.get("cta") ?? "").trim(),
    channels: form.getAll("channel").map(String),
    deliverables,
    actor: "owner",
  });
  if (form.get("askChief") === "on") {
    await requestCampaignCopy(db(), policy(), { campaignId: c.id, actor: "owner" });
  }
  redirect(`/campaigns/${c.id}`);
}

export async function requestCopyAction(o: {
  campaignId: string;
  itemIds?: string[];
  notes?: string;
}): Promise<{ ok: boolean; message: string }> {
  await requireOwner();
  const r = await requestCampaignCopy(db(), policy(), { ...o, actor: "owner" });
  revalidatePath(`/campaigns/${o.campaignId}`);
  return r.ok
    ? {
        ok: true,
        message: `The Chief is writing ${r.queued} piece${r.queued === 1 ? "" : "s"} of copy. Each one is checked by Claude and OpenAI before it comes back.`,
      }
    : { ok: false, message: r.reason };
}

// ───────────── approvals ─────────────

export async function decideApprovalAction(
  approvalId: string,
  decision: "approved" | "rejected",
): Promise<{ message: string }> {
  await requireOwner();
  const a = await getApproval(db(), approvalId);
  if (!a) return { message: "That approval no longer exists." };
  const result = await decideApproval(db(), approvalId, decision);
  await syncItemStatusesFromApprovals(db());
  revalidatePath("/approvals");
  revalidatePath("/campaigns", "layout");
  revalidatePath("/");
  return {
    message: {
      approved: "Approved.",
      rejected: "Rejected.",
      expired: "It had expired.",
      already_decided: `Already ${a.status}.`,
      not_found: "Not found.",
    }[result],
  };
}

// ───────────── brands ─────────────

export async function saveBrandAction(
  _: unknown,
  form: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireOwner();
  const hex = (k: string) => {
    const v = String(form.get(k) ?? "");
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${k} must be a #RRGGBB colour`);
    return v;
  };
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "A brand needs a name." };
  try {
    await saveBrand(db(), (form.get("id") as string) || null, {
      name,
      tagline: String(form.get("tagline") ?? "").trim(),
      industry: String(form.get("industry") ?? "").trim(),
      audience: String(form.get("audience") ?? "").trim(),
      tone: String(form.get("tone") ?? "").trim(),
      primary: hex("primary"),
      secondary: hex("secondary"),
      accent: hex("accent"),
      logoText: String(form.get("logoText") ?? "")
        .trim()
        .slice(0, 3),
      website: String(form.get("website") ?? "").trim(),
      features: String(form.get("features") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
      headingFont: String(form.get("headingFont") ?? "Manrope"),
      bodyFont: String(form.get("bodyFont") ?? "DM Sans"),
      image: String(form.get("image") ?? "") || undefined,
    });
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath("/brands");
  return { ok: true };
}
