import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { DeckValue } from '../__fixtures__/DeckFixture';
import { makeAssetLookup } from '../assets';
import type { Visual } from './types';
import { VisualSlot } from './Visual';

const diagramFallback = { kind: 'diagram' as const, diagram: 'd-loop', show: ['n-user', 'n-model', 'e-ask'], highlight: [], dim: [] };
const illustration: Visual = { kind: 'illustration', key: 'abcd1234', description: 'หุ่นยนต์', prompt: 'A robot', alt: 'หุ่นยนต์ถือกล่อง', fallback: diagramFallback };
const screenshot: Visual = { kind: 'screenshot', key: 'feed0001', url: 'https://x.y', capture: 'The docs page', fallback: { kind: 'text', text: '1. เปิดหน้า\n2. เลื่อนลง' } };
const none = { illustration: () => null, image: () => null };

test('image takes precedence over the drawn illustration', () => {
  const illustrationLoader = vi.fn(() => null);
  render(<DeckValue><VisualSlot visual={illustration} lookup={{ illustration: illustrationLoader, image: () => '/img/a.png' }} /></DeckValue>);
  expect(screen.getByRole('img', { name: 'หุ่นยนต์ถือกล่อง' })).toHaveAttribute('src', '/img/a.png');
  expect(illustrationLoader).not.toHaveBeenCalled();
});

test('a drawn illustration loads inside a described figure', async () => {
  const Drawing = () => <svg data-testid="drawing" />;
  const loader = () => Promise.resolve({ default: Drawing });
  render(<DeckValue direction="forward"><VisualSlot visual={illustration} lookup={{ illustration: () => loader, image: () => null }} /></DeckValue>);
  expect(await screen.findByTestId('drawing')).toBeInTheDocument();
  const figure = screen.getByRole('img', { name: 'หุ่นยนต์ถือกล่อง' });
  expect(figure.tagName).toBe('FIGURE');
});

test('missing illustration falls back to its diagram state without animation', () => {
  const { container } = render(<DeckValue direction="forward"><VisualSlot visual={illustration} lookup={none} /></DeckValue>);
  expect(container.querySelector('[data-el="n-model"]')).not.toBeNull();
  expect(container.querySelector('.rs-new')).toBeNull();
  expect(container.querySelector('.rs-draw')).toBeNull();
  expect(container.querySelector('[data-fallback]')).not.toBeNull();
});

test('missing screenshot falls back to text', () => {
  const { container } = render(<DeckValue><VisualSlot visual={screenshot} lookup={none} /></DeckValue>);
  const text = container.querySelector('[data-fallback]')!;
  expect(text).toHaveTextContent('1. เปิดหน้า');
  expect(text.querySelectorAll('br')).toHaveLength(1);
});

test('a captured screenshot shows with its capture as the description', () => {
  render(<DeckValue><VisualSlot visual={screenshot} lookup={{ illustration: () => null, image: () => '/img/s.png' }} /></DeckValue>);
  expect(screen.getByRole('img', { name: 'The docs page' })).toHaveAttribute('src', '/img/s.png');
});

test('a broken illustration falls back', async () => {
  const Broken = () => {
    throw new Error('bad drawing');
  };
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container, findByText } = render(
    <DeckValue><VisualSlot visual={{ ...screenshot, kind: 'illustration', description: 'd', prompt: 'p', alt: 'a' } as Visual} lookup={{ illustration: () => () => Promise.resolve({ default: Broken }), image: () => null }} /></DeckValue>,
  );
  expect(await findByText('2. เลื่อนลง', { exact: false })).toBeInTheDocument();
  expect(container.querySelector('[data-fallback]')).not.toBeNull();
  quiet.mockRestore();
});

test('two slides with the same key use the same file', () => {
  const loader = () => Promise.resolve({ default: () => null });
  const lookup = makeAssetLookup({ './illustrations/part-01/abcd1234.tsx': loader }, { './assets/images/part-02/feed0001.webp': '/a.webp' });
  expect(lookup.illustration(1, 'abcd1234')).toBe(loader);
  expect(lookup.illustration(1, 'abcd1234')).toBe(lookup.illustration(1, 'abcd1234'));
  expect(lookup.illustration(2, 'abcd1234')).toBeNull();
  expect(lookup.image(2, 'feed0001')).toBe('/a.webp');
  expect(lookup.image(10, 'feed0001')).toBeNull();
});

test('diagram visual renders the diagram, and animates only going forward', () => {
  const state: Visual = { ...diagramFallback, new: ['n-model'] };
  const forward = render(<DeckValue direction="forward"><VisualSlot visual={state} lookup={none} /></DeckValue>);
  expect(forward.container.querySelector('[data-el="n-model"] .rs-draw')).not.toBeNull();
  forward.unmount();
  const back = render(<DeckValue direction="back"><VisualSlot visual={state} lookup={none} /></DeckValue>);
  expect(back.container.querySelector('[data-el]')).not.toBeNull();
  expect(back.container.querySelector('.rs-draw')).toBeNull();
  back.unmount();
  const reduced = render(<DeckValue direction="forward" reducedMotion><VisualSlot visual={state} lookup={none} /></DeckValue>);
  expect(reduced.container.querySelector('.rs-draw')).toBeNull();
});
