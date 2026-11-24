// Keeps the console errors of this page load, for the check page. Installed once, at startup.
const MAX = 100;
const captured: string[] = [];
let installed = false;

const text = (value: unknown) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value));

export function captureConsoleErrors(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = console.error.bind(console);
  const keep = (message: string) => captured.length < MAX && captured.push(message);
  console.error = (...args: unknown[]) => {
    keep(args.map(text).join(' '));
    original(...args);
  };
  window.addEventListener('error', (event) => keep(event.message || text(event.error)));
  window.addEventListener('unhandledrejection', (event) => keep(`Unhandled rejection: ${text(event.reason)}`));
}

export function consoleErrors(): string[] {
  return [...captured];
}
