import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MiniPart, miniMeta } from '../__fixtures__/MiniPart';
import { TopicPart, topicMeta } from '../__fixtures__/TopicPart';
import { Deck } from '../components/Deck';
import { Anatomy, Code, Compare, Error as ErrorSlide, Explain, Output, Topic } from '../components/layouts';
import type { PartMeta } from '../components/types';
import { CheckPage } from './CheckPage';

vi.mock('../router', async (original) => ({
  ...(await original<typeof import('../router')>()),
  useRoute: () => ({ name: 'check', part: 1 }),
  navigate: vi.fn(),
}));

test('the check page lays out every slide twice and publishes its findings', async () => {
  const entry = { meta: miniMeta, load: () => Promise.resolve({ default: MiniPart }) };
  const { container } = render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
  expect(container.querySelectorAll('[data-frame="desktop"] [data-check-slide]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-frame="phone"] [data-check-slide]')).toHaveLength(3);
  expect(window.__reactSlidesCheck!.part).toBe(1);
  expect(window.__reactSlidesCheck!.course).toBe(miniMeta.course);
  expect(Array.isArray(window.__reactSlidesCheck!.findings)).toBe(true);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(container.querySelector('.rs-nav')).toBeNull();
});

test('a deck@3 Part with a divider, an anatomy and an example is laid out twice with no findings', async () => {
  const entry = { meta: topicMeta, load: () => Promise.resolve({ default: TopicPart }) };
  const { container } = render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
  for (const frame of ['desktop', 'phone']) {
    expect([...container.querySelectorAll(`[data-frame="${frame}"] [data-check-slide]`)].map((el) => el.getAttribute('data-check-slide'))).toEqual(['1-001', '1-002', '1-003']);
  }
  expect(container.querySelector('[data-frame="desktop"] .rs-anatomy-strip')).toHaveTextContent('nums.map((x) => x * 2)');
  expect(container.querySelector('[data-frame="phone"] .rs-example .rs-output')).toHaveTextContent('[2, 4, 6]');
  expect(window.__reactSlidesCheck!.findings.filter((finding) => finding.level === 'problem')).toEqual([]);
});

test('a slide whose body spills over the sources footer inside the frame is a prose-overflow problem at 85 %', async () => {
  const isBody = (el: Element) => el.classList.contains('rs-slide-body');
  const scroll = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) { return isBody(this) ? 480 : 700; });
  const client = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return isBody(this) ? 400 : 700; });
  try {
    const entry = { meta: miniMeta, load: () => Promise.resolve({ default: MiniPart }) };
    render(<CheckPage entry={entry} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 4000 });
    const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'prose-overflow' && f.frame === 'desktop');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.detail).toContain('780');
  } finally {
    scroll.mockRestore();
    client.mockRestore();
  }
});

// part-slides: the page reads each slide's section, phase and text, reports the readability budgets and lists the slides.
const longMeta: PartMeta = { course: 'c', part: 1, slug: 'long', title: 'Long', language: 'th', slideCount: 10 };
function LongTopic() {
  return (
    <Deck meta={longMeta} diagrams={{}} listings={{}} outputs={{}}>
      <Topic id="1-001" section="หัวข้อยาว" title={<>หัวข้อยาว</>} />
      {Array.from({ length: 9 }, (_, i) => (
        <Explain key={i} id={`1-${String(i + 2).padStart(3, '0')}`} section="หัวข้อยาว" phase="know" title={<>สไลด์ {i + 2}</>} body={<>เนื้อหา</>} visual={<svg />} />
      ))}
    </Deck>
  );
}

test('the page reports a budget finding for a topic of ten slides and lists the slides', async () => {
  const entry = { meta: longMeta, load: () => Promise.resolve({ default: LongTopic }) };
  render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
  const result = window.__reactSlidesCheck!;
  const budget = result.findings.filter((f) => f.kind === 'budget');
  expect(budget).toHaveLength(1);
  expect(budget[0]).toMatchObject({ slide: '1-010', level: 'problem' });
  expect(result.slides).toHaveLength(10);
  expect(result.slides[0]).toMatchObject({ id: '1-001', section: 'หัวข้อยาว', divider: true, title: 'หัวข้อยาว' });
  expect(result.slides[1]).toMatchObject({ id: '1-002', phase: 'know', divider: false, title: 'สไลด์ 2' });
});

