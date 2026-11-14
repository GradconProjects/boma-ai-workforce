"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/** A small confirm-then-delete button for any server action. */
export function DeleteButton({
  action,
  label = "Delete",
  confirmText,
  className = "",
}: {
  action: () => Promise<unknown>;
  label?: string;
  confirmText: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          start(async () => {
            const r = (await action()) as { result?: string } | undefined;
            if (r?.result) setNote(r.result);
          });
        }}
        className={`btn-ghost px-3 py-1.5 text-xs text-coral hover:bg-coral/10 ${className}`}
      >
        <Trash2 className="size-3.5" /> {pending ? "Deleting…" : label}
      </button>
      {note && <span className="text-xs text-mist-400">{note}</span>}
    </span>
  );
}
