// Reusable figures for illustrations: a flow, a pipeline, nested boxes, cells, bars, a network and a cycle.
// Each draws with the Sketch primitives and the vocabulary's role colours, takes its labels as plain text and draws them verbatim.
// The root is an `<svg data-figure="<name>">`; every labelled thing is a `[data-el]`, and `highlight` marks one of them with `data-highlight="true"`.
// An empty list draws nothing. A drawing in `illustrations/` places a figure inside its own `<svg>` or returns one.
import type { ReactNode } from 'react';
import { roleColour } from '../theme/roles';
import { SketchArrow, SketchEllipse, SketchLine, SketchRect } from './sketch';

type Label = string;

const INK = '#2b2b2b';
const MUTED = '#646464';
const EDGE = '#b5b5b5';
const SIZE = 20;
const PAD = 16;

/** Text width by character count: a figure sizes its boxes from its labels before the browser has drawn them. */
const textWidth = (text: string, size = SIZE) => [...text].length * size * 0.62;
const widest = (texts: string[], size = SIZE) => Math.max(0, ...texts.map((text) => textWidth(text, size)));
const accent = () => roleColour('accent');
const round = (value: number) => Math.round(value * 100) / 100;

function Frame({ name, width, height, labels, children }: { name: string; width: number; height: number; labels: string[]; children: ReactNode }) {
  return (
    <svg className="rs-figure" data-figure={name} viewBox={`0 0 ${round(width)} ${round(height)}`} role="img" aria-label={labels.join(', ')} fontFamily="var(--rs-font)">
      {children}
    </svg>
  );
}

function Text(props: { x: number; y: number; children: string; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; extra?: Record<string, string> }) {
  const { x, y, children, size = SIZE, fill = INK, anchor = 'middle', weight, extra } = props;
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={size} fill={fill} fontWeight={weight} {...extra}>
      {children}
    </text>
  );
}

/** A labelled box: one element of a figure. */
function Box({ seed, x, y, w, h, label, lit, children }: { seed: string; x: number; y: number; w: number; h: number; label: Label; lit: boolean; children?: ReactNode }) {
  return (
    <g data-el="" data-highlight={lit ? 'true' : undefined}>
      <SketchRect seedKey={seed} x={x} y={y} w={w} h={h} rounded stroke={lit ? accent() : INK} strokeWidth={lit ? 2.6 : 1.6} fill={lit ? accent() : undefined} />
      <Text x={x + w / 2} y={y + h / 2} extra={{ 'data-label': '' }}>
        {label}
      </Text>
      {children}
    </g>
  );
}

function Arrow({ seed, x1, y1, x2, y2 }: { seed: string; x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g data-arrow="">
      <SketchArrow seedKey={seed} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.8} />
    </g>
  );
}

/** Boxes in a row with an arrow between neighbours; `columns` is the width each one needs and `notes` the line under it. */
function Row({ name, seed, labels, notes = [], highlight }: { name: string; seed: string; labels: Label[]; notes?: (Label | undefined)[]; highlight?: number }) {
  const gap = 48;
  const height = 56;
  const widths = labels.map((label, index) => Math.max(90, textWidth(label) + 28, notes[index] ? textWidth(notes[index]!, 16) : 0));
  const starts = widths.reduce<number[]>((all, width, index) => [...all, index ? all[index - 1] + widths[index - 1] + gap : PAD], []);
  const hasNotes = notes.some(Boolean);
  const total = starts[starts.length - 1] + widths[widths.length - 1] + PAD;
  return (
    <Frame name={name} width={total} height={PAD * 2 + height + (hasNotes ? 40 : 0)} labels={labels}>
      {labels.map((label, index) => (
        <Box key={index} seed={`${seed}/${index}`} x={starts[index]} y={PAD} w={widths[index]} h={height} label={label} lit={highlight === index}>
          {notes[index] ? (
            <Text x={starts[index] + widths[index] / 2} y={PAD + height + 24} size={16} fill={MUTED} extra={{ 'data-note': '' }}>
              {notes[index]!}
            </Text>
          ) : null}
        </Box>
      ))}
      {labels.slice(1).map((_, index) => (
        <Arrow key={index} seed={`${seed}/arrow/${index}`} x1={starts[index] + widths[index] + 6} y1={PAD + height / 2} x2={starts[index + 1] - 6} y2={PAD + height / 2} />
      ))}
    </Frame>
  );
}

/** Steps left to right, each joined to the next by an arrow. */
export function Flow({ steps, highlight }: { steps: Label[]; highlight?: number }) {
  return steps.length ? <Row name="flow" seed="fig/flow" labels={steps} highlight={highlight} /> : null;
}

/** Stages left to right, each with an optional note under it. */
export function Pipeline({ stages, highlight }: { stages: { label: Label; note?: Label }[]; highlight?: number }) {
  return stages.length ? <Row name="pipeline" seed="fig/pipeline" labels={stages.map((stage) => stage.label)} notes={stages.map((stage) => stage.note)} highlight={highlight} /> : null;
}

