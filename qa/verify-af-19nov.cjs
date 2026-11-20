const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('./playwright-system-chrome.cjs');
const { completeDiagnostic } = require('./complete-diagnostic.cjs');

const base = process.argv[2] || 'http://127.0.0.1:8894';
const repo = path.join(__dirname, '..');
const output = path.join(__dirname, 'capturas-af-19nov', 'verificacion.json');
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
  if (!await page.locator('.b2c-business-link:visible').count()) await page.locator('.b2c-menu-details > summary').click();
  await click(page, 'C01', '.b2c-business-link:visible', () => screen(page, 'C02'));
  await click(page, 'C02', '.ux-hero [data-m10-unknown]', () => screen(page, 'C04'));
  await click(page, 'C04', '#r4Datos [data-r4-next]:visible', () => text(page, '#r4Datos .r4-msg', /Elige el tipo de negocio/));
  await click(page, 'C04', '#r4Datos [data-v="Hotel"]', () => page.locator('#r4Datos [data-v="Hotel"][aria-pressed="true"]').waitFor());
  await completeDiagnostic(page, { business: 'Hotel' });
  await screen(page, 'C05');
  await click(page, 'C05', '.af-proposal-details > summary', () => open(page, '.r3-proposal-machine .r5-porque'));
  await click(page, 'C05', '[data-r5-top-accept]', () => screen(page, 'C06'));
  await text(page, '.af-folio', /Folio/);
  await click(page, 'C06', '[data-af-contract] > summary', () => open(page, '[data-cycle-action="sign-contract"]'));
  await click(page, 'C06', '[data-cycle-action="sign-contract"]', () => text(page, '[data-af-contract] [role="status"]', /Contrato simulado registrado/));
  await click(page, 'C06', '[data-af-portal-target="r3-help"]', async () => {
    await screen(page, 'C09');
    await open(page, 'details.r3-support-fold[open] #r3-help');
  });
  await go(page, 'C06');
  await click(page, 'C06', '[data-af-portal-target="r3-recommend"]', async () => {
    await screen(page, 'C09');
    await open(page, 'details#r3-recommend[open] .m5-cycle');
  });
  await page.evaluate(() => M4Journey.jumpDays(30));
  await click(page, 'C09', '[data-cycle-action="confirm-order"]', () => open(page, '[data-r3-confirm-received]'));
  await click(page, 'C09', '[data-r3-confirm-received]:visible', () => open(page, '[data-r3-advance-time]:visible'));
  await click(page, 'C09', '[data-r3-advance-time]:visible', () => open(page, '[data-r3-repeat-summary]:visible'));
  await click(page, 'C09', '[data-r3-repeat-summary]:visible', () => open(page, '#r3-repeat-summary form'));
  await click(page, 'C09', '#r3-repeat-summary [type="submit"]', () => text(page, '.r3-repeat-done h2', /Reposición confirmada/i));
  assert.equal(await page.evaluate(() => M4.get().customerCycle.orders.length), 2);
  assert.equal(await page.evaluate(() => M4.get().emails.filter(email => email.orderId).length), 2);
  await click(page, 'C09', '[data-r3-back-portal]', () => open(page, '.r3-order-head'));

  await go(page, 'C03');
  const c03 = page.locator('#m4Contact details > summary');
  if (await c03.count()) await click(page, 'C03', '#m4Contact details > summary', () => open(page, '#m4Contact details[open]'));
  await go(page, 'C07');
  await click(page, 'C07', '#m4-main [data-go="C06"]:visible', () => screen(page, 'C06'));
  await go(page, 'C08');
  await click(page, 'C08', '#m4-main :is([data-a="quote-biz"], [data-a="case-resume"]):visible', () => page.waitForFunction(() => document.body.dataset.current !== 'C08'));
  await go(page, 'C10');
  await click(page, 'C10', '[data-r5-carro-abrir]', () => open(page, '#r5-carro.is-abierto'));
  await click(page, 'C10', '#r5-carro [data-r5-carro-cerrar]', () => page.locator('#r5-carro').waitFor({ state: 'hidden' }));
  await click(page, 'C10', '.af-pack-details > summary', () => open(page, '.af-pack-details[open] .r3-pack-lines'));
  await click(page, 'C10', 'details[data-r7-fold="catalogo-productos"] > summary', () => open(page, 'details[data-r7-fold="catalogo-productos"] .r5-prod[data-r5-prod]'));
}

const firstCrmAction = {
  R02: '[data-c2="toggle-referrals"]', R03: '[data-c2="open-account"]', R04: '[data-c2="recommend-account"]',
  R06: '.crm2-main details > summary', R08: '.crm2-main details > summary', R09: '.crm2-main details > summary',
  R10: '[data-c2="open-account"]', R12: '[data-c2="open-lead"]', R13: '.crm2-campaign details > summary',
  R14: '[data-c2="open-account"]', R15: '[data-c2="open-account"]',
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
  await page.locator('[data-crm2-draft-segment]').selectOption('OCS');
  await click(page, 'R11', '[data-c2="generate-marketing-draft"]', () => text(page, '[data-crm2-draft-preview]', /Borrador creado[\s\S]*puntos de café[\s\S]*para oficinas/i));
  await click(page, 'R11', '[data-c2="confirm-marketing-draft"]', () => text(page, '[data-crm2-draft-preview]', /Borrador confirmado/));
  for (const [route, selector] of Object.entries(firstCrmAction)) {
    if (route === 'R04') continue;
    await go(page, route);
    const target = page.locator(`#crm-v2-root ${selector}:visible`).first();
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
  assert.deepEqual(fs.readFileSync(path.join(repo, 'index.html')), fs.readFileSync(path.join(repo, 'prototipo.html')));
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
      return { heading: doc.querySelectorAll('h1').length, metadata, ld, links, images };
    };
    const old = await page.evaluate(parser, before);
    const current = await page.evaluate(parser, after);
    assert.equal(current.heading, 1, `${file}: H1 del HTML`);
    assert.deepEqual(current.metadata, old.metadata, `${file}: metadatos`);
    assert.deepEqual(current.ld, old.ld, `${file}: JSON-LD`);
    assert.deepEqual(current.links, old.links, `${file}: destinos HTML`);
    assert.deepEqual(current.images, old.images, `${file}: imágenes y texto alternativo`);
    evidence.push(file);
  }
  return evidence;
}

(async () => {
  const browser = await chromium.launch();
  try {
    let pages;
    for (const [width, height] of [[1280,551], [390,844]]) {
      for (const journey of [buyer, crm, guidedTest]) {
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
