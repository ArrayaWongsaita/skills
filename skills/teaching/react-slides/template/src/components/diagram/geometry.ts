// Pixel geometry of a deck diagram: the deck places nodes on a grid of CELL-pixel cells.
import type { DiagramDef, DiagramEdge, DiagramGroup, DiagramNode } from '../types';

export const CELL = 48;
const NODE_INSET = 6;
const GROUP_PADDING = 12;
const EDGE_GAP = 4;

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export function nodeBox(node: DiagramNode): Box {
  return {
    x: node.at[0] * CELL + NODE_INSET,
    y: node.at[1] * CELL + NODE_INSET,
    w: node.size[0] * CELL - 2 * NODE_INSET,
    h: node.size[1] * CELL - 2 * NODE_INSET,
  };
}

export function groupBox(def: DiagramDef, group: DiagramGroup): Box {
  const boxes = def.nodes.filter((node) => group.members.includes(node.id)).map(nodeBox);
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...boxes.map((b) => b.x)) - GROUP_PADDING;
  const y = Math.min(...boxes.map((b) => b.y)) - GROUP_PADDING;
  const right = Math.max(...boxes.map((b) => b.x + b.w)) + GROUP_PADDING;
  const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + GROUP_PADDING;
  return { x, y, w: right - x, h: bottom - y };
}

/** The box of a node or a group, or null for any other id. */
export function elementBox(def: DiagramDef, id: string): Box | null {
  const node = def.nodes.find((n) => n.id === id);
  if (node) return nodeBox(node);
  const group = def.groups.find((g) => g.id === id);
  return group ? groupBox(def, group) : null;
}

const centre = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Where the line from the box's centre towards `target` leaves the box, pushed EDGE_GAP further out. */
function exit(box: Box, target: Point): Point {
  const c = centre(box);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scale = Math.min(dx ? box.w / 2 / Math.abs(dx) : Infinity, dy ? box.h / 2 / Math.abs(dy) : Infinity);
  const length = Math.hypot(dx, dy);
  return { x: c.x + dx * scale + (dx / length) * EDGE_GAP, y: c.y + dy * scale + (dy / length) * EDGE_GAP };
}

export function edgePoints(def: DiagramDef, edge: DiagramEdge): { from: Point; to: Point } {
  const a = elementBox(def, edge.from);
  const b = elementBox(def, edge.to);
  if (!a || !b) return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
  return { from: exit(a, centre(b)), to: exit(b, centre(a)) };
}

/** The point a badge or note is near: an element's box corner area, or an edge's middle. */
export function nearPoint(def: DiagramDef, id: string): Point | null {
  const edge = def.edges.find((e) => e.id === id);
  if (edge) {
    const { from, to } = edgePoints(def, edge);
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }
  const box = elementBox(def, id);
  return box ? centre(box) : null;
}

export function outOfCanvas(def: DiagramDef): string[] {
  const [columns, rows] = def.canvas;
  return def.nodes
    .filter((n) => n.at[0] < 0 || n.at[1] < 0 || n.at[0] + n.size[0] > columns || n.at[1] + n.size[1] > rows)
    .map((n) => n.id);
}
