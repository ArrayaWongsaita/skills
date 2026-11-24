import { expect, test, vi } from 'vitest';
import { loadProgress, saveProgress } from './progress';

test('round trip', () => {
  saveProgress('c', 1, { last: '1-003', furthest: '1-007' });
  expect(loadProgress('c', 1)).toEqual({ last: '1-003', furthest: '1-007' });
  expect(window.localStorage.getItem('react-slides:c:part-01')).not.toBeNull();
});

test('courses and parts do not share progress', () => {
  saveProgress('c', 1, { last: '1-003' });
  expect(loadProgress('d', 1)).toEqual({});
  expect(loadProgress('c', 2)).toEqual({});
});

test('garbage in storage reads as no progress', () => {
  window.localStorage.setItem('react-slides:c:part-01', '{not json');
  expect(loadProgress('c', 1)).toEqual({});
  window.localStorage.setItem('react-slides:c:part-01', '{"last": 3}');
  expect(loadProgress('c', 1)).toEqual({});
});

test('blocked storage breaks nothing', () => {
  const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(() => saveProgress('c', 1, { last: '1-001' })).not.toThrow();
  expect(loadProgress('c', 1)).toEqual({});
  spy.mockRestore();
});
