import { type ReactNode, useRef } from 'react';
import { useAutoFit } from '../hooks';
import { formatRoute } from '../router';
import { type StringKey, t } from '../strings';
import { useDeck } from './Deck';
import { topicPosition } from './topics';
import type { Base, Phase, Rich } from './types';
import { unitPosition } from './units';

type Props = {
  slide: Base;
  title?: Rich;
  children?: ReactNode;
  visual?: ReactNode;
  /** The content takes the full width, as on code and compare slides. */
  wide?: boolean;
  /** The sources slide lists its sources itself. */
  hideSources?: boolean;
  /** The field the heading shows: `question` and `answer` slides have no title. */
  titleField?: string;
  /** A short line above the title, such as a divider's "Unit 2/3". Not a deck field. It wins over the phase label. */
  kicker?: ReactNode;
  className?: string;
};

const PHASE_LABELS: Record<Phase, StringKey> = {
  know: 'phaseKnow',
  parts: 'phaseParts',
  example: 'phaseExample',
  watchout: 'phaseWatchout',
  check: 'phaseCheck',
};

function sectionLabel(language: string, section: string): string {
  if (section === 'Opening') return t(language, 'opening');
  if (section === 'Closing') return t(language, 'closing');
  return section;
}

/** True when a section label ("1.1 Title") already says the topic's title, so the top line names the topic once. */
function isHeadingOf(section: string, title: string): boolean {
  return section.replace(/^\d+(?:\.\d+)*\s+/, '').trim() === title.trim();
}

export function SlideFrame({ slide, title, children, visual, wide, hideSources, titleField = 'title', kicker, className }: Props) {
  const { meta, frame, units, topics, places } = useDeck();
  const position = slide.unit ? unitPosition(units, slide.unit) : null;
  const topic = slide.topic ? topicPosition(topics, slide.topic) : null;
  const place = places[slide.id];
  const phase = slide.phase ? t(meta.language, PHASE_LABELS[slide.phase]) : null;
  const phaseKicker = phase ? (place && place.m >= 2 ? `${phase} · ${place.n}/${place.m}` : phase) : null;
  const shownKicker = kicker ?? phaseKicker;
  const ref = useRef<HTMLElement>(null);
  useAutoFit(ref, frame === 'desktop');
  return (
    <section ref={ref} className={`rs-slide${wide ? ' rs-wide' : ''}${visual ? ' rs-has-visual' : ''}${className ? ` ${className}` : ''}`} data-slide={slide.id} aria-roledescription="slide">
      <a className="rs-topline" href={formatRoute({ name: 'home' })}>
        Part {meta.part} · {sectionLabel(meta.language, slide.section)}
        {position ? ` · ${t(meta.language, 'unit', { n: position.n, m: position.m })} ${position.unit.title}` : null}
        {topic && !isHeadingOf(slide.section, topic.topic.title) ? ` · ${topic.topic.title}` : null}
      </a>
      {shownKicker ? <div className="rs-kicker">{shownKicker}</div> : null}
      {title !== undefined ? (
        <h2 className="rs-title" data-field={titleField}>
          {title}
        </h2>
      ) : null}
      <div className="rs-slide-body">
        <div className="rs-prose">{children}</div>
        {visual ? <div className="rs-visual">{visual}</div> : null}
      </div>
      {!hideSources && slide.sources.length > 0 ? (
        <footer className="rs-sources">
          {t(meta.language, 'sources')}:{' '}
          {slide.sources.map((url, i) => (
            <span key={url}>
              {i > 0 ? ' · ' : ''}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {url.replace(/^https?:\/\//, '')}
              </a>
            </span>
          ))}
        </footer>
      ) : null}
    </section>
  );
}
