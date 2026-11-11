// Verifica el contrato de storage de la consola con dos paginas Playwright del mismo origen.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const KIT = '/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

async function startServer() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (_) { res.writeHead(400).end(); return; }
    const target = path.resolve(ROOT, `.${pathname}`);
    const relative = path.relative(ROOT, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    fs.stat(target, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
  });
  for (const port of [8885, 8886, 8887, 8888, 8889, 8890, 8891]) {
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return { server, base: `http://127.0.0.1:${port}` }; }
    catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
  }
  throw new Error('No hay un puerto libre entre 8885 y 8891.');
}

async function answerQuestions(page, finishText) {
  for (let index = 0; index < 80; index += 1) {
    const fields = page.locator('#question-fields');
    if (!(await fields.count())) break;
    const textarea = fields.locator('textarea');
    const radios = fields.locator('input[type="radio"]');
    const checks = fields.locator('input[type="checkbox"]');
    if (await textarea.count()) await textarea.fill('Respuesta ficticia de prueba.');
    else if (await radios.count()) await radios.first().check();
    else if (await checks.count()) await checks.first().check();
    const next = page.locator('.mc-question-actions .mc-btn--primary');
    if (!(await next.count())) throw new Error('La pregunta no ofrece el boton para continuar.');
    await next.click();
    await page.waitForTimeout(35);
  }
  await page.getByRole('heading', { name: finishText, exact: true }).waitFor({ timeout: 10000 });
}

