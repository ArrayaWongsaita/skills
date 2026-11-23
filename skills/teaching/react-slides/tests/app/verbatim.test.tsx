// Copied into a generated app by tests/test_app_build.py, next to the expected.json it writes.
// Every field of every Part 1 slide must show exactly the deck's visible text.
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DeckModeContext, FrameContext } from './components/Deck';
import expected from './expected.json';
import Part01 from './parts/part-01';

const BLOCKS = new Set(['p', 'li', 'ol', 'ul', 'div']);

/** Text as a reader sees it: line breaks and blocks become newlines, runs of newlines collapse. */
function domText(node: Node): string {
  const out: string[] = [];
  const walk = (current: Node) => {
    if (current.nodeType === Node.TEXT_NODE) {
      out.push((current as Text).data);
      return;
    }
    if (!(current instanceof Element)) return;
    const tag = current.tagName.toLowerCase();
    if (tag === 'br') {
      out.push('\n');
      return;
    }
    const block = BLOCKS.has(tag);
    if (block) out.push('\n');
    current.childNodes.forEach(walk);
    if (block) out.push('\n');
  };
  walk(node);
  return out.join('').replace(/\n+/g, '\n').trim();
}

/** The deck's characters without markup, spacing or list markers: an independent check that nothing is dropped. */
const MARKUP = /[\s*_`\[\]\\~]/g;
const bareDeck = (raw: string) =>
  raw
    .replace(/^\s*(?:\d+\.|-)\s+/gm, '')
    .replace(/\]\(https?:\/\/[^\s)]*\)/g, ']')
    .replace(MARKUP, '');
const barePage = (text: string) => text.replace(MARKUP, '');

type Slide = { id: string; fields: Record<string, string | string[]>; raw: Record<string, string> };

test.each((expected as unknown as Slide[]).map((slide) => [slide.id, slide] as const))('%s shows every field verbatim', (id, slide) => {
  const { container } = render(
    <DeckModeContext.Provider value="check">
      <FrameContext.Provider value="desktop">
        <Part01 />
      </FrameContext.Provider>
    </DeckModeContext.Provider>,
  );
  const stage = container.querySelector(`[data-check-slide="${id}"]`);
  expect(stage, `${id} is rendered`).not.toBeNull();
  for (const [name, want] of Object.entries(slide.fields)) {
    const field = stage!.querySelector(`[data-field="${name}"]`);
    expect(field, `${id} has a [data-field="${name}"]`).not.toBeNull();
    const got = Array.isArray(want) ? [...field!.querySelectorAll('[data-item]')].map(domText) : domText(field!);
    expect(got, `${id} ${name}`).toEqual(want);
    expect(barePage(domText(field!)), `${id} ${name}: every character of the deck`).toBe(bareDeck(slide.raw[name]));
  }
});
