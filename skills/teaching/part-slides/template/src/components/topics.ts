// Look-ups in a Part's topic list (deck@3), for the header, the divider, the map and the phase labels.
import type { ReactElement } from 'react';
import type { Base, TopicDef, Topics } from './types';

export type TopicPosition = { topic: TopicDef; n: number; m: number };
/** Where a slide sits among the slides of its phase: its 1-based place `n` among the `m` slides of one phase of one topic. */
export type Place = { n: number; m: number };

export const NO_TOPICS: Topics = { topics: [] };

/** Where a topic sits: its 1-based place `n` among the Part's `m` topics. */
export function topicPosition(topics: Topics, id: string): TopicPosition | null {
  const index = topics.topics.findIndex((topic) => topic.id === id);
  return index >= 0 ? { topic: topics.topics[index], n: index + 1, m: topics.topics.length } : null;
}

export function topicTitle(topics: Topics, id: string): string {
  return topicPosition(topics, id)?.topic.title ?? id;
}

/** The place of every slide that has a topic (or, with no topic id, a section) and a phase, counted among the slides of the same phase of the same topic. */
export function phasePlaces(slides: ReactElement<Base>[]): Record<string, Place> {
  const groups = new Map<string, string[]>();
  for (const { props } of slides) {
    const group = props.topic ?? props.section; // a hand-written slide names its topic by its section
    if (!group || !props.phase) continue;
    const key = `${group}\n${props.phase}`;
    groups.set(key, [...(groups.get(key) ?? []), props.id]);
  }
  const places: Record<string, Place> = {};
  for (const ids of groups.values()) ids.forEach((id, index) => (places[id] = { n: index + 1, m: ids.length }));
  return places;
}
