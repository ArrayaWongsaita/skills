import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Bars, Cells, Cycle, Flow, Nested, Network, Pipeline } from './figures';

const AWKWARD = ['.map(', '<T>', 'a && b', 'x => x * 2', 'ข้อมูลเข้า'];

const figure = (container: HTMLElement, name: string) => container.querySelector(`svg[data-figure="${name}"]`)!;
const labels = (root: Element) => [...root.querySelectorAll('[data-el] text[data-label]')].map((node) => node.textContent);
const highlighted = (root: Element) => root.querySelectorAll('[data-highlight="true"]');

test('flow shows its steps in order, verbatim, with an arrow between each pair', () => {
  const { container } = render(<Flow steps={AWKWARD} />);
  const svg = figure(container, 'flow');
  expect(labels(svg)).toEqual(AWKWARD);
  expect(svg.querySelectorAll('[data-el]')).toHaveLength(5);
  expect(svg.querySelectorAll('[data-arrow]')).toHaveLength(4);
});

test('pipeline shows each stage with its note', () => {
  const { container } = render(<Pipeline stages={[{ label: 'อ่าน', note: 'อ่านไฟล์' }, { label: '.map(' }, { label: 'เขียน', note: 'a && b' }]} />);
  const svg = figure(container, 'pipeline');
  expect(labels(svg)).toEqual(['อ่าน', '.map(', 'เขียน']);
  expect([...svg.querySelectorAll('[data-note]')].map((node) => node.textContent)).toEqual(['อ่านไฟล์', 'a && b']);
  expect(svg.querySelectorAll('[data-arrow]')).toHaveLength(2);
});

test('nested draws one box per level, outermost first', () => {
  const { container } = render(<Nested levels={['AI', 'ML', 'Deep learning']} />);
  const svg = figure(container, 'nested');
  expect(labels(svg)).toEqual(['AI', 'ML', 'Deep learning']);
  const widths = [...svg.querySelectorAll('[data-el]')].map((node) => Number(node.getAttribute('data-width')));
  expect(widths[0]).toBeGreaterThan(widths[1]);
  expect(widths[1]).toBeGreaterThan(widths[2]);
});

test('cells shows each cell with its index and a mark under the cells it points at', () => {
  const { container } = render(<Cells cells={['10', '20', '30']} marks={[{ at: 1, label: 'index' }, { at: 9, label: 'nowhere' }]} />);
  const svg = figure(container, 'cells');
  expect(labels(svg)).toEqual(['10', '20', '30']);
  expect([...svg.querySelectorAll('[data-index]')].map((node) => node.textContent)).toEqual(['0', '1', '2']);
  expect([...svg.querySelectorAll('[data-mark]')].map((node) => [node.getAttribute('data-mark'), node.textContent])).toEqual([['1', 'index']]);
});

test('bars draw each value in proportion to the largest, or to max', () => {
  const bars = [{ label: 'a', value: 5 }, { label: 'b', value: 10 }, { label: 'c', value: -3 }];
  const widthsOf = (root: Element) => [...root.querySelectorAll('[data-el]')].map((node) => Number(node.getAttribute('data-length')));
  const byLargest = figure(render(<Bars bars={bars} />).container, 'bars');
  expect(labels(byLargest)).toEqual(['a', 'b', 'c']);
  const [a, b, c] = widthsOf(byLargest);
  expect([a * 2, c]).toEqual([b, 0]);
  const byMax = figure(render(<Bars bars={bars} max={20} />).container, 'bars');
  expect(widthsOf(byMax)[1]).toBe(b / 2);
  expect([...byLargest.querySelectorAll('[data-value]')].map((node) => node.textContent)).toEqual(['5', '10', '-3']);
});

test('a bar above max stops at the end of its track and still shows its value', () => {
  const svg = figure(render(<Bars bars={[{ label: 'big', value: 50 }, { label: 'ok', value: 10 }]} max={10} />).container, 'bars');
  const [big, ok] = [...svg.querySelectorAll('[data-el]')].map((node) => Number(node.getAttribute('data-length')));
  expect(big).toBe(ok);
  expect(svg.querySelector('[data-value]')).toHaveTextContent('50');
});

test('bars whose values are all zero do not divide by zero', () => {
  const svg = figure(render(<Bars bars={[{ label: 'z', value: 0 }]} />).container, 'bars');
  expect(svg.querySelector('[data-el]')!.getAttribute('data-length')).toBe('0');
});

