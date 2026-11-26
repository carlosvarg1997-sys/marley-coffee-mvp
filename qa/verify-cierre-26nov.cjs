'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');
const { chromium: edge } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const base = process.argv[2] || 'http://127.0.0.1:8910/';
const destination = path.resolve(process.argv[3] || '../marley-final-26nov-evidencia');
const version = process.argv[4] || 'despues';
const capture = new Set(['1280x551', '390x844', '360x640']);
const sizes = [[1280, 551], [1366, 625], [1536, 730], [1912, 733], [1440, 900], [390, 844], [360, 640]];
const data = [];
const only = process.env.MARLEY_CAPTURE_SIZE;

async function shot(page, folder, name, selector = null, full = false) {
  if (!folder) return;
  if (selector) {
    const target = page.locator(selector).first();
    await target.waitFor();
    await target.evaluate(el => el.scrollIntoView({ block: 'start' }));
  }
  if (full) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(img => {
    const rect = img.getBoundingClientRect();
    return !img.currentSrc || rect.width === 0 || rect.bottom <= 0 || rect.top >= innerHeight ||
      rect.right <= 0 || rect.left >= innerWidth || img.complete;
  }), null, { timeout: 4500 }).catch(() => {});
  await page.screenshot({ path: path.join(folder, name + '.jpg'), type: 'jpeg', quality: 80, animations: 'disabled', fullPage: full, timeout: 30000 });
}

async function open(page, route, selector) {
  await page.goto(new URL('index.html#' + route, base).href, { waitUntil: 'domcontentloaded' });
  await page.locator(selector).first().waitFor();
}

async function move(page, route, selector) {
  await page.evaluate(id => window.MarleyApp.go(id, { evaluation: true }), route);
  await page.locator(selector).first().waitFor();
}

async function measure(page, query, row, label) {
  row.screens[label] = await page.evaluate(selector => {
    const root = document.querySelector(selector) || document.body;
    const available = new Map();
    for (const face of document.fonts) {
      const key = face.family.replaceAll('"', '').replace(/^MC /, '');
      if (!available.has(key)) available.set(key, new Set());
      available.get(key).add(face.weight === 'normal' ? '400' : face.weight);
    }
    const bad = new Map();
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('[hidden]') || !el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      if (style.visibility !== 'visible') continue;
      const family = style.fontFamily.split(',')[0].replaceAll('"', '').replace(/^MC /, '');
      if (!/^(Festivo|Pressura)$/.test(family) || available.get(family)?.has(style.fontWeight)) continue;
      const key = family + ' ' + style.fontWeight;
      if (!bad.has(key)) bad.set(key, { family, weight: style.fontWeight, count: 0, example: el.className?.toString() || el.tagName });
      bad.get(key).count++;
    }
    return {
      height: Math.max(root.scrollHeight, document.documentElement.scrollHeight),
      overflow: document.documentElement.scrollWidth - innerWidth,
      unsupportedWeights: [...bad.values()]
    };
  }, query);
}

