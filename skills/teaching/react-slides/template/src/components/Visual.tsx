// Placeholder until the visual slot lands: shows the kind of visual a slide asks for.
import type { Visual } from './types';

export function VisualSlot({ visual }: { visual: Visual }) {
  return <div className="rs-visual-placeholder" data-visual={visual.kind} />;
}
