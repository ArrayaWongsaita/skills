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
export type Base = { id: string; section: string; purpose: string; from: string[]; sources: string[] };
export type Concept = { id: string; meaning: string; shape: string; role: string; icon: string };
export type Vocabulary = { version: number; roles: Record<string, string>; concepts: Concept[]; style: string };
