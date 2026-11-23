import { render, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { fixtureDiagrams } from '../../__fixtures__/DeckFixture';
import type { DiagramState, Vocabulary } from '../types';
import { Diagram } from './Diagram';

const DEF = fixtureDiagrams['d-loop'];
const vocabulary: Vocabulary = {
  version: 1,
  roles: { primary: '#1A73E8' },
  concepts: [
    { id: 'user', meaning: '', shape: 'person', role: 'neutral', icon: '' },
    { id: 'model', meaning: '', shape: 'rounded-box', role: 'primary', icon: 'bot' },
    { id: 'tool', meaning: '', shape: 'box', role: 'accent', icon: 'no-such-icon' },
    { id: 'agent', meaning: '', shape: 'box', role: 'primary', icon: '' },
  ],
  style: '',
};
const step1: DiagramState = { kind: 'diagram', diagram: 'd-loop', show: ['n-user', 'n-model', 'e-ask'], new: ['n-user', 'n-model', 'e-ask'], highlight: [], dim: [] };
const step3: DiagramState = {
  kind: 'diagram', diagram: 'd-loop',
  show: ['n-user', 'n-model', 'e-ask', 'n-tool', 'e-call', 'e-back', 'g-agent', 'e-hand', 'b1', 'b2', 't-loop'],
  new: ['e-hand', 'b1', 'b2', 't-loop'], highlight: ['n-model'], dim: ['e-ask'],
};
const draw = (state: DiagramState, animate = true) => render(<Diagram state={state} def={DEF} animate={animate} vocabulary={vocabulary} />);

test('hidden elements are not rendered', () => {
  const { container } = draw(step1);
  expect(container.querySelector('[data-el="n-model"]')).not.toBeNull();
  expect(container.querySelector('[data-el="n-tool"]')).toBeNull();
  expect(container.querySelector('[data-el="g-agent"]')).toBeNull();
});

test('new, highlight and dim are marked', () => {
  const { container } = draw(step3);
  expect(container.querySelector('[data-el="e-hand"]')).toHaveClass('rs-new');
  expect(container.querySelector('[data-el="n-model"]')).toHaveClass('rs-hl');
  expect(container.querySelector('[data-el="e-ask"]')).toHaveClass('rs-dim');
  expect(container.querySelector('[data-el="n-tool"]')!.getAttribute('class') ?? '').toBe('');
});

test('new elements draw only when animating', () => {
  expect(draw(step1, true).container.querySelectorAll('.rs-draw').length).toBeGreaterThan(0);
  expect(draw(step1, false).container.querySelectorAll('.rs-draw')).toHaveLength(0);
  expect(draw(step1, false).container.querySelectorAll('.rs-fade')).toHaveLength(0);
});

test('only new elements draw in', () => {
  const { container } = draw(step3);
  expect(container.querySelector('[data-el="n-model"] .rs-draw')).toBeNull();
  expect(container.querySelector('[data-el="b1"] .rs-draw')).not.toBeNull();
});

test('an element looks the same on every slide', () => {
  const d = (state: DiagramState) => draw(state, false).container.querySelector('[data-el="n-model"] path')!.getAttribute('d');
  expect(d(step1)).toBe(d(step3));
});

test('badges, notes and labels are drawn', () => {
  const { container } = draw(step3);
  expect(container.querySelector('[data-el="b2"]')).toHaveTextContent('2');
  expect(container.querySelector('[data-el="t-loop"]')).toHaveTextContent('วนจนได้คำตอบ');
  expect(container.querySelector('[data-el="e-call"]')).toHaveTextContent('tool call');
  expect(container.querySelector('[data-el="g-agent"]')).toHaveTextContent('agent');
});

test('the diagram describes itself', () => {
  const svg = draw(step1).container.querySelector('svg')!;
  expect(svg).toHaveAttribute('role', 'img');
  expect(svg.getAttribute('aria-label')).toContain('วงรอบ');
  expect(svg.getAttribute('aria-label')).toContain('Model');
  expect(svg.getAttribute('aria-label')).not.toContain('Tool');
});

test('a known icon is drawn and an unknown icon draws nothing', async () => {
  const { container } = draw(step3, false);
  await waitFor(() => expect(container.querySelector('[data-el="n-model"] [data-icon="bot"]')).not.toBeNull());
  expect(container.querySelector('[data-el="n-tool"] [data-icon]')).toBeNull();
});

test('every shape draws something', () => {
  const shapes = ['box', 'rounded-box', 'circle', 'cylinder', 'document', 'person', 'cloud', 'hexagon'];
  for (const shape of shapes) {
    const v = { ...vocabulary, concepts: [{ id: 'model', meaning: '', shape, role: 'primary', icon: '' }] };
    const { container, unmount } = render(<Diagram state={step1} def={DEF} animate={false} vocabulary={v} />);
    expect(container.querySelectorAll('[data-el="n-model"] path').length, shape).toBeGreaterThan(0);
    unmount();
  }
});
