#!/usr/bin/env node
// Screenshots of a Part's slides on a phone (390 x 844 at 2x) and a desktop (1280 x 720), with no browser tool:
// it drives headless Chrome over the DevTools protocol, with Node's own WebSocket (Node 22 or later).
//
//   node scripts/screenshots.mjs --url http://localhost:4173 --part N --out <dir> [--frame phone|desktop|both] [slide id ...]
//
// With no slide ids it takes every slide the Part's check page lists. It writes <out>/<slide id>-<frame>.png, after the
// fonts have loaded and with the entry animations off (prefers-reduced-motion). Chrome is $CHROME, or found in the usual
// places. Exit 0 when every screenshot was written, 1 on any error.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const FRAMES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  desktop: { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
};
const CHECK_TIMEOUT_MS = 60_000;
const SETTLE_MS = 400; // after the fonts: lazy drawings and auto-fit finish

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('usage: node scripts/screenshots.mjs --url <preview url> --part N --out <dir> [--frame phone|desktop|both] [slide id ...]');
  process.exit(1);
}

function parse(argv) {
  const args = { frame: 'both', ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (['--url', '--part', '--out', '--frame'].includes(flag)) {
      if (i + 1 >= argv.length) usage(`${flag} needs a value`);
      args[flag.slice(2)] = argv[++i];
    } else if (flag.startsWith('--')) usage(`unknown flag ${flag}`);
    else args.ids.push(flag);
  }
  if (!args.url || !args.part || !args.out) usage('--url, --part and --out are required');
  if (!/^\d+$/.test(args.part)) usage('--part is a number');
  if (!['phone', 'desktop', 'both'].includes(args.frame)) usage('--frame is phone, desktop or both');
  args.url = args.url.replace(/\/+$/, '');
  return args;
}

function findChrome() {
  const known = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const path of known) if (path && existsSync(path)) return path;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      if (existsSync(join(dir, name))) return join(dir, name);
    }
  }
  return null;
}

function launch(chrome, profile) {
  const proc = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--force-prefers-reduced-motion', '--hide-scrollbars', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let seen = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not start:\n${seen.slice(-800)}`)), 30_000);
    proc.stderr.on('data', (chunk) => {
      seen += chunk;
      const found = seen.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve({ proc, endpoint: found[1] }); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}:\n${seen.slice(-800)}`)); });
  });
}

function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  let next = 0;
  socket.addEventListener('message', (event) => {
    const reply = JSON.parse(event.data);
    const waiting = pending.get(reply.id);
    if (!waiting) return;
    pending.delete(reply.id);
    if (reply.error) waiting.reject(new Error(`${waiting.method}: ${reply.error.message}`));
    else waiting.resolve(reply.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ send, close: () => socket.close() }));
    socket.addEventListener('error', () => reject(new Error(`cannot connect to ${endpoint}`)));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parse(process.argv.slice(2));
  const nn = args.part.padStart(2, '0');
  const chrome = findChrome();
  if (!chrome) usage('no Chrome or Chromium found: set CHROME=<path to the browser>');
  mkdirSync(args.out, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'slides-shots-'));
  const { proc, endpoint } = await launch(chrome, profile);
  let cdp;
  try {
    cdp = await connect(endpoint);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async (expression) => (await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

    let ids = args.ids;
    if (ids.length === 0) {
      await page('Emulation.setDeviceMetricsOverride', FRAMES.desktop);
      await page('Page.navigate', { url: `${args.url}/#/check/part-${nn}` });
      const until = Date.now() + CHECK_TIMEOUT_MS;
      while (!(await evaluate('Boolean(window.__reactSlidesCheck && window.__reactSlidesCheck.done)'))) {
        if (Date.now() > until) throw new Error(`the check page ${args.url}/#/check/part-${nn} did not finish`);
        await sleep(250);
      }
      ids = await evaluate('window.__reactSlidesCheck.slides.map((s) => s.id)');
      if (!ids.length) throw new Error(`the check page lists no slides for Part ${args.part}: is --url this course's preview?`);
    }

    const frames = args.frame === 'both' ? ['phone', 'desktop'] : [args.frame];
    for (const frame of frames) {
      await page('Emulation.setDeviceMetricsOverride', FRAMES[frame]);
      for (const id of ids) {
        await page('Page.navigate', { url: 'about:blank' }); // a fresh load each time: a hash change alone keeps the old layout
        await page('Page.navigate', { url: `${args.url}/#/part-${nn}/${id}` });
        await evaluate(`new Promise((done) => {
          const ready = () => document.fonts.ready.then(() => setTimeout(done, ${SETTLE_MS}));
          document.readyState === 'complete' ? ready() : addEventListener('load', ready, { once: true });
        })`);
        if (!(await evaluate(`Boolean(document.querySelector('[data-slide="${id}"]'))`))) {
          throw new Error(`slide ${id} is not in Part ${args.part} at ${args.url}`);
        }
        const { data } = await page('Page.captureScreenshot', { format: 'png' });
        const file = join(args.out, `${id}-${frame}.png`);
        writeFileSync(file, Buffer.from(data, 'base64'));
        console.log(file);
      }
    }
  } finally {
    cdp?.close();
    proc.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
