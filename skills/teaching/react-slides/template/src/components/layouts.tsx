// One component per deck layout. Props are named after the deck's fields: required fields are required props.
// The component API is additive within a major template version: props may be added, never renamed or removed.
import { type ReactNode, useContext } from 'react';
import { formatRoute } from '../router';
import { slideNumber, t } from '../strings';
import { BlockList, CodeBlock, OutputBlock } from './code';
import { DeckModeContext, useDeck } from './Deck';
import { SlideFrame } from './SlideFrame';
import type { Base, Block, Range, Rich, Visual } from './types';
import { VisualSlot } from './Visual';

export function Field({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rs-field rs-field-${name}${className ? ` ${className}` : ''}`} data-field={name}>
      {children}
    </div>
  );
}

function Items({ items, ordered, className }: { items: Rich[]; ordered?: boolean; className?: string }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={`rs-items${className ? ` ${className}` : ''}`} data-field="items">
      {items.map((item, index) => (
        <li key={index} data-item="">
          {item}
        </li>
      ))}
    </List>
  );
}

function Labelled({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div className={`rs-labelled rs-labelled-${name}`}>
      <div className="rs-label">{label}</div>
      <Field name={name}>{children}</Field>
    </div>
  );
}

const slot = (visual?: Visual) => (visual ? <VisualSlot visual={visual} /> : undefined);

export function Cover(props: Base & { title: Rich; body?: Rich; visual?: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)} className="rs-cover">
      {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
    </SlideFrame>
  );
}

export function Focus(props: Base & { title: Rich; body: Rich; visual: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)} className="rs-focus">
      <Field name="body">{props.body}</Field>
    </SlideFrame>
  );
}

export function Explain(props: Base & { title: Rich; body: Rich; visual: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Field name="body">{props.body}</Field>
    </SlideFrame>
  );
}

export function Steps(props: Base & { title: Rich; items: Rich[]; visual: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} ordered className="rs-steps" />
    </SlideFrame>
  );
}

export function Compare(props: Base & { title: Rich; left: Rich; right: Rich; takeaway: Rich; leftBlocks?: Block[]; rightBlocks?: Block[] }) {
  const { meta } = useDeck();
  return (
    <SlideFrame slide={props} title={props.title} wide>
      <div className="rs-compare">
        <div className="rs-panel">
          <Field name="left">{props.left}</Field>
          {props.leftBlocks?.length ? <BlockList blocks={props.leftBlocks} language={meta.language} /> : null}
        </div>
        <div className="rs-panel">
          <Field name="right">{props.right}</Field>
          {props.rightBlocks?.length ? <BlockList blocks={props.rightBlocks} language={meta.language} /> : null}
        </div>
      </div>
      <Field name="takeaway" className="rs-takeaway">
        {props.takeaway}
      </Field>
    </SlideFrame>
  );
}

export function Code(props: Base & { title: Rich; body: Rich; notice?: Rich; snippet: string; lines: Range[]; highlight: Range[] }) {
  const { listings, meta } = useDeck();
  const listing = listings[props.snippet];
  return (
    <SlideFrame slide={props} title={props.title} wide>
      <Field name="body">{props.body}</Field>
      {props.notice !== undefined ? (
        <Field name="notice" className="rs-notice">
          {props.notice}
        </Field>
      ) : null}
      {listing ? <CodeBlock listing={listing} lines={props.lines} highlight={props.highlight} language={meta.language} /> : null}
    </SlideFrame>
  );
}

export function Output(props: Base & { title: Rich; body: Rich; notice?: Rich; snippet: string }) {
  const { outputs, meta } = useDeck();
  const block = outputs[props.snippet];
  return (
    <SlideFrame slide={props} title={props.title} wide>
      <Field name="body">{props.body}</Field>
      {props.notice !== undefined ? (
        <Field name="notice" className="rs-notice">
          {props.notice}
        </Field>
      ) : null}
      {block ? <OutputBlock block={block} language={meta.language} /> : null}
    </SlideFrame>
  );
}

export function Error(props: Base & { title: Rich; cause: Rich; fix: Rich; symptom?: Rich; blocks?: Block[] }) {
  const { meta } = useDeck();
  const lang = meta.language;
  return (
    <SlideFrame slide={props} title={props.title} wide>
      {props.symptom !== undefined ? (
        <Labelled label={t(lang, 'symptom')} name="symptom">
          {props.symptom}
        </Labelled>
      ) : null}
      {props.blocks?.length ? <BlockList blocks={props.blocks} language={lang} /> : null}
      <Labelled label={t(lang, 'cause')} name="cause">
        {props.cause}
      </Labelled>
      <Labelled label={t(lang, 'fix')} name="fix">
        {props.fix}
      </Labelled>
    </SlideFrame>
  );
}

export function Objectives(props: Base & { title: Rich; items: Rich[]; visual?: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} ordered />
    </SlideFrame>
  );
}

export function Setup(props: Base & { title: Rich; items: Rich[]; visual?: Visual; blocks?: Block[] }) {
  const { meta } = useDeck();
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} />
      {props.blocks?.length ? <BlockList blocks={props.blocks} language={meta.language} /> : null}
    </SlideFrame>
  );
}

export function Terms(props: Base & { title: Rich; items: Rich[]; visual?: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} className="rs-terms" />
    </SlideFrame>
  );
}

export function Question(props: Base & { question: Rich; body: Rich; items?: Rich[]; visual?: Visual }) {
  return (
    <SlideFrame slide={props} title={props.question} titleField="question" visual={slot(props.visual)}>
      {props.items?.length ? <Items items={props.items} ordered className="rs-choices" /> : null}
      <Field name="body" className="rs-hint">
        {props.body}
      </Field>
    </SlideFrame>
  );
}

export function Answer(props: Base & { answer: Rich; why: Rich; revisit: string; visual?: Visual }) {
  const { meta, ids } = useDeck();
  const n = ids.indexOf(props.revisit) + 1 || slideNumber(props.revisit);
  return (
    <SlideFrame slide={props} title={props.answer} titleField="answer" visual={slot(props.visual)}>
      <Labelled label={t(meta.language, 'why')} name="why">
        {props.why}
      </Labelled>
      {n ? (
        <a className="rs-revisit" href={formatRoute({ name: 'part', part: meta.part, slide: props.revisit })}>
          ↩ {t(meta.language, 'revisit', { n })}
        </a>
      ) : null}
    </SlideFrame>
  );
}

export function Practice(props: Base & { title: Rich; task: Rich; items?: Rich[]; solution?: Rich; visual?: Visual }) {
  const { meta } = useDeck();
  // The check page measures the slide with its solution open, the biggest it gets.
  const checking = useContext(DeckModeContext) === 'check';
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Field name="task">{props.task}</Field>
      {props.items?.length ? (
        <div className="rs-hints">
          <div className="rs-label">{t(meta.language, 'hints')}</div>
          <Items items={props.items} />
        </div>
      ) : null}
      {props.solution !== undefined ? (
        <details className="rs-solution" open={checking || undefined}>
          <summary>{t(meta.language, 'solution')}</summary>
          <Field name="solution">{props.solution}</Field>
        </details>
      ) : null}
    </SlideFrame>
  );
}

export function Summary(props: Base & { title: Rich; items: Rich[]; visual?: Visual }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} />
    </SlideFrame>
  );
}

export function Sources(props: Base & { title: Rich; items: Rich[] }) {
  return (
    <SlideFrame slide={props} title={props.title} hideSources>
      <Items items={props.items} className="rs-source-list" />
    </SlideFrame>
  );
}
