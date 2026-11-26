const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('./playwright-system-chrome.cjs');
const { completeDiagnostic } = require('./complete-diagnostic.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:8896').replace(/\/$/, '');
const repo = path.join(__dirname, '..');
const output = path.resolve(process.env.PILOTO_CLICK_OUT || '../marley-premium-20nov-evidencia/verificacion.json');
const audit = [];

async function screen(page, route) {
  await page.waitForFunction(expected => document.body.dataset.current === expected, route);
  if (route.startsWith('R')) await page.locator('#crm-v2-root h1:visible').first().waitFor({ state: 'visible' });
  const visibleH1 = await page.locator('h1:visible').count();
  assert.equal(visibleH1, 1, `${route}: H1 visible`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route}: desborde`);
}

async function go(page, route) {
  await page.evaluate(route => MarleyApp.go(route, { evaluation: true }), route);
  await screen(page, route);
}

async function click(page, route, selector, result) {
  assert.equal(await page.evaluate(() => document.body.dataset.current), route);
  const target = page.locator(selector).first();
  const label = (await target.innerText({ timeout: 8000 })).trim() || selector;
  await target.click({ timeout: 8000 });
  await result();
  const { width, height } = page.viewportSize();
  audit.push({ viewport: `${width}x${height}`, route, label, response: true });
}

async function open(page, selector) { await page.locator(selector).first().waitFor({ state: 'visible', timeout: 8000 }); }
async function text(page, selector, pattern) {
  await open(page, selector);
  assert.match(await page.locator(selector).first().innerText(), pattern);
}

async function guidedTest(page) {
  await page.goto(`${base}/prueba.html`, { waitUntil: 'domcontentloaded' });
  const consent = page.locator('#welcome-next');
  await consent.waitFor();
  assert.equal(await consent.isDisabled(), true, 'La prueba requiere consentimiento');
  await page.locator('#consent-check').check();
  await consent.click();
  await page.locator('[data-path="A"]').click();
  await page.locator('#profile-choice').selectOption('hotel');
  await page.locator('#choice-next').click();
  const next = page.locator('#question-next');
  await next.waitFor();
  assert.equal(await next.isDisabled(), true, 'La pregunta obligatoria bloquea el avance sin respuesta');
  await page.locator('#skip-answer').check();
  assert.equal(await next.isEnabled(), true, 'Prefiero no responder habilita el avance');
  await next.click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1'));
    return state?.respuestas.some(row => row.omitida && row.respuesta_texto === 'Prefiero no responder');
  });
}

async function buyer(page) {
  await page.goto(`${base}/index.html?motion=off&test=personas#C01`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__r5Instalado === true);
  await screen(page, 'C01');
  await click(page, 'C01', '.b2c-chat', () => open(page, '#m7-title'));
  await page.keyboard.press('Escape');
  if (!await page.locator('.b2c-business-link:visible').count()) await click(page, 'C01', '.b2c-menu-details > summary', () => open(page, '.b2c-business-link:visible'));
  await click(page, 'C01', '.b2c-business-link:visible', () => screen(page, 'C02'));
  // El CTA T1 se ofrece antes y después de la comparación de máquinas.
  await click(page, 'C02', '[data-cierra-tarea="T1"]', () => screen(page, 'C04'));
  await click(page, 'C04', '#r4Datos [data-r4-next]:visible', () => text(page, '#r4Datos .r4-msg', /Elige el tipo de negocio/));
  await click(page, 'C04', '#r4Datos [data-v="Hotel"]', () => page.locator('#r4Datos [data-v="Hotel"][aria-pressed="true"]').waitFor());
  await completeDiagnostic(page, { business: 'Hotel' });
  await screen(page, 'C05');
  await text(page, '.premium-quote-total', /Total neto referencial\s*\$\s*[\d.]+\s*\+ IVA/i);
  await text(page, '.cmp-maquina .cmp-motivo', /\S/);
  await page.locator('.cmp-cambios > details > summary').click();
  await page.locator('.cmp-cambios-lista > details > summary').click();
  await click(page, 'C05', '.cmp-cambios [data-m7-open="ayuda"]', () => open(page, '#m7-title, #agente-panel:not([hidden])'));
  await page.keyboard.press('Escape');
  await click(page, 'C05', '[data-pack-accion="ver-productos"]', () => open(page, '#pack-productos .cmp-deck'));
  assert.equal(await page.locator('#pack-resumen [data-pack-total]').getAttribute('data-pack-total'),
    await page.locator('#pack-productos [data-pack-total]').getAttribute('data-pack-total'), 'El total coincide con el detalle');
  await click(page, 'C05', '[data-pack-accion="cerrar-productos"]', () => page.locator('#pack-productos').waitFor({state:'hidden'}));
  await click(page, 'C05', '[data-pack-accion="aceptar"]', () => open(page, '#pack-contacto, #cross-sell'));
  if (await page.locator('#pack-contacto').isVisible()) {
    await page.locator('#pack-contacto [name="name"]').fill('Prueba Piloto');
    await page.locator('#pack-contacto [name="email"]').fill('piloto@example.test');
    await page.locator('#pack-contacto [name="consent"]').check();
    await click(page, 'C05', '[data-pack-accion="confirmar-contacto"]', () => open(page, '#cross-sell'));
  }
  await click(page, 'C05', '[data-cross="no-gracias"]', () => screen(page, 'C06'));
  await text(page, 'h1', /Tu pack quedó confirmado/i);
  await click(page, 'C06', '[data-cierra-tarea="T3"]', () => open(page, '#portal-tabs'));
  await click(page, 'C09', '#portal-tabs [data-portal-tab="ayuda"]', () => open(page, '#mp-panel-ayuda'));
  await click(page, 'C09', '#portal-tabs [data-portal-tab="recomendar"]', () => open(page, '#mp-panel-recomendar'));
  await click(page, 'C09', '#portal-tabs [data-portal-tab="pedido"]', () => open(page, '#portal-franja'));
  await click(page, 'C09', '[data-portal-accion="firmar-contrato"]', () => open(page, '[data-mp-dialogo]'));
  await click(page, 'C09', '[data-portal-accion="confirmar-firma"]', () => open(page, '[data-etapa="firmado"][aria-current="step"]'));
  await click(page, 'C09', '[data-portal-accion="avanzar-tiempo"]', async () => {
    await open(page, '[data-etapa="instalado"][aria-current="step"]');
    await open(page, '[data-mp-satisfaccion]');
  });
  await click(page, 'C09', '[data-portal-accion="avanzar-tiempo"]', () => open(page, '[data-portal-accion="ir-repetir"]'));
  await click(page, 'C09', '[data-portal-accion="ir-repetir"]', () => open(page, '#mp-form-repetir'));
  await click(page, 'C09', '[data-cierra-tarea="T5"]', () => text(page, '.mp-aviso-ok', /Repetición confirmada/i));
  assert.equal(await page.evaluate(() => M4.get().customerCycle.orders.length), 2);
  assert.equal(await page.evaluate(() => M4.get().emails.filter(email => email.orderId).length), 2);
  await click(page, 'C09', '#portal-tabs [data-portal-tab="pedido"]', () => open(page, '#portal-franja'));

  await go(page, 'C03');
  const c03 = page.locator('#m4Contact details > summary');
  if (await c03.count()) await click(page, 'C03', '#m4Contact details > summary', () => open(page, '#m4Contact details[open]'));
  await go(page, 'C07');
  await click(page, 'C07', '#m4-main [data-go="C06"]:visible', () => screen(page, 'C06'));
  await go(page, 'C08');
  await click(page, 'C08', '#m4-main :is([data-a="quote-biz"], [data-a="case-resume"]):visible', () => page.waitForFunction(() => document.body.dataset.current !== 'C08'));
  await go(page, 'C10');
  if (page.viewportSize().width < 900) {
    await click(page, 'C10', '[data-r5-carro-abrir]', () => open(page, '#r5-carro.is-abierto'));
    await click(page, 'C10', '#r5-carro [data-r5-carro-cerrar]', () => page.locator('#r5-carro').waitFor({ state: 'hidden' }));
  } else {
    await click(page, 'C10', '[data-r5-carro-abrir]', () => open(page, '#r5-carro.r5-pulso'));
  }
  await click(page, 'C10', 'details[data-r7-fold="catalogo-productos"] > summary', () => open(page, 'details[data-r7-fold="catalogo-productos"] .r5-prod[data-r5-prod]'));
}