// A highlight that marks most of the code points at nothing: the page measures the shown and the highlighted lines.
const hlMeta: PartMeta = { course: 'c', part: 1, slug: 'hl', title: 'Highlight', language: 'th', slideCount: 2 };
const six = { lang: 'python', status: 'verified', reason: '', code: 'a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6' } as const;
function Highlighted() {
  return (
    <Deck meta={hlMeta} diagrams={{}} listings={{ six }} outputs={{}}>
      <Code id="1-001" section="Opening" title={<>ทุกบรรทัด</>} body={<>b</>} snippet="six" highlight={[[1, 5]]} />
      <Code id="1-002" section="Opening" title={<>บรรทัดเดียว</>} body={<>b</>} snippet="six" highlight={[[2, 2]]} />
    </Deck>
  );
}

test('the page reports a highlight on most of the code, and only that one', async () => {
  const entry = { meta: hlMeta, load: () => Promise.resolve({ default: Highlighted }) };
  render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
  const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'highlight');
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', level: 'problem', frame: 'both' })]);
  expect(found[0]!.detail).toContain('5 of 6');
});

test('a code line wider than its box is a wide-line problem on the desktop and a note on the phone', async () => {
  const isCode = (el: Element) => el.classList.contains('rs-code');
  const content = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) { return isCode(this) ? 900 : 100; });
  const box = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return isCode(this) ? 600 : 100; });
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const right = this.classList.contains('rs-src') && this.closest('.rs-row')?.getAttribute('data-line') === '2' ? 900 : 100;
    return { top: 0, left: 0, bottom: 10, right, width: right, height: 10, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  try {
    const entry = { meta: hlMeta, load: () => Promise.resolve({ default: Highlighted }) };
    render(<CheckPage entry={entry} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
    const mine = window.__reactSlidesCheck!.findings.filter((f) => f.slide === '1-002');
    expect(mine).toContainEqual(expect.objectContaining({ kind: 'wide-line', level: 'problem', frame: 'desktop' }));
    expect(mine.find((f) => f.kind === 'wide-line')!.detail).toContain('line 2 is 5 characters');
    expect(mine).toContainEqual(expect.objectContaining({ kind: 'scrolling-block', level: 'note', frame: 'phone' }));
    expect(mine.filter((f) => f.kind === 'scrolling-block' && f.frame === 'desktop')).toEqual([]);
  } finally {
    content.mockRestore();
    box.mockRestore();
    rect.mockRestore();
  }
});

const outMeta: PartMeta = { course: 'c', part: 1, slug: 'out', title: 'Output', language: 'th', slideCount: 1 };
function LongOutput() {
  return (
    <Deck meta={outMeta} diagrams={{}} listings={{}} outputs={{ long: { lang: 'text', info: 'text', text: 'a\nb\nc\nd\ne' } }}>
      <Output id="1-001" section="Opening" title={<>ผลลัพธ์</>} body={<>b</>} snippet="long" />
    </Deck>
  );
}

test('an output box that is too tall is clipped-code', async () => {
  const isOutput = (el: Element) => el.tagName === 'PRE' && el.parentElement?.classList.contains('rs-output') === true;
  const tall = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) { return isOutput(this) ? 200 : 0; });
  const space = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return isOutput(this) ? 100 : 0; });
  try {
    const entry = { meta: outMeta, load: () => Promise.resolve({ default: LongOutput }) };
    render(<CheckPage entry={entry} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
    expect(window.__reactSlidesCheck!.findings).toContainEqual(expect.objectContaining({ slide: '1-001', kind: 'clipped-code', level: 'problem' }));
  } finally {
    tall.mockRestore();
    space.mockRestore();
  }
});

// Two labels of one drawing drawn on top of each other (a two-line label placed twice), and a drawing whose labels are apart.
const picMeta: PartMeta = { course: 'c', part: 1, slug: 'pic', title: 'Pictures', language: 'th', slideCount: 2 };
function Pictures() {
  const at = (n: number) => ({ 'data-box': `${n}` });
  return (
    <Deck meta={picMeta} diagrams={{}} listings={{}} outputs={{}}>
      <Explain id="1-001" section="Opening" title={<>ซ้อน</>} body={<>b</>} visual={<svg className="rs-figure"><text {...at(0)}>filter</text><text {...at(1)}>เก็บไหม?</text></svg>} />
      <Explain id="1-002" section="Opening" title={<>แยก</>} body={<>b</>} visual={<svg className="rs-figure"><text {...at(0)}>filter</text><text {...at(3)}>เก็บไหม?</text></svg>} />
    </Deck>
  );
}

