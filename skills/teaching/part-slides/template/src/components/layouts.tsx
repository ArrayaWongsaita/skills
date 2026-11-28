// One component per deck layout. Props are named after the deck's fields: required fields are required props.
// The component API is additive within a major template version: props may be added, never renamed or removed.
import { type ReactNode, useContext } from 'react';
import { formatRoute } from '../router';
import { slideNumber, t } from '../strings';
import { BlockList, CodeBlock, OutputBlock } from './code';
import { DeckModeContext, useDeck } from './Deck';
import { SlideFrame } from './SlideFrame';
import { roleColour } from '../theme/roles';
import { topicPosition, topicTitle } from './topics';
import type { AssemblyLabel, Base, Block, Piece, Range, Rich, Visual, VisualProp } from './types';
import { chapterTitle, unitPosition, unitTitle } from './units';
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

/** The colour of the n-th piece of an anatomy, from the vocabulary's roles, so a piece and its legend item share one. */
const PIECE_ROLES = ['primary', 'accent', 'success', 'secondary', 'warning', 'danger'];
const pieceColour = (n: number) => roleColour(PIECE_ROLES[(n - 1) % PIECE_ROLES.length]);

function Labelled({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div className={`rs-labelled rs-labelled-${name}`}>
      <div className="rs-label">{label}</div>
      <Field name={name}>{children}</Field>
    </div>
  );
}

const isData = (visual: VisualProp): visual is Visual => typeof visual === 'object' && visual !== null && 'kind' in visual && typeof (visual as { kind: unknown }).kind === 'string';
const slot = (visual?: VisualProp) => (!visual ? undefined : isData(visual) ? <VisualSlot visual={visual} /> : visual);

export function Cover(props: Base & { title: Rich; body?: Rich; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)} className="rs-cover">
      {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
    </SlideFrame>
  );
}

export function Focus(props: Base & { title: Rich; body: Rich; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)} className="rs-focus">
      <Field name="body">{props.body}</Field>
    </SlideFrame>
  );
}

export function Explain(props: Base & { title: Rich; body: Rich; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Field name="body">{props.body}</Field>
    </SlideFrame>
  );
}

export function Steps(props: Base & { title: Rich; items: Rich[]; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} ordered className="rs-steps" />
    </SlideFrame>
  );
}

