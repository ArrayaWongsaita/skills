import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MiniPart, miniMeta } from '../__fixtures__/MiniPart';
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
