'use strict';

// Comprobación real del puente sobre un único origen HTTP local. Usa solo datos ficticios.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');
const { completeDiagnostic } = require('./complete-diagnostic.cjs');

const root = path.resolve(__dirname, '..');
const evidence = process.env.W10_VERIFY_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'marley-w10-'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  });
});

async function context(browser, width, init) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 400 ? 844 : width === 1280 ? 551 : 900 }, reducedMotion: 'reduce' });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { ctx, page, errors };
}

// R5 (14-nov): en R5 el formulario de las landings va dentro de #ld-form-disclosure (plegado); abrirlo antes de completar el formulario.
async function openLandingForm(page) {
  const disc = page.locator('#ld-form-disclosure');
  if (await disc.count() && (await disc.getAttribute('open')) === null) {
    await page.locator('#ld-form-disclosure > summary').click();
  }
}

async function completeLanding(page, base, { marketing = false, touched = false, email = 'camila.rojas@example.com', company = 'Restaurante Los Aromos' } = {}) {
  await page.goto(base + '/captacion/landing/restaurantes.html?utm_source=google&utm_medium=cpc&utm_campaign=prueba&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_query_id=2&mc_surface=resultado-organico&mc_first_click_ms=1200&mc_first_click_surface=resultado-organico', { waitUntil: 'domcontentloaded' });
  if (touched) await page.locator('#c-base').evaluate((el) => { el.value = '120'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await openLandingForm(page);
  await page.locator('#f-nombre').fill('Camila Rojas');
  await page.locator('#f-correo').fill(email);
  await page.locator('#f-consent').check();
  if (marketing) await page.locator('#f-marketing').check();
  await page.locator('fieldset[data-paso="1"] button[type="submit"]').click();
  await page.locator('#f-empresa').fill(company);
  await page.locator('#f-telefono').fill('912345678');
  await page.locator('[data-accion="enviar"]').click();
  await page.locator('#ld-exito').waitFor({ state: 'visible' });
  return page.evaluate(() => ({ lead: JSON.parse(localStorage.getItem('mc_landing_lead_v1')), href: document.querySelector('#ld-continuar').href, draft: localStorage.getItem('mc_landing_draft_v1'), sessionLead: sessionStorage.getItem('mc_landing_lead_v1'), localEvents: localStorage.getItem('mc_landing_events_v1'), sessionEvents: JSON.parse(sessionStorage.getItem('mc_landing_events_v1')) }));
}

async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const input = process.argv[2];
  if (!input) await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = input ? input.replace(/\/$/, '') : 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const results = [];
  try {
    for (const width of [320, 390, 1280, 1440]) {
      const { ctx, page, errors } = await context(browser, width);
      await page.goto(base + '/captacion/landing/hoteles.html?utm_source=linkedin&utm_medium=paid_social&utm_campaign=primer-origen', { waitUntil: 'domcontentloaded' });
      const entry = await completeLanding(page, base, { marketing: true, touched: true });
      assert.match(entry.lead.id, /^[a-zA-Z0-9-]{8,100}$/);
      assert.equal(entry.lead.calc.tocado, true);
      assert.equal(entry.lead.calc.tazasDia, 120);
      assert.equal(entry.draft, null);
      assert.equal(entry.sessionLead, null);
      assert.equal(entry.localEvents, null);
      assert.ok(entry.sessionEvents.some((event) => event.event === 'lead_created'));
      const url = new URL(entry.href);
      assert.equal(url.searchParams.get('mc_handoff'), entry.lead.id);
      assert.equal(url.searchParams.get('mc_landing'), 'restaurante');
      assert.doesNotMatch(entry.href, /camila\.rojas|Los%20Aromos|912345678/i);
      assert.equal(entry.lead.firstTouch.params.utm_source, 'linkedin');
      assert.equal(entry.lead.lastTouch.params.utm_source, 'google');
      await page.locator('#ld-continuar').click();
      // R6e (14-nov): esperar carga completa del documento para asegurar ejecución de R6P antes de leer M4.score()
      await page.waitForFunction(() => document.readyState !== 'loading' && (location.hash || '').split('?')[0] === '#C04');
      await page.locator('.m5-qcard').waitFor({ state: 'visible' });
      const received = await page.evaluate(() => {
        const s = M4.get();
        return { score: M4.score(), lead: s.lead, events: s.events, emails: s.emails.length, agents: s.agents.length, focus: M4.landingFocus('C04'), menu: Boolean(document.querySelector('.m5-nav, .ux-mobile-nav')), screen: document.body.dataset.current, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, localEvents: localStorage.getItem('mc_landing_events_v1'), sessionEvents: Boolean(sessionStorage.getItem('mc_landing_events_v1')) };
      });
      // R6 (14-nov): la comuna pasó del interés al valor esperado (decisión de Carlitos); form1 pasa a 25 pts.
      assert.equal(received.score, 25);
      assert.equal(received.events.filter((event) => event.key === 'form1').length, 1);
      assert.equal(received.lead.company, 'Restaurante Los Aromos');
      assert.equal(received.lead.marketingConsent, true);
      assert.equal(received.lead.landing.buyerLabel, 'Restaurante');
      assert.equal(received.lead.landing.calc.tazasDia, 120);
      assert.equal(received.lead.attribution.firstTouch.params.utm_source, 'linkedin');
      assert.equal(received.lead.attribution.lastTouch.params.utm_source, 'google');
      assert.equal(received.lead.attribution.sessionId, 'SERP-1');
      assert.equal(received.lead.attribution.entrySurface, 'resultado-organico');
      assert.equal(received.focus, true);
      assert.equal(received.menu, false);
      const fuera = received.overflow ? await page.evaluate(() => {
        const ancho = document.documentElement.clientWidth;
        return [...document.querySelectorAll('#app *')].flatMap(e => {
          const r = e.getBoundingClientRect();
          return r.width && (r.right > ancho + 1 || r.left < -1) ? [`${e.tagName}.${String(e.className).slice(0, 65)} (${Math.round(r.left)}–${Math.round(r.right)})`] : [];
        }).slice(0, 10);
      }) : [];
      assert.equal(received.overflow, false, `Desborde en ${width}px: ${fuera.join(', ')}`);
      assert.equal(received.localEvents, null);
      assert.equal(received.sessionEvents, true);
      await page.screenshot({ path: path.join(evidence, `W10_C04_${width}.jpg`), type: 'jpeg', quality: 80 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.m5-qcard').waitFor({ state: 'visible' });
      const again = await page.evaluate(() => ({ score: M4.score(), events: M4.get().events.filter((e) => e.key === 'form1').length, emails: M4.get().emails.length, agents: M4.get().agents.length, focus: M4.landingFocus('C04') }));
      // R6 (14-nov): la comuna pasó del interés al valor esperado (decisión de Carlitos); form1 suma 25.
      assert.deepEqual(again, { score: 25, events: 1, emails: received.emails, agents: received.agents, focus: true });
      await page.evaluate(() => { M4.saveContact({ name: M4.get().lead.name, email: M4.get().lead.email, consent: true, marketingConsent: false }); });
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => M4.get().lead.marketingConsent), false);
      assert.equal(await page.evaluate(() => M4.score()), 25);
      await page.evaluate(() => { location.hash = '#C03'; });
      await page.locator('#m4Contact').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => M4.landingFocus('C03')), true);
      assert.equal(await page.locator('.m5-nav, .ux-mobile-nav').count(), 0);
      await page.evaluate(() => { location.hash = '#C04'; });
      await page.locator('.m5-qcard').waitFor({ state: 'visible' });
      // R4 (13-nov): «Tu negocio» en una pantalla. El negocio ya viene de la landing y no se vuelve a preguntar; solo falta la comuna.
      assert.equal(await page.locator('#r4Datos [data-a="answer"][data-k="negocio"]').count(), 0, 'C04 no vuelve a preguntar el negocio que trae la landing');
      await page.locator('#m5Comuna').selectOption({ label: 'Las Condes' });
      const maqC04 = await page.evaluate(() => window.R5?.maquina?.() || null); // coordinador (14-nov): clave de la máquina
      await completeDiagnostic(page);
      // R5 (14-nov): desde la landing («Calcula tu solución») C04 pasa directo a la propuesta C05, sin pasar por C10.
      await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C05');
      await page.locator('#pack-resumen').waitFor({ state: 'visible' });
      const propR5 = await page.evaluate(() => ({
        maqC05: window.R5?.maquina?.() || null,
        porqueVisible: Boolean(document.querySelector('.cmp-maquina .cmp-motivo')?.textContent.trim()),
      }));
      assert.equal(propR5.porqueVisible, true, 'R5: C05 muestra el porqué de la máquina');
      if (maqC04) assert.equal(propR5.maqC05, maqC04, 'R5: la máquina en C05 coincide con C04');
      assert.equal(await page.evaluate(() => M4.landingFocus('C05')), true);
      assert.equal(await page.locator('.m5-nav, .ux-mobile-nav').count(), 0);
      await page.screenshot({ path: path.join(evidence, `W10_C05_${width}.jpg`), type: 'jpeg', quality: 80 });
      await page.evaluate(() => { M4.setRole('ventas'); M4.select(M4.get().lead.id); location.hash = '#R04'; });
      const origin = page.locator('#crm-v2-root [data-crm2-landing-context]');
      await origin.locator('summary').click();
      assert.match(await origin.innerText(), /120 tazas al día/);
      assert.match(await origin.innerText(), /linkedin/i);
      assert.match(await origin.innerText(), /google/i);
      await page.screenshot({ path: path.join(evidence, `W10_CRM_${width}.jpg`), type: 'jpeg', quality: 80 });
      await page.evaluate(() => { location.hash = '#C02'; });
      await page.locator('.m5-nav').waitFor({ state: 'attached' });
      assert.equal(await page.evaluate(() => M4.landingFocus('C02')), false);
      assert.equal(await page.locator('.m5-nav').count(), 1);
      assert.deepEqual(errors, []);
      results.push({ width, handoff: 'PASS', reload: 'PASS', consent: 'PASS', crm: 'PASS', overflow: false });
      await ctx.close();
    }

    // Los datos por defecto de la calculadora no son una respuesta del participante.
    {
      const { ctx, page } = await context(browser, 390);
      const entry = await completeLanding(page, base);
      assert.equal(entry.lead.calc.tocado, false);
      await page.locator('#ld-continuar').click();
      // R6e (14-nov): esperar carga completa del documento y bloque C04 antes de leer M4.score()
      await page.waitForFunction(() => document.readyState !== 'loading' && (location.hash || '').split('?')[0] === '#C04');
      await page.locator('.m5-qcard').waitFor({ state: 'visible' });
      const info = await page.evaluate(() => ({ calc: M4.get().lead.landing.calc, answers: M4.get().answers, score: M4.score() }));
      assert.deepEqual(info.calc, { tocado: false });
      assert.equal(info.answers.volumen, undefined);
      // R6 (14-nov): la comuna pasó del interés al valor esperado (decisión de Carlitos); form1 suma 25.
      assert.equal(info.score, 25);
      await page.evaluate(() => M4.reset());
      const cleared = await page.evaluate(() => ({ lead: localStorage.getItem('mc_landing_lead_v1'), draft: localStorage.getItem('mc_landing_draft_v1'), first: localStorage.getItem('mc_first_touch_v1'), focus: sessionStorage.getItem('mc_landing_focus_v1'), events: sessionStorage.getItem('mc_landing_events_v1'), score: M4.score() }));
      assert.deepEqual(cleared, { lead: null, draft: null, first: null, focus: null, events: null, score: 0 });
      results.push({ defaultCalculator: 'not treated as answer', reset: 'PASS' });
      await ctx.close();
    }

    // Un formulario parcial, vencido o manipulado nunca desbloquea el diagnóstico.
    {
      const { ctx, page } = await context(browser, 390);
      await page.goto(base + '/index.html#C01', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('mc_landing_draft_v1', JSON.stringify({ v: 1, name: 'Camila Rojas', email: 'camila.rojas@example.com', consent: true })); });
      await page.goto(base + '/index.html?mc_handoff=draft-123456&mc_landing=restaurante#C04', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'No pudimos continuar' }).waitFor();
      assert.equal(await page.evaluate(() => M4.get().lead), null);
      assert.equal(await page.evaluate(() => M4.score()), 0);
      results.push({ partialDraft: 'blocked' });
      await ctx.close();
    }

    // Una solicitud nueva nunca sustituye otra cuenta ya guardada en este navegador.
    {
      const { ctx, page } = await context(browser, 390);
      await page.goto(base + '/index.html#C01', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { M4.saveContact({ name: 'Diego Paredes', email: 'diego.paredes@example.com', consent: true, marketingConsent: false }); M4.update((s) => { s.lead.company = 'Cafetería Patio Sur'; }); });
      await completeLanding(page, base);
      await page.locator('#ld-continuar').click();
      await page.getByText('Ya existe otra solicitud guardada en este navegador.', { exact: false }).waitFor();
      const kept = await page.evaluate(() => ({ email: M4.get().lead.email, company: M4.get().lead.company, score: M4.score(), pending: Boolean(localStorage.getItem('mc_landing_lead_v1')) }));
      // R6 (14-nov): la comuna pasó del interés al valor esperado (decisión de Carlitos); form1 suma 25.
      assert.deepEqual(kept, { email: 'diego.paredes@example.com', company: 'Cafetería Patio Sur', score: 25, pending: true });
      results.push({ existingAccount: 'preserved' });
      await ctx.close();
    }

    // Si el almacenamiento falla, no se presenta una confirmación falsa y se puede reintentar.
    {
      const init = () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage && sessionStorage.getItem('w10_fail_key') === key) throw new DOMException('Sin espacio', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      };
      const { ctx, page } = await context(browser, 390, init);
      await page.goto(base + '/captacion/landing/restaurantes.html', { waitUntil: 'domcontentloaded' });
      await openLandingForm(page);
      await page.locator('#f-nombre').fill('Camila Rojas');
      await page.locator('#f-correo').fill('camila.rojas@example.com');
      await page.locator('#f-consent').check();
      await page.evaluate(() => sessionStorage.setItem('w10_fail_key', 'mc_landing_draft_v1'));
      await page.locator('fieldset[data-paso="1"] button[type="submit"]').click();
      await page.getByRole('alert').filter({ hasText: 'No pudimos guardar tu avance' }).waitFor();
      assert.equal(await page.locator('#ld-form').getAttribute('data-paso'), '1');
      await page.evaluate(() => sessionStorage.removeItem('w10_fail_key'));
      await page.locator('fieldset[data-paso="1"] button[type="submit"]').click();
      await page.locator('#f-empresa').fill('Restaurante Los Aromos');
      await page.locator('#f-telefono').fill('912345678');
      await page.evaluate(() => sessionStorage.setItem('w10_fail_key', 'mc_landing_lead_v1'));
      await page.locator('[data-accion="enviar"]').click();
      await page.getByRole('alert').filter({ hasText: 'No pudimos confirmar y guardar tu solicitud' }).waitFor();
      assert.equal(await page.locator('#ld-exito').isVisible(), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('mc_landing_lead_v1')), null);
      assert.ok(await page.evaluate(() => localStorage.getItem('mc_landing_draft_v1')));
      await page.evaluate(() => sessionStorage.removeItem('w10_fail_key'));
      await page.locator('[data-accion="enviar"]').click();
      await page.locator('#ld-exito').waitFor({ state: 'visible' });
      await page.evaluate(() => sessionStorage.setItem('w10_fail_key', 'marleyMVP:v7:prototype'));
      await page.locator('#ld-continuar').click();
      await page.getByText('El navegador no pudo guardar tu avance.', { exact: false }).waitFor();
      assert.equal(await page.evaluate(() => M4.get().lead), null);
      assert.equal(await page.evaluate(() => M4.score()), 0);
      await page.evaluate(() => sessionStorage.removeItem('w10_fail_key'));
      await page.getByRole('button', { name: 'Reintentar' }).click();
      await page.locator('.m5-qcard').waitFor({ state: 'visible' });
      // R6 (14-nov): la comuna pasó del interés al valor esperado (decisión de Carlitos); form1 suma 25.
      assert.equal(await page.evaluate(() => M4.score()), 25);
      results.push({ storageFailure: 'blocked and recovered' });
      await ctx.close();
    }

    // QA sigue disponible a moderación y se oculta a participantes con test o recorrido activo.
    {
      const { ctx, page } = await context(browser, 390);
      for (const [query, hidden] of [['?qa=1', false], ['?qa=1&test=sitio', true], ['?qa=1&journey=resume', true]]) {
        await page.goto(base + '/captacion/landing/restaurantes.html' + query, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('#ld-qa').isHidden(), hidden, query);
      }
      results.push({ qaControls: 'moderator only' });
      await ctx.close();
    }
    process.stdout.write(JSON.stringify({ status: 'PASS', origin: 'HTTP local', results, evidence }, null, 2) + '\n');
  } finally { await browser.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
main().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
