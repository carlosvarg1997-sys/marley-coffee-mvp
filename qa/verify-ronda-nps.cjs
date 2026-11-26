'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const base = new URL(process.argv[2] || 'http://127.0.0.1:8960/');
const out = path.resolve(process.argv[3] || '../marley-final-26nov-evidencia/ronda-nps');
const channels = ['google', 'whatsapp', 'linkedin', 'instagram', 'referido'];
const configurations = [
  ['chrome', 1280, 551], ['chrome', 390, 844], ['chrome', 360, 640],
  ['msedge', 1280, 551], ['msedge', 390, 844]
];

async function shot(page, folder, label) {
  if (!folder) return;
  await page.screenshot({ path: path.join(folder, label + '.jpg'), type: 'jpeg', quality: 80, animations: 'disabled' });
}

async function inspect(page, route, { limit = true } = {}) {
  const result = await page.evaluate(() => ({
    width: innerWidth, height: document.documentElement.scrollHeight,
    excess: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bad: [...document.querySelectorAll('#app details')].flatMap(d => {
      const label = d.querySelector(':scope > summary');
      const text = (label?.getAttribute('aria-label') || label?.textContent || '').trim().replace(/\s+/g, ' ');
      return /[a-záéíóúñ]{3}/i.test(text) && !/^(?:ver|más|abrir|detalles?|menú|información|selección|opciones)$/i.test(text)
        ? [] : [text || d.className || '(sin resumen)'];
    })
  }));
  assert.ok(result.excess <= 1, route + ': desborde horizontal de ' + result.excess + ' px');
  assert.deepEqual(result.bad, [], route + ': desplegables sin rótulo específico');
  if (limit) assert.ok(result.height <= (result.width < 768 ? 2500 : 1800), route + ': alto ' + result.height);
  return result.height;
}

async function media(page, selector, video) {
  await page.waitForFunction(sel => {
    const scene = document.querySelector(sel);
    if (!scene || scene.closest('details')) return false;
    const rect = scene.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) scene.scrollIntoView({ block:'center', behavior:'instant' });
    const img = scene.querySelector('.m5-film-poster');
    return img && !img.hasAttribute('data-scene-poster') && img.complete && img.naturalWidth > 1;
  }, selector);
  if (video) await page.waitForFunction(sel => {
    const film = document.querySelector(sel + ' video');
    return film && film.currentTime > .12 && film.muted && film.playsInline && !film.loop;
  }, selector);
}

async function ayudaMovil(page, portal = false) {
  if (page.viewportSize().width >= 768) return;
  await page.evaluate(() => scrollTo(0, 0));
  const selector = portal ? '.mp-cabecera .mp-ayuda-movil' : '.mc-ayuda-movil button';
  const acceso = await page.waitForFunction(sel => {
    const el = document.querySelector(sel);
    const r = el?.getBoundingClientRect();
    if (!r || r.height < 44 || r.top < 0 || r.bottom > innerHeight) return null;
    return { texto:el.innerText, posicion:getComputedStyle(el).position };
  }, selector);
  const { texto, posicion } = await acceso.jsonValue();
  assert.equal(texto, '¿Necesitas ayuda?');
  assert.ok(!['fixed','absolute'].includes(posicion));
}

