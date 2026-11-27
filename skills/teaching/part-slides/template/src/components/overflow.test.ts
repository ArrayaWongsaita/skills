import { expect, test } from 'vitest';
import { boxOverflow, type BoxGeometry, type RowGeometry } from './overflow';

const row = (over: Partial<RowGeometry> = {}): RowGeometry => ({ line: 1, bottom: 20, right: 100, chars: 10, highlighted: false, ...over });
const box = (over: Partial<BoxGeometry> = {}): BoxGeometry => ({ width: 600, height: 200, scrollHeight: 200, scrollWidth: 600, longestLine: 10, lineHeight: 20, textLeft: 0, charWidth: 6.25, rows: [], ...over });

test('a box that fits has nothing hidden and nothing wide', () => {
  expect(boxOverflow(box({ rows: [row()] }))).toEqual({ hiddenRows: 0, hiddenHighlight: [], wideLines: [], fits: 96 });
});

test('rows below the box are hidden, a gap marker counts as a row', () => {
  const rows = [row({ line: 1, bottom: 20 }), row({ line: 2, bottom: 40 }), row({ line: null, bottom: 60 }), row({ line: 9, bottom: 80 })];
  expect(boxOverflow(box({ height: 50, rows })).hiddenRows).toBe(2);
});

test('a hidden highlighted line is named', () => {
  expect(boxOverflow(box({ height: 50, rows: [row({ line: 21, bottom: 90, highlighted: true })] })).hiddenHighlight).toEqual([21]);
});

test('an output box with no rows counts hidden lines from its height, the faded strip included', () => {
  // 120 px of text in a 60 px box that fades from 51 px: 69 px, so 4 lines of 20 px, cannot be read.
  expect(boxOverflow(box({ rows: [], height: 60, scrollHeight: 120, lineHeight: 20 })).hiddenRows).toBe(4);
});

test('a line wider than the box is listed with its length', () => {
  const found = boxOverflow(box({ width: 600, charWidth: 6.25, rows: [row({ line: 18, right: 880, chars: 141 })] }));
  expect(found.wideLines).toEqual([{ line: 18, chars: 141 }]);
  expect(found.fits).toBe(96);
});

test('with no character width the box fits 0', () => {
  expect(boxOverflow(box({ charWidth: 0 })).fits).toBe(0);
});

test('a box with no rows that is wider than its space lists one line with the longest length', () => {
  expect(boxOverflow(box({ rows: [], scrollWidth: 900, longestLine: 144 })).wideLines).toEqual([{ line: null, chars: 144 }]);
});

test('the box fits only the characters right of the line numbers and padding', () => {
  expect(boxOverflow(box({ width: 600, charWidth: 6.25, textLeft: 50 })).fits).toBe(88);
});

test('a row in the faded bottom of a box that scrolls counts as hidden', () => {
  const rows = [row({ line: 1, bottom: 40 }), row({ line: 2, bottom: 90, highlighted: true })];
  const found = boxOverflow(box({ height: 100, scrollHeight: 108, rows }));
  expect(found.hiddenRows).toBe(1);
  expect(found.hiddenHighlight).toEqual([2]);
});

test('a row low in a box that does not scroll is not hidden', () => {
  expect(boxOverflow(box({ height: 100, scrollHeight: 100, rows: [row({ bottom: 95 })] })).hiddenRows).toBe(0);
});
