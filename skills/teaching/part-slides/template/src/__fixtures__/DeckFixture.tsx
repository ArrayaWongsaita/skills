// Renders slides through Deck in check mode (every slide, no router), with a small data set.
import type { ReactNode } from 'react';
import { Deck, DeckContext, DeckModeContext, FrameContext } from '../components/Deck';
import { phasePlaces } from '../components/topics';
import type { Base, Block, DiagramDef, Listing, PartMeta, Topics, Units } from '../components/types';

export const fixtureMeta: PartMeta = { course: 'c', part: 1, slug: 'part-01', title: 'Fixture', language: 'th', slideCount: 20 };

export const fixtureListings: Record<string, Listing> = {
  's-ok': { lang: 'python', status: 'verified', reason: '', code: 'a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6' },
  's-new': { lang: 'python', status: 'unverified', reason: 'needs a key', code: 'print("hi")' },
  's-long': { lang: 'python', status: 'verified', reason: '', code: Array.from({ length: 12 }, (_, i) => `l${i + 1} = ${i + 1}`).join('\n') },
};

export const fixtureUnits: Units = {
  chapters: [
    {
      id: '1.1', section: '1.1', title: 'บทแรก',
      units: [
        { id: 'u-a', title: 'เรื่องหนึ่ง', goal: 'ทำข้อหนึ่งได้', needs: [] },
        { id: 'u-b', title: 'เรื่องสอง', goal: 'ทำข้อสองได้', needs: ['u-a'] },
        { id: 'u-c', title: 'เรื่องสาม', goal: 'ทำข้อสามได้', needs: ['u-b'] },
      ],
    },
    { id: '1.2', section: '1.2', title: 'บทสอง', units: [{ id: 'u-d', title: 'เรื่องสี่', goal: 'ทำข้อสี่ได้', needs: [] }] },
  ],
};

export const fixtureTopics: Topics = {
  topics: [
    { id: 't-a', section: '1.1', title: 'หัวข้อแรก', tagline: 'รู้จักอันแรก', components: ['ตัวหนึ่ง', 'ตัวสอง', 'ตัวสาม'] },
    { id: 't-b', section: '1.2', title: 'หัวข้อสอง', components: [] },
    { id: 't-c', section: '1.3', title: 'หัวข้อสาม', tagline: 'อันสุดท้าย', components: ['ตัวเดียว'] },
  ],
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

export function DeckFixture({ children, frame = 'desktop', units = fixtureUnits, topics, language }: {
  children: ReactNode;
  frame?: 'desktop' | 'phone';
  units?: Units;
  topics?: Topics;
  language?: string;
}) {
  return (
    <DeckModeContext.Provider value="check">
      <FrameContext.Provider value={frame}>
        <Deck meta={language ? { ...fixtureMeta, language } : fixtureMeta} diagrams={fixtureDiagrams} listings={fixtureListings} outputs={fixtureOutputs} units={units} topics={topics}>
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
      value={{ meta: fixtureMeta, diagrams: fixtureDiagrams, listings: fixtureListings, outputs: fixtureOutputs, units: fixtureUnits, topics: fixtureTopics, places: phasePlaces([]), current: '1-001', direction, reducedMotion, frame: 'desktop', ids: ['1-001'] }}
    >
      {children}
    </DeckContext.Provider>
  );
}
