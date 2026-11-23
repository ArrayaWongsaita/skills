import { type ReactNode, useRef } from 'react';
import { useAutoFit } from '../hooks';
import { formatRoute } from '../router';
import { t } from '../strings';
import { useDeck } from './Deck';
import type { Base, Rich } from './types';

type Props = {
  slide: Base;
  title?: Rich;
  children?: ReactNode;
  visual?: ReactNode;
  /** The content takes the full width, as on code and compare slides. */
  wide?: boolean;
  /** The sources slide lists its sources itself. */
  hideSources?: boolean;
};

function sectionLabel(language: string, section: string): string {
  if (section === 'Opening') return t(language, 'opening');
  if (section === 'Closing') return t(language, 'closing');
  return section;
}

export function SlideFrame({ slide, title, children, visual, wide, hideSources }: Props) {
  const { meta, frame } = useDeck();
  const ref = useRef<HTMLElement>(null);
  useAutoFit(ref, frame === 'desktop');
  return (
    <section ref={ref} className={`rs-slide${wide ? ' rs-wide' : ''}${visual ? ' rs-has-visual' : ''}`} data-slide={slide.id} aria-roledescription="slide">
      <a className="rs-topline" href={formatRoute({ name: 'home' })}>
        Part {meta.part} · {sectionLabel(meta.language, slide.section)}
      </a>
      {title !== undefined ? (
        <h2 className="rs-title" data-field="title">
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
