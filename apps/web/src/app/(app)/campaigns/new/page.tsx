import { FORMATS } from "@boma/design-engine";
import { CAMPAIGN_DELIVERABLES, listBrands } from "@boma/studio";
import { NewCampaignForm } from "./form";
import { db } from "@/lib/server";

export default async function NewCampaign() {
  const brands = await listBrands(db());
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">
        New campaign
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Write the brief</h1>
      <p className="mt-2 text-sm text-mist-400">
        Every deliverable is created as an editable design. Ask the Chief to write the copy and it
        comes back checked by both Claude and OpenAI, ready for your approval.
      </p>
      <NewCampaignForm
        brands={brands.map((b) => ({
          id: b.id,
          name: b.brand.name,
          audience: b.brand.audience,
          accent: b.brand.accent,
          primary: b.brand.primary,
        }))}
        deliverables={CAMPAIGN_DELIVERABLES.map((d) => ({
          ...d,
          title: FORMATS.find((f) => f.id === d.formatId)!.title,
          subtitle: FORMATS.find((f) => f.id === d.formatId)!.subtitle,
        }))}
      />
    </div>
  );
}
