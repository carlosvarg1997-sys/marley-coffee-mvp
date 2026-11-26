const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const base = new URL(process.argv[2] || 'http://127.0.0.1:8896/');
const evidence = path.resolve(process.argv[3] || '../marley-etapa2-23nov-evidencia/prueba-simulada');
const kit = 'PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/';
const C = { ventas: 'R01', marketing: 'R11', jefatura: 'R05' };
const bank = require('../' + kit + 'preguntas.json');

function local(file) { return new URL(file, base).href; }

async function omissionQuestions(page, expected) {
  for (let index = 0; index < expected; index++) {
    const next = page.locator('#question-next');
    await next.waitFor();
    const omit = page.locator('#skip-answer');
    const required = await page.locator('.ag-question-screen .ag-req').count() > 0;
    assert.equal(await next.isDisabled(), required, 'Se bloquea cada pregunta obligatoria');
    await omit.check();
    assert.equal(await next.isEnabled(), true);
    await next.click();
  }
}

async function download(page, id, folder) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(id).click()]);
  const saved = path.join(folder, file.suggestedFilename());
  await file.saveAs(saved);
  assert.ok(fs.statSync(saved).size > 0);
  return saved;
}

async function guided(page, role, folder) {
  page.on('dialog', dialog => dialog.accept());
  await page.goto(local('prueba.html'));
  const consent = page.locator('#welcome-next');
  await consent.waitFor();
  assert.ok(await consent.isDisabled());
  await page.locator('#consent-check').check();
  await consent.click();
  await page.locator('[data-path="C"]').click();
  await page.locator('#role-choice').selectOption(role);
  await page.locator('#choice-next').click();
  await omissionQuestions(page, bank.fases_autoguiada.inicial.internos.length);

  const inside = page.frameLocator('.ag-journey-frame');
  const roleButton = inside.locator('[data-c2="choose-role"][data-role="' + role + '"]');
  const today = inside.locator('body[data-current="' + C[role] + '"] #crm-v2-root h1');
  await roleButton.or(today).first().waitFor();
  if (await roleButton.isVisible()) await roleButton.click();
  await today.waitFor();
  // La tarea se cierra con el CTA del sitio que la cierra (data-cierra-tarea de la tarea en curso). Ese CTA abre #task-evaluation.
  const enCurso = await page.evaluate(() => {
    const estado = JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1') || 'null');
    return estado?.tareas?.[estado.taskIndex]?.etapa || null;
  });
  assert.ok(enCurso, 'Debe haber una tarea en curso en la prueba');
  // El CTA de cierre puede estar en otra pantalla del CRM (por ejemplo, la fila de un contacto de búsqueda en la cola de Ventas): se busca en las pantallas del rol.
  const pantallasRol = { ventas: ['R01', 'R02'], marketing: ['R11', 'R12'], jefatura: ['R05'] }[role] || [];
  const marco = await page.locator('.ag-journey-frame').elementHandle().then(h => h.contentFrame());
  for (const ruta of pantallasRol) {
    if (await inside.locator('[data-cierra-tarea="' + enCurso + '"]').first().isVisible().catch(() => false)) break;
    await marco.evaluate((r) => window.MarleyApp.go(r, { evaluation: true }), ruta).catch(() => {});
    await page.waitForTimeout(700);
  }
  const cierre = inside.locator('[data-cierra-tarea="' + enCurso + '"]').filter({ visible: true }).first();
  if (!(await cierre.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))) {
    const visibles = await inside.locator('[data-cierra-tarea]').evaluateAll(els => els.map(el => el.getAttribute('data-cierra-tarea')));
    assert.fail('No aparece el CTA que cierra la tarea «' + enCurso + '» (CTA visibles: ' + (visibles.join(', ') || 'ninguno') + ')');
  }
  await cierre.click();
  await page.locator('#task-evaluation').waitFor({ state: 'visible' });
  const save = page.locator('#task-save');
  assert.ok(await save.isDisabled());
  await page.locator('[name="task-result"][value="Logrado"]').check();
  assert.ok(await save.isDisabled(), 'El resultado solo no habilita guardar');
  await page.locator('[name="task-seq"][value="NR"]').check();
  const optionalStageGroups = page.locator('#task-evaluation fieldset').filter({ has: page.locator('input[value="Prefiero no responder"]') });
  for (const field of await optionalStageGroups.all()) {
    const opt = field.locator('input[value="Prefiero no responder"]');
    if (!await opt.getAttribute('name').then(name => name === 'task-result')) await opt.check();
  }
  assert.ok(await save.isEnabled());
  await save.click();
  if (await page.locator('#question-next').isVisible()) {
    for (let n = 0; n < 8 && await page.locator('#question-next').isVisible(); n++) await omissionQuestions(page, 1);
  }
  // «Terminar la prueba» vive dentro de la instrucción plegada de la franja: se abre con «Ver instrucción».
  const finish = page.locator('[data-action="finish-early"]').filter({ visible: true }).first();
  if (!await finish.isVisible()) await page.locator('[data-action="bar-fold"]').filter({ visible: true }).first().click();
  await finish.click();
  await omissionQuestions(page, bank.fases_autoguiada.final.internos.length);
  await page.locator('#download-pdf').waitFor();
  await page.reload();
  await page.locator('#download-pdf').waitFor();
  const pdf = await download(page, '#download-pdf', folder);
  const json = await download(page, '#download-json', folder);
  const csv = await download(page, '#download-csv', folder);
  const report = JSON.parse(fs.readFileSync(json, 'utf8').replace(/^\uFEFF/, ''));
  const code = report.sesion.codigo;
  assert.ok(code && report.respuestas.some(row => row.omitida && row.respuesta_texto === 'Prefiero no responder'));
  assert.equal(report.sesion.rol, role);
  assert.ok(fs.readFileSync(csv, 'utf8').includes(code));
  assert.match(fs.readFileSync(pdf).subarray(0, 12).toString(), /^%PDF-/);
  const python = process.env.MARLEY_QA_PYTHON;
  const pdfText = python
    ? execFileSync(python, ['-X', 'utf8', '-c', 'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))', pdf], { encoding: 'utf8' })
    : execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
  assert.match(pdfText, /tabla de tareas/i);
  assert.match(pdfText, /prefiero no responder/i);
  assert.ok(pdfText.includes(code));
  await page.locator('[data-action="restart-test"]').filter({ visible: true }).first().click();
  await consent.waitFor();
  assert.ok(await consent.isDisabled());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1')).respuestas.length), 0);
}

