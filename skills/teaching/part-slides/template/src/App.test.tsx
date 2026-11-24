import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';
import { iconUrl } from './icon';

test('the browser tab shows the course icon', () => {
  document.head.innerHTML = '';
  render(<App />);
  const link = document.head.querySelector('link[rel~="icon"]');
  expect(iconUrl).toBeTruthy();
  expect(link).toHaveAttribute('href', iconUrl!);
});
