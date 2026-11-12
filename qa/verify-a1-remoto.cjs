// Recorrido remoto de tarjetas del kit, en una sola pestaña y mismo origen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const KIT = '/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/';
const EVIDENCE = path.join(ROOT, 'EVIDENCIA_10NOV');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };

async function startServer() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://lab.test').pathname); }
    catch (_) { res.writeHead(400).end(); return; }
    const target = path.resolve(ROOT, `.${pathname}`);
    const relative = path.relative(ROOT, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    fs.stat(target, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
  });
  for (const port of [8885, 8886, 8887, 8888, 8889, 8890, 8891]) {
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return { server, base: `http://lab.test:${server.address().port}` }; }
    catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
  }
  throw new Error('No hay un puerto libre entre 8885 y 8891.');
}

function remoteSession(flow, role = 'externo') {
  const id = `MC-R3-${flow.replace(/[^A-Z0-9]/gi, '')}-${Date.now().toString(36)}`;
  return { id, participante: role === 'externo' ? (flow === 'A' ? 'P2' : 'P1') : ({ ventas: 'I1', marketing: 'I2', jefatura: 'I3' }[role]), camino: flow, rol: role, perfil: role === 'externo' ? (flow === 'A' ? 'hotel' : 'restaurante') : 'interno', modo: 'remoto', estado: 'en_recorrido', fases_hechas: [] };
}