async function moderated(page, folder) {
  await page.goto(local(kit + 'inicio.html'));
  await page.locator('#participant').selectOption('I1');
  const [participant] = await Promise.all([
    page.waitForEvent('popup'), page.locator('[data-route="C"][data-role="ventas"]').click(),
  ]);
  const start = participant.getByRole('button', { name: 'Continuar a las preguntas iniciales' });
  await start.waitFor();
  assert.ok(await start.isDisabled());
  await participant.locator('#consent-accepted').check();
  await start.click();
  const id = await participant.locator('#question-fields').locator('..').getAttribute('data-question-id');
  await participant.getByRole('button', { name: 'Continuar', exact: true }).click();
  assert.equal(await participant.locator('#question-fields').locator('..').getAttribute('data-question-id'), id);
  assert.ok(await participant.locator('#question-status').isVisible());
  for (let n = 0; n < 4; n++) await participant.getByRole('button', { name: 'Prefiero no responder', exact: true }).click();
  await participant.getByRole('button', { name: 'Comenzar recorrido' }).click();
  await participant.locator('#crm-v2-root h1').waitFor();
  await page.locator('#reset').click();
  const final = await page.context().newPage();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('mc_prueba_sesion_actual_v1')));
  await final.goto(local(kit + 'sesion.html?fase=final&mc_session=' + encodeURIComponent(session.id)));
  for (let n = 0; n < 7; n++) await final.getByRole('button', { name: 'Prefiero no responder', exact: true }).click();
  await final.getByRole('heading', { name: 'Gracias por participar' }).waitFor();
  await page.goto(local(kit + 'respuestas.html'));
  await page.locator('#filter-participant').selectOption('I1');
  const file = await download(page, '#export-json', folder);
  const records = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(records.sesiones.length, 1);
  assert.equal(records.sesiones[0].id, session.id);
  assert.equal(records.sesiones[0].estado, 'cerrada');
  assert.ok(records.respuestas.filter(row => row.omitida && row.sesion_id === session.id).length >= 11);
  await download(page, '#export-summary', folder);
}

