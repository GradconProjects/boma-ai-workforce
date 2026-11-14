"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { Brand } from "@boma/design-engine";
import { saveBrandAction } from "@/app/actions";
import { FONTS } from "@/components/editor/inspector";

const EMPTY = {
  name: "",
  tagline: "",
  industry: "",
  audience: "",
  tone: "",
  primary: "#101828",
  secondary: "#344054",
  accent: "#F4B860",
  logoText: "",
  website: "",
  features: [] as string[],
  headingFont: "Manrope",
  bodyFont: "DM Sans",
  image: "",
};

export function BrandEditor({
  id,
  brand,
  images,
}: {
  id: string | null;
  brand?: Brand & { image?: string };
  images: { src: string; label: string }[];
}) {
  const b = brand ?? { ...EMPTY, id: "" };
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState({
    primary: b.primary,
    secondary: b.secondary,
    accent: b.accent,
  });
  const [state, action, pending] = useActionState(saveBrandAction, {});

  if (!id && !open)
    return (
      <button onClick={() => setOpen(true)} className="btn-outline w-full border-dashed py-5">
        <Plus className="size-4" /> Add a brand
      </button>
    );

  return (
    <div className="panel overflow-hidden rounded-3xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div
          className="grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold"
          style={{ background: colors.primary, color: colors.accent }}
        >
          {b.logoText || b.name.slice(0, 2).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold">{b.name || "New brand"}</div>
          <div className="truncate text-sm text-mist-400">{b.tagline}</div>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          {[colors.primary, colors.secondary, colors.accent].map((c, i) => (
            <span
              key={i}
              className="h-8 w-10 rounded-lg ring-1 ring-white/10"
              style={{ background: c }}
            />
          ))}
        </div>
        <ChevronDown className={`size-5 text-mist-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form action={action} className="grid gap-4 border-t border-white/5 p-5 sm:grid-cols-2">
          {id && <input type="hidden" name="id" value={id} />}
          <Field name="name" label="Name" value={b.name} />
          <Field name="tagline" label="Tagline" value={b.tagline} />
          <Field name="industry" label="Industry" value={b.industry} />
          <Field name="tone" label="Tone of voice" value={b.tone} />
          <Field name="audience" label="Audience" value={b.audience} wide />
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            {(["primary", "secondary", "accent"] as const).map((k) => (
              <label key={k}>
                <span className="label">{k}</span>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/80 p-1.5">
                  <input
                    type="color"
                    value={colors[k]}
                    onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
                    className="size-8 cursor-pointer rounded-lg border-0 bg-transparent"
                  />
                  <input
                    name={k}
                    value={colors[k]}
                    onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
                    className="w-full bg-transparent font-mono text-xs outline-none"
                  />
                </div>
              </label>
            ))}
          </div>
          <label>
            <span className="label">Heading font</span>
            <select name="headingFont" defaultValue={b.headingFont} className="field">
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Body font</span>
            <select name="bodyFont" defaultValue={b.bodyFont} className="field">
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <Field name="logoText" label="Logo initials" value={b.logoText} />
          <Field name="website" label="Website" value={b.website} />
          <label className="sm:col-span-2">
            <span className="label">Key features / services (one per line)</span>
            <textarea
              name="features"
              rows={4}
              defaultValue={b.features.join("\n")}
              className="field"
            />
            <span className="mt-1 block text-[11px] text-mist-400">
              Reference only. Facts the Chief may state go in the workspace claim register.
            </span>
          </label>
          <label className="sm:col-span-2">
            <span className="label">Default photo</span>
            <select name="image" defaultValue={b.image ?? ""} className="field">
              <option value="">None</option>
              {images.map((i) => (
                <option key={i.src} value={i.src}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save brand"}
            </button>
            {state?.ok && <span className="text-sm text-sage">Saved.</span>}
            {state?.error && <span className="text-sm text-coral">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  value,
  wide,
}: {
  name: string;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} className="field" />
    </label>
  );
}
