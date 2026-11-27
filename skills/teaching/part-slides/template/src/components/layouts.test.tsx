import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { DeckFixture, fixtureTopics } from '../__fixtures__/DeckFixture';
import {
  A, Answer, Anatomy, Assemble, C, Code, Compare, Cover, Error as ErrorSlide, Example, Explain, Focus, MapSlide, Objectives, Output, Practice, Question, Setup,
  Sources, Steps, SlideFrame, Summary, Terms, Topic,
} from './index';
import type { Visual } from './types';

const base = (id: string) => ({ id, section: '1.1 หัวข้อ', purpose: 'p', from: [], sources: [] });
const visual: Visual = { kind: 'diagram', diagram: 'd-loop', show: ['n-user'], highlight: [], dim: [] };
const block = { lang: 'bash', info: 'bash', text: 'pip install x' };

const LAYOUT_CASES: [string, ReactElement, string[]][] = [
  ['Cover', <Cover {...base('1-001')} title={<>ปกบท</>} body={<>คำโปรย</>} />, ['ปกบท', 'คำโปรย']],
  ['Focus', <Focus {...base('1-002')} title={<>ประเด็นเดียว</>} body={<>ขยายความ</>} visual={visual} />, ['ประเด็นเดียว', 'ขยายความ']],
  ['Explain', <Explain {...base('1-003')} title={<>อธิบาย</>} body={<>เนื้อหาของบท</>} visual={visual} />, ['อธิบาย', 'เนื้อหาของบท']],
  ['Steps', <Steps {...base('1-004')} title={<>ขั้นตอน</>} items={[<>ขั้นแรก</>, <>ขั้นสอง</>]} visual={visual} />, ['ขั้นแรก', 'ขั้นสอง']],
  ['Compare', <Compare {...base('1-005')} title={<>เทียบ</>} left={<>ฝั่งซ้าย</>} right={<>ฝั่งขวา</>} takeaway={<>สรุปเทียบ</>} leftBlocks={[block]} />, ['ฝั่งซ้าย', 'ฝั่งขวา', 'สรุปเทียบ', 'pip install x']],
  ['Code', <Code {...base('1-006')} title={<>โค้ด</>} body={<>อธิบายโค้ด</>} snippet="s-ok" lines={[[1, 2]]} highlight={[]} />, ['อธิบายโค้ด', 'คัดลอก']],
  ['Output', <Output {...base('1-007')} title={<>ผลลัพธ์</>} body={<>สิ่งที่เห็น</>} snippet="s-ok" />, ['สิ่งที่เห็น', 'hello <world> & {x}']],
  ['Error', <ErrorSlide {...base('1-008')} title={<>ข้อผิดพลาด</>} symptom={<>อาการ 401</>} cause={<>ไม่มี key</>} fix={<>ตั้ง key</>} blocks={[{ lang: 'text', info: 'text', text: 'Error 401' }]} />, ['อาการ 401', 'ไม่มี key', 'ตั้ง key', 'Error 401']],
  ['Objectives', <Objectives {...base('1-009')} title={<>เป้าหมาย</>} items={[<>ทำได้หนึ่ง</>]} />, ['ทำได้หนึ่ง']],
  ['Setup', <Setup {...base('1-010')} title={<>เตรียม</>} items={[<>ติดตั้ง</>]} blocks={[block]} />, ['ติดตั้ง', 'pip install x']],
  ['Terms', <Terms {...base('1-011')} title={<>คำศัพท์</>} items={[<>agent: ตัวทำงาน</>]} />, ['agent: ตัวทำงาน']],
  ['Question', <Question {...base('1-012')} question={<>ถามอะไร?</>} body={<>คิดก่อน</>} items={[<>ตัวเลือกหนึ่ง</>]} />, ['ถามอะไร?', 'คิดก่อน', 'ตัวเลือกหนึ่ง']],
  ['Answer', <Answer {...base('1-013')} answer={<>คำตอบคือ</>} why={<>เพราะว่า</>} revisit="1-006" />, ['คำตอบคือ', 'เพราะว่า']],
  ['Practice', <Practice {...base('1-014')} title={<>ฝึก</>} task={<>งานที่ทำ</>} items={[<>คำใบ้</>]} solution={<>เฉลยงาน</>} />, ['งานที่ทำ', 'เฉลยงาน']],
  ['Summary', <Summary {...base('1-015')} title={<>สรุป</>} items={[<>ข้อสรุป</>]} />, ['ข้อสรุป']],
  ['Sources', <Sources {...base('1-016')} title={<>อ่านต่อ</>} items={[<A href="https://a.b">ลิงก์อ่านต่อ</A>]} />, ['ลิงก์อ่านต่อ']],
  ['MapSlide', <MapSlide {...base('1-017')} title={<>เส้นทางของบท</>} body={<>เรียนทีละเรื่อง</>} />, ['เส้นทางของบท', 'เรียนทีละเรื่อง', 'บทแรก', 'เรื่องสาม', 'บทสอง', 'เรื่องสี่']],
  ['Topic', <Topic {...base('1-018')} unit="u-b" title={<>หัวเรื่องที่สอง</>} body={<>ทำสิ่งที่สองได้</>} visual={visual} />, ['หัวเรื่องที่สอง', 'ทำสิ่งที่สองได้']],
  ['Assemble', (
    <Assemble
      {...base('1-019')} title={<>ประกอบร่าง</>} body={<>รวมสองเรื่อง</>} notice={<>ยังไม่ได้ทดสอบ</>} assembles="1.1"
      labels={[{ unit: 'u-a', lines: [[5, 8]] }, { unit: 'u-b', lines: [[10, 12]] }]} snippet="s-long" lines={[[1, 12]]}
    />
  ), ['ประกอบร่าง', 'รวมสองเรื่อง', 'ยังไม่ได้ทดสอบ']],
];

