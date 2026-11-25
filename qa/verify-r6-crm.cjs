'use strict';

// R6 · Verificador integral CRM por rol y traspasos (S + V + MJ).
// Corre en Chrome y Edge, a 390x844 y 1440x900 (+ 360x800, 414x896, 1280x600).
const { useLegacyCrm } = require('./legacy-crm-contract.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8880/index.html';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const ROLE_ROUTES = {
  ventas: [
    ['R01', 'Atender hoy', 1300],
    ['R02', 'Conversaciones', 1800],
    ['R08', 'Cotizaciones', 1800],
    ['R03', 'Clientes y recompras', 1800],
  ],
  marketing: [
    ['R12', 'Embudo y leads', 1300],
    ['R16', 'Estancados y recuperar', 1800],
    ['R11', 'Campañas', 1800],
    ['R13', 'Contenido por rubro', 1800],
    ['R06', 'Ventas y origen', 1800],
  ],
  jefatura: [
    ['R05', 'Resumen', 1300],
    ['R07', 'Por aprobar', 1800],
    ['R06', 'Metas y costo por adquisición', 1800],
    ['R09', 'Reglas', 1800],
    ['R14', 'Equipo y operación', 1800],
  ],
};

async function setRoute(page, role, hash) {
  await page.evaluate(({ r, h }) => {
    window.M4.setRole(r);
    window.MarleyApp.go(h, { evaluation: true });
  }, { r: role, h: hash });
  await page.waitForFunction((h) => document.body.dataset.current === h, hash, { timeout: 8000 });
  await page.waitForTimeout(80);
}

async function auditScreen(page, vp, role, hash, expectedH1, maxH) {
  await page.setViewportSize(vp);
  await setRoute(page, role, hash);
  const m = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (!(r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.02)) return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.hidden || (p.tagName === 'DETAILS' && !p.open && el !== p.querySelector('summary') && !p.querySelector('summary')?.contains(el))) return false;
      }
      return true;
    };
    const h1s = Array.from(document.querySelectorAll('h1')).filter((h) => visible(h) && !h.classList.contains('b2c-sr-only')).map((h) => h.textContent.trim());
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    const sh = document.documentElement.scrollHeight;
    const green = Array.from(document.querySelectorAll('.m4-crm *')).filter(visible).filter((el) => {
      const st = getComputedStyle(el);
      const isG = (c) => {
        const mm = String(c || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
        if (!mm) return false;
        const [r, g, b] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
        return g > r + 15 && g > b + 15;
      };
      return isG(st.backgroundColor) || isG(st.color);
    }).length;
    const small = Array.from(document.querySelectorAll('#m4-main button:not([disabled]), #m4-main a[href], #m4-main summary, #m4-main input, #m4-main select, #m4-main textarea'))
      .filter(visible)
      .map((el) => ({ t: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h < 43.5 || x.w < 43.5);
    return { h1s, sw, cw, sh, green, small };
  });
  assert.equal(m.h1s.length, 1, `${role}/${hash}@${vp.width}: esperado 1 H1, vi ${JSON.stringify(m.h1s)}`);
  assert.equal(m.h1s[0], expectedH1, `${role}/${hash}@${vp.width}: H1 "${m.h1s[0]}" !== "${expectedH1}"`);
  assert.ok(m.sw <= m.cw, `${role}/${hash}@${vp.width}: desborde ${m.sw} > ${m.cw}`);
  assert.equal(m.green, 0, `${role}/${hash}@${vp.width}: colores verdes residuales (${m.green})`);
  assert.deepEqual(m.small, [], `${role}/${hash}@${vp.width}: controles <44px: ${JSON.stringify(m.small)}`);
  if (maxH) {
    assert.ok(m.sh <= maxH, `${role}/${hash}@${vp.width}: alto ${m.sh}px > tope ${maxH}px`);
  }
  return m.sh;
}

