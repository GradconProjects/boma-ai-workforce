import { buildDesign, FORMATS, TEMPLATES } from "@boma/design-engine";
import { listBrands } from "@boma/studio";
import { NewDesignPicker } from "./picker";
import { db } from "@/lib/server";

export default async function NewDesign() {
  const brands = await listBrands(db());
  // Pre-build a preview for every brand × template × format so the picker is instant and exact.
  const previews = Object.fromEntries(
    brands.flatMap((b) =>
      TEMPLATES.flatMap((t) =>
        FORMATS.map((f) => [
          `${b.id}:${t.id}:${f.id}`,
          buildDesign({
            template: t.id,
            format: f,
            brand: b.brand,
            imageUrl: b.brand.image ?? null,
          }),
        ]),
      ),
    ),
  );
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">New design</div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        What are we making?
      </h1>
      <p className="mt-2 text-sm text-mist-400">
        Pick a brand, a format and a look. Everything stays editable.
      </p>
      <NewDesignPicker
        brands={brands.map((b) => ({
          id: b.id,
          name: b.brand.name,
          accent: b.brand.accent,
          primary: b.brand.primary,
        }))}
        formats={FORMATS}
        templates={TEMPLATES}
        previews={previews}
      />
    </div>
  );
}
