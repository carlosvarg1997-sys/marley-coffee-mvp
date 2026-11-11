'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8892/';
const evidence = path.join(root, 'EVIDENCIA_10NOV');
const viewports = [
  { width: 360, height: 800 }, { width: 390, height: 844 },
  { width: 414, height: 896 }, { width: 768, height: 1024 },
  { width: 1366, height: 768 }, { width: 1440, height: 900 },
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const record = (condition, message) => { if (!condition) failures.push(message); };
const rounded = (n) => Math.round(n * 10) / 10;

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const index = fs.readFileSync(path.join(root, 'index.html'));
  const prototype = fs.readFileSync(path.join(root, 'prototipo.html'));
  const parity = index.equals(prototype);
  const source = index.toString('utf8');
  record(parity, 'index.html y prototipo.html difieren');
  record(!source.toLowerCase().includes('#e4bc00'), 'Queda #E4BC00 en index.html');
  const browser = await chromium.launch({ headless: true });
  const measurements = { base, parity, sha256: crypto.createHash('sha256').update(index).digest('hex'), overlays: {}, touch: {}, c03: {}, c10: {}, consoleErrors: [] };
  try {
    const context = await browser.newContext({ viewport: viewports[0], serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (error) => measurements.consoleErrors.push({ type: 'pageerror', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error') measurements.consoleErrors.push({ type: 'console', message: message.text() }); });
    await page.goto(new URL('index.html#C01', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.MarleyApp && window.M4), null, { timeout: 10000 });
    const go = async (hash, viewport) => {
      if (viewport) await page.setViewportSize(viewport);
      await page.evaluate((value) => window.MarleyApp.go(value, { evaluation: true }), hash);
      await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 10000 });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
      await wait(120);
    };
    const getVisibleCollisions = async () => page.evaluate(() => {
      const all = [...document.querySelectorAll('body *')];
      const overlays = all.filter((element) => {
        const style = getComputedStyle(element);
        return ['fixed', 'sticky'].includes(style.position) && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.02;
      });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const texts = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) <= 0.02) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.width > 1 && rect.height > 1) texts.push({ parent, text: node.nodeValue.trim().replace(/\s+/g, ' ').slice(0, 100), rect });
      }
      const found = [];
      for (const overlay of overlays) {
        const overlayRect = overlay.getBoundingClientRect();
        if (overlayRect.width < 2 || overlayRect.height < 2 || overlayRect.right <= 0 || overlayRect.bottom <= 0 || overlayRect.left >= innerWidth || overlayRect.top >= innerHeight) continue;
        for (const item of texts) {
          if (overlay === item.parent || overlay.contains(item.parent)) continue;
          const rect = item.rect;
          const width = Math.max(0, Math.min(overlayRect.right, rect.right) - Math.max(overlayRect.left, rect.left));
          const height = Math.max(0, Math.min(overlayRect.bottom, rect.bottom) - Math.max(overlayRect.top, rect.top));
          if (width * height > 4) found.push({ overlay: overlay.id ? '#' + overlay.id : String(overlay.className || overlay.tagName).slice(0, 70), text: item.text, area: Math.round(width * height) });
        }
      }
      return found;
    });
    const scanOverlays = async (route, viewport) => {
      await go(route, viewport);
      const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
      const increment = Math.max(80, Math.floor(viewport.height * 0.7));
      const positions = [];
      for (let y = 0; y <= maxScroll; y += increment) positions.push(y);
      if (positions[positions.length - 1] !== maxScroll) positions.push(maxScroll);
      const collisions = [];
      for (const y of positions) {
        await page.evaluate((value) => window.scrollTo(0, value), y);
        await wait(25);
        for (const hit of await getVisibleCollisions()) collisions.push({ scrollY: y, ...hit });
      }
      const unique = [...new Map(collisions.map((hit) => [JSON.stringify(hit), hit])).values()];
      measurements.overlays[route + '_' + viewport.width] = { viewport: viewport.width + 'x' + viewport.height, samples: positions.length, collisions: unique };
      record(unique.length === 0, route + ' ' + viewport.width + 'px tiene ' + unique.length + ' intersecciones de texto con elementos fixed/sticky');
      return unique;
    };

    for (const route of ['C01', 'C09']) for (const viewport of viewports) {
      await scanOverlays(route, viewport);
      if (route === 'C01' && viewport.width === 768) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(evidence, 'A1_final6b_C01_768.png'), fullPage: true });
      }
      if (route === 'C09' && viewport.width === 1440) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await wait(60);
        await page.screenshot({ path: path.join(evidence, 'A1_final6b_C09_1440_top.png') });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await wait(80);
        await page.screenshot({ path: path.join(evidence, 'A1_final6b_C09_1440_tail.png') });
      }
    }

    const selectors = {
      C03: ['label.m5-check'],
      C08: ['button.m5-btn--hide-m'],
      C09: ['button.m5-btn--sm'],
      C13: ['label.check', '#screenSelect', '#scenarioSelect', '#scenario'],
      C14: ['label.check', '#screenSelect', '#scenarioSelect', '#scenario'],
    };
    for (const route of Object.keys(selectors)) for (const viewport of viewports) {
      await go(route, viewport);
      const targets = await page.evaluate((items) => items.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector, width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10, display: style.display, text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 45) };
      }).filter((item) => item.display !== 'none' && item.width > 0 && item.height > 0)), selectors[route]);
      const minimum = viewport.width <= 1024 ? 44 : viewport.width >= 1280 ? 24 : null;
      measurements.touch[route + '_' + viewport.width] = { viewport: viewport.width + 'x' + viewport.height, minimum, targets };
      if (minimum !== null) for (const target of targets) record(target.width >= minimum && target.height >= minimum, route + ' ' + viewport.width + 'px ' + target.selector + ' mide ' + target.width + 'x' + target.height + ', mínimo ' + minimum);
      if (viewport.width === 768 && ['C13', 'C14'].includes(route)) await page.screenshot({ path: path.join(evidence, 'A1_final6b_' + route + '_768.png') });
    }

    for (const viewport of [viewports[0], viewports[4]]) {
      await go('C03', viewport);
      const first = await page.evaluate(() => {
        const round = (value) => Math.round(value * 10) / 10;
        const box = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { top: round(rect.top), bottom: round(rect.bottom), documentTop: round(rect.top + scrollY), height: round(rect.height), text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50) };
        };
        return { title: box('.m5-split-body h1'), step: box('.m5-stepper'), field: box('#m4FName'), cta: box('#m4Contact button[type="submit"]'), viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight, fieldBeforeCta: Boolean(document.querySelector('#m4FName')?.compareDocumentPosition(document.querySelector('#m4Contact button[type="submit"]')) & Node.DOCUMENT_POSITION_FOLLOWING) };
      });
      measurements.c03[viewport.width] = first;
      record(Boolean(first.title && first.step && first.field && first.cta), 'C03 ' + viewport.width + 'px falta titular, indicador, primer campo o CTA');
      record(first.title.top >= 0 && first.title.bottom <= viewport.height, 'C03 ' + viewport.width + 'px el titular no cabe en la primera pantalla');
      record(first.step.top >= 0 && first.step.bottom <= viewport.height, 'C03 ' + viewport.width + 'px el indicador no cabe en la primera pantalla');
      record(first.field.top >= 0 && first.field.bottom <= viewport.height, 'C03 ' + viewport.width + 'px el primer campo no cabe en la primera pantalla');
      record(first.fieldBeforeCta && first.cta.documentTop > first.field.documentTop, 'C03 ' + viewport.width + 'px el CTA no sigue a los campos');
      record(first.cta.documentTop - viewport.height <= viewport.height, 'C03 ' + viewport.width + 'px el CTA está a más de un viewport de desplazamiento');
      if (viewport.width === 360) await page.screenshot({ path: path.join(evidence, 'A1_final6b_C03_360_first.png') });
      await page.evaluate((height) => {
        const cta = document.querySelector('#m4Contact button[type="submit"]');
        window.scrollTo(0, Math.max(0, cta.getBoundingClientRect().top + scrollY - height * 0.72));
      }, viewport.height);
      await wait(60);
      const ctaHits = await getVisibleCollisions();
      record(ctaHits.length === 0, 'C03 ' + viewport.width + 'px un elemento fixed/sticky tapa texto al llegar al CTA');
      if (viewport.width === 360) await page.screenshot({ path: path.join(evidence, 'A1_final6b_C03_360_cta.png') });
      if (viewport.width === 1366) await page.screenshot({ path: path.join(evidence, 'A1_final6b_C03_1366_cta.png') });
    }

    for (const viewport of viewports) {
      await go('C10', viewport);
      await wait(700); // let route transitions finish before measuring resting colors
      await page.mouse.move(2, viewport.height - 2);
      const colors = await page.evaluate(() => {
        const yellow = (value) => {
          const match = String(value).match(/[\d.]+/g);
          return match && Number(match[0]) >= 200 && Number(match[1]) >= 150 && Number(match[2]) <= 120;
        };
        const rows = [];
        for (const element of document.querySelectorAll('body *')) {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') continue;
          const values = [style.backgroundColor, style.color, style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor];
          for (const value of values) if (yellow(value)) { rows.push({ id: element.id, className: String(element.className || '').slice(0, 45), value, text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 35) }); break; }
        }
        return rows;
      });
      measurements.c10[viewport.width] = { viewport: viewport.width + 'x' + viewport.height, yellowValues: [...new Set(colors.map((row) => row.value))], elements: colors };
      record(measurements.c10[viewport.width].yellowValues.every((value) => value === 'rgb(243, 201, 0)'), 'C10 ' + viewport.width + 'px contiene amarillo estático distinto de #F3C900: ' + measurements.c10[viewport.width].yellowValues.join(', '));
      if ([390, 768].includes(viewport.width)) await page.screenshot({ path: path.join(evidence, 'A1_final6b_C10_' + viewport.width + '.png') });
    }

    record(measurements.consoleErrors.length === 0, 'Se registraron errores de consola: ' + measurements.consoleErrors.length);
    fs.writeFileSync(path.join(evidence, 'A1_final6b_mediciones.json'), JSON.stringify({ ...measurements, failures }, null, 2));
    console.log(JSON.stringify({ pass: failures.length === 0, failures, parity, sha256: measurements.sha256, collisionSamples: Object.keys(measurements.overlays).length, touchScenarios: Object.keys(measurements.touch).length, c03: measurements.c03, c10YellowValues: Object.fromEntries(Object.entries(measurements.c10).map(([width, data]) => [width, data.yellowValues])), consoleErrors: measurements.consoleErrors.length, evidence: 'EVIDENCIA_10NOV/A1_final6b_*' }, null, 2));
  } finally {
    await browser.close();
  }
  process.exitCode = failures.length ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
