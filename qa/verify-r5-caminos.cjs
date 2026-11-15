// Verificador R5 de caminos, coherencia de máquina, respuesta a clics, barras, encabezados, medidas y paleta.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidencia', 'R5', 'C3');
const LANDINGS = [
  { slug: 'restaurantes', buyer: 'Restaurante', chip: 'Restaurante' },
  { slug: 'hoteles', buyer: 'Hotel', chip: 'Hotel' },
  { slug: 'cafeterias', buyer: 'Cafetería', chip: 'Cafetería' },
  { slug: 'oficinas', buyer: 'Oficinas', chip: 'OCS' },
  { slug: 'panaderias', buyer: 'Panadería', chip: 'Panadería' },
  { slug: 'conveniencia', buyer: 'Conveniencia', chip: 'Conveniencia' },
  { slug: 'eventos-catering', buyer: 'Eventos o catering', chip: 'Eventos o catering' },
  // R5 C4 (14-nov): la landing empresas es general (buyer 'general'); C04 pregunta el negocio
  { slug: 'empresas', buyer: 'general', chip: 'OCS', general: true },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = http.createServer((req, res) => {
    let pathname = '/';
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(bytes);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, width, height, touch) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: touch,
    isMobile: touch,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return { ctx, page, pageErrors };
}

async function currentHash(page) {
  return page.evaluate(() => (location.hash || '').split('?')[0]);
}

async function readGuide(page) {
  return page.evaluate(() => {
    const api = window.R5?.guia?.() || null;
    const domSteps = Array.from(document.querySelectorAll('.r5-guia li, .r5-guia [data-step], .m5-steps li, nav.r3-steps li, .r3-steps li')).map((el) => ({
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      active: el.classList.contains('is-active') || el.classList.contains('is-on') || el.getAttribute('aria-current') === 'step',
    })).filter((x) => x.text);
    const guideText = (document.querySelector('.r5-guia, .m5-steps, .r3-steps')?.innerText || '').replace(/\s+/g, ' ').trim();
    return { api, domSteps, guideText };
  });
}

async function fillC04(page, { pickNegocio = 'Restaurante', comuna = 'Las Condes' } = {}) {
  await page.locator('.m5-qcard').waitFor({ state: 'visible', timeout: 10000 });
  const anyNegocio = page.locator('#r4Datos [data-a="answer"][data-k="negocio"]');
  if (await anyNegocio.count()) {
    const exactBtn = page.locator(`#r4Datos [data-a="answer"][data-k="negocio"][data-v="${pickNegocio}"]`);
    if (await exactBtn.count()) await exactBtn.first().click();
    else await anyNegocio.first().click();
    await wait(150);
  }
  const comunaSel = page.locator('#m5Comuna');
  if (await comunaSel.count()) {
    await comunaSel.selectOption({ label: comuna });
    await wait(120);
  }
  const nameIn = page.locator('#r4Datos [name="name"]:visible');
  if (await nameIn.count() && !(await nameIn.inputValue()).trim()) await nameIn.fill('Camila Rojas');
  const emailIn = page.locator('#r4Datos [name="email"]:visible');
  if (await emailIn.count() && !(await emailIn.inputValue()).trim()) await emailIn.fill('camila.rojas@example.com');
  const consent = page.locator('#r4Datos [name="consent"]:visible');
  if (await consent.count() && !(await consent.isChecked())) await consent.check();
}

function recordFail(failures, label, detail) {
  failures.push(`${label}: ${detail}`);
}

async function checkHeadingHierarchy(page, rootSelector, label, failures) {
  const audit = await page.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document.body;
    if (!scope) return { missingScope: true, items: [] };
    const isVisible = (el) => {
      if (!el || el.closest('[hidden], #m4t, #m4-demo-dock')) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const hs = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const items = hs.map((h) => {
      const closedCarro = h.closest('.r5-carro:not(.is-abierto)');
      const inClosedModal = Boolean(closedCarro && getComputedStyle(closedCarro).display === 'none');
      return {
        level: Number(h.tagName.slice(1)),
        text: (h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim(),
        visible: isVisible(h),
        inClosedDetails: Boolean(h.closest('details:not([open])')) || inClosedModal,
        inHiddenArea: Boolean(h.closest('[hidden], .r5-faq-hidden[hidden]')),
      };
    });
    return { missingScope: false, items };
  }, rootSelector);

  if (audit.missingScope) {
    recordFail(failures, label, `no existe contenedor ${rootSelector}`);
    return;
  }
  const visible = audit.items.filter((x) => x.visible && !x.inClosedDetails && !x.inHiddenArea);
  const h1s = visible.filter((x) => x.level === 1);
  if (h1s.length !== 1) {
    recordFail(failures, label, `se esperaba 1 H1 visible y hay ${h1s.length} (${h1s.map((x) => x.text).join(' | ')})`);
  }
  for (const h of audit.items) {
    if (!h.text) recordFail(failures, label, `encabezado H${h.level} vacío`);
    if (!h.visible && !h.inClosedDetails && !h.inHiddenArea) {
      recordFail(failures, label, `encabezado H${h.level} oculto: "${h.text.slice(0, 60)}"`);
    }
  }
  let prev = 0;
  for (const h of visible) {
    if (prev > 0 && h.level > prev + 1) {
      recordFail(failures, label, `salto de nivel de H${prev} a H${h.level} en "${h.text.slice(0, 60)}"`);
    }
    prev = h.level;
  }
}

async function checkPalette(page, scopeSelector, label, failures) {
  const bad = await page.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document.body;
    if (!scope) return [];
    const parseRgb = (str) => {
      const m = String(str || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/i);
      if (!m) return null;
      const a = m[4] === undefined ? 1 : Number(m[4]);
      if (a === 0) return null;
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
    };
    const isNeutralOrYellow = (c) => {
      const spread = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
      if (spread <= 8) return true; // negro, blanco y gris neutro
      // Amarillo Marley / dorado cálido (#F3C900, #F4C400, #735D00, #FFC800): R >= G > B con B notablemente más bajo
      if (c.r >= 100 && c.g >= 80 && c.r >= c.g - 15 && c.g > c.b + 25 && c.b <= 90) return true;
      return false;
    };
    const issues = [];
    const els = [scope, ...scope.querySelectorAll('*')];
    for (const el of els) {
      if (el.closest('#m4t, #m4-demo-dock, video')) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const bg = parseRgb(st.backgroundColor);
      if (bg && !isNeutralOrYellow(bg)) {
        issues.push({ kind: 'bg', color: st.backgroundColor, tag: el.tagName, cls: String(el.className || '').slice(0, 40) });
      }
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const bw = parseFloat(st['border' + side + 'Width']) || 0;
        if (bw > 0) {
          const bc = parseRgb(st['border' + side + 'Color']);
          if (bc && !isNeutralOrYellow(bc)) {
            issues.push({ kind: 'border', color: st['border' + side + 'Color'], tag: el.tagName, cls: String(el.className || '').slice(0, 40) });
            break;
          }
        }
      }
      if (issues.length >= 6) break;
    }
    return issues;
  }, scopeSelector);
  if (bad.length) {
    recordFail(failures, label, `paleta fuera de negro/blanco/gris neutro/amarillo: ${JSON.stringify(bad)}`);
  }
}

