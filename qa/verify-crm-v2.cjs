'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
let BASE = process.argv.slice(2).find(arg => /^https?:\/\//i.test(arg)) || null;
const OUT = process.env.CRM2_VERIFY_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'marley-crm-v2-'));
const SIZES = [{ name: 'desktop', width: 1280, height: 551 }, { name: 'mobile', width: 390, height: 844 }];
const BROWSERS = [
  { name: 'Chrome', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  { name: 'Edge', executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }
];
const ROUTES = {
  R00: ['Ingreso', null], R01: ['Ventas · Hoy', 'ventas'], R02: ['Ventas · Contactos', 'ventas'],
  R03: ['Ventas · Clientes', 'ventas'], R04: ['Ficha única', 'ventas'], R05: ['Jefatura · Resumen', 'jefatura'],
  R06: ['Jefatura · Metas y canales', 'jefatura'], R06_marketing: ['Marketing · Ventas y origen', 'marketing', 'R06'], R07: ['Jefatura · Por aprobar', 'jefatura'],
  R08: ['Ventas · Propuestas', 'ventas'], R09: ['Puntaje y fundamento', 'jefatura'], R10: ['Ventas · Reposición', 'ventas'],
  R11: ['Marketing · Hoy', 'marketing'], R12: ['Marketing · Leads', 'marketing'], R13: ['Marketing · Campañas', 'marketing'],
  R14: ['Jefatura · Equipo y operación', 'jefatura'], R15: ['Jefatura · Operación', 'jefatura'],
  R16: ['Marketing · Recuperar', 'marketing'], R17: ['CRM por comprador', 'marketing']
};
const TASKS = [
  ['C-V1', 'Origen orgánico', 'ventas'], ['C-V2', 'Aceptación humana', 'ventas'], ['C-V3', 'Propuesta simulada', 'ventas'],
  ['C-V4', 'Reposición', 'ventas'], ['C-V5', 'Cuenta en riesgo', 'ventas'], ['C-V6', 'Referido', 'ventas'],
  ['C-M1', 'Lead y origen', 'marketing'], ['C-M2', 'Contenido y campaña', 'marketing'],
  ['C-M3', 'Calificación MQL', 'marketing'], ['C-M4', 'Permisos y recuperación', 'marketing'],
  ['C-J1', 'Panel general', 'jefatura'], ['C-J2', 'Propuesta y aprobación', 'jefatura'],
  ['C-J3', 'Aprobación de referido', 'jefatura'], ['C-J4', 'Recuperación y permisos', 'jefatura']
];
const TASK_FILTER = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length);
const ACTIVE_TASKS = TASK_FILTER ? TASKS.filter(([id]) => id === TASK_FILTER) : TASKS;
const HOME = { ventas: 'R01', marketing: 'R11', jefatura: 'R05' };
const errors = [];
const report = { base: BASE, viewCaptures: 0, taskCaptures: 0, journeys: [], routes: [], layout: [], noResponsiveClicks: 0 };

