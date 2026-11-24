import { render } from '@testing-library/react';
import { useRef } from 'react';
import { expect, test } from 'vitest';
import { neededHeight, useAutoFit } from './hooks';

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

function WithBody() {
  const ref = useRef<HTMLElement>(null);
  useAutoFit(ref, true);
  return (
    <section ref={ref}>
      <div className="rs-slide-body">long list</div>
      <footer>sources</footer>
    </section>
  );
}

test('text that spills out of the slide body over the footer, inside the frame, still shrinks and still counts as overflow at 85 %', () => {
  const { container } = render(<WithBody />);
  const section = container.querySelector('section')!;
  const body = container.querySelector<HTMLElement>('.rs-slide-body')!;
  Object.defineProperty(section, 'clientHeight', { configurable: true, value: 700 });
  Object.defineProperty(section, 'scrollHeight', { configurable: true, value: 700 });
  Object.defineProperty(body, 'clientHeight', { configurable: true, value: 400 });
  Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 480 });

  expect(neededHeight(section)).toBe(780);
  section.dispatchEvent(new Event('toggle'));
  expect(section.dataset.fit).toBe('0.85');
  expect(section.dataset.overflow).toBe('true');
});
