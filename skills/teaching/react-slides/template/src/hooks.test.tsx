import { render } from '@testing-library/react';
import { useRef } from 'react';
import { expect, test } from 'vitest';
import { useAutoFit } from './hooks';

function Fitted() {
  const ref = useRef<HTMLElement>(null);
  useAutoFit(ref, true);
  return (
    <section ref={ref}>
      <details>
        <summary>solution</summary>
        <p>long</p>
      </details>
    </section>
  );
}

test('auto-fit runs again when a solution opens, and lets the slide scroll when 85 % is not enough', () => {
  const { container } = render(<Fitted />);
  const section = container.querySelector('section')!;
  const details = container.querySelector('details')!;
  Object.defineProperty(section, 'clientHeight', { configurable: true, value: 700 });
  Object.defineProperty(section, 'scrollHeight', { configurable: true, get: () => (details.open ? 1100 : 600) });

  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  expect(section.dataset.fit).toBe('0.85');
  expect(section.dataset.overflow).toBe('true');

  details.open = false;
  details.dispatchEvent(new Event('toggle'));
  expect(section.dataset.fit).toBe('1');
  expect(section.dataset.overflow).toBe('false');
});