test('the page reports labels of a drawing that sit on top of each other, and only on that slide', async () => {
  const boxes: Record<string, [number, number]> = { '0': [100, 120], '1': [112, 132], '3': [150, 170] }; // top, bottom; all 80 px wide
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = boxes[(this as HTMLElement).dataset?.box ?? ''];
    return (box ? { left: 10, right: 90, top: box[0], bottom: box[1], width: 80, height: box[1] - box[0], x: 10, y: box[0], toJSON: () => ({}) } : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });
  try {
    const entry = { meta: picMeta, load: () => Promise.resolve({ default: Pictures }) };
    render(<CheckPage entry={entry} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
    const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'text-overlap');
    expect(found).toEqual([expect.objectContaining({ slide: '1-001', level: 'problem' })]);
  } finally {
    rect.mockRestore();
  }
});

// Slide ids that do not run in file order: the writer moved a slide and kept its planned id.
const orderMeta: PartMeta = { course: 'c', part: 1, slug: 'order', title: 'Order', language: 'th', slideCount: 2 };
function OutOfOrder() {
  return (
    <Deck meta={orderMeta} diagrams={{}} listings={{}} outputs={{}}>
      <Explain id="1-002" section="Opening" title={<>สอง</>} body={<>b</>} />
      <Explain id="1-001" section="Opening" title={<>หนึ่ง</>} body={<>b</>} />
    </Deck>
  );
}

test('the page reports a slide whose id is not greater than the one before it', async () => {
  const entry = { meta: orderMeta, load: () => Promise.resolve({ default: OutOfOrder }) };
  render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
  const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'id-order');
  expect(found).toEqual([expect.objectContaining({ slide: '1-001', level: 'problem' })]);
});

// The text a reader takes in: the code in an Anatomy strip and the labels of an Error slide are not prose.
const proseMeta: PartMeta = { course: 'c', part: 1, slug: 'prose', title: 'Prose', language: 'th', slideCount: 2 };
const longCall = [{ text: 'basket.addFruit(', n: 1 }, { text: '"mango", { count: 3, ripe: true }', n: 2 }, { text: ').save()' }];
function ProseParts() {
  return (
    <Deck meta={proseMeta} diagrams={{}} listings={{}} outputs={{}}>
      <Anatomy id="1-001" section="Opening" title={<>ค</>} body={<>ก</>} pieces={longCall} items={[<>ข</>, <>ง</>]} />
      <ErrorSlide id="1-002" section="Opening" title={<>ค</>} symptom={<>ง</>} cause={<>ก</>} fix={<>ข</>} />
    </Deck>
  );
}

test('the text count leaves out the code of an Anatomy strip and the labels of an Error slide', async () => {
  const entry = { meta: proseMeta, load: () => Promise.resolve({ default: ProseParts }) };
  render(<CheckPage entry={entry} />);
  await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
  const [anatomy, error] = window.__reactSlidesCheck!.slides;
  expect(anatomy.chars).toBe('ค กขง'.length);
  expect(error.chars).toBe('ค งกข'.length);
});

// A long inline code or a run line in a Compare half runs out of the panel; only the panel's own width shows it.
const cmpMeta: PartMeta = { course: 'c', part: 1, slug: 'cmp', title: 'Compare', language: 'th', slideCount: 1 };
function Compared() {
  return (
    <Deck meta={cmpMeta} diagrams={{}} listings={{}} outputs={{}}>
      <Compare id="1-001" section="Opening" title={<>สองแบบ</>} left={<>ซ้าย</>} right={<>ขวา</>} takeaway={<>สรุป</>} />
    </Deck>
  );
}

test('text wider than a Compare panel is a clipped-text problem', async () => {
  const isPanel = (el: Element) => el.classList.contains('rs-panel');
  const content = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) { return isPanel(this) ? 700 : 100; });
  const box = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return isPanel(this) ? 520 : 100; });
  try {
    render(<CheckPage entry={{ meta: cmpMeta, load: () => Promise.resolve({ default: Compared }) }} />);
    await vi.waitFor(() => expect(window.__reactSlidesCheck?.done).toBe(true), { timeout: 6000 });
    const found = window.__reactSlidesCheck!.findings.filter((f) => f.kind === 'clipped-text');
    expect(found).toEqual([expect.objectContaining({ slide: '1-001', level: 'problem' })]);
    expect(found[0]!.detail).toContain('700');
  } finally {
    content.mockRestore();
    box.mockRestore();
  }
});
