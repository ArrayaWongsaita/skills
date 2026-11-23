import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { DeckFixture } from '../__fixtures__/DeckFixture';
import {
  A, Answer, C, Code, Compare, Cover, Error as ErrorSlide, Explain, Focus, Objectives, Output, Practice, Question, Setup, Sources, Steps,
  Summary, Terms,
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
  ['Code', <Code {...base('1-006')} title={<>โค้ด</>} body={<>อธิบายโค้ด</>} snippet="s-ok" lines={[[1, 2]]} highlight={[]} />, ['อธิบายโค้ด', 'คัดลอกส่วนนี้']],
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
];

test('there is one case per layout', () => {
  expect(new Set(LAYOUT_CASES.map(([name]) => name)).size).toBe(16);
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
