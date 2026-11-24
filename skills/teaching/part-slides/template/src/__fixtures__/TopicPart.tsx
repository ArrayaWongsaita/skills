// A three-slide deck@3 Part (a divider, an anatomy and an example), for the check page tests.
import { Deck } from '../components/Deck';
import { Anatomy, Example, Topic } from '../components/layouts';
import type { Listing, PartMeta, Topics } from '../components/types';

export const topicMeta: PartMeta = { course: 'c', part: 1, slug: 'part-01', title: 'Topics', language: 'th', slideCount: 3 };

const topics: Topics = { topics: [{ id: 't-map', section: '1.1', title: '.map()', tagline: 'แปลงทุกตัว', components: ['element', 'index'] }] };
const listings: Record<string, Listing> = { '1.1-a': { lang: 'javascript', status: 'verified', reason: '', code: 'const doubled = nums.map((x) => x * 2);\nconsole.log(doubled);' } };
const outputs = { '1.1-a': { lang: 'text', info: 'text', text: '[2, 4, 6]' } };
const base = { section: '1.1 map', purpose: 'p', from: [], sources: [], topic: 't-map' };

export function TopicPart() {
  return (
    <Deck meta={topicMeta} diagrams={{}} listings={listings} outputs={outputs} topics={topics}>
      <Topic id="1-001" {...base} title={<>.map()</>} body={<>แปลงทุกตัว</>} />
      <Anatomy
        id="1-002" {...base} phase="parts" title={<>หน้าตาของการเรียก</>}
        pieces={[{ text: 'nums', n: 1 }, { text: '.map(' }, { text: '(x) => x * 2', n: 2 }, { text: ')' }]}
        items={[<>array ที่จะแปลง</>, <>ฟังก์ชันที่ทำกับทุกตัว</>]}
      />
      <Example id="1-003" {...base} phase="example" title={<>ตัวอย่าง</>} body={<>คูณสองทุกตัว</>} snippet="1.1-a" lines={[[1, 2]]} highlight={[[1, 1]]} />
    </Deck>
  );
}
