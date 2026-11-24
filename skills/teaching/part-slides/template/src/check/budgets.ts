// The readability budgets of a Part, from what the check page read off its slides. Pure, so the rules are tested without a browser.
import type { Phase } from '../components/types';
import type { Finding, SlideInfo } from './findings';

/** Every number a budget uses is here and nowhere else; part-slides' plan-list brief quotes them. */
export const TOPIC_MAX = 9;
export const OPENING_MAX = 3;
export const PART_MAX = 40;
export const PART_NOTE_FROM = 35;
export const PROSE_MAX_THAI = 160;
export const PROSE_MAX_OTHER = 220;

const PHASES: Phase[] = ['know', 'parts', 'example', 'watchout', 'check'];
const NOT_TOPICS = ['Opening', 'Closing'];

const problem = (slide: string, detail: string): Finding => ({ slide, frame: '', kind: 'budget', level: 'problem', detail });

export function budgets(slides: SlideInfo[], language: string): Finding[] {
  const found: Finding[] = [];
  const proseMax = language === 'th' ? PROSE_MAX_THAI : PROSE_MAX_OTHER;

  for (const slide of slides) {
    if (slide.chars > proseMax) found.push(problem(slide.id, `the text is ${slide.chars} characters, over the ${proseMax} a slide may hold: split it into two slides`));
  }

  const sections = new Map<string, SlideInfo[]>();
  for (const slide of slides) sections.set(slide.section, [...(sections.get(slide.section) ?? []), slide]);

  for (const [section, inSection] of sections) {
    if (section === 'Opening') {
      if (inSection.length > OPENING_MAX) found.push(problem(inSection[OPENING_MAX].id, `the Opening has ${inSection.length} slides; at most ${OPENING_MAX}`));
      continue;
    }
    if (NOT_TOPICS.includes(section)) continue;
    if (inSection.length > TOPIC_MAX) found.push(problem(inSection[TOPIC_MAX].id, `topic "${section}" has ${inSection.length} slides; at most ${TOPIC_MAX} including its divider`));
    if (!inSection[0].divider) found.push(problem(inSection[0].id, `topic "${section}" does not start with its divider`));
    let before: Phase | undefined;
    for (const slide of inSection) {
      if (!slide.phase) continue;
      if (before && PHASES.indexOf(slide.phase) < PHASES.indexOf(before)) found.push(problem(slide.id, `phase ${slide.phase} comes after ${before}; the order is ${PHASES.join(', ')}`));
      before = slide.phase;
    }
  }

  if (slides.length > PART_MAX) found.push(problem('', `the Part has ${slides.length} slides; at most ${PART_MAX}`));
  else if (slides.length > PART_NOTE_FROM) found.push({ slide: '', frame: '', kind: 'budget', level: 'note', detail: `the Part has ${slides.length} slides; it is near the ${PART_MAX} limit` });
  return found;
}
