'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8892/';
const mode = process.argv[3] || 'after';
const viewports = [
  { width: 360, height: 800 }, { width: 390, height: 844 },
  { width: 414, height: 896 }, { width: 768, height: 1024 },
  { width: 1366, height: 768 }, { width: 1440, height: 900 },
];
const evidence = path.join(root, 'EVIDENCIA_10NOV');
const failures = [];
const record = (ok, message) => { if (!ok && mode !== 'before') failures.push(message); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (n) => Math.round(n * 10) / 10;

async function makePage(browser, viewport, opts = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', ...opts });
  const page = await context.newPage();
  await page.goto(new URL('index.html#C01', base).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.MarleyApp && window.M4), null, { timeout: 15000 });
  const go = async (route) => {
    await page.evaluate((hash) => window.MarleyApp.go(hash, { evaluation: true }), route);
    await page.waitForFunction((hash) => document.body.dataset.current === hash, route, { timeout: 10000 });
    await wait(80);
  };
  return { context, page, go };
}

function contrastData() {
  const rounded = (n) => Math.round(n * 10) / 10;
  const el = document.querySelector('.m5-roles-head h1');
  if (!el) return null;
  const rgb = (value) => {
    const values = String(value).match(/[\d.]+/g) || [0, 0, 0];
    return { r: +values[0], g: +values[1], b: +values[2], a: values[3] === undefined ? 1 : +values[3] };
  };
  let bg = [255, 255, 255];
  const ancestors = [];
  for (let node = el; node; node = node.parentElement) ancestors.push(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const color = rgb(getComputedStyle(ancestors[i]).backgroundColor);
    bg = bg.map((v, j) => [color.r, color.g, color.b][j] * color.a + v * (1 - color.a));
  }
  const fg = rgb(getComputedStyle(el).color);
  const luminance = (rgbValue) => {
    const channels = rgbValue.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const l1 = luminance([fg.r, fg.g, fg.b]);
  const l2 = luminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const box = el.getBoundingClientRect();
  return { text: el.innerText.trim(), color: getComputedStyle(el).color, background: `rgb(${bg.map(Math.round).join(', ')})`, contrast: rounded(ratio), box: { x: rounded(box.x), y: rounded(box.y), width: rounded(box.width), height: rounded(box.height) } };
}

async function videoRun(browser, viewport, interaction = null) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', hasTouch: interaction === 'touchstart', isMobile: interaction === 'touchstart' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const requests = [];
  const completed = new Map();
  const urls = new Map();
  const transfer = new Map();
  cdp.on('Network.requestWillBeSent', (event) => { urls.set(event.requestId, event.request.url); requests.push(event.request.url); });
  cdp.on('Network.responseReceived', (event) => transfer.set(event.requestId, event.response.encodedDataLength || 0));
  cdp.on('Network.dataReceived', (event) => transfer.set(event.requestId, (transfer.get(event.requestId) || 0) + (event.encodedDataLength || event.dataLength || 0)));
  cdp.on('Network.loadingFinished', (event) => { const key = urls.get(event.requestId) || event.requestId; completed.set(key, event.encodedDataLength); transfer.set(event.requestId, event.encodedDataLength); });
  await page.goto(new URL('index.html#C02', base).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.MarleyApp && document.body.dataset.current === 'C02'), null, { timeout: 15000 });
  await wait(1600);
  const before = await page.evaluate(() => {
    const film = document.querySelector('.m5-film[data-film="hero"]');
    const poster = film?.querySelector('.m5-film-poster');
    const video = film?.querySelector('video');
    const resources = performance.getEntriesByType('resource').map((r) => ({ name: r.name, transfer: r.transferSize, encoded: r.encodedBodySize })).filter((r) => r.name.startsWith(location.origin));
    return { videoSrc: video?.getAttribute('src') || null, videoCurrentSrc: video?.currentSrc || null, poster: poster ? { complete: poster.complete, naturalWidth: poster.naturalWidth, src: poster.currentSrc } : null, resources, transferBytes: resources.reduce((n, r) => n + r.transfer, 0) };
  });
  const cdpTransferBytes = [...transfer.values()].reduce((n, bytes) => n + bytes, 0);
  const videoTransferBytesBefore = [...transfer].filter(([id]) => /video_[mds]\.mp4/i.test(urls.get(id) || '')).reduce((n, [, bytes]) => n + bytes, 0);
  before.cdpTransferBytes = cdpTransferBytes;
  before.videoTransferBytes = videoTransferBytesBefore;
  before.videoRequests = requests.filter((url) => /video_[mds]\.mp4/i.test(url));
  if (!interaction && [390, 1440].includes(viewport.width)) await page.screenshot({ path: path.join(evidence, `A1_phase5_${mode}_C02_${viewport.width}.png`) });
  if (interaction) {
    await page.evaluate(() => { window.__a1Events = []; for (const type of ['wheel', 'scroll', 'touchstart', 'pointerdown']) addEventListener(type, (event) => window.__a1Events.push({ type, trusted: event.isTrusted, scrollY, target: event.target?.nodeName }), true); });
    if (interaction === 'scroll') { await page.mouse.move(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2)); await page.mouse.wheel(0, 180); }
    if (interaction === 'pointerdown') { await page.mouse.move(4, viewport.height - 4); await page.mouse.down(); await page.mouse.up(); }
    if (interaction === 'touchstart') await page.touchscreen.tap(1, Math.floor(viewport.height / 2));
    try { await page.waitForFunction(() => Boolean(document.querySelector('.m5-film[data-film="hero"] video[src]')), null, { timeout: 10000 }); }
    catch (error) { throw new Error(`${interaction} failed to assign src: ${JSON.stringify(await page.evaluate(() => ({ events: window.__a1Events, scrollY, size: document.documentElement.scrollHeight, current: document.body.dataset.current })))}`); }
    await wait(800);
  }
  const after = await page.evaluate(() => ({ videoSrc: document.querySelector('.m5-film[data-film="hero"] video')?.getAttribute('src') || null }));
  const result = { viewport: `${viewport.width}x${viewport.height}`, interaction, before, after, videoRequests: requests.filter((url) => /video_[mds]\.mp4/i.test(url)), videoTransferBytes: [...transfer].filter(([id]) => /video_[mds]\.mp4/i.test(urls.get(id) || '')).reduce((n, [, bytes]) => n + bytes, 0), completedVideoBytes: [...completed].filter(([url]) => /video_[mds]\.mp4/i.test(url)).reduce((n, [, bytes]) => n + bytes, 0), totalNetworkTransferBytes: [...transfer.values()].reduce((n, bytes) => n + bytes, 0) };
  await context.close();
  return result;
}

