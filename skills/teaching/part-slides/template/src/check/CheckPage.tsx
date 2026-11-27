// #/check/part-NN: every slide of a Part in its final state, at 1280 × 720 and 390 × 844, measured and reported.
// The agent reads window.__reactSlidesCheck through its browser tool; a person reads the table.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { DeckModeContext, FrameContext } from '../components/Deck';
import type { BoxOverflow } from '../components/overflow';
import { neededHeight } from '../hooks';
import type { PartEntry } from '../parts';
import { consoleErrors } from './console';
import { budgets, idOrder } from './budgets';
import { type Finding, findings, type Frame, type Measurement, type SlideInfo } from './findings';
import { countOverlaps } from './overlap';

const FRAMES: { frame: Frame; width: number; height: number }[] = [
  { frame: 'desktop', width: 1280, height: 720 },
  { frame: 'phone', width: 390, height: 844 },
];
const WAIT_MS = 50;
const WAIT_LIMIT_MS = 10000;
/** Time for lazy illustrations, icons and auto-fit to finish after the slides appear. */
const SETTLE_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fontLoads(spec: string): Promise<boolean> {
  // fonts.check() is true for a family that was never declared, so ask the set to load the face instead.
  if (typeof document === 'undefined' || !document.fonts?.load) return true;
  try {
    return (await document.fonts.load(spec, 'กa')).length > 0;
  } catch {
    return false;
  }
}

/** What a code or output box wrote about itself (see `useScrolls` in components/code.tsx). */
function readOverflow(box: HTMLElement): BoxOverflow {
  const list = (value: string | undefined) => (value ? value.split(',') : []);
  return {
    hiddenRows: Number(box.dataset.hiddenRows ?? '0'),
    hiddenHighlight: list(box.dataset.hiddenHighlight).map(Number),
    wideLines: list(box.dataset.wideLines).map((entry) => {
      const [line, chars] = entry.split(':');
      return { line: line === '-' ? null : Number(line), chars: Number(chars) };
    }),
    fits: Number(box.dataset.fits ?? '0'),
  };
}

function measure(root: HTMLElement): Measurement[] {
  const out: Measurement[] = [];
  for (const frameEl of root.querySelectorAll<HTMLElement>('[data-frame]')) {
    const frame = frameEl.dataset.frame as Frame;
    for (const stage of frameEl.querySelectorAll<HTMLElement>('[data-check-slide]')) {
      const slide = stage.querySelector<HTMLElement>('.rs-slide');
      const outside = [...stage.querySelectorAll<HTMLElement>('[data-out-of-canvas]')].flatMap((el) => (el.dataset.outOfCanvas ?? '').split(','));
      out.push({
        slide: stage.dataset.checkSlide ?? '',
        frame,
        prose: slide
          ? [{ scrollW: slide.scrollWidth, clientW: slide.clientWidth, scrollH: neededHeight(slide), clientH: slide.clientHeight, fit: Number(slide.dataset.fit ?? '1') }]
          : [],
        blocks: [...stage.querySelectorAll<HTMLElement>('[data-scrolls="true"], [data-scrolls-x="true"]')].map(readOverflow),
        codeRows: stage.querySelectorAll('.rs-codeblock .rs-row').length,
        highlightedRows: stage.querySelectorAll('.rs-codeblock .rs-hl').length,
        textOverlaps: [...stage.querySelectorAll('svg')].reduce((sum, svg) => sum + countOverlaps([...svg.querySelectorAll('text')].map((label) => label.getBoundingClientRect())), 0),
        outOfCanvas: [...new Set(outside.filter(Boolean))],
        fallback: stage.querySelector('[data-fallback]') !== null,
      });
    }
  }
  return out;
}

/**
 * The prose a reader has to take in: the title and the text beside the picture. Left out: code and its output, the
 * code line of an Anatomy strip, and the template's own field labels (an Error slide's "symptom", "cause", "fix").
 */
