import { expect, test } from 'vitest';
import { fixtureMeta, fixtureTopics, fixtureUnits } from '../__fixtures__/DeckFixture';
import type { Base } from './types';
import { whereOf } from './where';

const slide = (over: Partial<Base> = {}): Base => ({ id: '1-020', section: '1.1 หัวข้อ', ...over });
const context = (over: Partial<Parameters<typeof whereOf>[0]> = {}) => ({ meta: fixtureMeta, units: fixtureUnits, topics: fixtureTopics, places: {}, ...over });

test('the place names the Part, the section and the topic of a slide', () => {
  expect(whereOf(context(), slide({ topic: 't-a' })).place).toBe('Part 1 · 1.1 หัวข้อ · หัวข้อแรก');
});

test('a topic named like its section heading is named once', () => {
  const same = { topics: [{ id: 't-a', section: '1.1', title: 'หัวข้อ', components: [] }] };
  expect(whereOf(context({ topics: same }), slide({ topic: 't-a' })).place).toBe('Part 1 · 1.1 หัวข้อ');
});

test('a topic that is not in the list adds nothing', () => {
  expect(whereOf(context(), slide({ topic: 't-ghost' })).place).toBe('Part 1 · 1.1 หัวข้อ');
});

test('a unit of a deck@2 Part is named', () => {
  expect(whereOf(context(), slide({ unit: 'u-a' })).place).toBe('Part 1 · 1.1 หัวข้อ · เรื่อง 1/3 เรื่องหนึ่ง');
});

test('opening and closing use the interface language', () => {
  expect(whereOf(context(), slide({ section: 'Opening' })).place).toBe('Part 1 · เปิดบท');
  expect(whereOf(context({ meta: { ...fixtureMeta, language: 'en' } }), slide({ section: 'Closing' })).place).toBe('Part 1 · Closing');
});

test('the phase shows its place among the slides of its phase, or alone when it is the only one', () => {
  const places = { '1-020': { n: 2, m: 3 }, '1-021': { n: 1, m: 1 } };
  expect(whereOf(context({ places }), slide({ phase: 'parts' })).phase).toBe('ส่วนประกอบ · 2/3');
  expect(whereOf(context({ places }), slide({ id: '1-021', phase: 'example' })).phase).toBe('ตัวอย่าง');
});

test('a slide with no phase has no phase label', () => {
  expect(whereOf(context(), slide()).phase).toBeNull();
});

test('the five phase labels in Thai and in English', () => {
  const phases = ['know', 'parts', 'example', 'watchout', 'check'] as const;
  expect(phases.map((phase) => whereOf(context(), slide({ phase })).phase)).toEqual(['รู้จัก', 'ส่วนประกอบ', 'ตัวอย่าง', 'ระวัง', 'ทบทวน']);
  const en = context({ meta: { ...fixtureMeta, language: 'en' } });
  expect(phases.map((phase) => whereOf(en, slide({ phase })).phase)).toEqual(['Know it', 'Parts', 'Examples', 'Watch out', 'Check']);
});
