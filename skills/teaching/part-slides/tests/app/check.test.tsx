// Copied into a scaffolded app by tests/test_app_build.py: the fixture Part passes its own check page.
import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CheckPage } from './check/CheckPage';
import { meta } from './parts/part-01.data';

vi.mock('./router', async (original) => ({ ...(await original<typeof import('./router')>()), useRoute: () => ({ name: 'check', part: 1 }), navigate: vi.fn() }));

test('the fixture Part is laid out, listed and has no problem findings', async () => {
  const { container } = render(<CheckPage entry={{ meta, load: () => import('./parts/part-01') }} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 8000 });
  const result = window.__reactSlidesCheck!;
  expect(result.slides.map((s) => s.id)).toEqual(Array.from({ length: 10 }, (_, i) => `1-${String(i + 1).padStart(3, '0')}`));
  expect(result.slides.filter((s) => s.divider).map((s) => s.id)).toEqual(['1-003']);
  expect(result.findings.filter((f) => f.level === 'problem')).toEqual([]);
  expect(container.querySelector('[data-frame="desktop"] .rs-example .rs-output')).toHaveTextContent("['al', 'mia', 'zed']");
  expect(container.querySelector('[data-frame="desktop"] .rs-anatomy-strip')).toHaveTextContent('names.sort()');
});
