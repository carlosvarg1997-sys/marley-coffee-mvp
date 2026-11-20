const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('./playwright-system-chrome.cjs');

const phase = process.argv[2];
if (!['antes', 'despues'].includes(phase)) throw new Error('Usa antes o despues');
const base = process.argv[3] || 'http://127.0.0.1:8894';
const output = path.join(__dirname, 'capturas-af-19nov', phase);
const captures = new Set(['C01', 'C04', 'C05', 'C06', 'C09', 'C10', 'Hoy-ventas', 'Hoy-marketing', 'Hoy-jefatura']);
const home = { ventas: 'R01', marketing: 'R11', jefatura: 'R05' };
const landings = ['empresas', 'cafeterias', 'conveniencia', 'eventos-catering', 'hoteles', 'oficinas', 'panaderias', 'restaurantes'];
const baseline = new Map();
if (phase === 'antes') {
  const files = ['index.html', 'crm/crm-v2.js', 'crm/crm-v2.css', 'captacion/landing/landing.css', ...landings.map(slug => `captacion/landing/${slug}.html`)];
  for (const file of files) baseline.set('/' + file, execFileSync('git', ['show', `204ffb2:${file}`], { cwd: path.join(__dirname, '..'), maxBuffer: 32 * 1024 * 1024 }));
}

function measure() {
  const words = /[\p{L}\p{N}]+(?:[.,’'-][\p{L}\p{N}]+)*/gu;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let first = 0;
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent.closest('script, style, option, [aria-hidden="true"]') || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const font = parseFloat(getComputedStyle(parent).fontSize);
    const clips = [];
    for (let el = parent; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (/(hidden|clip|scroll|auto)/.test(style.overflowX + style.overflowY)) clips.push(el.getBoundingClientRect());
    }
    for (const word of node.data.matchAll(words)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const visible = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height >= Math.max(4, font / 2) && clips.every(clip => rect.right > clip.left && rect.left < clip.right && rect.bottom > clip.top && rect.top < clip.bottom));
      if (!visible.length) continue;
      total++;
      if (visible.some(rect => rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight)) first++;
    }
  }
  return {
    first, total,
    headings: [...document.querySelectorAll('h1')].map(el => el.textContent.trim()),
    controls: [...document.querySelectorAll('button, a[href], summary')].filter(el => el.getClientRects().length && el.checkVisibility()).length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [width, height] of [[1280, 551], [390, 844]]) {
      const viewport = `${width}x${height}`;
      const routes = [
        ...Array.from({ length: 11 }, (_, i) => [`C${String(i + 1).padStart(2, '0')}`, '/index.html']),
        ...landings.map(slug => [`landing-${slug}`, `/captacion/landing/${slug}.html`]),
        ...['ventas', 'marketing', 'jefatura'].map(role => [`Hoy-${role}`, '/index.html', role]),
      ];
      for (const [name, address, role] of routes) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
        try {
          if (baseline.size) await context.route(url => baseline.has(url.pathname), route => {
            const pathname = new URL(route.request().url()).pathname;
            const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[path.extname(pathname)];
            return route.fulfill({ body: baseline.get(pathname), contentType: `${type}; charset=utf-8` });
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const seeded = ['C05', 'C06', 'C09'].includes(name);
          const screen = role ? 'R00' : seeded ? 'C04' : name.startsWith('C') ? name : '';
          await page.goto(`${base}${address}?motion=off${seeded ? '&test=personas' : ''}${screen ? `#${screen}` : ''}`, { waitUntil: 'domcontentloaded' });
          if (screen) await page.waitForFunction(() => window.__r5Instalado === true);
          if (role) {
            await page.locator(`[data-c2="choose-role"][data-role="${role}"]`).click();
            await page.waitForFunction(route => location.hash === `#${route}`, home[role]);
            await page.locator('#crm-v2-root:not([hidden]) [data-c2-go="' + home[role] + '"]').first().waitFor({ state: 'attached' });
          }
          if (seeded) {
            await page.evaluate(route => {
              M4.update(state => Object.assign(state, route === 'C05' ? M4.exampleState() : M4.acceptedExample(), {
                catalogJourney: { productsAt: M4.now(), productsSkipped: true, machineSource: 'diagnostico' },
              }));
              M4Journey.sync();
              if (route === 'C09' && M4.get().customerCycle) {
                M4.update(state => {
                  state.customerCycle.contractSignedAt = M4.now();
                  state.customerCycle.replenishmentNotice = true;
                });
                M4Journey.placeOrder(M4Journey.baseItems(M4.get()));
              }
              MarleyApp.go(route, { evaluation: true });
            }, name);
            await page.waitForFunction(route => document.body.dataset.current === route, name);
          }
          if (name === 'C09') await page.locator('#mcm-toast').waitFor({ state: 'hidden', timeout: 9000 });
          await page.locator('h1').first().waitFor({ state: 'attached' });
          await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2000))]); window.scrollTo(0, 0); });
          const metrics = await page.evaluate(measure);
          if (name === 'C09' && !await page.locator('.r3-order-focus').count()) throw new Error('Falta el pedido de prueba en C09');
          results.push({ name, viewport, ...metrics, errors });
          if (captures.has(name)) await page.screenshot({ path: path.join(output, `${name}-${viewport}.png`), animations: 'disabled' });
          if (process.env.AF_DOM_DIR && width === 1280) {
            const body = await page.locator('body').evaluate(el => [...el.children].filter(child => !/SCRIPT|STYLE/.test(child.tagName)).map(child => child.outerHTML).join('\n'));
            fs.writeFileSync(path.join(process.env.AF_DOM_DIR, `${name}.html`), body);
          }
        } finally { await context.close(); }
      }
    }
    fs.writeFileSync(path.join(output, 'palabras.json'), `${JSON.stringify(results, null, 2)}\n`);
    console.table(results.map(({ name, viewport, first, total, controls }) => ({ name, viewport, first, total, controls })));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