async function customer(browser, viewport, folder, row) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const bytes = new Map();
  const responses = r => {
    const url = new URL(r.url());
    if (url.origin === new URL(base).origin) bytes.set(url.pathname, Number(r.headers()['content-length']) || 0);
  };
  try {
    page.on('response', responses);
    await open(page, 'C02', '#condiciones');
    await page.waitForFunction(() => Boolean(window.R3C2));
    await page.waitForLoadState('load');
    row.c02Bytes = [...bytes.values()].reduce((sum, count) => sum + count, 0);
    if (version !== 'antes') {
      const machines = await page.locator('.cmp-home-maquina h4').allTextContents();
      if (machines.join(',') !== 'Bar,Pods,Café al paso,Oficina') row.errors.push('C02 no muestra las cuatro máquinas');
    }
    page.off('response', responses);
    await measure(page, '#app', row, 'C02');
    await shot(page, folder, '01-c02-inicio');
    if (folder) {
      const machine = page.locator('.cmp-home-maquinas');
      if (await machine.count()) {
        await page.mouse.wheel(0, 1);
        await machine.evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.waitForFunction(() => [...document.querySelectorAll('.cmp-home-maquina img')].every(img => img.complete && img.naturalWidth > 0));
        await shot(page, folder, '02-c02-maquinas', '.cmp-compara-titulo');
        if (viewport.width < 768) {
          for (const [i, card] of (await machine.locator('article').all()).entries()) {
            await card.evaluate(el => { el.parentElement.scrollLeft = el.offsetLeft - el.parentElement.offsetLeft; });
            await shot(page, folder, '02-c02-maquina-' + (i + 1));
          }
          await machine.evaluate(el => { el.scrollLeft = 0; });
        }
      } else await shot(page, folder, '02-c02-maquinas', '#condiciones');
      await shot(page, folder, '03-c02-completa', null, true);
    }
    await page.locator('[data-cierra-tarea="T1"]').first().click();
    await page.locator('#r4-titulo').waitFor();
    await page.evaluate(() => {
      M4.startQuote('Hotel');
      M4.update(s => { s.diag.r5QuestionStep = 'operacion'; });
      MarleyApp.render();
    });
    const shortcut = page.locator('[data-solucion-accion="ya-se-maquina"]');
    await shortcut.waitFor();
    await measure(page, '#app', row, 'C04');
    await shot(page, folder, '04-c04-formulario');
    await shortcut.click();
    await page.locator('[data-maquina-id="bar"]').waitFor();
    await shot(page, folder, '05-c04-cuatro-maquinas');
    await page.locator('[data-maquina-id="bar"]').click();
    await page.locator('#pack-resumen').waitFor();
    await measure(page, '#app', row, 'C05');
    await shot(page, folder, '06-c05-pack');
    await shot(page, folder, '07-c05-acciones', '#pack-resumen .cmp-acciones');
    await shot(page, folder, '08-c05-completa', null, true);
    await page.locator('[data-pack-accion="ver-productos"]').click();
    await shot(page, folder, '09-c05-producto-precio-cantidad', '#pack-productos .cmp-card');
    if (folder) {
      await page.locator('#pack-productos .cmp-card img').first().click();
      await shot(page, folder, '09-c05-zoom', '.vz[role="dialog"]');
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-pack-accion="cerrar-productos"]').click();
    await page.locator('[data-pack-accion="aceptar"]').first().click();
    await page.locator('#m4FName').fill('Ana Prueba');
    await page.locator('#m4FEmail').fill('ana.prueba@example.test');
    await page.locator('#pack-contacto [name="consent"]').check();
    await page.locator('[data-pack-accion="confirmar-contacto"]').click();
    await page.locator('#cross-sell').waitFor();
    await shot(page, folder, '10-c05-sugerencia');
    await page.locator('[data-cross="no-gracias"]').click();
    await page.locator('.cmp-confirm').waitFor();
    await measure(page, '#app', row, 'C06');
    await shot(page, folder, '11-c06-confirmacion');
    await page.locator('[data-cierra-tarea="T3"]').click();
    await page.locator('#portal-tabs').waitFor();
    await measure(page, '#portal-host', row, 'C09-pedido');
    await shot(page, folder, '12-c09-pedido');
    await shot(page, folder, '13-c09-franja', '#portal-franja');
    await shot(page, folder, '14-c09-formatos-total', '.mp-lista');
    await page.evaluate(() => {
      const j = window.M4Journey;
      j.signContract();
      j.jumpDays(30);
      const order = j.placeOrder(j.baseItems(M4.get()));
      if (order) { j.advanceOrderWait(order); j.confirmOrderReceived(order); j.advanceReplenishment(order); }
    });
    for (const tab of ['repetir', 'ayuda', 'recomendar']) {
      await page.locator('#portal-tabs [data-portal-tab="' + tab + '"]').click();
      await page.locator('#mp-panel-' + tab).waitFor();
      await measure(page, '#portal-host', row, 'C09-' + tab);
      await shot(page, folder, '15-c09-' + tab, '#portal-tabs');
    }
    await move(page, 'C11', 'body[data-current="C11"] main');
    await measure(page, '#app', row, 'C11');
    await shot(page, folder, '16-c11');
    await move(page, 'C08', 'body[data-current="C08"] main');
    await shot(page, folder, '17-c08-pestanas', '.m5-stage-tabs');
  } finally { await context.close(); }
}