async function acquisition(page) {
  await page.goto(local('PRUEBA_CON_PERSONAS/serp-seo-aeo-geo.html'));
  await page.locator('#query').fill('máquina de café para cafetería');
  await page.locator('#search button').click();
  await page.locator('#serp-list .result:visible').first().waitFor();
  await page.goto(local('captacion/anuncios/feed-simulado.html?red=meta&perfil=cafeteria'));
  const ad = page.locator('#ad-link');
  await ad.scrollIntoViewIfNeeded();
  await ad.click();
  await page.waitForURL(/captacion\/landing\/.*utm_source=meta/);
  await page.locator('h1').waitFor();
}

const sessionKey = 'mc_prueba_autoguiada_v1';
const layer = '#ag-eval';

async function begin(page, role) {
  await page.goto(local('prueba.html'));
  await page.locator('#consent-check').check();
  await page.locator('#welcome-next').click();
  await page.locator(role ? '[data-path="C"]' : '[data-path="A"]').click();
  await page.locator(role ? '#role-choice' : '#profile-choice').selectOption(role || 'hotel');
  await page.locator('#choice-next').click();
  await omissionQuestions(page, bank.fases_autoguiada.inicial[role ? 'internos' : 'externos'].length);
  const iframe = page.locator('.ag-journey-frame');
  await iframe.waitFor();
  return (await iframe.elementHandle()).contentFrame();
}

async function blocked(page, folder, file) {
  const dialog = page.locator(layer);
  await dialog.waitFor();
  assert.equal(await page.locator('.ag-journey-frame').evaluate(el =>
    el.inert && getComputedStyle(el).pointerEvents === 'none'), true);
  const fit = await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      inside: rect.top >= 0 && rect.bottom <= innerHeight + 1 && rect.left >= 0 && rect.right <= innerWidth + 1,
      noOverflow: [el, ...el.querySelectorAll('.ag-eval-body, fieldset, .ag-seq-grid')]
        .every(node => node.scrollWidth <= node.clientWidth + 1),
      fillsMobile: innerWidth > 767 || (rect.width === innerWidth && Math.abs(rect.height - innerHeight) <= 1)
    };
  });
  assert.deepEqual(fit, { inside: true, noOverflow: true, fillsMobile: true });
  assert.ok(await dialog.getByRole('button', { name: 'Guardar y seguir' }).isDisabled());
  if (file) await page.screenshot({ path: path.join(folder, file.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 80 });
}

async function saveEvaluation(page) {
  const dialog = page.locator(layer);
  await dialog.locator('input[name="task-result"][value="Prefiero no responder"]').check();
  await dialog.locator('input[name="task-seq"][value="NR"]').check();
  for (const control of await dialog.locator('input[name^="stage-"][value="Prefiero no responder"]').all()) {
    await control.check();
  }
  await page.locator('#task-save').click();
  await dialog.waitFor({ state: 'hidden' });
}