function proseChars(slide: HTMLElement): number {
  const parts = [...slide.querySelectorAll<HTMLElement>('.rs-title, .rs-prose')].map((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const skip of copy.querySelectorAll('pre, .rs-codeblock, .rs-output, .rs-block, .rs-anatomy-strip, .rs-label')) skip.remove();
    return copy.textContent ?? '';
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim().length;
}

/** One entry per slide, read from the desktop layout. */
function readSlides(root: HTMLElement): SlideInfo[] {
  const frame = root.querySelector<HTMLElement>('[data-frame="desktop"]');
  if (!frame) return [];
  return [...frame.querySelectorAll<HTMLElement>('[data-check-slide]')].map((stage) => {
    const slide = stage.querySelector<HTMLElement>('.rs-slide');
    const phase = slide?.dataset.phase;
    return {
      id: stage.dataset.checkSlide ?? '',
      section: slide?.dataset.section ?? '',
      ...(phase ? { phase: phase as SlideInfo['phase'] } : {}),
      divider: slide?.classList.contains('rs-divider') ?? false,
      title: slide?.querySelector('.rs-title')?.textContent?.trim() ?? '',
      chars: slide ? proseChars(slide) : 0,
    };
  });
}

export function CheckPage({ entry }: { entry: PartEntry }) {
  const Part = useMemo(() => lazy(entry.load), [entry]);
  const root = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Finding[] | null>(null);
  const part = entry.meta.part;
  const course = entry.meta.course;

  useEffect(() => {
    let cancelled = false;
    window.__reactSlidesCheck = { course, part, done: false, findings: [], measurements: [], slides: [] };
    (async () => {
      const expected = entry.meta.slideCount * FRAMES.length;
      for (let waited = 0; waited < WAIT_LIMIT_MS; waited += WAIT_MS) {
        if ((root.current?.querySelectorAll('[data-check-slide]').length ?? 0) >= expected) break;
        await sleep(WAIT_MS);
      }
      await document.fonts?.ready;
      const fonts = { mali: await fontLoads('16px Mali'), mono: await fontLoads('16px "JetBrains Mono"') };
      await sleep(SETTLE_MS);
      if (cancelled || !root.current) return;
      const measurements = measure(root.current);
      const slides = readSlides(root.current);
      const budget = [...budgets(slides, entry.meta.language), ...idOrder(slides, part)];
      const all = findings(measurements, fonts, consoleErrors());
      const found = [...all.filter((f) => f.level === 'problem'), ...budget.filter((f) => f.level === 'problem'), ...all.filter((f) => f.level === 'note'), ...budget.filter((f) => f.level === 'note')];
      setResult(found);
      window.__reactSlidesCheck = { course, part, done: true, findings: found, measurements, slides };
    })();
    return () => {
      cancelled = true;
    };
  }, [entry, course, part]);

  return (
    <div className="rs-check" ref={root}>
      <h1>
        Check · Part {part} · {entry.meta.title}
      </h1>
      <table className="rs-check-table">
        <thead>
          <tr>
            <th>slide</th>
            <th>frame</th>
            <th>kind</th>
            <th>level</th>
            <th>detail</th>
          </tr>
        </thead>
        <tbody>
          {result === null ? (
            <tr>
              <td colSpan={5}>checking…</td>
            </tr>
          ) : result.length === 0 ? (
            <tr>
              <td colSpan={5}>no findings</td>
            </tr>
          ) : (
            result.map((f, index) => (
              <tr key={index} data-level={f.level}>
                <td>{f.slide}</td>
                <td>{f.frame}</td>
                <td>{f.kind}</td>
                <td>{f.level}</td>
                <td>{f.detail}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <DeckModeContext.Provider value="check">
        <div className="rs-check-frames">
          {FRAMES.map(({ frame, width, height }) => (
            <section key={frame} className="rs-check-frame" data-frame={frame}>
              <h2>
                {frame} · {width} × {height}
              </h2>
              <FrameContext.Provider value={frame}>
                <Suspense fallback={null}>
                  <Part />
                </Suspense>
              </FrameContext.Provider>
            </section>
          ))}
        </div>
      </DeckModeContext.Provider>
    </div>
  );
}
