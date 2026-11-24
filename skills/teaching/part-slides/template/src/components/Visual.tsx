// The visual area of a slide: a diagram state, or an illustration or screenshot with its fallback.
// Order for an illustration or screenshot: an image file, then a drawn illustration, then the deck's fallback.
import { Component, type ComponentType, type LazyExoticComponent, type ReactNode, lazy, Suspense, useEffect, useState } from 'react';
import { type AssetLookup, assets, type IllustrationLoader } from '../assets';
import { useDeck } from './Deck';
import { Diagram, type DiagramLabel } from './diagram/Diagram';
import type { Fallback, Visual } from './types';

const lazyCache = new Map<IllustrationLoader, LazyExoticComponent<ComponentType>>();
const seen = new Set<string>();

function lazyFor(loader: IllustrationLoader) {
  let found = lazyCache.get(loader);
  if (!found) {
    found = lazy(loader);
    lazyCache.set(loader, found);
  }
  return found;
}

class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FallbackView({ fallback }: { fallback: Fallback }) {
  const { diagrams } = useDeck();
  if (fallback.kind === 'text') {
    const lines = fallback.text.split('\n');
    return (
      <div className="rs-fallback-text" data-fallback="text">
        {lines.map((line, index) => (
          <span key={index}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </div>
    );
  }
  const def = diagrams[fallback.diagram];
  return (
    <div className="rs-fallback-diagram" data-fallback="diagram">
      {def ? <Diagram state={{ ...fallback, new: [] }} def={def} animate={false} /> : null}
    </div>
  );
}

function Illustration({ loader, alt, id, fallback }: { loader: IllustrationLoader; alt: string; id: string; fallback: Fallback }) {
  const { reducedMotion } = useDeck();
  const [drawIn] = useState(() => !reducedMotion && !seen.has(id));
  useEffect(() => {
    seen.add(id);
  }, [id]);
  const Drawing = lazyFor(loader);
  return (
    <Guard fallback={<FallbackView fallback={fallback} />}>
      <figure className={drawIn ? 'rs-illustration rs-draw-in' : 'rs-illustration'} role="img" aria-label={alt}>
        <Suspense fallback={null}>
          <Drawing />
        </Suspense>
      </figure>
    </Guard>
  );
}

/** `labels` numbers the diagram's elements, as an assembly does. */
export function VisualSlot({ visual, lookup = assets, labels }: { visual: Visual; lookup?: AssetLookup; labels?: DiagramLabel[] }) {
  const { meta, diagrams, direction, reducedMotion } = useDeck();
  if (visual.kind === 'diagram') {
    const def = diagrams[visual.diagram];
    return def ? <Diagram state={visual} def={def} animate={direction === 'forward' && !reducedMotion} labels={labels} /> : null;
  }
  const alt = visual.kind === 'illustration' ? visual.alt : visual.capture;
  const image = lookup.image(meta.part, visual.key);
  if (image) return <img className="rs-image" src={image} alt={alt} />;
  if (visual.kind === 'illustration') {
    const loader = lookup.illustration(meta.part, visual.key);
    if (loader) return <Illustration loader={loader} alt={alt} id={`${meta.part}/${visual.key}`} fallback={visual.fallback} />;
  }
  return <FallbackView fallback={visual.fallback} />;
}
