import { useSyncExternalStore } from 'react';

export type Route = { name: 'home' } | { name: 'part'; part: number; slide?: string } | { name: 'check'; part: number };

const PART_RE = /^#\/part-(\d{2,})(?:\/([\w-]+))?\/?$/;
const CHECK_RE = /^#\/check\/part-(\d{2,})\/?$/;

const pad = (part: number) => String(part).padStart(2, '0');

export function parseHash(hash: string): Route {
  const check = CHECK_RE.exec(hash);
  if (check) return { name: 'check', part: Number(check[1]) };
  const part = PART_RE.exec(hash);
  if (part) return part[2] ? { name: 'part', part: Number(part[1]), slide: part[2] } : { name: 'part', part: Number(part[1]) };
  return { name: 'home' };
}

export function formatRoute(route: Route): string {
  if (route.name === 'home') return '#/';
  if (route.name === 'check') return `#/check/part-${pad(route.part)}`;
  return `#/part-${pad(route.part)}${route.slide ? `/${route.slide}` : ''}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, () => window.location.hash, () => ''));
}

/** Go to a route. `replace` swaps the history entry, so moving between slides does not fill the back button. */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = formatRoute(route);
  if (window.location.hash === hash) return;
  if (options.replace) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}
