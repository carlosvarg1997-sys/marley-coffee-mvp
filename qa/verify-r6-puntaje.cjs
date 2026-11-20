'use strict';

const { useLegacyCrm } = require('./legacy-crm-contract.cjs');
const { completeDiagnostic } = require('./complete-diagnostic.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium: realChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2'
};

function startServer() {
  const srv = http.createServer((req, res) => {
    let pathname = '/';
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, bytes) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}

function browserTargets() {
  const out = [{ name: 'chrome', executablePath: CHROME_PATH }];
  if (fs.existsSync(EDGE_PATH)) out.push({ name: 'edge', executablePath: EDGE_PATH });
  return out;
}

async function measureViewport(page, url, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-r6-peso="volumen"]').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    const sh = document.documentElement.scrollHeight;
    const h1s = Array.from(document.querySelectorAll('h1')).filter((el) => el.offsetParent !== null);
    const badTouch = [];
    document.querySelectorAll('button, input, select, a.m4-nav').forEach((el) => {
      if (el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 42 || r.width < 42) && el.closest('#m4-main')) {
        badTouch.push({ tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    return { sw, cw, sh, overflow: sw > cw, h1Count: h1s.length, h1Text: h1s[0]?.innerText?.trim() || '', badTouch };
  });
}

async function verifyOnBrowser(target, base) {
  const browser = await realChromium.launch({ headless: true, executablePath: target.executablePath, args: ['--disable-gpu'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await useLegacyCrm(ctx);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(base + '/index.html#C01', { waitUntil: 'domcontentloaded' });

    // R6d (14-nov): versión de Carlitos fundamentada por variable
    const cmp = await page.evaluate(() => {
      function runSameClicks(negocio, comuna, volumen) {
        M4.reset();
        M4.saveContact({ name: 'Prueba ' + negocio, email: negocio.toLowerCase().replace(/\s+/g, '') + '@example.cl', consent: true, marketingConsent: false });
        M4.startQuote();
        M4.answer('negocio', negocio);
        M4.confirmStep();
        M4.setComuna(comuna);
        M4.answer('volumen', volumen);
        M4.confirmStep();
        M4.confirmStep();
        const s = M4.get();
        return {
          score: M4.score(s),
          mql: M4.isMQL(s),
          interes: R6P.interes(s),
          valor: R6P.valor(s),
          prioridad: R6P.prioridad(s),
          porqueConMontos: R6P.frasePorque(s, { montos: true }),
          porqueSinMontos: R6P.frasePorque(s, { montos: false }),
          chipSinMontos: R6P.chipValor(s, { montos: false })
        };
      }

      const hotelVit = runSameClicks('Hotel', 'Vitacura', 'De 150 a 400');
      const panRec = runSameClicks('Panadería', 'Recoleta', 'Menos de 50');

      const tazasMap = {
        menor50: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'Menos de 50', puntos: '1 punto' }).partes.tazas.pts,
        entre50y150: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 50 a 150', puntos: '1 punto' }).partes.tazas.pts,
        noLoSe: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'No lo sé', puntos: '1 punto' }).partes.tazas.pts,
        entre150y400: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '1 punto' }).partes.tazas.pts,
        mas400: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'Más de 400', puntos: '1 punto' }).partes.tazas.pts
      };

      const localesMap = {
        uno: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '1 punto' }).partes.locales.pts,
        dosACinco: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '2–5 puntos' }).partes.locales.pts,
        seisAVeinte: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '6–20 puntos' }).partes.locales.pts,
        masVeinte: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: 'Más de 20 puntos' }).partes.locales.pts,
        noLoSe: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: 'No lo sé' }).partes.locales.pts
      };

      // Verificar orden de rubros y orden de zonas respecto al ticket promedio calculado
      const rubroOrden = Object.values(R6P.config.rubroStats || {})
        .filter((r) => !r.sinCuentas)
        .map((r) => ({ rubro: r.rubro, ticket: r.ticketPromedio, pts: r.pts }));
      const zonaOrden = Object.values(R6P.config.zonaStats || {})
        .filter((z) => z.fromAccounts)
        .map((z) => ({ tier: z.tier, ticket: z.ticketPromedio, pts: z.pts }));

      // Caso sin tocar DEFAULTS (lo pre-marcado en Tu negocio no suma interés y marca estimado: true)
      M4.reset();
      M4.saveContact({ name: 'Hotel Default', email: 'hd@example.cl', consent: true, marketingConsent: false });
      M4.startQuote();
      M4.answer('negocio', 'Hotel');
      M4.confirmStep();
      M4.setComuna('Vitacura');
      M4.confirmStep();
      M4.confirmStep();
      const sSinEditar = M4.get();
      const scoreSinEditarSugerido = M4.score(sSinEditar);
      const valSinEditar = R6P.valor(sSinEditar);

      // 25 horas hábiles sin respuesta en Atender normal -> vencido24h: true y orden 0 (va primero)
      const vencido25h = R6P.prioridad({
        negocio: 'Panadería', comuna: 'Recoleta', volumen: 'Menos de 50', puntos: '1 punto',
        actions: ['form1', 'cotizar', 'diag_completo'],
        horasHabilesSinRespuesta: 25
      });
      const hotelAtenderYa = R6P.prioridad({
        negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '1 punto',
        actions: ['form1', 'cotizar', 'diag_completo'],
        horasHabilesSinRespuesta: 1
      });

      const pesosSum = Math.round(Object.values(R6P.config.pesos).reduce((a, b) => a + Number(b || 0), 0) * 100);
      const prospectsCheck = M4D.PROSPECTS.map((p) => {
        const v = R6P.valor(p);
        const partesArr = Object.values(v.partes);
        const sumPartes = partesArr.reduce((acc, pt) => acc + Number(pt.aporte || 0), 0);
        const allUnderMax = partesArr.every((pt) => Number(pt.aporte) <= Number(pt.maxAporte) && Number(pt.aporte) >= 0);
        return {
          id: p.id, volumen: p.volumen, puntos: p.puntos,
          i: R6P.interes(p).puntaje, v: v.puntaje, pScore: p.score,
          sumPartes, diff: Math.abs(sumPartes - v.puntaje), allUnderMax
        };
      });

      return {
        pesosSum, hotelVit, panRec, tazasMap, localesMap, rubroOrden, zonaOrden,
        scoreSinEditarSugerido, valSinEditar,
        vencido25h, hotelAtenderYa, prospectsCheck
      };
    });

    // R6e (14-nov): interacción fundamentada; lead nuevo y antiguo
    assert.equal(cmp.pesosSum, 100, `${target.name}: los pesos base suman 100`);

    // Lead nuevo: interes.partes suma el total y comuna/rubro no suman interés
    const r6eLeadAndCuenta = await page.evaluate(() => {
      const l1 = R6P.interes({ form1: true, cotizar: true, diag_completo: true, diag_personalizado: true, recomendacion: true, expansion: true, portal: true, ejecutivo: true, propuesta: true, comuna: 'Vitacura', negocio: 'Hotel' });
      const l2 = R6P.interes({ form1: true, cotizar: true, diag_completo: true, diag_personalizado: true, recomendacion: true, expansion: true, portal: true, ejecutivo: true, propuesta: true, comuna: 'Recoleta', negocio: 'Panadería' });
      const sumPartesLead = Object.values(l1.partes).reduce((a, p) => a + p.aporte, 0);

      const relPesosSum = Math.round(Object.values(R6P.config.pesosRelacion).reduce((a, b) => a + b, 0) * 100);
      const vrPesosSum = Math.round(Object.values(R6P.config.pesosValorReal).reduce((a, b) => a + b, 0) * 100);

      const accAlDia = R6P.cuenta({ id: 'TEST-DIA', lastAgo: 10, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 9, avg: 400000, margin: 40, cats: 4, comuna: 'Vitacura', incidenciaAbierta: false, servicePaused: false });
      const accAtrasada = R6P.cuenta({ id: 'TEST-ATR', lastAgo: 35, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 9, avg: 400000, margin: 40, cats: 4, comuna: 'Vitacura', incidenciaAbierta: false, servicePaused: false });
      const accSinNps = R6P.cuenta({ id: 'TEST-SNPS', lastAgo: 10, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: null, avg: 400000, margin: 40, cats: 4, comuna: 'Vitacura', incidenciaAbierta: false, servicePaused: false });
      const accIncidencia = R6P.cuenta({ id: 'TEST-INC', lastAgo: 10, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 9, avg: 400000, margin: 40, cats: 4, comuna: 'Vitacura', servicePaused: true });
      const accXss = R6P.cuenta({ id: 'TEST-XSS', lastAgo: 10, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 9, avg: 400000, margin: 40, cats: 4, comuna: 'Vitacura' });
      const chipSinMontos = R6P.chipCuenta({ id: 'AC-103', name: '<script>alert(1)</script>' }, { montos: false });

      const sumRelAlDia = Object.values(accAlDia.relacion.partes).reduce((a, p) => a + p.aporte, 0);
      const sumValAlDia = Object.values(accAlDia.valor.partes).reduce((a, p) => a + p.aporte, 0);
      const sumRelSinNps = Object.values(accSinNps.relacion.partes).reduce((a, p) => a + p.aporte, 0);
      const maxRelSinNps = Object.values(accSinNps.relacion.partes).reduce((a, p) => a + p.maxAporte, 0);
      const realAccChecks = (window.M4D?.ACCOUNTS || []).slice(0, 6).map((a) => {
        const c = R6P.cuenta(a);
        return {
          id: a.id,
          relPts: c.relacion.puntaje,
          relSum: Object.values(c.relacion.partes).reduce((s, p) => s + p.aporte, 0),
          valPts: c.valor.puntaje,
          valSum: Object.values(c.valor.partes).reduce((s, p) => s + p.aporte, 0)
        };
      });

      return {
        l1Puntaje: l1.puntaje,
        l2Puntaje: l2.puntaje,
        sumPartesLead,
        tienePorqueLead: Boolean(l1.porque),
        relPesosSum,
        vrPesosSum,
        accAlDia,
        accAtrasada,
        accSinNps,
        accIncidencia,
        accXssRel: accXss.relacion.puntaje,
        sumRelAlDia,
        sumValAlDia,
        sumRelSinNps,
        maxRelSinNps,
        chipSinMontos,
        realAccChecks
      };
    });

    assert.equal(r6eLeadAndCuenta.l1Puntaje, 100, `${target.name}: 9 señales de interés suman 100 exacto`);
    assert.equal(r6eLeadAndCuenta.l1Puntaje, r6eLeadAndCuenta.l2Puntaje, `${target.name}: comuna y rubro no suman al interés`);
    assert.equal(r6eLeadAndCuenta.sumPartesLead, r6eLeadAndCuenta.l1Puntaje, `${target.name}: interes.partes suma el total`);
    assert.equal(r6eLeadAndCuenta.tienePorqueLead, true, `${target.name}: interes devuelve porque`);
    assert.equal(r6eLeadAndCuenta.relPesosSum, 100, `${target.name}: pesos de Relación suman 100`);
    assert.equal(r6eLeadAndCuenta.vrPesosSum, 100, `${target.name}: pesos de Valor real suman 100`);
    assert.equal(r6eLeadAndCuenta.sumRelAlDia, r6eLeadAndCuenta.accAlDia.relacion.puntaje, `${target.name}: partes de Relación suman total`);
    assert.equal(r6eLeadAndCuenta.sumValAlDia, r6eLeadAndCuenta.accAlDia.valor.puntaje, `${target.name}: partes de Valor real suman total`);
    assert.ok(r6eLeadAndCuenta.accAtrasada.relacion.puntaje < r6eLeadAndCuenta.accAlDia.relacion.puntaje, `${target.name}: cuenta con recompra atrasada (${r6eLeadAndCuenta.accAtrasada.relacion.puntaje}) tiene menos relación que una a tiempo (${r6eLeadAndCuenta.accAlDia.relacion.puntaje})`);
    assert.equal(r6eLeadAndCuenta.accIncidencia.prioridad.texto, 'Servicio primero', `${target.name}: incidencia abierta da Servicio primero`);
    assert.equal(r6eLeadAndCuenta.accIncidencia.prioridad.orden, 0, `${target.name}: Servicio primero va arriba de todo`);
    assert.equal(r6eLeadAndCuenta.accIncidencia.prioridad.pausaPromociones, true, `${target.name}: incidencia abierta pausa promociones`);
    assert.equal(r6eLeadAndCuenta.accIncidencia.relacion.puntaje, r6eLeadAndCuenta.accAlDia.relacion.puntaje, `${target.name}: incidencia abierta NO resta puntos de relación`);
    assert.equal(r6eLeadAndCuenta.accSinNps.relacion.partes.nps.sinDato, true, `${target.name}: sin NPS marca sinDato`);
    assert.equal(r6eLeadAndCuenta.accSinNps.relacion.partes.nps.detalle, 'sin dato', `${target.name}: sin NPS muestra "sin dato"`);
    assert.equal(r6eLeadAndCuenta.maxRelSinNps, 100, `${target.name}: sin NPS reparte peso en proporción hasta 100`);
    assert.equal(r6eLeadAndCuenta.sumRelSinNps, r6eLeadAndCuenta.accSinNps.relacion.puntaje, `${target.name}: partes sin NPS suman total`);
    assert.doesNotMatch(r6eLeadAndCuenta.chipSinMontos, /<script>|\$/, `${target.name}: chipCuenta escapa HTML y oculta montos`);
    for (const acRow of r6eLeadAndCuenta.realAccChecks) {
      assert.equal(acRow.relSum, acRow.relPts, `${target.name}: cuenta real ${acRow.id} suma partes de relación`);
      assert.equal(acRow.valSum, acRow.valPts, `${target.name}: cuenta real ${acRow.id} suma partes de valor real`);
    }
    assert.deepEqual(cmp.tazasMap, { menor50: 26, entre50y150: 43, noLoSe: 39, entre150y400: 71, mas400: 100 }, `${target.name}: fórmula raíz de tazas coincide`);
    assert.deepEqual(cmp.localesMap, { uno: 22, dosACinco: 42, seisAVeinte: 81, masVeinte: 100, noLoSe: 40 }, `${target.name}: fórmula raíz de locales coincide`);

    // Orden de rubros == orden de ticket promedio calculado
    const byTicketR = cmp.rubroOrden.slice().sort((a, b) => b.ticket - a.ticket).map((x) => x.rubro);
    const byPtsR = cmp.rubroOrden.slice().sort((a, b) => b.pts - a.pts || b.ticket - a.ticket).map((x) => x.rubro);
    assert.deepEqual(byPtsR, byTicketR, `${target.name}: orden de rubros sigue ticket promedio calculado`);

    // Orden de zonas == orden de ticket promedio calculado
    const byTicketZ = cmp.zonaOrden.slice().sort((a, b) => b.ticket - a.ticket).map((x) => x.tier);
    const byPtsZ = cmp.zonaOrden.slice().sort((a, b) => b.pts - a.pts || b.ticket - a.ticket).map((x) => x.tier);
    assert.deepEqual(byPtsZ, byTicketZ, `${target.name}: orden de zonas sigue ticket promedio calculado`);

    // Hotel Vitacura (150-400) vs Panadería Recoleta (<50) con mismo interés y los dos MQL
    assert.equal(cmp.hotelVit.score, cmp.panRec.score, `${target.name}: mismos clics producen el mismo interés (${cmp.hotelVit.score} vs ${cmp.panRec.score})`);
    assert.equal(cmp.hotelVit.score, 50, `${target.name}: interés con personalización de tazas debe ser 50 (25 form1 + 10 cotizar + 10 diag + 5 cambio)`);
    assert.equal(cmp.scoreSinEditarSugerido, 45, `${target.name}: lo pre-marcado en Tu negocio y la comuna NO suman interés (25+10+10=45)`);
    assert.equal(cmp.valSinEditar.estimado, true, `${target.name}: lo pre-marcado sin confirmar marca estimado: true`);
    assert.equal(cmp.hotelVit.mql, true, `${target.name}: hotel es MQL`);
    assert.equal(cmp.panRec.mql, true, `${target.name}: panadería es MQL`);
    assert.ok(cmp.hotelVit.valor.puntaje > cmp.panRec.valor.puntaje, `${target.name}: hotel Vitacura (${cmp.hotelVit.valor.puntaje}) vale más que panadería Recoleta (${cmp.panRec.valor.puntaje})`);
    assert.equal(cmp.hotelVit.valor.puntaje, 77, `${target.name}: hotel Vitacura (150-400) = 77/100`);
    assert.equal(cmp.panRec.valor.puntaje, 34, `${target.name}: panadería Recoleta (<50) = 34/100`);
    assert.equal(cmp.hotelVit.prioridad.texto, 'Atender ya', `${target.name}: hotel Vitacura = Atender ya`);
    assert.equal(cmp.panRec.prioridad.texto, 'Atender normal', `${target.name}: panadería Recoleta = Atender normal`);

    // El porqué suma el total y no filtra montos en Marketing
    const hLines = cmp.hotelVit.porqueConMontos.split('\n');
    const hLinesSin = cmp.hotelVit.porqueSinMontos.split('\n');
    assert.equal(hLines.length, 2, `${target.name}: porque con montos tiene 2 líneas`);
    assert.match(hLines[0], /^Valor alto \(77\/100\) = tazas 25 de 35 · rubro 25 de 25 · zona 20 de 20 · locales 2 de 10 · margen 5 de 10$/);
    assert.match(hLines[1], /^Hotel \(ticket promedio del rubro \$[\d.]+\/mes\) · Vitacura, zona A · 150 a 400 tazas\/día$/);
    assert.match(hLinesSin[0], /^Valor alto \(77\/100\) = tazas 25 de 35 · rubro 25 de 25 · zona 20 de 20 · locales 2 de 10 · margen 5 de 10$/);
    assert.doesNotMatch(cmp.hotelVit.porqueSinMontos, /\$\s*\d/, `${target.name}: Marketing no ve montos en $`);
    assert.doesNotMatch(cmp.hotelVit.chipSinMontos, /\$/);

    // Cada parte <= su peso y suma de partes == total (diff <= 1) en los 15 PROSPECTS
    assert.equal(cmp.vencido25h.vencido24h, true, `${target.name}: 25h hábiles marca vencido24h = true`);
    assert.ok(cmp.vencido25h.orden < cmp.hotelAtenderYa.orden, `${target.name}: Atender normal vencido (+24h) se ordena primero que Atender ya`);
    assert.equal(cmp.prospectsCheck.length, 15, `${target.name}: los 15 PROSPECTS están enriquecidos`);
    for (const row of cmp.prospectsCheck) {
      assert.ok(row.volumen && row.puntos, `${target.name}: ${row.id} tiene volumen y puntos`);
      assert.equal(row.i, row.pScore, `${target.name}: ${row.id} score coincide con R6P.interes`);
      assert.ok(Number.isFinite(row.v) && row.v > 0, `${target.name}: ${row.id} tiene valor numérico válido`);
      assert.equal(row.allUnderMax, true, `${target.name}: ${row.id} cada parte vale como máximo su peso`);
      assert.ok(row.diff <= 1, `${target.name}: ${row.id} suma de partes (${row.sumPartes}) difiere <= 1 del total (${row.v})`);
    }

    // 2. R09 Reglas: Jefatura edita pesos (deben sumar 100), margen, persistencia y Restaurar
    await page.evaluate(() => {
      M4.reset();
      M4.saveContact({ name: 'Hotel Pesos', email: 'hp@example.cl', consent: true });
      M4.answer('negocio', 'Hotel');
      M4.setComuna('Vitacura');
      M4.answer('volumen', 'De 150 a 400');
      M4.confirmStep(); M4.confirmStep(); M4.confirmStep();
      M4.setRole('jefatura');
      location.hash = '#R09';
    });
    await page.locator('[data-r6-peso="volumen"]').waitFor({ state: 'visible' });

    const r09Desktop = await measureViewport(page, base + '/index.html#R09', 1440, 900);
    const r09Compact = await measureViewport(page, base + '/index.html#R09', 1280, 551);
    assert.equal(r09Compact.overflow, false, `${target.name}: R09 sin desborde a 1280×551`);
    assert.ok(r09Compact.sh <= 1800, `${target.name}: R09 alto a 1280×551`);
    assert.deepEqual(r09Compact.badTouch, [], `${target.name}: R09 controles de 42 px a 1280×551`);
    assert.equal(r09Desktop.overflow, false, `${target.name}: R09 sin desborde en 1440`);
    assert.ok(r09Desktop.sh <= 1800, `${target.name}: R09 alto 1440 (${r09Desktop.sh}px) <= 1800`);
    assert.equal(r09Desktop.h1Count, 1, `${target.name}: R09 tiene 1 solo H1 visible`);
    assert.deepEqual(r09Desktop.badTouch, [], `${target.name}: R09 en 1440 tiene todos los controles >= 42px`);

    for (const w of [360, 390, 414, 768]) {
      const m = await measureViewport(page, base + '/index.html#R09', w, 844);
      assert.equal(m.overflow, false, `${target.name}: R09 sin desborde en ${w}px`);
      if (w === 390) assert.ok(m.sh <= 2500, `${target.name}: R09 alto 390 (${m.sh}px) <= 2500`);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/index.html#R09', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-r6-peso="volumen"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-r6-prev-hotel]').innerText(), '77/100');

    // Pesos que NO suman 100 muestran aviso y NO se guardan
    await page.locator('[data-r6-peso="volumen"]').fill('50');
    await page.locator('[data-r6-peso="volumen"]').dispatchEvent('change');
    const badPesoCheck = await page.evaluate(() => ({
      avisoVisible: !document.querySelector('[data-r6-peso-aviso]').hidden,
      avisoTxt: document.querySelector('[data-r6-peso-aviso]').textContent,
      savedVolPeso: R6P.config.pesos.volumen,
      hotelVal: R6P.valor({ negocio: 'Hotel', comuna: 'Vitacura', volumen: 'De 150 a 400', puntos: '1 punto' }).puntaje
    }));
    assert.equal(badPesoCheck.avisoVisible, true, `${target.name}: pesos != 100 muestran aviso`);
    assert.match(badPesoCheck.avisoTxt, /115 %.*100 %/);
    assert.equal(badPesoCheck.savedVolPeso, 0.35, `${target.name}: pesos != 100 NO se guardan`);
    assert.equal(badPesoCheck.hotelVal, 77, `${target.name}: total no cambia mientras pesos != 100`);

    // Ajustar zona de 20 a 5 para cuadrar 100 (50+25+5+10+10=100) -> SÍ se guarda y cambia el total (77 -> 73)
    await page.locator('[data-r6-peso="zona"]').fill('5');
    await page.locator('[data-r6-peso="zona"]').dispatchEvent('change');
    const goodPesoCheck = await page.evaluate(() => ({
      avisoHidden: document.querySelector('[data-r6-peso-aviso]').hidden,
      savedVolPeso: R6P.config.pesos.volumen,
      savedZonaPeso: R6P.config.pesos.zona,
      prevHotel: document.querySelector('[data-r6-prev-hotel]').innerText
    }));
    assert.equal(goodPesoCheck.avisoHidden, true, `${target.name}: al cuadrar 100 desaparece el aviso`);
    assert.equal(goodPesoCheck.savedVolPeso, 0.50);
    assert.equal(goodPesoCheck.savedZonaPeso, 0.05);
    assert.equal(goodPesoCheck.prevHotel, '73/100', `${target.name}: cambiar peso válido en R09 cambia el total`);

    // Recarga conserva reglas válidas
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => R6P.valor(M4.get()).puntaje), 73, `${target.name}: pesos válidos se conservan al recargar`);

    // Editar margen de Hotel de 35 % a 70 % con pesos actuales (margen 10 %) -> sube 5 pts (73 -> 78)
    await page.locator('[data-r6-margen-rubro="Hotel"]').fill('70');
    await page.locator('[data-r6-margen-rubro="Hotel"]').dispatchEvent('change');
    assert.equal(await page.locator('[data-r6-prev-hotel]').innerText(), '78/100', `${target.name}: editar margen recalcula en vivo`);

    // Ventas y Marketing ven R09 sin editar
    for (const roRole of ['ventas', 'marketing']) {
      await page.evaluate((r) => { M4.setRole(r); if (window.MarleyApp?.go) MarleyApp.go('R09'); else location.hash = '#R09'; }, roRole);
      await page.locator('.r6-r09-ro').first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('#m4-main input[data-r6-peso], #m4-main input[data-r6-peso-relacion], #m4-main input[data-r6-peso-valor-real], #m4-main input[data-r6-margen-rubro], #m4-main input[data-r6-umbral], #m4-main input[data-r6-umbral-cuenta]').count(), 0, `${target.name}: ${roRole} ve R09 solo lectura`);
    }

    // Jefatura: verificar encabezados R09, edición de pesos de Relación y Valor real, y Restaurar
    await page.evaluate(() => { M4.setRole('jefatura'); if (window.MarleyApp?.go) MarleyApp.go('R09'); else location.hash = '#R09'; });
    await page.locator('[data-r6-restaurar]').waitFor({ state: 'visible' });
    const r09Headings = await page.evaluate(() => ({
      h1: Array.from(document.querySelectorAll('h1')).filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim()),
      h2: Array.from(document.querySelectorAll('#m4-main h2')).map((el) => el.textContent.trim()),
      h3: Array.from(document.querySelectorAll('#m4-main h3')).map((el) => el.textContent.trim())
    }));
    assert.deepEqual(r09Headings.h1, ['Reglas'], `${target.name}: R09 tiene 1 H1 "Reglas"`);
    assert.deepEqual(r09Headings.h2, ['¿Cómo se prioriza un lead nuevo?', '¿Cómo se prioriza un cliente con compras?'], `${target.name}: R09 tiene los 2 H2 requeridos`);
    assert.equal(r09Headings.h3.length, 4, `${target.name}: R09 tiene un H3 por cada eje`);

    // Pesos de Relación que no suman 100 NO se guardan
    await page.locator('[data-r6-peso-relacion="recompraTiempo"]').fill('50');
    await page.locator('[data-r6-peso-relacion="recompraTiempo"]').dispatchEvent('change');
    const badRelCheck = await page.evaluate(() => ({
      avisoVisible: !document.querySelector('[data-r6-peso-aviso-relacion]').hidden,
      savedPeso: R6P.config.pesosRelacion.recompraTiempo
    }));
    assert.equal(badRelCheck.avisoVisible, true, `${target.name}: pesos Relación != 100 muestran aviso`);
    assert.equal(badRelCheck.savedPeso, 0.35, `${target.name}: pesos Relación != 100 NO se guardan`);

    // Cuadrar 100 en Relación (recompraTiempo 50, nps 0) -> SÍ guarda y recalcula
    const relBefore = await page.evaluate(() => R6P.cuenta({ lastAgo: 40, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 10 }).relacion.puntaje);
    await page.locator('[data-r6-peso-relacion="nps"]').fill('0');
    await page.locator('[data-r6-peso-relacion="nps"]').dispatchEvent('change');
    const relAfter = await page.evaluate(() => R6P.cuenta({ lastAgo: 40, freqDays: 20, recompraDigital: true, recordatorios: 100, referrals: 1, npsScore: 10 }).relacion.puntaje);
    assert.equal(await page.evaluate(() => document.querySelector('[data-r6-peso-aviso-relacion]').hidden), true, `${target.name}: al cuadrar 100 en Relación desaparece aviso`);
    assert.notEqual(relAfter, relBefore, `${target.name}: cambiar peso válido de Relación en R09 recalcula`);

    // Pesos de Valor real que no suman 100 NO se guardan, y al cuadrar recalcula
    await page.locator('[data-r6-peso-valor-real="ticket"]').fill('45');
    await page.locator('[data-r6-peso-valor-real="ticket"]').dispatchEvent('change');
    assert.equal(await page.evaluate(() => !document.querySelector('[data-r6-peso-aviso-valor-real]').hidden), true, `${target.name}: pesos Valor real != 100 muestran aviso`);
    assert.equal(await page.evaluate(() => R6P.config.pesosValorReal.ticket), 0.30, `${target.name}: pesos Valor real != 100 NO se guardan`);

    await page.locator('[data-r6-restaurar]').click();
    assert.equal(await page.locator('[data-r6-prev-hotel]').innerText(), '77/100', `${target.name}: Restaurar devuelve hotel a 77/100`);
    assert.equal(await page.evaluate(() => R6P.config.pesosRelacion.recompraTiempo), 0.35, `${target.name}: Restaurar devuelve pesos Relación base`);

    // 3. C04 conserva puntos de café en ambos caminos, como pregunta independiente para Oficinas.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const camino of ['productos', 'solucion']) {
      await page.evaluate((cam) => {
        M4.reset();
        localStorage.removeItem('mc_landing_lead_v1');
        M4.saveContact({ name: 'Hotel C04', email: 'hc04@example.cl', consent: true });
        M4.answer('negocio', 'OCS');
        M4.update((s) => {
          s.answers.negocio = 'OCS';
          s.catalogJourney = cam === 'solucion'
            ? { machine: 'orientacion', machineSource: 'diagnostico', productsSkipped: true }
            : { machine: 'bar', machineSource: 'cliente', cart: [{ id: 'grano', qty: 1 }] };
        });
        location.hash = '#C04';
      }, camino);
      await page.locator('#r4Datos').waitFor({ state: 'visible' });
      await completeDiagnostic(page, { business: 'Oficinas', stopAt: 'puntos' });
      const point = page.locator('#r4Datos [data-k="puntos"][data-v="1 punto"]');
      if (await point.getAttribute('aria-pressed') !== 'true') await point.click();
      await page.locator('#r4Datos [data-k="puntos"][data-v="1 punto"][aria-pressed="true"]').waitFor({ state:'visible' });
      const c04Check = await page.evaluate(() => {
        const puntosBtns = Array.from(document.querySelectorAll('#r4Datos [data-k="puntos"]'));
        const onePoint = document.querySelector('#r4Datos [data-k="puntos"][data-v="1 punto"]');
        return {
          puntosCount: puntosBtns.length,
          activeQuestionGroups: new Set([...document.querySelectorAll('#r4Datos [data-a="answer"]')].map(el => el.dataset.k)).size,
          onePointPressed: onePoint ? onePoint.getAttribute('aria-pressed') : null,
          sh: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });
      assert.ok(c04Check.puntosCount >= 5, `${target.name}: C04 (${camino}) muestra opciones de puntos de café`);
      assert.equal(c04Check.activeQuestionGroups, 1, `${target.name}: C04 (${camino}) muestra solo la pregunta de locales`);
      assert.equal(c04Check.onePointPressed, 'true', `${target.name}: C04 (${camino}) guarda la selección «1 punto»`);
      assert.equal(c04Check.overflow, false, `${target.name}: C04 (${camino}) sin desborde a 390px`);
      assert.ok(c04Check.sh <= 2500, `${target.name}: C04 (${camino}) alto 390 (${c04Check.sh}px) <= 2500px`);
    }

    assert.deepEqual(pageErrors, [], `${target.name}: sin errores JS en ejecución`);
    return { browser: target.name, status: 'PASS', r09DesktopH: r09Desktop.sh };
  } finally {
    await browser.close();
  }
}

async function main() {
  const { srv, base } = process.argv[2] ? { base: process.argv[2].replace(/\/$/, '') } : await startServer();
  try {
    const targets = browserTargets();
    const results = [];
    for (const t of targets) {
      results.push(await verifyOnBrowser(t, base));
    }
    console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
  } finally {
    if (srv) srv.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
