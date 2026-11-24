import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MiniPart, miniMeta } from '../__fixtures__/MiniPart';
import { TopicPart, topicMeta } from '../__fixtures__/TopicPart';
import { CheckPage } from './CheckPage';

vi.mock('../router', async (original) => ({
  ...(await original<typeof import('../router')>()),
  useRoute: () => ({ name: 'check', part: 1 }),
  navigate: vi.fn(),
}));

test('the check page lays out every slide twice and publishes its findings', async () => {
  const entry = { meta: miniMeta, load: () => Promise.resolve({ default: MiniPart }) };
  const { container } = render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
  expect(container.querySelectorAll('[data-frame="desktop"] [data-check-slide]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-frame="phone"] [data-check-slide]')).toHaveLength(3);
  expect(window.__reactSlidesCheck!.part).toBe(1);
  expect(Array.isArray(window.__reactSlidesCheck!.findings)).toBe(true);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(container.querySelector('.rs-nav')).toBeNull();
});

test('a deck@3 Part with a divider, an anatomy and an example is laid out twice with no findings', async () => {
  const entry = { meta: topicMeta, load: () => Promise.resolve({ default: TopicPart }) };
  const { container } = render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
  for (const frame of ['desktop', 'phone']) {
    expect([...container.querySelectorAll(`[data-frame="${frame}"] [data-check-slide]`)].map((el) => el.getAttribute('data-check-slide'))).toEqual(['1-001', '1-002', '1-003']);
  }
  expect(container.querySelector('[data-frame="desktop"] .rs-anatomy-strip')).toHaveTextContent('nums.map((x) => x * 2)');
  expect(container.querySelector('[data-frame="phone"] .rs-example .rs-output')).toHaveTextContent('[2, 4, 6]');
  expect(window.__reactSlidesCheck!.findings.filter((finding) => finding.level === 'problem')).toEqual([]);
});

test('a slide whose body spills over the sources footer inside the frame is a prose-overflow problem at 85 %', async () => {
  const isBody = (el: Element) => el.classList.contains('rs-slide-body');
  const scroll = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) { return isBody(this) ? 480 : 700; });
  const client = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return isBody(this) ? 400 : 700; });
  try {
    const entry = { meta: miniMeta, load: () => Promise.resolve({ default: MiniPart }) };
    render(<CheckPage entry={entry} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
    const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'prose-overflow' && f.frame === 'desktop');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.detail).toContain('780');
  } finally {
    scroll.mockRestore();
    client.mockRestore();
  }
});
