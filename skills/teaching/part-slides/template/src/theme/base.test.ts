import { expect, test } from 'vitest';
import css from './base.css?raw';

const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is in base.css`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

test('a divider title is set in the text font, which has Thai, not the mono font, which does not', () => {
  // JetBrains Mono has no Thai glyphs: a Thai title in it shows its vowels and tone marks pulled apart.
  expect(rule('.rs-divider .rs-title')).not.toContain('var(--rs-mono)');
  expect(css).toMatch(/--rs-font: 'Mali'/);
});

test('reduced motion stops every entry animation, so a screenshot never catches a slide mid-draw', () => {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const reduced = css.slice(start, css.indexOf('\n}\n', start));
  expect(reduced).toContain('.rs-illustration.rs-draw-in path[pathLength]');
});

test('a divider title leaves room for Thai marks above and below its lines', () => {
  // At 1.1 a Thai title's tone marks touch the kicker above it and the line above them.
  const lineHeight = Number(rule('.rs-divider .rs-title').match(/line-height: ([\d.]+)/)?.[1]);
  expect(lineHeight).toBeGreaterThanOrEqual(1.25);
});

test('on a phone a run wraps, so the end of a long line (a test name) stays in view', () => {
  expect(rule('.rs-phone .rs-output pre')).toContain('white-space: pre-wrap');
});
