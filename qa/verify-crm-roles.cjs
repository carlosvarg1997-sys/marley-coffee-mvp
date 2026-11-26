'use strict';
/* verify-crm-roles.cjs · DS6 · CRM por rol (contrato 26-nov).
   Comprueba, en Chrome a 1280×551 y 390×844 y en Edge a 1280×551:
   1) las pestañas de cada rol (Ventas no ve postventa ni recomendados);
   2) que cada acción abra el agente A LA VISTA y que al enviar cambien la fila, el aviso, la línea
      de tiempo, el contador y el destino (el cliente o el «Hoy» del otro rol);
   3) que cada opción del agente de cada rol dé un resultado (sin textos rotos);
   4) el alto de cada «Hoy» (≤1300 en escritorio, ≤2500 en celular) y la vista «Medios».
   Capturas JPEG en marley-final-26nov-evidencia/ds6/. */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE = process.argv.slice(2).find(arg => /^https?:\/\//i.test(arg)) || 'http://127.0.0.1:8961/';
const OUT = process.env.CRM_ROLES_OUT || 'C:/Users/HP/Documents/Codex/2026-11-15/ten/work/marley-final-26nov-evidencia/ds6';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CASOS = [
  { navegador: 'Chrome', width: 1280, height: 551, lanzar: () => chromeLauncher.launch({ headless: true, args: ['--disable-gpu'] }) },
  { navegador: 'Chrome', width: 390, height: 844, lanzar: () => chromeLauncher.launch({ headless: true, args: ['--disable-gpu'] }) },
  { navegador: 'Edge', width: 1280, height: 551, lanzar: () => pwChromium.launch({ headless: true, executablePath: EDGE, args: ['--disable-gpu'] }) },
];
const HOME = { ventas: 'R01', marketing: 'R11', jefatura: 'R05' };
const NAV_ESPERADO = {
  ventas: ['Hoy', 'Traspasos y leads', 'Propuestas', 'Volver a pedir', 'Cuentas'],
  marketing: ['Hoy', 'Leads', 'Postventa', 'Recomendados', 'Campañas y contenido'],
  jefatura: ['Hoy', 'Por aprobar', 'Metas y KPIs', 'Equipo'],
};
const PROHIBIDO = /undefined|\bnull\b|NaN|\[object|\{\{|\}\}/;
const TEXTO_VENTAS_PROHIBIDO = /Detractor|Postventa|NPS|Rese[ñn]a|Recomendados|Pedir rese/i;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const norm = texto => String(texto || '').replace(/\s+/g, ' ').trim();
let capturas = 0, controles = 0;

function carpeta() { fs.mkdirSync(OUT, { recursive: true }); }

async function captura(page, nombre) {
  const archivo = path.join(OUT, `${nombre}.jpeg`);
  await page.screenshot({ path: archivo, type: 'jpeg', quality: 80 });
  capturas += 1;
  return archivo;
}

async function nuevaSesion(caso) {
  const browser = await caso.lanzar();
  const context = await browser.newContext({
    viewport: { width: caso.width, height: caso.height },
    isMobile: caso.width < 768,
    hasTouch: caso.width < 768,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', error => errores.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errores.push(`console: ${message.text()}`); });
  await page.goto(BASE + '#R00', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.M4 && window.M4.get, null, { timeout: 15000 });
  await page.evaluate(() => window.M4.reset());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#crm-v2-root:not([hidden])').waitFor({ state: 'visible', timeout: 15000 });
  return { browser, context, page, errores };
}

async function entrar(page, rol) {
  await page.evaluate(() => window.M4.setRole(null));
  await page.goto(BASE + '#R00', { waitUntil: 'domcontentloaded' });
  await page.locator('#crm-v2-root:not([hidden])').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator(`[data-c2="choose-role"][data-role="${rol}"]`).click();
  await page.waitForFunction(home => location.hash === '#' + home, HOME[rol]);
  await page.waitForTimeout(260);
}

async function irA(page, ruta) {
  await page.locator(`[data-c2-go="${ruta}"]`).first().click();
  await page.waitForFunction(r => location.hash === '#' + r, ruta);
  await page.waitForTimeout(280);
}

const estado = page => page.evaluate(() => {
  const s = window.M4.get();
  let agente = {};
  try { agente = JSON.parse(localStorage.getItem('marley.agente.v1') || '{}'); } catch (_) { agente = {}; }
  return {
    crm: s.crm2 || {},
    rowState: (s.crm2 && s.crm2.rowState) || {},
    counters: (s.crm2 && s.crm2.counters) || {},
    gestion: (s.crm2 && s.crm2.postventaGestion) || {},
    handoffs: (s.crm2 && s.crm2.handoffs) || {},
    pasos: s.marketingPasos || {},
    jefeAprob: s.jefeAprob || [],
    agente: { traspasos: agente.traspasos || [], notificaciones: agente.notificaciones || {}, conversaciones: agente.conversaciones || {} },
  };
});

const totalContadores = contadores => Object.values(contadores || {}).reduce((suma, valor) => suma + (Number(valor) || 0), 0);

async function panelAVista(page, requiereBorrador = true) {
  const caja = await page.evaluate(() => {
    const panel = document.querySelector('#crm-agente-chat');
    if (!panel || !panel.classList.contains('is-abierto')) return null;
    const r = panel.getBoundingClientRect();
    return {
      top: r.top, bottom: r.bottom, width: r.width, height: r.height, vh: innerHeight, vw: innerWidth,
      borrador: Boolean(panel.querySelector('[data-crm-agente-borrador]')),
      confirmacion: Boolean(panel.querySelector('[data-crm-agente-accion="confirmar-aprobacion"], [data-crm-agente-accion="confirmar-checklist"]')),
    };
  });
  assert.ok(caja, 'El agente no se abrió (falta .is-abierto)');
  assert.ok(caja.width > 0 && caja.height > 0, 'El panel del agente tiene tamaño cero');
  assert.ok(caja.top >= -1 && caja.bottom <= caja.vh + 1, `El panel queda fuera de la vista: ${JSON.stringify(caja)}`);
  assert.ok(requiereBorrador ? caja.borrador : (caja.borrador || caja.confirmacion), 'El panel no muestra el borrador o la confirmación lista');
  return caja;
}

async function enviar(page) {
  const horarios = page.locator('#crm-agente-chat [data-estado="editando"] [data-crm-agente-horario]');
  if (await horarios.count()) await horarios.first().check();
  const boton = page.locator('#crm-agente-chat [data-crm-agente-accion="enviar"]:not([disabled])').last();
  controles += 1;
  await boton.click();
  await page.waitForTimeout(1500);
}

async function esperarEstado(page, fn, etiqueta, ms = 6000) {
  const limite = Date.now() + ms;
  let ultimo = null;
  while (Date.now() < limite) {
    ultimo = await estado(page);
    if (fn(ultimo)) return ultimo;
    await sleep(180);
  }
  throw new Error(`No llegó el estado esperado: ${etiqueta}. Último: ${JSON.stringify(ultimo).slice(0, 400)}`);
}

async function textoRaiz(page) { return norm(await page.locator('#crm-v2-root').innerText()); }

async function revisarPestanas(page) {
  const nav = await page.locator('.crm2-nav-link span').allTextContents();
  return nav.map(norm);
}

async function altoHoy(page, caso) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const tope = caso.width < 768 ? 2500 : 1300;
  assert.ok(alto <= tope, `El Hoy mide ${alto} px y el tope es ${tope}`);
  return alto;
}

async function opcionesDelRol(page, rol) {
  const chips = (await page.locator('#crm-agente-barra [data-crm-agente-sugerencia]').allTextContents()).map(norm);
  assert.ok(chips.length >= 2, `${rol}: la tarjeta debe ofrecer al menos dos opciones`);
  const resultados = [];
  for (let i = 0; i < chips.length; i += 1) {
    await page.locator('#crm-agente-barra [data-crm-agente-sugerencia]').nth(i).click();
    await page.waitForTimeout(1500);
    const hilo = await page.evaluate(() => {
      const panel = document.querySelector('#crm-agente-chat');
      const cuerpo = panel && panel.querySelector('[data-crm-agente-hilo-chat]');
      return { abierto: Boolean(panel && panel.classList.contains('is-abierto')), texto: String(cuerpo ? cuerpo.innerText : '').replace(/\s+/g, ' ').trim() };
    });
    assert.ok(hilo.abierto, `${rol}: «${chips[i]}» no abrió la conversación`);
    assert.ok(hilo.texto.length > 40, `${rol}: «${chips[i]}» no dio resultado (${hilo.texto.length} caracteres)`);
    assert.ok(!PROHIBIDO.test(hilo.texto), `${rol}: texto roto en «${chips[i]}»`);
    resultados.push({ opcion: chips[i], largo: hilo.texto.length });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(180);
  }
  return resultados;
}

async function accionVentas(page, caso, etiqueta) {
  await entrar(page, 'ventas');
  if (['visita','avisar'].includes(etiqueta)) {
    await page.locator('.crm2-block').filter({ hasText: 'Visitas por coordinar' }).locator('[data-c2="open-account"]').first().click();
  }
  const boton = page.locator(`[data-crm-agente-tarea="${etiqueta}"]`).first();
  await boton.waitFor();
  controles += 1;
  const id = await boton.getAttribute('data-cuenta-id');
  const antes = await estado(page);
  await boton.click();
  await page.waitForTimeout(900);
  await panelAVista(page);
  await captura(page, `roles-${caso.navegador}-${caso.width}x${caso.height}-ventas-${etiqueta}-abrir`);
  const borrador = norm(await page.locator('#crm-agente-chat [data-crm-agente-borrador] textarea').last().inputValue());
  assert.ok(borrador.length > 20, `El borrador de ${etiqueta} está vacío`);
  await enviar(page);
  const despues = await esperarEstado(page, s => s.rowState[id] && totalContadores(s.counters) > totalContadores(antes.counters), `fila y contador de ${etiqueta}`);
  assert.ok(despues.rowState[id].texto, `La fila ${id} no cambió de estado`);
  const aviso = norm(await page.locator('[data-crm2-toast]').innerText().catch(() => ''));
  assert.ok(aviso.length > 0, `No apareció el aviso de ${etiqueta}`);
  assert.match(aviso, /Contactado|enviado|Visita|Aviso/i, `Aviso inesperado de ${etiqueta}: ${aviso}`);
  if (etiqueta === 'avisar') {
    const destino = despues.agente.notificaciones.marketing || [];
    const antesDestino = antes.agente.notificaciones.marketing || [];
    assert.ok(destino.length > antesDestino.length, 'El aviso no llegó al Hoy del compañero (Marketing)');
  } else {
    const conCliente = despues.agente.conversaciones[id] || [];
    assert.ok(conCliente.length > 0, `El envío de ${etiqueta} no llegó del lado del cliente (conversación de ${id})`);
  }
  const linea = norm(await page.evaluate(() => Array.from(document.querySelectorAll('#crm-agente-timeline')).map(el => el.textContent || '').join(' ')));
  assert.ok(linea.length > 20, `El envío de ${etiqueta} no quedó en la línea de tiempo`);
  const scope = etiqueta === 'contactar' ? 'Traspasos nuevos' : etiqueta === 'recordatorio' ? 'Cuentas por reponer' : 'Visitas por coordinar';
  if (['visita','avisar'].includes(etiqueta)) {
    await page.keyboard.press('Escape');
    await irA(page, 'R01');
  }
  if (etiqueta !== 'avisar') assert.match(await page.locator('.crm2-block').filter({ hasText: scope }).innerText(), /Contactado|Visita agendada|Recordatorio enviado/i);
  await captura(page, `roles-${caso.navegador}-${caso.width}x${caso.height}-ventas-${etiqueta}-enviado`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const cerrado = await page.evaluate(() => !document.querySelector('#crm-agente-chat')?.classList.contains('is-abierto'));
  assert.ok(cerrado, 'Escape no cerró el panel del agente');
  return { accion: etiqueta, id, estado: despues.rowState[id].texto, aviso, contador: totalContadores(despues.counters) };
}

async function casoCompleto(caso) {
  const { browser, context, page, errores } = await nuevaSesion(caso);
  const resumen = { navegador: caso.navegador, viewport: `${caso.width}x${caso.height}`, roles: {}, acciones: [], opciones: [], altos: {} };
  const sufijo = `${caso.navegador}-${caso.width}x${caso.height}`;
  try {
    // 1. Pestañas y alto del Hoy de cada rol
    for (const rol of ['ventas', 'marketing', 'jefatura']) {
      await entrar(page, rol);
      const nav = await revisarPestanas(page);
      assert.deepEqual(nav, NAV_ESPERADO[rol], `${rol}: pestañas inesperadas ${JSON.stringify(nav)}`);
      resumen.roles[rol] = nav;
      resumen.altos[rol] = await altoHoy(page, caso);
      await captura(page, `roles-${sufijo}-${rol}-hoy`);
      if (rol === 'ventas') {
        const texto = await textoRaiz(page);
        assert.ok(!TEXTO_VENTAS_PROHIBIDO.test(texto), 'Ventas ve postventa, NPS, reseñas o recomendados en su Hoy');
      }
    }

    // 2. Ventas: Contactar, Visita y Avisar abren el agente a la vista y dejan efectos
    for (const accion of ['contactar', 'recordatorio', 'visita', 'avisar']) {
      resumen.acciones.push(await accionVentas(page, caso, accion));
    }

    // 3. Marketing: Pasar a Ventas (traspaso) y el efecto en el Hoy de Ventas
    await entrar(page, 'marketing');
    await page.locator('.crm2-block').filter({ hasText: 'Leads por calificar' }).getByRole('button',{ name:'Revisar lead' }).first().click();
    const botonTraspaso = page.locator('.crm2-actionbar [data-crm-agente-tarea="traspaso"]').first();
    await botonTraspaso.waitFor();
    controles += 1;
    const leadTraspaso = await botonTraspaso.getAttribute('data-cuenta-id');
    const antesTraspaso = await estado(page);
    await botonTraspaso.click();
    await page.waitForTimeout(900);
    await panelAVista(page);
    await enviar(page);
    const conTraspaso = await esperarEstado(page, s => s.rowState[leadTraspaso] && s.agente.traspasos.length > antesTraspaso.agente.traspasos.length && Boolean(s.handoffs[leadTraspaso]), 'traspaso a Ventas');
    assert.ok(conTraspaso.agente.notificaciones.ventas.length > antesTraspaso.agente.notificaciones.ventas.length, 'El traspaso no dejó aviso en Ventas');
    await captura(page, `roles-${sufijo}-marketing-traspaso`);
    await page.keyboard.press('Escape');
    resumen.acciones.push({ accion: 'pasar a ventas', id: leadTraspaso, estado: conTraspaso.rowState[leadTraspaso].texto, destino: 'Hoy de Ventas' });
    // El destino: Ventas lo ve con la marca «Nuevo»
    await entrar(page, 'ventas');
    const textoVentas = await textoRaiz(page);
    assert.match(textoVentas, /Traspaso nuevo de Marketing|Nuevo/i, 'Ventas no ve el traspaso con la marca «Nuevo»');

    // 4. Marketing: Postventa y Recomendados
    await entrar(page, 'marketing');
    await irA(page, 'R18');
    const textoPostventa = await textoRaiz(page);
    assert.match(textoPostventa, /Detractores por resolver/i);
    assert.match(textoPostventa, /Satisfacci[oó]n y NPS/i);
    assert.match(textoPostventa, /Seguimiento de ayudas/i);
    await captura(page, `roles-${sufijo}-marketing-postventa`);
    const responder = page.locator('[data-crm-agente-tarea="detractor"]').first();
    assert.ok(await responder.count(), 'Postventa no ofrece Responder al detractor');
    controles += 1;
    const idDetractor = await responder.getAttribute('data-cuenta-id');
    const antesDetractor = await estado(page);
    await responder.click();
    await page.waitForTimeout(900);
    await panelAVista(page);
    await enviar(page);
    const conDetractor = await esperarEstado(page, s => s.gestion.ayudas && s.gestion.ayudas[idDetractor], 'respuesta al detractor');
    assert.match(String(conDetractor.gestion.ayudas[idDetractor].estado), /respond/i, 'La ayuda no quedó respondida');
    assert.ok(conDetractor.rowState[idDetractor], 'La fila del detractor no cambió de estado');
    assert.ok((conDetractor.agente.conversaciones[idDetractor] || []).length > (antesDetractor.agente.conversaciones[idDetractor] || []).length, 'La respuesta no llegó del lado del cliente');
    const textoPostventa2 = await textoRaiz(page);
    assert.match(textoPostventa2, /Respondido/i, 'Postventa no muestra la ayuda como respondida');
    await captura(page, `roles-${sufijo}-marketing-detractor-respondido`);
    await page.keyboard.press('Escape');
    resumen.acciones.push({ accion: 'responder al detractor', id: idDetractor, estado: conDetractor.rowState[idDetractor].texto, destino: 'ayuda respondida y chat del cliente' });

    await irA(page, 'R19');
    const textoRef = await textoRaiz(page);
    assert.match(textoRef, /Referidos/i);
    assert.match(textoRef, /Rese[ñn]as invitadas/i);
    assert.match(textoRef, /Promotores/i);
    await captura(page, `roles-${sufijo}-marketing-recomendados`);
    const resena = page.locator('[data-crm-agente-tarea="resena"]').first();
    assert.ok(await resena.count(), 'Recomendados no ofrece pedir reseña');
    controles += 1;
    const idResena = await resena.getAttribute('data-cuenta-id');
    await resena.click();
    await page.waitForTimeout(900);
    await panelAVista(page);
    await enviar(page);
    const conResena = await esperarEstado(page, s => s.gestion.resenas && s.gestion.resenas[idResena], 'reseña pedida');
    assert.match(String(conResena.gestion.resenas[idResena].estado), /pedida/i);
    assert.match(await textoRaiz(page), /Rese[ñn]a pedida/i, 'La lista no muestra la reseña pedida');
    await captura(page, `roles-${sufijo}-marketing-resena-pedida`);
    await page.keyboard.press('Escape');
    resumen.acciones.push({ accion: 'pedir reseña', id: idResena, estado: conResena.rowState[idResena]?.texto || 'Reseña pedida', destino: 'resenas del CRM' });

    // 5. Campañas y contenido: vista Medios
    await irA(page, 'R13');
    await page.locator('[data-c2="vista-medios"]').click();
    await page.waitForTimeout(500);
    const medios = await page.evaluate(() => ({
      grupos: [...document.querySelectorAll('.crm2-medios-grupo > h3')].map(el => el.textContent.trim()),
      tarjetas: document.querySelectorAll('.crm2-medio').length,
      imagenes: document.querySelectorAll('.crm2-medio img').length,
      kpis: [...document.querySelectorAll('.crm2-medio-kpi')].map(el => el.textContent.trim()),
      texto: document.querySelector('.crm2-medios')?.innerText || '',
    }));
    assert.deepEqual(medios.grupos, ['Captación', 'Conversación', 'Evangelización'], `Grupos de Medios inesperados: ${JSON.stringify(medios.grupos)}`);
    assert.ok(medios.tarjetas >= 8, `Medios tiene ${medios.tarjetas} tarjetas`);
    assert.ok(medios.imagenes >= 4, `Medios tiene ${medios.imagenes} piezas reales`);
    assert.ok(medios.kpis.length === medios.tarjetas, 'Cada medio debe mostrar su KPI');
    assert.ok(!PROHIBIDO.test(medios.texto), 'Texto roto en Medios');
    assert.match(medios.texto, /CTR y CPL/);
    assert.match(medios.texto, /Respuesta y paso a MQL/);
    assert.match(medios.texto, /Rese[ñn]as y NPS/);
    await page.evaluate(() => document.querySelector('.crm2-medios')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(350);
    await captura(page, `roles-${sufijo}-marketing-medios`);
    resumen.medios = { tarjetas: medios.tarjetas, imagenes: medios.imagenes };

    // 6. Jefatura: NPS con meta y «¿Qué significa?», y Aprobar con el agente a la vista
    await entrar(page, 'jefatura');
    const textoJefatura = await textoRaiz(page);
    assert.match(textoJefatura, /Metas y NPS/i);
    assert.match(textoJefatura, /NPS/i);
    await irA(page, 'R06');
    const textoMetas = await textoRaiz(page);
    assert.match(textoMetas, /NPS/i);
    assert.match(textoMetas, /Meta 52/i);
    assert.match(textoMetas, /¿Qu[eé] significa el NPS\?/i);
    await page.evaluate(() => document.querySelector('.crm2-block')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await captura(page, `roles-${sufijo}-jefatura-metas-nps`);
    await irA(page, 'R07');
    const propuesta = page.locator('.crm2-approval').filter({ hasText: /descuento fuera de lista/i }).first();
    assert.ok(await propuesta.count(), 'Por aprobar no tiene la propuesta de ejemplo');
    const aprobId = await propuesta.getAttribute('data-approval');
    const antesAprob = await estado(page);
    await propuesta.locator('[data-decision="aprobada"]').click();
    await page.waitForTimeout(800);
    await panelAVista(page, false);
    await captura(page, `roles-${sufijo}-jefatura-aprobar-agente`);
    const confirmar = page.locator('#crm-agente-chat [data-crm-agente-accion="confirmar-aprobacion"]:not([disabled])').last();
    await confirmar.click();
    await page.waitForTimeout(1400);
    const conAprob = await esperarEstado(page, s => (s.jefeAprob || []).some(item => item.id === aprobId && item.estado === 'aprobada'), 'aprobación registrada');
    assert.ok(totalContadores(conAprob.counters) > totalContadores(antesAprob.counters), 'El contador de Jefatura no cambió');
    assert.ok(conAprob.agente.notificaciones.ventas.length > antesAprob.agente.notificaciones.ventas.length, 'Ventas no recibió el aviso de aprobación');
    await page.keyboard.press('Escape');
    resumen.acciones.push({ accion: 'aprobar', id: aprobId, estado: 'aprobada', destino: 'aviso a Ventas' });

    // 7. Todas las opciones del agente de cada rol, una por una
    for (const rol of ['ventas', 'marketing', 'jefatura']) {
      await entrar(page, rol);
      resumen.opciones.push({ rol, resultados: await opcionesDelRol(page, rol) });
    }

    assert.deepEqual(errores, [], `Errores de página: ${errores.join(' | ')}`);
    return resumen;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  carpeta();
  const resultados = [];
  for (const caso of CASOS) {
    process.stderr.write(`\n== ${caso.navegador} ${caso.width}x${caso.height} ==\n`);
    const resumen = await casoCompleto(caso);
    resultados.push(resumen);
    process.stderr.write(`  ok  pestañas, alto, acciones, opciones y medios\n`);
  }
  const salida = { base: BASE, capturas, controles, casos: resultados, fecha: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'verify-crm-roles.json'), JSON.stringify(salida, null, 2));
  console.log(JSON.stringify({
    PASS: resultados.length,
    FALLA: 0,
    capturas,
    controles,
    altos: resultados.map(r => ({ caso: `${r.navegador} ${r.viewport}`, ...r.altos })),
    opciones: resultados.map(r => ({ caso: `${r.navegador} ${r.viewport}`, roles: r.opciones.map(o => `${o.rol}: ${o.resultados.length}`) })),
  }, null, 2));
}

main().catch(error => { console.error('CRM ROLES VERIFY FAIL:', error.stack || error.message || error); process.exit(1); });