async function touchData(page, route, viewport) {
  const selectors = {
    C01: ['button', 'a[href]', 'input:not([type="hidden"])', 'select', 'summary', '[role="button"]', '[role="link"]'],
    C10: ['.m9-detail summary'],
    C12: ['label.check', 'a[href]'],
    C13: ['.evaluation-tools :is(button,a[href],input:not([type="hidden"]),select,summary,label.check,[role="button"],[role="link"])'],
    C14: ['.evaluation-tools :is(button,a[href],input:not([type="hidden"]),select,summary,label.check,[role="button"],[role="link"])'],
    C15: ['.evaluation-tools :is(button,a[href],input:not([type="hidden"]),select,summary,label.check,[role="button"],[role="link"])', 'label.check', 'a[href]'],
  }[route];
  if (['C13', 'C14', 'C15'].includes(route)) await page.evaluate(() => { const panel = document.querySelector('.evaluation-tools'); if (panel) panel.open = true; });
  const items = await page.evaluate(({ queryList, routeName }) => {
    const rounded = (n) => Math.round(n * 10) / 10;
    const found = new Set();
    for (const selector of queryList) for (const el of document.querySelectorAll(selector)) found.add(el);
    return [...found].map((el) => {
      const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
      return { tag: el.tagName, selectorHint: el.id ? `#${el.id}` : String(el.className || '').toString().split(/\s+/).slice(0, 2).join('.'), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 48), width: rounded(rect.width), height: rounded(rect.height), display: style.display, visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0, paragraphLink: el.tagName === 'A' && Boolean(el.closest('p')), elementInsideLabel: el.tagName === 'INPUT' && Boolean(el.closest('label')), route: routeName };
    }).filter((item) => item.visible && !(item.route === 'C01' && item.paragraphLink) && !(item.tag === 'INPUT' && item.elementInsideLabel));
  }, { queryList: selectors, routeName: route });
  const min = viewport.width <= 1024 ? 44 : viewport.width >= 1280 ? 24 : null;
  return { viewport: `${viewport.width}x${viewport.height}`, min, count: items.length, under: min === null ? [] : items.filter((item) => item.width < min || item.height < min), items };
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const data = { mode, viewports: viewports.map((v) => `${v.width}x${v.height}`), contrast: {}, video: {}, touch: {}, consoleErrors: [], parity: null, sha256: null };
  try {
    const index = fs.readFileSync(path.join(root, 'index.html'));
    const prototype = fs.readFileSync(path.join(root, 'prototipo.html'));
    data.parity = index.equals(prototype);
    data.sha256 = crypto.createHash('sha256').update(index).digest('hex');
    record(data.parity, 'index.html y prototipo.html difieren');

    const { context, page, go } = await makePage(browser, viewports[0]);
    page.on('pageerror', (error) => data.consoleErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') data.consoleErrors.push(message.text()); });
    for (const route of ['R01', 'R02']) for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await go(route);
      const result = await page.evaluate(contrastData);
      data.contrast[`${route}_${viewport.width}`] = result;
      record(Boolean(result && result.contrast >= 4.5), `${route} ${viewport.width} px H1 contraste ${result?.contrast ?? 'no medido'}:1`);
      if (mode === 'before' && (viewport.width === 360 || viewport.width === 1440)) await page.screenshot({ path: path.join(evidence, `A1_phase5_before_${route}_${viewport.width}.png`) });
      if (mode !== 'before' && (viewport.width === 360 || viewport.width === 1440)) await page.screenshot({ path: path.join(evidence, `A1_phase5_after_${route}_${viewport.width}.png`) });
    }
    const routeList = ['C01', 'C10', 'C12', 'C13', 'C14', 'C15'];
    for (const route of routeList) for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await go(route);
      const result = await touchData(page, route, viewport);
      data.touch[`${route}_${viewport.width}`] = result;
      for (const target of result.under) {
        const desktopParagraphException = viewport.width >= 1280 && route === 'C12' && target.paragraphLink;
        if (!desktopParagraphException) record(false, `${route} ${viewport.width}px ${target.selectorHint || target.tag} ${target.text.slice(0, 24)} ${target.width}x${target.height}; mínimo ${result.min}`);
      }
      if (mode === 'before' && ((route === 'C01' && viewport.width === 1440) || (route === 'C10' && viewport.width === 768) || (route === 'C13' && viewport.width === 768) || (route === 'C15' && viewport.width === 1366))) await page.screenshot({ path: path.join(evidence, `A1_phase5_before_${route}_${viewport.width}.png`) });
      if (mode !== 'before' && ((route === 'C01' && viewport.width === 1440) || (route === 'C10' && viewport.width === 768) || (route === 'C13' && viewport.width === 768) || (route === 'C15' && viewport.width === 1366))) await page.screenshot({ path: path.join(evidence, `A1_phase5_after_${route}_${viewport.width}.png`) });
    }
    await context.close();

    for (const viewport of viewports) {
      const result = await videoRun(browser, viewport);
      data.video[viewport.width] = result;
      if (viewport.width <= 1024) {
        record(!result.before.videoSrc && result.videoRequests.length === 0, `C02 ${result.viewport} asigna o solicita video antes de interacción`);
        record(result.before.cdpTransferBytes < 2_500_000, `C02 ${result.viewport} transfiere ${result.before.cdpTransferBytes} bytes antes de interacción (límite 2.500.000)`);
        record(Boolean(result.before.poster?.complete && result.before.poster?.naturalWidth > 0), `C02 ${result.viewport} no muestra el póster antes de interacción`);
      }
    }
    if (mode !== 'before') {
      for (const [indexTrigger, trigger] of ['scroll', 'touchstart', 'pointerdown'].entries()) {
        const viewport = viewports[indexTrigger];
        const result = await videoRun(browser, viewport, trigger);
        data.video[`interaction_${trigger}`] = result;
        record(!result.before.videoSrc && result.before.videoRequests.length === 0, `C02 ${trigger}: había video antes de la interacción`);
        record(Boolean(result.after.videoSrc && result.videoRequests.length > 0), `C02 ${trigger}: no se asignó src al primer gesto`);
      }
    }

    const name = `A1_phase5_${mode}.json`;
    fs.writeFileSync(path.join(evidence, name), JSON.stringify(data, null, 2));
    const contrastSummary = Object.fromEntries(Object.entries(data.contrast).map(([key, value]) => [key, { color: value?.color, background: value?.background, ratio: value?.contrast }]));
    const videoSummary = Object.fromEntries(Object.entries(data.video).map(([key, value]) => [key, { beforeSrc: value.before.videoSrc, afterSrc: value.after.videoSrc, posterWidth: value.before.poster?.naturalWidth, resourceBytesBefore: value.before.transferBytes, cdpBytesBefore: value.before.cdpTransferBytes, videoBytes: value.before.videoTransferBytes, requests: value.videoRequests.map((url) => path.basename(new URL(url).pathname)) }]));
    const touchSummary = Object.fromEntries(Object.entries(data.touch).map(([key, value]) => [key, { count: value.count, min: value.min, under: value.under.map((item) => ({ selector: item.selectorHint, text: item.text, width: item.width, height: item.height })) }]));
    console.log(JSON.stringify({ pass: failures.length === 0, failures, parity: data.parity, sha256: data.sha256, contrast: contrastSummary, video: videoSummary, touch: touchSummary, consoleErrors: data.consoleErrors, evidence: path.relative(root, path.join(evidence, name)) }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
