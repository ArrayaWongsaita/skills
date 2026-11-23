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
/** `unit` is the unit the slide belongs to (deck@2): the header names it. */
export type Base = { id: string; section: string; purpose: string; from: string[]; sources: string[]; unit?: string };
export type UnitDef = { id: string; title: string; goal: string; needs: string[] };
export type ChapterDef = { id: string; section: string; title: string; units: UnitDef[] };
/** A Part's unit map: its chapters in order, each with its units in teaching order. Empty for a deck@1 deck. */
export type Units = { chapters: ChapterDef[] };
/** One numbered piece of an assembly: a unit (or, for the whole Part, a chapter) and the code lines or diagram elements it covers. */
export type AssemblyLabel = { unit?: string; chapter?: string; lines?: Range[]; elements?: string[] };
export type Concept = { id: string; meaning: string; shape: string; role: string; icon: string };
export type Vocabulary = { version: number; roles: Record<string, string>; concepts: Concept[]; style: string };
