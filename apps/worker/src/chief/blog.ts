import { audit, createTask, isPaused, transition, type Queryable } from "@boma/core";
import type { Notifier } from "./notifier";

/**
 * Blog publishing. An approved article (owner or his autopilot rule) is published on the
 * workspace's public blog, then a Facebook post linking to it is drafted (which goes through
 * its own review and approval). Idempotent: one blog post per task.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "post";

export function splitArticle(text: string): { title: string; body: string; excerpt: string } {
  const lines = text.trim().split("\n");
  const title = (lines[0] ?? "").replace(/^#+\s*/, "").trim() || "Untitled";
  const body = lines.slice(1).join("\n").trim();
  const firstPara =
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#")) ?? "";
  const plain = firstPara.replace(/[*_`#>]/g, "").replace(/\s+/g, " ");
  return { title, body, excerpt: plain.length > 220 ? `${plain.slice(0, 217).trimEnd()}…` : plain };
}

export async function publishApprovedArticles(
  db: Queryable,
  o: { appUrl?: string; notify: Notifier },
): Promise<number> {
  if (await isPaused(db)) return 0;
  const { rows } = await db.query<{
    id: string;
    workspace_id: string;
    slug: string;
    name: string;
    preview: { text?: string };
  }>(
    `select t.id, t.workspace_id, w.slug, w.name, a.preview
       from tasks t join workspaces w on w.id = t.workspace_id
       join approvals a on a.task_id = t.id and a.status = 'approved'
      where t.kind = 'write_article' and t.status = 'approved'
      order by t.created_at`,
  );
  let published = 0;
  for (const r of rows) {
    const { title, body, excerpt } = splitArticle(r.preview.text ?? "");
    let slug = slugify(title);
    for (let n = 2; n < 50; n++) {
      const clash = await db.query(
        "select 1 from blog_posts where workspace_id = $1 and slug = $2 and task_id is distinct from $3",
        [r.workspace_id, slug, r.id],
      );
      if (!clash.rows[0]) break;
      slug = `${slugify(title).slice(0, 64)}-${n}`;
    }
    await db.query(
      `insert into blog_posts (workspace_id, task_id, slug, title, excerpt, body_md)
       values ($1, $2, $3, $4, $5, $6) on conflict (task_id) do nothing`,
      [r.workspace_id, r.id, slug, title, excerpt, body],
    );
    const saved = await db.query<{ slug: string }>(
      "select slug from blog_posts where task_id = $1",
      [r.id],
    );
    const url = `${o.appUrl ?? ""}/blog/${r.slug}/${saved.rows[0]!.slug}`;
    await transition(db, r.id, "done", "system", `published to the blog: ${url}`);
    await audit(db, { actor: "system", action: "blog.publish", target: url, result: "published" });
    await createTask(db, {
      bot: "chief-of-staff",
      kind: "draft_post",
      workspace: r.slug,
      parentTaskId: r.id,
      inputs: {
        brief: `Promote our new blog article "${title}". What it's about: ${excerpt}\nInclude this link to the article: ${url}`,
        scheduled_for: null,
      },
      idempotencyKey: `${r.id}:facebook`,
      actor: "bot:chief-of-staff",
    });
    await o.notify.send(
      `📰 Published on the ${r.name} blog: "${title}"\n${url}\nI'm drafting the Facebook post that links to it.`,
    );
    published++;
  }
  return published;
}