async function runCustomerCtas(page, frame, folder) {
  const close = async (task, selector) => {
    await frame.locator(selector || '[data-cierra-tarea="' + task + '"]').first().click();
    await blocked(page, folder, 'cta-' + task + '.png');
    const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);
    assert.equal(state.tareas[state.taskIndex].etapa, task);
    assert.equal(state.evaluando_origen, 'cta');
    await saveEvaluation(page);
  };
  await frame.locator('[data-solucion-accion="ya-se-maquina"]').click();
  await frame.locator('[data-maquina-id="bar"]').click();
  await close('T2', '.cmp-cierre [data-cierra-tarea="T2"]');
  await frame.locator('#m4FName').fill('Ana Prueba');
  await frame.locator('#m4FEmail').fill('ana.prueba@example.test');
  await frame.locator('#pack-contacto [name="consent"]').check();
  await frame.locator('[data-pack-accion="confirmar-contacto"]').click();
  await frame.locator('[data-cross="no-gracias"]').click();
  await close('T3');
  await page.locator('#ag-salto [data-action="jump"]').click();
  await close('T4');
  await page.locator('#ag-salto [data-action="jump"]').click();
  await frame.locator('#portal-franja [data-etapa="instalado"][aria-current="step"]').waitFor();
  await frame.locator('[data-mp-satisfaccion]').waitFor();
  await frame.locator('[data-portal-accion="ir-repetir"]').first().click();
  await close('T5');
  await frame.locator('#portal-tabs [data-portal-tab="ayuda"]').click();
  await frame.locator('#mp-form-ayuda select').selectOption({ index: 1 });
  await frame.locator('#mp-form-ayuda textarea').fill('La máquina de prueba necesita ayuda.');
  await close('T6', '#mp-panel-ayuda [data-cierra-tarea="T6"]');
  await page.locator('#question-next').waitFor();
}

async function openClientAtC02(frame, waitUntil) {
  await frame.waitForURL(/\/index\.html/);
  await frame.waitForFunction(() => Boolean(window.MarleyApp));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await frame.goto(local('index.html?test=sitio#C02'), { waitUntil });
      return;
    } catch (error) {
      if (attempt === 2 || !/net::ERR_ABORTED|interrupted by another navigation/.test(String(error.message))) throw error;
    }
  }
}

