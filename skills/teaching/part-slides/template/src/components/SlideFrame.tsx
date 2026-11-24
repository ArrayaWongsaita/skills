import { type ReactNode, useRef } from 'react';
import { useAutoFit } from '../hooks';
import { t } from '../strings';
import { useDeck } from './Deck';
import type { Base, Rich } from './types';
import { WhereLine, whereOf } from './where';

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
  /** A short line above the title, such as a divider's "Next topic 2/3". Not a deck field. */
  kicker?: ReactNode;
  className?: string;
};

export function SlideFrame({ slide, title, children, visual, wide, hideSources, titleField = 'title', kicker, className }: Props) {
  const deck = useDeck();
  const { meta, frame } = deck;
  const sources = slide.sources ?? [];
  const ref = useRef<HTMLElement>(null);
  useAutoFit(ref, frame === 'desktop');
  return (
    <section ref={ref} className={`rs-slide${wide ? ' rs-wide' : ''}${visual ? ' rs-has-visual' : ''}${className ? ` ${className}` : ''}`} data-slide={slide.id} data-section={slide.section} data-phase={slide.phase} aria-roledescription="slide">
      <WhereLine where={whereOf(deck, slide)} />
      {kicker ? <div className="rs-kicker">{kicker}</div> : null}
      {title !== undefined ? (
        <h2 className="rs-title" data-field={titleField}>
          {title}
        </h2>
      ) : null}
      <div className="rs-slide-body">
        <div className="rs-prose">{children}</div>
        {visual ? <div className="rs-visual">{visual}</div> : null}
      </div>
      {!hideSources && sources.length > 0 ? (
        <footer className="rs-sources">
          {t(meta.language, 'sources')}:{' '}
          {sources.map((url, i) => (
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