async function compra(page, folder) {
  await page.goto(new URL('index.html#C02', base).href, { waitUntil: 'load' });
  await page.locator('.cmp-home-maquina').last().waitFor();
  const peso = await page.evaluate(origin => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
    .filter(e => new URL(e.name).origin === origin).reduce((s, e) => s + e.transferSize, 0), base.origin);
  if (page.viewportSize().width === 390) assert.ok(peso <= 2500000, 'C02 inicial ' + peso + ' bytes');
  await ayudaMovil(page);
  if (page.viewportSize().width < 768) {
    await page.locator('.mc-ayuda-movil button').click();
    await page.getByRole('button', {name:'Cerrar el asistente'}).click();
  }
  const altoInicio = await inspect(page, 'C02');
  const fichas = page.locator('.cmp-home-maquina img');
  assert.equal(await fichas.count(), 4);
  for (let i = 0; i < 4; i++) {
    await fichas.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction(index => {
      const img = document.querySelectorAll('.cmp-home-maquina img')[index];
      return img?.complete && img.naturalWidth > 1;
    }, i);
  }
  await shot(page, folder, '01-c02-maquinas');
  await media(page, '.mc-buyer-scene', true);
  await shot(page, folder, '02-c02-video-negocio');
  await page.locator('#condiciones [data-cierra-tarea="T1"]').click();
  await page.locator('[data-solucion-accion="ya-se-maquina"]').click();
  await page.locator('[data-maquina-id="bar"]').click();
  await page.locator('#pack-resumen').waitFor();
  await ayudaMovil(page);
  const altoPack = await inspect(page, 'C05');
  await media(page, '.mc-pack-scene', true);
  await shot(page, folder, '03-c05-escena-pack');
  await page.locator('#pack-resumen [data-pack-accion="aceptar"]').click();
  await page.locator('#m4FName').fill('Ana Prueba');
  await page.locator('#m4FEmail').fill('ana.prueba@example.test');
  await page.locator('#m4FComuna').selectOption('Las Condes');
  await page.locator('#pack-contacto [name="consent"]').check();
  await page.locator('[data-pack-accion="confirmar-contacto"]').click();
  const ubicacion = await page.evaluate(() => {
    const state = M4.get();
    const value = R6P.valor(state);
    return { comuna: value.comuna, zona: value.zona, owner: state.lead.execId };
  });
  assert.deepEqual(ubicacion, { comuna: 'Las Condes', zona: 'A', owner: 'paula' });
  await page.locator('[data-cross="no-gracias"]').click();
  await page.locator('[data-cierra-tarea="T3"]').click();
  await page.locator('#mp-panel-pedido').waitFor();
  await ayudaMovil(page, true);
  if (page.viewportSize().width < 768) {
    await page.locator('.mp-ayuda-movil').click();
    await page.locator('#mp-panel-ayuda').waitFor();
    await page.locator('#portal-tabs [data-portal-tab="pedido"]').click();
  }
  await page.locator('.mp-explicaciones summary').first().click();
  assert.match(await page.locator('.mp-explicaciones details[open]').innerText(), /Bar.*directamente[\s\S]*tazas al día[\s\S]*Atención/i);
  await page.locator('.mp-explicaciones summary').first().click();
  await page.locator('.mp-explicaciones summary').last().click();
  assert.match(await page.locator('.mp-explicaciones details[open]').innerText(), /préstamo[\s\S]*carga base[\s\S]*kit[\s\S]*filtro/i);
  await page.locator('.mp-explicaciones summary').last().click();
  await page.locator('[data-portal-accion="firmar-contrato"]').first().click();
  await page.locator('[data-portal-accion="confirmar-firma"]').click();
  return { peso, altoInicio, altoPack };
}

async function entregar(page, dias, numero, porBoton) {
  if (porBoton) await page.locator('[data-portal-accion="avanzar-tiempo"]').first().click();
  else {
    await page.locator('#mp-panel-pedido .mp-tecnico summary').click();
    await page.locator('[data-portal-accion="avanzar-tiempo"][data-dias="' + dias + '"]').click();
  }
  const card = page.locator('[data-mp-satisfaccion]');
  await card.waitFor();
  const estado = await page.evaluate(() => {
    const c = M4.get().customerCycle;
    return { total: c.orders.length, pedido: c.orders.at(-1) };
  });
  assert.equal(estado.total, numero);
  assert.ok(estado.pedido.receivedAt && estado.pedido.waitPassed);
  assert.equal(Boolean(estado.pedido.installedAt), numero === 1);
  await page.locator('#portal-franja [data-etapa="instalado"][aria-current="step"]').waitFor();
  assert.equal(await page.locator('[data-portal-accion="confirmar-recepcion"]:visible').count(), 0);
  assert.equal(await card.locator('.mp-carita').count(), 3);
  await inspect(page, 'C09 Mi pedido');
  return estado.pedido.id;
}

