// `npm run build` type-checks this file: each line leaves out a required prop and must fail to compile.
import {
  Anatomy, Answer, Assemble, Code, Compare, Cover, Error as ErrorSlide, Example, Explain, Focus, MapSlide, Objectives, Output, Practice, Question, Setup, Sources,
  Steps, Summary, Terms, Topic,
} from '../components';
import type { Visual } from '../components/types';

const base = { id: 'x', section: 's', purpose: 'p', from: [], sources: [] };
const v: Visual = { kind: 'diagram', diagram: 'd', show: [], highlight: [], dim: [] };
const r = <>text</>;

export const missingRequiredProps = [
  // @ts-expect-error title is required
  <Cover key="cover" {...base} />,
  // @ts-expect-error body is required
  <Focus key="focus" {...base} title={r} visual={v} />,
  // @ts-expect-error body is required
  <Explain key="explain" {...base} title={r} visual={v} />,
  // @ts-expect-error items is required
  <Steps key="steps" {...base} title={r} visual={v} />,
  // @ts-expect-error takeaway is required
  <Compare key="compare" {...base} title={r} left={r} right={r} />,
  // @ts-expect-error snippet is required
  <Code key="code" {...base} title={r} body={r} />,
  // @ts-expect-error snippet is required
  <Output key="output" {...base} title={r} body={r} />,
  // @ts-expect-error fix is required
  <ErrorSlide key="error" {...base} title={r} cause={r} />,
  // @ts-expect-error items is required
  <Objectives key="objectives" {...base} title={r} />,
  // @ts-expect-error items is required
  <Setup key="setup" {...base} title={r} />,
  // @ts-expect-error items is required
  <Terms key="terms" {...base} title={r} />,
  // @ts-expect-error body is required
  <Question key="question" {...base} question={r} />,
  // @ts-expect-error revisit is required
  <Answer key="answer" {...base} answer={r} why={r} />,
  // @ts-expect-error task is required
  <Practice key="practice" {...base} title={r} />,
  // @ts-expect-error items is required
  <Summary key="summary" {...base} title={r} />,
  // @ts-expect-error items is required
  <Sources key="sources" {...base} title={r} />,
  // @ts-expect-error title is required
  <MapSlide key="map" {...base} />,
  // @ts-expect-error title is required
  <Topic key="topic" {...base} />,
  // @ts-expect-error pieces is required
  <Anatomy key="anatomy" {...base} title={r} items={[r, r]} />,
  // @ts-expect-error items is required
  <Anatomy key="anatomy-items" {...base} title={r} pieces={[]} />,
  // @ts-expect-error snippet is required
  <Example key="example" {...base} title={r} body={r} />,
  // @ts-expect-error labels is required
  <Assemble key="assemble" {...base} title={r} body={r} assembles="1.1" />,
  // @ts-expect-error a visual is required on explain slides
  <Explain key="explain-visual" {...base} title={r} body={r} />,
  // @ts-expect-error id is part of every slide
  <Summary key="summary-id" section="s" purpose="p" from={[]} sources={[]} title={r} items={[]} />,
];
