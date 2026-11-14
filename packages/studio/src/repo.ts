import { audit, withTx, type Queryable } from "@boma/core";
import {
  applyCopy,
  buildDesign,
  designSchema,
  getFormat,
  type Brand,
  type Copy,
  type Design,
  type TemplateId,
} from "@boma/design-engine";
import { STARTER_BRANDS } from "./seed";

/** Data access for the Creative Studio. Shared by the web app (owner actions) and the worker (Chief). */

export interface BrandRow {
  id: string;
  slug: string;
  workspace: string | null;
  brand: Brand & { image?: string };
}

export interface DesignRow {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  title: string;
  format_id: string;
  template_id: string;
  doc: Design;
  revision: number;
  updated_at: Date;
}

export interface CampaignRow {
  id: string;
  brand_id: string;
  name: string;
  objective: string;
  audience: string;
  cta: string;
  channels: string[];
  status: "draft" | "in_production" | "ready" | "archived";
  created_at: Date;
}

export interface CampaignItemRow {
  id: string;
  campaign_id: string;
  design_id: string;
  position: number;
  task_id: string | null;
  copy: Copy | null;
  copy_status:
    | "none"
    | "drafting"
    | "awaiting_approval"
    | "approved"
    | "rejected"
    | "failed"
    | "needs_decision";
  simulated: boolean;
  design: DesignRow;
  approval_id: string | null;
  task_error: string | null;
}

const brandSelect = `select b.id, b.slug, w.slug as workspace, b.data from brands b left join workspaces w on w.id = b.workspace_id`;
const toBrandRow = (r: {
  id: string;
  slug: string;
  workspace: string | null;
  data: Brand;
}): BrandRow => ({
  id: r.id,
  slug: r.slug,
  workspace: r.workspace,
  brand: { ...r.data, id: r.id },
});

export async function seedBrands(db: Queryable): Promise<void> {
  for (const b of STARTER_BRANDS) {
    const { workspace, id: slug, ...data } = b;
    await db.query(
      `insert into brands (slug, workspace_id, data)
       values ($1, (select id from workspaces where slug = $2), $3)
       on conflict (slug) do nothing`,
      [slug, workspace, { ...data, id: slug }],
    );
  }
}

export async function listBrands(db: Queryable): Promise<BrandRow[]> {
  const { rows } = await db.query(`${brandSelect} order by b.created_at`);
  return rows.map(toBrandRow);
}

export async function getBrand(db: Queryable, id: string): Promise<BrandRow> {
  const { rows } = await db.query(`${brandSelect} where b.id = $1`, [id]);
  if (!rows[0]) throw new Error("Brand not found");
  return toBrandRow(rows[0]);
}

export async function saveBrand(
  db: Queryable,
  id: string | null,
  data: Omit<Brand, "id"> & { image?: string },
): Promise<string> {
  if (id) {
    await db.query("update brands set data = $2, updated_at = now() where id = $1", [id, data]);
    return id;
  }
  const slug =
    data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "brand";
  const { rows } = await db.query<{ id: string }>(
    "insert into brands (slug, data) values ($1 || '-' || substr(md5(random()::text), 1, 5), $2) returning id",
    [slug, data],
  );
  return rows[0]!.id;
}

// ───────────── designs ─────────────

export async function createDesign(
  db: Queryable,
  o: {
    brandId: string;
    formatId: string;
    template: TemplateId;
    title?: string;
    copy?: Copy;
    imageUrl?: string | null;
    campaignId?: string | null;
    actor: string;
  },
): Promise<DesignRow> {
  const { brand } = await getBrand(db, o.brandId);
  const format = getFormat(o.formatId);
  const imageUrl = o.imageUrl === undefined ? (brand.image ?? null) : o.imageUrl;
  const doc = buildDesign({ template: o.template, format, brand, copy: o.copy, imageUrl });
  const title = o.title ?? `${format.title} · ${brand.name}`;
  return withTx(db, async (c) => {
    const { rows } = await c.query<DesignRow>(
      `insert into designs (brand_id, campaign_id, title, format_id, template_id, doc) values ($1, $2, $3, $4, $5, $6) returning *`,
      [o.brandId, o.campaignId ?? null, title, o.formatId, o.template, doc],
    );
    const d = rows[0]!;
    await c.query(
      "insert into design_versions (design_id, revision, doc, note, actor) values ($1, 1, $2, 'created', $3)",
      [d.id, doc, o.actor],
    );
    return d;
  });
}

