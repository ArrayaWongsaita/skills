import { expect, test } from 'vitest';
import { iconType, iconUrl, pickIcon, setFavicon } from './icon';

test('the default svg is used when it is the only icon', () => {
  expect(pickIcon({ './assets/icon.svg': '/default.svg' })).toBe('/default.svg');
});

test('a picture the user adds wins over the default svg, in a fixed order', () => {
  expect(pickIcon({ './assets/icon.svg': '/d.svg', './assets/icon.png': '/mine.png' })).toBe('/mine.png');
  expect(pickIcon({ './assets/icon.svg': '/d.svg', './assets/icon.jpg': '/a.jpg', './assets/icon.webp': '/b.webp' })).toBe('/b.webp');
});

test('no icon file means no icon', () => {
  expect(pickIcon({})).toBeNull();
  expect(pickIcon({ './assets/other.png': '/x.png' })).toBeNull();
});

test('the template ships a default icon', () => {
  expect(iconUrl).toMatch(/icon.*\.svg|^data:image\/svg/);
});

test('the picture type comes from the extension or from a data url', () => {
  expect(iconType('/assets/icon-abc.svg')).toBe('image/svg+xml');
  expect(iconType('./assets/icon.png?v=3')).toBe('image/png');
  expect(iconType('/a/icon.jpeg')).toBe('image/jpeg');
  expect(iconType('/a/icon.webp')).toBe('image/webp');
  expect(iconType('data:image/svg+xml,%3Csvg%3E')).toBe('image/svg+xml');
  expect(iconType('/a/icon.bin')).toBeUndefined();
});

test('the tab icon is one link in the head, reused when the icon changes', () => {
  document.head.innerHTML = '';
  setFavicon(document, '/a/icon.svg');
  setFavicon(document, '/b/icon.png');
  const links = document.head.querySelectorAll('link[rel~="icon"]');
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute('href', '/b/icon.png');
  expect(links[0]).toHaveAttribute('type', 'image/png');
});

test('an existing icon link of the page is taken over, not duplicated', () => {
  document.head.innerHTML = '<link rel="icon" href="/old.ico">';
  setFavicon(document, '/new.svg');
  expect(document.head.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
  expect(document.head.querySelector('link[rel~="icon"]')).toHaveAttribute('href', '/new.svg');
});