test('there is one case per layout', () => {
  expect(new Set(LAYOUT_CASES.map(([name]) => name)).size).toBe(19);
});

test.each(LAYOUT_CASES)('%s renders its fields', (_name, element, texts) => {
  render(<DeckFixture>{element}</DeckFixture>);
  for (const text of texts) expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
});

test('fields and items are marked for the verbatim check', () => {
  const { container } = render(<DeckFixture>{LAYOUT_CASES[3][1]}</DeckFixture>);
  expect(container.querySelector('[data-field="title"]')).toHaveTextContent('ขั้นตอน');
  expect(container.querySelectorAll('[data-field="items"] [data-item]')).toHaveLength(2);
});

test('answer links back to its revisit slide', () => {
  render(<DeckFixture>{LAYOUT_CASES[12][1]}</DeckFixture>);
  const link = screen.getByRole('link', { name: /กลับไปดูหน้า/ });
  expect(link).toHaveAttribute('href', '#/part-01/1-006');
});

test('links open in a new tab', () => {
  render(<DeckFixture>{LAYOUT_CASES[15][1]}</DeckFixture>);
  const link = screen.getByRole('link', { name: 'ลิงก์อ่านต่อ' });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
});

test('slide sources render as links, and empty sources render none', () => {
  const withSources = { ...base('1-020'), sources: ['https://docs.example.com/page'] };
  const { container, unmount } = render(<DeckFixture><Explain {...withSources} title={<>t</>} body={<>b</>} visual={visual} /></DeckFixture>);
  expect(container.querySelector('.rs-sources a')).toHaveAttribute('href', 'https://docs.example.com/page');
  unmount();
  const again = render(<DeckFixture>{LAYOUT_CASES[2][1]}</DeckFixture>);
  expect(again.container.querySelector('.rs-sources')).toBeNull();
});

test('inline code renders as code', () => {
  const { container } = render(<DeckFixture><Explain {...base('1-021')} title={<>t</>} body={<>ใช้ <C>{'a{b}'}</C></>} visual={visual} /></DeckFixture>);
  expect(container.querySelector('[data-field="body"] code')).toHaveTextContent('a{b}');
});

