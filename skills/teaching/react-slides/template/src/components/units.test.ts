import { expect, test } from 'vitest';
import { fixtureUnits } from '../__fixtures__/DeckFixture';
import { chapterTitle, unitPosition, unitTitle } from './units';

test('unitPosition counts within the unit\'s chapter', () => {
  const found = unitPosition(fixtureUnits, 'u-b');
  expect(found && { n: found.n, m: found.m, chapter: found.chapter.id, title: found.unit.title }).toEqual({ n: 2, m: 3, chapter: '1.1', title: 'เรื่องสอง' });
  expect(unitPosition(fixtureUnits, 'u-d')).toMatchObject({ n: 1, m: 1 });
});

test('an unknown unit has no position', () => {
  expect(unitPosition(fixtureUnits, 'u-nope')).toBeNull();
  expect(unitPosition({ chapters: [] }, 'u-a')).toBeNull();
});

test('titles of units and chapters, or the id when unknown', () => {
  expect(unitTitle(fixtureUnits, 'u-c')).toBe('เรื่องสาม');
  expect(chapterTitle(fixtureUnits, '1.2')).toBe('บทสอง');
  expect(unitTitle(fixtureUnits, 'u-x')).toBe('u-x');
  expect(chapterTitle(fixtureUnits, '9.9')).toBe('9.9');
});
