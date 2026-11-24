import { Children, createContext, isValidElement, type ReactElement, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery, useReducedMotion, useSwipe } from '../hooks';
import { loadProgress, saveProgress } from '../progress';
import { navigate, useRoute } from '../router';
import { Nav } from './Nav';
import { NO_TOPICS, type Place, phasePlaces } from './topics';
import type { Base, Block, DiagramDef, Listing, PartMeta, Topics, Units } from './types';
import { NO_UNITS } from './units';

export type Direction = 'forward' | 'back' | 'none';
export type Frame = 'desktop' | 'phone';

export type DeckValue = {
  meta: PartMeta;
  diagrams: Record<string, DiagramDef>;
  listings: Record<string, Listing>;
  outputs: Record<string, Block>;
  units: Units;
  /** The Part's topics (deck@3); empty for an earlier deck. */
  topics: Topics;
  /** The place of each slide that has a topic and a phase, among the slides of its phase. */
  places: Record<string, Place>;
  current: string;
  direction: Direction;
  reducedMotion: boolean;
  frame: Frame;
  ids: string[];
};

export const DeckContext = createContext<DeckValue | null>(null);
/** 'check' renders every slide in order, with no navigation, for the check page. */
export const DeckModeContext = createContext<'read' | 'check'>('read');
/** The frame the check page lays a slide out in; null means "follow the screen width". */
export const FrameContext = createContext<Frame | null>(null);

// A narrow screen, or a phone held sideways: the 16:9 frame would make the text too small to read.
export const PHONE_QUERY = '(max-width: 720px), (max-height: 500px)';

export function useDeck(): DeckValue {
  const value = useContext(DeckContext);
  if (!value) throw new globalThis.Error('useDeck must be used inside <Deck>');
  return value;
}

type Props = {
  meta: PartMeta;
  diagrams: Record<string, DiagramDef>;
  listings: Record<string, Listing>;
  outputs: Record<string, Block>;
  /** The Part's unit map; a deck@1 deck has none. */
  units?: Units;
  /** The Part's topic list; a deck@1 or deck@2 deck has none. */
  topics?: Topics;
  children: ReactNode;
};

function slidesOf(children: ReactNode): ReactElement<Base>[] {
  return Children.toArray(children).filter((child): child is ReactElement<Base> => isValidElement<Base>(child) && typeof child.props.id === 'string');
}

export function Deck(props: Props) {
  const mode = useContext(DeckModeContext);
  const slides = slidesOf(props.children);
  return mode === 'check' ? <CheckDeck {...props} slides={slides} /> : <ReadDeck {...props} slides={slides} />;
}

function useFrame(): Frame {
  const fixed = useContext(FrameContext);
  const phone = useMediaQuery(PHONE_QUERY);
  return fixed ?? (phone ? 'phone' : 'desktop');
}

function CheckDeck({ meta, diagrams, listings, outputs, units = NO_UNITS, topics = NO_TOPICS, slides }: Props & { slides: ReactElement<Base>[] }) {
  const frame = useFrame();
  const ids = slides.map((slide) => slide.props.id);
  const places = phasePlaces(slides);
  return (
    <div className={`rs-deck rs-${frame}`}>
      {slides.map((slide) => (
        <DeckContext.Provider
          key={slide.props.id}
          value={{ meta, diagrams, listings, outputs, units, topics, places, current: slide.props.id, direction: 'none', reducedMotion: true, frame, ids }}
        >
          <div className="rs-stage" data-check-slide={slide.props.id}>
            {slide}
          </div>
        </DeckContext.Provider>
      ))}
    </div>
  );
}

function ReadDeck({ meta, diagrams, listings, outputs, units = NO_UNITS, topics = NO_TOPICS, slides }: Props & { slides: ReactElement<Base>[] }) {
  const route = useRoute();
  const reducedMotion = useReducedMotion();
  const frame = useFrame();
  const ids = useMemo(() => slides.map((slide) => slide.props.id), [slides]);
  const places = useMemo(() => phasePlaces(slides), [slides]);
  const [saved] = useState(() => loadProgress(meta.course, meta.part));
  const requested = route.name === 'part' ? route.slide : undefined;
  const current = requested && ids.includes(requested) ? requested : !requested && saved.furthest && ids.includes(saved.furthest) ? saved.furthest : ids[0];
  const index = ids.indexOf(current);

  const [view, setView] = useState<{ id: string; direction: Direction }>({ id: current, direction: 'none' });
  let direction = view.direction;
  if (view.id !== current) {
    const before = ids.indexOf(view.id);
    direction = index === before + 1 && before >= 0 ? 'forward' : index < before ? 'back' : 'none';
    setView({ id: current, direction });
  }

  useEffect(() => {
    if (current && requested !== current) navigate({ name: 'part', part: meta.part, slide: current }, { replace: true });
  }, [current, requested, meta.part]);

  const furthest = useRef(saved.furthest);
  useEffect(() => {
    if (!current) return;
    if (!furthest.current || ids.indexOf(furthest.current) < ids.indexOf(current)) furthest.current = current;
    saveProgress(meta.course, meta.part, { last: current, furthest: furthest.current });
  }, [current, ids, meta.course, meta.part]);

  const go = (to: number) => {
    if (to >= 0 && to < ids.length && to !== index) navigate({ name: 'part', part: meta.part, slide: ids[to] }, { replace: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      // Space on a focused button, link or summary is that control's: it presses the copy button or opens the solution.
      if (event.key === ' ' && target?.closest?.('button, summary, a[href], [role="button"]')) return;
      const forward = event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey);
      const back = event.key === 'ArrowLeft' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey);
      if (!forward && !back) return;
      event.preventDefault();
      go(forward ? index + 1 : index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const root = useRef<HTMLDivElement>(null);
  useSwipe(root, { onLeft: () => go(index + 1), onRight: () => go(index - 1) });

  if (index < 0) return null;
  return (
    <DeckContext.Provider value={{ meta, diagrams, listings, outputs, units, topics, places, current, direction, reducedMotion, frame, ids }}>
      <div ref={root} className={`rs-deck rs-${frame}`}>
        <div key={current} className={reducedMotion ? 'rs-stage' : 'rs-stage rs-fade-slide'}>
          {slides[index]}
        </div>
        <Nav language={meta.language} index={index} total={ids.length} onPrev={() => go(index - 1)} onNext={() => go(index + 1)} />
      </div>
    </DeckContext.Provider>
  );
}
