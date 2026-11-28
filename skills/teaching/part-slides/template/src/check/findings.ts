// What the check page reports, from what it measured. Pure, so the rules are tested without a browser.
import type { Phase } from '../components/types';
import { MIN_FIT } from '../hooks';
import type { BoxOverflow } from '../components/overflow';

export type Frame = 'desktop' | 'phone';
export type Measurement = {
  slide: string;
  frame: Frame;
  prose: { scrollW: number; clientW: number; scrollH: number; clientH: number; fit: number }[];
  /** The code and output boxes that do not fit their space. */
  blocks: BoxOverflow[];
  /** The lines a code block shows, and how many of them are highlighted. */
  codeRows: number;
  highlightedRows: number;
  outOfCanvas: string[];
  /** Pairs of labels in the slide's drawings that sit on top of each other. */
  textOverlaps: number;
  fallback: boolean;
  /** Text boxes that do not scroll (a Compare panel, its takeaway) whose content is wider than they are: the rest is cut off. */
  clippedText?: { where: string; scrollW: number; clientW: number }[];
  /** Drawings that run past the slide's bottom or right edge, by how many px: the slide cuts that part off. */
  clippedDrawings?: { bottom: number; right: number }[];
};
export type FindingKind = 'prose-overflow' | 'out-of-canvas' | 'fallback' | 'font-missing' | 'console-error' | 'scrolling-block' | 'clipped-code' | 'wide-line' | 'highlight' | 'text-overlap' | 'budget' | 'id-order' | 'clipped-text' | 'clipped-drawing';
export type Finding = { slide: string; frame: string; kind: FindingKind; level: 'problem' | 'note'; detail: string };
/** What the check page knows about one slide, for the readability budgets and for the agent's slide list. */
export type SlideInfo = { id: string; section: string; phase?: Phase; divider: boolean; title: string; chars: number };
export type CheckResult = { course: string; part: number; done: boolean; findings: Finding[]; measurements: Measurement[]; slides: SlideInfo[] };

declare global {
  interface Window {
    __reactSlidesCheck?: CheckResult;
  }
}

/** One pixel of slack, since layout sizes round. */
const SLACK = 1;
const MAX_DETAIL = 300;

export function findings(ms: Measurement[], fontsOk: { mali: boolean; mono: boolean }, consoleErrors: string[]): Finding[] {
  const found: Finding[] = [];
  const once = new Map<string, Finding>();
  const perSlide = (m: Measurement, kind: FindingKind, detail: string) => {
    const key = `${m.slide}|${kind}`;
    const seen = once.get(key);
    if (seen) {
      if (seen.frame !== m.frame) seen.frame = 'both';
      return;
    }
    const finding: Finding = { slide: m.slide, frame: m.frame, kind, level: 'problem', detail };
    once.set(key, finding);
    found.push(finding);
  };

  for (const m of ms) {
    for (const p of m.prose) {
      const wide = p.scrollW > p.clientW + SLACK;
      const tall = p.scrollH > p.clientH + SLACK;
      if (m.frame === 'desktop' && (wide || tall) && p.fit <= MIN_FIT + 1e-9) {
        found.push({
          slide: m.slide, frame: m.frame, kind: 'prose-overflow', level: 'problem',
          detail: `content is ${p.scrollW}×${p.scrollH} px in a ${p.clientW}×${p.clientH} px slide, at the smallest text size (${Math.round(p.fit * 100)} %)`,
        });
      } else if (m.frame === 'phone' && wide) {
        found.push({ slide: m.slide, frame: m.frame, kind: 'prose-overflow', level: 'problem', detail: `content is ${p.scrollW} px wide on a ${p.clientW} px screen` });
      }
    }
    for (const clip of m.clippedText ?? []) {
      perSlide(m, 'clipped-text', `${clip.where} holds text ${clip.scrollW} px wide in ${clip.clientW} px: the rest is cut off; shorten it, excerpt the output, or break the line`);
    }
    for (const cut of m.clippedDrawings ?? []) {
      const where = [cut.bottom > 0 ? `${cut.bottom} px past the bottom` : '', cut.right > 0 ? `${cut.right} px past the right edge` : ''].filter(Boolean).join(' and ');
      perSlide(m, 'clipped-drawing', `a drawing runs ${where} of the slide, where it is cut off: draw it smaller, with fewer rows, or shorten the text beside it`);
    }
    for (const block of m.blocks) {
      if (block.hiddenRows > 0) {
        const lost = block.hiddenHighlight.map((n) => `; highlighted line ${n} is hidden`).join('');
        found.push({
          slide: m.slide, frame: m.frame, kind: 'clipped-code', level: 'problem',
          detail: `${block.hiddenRows} row(s) of code or output are cut off at the bottom: show fewer lines with \`lines\`, shorten the output, or drop the body${lost}`,
        });
      }
      if (block.wideLines.length === 0) continue;
      if (m.frame === 'phone') {
        found.push({ slide: m.slide, frame: m.frame, kind: 'scrolling-block', level: 'note', detail: `${block.wideLines.length} line(s) scroll sideways on the phone` });
      } else {
        const lines = block.wideLines.map(({ line, chars }) => `${line === null ? 'a line' : `line ${line}`} is ${chars} characters, the box fits ${block.fits}`);
        found.push({ slide: m.slide, frame: m.frame, kind: 'wide-line', level: 'problem', detail: `${lines.join('; ')}: excerpt it, or break it over several lines in the program` });
      }
    }
    if (m.highlightedRows * 2 > m.codeRows) perSlide(m, 'highlight', `${m.highlightedRows} of ${m.codeRows} code lines are highlighted: highlight the one place to look at, or nothing`);
    if (m.textOverlaps > 0) perSlide(m, 'text-overlap', `${m.textOverlaps} pair(s) of labels in a drawing overlap: move them apart or shorten them`);
    if (m.outOfCanvas.length > 0) perSlide(m, 'out-of-canvas', `diagram nodes outside the canvas: ${m.outOfCanvas.join(', ')}`);
    if (m.fallback) perSlide(m, 'fallback', 'shows its fallback: the illustration or screenshot is missing or failed to draw');
  }
  if (!fontsOk.mali) found.push({ slide: '', frame: '', kind: 'font-missing', level: 'problem', detail: 'Mali did not load' });
  if (!fontsOk.mono) found.push({ slide: '', frame: '', kind: 'font-missing', level: 'problem', detail: 'JetBrains Mono did not load' });
  for (const error of consoleErrors) {
    found.push({ slide: '', frame: '', kind: 'console-error', level: 'problem', detail: error.length > MAX_DETAIL ? `${error.slice(0, MAX_DETAIL)}…` : error });
  }
  return [...found.filter((f) => f.level === 'problem'), ...found.filter((f) => f.level === 'note')];
}
