// Where a slide is in the Part: "Part 1 · section · topic" and its phase. Wayfinding, so it is a small muted block at the top of the slide.
import { formatRoute } from '../router';
import { type StringKey, t } from '../strings';
import { type Place, topicPosition } from './topics';
import type { Base, PartMeta, Phase, Topics, Units } from './types';
import { unitPosition } from './units';

export type Where = { place: string; phase: string | null };

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

/** True when a section label ("1.1 Title") already says the topic's title, so the line names the topic once. */
function isHeadingOf(section: string, title: string): boolean {
  return section.replace(/^\d+(?:\.\d+)*\s+/, '').trim() === title.trim();
}

type Context = { meta: PartMeta; units: Units; topics: Topics; places: Record<string, Place> };

export function whereOf({ meta, units, topics, places }: Context, slide: Base): Where {
  const position = slide.unit ? unitPosition(units, slide.unit) : null;
  const topic = slide.topic ? topicPosition(topics, slide.topic) : null;
  const unitName = position ? ` · ${t(meta.language, 'unit', { n: position.n, m: position.m })} ${position.unit.title}` : '';
  const topicName = topic && !isHeadingOf(slide.section, topic.topic.title) ? ` · ${topic.topic.title}` : '';
  const phase = slide.phase ? t(meta.language, PHASE_LABELS[slide.phase]) : null;
  const place = places[slide.id];
  return {
    place: `Part ${meta.part} · ${sectionLabel(meta.language, slide.section)}${unitName}${topicName}`,
    phase: phase ? (place && place.m >= 2 ? `${phase} · ${place.n}/${place.m}` : phase) : null,
  };
}

export function WhereLine({ where }: { where: Where }) {
  return (
    <div className="rs-where">
      <a className="rs-topline" href={formatRoute({ name: 'home' })}>
        {where.place}
      </a>
      {where.phase ? <div className="rs-phase">{where.phase}</div> : null}
    </div>
  );
}
