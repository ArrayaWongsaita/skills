// What the check page reports, from what it measured. Pure, so the rules are tested without a browser.
import { MIN_FIT } from '../hooks';

export type Frame = 'desktop' | 'phone';
export type Measurement = {
  slide: string;
  frame: Frame;
  prose: { scrollW: number; clientW: number; scrollH: number; clientH: number; fit: number }[];
  scrollingBlocks: number;
  outOfCanvas: string[];
  fallback: boolean;
};
export type FindingKind = 'prose-overflow' | 'out-of-canvas' | 'fallback' | 'font-missing' | 'console-error' | 'scrolling-block';
export type Finding = { slide: string; frame: string; kind: FindingKind; level: 'problem' | 'note'; detail: string };
export type CheckResult = { part: number; done: boolean; findings: Finding[]; measurements: Measurement[] };

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
    if (m.scrollingBlocks > 0) {
      found.push({ slide: m.slide, frame: m.frame, kind: 'scrolling-block', level: 'note', detail: `${m.scrollingBlocks} block(s) scroll inside their box` });
    }
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
