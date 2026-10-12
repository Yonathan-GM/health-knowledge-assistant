"use client";

import { useId, useState, type ReactNode } from "react";
import type { Source } from "@/lib/api";

// Splits text into **bold** runs and citation markers like [1] or [1, 2].
const TOKEN = /(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g;
const BULLET = /^\s*[*•-]\s+/;

type Props = {
  answer: string;
  sources: Source[];
  showCopy?: boolean;
};

export function AnswerBlock({ answer, sources, showCopy = false }: Props) {
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const byNumber = new Map(sources.map((s) => [s.n, s]));

  function chip(n: number, key: string): ReactNode {
    const source = byNumber.get(n);
    if (!source) return <span key={key}>[{n}]</span>;
    return (
      <button
        key={key}
        type="button"
        aria-label={`Source ${n}: ${source.filename}, page ${source.page}`}
        onMouseEnter={() => setActive(n)}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(n)}
        onBlur={() => setActive(null)}
        onClick={() =>
          document.getElementById(`${uid}-src-${n}`)?.scrollIntoView({ block: "nearest" })
        }
        className="mx-0.5 inline-flex h-5 min-w-5 -translate-y-0.5 items-center justify-center rounded bg-teal-wash px-1 font-sans text-xs font-semibold text-teal-deep transition-colors hover:bg-mark focus-visible:bg-mark"
      >
        {n}
      </button>
    );
  }

  function inline(text: string, keyBase: string): ReactNode[] {
    return text
      .split(TOKEN)
      .filter(Boolean)
      .flatMap((part, i): ReactNode[] => {
        const key = `${keyBase}-${i}`;
        if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
          return [
            <strong key={key} className="font-semibold">
              {part.slice(2, -2)}
            </strong>,
          ];
        }
        const marker = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
        if (marker) {
          // Keep neighbouring numbers together so "[2, 3]" never splits across lines.
          return [
            <span key={key} className="whitespace-nowrap">
              {marker[1]
                .split(",")
                .map((num, j) => chip(parseInt(num.trim(), 10), `${key}-${j}`))}
            </span>,
          ];
        }
        return [part];
      });
  }

  const blocks = answer
    .trim()
    .split(/\n{2,}/)
    .flatMap((block, bi) => {
      // Group consecutive lines into bullet lists and plain paragraphs.
      const groups: { bullets: boolean; lines: string[] }[] = [];
      for (const line of block.split("\n")) {
        const isBullet = BULLET.test(line);
        const last = groups[groups.length - 1];
        if (last && last.bullets === isBullet) last.lines.push(line);
        else groups.push({ bullets: isBullet, lines: [line] });
      }
      return groups.map((g, gi) => {
        const key = `${bi}-${gi}`;
        if (g.bullets) {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-5">
              {g.lines.map((l, li) => (
                <li key={li}>{inline(l.replace(BULLET, ""), `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={key}>{inline(g.lines.join(" "), key)}</p>;
      });
    });

  async function copy() {
    const text = `${answer.trim()}\n\nSources:\n${sources
      .map((s) => `[${s.n}] ${s.filename}, page ${s.page}`)
      .join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked by the browser: nothing to do */
    }
  }

  return (
    <div>
      <div className="max-w-[65ch] space-y-3 font-serif text-[1.0625rem] leading-7">
        {blocks}
      </div>

      {sources.length > 0 && (
        <div className="mt-5 max-w-[65ch] border-t border-rule pt-3">
          <h3 className="text-sm font-medium text-muted">Sources</h3>
          <ol className="mt-2 space-y-1 text-sm">
            {sources.map((s) => (
              <li
                key={s.n}
                id={`${uid}-src-${s.n}`}
                className={`flex gap-2 rounded px-2 py-1 transition-colors ${
                  active === s.n ? "bg-mark" : ""
                }`}
              >
                <span className="w-5 shrink-0 font-semibold text-teal-deep">{s.n}</span>
                <span className="min-w-0 break-words">
                  {s.filename}, page {s.page}
                </span>
              </li>
            ))}
          </ol>
          {showCopy && (
            <button
              type="button"
              onClick={copy}
              className="mt-3 text-sm font-medium text-teal-deep underline underline-offset-4 hover:text-teal"
            >
              {copied ? "Copied" : "Copy answer"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
