// The vocabulary's shapes as sketches. An unknown shape draws as a box.
import { SketchEllipse, SketchPath, SketchRect, type SketchStyle } from '../sketch';
import type { Box } from './geometry';

export const SHAPES = ['box', 'rounded-box', 'circle', 'cylinder', 'document', 'person', 'cloud'] as const;

/** Where a shape's label goes: person shapes keep their figure on the left. */
export function labelArea(shape: string, box: Box): Box {
  if (shape !== 'person') return box;
  const figure = Math.min(box.h * 0.8, box.w * 0.4);
  return { x: box.x + figure, y: box.y, w: box.w - figure, h: box.h };
}

export function Shape({ shape, box, ...style }: SketchStyle & { shape: string; box: Box }) {
  const { x, y, w, h } = box;
  switch (shape) {
    case 'rounded-box':
      return <SketchRect {...style} x={x} y={y} w={w} h={h} rounded />;
    case 'circle':
      return <SketchEllipse {...style} cx={x + w / 2} cy={y + h / 2} w={w} h={h} />;
    case 'cylinder': {
      const ry = Math.min(10, h / 4);
      return (
        <g>
          <SketchEllipse {...style} cx={x + w / 2} cy={y + ry} w={w} h={2 * ry} />
          <SketchPath {...style} seedKey={`${style.seedKey}/body`} d={`M${x},${y + ry} L${x},${y + h - ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + h - ry} L${x + w},${y + ry}`} />
        </g>
      );
    }
    case 'document': {
      const wave = Math.min(8, h / 5);
      return <SketchPath {...style} d={`M${x},${y} H${x + w} V${y + h - wave} Q${x + w * 0.75},${y + h - 2 * wave} ${x + w / 2},${y + h - wave} T${x},${y + h - wave} Z`} />;
    }
    case 'person': {
      const figure = Math.min(h * 0.8, w * 0.4);
      const cx = x + figure / 2;
      const head = figure * 0.36;
      return (
        <g>
          <SketchEllipse {...style} cx={cx} cy={y + h * 0.3} w={head} h={head} />
          <SketchPath {...style} seedKey={`${style.seedKey}/body`} d={`M${cx - figure * 0.38},${y + h * 0.95} Q${cx},${y + h * 0.4} ${cx + figure * 0.38},${y + h * 0.95}`} />
        </g>
      );
    }
    case 'cloud': {
      const p = (fx: number, fy: number) => `${x + w * fx},${y + h * fy}`;
      return (
        <SketchPath
          {...style}
          d={`M${p(0.22, 0.88)} Q${p(0.02, 0.86)} ${p(0.08, 0.6)} Q${p(0, 0.3)} ${p(0.28, 0.32)} Q${p(0.36, 0.02)} ${p(0.58, 0.18)} Q${p(0.8, 0)} ${p(0.86, 0.36)} Q${p(1.02, 0.46)} ${p(0.92, 0.72)} Q${p(0.92, 0.96)} ${p(0.7, 0.88)} Z`}
        />
      );
    }
    default:
      return <SketchRect {...style} x={x} y={y} w={w} h={h} />;
  }
}
