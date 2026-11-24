// The course's icon: the home page header and the browser tab. It is not on the slides, where it would pull the eye from the content.
// src/assets/icon.svg is the default; a picture named icon.png, icon.webp, icon.jpg or icon.jpeg in src/assets/ wins over it, so a course can bring its own.
const EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg'];

export function pickIcon(files: Record<string, string>): string | null {
  for (const extension of EXTENSIONS) {
    const url = files[`./assets/icon.${extension}`];
    if (url) return url;
  }
  return null;
}

export const iconUrl = pickIcon(import.meta.glob<string>('./assets/icon.{svg,png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }));

const TYPES: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/** The media type of an icon url, from a data url or the file extension; undefined when it cannot be told. */
export function iconType(url: string): string | undefined {
  if (url.startsWith('data:')) return /^data:([^;,]+)/.exec(url)?.[1];
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(url)?.[1]?.toLowerCase();
  return extension ? TYPES[extension] : undefined;
}

/** Makes the page's tab icon the given picture: one `<link rel="icon">` in the head, taken over if the page already has one. */
export function setFavicon(doc: Document, url: string): void {
  let link = doc.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.setAttribute('rel', 'icon');
    doc.head.append(link);
  }
  link.setAttribute('href', url);
  const type = iconType(url);
  if (type) link.setAttribute('type', type);
  else link.removeAttribute('type');
}
