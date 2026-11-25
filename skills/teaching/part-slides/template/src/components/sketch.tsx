// Hand-drawn primitives on rough.js. The seed comes from `seedKey`, so an element looks the same on every slide.
import { useMemo } from 'react';
import rough from 'roughjs';
import type { Drawable, Options } from 'roughjs/bin/core';
import { seedOf } from './seed';

const generator = rough.generator();

/** The opacity of a fill whose `fillStyle` is left out: a pale tint that a label can sit on. Hatch lines would cross the label. */
export const TINT = 0.18;

export type SketchStyle = {
  seedKey: string;
  stroke: string;
  strokeWidth?: number;
  /** Without `fillStyle`, a pale solid tint (`TINT`); give `fillStyle` for another look, such as hachure on a shape with no text. */
  fill?: string;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots';
  /** The opacity of a solid fill; the default is `TINT` when `fillStyle` is left out and opaque otherwise. */
  fillOpacity?: number;
  roughness?: number;
  /** Draw the strokes in, as a build step. */
  draw?: boolean;
  /** Dashed strokes; they fade in instead of drawing in, because the dash pattern and the draw-in share one property. */
  dashed?: boolean;
  className?: string;
};

function options(style: SketchStyle): Options {
  return {
    seed: seedOf(style.seedKey),
    stroke: style.stroke,
    strokeWidth: style.strokeWidth ?? 1.6,
    roughness: style.roughness ?? 1.1,
    bowing: 1,
    ...(style.fill ? { fill: style.fill, fillStyle: style.fillStyle ?? 'solid', hachureGap: 7, fillWeight: 1 } : {}),
  };
}

function Paths({ drawables, style }: { drawables: Drawable[]; style: SketchStyle }) {
  const paths = drawables.flatMap((drawable) => generator.toPaths(drawable));
  const animate = style.draw ? (style.dashed ? 'rs-fade' : 'rs-draw') : undefined;
  const fillOpacity = style.fillOpacity ?? (style.fillStyle === undefined ? TINT : undefined);
  return (
    <g className={style.className}>
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          stroke={path.stroke}
          strokeWidth={path.strokeWidth}
          fill={path.fill ?? 'none'}
          fillOpacity={path.fill && path.fill !== 'none' ? fillOpacity : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(style.dashed ? { strokeDasharray: '7 6' } : { pathLength: 1 })}
          className={animate}
        />
      ))}
    </g>
  );
}

function useDrawables(make: () => Drawable[], deps: unknown[]) {
  return useMemo(make, deps);
}

export function SketchRect(props: SketchStyle & { x: number; y: number; w: number; h: number; rounded?: boolean }) {
  const { x, y, w, h, rounded } = props;
  const o = options(props);
  const drawables = useDrawables(() => {
    if (!rounded) return [generator.rectangle(x, y, w, h, o)];
    const r = Math.min(14, w / 4, h / 4);
    const d = `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
    return [generator.path(d, o)];
  }, [x, y, w, h, rounded, JSON.stringify(o)]);
  return <Paths drawables={drawables} style={props} />;
}

export function SketchEllipse(props: SketchStyle & { cx: number; cy: number; w: number; h: number }) {
  const { cx, cy, w, h } = props;
  const o = options(props);
  const drawables = useDrawables(() => [generator.ellipse(cx, cy, w, h, o)], [cx, cy, w, h, JSON.stringify(o)]);
  return <Paths drawables={drawables} style={props} />;
}

export function SketchLine(props: SketchStyle & { x1: number; y1: number; x2: number; y2: number }) {
  const { x1, y1, x2, y2 } = props;
  const o = options(props);
  const drawables = useDrawables(() => [generator.line(x1, y1, x2, y2, o)], [x1, y1, x2, y2, JSON.stringify(o)]);
  return <Paths drawables={drawables} style={props} />;
}

export function SketchPath(props: SketchStyle & { d: string }) {
  const o = options(props);
  const drawables = useDrawables(() => [generator.path(props.d, o)], [props.d, JSON.stringify(o)]);
  return <Paths drawables={drawables} style={props} />;
}

export function SketchArrow(props: SketchStyle & { x1: number; y1: number; x2: number; y2: number; head?: number }) {
  const { x1, y1, x2, y2, head = 11 } = props;
  const o = options(props);
  const drawables = useDrawables(() => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const wing = (side: number): [number, number] => [x2 - head * Math.cos(angle + side * 0.45), y2 - head * Math.sin(angle + side * 0.45)];
    return [generator.line(x1, y1, x2, y2, o), generator.linearPath([wing(1), [x2, y2], wing(-1)], { ...o, seed: o.seed! + 1 })];
  }, [x1, y1, x2, y2, head, JSON.stringify(o)]);
  return <Paths drawables={drawables} style={props} />;
}