export async function getDesign(db: Queryable, id: string): Promise<DesignRow> {
  const { rows } = await db.query<DesignRow>(
    "select * from designs where id = $1 and deleted_at is null",
    [id],
  );
  if (!rows[0]) throw new Error("Design not found");
  return rows[0];
}

export async function listDesigns(
  db: Queryable,
  opts: { brandId?: string; limit?: number } = {},
): Promise<DesignRow[]> {
  const { rows } = await db.query<DesignRow>(
    `select * from designs where deleted_at is null and ($1::uuid is null or brand_id = $1)
      order by updated_at desc limit $2`,
    [opts.brandId ?? null, opts.limit ?? 60],
  );
  return rows;
}

export class StaleRevisionError extends Error {}

/**
 * Save a design. Optimistic concurrency: the caller sends the revision it edited; if someone
 * (e.g. the Chief applying copy) saved since, the save is refused instead of overwriting.
 */
export async function saveDesign(
  db: Queryable,
  o: {
    id: string;
    doc: unknown;
    baseRevision: number;
    title?: string;
    note: string;
    actor: string;
    snapshot?: boolean;
  },
): Promise<DesignRow> {
  const doc = designSchema.parse(o.doc);
  return withTx(db, async (c) => {
    const { rows } = await c.query<DesignRow>(
      `update designs set doc = $2, revision = revision + 1, title = coalesce($4, title), updated_at = now()
        where id = $1 and revision = $3 and deleted_at is null returning *`,
      [o.id, doc, o.baseRevision, o.title ?? null],
    );
    const d = rows[0];
    if (!d)
      throw new StaleRevisionError(
        "This design changed since you opened it. Reload to get the latest version.",
      );
    if (o.snapshot !== false) {
      await c.query(
        "insert into design_versions (design_id, revision, doc, note, actor) values ($1, $2, $3, $4, $5)",
        [d.id, d.revision, doc, o.note, o.actor],
      );
    }
    return d;
  });
}

export async function listVersions(db: Queryable, designId: string) {
  const { rows } = await db.query<{
    revision: number;
    note: string;
    actor: string;
    created_at: Date;
  }>(
    "select revision, note, actor, created_at from design_versions where design_id = $1 order by revision desc limit 50",
    [designId],
  );
  return rows;
}

export async function restoreVersion(
  db: Queryable,
  designId: string,
  revision: number,
  actor: string,
): Promise<DesignRow> {
  const { rows } = await db.query<{ doc: Design }>(
    "select doc from design_versions where design_id = $1 and revision = $2",
    [designId, revision],
  );
  if (!rows[0]) throw new Error("Version not found");
  const current = await getDesign(db, designId);
  return saveDesign(db, {
    id: designId,
    doc: rows[0].doc,
    baseRevision: current.revision,
    note: `restored revision ${revision}`,
    actor,
  });
}

export async function deleteDesign(db: Queryable, id: string): Promise<void> {
  await db.query("update designs set deleted_at = now() where id = $1", [id]);
}

// ───────────── campaigns ─────────────

export const CAMPAIGN_DELIVERABLES: { formatId: string; template: TemplateId }[] = [
  { formatId: "social-portrait", template: "editorial" },
  { formatId: "social-square", template: "bold" },
  { formatId: "story", template: "editorial" },
  { formatId: "ad-landscape", template: "split" },
  { formatId: "flyer-a4", template: "editorial" },
];

export async function createCampaign(
  db: Queryable,
  o: {
    brandId: string;
    name: string;
    objective: string;
    audience: string;
    cta: string;
    channels: string[];
    deliverables?: { formatId: string; template: TemplateId }[];
    actor: string;
  },
): Promise<CampaignRow> {
  const { rows } = await db.query<CampaignRow>(
    `insert into campaigns (brand_id, name, objective, audience, cta, channels) values ($1, $2, $3, $4, $5, $6) returning *`,
    [o.brandId, o.name, o.objective, o.audience, o.cta, o.channels],
  );
  const campaign = rows[0]!;
  const list = o.deliverables ?? CAMPAIGN_DELIVERABLES;
  for (const [i, d] of list.entries()) {
    const design = await createDesign(db, {
      brandId: o.brandId,
      formatId: d.formatId,
      template: d.template,
      campaignId: campaign.id,
      title: `${o.name} · ${getFormat(d.formatId).title}`,
      copy: o.cta ? { cta: o.cta } : undefined,
      actor: o.actor,
    });
    await db.query(
      "insert into campaign_items (campaign_id, design_id, position) values ($1, $2, $3)",
      [campaign.id, design.id, i],
    );
  }
  await audit(db, {
    actor: o.actor,
    action: "campaign.create",
    target: `campaign:${campaign.id}`,
    inputs: o,
    result: "ok",
  });
  return campaign;
}

