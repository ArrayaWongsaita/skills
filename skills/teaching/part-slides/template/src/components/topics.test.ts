import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { fixtureTopics } from '../__fixtures__/DeckFixture';
import { NO_TOPICS, phasePlaces, topicPosition, topicTitle } from './topics';
import type { Base, Phase } from './types';

const slide = (id: string, topic?: string, phase?: Phase) => ({ props: { id, topic, phase } }) as unknown as ReactElement<Base>;

test('topicPosition counts the topic among the Part\'s topics', () => {
  const found = topicPosition(fixtureTopics, 't-b');
  expect(found && { n: found.n, m: found.m, title: found.topic.title }).toEqual({ n: 2, m: 3, title: 'หัวข้อสอง' });
  expect(topicPosition(fixtureTopics, 't-a')).toMatchObject({ n: 1, m: 3 });
});

test('an unknown topic has no position', () => {
  expect(topicPosition(fixtureTopics, 't-nope')).toBeNull();
  expect(topicPosition(NO_TOPICS, 't-a')).toBeNull();
});

test('a topic title falls back to the id', () => {
  expect(topicTitle(fixtureTopics, 't-c')).toBe('หัวข้อสาม');
  expect(topicTitle(fixtureTopics, 't-x')).toBe('t-x');
});

test('phasePlaces numbers the slides of one phase of one topic', () => {
  const places = phasePlaces([slide('1-001'), slide('1-002', 't-a', 'parts'), slide('1-003', 't-a', 'parts'), slide('1-004', 't-a', 'parts')]);
  expect([places['1-002'], places['1-003'], places['1-004']]).toEqual([{ n: 1, m: 3 }, { n: 2, m: 3 }, { n: 3, m: 3 }]);
  expect(places['1-001']).toBeUndefined();
});

test('a lone slide of a phase is 1/1', () => {
  expect(phasePlaces([slide('1-002', 't-a', 'example')])['1-002']).toEqual({ n: 1, m: 1 });
});

test('the same phase of two topics, and two phases of one topic, count apart', () => {
  const places = phasePlaces([
    slide('1-001', 't-a', 'know'), slide('1-002', 't-a', 'parts'), slide('1-003', 't-a', 'parts'),
    slide('1-004', 't-b', 'parts'), slide('1-005', 't-b', 'parts'), slide('1-006', 't-b', 'parts'),
  ]);
  expect(places['1-001']).toEqual({ n: 1, m: 1 });
  expect([places['1-002'], places['1-003']]).toEqual([{ n: 1, m: 2 }, { n: 2, m: 2 }]);
  expect(places['1-006']).toEqual({ n: 3, m: 3 });
});

test('a slide with a topic but no phase, such as a divider, has no place', () => {
  expect(phasePlaces([slide('1-001', 't-a'), slide('1-002', 't-a', 'know')])).toEqual({ '1-002': { n: 1, m: 1 } });
});
