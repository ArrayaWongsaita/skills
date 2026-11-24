// One slide's state of a deck diagram: shown elements only, `new` ones drawn in, `highlight` stronger, `dim` faded.
// An assembly adds numbered `labels`: each labelled element carries its number, and the number is drawn once by its elements.
import { roleColour } from '../../theme/roles';
import { vocabulary as courseVocabulary } from '../../vocabulary';
import { iconFor, useIcons } from '../icons';
import { SketchArrow, SketchEllipse, SketchRect } from '../sketch';
import type { DiagramDef, DiagramState, Vocabulary } from '../types';
import { type Box, CELL, edgePoints, edgeSlots, elementBox, groupBox, nearPoint, outOfCanvas } from './geometry';
import { labelArea, Shape } from './shapes';

const PAD = 32;
const INK = '#2b2b2b';
const EDGE_INK = '#555555';
/** Text sizes in canvas units: a 16-column canvas shows at about 0.8 scale on a 1280 px slide. */
const NODE_TEXT = 18;
const SMALL_TEXT = 15;
const BADGE = 26;
const TAG = 30;

export type DiagramLabel = { n: number; elements: string[] };
type Props = { state: DiagramState; def: DiagramDef; animate: boolean; vocabulary?: Vocabulary; labels?: DiagramLabel[] };