export function Compare(props: Base & { title: Rich; left: Rich; right: Rich; takeaway: Rich; leftBlocks?: Block[]; rightBlocks?: Block[]; visual?: VisualProp }) {
  const { meta } = useDeck();
  return (
    <SlideFrame slide={props} title={props.title} wide={props.visual === undefined} visual={slot(props.visual)}>
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

export function Code(props: Base & { title: Rich; body: Rich; notice?: Rich; snippet: string; lines?: Range[]; highlight?: Range[] }) {
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
      {listing ? <CodeBlock listing={listing} lines={props.lines ?? [[1, listing.code.split('\n').length]]} highlight={props.highlight ?? []} language={meta.language} /> : null}
    </SlideFrame>
  );
}

/** One example: the code excerpt and, when the snippet has an expected output, the output right after it. */
export function Example(props: Base & { title: Rich; body: Rich; notice?: Rich; snippet: string; lines?: Range[]; highlight?: Range[] }) {
  const { listings, outputs, meta } = useDeck();
  const listing = listings[props.snippet];
  const block = outputs[props.snippet];
  return (
    <SlideFrame slide={props} title={props.title} wide className="rs-example">
      <Field name="body">{props.body}</Field>
      {props.notice !== undefined ? (
        <Field name="notice" className="rs-notice">
          {props.notice}
        </Field>
      ) : null}
      {listing ? <CodeBlock listing={listing} lines={props.lines ?? [[1, listing.code.split('\n').length]]} highlight={props.highlight ?? []} language={meta.language} /> : null}
      {block ? <OutputBlock block={block} language={meta.language} /> : null}
    </SlideFrame>
  );
}

/** One line of code or one formula cut into numbered pieces, with a legend. The markers are drawn by CSS, so the strip's text is exactly the line. */
export function Anatomy(props: Base & { title: Rich; items: Rich[]; body?: Rich; notice?: Rich; pieces: Piece[] }) {
  return (
    <SlideFrame slide={props} title={props.title} wide className="rs-anatomy">
      {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
      {props.notice !== undefined ? (
        <Field name="notice" className="rs-notice">
          {props.notice}
        </Field>
      ) : null}
      <div className="rs-anatomy-strip" translate="no">
        {props.pieces.map((piece, index) =>
          piece.n !== undefined ? (
            <span key={index} className="rs-piece" data-piece-n={piece.n} style={{ ['--rs-piece' as string]: pieceColour(piece.n) }}>
              {piece.text}
            </span>
          ) : (
            <span key={index} className="rs-piece rs-piece-plain">
              {piece.text}
            </span>
          ),
        )}
      </div>
      <ol className="rs-items rs-anatomy-legend" data-field="items">
        {props.items.map((item, index) => (
          <li key={index} data-item="" style={{ ['--rs-piece' as string]: pieceColour(index + 1) }}>
            <span>{item}</span>
          </li>
        ))}
      </ol>
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

export function Error(props: Base & { title: Rich; cause: Rich; fix: Rich; symptom?: Rich; blocks?: Block[]; visual?: VisualProp }) {
  const { meta } = useDeck();
  const lang = meta.language;
  return (
    <SlideFrame slide={props} title={props.title} wide={props.visual === undefined} visual={slot(props.visual)}>
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

export function Objectives(props: Base & { title: Rich; items: Rich[]; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} ordered />
    </SlideFrame>
  );
}

export function Setup(props: Base & { title: Rich; items: Rich[]; visual?: VisualProp; blocks?: Block[] }) {
  const { meta } = useDeck();
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} />
      {props.blocks?.length ? <BlockList blocks={props.blocks} language={meta.language} /> : null}
    </SlideFrame>
  );
}

export function Terms(props: Base & { title: Rich; items: Rich[]; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.title} visual={slot(props.visual)}>
      <Items items={props.items} className="rs-terms" />
    </SlideFrame>
  );
}

export function Question(props: Base & { question: Rich; body: Rich; items?: Rich[]; visual?: VisualProp }) {
  return (
    <SlideFrame slide={props} title={props.question} titleField="question" visual={slot(props.visual)}>
      {props.items?.length ? <Items items={props.items} ordered className="rs-choices" /> : null}
      <Field name="body" className="rs-hint">
        {props.body}
      </Field>
    </SlideFrame>
  );
}

export function Answer(props: Base & { answer: Rich; why: Rich; revisit: string; visual?: VisualProp }) {
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

export function Practice(props: Base & { title: Rich; task: Rich; items?: Rich[]; solution?: Rich; visual?: VisualProp }) {
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

export function Summary(props: Base & { title: Rich; items: Rich[]; visual?: VisualProp }) {
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

/** The Part's route: its topics in order (deck@3), or every chapter and its units (deck@2). Generated chrome, not a deck field. */
export function MapSlide(props: Base & { title: Rich; body?: Rich }) {
  const { units, topics } = useDeck();
  return (
    <SlideFrame slide={props} title={props.title} wide className="rs-map">
      {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
      {topics.topics.length ? (
        <ol className="rs-topic-map">
          {topics.topics.map((topic, index) => (
            <li key={topic.id}>
              <span className="rs-map-n" aria-hidden="true">
                {index + 1}
              </span>
              <span className="rs-topic-map-title">{topic.title}</span>
              {topic.tagline ? <span className="rs-topic-map-tagline">{topic.tagline}</span> : null}
            </li>
          ))}
        </ol>
      ) : units.chapters.length ? (
        <ol className="rs-unit-map">
          {units.chapters.map((chapter, index) => (
            <li key={chapter.id} className="rs-map-chapter">
              <div className="rs-map-chapter-title">
                <span className="rs-map-n" aria-hidden="true">
                  {index + 1}
                </span>
                {chapter.title}
              </div>
              <ol className="rs-map-units">
                {chapter.units.map((unit) => (
                  <li key={unit.id}>{unit.title}</li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : null}
    </SlideFrame>
  );
}

/**
 * The divider that opens a topic (deck@3): its title large, its tagline and an optional picture, and nothing else.
 * In a deck@2 deck it opens a unit: where it sits in its chapter, its title and goal, and the chapter's units so far.
 */
export function Topic(props: Base & { unit?: string; title: Rich; body?: Rich; visual?: VisualProp }) {
  const { meta, units, topics } = useDeck();
  const place = props.topic ? topicPosition(topics, props.topic) : null;
  if (place) {
    return (
      <SlideFrame slide={props} title={props.title} kicker={t(meta.language, 'nextTopic', { n: place.n, m: place.m })} visual={slot(props.visual)} className="rs-topic rs-divider">
        {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
      </SlideFrame>
    );
  }
  const position = props.unit ? unitPosition(units, props.unit) : null;
  const kicker = position ? t(meta.language, 'unit', { n: position.n, m: position.m }) : undefined;
  return (
    <SlideFrame slide={props} title={props.title} kicker={kicker} visual={slot(props.visual)} className={props.unit ? 'rs-topic' : 'rs-topic rs-divider'}>
      {props.body !== undefined ? <Field name="body">{props.body}</Field> : null}
      {position ? (
        <ol className="rs-topic-units">
          {position.chapter.units.map((unit, index) => (
            <li key={unit.id} data-unit-state={index + 1 < position.n ? 'done' : index + 1 === position.n ? 'current' : 'todo'}>
              {unit.title}
            </li>
          ))}
        </ol>
      ) : null}
    </SlideFrame>
  );
}

/** Puts a chapter's units, the whole Part's chapters (deck@2) or the whole Part's topics (deck@3) back together: numbered code lines or diagram elements, with a legend. */
export function Assemble(props: Base & {
  title: Rich; body: Rich; notice?: Rich; assembles: string; labels: AssemblyLabel[]; snippet?: string; lines?: Range[]; visual?: Visual;
}) {
  const { listings, meta, units, topics } = useDeck();
  const numbered = props.labels.map((label, index) => ({ ...label, n: index + 1 }));
  const name = (label: AssemblyLabel) =>
    label.topic ? topicTitle(topics, label.topic) : label.unit ? unitTitle(units, label.unit) : label.chapter ? chapterTitle(units, label.chapter) : '';
  const listing = props.snippet ? listings[props.snippet] : undefined;
  const code = listing && props.lines;
  const legend = (
    <ol className="rs-assembly-legend">
      {numbered.map((label) => (
        <li key={label.n} data-label={label.n}>
          <span className="rs-assembly-n" aria-hidden="true">
            {label.n}
          </span>
          <span className="rs-assembly-name">{name(label)}</span>
        </li>
      ))}
    </ol>
  );
  const visual = !code && props.visual ? (
    <VisualSlot visual={props.visual} labels={numbered.filter((l) => l.elements).map((l) => ({ n: l.n, elements: l.elements! }))} />
  ) : undefined;
  return (
    <SlideFrame slide={props} title={props.title} wide={Boolean(code)} visual={visual} className="rs-assemble">
      <Field name="body">{props.body}</Field>
      {props.notice !== undefined ? (
        <Field name="notice" className="rs-notice">
          {props.notice}
        </Field>
      ) : null}
      {legend}
      {code ? (
        <CodeBlock
          listing={listing}
          lines={props.lines!}
          highlight={[]}
          language={meta.language}
          groups={numbered.filter((l) => l.lines).map((l) => ({ n: l.n, lines: l.lines! }))}
        />
      ) : null}
    </SlideFrame>
  );
}