async function checkHeightsAndOverflow(page, maxMobileH, maxDesktopH, label, failures) {
  const m = await page.evaluate(() => ({
    vw: window.innerWidth,
    vh: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight,
  }));
  if (m.sw > m.cw) {
    recordFail(failures, label, `desborde lateral a ${m.vw}px: scrollWidth=${m.sw} > clientWidth=${m.cw}`);
  }
  if (m.vw <= 420 && maxMobileH && m.sh > maxMobileH) {
    recordFail(failures, label, `alto ${m.sh}px excede tope ${maxMobileH}px a ${m.vw}px`);
  }
  if (m.vw >= 1200 && maxDesktopH && m.sh > maxDesktopH) {
    recordFail(failures, label, `alto ${m.sh}px excede tope ${maxDesktopH}px a ${m.vw}px`);
  }
}

async function testViewportFlows(browser, base, vp, failures) {
  const tag = `${vp.width}x${vp.height}`;

  // 1) Camino «Elige tus productos»: C02 -> C10 -> C04 -> C05 -> C06 (4 pantallas) + interacciones catálogo + barras
  {
    const { ctx, page, pageErrors } = await newPage(browser, vp.width, vp.height, vp.touch);
    try {
      await page.goto(`${base}/index.html#C02`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__r5Instalado === true, null, { timeout: 8000 });
      await page.locator('.ux-hero [data-m9-open]').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('.ux-hero [data-m9-open]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C10', null, { timeout: 8000 });
      await page.locator('.m9-catalog').waitFor({ state: 'visible' });

      const screens = ['C10'];
      const g1 = await readGuide(page);
      if (JSON.stringify(g1.api) !== JSON.stringify({ pasos: ['Productos', 'Tu negocio', 'Propuesta', 'Confirmar'], actual: 1 })) {
        recordFail(failures, `${tag}/productos/C10`, `guía incorrecta: ${JSON.stringify(g1.api)}`);
      }

      // Barras en C10 antes de interactuar
      const barMetrics = await page.evaluate(() => {
        const bar = document.querySelector('.r5-barra');
        const cta = document.querySelector('#m9-continue');
        const res = document.querySelector('[data-r5-carro-abrir]');
        if (!bar || !cta) return { missing: true };
        const br = bar.getBoundingClientRect();
        const cr = cta.getBoundingClientRect();
        const rr = res ? res.getBoundingClientRect() : null;
        const overlapsBtn = rr ? !(rr.right <= cr.left + 1 || cr.right <= rr.left + 1 || rr.bottom <= cr.top + 1 || cr.bottom <= rr.top + 1) : false;
        return {
          missing: false,
          ratio: br.height / window.innerHeight,
          barH: br.height,
          vh: window.innerHeight,
          ctaVisible: cr.width > 0 && cr.height > 0 && cr.bottom <= window.innerHeight + 1 && cr.top >= -1,
          overlapsBtn,
        };
      });
      if (barMetrics.missing) {
        recordFail(failures, `${tag}/C10/barra`, 'falta .r5-barra o #m9-continue');
      } else {
        if (barMetrics.ratio > 0.15) recordFail(failures, `${tag}/C10/barra`, `barra ocupa ${(barMetrics.ratio * 100).toFixed(1)}% (> 15%) del alto`);
        if (!barMetrics.ctaVisible) recordFail(failures, `${tag}/C10/barra`, '#m9-continue no queda visible dentro del viewport');
        if (barMetrics.overlapsBtn) recordFail(failures, `${tag}/C10/barra`, 'el resumen de barra tapa al CTA #m9-continue');
      }

      // Clics en catálogo: Agregar -> +/- -> quitar con Deshacer -> Elegir pack sin borrar lo agregado
      const nonPackBtn = page.locator('.r5-prod:not(:has(.r5-tag)) [data-m9-add]').first();
      const targetProdId = await nonPackBtn.getAttribute('data-m9-add');
      await nonPackBtn.click();
      const prodCard = page.locator(`.r5-prod[data-r5-prod="${targetProdId}"]`);
      await prodCard.locator('.r5-cant output').waitFor({ state: 'visible', timeout: 4000 });
      if ((await prodCard.locator('.r5-cant output').innerText()).trim() !== '1') {
        recordFail(failures, `${tag}/C10/agregar`, 'Agregar no pasó a cantidad 1');
      }
      await page.locator('#r5-aviso.is-on').waitFor({ state: 'visible', timeout: 3000 }).catch(() => recordFail(failures, `${tag}/C10/agregar`, 'no apareció #r5-aviso tras Agregar'));

      // El aviso no tapa la barra
      const avisoCheck = await page.evaluate(() => {
        const av = document.querySelector('#r5-aviso.is-on');
        const bar = document.querySelector('.r5-barra');
        if (!av || !bar) return { ok: true };
        const a = av.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const overlap = !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
        return { ok: !overlap, a: { top: a.top, bottom: a.bottom }, b: { top: b.top, bottom: b.bottom } };
      });
      if (!avisoCheck.ok) recordFail(failures, `${tag}/C10/aviso`, `#r5-aviso tapa a .r5-barra (${JSON.stringify(avisoCheck)})`);

      // Botón +
      await prodCard.locator('[data-r3-qty="plus"]').click();
      await wait(120);
      if ((await prodCard.locator('.r5-cant output').innerText()).trim() !== '2') {
        recordFail(failures, `${tag}/C10/+`, 'botón + no subió la cantidad a 2');
      }
      if (!(await page.locator('#r5-aviso.is-on').isVisible())) recordFail(failures, `${tag}/C10/+`, 'no apareció aviso al sumar con +');

      // Botón - a 1
      await prodCard.locator('[data-r3-qty="minus"]').click();
      await wait(120);
      if ((await prodCard.locator('.r5-cant output').innerText()).trim() !== '1') {
        recordFail(failures, `${tag}/C10/-`, 'botón − no bajó la cantidad a 1');
      }
      if (!(await page.locator('#r5-aviso.is-on').isVisible())) recordFail(failures, `${tag}/C10/-`, 'no apareció aviso al restar con −');

      // Quitar (llegar a 0) -> Deshacer restaura
      await prodCard.locator('[data-r3-qty="minus"]').click();
      await wait(150);
      if (await prodCard.locator('.r5-cant').count()) recordFail(failures, `${tag}/C10/quitar`, 'quitar hasta 0 no removió el selector de cantidad');
      const undoBtn = page.locator('#r5-aviso.is-on .r5-aviso-acc');
      if (!(await undoBtn.count()) || !(await undoBtn.innerText()).includes('Deshacer')) {
        recordFail(failures, `${tag}/C10/quitar`, 'al quitar no apareció aviso con «Deshacer»');
      } else {
        await undoBtn.click();
        await wait(150);
        if ((await prodCard.locator('.r5-cant output').innerText()).trim() !== '1') {
          recordFail(failures, `${tag}/C10/deshacer`, '«Deshacer» no restauró el producto quitado');
        }
      }

      // Elegir pack sin borrar el producto previo
      await page.locator('[data-r3-pack]').click();
      const packDoneBtn = page.locator('[data-r5-ver-carro]');
      await packDoneBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      const packTxt = (await packDoneBtn.count()) ? await packDoneBtn.first().textContent() : '';
      if (!(await packDoneBtn.count()) || !/Pack en tu cotización/i.test(packTxt || '')) {
        recordFail(failures, `${tag}/C10/pack`, 'al elegir el pack no mostró «✓ Pack en tu cotización»');
      }
      await page.locator('#r5-aviso.is-on').waitFor({ state: 'visible', timeout: 3000 }).catch(() => recordFail(failures, `${tag}/C10/pack`, 'no apareció aviso al elegir el pack'));
      if (!(await prodCard.locator('.r5-cant').count())) {
        recordFail(failures, `${tag}/C10/pack`, 'elegir el pack borró el producto que ya estaba en la cotización');
      }

      // Hoja «Mi cotización» en celular (390x844): abre, Escape cierra y devuelve el foco
      if (vp.width <= 899) {
        const opener = page.locator('[data-r5-carro-abrir]');
        await opener.click();
        await page.locator('#r5-carro.is-abierto').waitFor({ state: 'visible', timeout: 3000 }).catch(() => recordFail(failures, `${tag}/C10/hoja`, 'no se abrió la hoja #r5-carro'));
        await page.keyboard.press('Escape');
        await wait(150);
        if (await page.locator('#r5-carro.is-abierto').count()) {
          recordFail(failures, `${tag}/C10/hoja`, 'Escape no cerró la hoja «Mi cotización»');
        }
        const focusBack = await page.evaluate(() => document.activeElement?.hasAttribute('data-r5-carro-abrir'));
        if (!focusBack) recordFail(failures, `${tag}/C10/hoja`, 'Escape no devolvió el foco a [data-r5-carro-abrir]');
      }

      // Continuar C10 -> C04 -> C05 -> C06
      await page.locator('#m9-continue').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C04', null, { timeout: 8000 });
      screens.push(await currentHash(page).then((h) => h.slice(1)));
      const g2 = await readGuide(page);
      if (JSON.stringify(g2.api) !== JSON.stringify({ pasos: ['Productos', 'Tu negocio', 'Propuesta', 'Confirmar'], actual: 2 })) {
        recordFail(failures, `${tag}/productos/C04`, `guía incorrecta: ${JSON.stringify(g2.api)}`);
      }
      await fillC04(page, { pickNegocio: 'Restaurante', comuna: 'Las Condes' });
      await page.locator('[data-a="next"]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C05', null, { timeout: 8000 });
      screens.push(await currentHash(page).then((h) => h.slice(1)));
      const g3 = await readGuide(page);
      if (JSON.stringify(g3.api) !== JSON.stringify({ pasos: ['Productos', 'Tu negocio', 'Propuesta', 'Confirmar'], actual: 3 })) {
        recordFail(failures, `${tag}/productos/C05`, `guía incorrecta: ${JSON.stringify(g3.api)}`);
      }
      await page.locator('[data-a="accept-prop"]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C06', null, { timeout: 8000 });
      screens.push(await currentHash(page).then((h) => h.slice(1)));
      const g4 = await readGuide(page);
      if (JSON.stringify(g4.api) !== JSON.stringify({ pasos: ['Productos', 'Tu negocio', 'Propuesta', 'Confirmar'], actual: 4 })) {
        recordFail(failures, `${tag}/productos/C06`, `guía incorrecta: ${JSON.stringify(g4.api)}`);
      }
      if (screens.join('>') !== 'C10>C04>C05>C06') {
        recordFail(failures, `${tag}/productos`, `recorrido esperado en 4 pantallas C10>C04>C05>C06, obtenido ${screens.join('>')}`);
      }
      if (pageErrors.length) recordFail(failures, `${tag}/productos/errores`, pageErrors.join(' | '));
    } finally {
      await ctx.close();
    }
  }

  // 2) Camino «Calcula tu solución»: C02 -> C04 -> C05 -> C06 (3 pantallas) + máquina coherente C04/C05/C06/C11 + Barra con barista + porqué
  {
    const { ctx, page, pageErrors } = await newPage(browser, vp.width, vp.height, vp.touch);
    try {
      await page.goto(`${base}/index.html#C02`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__r5Instalado === true, null, { timeout: 8000 });
      await page.locator('.ux-hero [data-m10-unknown]').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('.ux-hero [data-m10-unknown]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C04', null, { timeout: 8000 });

      const screens = ['C04'];
      const g1 = await readGuide(page);
      if (JSON.stringify(g1.api) !== JSON.stringify({ pasos: ['Tu solución', 'Propuesta', 'Confirmar'], actual: 1 })) {
        recordFail(failures, `${tag}/solucion/C04`, `guía incorrecta: ${JSON.stringify(g1.api)}`);
      }
      await fillC04(page, { pickNegocio: 'Restaurante', comuna: 'Las Condes' });
      await page.locator('#r4Datos [data-a="answer"][data-k="operacion"][data-v="Barra con barista"]').waitFor({ state: 'visible', timeout: 8000 });
      await page.locator('#r4Datos [data-a="answer"][data-k="operacion"][data-v="Barra con barista"]').click();
      await page.locator('#r5-aviso.is-on').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      const baristaCheck = await page.evaluate(() => ({
        maq: document.querySelector('#r4Datos [data-r5-maq], .r5-resultado[data-r5-maq]')?.getAttribute('data-r5-maq') || window.R5?.maquina?.(),
        avisoOn: Boolean(document.querySelector('#r5-aviso.is-on')),
        avisoTxt: (document.querySelector('#r5-aviso')?.innerText || '').trim(),
      }));
      if (baristaCheck.maq !== 'bar') {
        recordFail(failures, `${tag}/C04/maquina-bar`, `al cambiar a «Barra con barista» salió "${baristaCheck.maq}" en vez de "bar"`);
      }
      if (!baristaCheck.avisoOn || !baristaCheck.avisoTxt) {
        recordFail(failures, `${tag}/C04/maquina-bar`, 'al cambiar a «Barra con barista» no apareció aviso visible');
      }

      await page.locator('[data-a="next"]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C05', null, { timeout: 8000 });
      const hashC05 = await currentHash(page);
      if (hashC05 !== '#C05') recordFail(failures, `${tag}/solucion`, `se esperaba #C05 directo y llegó a ${hashC05}`);
      screens.push('C05');
      const g2 = await readGuide(page);
      if (JSON.stringify(g2.api) !== JSON.stringify({ pasos: ['Tu solución', 'Propuesta', 'Confirmar'], actual: 2 })) {
        recordFail(failures, `${tag}/solucion/C05`, `guía incorrecta: ${JSON.stringify(g2.api)}`);
      }
      const c05Info = await page.evaluate(() => ({
        maq: window.R5?.maquina?.(),
        porqueVisible: Boolean(document.querySelector('.r3-proposal-machine .r5-porque')),
        porqueText: (document.querySelector('.r3-proposal-machine .r5-porque')?.innerText || '').trim(),
      }));
      if (c05Info.maq !== 'bar') recordFail(failures, `${tag}/C05/maquina`, `C05 tiene "${c05Info.maq}" y C04 tenía "bar"`);
      if (!c05Info.porqueVisible || !c05Info.porqueText) recordFail(failures, `${tag}/C05/porque`, 'falta el porqué visible de la máquina en C05');

      await page.locator('[data-a="accept-prop"]').click();
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C06', null, { timeout: 8000 });
      screens.push('C06');
      const g3 = await readGuide(page);
      if (JSON.stringify(g3.api) !== JSON.stringify({ pasos: ['Tu solución', 'Propuesta', 'Confirmar'], actual: 3 })) {
        recordFail(failures, `${tag}/solucion/C06`, `guía incorrecta: ${JSON.stringify(g3.api)}`);
      }
      const maqC06 = await page.evaluate(() => window.R5?.maquina?.());
      if (maqC06 !== 'bar') recordFail(failures, `${tag}/C06/maquina`, `C06 tiene "${maqC06}" y C04/C05 tenían "bar"`);

      await page.evaluate(() => { location.hash = '#C11'; });
      await page.locator('.r3-machine-grid').waitFor({ state: 'visible', timeout: 8000 });
      const maqC11 = await page.evaluate(() => window.R5?.maquina?.());
      if (maqC11 !== 'bar') recordFail(failures, `${tag}/C11/maquina`, `C11 tiene "${maqC11}" y C04/C05/C06 tenían "bar"`);

      if (screens.join('>') !== 'C04>C05>C06') {
        recordFail(failures, `${tag}/solucion`, `recorrido esperado en 3 pantallas C04>C05>C06, obtenido ${screens.join('>')}`);
      }
      if (pageErrors.length) recordFail(failures, `${tag}/solucion/errores`, pageErrors.join(' | '));
    } finally {
      await ctx.close();
    }
  }

  // 3) Encabezados, alturas y paleta en C02, C10, C04, C05
  {
    const { ctx, page } = await newPage(browser, vp.width, vp.height, vp.touch);
    try {
      for (const route of ['C02', 'C10', 'C04', 'C05']) {
        if (route === 'C05') {
          await page.goto(`${base}/index.html#C04`, { waitUntil: 'domcontentloaded' });
          await fillC04(page, { pickNegocio: 'Restaurante', comuna: 'Las Condes' });
          await page.locator('[data-a="next"]').click();
        } else {
          await page.goto(`${base}/index.html#${route}`, { waitUntil: 'domcontentloaded' });
        }
        await page.waitForFunction((r) => document.body.dataset.current === r && window.__r5Instalado === true, route, { timeout: 8000 });
        await page.waitForTimeout(250);
        await checkHeadingHierarchy(page, '#app', `${tag}/${route}/encabezados`, failures);
        await checkHeightsAndOverflow(page, 2500, 1800, `${tag}/${route}/medidas`, failures);
        await checkPalette(page, '#app', `${tag}/${route}/paleta`, failures);
      }
    } finally {
      await ctx.close();
    }
  }

  // 4) Las 8 landings: encabezados, medidas, paleta, «Arma tu propuesta» -> C04 (sin re-preguntar negocio) -> C05 directo
  for (const l of LANDINGS) {
    const { ctx, page, pageErrors } = await newPage(browser, vp.width, vp.height, vp.touch);
    try {
      await page.goto(`${base}/captacion/landing/${l.slug}.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      await checkHeadingHierarchy(page, 'main', `${tag}/landing/${l.slug}/encabezados`, failures);
      await checkHeightsAndOverflow(page, 3000, 2200, /* 15-nov: con el aire pedido por Carlitos («cero aire»), las landings crecieron ~16 %; tope nuevo 3000/2200 */ `${tag}/landing/${l.slug}/medidas`, failures);
      await checkPalette(page, 'body', `${tag}/landing/${l.slug}/paleta`, failures);

      // Barra fija en landing si visible <= 15% y sin tapar CTA héroe
      const ldBar = await page.evaluate(() => {
        const bar = document.querySelector('.ld-barra');
        if (!bar) return { ok: true };
        const st = getComputedStyle(bar);
        if (st.display === 'none' || st.visibility === 'hidden') return { ok: true };
        const br = bar.getBoundingClientRect();
        if (br.height === 0) return { ok: true };
        return { ok: br.height / window.innerHeight <= 0.15, ratio: br.height / window.innerHeight };
      });
      if (!ldBar.ok) recordFail(failures, `${tag}/landing/${l.slug}/barra`, `.ld-barra ocupa ${(ldBar.ratio * 100).toFixed(1)}% (> 15%)`);

      await page.locator('a[data-cta="hero"]').click();
      await page.waitForFunction(() => /\/index\.html/.test(location.pathname) && (location.hash || '').split('?')[0] === '#C04' && window.__r5Instalado === true, null, { timeout: 10000 });
      await page.locator('.m5-qcard').waitFor({ state: 'visible', timeout: 8000 });

      const negocioReAsked = await page.locator('#r4Datos [data-a="answer"][data-k="negocio"]').count();
      const deducido = await page.evaluate(() => window.R5?.negocioConocido?.(M4.get()) || null);
      if (l.general) {
        // R5 C4 (14-nov): la landing empresas es general (buyer 'general'); C04 pregunta el negocio
        if (negocioReAsked === 0) {
          recordFail(failures, `${tag}/landing/${l.slug}/C04`, `debió preguntar negocio (landing general) y no mostró botones`);
        }
        if (deducido !== null) {
          recordFail(failures, `${tag}/landing/${l.slug}/C04`, `negocio deducido="${deducido}" en landing general (esperado null)`);
        }
      } else {
        if (negocioReAsked !== 0) {
          recordFail(failures, `${tag}/landing/${l.slug}/C04`, `volvió a preguntar negocio (${negocioReAsked} botones) aunque venía mc_landing`);
        }
        if (deducido !== l.buyer && deducido !== l.chip) {
          recordFail(failures, `${tag}/landing/${l.slug}/C04`, `negocio deducido="${deducido}" != esperado "${l.buyer}"`);
        }
      }

      await fillC04(page, { pickNegocio: l.chip, comuna: 'Las Condes' });
      await page.locator('[data-a="next"]').click();
      await page.waitForFunction(() => ['#C05', '#C10'].includes((location.hash || '').split('?')[0]), null, { timeout: 8000 });
      const dest = await currentHash(page);
      if (dest !== '#C05') {
        recordFail(failures, `${tag}/landing/${l.slug}/C05`, `C04 pasó a ${dest} en vez de ir directo a #C05`);
      } else {
        await page.locator('.m5-propsec').waitFor({ state: 'visible' });
        if (!(await page.locator('.r3-proposal-machine .r5-porque').count())) {
          recordFail(failures, `${tag}/landing/${l.slug}/C05`, 'falta .r5-porque en la propuesta');
        }
      }
      if (pageErrors.length) recordFail(failures, `${tag}/landing/${l.slug}/errores`, pageErrors.join(' | '));
    } finally {
      await ctx.close();
    }
  }
}