async function crm(browser, viewport, folder, row) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  try {
    await open(page, 'R00', '[data-c2="choose-role"][data-role="ventas"]');
    await page.locator('[data-c2="choose-role"][data-role="ventas"]').click();
    await page.locator('.crm2-content').waitFor();
    await page.locator('#crm-tablero').waitFor({ state: 'attached' });
    await measure(page, '#crm-v2-root', row, 'R01');
    await shot(page, folder, '18-r01-hoy');
    await shot(page, folder, '19-r01-completa', null, true);
    await move(page, 'R03', 'body[data-current="R03"] .crm2-content');
    await measure(page, '#crm-v2-root', row, 'R03');
    await shot(page, folder, '20-r03-cuentas');
    await page.locator('[data-c2="open-account"]').first().click();
    await page.locator('body[data-current="R04"] .crm2-content').waitFor();
    await measure(page, '#crm-v2-root', row, 'R04');
    await shot(page, folder, '21-r04-ficha');
    const action = page.locator('[data-crm-agente-tarea="avisar"]').first();
    if (folder && await action.count()) {
      await action.click();
      await shot(page, folder, '22-r04-agente-redactando', '#crm-agente-chat');
      const send = page.locator('#crm-agente-chat [data-crm-agente-accion="enviar"]').first();
      await send.waitFor();
      await shot(page, folder, '23-r04-agente-borrador', '#crm-agente-chat');
      await send.click();
      await page.getByText(/enviado|aviso enviado/i).last().waitFor();
      await shot(page, folder, '24-r04-agente-envio', '#crm-agente-chat');
    }
  } finally { await context.close(); }
}

async function main() {
  for (const [name, launcher, dimensions] of [
    ['chrome', chromium, version === 'antes' ? sizes.filter(([w, h]) => capture.has(w + 'x' + h)) : sizes],
    ...(version === 'antes' ? [] : [['edge', edge, [[1280, 551], [390, 844]]]])
  ]) {
    const browser = await launcher.launch(name === 'edge' ? { channel: 'msedge' } : {});
    try {
      for (const [width, height] of dimensions) {
        const size = width + 'x' + height;
        if (only && size !== only) continue;
        const row = { name, size, screens: {}, errors: [] };
        const folder = name === 'chrome' && capture.has(size) ? path.join(destination, version, size) : null;
        if (folder) fs.mkdirSync(folder, { recursive: true });
        for (const test of [customer, crm]) {
          try { await test(browser, { width, height }, folder, row); }
          catch (error) { row.errors.push(String(error.message).split('\n').slice(0,4).join(' ')); console.error(name, size, row.errors.at(-1)); }
        }
        if (version !== 'antes') {
          const mobile = width < 768;
          for (const [route, checks] of Object.entries(row.screens)) {
            if (checks.overflow > 0 || checks.unsupportedWeights.length) {
              row.errors.push(route + ' tiene desborde o un peso tipográfico sin archivo');
            }
            const max = route === 'R01' ? (mobile ? 2500 : 1300) :
              route.startsWith('C') ? (mobile ? 2500 : 1800) : Infinity;
            if (checks.height > max) row.errors.push(route + ' mide ' + checks.height + ' px (máximo ' + max + ')');
          }
          if (size === '390x844' && row.c02Bytes > 2500000) row.errors.push('C02 supera el peso de portada');
        }
        data.push(row);
        console.log(name, size, row.c02Bytes, Object.fromEntries(Object.entries(row.screens).map(([key, value]) => [key, value.height])));
        fs.writeFileSync(path.join(destination, 'mediciones-' + version + '.json'), JSON.stringify(data, null, 2));
      }
    } finally { await browser.close(); }
  }
  if (data.some(row => row.errors.length)) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
