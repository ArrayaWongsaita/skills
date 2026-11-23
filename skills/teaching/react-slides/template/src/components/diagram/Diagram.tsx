// One slide's state of a deck diagram: shown elements only, `new` ones drawn in, `highlight` stronger, `dim` faded.
import { roleColour } from '../../theme/roles';
import { vocabulary as courseVocabulary } from '../../vocabulary';
import { iconFor, useIcons } from '../icons';
import { SketchArrow, SketchEllipse, SketchRect } from '../sketch';
import type { DiagramDef, DiagramState, Vocabulary } from '../types';
import { CELL, edgePoints, elementBox, groupBox, nearPoint, outOfCanvas } from './geometry';
import { labelArea, Shape } from './shapes';

const PAD = 32;
const INK = '#2b2b2b';
const EDGE_INK = '#555555';

type Props = { state: DiagramState; def: DiagramDef; animate: boolean; vocabulary?: Vocabulary };

export function Diagram({ state, def, animate, vocabulary = courseVocabulary }: Props) {
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

  const nodes = def.nodes.filter((n) => show.has(n.id));
  const groups = def.groups.filter((g) => show.has(g.id));
  const edges = def.edges.filter((e) => show.has(e.id));
  const badges = def.badges.filter((b) => show.has(b.id));
  const notes = def.notes.filter((n) => show.has(n.id));
  const iconsReady = useIcons(nodes.some((n) => concept(n.concept)?.icon));

  const width = def.canvas[0] * CELL;
  const height = def.canvas[1] * CELL;
  const labels = [...groups, ...nodes, ...edges].map((item) => item.label).filter(Boolean);
  const outside = outOfCanvas(def).filter((id) => show.has(id));

  return (
    <svg
      className="rs-diagram"
      viewBox={`${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`}
      role="img"
      aria-label={`${def.title}: ${labels.join(', ')}`}
      data-diagram={def.id}
      {...(outside.length ? { 'data-out-of-canvas': outside.join(',') } : {})}
    >
      {groups.map((group) => {
        const box = groupBox(def, group);
        return (
          <g key={group.id} data-el={group.id} className={classes(group.id)}>
            <SketchRect seedKey={seed(group.id)} {...box} rounded dashed stroke={colourOf(group.concept)} strokeWidth={1.3} draw={drawn(group.id)} />
            <text className={fade(group.id)} x={box.x + 10} y={box.y + 15} fontSize={13} fill={colourOf(group.concept)}>
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
        const iconSize = Icon ? Math.min(20, area.h * 0.6) : 0;
        const textX = area.x + area.w / 2 + (Icon ? iconSize / 2 + 2 : 0);
        return (
          <g key={node.id} data-el={node.id} className={classes(node.id)}>
            <Shape shape={shape} box={box} seedKey={seed(node.id)} stroke={stroke} draw={drawn(node.id)} />
            <g className={fade(node.id)}>
              {Icon ? (
                <Icon
                  data-icon={concept(node.concept)?.icon}
                  x={textX - iconSize - 4 - node.label.length * 3.6}
                  y={area.y + area.h / 2 - iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                  color={stroke}
                  strokeWidth={1.8}
                />
              ) : null}
              <text x={textX} y={area.y + area.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={15} fill={INK}>
                {node.label}
              </text>
            </g>
          </g>
        );
      })}
      {edges.map((edge) => {
        const { from, to } = edgePoints(def, edge);
        return (
          <g key={edge.id} data-el={edge.id} className={classes(edge.id)}>
            <SketchArrow seedKey={seed(edge.id)} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={EDGE_INK} strokeWidth={1.4} dashed={edge.style === 'dashed'} draw={drawn(edge.id)} />
            {edge.label ? (
              <text className={`rs-halo${fade(edge.id) ? ' rs-fade' : ''}`} x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fontSize={13} fill={EDGE_INK}>
                {edge.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {badges.map((badge) => {
        const box = elementBox(def, badge.near);
        const at = box ? { x: box.x + 2, y: box.y + 2 } : nearPoint(def, badge.near);
        if (!at) return null;
        return (
          <g key={badge.id} data-el={badge.id} className={classes(badge.id)}>
            <SketchEllipse seedKey={seed(badge.id)} cx={at.x} cy={at.y} w={22} h={22} stroke={roleColour('accent')} fill="#ffffff" fillStyle="solid" draw={drawn(badge.id)} />
            <text className={fade(badge.id)} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={INK}>
              {badge.n}
            </text>
          </g>
        );
      })}
      {notes.map((note) => {
        const box = elementBox(def, note.near);
        const at = box ? { x: box.x + box.w / 2, y: box.y + box.h + 18 } : nearPoint(def, note.near);
        if (!at) return null;
        return (
          <g key={note.id} data-el={note.id} className={classes(note.id)}>
            <text className={`rs-halo${fade(note.id) ? ' rs-fade' : ''}`} x={at.x} y={box ? at.y : at.y + 22} textAnchor="middle" fontSize={13} fill={EDGE_INK}>
              {note.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