async function clickWithResponse(page, locator, label) {
  assert.ok(await locator.count() > 0, `falta control: ${label}`);
  const before = await page.evaluate(() => JSON.stringify({
    h: location.hash,
    cur: document.body.dataset.current,
    rev: window.M4?.get?.()?.rev,
    sel: window.M4?.get?.()?.sel,
    txt: (document.querySelector('#m4-main')?.innerText || '').slice(0, 800),
    dlg: Boolean(document.querySelector('#m4-r3-dialog[open]')),
  }));
  await locator.first().scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
  await locator.first().click({ timeout: 4000 });
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => JSON.stringify({
    h: location.hash,
    cur: document.body.dataset.current,
    rev: window.M4?.get?.()?.rev,
    sel: window.M4?.get?.()?.sel,
    txt: (document.querySelector('#m4-main')?.innerText || '').slice(0, 800),
    dlg: Boolean(document.querySelector('#m4-r3-dialog[open]')),
  }));
  assert.notEqual(after, before, `clic sin respuesta visible ni cambio de estado en: ${label}`);
}

async function runSuite(name, launcher, launchOpts) {
  const browser = await launcher.launch(launchOpts);
  const errors = [];
  const heights = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await useLegacyCrm(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.M4D && window.M4R && window.MarleyApp && window.R6P && window.R6MJ), null, { timeout: 10000 });
    await page.evaluate(() => { localStorage.clear(); window.M4.reset(); });

    // 1. Auditoría de rutas, H1 == menú, alturas, paleta Negro Marley y toques >= 44px
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      const menu = await page.evaluate((r) => window.M4D.ROLE_MENUS[r].menu.map((x) => [x[0], x[1]]), role);
      for (const [h, title, max1440] of routes) {
        const menuEntry = menu.find((x) => x[0] === h);
        if (menuEntry) assert.equal(menuEntry[1], title, `${role}/${h}: menú "${menuEntry[1]}" !== H1 "${title}"`);
        heights[`${role}_${h}_1440`] = await auditScreen(page, { width: 1440, height: 900 }, role, h, title, max1440);
        heights[`${role}_${h}_1280`] = await auditScreen(page, { width: 1280, height: 551 }, role, h, title, max1440);
        heights[`${role}_${h}_390`] = await auditScreen(page, { width: 390, height: 844 }, role, h, title, 2500);
      }
    }

    // Extra anchos sin desborde
    for (const [w, h, role, route, title] of [
      [360, 800, 'ventas', 'R01', 'Atender hoy'],
      [414, 896, 'marketing', 'R12', 'Embudo y leads'],
      [1280, 600, 'jefatura', 'R05', 'Resumen'],
    ]) {
      await auditScreen(page, { width: w, height: h }, role, route, title, null);
    }

    // 2. Recorrido completo entre los 3 roles:
    //    2a) Marketing pasa lead -> Ventas lo ve en R01 y acepta -> Marketing ve "SQL aceptado"
    await page.setViewportSize({ width: 1440, height: 900 });
    const liveId = await page.evaluate(() => {
      window.M4.loadExample();
      const s = window.M4.get();
      window.M4.update((st) => {
        st.events = st.events || [];
        if (!st.events.some((x) => x.eventName === 'lead_qualified' && x.qualification_status === 'MQL' && x.actor_type === 'human')) {
          st.events.push({
            key: 'crm-qa-mql-' + st.lead.id,
            eventName: 'lead_qualified',
            qualification_status: 'MQL',
            actor_type: 'human',
            actor_role: 'Marketing',
            actor_id: 'Marketing',
            label: 'Marketing revisó el MQL',
            pts: 0,
            at: window.M4.now(),
          });
        }
      });
      return s.lead.id;
    });

    await setRoute(page, 'marketing', 'R12');
    const passSelLive = `[data-r3-reason-for="${liveId}"]`;
    assert.ok(await page.locator(passSelLive).count() > 0, 'R12 debe mostrar al lead en vivo listo para pasar');
    await page.selectOption(passSelLive, 'Volumen suficiente');
    await clickWithResponse(page, page.locator(`[data-r3-action="pass-sales"][data-lead="${liveId}"]`), 'Pasar lead a ventas en R12');
    assert.equal(await page.evaluate((id) => window.M4.get().marketingPasos?.[id]?.estado, liveId), 'esperando');

    await setRoute(page, 'ventas', 'R01');
    const r01Top = await page.textContent('.r6-v-next');
    assert.match(r01Top, /Elena Fuentes|Derivado por Marketing/i, 'R01 debe mostrar el lead pasado por Marketing');
    await clickWithResponse(page, page.locator(`.r6-v-next [data-r6-v-action="open-ficha"][data-lead="${liveId}"]`), 'Abrir ficha en R04 desde R01');
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    await clickWithResponse(page, page.locator('#m4-main [data-r6-v-action="accept-sql"]'), 'Aceptar como SQL en R04');
    assert.equal(await page.evaluate((id) => window.M4.get().marketingPasos?.[id]?.estado, liveId), 'aceptado');

    await setRoute(page, 'marketing', 'R12');
    assert.match(await page.textContent(`[data-r6-handoff="${liveId}"]`), /SQL aceptado/i, 'Marketing debe ver "SQL aceptado" en R12');

    //    2b) Ventas devuelve otro lead -> Marketing lo ve en R12 y en R16 "Estancados y recuperar"
    const devId = 'MC-HOR-2036';
    await setRoute(page, 'marketing', 'R12');
    await page.selectOption(`[data-r3-reason-for="${devId}"]`, 'Necesidad confirmada');
    await clickWithResponse(page, page.locator(`[data-r3-action="pass-sales"][data-lead="${devId}"]`), 'Pasar MC-HOR-2036 a ventas');
    await setRoute(page, 'ventas', 'R01');
    await page.evaluate((id) => { window.M4.select(id); window.MarleyApp.go('R04', { evaluation: true }); }, devId);
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    await clickWithResponse(page, page.locator('#m4-main [data-r6-v-action="return-open"]'), 'Abrir devolución en R04');
    await page.locator('[data-r6-v-reason]').selectOption({ label: 'No contesta' });
    await clickWithResponse(page, page.locator('#m4-main [data-r6-v-action="return-confirm"]'), 'Confirmar devolución en R04');
    assert.equal(await page.evaluate((id) => window.M4.get().marketingPasos?.[id]?.estado, devId), 'devuelto');

    await setRoute(page, 'marketing', 'R12');
    assert.match(await page.textContent(`[data-r6-handoff="${devId}"]`), /Devuelto:\s*No contesta/, 'R12 debe mostrar motivo devuelto');
    await setRoute(page, 'marketing', 'R16');
    const r16Dev = await page.textContent('[data-r6-group="devuelto"]');
    assert.match(r16Dev, /Carolina Muñoz|No contesta/, 'R16 debe agrupar el lead devuelto');

    //    2c) Ventas envía excepción a aprobación -> Jefatura aprueba en R07 -> Ventas lo ve en R04
    await page.evaluate((id) => { window.M4.setRole('ventas'); window.M4.select(id); window.MarleyApp.go('R04', { evaluation: true }); }, liveId);
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    await clickWithResponse(page, page.locator('#m4-main [data-r6-v-action="approval-open"]'), 'Abrir excepción en R04');
    await page.locator('[data-r6-v-type]').selectOption({ label: 'Descuento fuera de lista' });
    await page.locator('[data-r6-v-note]').fill('Aprobar descuento especial corporativo');
    await page.locator('[data-r6-v-amount]').fill('75000');
    await clickWithResponse(page, page.locator('#m4-main [data-r6-v-action="approval-confirm"]'), 'Enviar excepción a aprobación');
    const reqId = await page.evaluate((id) => (window.M4.get().jefeAprob || []).find((a) => a.leadId === id && a.estado === 'pendiente')?.id, liveId);
    assert.ok(reqId, 'La excepción debe quedar pendiente en jefeAprob');

    await setRoute(page, 'jefatura', 'R07');
    await clickWithResponse(page, page.locator(`[data-r6-action="aprob-ok"][data-v="${reqId}"]`), 'Aprobar excepción en R07');
    assert.equal(await page.evaluate((rid) => (window.M4.get().jefeAprob || []).find((a) => a.id === rid)?.estado, reqId), 'aprobada');

    await page.evaluate((id) => { window.M4.setRole('ventas'); window.M4.select(id); window.MarleyApp.go('R04', { evaluation: true }); }, liveId);
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    assert.match(await page.textContent('#m4-main'), /Aprobada/, 'R04 de Ventas debe reflejar la aprobación de Jefatura');

    // 3. Ninguna función existente desapareció (PLAN_R6 5.6)
    await setRoute(page, 'marketing', 'R16');
    for (const [act, lbl] of [['open-permission', 'Permisos R16'], ['open-followup', 'Programar R16'], ['open-contacted', 'Contactado R16']]) {
      const btn = page.locator(`[data-r3-action="${act}"]`);
      if (await btn.count()) {
        await clickWithResponse(page, btn, lbl);
        if (await page.locator('#m4-r3-dialog[open] [data-r3-action="close-dialog"]').count()) {
          await page.locator('#m4-r3-dialog [data-r3-action="close-dialog"]').click();
          await page.waitForTimeout(60);
        }
      }
    }

    await setRoute(page, 'marketing', 'R11');
    assert.ok((await page.textContent('#m4-main')).length > 80, 'R11 Campañas debe renderizar');
    await setRoute(page, 'marketing', 'R13');
    await clickWithResponse(page, page.locator('[data-r3-action="content-validate"]'), 'Validar contenido en R13');

    await setRoute(page, 'jefatura', 'R05');
    await clickWithResponse(page, page.locator('[data-r6-action="toggle-r05-goal"]'), 'Abrir meta editable en R05');

    await setRoute(page, 'ventas', 'R01');
    await clickWithResponse(page, page.locator('[data-a="cola-filter"][data-v="postventa"]'), 'Postventa en R01');
    const searchSel = (await page.locator('[data-r3-search]').count()) ? '[data-r3-search]' : '[data-a="cola-search"]';
    if (await page.locator(searchSel).count()) {
      await page.fill(searchSel, 'Isidora');
      // coordinador (14-nov): el buscador global muestra sus resultados en la barra superior (.m4-r3-search-results), fuera de #m4-main.
      const zona = searchSel === '[data-r3-search]' ? '.m4-r3-search-results' : '#m4-main';
      await page.waitForFunction((sel) => /Isidora/i.test((document.querySelector(sel) || {}).textContent || ''), zona, { timeout: 3000 });
      assert.match(await page.textContent(zona), /Isidora/i, 'Buscador en R01 debe encontrar el cliente');
    }

    // 4. Pantallas C del comprador intactas
    for (const [cHash, sel] of [['C02', '.ux-hero'], ['C10', '.m9-catalog'], ['C04', '.m5-qcard'], ['C11', '.r3-machine-grid'], ['C09', 'h1:has-text("Portal de cliente"), .m5-cycle-head']]) { // coordinador (14-nov): .m5-cycle-head solo existe con un pedido en curso; sin pedido, C09 muestra «Portal de cliente» (igual en la R5 sin CRM)
      await page.goto(BASE + '#' + cHash, { waitUntil: 'domcontentloaded' });
      // Con el ejemplo de pasos anteriores, C04 reanuda el catálogo y pasa a C10: C04 se entra sin ese estado.
      if (cHash === 'C04') await page.evaluate(() => { window.M4?.reset?.(); window.MarleyApp.go('C04', { evaluation: true }); });
      await page.waitForFunction((h) => document.body.dataset.current === h, cHash, { timeout: 8000 });
      await page.locator(sel).first().waitFor({ state: 'attached', timeout: 8000 });
    }

    assert.deepEqual(errors, [], `Errores JS en ${name}: ${errors.join(' | ')}`);
    return { browser: name, status: 'PASS', heights };
  } finally {
    await browser.close();
  }
}

(async () => {
  const cRes = await runSuite('Chrome', chromeLauncher, { headless: true });
  const eRes = await runSuite('Edge', pwChromium, { executablePath: EDGE_PATH, headless: true });
  process.stdout.write(JSON.stringify({ status: 'PASS', results: [cRes, eRes] }, null, 2) + '\n');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
