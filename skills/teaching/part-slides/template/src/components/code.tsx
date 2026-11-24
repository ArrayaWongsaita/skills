// Code, output and other blocks. Highlighting is bundled (no CDN); an unknown language renders as plain text.
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type StringKey, t } from '../strings';
import type { Block, Listing, Range } from './types';

hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('ini', ini); // also toml
hljs.registerLanguage('xml', xml); // also html
hljs.registerLanguage('plaintext', plaintext);

const ALIASES: Record<string, string> = { shell: 'bash', sh: 'bash', zsh: 'bash', console: 'bash', text: 'plaintext', txt: 'plaintext' };

/** The registered language for a fence's language, or null to render plain text. */
export function highlightLang(lang: string): string | null {
  const name = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
  if (!name || !hljs.getLanguage(name)) return null;
  return hljs.listLanguages().find((known) => known === name || hljs.getLanguage(known)?.aliases?.includes(name)) ?? name;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML per source line. Spans that cross a line break are closed and reopened, so each line stands alone. */
export function highlightLines(code: string, lang: string): string[] {
  const language = highlightLang(lang);
  const html = language ? hljs.highlight(code, { language, ignoreIllegals: true }).value : escapeHtml(code);
  const lines: string[] = [];
  const open: string[] = [];
  let current = '';
  for (const [token] of html.matchAll(/<span[^>]*>|<\/span>|\n|[^<\n]+/g)) {
    if (token === '\n') {
      lines.push(current + '</span>'.repeat(open.length));
      current = open.join('');
    } else if (token.startsWith('<span')) {
      open.push(token);
      current += token;
    } else if (token === '</span>') {
      open.pop();
      current += token;
    } else {
      current += token;
    }
  }
  lines.push(current);
  return lines;
}

export type Row = { n: number; text: string } | 'gap';

export function excerptRows(code: string, lines: Range[]): Row[] {
  const source = code.split('\n');
  const rows: Row[] = [];
  let previous = 0;
  for (const [first, last] of lines) {
    if (previous && first > previous + 1) rows.push('gap');
    for (let n = first; n <= last; n++) rows.push({ n, text: source[n - 1] ?? '' });
    previous = last;
  }
  return rows;
}

export function excerptText(code: string, lines: Range[]): string {
  return excerptRows(code, lines)
    .filter((row): row is { n: number; text: string } => row !== 'gap')
    .map((row) => row.text)
    .join('\n') + '\n';
}

const withNewline = (text: string) => (text.endsWith('\n') ? text : `${text}\n`);

export async function copyText(text: string): Promise<'ok' | 'unavailable'> {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') return 'unavailable';
  try {
    await navigator.clipboard.writeText(text);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

function CopyButton({ text, label, language }: { text: string; label: StringKey; language: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'unavailable'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);
  const shown = state === 'ok' ? t(language, 'copied') : state === 'unavailable' ? t(language, 'copyFailed') : t(language, label);
  return (
    <button type="button" className="rs-copy" aria-label={t(language, label)} onClick={() => copyText(text).then(setState)}>
      <span aria-live="polite">{shown}</span>
    </button>
  );
}

/** Marks a box whose content is taller than its space, so it scrolls with a visible cue (and the check page can count it). */
function useScrolls<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      element.dataset.scrolls = String(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  return ref;
}

const inRanges = (n: number, ranges: Range[]) => ranges.some(([first, last]) => n >= first && n <= last);

/** A numbered run of lines: an assembly marks which unit each part of the program came from. */
export type CodeGroup = { n: number; lines: Range[] };

type CodeBlockProps = { listing: Listing; lines: Range[]; highlight: Range[]; language: string; groups?: CodeGroup[] };

export function CodeBlock({ listing, lines, highlight, language, groups = [] }: CodeBlockProps) {
  const html = useMemo(() => highlightLines(listing.code, listing.lang), [listing.code, listing.lang]);
  const rows = excerptRows(listing.code, lines);
  const groupOf = (n: number) => groups.find((group) => inRanges(n, group.lines))?.n;
  const firstRow = new Map(groups.map((group) => [Math.min(...group.lines.map(([first]) => first)), group.n]));
  const scroll = useScrolls<HTMLPreElement>();
  return (
    <figure className="rs-codeblock">
      <div className="rs-code-actions">
        <CopyButton text={excerptText(listing.code, lines)} label="copy" language={language} />
      </div>
      <pre ref={scroll} className="rs-code" data-lang={listing.lang}>
        <code>
          {rows.map((row, index) =>
            row === 'gap' ? (
              <span key={`gap-${index}`} className="rs-gap" aria-hidden="true">
                ⋯
              </span>
            ) : (
              <span
                key={row.n}
                className={inRanges(row.n, highlight) ? 'rs-row rs-hl' : 'rs-row'}
                data-line={row.n}
                {...(groupOf(row.n) !== undefined ? { 'data-group': groupOf(row.n) } : {})}
              >
                {firstRow.has(row.n) && groupOf(row.n) === firstRow.get(row.n) ? (
                  <span className="rs-group-n" aria-hidden="true">
                    {firstRow.get(row.n)}
                  </span>
                ) : null}
                <span className="rs-ln" aria-hidden="true">
                  {row.n}
                </span>
                <span className="rs-src" dangerouslySetInnerHTML={{ __html: html[row.n - 1] || ' ' }} />
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

export function OutputBlock({ block, language }: { block: Block; language: string }) {
  const scroll = useScrolls<HTMLPreElement>();
  return (
    <figure className="rs-output">
      {block.info.split(/\s+/).includes('illustrative') ? <figcaption>{t(language, 'illustrative')}</figcaption> : null}
      <pre ref={scroll}>{block.text}</pre>
    </figure>
  );
}

function OneBlock({ block, language }: { block: Block; language: string }) {
  const html = useMemo(() => highlightLines(block.text, block.lang).join('\n'), [block.text, block.lang]);
  const scroll = useScrolls<HTMLPreElement>();
  return (
    <figure className="rs-block">
      <div className="rs-code-actions">
        <CopyButton text={withNewline(block.text)} label="copy" language={language} />
      </div>
      <pre ref={scroll} className="rs-code" data-lang={block.lang}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </figure>
  );
}

export function BlockList({ blocks, language }: { blocks: Block[]; language: string }) {
  return (
    <>
      {blocks.map((block, index) => (
        <OneBlock key={index} block={block} language={language} />
      ))}
    </>
  );
}
