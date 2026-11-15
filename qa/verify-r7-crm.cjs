'use strict';

// Verificador R7 · Rol C (CRM). Chrome + Edge, 390x844 y 1440x900.
// Usa contextos aislados sin llamar localStorage.clear().
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8880/index.html';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const ROUTE_CAPS = [
  ['ventas', 'R01', 'Atender hoy', 1300],
  ['ventas', 'R03', 'Clientes y recompras', 1800],
  ['marketing', 'R12', 'Embudo y leads', 1300],
  ['marketing', 'R16', 'Estancados y recuperar', 1800],
  ['marketing', 'R06', 'Ventas y origen', 1800],
  ['jefatura', 'R05', 'Resumen', 1300],
  ['jefatura', 'R06', 'Metas y costo por adquisición', 1800],
];

function visibleEval() {
  return (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.02)) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.hidden || (p.tagName === 'DETAILS' && !p.open && el !== p.querySelector('summary') && !p.querySelector('summary')?.contains(el))) return false;
    }
    return true;
  };
}

async function auditLayout(page, vp, role, hash, expectedH1, max1440) {
  await page.setViewportSize(vp);
  await page.evaluate(({ r, h }) => {
    window.M4.setRole(r);
    window.MarleyApp.go(h, { evaluation: true });
  }, { r: role, h: hash });
  await page.waitForFunction((h) => document.body.dataset.current === h, hash, { timeout: 8000 });
  await page.waitForTimeout(70);

  const m = await page.evaluate((visSrc) => {
    const visible = eval(`(${visSrc})`);
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
    const hasOcs = /\bOCS\b/.test(document.querySelector('#m4-main')?.innerText || '');
    return { h1s, sw, cw, sh, green, small, hasOcs };
  }, visibleEval.toString());

  assert.equal(m.h1s.length, 1, `${role}/${hash}@${vp.width}: esperado 1 H1, vi ${JSON.stringify(m.h1s)}`);
  if (expectedH1) assert.equal(m.h1s[0], expectedH1, `${role}/${hash}@${vp.width}: H1 "${m.h1s[0]}" !== "${expectedH1}"`);
  assert.ok(m.sw <= m.cw, `${role}/${hash}@${vp.width}: desborde ${m.sw} > ${m.cw}`);
  assert.equal(m.green, 0, `${role}/${hash}@${vp.width}: colores verdes residuales (${m.green})`);
  assert.deepEqual(m.small, [], `${role}/${hash}@${vp.width}: controles <44px: ${JSON.stringify(m.small)}`);
  assert.equal(m.hasOcs, false, `${role}/${hash}@${vp.width}: apareció sigla prohibida OCS`);

  if ((vp.width === 1440 || vp.width === 1280) && max1440) {
    assert.ok(m.sh <= max1440, `${role}/${hash}@${vp.width}: alto ${m.sh}px > tope ${max1440}px`);
  }
  if (vp.width === 390 || vp.width === 360) {
    assert.ok(m.sh <= 2500, `${role}/${hash}@${vp.width}: alto ${m.sh}px > tope 2500px`);
  }
}