async function testLateralWidths(browser, base, failures) {
  const portalRoutes = ['C02', 'C10', 'C04', 'C05', 'C06', 'C11', 'C09'];
  for (const w of [360, 390, 414, 768]) {
    const { ctx, page } = await newPage(browser, w, w <= 420 ? 844 : 900, w <= 420);
    try {
      await page.goto(`${base}/index.html#C04`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__r5Instalado === true, null, { timeout: 8000 });
      await fillC04(page, { pickNegocio: 'Restaurante', comuna: 'Las Condes' });
      await page.locator('[data-a="next"]').click();
      await page.waitForFunction(() => document.body.dataset.current === 'C05', null, { timeout: 8000 });
      await page.locator('[data-a="accept-prop"]').click();
      await page.waitForFunction(() => document.body.dataset.current === 'C06', null, { timeout: 8000 });
      for (const r of portalRoutes) {
        await page.evaluate((route) => { location.hash = '#' + route; }, r);
        await page.waitForFunction((route) => document.body.dataset.current === route, r, { timeout: 8000 });
        await page.waitForTimeout(150);
        const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (ov.sw > ov.cw) {
          recordFail(failures, `${w}px/${r}`, `desborde lateral scrollWidth=${ov.sw} > clientWidth=${ov.cw}`);
        }
      }
      for (const l of LANDINGS) {
        await page.goto(`${base}/captacion/landing/${l.slug}.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(150);
        const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (ov.sw > ov.cw) {
          recordFail(failures, `${w}px/landing/${l.slug}`, `desborde lateral scrollWidth=${ov.sw} > clientWidth=${ov.cw}`);
        }
      }
    } finally {
      await ctx.close();
    }
  }
}

async function runDeadClicksTool(base, failures) {
  const tool = path.join(ROOT, '_r5', 'herramientas', 'r5_clics_muertos.cjs');
  if (!fs.existsSync(tool)) {
    recordFail(failures, 'clics-muertos', 'no existe _r5/herramientas/r5_clics_muertos.cjs');
    return;
  }
  const outJson = path.join(OUT_DIR, 'clics-muertos-r5.json');
  try {
    await execFile(process.execPath, [tool, base, outJson], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const data = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    if (data.dead || data.missing || data.errors) {
      recordFail(failures, 'clics-muertos', `dead=${data.dead} missing=${data.missing} errors=${data.errors}`);
    }
  } catch (err) {
    recordFail(failures, 'clics-muertos', `r5_clics_muertos falló: ${err.stdout || err.message}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { server, base } = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const failures = [];
  try {
    await testViewportFlows(browser, base, { width: 390, height: 844, touch: true }, failures);
    await testViewportFlows(browser, base, { width: 1440, height: 900, touch: false }, failures);
    await testLateralWidths(browser, base, failures);
    await runDeadClicksTool(base, failures);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  if (failures.length) {
    console.error(`FAIL (${failures.length} hallazgos):\n` + failures.map((f, i) => `${i + 1}. ${f}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('PASS');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