const firstCrmAction = {
  R02: '[data-c2="toggle-referrals"]', R03: '[data-c2="open-account"]', R04: '[data-c2="recommend-account"]',
  R06: '.crm2-main details > summary', R08: '.crm2-main details > summary', R09: '.crm2-main details > summary',
  R10: '[data-c2="open-account"]', R12: '[data-c2="open-lead"]', R13: '.crm2-campaign details > summary',
  R14: '.crm2-main details > summary', R15: '[data-c2="open-account"]',
  R16: '[data-c2="reply-request"]', R17: 'details.crm2-buyer-fold > summary',
};

async function crm(page) {
  await page.goto(`${base}/index.html?motion=off#R00`, { waitUntil: 'load' });
  await click(page, 'R00', '[data-c2="choose-role"][data-role="ventas"]', () => screen(page, 'R01'));
  await click(page, 'R01', '#crm-v2-root [data-c2="open-account"]:visible', () => screen(page, 'R04'));
  await click(page, 'R04', firstCrmAction.R04, () => text(page, '#crm2-recommend-title', /Recomendar/));
  await click(page, 'R04', '[data-c2="save-account-recommendation"]', () => text(page, '[data-inline-panel]', /Invitación de prueba guardada/));
  await go(page, 'R05');
  for (const label of ['Referidos', 'Recuperación', 'Permisos']) {
    const selector = `.crm2-approval-queue [data-c2="review-approval"]:has-text("${label}")`;
    const id = await page.locator(selector).getAttribute('data-id');
    const row = `[data-approval="${id}"], [data-followup="${id}"]`;
    await click(page, 'R05', selector, async () => {
      await screen(page, 'R07');
      await page.waitForFunction(selector => {
        const review = document.querySelector(selector)?.getBoundingClientRect();
        return review && review.bottom > 0 && review.top < innerHeight;
      }, row, { timeout: 8000 });
    });
    if (label === 'Referidos') {
      const approval = page.locator(row);
      assert.equal(await approval.locator('[data-decision="aprobada"]').isDisabled(), true);
      await approval.locator('[data-approval-note]').fill('Verificar permiso y vínculo B2B.');
      await click(page, 'R07', `[data-approval="${id}"] [data-decision="pidio_info"]`, () => text(page, '[data-crm2-toast]', /Información solicitada/));
    }
    if (label === 'Permisos') await click(page, 'R07', `[data-followup="${id}"] [data-c2="review-followup"]`, () => open(page, '[data-crm2-permissions][open]'));
    await go(page, 'R05');
  }
  await go(page, 'R11');
  const campaignFold = 'details:has([data-crm2-draft-segment]) > summary';
  if (await page.locator(campaignFold).count()) {
    await click(page, 'R11', campaignFold, () => open(page, '[data-crm2-draft-segment]'));
  }
  await go(page, 'R13');
  await page.locator('[data-crm2-draft-segment]').selectOption('OCS');
  await click(page, 'R13', '[data-c2="generate-marketing-draft"]', () => text(page, '[data-crm2-draft-preview]', /Borrador creado[\s\S]*puntos de café[\s\S]*para oficinas/i));
  await click(page, 'R13', '[data-c2="confirm-marketing-draft"]', () => text(page, '[data-crm2-draft-preview]', /Borrador confirmado/));
  for (const [route, selector] of Object.entries(firstCrmAction)) {
    if (route === 'R04') continue;
    await go(page, route);
    const target = page.locator(`#crm-v2-root ${selector}:visible`).first();
    assert.ok(await target.count(), `${route}: control principal visible (${selector})`);
    const type = await target.evaluate(element => element.tagName === 'SUMMARY' ? 'fold' : element.dataset.c2);
    await click(page, route, `#crm-v2-root ${selector}:visible`, async () => {
      if (type === 'fold') assert.equal(await target.evaluate(element => element.parentElement.open), true);
      else if (type === 'toggle-referrals') await open(page, '[data-c2="toggle-referrals"].is-selected');
      else if (type === 'reply-request') await text(page, '[data-crm2-toast]', /Respuesta preparada/);
      else await screen(page, 'R04');
    });
  }
}

