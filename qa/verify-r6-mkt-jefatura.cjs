const { useLegacyCrm } = require('./legacy-crm-contract.cjs');
const assert = require('node:assert/strict');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8880/index.html';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const MK_SCREENS = [
  ['R12', 'Embudo y leads'],
  ['R16', 'Estancados y recuperar'],
  ['R11', 'Campañas'],
  ['R13', 'Contenido por rubro'],
  ['R06', 'Ventas y origen']
];

const JF_SCREENS = [
  ['R05', 'Resumen'],
  ['R07', 'Por aprobar'],
  ['R06', 'Metas y costo por adquisición'],
  ['R14', 'Equipo y operación'],
  ['R15', 'Equipo y operación']
];

function relLum(rgbStr) {
  const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const l1 = relLum(fg), l2 = relLum(bg);
  if (l1 === null || l2 === null) return 99;
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

async function setRoute(page, role, hash) {
  await page.evaluate(({ r, h }) => {
    window.M4.setRole(r);
    window.MarleyApp.go(h, { evaluation: true });
  }, { r: role, h: hash });
  await page.waitForFunction((h) => document.body.dataset.current === h, hash, { timeout: 8000 });
  await page.waitForTimeout(80);
}

async function auditLayout(page, viewport, role, hash, expectedH1, maxHeight) {
  await page.setViewportSize(viewport);
  await setRoute(page, role, hash);

  const metrics = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const h1s = Array.from(document.querySelectorAll('h1')).filter(visible).map((el) => el.textContent.trim());
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const height = document.documentElement.scrollHeight;
    const txt = (document.body.innerText || '');
    const forbidden = [];
    if (/\bdemo\b|demostraci[oó]n/i.test(txt)) forbidden.push('demo');
    if (/\ba definir\b/i.test(txt)) forbidden.push('a definir');
    if (/\bMVP\b/.test(txt)) forbidden.push('MVP');
    if (/\bOCS\b/.test(txt)) forbidden.push('OCS');

    const ctrlSel = 'button, .m4-btn, .m4-r3-btn, .m4-seg, .m4-r3-temp-filter, details > summary, [data-r3-search], .r6-input, .r6-select';
    const smallCtrls = Array.from(document.querySelectorAll(ctrlSel))
      .filter((el) => visible(el) && !el.disabled && !el.closest('#m4-demo-dock,.m4-strip'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((c) => c.h < 43.5);

    const textEls = Array.from(document.querySelectorAll('.m4-crm *')).filter((el) => visible(el) && el.childNodes.length && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()));
    let minFont = 99;
    let minFontSample = '';
    for (const el of textEls) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < minFont) {
        minFont = fs;
        minFontSample = el.textContent.trim().slice(0, 40);
      }
    }

    const warnEls = Array.from(document.querySelectorAll('.m4-chip--warn, .r6-badge--warn, .m4-r3-status--urgent')).filter(visible).map((el) => {
      const st = getComputedStyle(el);
      return { txt: el.textContent.trim().slice(0, 30), color: st.color, bg: st.backgroundColor };
    });

    const greenResidual = Array.from(document.querySelectorAll('.m4-crm *')).filter(visible).filter((el) => {
      const st = getComputedStyle(el);
      const isGreen = (c) => /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.test(c) && (() => {
        const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        return g > r + 15 && g > b + 15;
      })();
      return isGreen(st.backgroundColor) || isGreen(st.color);
    }).map((el) => el.className + ':' + getComputedStyle(el).backgroundColor);

    return { h1s, overflow, height, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, forbidden, smallCtrls, minFont, minFontSample, warnEls, greenResidual };
  });

  assert.equal(metrics.h1s.length, 1, `${role}/${hash}@${viewport.width}: esperado 1 H1 visible, vi ${JSON.stringify(metrics.h1s)}`);
  assert.equal(metrics.h1s[0], expectedH1, `${role}/${hash}@${viewport.width}: H1 '${metrics.h1s[0]}' !== '${expectedH1}'`);
  assert.equal(metrics.overflow, false, `${role}/${hash}@${viewport.width}: overflow horizontal ${metrics.scrollW} > ${metrics.clientW}`);
  assert.deepEqual(metrics.forbidden, [], `${role}/${hash}@${viewport.width}: términos prohibidos: ${metrics.forbidden.join(', ')}`);
  assert.equal(metrics.smallCtrls.length, 0, `${role}/${hash}@${viewport.width}: controles <44px: ${JSON.stringify(metrics.smallCtrls)}`);
  assert.ok(metrics.minFont >= 12, `${role}/${hash}@${viewport.width}: fuente <12px (${metrics.minFont}px en '${metrics.minFontSample}')`);
  assert.deepEqual(metrics.greenResidual, [], `${role}/${hash}@${viewport.width}: colores verdes residuales: ${JSON.stringify(metrics.greenResidual)}`);
  for (const w of metrics.warnEls) {
    const cr = contrastRatio(w.color, w.bg);
    assert.ok(cr >= 4.5, `${role}/${hash}@${viewport.width}: contraste warn '${w.txt}' = ${cr.toFixed(2)} (<4.5)`);
  }
  if (maxHeight) {
    assert.ok(metrics.height <= maxHeight, `${role}/${hash}@${viewport.width}: altura ${metrics.height}px > tope ${maxHeight}px`);
  }
  return metrics;
}

