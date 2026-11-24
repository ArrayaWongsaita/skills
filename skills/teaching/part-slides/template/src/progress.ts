// Reading progress per Part, kept only in this browser. Storage can be blocked: every access is guarded.
export type Progress = { last?: string; furthest?: string };

const key = (course: string, part: number) => `react-slides:${course}:part-${String(part).padStart(2, '0')}`;

export function loadProgress(course: string, part: number): Progress {
  try {
    const raw = window.localStorage.getItem(key(course, part));
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const { last, furthest } = value as Record<string, unknown>;
    return { ...(typeof last === 'string' ? { last } : {}), ...(typeof furthest === 'string' ? { furthest } : {}) };
  } catch {
    return {};
  }
}

export function saveProgress(course: string, part: number, progress: Progress): void {
  try {
    window.localStorage.setItem(key(course, part), JSON.stringify(progress));
  } catch {
    // storage blocked or full: reading still works, progress is just not kept
  }
}
