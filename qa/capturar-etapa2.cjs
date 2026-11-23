const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');
const { metrics } = require('./medir-piloto-premium.cjs');

const base = process.argv[2] || 'http://127.0.0.1:8896/';
const evidence = path.resolve(process.argv[3] || '../marley-etapa2-23nov-evidencia');
const phase = process.argv[4] || 'despues';
const only = new Set(process.argv.slice(5));
const repo = path.resolve(__dirname, '..');
const sizes = [[1280, 551], [1912, 733], [390, 844], [1440, 900], [360, 740]];
const kit = 'PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9';
const roles = {
  R01: 'ventas', R02: 'ventas', R03: 'ventas', R04: 'ventas',
  R05: 'jefatura', R06: 'jefatura', R07: 'jefatura', R08: 'jefatura',
  R09: 'jefatura', R10: 'jefatura', R11: 'marketing', R12: 'marketing',
  R13: 'marketing', R14: 'jefatura', R15: 'jefatura', R16: 'ventas', R17: 'ventas',
};
const screens = [
  ...Array.from({ length: 11 }, (_, n) => ['C' + String(n + 1).padStart(2, '0'), 'index.html']),
  ...Array.from({ length: 18 }, (_, n) => ['R' + String(n).padStart(2, '0'), 'index.html']),
  ...['landing', 'soluciones', 'contenidos'].flatMap(group =>
    fs.readdirSync(path.join(repo, 'captacion', group)).filter(file => file.endsWith('.html')).map(file =>
      [group + '-' + path.basename(file, '.html'), 'captacion/' + group + '/' + file])),
  ['blog', 'blog-empresas.html'], ['guia', 'guia-servicio-cafe.html'],
  ['feed', 'captacion/anuncios/feed-simulado.html'],
  ['buscador', 'PRUEBA_CON_PERSONAS/serp-seo-aeo-geo.html'],
  ['prueba', 'prueba.html'], ['prueba-kit', kit + '/inicio.html'],
];

function publishedFiles() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
  const names = execFileSync('git', ['diff', '--name-only', '--diff-filter=MD', '204ffb2', '--'], { cwd: repo, encoding: 'utf8' }).trim().split(/\r?\n/);
  return new Map(names.filter(name => mime[path.extname(name)]).map(name => [
    '/' + name,
    { body: execFileSync('git', ['show', '204ffb2:' + name], { cwd: repo, maxBuffer: 32 * 1024 * 1024 }),
      contentType: mime[path.extname(name)] },
  ]));
}

async function enter(page, id, file) {
  const app = file === 'index.html';
  const url = new URL(file, base);
  if (app) {
    url.searchParams.set('test', 'personas');
    url.hash = id[0] === 'R' ? 'R00' : (id === 'C02' ? 'C02' : 'C01');
  }
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  if (app) {
    await page.waitForFunction(() => window.__r5Instalado === true);
    if (roles[id]) await page.locator('[data-c2="choose-role"][data-role="' + roles[id] + '"]').click();
    if (!['C01', 'C02', 'R00', 'R01', 'R05', 'R11'].includes(id)) {
      await page.evaluate(id => {
        if (['C05', 'C06', 'C07', 'C09'].includes(id)) {
          M4.update(state => Object.assign(state, id === 'C05' ? M4.exampleState() : M4.acceptedExample(), {
            catalogJourney: { productsAt: M4.now(), productsSkipped: true, machineSource: 'diagnostico' },
          }));
          M4Journey.sync();
          if (id === 'C09') {
            M4.update(state => {
              state.customerCycle.contractSignedAt = M4.now();
              state.customerCycle.replenishmentNotice = true;
            });
            M4Journey.placeOrder(M4Journey.baseItems(M4.get()));
          }
        }
        MarleyApp.go(id, { evaluation: true });
      }, id);
    }
    await page.waitForFunction(id => document.body.dataset.current === id, id);
    if (id === 'R17' && phase !== 'antes') await page.locator('.crm2-buyer-fold').first().waitFor();
    if (id === 'C09') await page.evaluate(() => window.MCToast?.hide());
  }
  if (id === 'prueba') await page.locator('#welcome-next').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images].filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().width > 0);
    await Promise.race([Promise.allSettled(images.map(img => img.decode())), new Promise(resolve => setTimeout(resolve, 700))]);
    scrollTo({ top: 0, behavior: 'instant' });
  });
}

async function main() {
  const before = phase === 'antes' ? publishedFiles() : new Map();
  const channels = phase === 'antes' ? ['chrome'] : phase === 'edge' ? ['msedge'] : ['chrome'];
  const directory = phase === 'antes' ? 'antes' : 'despues';
  for (const channel of channels) {
    const browser = await chromium.launch({ channel });
    const out = path.join(evidence, channel, directory);
    fs.mkdirSync(out, { recursive: true });
    const report = path.join(out, 'mediciones.json');
    const previous = only.size && fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : null;
    const results = previous ? previous.results.filter(row => !only.has(row.id)) : [];
    const jobs = (phase === 'antes' ? sizes.slice(0, 3) : sizes).flatMap(size =>
      screens.filter(([id]) => !only.size || only.has(id)).map(screen => ({ size, screen })));
    const failures = previous ? previous.failures.filter(row => !only.has(row.id)) : [];
    try {
      async function capture() {
        for (let job = jobs.shift(); job; job = jobs.shift()) {
          const { size: [width, height], screen: [id, file] } = job;
          const viewport = width + 'x' + height;
          const name = path.join(out, id + '-' + viewport);
          const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768, reducedMotion: channel === 'chrome' ? 'reduce' : 'no-preference' });
          try {
            if (before.size) await context.route(url => before.has(url.pathname), route => route.fulfill(before.get(new URL(route.request().url()).pathname)));
            const page = await context.newPage();
            page.setDefaultTimeout(12000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            try {
              await enter(page, id, file);
            } catch (error) {
              if (!/ERR_CONNECTION_REFUSED|Timeout .* exceeded/.test(error.message)) throw error;
              await enter(page, id, file);
            }
            if (channel === 'msedge') {
              await page.evaluate(async () => {
                const transitions = document.getAnimations().filter(animation =>
                  animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime));
                await Promise.race([
                  Promise.allSettled(transitions.map(animation => animation.finished)),
                  new Promise(resolve => setTimeout(resolve, 1200)),
                ]);
              });
            }
            results.push({ id, file, viewport, ...await page.evaluate(metrics), errors });
            await page.screenshot({ path: name + '.png' });
            if (phase !== 'antes' && await page.evaluate(() => document.documentElement.scrollHeight - innerHeight > 24)) {
              await page.mouse.move(width / 2, height / 2);
              await page.mouse.wheel(0, Math.floor(height * .72));
              await page.waitForTimeout(380);
              await page.screenshot({ path: name + '-scroll.png' });
            }
          } catch (error) {
            failures.push({ id, viewport, error: error.message });
          } finally { await context.close(); }
        }
      }
      await Promise.all(Array.from({ length: Number(process.env.QA_CAPTURE_WORKERS || 2) }, () => capture()));
    } finally { await browser.close(); }
    results.sort((a, b) => a.id.localeCompare(b.id) || a.viewport.localeCompare(b.viewport));
    fs.writeFileSync(report, JSON.stringify({ results, failures }, null, 2) + '\n');
    console.log(channel, directory, results.length, 'mediciones', failures);
    if (failures.length) process.exitCode = 1;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
