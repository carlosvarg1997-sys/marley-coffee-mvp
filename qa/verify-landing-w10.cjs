'use strict';

// DS7 · Puente de las 8 landings por intención con el MISMO inicio del MVP (C02).
//
// La landing conserva su <head> (title, description, canonical, Open Graph y JSON-LD: su SEO)
// y su cuerpo es solo el respaldo <noscript> (un H1 con la intención, un párrafo corto y un
// enlace «Ver la propuesta para tu …») más el salto a ../../index.html con todos los parámetros
// de la URL y landing=<slug> (#C02). En el inicio solo cambian la frase de intención y el negocio
// marcado: el resto de las secciones, el H1 y los CTA son los mismos.
//
// Comprueba el puente sobre un único origen HTTP local y con datos ficticios.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');
const { completeDiagnostic, completePack } = require('./complete-diagnostic.cjs');

const root = path.resolve(__dirname, '..');
const evidence = process.env.W10_VERIFY_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'marley-w10-'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
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

const oferta = JSON.parse(fs.readFileSync(path.join(root, 'recursos/datos/oferta_por_buyer.json'), 'utf8'));
const LANDINGS = [
  { slug: 'restaurantes', negocio: 'Restaurante', marcado: 'Restaurante', articulo: 'tu restaurante' },
  { slug: 'hoteles', negocio: 'Hotel', marcado: 'Hotel', articulo: 'tu hotel' },
  { slug: 'cafeterias', negocio: 'Cafetería', marcado: 'Cafetería', articulo: 'tu cafetería' },
  { slug: 'oficinas', negocio: 'OCS', marcado: 'Oficinas', articulo: 'tu oficina' },
  { slug: 'panaderias', negocio: 'Panadería', marcado: 'Panadería', articulo: 'tu panadería' },
  { slug: 'conveniencia', negocio: 'Conveniencia', marcado: 'Conveniencia', articulo: 'tu tienda de conveniencia' },
  { slug: 'eventos-catering', negocio: 'Eventos o catering', marcado: 'Eventos', articulo: 'tu evento' },
  // La landing de empresas es general: no marca negocio y C04 lo pregunta.
  { slug: 'empresas', negocio: null, marcado: null, articulo: 'tu negocio' },
];
// Parámetros de campaña y de la prueba autoguiada: no se puede perder ninguno.
const PARAMS = '?utm_source=google&utm_medium=cpc&utm_campaign=prueba&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_query_id=2&mc_surface=resultado-organico&mc_first_click_ms=1200&mc_first_click_surface=resultado-organico&test=personas&camino=B-Google&participante=P1&pid=P1&journey=full&journey_started_at=1795736000000';

async function context(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 400 ? 844 : width === 1280 ? 551 : 900 }, reducedMotion: 'reduce' });
  return { ctx, page: await ctx.newPage() };
}