async function main() {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const portal = await context.newPage();
    const moderator = await context.newPage();
    const pageErrors = [];
    portal.on('pageerror', error => pageErrors.push(`portal: ${error.message}`));
    moderator.on('pageerror', error => pageErrors.push(`moderator: ${error.message}`));
    await moderator.goto(`${base}${KIT}inicio.html`, { waitUntil: 'domcontentloaded' });
    await moderator.locator('#participant').selectOption('P1');
    await moderator.locator('#profile').selectOption('restaurante');
    const welcomePopup = moderator.waitForEvent('popup');
    await moderator.locator('[data-route="B-Meta"]').click();
    const welcome = await welcomePopup;
    welcome.on('pageerror', error => pageErrors.push(`welcome: ${error.message}`));
    await welcome.locator('#consent-accepted').waitFor({ state: 'visible' });
    await welcome.locator('#consent-accepted').check();
    await welcome.getByRole('button', { name: 'Continuar a las preguntas iniciales' }).click();
    await welcome.locator('#question-fields').waitFor({ state: 'visible' });
    await answerQuestions(welcome, 'Comenzar recorrido');
    await welcome.getByRole('button', { name: 'Comenzar recorrido' }).click();
    await welcome.waitForFunction(() => !location.pathname.endsWith('/sesion.html'), null, { timeout: 15000 });
    await welcome.waitForLoadState('domcontentloaded');
    const participant = welcome;
    participant.on('pageerror', error => pageErrors.push(`participant: ${error.message}`));
    await participant.waitForLoadState('domcontentloaded');
    const session = await moderator.evaluate(() => window.MCPrueba.readActive());
    if (session?.camino !== 'B-Meta' || session?.estado === 'cerrada') throw new Error(`El lanzador no creo una sesion B-Meta activa: ${JSON.stringify(session)}`);
    await portal.goto(`${base}/index.html?test=personas&camino=B-Meta&negocio=restaurante&mc_session=${encodeURIComponent(session.id)}#C04`, { waitUntil: 'domcontentloaded' });
    await portal.waitForFunction(() => Boolean(window.M4 && window.M4Journey));

    const beforeLead = await portal.evaluate(() => window.M4Journey.enabled());
    await portal.evaluate(() => window.M4.update(state => {
      state.lead = { id: 'MC-B2B-R2TEST1', name: 'Rocio Fuentes', email: 'rocio.fuentes@example.com', consent: true, marketingConsent: false, company: '', source: 'Organico · Google' };
      state.events = [{ key: 'form1', pts: 20, label: 'formulario', at: 1794420000000 }];
      state.answers = {};
      state.emails = [];
      state.customerCycle = null;
      state.proposal = null;
    }));
    await portal.waitForFunction(() => window.M4Journey.enabled() && Boolean(window.M4.get().customerCycle));
    const initial = await portal.evaluate(() => {
      const s = window.M4.get();
      return { enabled: window.M4Journey.enabled(), buyer: s.customerCycle.buyer, slug: s.customerCycle.buyerSlug, leadId: s.customerCycle.leadId, events: s.events.filter(e => e.key === `cycle:${s.lead.id}:lead_created`).length, e01: s.emails.filter(e => e.journeyCode === 'E01').length };
    });
    if (beforeLead || !initial.enabled || initial.buyer !== 'restaurante' || initial.slug !== 'restaurantes' || initial.events !== 1 || initial.e01 !== 1) throw new Error(`No landing/form1 no quedo identificado una sola vez: ${JSON.stringify({ beforeLead, initial })}`);

    async function writeJump(payload) {
      await moderator.evaluate(value => localStorage.setItem('mc_prueba_salto_v1', JSON.stringify(value)), payload);
    }
    async function stats() {
      return portal.evaluate(() => {
        const s = window.M4.get(), c = s.customerCycle;
        return { days: c?.simulatedDays || 0, jumps: { ...(c?.timeJumps || {}) }, nonces: { ...(c?.moderatorJumpNonces || {}) }, leadEvents: s.events.filter(e => e.key === `cycle:${s.lead.id}:lead_created`).length, e01: s.emails.filter(e => e.journeyCode === 'E01').length };
      });
    }
    const baseline = await stats();
    await writeJump({ dias: 3, sesion_id: 'MC-OTRA-SESION', at: Date.now(), nonce: 'rechazado-ajeno' });
    await moderator.evaluate(value => localStorage.setItem('mc_prueba_sesion_actual_v1', JSON.stringify({ ...value, estado: 'cerrada' })), session);
    await writeJump({ dias: 30, sesion_id: session.id, at: Date.now() + 1, nonce: 'rechazado-cerrado' });
    await writeJump({ dias: 3, sesion_id: session.id, at: Date.now() + 2, nonce: 'rechazado-cerrado-2' });
    await portal.waitForTimeout(180);
    const afterRejected = await stats();
    if (JSON.stringify(afterRejected) !== JSON.stringify(baseline)) throw new Error(`Se aplico un salto de sesion ajena/cerrada: ${JSON.stringify({ baseline, afterRejected })}`);
    await moderator.evaluate(value => localStorage.setItem('mc_prueba_sesion_actual_v1', JSON.stringify(value)), session);

    const jump3 = { dias: 3, sesion_id: session.id, at: Date.now() + 3, nonce: 'nonce-a1-r2-3' };
    await writeJump(jump3);
    await portal.waitForFunction(() => window.M4.get().customerCycle?.timeJumps?.['3']);
    const after3 = await stats();
    await writeJump({ ...jump3, at: jump3.at + 1 });
    await portal.waitForTimeout(140);
    const afterDuplicate = await stats();
    if (after3.days !== 3 || afterDuplicate.days !== 3 || afterDuplicate.jumps['3'] !== after3.jumps['3'] || !afterDuplicate.nonces[jump3.nonce]) throw new Error(`El nonce 3 dias no fue idempotente: ${JSON.stringify({ after3, afterDuplicate })}`);

    const jump30 = { dias: 30, sesion_id: session.id, at: Date.now() + 4, nonce: 'nonce-a1-r2-30' };
    await writeJump(jump30);
    await portal.waitForFunction(() => window.M4.get().customerCycle?.timeJumps?.['30']);
    const beforeReload = await stats();
    await portal.reload({ waitUntil: 'domcontentloaded' });
    await portal.waitForFunction(() => window.M4Journey.enabled() && Boolean(window.M4.get().customerCycle));
    await writeJump({ ...jump3, at: jump3.at + 2 });
    await portal.waitForTimeout(140);
    const afterReloadDuplicate = await stats();
    const finalState = await portal.evaluate(() => {
      const s = window.M4.get();
      return { buyer: s.customerCycle.buyer, leadId: s.customerCycle.leadId, accountCode: s.customerCycle.accountCode, leadEvents: s.events.filter(e => e.key === `cycle:${s.lead.id}:lead_created`).length, e01: s.emails.filter(e => e.journeyCode === 'E01').length };
    });
    if (beforeReload.days !== 33 || afterReloadDuplicate.days !== 33 || afterReloadDuplicate.jumps['3'] !== beforeReload.jumps['3'] || finalState.leadEvents !== 1 || finalState.e01 !== 1 || finalState.buyer !== 'restaurante') throw new Error(`Recarga/duplicado altero el ciclo: ${JSON.stringify({ beforeReload, afterReloadDuplicate, finalState })}`);
    if (pageErrors.length) throw new Error(`Errores JavaScript: ${pageErrors.join(' | ')}`);

    console.log(JSON.stringify({ status: 'PASS', base, launchedFrom: `${base}${KIT}inicio.html`, launchedPath: session.camino, sessionId: session.id, participantStarted: participant.url(), sameContextStorage: true, beforeLead, initial, rejectedForeignAndClosed: afterRejected, after3, afterDuplicate, after30: beforeReload, afterReloadDuplicate, finalState, pageErrors }, null, 2));
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