async function openPortal(browser, base, session, route) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const errors = [];
  const apiRequests = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ping') apiRequests.push(request.url()); });
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: 'mc_prueba_sesion_actual_v1', value: session });
  const test = 'personas';
  const params = new URLSearchParams({ test, camino: session.camino, perfil: session.perfil, negocio: session.perfil, rol: session.rol, participante: session.participante, mc_session: session.id, tipo: 'cliente' });
  const url = `${base}/index.html?${params.toString()}#${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp), null, { timeout: 15000 });
  await page.waitForTimeout(80);
  return { context, page, errors, apiRequests, url };
}

async function assertNoOverflowAndCard(page, id, capturePath) {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = page.locator(`#a1-remote-cards [data-card-id="${id}"]`);
  await card.waitFor({ state: 'visible', timeout: 10000 });
  const readMetrics = () => page.evaluate(cardId => {
    const el=document.querySelector(`#a1-remote-cards [data-card-id="${cardId}"]`);
    if(!el)return null;
    const action = el.querySelector('[data-a1-card-action], [data-a1-remote-jump]');
    const r = action?.getBoundingClientRect(), c=el.getBoundingClientRect(), parent=el.parentElement, root=document.querySelector('#app');
    return { position: getComputedStyle(el).position, display:getComputedStyle(el).display, top:c.top, bottom:c.bottom, parent:parent?.tagName+'.'+parent?.className, mountId:parent?.parentElement?.id||'', appChildren:[...(root?.children||[])].map(node=>node.tagName+'.'+node.className), selectors:{form:Boolean(root?.querySelector('#leadForm')),dialog:Boolean(root?.querySelector('.contact-dialog')),portal:Boolean(root?.querySelector('.portal-content')),main:Boolean(root?.querySelector('main.app-main')),crm:Boolean(root?.querySelector('#m4-main'))},scroll:{window:scrollY,document:document.documentElement.scrollHeight,body:getComputedStyle(document.body).overflow}, actionHeight: r?.height || 0, actionWidth: r?.width || 0, cardText: el.innerText, actionTarget: action?.getAttribute('target') || '' };
  }, id);
  await page.waitForTimeout(180);
  let metrics=await readMetrics();
  if(!metrics){await card.waitFor({state:'visible',timeout:10000});metrics=await readMetrics();}
  assert.equal(metrics.position, 'static', `${id} debe permanecer en el flujo del documento`);
  assert.equal(metrics.mountId, 'm4-main', `${id} debe quedar dentro del contenido activo`);
  if(id==='pausa1')assert.ok(metrics.top>=0&&metrics.top<844, 'Pausa 1 debe quedar en la primera pantalla del formulario');
  assert.ok(metrics.actionHeight >= 44, `${id} tiene acción menor de 44 px: ${metrics.actionHeight}`);
  assert.ok(!/\b(?:E3|SUS|M4T)\b/i.test(metrics.cardText), `${id} muestra jerga interna: ${metrics.cardText}`);
  assert.equal(metrics.actionTarget, '', `${id} debe continuar en la misma pestaña`);
  for (const width of [360, 390, 414]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(180);
    await page.waitForFunction(cardId => Boolean(document.querySelector(`#a1-remote-cards [data-card-id="${cardId}"]`)), id, {timeout:10000});
    const widthData = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(widthData.scroll <= widthData.inner, `Desborde horizontal de ${widthData.scroll - widthData.inner}px en ${width}px`);
    const height = await page.evaluate(cardId=>document.querySelector(`#a1-remote-cards [data-card-id="${cardId}"] [data-a1-card-action], #a1-remote-cards [data-card-id="${cardId}"] [data-a1-remote-jump]`)?.getBoundingClientRect().height||0,id);
    assert.ok(height >= 44, `${id} baja de 44 px a ${width}px: ${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(cardId=>document.querySelector(`#a1-remote-cards [data-card-id="${cardId}"]`)?.scrollIntoView({block:'center'}),id);
  await page.waitForTimeout(100);
  metrics.afterScroll=await page.evaluate(cardId=>{const el=document.querySelector(`#a1-remote-cards [data-card-id="${cardId}"]`),r=el?.getBoundingClientRect();return {window:scrollY,top:r?.top,bottom:r?.bottom};},id);
  if (capturePath) await page.screenshot({ path: capturePath, fullPage: false });
  return metrics;
}

async function openPauseInSameTab(page, sessionId, phase, cardId = phase) {
  const resume = page.url();
  const link = page.locator(`#a1-remote-cards [data-card-id="${cardId}"] [data-a1-card-action]`);
  const href = new URL(await link.getAttribute('href'));
  assert.ok(href.pathname.endsWith(`${KIT}sesion.html`), `${phase}: destino distinto de sesion.html (${href.href})`);
  assert.equal(href.searchParams.get('fase'), phase);
  assert.equal(href.searchParams.get('mc_session'), sessionId);
  assert.equal(href.searchParams.get('volver'), resume, `${phase}: volver debe conservar la URL exacta del portal`);
  const originalPage = page;
  await link.click();
  await page.waitForURL(url => new URL(url).pathname.endsWith(`${KIT}sesion.html`), { timeout: 10000 });
  assert.equal(page, originalPage, `${phase}: se abrió otra pestaña`);
  await page.locator('#question-fields').waitFor({ state: 'visible', timeout: 12000 });
  return resume;
}

async function completePauseAndReturn(page, sessionId, phase, resume) {
  for(let attempt=0;attempt<16;attempt++){
    const back=page.getByRole('button',{name:'Volver al recorrido'});
    if(await back.count()){
      await back.click();
      await page.waitForURL(resume,{timeout:10000});
      const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),'mc_prueba_sesion_actual_v1');
      assert.equal(saved?.id,sessionId,`${phase}: session id changed on return`);
      assert.ok(saved?.fases_hechas?.includes(phase),`${phase}: completed phase was not recorded`);
      await page.waitForTimeout(120);
      return;
    }
    await page.locator('#question-fields').waitFor({state:'visible',timeout:10000});
    const skip=page.locator('button.mc-skip');
    assert.ok(await skip.count(),`${phase}: questionnaire continuation control missing`);
    await skip.click();
    await page.waitForTimeout(80);
  }
  throw new Error(`${phase}: remote session did not return`);
}
async function seedPortal(page, session) {
  await page.evaluate(({ session }) => {
    window.M4.update(state => {
      state.lead = {
        id: `MC-B2B-R3-${session.id.slice(-7)}`, name: 'Rocío Fuentes', email: 'rocio.fuentes@example.com', company: 'Hotel Los Aromos',
        source: session.camino === 'A' ? 'Orgánico · Google' : 'Meta Ads · paid_social', consent: true, marketingConsent: true,
        ...(session.camino === 'A' ? {} : { landing: { id: `LAND-${session.id}`, buyer: 'restaurante', slug: 'restaurantes' } })
      };
      state.answers = { negocio: session.camino === 'A' ? 'hotel' : 'restaurante', comuna: 'Santiago' };
      state.events = [{ key: 'form1', eventName: 'form_step_completed', pts: 20, label: 'Formulario confirmado', at: Date.now() }];
      state.proposal = { id: `PROP-${session.id}`, label: 'Propuesta de prueba', kind: 'base', status: 'pendiente', selectionVersion: 1 };
      state.diagnosticDone = true;
      state.customerCycle = null;
      state.emails = [];
      state.supportCase = null;
      state.csat = null;
    });
  }, { session });
  await page.waitForFunction(() => window.M4Journey.enabled() && Boolean(window.M4.get().customerCycle));
}

