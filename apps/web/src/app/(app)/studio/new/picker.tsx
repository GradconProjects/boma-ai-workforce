"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check } from "lucide-react";
import type { Design, Format, TemplateId } from "@boma/design-engine";
import { createDesignAction } from "@/app/actions";
import { DesignView } from "@/components/design-view";

type BrandLite = { id: string; name: string; accent: string; primary: string };

export function NewDesignPicker(p: {
  brands: BrandLite[];
  formats: Format[];
  templates: { id: TemplateId; title: string; description: string }[];
  previews: Record<string, Design>;
}) {
  const [brand, setBrand] = useState(p.brands[0]?.id ?? "");
  const [format, setFormat] = useState("social-portrait");
  const [template, setTemplate] = useState<TemplateId>("editorial");
  const preview = p.previews[`${brand}:${template}:${format}`];

  return (
    <form action={createDesignAction} className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
      <input type="hidden" name="brandId" value={brand} />
      <input type="hidden" name="formatId" value={format} />
      <input type="hidden" name="template" value={template} />
      <div className="space-y-8">
        <Section title="Brand">
          <div className="flex flex-wrap gap-2">
            {p.brands.map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => setBrand(b.id)}
                className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${brand === b.id ? "border-amber/50 bg-amber/10 text-white" : "border-white/10 text-mist-300 hover:border-white/20"}`}
              >
                <span
                  className="size-4 rounded-md"
                  style={{ background: `linear-gradient(135deg, ${b.primary}, ${b.accent})` }}
                />
                {b.name}
              </button>
            ))}
          </div>
        </Section>
        <Section title="Format">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {p.formats.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${format === f.id ? "border-amber/50 bg-amber/[0.07]" : "border-white/[0.07] bg-ink-900/50 hover:border-white/15"}`}
              >
                <div className="grid size-12 shrink-0 place-items-center">
                  <div
                    className="rounded-[3px] border-2 border-mist-300/70"
                    style={{
                      width: (40 * f.width) / Math.max(f.width, f.height),
                      height: (40 * f.height) / Math.max(f.width, f.height),
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="truncate text-xs text-mist-400">{f.subtitle}</div>
                  <div className="text-[11px] text-mist-400/70">
                    {f.width}×{f.height}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Look">
          <div className="grid gap-3 sm:grid-cols-3">
            {p.templates.map((t) => {
              const d = p.previews[`${brand}:${t.id}:social-square`];
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition ${template === t.id ? "border-amber/50 ring-2 ring-amber/20" : "border-white/[0.07] hover:border-white/15"}`}
                >
                  {d && <DesignView design={d} width={260} className="w-full" />}
                  <div className="flex items-start justify-between gap-2 p-3.5">
                    <div>
                      <div className="text-sm font-semibold">{t.title}</div>
                      <div className="text-xs text-mist-400">{t.description}</div>
                    </div>
                    {template === t.id && <Check className="size-4 shrink-0 text-amber" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      </div>
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="panel rounded-3xl p-6">
          <div className="label">Preview</div>
          <div className="stage-bg mt-2 grid min-h-[360px] place-items-center rounded-2xl p-6">
            {preview && (
              <DesignView
                key={`${brand}${template}${format}`}
                design={preview}
                width={
                  preview.width >= preview.height
                    ? 340
                    : Math.round((380 * preview.width) / preview.height)
                }
                className="rise rounded-md shadow-2xl shadow-black/60"
              />
            )}
          </div>
          <Submit />
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary mt-5 w-full py-3" disabled={pending}>
      {pending ? "Creating…" : "Open in editor"} <ArrowRight className="size-4" />
    </button>
  );
}