export async function listCampaigns(db: Queryable) {
  const { rows } = await db.query<
    CampaignRow & { brand_name: string; items: number; approved: number }
  >(
    `select c.*, b.data->>'name' as brand_name,
            (select count(*)::int from campaign_items i where i.campaign_id = c.id) as items,
            (select count(*)::int from campaign_items i where i.campaign_id = c.id and i.copy_status = 'approved') as approved
       from campaigns c join brands b on b.id = c.brand_id
      where c.status <> 'archived' order by c.created_at desc`,
  );
  return rows;
}

export async function getCampaign(
  db: Queryable,
  id: string,
): Promise<{ campaign: CampaignRow; items: CampaignItemRow[] }> {
  const c = await db.query<CampaignRow>("select * from campaigns where id = $1", [id]);
  if (!c.rows[0]) throw new Error("Campaign not found");
  const { rows } = await db.query(
    `select i.*, row_to_json(d.*) as design, t.approval_id, t.last_error as task_error
       from campaign_items i join designs d on d.id = i.design_id left join tasks t on t.id = i.task_id
      where i.campaign_id = $1 order by i.position`,
    [id],
  );
  return { campaign: c.rows[0], items: rows as CampaignItemRow[] };
}

export async function setItemTask(db: Queryable, itemId: string, taskId: string): Promise<void> {
  await db.query("update campaign_items set task_id = $2, copy_status = 'drafting' where id = $1", [
    itemId,
    taskId,
  ]);
}

/** Called by the worker when the Chief's copy is ready: store it and apply it to the design. */
export async function applyItemCopy(
  db: Queryable,
  o: {
    itemId: string;
    copy: Copy;
    status: CampaignItemRow["copy_status"];
    simulated: boolean;
    actor: string;
  },
): Promise<void> {
  const { rows } = await db.query<{ design_id: string }>(
    "select design_id from campaign_items where id = $1",
    [o.itemId],
  );
  if (!rows[0]) return;
  const design = await getDesign(db, rows[0].design_id);
  await saveDesign(db, {
    id: design.id,
    doc: applyCopy(design.doc, o.copy),
    baseRevision: design.revision,
    note: o.simulated
      ? "simulated copy applied (not real AI output)"
      : "Chief's reviewed copy applied",
    actor: o.actor,
  });
  await db.query(
    "update campaign_items set copy = $2, copy_status = $3, simulated = $4 where id = $1",
    [o.itemId, o.copy, o.status, o.simulated],
  );
  await db.query(
    "update campaigns set status = 'in_production', updated_at = now() where id = (select campaign_id from campaign_items where id = $1) and status = 'draft'",
    [o.itemId],
  );
}

export async function setItemStatus(
  db: Queryable,
  itemId: string,
  status: CampaignItemRow["copy_status"],
): Promise<void> {
  await db.query("update campaign_items set copy_status = $2 where id = $1", [itemId, status]);
}

/** Keep campaign item statuses in step with their approvals (decided on Telegram or the web). */
export async function syncItemStatusesFromApprovals(db: Queryable): Promise<void> {
  await db.query(
    `update campaign_items i set copy_status = case a.status when 'approved' then 'approved' when 'rejected' then 'rejected' else i.copy_status end
       from tasks t join approvals a on a.id = t.approval_id
      where i.task_id = t.id and a.status in ('approved', 'rejected') and i.copy_status = 'awaiting_approval'`,
  );
  await db.query(
    `update campaigns c set status = 'ready', updated_at = now()
      where c.status = 'in_production'
        and not exists (select 1 from campaign_items i where i.campaign_id = c.id and i.copy_status <> 'approved')`,
  );
}
