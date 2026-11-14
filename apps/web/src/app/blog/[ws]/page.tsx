import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/server";
import { runtime } from "@/lib/runtime";

/** Public blog index for one workspace (no login). */
export const dynamic = "force-dynamic";

export default async function BlogIndex({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  if (!/^[a-z0-9-]+$/.test(ws)) notFound();
  await runtime();
  const w = await db().query<{ id: string; name: string; rules: { notes?: string[] } }>(
    "select id, name, rules from workspaces where slug = $1",
    [ws],
  );
  if (!w.rows[0]) notFound();
  const { rows: posts } = await db().query<{
    slug: string;
    title: string;
    excerpt: string;
    published_at: Date;
  }>(
    "select slug, title, excerpt, published_at from blog_posts where workspace_id = $1 order by published_at desc limit 100",
    [w.rows[0].id],
  );
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        <span className="text-glow">{w.rows[0].name}</span>
      </h1>
      <p className="mt-2 text-mist-300">{w.rows[0].rules?.notes?.[0] ?? ""}</p>
      <div className="mt-10 space-y-5">
        {posts.length === 0 && <p className="text-mist-400">First articles are on their way.</p>}
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${ws}/${p.slug}`}
            className="panel block rounded-3xl p-6 transition hover:border-amber/40"
          >
            <div className="text-xs text-mist-400">
              {p.published_at.toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
                dateStyle: "long",
              })}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold">{p.title}</h2>
            <p className="mt-2 text-sm text-mist-300">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
