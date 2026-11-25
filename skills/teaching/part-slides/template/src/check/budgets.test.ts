import { expect, test } from 'vitest';
import { budgets, idOrder } from './budgets';
import type { SlideInfo } from './findings';

let n = 0;
const slide = (section: string, over: Partial<SlideInfo> = {}): SlideInfo => ({ id: `1-${String(++n).padStart(3, '0')}`, section, divider: false, title: 't', chars: 40, ...over });
const divider = (section: string) => slide(section, { divider: true });
const topic = (section: string, phases: SlideInfo['phase'][]): SlideInfo[] => [divider(section), ...phases.map((phase) => slide(section, { phase }))];

const kinds = (found: ReturnType<typeof budgets>) => found.map((f) => `${f.slide}|${f.level}|${f.kind}`);

test('a topic of nine slides is fine and the tenth is a problem', () => {
  const nine = topic('ML', ['know', 'know', 'parts', 'parts', 'parts', 'parts', 'example', 'watchout']);
  expect(nine).toHaveLength(9);
  expect(budgets(nine, 'th')).toEqual([]);
  const ten = [...nine, slide('ML', { phase: 'watchout' })];
  const found = budgets(ten, 'th');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ slide: ten[9].id, kind: 'budget', level: 'problem' });
  expect(found[0].detail).toContain('9');
});

test('the Opening has at most three slides', () => {
  const three = [slide('Opening'), slide('Opening'), slide('Opening')];
  expect(budgets(three, 'th')).toEqual([]);
  const four = [...three, slide('Opening')];
  expect(kinds(budgets(four, 'th'))).toEqual([`${four[3].id}|problem|budget`]);
});

test('a Part of 41 slides is a problem, 36 a note and 35 fine', () => {
  const part = (count: number) => Array.from({ length: count }, () => slide('Opening'));
  // spread the slides over topics so the per-section limits are not what is under test
  const many = (count: number): SlideInfo[] => {
    const out: SlideInfo[] = [];
    for (let t = 0; out.length < count; t++) out.push(...topic(`T${t}`, ['know', 'parts', 'example']));
    return out.slice(0, count);
  };
  expect(part(0)).toEqual([]);
  expect(budgets(many(36), 'th').filter((f) => f.slide === '')).toMatchObject([{ level: 'note', kind: 'budget' }]);
  expect(budgets(many(35), 'th').filter((f) => f.slide === '')).toEqual([]);
  expect(budgets(many(41), 'th').filter((f) => f.slide === '')).toMatchObject([{ level: 'problem', kind: 'budget' }]);
});

test('prose over 160 characters is a problem in Thai, and fine in English up to 220', () => {
  const long = slide('Opening', { chars: 161 });
  expect(kinds(budgets([long], 'th'))).toEqual([`${long.id}|problem|budget`]);
  expect(budgets([slide('Opening', { chars: 160 })], 'th')).toEqual([]);
  expect(budgets([slide('Opening', { chars: 220 })], 'en')).toEqual([]);
  expect(budgets([slide('Opening', { chars: 221 })], 'en')).toHaveLength(1);
});

test('phases out of order name only the slide that breaks the order', () => {
  const slides = topic('ML', ['know', 'parts', 'example', 'parts']);
  const found = budgets(slides, 'th');
  expect(found).toHaveLength(1);
  expect(found[0].slide).toBe(slides[4].id);
  expect(found[0].detail).toContain('parts');
});

test('one misplaced slide does not flag the slides after it', () => {
  const slides = topic('ML', ['parts', 'know', 'know', 'know']);
  expect(budgets(slides, 'th').map((f) => f.slide)).toEqual([slides[2].id]);
});

test('a divider has no phase and does not break the order; a topic must start with its divider', () => {
  expect(budgets(topic('ML', ['know', 'parts']), 'th')).toEqual([]);
  const headless = [slide('ML', { phase: 'know' }), slide('ML', { phase: 'parts' })];
  expect(kinds(budgets(headless, 'th'))).toEqual([`${headless[0].id}|problem|budget`]);
});

test('a slide with no phase inside a topic does not break the order', () => {
  const slides = [divider('ML'), slide('ML', { phase: 'know' }), slide('ML'), slide('ML', { phase: 'parts' })];
  expect(budgets(slides, 'th')).toEqual([]);
});

test('a Part with only an Opening and a Closing has no findings', () => {
  expect(budgets([slide('Opening'), slide('Opening'), slide('Closing'), slide('Closing')], 'th')).toEqual([]);
});

// Slide ids run in the order the slides run.
const ids = (...list: string[]): SlideInfo[] => list.map((id) => ({ id, section: 'Topic', divider: false, title: 't', chars: 10 }));
const flagged = (found: ReturnType<typeof idOrder>) => found.map((f) => f.slide);

test('ids that ascend have no findings, gaps included', () => {
  expect(idOrder(ids('1-001', '1-002', '1-010'), 1)).toEqual([]);
});

test('a slide whose id is not greater than the one before is reported, and only that slide', () => {
  expect(flagged(idOrder(ids('3-014', '3-016', '3-015', '3-017'), 3))).toEqual(['3-015']);
});

test('one slide moved far ahead is one finding, not one for every slide after it', () => {
  expect(flagged(idOrder(ids('1-001', '1-009', '1-002', '1-003'), 1))).toEqual(['1-002']);
});

test('a repeated id is reported', () => {
  expect(flagged(idOrder(ids('1-001', '1-002', '1-002'), 1))).toEqual(['1-002']);
});

test.each(['1-5', 'x', '2-005', '1-0001', ''])('an id that is not <part>-<nnn> for this Part is reported: "%s"', (bad) => {
  expect(idOrder(ids('1-001', bad, '1-003'), 1)).toEqual([expect.objectContaining({ slide: bad, frame: '', kind: 'id-order', level: 'problem' })]);
});

test('the detail names the slide before and says to renumber', () => {
  const [finding] = idOrder(ids('1-002', '1-001'), 1);
  expect(finding).toMatchObject({ slide: '1-001', kind: 'id-order', level: 'problem' });
  expect(finding.detail).toMatch(/1-001.*1-002.*renumber/);
});

test('an empty Part has no findings', () => {
  expect(idOrder([], 1)).toEqual([]);
});