async function runBrowserSuite(name, launcher, launchOpts) {
  const browser = await launcher.launch(launchOpts);
  const errors = [];
  const summary = { browser: name, heights: {}, checks: {} };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await useLegacyCrm(context);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.M4R && window.R6MJ && window.R6P), null, { timeout: 10000 });
    await page.evaluate(() => { localStorage.clear(); window.M4.reset(); });

    // 1. Verificar menús de 5 entradas = H1
    const menus = await page.evaluate(() => ({
      marketing: window.M4D.ROLE_MENUS.marketing.menu.map((x) => [x[0], x[1]]),
      jefatura: window.M4D.ROLE_MENUS.jefatura.menu.map((x) => [x[0], x[1]])
    }));
    assert.equal(menus.marketing.length, 5, 'Menú marketing debe tener 5 entradas');
    assert.equal(menus.jefatura.length, 5, 'Menú jefatura debe tener 5 entradas');

    // 2. Auditoría de diseño + altura en 1440x900 y 390x844
    for (const [h, title] of MK_SCREENS) {
      // R6c (14-nov): R12 (inicio de Marketing) con >= 40 px de margen bajo los topes (<=1260 a 1440 y <=2460 a 390)
      const top1440 = h === 'R12' ? 1260 : 1800;
      const top390 = h === 'R12' ? 2460 : 2500;
      const m1440 = await auditLayout(page, { width: 1440, height: 900 }, 'marketing', h, title, top1440);
      await auditLayout(page, { width: 1280, height: 551 }, 'marketing', h, title, top1440);
      const m390 = await auditLayout(page, { width: 390, height: 844 }, 'marketing', h, title, top390);
      summary.heights[`mkt_${h}_1440`] = m1440.height;
      summary.heights[`mkt_${h}_390`] = m390.height;
    }
    for (const [h, title] of JF_SCREENS) {
      const top1440 = h === 'R05' ? 1300 : 1800;
      const m1440 = await auditLayout(page, { width: 1440, height: 900 }, 'jefatura', h, title, top1440);
      await auditLayout(page, { width: 1280, height: 551 }, 'jefatura', h, title, top1440);
      const m390 = await auditLayout(page, { width: 390, height: 844 }, 'jefatura', h, title, 2500);
      summary.heights[`jefe_${h}_1440`] = m1440.height;
      summary.heights[`jefe_${h}_390`] = m390.height;
    }

    // Overflow checks extra: 360x800, 414x896, 1280x600
    await auditLayout(page, { width: 360, height: 800 }, 'marketing', 'R12', 'Embudo y leads', null);
    await auditLayout(page, { width: 414, height: 896 }, 'jefatura', 'R05', 'Resumen', null);
    await auditLayout(page, { width: 1280, height: 600 }, 'jefatura', 'R05', 'Resumen', 1300);

    // 3. Flujo Marketing R12
    await page.setViewportSize({ width: 1440, height: 900 });
    await setRoute(page, 'marketing', 'R12');

    // 3 tarjetas abren detalle
    for (const key of ['ventas', 'embudo', 'derivados']) {
      await page.click(`[data-r6-action="r12-detail"][data-v="${key}"]`);
      await page.waitForSelector('#r6-r12-detail');
      const dTxt = await page.textContent('#r6-r12-detail');
      assert.ok(dTxt.length > 20, `Detalle ${key} en R12 vacío`);
      if (key === 'ventas') assert.match(dTxt, /datos de prueba/i);
    }

    // Sin montos individuales en filas de R12 y detalle «Ver más»
    const r12RowDollar = await page.evaluate(() => Array.from(document.querySelectorAll('[data-r6-lead]')).some((el) => /\$\s*\d/.test(el.textContent)));
    assert.equal(r12RowDollar, false, 'R12 no puede mostrar montos individuales en $');
    // R6c (14-nov): «Ver más» en R12 abre el desglose completo sin montos
    const firstWhyBtn = page.locator('[data-r6-action="r12-why"]').first();
    assert.ok(await firstWhyBtn.count() > 0, 'R12 debe tener botón Ver más en el porqué');
    const firstLeadId = await firstWhyBtn.getAttribute('data-v');
    await firstWhyBtn.click();
    await page.waitForSelector(`[data-r6-why-detail="${firstLeadId}"]`);
    const whyDetTxt = await page.textContent(`[data-r6-why-detail="${firstLeadId}"]`);
    assert.match(whyDetTxt, /tazas/i);
    assert.doesNotMatch(whyDetTxt, /\$\s*\d/);
    await page.click(`[data-r6-action="r12-why"][data-v="${firstLeadId}"]`);

    // Filtros R12
    for (const fk of ['listos', 'calientes', 'tibios', 'frios', 'valor_alto', 'todos']) {
      await page.click(`[data-r6-action="r12-filter"][data-v="${fk}"]`);
      const pressed = await page.getAttribute(`[data-r6-action="r12-filter"][data-v="${fk}"]`, 'aria-pressed');
      assert.equal(pressed, 'true', `Filtro ${fk} no quedó activo`);
    }

    // Nutrir solo con permiso
    const nutrirCheck = await page.evaluate(() => {
      const noPerm = document.querySelector('[data-r6-lead="MC-HOR-2040"]');
      const withPerm = document.querySelector('[data-r6-lead="MC-HOR-2036"]');
      return {
        noPermHasBtn: Boolean(noPerm && noPerm.querySelector('[data-a="lead-nutrir"]')),
        noPermHasLabel: Boolean(noPerm && /Sin permiso de promoción/i.test(noPerm.textContent)),
        withPermHasBtn: Boolean(withPerm && withPerm.querySelector('[data-a="lead-nutrir"]'))
      };
    });
    assert.equal(nutrirCheck.noPermHasBtn, false, 'Nutrir no debe aparecer sin permiso');
    assert.equal(nutrirCheck.noPermHasLabel, true, 'Debe mostrar Sin permiso de promoción');
    assert.equal(nutrirCheck.withPermHasBtn, true, 'Nutrir debe aparecer con permiso');

    // Pasar a ventas escribe estado: 'esperando' y aparece en R01; aceptar/devolver cambia R12
    await page.selectOption('[data-r3-reason-for="MC-HOR-2036"]', 'Volumen suficiente');
    await page.click('[data-r3-action="pass-sales"][data-lead="MC-HOR-2036"]');
    const paso = await page.evaluate(() => window.M4.get().marketingPasos['MC-HOR-2036']);
    assert.equal(paso.estado, 'esperando', 'marketingPasos debe tener estado esperando');

    await setRoute(page, 'ventas', 'R01');
    const r01Txt = await page.textContent('#m4-main');
    assert.match(r01Txt, /Carolina Muñoz/, 'R01 de Ventas debe mostrar el lead pasado por Marketing');

    // Simular devolución por Ventas
    await page.evaluate(() => {
      window.M4.update((st) => {
        st.marketingPasos['MC-HOR-2036'].estado = 'devuelto';
        st.marketingPasos['MC-HOR-2036'].motivoDevolucion = 'Falta confirmar comuna exacta';
      });
    });
    await setRoute(page, 'marketing', 'R12');
    const devTxt = await page.textContent('[data-r6-handoff="MC-HOR-2036"]');
    assert.match(devTxt, /Devuelto:\s*Falta confirmar comuna exacta/);

    // 4. Flujo Marketing R16 (grupos + pieza + diálogos Permisos / Programar / Contactado)
    await setRoute(page, 'marketing', 'R16');
    const r16Groups = await page.evaluate(() => Array.from(document.querySelectorAll('[data-r6-group]')).map((el) => el.dataset.r6Group));
    assert.ok(r16Groups.includes('devuelto') && r16Groups.includes('inactivo'), `Grupos R16 inesperados: ${r16Groups}`);
    const r16Txt = await page.textContent('#m4-main');
    assert.match(r16Txt, /E0[23459]|Elegir máquina|Café para desayuno/);

    // R6c (14-nov): una cuenta con incidencia abierta en R16 muestra la pausa y no una promoción
    await page.click('[data-r6-group="inactivo"] > summary');
    const accCheck = await page.evaluate(() => {
      const grp = document.querySelector('[data-r6-group="inactivo"]');
      const cards = grp ? Array.from(grp.querySelectorAll('[data-r6-recovery][data-r6-kind="acc"]')) : [];
      const orderIds = cards.map((c) => c.dataset.r6Recovery);
      const incCard = grp ? grp.querySelector('[data-r6-recovery="AC-101"]') : null;
      const lateCard = grp ? grp.querySelector('[data-r6-recovery="AC-117"]') : null;
      return {
        orderIds,
        grpHasDollar: Boolean(grp && /\$\s*\d/.test(grp.textContent)),
        incText: incCard ? incCard.textContent : '',
        incHasPausa: Boolean(incCard && /Pausar promociones:\s*primero postventa/i.test(incCard.textContent)),
        incHasPromo: Boolean(incCard && (/Pieza sugerida/i.test(incCard.textContent) || incCard.querySelector('[data-r6-action="recovery-approve"]'))),
        incHasServicioChip: Boolean(incCard && /Servicio primero/i.test(incCard.textContent)),
        lateHasChipCuenta: Boolean(lateCard && /Relación\s+\d+\/100/i.test(lateCard.textContent) && /Valor real\s+\d+\/100/i.test(lateCard.textContent)),
        lateHasPiece: Boolean(lateCard && /Pieza sugerida/i.test(lateCard.textContent))
      };
    });
    assert.equal(accCheck.grpHasDollar, false, 'R16 cuentas no debe mostrar montos en $ para Marketing');
    assert.ok(accCheck.orderIds.indexOf('AC-101') === 0, `AC-101 (Servicio primero) debe ir primero en R16 cuentas: ${JSON.stringify(accCheck.orderIds)}`);
    assert.equal(accCheck.incHasServicioChip, true, 'Cuenta con incidencia debe mostrar chip Servicio primero');
    assert.equal(accCheck.incHasPausa, true, 'Cuenta con incidencia abierta debe mostrar Pausar promociones: primero postventa');
    assert.equal(accCheck.incHasPromo, false, 'Cuenta con incidencia abierta no debe ofrecer pieza ni botón de promoción');
    assert.equal(accCheck.lateHasChipCuenta, true, 'Cuenta con recompra atrasada debe usar chipCuenta (Relación y Valor real)');
    assert.equal(accCheck.lateHasPiece, true, 'Cuenta sin incidencia debe mostrar pieza sugerida de reactivación');

    // Probar diálogo Permisos y Programar
    await page.click('[data-r3-action="open-permission"]');
    await page.waitForSelector('#m4-r3-dialog[open]');
    await page.click('[data-r3-action="close-dialog"]');
    await page.click('[data-r3-action="open-followup"]');
    await page.waitForSelector('#m4-r3-dialog[open]');
    await page.click('[data-r3-action="close-dialog"]');

    // R11 y R13 acciones básicas
    await setRoute(page, 'marketing', 'R11');
    await page.click('details.m4-r3-secondary summary:has-text("Canal, piezas y KPI")');
    await page.click('[data-r3-action="preview"]');
    await page.waitForSelector('#m4-r3-dialog[open]');
    await page.click('[data-r3-action="close-dialog"]');

    await setRoute(page, 'marketing', 'R13');
    await page.click('[data-r3-action="content-validate"]');
    await page.waitForTimeout(40);

    // 5. Marketing R06 Ventas y origen (sin CAC individual)
    await setRoute(page, 'marketing', 'R06');
    const r06MktTxt = await page.textContent('#m4-main');
    assert.match(r06MktTxt, /Leads, MQL y SQL por origen/);
    assert.doesNotMatch(r06MktTxt, /Gasto 90 días/);

    // 6. Flujo Jefatura R05 + R06 CAC y Metas
    await setRoute(page, 'jefatura', 'R05');
    const r05Txt = await page.textContent('#m4-main');
    assert.match(r05Txt, /Escenario del piloto \(informe V7\.1\) · datos de prueba/);
    assert.match(r05Txt, /\$666\.667/); // $2.000.000 / 3 cuentas nuevas

    // Editar meta en R05 y validar en R06 tras reload
    await page.click('[data-r6-action="toggle-r05-goal"]');
    await page.fill('#r6-r05-goal-editor input[name="montoPesos"]', '12500000');
    await page.fill('#r6-r05-goal-editor input[name="cuentasNuevas"]', '5');
    await page.click('#r6-r05-goal-editor button[type="submit"]');
    await page.waitForTimeout(80);
    assert.match(await page.textContent('#m4-main'), /\$12\.500\.000/);

    await setRoute(page, 'jefatura', 'R06');
    assert.match(await page.textContent('#m4-main'), /\$12\.500\.000/);
    assert.match(await page.textContent('#m4-main'), /Cuentas nuevas objetivo:\s*5/i);

    // Editar gasto CAC en R06 y verificar recálculo
    await page.fill('[data-r6-spend="search"]', '900000');
    await page.waitForTimeout(50);
    assert.match(await page.textContent('[data-r6-cac-total]'), /\$2\.300\.000/);
    assert.match(await page.textContent('[data-r6-cac-result]'), /\$766\.667/);

    // 3.a capa del mapa (abrir details primero)
    await page.click('details.hoy-det summary:has-text("Mapa por comuna")');
    await page.click('[data-a="map-layer"][data-v="valor_esperado"]');
    await page.waitForTimeout(60);
    assert.match(await page.textContent('#m4-main'), /Valor esperado por comuna|Comuna/);

    // Modo CAC pendiente
    await page.evaluate(() => { window.R6MJ.CAC_MODO = 'pendiente'; window.MarleyApp.render(); });
    assert.match(await page.textContent('#m4-main'), /Costo por adquisición pendiente: sin gasto real conectado/);
    await page.evaluate(() => { window.R6MJ.CAC_MODO = 'calculadora'; window.MarleyApp.render(); });

    // 7. Jefatura R07 aprobación + Pedir información + recarga + load-example no cambia rol
    await setRoute(page, 'jefatura', 'R07');
    await page.evaluate(() => {
      window.M4.update((st) => {
        st.jefeAprob.push({ id: 'AP-R6-INFO', leadId: 'MC-HOR-2049', titulo: 'Descuento flota · Hotel Valle Nevado', tipo: 'Descuento', monto: 480000, motivo: 'Caso prueba info', estado: 'pendiente', nota: '', por: '', at: window.M4.now() });
      });
      window.MarleyApp.render();
    });
    await page.click('[data-r6-action="aprob-ok"][data-v="AP-R6-1"]');
    await page.waitForTimeout(60);
    const aprobRec = await page.evaluate(() => window.M4.get().jefeAprob.find((x) => x.id === 'AP-R6-1'));
    assert.equal(aprobRec.estado, 'aprobada', 'Solicitud AP-R6-1 debe quedar aprobada');
    assert.ok(aprobRec.por && aprobRec.at, 'Debe registrar por y at');

    await page.click('[data-r6-action="aprob-info-open"][data-v="AP-R6-INFO"]');
    await page.fill('form[data-r6-form="aprob-info"] input[name="nota"]', 'Adjuntar consumo mensual confirmado');
    await page.click('form[data-r6-form="aprob-info"] button[type="submit"]');
    await page.waitForTimeout(60);
    const infoRec = await page.evaluate(() => window.M4.get().jefeAprob.find((x) => x.id === 'AP-R6-INFO'));
    assert.equal(infoRec.estado, 'pidio_info');
    assert.equal(infoRec.nota, 'Adjuntar consumo mensual confirmado');

    // load-example mantiene rol jefatura (desde R07 antes de cargar ejemplo)
    await page.click('[data-a="load-example"]');
    await page.waitForTimeout(80);
    const roleAfterEx = await page.evaluate(() => window.M4.get().role);
    assert.equal(roleAfterEx, 'jefatura', 'load-example no debe sacar a Jefatura de su rol');

    // R14 / R15 pestaña Equipo y operación
    await setRoute(page, 'jefatura', 'R14');
    await page.click('[data-r6-action="r14-tab"][data-v="operacion"]');
    await page.waitForTimeout(40);
    assert.match(await page.textContent('#m4-main'), /OTIF|Parque de máquinas/);

    // Recarga persiste meta y aprobaciones
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.R6MJ), null, { timeout: 10000 });
    const persisted = await page.evaluate(() => ({
      goal: window.M4.get().crmR3?.monthlyGoal?.montoPesos,
      spendSearch: window.M4.get().r6CacSpend?.search
    }));
    assert.equal(persisted.goal, 12500000, 'Meta en pesos debe persistir tras recarga');
    assert.equal(persisted.spendSearch, 900000, 'Gasto CAC debe persistir tras recarga');

    // 8. Regresión Ventas R07 / R16
    await setRoute(page, 'ventas', 'R16');
    assert.ok(await page.locator('.m7c-feed').count() > 0, 'Ventas en R16 debe conservar .m7c-feed');

    summary.checks = { r12: 'PASS', r16: 'PASS', r11: 'PASS', r13: 'PASS', r05: 'PASS', r06: 'PASS', r07: 'PASS', r14_r15: 'PASS', loadExampleRole: roleAfterEx, errors: errors.length };
    assert.deepEqual(errors, [], `Errores en ${name}: ${errors.join(' | ')}`);
    return summary;
  } finally {
    await browser.close();
  }
}

(async () => {
  const chromeRes = await runBrowserSuite('Chrome', chromeLauncher, { headless: true });
  const edgeRes = await runBrowserSuite('Edge', pwChromium, { executablePath: EDGE_PATH, headless: true });
  process.stdout.write(JSON.stringify({ status: 'PASS', results: [chromeRes, edgeRes] }, null, 2) + '\n');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
