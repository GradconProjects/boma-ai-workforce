"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@boma/core";
import { db, requireOwner } from "@/lib/server";

/** The owner can delete anything he no longer wants. Every delete is audited. */

const UUID = /^[0-9a-f-]{36}$/i;

export async function deleteSkillRunAction(id: string): Promise<void> {
  await requireOwner();
  if (!UUID.test(id)) return;
  await db().query("delete from skill_runs where id = $1", [id]);
  await audit(db(), { actor: "owner", action: "skill_run.delete", target: id, result: "deleted" });
  revalidatePath("/skills");
  redirect("/skills");
}

export async function deleteCampaignAction(id: string): Promise<void> {
  await requireOwner();
  if (!UUID.test(id)) return;
  // Its deliverable designs go with it; approvals and published records stay in the audit trail.
  const { rows } = await db().query<{ design_id: string }>(
    "select design_id from campaign_items where campaign_id = $1",
    [id],
  );
  await db().query("delete from campaigns where id = $1", [id]);
  if (rows.length) {
    await db().query(
      "delete from designs where id = any($1::uuid[]) and not exists (select 1 from campaign_items ci where ci.design_id = designs.id)",
      [rows.map((r) => r.design_id)],
    );
  }
  await audit(db(), { actor: "owner", action: "campaign.delete", target: id, result: "deleted" });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

/**
 * Workspaces the owner created in chat. One with no work history is removed; one that has
 * history is retired (hidden from the Chief) so that history stays intact.
 */
export async function deleteWorkspaceAction(slug: string): Promise<{ result: string }> {
  await requireOwner();
  const { rows } = await db().query<{ id: string; owner_added: boolean }>(
    "select id, owner_added from workspaces where slug = $1",
    [slug],
  );
  const ws = rows[0];
  if (!ws) return { result: "Not found." };
  if (!ws.owner_added)
    return { result: "Built-in workspaces are changed in config/workspaces.yaml." };
  try {
    await db().query("delete from workspaces where id = $1", [ws.id]);
    await audit(db(), {
      actor: "owner",
      action: "workspace.delete",
      target: slug,
      result: "deleted",
    });
    revalidatePath("/bots");
    return { result: "Deleted." };
  } catch {
    await db().query("update workspaces set owner_added = false where id = $1", [ws.id]);
    await audit(db(), {
      actor: "owner",
      action: "workspace.retire",
      target: slug,
      result: "retired",
    });
    revalidatePath("/bots");
    return { result: "Retired: it has work history, so it's hidden instead of erased." };
  }
}

export async function deleteBlogPostAction(id: string, ws: string): Promise<void> {
  await requireOwner();
  if (!UUID.test(id) || !/^[a-z0-9-]+$/.test(ws)) return;
  await db().query("delete from blog_posts where id = $1", [id]);
  await audit(db(), { actor: "owner", action: "blog.delete", target: id, result: "deleted" });
  revalidatePath(`/blog/${ws}`);
  redirect(`/blog/${ws}`);
}
