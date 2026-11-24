import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Home } from './Home';
import type { PartMeta } from './types';

const parts: PartMeta[] = [
  { course: 'c', part: 1, slug: 'part-01', title: 'Agent ตัวแรก', language: 'th', slideCount: 40 },
  { course: 'c', part: 2, slug: 'part-02', title: 'กราฟ', language: 'th', slideCount: 12 },
];

test('cards link to parts and show progress', () => {
  render(<Home course={{ slug: 'c', title: 'คอร์ส' }} parts={parts} progress={{ 1: { furthest: '1-025' } }} />);
  expect(screen.getByRole('heading', { name: 'คอร์ส' })).toBeInTheDocument();
  const links = screen.getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/part-01', '#/part-02']);
  expect(links[0]).toHaveTextContent('Part 1');
  expect(links[0]).toHaveTextContent('Agent ตัวแรก');
  expect(links[0]).toHaveTextContent('40 หน้า');
  expect(links[0]).toHaveTextContent('อ่านถึงหน้า 25');
  expect(links[1]).toHaveTextContent('ยังไม่เริ่ม');
  expect(links[0].querySelector('[data-progress]')).not.toBeNull();
  expect(links[1].querySelector('[data-progress]')).toBeNull();
});

test('english interface for other languages', () => {
  render(<Home course={{ slug: 'c', title: 'Course' }} parts={[{ ...parts[0], language: 'fr' }]} progress={{}} />);
  expect(screen.getByRole('link')).toHaveTextContent('Not started');
});

test('no parts yet', () => {
  render(<Home course={{ slug: 'c', title: 'Course' }} parts={[]} progress={{}} />);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});
