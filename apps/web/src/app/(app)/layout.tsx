import { pendingApprovals } from "@boma/core";
import { Shell } from "@/components/shell";
import { db, env, requireOwner } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const pending = (await pendingApprovals(db())).length;
  const e = env();
  const simulation = !(e.ANTHROPIC_API_KEY && e.OPENAI_API_KEY);
  return (
    <Shell pending={pending} simulation={simulation}>
      {children}
    </Shell>
  );
}
