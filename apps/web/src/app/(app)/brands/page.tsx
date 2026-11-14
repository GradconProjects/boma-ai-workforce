import { listBrands, STOCK_IMAGES } from "@boma/studio";
import { db } from "@/lib/server";
import { BrandEditor } from "./brand-editor";

export default async function Brands() {
  const brands = await listBrands(db());
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">Brand kits</div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        Every business, its own identity
      </h1>
      <p className="mt-2 text-sm text-mist-400">
        Colours, fonts and voice drive every template and every line the Chief writes.
      </p>
      <div className="mt-8 space-y-5">
        {brands.map((b) => (
          <BrandEditor key={b.id} id={b.id} brand={b.brand} images={STOCK_IMAGES} />
        ))}
        <BrandEditor id={null} images={STOCK_IMAGES} />
      </div>
    </div>
  );
}
