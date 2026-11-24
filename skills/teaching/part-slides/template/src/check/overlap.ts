// Drawn labels that sit on top of each other: the check page counts them, since a build and a text check cannot see it.
export type Box = { left: number; top: number; right: number; bottom: number };

/** Share of the smaller label that must be covered before two labels count as overlapping: a grazing edge is not one. */
const COVERED = 0.25;

const area = (box: Box) => Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);

/** The number of pairs of labels where one covers at least a quarter of the other. A label with no size (not drawn) is ignored. */
export function countOverlaps(boxes: Box[]): number {
  const drawn = boxes.filter((box) => area(box) > 0);
  let pairs = 0;
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      const a = drawn[i]!;
      const b = drawn[j]!;
      const shared = area({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
      if (shared > 0 && shared / Math.min(area(a), area(b)) >= COVERED) pairs += 1;
    }
  }
  return pairs;
}