async function journeyGate(context, folder) {
  const early = await context.newPage();
  const viewport = early.viewportSize();
  try {
    const frame = await begin(early);
    // Un recurso lento mantiene el iframe antes de load; el CTA ya debe estar protegido.
    await early.route('**/recursos/escenas/hero/poster*.webp', async route => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    await openClientAtC02(frame, 'commit');
    const reallyEarly = await frame.waitForFunction(() => {
      const button = document.querySelector('[data-cierra-tarea="T1"]');
      if (!button?.isConnected) return null;
      const beforeLoad = document.readyState !== 'complete';
      button.click();
      return { beforeLoad };
    });
    assert.equal((await reallyEarly.jsonValue()).beforeLoad, true);
    await blocked(early, folder, '01-cta-inmediato.png');
    assert.match(frame.url(), /#C02$/);
    await saveEvaluation(early);
    await frame.waitForURL(/#C04$/);
    assert.equal(await early.evaluate(key => JSON.parse(localStorage.getItem(key)).taskIndex, sessionKey), 1);
    await runCustomerCtas(early, frame, folder);
  } finally { await early.close(); }

  const altContext = await context.browser().newContext({
    viewport, reducedMotion: 'reduce', isMobile: viewport.width < 768, hasTouch: viewport.width < 768
  });
  const alt = await altContext.newPage();
  try {
    const frame = await begin(alt);
    await openClientAtC02(frame, 'domcontentloaded');
    await frame.locator('.ux-hero [data-m9-open]').click();
    await blocked(alt, folder, '02-ruta-alternativa.png');
    assert.equal(await alt.locator('#ag-eval [data-action="return-task"]').count(), 0);
    await alt.keyboard.press('Escape');
    assert.equal(await alt.locator(layer).isVisible(), true);
    await saveEvaluation(alt);
    assert.equal(await alt.evaluate(key => JSON.parse(localStorage.getItem(key)).taskIndex, sessionKey), 1);

    await frame.evaluate(() => window.MarleyApp.go('C09', { evaluation: true }));
    await frame.locator('#portal-tabs').waitFor();
    // C09 es la confirmación. Tras responder, un cambio de pestaña también es una transición.
    await blocked(alt, folder, '03-ruta-marleyapp.png');
    await saveEvaluation(alt);
    await frame.locator('#portal-tabs [data-portal-tab="ayuda"]').click();
    await blocked(alt, folder, '04-pestana-del-portal.png');
    await saveEvaluation(alt);
    assert.equal(await alt.evaluate(key => JSON.parse(localStorage.getItem(key)).taskIndex, sessionKey), 5);
  } finally { await altContext.close(); }

  const historyContext = await context.browser().newContext({
    viewport, reducedMotion: 'reduce', isMobile: viewport.width < 768, hasTouch: viewport.width < 768
  });
  try {
    const page = await historyContext.newPage();
    const frame = await begin(page);
    await openClientAtC02(frame, 'domcontentloaded');
    // Una página posterior puede quedar en el historial de una sesión reanudada.
    await frame.evaluate(() => {
      history.pushState(null, '', '#C09');
      history.pushState(null, '', '#C02');
      history.back();
    });
    await frame.waitForURL(/#C09$/);
    await blocked(page, folder, '05-volver-en-historial.jpg');
    await saveEvaluation(page);
    const step = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).taskIndex, sessionKey);
    assert.ok(step > 0, 'Volver por el historial a una etapa posterior requiere la evaluación');
  } finally { await historyContext.close(); }
}

async function crmGate(context, role, folder) {
  const page = await context.newPage();
  try {
    await page.addInitScript(key => { if (location.pathname.endsWith('/prueba.html')) localStorage.removeItem(key); }, sessionKey);
    const frame = await begin(page, role);
    const choose = frame.locator('[data-c2="choose-role"][data-role="' + role + '"]');
    const menu = frame.locator('.crm2-nav');
    await choose.or(menu).first().waitFor();
    if (await choose.isVisible()) await choose.click();
    const routes = { ventas: 'R08', marketing: 'R13', jefatura: 'R07' };
    await menu.locator('[data-c2-go="' + routes[role] + '"]').click();
    await blocked(page, folder, '05-menu-crm-' + role + '.png');
    await saveEvaluation(page);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).taskIndex, sessionKey), role === 'ventas' ? 2 : 1);
  } finally { await page.close(); }
}

async function main() {
  const configurations = ['chrome', 'msedge'].flatMap(channel =>
    [[1280, 551], [390, 844], [360, 640]].map(([width, height], index) =>
      [channel, ['ventas', 'marketing', 'jefatura'][index], { width, height }]));
  for (const [channel, role, viewport] of configurations) {
    if (process.env.MARLEY_GATE_SIZE && process.env.MARLEY_GATE_SIZE !== viewport.width + 'x' + viewport.height) continue;
    if (process.env.MARLEY_GATE_BROWSER && process.env.MARLEY_GATE_BROWSER !== channel) continue;
    const browser = await chromium.launch({ channel });
    const folder = path.join(evidence, channel + '-' + viewport.width + 'x' + viewport.height);
    fs.mkdirSync(folder, { recursive: true });
    try {
      const errors = [];
      const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: 'reduce', isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
      // El sondeo /api/ping de index.html (solo en localhost) responde 404 en un servidor estático: no es un error de la prueba.
      const sondeo = url => /\/api\/ping(\?|$)/.test(url);
      context.on('page', page => {
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !sondeo(message.location()?.url || '')) errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400 && !sondeo(response.url())) errors.push(`HTTP ${response.status()} ${response.url()}`); });
      });
      const guidedPage = await context.newPage();
      await guided(guidedPage, role, folder);
      await guidedPage.close();
      if (channel === 'chrome' && role === 'ventas') await moderated(await context.newPage(), folder);
      if (channel === 'chrome' && role === 'marketing') await acquisition(await context.newPage());
      await crmGate(context, role, folder);
      const client = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
      try { await journeyGate(client, folder); }
      finally { await client.close(); }
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS', channel, role, viewport);
    } finally { await browser.close(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
