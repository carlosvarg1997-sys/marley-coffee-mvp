const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const base = process.argv[2] || 'http://127.0.0.1:8896/';
const destination = path.resolve(process.argv[3] || '../marley-premium-20nov-evidencia');
const onlyAfter = process.argv.includes('--solo-despues');
const root = path.resolve(__dirname, '..');
const before = new Map(['index.html', 'crm/crm-v2.js', 'crm/crm-v2.css'].map(file => [
  '/' + file, execFileSync('git', ['show', '204ffb2:' + file], { cwd: root, maxBuffer: 32 * 1024 * 1024 }),
]));
const viewports = [[1280, 551], [1912, 733], [390, 844], [1440, 900], [360, 740]];
const routes = ['C01', 'C05', 'C09', 'R01', 'R11', 'R05'];
const roles = { R01: 'ventas', R11: 'marketing', R05: 'jefatura' };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function metrics() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const first = [];
  const firstMain = [];
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent.closest('script,style,option,[aria-hidden="true"],.b2c-sr-only') ||
        !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const clips = [];
    for (let el = parent; el !== document.body; el = el.parentElement) {
      if (/(hidden|clip|scroll|auto)/.test(getComputedStyle(el).overflow + '')) clips.push(el.getBoundingClientRect());
    }
    for (const word of node.data.matchAll(/[\p{L}\p{N}]+(?:[.,’'-][\p{L}\p{N}]+)*/gu)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const visible = [...range.getClientRects()].filter(box => box.width > 0 && box.height >= 5 &&
        clips.every(clip => box.right > clip.left && box.left < clip.right && box.bottom > clip.top && box.top < clip.bottom));
      if (!visible.length) continue;
      total++;
      if (visible.some(box => box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight)) {
        first.push(word[0]);
        if (parent.closest('main')) firstMain.push(word[0]);
      }
    }
  }
  return {
    first: first.length,
    firstMain: firstMain.length,
    total,
    words: first.join(' '),
    mainWords: firstMain.join(' '),
    height: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    fontsLoaded: ['Festivo', 'Pressura'].every(font => document.fonts.check('16px "' + font + '"')),
  };
}

async function enter(page, route) {
  const seeded = ['C05', 'C09'].includes(route);
  const start = roles[route] ? 'R00' : seeded ? 'C01' : route;
  await page.goto(new URL('index.html?test=personas#' + start, base).href, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__r5Instalado === true, null, { timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__r5Instalado === true, null, { timeout: 10000 });
  }
  if (roles[route]) await page.locator('[data-c2="choose-role"][data-role="' + roles[route] + '"]').click();
  if (seeded) {
    await page.evaluate(route => {
      M4.update(state => Object.assign(state, route === 'C05' ? M4.exampleState() : M4.acceptedExample(), {
        catalogJourney: { productsAt: M4.now(), productsSkipped: true, machineSource: 'diagnostico' },
      }));
      M4Journey.sync();
      if (route === 'C09') {
        M4.update(state => {
          state.customerCycle.contractSignedAt = M4.now();
          state.customerCycle.replenishmentNotice = true;
        });
        M4Journey.placeOrder(M4Journey.baseItems(M4.get()));
      }
      MarleyApp.go(route, { evaluation: true });
    }, route);
  }
  await page.waitForFunction(route => document.body.dataset.current === route, route);
  if (route === 'C09') await page.evaluate(() => window.MCToast?.hide());
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo({ top: 0, behavior: 'instant' });
  });
}

async function run() {
  const measurements = path.join(destination, 'mediciones.json');
  const results = onlyAfter ? JSON.parse(fs.readFileSync(measurements, 'utf8')).filter(row => row.phase === 'antes') : [];
  for (const channel of ['chrome', 'msedge']) {
    const browser = await chromium.launch({ channel });
    try {
      for (const phase of channel === 'chrome' && !onlyAfter ? ['antes', 'despues'] : ['despues']) {
        for (const [width, height] of viewports) {
          const viewport = width + 'x' + height;
          for (const route of routes) {
            const context = await browser.newContext({
              viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768,
              reducedMotion: 'reduce',
            });
            try {
              if (phase === 'antes') await context.route(url => before.has(url.pathname), route => {
                const pathname = new URL(route.request().url()).pathname;
                return route.fulfill({ body: before.get(pathname), contentType: mime[path.extname(pathname)] + '; charset=utf-8' });
              });
              const page = await context.newPage();
              const errors = [];
              page.on('pageerror', error => errors.push(error.message));
              const requests = [];
              page.on('requestfailed', request => requests.push(request.failure()?.errorText + ' ' + request.url()));
              try {
                await enter(page, route);
              } catch (error) {
                throw new Error([channel, phase, viewport, route, ...errors, ...requests].join(' · '), { cause: error });
              }
              const folder = path.join(destination, channel, phase);
              const file = path.join(folder, (roles[route] ? 'Hoy-' + roles[route] : route) + '-' + viewport);
              results.push({ channel, phase, route, viewport, ...await page.evaluate(metrics), errors });
              await page.screenshot({ path: file + '.png' });
              if (phase === 'despues' && !roles[route]) {
                if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)) {
                  await page.mouse.move(width / 2, height / 2);
                  await page.mouse.wheel(0, Math.floor(height * .72));
                  await page.waitForFunction(() => scrollY > 0);
                  await page.screenshot({ path: file + '-scroll.png' });
                }
                const details = page.locator({ C01: '.b2c-coffee-club', C05: '.premium-proposal-details', C09: '.premium-order-details' }[route]);
                await details.locator(':scope > summary').click();
                await details.scrollIntoViewIfNeeded();
                await page.screenshot({ path: file + '-detalle.png' });
              }
            } finally { await context.close(); }
          }
        }
      }
    } finally { await browser.close(); }
  }
  fs.writeFileSync(measurements, JSON.stringify(results, null, 2) + '\n');
  console.table(results.filter(row => row.channel === 'chrome' && row.viewport === '1280x551'));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