test('network draws a node for every count and an edge between neighbouring layers', () => {
  const svg = figure(render(<Network layers={[3, 4, 2]} />).container, 'network');
  expect(svg.querySelectorAll('[data-node]')).toHaveLength(9);
  expect(svg.querySelectorAll('[data-edge]')).toHaveLength(3 * 4 + 4 * 2);
  expect([...svg.querySelectorAll('[data-layer-count]')].map((node) => node.textContent)).toEqual(['3', '4', '2']);
});

test('a big layer shows a few nodes and its real size', () => {
  const svg = figure(render(<Network layers={[784, 128, 10]} />).container, 'network');
  for (const layer of svg.querySelectorAll('[data-layer]')) expect(layer.querySelectorAll('[data-node]').length).toBeLessThanOrEqual(8);
  expect([...svg.querySelectorAll('[data-layer-count]')].map((node) => node.textContent)).toEqual(['784', '128', '10']);
  expect(svg.querySelectorAll('[data-edge]').length).toBeLessThan(200);
});

test('cycle joins its steps in a ring', () => {
  const svg = figure(render(<Cycle steps={['ถาม', 'คิด', 'ตอบ']} />).container, 'cycle');
  expect(labels(svg)).toEqual(['ถาม', 'คิด', 'ตอบ']);
  expect(svg.querySelectorAll('[data-arrow]')).toHaveLength(3);
});

test('a cycle of two goes there and back, and a cycle of one has no arrow', () => {
  expect(figure(render(<Cycle steps={['a', 'b']} />).container, 'cycle').querySelectorAll('[data-arrow]')).toHaveLength(2);
  expect(figure(render(<Cycle steps={['a']} />).container, 'cycle').querySelectorAll('[data-arrow]')).toHaveLength(0);
});

const HIGHLIGHTABLE = [
  ['flow', (highlight?: number) => <Flow steps={['a', 'b', 'c']} highlight={highlight} />],
  ['pipeline', (highlight?: number) => <Pipeline stages={[{ label: 'a' }, { label: 'b' }, { label: 'c' }]} highlight={highlight} />],
  ['nested', (highlight?: number) => <Nested levels={['a', 'b', 'c']} highlight={highlight} />],
  ['cells', (highlight?: number) => <Cells cells={['a', 'b', 'c']} highlight={highlight} />],
  ['network', (highlight?: number) => <Network layers={[2, 3, 1]} highlight={highlight} />],
  ['cycle', (highlight?: number) => <Cycle steps={['a', 'b', 'c']} highlight={highlight} />],
] as const;

test.each(HIGHLIGHTABLE)('%s marks exactly the highlighted element', (name, make) => {
  expect(highlighted(figure(render(make(1)).container, name))).toHaveLength(1);
  expect(highlighted(figure(render(make()).container, name))).toHaveLength(0);
  expect(highlighted(figure(render(make(7)).container, name))).toHaveLength(0);
  expect(highlighted(figure(render(make(-1)).container, name))).toHaveLength(0);
});

test('the highlight sits on the element it names', () => {
  const svg = figure(render(<Flow steps={['a', 'b', 'c']} highlight={2} />).container, 'flow');
  expect(highlighted(svg)[0]).toHaveTextContent('c');
});

test.each([
  ['flow', <Flow steps={[]} />],
  ['pipeline', <Pipeline stages={[]} />],
  ['nested', <Nested levels={[]} />],
  ['cells', <Cells cells={[]} />],
  ['bars', <Bars bars={[]} />],
  ['network', <Network layers={[]} />],
  ['network with only empty layers', <Network layers={[0, 0]} />],
  ['cycle', <Cycle steps={[]} />],
])('an empty %s renders nothing', (_name, element) => {
  const { container } = render(element);
  expect(container).toBeEmptyDOMElement();
});

test('a figure is an image for a screen reader, described by its labels', () => {
  const svg = figure(render(<Flow steps={['อ่าน', 'เขียน']} />).container, 'flow');
  expect(svg).toHaveAttribute('role', 'img');
  expect(svg.getAttribute('aria-label')).toBe('อ่าน, เขียน');
});

test('the same figure draws the same way every time', () => {
  const first = render(<Flow steps={['a', 'b']} highlight={0} />).container.innerHTML;
  const second = render(<Flow steps={['a', 'b']} highlight={0} />).container.innerHTML;
  expect(second).toBe(first);
});