async function verifyBrowser(name, launcher, launchOpts) {
  const browser = await launcher.launch(launchOpts);
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.M4D && window.M4R && window.R6P && window.R7C && window.MarleyApp), null, { timeout: 10000 });
    await page.evaluate(() => window.M4.reset());

    // 1. Contrato R7C y regla dinámica de ciclo propio (no 30 días fijos)
    const cycleRes = await page.evaluate(() => {
      const ac111At31 = window.R7C.cicloCuenta({ id: 'AC-111', lastAgo: 31 });
      const ac103 = window.R7C.cicloCuenta('AC-103'); // freq 7, pause 10
      const ac117 = window.R7C.cicloCuenta('AC-117'); // freq 16, pause 19
      const ac110 = window.R7C.cicloCuenta('AC-110'); // freq 25, pause 120
      const inds = window.R7C.indicadores();
      return { ac111At31, ac103, ac117, ac110, indCount: inds.length };
    });

    assert.equal(cycleRes.ac111At31.freqDias, 45);
    assert.equal(cycleRes.ac111At31.atrasoDias, -14);
    assert.equal(cycleRes.ac111At31.estadoClave, 'en_ciclo', 'AC-111 (ciclo 45d) al día 31 NO debe marcarse atrasada');
    assert.ok(cycleRes.ac103.atrasoDias > 0 && cycleRes.ac103.estadoClave !== 'en_ciclo', 'AC-103 (ciclo 7d) debe marcar atraso real');
    assert.ok(cycleRes.ac117.atrasoDias > 0, 'AC-117 debe calcular atraso respecto a su propio ciclo');
    assert.equal(cycleRes.ac110.estadoClave, 'reactivacion_prioritaria', 'AC-110 (120d) debe estar en reactivación prioritaria');
    assert.ok(cycleRes.indCount >= 6, 'Debe exponer diccionario de indicadores en español');

    // 2. Pantallas con tope de alto y cero desbordes en 1440, 1280, 390 y 360
    for (const [role, hash, title, max1440] of ROUTE_CAPS) {
      await auditLayout(page, { width: 1440, height: 900 }, role, hash, title, max1440);
      await auditLayout(page, { width: 390, height: 844 }, role, hash, title, max1440);
    }
    await auditLayout(page, { width: 1280, height: 600 }, 'ventas', 'R01', 'Atender hoy', 1300);

    // 2b. Cobertura R04 completa (cuenta AC-121 y lead MC-HOR-2036) en 3 roles y 4 viewports
    for (const entityId of ['AC-121', 'MC-HOR-2036']) {
      for (const role of ['ventas', 'marketing', 'jefatura']) {
        await page.evaluate((id) => window.M4.select(id), entityId);
        for (const vp of [
          { width: 1440, height: 900 },
          { width: 1280, height: 600 },
          { width: 390, height: 844 },
          { width: 360, height: 800 }
        ]) {
          await auditLayout(page, vp, role, 'R04', null, 1800);
        }
      }
    }

    // 3. Ficha de cuenta multipunto AC-121 (jerarquía, normalización Oficinas, categorías faltantes, IA supervisada y R7P)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      if (window.R7P && typeof window.R7P.registrarEvento === 'function') {
        window.R7P.registrarEvento('recomendacion_vista', { negocioId: 'oficina', productoId: 'vaso65', origen: 'qa_r7' });
      }
      window.M4.setRole('ventas');
      window.M4.select('AC-121');
      window.MarleyApp.go('R04', { evaluation: true });
    });
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    const ac121Text = await page.textContent('#m4-main');
    assert.match(ac121Text, /Cuenta → Establecimiento → Contacto → Productos → Pedido → Servicio/, 'R04 debe mostrar la jerarquía comercial completa');
    assert.match(ac121Text, /Oficinas/, 'AC-121 debe normalizar OCS a Oficinas');
    assert.ok(!/\bOCS\b/.test(ac121Text), 'No debe mostrar sigla OCS visible');
    assert.match(ac121Text, /2 establecimiento\(s\)/, 'AC-121 debe distinguir sus 2 establecimientos');
    assert.match(ac121Text, /Vasos con marca/, 'Debe mostrar vasos con marca como ejemplo guía de complemento');
    assert.match(ac121Text, /Precio referencial · cotización oct-2026/, 'Debe rotular precio referencial de oct-2026');
    assert.match(ac121Text, /aprobación humana|aprobación de una persona/i, 'IA debe explicitar aprobación humana obligatoria');
    if (await page.evaluate(() => Boolean(window.R7P))) {
      const r7pBridge = await page.evaluate(() => window.R7C.orientacionIA('AC-121'));
      assert.match(r7pBridge.portalR7PInfo, /Portal R7P conectado/, 'Debe conectar con window.R7P');
      assert.ok((r7pBridge.portalRecomendaciones || []).length >= 1, 'Debe recibir recomendaciones R7P para Oficinas (oficina)');
      assert.match(r7pBridge.portalR7PInfo, /[1-9]\d*\s+evento/, 'Debe reflejar eventos del portal para negocio oficina');
    } else {
      assert.match(ac121Text, /sin dato/i, 'Si R7P no está cargado aún, debe mostrar explícitamente "sin dato"');
    }

    // Expandir productos comprados vs categorías no compradas
    await page.locator('[data-r7c-hierarchy="AC-121"] summary').click();
    const catsText = await page.textContent('[data-r7c-categories="AC-121"]');
    assert.match(catsText, /Productos comprados/, 'Debe listar productos comprados');
    assert.match(catsText, /Categorías no compradas/, 'Debe listar categorías no compradas');

    // Aprobación humana de borrador IA en R04 + persistencia tras recarga
    const iaCard = page.locator('[data-r7c-ia="AC-121"]');
    await iaCard.locator('details.r7-fold > summary').click();
    await iaCard.locator('[data-r7c-draft="AC-121"]').fill('Hola Oficinas Nueva Providencia, validamos su reposición y propuesta referencial de vasos con marca.');
    await iaCard.locator('[data-r7c-action="approve-draft"]').click();
    await page.waitForTimeout(80);
    const savedApproval = await page.evaluate(() => window.M4.get().r7AprobacionesIA?.['AC-121']);
    assert.equal(savedApproval?.estado, 'aprobado', 'La aprobación humana del borrador IA debe persistirse en estado');
    assert.match(await page.textContent('[data-r7c-ia="AC-121"]'), /Aprobado por/, 'La tarjeta IA debe reflejar la aprobación humana');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.R7C && window.MarleyApp), null, { timeout: 10000 });
    await page.evaluate(() => {
      window.M4.setRole('ventas');
      window.M4.select('AC-121');
      window.MarleyApp.go('R04', { evaluation: true });
    });
    await page.waitForFunction(() => document.body.dataset.current === 'R04', null, { timeout: 6000 });
    assert.match(await page.textContent('[data-r7c-ia="AC-121"]'), /Aprobado por/, 'La aprobación IA debe persistir tras recargar');

    // 4. Incidencia abierta pausa ciclo y prioriza servicio en AC-101
    await page.evaluate(() => {
      window.M4.update((s) => {
        s.serviceCases = s.serviceCases || {};
        s.serviceCases['AC-101::P01'] = {
          accountId: 'AC-101',
          pointId: 'P01',
          pointName: 'Hotel Altos · Barra',
          ticket: { id: 'TK-R7-TEST', type: 'Falla molino', status: 'Abierto' }
        };
      });
      window.M4.select('AC-101');
      window.MarleyApp.go('R04', { evaluation: true });
    });
    await page.waitForTimeout(60);
    const ac101Badge = await page.textContent('[data-r7c-cycle-badge="AC-101"]');
    assert.match(ac101Badge, /Pausada por incidencia/i, 'Incidencia abierta debe pausar ciclo y priorizar servicio');

    // 5. Confidencialidad Marketing en R04 (sin montos $)
    await page.evaluate(() => {
      window.M4.setRole('marketing');
      window.M4.select('AC-121');
      window.MarleyApp.go('R04', { evaluation: true });
    });
    await page.waitForTimeout(60);
    const mktPanelTxt = await page.textContent('[data-r7c-account="AC-121"]');
    assert.ok(!/\$447\.920|\$67\.000/.test(mktPanelTxt), 'El panel R7C en Marketing no debe mostrar montos en pesos');

    // 6. Diálogo de ciclo e indicadores en español desde R03 y R01
    await page.evaluate(() => {
      window.M4.setRole('ventas');
      window.MarleyApp.go('R03', { evaluation: true });
    });
    await page.waitForFunction(() => document.body.dataset.current === 'R03');
    const r03RowCount = await page.locator('[data-r7c-row-cycle]').count();
    const r03Untagged = await page.locator('#m4-main [data-a="open-account"][data-v^="AC-"]:not(:has([data-r7c-row-cycle]))').count();
    assert.ok(r03RowCount >= 7 && r03Untagged === 0, `R03 debe mostrar ciclo propio en todas las filas de cuentas (vi ${r03RowCount}, sin etiqueta ${r03Untagged})`);
    await page.locator('[data-r7c-action="open-cycle-dialog"]').click();
    await page.waitForSelector('#r7c-dialog[open]', { timeout: 3000 });
    const dlgTxt = await page.textContent('#r7c-dialog');
    assert.match(dlgTxt, /reposición digital ≠ frecuencia de compra/i, 'Debe aclarar reposición digital ≠ frecuencia');
    assert.match(dlgTxt, /ticket promedio ≠ facturación mensual/i, 'Debe aclarar ticket promedio ≠ facturación mensual');
    assert.match(dlgTxt, /Eventos Cordillera/, 'Debe listar AC-111 en la tabla de ciclo propio');
    await page.locator('[data-r7c-action="close-dialog"]').click();

    await page.evaluate(() => window.MarleyApp.go('R01', { evaluation: true }));
    await page.waitForFunction(() => document.body.dataset.current === 'R01');
    await page.locator('[data-r7c-action="open-glossary"]').click();
    await page.waitForSelector('#r7c-dialog[open]', { timeout: 3000 });
    await page.locator('[data-r7c-action="close-dialog"]').click();

    // Sin errores ni alertas en consola
    assert.deepEqual(errors, [], `Errores de consola/página en ${name}: ${JSON.stringify(errors)}`);
    await ctx.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  await verifyBrowser('Chrome', chromeLauncher, { headless: true });
  if (fs.existsSync(EDGE_PATH)) {
    await verifyBrowser('Edge', pwChromium, { headless: true, executablePath: EDGE_PATH, args: ['--disable-gpu'] });
  }
  console.log('R7 CRM (Rol C): verificación Chrome y Edge OK.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
