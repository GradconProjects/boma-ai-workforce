"use client";

import { useTransition } from "react";
import { setAutopilotAction } from "@/app/autopilot-actions";

/** On/off switch for a workspace's autopilot. */
export function AutopilotSwitch({ slug, until }: { slug: string; until: string | null }) {
  const [pending, start] = useTransition();
  const on = Boolean(until);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => start(() => setAutopilotAction(slug, !on))}
      title={
        on
          ? `Autopilot on until ${new Date(until!).toLocaleDateString("en-AU")}: clean reviewed posts are approved automatically`
          : "Autopilot off: every post comes to you for approval"
      }
      className="flex items-center gap-2 text-xs text-mist-300"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${on ? "bg-sage" : "bg-white/15"} ${pending ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      Autopilot {on ? "on" : "off"}
    </button>
  );
}