/** Boxes inside boxes, outermost first: a set inside a bigger set. */
export function Nested({ levels, highlight }: { levels: Label[]; highlight?: number }) {
  if (!levels.length) return null;
  const band = 34;
  const inset = 28;
  const count = levels.length;
  const width = PAD * 2 + 2 * (count - 1) * inset + Math.max(220, widest(levels) + 40);
  const height = PAD * 2 + 2 * (count - 1) * band + 70;
  return (
    <Frame name="nested" width={width} height={height} labels={levels}>
      {levels.map((label, index) => {
        const x = PAD + index * inset;
        const y = PAD + index * band;
        const w = width - 2 * x;
        const lit = highlight === index;
        return (
          <g key={index} data-el="" data-highlight={lit ? 'true' : undefined} data-width={round(w)}>
            <SketchRect seedKey={`fig/nested/${index}`} x={x} y={y} w={w} h={height - 2 * y} rounded stroke={lit ? accent() : INK} strokeWidth={lit ? 3 : 1.6} />
            <Text x={x + 14} y={y + 20} anchor="start" weight={lit ? 600 : undefined} extra={{ 'data-label': '' }}>
              {label}
            </Text>
          </g>
        );
      })}
    </Frame>
  );
}

/** A row of cells with their positions (from 0) under them, and marks pointing up at chosen cells from below. */
export function Cells({ cells, highlight, marks = [] }: { cells: Label[]; highlight?: number; marks?: { at: number; label: Label }[] }) {
  if (!cells.length) return null;
  const gap = 12;
  const height = 58;
  const w = Math.max(66, widest(cells) + 24);
  const shown = marks.filter((mark) => Number.isInteger(mark.at) && mark.at >= 0 && mark.at < cells.length);
  const top = PAD + 4;
  const centre = (index: number) => PAD + index * (w + gap) + w / 2;
  return (
    <Frame name="cells" width={PAD * 2 + cells.length * w + (cells.length - 1) * gap} height={top + height + (shown.length ? 104 : 40)} labels={cells}>
      {cells.map((label, index) => (
        <Box key={index} seed={`fig/cells/${index}`} x={PAD + index * (w + gap)} y={top} w={w} h={height} label={label} lit={highlight === index} />
      ))}
      {cells.map((_, index) => (
        <Text key={index} x={centre(index)} y={top + height + 20} size={16} fill={MUTED} extra={{ 'data-index': '' }}>
          {String(index)}
        </Text>
      ))}
      {shown.map((mark, index) => (
        <g key={index} data-mark={mark.at}>
          <SketchArrow seedKey={`fig/cells/mark/${index}`} x1={centre(mark.at)} y1={top + height + 74} x2={centre(mark.at)} y2={top + height + 38} stroke={accent()} strokeWidth={2} />
          <Text x={centre(mark.at)} y={top + height + 90} size={18} fill={accent()}>
            {mark.label}
          </Text>
        </g>
      ))}
    </Frame>
  );
}

/** Horizontal bars, each as long as its value is of `max` (default: the largest value); a bar past `max` stops at the end of its track. */
export function Bars({ bars, max }: { bars: { label: Label; value: number }[]; max?: number }) {
  if (!bars.length) return null;
  const track = 360;
  const row = 46;
  const labelWidth = Math.max(60, widest(bars.map((bar) => bar.label)) + 16);
  const value = (bar: { value: number }) => (Number.isFinite(bar.value) ? bar.value : 0);
  const scale = max !== undefined && max > 0 ? max : Math.max(0, ...bars.map(value)) || 1;
  const valueWidth = widest(bars.map((bar) => String(bar.value)), 18) + 16;
  return (
    <Frame name="bars" width={PAD * 2 + labelWidth + track + valueWidth} height={PAD * 2 + bars.length * row - 12} labels={bars.map((bar) => bar.label)}>
      {bars.map((bar, index) => {
        const length = round(Math.min(track, Math.max(0, (value(bar) / scale) * track)));
        const y = PAD + index * row;
        return (
          <g key={index} data-el="" data-length={length}>
            <Text x={PAD + labelWidth - 12} y={y + 17} anchor="end" extra={{ 'data-label': '' }}>
              {bar.label}
            </Text>
            {length > 0 ? <SketchRect seedKey={`fig/bars/${index}`} x={PAD + labelWidth} y={y + 3} w={length} h={28} stroke={roleColour('primary')} strokeWidth={1.8} fill={roleColour('primary')} /> : null}
            <Text x={PAD + labelWidth + length + 10} y={y + 17} anchor="start" size={18} fill={MUTED} extra={{ 'data-value': '' }}>
              {String(bar.value)}
            </Text>
          </g>
        );
      })}
    </Frame>
  );
}

const MOST_NODES = 8;
const SLOT = 52;

