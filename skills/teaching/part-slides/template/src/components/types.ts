// The component contract. tsx_writer.py emits code against these names: change them only with a major template version.
import type { ReactNode } from 'react';

export type Rich = ReactNode;
export type Range = [number, number];
export type DiagramState = { kind: 'diagram'; diagram: string; show: string[]; new?: string[]; highlight: string[]; dim: string[] };
export type Fallback = DiagramState | { kind: 'text'; text: string };
export type Visual =
  | DiagramState
  | { kind: 'illustration'; key: string; description: string; prompt: string; alt: string; fallback: Fallback }
  | { kind: 'screenshot'; key: string; url: string; capture: string; fallback: Fallback };
export type Block = { lang: string; info: string; text: string };
export type Listing = { lang: string; status: 'verified' | 'unverified' | 'skipped'; reason: string; code: string };
export type DiagramNode = { id: string; label: string; concept: string; at: [number, number]; size: [number, number] };
export type DiagramEdge = { id: string; from: string; to: string; label?: string; style: 'solid' | 'dashed' };
export type DiagramGroup = { id: string; label: string; concept?: string; members: string[] };
export type DiagramDef = {
  id: string;
  title: string;
  canvas: [number, number];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
  badges: { id: string; n: number; near: string }[];
  notes: { id: string; text: string; near: string }[];
};
export type PartMeta = { course: string; part: number; slug: string; title: string; language: string; slideCount: number };
/** The phases of a topic (deck@3), in teaching order. The divider has none. */
export type Phase = 'know' | 'parts' | 'example' | 'watchout' | 'check';
/** `unit` is the unit the slide belongs to (deck@2); `topic` and `phase` are the topic and the phase of a deck@3 slide: the header and the kicker name them. */
export type Base = { id: string; section: string; purpose?: string; from?: string[]; sources?: string[]; unit?: string; topic?: string; phase?: Phase };
/** A slide's picture: a deck's visual data, or any node (the Part's own drawing, a figure). */
export type VisualProp = Visual | ReactNode;
export type UnitDef = { id: string; title: string; goal: string; needs: string[] };
export type ChapterDef = { id: string; section: string; title: string; units: UnitDef[] };
/** A Part's unit map: its chapters in order, each with its units in teaching order. Empty for a deck@1 deck. */
export type Units = { chapters: ChapterDef[] };
/** A topic of a Part (deck@3): one per sub-topic. `components` are the parts its `parts` phase explains. */
export type TopicDef = { id: string; section: string; title: string; tagline?: string; components: string[] };
/** A Part's topics in order. Empty for a deck@1 or deck@2 deck. */
export type Topics = { topics: TopicDef[] };
/** One piece of an `anatomy` slide: its text and, when it is explained in the legend, the number of that legend item. */
export type Piece = { text: string; n?: number };
/** One numbered piece of an assembly: a unit, a topic (deck@3) or, for the whole Part in a deck@2 deck, a chapter, and the code lines or diagram elements it covers. */
export type AssemblyLabel = { unit?: string; chapter?: string; topic?: string; lines?: Range[]; elements?: string[] };
export type Concept = { id: string; meaning: string; shape: string; role: string; icon: string };
export type Vocabulary = { version: number; roles: Record<string, string>; concepts: Concept[]; style: string };