const leerInicio = () => {
  const main = document.querySelector('#app main');
  return {
    h1: document.querySelector('#ux-hero-title')?.textContent.trim() || '',
    hero: document.querySelector('.ux-hero-copy p')?.textContent.trim() || '',
    pressed: [...document.querySelectorAll('.m5-tab[aria-pressed="true"]')].map((b) => b.textContent.trim()),
    maquinas: document.querySelectorAll('#condiciones .cmp-home-maquina').length,
    t1: [...document.querySelectorAll('[data-cierra-tarea="T1"]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
    secciones: main ? [...main.querySelectorAll(':scope > section')].map((s) => s.id || String(s.className).split(' ')[0]) : [],
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
};
const estructura = (s) => JSON.stringify({ secciones: s.secciones, t1: s.t1, h1: s.h1, maquinas: s.maquinas });

async function esperarInicio(page) {
  await page.waitForFunction(() => /\/index\.html$/.test(location.pathname) && (location.hash || '').split('?')[0] === '#C02' && document.body.dataset.current === 'C02' && window.__r5Instalado === true, null, { timeout: 20000 });
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
      // Canon: el inicio sin landing. Todas las landings deben mostrar exactamente lo mismo.
      const canonCtx = await context(browser, width);
      await canonCtx.page.goto(base + '/index.html#C02', { waitUntil: 'domcontentloaded' });
      await esperarInicio(canonCtx.page);
      const canon = await canonCtx.page.evaluate(leerInicio);
      await canonCtx.ctx.close();

      const comunes = [];
      for (const l of LANDINGS) {
        const { ctx, page } = await context(browser, width);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          // a) Respaldo: <head> de SEO intacto, un H1 con la intención y un único enlace al inicio.
          const fuente = fs.readFileSync(path.join(root, 'captacion/landing', `${l.slug}.html`), 'utf8');
          const crudo = await page.evaluate((html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return {
              title: doc.title,
              description: doc.querySelector('meta[name="description"]')?.content || '',
              ld: doc.querySelectorAll('script[type="application/ld+json"]').length,
              h1: [...doc.querySelectorAll('h1')].map((h) => h.textContent.trim()),
              enlaces: [...doc.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim() })),
              imagenes: doc.querySelectorAll('img').length,
            };
          }, fuente).catch(() => null);
          assert.ok(crudo, `${l.slug}: no se pudo leer la landing`);
          assert.ok(crudo.title && crudo.description && crudo.ld === 1, `${l.slug}: el <head> perdió su SEO`);
          assert.equal(crudo.h1.length, 1, `${l.slug}: un solo H1 de respaldo`);
          assert.match(crudo.h1[0], /[a-záéíóúñ]/i, `${l.slug}: el H1 conserva la frase de intención`);
          assert.deepEqual(crudo.enlaces, [{ href: `../../index.html?landing=${l.slug}#C02`, texto: `Ver la propuesta para ${l.articulo}` }], `${l.slug}: enlace de respaldo`);
          assert.equal(crudo.imagenes, 0, `${l.slug}: sin el diseño viejo`);

          // b) El salto conserva todos los parámetros y llega al mismo inicio (C02).
          await page.goto(`${base}/captacion/landing/${l.slug}.html${PARAMS}`, { waitUntil: 'domcontentloaded' });
          await esperarInicio(page);
          const destino = new URL(await page.evaluate(() => location.href));
          const antes = new URLSearchParams(PARAMS);
          for (const [clave, valor] of antes) assert.equal(destino.searchParams.get(clave), valor, `${l.slug}: se perdió ${clave}`);
          assert.equal(destino.searchParams.get('landing'), l.slug, `${l.slug}: landing en la URL`);
          assert.deepEqual([...destino.searchParams.keys()].sort(), [...antes.keys(), 'landing'].sort(), `${l.slug}: parámetros exactos`);
          assert.equal(destino.hash, '#C02', `${l.slug}: destino #C02`);

          // c) El inicio es el mismo: mismas secciones, H1 y CTA. Solo cambian la frase y el negocio marcado.
          const inicio = await page.evaluate(leerInicio);
          const buyer = l.negocio ? oferta.buyers.find((b) => b.landing === l.slug) : null;
          assert.equal(estructura(inicio), estructura(canon), `${l.slug}: el inicio cambia secciones, H1 o CTA`);
          assert.equal(inicio.overflow, false, `${l.slug}: desborde lateral a ${width}px`);
          if (buyer) {
            assert.equal(inicio.hero, buyer.mensaje, `${l.slug}: frase de intención`);
            assert.ok(inicio.pressed.includes(l.marcado), `${l.slug}: negocio marcado (${inicio.pressed.join(', ')})`);
            assert.equal(await page.evaluate(() => M4.get().answers.negocio || null), l.negocio, `${l.slug}: negocio guardado`);
          } else {
            assert.equal(inicio.hero, canon.hero, `${l.slug}: la landing general no cambia la frase`);
            assert.equal(await page.evaluate(() => M4.get().answers.negocio || null), null, `${l.slug}: sin negocio marcado`);
          }
          comunes.push(estructura(inicio));
          if (width === 390) await page.screenshot({ path: path.join(evidence, `W10_${l.slug}_390.jpg`), type: 'jpeg', quality: 80 });
          if (width === 1280) await page.screenshot({ path: path.join(evidence, `W10_${l.slug}_1280.jpg`), type: 'jpeg', quality: 80 });
          assert.deepEqual(errors, [], `${l.slug} a ${width}px`);
        } finally {
          await ctx.close();
        }
      }
      assert.equal(new Set(comunes).size, 1, `las 8 landings muestran inicios distintos a ${width}px`);
      results.push({ width, landings: LANDINGS.length, mismoInicio: 'PASS' });
    }

    // d) Traspaso real: el negocio de la landing llega al cuestionario, la propuesta y el CRM.
    {
      const { ctx, page } = await context(browser, 390);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${base}/captacion/landing/restaurantes.html${PARAMS}`, { waitUntil: 'domcontentloaded' });
        await esperarInicio(page);
        await page.locator('[data-cierra-tarea="T1"]').first().click();
        await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C04', null, { timeout: 10000 });
        await page.locator('#r4Datos').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#r4Datos [data-a="answer"][data-k="negocio"]').count(), 0, 'C04 no vuelve a preguntar el negocio que trae la landing');
        await completeDiagnostic(page);
        await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C05', null, { timeout: 10000 });
        await page.locator('#pack-resumen').waitFor({ state: 'visible' });
        // El contacto es opcional en el cuestionario: se deja al aceptar el pack, como en el resto del MVP.
        await completePack(page);
        await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C06', null, { timeout: 10000 });
        const estado = await page.evaluate(() => ({ negocio: M4.get().answers.negocio, lead: M4.get().lead?.id || null, form1: M4.get().events.filter((e) => e.key === 'form1').length }));
        assert.equal(estado.negocio, 'Restaurante');
        assert.ok(estado.lead, 'la solicitud queda guardada con su contacto');
        assert.equal(estado.form1, 1, 'el contacto con permiso se registra una vez');
        await page.evaluate(() => { const id = M4.get().lead.id; M4.setRole('ventas'); M4.select(id); location.hash = '#R04'; });
        await page.locator('#crm-v2-root').waitFor({ state: 'visible' });
        await page.waitForTimeout(400);
        const ficha = await page.locator('#crm-v2-root').innerText();
        assert.match(ficha, /Restaurante/, 'la ficha del CRM muestra el negocio que trajo la landing');
        assert.deepEqual(errors, []);
        results.push({ traspaso: 'PASS', crm: 'PASS' });
      } finally { await ctx.close(); }
    }

    // e) El vínculo viejo (mc_handoff incompleto) sigue sin desbloquear el diagnóstico.
    {
      const { ctx, page } = await context(browser, 390);
      try {
        await page.goto(base + '/index.html#C01', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => { localStorage.setItem('mc_landing_draft_v1', JSON.stringify({ v: 1, name: 'Camila Rojas', email: 'camila.rojas@example.com', consent: true })); });
        await page.goto(base + '/index.html?mc_handoff=draft-123456&mc_landing=restaurante#C04', { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'No pudimos continuar' }).waitFor();
        assert.equal(await page.evaluate(() => M4.get().lead), null);
        assert.equal(await page.evaluate(() => M4.score()), 0);
        results.push({ handoffIncompleto: 'bloqueado' });
      } finally { await ctx.close(); }
    }

    process.stdout.write(JSON.stringify({ status: 'PASS', origin: 'HTTP local', results, evidence }, null, 2) + '\n');
  } finally { await browser.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
main().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
