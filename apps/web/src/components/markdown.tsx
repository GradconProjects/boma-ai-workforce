"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer for chat messages: builds React elements (never raw HTML), so
 * model output can't inject markup. Covers headings, lists, code, bold/italic, links and
 * internal app paths (which open in the preview panel).
 */

export type LinkHandler = (href: string, label: string) => void;

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))|(https?:\/\/[^\s)]+)|((?<![\w/])\/(?:skills\/runs|studio|campaigns|approvals|bots|skills|brands)(?:\/[\w-]+)*)/g;

function inline(text: string, onLink?: LinkHandler): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const [tok] = m;
    if (m[1])
      out.push(
        <code key={k++} className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]">
          {tok.slice(1, -1)}
        </code>,
      );
    else if (m[2])
      out.push(
        <strong key={k++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>,
      );
    else if (m[3]) out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else {
      let label = tok;
      let href = tok;
      if (m[4]) {
        const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
        label = lm[1]!;
        href = lm[2]!;
      }
      const internal = href.startsWith("/");
      out.push(
        <a
          key={k++}
          href={href}
          target={internal ? undefined : "_blank"}
          rel="noreferrer noopener"
          className="text-amber underline decoration-amber/40 underline-offset-2 hover:decoration-amber"
          onClick={(e) => {
            if (internal && onLink) {
              e.preventDefault();
              onLink(href, label);
            }
          }}
        >
          {label}
        </a>,
      );
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onLink }: { text: string; onLink?: LinkHandler }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i++;
      blocks.push(
        <pre
          key={k++}
          className="scroll-thin overflow-x-auto rounded-xl bg-black/40 p-3 text-[13px] leading-relaxed"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const size = ["", "text-xl", "text-lg", "text-base", "text-base"][h[1]!.length];
      blocks.push(
        <p key={k++} className={`${size} mt-2 font-display font-bold text-white`}>
          {inline(h[2]!, onLink)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={k++}
          className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 marker:text-mist-400`}
        >
          {items.map((it, j) => (
            <li key={j}>{inline(it, onLink)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (/^\s*(---|───|──────────)/.test(line)) {
      blocks.push(<hr key={k++} className="border-white/10" />);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+)/.test(lines[i]!)
    ) {
      para.push(lines[i++]!);
    }
    blocks.push(
      <p key={k++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, onLink)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-3">{blocks}</div>;
}