test('a notice is shown when given', () => {
  render(<DeckFixture><Code {...base('1-022')} title={<>t</>} body={<>b</>} notice={<>ยังไม่ได้ทดสอบ</>} snippet="s-new" lines={[[1, 1]]} highlight={[]} /></DeckFixture>);
  expect(screen.getByText('ยังไม่ได้ทดสอบ')).toBeInTheDocument();
});

test('the check page measures a practice slide with its solution open', () => {
  const { container } = render(
    <DeckFixture>
      <Practice id="1-001" section="s" purpose="p" from={[]} sources={[]} title={<>t</>} task={<>งาน</>} solution={<>เฉลย</>} />
    </DeckFixture>,
  );
  expect(container.querySelector('details')).toHaveAttribute('open');
});

const caseOf = (name: string) => LAYOUT_CASES.find(([n]) => n === name)![1];

test('topic shows its position and marks units done, current and to come', () => {
  const { container } = render(<DeckFixture>{caseOf('Topic')}</DeckFixture>);
  expect(screen.getByText('เรื่อง 2/3')).toBeInTheDocument();
  const states = [...container.querySelectorAll('[data-unit-state]')].map((li) => li.getAttribute('data-unit-state'));
  expect(states).toEqual(['done', 'current', 'todo']);
  expect(container.querySelector('[data-unit-state="current"]')).toHaveTextContent('เรื่องสอง');
});

test('generated chrome carries no data-field, so the verbatim check sees only deck text', () => {
  for (const name of ['MapSlide', 'Topic', 'Assemble']) {
    const { container, unmount } = render(<DeckFixture>{caseOf(name)}</DeckFixture>);
    const fields = [...container.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field'));
    expect(fields.every((field) => ['title', 'body', 'notice', 'items'].includes(field!)), name).toBe(true);
    expect(container.querySelector('.rs-unit-map [data-field], .rs-topic-units [data-field], .rs-assembly-legend [data-field]')).toBeNull();
    unmount();
  }
});

test('assemble labels its code lines and lists the units', () => {
  const { container } = render(<DeckFixture>{caseOf('Assemble')}</DeckFixture>);
  const group = (n: number) => container.querySelector(`[data-line="${n}"]`)?.getAttribute('data-group') ?? null;
  expect([5, 6, 7, 8].map(group)).toEqual(['1', '1', '1', '1']);
  expect([10, 11, 12].map(group)).toEqual(['2', '2', '2']);
  expect([1, 4, 9].map(group)).toEqual([null, null, null]);
  const legend = [...container.querySelectorAll('.rs-assembly-legend li')];
  expect(legend.map((li) => li.querySelector('.rs-assembly-name')?.textContent)).toEqual(['เรื่องหนึ่ง', 'เรื่องสอง']);
  expect(legend.map((li) => li.getAttribute('data-label'))).toEqual(['1', '2']);
});

test('a part assembly lists chapter titles and labels the diagram', () => {
  const full: Visual = { kind: 'diagram', diagram: 'd-loop', show: ['n-user', 'n-model', 'n-tool', 'e-ask', 'e-call'], new: [], highlight: [], dim: [] };
  const { container } = render(
    <DeckFixture>
      <Assemble
        {...base('1-020')} title={<>ภาพรวม</>} body={<>ทั้งบท</>} assembles="part" visual={full}
        labels={[{ chapter: '1.1', elements: ['n-user', 'e-ask'] }, { chapter: '1.2', elements: ['n-tool'] }]}
      />
    </DeckFixture>,
  );
  expect([...container.querySelectorAll('.rs-assembly-name')].map((el) => el.textContent)).toEqual(['บทแรก', 'บทสอง']);
  expect(container.querySelector('[data-el="n-user"]')).toHaveAttribute('data-label', '1');
  expect(container.querySelector('[data-el="n-tool"]')).toHaveAttribute('data-label', '2');
  expect(container.querySelector('[data-el="n-model"]')).not.toHaveAttribute('data-label');
  expect(container.querySelector('.rs-codeblock')).toBeNull();
});

test('a map with no units still renders its fields', () => {
  render(<DeckFixture units={{ chapters: [] }}>{caseOf('MapSlide')}</DeckFixture>);
  expect(screen.getByText('เส้นทางของบท')).toBeInTheDocument();
});

const inTopic = (id: string, phase: 'know' | 'parts' | 'example' | 'watchout' | 'check', topic = 't-a') => ({ ...base(id), topic, phase });
const part = (id: string) => <Explain key={id} {...inTopic(id, 'parts')} title={<>ตัวหนึ่ง</>} body={<>อธิบายตัวหนึ่ง</>} visual={visual} />;

const divider = (extra: object = {}) => ({ ...base('1-030'), topic: 't-b', ...extra });

const slideOf = (container: HTMLElement, id: string) => container.querySelector(`[data-slide="${id}"]`)!;

test('the Part, section and phase are a small block at the top of every slide, above the title', () => {
  for (const frame of ['desktop', 'phone'] as const) {
    const { container, unmount } = render(<DeckFixture topics={fixtureTopics} frame={frame}>{[part('1-020'), part('1-021')]}</DeckFixture>);
    const slide = slideOf(container, '1-020');
    expect(slide.firstElementChild).toHaveClass('rs-where');
    expect(slide.children[1]).toHaveClass('rs-title');
    expect(slide.querySelector('.rs-where .rs-topline')).toHaveTextContent('Part 1 · 1.1 หัวข้อ · หัวข้อแรก');
    expect(slide.querySelector('.rs-where .rs-phase')).toHaveTextContent('ส่วนประกอบ · 1/2');
    expect(slide.querySelector('.rs-topline')).toHaveAttribute('href', '#/');
    unmount();
  }
});

test('a slide with no phase has the place and no phase line', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics}><Explain {...base('1-020')} title={<>t</>} body={<>b</>} visual={visual} /></DeckFixture>);
  expect(slideOf(container, '1-020').querySelector('.rs-phase')).toBeNull();
});

