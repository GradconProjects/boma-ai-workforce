"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";
import { createCampaignAction } from "@/app/actions";

export function NewCampaignForm(p: {
  brands: { id: string; name: string; audience: string; accent: string; primary: string }[];
  deliverables: { formatId: string; template: string; title: string; subtitle: string }[];
}) {
  const [state, action, pending] = useActionState(createCampaignAction, {});
  const [brandId, setBrandId] = useState(p.brands[0]?.id ?? "");
  const brand = p.brands.find((b) => b.id === brandId);
  return (
    <form action={action} className="panel mt-8 space-y-6 rounded-3xl p-7">
      <div>
        <span className="label">Brand</span>
        <div className="flex flex-wrap gap-2">
          {p.brands.map((b) => (
            <label
              key={b.id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm transition ${brandId === b.id ? "border-amber/50 bg-amber/10" : "border-white/10 hover:border-white/20"}`}
            >
              <input
                type="radio"
                name="brandId"
                value={b.id}
                checked={brandId === b.id}
                onChange={() => setBrandId(b.id)}
                className="sr-only"
              />
              <span
                className="size-4 rounded-md"
                style={{ background: `linear-gradient(135deg, ${b.primary}, ${b.accent})` }}
              />
              {b.name}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Campaign name
          </label>
          <input
            id="name"
            name="name"
            className="field"
            placeholder="e.g. Spring landlord check-ins"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="objective">
            Objective
          </label>
          <textarea
            id="objective"
            name="objective"
            rows={3}
            className="field"
            placeholder="What should this campaign achieve?"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="audience">
            Audience
          </label>
          <input
            id="audience"
            name="audience"
            className="field"
            defaultValue={brand?.audience}
            key={brandId}
          />
        </div>
        <div>
          <label className="label" htmlFor="cta">
            Call to action
          </label>
          <input id="cta" name="cta" className="field" placeholder="e.g. Book an inspection" />
        </div>
      </div>
      <div>
        <span className="label">Channels</span>
        <div className="flex flex-wrap gap-2">
          {["facebook", "instagram", "linkedin", "tiktok", "print"].map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm capitalize has-[:checked]:border-amber/50 has-[:checked]:bg-amber/10"
            >
              <input
                type="checkbox"
                name="channel"
                value={c}
                defaultChecked={c === "facebook"}
                className="accent-amber"
              />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Deliverables</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {p.deliverables.map((d) => (
            <label
              key={d.formatId}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 has-[:checked]:border-amber/50 has-[:checked]:bg-amber/[0.07]"
            >
              <input
                type="checkbox"
                name="deliverable"
                value={`${d.formatId}:${d.template}`}
                defaultChecked
                className="accent-amber"
              />
              <span>
                <span className="block text-sm font-semibold">{d.title}</span>
                <span className="text-xs text-mist-400">
                  {d.subtitle} · {d.template}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-amber/25 bg-amber/[0.06] p-4">
        <input type="checkbox" name="askChief" defaultChecked className="mt-0.5 accent-amber" />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-amber">
            <Sparkles className="size-4" /> Ask the Chief to write the copy now
          </span>
          <span className="mt-0.5 block text-mist-300">
            About A$0.06 per deliverable, checked against your monthly budget first. You approve
            every piece before it&apos;s used.
          </span>
        </span>
      </label>
      {state?.error && <p className="text-sm text-coral">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>
        {pending ? "Creating designs…" : "Create campaign"}
      </button>
    </form>
  );
}
