import { notFound } from "next/navigation";
import { getBrand, getDesign, listVersions, STOCK_IMAGES } from "@boma/studio";
import { Editor } from "@/components/editor/editor";
import { db } from "@/lib/server";

export default async function EditDesign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(db(), id).catch(() => null);
  if (!design) notFound();
  const [{ brand }, versions, item] = await Promise.all([
    getBrand(db(), design.brand_id),
    listVersions(db(), id),
    db()
      .query<{
        id: string;
        campaign_id: string;
        copy_status: string;
        simulated: boolean;
        campaign_name: string;
      }>(
        `select i.id, i.campaign_id, i.copy_status, i.simulated, c.name as campaign_name
           from campaign_items i join campaigns c on c.id = i.campaign_id where i.design_id = $1`,
        [id],
      )
      .then((r) => r.rows[0] ?? null),
  ]);
  return (
    <Editor
      key={`${design.id}:${design.revision}`}
      designId={design.id}
      initialDoc={design.doc}
      initialRevision={design.revision}
      initialTitle={design.title}
      brand={brand}
      stockImages={STOCK_IMAGES}
      versions={versions.map((v) => ({ ...v, created_at: v.created_at.toISOString() }))}
      campaignItem={item}
    />
  );
}
