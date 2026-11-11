// Recorre todos los hashes A8 desde el enrutador con un caso local de prueba.
// R17 se verifica aparte porque se integró después del inventario de A8.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8878/';
const hashes = [
  ...Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 17 }, (_, i) => `R${String(i).padStart(2, '0')}`),
];
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const outputDir = path.join(root, 'EVIDENCIA_10NOV');
const evidenceHashes = new Set(['C01', 'C02', 'C03', 'C08', 'C10', 'R02', 'R06', 'R16', 'R17']);

function roleFor(hash) {
  if (['R05', 'R14', 'R15'].includes(hash)) return 'jefatura';
  if (['R09', 'R11', 'R12', 'R13'].includes(hash)) return 'marketing';
  if (hash.startsWith('R') && hash !== 'R00') return 'ventas';
  return null;
}

async function collect(page, expectedHash, viewport) {
  const role = roleFor(expectedHash);
  await page.evaluate(({ expectedHash, role }) => {
    if (window.M4?.loadExample) window.M4.loadExample();
    if (window.M4?.setRole) window.M4.setRole(role);
    if (window.MarleyApp?.go) window.MarleyApp.go(expectedHash, { evaluation: true });
  }, { expectedHash, role });
  await page.waitForFunction((hash) => document.body.dataset.current === hash, expectedHash, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0;
    };
    const selector = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
    const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const controls = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]')]
      .filter((el) => visible(el) && !el.disabled && el.getAttribute('aria-hidden') !== 'true');
    const smallTouches = controls.map((el) => {
      const target = el.matches('input[type="checkbox"],input[type="radio"]') ? (el.closest('label') || el) : el;
      const r = target.getBoundingClientRect();
      return { selector: selector(el), target: target === el ? selector(el) : selector(target), width: Math.round(r.width), height: Math.round(r.height), text: label(el) };
    })
      .filter((el) => el.width < 44 || el.height < 44);
    const yellows = [...document.querySelectorAll('a[href],button,[role="button"]')]
      .filter((el) => visible(el) && !el.disabled)
      .map((el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { selector: selector(el), bg: s.backgroundColor, color: s.color, width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), left: Math.round(r.left), text: label(el) };
      })
      .filter((el) => /^(rgb\()?\s*(?:243,\s*201,\s*0|247,\s*190,\s*0|239,\s*198,\s*0|203,\s*166,\s*0)/i.test(el.bg));
    const inViewport = (item) => item.bottom > 0 && item.top < innerHeight && item.right > 0 && item.left < innerWidth;
    const h1 = [...document.querySelectorAll('h1')].find((el) => visible(el));
    return {
      actualHash: (location.hash || '').slice(1).split('?')[0],
      current: document.body.dataset.current || '',
      title: document.title,
      h1: h1?.innerText?.trim() || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      smallTouches,
      yellowActions: yellows,
      yellowInViewport: yellows.filter(inViewport),
      videosPlaying: [...document.querySelectorAll('video')].filter((video) => !video.paused && !video.ended).length,
    };
  });

  if (evidenceHashes.has(expectedHash)) {
    const evidenceName = `A1_A8_${expectedHash}_${viewport.width}.png`;
    await page.screenshot({ path: path.join(outputDir, evidenceName), fullPage: true });
  }
  return { expectedHash, viewport: viewport.width, ...metrics };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [], errors = [];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push({ viewport: viewport.width, type: 'pageerror', message: error.message, stack: error.stack || '' }));
        page.on('console', (message) => { if (message.type() === 'error') errors.push({ viewport: viewport.width, type: 'console', message: message.text() }); });
        page.on('requestfailed', (request) => {
          const message = request.failure()?.errorText || '';
          // Al cambiar hash una imagen lazy de la vista anterior puede cancelarse sin indicar un fallo del sitio.
          if (new URL(request.url()).origin === new URL(base).origin && message !== 'net::ERR_ABORTED') errors.push({ viewport: viewport.width, type: 'requestfailed', url: request.url(), message });
        });
        await page.goto(new URL('/index.html', base).toString(), { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.M4D), null, { timeout: 10000 });
        for (const hash of hashes) results.push(await collect(page, hash, viewport));
        // R17 es la integración por comprador posterior al conjunto de 32 rutas revisadas por A8.
        await page.evaluate(() => window.M4?.setRole?.('marketing'));
        results.push(await collect(page, 'R17', viewport));
        await page.close();
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }

  const routeMismatches = results.filter((result) => (result.actualHash || (result.expectedHash === 'C01' ? 'C01' : '')) !== result.expectedHash || result.current !== result.expectedHash)
    .map(({ viewport, expectedHash, actualHash, current, title }) => ({ viewport, expectedHash, actualHash, current, title }));
  const overflow = results.filter((result) => result.overflow)
    .map(({ viewport, expectedHash, scrollWidth, clientWidth }) => ({ viewport, expectedHash, scrollWidth, clientWidth }));
  const missingH1 = results.filter((result) => !result.h1).map(({ viewport, expectedHash, title }) => ({ viewport, expectedHash, title }));
  const playingVideos = results.filter((result) => result.videosPlaying).map(({ viewport, expectedHash, videosPlaying }) => ({ viewport, expectedHash, videosPlaying }));
  const mobile = results.filter((result) => result.viewport === 390);
  const smallTouchSummary = mobile.filter((result) => result.smallTouches.length)
    .map((result) => ({ hash: result.expectedHash, count: result.smallTouches.length, controls: [...new Map(result.smallTouches.map((item) => [`${item.target} ${item.width}×${item.height} · ${item.text}`, `${item.target} ${item.width}×${item.height} · ${item.text}`])).values()] }));
  const yellowSummary = mobile.filter((result) => result.yellowActions.length)
    .map((result) => ({ hash: result.expectedHash, actions: result.yellowActions.map(({ text, selector, bg, top, bottom }) => ({ text, selector, bg, inViewport: bottom > 0 && top < 844 })) }));
  const yellowCompetitionSummary = results.filter((result) => result.yellowInViewport.length > 1)
    .map((result) => ({ hash: result.expectedHash, viewport: result.viewport, actions: result.yellowInViewport.map(({ text, selector, bg }) => ({ text, selector, bg })) }));
  const status = errors.length || routeMismatches.length || overflow.length || missingH1.length || playingVideos.length || smallTouchSummary.length || yellowCompetitionSummary.length ? 'FAIL' : 'PASS';
  const summary = { status, originalA8Hashes: hashes.length, viewportVisits: results.length, rootErrors: errors, routeMismatches, overflow, missingH1, reducedMotionVideosPlaying: playingVideos, smallTouchSummary, yellowSummary, yellowCompetitionSummary };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  assert.equal(errors.length, 0, 'portal root and all routes load without JS, console, or local request errors');
  assert.equal(routeMismatches.length, 0, 'all 32 A8 hashes and R17 render at their requested route');
  assert.equal(overflow.length, 0, 'all tested portal routes fit their viewport');
  assert.equal(missingH1.length, 0, 'every tested route has a visible H1');
  assert.equal(playingVideos.length, 0, 'reduced motion leaves all videos paused');
  assert.equal(smallTouchSummary.length, 0, 'all visible mobile controls have a touch target of at least 44 × 44 px');
  assert.equal(yellowCompetitionSummary.length, 0, 'no route has competing yellow actions in its viewport');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