async function seo(page) {
  const pages = ['index.html', 'prototipo.html', 'blog-empresas.html', 'guia-servicio-cafe.html', ...fs.readdirSync(path.join(repo,'captacion/landing')).filter(name => name.endsWith('.html')).map(name => `captacion/landing/${name}`)];
  assert.ok(fs.readFileSync(path.join(repo, 'index.html')).equals(fs.readFileSync(path.join(repo, 'prototipo.html'))), 'Los dos HTML del prototipo son idénticos');
  const evidence = [];
  for (const file of pages) {
    const before = execFileSync('git', ['show', `204ffb2:${file}`], { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const after = fs.readFileSync(path.join(repo, file), 'utf8');
    const parser = source => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      const metadata = [...doc.head.querySelectorAll('title,meta[name],meta[property],link[rel="canonical"]')].map(el => el.outerHTML);
      const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent));
      const links = [...new Set([...doc.querySelectorAll('a[href]')].map(el => el.getAttribute('href')))].sort();
      const images = [...doc.querySelectorAll('img[alt]')].map(el => [el.getAttribute('src'), el.alt]);
      return { heading: doc.querySelectorAll('h1').length, metadata, ld, links, images, tieneCondiciones: Boolean(doc.querySelector('#condiciones')) };
    };
    const old = await page.evaluate(parser, before);
    const current = await page.evaluate(parser, after);
    assert.equal(current.heading, 1, `${file}: H1 del HTML`);
    assert.deepEqual(current.metadata, old.metadata, `${file}: metadatos`);
    assert.deepEqual(current.ld, old.ld, `${file}: JSON-LD`);
    const esPrototipo = file === 'index.html' || file === 'prototipo.html';
    const enlacesEsperados = esPrototipo ? [...old.links, '#condiciones'].sort() : old.links;
    assert.deepEqual(current.links, enlacesEsperados, `${file}: destinos HTML`);
    if (esPrototipo) assert.ok(current.tieneCondiciones, `${file}: ancla de condiciones del HTML inicial`);
    assert.deepEqual(current.images, old.images, `${file}: imágenes y texto alternativo`);
    evidence.push(file);
  }
  return evidence;
}

