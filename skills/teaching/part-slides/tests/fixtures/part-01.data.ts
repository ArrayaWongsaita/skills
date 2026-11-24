import type { Block, Listing, PartMeta } from '../components/types';

export const meta: PartMeta = {
  course: 'fixture-course',
  part: 1,
  slug: 'sorting-a-list',
  title: 'Sorting a list',
  language: 'en',
  slideCount: 10,
};

export const listings: Record<string, Listing> = {
  sort: { lang: 'python', status: 'verified', reason: '', code: "names = ['mia', 'al', 'zed']\nnames.sort()\nprint(names)" },
};
export const outputs: Record<string, Block> = {
  sort: { lang: 'text', info: 'text', text: "['al', 'mia', 'zed']" },
};
