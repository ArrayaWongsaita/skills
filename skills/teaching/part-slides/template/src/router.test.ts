import { expect, test } from 'vitest';
import { formatRoute, parseHash } from './router';

test('routes', () => {
  expect(parseHash('')).toEqual({ name: 'home' });
  expect(parseHash('#/')).toEqual({ name: 'home' });
  expect(parseHash('#/part-01')).toEqual({ name: 'part', part: 1 });
  expect(parseHash('#/part-01/1-015')).toEqual({ name: 'part', part: 1, slide: '1-015' });
  expect(parseHash('#/check/part-02')).toEqual({ name: 'check', part: 2 });
  expect(parseHash('#/nonsense')).toEqual({ name: 'home' });
});

test('part 10', () => {
  // Review Focus 2
  expect(parseHash('#/part-10/10-001')).toEqual({ name: 'part', part: 10, slide: '10-001' });
  expect(formatRoute({ name: 'part', part: 10, slide: '10-001' })).toBe('#/part-10/10-001');
  expect(formatRoute({ name: 'check', part: 3 })).toBe('#/check/part-03');
  expect(formatRoute({ name: 'home' })).toBe('#/');
});

test('round trip', () => {
  for (const hash of ['#/', '#/part-02', '#/part-02/2-007', '#/check/part-12']) {
    expect(formatRoute(parseHash(hash))).toBe(hash);
  }
});
