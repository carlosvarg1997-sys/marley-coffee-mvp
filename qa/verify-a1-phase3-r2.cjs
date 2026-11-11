const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8891/';
const evidence = path.join(root, 'EVIDENCIA_10NOV');
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roleFor = (hash) => ['R05', 'R14', 'R15'].includes(hash) ? 'jefatura'
  : ['R09', 'R11', 'R12', 'R13'].includes(hash) ? 'marketing'
    : hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;

async function go(page, hash) {
  await page.evaluate(({ hash, role }) => {
    if (window.M4?.setRole) window.M4.setRole(role);
    window.MarleyApp.go(hash, { evaluation: true });
  }, { hash, role: roleFor(hash) });
  await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 10000 });
  await wait(650);
}

function fail(result, condition, detail) {
  if (!condition) result.failures.push(detail);
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const result = {
    base,
    viewports: viewports.map((v) => v.width + 'x' + v.height),
    failures: [],
    consoleErrors: [],
    parity: null,
    r00: [],
    c03: [],
    c09: [],
    c10: null,
    touch768: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: viewports[0], serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (error) => result.consoleErrors.push({ type: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') result.consoleErrors.push({ type: 'console', message: message.text() });
    });
    await page.goto(new URL('/index.html#R00', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp), null, { timeout: 10000 });

    const textContrast = (hash) => page.evaluate(() => {
      const rgb = (color) => {
        const values = String(color).match(/[\d.]+/g);
        return values ? { channels: values.slice(0, 3).map(Number), alpha: values.length > 3 ? Number(values[3]) : 1 } : { channels: [255, 255, 255], alpha: 1 };
      };
      const luminance = (color) => {
        const channels = rgb(color).channels.map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const contrast = (a, b) => {
        const x = luminance(a), y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      const effectiveBackground = (e) => {
        const stack = [];
        for (let node = e; node; node = node.parentElement) stack.push(node);
        let color = [255, 255, 255];
        for (let i = stack.length - 1; i >= 0; i--) {
          const layer = rgb(getComputedStyle(stack[i]).backgroundColor);
          if (layer.alpha > 0) color = layer.channels.map((channel, n) => channel * layer.alpha + color[n] * (1 - layer.alpha));
        }
        return 'rgb(' + color.map((v) => Math.round(v)).join(', ') + ')';
      };
      const root = document.querySelector('.m5-roles-page');
      if (!root) return { missing: true, failures: [] };
      const failures = [];
      const rows = [...root.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && e.textContent.trim())
        .map((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          const bg = effectiveBackground(e);
          const ratio = contrast(s.color, bg);
          const visible = r.width > 0 && r.height > 0 && Number(s.opacity || 1) > 0 && s.visibility !== 'hidden';
          const row = { tag: e.tagName, className: String(e.className || ''), text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 80), color: s.color, background: bg, ratio: Number(ratio.toFixed(2)), visible };
          if (visible && ratio < 4.5) failures.push(row);
          return row;
        });
      const get = (selector) => {
        const e = document.querySelector(selector);
        if (!e) return null;
        const s = getComputedStyle(e);
        const bg = effectiveBackground(e);
        return { color: s.color, background: bg, ratio: Number(contrast(s.color, bg).toFixed(2)) };
      };
      return {
        failures,
        h1: get('.m5-roles-head h1'),
        support: get('.m5-roles-head p'),
        rolesHeading: get('.m5-login-demo h2'),
        whiteOrTextFailures: rows.length,
      };
    });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await go(page, 'R00');
      const contrast = await textContrast('R00');
      result.r00.push({ viewport: viewport.width + 'x' + viewport.height, ...contrast });
      fail(result, !contrast.missing && contrast.failures.length === 0, {
        area: 'R00 contrast',
        viewport,
        failures: contrast.failures,
      });
      if (viewport.width === 320 || viewport.width === 360) {
        await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_R00_' + viewport.width + 'x' + viewport.height + '.png'), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 320, height: 640 });
    await go(page, 'R00');
    const exactR00 = await textContrast('R00');
    result.r00.push({ viewport: '320x640', ...exactR00 });
    fail(result, !exactR00.missing && exactR00.failures.length === 0, { area: 'R00 original audit viewport', failures: exactR00.failures });
    await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_R00_320x640.png'), fullPage: true });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await go(page, 'C03');
      const state = await page.evaluate(() => {
        const bounds = (e) => {
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        const email = document.querySelector('#m4FEmail');
        const phone = document.querySelector('#m4FPhone');
        const launcher = document.querySelector('#m7-launcher');
        const note = document.querySelector('.m5-cta-note.a1-next-step');
        const button = document.querySelector('#m4Contact button[type="submit"]');
        const section = document.querySelector('.m5-split--start .m5-split-media');
        const style = launcher ? getComputedStyle(launcher) : null;
        const overlap = (a, b) => a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)) : 0;
        return {
          current: document.body.dataset.current,
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          email: bounds(email),
          phone: bounds(phone),
          launcher: bounds(launcher),
          launcherDisplay: style?.display || 'missing',
          emailOverlap: overlap(bounds(email), bounds(launcher)),
          phoneOverlap: overlap(bounds(phone), bounds(launcher)),
          note: bounds(note),
          noteText: note?.textContent.trim() || '',
          noteOrder: note?.parentElement ? [...note.parentElement.children].indexOf(note) : -1,
          submit: bounds(button),
          submitPosition: button ? getComputedStyle(button).position : 'missing',
          media: bounds(section),
          viewportHeight: innerHeight,
        };
      });
      result.c03.push({ viewport: viewport.width + 'x' + viewport.height, ...state });
      fail(result, state.current === 'C03', { area: 'C03 route', viewport, state });
      fail(result, state.launcherDisplay === 'none' && state.emailOverlap === 0 && state.phoneOverlap === 0, {
        area: 'C03 launcher overlay',
        viewport,
        display: state.launcherDisplay,
        emailOverlap: state.emailOverlap,
        phoneOverlap: state.phoneOverlap,
      });
      fail(result, state.submitPosition !== 'fixed' && state.submitPosition !== 'sticky', {
        area: 'C03 CTA flow',
        viewport,
        position: state.submitPosition,
      });
      if (viewport.width === 360) {
        fail(result, state.note && state.note.bottom <= viewport.height && state.noteText.toLocaleLowerCase('es-CL').includes('a continuación eliges'), {
          area: 'C03 next-step indicator first viewport',
          viewport,
          note: state.note,
          text: state.noteText,
        });
      }
      if ([360, 390, 414, 768, 1366, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_C03_' + viewport.width + 'x' + viewport.height + '.png') });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'C09');
    const video = page.locator('video[controls]').first();
    await video.scrollIntoViewIfNeeded();
    await video.focus();
    result.c09.push(await page.evaluate(() => {
      const v = document.querySelector('video[controls]');
      const s = getComputedStyle(v);
      return { state: 'focus-within', within: v.matches(':focus-within'), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, boxShadow: s.boxShadow };
    }));
    await page.keyboard.press('Tab');
    await wait(30);
    await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_C09_390x844.png') });
    for (let i = 1; i < 22; i++) {
      const row = await page.evaluate((step) => {
        const active = document.activeElement;
        const video = document.querySelector('video[controls]');
        const vs = getComputedStyle(video);
        const as = getComputedStyle(active);
        const isVideoHost = active === video || video.matches(':focus-within');
        return {
          step,
          tag: active.tagName,
          id: active.id,
          className: typeof active.className === 'string' ? active.className : '',
          text: (active.innerText || active.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
          focusVisible: active.matches(':focus-visible'),
          outlineStyle: as.outlineStyle,
          outlineWidth: as.outlineWidth,
          videoWithin: video.matches(':focus-within'),
          videoOutline: vs.outlineStyle,
          videoOutlineWidth: vs.outlineWidth,
        };
      }, i);
      result.c09.push(row);
      if (row.tag === 'VIDEO' || row.videoWithin) {
        fail(result, row.videoOutline === 'solid' && row.videoOutlineWidth === '3px', { area: 'C09 video host focus', row });
      } else if (row.tag !== 'BODY') {
        fail(result, row.focusVisible && row.outlineStyle === 'solid' && row.outlineWidth === '3px', { area: 'C09 keyboard focus', row });
      }
      await page.keyboard.press('Tab');
      await wait(20);
    }

    await setAndGoC10(page, result, evidence, base);

    for (const hash of ['C01', 'C02', 'C12']) {
      const viewport = { width: 768, height: 1024 };
      await page.setViewportSize(viewport);
      await go(page, hash);
      const audit = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"]')]
          .filter((e) => {
            const r = e.getBoundingClientRect(), s = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 && !e.disabled;
          })
          .map((e) => {
            const r = e.getBoundingClientRect();
            return { tag: e.tagName, className: typeof e.className === 'string' ? e.className : '', text: (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 70), width: Math.round(r.width), height: Math.round(r.height) };
          });
        return { current: document.body.dataset.current, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, controls: all.length, small: all.filter((e) => e.width < 44 || e.height < 44) };
      });
      result.touch768.push({ hash, ...audit });
      fail(result, audit.current === hash, { area: hash + ' route', audit });
      fail(result, audit.small.length === 0, { area: hash + ' touch targets 768', small: audit.small });
      fail(result, audit.scrollWidth <= viewport.width, { area: hash + ' horizontal overflow', viewport: viewport.width, scrollWidth: audit.scrollWidth });
      await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_' + hash + '_768x1024.png') });
    }

    result.parity = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex')
      === crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'prototipo.html'))).digest('hex');
    fail(result, result.parity, { area: 'index.html = prototipo.html' });
    fail(result, result.consoleErrors.length === 0, { area: 'console errors', errors: result.consoleErrors });
    await context.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(evidence, 'A1_after_A8v2_phase3_diagnostics.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  const summary = {
    status: result.failures.length ? 'FAIL' : 'PASS',
    viewports: result.viewports,
    failures: result.failures.length,
    consoleErrors: result.consoleErrors.length,
    parity: result.parity,
    r00TextContrastRatios: result.r00.map((item) => ({ viewport: item.viewport, ratios: [item.h1.ratio, item.support.ratio, item.rolesHeading.ratio], failingPairs: item.failures.length })),
    c03: result.c03.map((item) => ({ viewport: item.viewport, launcher: item.launcherDisplay, overlaps: [item.emailOverlap, item.phoneOverlap], firstViewportCue: item.note && item.note.bottom <= item.viewportHeight, cueY: item.note?.y, ctaY: item.submit?.y, ctaPosition: item.submitPosition, scrollWidth: item.scrollWidth })),
    c09TabStates: result.c09.length,
    c10: { initialColor: result.c10.initialColor, transitionProperty: result.c10.transitionProperty, resizeColors: [...new Set(result.c10.samples.map((sample) => sample.color))] },
    touch768: result.touch768.map((item) => ({ route: item.hash, controls: item.controls, undersized: item.small.length, scrollWidth: item.scrollWidth })),
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  if (result.failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function setAndGoC10(page, result, evidence, base) {
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, 'C10');
  await page.waitForSelector('#m9-add-milk', { timeout: 8000 });
  const initialColor = await page.locator('#m9-add-milk').evaluate((el) => getComputedStyle(el).backgroundColor);
  result.c10 = { initialColor };
  await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_C10_390x844.png') });
  await page.setViewportSize({ width: 768, height: 1024 });
  const samples = await page.evaluate(async () => {
    const el = document.querySelector('#m9-add-milk');
    if (!el) return { missing: true, samples: [] };
    const samples = [];
    let start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        samples.push({ ms: Number((performance.now() - start).toFixed(1)), color: getComputedStyle(el).backgroundColor });
        if (performance.now() - start < 500) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return { missing: false, transitionProperty: getComputedStyle(el).transitionProperty, samples };
  });
  result.c10 = { ...samples, initialColor };
  const allowed = ['rgb(255, 255, 255)', 'rgb(243, 201, 0)'];
  fail(result, initialColor === 'rgb(255, 255, 255)', { area: 'C10 390px initial state', color: initialColor });
  fail(result, !samples.missing && !samples.transitionProperty.includes('background'), { area: 'C10 transition-property', sample: samples });
  fail(result, samples.samples.length > 0 && samples.samples.every((sample) => allowed.includes(sample.color)), {
    area: 'C10 resize intermediate colors',
    unexpected: samples.samples.filter((sample) => !allowed.includes(sample.color)),
  });
  await page.screenshot({ path: path.join(evidence, 'A1_after_A8v2_C10_768x1024.png') });
}

