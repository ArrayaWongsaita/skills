import type { ComponentType } from 'react';
import type { PartMeta } from './components/types';

export type PartEntry = { meta: PartMeta; load: () => Promise<{ default: ComponentType }> };

// Every generated Part is found here, so no shared index file needs rewriting.
const metas = import.meta.glob<{ meta: PartMeta }>('./parts/part-*.data.ts', { eager: true });
const loaders = import.meta.glob<{ default: ComponentType }>('./parts/part-*.tsx');

export function listParts(): PartEntry[] {
  return Object.entries(metas)
    .flatMap(([path, module]) => {
      const tsx = path.replace(/\.data\.ts$/, '.tsx');
      return Object.hasOwn(loaders, tsx) ? [{ meta: module.meta, load: loaders[tsx] }] : [];
    })
    .sort((a, b) => a.meta.part - b.meta.part);
}
