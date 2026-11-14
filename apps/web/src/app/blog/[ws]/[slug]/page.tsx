import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBlogPostAction } from "@/app/delete-actions";
import { DeleteButton } from "@/components/delete-button";
import { Markdown } from "@/components/markdown";
import { db, isOwner } from "@/lib/server";

/** One public blog article (no login). The owner also sees a Delete button. */
export const dynamic = "force-dynamic";

type P = { params: Promise<{ ws: string; slug: string }> };

async function load(ws: string, slug: string) {
  if (!/^[a-z0-9-]+$/.test(ws) || !/^[a-z0-9-]+$/.test(slug)) return undefined;
  const { rows } = await db().query<{
    id: string;
    title: string;
    excerpt: string;
    body_md: string;
    published_at: Date;
    name: string;
  }>(
    `select p.id, p.title, p.excerpt, p.body_md, p.published_at, w.name
       from blog_posts p join workspaces w on w.id = p.workspace_id
      where w.slug = $1 and p.slug = $2`,
    [ws, slug],
  );
  return rows[0];
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { ws, slug } = await params;
  const post = await load(ws, slug);
  if (!post) return {};
  return {
    title: `${post.title} | ${post.name}`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

export default async function BlogPost({ params }: P) {
  const { ws, slug } = await params;
  const post = await load(ws, slug);
  if (!post) notFound();
  const owner = await isOwner();
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/blog/${ws}`} className="text-sm text-amber hover:underline">
          ← {post.name}
        </Link>
        {owner && (
          <DeleteButton
            action={deleteBlogPostAction.bind(null, post.id, ws)}
            label="Delete article"
            confirmText="Delete this article from the blog?"
          />
        )}
      </div>
      <h1 className="mt-6 font-display text-4xl leading-tight font-extrabold tracking-tight">
        {post.title}
      </h1>
      <div className="mt-2 text-sm text-mist-400">
        {post.published_at.toLocaleDateString("en-AU", {
          timeZone: "Australia/Sydney",
          dateStyle: "long",
        })}
      </div>
      <article className="mt-8 text-[17px] leading-relaxed text-mist-100">
        <Markdown text={post.body_md} />
      </article>
    </main>
  );
}
