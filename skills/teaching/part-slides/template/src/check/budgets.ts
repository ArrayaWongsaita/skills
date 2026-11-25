// The readability budgets of a Part and the order of its slide ids, from what the check page read off its slides. Pure, so the rules are
// tested without a browser. The id check lives here, not in a file of its own: scaffold.py adds only missing files to an existing course,
// and a new file that needs this version of findings.ts would break the build of a course made before it.
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

const idProblem = (slide: string, detail: string): Finding => ({ slide, frame: '', kind: 'id-order', level: 'problem', detail });

/** Each slide, in file order, whose id is not `<part>-<nnn>` or is not greater than the valid id just before it, so one moved slide is one finding. */
export function idOrder(slides: SlideInfo[], part: number): Finding[] {
  const found: Finding[] = [];
  const shape = new RegExp(`^${part}-(\\d{3})$`);
  let previous: { id: string; n: number } | undefined;
  for (const { id } of slides) {
    const match = shape.exec(id);
    if (!match) {
      found.push(idProblem(id, `id "${id}" is not ${part}-<nnn>: number the slides of Part ${part} as ${part}-001, ${part}-002, …`));
      continue;
    }
    const n = Number(match[1]);
    if (previous && n <= previous.n) found.push(idProblem(id, `id ${id} comes after ${previous.id} in the file: renumber the slides so the ids run in the order the slides run`));
    previous = { id, n };
  }
  return found;
}
