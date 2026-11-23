// Renders slides through Deck in check mode (every slide, no router), with a small data set.
import type { ReactNode } from 'react';
import { Deck, DeckContext, DeckModeContext, FrameContext } from '../components/Deck';
import type { Block, DiagramDef, Listing, PartMeta } from '../components/types';

export const fixtureMeta: PartMeta = { course: 'c', part: 1, slug: 'part-01', title: 'Fixture', language: 'th', slideCount: 20 };

export const fixtureListings: Record<string, Listing> = {
  's-ok': { lang: 'python', status: 'verified', reason: '', code: 'a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6' },
  's-new': { lang: 'python', status: 'unverified', reason: 'needs a key', code: 'print("hi")' },
};

export const fixtureOutputs: Record<string, Block> = {
  's-ok': { lang: 'text', info: 'text illustrative', text: 'hello <world> & {x}' },
};

export const fixtureDiagrams: Record<string, DiagramDef> = {
  'd-loop': {
    id: 'd-loop',
    title: 'วงรอบ',
    canvas: [16, 8],
    nodes: [
      { id: 'n-user', label: 'ผู้ใช้', concept: 'user', at: [0, 3], size: [2, 1] },
      { id: 'n-model', label: 'Model', concept: 'model', at: [6, 1], size: [3, 1] },
      { id: 'n-tool', label: 'Tool', concept: 'tool', at: [6, 5], size: [3, 1] },
    ],
    edges: [
      { id: 'e-ask', from: 'n-user', to: 'n-model', label: 'คำถาม', style: 'solid' },
      { id: 'e-call', from: 'n-model', to: 'n-tool', label: 'tool call', style: 'solid' },
      { id: 'e-back', from: 'n-tool', to: 'n-model', style: 'dashed' },
      { id: 'e-hand', from: 'n-user', to: 'g-agent', label: 'ส่งงาน', style: 'dashed' },
    ],
    groups: [{ id: 'g-agent', label: 'agent', concept: 'agent', members: ['n-model', 'n-tool'] }],
    badges: [{ id: 'b1', n: 1, near: 'n-model' }, { id: 'b2', n: 2, near: 'e-call' }],
    notes: [{ id: 't-loop', text: 'วนจนได้คำตอบ', near: 'e-call' }],
  },
};

export function DeckFixture({ children, frame = 'desktop' }: { children: ReactNode; frame?: 'desktop' | 'phone' }) {
  return (
    <DeckModeContext.Provider value="check">
      <FrameContext.Provider value={frame}>
        <Deck meta={fixtureMeta} diagrams={fixtureDiagrams} listings={fixtureListings} outputs={fixtureOutputs}>
          {children}
        </Deck>
      </FrameContext.Provider>
    </DeckModeContext.Provider>
  );
}

/** Provides a Deck value directly, to test one component outside a slide list. */
export function DeckValue({ children, direction = 'none', reducedMotion = false }: { children: ReactNode; direction?: 'forward' | 'back' | 'none'; reducedMotion?: boolean }) {
  return (
    <DeckContext.Provider
      value={{ meta: fixtureMeta, diagrams: fixtureDiagrams, listings: fixtureListings, outputs: fixtureOutputs, current: '1-001', direction, reducedMotion, frame: 'desktop', ids: ['1-001'] }}
    >
      {children}
    </DeckContext.Provider>
  );
}
