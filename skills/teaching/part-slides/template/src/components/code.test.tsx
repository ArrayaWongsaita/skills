import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DeckFixture } from '../__fixtures__/DeckFixture';
import { BlockList, CodeBlock, excerptRows, excerptText, highlightLang, OutputBlock } from './code';
import { Code, Setup } from './layouts';
import type { Listing } from './types';

const listing: Listing = { lang: 'python', status: 'verified', reason: '', code: 'a\nb\nc\nd\ne\nf' };

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

test('excerpt rows and gap', () => {
  expect(excerptRows('a\nb\nc\nd\ne\nf', [[1, 2], [5, 6]])).toEqual([{ n: 1, text: 'a' }, { n: 2, text: 'b' }, 'gap', { n: 5, text: 'e' }, { n: 6, text: 'f' }]);
  expect(excerptRows('a\nb\nc', [[1, 1], [2, 3]])).toEqual([{ n: 1, text: 'a' }, { n: 2, text: 'b' }, { n: 3, text: 'c' }]);
  expect(excerptText('a\nb\nc\nd\ne\nf', [[1, 2], [5, 6]])).toBe('a\nb\ne\nf\n');
});

test('rows show the real line numbers and a gap row', () => {
  const { container } = render(<CodeBlock listing={listing} lines={[[1, 2], [5, 6]]} highlight={[]} language="th" />);
  expect([...container.querySelectorAll('[data-line]')].map((row) => row.getAttribute('data-line'))).toEqual(['1', '2', '5', '6']);
  expect(container.querySelector('.rs-gap')).toHaveTextContent('⋯');
});

test('a code block has one copy button, and it copies exactly the shown lines', async () => {
  const writeText = mockClipboard();
  render(<CodeBlock listing={listing} lines={[[1, 2], [5, 6]]} highlight={[]} language="th" />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'คัดลอก' }));
  expect(await screen.findByText('คัดลอกแล้ว ✓')).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith('a\nb\ne\nf\n');
});

test('a whole listing is copied whole', async () => {
  const writeText = mockClipboard();
  render(<CodeBlock listing={listing} lines={[[1, 6]]} highlight={[]} language="th" />);
  fireEvent.click(screen.getByRole('button', { name: 'คัดลอก' }));
  await screen.findByText('คัดลอกแล้ว ✓');
  expect(writeText).toHaveBeenCalledWith('a\nb\nc\nd\ne\nf\n');
});

test('clipboard unavailable', async () => {
  render(<CodeBlock listing={listing} lines={[[1, 2]]} highlight={[]} language="en" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
  expect(await screen.findByText('Could not copy: select the text instead')).toBeInTheDocument();
});

test('highlighted rows are marked', () => {
  const { container } = render(<CodeBlock listing={listing} lines={[[1, 6]]} highlight={[[5, 5]]} language="th" />);
  expect(container.querySelector('[data-line="5"]')).toHaveClass('rs-hl');
  expect(container.querySelector('[data-line="4"]')).not.toHaveClass('rs-hl');
});

test('known languages are highlighted, across lines', () => {
  const code = 'x = """one\ntwo"""\nprint(x)';
  const { container } = render(<CodeBlock listing={{ ...listing, code }} lines={[[1, 3]]} highlight={[]} language="th" />);
  expect(container.querySelector('[data-line="2"] .hljs-string')).toHaveTextContent('two"""');
  expect(container.querySelector('[data-line="3"]')).toHaveTextContent('print(x)');
});

test('unknown language renders plain', () => {
  const code = 'IDENTIFICATION <DIVISION> & {x}';
  const { container } = render(<CodeBlock listing={{ ...listing, lang: 'cobol', code }} lines={[[1, 1]]} highlight={[]} language="th" />);
  expect(container.querySelector('[class^="hljs-"]')).toBeNull();
  expect(container.querySelector('[data-line="1"] .rs-src')).toHaveTextContent(code);
  expect(highlightLang('cobol')).toBeNull();
  expect(highlightLang('shell')).toBe('bash');
  expect(highlightLang('py')).toBe('python');
});

test('unverified listing shows the notice', () => {
  const { container } = render(
    <DeckFixture>
      <Code id="1-030" section="s" purpose="p" from={[]} sources={[]} title={<>t</>} body={<>b</>} notice={<>ยังไม่ได้รันจริง</>} snippet="s-new" lines={[[1, 1]]} highlight={[]} />
    </DeckFixture>,
  );
  expect(screen.getByText('ยังไม่ได้รันจริง')).toBeInTheDocument();
  expect(container.querySelector('[data-line="1"] .rs-src')).toHaveTextContent('print("hi")');
});

test('illustrative output is labelled and has no copy button', () => {
  render(<OutputBlock block={{ lang: 'text', info: 'text illustrative', text: '<b>out</b>' }} language="th" />);
  expect(screen.getByText('ผลลัพธ์ตัวอย่าง')).toBeInTheDocument();
  expect(screen.getByText('<b>out</b>')).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
});

test('other blocks get one copy button each', async () => {
  const writeText = mockClipboard();
  render(<BlockList blocks={[{ lang: 'bash', info: 'bash', text: 'pip install x' }, { lang: 'text', info: 'text', text: 'Error 401' }]} language="th" />);
  const buttons = screen.getAllByRole('button', { name: 'คัดลอก' });
  expect(buttons).toHaveLength(2);
  fireEvent.click(buttons[0]);
  await screen.findByText('คัดลอกแล้ว ✓');
  expect(writeText).toHaveBeenCalledWith('pip install x\n');
});

test('setup slides use the block list', () => {
  render(
    <DeckFixture>
      <Setup id="1-031" section="s" purpose="p" from={[]} sources={[]} title={<>t</>} items={[<>ติดตั้ง</>]} blocks={[{ lang: 'bash', info: 'bash', text: 'pip install y' }]} />
    </DeckFixture>,
  );
  expect(screen.getByRole('button', { name: 'คัดลอก' })).toBeInTheDocument();
});

test('without groups no row carries a group', () => {
  const { container } = render(<CodeBlock listing={listing} lines={[[1, 6]]} highlight={[]} language="th" />);
  expect(container.querySelector('[data-group]')).toBeNull();
  expect(container.querySelector('.rs-group-n')).toBeNull();
});

test('groups mark their rows and number their first row', () => {
  const { container } = render(<CodeBlock listing={listing} lines={[[1, 6]]} highlight={[]} language="th" groups={[{ n: 1, lines: [[2, 3]] }, { n: 2, lines: [[5, 6]] }]} />);
  expect([...container.querySelectorAll('[data-group]')].map((row) => `${row.getAttribute('data-line')}:${row.getAttribute('data-group')}`)).toEqual(['2:1', '3:1', '5:2', '6:2']);
  expect([...container.querySelectorAll('.rs-group-n')].map((mark) => mark.textContent)).toEqual(['1', '2']);
});
