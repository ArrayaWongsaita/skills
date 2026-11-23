import { type RefObject, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED);
  query.addEventListener?.('change', onChange);
  return () => query.removeEventListener?.('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches,
    () => false,
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.('change', onChange);
      return () => list.removeEventListener?.('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

/** Calls onLeft or onRight for a horizontal swipe; a vertical scroll never counts. */
export function useSwipe(ref: RefObject<HTMLElement | null>, handlers: { onLeft: () => void; onRight: () => void }): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let start: { x: number; y: number } | null = null;
    const down = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const up = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? latest.current.onLeft : latest.current.onRight)();
    };
    element.addEventListener('touchstart', down, { passive: true });
    element.addEventListener('touchend', up, { passive: true });
    return () => {
      element.removeEventListener('touchstart', down);
      element.removeEventListener('touchend', up);
    };
  }, [ref]);
}

export const MIN_FIT = 0.85;

/**
 * Shrinks prose (the --fit custom property) in steps of 0.05, down to MIN_FIT, while the element overflows.
 * The value used is left in data-fit, where the check page reads it.
 */
export function useAutoFit(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      let value = 1;
      element.style.setProperty('--fit', '1');
      const overflows = () => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1;
      while (enabled && value > MIN_FIT + 1e-9 && overflows()) {
        value = Math.round((value - 0.05) * 100) / 100;
        element.style.setProperty('--fit', String(value));
      }
      element.dataset.fit = String(value);
    };
    fit();
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && fit());
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [ref, enabled]);
}
