"use server";

import { revalidatePath } from "next/cache";
import { audit, setState } from "@boma/core";
import { db, requireOwner } from "@/lib/server";

/**
 * The owner's autopilot switch per workspace: clean, dual-reviewed routine posts are approved
 * automatically for 30 days. Never covers ads or spending.
 */
export async function setAutopilotAction(slug: string, on: boolean): Promise<void> {
  await requireOwner();
  const { rows } = await db().query("select 1 from workspaces where slug = $1", [slug]);
  if (!rows[0]) return;
  const until = new Date(Date.now() + 30 * 86_400_000);
  await setState(
    db(),
    `autopilot:${slug}`,
    on ? { until: until.toISOString(), minScore: 85 } : null,
  );
  await audit(db(), {
    actor: "owner",
    action: on ? "autopilot.on" : "autopilot.off",
    target: slug,
    result: on ? `until ${until.toISOString()}` : "off",
  });
  revalidatePath("/bots");
}
