import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { seedOf } from './seed';
import { SketchArrow, SketchEllipse, SketchRect, TINT } from './sketch';

test('seeds are stable, positive and differ by key', () => {
  expect(seedOf('d/n-model')).toBe(seedOf('d/n-model'));
  expect(seedOf('d/n-model')).not.toBe(seedOf('d/n-tool'));
  for (const key of ['', 'a', 'ข้อความ', 'd-agent-loop/n-user']) {
    expect(seedOf(key)).toBeGreaterThanOrEqual(1);
    expect(seedOf(key)).toBeLessThanOrEqual(2 ** 31 - 1);
  }
});

test('same seed key gives the same path', () => {
  const a = render(<svg><SketchEllipse seedKey="d/n-model" cx={50} cy={50} w={80} h={40} stroke="#000" /></svg>);
  const b = render(<svg><SketchEllipse seedKey="d/n-model" cx={50} cy={50} w={80} h={40} stroke="#000" /></svg>);
  const c = render(<svg><SketchEllipse seedKey="d/n-tool" cx={50} cy={50} w={80} h={40} stroke="#000" /></svg>);
  const d = (r: ReturnType<typeof render>) => r.container.querySelector('path')!.getAttribute('d');
  expect(d(a)).toBe(d(b));
  expect(d(a)).not.toBe(d(c));
});

test('draw adds the class', () => {
  const { container } = render(<svg><SketchRect seedKey="k" x={0} y={0} w={40} h={20} stroke="#000" draw /></svg>);
  const paths = [...container.querySelectorAll('path')];
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    expect(path).toHaveClass('rs-draw');
    expect(path.getAttribute('pathLength')).toBe('1');
  }
});

test('without draw there is no draw class', () => {
  const { container } = render(<svg><SketchArrow seedKey="k" x1={0} y1={0} x2={40} y2={20} stroke="#000" /></svg>);
  expect(container.querySelectorAll('path.rs-draw')).toHaveLength(0);
  expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
});

const ORANGE = '#e08a2e';
const rect = (extra: Record<string, unknown> = {}) => render(<svg><SketchRect seedKey="k" x={0} y={0} w={80} h={40} stroke="#000" fill={ORANGE} {...extra} /></svg>).container;
const filled = (root: Element) => [...root.querySelectorAll('path')].filter((path) => path.getAttribute('fill') === ORANGE);
const hatched = (root: Element) => [...root.querySelectorAll('path')].filter((path) => path.getAttribute('stroke') === ORANGE);

test('a fill without a fillStyle is a pale solid tint with no hatch lines, so a label on it stays readable', () => {
  const root = rect();
  expect(filled(root)).toHaveLength(1);
  expect(filled(root)[0].getAttribute('fill-opacity')).toBe(String(TINT));
  expect(TINT).toBeLessThan(0.5);
  expect(hatched(root)).toEqual([]);
});

test('an explicit hachure fill still draws hatch lines', () => {
  const root = rect({ fillStyle: 'hachure' });
  expect(hatched(root).length).toBeGreaterThan(0);
  expect(filled(root)).toEqual([]);
});

test('an explicit solid fill stays opaque, and fillOpacity sets the opacity of any fill', () => {
  expect(filled(rect({ fillStyle: 'solid' }))[0].getAttribute('fill-opacity')).toBeNull();
  expect(filled(rect({ fillStyle: 'solid', fillOpacity: 0.5 }))[0].getAttribute('fill-opacity')).toBe('0.5');
});
