import { expect, test } from 'vitest';
import { findings, type Measurement } from './findings';

const fonts = { mali: true, mono: true };
const prose = (over: Partial<Measurement['prose'][number]> = {}) => ({ scrollW: 1200, clientW: 1200, scrollH: 600, clientH: 600, fit: 1, ...over });
const m = (over: Partial<Measurement> = {}): Measurement => ({ slide: '1-001', frame: 'desktop', prose: [prose()], scrollingBlocks: 0, codeRows: 0, highlightedRows: 0, outOfCanvas: [], textOverlaps: 0, fallback: false, ...over });

test('a clean Part has no findings', () => {
  expect(findings([m(), m({ frame: 'phone', prose: [prose({ clientW: 358, scrollW: 358, scrollH: 2000 })] })], fonts, [])).toEqual([]);
});

test('desktop prose overflow at minimum fit is a problem', () => {
  const [finding] = findings([m({ prose: [prose({ fit: 0.85, scrollH: 800 })] })], fonts, []);
  expect(finding).toMatchObject({ slide: '1-001', frame: 'desktop', kind: 'prose-overflow', level: 'problem' });
  expect(finding.detail).toContain('800');
});

test('desktop overflow above minimum fit is not reported', () => {
  expect(findings([m({ prose: [prose({ fit: 0.9, scrollH: 800 })] })], fonts, [])).toEqual([]);
});

test('phone height is fine but width is not', () => {
  expect(findings([m({ frame: 'phone', prose: [prose({ scrollH: 3000, clientH: 844 })] })], fonts, [])).toEqual([]);
  const [finding] = findings([m({ frame: 'phone', prose: [prose({ scrollW: 420, clientW: 390 })] })], fonts, []);
  expect(finding).toMatchObject({ frame: 'phone', kind: 'prose-overflow', level: 'problem' });
});

test('scrolling blocks are notes', () => {
  expect(findings([m({ scrollingBlocks: 1 })], fonts, [])).toEqual([
    expect.objectContaining({ kind: 'scrolling-block', level: 'note' }),
  ]);
});

test('fallback, canvas, fonts and console errors are problems', () => {
  const found = findings(
    [m({ fallback: true, outOfCanvas: ['n-far'] }), m({ frame: 'phone', fallback: true, outOfCanvas: ['n-far'], prose: [prose({ clientW: 358, scrollW: 358 })] })],
    { mali: false, mono: true },
    ['TypeError: x is undefined'],
  );
  expect(found.map((f) => f.kind).sort()).toEqual(['console-error', 'fallback', 'font-missing', 'out-of-canvas']);
  expect(found.every((f) => f.level === 'problem')).toBe(true);
  expect(found.find((f) => f.kind === 'out-of-canvas')!.detail).toContain('n-far');
});

test('a highlight on most of the code is a problem: highlight one place, or nothing', () => {
  const found = findings([m({ codeRows: 6, highlightedRows: 5 }), m({ frame: 'phone', codeRows: 6, highlightedRows: 5, prose: [prose({ clientW: 358, scrollW: 358 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', kind: 'highlight', level: 'problem', frame: 'both' })]);
  expect(found[0].detail).toContain('5 of 6');
});

test('a highlight on half of the code or less, or none, is fine', () => {
  expect(findings([m({ codeRows: 6, highlightedRows: 3 })], fonts, [])).toEqual([]);
  expect(findings([m({ codeRows: 6, highlightedRows: 0 })], fonts, [])).toEqual([]);
  expect(findings([m({ codeRows: 0, highlightedRows: 0 })], fonts, [])).toEqual([]);
});

test('labels of a drawing that overlap are one problem per slide, in either frame', () => {
  const found = findings([m({ textOverlaps: 2 }), m({ frame: 'phone', textOverlaps: 2, prose: [prose({ clientW: 358, scrollW: 358 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', frame: 'both', kind: 'text-overlap', level: 'problem' })]);
  expect(found[0]!.detail).toContain('2');
  expect(findings([m({ textOverlaps: 0 })], fonts, [])).toEqual([]);
});
