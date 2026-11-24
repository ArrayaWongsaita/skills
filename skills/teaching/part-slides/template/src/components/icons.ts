// Vocabulary icons come from lucide, loaded as one lazy chunk only when a diagram needs an icon.
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

let loaded: Record<string, LucideIcon> | null = null;
let pending: Promise<void> | null = null;

const pascal = (name: string) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

/** The icon for a lucide name such as `bot` or `file-text`, or null when it is unknown or not loaded yet. */
export function iconFor(name: string): LucideIcon | null {
  if (!name || !loaded) return null;
  return loaded[pascal(name)] ?? null;
}

export function loadIcons(): Promise<void> {
  pending ??= import('lucide-react').then((module) => {
    loaded = module.icons as Record<string, LucideIcon>;
  });
  return pending;
}

/** True once the icons are loaded; starts loading when `needed`. */
export function useIcons(needed: boolean): boolean {
  const [ready, setReady] = useState(loaded !== null);
  useEffect(() => {
    if (!needed || loaded) return;
    let live = true;
    loadIcons().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [needed]);
  return ready || loaded !== null;
}