async function delayedBuyerCrm(page) {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/captacion/crm/compradores.json', async request => {
    await hold;
    await request.continue();
  });
  try {
    await page.goto(new URL('index.html?motion=off#R00', base + '/').href, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-c2="choose-role"][data-role="ventas"]').click();
    await screen(page, 'R01');
    await go(page, 'R17');
    const root = page.locator('#crm-v2-root');
    assert.match(await root.innerText(), /cargando/i);
    release();
    await open(page, '#crm-v2-root details.crm2-buyer-fold > summary');
    assert.doesNotMatch(await root.innerText(), /cargando/i);
  } finally {
    release();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    let pages;
    for (const [width, height] of [[1280,551], [390,844]]) {
      for (const journey of [buyer, crm, guidedTest, delayedBuyerCrm]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await journey(page);
          assert.deepEqual(errors, [], `${journey.name} a ${width}×${height}`);
          if (!pages) pages = await seo(page);
        } finally { await context.close(); }
      }
    }
    if (!process.argv.includes('--no-write')) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ status: 'PASS', clickCount: audit.length, unresponsive: 0, guidedTest: 'PASS a 1280×551 y 390×844', seo: pages, audit }, null, 2) + '\n');
    }
    console.log(`PASS ${audit.length} clics y ${pages.length} archivos SEO`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