/** The box around a label's shown elements: nodes and groups by their boxes, edges by their middles. */
function labelBox(def: DiagramDef, ids: string[]): Box | null {
  const boxes = ids.flatMap((id) => {
    const box = elementBox(def, id);
    if (box) return [box];
    const at = nearPoint(def, id);
    return at ? [{ x: at.x, y: at.y, w: 0, h: 0 }] : [];
  });
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

export function Diagram({ state, def, animate, vocabulary = courseVocabulary, labels = [] }: Props) {
  const show = new Set(state.show);
  const fresh = new Set(state.new ?? []);
  const strong = new Set(state.highlight);
  const faded = new Set(state.dim);
  const concept = (id?: string) => vocabulary.concepts.find((c) => c.id === id);
  const groupOf = (nodeId: string) => def.groups.find((g) => g.members.includes(nodeId));
  const colourOf = (conceptId?: string, fallback?: string) => roleColour(concept(conceptId)?.role ?? concept(fallback)?.role ?? 'neutral');
  const classes = (id: string) => [fresh.has(id) && 'rs-new', strong.has(id) && 'rs-hl', faded.has(id) && 'rs-dim'].filter(Boolean).join(' ') || undefined;
  const drawn = (id: string) => animate && fresh.has(id);
  const fade = (id: string) => (drawn(id) ? 'rs-fade' : undefined);
  const seed = (id: string) => `${def.id}/${id}`;
  const labelOf = new Map<string, number>();
  for (const label of labels) for (const id of label.elements) if (!labelOf.has(id)) labelOf.set(id, label.n);
  const mark = (id: string) => (labelOf.has(id) ? { 'data-label': labelOf.get(id) } : {});

  const nodes = def.nodes.filter((n) => show.has(n.id));
  const groups = def.groups.filter((g) => show.has(g.id));
  const edges = def.edges.filter((e) => show.has(e.id));
  const badges = def.badges.filter((b) => show.has(b.id));
  const notes = def.notes.filter((n) => show.has(n.id));
  const iconsReady = useIcons(nodes.some((n) => concept(n.concept)?.icon));

  const width = def.canvas[0] * CELL;
  const height = def.canvas[1] * CELL;
  const names = [...groups, ...nodes, ...edges].map((item) => item.label).filter(Boolean);
  const outside = outOfCanvas(def).filter((id) => show.has(id));

  return (
    <svg
      className="rs-diagram"
      viewBox={`${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`}
      role="img"
      aria-label={`${def.title}: ${names.join(', ')}`}
      data-diagram={def.id}
      {...(outside.length ? { 'data-out-of-canvas': outside.join(',') } : {})}
    >
      {groups.map((group) => {
        const box = groupBox(def, group);
        return (
          <g key={group.id} data-el={group.id} className={classes(group.id)} {...mark(group.id)}>
            <SketchRect seedKey={seed(group.id)} {...box} rounded dashed stroke={colourOf(group.concept)} strokeWidth={1.3} draw={drawn(group.id)} />
            <text className={fade(group.id)} x={box.x + 8} y={box.y - 8} fontSize={SMALL_TEXT} fill={colourOf(group.concept)}>
              {group.label}
            </text>
          </g>
        );
      })}
      {nodes.map((node) => {
        const box = elementBox(def, node.id)!;
        const shape = concept(node.concept)?.shape ?? 'box';
        const stroke = colourOf(node.concept, groupOf(node.id)?.concept);
        const Icon = iconsReady ? iconFor(concept(node.concept)?.icon ?? '') : null;
        const area = labelArea(shape, box);
        const iconSize = Icon ? Math.min(22, area.h * 0.6) : 0;
        const textX = area.x + area.w / 2 + (Icon ? iconSize / 2 + 2 : 0);
        return (
          <g key={node.id} data-el={node.id} className={classes(node.id)} {...mark(node.id)}>
            <Shape shape={shape} box={box} seedKey={seed(node.id)} stroke={stroke} draw={drawn(node.id)} />
            <g className={fade(node.id)}>
              {Icon ? (
                <Icon
                  data-icon={concept(node.concept)?.icon}
                  x={textX - iconSize - 4 - node.label.length * 4.4}
                  y={area.y + area.h / 2 - iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                  color={stroke}
                  strokeWidth={1.8}
                />
              ) : null}
              <text x={textX} y={area.y + area.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={NODE_TEXT} fill={INK}>
                {node.label}
              </text>
            </g>
          </g>
        );
      })}
      {edges.map((edge) => {
        const { from, to } = edgePoints(def, edge);
        const { label } = edgeSlots(def, edge);
        return (
          <g key={edge.id} data-el={edge.id} className={classes(edge.id)} {...mark(edge.id)}>
            <SketchArrow seedKey={seed(edge.id)} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={EDGE_INK} strokeWidth={1.4} dashed={edge.style === 'dashed'} draw={drawn(edge.id)} />
            {edge.label ? (
              <text className={`rs-halo${fade(edge.id) ? ' rs-fade' : ''}`} x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline="central" fontSize={SMALL_TEXT} fill={EDGE_INK}>
                {edge.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {badges.map((badge) => {
        const box = elementBox(def, badge.near);
        const edge = def.edges.find((e) => e.id === badge.near);
        const at = box ? { x: box.x, y: box.y } : edge ? edgeSlots(def, edge).badge : null;
        if (!at) return null;
        return (
          <g key={badge.id} data-el={badge.id} className={classes(badge.id)} {...mark(badge.id)}>
            <SketchEllipse seedKey={seed(badge.id)} cx={at.x} cy={at.y} w={BADGE} h={BADGE} stroke={roleColour('accent')} fill="#ffffff" fillStyle="solid" draw={drawn(badge.id)} />
            <text className={fade(badge.id)} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={SMALL_TEXT} fill={INK}>
              {badge.n}
            </text>
          </g>
        );
      })}
      {notes.map((note) => {
        const box = elementBox(def, note.near);
        const edge = def.edges.find((e) => e.id === note.near);
        const at = box ? { x: box.x + box.w / 2, y: box.y + box.h + 16, anchor: 'middle' as const } : edge ? edgeSlots(def, edge).note : null;
        if (!at) return null;
        return (
          <g key={note.id} data-el={note.id} className={classes(note.id)} {...mark(note.id)}>
            <text className={`rs-halo${fade(note.id) ? ' rs-fade' : ''}`} x={at.x} y={at.y} textAnchor={at.anchor} dominantBaseline="central" fontSize={SMALL_TEXT} fill={EDGE_INK}>
              {note.text}
            </text>
          </g>
        );
      })}
      {labels.map((label) => {
        const box = labelBox(def, label.elements.filter((id) => show.has(id)));
        if (!box) return null;
        const at = { x: box.x + box.w, y: box.y };
        return (
          <g key={`label-${label.n}`} className="rs-label-tag" data-label-tag={label.n}>
            <SketchEllipse seedKey={seed(`label-${label.n}`)} cx={at.x} cy={at.y} w={TAG} h={TAG} stroke={roleColour('primary')} fill={roleColour('primary')} fillStyle="solid" draw={false} />
            <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={SMALL_TEXT} fontWeight={700} fill="#ffffff">
              {label.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
