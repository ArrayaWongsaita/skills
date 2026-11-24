// Look-ups in a Part's unit map, for the header, the divider and the assembly legend.
import type { ChapterDef, UnitDef, Units } from './types';

export type UnitPosition = { chapter: ChapterDef; unit: UnitDef; n: number; m: number };

export const NO_UNITS: Units = { chapters: [] };

/** Where a unit sits: its chapter, and its 1-based place `n` among the chapter's `m` units. */
export function unitPosition(units: Units, id: string): UnitPosition | null {
  for (const chapter of units.chapters) {
    const index = chapter.units.findIndex((unit) => unit.id === id);
    if (index >= 0) return { chapter, unit: chapter.units[index], n: index + 1, m: chapter.units.length };
  }
  return null;
}

export function unitTitle(units: Units, id: string): string {
  return unitPosition(units, id)?.unit.title ?? id;
}

export function chapterTitle(units: Units, id: string): string {
  return units.chapters.find((chapter) => chapter.id === id)?.title ?? id;
}
