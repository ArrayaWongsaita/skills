import { expect, test } from 'vitest';
import { fixtureDiagrams } from '../../__fixtures__/DeckFixture';
import { type Box, CELL, edgePoints, edgeSlots, elementBox, groupBox, nearPoint, nodeBox, outOfCanvas, type Point } from './geometry';

const DEF = fixtureDiagrams['d-loop'];

function distanceToBorder(p: Point, b: Box): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h));
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return Math.min(p.x - b.x, b.x + b.w - p.x, p.y - b.y, b.y + b.h - p.y);
}
const onBorder = (p: Point, b: Box) => distanceToBorder(p, b) <= 6;

test('node boxes come from the grid', () => {
  const box = nodeBox(DEF.nodes[1]);
  expect(box.x).toBeGreaterThanOrEqual(6 * CELL);
  expect(box.x + box.w).toBeLessThanOrEqual(9 * CELL);
  expect(box.y).toBeGreaterThanOrEqual(1 * CELL);
});

test('a group frames its members', () => {
  const group = groupBox(DEF, DEF.groups[0]);
  for (const member of ['n-model', 'n-tool']) {
    const box = elementBox(DEF, member)!;
    expect(box.x).toBeGreaterThan(group.x);
    expect(box.y).toBeGreaterThan(group.y);
    expect(box.x + box.w).toBeLessThan(group.x + group.w);
    expect(box.y + box.h).toBeLessThan(group.y + group.h);
  }
});

test('edge to a group', () => {
  // Review Focus 3: the arrow ends on the group's frame, not on a member node.
  const { to } = edgePoints(DEF, { id: 'e-g', from: 'n-user', to: 'g-agent', style: 'solid' });
  expect(onBorder(to, groupBox(DEF, DEF.groups[0]))).toBe(true);
  expect(onBorder(to, elementBox(DEF, 'n-model')!)).toBe(false);
});

test('edge endpoints sit on node borders', () => {
  const { from, to } = edgePoints(DEF, DEF.edges[0]);
  expect(onBorder(from, elementBox(DEF, 'n-user')!)).toBe(true);
  expect(onBorder(to, elementBox(DEF, 'n-model')!)).toBe(true);
});

test('badges and notes near an edge sit at its middle', () => {
  const { from, to } = edgePoints(DEF, DEF.edges[1]);
  const middle = nearPoint(DEF, 'e-call')!;
  expect(middle.x).toBeCloseTo((from.x + to.x) / 2);
  expect(middle.y).toBeCloseTo((from.y + to.y) / 2);
  expect(nearPoint(DEF, 'nowhere')).toBeNull();
});

test('nodes outside the canvas are reported', () => {
  expect(outOfCanvas(DEF)).toEqual([]);
  const wide = { ...DEF, nodes: [...DEF.nodes, { id: 'n-far', label: 'far', concept: 'tool', at: [15, 7] as [number, number], size: [3, 1] as [number, number] }] };
  expect(outOfCanvas(wide)).toEqual(['n-far']);
});

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const side = (p: Point, a: Point, b: Point) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
const mid = (e: { from: Point; to: Point }) => ({ x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 });

test('opposite edges run side by side', () => {
  const call = edgePoints(DEF, DEF.edges[1]);
  const back = edgePoints(DEF, DEF.edges[2]);
  expect(dist(mid(call), mid(back))).toBeGreaterThanOrEqual(12);
});

test('label, badge and note of an edge each get their own place', () => {
  const edge = DEF.edges[1];
  const { from, to } = edgePoints(DEF, edge);
  const slots = edgeSlots(DEF, edge);
  const along = Math.abs((to.x - from.x) * (slots.badge.y - from.y) - (to.y - from.y) * (slots.badge.x - from.x)) / dist(from, to);
  expect(along).toBeLessThan(1); // on the line
  expect(dist(slots.label, slots.badge)).toBeGreaterThanOrEqual(12);
  expect(dist(slots.note, slots.badge)).toBeGreaterThanOrEqual(12);
  expect(side(slots.label, from, to)).toBe(-side(slots.note, from, to));
  // The note clears the edge running the other way, too.
  const back = edgePoints(DEF, DEF.edges[2]);
  expect(side(slots.note, back.from, back.to)).toBe(side(mid({ from, to }), back.from, back.to) * -1);
});

test('badges on opposite edges do not overlap', () => {
  expect(dist(edgeSlots(DEF, DEF.edges[1]).badge, edgeSlots(DEF, DEF.edges[2]).badge)).toBeGreaterThanOrEqual(28);
});
