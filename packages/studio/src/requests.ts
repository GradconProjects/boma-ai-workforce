import {
  budgetStatus,
  createTask,
  decide,
  isPaused,
  type Policy,
  type Queryable,
} from "@boma/core";
import { getFormat } from "@boma/design-engine";
import { loadBotSettings } from "@boma/bots";
import { getCampaign, setItemTask } from "./repo";

/** Rough A$ cost of one copy task (maker + checker), for the budget pre-check. */
export const COPY_TASK_ESTIMATE_AUD = 0.06;

export type CopyRequestResult = { ok: true; queued: number } | { ok: false; reason: string };

/**
 * Ask the Chief to write copy for campaign deliverables. Goes through the same policy and budget
 * checks as a Telegram request; the worker then runs the dual review and requests approval.
 */
export async function requestCampaignCopy(
  db: Queryable,
  policy: Policy,
  o: { campaignId: string; itemIds?: string[]; notes?: string; actor: string },
): Promise<CopyRequestResult> {
  const { campaign, items } = await getCampaign(db, o.campaignId);
  const targets = items.filter(
    (i) => (o.itemIds ? o.itemIds.includes(i.id) : true) && i.copy_status !== "drafting",
  );
  if (!targets.length)
    return { ok: false, reason: "Nothing to write: those deliverables are already being drafted." };

  const chief = await loadBotSettings(db, "chief-of-staff");
  const decision = decide({
    policy,
    bot: {
      slug: chief.slug,
      workspaces: chief.frontmatter.workspaces,
      accounts: chief.frontmatter.accounts,
      actions: chief.frontmatter.actions,
    },
    action: "draft_post_text",
    effect: "internal",
    paused: await isPaused(db),
  });
  if (!decision.allowed) return { ok: false, reason: decision.reason };

  const budget = await budgetStatus(db, policy);
  const estimate = targets.length * COPY_TASK_ESTIMATE_AUD;
  if (budget.spentAud + estimate > budget.hardStopAud) {
    return {
      ok: false,
      reason: `Budget: needs about A$${estimate.toFixed(2)}, only A$${Math.max(0, budget.hardStopAud - budget.spentAud).toFixed(2)} left this month.`,
    };
  }

  const stamp = Date.now();
  for (const item of targets) {
    const format = getFormat(item.design.format_id);
    const { task } = await createTask(db, {
      bot: "chief-of-staff",
      kind: "draft_creative",
      inputs: {
        campaign_item_id: item.id,
        brand_id: campaign.brand_id,
        format_title: format.title,
        channel: format.subtitle,
        objective: campaign.objective,
        audience: campaign.audience,
        cta: campaign.cta,
        owner_notes: o.notes ?? null,
      },
      idempotencyKey: `copy:${item.id}:${stamp}`,
      estCostAud: COPY_TASK_ESTIMATE_AUD,
      actor: o.actor,
    });
    await setItemTask(db, item.id, task.id);
  }
  return { ok: true, queued: targets.length };
}
