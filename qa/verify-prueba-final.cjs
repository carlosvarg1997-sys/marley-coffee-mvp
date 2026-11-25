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
  if (role === 'ventas') {
    await inside.locator('[data-c2="open-account"]').first().click();
    await inside.locator('[data-c2="recommend-account"]').click();
    await inside.locator('#crm2-recommend-title').waitFor();
  } else if (role === 'marketing') {
    await inside.locator('[data-crm2-draft-segment]').selectOption('OCS');
    await inside.locator('[data-c2="generate-marketing-draft"]').click();
    assert.match(await inside.locator('[data-crm2-draft-preview]').innerText(), /Borrador creado/);
  } else {
    await inside.locator('.crm2-approval-queue [data-c2="review-approval"]:has-text("Referidos")').click();
    await inside.locator('body[data-current="R07"] #crm-v2-root h1').waitFor();
  }
  // La tarea se cierra con el CTA del sitio que la cierra (data-cierra-tarea de la tarea en curso). Ese CTA abre #task-evaluation.
  const enCurso = await page.evaluate(() => {
    const estado = JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1') || 'null');
    return estado?.tareas?.[estado.taskIndex]?.etapa || null;
  });
  assert.ok(enCurso, 'Debe haber una tarea en curso en la prueba');
  // El CTA de cierre puede estar en otra pantalla del CRM (por ejemplo, la fila de un contacto de búsqueda en la cola de Ventas): se busca en las pantallas del rol.
  const pantallasRol = { ventas: ['R01', 'R03', 'R02'], marketing: ['R11', 'R12'], jefatura: ['R05', 'R07'] }[role] || [];
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

async function main() {
  for (const [channel, role, viewport] of [
    ['chrome', 'ventas', { width: 1280, height: 551 }],
    ['chrome', 'marketing', { width: 390, height: 844 }],
    ['msedge', 'jefatura', { width: 390, height: 844 }],
  ]) {
    const browser = await chromium.launch({ channel });
    const folder = path.join(evidence, channel + '-' + role);
    fs.mkdirSync(folder, { recursive: true });
    try {
      const errors = [];
      const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: 'reduce' });
      // El sondeo /api/ping de index.html (solo en localhost) responde 404 en un servidor estático: no es un error de la prueba.
      const sondeo = url => /\/api\/ping(\?|$)/.test(url);
      context.on('page', page => {
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !sondeo(message.location()?.url || '')) errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400 && !sondeo(response.url())) errors.push(`HTTP ${response.status()} ${response.url()}`); });
      });
      await guided(await context.newPage(), role, folder);
      if (role === 'ventas') await moderated(await context.newPage(), folder);
      if (role === 'marketing') await acquisition(await context.newPage());
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS', channel, role, viewport);
    } finally { await browser.close(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
