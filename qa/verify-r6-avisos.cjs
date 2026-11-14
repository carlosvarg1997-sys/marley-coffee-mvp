const assert = require('node:assert/strict');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8880/index.html';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function setRoute(page, role, hash) {
  await page.evaluate(({ r, h }) => {
    window.M4.setRole(r);
    window.MarleyApp.go(h, { evaluation: true });
  }, { r: role, h: hash });
  await page.waitForTimeout(160);
}

async function waitForR6A(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    const ok = await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.R6A && window.R6P), null, { timeout: 12000 }).then(() => true).catch(() => false);
    if (ok) return;
  }
  await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.R6A && window.R6P), null, { timeout: 15000 });
}

async function auditSurface(page, viewport, role, hash, options = {}) {
  const { maxHeightDesktop = 1300, maxHeightMobile = 2500, checkPanelOpen = false } = options;
  await page.setViewportSize(viewport);
  await setRoute(page, role, hash);

  if (checkPanelOpen) {
    await page.click('[data-r6-avisos-toggle]');
    await page.waitForSelector('#r6-avisos-panel', { state: 'visible' });
  }

  const metrics = await page.evaluate(({ isMobile, isOpen }) => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
    };

    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const docHeight = document.documentElement.scrollHeight;
    const trigger = document.querySelector('[data-r6-avisos-toggle]');
    const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
    const tabbar = document.querySelector('.m4-tabbar');
    const tabbarRect = tabbar && vis(tabbar) ? tabbar.getBoundingClientRect() : null;

    let overlapsTabbar = false;
    if (triggerRect && tabbarRect) {
      overlapsTabbar = !(triggerRect.bottom <= tabbarRect.top || triggerRect.top >= tabbarRect.bottom);
    }

    const ctrlList = isOpen
      ? '#r6-avisos-panel button, #r6-avisos-panel summary'
      : '[data-r6-avisos-toggle], .r6-avisos-strip button, .r6-avisos-strip summary';
    const smallControls = Array.from(document.querySelectorAll(ctrlList))
      .filter((el) => vis(el) && !el.disabled)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((c) => c.h < 43.5 || c.w < 43.5);

    const fontTargets = Array.from(document.querySelectorAll('.r6-avisos-btn, .r6-avisos-btn *, .r6-avisos-strip *, #r6-avisos-panel *'))
      .filter((el) => vis(el) && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()));
    let minFont = 99;
    let minFontSample = '';
    for (const el of fontTargets) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < minFont) {
        minFont = fs;
        minFontSample = el.textContent.trim().slice(0, 35);
      }
    }

    // R6c (14-nov): paleta Negro Marley estricta (sin rosado ni borde rojo; rojo solo en texto vencido o con error)
    const badColors = [];
    const colorTargets = Array.from(document.querySelectorAll('.r6-avisos-btn, .r6-avisos-strip, .r6-avisos-strip *, #r6-avisos-panel, #r6-avisos-panel *')).filter(vis);
    const checkRgb = (cssVal, elDesc, prop) => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i.exec(cssVal || '');
      if (!m) return;
      if (m[4] !== undefined && Number(m[4]) === 0) return;
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (r === g && g === b) return; // neutral gray/white/black
      if (r >= 220 && g >= 180 && b <= 60) return; // Negro Marley yellow (#f3c900 / hover)
      if (r >= 130 && g <= 60 && b <= 55) {
        const allowRedText = prop === 'fg' && /r6-aviso-overdue|is-error/.test(String(elDesc || ''));
        if (!allowRedText) badColors.push(`red-${prop}(${cssVal})@${elDesc}`);
        return;
      }
      if (r >= 240 && g >= 215 && b >= 210 && r > g + 10 && r > b + 10) {
        badColors.push(`pink-${prop}(${cssVal})@${elDesc}`);
      } else if (r >= 235 && g >= 220 && b >= 180 && b > 140) badColors.push(`cream/beige(${cssVal})@${elDesc}`);
      else if (g > r + 15 && g > b + 15) badColors.push(`green(${cssVal})@${elDesc}`);
      else if (b > r + 20 && b > g + 15) badColors.push(`blue/celeste(${cssVal})@${elDesc}`);
    };
    colorTargets.forEach((el) => {
      const st = getComputedStyle(el);
      checkRgb(st.backgroundColor, el.className, 'bg');
      checkRgb(st.color, el.className, 'fg');
      if (parseFloat(st.borderLeftWidth) > 0) checkRgb(st.borderLeftColor, el.className, 'border');
    });

    if (isOpen) {
      document.querySelectorAll('#r6-avisos-panel .r6-aviso-origin').forEach((chip) => {
        if (!vis(chip)) return;
        const st = getComputedStyle(chip);
        if (st.backgroundColor !== 'rgb(229, 229, 229)' || st.color !== 'rgb(13, 13, 13)') {
          badColors.push(`origin-not-neutral(${st.backgroundColor}/${st.color})`);
        }
        if (!chip.querySelector('svg')) {
          badColors.push(`origin-missing-icon(${chip.textContent.trim()})`);
        }
      });
    }

    const panel = document.getElementById('r6-avisos-panel');
    const panelRect = panel && vis(panel) ? panel.getBoundingClientRect() : null;

    const allText = (isOpen && panel ? panel.innerText : '') + '\n' + (document.getElementById('m4-main')?.innerText || '');
    const forbidden = [];
    if (/\bMVP\b/.test(allText)) forbidden.push('MVP');
    if (/\bOCS\b/.test(allText)) forbidden.push('OCS');
    if (/\batender_ya\b/i.test(allText)) forbidden.push('atender_ya');
    if (/\bscore\b/i.test(allText)) forbidden.push('score');
    if (/\ba definir\b/i.test(allText)) forbidden.push('a definir');

    return {
      overflow,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      docHeight,
      triggerVisible: vis(trigger),
      triggerW: triggerRect ? Math.round(triggerRect.width) : 0,
      triggerH: triggerRect ? Math.round(triggerRect.height) : 0,
      overlapsTabbar,
      smallControls,
      minFont,
      minFontSample,
      badColors,
      panelRect: panelRect ? { x: Math.round(panelRect.left), y: Math.round(panelRect.top), w: Math.round(panelRect.width), h: Math.round(panelRect.height), bottom: Math.round(panelRect.bottom), right: Math.round(panelRect.right) } : null,
      forbidden
    };
  }, { isMobile: viewport.width <= 767, isOpen: checkPanelOpen });

  assert.equal(metrics.overflow, false, `Desborde horizontal en ${role}/${hash} @${viewport.width}x${viewport.height}: scrollW=${metrics.scrollW} > clientW=${metrics.clientW}`);
  assert.equal(metrics.triggerVisible, true, `Botón Avisos no visible en ${role}/${hash} @${viewport.width}x${viewport.height}`);
  assert.ok(metrics.triggerH >= 43.5 && metrics.triggerW >= 43.5, `Botón Avisos < 44px en ${role}/${hash} @${viewport.width}: ${metrics.triggerW}x${metrics.triggerH}`);
  assert.equal(metrics.overlapsTabbar, false, `Botón Avisos choca con barra inferior en ${role}/${hash} @${viewport.width}`);
  assert.deepEqual(metrics.smallControls, [], `Controles < 44px en ${role}/${hash} @${viewport.width}: ${JSON.stringify(metrics.smallControls)}`);
  assert.ok(metrics.minFont >= 12, `Letra < 12px en ${role}/${hash} @${viewport.width}: ${metrics.minFont}px (${metrics.minFontSample})`);
  assert.deepEqual(metrics.badColors, [], `Colores fuera de paleta Negro Marley en ${role}/${hash}: ${JSON.stringify(metrics.badColors)}`);
  assert.deepEqual(metrics.forbidden, [], `Palabras prohibidas en ${role}/${hash}: ${JSON.stringify(metrics.forbidden)}`);

  if (!checkPanelOpen) {
    const cap = viewport.width >= 1024 ? maxHeightDesktop : maxHeightMobile;
    assert.ok(metrics.docHeight <= cap, `Alto excede tope (${metrics.docHeight} > ${cap}) en ${role}/${hash} @${viewport.width}x${viewport.height}`);
  } else {
    assert.ok(metrics.panelRect, 'Panel abierto sin bounding box');
    if (viewport.width <= 767) {
      assert.ok(metrics.panelRect.bottom >= viewport.height - 10, `Hoja inferior móvil no anclada abajo: ${JSON.stringify(metrics.panelRect)}`);
    } else {
      assert.ok(metrics.panelRect.right >= viewport.width - 5 && metrics.panelRect.h >= viewport.height - 10, `Panel lateral escritorio mal ubicado: ${JSON.stringify(metrics.panelRect)}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
  }
}

async function runFlows(page, browserLabel) {
  console.log(`Iniciando verify-r6-avisos en ${browserLabel}...`);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror(${browserLabel}): ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console(${browserLabel}): ${m.text()}`); });

  await waitForR6A(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // R6c (14-nov): avisos agrupados por tipo — en estado de ejemplo, el botón «Avisos» marca <= 7 por rol
  await page.evaluate(() => { window.M4.loadExample(); });
  for (const [role, home] of [['ventas', 'R01'], ['marketing', 'R12'], ['jefatura', 'R05']]) {
    await setRoute(page, role, home);
    const badgeCount = Number(await page.locator('[data-r6-avisos-toggle] .r6-avisos-btn-count').textContent());
    assert.ok(badgeCount >= 1 && badgeCount <= 7, `R6c: conteo de grupos en ${role} debe estar entre 1 y 7 (dio ${badgeCount})`);
  }

  // Preparar un estado limpio para traspasos + postventa + cliente (con lead MQL en vivo completo)
  await page.evaluate(() => {
    window.M4.reset();
    const t = window.M4.now();
    window.M4.update((st) => {
      st.marketingPasos = {};
      st.avisosVistos = {};
      st.jefeAprob = [];
      st.sql = null;
      st.lead = {
        id: 'MC-LIVE-TRASPASO',
        name: 'Camila Rojas',
        company: 'HotelMirador',
        email: 'camila@hotelmirador.cl',
        consent: true,
        marketingConsent: true,
        source: 'Google Ads',
        at: t - 3600000
      };
      st.answers = { negocio: 'Hotel', comuna: 'Providencia', consumo: '160' };
      st.events = [
        { key: 'form1', pts: 25, at: t - 3600000 },
        { key: 'diag_completo', pts: 10, at: t - 3500000 },
        { key: 'cotizar', pts: 10, at: t - 3400000 },
        { key: 'ejecutivo', pts: 15, at: t - 3300000 },
        { key: 'mkt_mql', eventName: 'lead_qualified', qualification_status: 'MQL', actor_type: 'human', pts: 0, at: t - 1200000 }
      ];
    });
  });

  // 1. Marketing pasa el lead en vivo -> Ventas ve el aviso y su número
  await setRoute(page, 'marketing', 'R12');
  const passBtn = page.locator('[data-r3-action="pass-sales"][data-lead="MC-LIVE-TRASPASO"]');
  if (!(await passBtn.isVisible().catch(() => false))) {
    const moreLeads = page.locator('#m4-main details summary').first();
    if (await moreLeads.count()) await moreLeads.click();
  }
  await passBtn.waitFor({ state: 'visible' });
  const passedLeadId = 'MC-LIVE-TRASPASO';
  await page.selectOption(`[data-r3-reason-for="${passedLeadId}"]`, 'Volumen suficiente');
  await passBtn.click();
  await page.waitForTimeout(150);

  await setRoute(page, 'ventas', 'R01');
  const ventasBeforeBadge = Number(await page.locator('[data-r6-avisos-toggle] .r6-avisos-btn-count').textContent());
  // R6c (14-nov): avisos agrupados por tipo (badge cuenta grupos <= 7)
  assert.ok(ventasBeforeBadge >= 1 && ventasBeforeBadge <= 7, `Badge de Avisos en Ventas debe estar entre 1 y 7 (dio ${ventasBeforeBadge})`);
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  // R6c (14-nov): avisos agrupados por tipo — verificar orden de urgencia: postventa -> traspasos -> prioridad alta -> resto
  const ventasGroupKinds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#r6-avisos-panel [data-r6-aviso-group]')).map((el) => el.getAttribute('data-r6-aviso-kind'))
  );
  const idxPost = ventasGroupKinds.indexOf('postventa');
  const idxTrasp = ventasGroupKinds.indexOf('traspaso_esperando');
  const idxA04 = ventasGroupKinds.indexOf('A04');
  const idxA08 = ventasGroupKinds.indexOf('A08');
  assert.ok(idxPost !== -1 && idxTrasp !== -1 && idxA04 !== -1 && idxA08 !== -1, `Faltan grupos esperados en Ventas: ${JSON.stringify(ventasGroupKinds)}`);
  assert.ok(idxPost < idxTrasp && idxTrasp < idxA04 && idxA04 < idxA08, `Orden de urgencia incorrecto: ${JSON.stringify(ventasGroupKinds)}`);
  const ventasTraspasoCard = page.locator('#r6-avisos-panel [data-r6-aviso-group][data-r6-aviso-kind="traspaso_esperando"]').first();
  await ventasTraspasoCard.waitFor({ state: 'visible' });
  const traspasoTitle = await ventasTraspasoCard.textContent();
  assert.match(traspasoTitle, /Marketing te pasó a/i, 'Ventas no ve aviso de Marketing te pasó');
  assert.match(traspasoTitle, /De Marketing/i, 'Falta origen De Marketing');

  // Probar «¿Por qué este aviso?» y «Cómo funcionan los avisos»
  const whySummary = ventasTraspasoCard.locator('details.r6-aviso-why summary');
  await whySummary.click();
  const guideText = await ventasTraspasoCard.locator('.r6-aviso-guide').textContent();
  assert.match(guideText, /Qué gana el cliente/i);
  assert.match(guideText, /Qué mide Marley/i);
  assert.match(guideText, /Cuándo se detiene/i);

  const manualSummary = page.locator('#r6-avisos-panel details.r6-avisos-manual summary');
  await manualSummary.click();
  const manualRows = await page.locator('#r6-avisos-panel .r6-avisos-table tbody tr').count();
  assert.ok(manualRows >= 10, `Tabla Cómo funcionan los avisos debe tener al menos 10 filas (tiene ${manualRows})`);

  // Escape cierra panel y devuelve el foco al botón trigger
  await page.keyboard.press('Escape');
  await page.waitForSelector('#r6-avisos-panel', { state: 'detached' });
  const focusedAfterEsc = await page.evaluate(() => document.activeElement?.hasAttribute('data-r6-avisos-toggle'));
  assert.equal(focusedAfterEsc, true, 'Escape no devolvió el foco al botón Avisos');

  // Abrir desde la franja de inicio «Ver todos» y navegar al lead exacto
  await page.click('[data-r6-avisos-open-all]');
  await page.waitForSelector('#r6-avisos-panel');
  await page.locator('#r6-avisos-panel [data-r6-aviso-kind="traspaso_esperando"] [data-r6-aviso-act]').first().click();
  await page.waitForTimeout(160);
  const currentAfterGo = await page.evaluate(() => ({ hash: location.hash, sel: window.M4.get().sel }));
  assert.match(currentAfterGo.hash, /#R04/, 'Acción de traspaso debe llevar a R04');
  assert.equal(currentAfterGo.sel, passedLeadId, `Acción de traspaso debe seleccionar lead ${passedLeadId}`);

  // 2. Ventas acepta como SQL por UI -> desaparece aviso en Ventas y Marketing ve «aceptó»
  const acceptBtn = page.locator(`[data-r6-v-action="accept-sql"][data-lead="${passedLeadId}"]`).first();
  await acceptBtn.waitFor({ state: 'visible' });
  assert.equal(await acceptBtn.isDisabled(), false, 'Aceptar como SQL debe estar habilitado para el lead en vivo calificado');
  await acceptBtn.click();
  await page.waitForTimeout(150);

  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const waitingCount = await page.locator(`#r6-avisos-panel [data-r6-aviso-id*="traspaso_esperando:${passedLeadId}"]`).count();
  assert.equal(waitingCount, 0, 'Al aceptar como SQL, el aviso esperando debe desaparecer de Ventas');
  await page.keyboard.press('Escape');

  await setRoute(page, 'marketing', 'R12');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const acceptedText = await page.locator('#r6-avisos-panel [data-r6-aviso-kind="traspaso_aceptado"]').first().textContent();
  assert.match(acceptedText, /Ventas aceptó a .* como SQL/i, 'Marketing no ve aviso de SQL aceptado');
  await page.keyboard.press('Escape');

  // 3. Ventas devuelve otro lead (con permiso promocional) por UI -> Marketing ve «devolvió» con acción a R16
  await page.evaluate(() => {
    window.M4.select('MC-HOR-2036');
  });
  await setRoute(page, 'ventas', 'R04');
  await page.waitForSelector('[data-r6-v-action="return-open"][data-lead="MC-HOR-2036"]');
  await page.click('[data-r6-v-action="return-open"][data-lead="MC-HOR-2036"]');
  await page.selectOption('[data-r6-v-reason="MC-HOR-2036"]', 'Falta volumen');
  await page.click('[data-r6-v-action="return-confirm"][data-lead="MC-HOR-2036"]');
  await page.waitForTimeout(150);

  await setRoute(page, 'marketing', 'R12');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const devAviso = page.locator('#r6-avisos-panel [data-r6-aviso-id*="traspaso_devuelto:MC-HOR-2036"]');
  await devAviso.waitFor({ state: 'visible' });
  const devText = await devAviso.textContent();
  assert.match(devText, /Ventas devolvió a/i, 'Marketing debe ver Ventas devolvió a');
  const devActBtn = devAviso.locator('[data-r6-aviso-act]');
  assert.match(await devActBtn.textContent(), /Recuperar/i);
  await devActBtn.click();
  await page.waitForTimeout(160);
  assert.match(await page.evaluate(() => location.hash), /#R16/, 'Acción Recuperar debe navegar a R16');

  // 4. Ventas pide aprobación -> Jefatura ve el aviso -> aprueba -> Ventas ve «aprobó»
  await setRoute(page, 'ventas', 'R04');
  await page.evaluate(() => {
    window.M4.select('MC-HOR-2039');
    window.M4.update((st) => {
      st.jefeAprob = st.jefeAprob || [];
      st.jefeAprob.push({
        id: 'AP-AVISO-TEST',
        leadId: 'MC-HOR-2039',
        cuenta: 'Boutique Hotel Providencia',
        titulo: 'Comodato 2 máquinas para desayuno y lobby',
        tipo: 'Descuento inicial',
        monto: 480000,
        motivo: 'Contrato anual garantizado de cápsulas e insumos',
        estado: 'pendiente',
        por: 'Paula Díaz · Ventas',
        at: window.M4.now()
      });
    });
    window.MarleyApp.render();
  });
  await page.waitForTimeout(120);

  await setRoute(page, 'jefatura', 'R05');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const jefePend = page.locator('#r6-avisos-panel [data-r6-aviso-id*="AP-AVISO-TEST"]');
  await jefePend.waitFor({ state: 'visible' });
  assert.match(await jefePend.textContent(), /Ventas pide aprobar: Descuento inicial/i);
  await jefePend.locator('[data-r6-aviso-act]').click();
  await page.waitForTimeout(160);
  assert.match(await page.evaluate(() => location.hash), /#R07/, 'Acción de aprobación debe llevar a R07');

  const aprobOkBtn = page.locator('[data-r6-aprob="AP-AVISO-TEST"] [data-r6-action="aprob-ok"]');
  await aprobOkBtn.waitFor({ state: 'visible' });
  await aprobOkBtn.click();
  await page.waitForTimeout(150);

  await setRoute(page, 'ventas', 'R01');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const ventasAprob = page.locator('#r6-avisos-panel [data-r6-aviso-id*="aprob_res:AP-AVISO-TEST"]');
  await ventasAprob.waitFor({ state: 'visible' });
  assert.match(await ventasAprob.textContent(), /Jefatura aprobó/i, 'Ventas debe ver que Jefatura aprobó');

  // 5. Marcar como visto persiste tras recargar
  const firstSeenBtn = page.locator('#r6-avisos-panel [data-r6-aviso-seen]').first();
  const seenId = await firstSeenBtn.getAttribute('data-r6-aviso-seen');
  const countBeforeSeen = Number(await page.locator('[data-r6-avisos-toggle] .r6-avisos-btn-count').textContent());
  await firstSeenBtn.click();
  await page.waitForTimeout(120);
  const countAfterSeen = Number(await page.locator('[data-r6-avisos-toggle] .r6-avisos-btn-count').textContent());
  assert.equal(countAfterSeen, Math.max(0, countBeforeSeen - 1), 'Marcar como visto debe descontar 1 del contador');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.R6A));
  await setRoute(page, 'ventas', 'R01');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const persistedPressed = await page.locator(`#r6-avisos-panel [data-r6-aviso-seen="${seenId}"]`).getAttribute('aria-pressed');
  assert.equal(persistedPressed, 'true', 'Marcar como visto debe mantenerse tras recargar');
  await page.keyboard.press('Escape');

  // 6. Postventa abierto -> genera avisos para los 3 roles
  const checkPostventaRole = async (role, hash, expectedRegex) => {
    await setRoute(page, role, hash);
    await page.click('[data-r6-avisos-toggle]');
    await page.waitForSelector('#r6-avisos-panel');
    const txt = await page.locator('#r6-avisos-panel').innerText();
    assert.match(txt, expectedRegex, `Falta aviso de postventa en ${role}: esperado ${expectedRegex}`);
    await page.keyboard.press('Escape');
  };
  await checkPostventaRole('ventas', 'R01', /Primero resolver postventa/i);
  await checkPostventaRole('marketing', 'R12', /Pausar promociones a .* tiene un caso abierto/i);
  await checkPostventaRole('jefatura', 'R05', /Incidencia abierta/i);

  // 7. Sin permiso: Marketing NO recibe acciones de promoción, solo «Sin permiso»
  await setRoute(page, 'marketing', 'R12');
  await page.evaluate(() => {
    window.M4.update((st) => {
      st.crmR3 = st.crmR3 || { events: [], permissions: {}, followups: {}, content: {}, campaigns: {}, postventa: {} };
      (window.M4D.PROSPECTS || []).forEach((p) => {
        st.crmR3.permissions[p.id] = { response: 'si', promotion: 'no' };
      });
      if (st.lead) st.lead.marketingConsent = false;
      st.marketingPasos = {
        'MC-HOR-2041': { motivo: 'Lead sin permiso', motivoDevolucion: 'Sin permiso promocional', estado: 'devuelto', at: window.M4.now() }
      };
    });
    window.MarleyApp.render();
  });
  await page.waitForTimeout(120);
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const mktNoPermStats = await page.evaluate(() => {
    const panel = document.getElementById('r6-avisos-panel');
    const actBtns = Array.from(panel.querySelectorAll('[data-r6-aviso-act]')).map((b) => b.textContent.trim());
    const noPermBadges = Array.from(panel.querySelectorAll('.r6-aviso-noperm')).map((b) => b.textContent.trim());
    return { actBtns, noPermBadges };
  });
  assert.equal(mktNoPermStats.actBtns.length, 0, `Sin permiso promocional no debe haber acciones promocionales en Marketing: ${JSON.stringify(mktNoPermStats.actBtns)}`);
  assert.ok(mktNoPermStats.noPermBadges.some((t) => /Sin permiso/i.test(t)), 'Debe mostrarse etiqueta «Sin permiso»');
  await page.keyboard.press('Escape');

  // 8. Del cliente (A03, ejecutivo, C06) y del sistema (A04, A05, A08, A10, A11, A12)
  await page.evaluate(() => {
    const oldAt = window.M4.now() - (4 * 86400000);
    window.M4.update((st) => {
      st.lead = {
        id: 'MC-LIVE-AVISO',
        name: 'Carolina Soto',
        company: 'Café Cordillera',
        email: 'carolina@cordillera.cl',
        consent: true,
        marketingConsent: true,
        channel: 'chat',
        at: oldAt,
        createdAt: oldAt,
        contactRequestedAt: oldAt
      };
      st.answers = { negocio: 'Cafetería', comuna: 'Providencia', consumo: '100' };
      st.events = [
        { key: 'form1', pts: 25, at: oldAt },
        { key: 'cotizar', pts: 10, at: oldAt + 60000 },
        { key: 'ejecutivo', pts: 15, at: oldAt + 120000 }
      ];
      st.sql = null;
      st.conv = null;
      st.proposal = { id: 'PR-LIVE-1', machine: 'bar', mode: 'comodato', status: 'aceptada', acceptedAt: window.M4.now() - 60000 };
    });
  });
  await setRoute(page, 'ventas', 'R01');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');

  // R6c (14-nov): avisos agrupados por tipo — muestra los 3 primeros y botón «Ver los N» en grupos grandes
  const a04Card = page.locator('#r6-avisos-panel [data-r6-aviso-group][data-r6-aviso-kind="A04"]').first();
  await a04Card.waitFor({ state: 'visible' });
  const a04InitialRows = await a04Card.locator('.r6-aviso-subitem').count();
  assert.equal(a04InitialRows, 3, `Grupo A04 debe mostrar inicialmente 3 ítems (mostró ${a04InitialRows})`);
  const a04ExpandBtn = a04Card.locator('[data-r6-group-expand]');
  assert.match(await a04ExpandBtn.textContent(), /Ver los \d+/, 'Falta botón Ver los N en grupo A04');
  await a04ExpandBtn.click();
  await page.waitForTimeout(80);
  const a04ExpandedRows = await a04Card.locator('.r6-aviso-subitem').count();
  assert.ok(a04ExpandedRows > 3, `Al expandir A04 deben verse todos los ítems (${a04ExpandedRows})`);

  const a03ExpandBtn = page.locator('#r6-avisos-panel [data-r6-aviso-group][data-r6-aviso-kind="A03"] [data-r6-group-expand]').first();
  if (await a03ExpandBtn.count()) {
    await a03ExpandBtn.click();
    await page.waitForTimeout(80);
  }

  const vTxt = await page.locator('#r6-avisos-panel').innerText();
  assert.match(vTxt, /MC-LIVE-AVISO/i, 'Falta A03');
  assert.match(vTxt, /Carolina Soto pidió hablar con una persona/i, 'Falta evento ejecutivo');
  assert.match(vTxt, /Carolina Soto confirmó su propuesta/i, 'Falta C06');
  assert.match(vTxt, /Prioridad alta · \d+ leads?/i, 'Falta grupo A04 con conteo');
  assert.match(vTxt, /Cotización sin respuesta/i, 'Falta A05');
  assert.match(vTxt, /Reposición esperada · \d+ cuentas?/i, 'Falta grupo A08 con conteo');
  assert.match(vTxt, /sugerir pedido con revisión humana/i, 'A08 debe exigir revisión humana');
  assert.match(vTxt, /Caída de consumo: investigar causa/i, 'Falta A10');
  assert.match(vTxt, /Oportunidad de expansión, sujeta a aprobación/i, 'Falta A11');
  await page.keyboard.press('Escape');

  await setRoute(page, 'jefatura', 'R05');
  await page.click('[data-r6-avisos-toggle]');
  await page.waitForSelector('#r6-avisos-panel');
  const jTxt = await page.locator('#r6-avisos-panel').innerText();
  assert.match(jTxt, /Resumen semanal · anomalías para revisión/i, 'Falta A12');
  await page.keyboard.press('Escape');

  // 9. Auditoría de medidas, toques, contraste/paleta y desbordes en todas las vistas requeridas
  for (const [role, home] of [['ventas', 'R01'], ['marketing', 'R12'], ['jefatura', 'R05']]) {
    await auditSurface(page, { width: 1440, height: 900 }, role, home, { maxHeightDesktop: 1300, checkPanelOpen: false });
    await auditSurface(page, { width: 1440, height: 900 }, role, home, { maxHeightDesktop: 1300, checkPanelOpen: true });
    await auditSurface(page, { width: 390, height: 844 }, role, home, { maxHeightMobile: 2500, checkPanelOpen: false });
    await auditSurface(page, { width: 390, height: 844 }, role, home, { maxHeightMobile: 2500, checkPanelOpen: true });
    await auditSurface(page, { width: 360, height: 800 }, role, home, { maxHeightMobile: 2650, checkPanelOpen: false });
    await auditSurface(page, { width: 414, height: 896 }, role, home, { maxHeightMobile: 2500, checkPanelOpen: false });
  }

  assert.deepEqual(errors, [], `Errores de consola/runtime en ${browserLabel}: ${JSON.stringify(errors)}`);
  console.log(`PASS verify-r6-avisos (${browserLabel}): todos los flujos, permisos, foco, persistencia y medidas OK`);
}

(async () => {
  const browsers = [
    ['Chrome', () => chromeLauncher.launch({ headless: true })],
    ['Edge', () => pwChromium.launch({ executablePath: EDGE_PATH, headless: true })]
  ];

  for (const [name, launch] of browsers) {
    const browser = await launch();
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await runFlows(page, name);
      await ctx.close();
    } finally {
      await browser.close();
    }
  }
})();