test('a divider shows the place, then its "next topic" label, then its title', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics}><Topic {...divider()} title={<>หัวข้อสอง</>} /></DeckFixture>);
  const slide = container.querySelector('.rs-slide')!;
  expect([...slide.children].slice(0, 3).map((el) => el.className.split(' ')[0])).toEqual(['rs-where', 'rs-kicker', 'rs-title']);
});

test('a slide carries no icon: the course icon is on the home page and the tab, and would pull the eye from the content', () => {
  for (const frame of ['desktop', 'phone'] as const) {
    const { container, unmount } = render(<DeckFixture topics={fixtureTopics} frame={frame}>{part('1-020')}</DeckFixture>);
    expect(container.querySelector('img')).toBeNull();
    unmount();
  }
});

test('a topic divider shows only the title, the tagline and the visual', () => {
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Topic {...divider()} title={<>หัวข้อสอง</>} body={<>แท็กไลน์</>} visual={visual} />
    </DeckFixture>,
  );
  expect(container.querySelector('[data-field="title"]')).toHaveTextContent('หัวข้อสอง');
  expect(container.querySelector('[data-field="body"]')).toHaveTextContent('แท็กไลน์');
  expect(container.querySelector('.rs-visual')).not.toBeNull();
  expect(container.querySelector('ol, ul')).toBeNull();
  expect(container.querySelector('.rs-kicker')).toHaveTextContent('หัวข้อถัดไป 2/3');
  expect(container.querySelector('.rs-slide')).toHaveClass('rs-topic', 'rs-divider');
});

test('a topic divider without a tagline renders the title alone', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics}><Topic {...divider()} title={<>หัวข้อสอง</>} /></DeckFixture>);
  expect(container.querySelector('[data-field="title"]')).toHaveTextContent('หัวข้อสอง');
  expect(container.querySelector('[data-field="body"]')).toBeNull();
  expect(container.querySelector('.rs-visual')).toBeNull();
});

test('the divider kicker is in English for an English deck', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics} language="en"><Topic {...divider({ topic: 't-c' })} title={<>Three</>} /></DeckFixture>);
  expect(container.querySelector('.rs-kicker')).toHaveTextContent('Next topic 3/3');
});

