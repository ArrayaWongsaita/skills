import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MiniPart } from '../__fixtures__/MiniPart';
import { DeckFixture, fixtureTopics } from '../__fixtures__/DeckFixture';
import { useDeck } from './Deck';
import { loadProgress, saveProgress } from '../progress';
import { navigate, type Route } from '../router';

const route = vi.hoisted(() => ({ current: { name: 'part', part: 1 } as Route }));
vi.mock('../router', async (original) => ({
  ...(await original<typeof import('../router')>()),
  useRoute: () => route.current,
  navigate: vi.fn(),
}));

const lastNavigation = () => vi.mocked(navigate).mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.mocked(navigate).mockClear();
  route.current = { name: 'part', part: 1 };
});

test('shows the routed slide and its counter', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  render(<MiniPart />);
  expect(screen.getByText('second body')).toBeInTheDocument();
  expect(screen.queryByText('first body')).toBeNull();
  expect(screen.getByText('2 / 3')).toBeInTheDocument();
});

test('the top line names the Part and the section', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  render(<MiniPart />);
  expect(screen.getByText(/Part 1 · 1\.1 หัวข้อ/)).toBeInTheDocument();
});

test('a slide in a unit names the unit in the top line', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  const { container } = render(<MiniPart />);
  expect(container.querySelector('.rs-topline')).toHaveTextContent('Part 1 · 1.1 หัวข้อ · เรื่อง 1/2 เรื่องแรก');
});

test('a slide outside a unit keeps the plain top line', () => {
  route.current = { name: 'part', part: 1, slide: '1-003' };
  const { container } = render(<MiniPart />);
  expect(container.querySelector('.rs-topline')?.textContent).toBe('Part 1 · ปิดบท');
});

test('opening and closing sections use the interface language', () => {
  route.current = { name: 'part', part: 1, slide: '1-001' };
  render(<MiniPart />);
  expect(screen.getByText(/Part 1 · เปิดบท/)).toBeInTheDocument();
});

test('ArrowRight navigates forward', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  render(<MiniPart />);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-003' });
  fireEvent.keyDown(window, { key: 'PageUp' });
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-001' });
});

test('Space on a focused button or summary works the control and leaves the slide alone', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  const { container } = render(<MiniPart />);
  const button = container.querySelector('.rs-deck button') as HTMLElement;
  expect(fireEvent.keyDown(button, { key: ' ' })).toBe(true);
  const summary = document.createElement('summary');
  container.querySelector('.rs-slide')!.append(summary);
  expect(fireEvent.keyDown(summary, { key: ' ', shiftKey: true })).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'ArrowRight' });
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-003' });
});

test('a phone held sideways gets the phone layout', () => {
  const viewport = { width: 844, height: 390 };
  const matches = (query: string) =>
    query.split(',').some((part) =>
      [...part.matchAll(/\(max-(width|height):\s*(\d+)px\)/g)].every(([, side, px]) => viewport[side as 'width' | 'height'] <= Number(px)),
    );
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches(query), media: query, addEventListener() {}, removeEventListener() {} }));
  try {
    route.current = { name: 'part', part: 1, slide: '1-002' };
    const { container } = render(<MiniPart />);
    expect(container.querySelector('.rs-deck')).toHaveClass('rs-phone');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('keys with a modifier are left to the browser', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  render(<MiniPart />);
  fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
  expect(navigate).not.toHaveBeenCalled();
});

