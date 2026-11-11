const assert = require('node:assert/strict');
const { chromium } = require('./playwright-system-chrome.cjs');

const base = process.argv[2] || 'http://127.0.0.1:8879/';
const routeList = [
  ...Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 18 }, (_, i) => `R${String(i).padStart(2, '0')}`),
];
const touchRoutes = new Set(['C01', 'C02', 'C03', 'C04', 'C12', 'C13', 'C14', 'R00', 'R01', 'R02']);
const overlayRoutes = ['C01', 'C03', 'C04', 'C05', 'C08'];
const targetRoutes = ['C01', 'C02', 'C03', 'C04', 'C05', 'C08', 'C09', 'C12', 'C13', 'C14', 'C15', 'R00', 'R01', 'R02'];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
];
const roleFor = (hash) => ['R05', 'R14', 'R15'].includes(hash) ? 'jefatura'
  : ['R09', 'R11', 'R12', 'R13'].includes(hash) ? 'marketing'
    : hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function route(page, hash) {
  const role = roleFor(hash);
  await page.evaluate(({ hash, role }) => {
    if (window.M4?.setRole) window.M4.setRole(role);
    window.MarleyApp.go(hash, { evaluation: true });
  }, { hash, role });
  await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 8000 });
  await wait(60);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const allTerms = [];
  const routeVisits = [];
  const touchFailures = [];
  const overlayFailures = [];
  const firstFold = [];
  const formActions = [];
  const focusResults = [];
  const contrastResults = [];
  let badLinkCount = 0;
  let m9Background = null;
  let loginError = null;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText || '';
      if (new URL(request.url()).origin === new URL(base).origin && reason !== 'net::ERR_ABORTED') errors.push({ type: 'requestfailed', url: request.url(), message: reason });
    });
    await page.goto(new URL('/index.html', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.M4D), null, { timeout: 10000 });
    await page.evaluate(() => window.M4.loadExample());

    for (const hash of routeList) {
      await route(page, hash);
      const result = await page.evaluate(() => {
        const visible = (element) => {
          const r = element.getBoundingClientRect(), s = getComputedStyle(element);
          return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0;
        };
        const term = /\bdemo\b|demostraci[oó]n/i;
        const text = document.body.innerText || '';
        const attributes = [...document.querySelectorAll('body *')].filter(visible).flatMap((element) => ['aria-label', 'title', 'placeholder', 'alt'].map((name) => element.getAttribute(name) || '').filter(Boolean));
        return {
          current: document.body.dataset.current || '',
          terms: [text, document.title, ...attributes].filter((value) => term.test(value)).map((value) => value.trim().slice(0, 130)),
          badLinks: [...document.querySelectorAll('a[href]')].filter((a) => /diagramas\.html/i.test(a.getAttribute('href') || '')).length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      routeVisits.push({ hash, current: result.current, overflow: result.overflow });
      allTerms.push(...result.terms.map((text) => ({ hash, text })));
      badLinkCount += result.badLinks;
    }

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const hash of targetRoutes) {
        await route(page, hash);
        const data = await page.evaluate(({ hash, viewportHeight }) => {
          const visible = (element) => {
            const r = element.getBoundingClientRect(), s = getComputedStyle(element);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0;
          };
          const selector = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]';
          const controls = [...document.querySelectorAll(selector)].filter((element) => visible(element) && !element.disabled && element.getAttribute('aria-hidden') !== 'true');
          const small = controls.map((element) => {
            const target = element.matches('input[type="checkbox"],input[type="radio"]') ? (element.closest('label') || element) : element;
            const r = target.getBoundingClientRect();
            return { text: (element.innerText || element.getAttribute('aria-label') || element.value || '').trim().replace(/\s+/g, ' ').slice(0, 65), width: r.width, height: r.height };
          }).filter((item) => item.width < 44 || item.height < 44);
          const fixed = [...document.querySelectorAll('body *')].filter((element) => {
            const r = element.getBoundingClientRect(), s = getComputedStyle(element);
            return (s.position === 'fixed' || s.position === 'sticky') && r.width > 1 && r.height > 1 && visible(element);
          }).map((element) => {
            const r = element.getBoundingClientRect();
            return { selector: element.id || (typeof element.className === 'string' ? element.className : element.tagName), position: getComputedStyle(element).position, top: r.top, bottom: r.bottom, left: r.left, right: r.right, text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 55) };
          });
          const mainCta = hash === 'C08' ? [...document.querySelectorAll('button,a')].find((e) => e.innerText.trim().toLocaleUpperCase('es-CL') === 'COTIZAR')
            : hash === 'C14' ? [...document.querySelectorAll('button,a')].find((e) => e.innerText.trim().toLocaleLowerCase('es-CL') === 'añadir a mi propuesta')
              : hash === 'C15' ? [...document.querySelectorAll('button,a')].find((e) => e.innerText.trim().toLocaleLowerCase('es-CL') === 'revisar soporte') : null;
          const h1 = [...document.querySelectorAll('h1')].find(visible);
          const primary = [...document.querySelectorAll('button,a')].find((e) => {
            const label = e.innerText.trim().toLocaleUpperCase('es-CL');
            return ['CONFIRMAR PROPUESTA', 'VER MI PROPUESTA'].includes(label) && visible(e);
          });
          const input = document.querySelector('#m4Pass');
          const support = [...document.querySelectorAll('.m5-roles-head p')].find(visible);
          const targetColor = support ? getComputedStyle(support).color : null;
          let background = 'rgb(255, 255, 255)';
          if (support) {
            for (let element = support; element; element = element.parentElement) {
              const color = getComputedStyle(element).backgroundColor;
              if (color !== 'rgba(0, 0, 0, 0)') { background = color; break; }
            }
          }
          const touchFailure = small;
          const mobileOverlay = ['C01', 'C03', 'C04', 'C05', 'C08', 'R01', 'R02'].includes(hash) ? fixed : [];
          return {
            hash, fixed: mobileOverlay, small: touchFailure,
            h1: h1 ? { top: h1.getBoundingClientRect().top, bottom: h1.getBoundingClientRect().bottom } : null,
            cta: mainCta ? { text: mainCta.innerText.trim(), top: mainCta.getBoundingClientRect().top, bottom: mainCta.getBoundingClientRect().bottom, position: getComputedStyle(mainCta).position } : null,
            primary: primary ? { text: primary.innerText.trim(), y: primary.getBoundingClientRect().top + scrollY, position: getComputedStyle(primary).position } : null,
            support: support ? { color: targetColor, background } : null,
            loginInput: Boolean(input),
          };
        }, { hash, viewportHeight: viewport.height });
        if (touchRoutes.has(hash) && data.small.length) touchFailures.push({ width: viewport.width, hash, controls: data.small });
        if (data.fixed.length && overlayRoutes.includes(hash) || data.fixed.length && ['R01', 'R02'].includes(hash)) overlayFailures.push({ width: viewport.width, hash, fixed: data.fixed });
        if (['C08', 'C14', 'C15'].includes(hash)) firstFold.push({ width: viewport.width, hash, h1: data.h1, cta: data.cta });
        if (['C03', 'C04', 'C05'].includes(hash)) formActions.push({ width: viewport.width, hash, action: data.primary });
        if (data.support) contrastResults.push({ width: viewport.width, hash, ...data.support });
        if (hash === 'R00' && data.loginInput) {
          await page.locator('#m4Pass').fill('incorrecta');
          await page.locator('#m4User').fill('paula.diaz');
          await page.locator('button[type="submit"]').click();
          await page.waitForTimeout(30);
          loginError = await page.locator('[role="alert"]').first().innerText().catch(() => '');
        }
      }

      for (const hash of overlayRoutes) {
        await route(page, hash);
        const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        const positions = hash === 'C08' ? [0, Math.floor(max / 2), max] : [0, Math.floor(max / 2), max];
        for (const y of positions) {
          await page.evaluate((top) => scrollTo(0, top), y);
          await wait(40);
          const fixed = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => {
            const r = element.getBoundingClientRect(), position = getComputedStyle(element).position, style = getComputedStyle(element);
            return (position === 'fixed' || position === 'sticky') && r.width > 1 && r.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
          }).map((element) => {
            const r = element.getBoundingClientRect();
            return { selector: element.id || element.className || element.tagName, position: getComputedStyle(element).position, top: r.top, bottom: r.bottom, left: r.left, right: r.right, text: (element.innerText || '').trim().slice(0, 40) };
          }));
          if (fixed.length) overlayFailures.push({ width: viewport.width, hash, scrollY: y, fixed });
        }
      }
    }

    for (const hash of ['C01', 'C09', 'C12', 'C13']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await route(page, hash);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const element = document.activeElement, style = getComputedStyle(element);
        return { tag: element.tagName, text: (element.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 50), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, outlineColor: style.outlineColor, boxShadow: style.boxShadow };
      });
      focusResults.push({ hash, ...result });
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await route(page, 'C10');
    m9Background = await page.evaluate(() => {
      const element = document.querySelector('#m9-add-grano');
      return element ? getComputedStyle(element).backgroundColor : null;
    });
    await context.close();

    const videoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const videoPage = await videoContext.newPage();
    await videoPage.goto(new URL('/index.html#C02', base).toString(), { waitUntil: 'domcontentloaded' });
    await videoPage.waitForFunction(() => Boolean(window.M4 && window.MarleyApp), null, { timeout: 10000 });
    await wait(450);
    const videoInitial = await videoPage.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]?.transferSize || 0;
      const resources = performance.getEntriesByType('resource');
      const media = resources.filter((entry) => /\.(mp4|webm|m4v)(\?|$)/i.test(entry.name));
      const total = nav + resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      return { totalBytes: total, mediaRequests: media.map((entry) => entry.name), posterLoaded: resources.some((entry) => /poster_m\.webp/i.test(entry.name)), videos: document.querySelectorAll('video').length };
    });
    await videoPage.evaluate(() => scrollTo(0, 450));
    await videoPage.waitForFunction(() => performance.getEntriesByType('resource').some((entry) => /video_m\.mp4/i.test(entry.name)), null, { timeout: 5000 }).catch(() => {});
    const videoAfterScroll = await videoPage.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /\.(mp4|webm|m4v)(\?|$)/i.test(entry.name)).map((entry) => entry.name));
    await videoContext.close();

    const routeFailures = routeVisits.filter((visit) => visit.current !== visit.hash || visit.overflow);
    const firstFoldFailures = firstFold.filter((item) => !item.h1 || !item.cta || item.h1.top < -2 || item.h1.bottom > viewports.find((vp) => vp.width === item.width).height || item.cta.top < 0 || item.cta.bottom > viewports.find((vp) => vp.width === item.width).height || item.cta.position === 'fixed' || item.cta.position === 'sticky');
    const contrastFailures = contrastResults.filter((item) => contrastRatio(item.color, item.background) < 4.5);
    const focusFailures = focusResults.filter((item) => item.outlineStyle === 'none' || Number.parseFloat(item.outlineWidth) < 3 || !/(?:23,\s*23,\s*23|243,\s*201,\s*0)/.test(item.outlineColor));
    const output = {
      status: errors.length || allTerms.length || badLinkCount || routeFailures.length || touchFailures.length || overlayFailures.length || firstFoldFailures.length || contrastFailures.length || focusFailures.length || !loginError || /demo|demostraci[oó]n/i.test(loginError) || !/prueba/i.test(loginError) || m9Background !== 'rgb(255, 255, 255)' || videoInitial.mediaRequests.length || !videoInitial.posterLoaded || videoInitial.totalBytes >= 2500000 || !videoAfterScroll.length ? 'FAIL' : 'PASS',
      routes: routeVisits.length, errors, visibleDemoTerms: allTerms.slice(0, 20), badDiagramLinks: badLinkCount,
      routeFailures, touchFailures, overlayFailures, firstFold, firstFoldFailures,
      formActions,
      contrastResults, contrastFailures, focusResults, focusFailures, loginError,
      m9Background, videoInitial, videoAfterScroll,
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    assert.equal(output.status, 'PASS', 'final A8 checks pass across mobile routes');
  } finally { await browser.close(); }
}

function contrastRatio(foreground, background) {
  const luminance = (rgb) => {
    const values = rgb.match(/[\d.]+/g).slice(0, 3).map((value) => Number(value) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