test('a divider whose topic is not in the list falls back to the unit divider', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics}><Topic {...divider({ topic: 't-ghost', unit: 'u-b' })} title={<>x</>} body={<>y</>} /></DeckFixture>);
  expect(container.querySelector('.rs-topic-units')).not.toBeNull();
  expect(container.querySelector('.rs-divider')).toBeNull();
});

const AWKWARD = ['.map(', '<T>', '{ a, b }', 'a && b', 'x => x * 2', '"q" \\ \'s\'', 'น้ำ ผู้ ที่'];

test('anatomy shows each piece with its numbered marker and a numbered legend', () => {
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Anatomy
        {...inTopic('1-040', 'parts')} title={<>หน้าตา</>} body={<>เส้นเดียว</>}
        pieces={[{ text: 'model', n: 1 }, { text: ' = ' }, { text: 'init(', n: 2 }, { text: ')' }]}
        items={[<>ตัวแปร</>, <>ฟังก์ชัน</>]}
      />
    </DeckFixture>,
  );
  const strip = container.querySelector('.rs-anatomy-strip')!;
  expect(strip.textContent).toBe('model = init()');  // the markers are CSS, so the text is exactly the line
  expect([...strip.querySelectorAll('[data-piece-n]')].map((el) => [el.getAttribute('data-piece-n'), el.textContent])).toEqual([['1', 'model'], ['2', 'init(']]);
  expect(container.querySelectorAll('[data-field="items"] [data-item]')).toHaveLength(2);
  expect(container.querySelector('[data-field="items"]')).toHaveTextContent('ตัวแปร');
  expect(container.querySelector('[data-field="body"]')).toHaveTextContent('เส้นเดียว');
  expect(strip.querySelector('[data-field]')).toBeNull();
});

test('anatomy renders awkward text verbatim', () => {  // Review Focus 3
  const pieces = AWKWARD.map((text, index) => ({ text, n: index + 1 }));
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Anatomy {...inTopic('1-040', 'parts')} title={<>t</>} pieces={pieces} items={AWKWARD.map((text) => <>{text}</>)} />
    </DeckFixture>,
  );
  expect([...container.querySelectorAll('[data-piece-n]')].map((el) => el.textContent)).toEqual(AWKWARD);
  expect([...container.querySelectorAll('[data-field="items"] [data-item]')].map((el) => el.textContent)).toEqual(AWKWARD);
});

test('anatomy shows a notice when given', () => {
  render(<DeckFixture topics={fixtureTopics}><Anatomy {...inTopic('1-040', 'parts')} title={<>t</>} pieces={[{ text: 'x', n: 1 }]} items={[<>หนึ่ง</>]} notice={<>ยังไม่ได้ทดสอบ</>} /></DeckFixture>);
  expect(screen.getByText('ยังไม่ได้ทดสอบ')).toBeInTheDocument();
});

test('example shows the code and the output together', () => {
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Example {...inTopic('1-041', 'example')} title={<>ตัวอย่าง</>} body={<>รันแล้วเห็น</>} snippet="s-ok" lines={[[1, 2]]} highlight={[[2, 2]]} />
    </DeckFixture>,
  );
  expect(container.querySelector('[data-field="body"]')).toHaveTextContent('รันแล้วเห็น');
  expect(container.querySelector('.rs-codeblock')).toHaveTextContent('a = 1');
  expect(container.querySelector('[data-line="2"]')).toHaveClass('rs-hl');
  expect(screen.getByText('hello <world> & {x}')).toBeInTheDocument();
  const html = container.querySelector('.rs-example')!.innerHTML;
  expect(html.indexOf('rs-codeblock')).toBeLessThan(html.indexOf('hello &lt;world&gt;'));
});