async function positiva(page, id, cara, folder, momento) {
  await page.locator('[data-cara="' + cara + '"]').click();
  const dialogo = page.locator('[data-mp-encuesta]');
  await dialogo.locator('[name="nps"][value="9"]').check();
  await dialogo.getByLabel('¿Qué te gustó o qué mejorarías?').fill('El pedido llegó bien.');
  for (const canal of channels) {
    await dialogo.locator('[name="canales"][value="' + canal + '"]').check();
    const preview = dialogo.locator('[data-canal-vista="' + canal + '"]');
    assert.match(await preview.innerText(), /Así se vería.*[\s\S]*Vista previa simulada: no se publica ni se envía nada/);
    if (canal === 'google') assert.match(await preview.innerText(), /Google Maps[\s\S]*búsqueda local/);
    if (canal === 'whatsapp') assert.match(await preview.innerText(), /mc_referral_account=/);
    if (canal === 'instagram') assert.match(await preview.innerText(), /@marleycoffee\.chile/);
    if (folder && ['google','whatsapp'].includes(canal)) {
      await preview.locator('h3').scrollIntoViewIfNeeded();
      await shot(page, folder, '04-' + momento + '-' + canal);
    }
  }
  await dialogo.getByRole('button', { name: 'Guardar respuesta' }).click();
  const fila = await page.evaluate(pid => M4.get().postventa.respuestas.find(r => r.pedidoId === pid), id);
  assert.equal(fila.cara || fila.carita, cara);
  assert.equal(fila.momento, momento);
  assert.equal(fila.nps, 9);
  assert.deepEqual(fila.canales, channels);
  assert.equal(fila.abierta, 'El pedido llegó bien.');
  await page.locator('#mp-panel-recomendar').waitFor();
}

