import { expect, test } from 'vitest';
import { countOverlaps } from './overlap';

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

test('two labels one on top of the other are one overlap', () => {
  expect(countOverlaps([box(0, 100, 80, 120), box(0, 112, 80, 132)])).toBe(1);
});

test('labels that are apart, or only touch, do not overlap', () => {
  expect(countOverlaps([box(0, 100, 80, 120), box(0, 120, 80, 140), box(0, 150, 80, 170)])).toBe(0);
});

test('a small graze of an edge is not an overlap, but a quarter of the smaller label is', () => {
  expect(countOverlaps([box(0, 0, 100, 20), box(0, 18, 100, 38)])).toBe(0); // 10 % of the label
  expect(countOverlaps([box(0, 0, 100, 20), box(0, 14, 100, 34)])).toBe(1); // 30 %
});

test('a label that is not drawn (no size) is ignored, and every pair is counted once', () => {
  expect(countOverlaps([box(0, 0, 0, 0), box(0, 0, 80, 20)])).toBe(0);
  expect(countOverlaps([box(0, 0, 80, 20), box(0, 5, 80, 25), box(0, 10, 80, 30)])).toBe(3);
});