test('an example whose snippet has no output shows the code alone', () => {
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Example {...inTopic('1-041', 'example')} title={<>ตัวอย่าง</>} body={<>b</>} snippet="s-new" lines={[[1, 1]]} highlight={[]} notice={<>ยังไม่ได้ทดสอบ</>} />
    </DeckFixture>,
  );
  expect(container.querySelector('.rs-codeblock')).not.toBeNull();
  expect(container.querySelectorAll('.rs-output, .rs-outputblock').length).toBe(0);
  expect(screen.getByText('ยังไม่ได้ทดสอบ')).toBeInTheDocument();
});

test('the map lists the topics in order, with their taglines', () => {
  const { container } = render(<DeckFixture topics={fixtureTopics}><MapSlide {...base('1-003')} title={<>เส้นทาง</>} body={<>เรียนทีละหัวข้อ</>} /></DeckFixture>);
  const items = [...container.querySelectorAll('.rs-topic-map > li')];
  expect(items.map((li) => li.querySelector('.rs-topic-map-title')?.textContent)).toEqual(['หัวข้อแรก', 'หัวข้อสอง', 'หัวข้อสาม']);
  expect(items.map((li) => li.querySelector('.rs-topic-map-tagline')?.textContent ?? null)).toEqual(['รู้จักอันแรก', null, 'อันสุดท้าย']);
  expect(container.querySelector('.rs-unit-map')).toBeNull();
  expect(container.querySelector('.rs-topic-map [data-field]')).toBeNull();
});

test('the legend of an assembly names a topic', () => {
  const { container } = render(
    <DeckFixture topics={fixtureTopics}>
      <Assemble {...base('1-050')} title={<>รวม</>} body={<>ทั้งหมด</>} assembles="part" snippet="s-long" lines={[[1, 12]]} labels={[{ topic: 't-a', lines: [[2, 4]] }, { topic: 't-c', lines: [[6, 8]] }]} />
    </DeckFixture>,
  );
  expect([...container.querySelectorAll('.rs-assembly-name')].map((el) => el.textContent)).toEqual(['หัวข้อแรก', 'หัวข้อสาม']);
  expect(container.querySelector('[data-line="3"]')).toHaveAttribute('data-group', '1');
  expect(container.querySelector('[data-line="7"]')).toHaveAttribute('data-group', '2');
});

// part-slides: a Part is written by hand, so a slide carries no research metadata and its picture can be any node.
const own = <svg data-testid="own" />;
const lean = (id: string) => ({ id, section: 'หัวข้อ' });

test('a slide without purpose, from and sources renders, with no sources footer', () => {
  const { container } = render(
    <DeckFixture>
      <Explain {...lean('1-001')} title={<>ชื่อสไลด์</>} body={<>เนื้อหา</>} visual={own} />
    </DeckFixture>,
  );
  expect(screen.getByText('ชื่อสไลด์')).toBeInTheDocument();
  expect(screen.getByTestId('own')).toBeInTheDocument();
  expect(container.querySelector('.rs-sources')).toBeNull();
});

test.each([
  ['Cover', (v: ReactElement) => <Cover {...lean('1-001')} title={<>ก</>} visual={v} />],
  ['Focus', (v: ReactElement) => <Focus {...lean('1-001')} title={<>ก</>} body={<>ข</>} visual={v} />],
  ['Steps', (v: ReactElement) => <Steps {...lean('1-001')} title={<>ก</>} items={[<>หนึ่ง</>, <>สอง</>]} visual={v} />],
  ['Topic', (v: ReactElement) => <Topic {...lean('1-001')} title={<>ก</>} visual={v} />],
  ['Objectives', (v: ReactElement) => <Objectives {...lean('1-001')} title={<>ก</>} items={[<>ข</>]} visual={v} />],
  ['Summary', (v: ReactElement) => <Summary {...lean('1-001')} title={<>ก</>} items={[<>ข</>]} visual={v} />],
])('%s shows a node as its visual', (_name, make) => {
  render(<DeckFixture>{make(own)}</DeckFixture>);
  expect(screen.getByTestId('own')).toBeInTheDocument();
});

