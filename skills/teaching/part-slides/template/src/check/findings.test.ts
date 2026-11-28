import { expect, test } from 'vitest';
import { findings, type Measurement } from './findings';

const fonts = { mali: true, mono: true };
const prose = (over: Partial<Measurement['prose'][number]> = {}) => ({ scrollW: 1200, clientW: 1200, scrollH: 600, clientH: 600, fit: 1, ...over });
const m = (over: Partial<Measurement> = {}): Measurement => ({ slide: '1-001', frame: 'desktop', prose: [prose()], blocks: [], codeRows: 0, highlightedRows: 0, outOfCanvas: [], textOverlaps: 0, fallback: false, ...over });

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

const block = (over: Partial<Measurement['blocks'][number]> = {}): Measurement['blocks'][number] => ({ hiddenRows: 0, hiddenHighlight: [], wideLines: [], fits: 96, ...over });

test('a clipped box on the desktop is a problem with the hidden rows', () => {
  const found = findings([m({ blocks: [block({ hiddenRows: 2 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ kind: 'clipped-code', level: 'problem', frame: 'desktop' })]);
  expect(found[0]!.detail).toContain('2 row(s)');
});

test('a hidden highlighted line is named in the detail', () => {
  const [finding] = findings([m({ blocks: [block({ hiddenRows: 1, hiddenHighlight: [21] })] })], fonts, []);
  expect(finding!.detail).toContain('highlighted line 21 is hidden');
});

test('a wide line on the desktop is a problem with its line number', () => {
  const found = findings([m({ blocks: [block({ wideLines: [{ line: 18, chars: 141 }] })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ kind: 'wide-line', level: 'problem' })]);
  expect(found[0]!.detail).toContain('line 18 is 141 characters, the box fits 96');
});

test('a wide line on the phone is a note', () => {
  const found = findings([m({ frame: 'phone', prose: [prose({ clientW: 358, scrollW: 358 })], blocks: [block({ wideLines: [{ line: 18, chars: 141 }] })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ kind: 'scrolling-block', level: 'note', frame: 'phone' })]);
});

test('a clipped box on the phone is a problem', () => {
  const found = findings([m({ frame: 'phone', prose: [prose({ clientW: 358, scrollW: 358 })], blocks: [block({ hiddenRows: 1 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ kind: 'clipped-code', level: 'problem', frame: 'phone' })]);
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

test('text wider than its Compare panel or takeaway is a clipped-text problem, once per slide', () => {
  const clipped = [{ where: 'a Compare panel', scrollW: 700, clientW: 520 }];
  const found = findings([m({ clippedText: clipped }), m({ frame: 'phone', clippedText: clipped, prose: [prose({ clientW: 358, scrollW: 358 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', kind: 'clipped-text', level: 'problem', frame: 'both' })]);
  expect(found[0].detail).toContain('a Compare panel');
  expect(findings([m({ clippedText: [] })], fonts, [])).toEqual([]);
});

test('a drawing cut off by its slide is a clipped-drawing problem, and one that fits is not', () => {
  const found = findings([m({ frame: 'phone', clippedDrawings: [{ bottom: 56, right: 0 }], prose: [prose({ clientW: 358, scrollW: 358 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', kind: 'clipped-drawing', level: 'problem', frame: 'phone' })]);
  expect(findings([m({ clippedDrawings: [] })], fonts, [])).toEqual([]);
});

test('an Anatomy piece that wraps inside itself is a split-piece problem, and none is not', () => {
  const found = findings([m({ frame: 'phone', splitPieces: [2], prose: [prose({ clientW: 358, scrollW: 358 })] })], fonts, []);
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', kind: 'split-piece', level: 'problem', frame: 'phone' })]);
  expect(findings([m({ splitPieces: [] })], fonts, [])).toEqual([]);
});