async function setPhases(page, sessionId, phases) {
  await page.evaluate(({ key, sessionId, phases }) => {
    const session = JSON.parse(localStorage.getItem(key) || 'null');
    session.fases_hechas = phases;
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: 'mc_prueba_sesion_actual_v1', sessionId, phases });
}

async function testExternalFlow(browser, base, flow, initialRoute, capture = false) {
  const session = remoteSession(flow);
  const { context, page, errors, apiRequests, url } = await openPortal(browser, base, session, initialRoute);
  const evidence = {};
  try {
    const cap = name => capture ? path.join(EVIDENCE, `A1_r3_remoto_A_${name}_390.png`) : null;
    evidence.pause1 = await assertNoOverflowAndCard(page, 'pausa1', cap('pausa1'));
    let resume = await openPauseInSameTab(page, session.id, 'pausa1');
    await completePauseAndReturn(page, session.id, 'pausa1', resume);
    assert.equal(await page.locator('#a1-remote-cards [data-card-id="pausa1"]').count(), 0, `${flow} mostró Pausa 1 después de completarla`);

    await seedPortal(page, session);
    await page.evaluate(() => { location.hash = 'C05'; });
    await page.waitForFunction(() => document.body.dataset.current === 'C05' || location.hash === '#C05');
    await page.waitForTimeout(180);
    evidence.pause2 = await assertNoOverflowAndCard(page, 'pausa2', cap('pausa2'));
    resume = await openPauseInSameTab(page, session.id, 'pausa2');
    await completePauseAndReturn(page, session.id, 'pausa2', resume);
    await page.waitForFunction(() => window.M4Journey && window.M4.get().proposal);
    evidence.jump3 = await assertNoOverflowAndCard(page, 'salto-3', cap('salto-3'));
    await page.locator('#a1-remote-cards [data-card-id="salto-3"] [data-a1-remote-jump]').click();
    await page.waitForFunction(() => window.M4.get().customerCycle?.timeJumps?.['3'] && window.M4.get().emails.some(mail => mail.journeyCode === 'E03'));
    assert.equal(await page.locator('#a1-remote-cards [data-card-id="salto-3"]').count(), 0, 'El salto de 3 días siguió disponible después de aplicarse.');
    assert.ok(await page.locator('#a1-remote-cards [data-card-status="salto-3"]').count(), 'No confirmó el salto de 3 días en pantalla.');

    await page.evaluate(() => window.M4.update(state => { state.proposal.status = 'aceptada'; }));
    await page.evaluate(() => { location.hash = 'C06'; });
    await page.waitForFunction(() => document.body.dataset.current === 'C06' || location.hash === '#C06');
    await page.locator('[data-cycle-action="sign-contract"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-cycle-action="sign-contract"]').click();
    await page.waitForFunction(() => Boolean(window.M4.get().customerCycle?.contractSignedAt));
    await page.evaluate(() => { location.hash = 'C09'; });
    await page.waitForFunction(() => document.body.dataset.current === 'C09' || location.hash === '#C09');
    evidence.jump30 = await assertNoOverflowAndCard(page, 'salto-30', cap('salto-30'));
    await page.locator('#a1-remote-cards [data-card-id="salto-30"] [data-a1-remote-jump]').click();
    await page.waitForFunction(() => window.M4.get().customerCycle?.timeJumps?.['30'] && window.M4.get().emails.some(mail => mail.journeyCode === 'E08'));
    await page.waitForFunction(() => Boolean(document.querySelector('#a1-remote-cards [data-card-status="salto-30"]')),{timeout:10000});
    assert.ok(await page.locator('#a1-remote-cards [data-card-status="salto-30"]').count(), 'No confirmó el salto de un mes en pantalla.');
    await page.locator('form[data-cycle-form="support"] select[name="type"]').selectOption({ label: 'Pedido o reposición' });
    await page.locator('form[data-cycle-form="support"] textarea[name="detail"]').fill('Consulta ficticia sobre la próxima reposición.');
    await page.locator('form[data-cycle-form="support"] button[type="submit"]').click();
    await page.locator('form[data-cycle-form="csat"] select[name="score"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('form[data-cycle-form="csat"] select[name="score"]').selectOption('5');
    await page.locator('form[data-cycle-form="csat"] textarea[name="comment"]').fill('Respuesta de prueba, clara y oportuna.');
    await page.locator('form[data-cycle-form="csat"] button[type="submit"]').click();
    await page.waitForFunction(() => Boolean(window.M4.get().customerCycle?.csat));
    evidence.final = await assertNoOverflowAndCard(page, 'final', cap('final'));
    const state = await page.evaluate(() => {
      const s = window.M4.get(), c = s.customerCycle;
      return { route: location.hash, buyer: c.buyer, leadId: s.lead.id, days: c.simulatedDays, phaseEmails: s.emails.filter(mail => ['E03','E08'].includes(mail.journeyCode)).map(mail => mail.journeyCode), contractSigned: Boolean(c.contractSignedAt), support: Boolean(c.supportCase), csat: Boolean(c.csat), portalUrl: location.href };
    });
    assert.equal(state.days, 33, `${flow}: total de días incorrecto`);
    assert.deepEqual(state.phaseEmails, ['E03', 'E08'], `${flow}: faltan E03/E08`);
    assert.ok(state.contractSigned && state.support && state.csat, `${flow}: el camino E6/E8 no quedó completo`);
    resume = await openPauseInSameTab(page, session.id, 'final');
    state.finalPhaseUrl = page.url();
    assert.equal(new URL(state.finalPhaseUrl).searchParams.get('fase'), 'final');
    assert.equal(errors.length, 0, `${flow}: errores de consola ${errors.join(' | ')}`);
    assert.equal(apiRequests.length, 0, `${flow}: /api/ping se llamó desde lab.test`);
    return { flow, sessionId: session.id, startUrl: url, state, evidence, errors, apiRequests };
  } finally { await context.close(); }
}

async function testInternal(browser, base, role) {
  const session = remoteSession('C', role);
  const { context, page, errors } = await openPortal(browser, base, session, 'R00');
  try {
    const card = page.locator('#a1-remote-cards [data-card-id="pausa-c"]');
    await card.waitFor({ state: 'visible', timeout: 10000 });
    const href = new URL(await card.locator('[data-a1-card-action]').getAttribute('href'));
    assert.equal(href.searchParams.get('fase'), 'pausa_c');
    assert.equal(href.searchParams.get('mc_session'), session.id);
    assert.equal(href.searchParams.get('volver'), page.url());
    assert.match(await card.innerText(), /Cuando el moderador te lo indique/i);
    const metrics = await assertNoOverflowAndCard(page, 'pausa-c', null);
    const resume=await openPauseInSameTab(page,session.id,'pausa_c','pausa-c');
    await completePauseAndReturn(page,session.id,'pausa_c',resume);
    assert.equal(await page.locator('#a1-remote-cards [data-card-id="pausa-c"]').count(), 0, `${role}: Pausa C volvió tras completar la fase`);
    assert.equal(errors.length, 0, `${role}: errores de consola ${errors.join(' | ')}`);
    return { role, metrics };
  } finally { await context.close(); }
}

async function testInactiveSessions(browser, base) {
  const results = [];
  for (const mode of ['local', 'remote-closed', 'missing']) {
    const session = mode === 'missing' ? null : remoteSession('A');
    if (session && mode === 'local') session.modo = 'local';
    if (session && mode === 'remote-closed') session.estado = 'cerrada';
    const { context, page } = await openPortal(browser, base, session || {}, 'C03');
    try {
      if (mode === 'missing') await page.evaluate(() => localStorage.removeItem('mc_prueba_sesion_actual_v1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(60);
      assert.equal(await page.locator('#a1-remote-cards').count(), 0, `Aparecieron tarjetas en la sesión ${mode}`);
      results.push({ mode, cards: 0 });
    } finally { await context.close(); }
  }
  return results;
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP lab.test 127.0.0.1'] });
    const results = {
      a: await testExternalFlow(browser, base, 'A', 'C04', true),
      bMeta: await testExternalFlow(browser, base, 'B-Meta', 'C04', false),
      internal: await Promise.all(['ventas','marketing','jefatura'].map(role => testInternal(browser, base, role))),
      inactive: await testInactiveSessions(browser, base)
    };
    const output = { status: 'PASS', base, hostResolver: 'lab.test → 127.0.0.1', viewport: '390x844; responsive checks 360/390/414', results };
    fs.writeFileSync(path.join(EVIDENCE, 'A1_r3_remoto_report.json'), JSON.stringify(output, null, 2), 'utf8');
    console.log(JSON.stringify(output, null, 2));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