/** The slots of a layer from top to bottom: its nodes, with a "⋮" in the middle when there are too many to draw (first three and last three). */
function slots(count: number): ('node' | 'more')[] {
  return count > MOST_NODES ? ['node', 'node', 'node', 'more', 'node', 'node', 'node'] : Array.from({ length: count }, () => 'node' as const);
}

/** Layers of nodes, each node joined to every node of the next layer; the numbers are the node counts, and a layer past eight shows six and its real size. */
export function Network({ layers, highlight }: { layers: number[]; highlight?: number }) {
  const counts = layers.map((count) => (Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0)).filter((count) => count > 0);
  if (!counts.length) return null;
  const drawn = counts.map(slots);
  const tallest = Math.max(...drawn.map((layer) => layer.length));
  const colGap = 140;
  const centreY = PAD + 15 + ((tallest - 1) * SLOT) / 2;
  const columnX = (layer: number) => PAD + 40 + layer * colGap;
  const nodeY = (layer: number, slot: number) => centreY + (slot - (drawn[layer].length - 1) / 2) * SLOT;
  const nodeSlots = drawn.map((layer) => layer.flatMap((kind, slot) => (kind === 'node' ? [slot] : [])));
  return (
    <Frame name="network" width={columnX(counts.length - 1) + 40 + PAD} height={centreY + ((tallest - 1) * SLOT) / 2 + 15 + 44} labels={counts.map(String)}>
      {nodeSlots.slice(1).flatMap((to, layer) =>
        nodeSlots[layer].flatMap((from, i) =>
          to.map((slot, j) => (
            <g key={`${layer}-${i}-${j}`} data-edge="">
              <SketchLine seedKey={`fig/network/edge/${layer}/${i}/${j}`} x1={columnX(layer)} y1={nodeY(layer, from)} x2={columnX(layer + 1)} y2={nodeY(layer + 1, slot)} stroke={EDGE} strokeWidth={1.2} roughness={0.6} />
            </g>
          )),
        ),
      )}
      {drawn.map((layer, index) => {
        const lit = highlight === index;
        return (
          <g key={index} data-layer={index} data-el="" data-highlight={lit ? 'true' : undefined}>
            {layer.map((kind, slot) =>
              kind === 'node' ? (
                <g key={slot} data-node="">
                  <SketchEllipse seedKey={`fig/network/node/${index}/${slot}`} cx={columnX(index)} cy={nodeY(index, slot)} w={30} h={30} stroke={lit ? accent() : INK} strokeWidth={lit ? 2.6 : 1.6} fill={lit ? accent() : undefined} />
                </g>
              ) : (
                <Text key={slot} x={columnX(index)} y={nodeY(index, slot)} size={26} fill={MUTED}>
                  ⋮
                </Text>
              ),
            )}
            <Text x={columnX(index)} y={centreY + ((tallest - 1) * SLOT) / 2 + 15 + 26} size={18} fill={lit ? accent() : MUTED} extra={{ 'data-layer-count': '' }}>
              {String(counts[index])}
            </Text>
          </g>
        );
      })}
    </Frame>
  );
}

/** Steps on a ring, each joined to the next, the last back to the first. */
export function Cycle({ steps, highlight }: { steps: Label[]; highlight?: number }) {
  if (!steps.length) return null;
  const count = steps.length;
  const h = 48;
  const w = Math.max(90, widest(steps) + 24);
  const radius = count === 1 ? 0 : Math.max(90, (w + 30) / (2 * Math.sin(Math.PI / count)));
  const half = (w + 6) / 2;
  const squash = 0.8;
  const width = Math.max(260, 2 * (radius + w / 2 + PAD));
  const height = 2 * (radius * squash + h / 2 + PAD);
  const centres = steps.map((_, index): [number, number] => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return [width / 2 + radius * Math.cos(angle), height / 2 + radius * squash * Math.sin(angle)];
  });
  const arrows = count < 2 ? [] : centres.map((from, index) => ({ from, to: centres[(index + 1) % count], index }));
  return (
    <Frame name="cycle" width={width} height={height} labels={steps}>
      {arrows.flatMap(({ from, to, index }) => {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const length = Math.hypot(dx, dy);
        const [ux, uy] = [dx / length, dy / length];
        const exit = Math.min(half / Math.max(Math.abs(ux), 1e-6), (h / 2 + 6) / Math.max(Math.abs(uy), 1e-6));
        if (length < 2 * exit + 12) return [];
        const [ox, oy] = count === 2 ? [-uy * 16, ux * 16] : [0, 0];
        return [<Arrow key={index} seed={`fig/cycle/arrow/${index}`} x1={from[0] + ux * exit + ox} y1={from[1] + uy * exit + oy} x2={to[0] - ux * exit + ox} y2={to[1] - uy * exit + oy} />];
      })}
      {steps.map((label, index) => (
        <Box key={index} seed={`fig/cycle/${index}`} x={centres[index][0] - w / 2} y={centres[index][1] - h / 2} w={w} h={h} label={label} lit={highlight === index} />
      ))}
    </Frame>
  );
}
