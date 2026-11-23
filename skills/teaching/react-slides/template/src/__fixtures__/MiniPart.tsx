// A three-slide Part built straight on SlideFrame, for the Deck tests.
import { Deck, useDeck } from '../components/Deck';
import { SlideFrame } from '../components/SlideFrame';
import type { Base, PartMeta, Units } from '../components/types';

export const miniMeta: PartMeta = { course: 'c', part: 1, slug: 'part-01', title: 'Mini', language: 'th', slideCount: 3 };

function Slide(props: Base & { text: string }) {
  const deck = useDeck();
  return (
    <SlideFrame slide={props} title={<>{props.text}</>}>
      <p data-direction={deck.direction}>{props.text} body</p>
    </SlideFrame>
  );
}

const base = { purpose: 'p', from: [], sources: [] };

export const miniUnits: Units = {
  chapters: [{ id: '1.1', section: '1.1', title: 'หัวข้อ', units: [{ id: 'u-a', title: 'เรื่องแรก', goal: 'g', needs: [] }, { id: 'u-b', title: 'เรื่องสอง', goal: 'g', needs: ['u-a'] }] }],
};

export function MiniPart() {
  return (
    <Deck meta={miniMeta} diagrams={{}} listings={{}} outputs={{}} units={miniUnits}>
      <Slide id="1-001" section="Opening" text="first" {...base} />
      <Slide id="1-002" section="1.1 หัวข้อ" unit="u-a" text="second" {...base} />
      <Slide id="1-003" section="Closing" text="third" {...base} />
    </Deck>
  );
}
