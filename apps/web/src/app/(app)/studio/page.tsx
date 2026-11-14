import Link from "next/link";
import { Plus } from "lucide-react";
import { getFormat } from "@boma/design-engine";
import { listBrands, listDesigns } from "@boma/studio";
import { DesignView } from "@/components/design-view";
import { db } from "@/lib/server";

export default async function StudioLibrary({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const [brands, designs] = await Promise.all([
    listBrands(db()),
    listDesigns(db(), { brandId: brand, limit: 120 }),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.brand.name]));
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">
            Design studio
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Your designs</h1>
        </div>
        <Link href="/studio/new" className="btn-primary">
          <Plus className="size-4" /> New design
        </Link>
      </header>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/studio"
          className={`chip border ${!brand ? "border-amber/40 bg-amber/10 text-amber" : "border-white/10 text-mist-300 hover:border-white/20"}`}
        >
          All brands
        </Link>
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/studio?brand=${b.id}`}
            className={`chip border ${brand === b.id ? "border-amber/40 bg-amber/10 text-amber" : "border-white/10 text-mist-300 hover:border-white/20"}`}
          >
            <span className="size-2 rounded-full" style={{ background: b.brand.accent }} />
            {b.brand.name}
          </Link>
        ))}
      </div>
      {designs.length === 0 ? (
        <div className="panel rounded-3xl px-6 py-16 text-center text-mist-400">
          Nothing here yet.{" "}
          <Link href="/studio/new" className="text-amber hover:underline">
            Create a design
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
          {designs.map((d) => (
            <Link key={d.id} href={`/studio/${d.id}`} className="group rise">
              <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900 p-5 transition group-hover:-translate-y-0.5 group-hover:border-amber/30">
                <DesignView
                  design={d.doc}
                  width={
                    d.doc.width / d.doc.height > 0.8
                      ? 220
                      : Math.round((260 * d.doc.width) / d.doc.height)
                  }
                  className="rounded-md shadow-2xl shadow-black/60"
                />
              </div>
              <div className="mt-3 truncate text-sm font-semibold">{d.title}</div>
              <div className="flex items-center gap-2 text-xs text-mist-400">
                {brandName.get(d.brand_id)} · {getFormat(d.format_id).subtitle.split(" · ")[0]}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