async function negativa(page, id, folder, momento) {
  await page.locator('[data-cara="no-contento"]').click();
  const dialogo = page.locator('[data-mp-encuesta]');
  await dialogo.getByText('Te ayudamos ahora', { exact: true }).waitFor();
  await shot(page, folder, '05-' + momento + '-ayuda');
  await dialogo.getByRole('button', { name: 'O deja tu reseña en Google' }).click();
  await dialogo.locator('[data-canal-vista="google"]').waitFor();
  await dialogo.getByRole('button', {name:'Cerrar', exact:true}).click();
  await dialogo.locator('[name="motivo"]').selectOption({label:'La máquina no funciona'});
  await dialogo.locator('[name="detalle"]').fill('La máquina necesita revisión.');
  await dialogo.locator('[name="horario"]').fill('En la mañana');
  await dialogo.locator('[name="foto"]').setInputFiles({ name:'maquina.png', mimeType:'image/png', buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPioAAAAASUVORK5CYII=', 'base64') });
  await dialogo.getByRole('button', { name:'Pedir ayuda' }).click();
  await page.locator('#mp-panel-ayuda').waitFor();
  await page.locator('#agente-portal').waitFor();
  const r = await page.evaluate(pid => {
    const post = M4.get().postventa;
    return { cara:post.respuestas.find(r=>r.pedidoId===pid), ayuda:post.ayudas.find(r=>r.pedidoId===pid), reseña:post.resenas.find(r=>r.pedidoId===pid) };
  }, id);
  assert.equal(r.cara.momento, momento);
  assert.equal(r.cara.carita, 'no-contento');
  assert.equal(r.cara.nps, null);
  assert.equal(r.ayuda.estado, 'abierta');
  assert.match(r.ayuda.resumen, /En la mañana.*maquina\.png/);
  assert.equal(r.reseña.estado, 'vista-previa');
  await page.waitForFunction(pid => {
    const traspaso = MarleyAgente.espera.estado(M4.get().lead.id).traspaso;
    return traspaso?.postventaPedidoId === pid && traspaso.resumen.includes('maquina.png');
  }, id).catch(async error => {
    const detalle = await page.evaluate(() => ({
      traspasos: MarleyAgente.estado.get().traspasos,
      chat: document.querySelector('#agente-portal [role="log"]')?.innerText
    }));
    throw new Error('El resumen no llegó al agente: ' + JSON.stringify(detalle), {cause:error});
  });
  await page.evaluate(pid => M4.update(s => {
    s.postventa.ayudas.find(a => a.pedidoId === pid).estado = 'resuelta';
  }), id);
  await page.locator('#portal-tabs [data-portal-tab="pedido"]').click();
  await page.getByRole('button', {name:'Contar cómo me fue'}).click();
  await dialogo.locator('[name="nps"][value="8"]').check();
  await dialogo.getByRole('button', {name:'Guardar respuesta'}).click();
  assert.equal(await page.evaluate(pid => M4.get().postventa.respuestas.find(r => r.pedidoId === pid).seguimiento?.nps, id), 8);
}

async function recomendar(page, folder) {
  const panel = page.locator('#mp-panel-recomendar');
  await panel.getByText('Ver cómo recomendar por cada canal').click();
  for (const canal of channels) {
    await panel.locator('[data-canal="' + canal + '"]').click();
    await panel.locator('[data-canal-vista="' + canal + '"]').waitFor();
  }
  await shot(page, folder, '06-recomendar-preview');
  await panel.locator('[name="negocio"]').fill('Café Futuro');
  await panel.locator('[name="persona"]').fill('Contacto Prueba');
  await panel.locator('[name="contacto"]').fill('referido@example.test');
  await panel.locator('[name="permiso"][value="si"]').check();
  await panel.locator('[data-cta-principal="recomendar-enviar"]').first().click();
  const referido = await page.evaluate(() => M4.get().postventa.referidos.at(-1));
  assert.equal(referido.negocio, 'Café Futuro');
  assert.equal(referido.permiso, true);
  assert.equal(referido.estado, 'enviado');
}

async function repetir(page, mes) {
  await page.locator('#portal-tabs [data-portal-tab="pedido"]').click();
  if (mes) await page.locator('[data-portal-accion="avanzar-tiempo"]').first().click();
  await page.locator('[data-portal-accion="ir-repetir"]').first().click();
  await page.locator('#mp-form-repetir').waitFor();
  await page.locator('[data-cta-principal="repetir-confirmar"]').first().click();
  await page.locator('#mp-panel-pedido').waitFor();
}

async function revisarSitio(page, folder) {
  await page.goto(new URL('index.html#C08', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('.mc-caso-ficha').waitFor();
  assert.equal(await page.locator('.m5-stage-tabs button').count(), 3);
  for (const button of await page.locator('.m5-stage-tabs button').all()) {
    await button.click();
    assert.match(await page.locator('.mc-caso-ficha').innerText(), /Problema[\s\S]*Solución[\s\S]*Máquina[\s\S]*Resultado esperado/i);
    assert.match(await page.locator('#h-exp').innerText(), /Caso ilustrativo/i);
  }
  assert.equal(await page.locator('.mc-caso-recursos a').count(), 2);
  assert.equal(await page.locator('[data-cta-principal="caso-comercial"]').count(), 2);
  await inspect(page, 'C08 Casos y guías');
  await shot(page, folder, '07-casos-guias');
  for (const route of ['C01','C03','C04','C06','C07','C10','C11','C12','C13','C14','C15']) {
    await page.evaluate(id => MarleyApp.go(id, { evaluation:true }), route);
    await page.waitForFunction(id => document.body.dataset.current === id, route);
    await inspect(page, route, { limit: false });
    await ayudaMovil(page);
  }
}

async function main() {
  fs.mkdirSync(out, { recursive:true });
  const results = [];
  for (const [channel, width, height] of configurations) {
    const key = channel + '-' + width + 'x' + height;
    if (process.env.MARLEY_NPS_SOLO && key !== process.env.MARLEY_NPS_SOLO) continue;
    const folder = path.join(out, key);
    fs.mkdirSync(folder, { recursive:true });
    const browser = await chromium.launch({ channel });
    const errores = [];
    try {
      for (const primeroContento of [true, false]) {
        const page = await browser.newPage({ viewport:{width,height}, isMobile:width<768, hasTouch:width<768 });
        page.setDefaultTimeout(14000);
        try {
          page.on('pageerror', e => errores.push(e.message));
          page.on('console', msg => {
            if (msg.type() === 'error' && !/\/api\/ping/.test(msg.location()?.url || '')) errores.push(msg.text());
          });
          const assets = await compra(page, primeroContento ? folder : null);
          const id = await entregar(page, primeroContento ? 3 : 30, 1, primeroContento);
          if (primeroContento) {
            await positiva(page, id, 'contento', folder, 'primera');
            await recomendar(page, folder);
          } else await negativa(page, id, folder, 'primera');
          await repetir(page, primeroContento);
          const recompra = await entregar(page, primeroContento ? 3 : 30, 2, primeroContento);
          if (primeroContento) await negativa(page, recompra, folder, 'recompra');
          else await positiva(page, recompra, 'regular', folder, 'recompra');
          results.push({ key, primeroContento, assets, entregas:[id,recompra] });
          if (primeroContento) await revisarSitio(page, folder);
        } finally { await page.close(); }
      }
      assert.deepEqual(errores, []);
      console.log('PASS', key);
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(out, 'verificacion.json'), JSON.stringify(results, null, 2) + '\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