function mkdirs() {
  for (const dir of ['vistas', 'tareas']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
}
async function newPage(browser, size) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.width < 768, hasTouch: size.width < 768, reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`); });
  return { context, page, pageErrors };
}
async function go(page, route) {
  await page.goto(`${BASE}#${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#crm-v2-root:not([hidden])').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(route => (location.hash || '').slice(1).split('?')[0] === route, route);
  await page.waitForTimeout(90);
  await page.evaluate(() => document.fonts.ready);
}
async function roleStart(page, role) {
  await go(page, 'R00');
  await page.locator(`[data-c2="choose-role"][data-role="${role}"]`).click();
  await page.waitForFunction(route => location.hash === `#${route}`, HOME[role]);
}
async function click(locator, label) {
  assert.ok(await locator.count(), `No se encontró el control: ${label}`);
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().click({ timeout: 7000 });
}
async function screenshot(page, file) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
}
async function checkRouteViews(browser) {
  for (const size of SIZES) {
    for (const [routeKey, [label, role, hash = routeKey]] of Object.entries(ROUTES)) {
      const { context, page, pageErrors } = await newPage(browser, size);
      try {
        if (routeKey === 'R06_marketing') {
          await go(page, 'R00');
          await page.evaluate(() => M4.setRole('marketing'));
          await page.evaluate(() => { location.hash = '#R06'; });
          await page.locator('#crm-v2-root .crm2-block h2').filter({ hasText:'Leads, MQL y SQL por origen' }).waitFor({ state:'visible' });
        } else if (routeKey === 'R17') {
          await go(page, 'R00');
          await page.evaluate(() => M4.setRole('marketing'));
          await page.evaluate(() => { location.hash = '#R17'; });
          await page.locator('#crm-v2-root .crm2-block h2').filter({ hasText:'Contacto y decisión actual' }).waitFor({ state:'visible' });
        } else if (routeKey === 'R04') {
          await go(page, HOME[role]);
          const firstLead = page.locator('[data-c2="open-lead"]').first();
          if (await firstLead.count()) await click(firstLead, 'abrir lead para ficha');
          else {
            await go(page, 'R01');
            await click(page.locator('[data-c2="open-account"]'), 'abrir cuenta para ficha');
          }
        } else await go(page, hash);
        const metrics = await page.evaluate(() => {
          const root = document.querySelector('#crm-v2-root');
          const style = getComputedStyle(root);
          const h1 = root.querySelector('h1');
          const title = h1 ? getComputedStyle(h1).fontFamily : '';
          const bodyFont = style.fontFamily;
          const blocks = [...root.querySelectorAll('.crm2-main > .crm2-content > .crm2-block')].filter(node => node.offsetWidth && node.offsetHeight).length;
          const actionbar = root.querySelector('.crm2-actionbar');
          const sidebar = root.querySelector('.crm2-sidebar');
          const ab = actionbar?.getBoundingClientRect();
          const sb = sidebar?.getBoundingClientRect();
          const touchTargets = [...root.querySelectorAll('.crm2-actionbar button,.crm2-actionbar summary')].filter(node => node.offsetWidth && node.offsetHeight).map(node => { const r = node.getBoundingClientRect(); return { width:r.width, height:r.height }; });
          return {
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            rootVisible: Boolean(root && root.offsetWidth && root.offsetHeight),
            pageTitle: h1?.innerText || root.querySelector('h1')?.innerText || 'Ingreso al CRM',
            majorGroups: blocks,
            bodyFont,
            titleFont: title,
            yellow: getComputedStyle(document.documentElement).getPropertyValue('--crm2-yellow').trim(),
            primaryBackground: root.querySelector('.crm2-btn--primary') ? getComputedStyle(root.querySelector('.crm2-btn--primary')).backgroundColor : null,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            actionbarOverlap: Boolean(ab && sb && document.documentElement.clientWidth > 640 && ab.left < sb.right - 1),
            smallActionTargets: touchTargets.filter(target => target.width < 44 || target.height < 44).length,
            colorFamilies: [...new Set([...root.querySelectorAll('*')].filter(n => n.offsetWidth && n.offsetHeight).flatMap(n => [getComputedStyle(n).color, getComputedStyle(n).backgroundColor, getComputedStyle(n).borderColor]))].filter(c => /\b(blue|green|red|orange|purple|teal|cyan)\b/i.test(c)),
            fontLoaded: { festivo: document.fonts.check('12px Festivo'), pressura: document.fonts.check('12px Pressura') },
            foldsOpen: [...root.querySelectorAll('details')].filter(node => node.open).length
          };
        });
        const route = hash;
        assert.ok(metrics.rootVisible, `${routeKey} ${size.name}: CRM no visible`);
        assert.equal(metrics.horizontalOverflow, false, `${routeKey} ${size.name}: overflow horizontal (${metrics.scrollWidth}/${metrics.width})`);
        assert.ok(metrics.majorGroups <= 3, `${routeKey} ${size.name}: ${metrics.majorGroups} grupos visibles`);
        assert.match(metrics.bodyFont, /Fabriga.*sans-serif/i, `${routeKey} ${size.name}: falta la familia proporcional de lectura`);
        assert.match(metrics.titleFont, /Festivo/i, `${routeKey} ${size.name}: título sin Festivo (${metrics.titleFont || 'sin font-family'})`);
        assert.equal(metrics.yellow.toLowerCase(), '#f7be00', `${routeKey}: token amarillo distinto`);
        assert.equal(metrics.fontLoaded.festivo, true, `${routeKey} ${size.name}: Festivo no cargó`);
        assert.equal(metrics.fontLoaded.pressura, true, `${routeKey} ${size.name}: Pressura no cargó`);
        assert.equal(metrics.actionbarOverlap, false, `${routeKey} ${size.name}: la barra fija invade el menú lateral`);
        assert.equal(metrics.smallActionTargets, 0, `${routeKey} ${size.name}: control fijo menor a 44 px`);
        assert.deepEqual(metrics.colorFamilies, [], `${routeKey} ${size.name}: color fuera de paleta`);
        if (routeKey === 'R06_marketing') {
          assert.match(await page.locator('#crm-v2-root').innerText(), /Leads, MQL y SQL por origen/i, 'R06 en Marketing debe conservar el desglose por origen');
          assert.equal(await page.locator('.crm2-nav [data-c2-go]').count(), 4, 'el alias de R06 conserva el menú de cuatro entradas de Marketing');
        }
        const file = path.join(OUT, 'vistas', `${routeKey}-${size.name}-${size.width}x${size.height}.png`);
        await screenshot(page, file);
        report.viewCaptures += 1;
        report.routes.push({ route, routeKey, role, label, viewport: `${size.width}x${size.height}`, ...metrics, screenshot: path.basename(file) });
        assert.deepEqual(pageErrors, [], `${routeKey} ${size.name}: ${pageErrors.join(' | ')}`);
      } finally { await context.close(); }
    }
  }
}
async function taskJourney(browser, size, task) {
  const [id, title, role] = task;
  const { context, page, pageErrors } = await newPage(browser, size);
  let counted = 0;
  const nav = async route => { await click(page.locator(`[data-c2-go="${route}"]`), `ir a ${route}`); await page.waitForFunction(route => location.hash === `#${route}`, route); counted += 1; };
  try {
    await roleStart(page, role);
    let evidenceRoute = HOME[role];
    if (id === 'C-V1') {
      await nav('R02'); evidenceRoute = 'R02';
      const organic = page.locator('.crm2-row').filter({ hasText: /Google|búsqueda|orgánic/i }).first();
      await click(organic, 'prospecto orgánico'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04'); evidenceRoute = 'R04';
      assert.match(await page.locator('#crm-v2-root').innerText(), /Google|orgánic|búsqueda/i);
    } else if (id === 'C-V2') {
      const queue = page.locator('.crm2-block').filter({ hasText: 'A atender hoy' }).first();
      await click(queue.locator('[data-c2="open-lead"]'), 'contacto pasado por Marketing'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04');
      await click(page.locator('[data-c2="accept-sql"]'), 'aceptar como SQL'); counted += 1;
      await page.waitForTimeout(100); evidenceRoute = 'R04';
      assert.match(await page.locator('[data-crm2-toast]').innerText(), /aceptada como SQL/i);
    } else if (id === 'C-V3') {
      await click(page.locator('.crm2-block').filter({ hasText: 'A atender hoy' }).locator('[data-c2="open-lead"]'), 'abrir contacto'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04');
      await click(page.locator('.crm2-actionbar [data-c2="quote"]'), 'preparar propuesta'); counted += 1;
      const dialog = page.locator('[data-quote-dialog]');
      await dialog.waitFor({ state: 'visible' });
      for (let step = 1; step <= 2; step += 1) await click(dialog.locator('[data-c2="quote-next"]'), `paso ${step + 1}`);
      await dialog.locator('input[name="quote-channel"][value="ambos"]').check();
      assert.match(await dialog.innerText(), /simulada|simulado|prototipo/i);
      await click(dialog.locator('[data-c2="quote-send"]'), 'guardar envío simulado');
      await page.waitForTimeout(100); evidenceRoute = 'R04';
      assert.match(await page.locator('[data-crm2-toast]').innerText(), /solo en el prototipo/i);
      assert.match(await page.locator('#crm-v2-root').innerText(), /MC-PROP-0001/);
    } else if (id === 'C-V4') {
      await click(page.locator('.crm2-block').filter({ hasText: 'A atender hoy' }).locator('.crm2-row').filter({ hasText: 'Reposición' }), 'cuenta con reposición'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04');
      await click(page.locator('.crm2-actionbar [data-c2="open-reorder"]'), 'preparar reposición'); counted += 1;
      assert.ok(await page.locator('[data-reorder-qty]').count(), `faltan cantidades del último pedido: ${await page.locator('[data-inline-panel]').innerText()}`);
      await page.locator('[data-reorder-note]').fill('Confirmar cantidades con la cuenta');
      evidenceRoute = 'R04';
      await click(page.locator('[data-c2="save-reorder"]'), 'dejar reposición lista');
      assert.match(await page.locator('[data-crm2-toast]').innerText(), /Reposición lista/i);
    } else if (id === 'C-V5') {
      await nav('R03'); evidenceRoute = 'R03';
      const risk = page.locator('.crm2-block').filter({ hasText: 'En riesgo' }).first();
      await click(risk.locator('.crm2-row'), 'cuenta en riesgo'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04'); evidenceRoute = 'R04';
      assert.match(await page.locator('#crm-v2-root').innerText(), /riesgo|compra|postventa/i);
    } else if (id === 'C-V6') {
      const row = page.locator('.crm2-block').filter({ hasText: 'A atender hoy' }).locator('[data-c2="open-account"]').filter({ hasText: /Referido/ }).first();
      await click(row, 'referido'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04'); evidenceRoute = 'R04';
      assert.match(await page.locator('#crm-v2-root').innerText(), /Recomendación registrada/);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Recomendó/);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Permiso del referido/);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Beneficio para quien refiere/);
    } else if (id === 'C-M1') {
      await nav('R12'); evidenceRoute = 'R12';
      await click(page.locator('.crm2-row').first(), 'lead recién incorporado'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04'); evidenceRoute = 'R04';
      assert.match(await page.locator('#crm-v2-root').innerText(), /Llegó por|Origen/i);
    } else if (id === 'C-M2') {
      await nav('R13'); evidenceRoute = 'R13';
      await click(page.locator('.crm2-campaign details > summary').first(), 'abrir piezas y contactos'); counted += 1;
      assert.match(await page.locator('#crm-v2-root').innerText(), /Pieza:|Contenido del rubro|Pieza sin registro/i);
    } else if (id === 'C-M3') {
      await nav('R12'); evidenceRoute = 'R12';
      await click(page.locator('.crm2-row').first(), 'revisar lead para MQL'); counted += 1;
      await page.waitForFunction(() => location.hash === '#R04'); evidenceRoute = 'R04';
      assert.ok(await page.locator('.crm2-qualification').count(), 'no aparece el checklist MQL');
    } else if (id === 'C-M4') {
      await nav('R16'); evidenceRoute = 'R16';
      assert.match(await page.locator('#crm-v2-root').innerText(), /Sin permiso|Solicitud de respuesta/i);
      await click(page.locator('[data-c2="reply-request"]'), 'responder solicitud expresa'); counted += 1;
      assert.match(await page.locator('[data-crm2-toast]').innerText(), /solo responde la solicitud/i);
      assert.equal(await page.locator('[data-c2="nurture"]').count(), 0, 'aparece promoción para contacto sin permiso');
    } else if (id === 'C-J1') {
      evidenceRoute = 'R05';
      await click(page.locator('#crm-v2-root summary').filter({ hasText: 'Resultados del programa' }), 'resultados del programa'); counted += 1;
      assert.equal(await page.locator('.crm2-metric').count(), 4, 'Resumen no muestra 4 indicadores');
      assert.match(await page.locator('#crm-v2-root').innerText(), /Decisiones de hoy|Todos los indicadores/);
    } else if (id === 'C-J2') {
      await nav('R07'); evidenceRoute = 'R07';
      const proposal = page.locator('.crm2-approval').filter({ hasText: /descuento fuera de lista/i }).first();
      await proposal.locator('[data-approval-note]').fill('Confirmar descuento excepcional antes de decidir.');
      await click(proposal.locator('[data-decision="pidio_info"]'), 'pedir información'); counted += 1;
      assert.match(await page.locator('[data-crm2-toast]').innerText(), /Información solicitada/i);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Información solicitada a Ventas/i);
    } else if (id === 'C-J3') {
      await nav('R07'); evidenceRoute = 'R07';
      const referral = page.locator('.crm2-approval').filter({ hasText: /Beneficio por referido/ }).first();
      assert.ok(await referral.count(), 'falta muestra de aprobación de referido');
      assert.match(await referral.innerText(), /Permiso del referido|Permiso.*confirmar/i);
      assert.equal(await referral.locator('[data-decision="aprobada"]').isDisabled(), true, 'debe bloquear aprobación hasta validar las 3 condiciones');
    } else if (id === 'C-J4') {
      await nav('R07'); evidenceRoute = 'R07';
      assert.match(await page.locator('#crm-v2-root').innerText(), /Seguimientos preparados/);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Bloqueado: falta permiso/);
      assert.match(await page.locator('#crm-v2-root').innerText(), /Requiere aprobación/);
    }

    assert.ok(counted <= 2, `${id}: ${counted} clics para llegar a la tarea desde Hoy`);
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, 'tareas', `${id}-${size.width}x${size.height}.png`);
    if (browser._crm2Name === 'Chrome') { await screenshot(page, file); report.taskCaptures += 1; }
    assert.deepEqual(pageErrors, [], `${id}: ${pageErrors.join(' | ')}`);
    report.journeys.push({ id, title, browser: browser._crm2Name, viewport: `${size.width}x${size.height}`, clicksToTask: counted, evidenceRoute, errors: pageErrors.length });
  } finally { await context.close(); }
}

async function main() {
  mkdirs();
  let server = null;
  if (!BASE) {
    const root = path.resolve(__dirname, '..');
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };
    server = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
      const file = path.resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (error, bytes) => {
        if (error) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type':types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
        res.end(bytes);
      });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    BASE = `http://127.0.0.1:${server.address().port}/index.html`;
  }
  try {
    const url = new URL(BASE);
    assert.equal(url.hostname, '127.0.0.1', 'El verificador debe ejecutarse contra el servidor local pedido.');
    for (const spec of BROWSERS) {
      assert.ok(fs.existsSync(spec.executablePath), `${spec.name} no está instalado en ${spec.executablePath}`);
      const browser = await chromium.launch({ headless: true, executablePath: spec.executablePath, args: ['--disable-gpu'] });
      browser._crm2Name = spec.name;
      try {
        if (spec.name === 'Chrome' && !process.argv.includes('--skip-route-checks')) await checkRouteViews(browser);
        for (const size of SIZES) for (const task of ACTIVE_TASKS) await taskJourney(browser, size, task);
      } finally { await browser.close(); }
    }
    report.noResponsiveClicks = report.journeys.length ? 0 : null;
    fs.writeFileSync(path.join(OUT, 'verificacion-crm-v2.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify({ status: 'PASS', captures: { views: report.viewCaptures, tasks: report.taskCaptures }, journeys: report.journeys.length, routeChecks: report.routes.length, output: OUT }, null, 2) + '\n');
  } finally { if (server) await new Promise((resolve) => server.close(resolve)); }
}
main().catch(error => { console.error('CRM V2 VERIFY FAIL:', error.stack || error.message || error); process.exit(1); });
