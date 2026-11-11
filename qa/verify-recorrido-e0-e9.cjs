// Recorrido local E0–E9. Solo datos ficticios; no se envían mensajes ni pedidos reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'EVIDENCIA_10NOV');
const crmContract = JSON.parse(fs.readFileSync(path.join(root, 'captacion/crm/compradores.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => { if (error) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(bytes); });
});

function verifySearchDestinations() {
  const html = fs.readFileSync(path.join(root, 'PRUEBA_CON_PERSONAS/serp-seo-aeo-geo.html'), 'utf8');
  assert.doesNotMatch(html, /blog-empresas\.html/i, 'the SERP no longer links to the missing blog page');
  assert.doesNotMatch(html, /captacion\/landing\/empresas\.html/i, 'the P02 control landing stays out of simulated search results');
  const routes = [...html.matchAll(/\.\.\/(captacion\/(?:landing|soluciones|contenidos)\/[^'"\s?#)]+\.html)/g)].map((match) => match[1]);
  assert.ok(routes.some((route) => route === 'captacion/contenidos/index.html'));
  assert.ok(routes.some((route) => route === 'captacion/soluciones/restaurantes.html'));
  assert.ok(routes.some((route) => route === 'captacion/landing/restaurantes.html'));
  for (const route of new Set(routes)) assert.ok(fs.existsSync(path.join(root, route)), `SERP destination exists: ${route}`);
}

async function makeContext(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 400 ? 844 : 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { ctx, page, errors };
}
async function journey(browser, base, width) {
  const { ctx, page, errors } = await makeContext(browser, width);
  const evidencePrefix = path.join(evidence, `A1_${width}`);
  try {
    await page.goto(new URL('/index.html?test=sitio&qa=1', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.locator('button[data-q="cliente"]').click();
    await page.locator('button[data-p="restaurante"]').click();
    await page.locator('#m4tNombre').fill('Camila Rojas');
    await page.locator('#m4tOk').check();
    if (await page.locator('#m4tRec').count()) await page.locator('#m4tRec').uncheck();
    await page.locator('#m4tGo').click();
    await page.waitForURL(/PRUEBA_CON_PERSONAS\/serp-seo-aeo-geo\.html/, { waitUntil: 'domcontentloaded' });
    await page.locator('#query').fill('café para restaurante');
    await page.locator('#search button[type="submit"]').click();
    await page.locator('#serp-list').waitFor({ state: 'visible' });
    await page.screenshot({ path: evidencePrefix + '_E0_SERP.png', fullPage: true });
    const organicHref = await page.locator('#organic-title').getAttribute('href');
    const organic = new URL(organicHref, base);
    assert.match(organic.pathname, /\/captacion\/soluciones\/restaurantes\.html$/);
    assert.equal(organic.searchParams.get('utm_source'), 'google');
    assert.equal(organic.searchParams.get('utm_medium'), 'organic');
    assert.equal(organic.searchParams.get('utm_campaign'), 'horeca_captacion');
    for (const [surface, screen] of [['acceso-packs', '#C10'], ['acceso-maquinas', '#C11']]) {
      const link = new URL(await page.locator(`[data-surface="${surface}"]`).getAttribute('href'), base);
      assert.match(link.pathname, /\/index\.html$/);
      assert.equal(link.hash, screen);
    }

    const ad = page.locator('#sponsored-title');
    const adHref = await ad.getAttribute('href'); const adUrl = new URL(adHref, base);
    assert.match(adUrl.pathname, /\/captacion\/landing\/restaurantes\.html$/);
    assert.equal(adUrl.searchParams.get('utm_source'), 'google');
    assert.equal(adUrl.searchParams.get('utm_medium'), 'cpc');
    assert.equal(adUrl.searchParams.get('utm_campaign'), 'CL_GOOGLE_SEARCH_RESTAURANTES_COTIZA_202612_V01');
    assert.equal(adUrl.searchParams.get('utm_id'), 'mc_hor_001');
    await ad.click();
    await page.locator('#f-nombre').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await page.screenshot({ path: evidencePrefix + '_E1_landing.png', fullPage: true });
    await page.locator('#f-nombre').fill('Camila Rojas');
    await page.locator('#f-correo').fill('camila.rojas@example.com');
    await page.locator('#f-consent').check();
    await page.locator('#f-marketing').check();
    await page.locator('fieldset[data-paso="1"] button[type="submit"]').click();
    await page.locator('#f-empresa').fill('Restaurante Los Aromos');
    await page.locator('#f-telefono').fill('912345678');
    await page.locator('[data-accion="enviar"]').click();
    await page.locator('#ld-exito').waitFor({ state: 'visible' });
    const handoffHref = await page.locator('#ld-continuar').getAttribute('href');
    assert.doesNotMatch(handoffHref, /camila\.rojas|912345678|Los%20Aromos/i);
    await page.locator('#ld-continuar').click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C04');
    await page.locator('.m5-qcard').waitFor({ state: 'visible' });

    const imported = await page.evaluate(() => ({
      test: M4.TEST, score: M4.score(), formEvents: M4.get().events.filter((e) => e.key === 'form1').length,
      lead: M4.get().lead, handoff: M4.get().landingHandoff, focus: M4.landingFocus('C04'),
      visibleMenu: Boolean(document.querySelector('.m5-nav, .ux-mobile-nav')),
      cycleEvent: M4.get().events.find((e) => e.eventName === 'lead_created')
    }));
    assert.equal(imported.test, 'sitio');
    assert.equal(imported.score, 20);
    assert.equal(imported.formEvents, 1);
    assert.equal(imported.lead.company, 'Restaurante Los Aromos');
    assert.equal(imported.lead.consent, true);
    assert.equal(imported.lead.marketingConsent, true);
    assert.equal(imported.lead.landing.buyer, 'restaurante');
    assert.equal(imported.lead.landing.calc.tocado, false);
    assert.equal(imported.lead.attribution.firstTouch.params.utm_campaign, adUrl.searchParams.get('utm_campaign'));
    assert.equal(imported.lead.attribution.lastTouch.params.utm_campaign, adUrl.searchParams.get('utm_campaign'));
    assert.equal(imported.handoff.id, imported.lead.landing.id);
    assert.equal(imported.focus, true);
    assert.equal(imported.visibleMenu, false);
    assert.equal(imported.cycleEvent?.pts, 0);
    await page.screenshot({ path: evidencePrefix + '_E2_portal_C04.png', fullPage: true });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.m5-qcard').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => ({ score: M4.score(), formEvents: M4.get().events.filter((e) => e.key === 'form1').length, cycleLeads: M4.get().events.filter((e) => e.eventName === 'lead_created').length })), { score: 20, formEvents: 1, cycleLeads: 1 });

    await page.evaluate(() => { location.hash = '#C03'; });
    await page.locator('#m4Contact').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.m5-nav, .ux-mobile-nav').count(), 0);
    await page.screenshot({ path: evidencePrefix + '_E3_focus_C03.png', fullPage: true });
    await page.evaluate(() => { location.hash = '#C04'; });
    await page.locator('.m5-qcard').waitFor({ state: 'visible' });
    await page.locator('[data-a="answer"][data-k="negocio"][data-v="Restaurante"]').click();
    await page.locator('[data-a="next"]').click();
    await page.locator('#m5Comuna').selectOption({ label: 'Las Condes' });
    await page.locator('[data-a="next"]').click();
    await page.locator('[data-a="next"]').click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C10');
    await page.locator('.m9-catalog').waitFor({ state: 'visible' });
    await page.locator('#m9-continue').click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C04');
    await page.locator('.m5-qcard').waitFor({ state: 'visible' });
    await page.locator('[data-a="next"]').click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C05');
    await page.locator('.m5-propsec').waitFor({ state: 'visible' });
    await page.screenshot({ path: evidencePrefix + '_E4_focus_C05.png', fullPage: true });
    await page.getByRole('heading', { name: 'Bandeja de seguimiento' }).waitFor();
    const inbox = await page.evaluate(() => M4.get().emails.filter((e) => e.journeyCode).map((e) => ({ code: e.journeyCode, href: e.href, subject: e.subject })));
    assert.ok(inbox.some((e) => e.code === 'E01'));
    assert.ok(inbox.some((e) => e.code === 'E02'));
    for (const code of ['E01', 'E02']) {
      const item = inbox.find((e) => e.code === code); const u = new URL(item.href, base);
      assert.equal(u.pathname, `/captacion/correos/${code}.html`);
      assert.ok(fs.existsSync(path.join(root, 'captacion', 'correos', `${code}.html`)));
      assert.equal(u.searchParams.get('utm_source'), 'email');
      assert.equal(u.searchParams.get('utm_medium'), 'email');
      assert.equal(u.searchParams.get('utm_campaign'), code);
    }
    const e01 = inbox.find((item) => item.code === 'E01');
    const e01Title = fs.readFileSync(path.join(root, 'captacion/correos/E01.html'), 'utf8').match(/<title>([^<]+)<\/title>/i)?.[1];
    assert.equal(e01.subject, e01Title?.replace('{{numero}}', imported.lead.id), 'E01 inbox subject matches the final A3 page');
    assert.equal(await page.locator('[aria-labelledby="m5-cycle-inbox-title"] a').first().getAttribute('href'), e01.href);
    assert.equal(await page.evaluate(() => M4.landingFocus('C05')), true);
    assert.equal(await page.locator('.m5-nav, .ux-mobile-nav').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await page.screenshot({ path: evidencePrefix + '_E5_bandeja.png', fullPage: true });

    await page.locator('[data-a="accept-prop"]').click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C06');
    await page.getByRole('button', { name: 'Simular firma de contrato' }).click();
    await page.getByText('Contrato simulado registrado', { exact: false }).waitFor();
    const contract = await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'contract_signed').length);
    assert.equal(contract, 1);
    assert.ok((await page.locator('#app').innerText()).includes('a confirmar con el equipo'));
    await page.getByRole('link', { name: 'Ir a Mi cuenta' }).click();
    await page.waitForFunction(() => (location.hash || '').split('?')[0] === '#C09');
    await page.locator('.m5-cycle-head').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#m4tMore').count(), 1, 'la barra de moderación debe estar disponible en ?test=sitio');

    await page.locator('#m4tMore').click();
    await page.getByRole('button', { name: 'Pasaron 3 días' }).click();
    await page.locator('#m4tMore').click();
    await page.getByRole('button', { name: 'Pasó un mes' }).click();
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await page.getByRole('button', { name: 'Repetir pedido' }).click();
    const ordersBeforeReload = await page.evaluate(() => ({ orders: M4.get().customerCycle.orders, names: M4.get().events.filter((e) => ['order_confirmed','repeat_order_confirmed'].includes(e.eventName)).map((e) => e.eventName) }));
    assert.deepEqual(ordersBeforeReload.names, ['order_confirmed', 'repeat_order_confirmed']);
    assert.equal(ordersBeforeReload.orders.length, 2);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.m5-cycle-head').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => M4.get().customerCycle.orders.length), 2);
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'order_confirmed').length), 1);
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'repeat_order_confirmed').length), 1);
    assert.ok((await page.locator('#app').innerText()).includes('E08'));

    const support = page.locator('form[data-cycle-form="support"]');
    await support.locator('[name="type"]').selectOption({ label: 'Producto o formato' });
    await support.locator('[name="detail"]').fill('Necesito revisar el formato para mi operación.');
    await support.locator('button[type="submit"]').click();
    await page.getByText('Caso CAS-', { exact: false }).waitFor();
    const csat = page.locator('form[data-cycle-form="csat"]');
    await csat.locator('[name="score"]').selectOption('4');
    await csat.locator('[name="comment"]').fill('La atención fue clara y pude dejar mi consulta.');
    await csat.locator('button[type="submit"]').click();
    await page.getByText('CSAT: 4/5', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'support_case_opened').length), 1);
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'csat_submitted').length), 1);

    await page.locator('[data-cycle-nps="10"]').click();
    await page.getByRole('button', { name: 'Preparar recomendación' }).click();
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'referral_sent').length), 0, 'preparar el enlace no registra envío');
    await page.getByRole('button', { name: 'Registrar envío simulado' }).click();
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'referral_sent').length), 1);
    const referral = page.getByRole('link', { name: 'Abrir enlace con UTM de referido' });
    const referralHref = await referral.getAttribute('href'); const referralUrl = new URL(referralHref);
    assert.equal(referralUrl.searchParams.get('utm_source'), 'referido');
    assert.equal(referralUrl.searchParams.get('utm_medium'), 'referral');
    assert.equal(referralUrl.searchParams.get('utm_campaign'), 'recomienda');
    assert.ok(referralUrl.searchParams.get('mc_referral_account'));
    assert.ok(referralUrl.searchParams.get('mc_referral_code'));
    const primaryCrmState = await page.evaluate((width) => {
      M4.update((s) => { s.qaRunId = `A1-CRM-20261111-${width}`; });
      return M4.get();
    }, width);
    const customerTimeline = await page.locator('.m5-cycle-timeline a').evaluateAll((anchors) => anchors.map((anchor) => ({ id: anchor.textContent.match(/E\d{2}/)?.[0], href: anchor.getAttribute('href') })));
    for (const code of ['E01', 'E02', 'E06', 'E08', 'E10', 'E11']) {
      const item = customerTimeline.find((link) => link.id === code);
      assert.ok(item, `account timeline includes ${code}`);
      assert.equal(new URL(item.href, base).pathname, `/captacion/correos/${code}.html`);
      assert.ok(fs.existsSync(path.join(root, 'captacion', 'correos', `${code}.html`)));
    }
    assert.equal(await page.evaluate(() => M4.get().events.filter((e) => e.eventName === 'referral_lead_created').length), 0, 'el referido no existe en CRM antes de confirmar el formulario');
    assert.equal(await page.evaluate(() => M4.get().referralLeads?.length || 0), 0, 'no se crea una ficha referida al abrir el enlace');

    await page.evaluate(() => { localStorage.removeItem('mc_first_touch_v1'); localStorage.removeItem('mc_landing_lead_v1'); localStorage.removeItem('mc_landing_draft_v1'); });
    const popupPromise = page.waitForEvent('popup');
    await referral.click();
    const referredPage = await popupPromise;
    const referredErrors = [];
    referredPage.on('pageerror', (error) => referredErrors.push(error.message));
    await referredPage.locator('#f-nombre').waitFor({ state: 'visible' });
    await referredPage.locator('#f-nombre').fill('Rocío Fuentes');
    await referredPage.locator('#f-correo').fill('rocio.fuentes@example.com');
    await referredPage.locator('#f-consent').check();
    await referredPage.locator('#f-marketing').uncheck();
    await referredPage.locator('fieldset[data-paso="1"] button[type="submit"]').click();
    await referredPage.locator('#f-empresa').fill('Restaurante Patio Sur');
    await referredPage.locator('#f-telefono').fill('998765432');
    await referredPage.locator('[data-accion="enviar"]').click();
    await referredPage.locator('#ld-exito').waitFor({ state: 'visible' });
    const referralHandoff = await referredPage.locator('#ld-continuar').getAttribute('href');
    const referralHandoffUrl = new URL(referralHandoff);
    assert.equal(referralHandoffUrl.searchParams.get('utm_source'), 'referido');
    assert.equal(referralHandoffUrl.searchParams.get('utm_content'), referralUrl.searchParams.get('utm_content'));
    await referredPage.locator('#ld-continuar').click();
    await referredPage.getByRole('heading', { name: 'Solicitud recibida' }).waitFor();
    await referredPage.screenshot({ path: evidencePrefix + '_E9_referido_recibido.png', fullPage: true });
    await referredPage.reload({ waitUntil: 'domcontentloaded' });
    await referredPage.getByRole('heading', { name: 'Solicitud recibida' }).waitFor();
    const referralLead = await referredPage.evaluate(() => M4.get().referralLeads?.[0] || null);
    assert.ok(referralLead);
    assert.equal(referralLead.source, 'Referido');
    assert.equal(referralLead.consent, true);
    assert.equal(referralLead.marketingConsent, false);
    assert.equal(referralLead.referrerAccountId, referralUrl.searchParams.get('mc_referral_account'));
    assert.equal(referralLead.referralCode, referralUrl.searchParams.get('mc_referral_code'));
    assert.equal(referralLead.attribution.firstTouch.params.utm_source, 'referido');
    assert.equal(referralLead.attribution.lastTouch.params.utm_source, 'referido');
    assert.equal(referralLead.events.filter((e) => e.eventName === 'referral_lead_created').length, 1);
    assert.deepEqual(referredErrors, []);
    await referredPage.reload({ waitUntil: 'domcontentloaded' });
    await referredPage.getByRole('heading', { name: 'Solicitud recibida' }).waitFor();
    assert.equal(await referredPage.evaluate(() => M4.get().referralLeads.filter((item) => item.source === 'Referido').length), 1, 'recargar no duplica el lead referido');
    const accountEvent = await referredPage.evaluate(() => ({ accountId: M4.get().customerCycle.accountId, referralEvents: M4.get().events.filter((e) => e.eventName === 'referral_lead_created') }));
    assert.equal(accountEvent.referralEvents.length, 1);
    assert.equal(accountEvent.referralEvents[0].accountId, accountEvent.accountId);
    const eventCounts = await referredPage.evaluate(() => Object.fromEntries(['contract_signed','order_confirmed','repeat_order_confirmed','support_case_opened','csat_submitted','referral_sent','referral_lead_created'].map((name) => [name, M4.get().events.filter((e) => e.eventName === name).length])));
    assert.deepEqual(eventCounts, { contract_signed: 1, order_confirmed: 1, repeat_order_confirmed: 1, support_case_opened: 1, csat_submitted: 1, referral_sent: 1, referral_lead_created: 1 });

    const crmState = await referredPage.evaluate((width) => { M4.update((s) => { s.qaRunId = `A1-CRM-20261111-${width}`; }); return M4.get(); }, width);
    const crmPage = await ctx.newPage();
    const crmErrors = [];
    crmPage.on('pageerror', (error) => crmErrors.push(error.message));
    await crmPage.goto(new URL('/index.html?qa=1#R04', base).toString(), { waitUntil: 'domcontentloaded' });
    await crmPage.evaluate((state) => localStorage.setItem('marleyMVP:v7:prototype', JSON.stringify(state)), crmState);
    await crmPage.reload({ waitUntil: 'domcontentloaded' });
    await crmPage.evaluate((id) => { M4.setRole('ventas'); M4.select(id); }, referralLead.id);
    await crmPage.locator('#app').getByText('Cuenta que recomienda').waitFor({ state: 'visible' });
    const referralCrm = await crmPage.locator('#app').innerText();
    assert.ok(referralCrm.includes('Origen referido'));
    assert.ok(referralCrm.includes(referralLead.referrerAccountId));
    assert.ok(referralCrm.includes(referralLead.referralCode));
    assert.equal(await crmPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await crmPage.screenshot({ path: evidencePrefix + '_E9_CRM_referido_R04.png', fullPage: true });
    await crmPage.evaluate(() => { location.hash = '#R17'; });
    await crmPage.locator('[data-a1-buyer-profile]').waitFor({ state: 'visible' });
    await crmPage.locator('.a1crm-role-note[data-a1-role-view="ventas"]').waitFor({ state: 'visible' });
    const referralBuyerCRM = await crmPage.locator('#app').innerText();
    assert.ok(referralBuyerCRM.includes('Rocío Fuentes'));
    assert.ok(referralBuyerCRM.includes('Restaurante Patio Sur'));
    assert.ok(referralBuyerCRM.includes('Origen referido'));
    assert.ok(referralBuyerCRM.includes(referralLead.referrerAccountId));
    assert.equal(await crmPage.locator('[data-a1-run-id]').innerText(), `A1-CRM-20261111-${width}`);
    await crmPage.screenshot({ path: evidencePrefix + '_E9_CRM_referido.png', fullPage: true });
    assert.equal(await crmPage.locator('[data-a1-email]').count(), 12, 'the CRM catalog links all 12 final A3 emails');
    const crmEmailLinks = await crmPage.locator('[data-a1-email]').evaluateAll((cards) => cards.map((card) => ({ id: card.getAttribute('data-a1-email'), href: card.querySelector('[data-a1-email-id]')?.getAttribute('href') })));
    assert.deepEqual(crmEmailLinks.map((item) => item.id), crmContract.email_catalog.map((item) => item.id));
    for (const item of crmEmailLinks) {
      assert.equal(new URL(item.href, base).pathname, `/captacion/correos/${item.id}.html`);
      assert.ok(fs.existsSync(path.join(root, 'captacion', 'correos', `${item.id}.html`)));
    }
    const referralEmailsBeforeBrowse = await crmPage.evaluate(() => M4.get().emails.length);
    for (const role of ['marketing', 'jefatura', 'ventas']) {
      await crmPage.evaluate((nextRole) => { M4.setRole(nextRole); location.hash = '#R17'; }, role);
      await crmPage.locator(`.a1crm-role-note[data-a1-role-view="${role}"]`).waitFor({ state: 'visible' });
      assert.equal(await crmPage.locator('[data-a1-accept-sql]').count(), 0, `${role} cannot accept a non-qualified referral as SQL`);
      assert.equal(await crmPage.evaluate(() => M4.get().emails.length), referralEmailsBeforeBrowse, 'viewing CRM roles does not send or add email');
      assert.equal(await crmPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      if (role === 'ventas') await crmPage.screenshot({ path: evidencePrefix + '_CRM_referido_ventas.png', fullPage: true });
    }

    const buyerCrmPage = await ctx.newPage();
    const buyerCrmErrors = [];
    buyerCrmPage.on('pageerror', (error) => buyerCrmErrors.push(error.message));
    await buyerCrmPage.goto(new URL('/index.html?qa=1#R17', base).toString(), { waitUntil: 'domcontentloaded' });
    await buyerCrmPage.evaluate((state) => localStorage.setItem('marleyMVP:v7:prototype', JSON.stringify(state)), primaryCrmState);
    await buyerCrmPage.reload({ waitUntil: 'domcontentloaded' });
    await buyerCrmPage.evaluate((id) => { M4.setRole('marketing'); M4.select(id); location.hash = '#R17'; }, primaryCrmState.lead.id);
    await buyerCrmPage.locator('[data-a1-buyer-profile]').waitFor({ state: 'visible' });
    await buyerCrmPage.locator('.a1crm-role-note[data-a1-role-view="marketing"]').waitFor({ state: 'visible' });
    assert.equal(await buyerCrmPage.locator('.a1crm-side [href="#R17"]').count(), 1);
    assert.equal(await buyerCrmPage.locator('[data-a1-run-id]').innerText(), `A1-CRM-20261111-${width}`);
    assert.equal((await buyerCrmPage.locator('.a1crm-header .a1crm-card h2').innerText()).toLocaleLowerCase(), 'camila rojas', 'viewport and run ID do not enter the visible contact name');
    const buyerOptions = await buyerCrmPage.locator('[data-a1-buyer-select] option').evaluateAll((options) => options.map((option) => option.value));
    assert.deepEqual(buyerOptions, crmContract.buyers.map((buyer) => buyer.code), 'all seven buyer profiles use the fixed codes');
    const initialEmails = await buyerCrmPage.evaluate(() => M4.get().emails.length);
    const funnelStages = await buyerCrmPage.locator('[data-a1-stage]').evaluateAll((items) => items.map((item) => item.getAttribute('data-a1-stage')));
    assert.deepEqual(funnelStages, crmContract.funnel.map((item) => item.stage), 'the single funnel renders all 11 contracted stages in order');
    for (const stage of crmContract.funnel) {
      const content = await buyerCrmPage.locator(`[data-a1-stage="${stage.stage}"]`).innerText();
      assert.ok(content.includes(stage.entry), `${stage.stage} shows its contracted entry criterion`);
      assert.ok(content.includes(stage.exit), `${stage.stage} shows its contracted exit criterion`);
    }
    assert.equal(await buyerCrmPage.locator('[data-a1-assistant]').count(), 6);
    for (const item of await buyerCrmPage.locator('[data-a1-assistant]').all()) {
      const content = await item.innerText();
      for (const label of ['Señal', 'Borrador', 'Revisión humana', 'Consecuencia', 'Sin ejecución automática']) assert.ok(content.includes(label));
    }
    assert.equal(await buyerCrmPage.locator('[data-a1-recovery-id]').count(), 5);
    for (const scenario of crmContract.recovery_scenarios) {
      const content = await buyerCrmPage.locator(`[data-a1-recovery-id="${scenario.id}"]`).innerText();
      assert.ok(content.includes(scenario.permission_base), `${scenario.id} shows its permission base`);
    }
    assert.equal(await buyerCrmPage.locator('[data-a1-indicator]').count(), 11);
    for (const indicator of crmContract.indicator_definitions) {
      const content = await buyerCrmPage.locator(`[data-a1-indicator="${indicator.id}"]`).innerText();
      assert.ok(content.includes(indicator.formula));
      assert.ok(content.includes(indicator.sample_value));
      assert.ok(content.includes('Ejemplo; no es dato Marley'));
    }
    for (const buyer of crmContract.buyers) {
      await buyerCrmPage.locator('[data-a1-buyer-select]').selectOption(buyer.code);
      const profile = buyerCrmPage.locator(`[data-a1-buyer-profile="${buyer.code}"]`);
      await profile.waitFor({ state: 'visible' });
      assert.equal(await profile.locator('.a1crm-role-card').count(), buyer.roles.length, `${buyer.code} displays its four buying roles`);
      const profileText = (await profile.innerText()).toLocaleLowerCase();
      for (const buyingRole of buyer.roles) {
        assert.ok(profileText.includes(buyingRole.role.toLocaleLowerCase()));
        for (const title of buyingRole.titles) assert.ok(profileText.includes(title.toLocaleLowerCase()), `${buyer.code} includes ${title}`);
      }
      const nextStates = await buyerCrmPage.locator('[data-a1-next-state]').evaluateAll((items) => items.map((item) => item.getAttribute('data-a1-next-state')));
      assert.deepEqual(nextStates, crmContract.funnel.map((stage) => stage.stage));
      for (const stage of crmContract.funnel) {
        const actionText = await buyerCrmPage.locator(`[data-a1-next-state="${stage.stage}"]`).innerText();
        assert.ok(actionText.includes(buyer.next_best_action_by_state[stage.stage]));
      }
    }
    const contractNote = await buyerCrmPage.locator('.a1crm-note').innerText();
    assert.match(contractNote, /SLA, cobertura[\s\S]*cadencia:[\s\S]*a definir con Marley/i);
    assert.equal(await buyerCrmPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().events.filter((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'MQL').length), 0, 'MQL is not recorded automatically by scoring');
    const candidate = await buyerCrmPage.evaluate(() => ({ eligible: M4.isMQL(), emailCount: M4.get().emails.length, score: M4.score(), sql: M4.get().sql }));
    assert.equal(candidate.eligible, true, 'the journey qualifies under the existing score rules');
    assert.equal(candidate.sql, null, 'scoring does not accept SQL');
    await buyerCrmPage.locator('[data-a1-buyer-select]').selectOption('restaurante');
    await buyerCrmPage.locator('[data-a1-mark-mql]').waitFor({ state: 'visible' });
    await buyerCrmPage.screenshot({ path: evidencePrefix + '_CRM_marketing.png', fullPage: true });
    await buyerCrmPage.locator('[data-a1-mark-mql]').click();
    await buyerCrmPage.waitForFunction(() => M4.get().events.some((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'MQL' && event.actor_type === 'human'));
    const mqlEvent = await buyerCrmPage.evaluate(() => M4.get().events.find((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'MQL'));
    assert.equal(mqlEvent.actor_role, 'Marketing');
    assert.equal(mqlEvent.actor_type, 'human');
    assert.equal(mqlEvent.pts, 0);
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().emails.length), initialEmails, 'marking MQL does not send email');
    await buyerCrmPage.evaluate(() => { M4.acceptSql(); M4.setRole('jefatura'); M4.acceptSql(); });
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().sql), null, 'Marketing and Jefatura cannot accept SQL');
    assert.equal(await buyerCrmPage.locator('[data-a1-accept-sql]').count(), 0);
    await buyerCrmPage.screenshot({ path: evidencePrefix + '_CRM_jefatura.png', fullPage: true });
    await buyerCrmPage.evaluate(() => M4.setRole('ventas'));
    await buyerCrmPage.locator('.a1crm-role-note[data-a1-role-view="ventas"]').waitFor({ state: 'visible' });
    assert.equal(await buyerCrmPage.locator('[data-a1-accept-sql]').count(), 1, 'only Sales receives the manual SQL action');
    const scoreBeforeSql = await buyerCrmPage.evaluate(() => M4.score());
    await buyerCrmPage.locator('[data-a1-accept-sql]').click();
    const sqlEvent = await buyerCrmPage.evaluate(() => M4.get().events.find((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'SQL'));
    assert.equal(sqlEvent.accepted_by_role, 'Ventas');
    assert.equal(sqlEvent.actor_type, 'human');
    assert.equal(sqlEvent.pts, 0);
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().events.filter((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'SQL').length), 1);
    assert.equal(await buyerCrmPage.evaluate(() => M4.score()), scoreBeforeSql, 'MQL and SQL qualification events keep the current score unchanged');
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().emails.length), initialEmails, 'accepting SQL does not send email');
    await buyerCrmPage.screenshot({ path: evidencePrefix + '_CRM_ventas.png', fullPage: true });
    await buyerCrmPage.reload({ waitUntil: 'domcontentloaded' });
    await buyerCrmPage.locator('[data-a1-buyer-profile]').waitFor({ state: 'visible' });
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().events.filter((event) => event.eventName === 'lead_qualified' && event.qualification_status === 'SQL').length), 1, 'reload does not duplicate SQL');
    assert.equal(await buyerCrmPage.evaluate(() => M4.get().emails.length), initialEmails, 'reload does not send or duplicate mail');
    await buyerCrmPage.evaluate(() => { location.hash = '#R16'; });
    await buyerCrmPage.locator('.m7c-feed').waitFor({ state: 'visible' });
    const crmTimelineEmails = await buyerCrmPage.locator('.m7c-feed a.m7c-email-template-link').evaluateAll((anchors) => anchors.map((anchor) => ({ id: anchor.textContent.match(/E\d{2}/)?.[0], href: anchor.getAttribute('href') })));
    assert.ok(crmTimelineEmails.some((item) => item.id === 'E01'), 'CRM timeline links generated email E01 to A3');
    for (const item of crmTimelineEmails) assert.equal(new URL(item.href, base).pathname, `/captacion/correos/${item.id}.html`);
    assert.equal(await buyerCrmPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await buyerCrmPage.screenshot({ path: evidencePrefix + '_CRM_linea_tiempo.png', fullPage: true });
    await page.screenshot({ path: evidencePrefix + '_E7_E8_E9_MiCuenta.png', fullPage: true });
    assert.deepEqual(crmErrors, []);
    assert.deepEqual(buyerCrmErrors, []);
    assert.deepEqual(errors, []);
    return { width, organic: 'PASS', paid: 'PASS', landingImport: 'PASS', focus: 'PASS', inbox: 'PASS', contract: 'PASS', orders: 'PASS', supportCsat: 'PASS', referralCrm: 'PASS', buyers: 7, funnelStages: 11, humanMqlSql: 'PASS', assistants: 6, recovery: 5, indicators: 11, noAutomaticEmail: true, noOverflow: true };
  } finally { await ctx.close(); }
}

async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  verifySearchDestinations();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  try {
    const results = [];
    for (const width of [390, 1440]) results.push(await journey(browser, base, width));
    process.stdout.write(JSON.stringify({ status: 'PASS', origin: 'HTTP local', results, evidence }, null, 2) + '\n');
  } finally { await browser.close(); server.close(); }
}
main().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