test('first slide disables previous', () => {
  route.current = { name: 'part', part: 1, slide: '1-001' };
  render(<MiniPart />);
  expect(screen.getByRole('button', { name: 'หน้าก่อน' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'หน้าถัดไป' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-002' });
});

test('unknown slide id', () => {
  // Review Focus 4: an id from an older numbering opens the first slide.
  route.current = { name: 'part', part: 1, slide: '1-099' };
  render(<MiniPart />);
  expect(screen.getByText('first body')).toBeInTheDocument();
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-001' });
});

test('resumes the furthest slide', () => {
  saveProgress('c', 1, { last: '1-001', furthest: '1-003' });
  render(<MiniPart />);
  expect(screen.getByText('third body')).toBeInTheDocument();
});

test('a stale saved slide id starts at the first slide', () => {
  // Review Focus 4: progress saved before the deck was renumbered.
  saveProgress('c', 1, { furthest: '1-042' });
  render(<MiniPart />);
  expect(screen.getByText('first body')).toBeInTheDocument();
});

test('progress keeps the furthest slide', () => {
  saveProgress('c', 1, { furthest: '1-003' });
  route.current = { name: 'part', part: 1, slide: '1-002' };
  render(<MiniPart />);
  expect(loadProgress('c', 1)).toEqual({ last: '1-002', furthest: '1-003' });
});

test('vertical swipe does not navigate', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  const { container } = render(<MiniPart />);
  const deck = container.querySelector('.rs-deck')!;
  fireEvent.touchStart(deck, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchEnd(deck, { changedTouches: [{ clientX: 10, clientY: 200 }] });
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.touchStart(deck, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(deck, { changedTouches: [{ clientX: 20, clientY: 10 }] });
  expect(lastNavigation()).toEqual({ name: 'part', part: 1, slide: '1-003' });
});

test('a swipe that starts on a block that scrolls sideways is left to the block', () => {
  route.current = { name: 'part', part: 1, slide: '1-002' };
  const { container } = render(<MiniPart />);
  const wide = container.querySelector('[data-direction]') as HTMLElement;
  wide.style.overflowX = 'auto';
  Object.defineProperty(wide, 'scrollWidth', { configurable: true, value: 800 });
  Object.defineProperty(wide, 'clientWidth', { configurable: true, value: 300 });
  fireEvent.touchStart(wide, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(wide, { changedTouches: [{ clientX: 20, clientY: 10 }] });
  expect(navigate).not.toHaveBeenCalled();
});

test('direction', () => {
  route.current = { name: 'part', part: 1, slide: '1-001' };
  const { rerender } = render(<MiniPart />);
  const direction = () => document.querySelector('[data-direction]')!.getAttribute('data-direction');
  expect(direction()).toBe('none');
  route.current = { name: 'part', part: 1, slide: '1-002' };
  rerender(<MiniPart />);
  expect(direction()).toBe('forward');
  rerender(<MiniPart />);
  expect(direction()).toBe('forward');
  route.current = { name: 'part', part: 1, slide: '1-001' };
  rerender(<MiniPart />);
  expect(direction()).toBe('back');
  route.current = { name: 'part', part: 1, slide: '1-003' };
  rerender(<MiniPart />);
  expect(direction()).toBe('none');
});

test('slides fade in unless motion is reduced', () => {
  route.current = { name: 'part', part: 1, slide: '1-001' };
  const { container, unmount } = render(<MiniPart />);
  expect(container.querySelector('.rs-fade-slide')).not.toBeNull();
  unmount();
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} })) as never;
  const again = render(<MiniPart />);
  expect(again.container.querySelector('.rs-fade-slide')).toBeNull();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

function Probe(props: { id: string; section: string; purpose: string; from: string[]; sources: string[] }) {
  const { topics, places } = useDeck();
  return <div data-probe={props.id}>{JSON.stringify({ topics: topics.topics.map((topic) => topic.id), place: places[props.id] ?? null })}</div>;
}

test('the deck context carries the topic list and the place of every slide in its phase', () => {
  const at = (id: string) => ({ id, section: 's', purpose: 'p', from: [], sources: [], topic: 't-a', phase: 'parts' as const });
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Probe {...at('1-001')} />
      <Probe {...at('1-002')} />
    </DeckFixture>,
  );
  expect(JSON.parse(container.querySelector('[data-probe="1-002"]')!.textContent!)).toEqual({ topics: ['t-a', 't-b', 't-c'], place: { n: 2, m: 2 } });
});

test('a deck with no topic list has an empty one', () => {
  const { container } = render(<DeckFixture><Probe id="1-001" section="s" purpose="p" from={[]} sources={[]} /></DeckFixture>);
  expect(JSON.parse(container.querySelector('[data-probe="1-001"]')!.textContent!)).toEqual({ topics: [], place: null });
});