test('the slide is marked with its section and phase', () => {
  const { container } = render(
    <DeckFixture>
      <Explain {...lean('1-001')} phase="know" title={<>ก</>} body={<>ข</>} visual={own} />
    </DeckFixture>,
  );
  const slide = container.querySelector('.rs-slide');
  expect(slide).toHaveAttribute('data-section', 'หัวข้อ');
  expect(slide).toHaveAttribute('data-phase', 'know');
});

test('a divider is marked as one even when the deck has no topic list', () => {
  const { container } = render(
    <DeckFixture>
      <Topic {...lean('1-002')} title={<>หัวข้อ</>} />
    </DeckFixture>,
  );
  expect(container.querySelector('.rs-slide.rs-divider')).not.toBeNull();
});

test('Example and Code show the whole listing and highlight nothing when given no lines', () => {
  const { container } = render(
    <DeckFixture>
      <Example {...lean('1-001')} title={<>ตัวอย่าง</>} body={<>รันแล้วเห็น</>} snippet="s-ok" />
      <Code {...lean('1-002')} title={<>โค้ด</>} body={<>อ่านโค้ด</>} snippet="s-ok" />
    </DeckFixture>,
  );
  expect(container.querySelectorAll('.rs-example .rs-row')).toHaveLength(6);
  expect(container.querySelectorAll('.rs-hl')).toHaveLength(0);
});

test('Focus, Explain and Steps may have no picture, and then have no visual column', () => {
  const { container } = render(
    <DeckFixture>
      <Focus {...lean('1-001')} title={<>ก</>} body={<>ข</>} />
      <Explain {...lean('1-002')} title={<>ค</>} body={<>ง</>} />
      <Steps {...lean('1-003')} title={<>จ</>} items={[<>หนึ่ง</>, <>สอง</>]} />
    </DeckFixture>,
  );
  expect(container.querySelectorAll('.rs-slide')).toHaveLength(3);
  expect(container.querySelector('.rs-visual')).toBeNull();
});

test('an Error slide can carry a picture, and is then a two-column slide like Explain; without one it stays wide', () => {
  const fix = { cause: <>สาเหตุ</>, fix: <>วิธีแก้</> };
  const withPicture = render(<DeckFixture topics={fixtureTopics}><ErrorSlide {...base('1-008')} title={<>ผิด</>} {...fix} symptom={<>อาการ</>} visual={<svg data-testid="pic" />} /></DeckFixture>);
  expect(withPicture.container.querySelector('.rs-visual [data-testid="pic"]')).not.toBeNull();
  expect(slideOf(withPicture.container, '1-008')).toHaveClass('rs-has-visual');
  expect(slideOf(withPicture.container, '1-008')).not.toHaveClass('rs-wide');
  withPicture.unmount();
  const plain = render(<DeckFixture topics={fixtureTopics}><ErrorSlide {...base('1-008')} title={<>ผิด</>} {...fix} /></DeckFixture>);
  expect(slideOf(plain.container, '1-008')).toHaveClass('rs-wide');
  expect(plain.container.querySelector('.rs-visual')).toBeNull();
});

test('a Compare with a visual shows the picture beside the two panels', () => {
  const { container } = render(
    <DeckFixture>
      <Compare {...lean('1-001')} title={<>เทียบ</>} left={<>ซ้าย</>} right={<>ขวา</>} takeaway={<>สรุป</>} visual={own} />
    </DeckFixture>,
  );
  expect(container.querySelector('.rs-visual [data-testid="own"]')).not.toBeNull();
  expect(container.querySelector('.rs-slide')).not.toHaveClass('rs-wide');
  expect(container.querySelectorAll('.rs-panel')).toHaveLength(2);
});

test('a Compare without a visual is a wide slide as before', () => {
  const { container } = render(
    <DeckFixture>
      <Compare {...lean('1-001')} title={<>เทียบ</>} left={<>ซ้าย</>} right={<>ขวา</>} takeaway={<>สรุป</>} />
    </DeckFixture>,
  );
  expect(container.querySelector('.rs-slide')).toHaveClass('rs-wide');
  expect(container.querySelector('.rs-visual')).toBeNull();
});
