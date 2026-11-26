'use strict';

// Verificador del agente conversacional de Marley Coffee Empresas (24-nov).
// Recorre con los selectores del contrato:
//   1. el flujo del comprador: duda, cotización, pedido de llamada y repetición
//      del pedido en el portal (C04 y C09);
//   2. el flujo del CRM: Marketing -> Ventas -> Jefatura (R11, R01 y R05):
//      consulta del lead, traspaso, aviso en Ventas, envío aprobado en la línea
//      de tiempo, registro con su nivel de control y decisión de Jefatura.
// Revisa además los clics sin respuesta, los errores de página, consola o red,
// el desborde horizontal, los controles de menos de 44 px, las llamadas a
// localStorage.clear y la estructura de localStorage["marley.agente.v1"].
//
// Uso (servidor en 8899, desde la carpeta del repositorio):
//   py -3.12 -m http.server 8899 --bind 127.0.0.1
//   node qa/verify-agente-conversacional.cjs http://127.0.0.1:8899/
// Corre en Chrome y en Edge, a 1280x551 y 390x844. Cada sesión empieza en un
// contexto nuevo. Las capturas van a AGENTE_VERIFY_OUT o a una carpeta temporal
// que se imprime al final. El progreso sale por stderr y el resumen por stdout.
// Diagnóstico: AGENTE_VERIFY_SIN_PORTAL=1 omite solo el paso del portal (C09) para
// revisar el resto del flujo; la salida lo marca. Una corrida válida no lo usa.
//
// Flujo de la conexión chat -> CRM (25-nov): el comprador de la sesión empieza anónimo,
// pide que lo llamen y da su nombre, empresa, correo y permisos en el chat. Ese lead
// queda en el CRM con su origen (chat del sitio), su cotización, sus puntajes y su
// conversación. Marketing lo busca por su nombre, pregunta por MQL, lo pasa a Ventas,
// aprueba el mensaje y el envío aparece del lado del cliente. Si el comprador no da sus
// datos, Marketing sigue con Fernanda Rojas (MC-HOR-2040), MQL en los datos de muestra.
// Al final se prueban «Prefiero no responder» (no se crea lead) y la baja (sin contacto).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { chromium: chromeLauncher } = require('./playwright-system-chrome.cjs');
const { chromium: pwChromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const KEY = 'marley.agente.v1';
const SIZES = [{ width: 1280, height: 551 }, { width: 390, height: 844 }];
const NAVEGADORES = [
  { nombre: 'Chrome', lanzar: () => chromeLauncher.launch({ headless: true, args: ['--disable-gpu'] }) },
  { nombre: 'Edge', lanzar: () => pwChromium.launch({ headless: true, executablePath: EDGE_PATH, args: ['--disable-gpu'] }) },
];
const HOME = { ventas: 'R01', marketing: 'R11', jefatura: 'R05' };
const NIVELES = ['regla', 'ia', 'persona'];
// Respaldo de Marketing si el comprador no da sus datos: Fernanda Rojas es MQL en los datos de muestra.
const LEAD = 'Fernanda Rojas';
const LEAD_ID = 'MC-HOR-2040';
const RIESGOSA = /persona|humano|humana|llam|asesor|ejecutiv|autoriz|whatsapp|correo|derivar/i;
const PROHIBIDAS = /undefined|\bnull\b|NaN|\[object|\{\{|\}\}/;
const FRAGMENTO = 24;
const CARGAS = [
  'recursos/agente/agente.css',
  'recursos/agente/agente-motor.js',
  'recursos/agente/agente-cliente.js',
  'crm/crm-agente.css',
  'crm/crm-agente.js',
];
const SEL_LANZADOR = '[data-m7-open="ayuda"]';
const SEL_PANEL = '#agente-panel';
const SEL_CHIP = '#agente-panel [data-agente-chip]';
const SEL_MENSAJE = '#agente-panel [data-agente-mensaje]';
const SEL_DERIVAR = '#agente-panel [data-agente-accion="derivar-persona"]';
const SEL_PASAR = '[data-crm-agente-accion="pasar-a-ventas"]';
const SEL_APROBAR = '[data-crm-agente-accion="aprobar-envio"]';
const SEL_CONF_CHECK = '[data-crm-agente-accion="confirmar-checklist"]';
const SEL_CONF_APROB = '[data-crm-agente-accion="confirmar-aprobacion"]';
const SEL_AVISO = '[data-crm-notificacion]';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const arr = (valor) => (Array.isArray(valor) ? valor : []);

function urlIndice(raw) {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  if (!/\.html$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/?$/, '/')}index.html`;
  return url.href;
}

const INDEX = urlIndice(process.argv[2] || 'http://127.0.0.1:8899/');
const ORIGEN = new URL(INDEX).origin;
const OUT = process.env.AGENTE_VERIFY_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'marley-agente-'));

function paso(log, texto) {
  log.pasos.push(texto);
  process.stderr.write(`  ok  ${log.etiqueta}: ${texto}\n`);
}

function conLimite(promesa, ms, etiqueta) {
  let temporizador = null;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error(`Tiempo agotado (${ms / 1000} s) en ${etiqueta}`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

// ---------- Comprobaciones previas a los navegadores ----------

function comprobarServidor(url) {
  const cliente = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = cliente.get(url, (res) => {
      res.resume();
      if (res.statusCode === 200) resolve();
      else reject(new Error(`HTTP ${res.statusCode} al abrir ${url}`));
    });
    req.setTimeout(5000, () => req.destroy(new Error('sin respuesta en 5 s')));
    req.on('error', (error) => reject(new Error(`No responde ${url} (${error.message}). Levanta el servidor: py -3.12 -m http.server 8899 --bind 127.0.0.1`)));
  });
}

// Quita comentarios para que una nota («nunca se usa localStorage.clear()») no cuente como llamada.
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linea) => linea.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

function revisarArchivos() {
  const faltan = [];
  const conClear = [];
  for (const rel of CARGAS) {
    const archivo = path.join(ROOT, rel);
    if (!fs.existsSync(archivo)) {
      faltan.push(rel);
      continue;
    }
    if (/localStorage\s*\.\s*clear\s*\(/.test(sinComentarios(fs.readFileSync(archivo, 'utf8')))) conClear.push(rel);
  }
  // Las rutas del CRM (crm-agente.*) se cargan bajo demanda desde crm/crm-carga.js, que index.html sí carga.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cargador = fs.existsSync(path.join(ROOT, 'crm/crm-carga.js')) ? fs.readFileSync(path.join(ROOT, 'crm/crm-carga.js'), 'utf8') : '';
  const sinCarga = CARGAS.filter((rel) => !html.includes(rel) && !(html.includes('crm/crm-carga.js') && cargador.includes(rel)));
  return { faltan, conClear, sinCarga };
}

// ---------- Sesión y navegación ----------

async function abrirSesion(browser, size, log) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.width < 768,
    hasTouch: size.width < 768,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.__clearCalls = 0;
    const original = Storage.prototype.clear;
    Storage.prototype.clear = function clear(...args) {
      window.__clearCalls += 1;
      return original.apply(this, args);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => log.errores.push(`pageerror: ${error.message}`));
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error' && !/Failed to load resource/.test(mensaje.text())) log.errores.push(`console: ${mensaje.text()}`);
  });
  page.on('requestfailed', (request) => {
    const motivo = request.failure()?.errorText || '';
    if (new URL(request.url()).origin === ORIGEN && motivo !== 'net::ERR_ABORTED') log.errores.push(`red: ${request.url()} (${motivo})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === ORIGEN) log.errores.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(INDEX, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.M4 && window.M4D && window.MarleyApp), null, { timeout: 15000 })
    .catch(() => {
      throw new Error('La página no expone M4 ni MarleyApp: revisa index.html');
    });
  const motor = await page.evaluate(() => Boolean(window.MarleyAgente));
  assert.ok(motor, 'Falta window.MarleyAgente: revisa que index.html cargue recursos/agente/agente-motor.js (subagente A)');
  // Sesión nueva: el comprador es anónimo y su lead se crea en el chat. Se quita solo la conversación del agente (sin clear()).
  await page.evaluate(() => { window.localStorage.removeItem('marley.agente.v1'); window.M4.reset(); });
  return { context, page };
}

async function sinDesborde(page, etiqueta) {
  const medida = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    total: document.documentElement.scrollWidth,
  }));
  assert.ok(medida.total <= medida.ancho + 1, `Desborde horizontal en ${etiqueta}: ${medida.total} px en un ancho de ${medida.ancho} px`);
}

async function irA(page, ruta) {
  await page.evaluate((r) => window.MarleyApp.go(r, { evaluation: true }), ruta);
  await page.waitForFunction((r) => (location.hash || '').slice(1).split('?')[0] === r, ruta, { timeout: 8000 });
  await sleep(200);
  await sinDesborde(page, ruta);
}

async function captura(page, log, nombre) {
  await page.screenshot({ path: path.join(OUT, `${log.etiqueta}-${nombre}.png`) });
}

// ---------- Localizar controles visibles ----------

async function visiblesDe(page, selector, patron = null) {
  const todos = page.locator(selector);
  const datos = await todos.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const enDetallesCerrado = el.tagName !== 'SUMMARY' && el.closest('details:not([open])');
    const visible = r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]') && !enDetallesCerrado;
    return { visible, texto: `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.replace(/\s+/g, ' ').trim() };
  }));
  const salida = [];
  datos.forEach((dato, indice) => {
    if (dato.visible && (!patron || patron.test(dato.texto))) salida.push({ locator: todos.nth(indice), texto: dato.texto });
  });
  return salida;
}

async function controlVisible(page, selector, patron = null, excluir = null) {
  const lista = await visiblesDe(page, selector, patron);
  return lista.find((x) => !excluir || !excluir.test(x.texto)) || null;
}

async function esperarControl(page, selector, ms, etiqueta) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const hit = await controlVisible(page, selector);
    if (hit) return hit;
    await sleep(200);
  }
  throw new Error(`No apareció ${etiqueta} (${selector})`);
}

async function esperarControlTexto(page, selector, patron, ms, etiqueta) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const hit = await controlVisible(page, selector, patron);
    if (hit) return hit;
    await sleep(200);
  }
  throw new Error(`No apareció ${etiqueta} (${selector} con texto ${patron})`);
}

async function esperarAlguno(page, selectores, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    for (const selector of selectores) {
      const hit = await controlVisible(page, selector);
      if (hit) return { ...hit, selector };
    }
    await sleep(200);
  }
  return null;
}

// ---------- Clic con respuesta ----------

async function instantanea(page) {
  return page.evaluate((key) => {
    const hash = (texto) => {
      let x = 5381;
      for (let i = 0; i < texto.length; i += 1) x = ((x << 5) + x + texto.charCodeAt(i)) | 0;
      return String(x);
    };
    const texto = (selector) => document.querySelector(selector)?.textContent || '';
    const panel = document.querySelector('#agente-panel');
    const estadoPanel = panel ? `${panel.hidden}|${getComputedStyle(panel).display}` : 'sin-panel';
    return [
      location.hash,
      estadoPanel,
      texto('#agente-panel'),
      texto('#crm-agente-barra'),
      texto('#crm-agente-timeline'),
      texto('#crm-v2-root'),
      localStorage.getItem(key) || '',
      String(document.querySelectorAll('dialog[open]').length),
    ].map(hash).join('|');
  }, KEY);
}

async function clicConRespuesta(page, locator, etiqueta, log, { estricto = true } = {}) {
  const antes = await instantanea(page);
  const paginas = page.context().pages().length;
  let error = null;
  try {
    await locator.click({ timeout: 4000 });
  } catch (e) {
    error = `No se pudo hacer clic en «${etiqueta}»: ${String(e.message).split('\n')[0]}`;
  }
  if (!error) {
    const limite = Date.now() + 2500;
    while (Date.now() < limite) {
      await sleep(120);
      if (page.context().pages().length !== paginas || (await instantanea(page)) !== antes) {
        log.clics += 1;
        return true;
      }
    }
    error = `Clic sin respuesta: «${etiqueta}»`;
  }
  log.sinRespuesta.push(error);
  if (estricto) throw new Error(error);
  return false;
}

// ---------- Comprador: lanzador, respuestas y controles ----------

async function abrirAgente(page) {
  if (await page.evaluate(() => document.body.dataset.current === 'C09')) {
    const ayuda = page.locator('#portal-tabs [data-portal-tab="ayuda"]');
    await ayuda.waitFor({ state: 'visible', timeout: 8000 });
    if (await ayuda.getAttribute('aria-selected') !== 'true') await ayuda.click();
    const abrir = page.locator('#mp-agente:not([open]) > summary');
    if (await abrir.isVisible()) await abrir.click();
    const alcance = '#agente-portal';
    await page.locator(`${alcance} [data-agente-parte="entrada"]`).waitFor({ state: 'visible', timeout: 8000 });
    return alcance;
  }
  if (await page.locator(SEL_PANEL).isVisible().catch(() => false)) return SEL_PANEL;
  let boton = await controlVisible(page, SEL_LANZADOR);
  if (!boton) {
    // En el portal el botón vive en «Ayuda y postventa», que puede estar plegado.
    const abrir = await controlVisible(page, 'summary, button, a', /Ayuda y postventa/i);
    if (abrir) await abrir.locator.click({ timeout: 4000 });
    if (await page.locator(SEL_PANEL).isVisible().catch(() => false)) return SEL_PANEL;
    boton = await controlVisible(page, SEL_LANZADOR);
  }
  assert.ok(boton, 'No hay un botón visible para abrir el agente (data-m7-open="ayuda", «Te ayudamos a decidir»)');
  await boton.locator.click({ timeout: 4000 });
  await page.locator(SEL_PANEL).waitFor({ state: 'visible', timeout: 6000 });
  return SEL_PANEL;
}

async function cerrarAgente(page) {
  if (await page.locator(SEL_PANEL).isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.locator(SEL_PANEL).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

async function textoDe(page, selector) {
  return norm(await page.evaluate((s) => document.querySelector(s)?.textContent || '', selector));
}

async function esperarTexto(page, selector, predicado, etiqueta, ms = 6000) {
  const limite = Date.now() + ms;
  let texto = '';
  while (Date.now() < limite) {
    texto = await textoDe(page, selector);
    if (predicado(texto)) return texto;
    await sleep(150);
  }
  throw new Error(`No apareció ${etiqueta} en ${selector}: ${texto.slice(0, 300)}`);
}

async function mensajesAgente(page, alcance = SEL_PANEL) {
  return page.$$eval(`${alcance} [data-agente-mensaje]`, (els) => els.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()));
}

async function preguntarCliente(page, log, texto, patrones, etiqueta) {
  const alcance = await abrirAgente(page);
  const chat = page.locator(alcance);
  const antes = (await mensajesAgente(page, alcance)).length;
  await chat.locator('[data-agente-parte="entrada"]').fill(texto);
  await clicConRespuesta(page, chat.locator('[data-agente-parte="enviar"]'), `Enviar «${texto}»`, log);
  const limite = Date.now() + 7000;
  let nuevos = [];
  while (Date.now() < limite) {
    nuevos = (await mensajesAgente(page, alcance)).slice(antes).filter((t) => t && t !== norm(texto));
    if (patrones.every((p) => nuevos.some((t) => p.test(t)))) break;
    await sleep(150);
  }
  assert.ok(
    patrones.every((p) => nuevos.some((t) => p.test(t))),
    `Respuesta incompleta (${etiqueta}). Mensajes nuevos: ${JSON.stringify(nuevos).slice(0, 400)}`,
  );
  for (const t of nuevos) assert.ok(!PROHIBIDAS.test(t), `Texto roto en ${etiqueta}: ${t}`);
  return nuevos;
}

async function revisarControles(page, size) {
  const medida = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const panel = document.querySelector('#agente-panel');
    const controles = [...document.querySelectorAll('#agente-panel [data-agente-chip], #agente-panel #agente-enviar')].filter(visible);
    return {
      vivos: panel ? panel.querySelectorAll('[aria-live]').length : 0,
      pequenos: controles
        .filter((el) => el.getBoundingClientRect().height < 43.5)
        .map((el) => (el.textContent || el.id || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
      ancho: panel ? panel.getBoundingClientRect().width : 0,
      cerrar: panel
        ? [...panel.querySelectorAll('button')].some((b) => /cerrar|close|✕|×/i.test(`${b.textContent} ${b.getAttribute('aria-label') || ''}`))
        : false,
    };
  });
  assert.ok(medida.vivos >= 1, 'El panel del agente necesita aria-live para leer sus respuestas');
  assert.deepEqual(medida.pequenos, [], `Controles del agente con menos de 44 px: ${JSON.stringify(medida.pequenos)}`);
  assert.ok(medida.cerrar, 'El panel del agente necesita un botón claro para cerrarlo');
  if (size.width < 768) {
    assert.ok(medida.ancho >= size.width * 0.9, `En celular el agente debe abrirse como hoja a pantalla completa (ancho ${Math.round(medida.ancho)} px)`);
  }
}

// ---------- Estado guardado (localStorage) ----------

function estadoVacio() {
  return {
    crudo: null,
    conversaciones: {},
    traspasos: [],
    notificaciones: { ventas: [], marketing: [], jefatura: [] },
    registro: [],
  };
}

async function estado(page) {
  const leido = await page.evaluate((key) => {
    const texto = localStorage.getItem(key);
    if (texto === null) return { existe: false };
    try {
      return { existe: true, valor: JSON.parse(texto) };
    } catch (error) {
      return { existe: true, error: error.message };
    }
  }, KEY);
  if (!leido.existe) return estadoVacio();
  if (leido.error) throw new Error(`localStorage["${KEY}"] no es JSON válido: ${leido.error}`);
  const v = leido.valor && typeof leido.valor === 'object' ? leido.valor : {};
  return {
    crudo: v,
    conversaciones: v.conversaciones && typeof v.conversaciones === 'object' ? v.conversaciones : {},
    traspasos: arr(v.traspasos),
    notificaciones: {
      ventas: arr(v.notificaciones?.ventas),
      marketing: arr(v.notificaciones?.marketing),
      jefatura: arr(v.notificaciones?.jefatura),
    },
    registro: arr(v.registro),
  };
}

async function esperarEstadoOpcional(page, predicado, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const s = await estado(page);
    if (predicado(s)) return s;
    await sleep(200);
  }
  return null;
}

async function esperarEstado(page, predicado, ms, etiqueta) {
  const s = await esperarEstadoOpcional(page, predicado, ms);
  if (!s) throw new Error(`No se cumplió «${etiqueta}» en ${ms / 1000} s`);
  return s;
}

function mensajesNuevos(antes, despues) {
  const nuevos = [];
  for (const [cuenta, lista] of Object.entries(despues.conversaciones)) {
    const previos = arr(antes.conversaciones[cuenta]).length;
    nuevos.push(...arr(lista).slice(previos));
  }
  return nuevos;
}

function traspasosNuevos(antes, despues) {
  const conocidos = new Set(antes.traspasos.map((t) => String(t.id)));
  return despues.traspasos.filter((t) => !conocidos.has(String(t.id)));
}

// ---------- CRM: textos, envío y respuestas ----------

async function elegirRol(page, rol, log) {
  await page.evaluate(() => window.M4.setRole(null));
  await irA(page, 'R00');
  // El ingreso del rol se carga perezosamente: en Edge en vivo aparece a los 0,33 s, así que se espera activamente y no con una sola mirada.
  const ingreso = await esperarControl(page, `[data-c2="choose-role"][data-role="${rol}"]`, 8000, `el ingreso de ${rol} en R00`);
  await ingreso.locator.click({ timeout: 5000 });
  await page.waitForFunction((h) => location.hash === h, `#${HOME[rol]}`, { timeout: 8000 });
  await page.locator('#crm-agente-barra').first().waitFor({ state: 'attached', timeout: 8000 });
  const control = page.locator('#crm-agente-controles:not([open]) > summary');
  if (await control.isVisible()) await control.click();
  await page.locator('#crm-agente-barra').first().waitFor({ state: 'visible', timeout: 8000 });
  await sinDesborde(page, `CRM · ${rol}`);
  paso(log, `Entra como ${rol} y ve la barra «Pídele al agente» en su Hoy`);
}

async function textoCrm(page) {
  return page.evaluate(() => {
    const barra = document.querySelector('#crm-agente-barra');
    const raiz = document.querySelector('#crm-v2-root');
    return {
      barra: barra ? barra.innerText || barra.textContent || '' : '',
      raiz: raiz ? raiz.innerText || '' : '',
    };
  });
}

const nuevoDesde = (antes, ahora) => (ahora.startsWith(antes) ? ahora.slice(antes.length) : ahora);

async function enviarCrm(page, texto) {
  const entrada = page.locator('#crm-agente-entrada');
  await entrada.waitFor({ state: 'visible', timeout: 8000 });
  await entrada.fill(texto);
  const antes = await textoCrm(page);
  await entrada.press('Enter');
  // Si Enter no envió nada, se usa el botón «Pedir»; así nunca se envía dos veces.
  const limite = Date.now() + 1500;
  while (Date.now() < limite) {
    await sleep(150);
    const ahora = await textoCrm(page);
    const vacia = await entrada.inputValue().then((valor) => valor === '', () => false);
    if (vacia || ahora.barra !== antes.barra || ahora.raiz !== antes.raiz) return;
  }
  const boton = (await controlVisible(page, '#crm-agente-barra button[type="submit"]'))
    || (await controlVisible(page, '#crm-agente-barra button', /pedir|enviar|preguntar/i));
  assert.ok(boton, `La barra del agente no envió «${texto}»: falta Enter o el botón «Pedir»`);
  await boton.locator.click({ timeout: 4000 });
}

async function preguntarCrm(page, texto, patrones, etiqueta) {
  const antes = await textoCrm(page);
  await enviarCrm(page, texto);
  const limite = Date.now() + 7000;
  let barra = '';
  while (Date.now() < limite) {
    await sleep(150);
    const ahora = await textoCrm(page);
    barra = norm(nuevoDesde(antes.barra, ahora.barra));
    const todo = `${barra} ${norm(nuevoDesde(antes.raiz, ahora.raiz))}`;
    if (patrones.every((p) => p.test(todo))) {
      assert.ok(!PROHIBIDAS.test(barra), `Texto roto en ${etiqueta}: ${barra.slice(0, 300)}`);
      return todo;
    }
  }
  throw new Error(`Respuesta del agente de CRM incompleta (${etiqueta}). Texto nuevo: ${barra.slice(0, 400)}`);
}

// ---------- Barridos: cada control visible debe responder ----------

async function barridoCliente(browser, size, log) {
  const { context, page } = await abrirSesion(browser, size, log);
  try {
    await irA(page, 'C04');
    await abrirAgente(page);
    for (let i = 0; i < 3; i += 1) {
      const lista = await visiblesDe(page, SEL_CHIP);
      if (!lista[i]) break;
      await clicConRespuesta(page, lista[i].locator, `Barrido del comprador · «${lista[i].texto}»`, log, { estricto: false });
      await sleep(1000);
    }
  } finally {
    await context.close();
  }
}

async function barridoCrm(browser, size, log, rol) {
  const { context, page } = await abrirSesion(browser, size, log);
  try {
    await elegirRol(page, rol, log);
    for (let i = 0; i < 4; i += 1) {
      const lista = await visiblesDe(page, '[data-crm-agente-sugerencia]');
      if (!lista[i]) break;
      await clicConRespuesta(page, lista[i].locator, `Barrido ${rol} · «${lista[i].texto}»`, log, { estricto: false });
      await sleep(900);
    }
  } finally {
    await context.close();
  }
}

// ---------- Flujos principales ----------

async function flujoComprador(page, size, log) {
  await irA(page, 'C04');
  await abrirAgente(page);
  await esperarTexto(page, SEL_PANEL, (t) => /Asistente de IA de Marley/i.test(t), 'la presentación del agente');
  assert.match(await textoDe(page, SEL_PANEL), /persona/i, 'La presentación debe decir que una persona revisa precios y excepciones');
  await revisarControles(page, size);
  await captura(page, log, 'cliente-01-bienvenida');
  paso(log, 'El agente se presenta como asistente de IA; una persona revisa precios');

  await page.keyboard.press('Escape');
  const cerro = await page.locator(SEL_PANEL).waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false);
  assert.ok(cerro, 'La tecla Escape debe cerrar el panel del agente');
  await abrirAgente(page);
  paso(log, 'Escape cierra el panel y el botón lo vuelve a abrir');

  await preguntarCliente(page, log, '¿Qué incluye el comodato?', [/comodato/i], 'duda sobre el comodato');
  paso(log, 'El comprador resuelve una duda: el comodato');

  const antesCot = (await mensajesAgente(page)).length;
  await preguntarCliente(page, log, 'Quiero cotizar una máquina para mi cafetería', [/\?|cu[aá]nt|qu[eé]|tipo|tazas|cafeter/i], 'inicio de la cotización');
  for (let i = 0; i < 4; i += 1) {
    const opcion = await controlVisible(page, SEL_CHIP, null, RIESGOSA);
    if (!opcion) break;
    await clicConRespuesta(page, opcion.locator, `Cotización · «${opcion.texto}»`, log);
    await sleep(1100);
    if ((await mensajesAgente(page)).slice(antesCot).some((t) => /propuesta|recomiend/i.test(t))) break;
  }
  const armada = (await mensajesAgente(page)).slice(antesCot);
  assert.ok(armada.some((t) => /propuesta|recomiend|m[aá]quina/i.test(t)), 'El agente no armó una propuesta de máquina después de sus preguntas');
  paso(log, 'El comprador cotiza: responde con opciones y recibe una propuesta');

  const antesLlamada = await estado(page);
  // Pide que lo llamen y da sus datos en el chat: el agente pregunta solo lo que falta, de a una pregunta.
  await capturarLead(page, log);
  const lead = await page.evaluate(() => {
    const L = window.M4.get().lead || {};
    return { nombre: L.name || '', id: L.id || '', empresa: L.company || '', origen: L.source || '' };
  });
  assert.ok(lead.id && lead.nombre === 'Ana Pérez', `El chat debe crear el lead con el nombre dado (lead: ${JSON.stringify(lead)})`);
  assert.equal(lead.origen, 'Chat del sitio', 'El lead creado en el chat debe llevar el origen «Chat del sitio»');
  log.lead = lead;
  paso(log, 'El comprador pide que lo llamen y el chat pide nombre, empresa, correo y permisos, de a una pregunta');
  // Antes de enviar nada, el agente muestra el resumen y pide confirmación («Sí, pásalo a Ventas»).
  const confirma = await esperarControlTexto(page, SEL_CHIP, /pas[aá]lo|confirm|s[ií][,.! ]/i, 5000, 'la confirmación para pasar el caso a Ventas');
  await clicConRespuesta(page, confirma.locator, `Confirmar envío a Ventas · «${confirma.texto}»`, log);
  const conTraspaso = await esperarEstado(page, (s) => traspasosNuevos(antesLlamada, s).length > 0, 8000, 'traspaso de la llamada');
  const nuevo = traspasosNuevos(antesLlamada, conTraspaso)[0];
  assert.ok(nuevo && norm(nuevo.resumen).length >= 20, 'El traspaso de la llamada debe llevar un resumen');
  paso(log, 'Pide que lo llamen: el agente muestra el resumen, el comprador confirma y se crea el traspaso');
  await captura(page, log, 'cliente-02-llamada');
  await cerrarAgente(page);
}

async function flujoPortal(page, size, log) {
  await irA(page, 'C09');
  const alcance = await abrirAgente(page);
  const opciones = `${alcance} [data-agente-chip]`;
  await preguntarCliente(page, log, '¿En qué etapa va mi pedido?', [/etapa|estado|pedido|folio/i], 'estado del pedido');
  paso(log, 'Portal: el comprador pregunta en qué etapa va su pedido');

  const antes = await estado(page);
  const repAntes = await page.evaluate(() => (window.M4.get().reorders || []).length);
  const repetir = await controlVisible(page, opciones, /repet|reposic/i);
  if (repetir) {
    await clicConRespuesta(page, repetir.locator, `Portal · «${repetir.texto}»`, log);
  } else {
    await preguntarCliente(page, log, 'Quiero repetir mi último pedido', [/repet|reposic|confirm/i], 'repetir pedido');
  }
  await sleep(900);
  const confirmar = await controlVisible(page, opciones, /confirm|^s[ií][,.! ]|^s[ií]$/i);
  if (confirmar) {
    await clicConRespuesta(page, confirmar.locator, `Confirmar repetición · «${confirmar.texto}»`, log);
  } else {
    await preguntarCliente(page, log, 'Sí, confirmo', [/registr|list|solicit|reposici|avis|confirm/i], 'confirmar repetición');
  }
  let registrado = false;
  const limite = Date.now() + 6000;
  while (Date.now() < limite && !registrado) {
    const s = await estado(page);
    const reps = await page.evaluate(() => (window.M4.get().reorders || []).length);
    registrado = s.registro.length > antes.registro.length || reps > repAntes || traspasosNuevos(antes, s).length > 0;
    if (!registrado) await sleep(150);
  }
  if (!registrado) {
    const ultimos = (await mensajesAgente(page, alcance)).slice(-2);
    throw new Error(`Repetir el pedido no dejó registro, solicitud ni traspaso. Últimas respuestas del agente: ${JSON.stringify(ultimos)}`);
  }
  paso(log, 'El comprador repite su pedido con el agente y queda registrado');
  await captura(page, log, 'cliente-03-repeticion');
  await cerrarAgente(page);
}

async function flujoMarketing(page, size, log) {
  // Lead de la demostración: el que creó el chat del comprador. Si no dio sus datos, queda Fernanda Rojas (respaldo).
  const LEAD = log.lead ? log.lead.nombre : 'Fernanda Rojas';
  const LEAD_ID = log.lead ? log.lead.id : 'MC-HOR-2040';
  await elegirRol(page, 'marketing', log);
  assert.ok((await page.locator('[data-crm-agente-sugerencia]').count()) >= 2, 'El Hoy de Marketing debe ofrecer al menos dos sugerencias del agente');
  await captura(page, log, 'crm-01-marketing-hoy');

  await preguntarCrm(page, `¿Qué cotizó ${LEAD}?`, [
    /cotiz/i, /m[aá]quina/i, /total|\$\s?\d/i, /inter[eé]s/i, /valor esperado/i, /origen|campa[ñn]a/i, /sitio|visit/i, /conversaci/i,
  ], 'qué cotizó el lead');
  paso(log, 'Marketing pregunta «qué cotizó» y recibe cotización, puntajes con su porqué, origen, sitio y conversación');

  await preguntarCrm(page, '¿De dónde llegó?', [/chat del sitio/i], 'pregunta: origen del lead');
  await preguntarCrm(page, '¿Pidió ejecutivo?', [/persona|llam|ejecutiv/i], 'pregunta: ejecutivo');
  await preguntarCrm(page, '¿Cuántas tazas?', [/\d|tazas?/i], 'pregunta: tazas');
  await preguntarCrm(page, '¿Qué dudas tuvo?', [/duda|pregunt/i], 'pregunta: dudas');
  await preguntarCrm(page, '¿Cumple para MQL?', [/Sí cumple|MQL/i], 'pregunta: MQL');
  paso(log, 'Marketing hace preguntas específicas y el agente responde con los datos del registro');

  // Pásalo a Ventas: primero lo escrito; si no crea el traspaso, el botón del agente.
  const antesTraspaso = await estado(page);
  await enviarCrm(page, 'Pásalo a Ventas');
  let conTraspaso = await esperarEstadoOpcional(page, (s) => traspasosNuevos(antesTraspaso, s).length > 0, 4000);
  if (!conTraspaso) {
    const boton = await esperarAlguno(page, [SEL_PASAR], 3000);
    assert.ok(boton, 'Pásalo a Ventas no creó el traspaso ni dejó el botón «Pásalo a Ventas»');
    await clicConRespuesta(page, boton.locator, 'Pásalo a Ventas (botón del agente)', log);
    conTraspaso = await esperarEstado(page, (s) => traspasosNuevos(antesTraspaso, s).length > 0, 8000, 'traspaso a Ventas');
  }
  const traspaso = traspasosNuevos(antesTraspaso, conTraspaso)[0];
  assert.equal(
    String(traspaso.leadId),
    LEAD_ID,
    `El traspaso debe apuntar al lead que Marketing está revisando (leadId ${traspaso.leadId}, de ${traspaso.de}, a ${traspaso.a}, id ${traspaso.id})`,
  );
  assert.ok(norm(traspaso.resumen).length >= 20, 'El traspaso debe llevar un resumen');
  assert.ok(norm(traspaso.a), 'El traspaso debe tener destino');
  assert.ok(conTraspaso.notificaciones.ventas.length > antesTraspaso.notificaciones.ventas.length, 'El traspaso no dejó aviso en Ventas');
  paso(log, 'Pásalo a Ventas: se crea el traspaso con resumen y queda el aviso para Ventas');

  // Mensaje redactado por el agente: Marketing lo aprueba y se envía en modo simulado.
  const aprobar = await esperarControl(page, SEL_APROBAR, 8000, 'el mensaje redactado para aprobar');
  const antesEnvio = await estado(page);
  await captura(page, log, 'crm-02-envio-antes');
  await clicConRespuesta(page, aprobar.locator, 'Aprobar envío del mensaje', log);
  const conEnvio = await esperarEstado(page, (s) => mensajesNuevos(antesEnvio, s).length > 0, 6000, 'envío guardado en la conversación');
  const envio = mensajesNuevos(antesEnvio, conEnvio).at(-1);
  const fragmento = norm(envio.texto).slice(0, FRAGMENTO);
  assert.ok(fragmento.length >= 10, 'El envío aprobado no tiene texto');
  const linea = norm(await page.evaluate(() => Array.from(document.querySelectorAll('#crm-agente-timeline')).map((el) => el.textContent || '').join(' ')));
  assert.ok(linea.includes(fragmento), 'El envío aprobado no aparece en la línea de tiempo (#crm-agente-timeline)');
  const conRegistro = await esperarEstado(page, (s) => s.registro.slice(antesEnvio.registro.length).some((e) => e.nivel === 'persona'), 6000, 'registro de la aprobación');
  const decision = conRegistro.registro.slice(antesEnvio.registro.length).find((e) => e.nivel === 'persona');
  assert.ok(norm(decision.decidio), 'La aprobación del envío debe registrar quién la aprobó');
  await captura(page, log, 'crm-03-envio-despues');
  paso(log, 'Marketing aprueba el mensaje: el envío queda en la línea de tiempo y en el registro (nivel persona)');

  // Lado del cliente: el envío queda en la conversación guardada de la cuenta, que es lo que lee el agente de la web.
  // El comprador de la sesión es otra cuenta, así que aquí se comprueba el dato, no la pantalla del comprador.
  const enCuenta = arr(conEnvio.conversaciones[LEAD_ID]).slice(arr(antesEnvio.conversaciones[LEAD_ID]).length);
  assert.ok(enCuenta.some((m) => norm(m.texto).slice(0, FRAGMENTO) === fragmento), 'El envío aprobado no quedó en la conversación de la cuenta del cliente');
  paso(log, 'El envío queda en la conversación de la cuenta del cliente');
  await flujoLadoCliente(page, log, fragmento);
  // Respaldo: el lead de muestra (Fernanda Rojas) sigue disponible para Marketing si el comprador no da sus datos.
  await elegirRol(page, 'marketing', log);
  await preguntarCrm(page, '¿Cumple para MQL de Fernanda Rojas?', [/Sí cumple|MQL/i], 'respaldo: lead de muestra');
  paso(log, 'Respaldo: Fernanda Rojas (lead de muestra) sigue consultable para Marketing');
}

async function flujoVentas(page, size, log) {
  await elegirRol(page, 'ventas', log);
  const aviso = await esperarControl(page, SEL_AVISO, 8000, 'el aviso de Ventas');
  const textoAviso = norm(await aviso.locator.textContent());
  assert.match(textoAviso, new RegExp(`${log.lead ? log.lead.nombre : 'Fernanda Rojas'}|traspas|MQL|Marketing`, 'i'), 'El aviso de Ventas debe nombrar la cuenta o el traspaso');
  await captura(page, log, 'ventas-01-aviso');
  paso(log, 'El aviso del traspaso aparece en el Hoy de Ventas');

  // El aviso es un bloque con el botón «Ver»: ese botón es el control que responde.
  const ver = (await controlVisible(page, `${SEL_AVISO} [data-crm-agente-accion="ver-aviso"]`)) || aviso;
  await clicConRespuesta(page, ver.locator, 'Ver aviso de Ventas', log);
  await irA(page, 'R01');
  await page.locator('#crm-agente-barra').first().waitFor({ state: 'attached', timeout: 8000 });
  const control = page.locator('#crm-agente-controles:not([open]) > summary');
  if (await control.isVisible()) await control.click();
  await page.locator('#crm-agente-barra').first().waitFor({ state: 'visible', timeout: 8000 });
  await preguntarCrm(page, 'Resume la cuenta', [/resum|cuenta/i, new RegExp(`${log.lead ? log.lead.nombre : 'Fernanda Rojas'}|Hotel`, 'i')], 'resumen de la cuenta');
  paso(log, 'Ventas pide «resume la cuenta»');
  await preguntarCrm(page, 'Propón la canasta', [/canasta|propuesta/i], 'propuesta de canasta');
  paso(log, 'Ventas pide «propón la canasta» con el motor de recomendación');
  await captura(page, log, 'ventas-02-resumen-canasta');
}

async function flujoJefatura(page, size, log) {
  await elegirRol(page, 'jefatura', log);
  await preguntarCrm(page, '¿Qué espera mi aprobación?', [/aprob|espera|pendient|referid|solicitud/i], 'pendientes de Jefatura');
  paso(log, 'Jefatura pregunta «¿qué espera mi aprobación?»');
  await captura(page, log, 'jefatura-01-espera');

  const antes = await estado(page);
  // Se usa la sugerencia de aprobación del Hoy de Jefatura («Aprueba el referido de …» o «la propuesta de …»).
  const sugerencia = await controlVisible(page, '[data-crm-agente-sugerencia]', /aprueb/i);
  assert.ok(sugerencia, 'El Hoy de Jefatura no ofrece ninguna aprobación entre sus sugerencias');
  paso(log, `Jefatura ve la sugerencia «${sugerencia.texto}»`);
  await clicConRespuesta(page, sugerencia.locator, `Sugerencia · «${sugerencia.texto}»`, log);

  // El referido puede pedir primero el permiso y el beneficio, y luego la aprobación.
  const primero = await esperarAlguno(page, [SEL_CONF_CHECK, SEL_CONF_APROB], 6000);
  assert.ok(primero, 'Jefatura no ve el botón para confirmar el referido');
  if (primero.selector === SEL_CONF_CHECK) {
    await clicConRespuesta(page, primero.locator, 'Confirmar permiso y beneficio (Jefatura)', log);
    const aprobacion = await esperarAlguno(page, [SEL_CONF_APROB], 6000);
    assert.ok(aprobacion, 'Tras confirmar permiso y beneficio, Jefatura debe ver «Confirmar aprobación»');
    await clicConRespuesta(page, aprobacion.locator, 'Confirmar aprobación (Jefatura)', log);
  } else {
    await clicConRespuesta(page, primero.locator, 'Confirmar aprobación (Jefatura)', log);
  }

  const conRegistro = await esperarEstado(page, (s) => s.registro.slice(antes.registro.length).some((e) => e.nivel === 'persona' && norm(e.decidio)), 6000, 'registro de la decisión de Jefatura');
  assert.ok(conRegistro, 'La decisión de Jefatura debe quedar en el registro');
  paso(log, 'Jefatura aprueba el referido: queda en el registro con nivel persona y quién decidió');
  await captura(page, log, 'jefatura-02-aprobado');
}

// ---------- Captura del lead desde el chat (25-nov) ----------
// Cada respuesta del agente se espera por su rol: el último mensaje tiene que ser del agente y no estar «escribiendo».
async function contarMensajes(page) {
  return page.$$eval(SEL_MENSAJE, (els) => ({ n: els.length, ult: els.length ? (els.at(-1).textContent || '').replace(/\s+/g, ' ').trim() : '' }));
}
async function esperarRespuesta(page, antes, etiqueta) {
  const limite = Date.now() + 8000;
  while (Date.now() < limite) {
    const msgs = await page.$$eval(SEL_MENSAJE, (els) => els.map((el) => ({ rol: el.getAttribute('data-rol'), t: (el.textContent || '').replace(/\s+/g, ' ').trim() })));
    const ultimo = msgs.at(-1);
    const cambio = msgs.length !== antes.n || (ultimo && ultimo.t !== antes.ult);
    if (cambio && ultimo && ultimo.rol !== 'comprador' && !/cargando|escribiendo/i.test(ultimo.t)) return msgs.map((m) => m.t);
    await sleep(150);
  }
  const ultimos = await page.$$eval(SEL_MENSAJE, (els) => els.slice(-3).map((el) => `${el.getAttribute('data-rol')}: ${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`));
  const total = await page.$$eval(SEL_MENSAJE, (els) => els.length);
  const guardado = await page.evaluate(() => {
    const e = JSON.parse(window.localStorage.getItem('marley.agente.v1') || '{}');
    return { conv: Object.fromEntries(Object.entries(e.conversaciones || {}).map(([k, v]) => [k, v.length])), capturas: Object.keys(e.capturas || {}), cuenta: window.M4.get().lead ? window.M4.get().lead.id : null };
  });
  throw new Error(`El agente no respondió a tiempo (${etiqueta}). Mensajes antes ${antes.n}, ahora ${total}. Guardado: ${JSON.stringify(guardado)}. Últimos mensajes: ${JSON.stringify(ultimos)}`);
}
async function responderTexto(page, log, texto, etiqueta) {
  const antes = await contarMensajes(page);
  await page.locator('#agente-entrada').fill(texto);
  await clicConRespuesta(page, page.locator('#agente-enviar'), `${etiqueta} · «${texto}»`, log);
  return esperarRespuesta(page, antes, etiqueta);
}
async function pulsarOpcion(page, log, patron, etiqueta) {
  const antes = await contarMensajes(page);
  const opcion = await esperarControlTexto(page, SEL_CHIP, patron, 6000, etiqueta);
  await clicConRespuesta(page, opcion.locator, `${etiqueta} · «${opcion.texto}»`, log);
  return esperarRespuesta(page, antes, etiqueta);
}
// El comprador pide una llamada y responde lo que el agente pregunta, de a una pregunta, hasta «Guardé tus datos».
async function capturarLead(page, log, datos = {}) {
  const d = Object.assign({
    nombre: 'Ana Pérez',
    empresa: 'Hotel Sol',
    negocio: /^Hotel$/,
    correo: 'ana.perez@hotelsol.cl',
    permisoContacto: /^Sí, autorizo$/,
    permisoNovedades: /^Sí, novedades$/,
  }, datos);
  await responderTexto(page, log, 'Quiero que me llamen', 'pedido de llamada');
  for (let i = 0; i < 8; i += 1) {
    const msgs = await mensajesAgente(page);
    const ultima = msgs.at(-1) || '';
    if (msgs.slice(-2).some((t) => /Guardé tus datos/.test(t))) return d;
    if (/te llamas/i.test(ultima)) await responderTexto(page, log, d.nombre, 'nombre del comprador');
    else if (/negocio o empresa/i.test(ultima)) {
      if (d.empresa) await responderTexto(page, log, d.empresa, 'empresa del comprador');
      else await pulsarOpcion(page, log, /^Prefiero no responder$/, 'el comprador prefiere no dar su empresa');
    } else if (/tipo de negocio/i.test(ultima)) await pulsarOpcion(page, log, d.negocio, 'tipo de negocio');
    else if (/por correo o por WhatsApp/i.test(ultima)) await pulsarOpcion(page, log, /^Por correo$/, 'canal de contacto');
    else if (/Escribe tu correo/i.test(ultima)) await responderTexto(page, log, d.correo, 'correo del comprador');
    else if (/autorizas a contactarte/i.test(ultima)) await pulsarOpcion(page, log, d.permisoContacto, 'permiso de contacto');
    else if (/novedades y ofertas/i.test(ultima)) await pulsarOpcion(page, log, d.permisoNovedades, 'permiso de novedades');
    else throw new Error(`Pregunta del agente no prevista en la captura: ${ultima.slice(0, 200)}`);
  }
  throw new Error('La captura del lead no terminó en 8 pasos');
}
// Lado del cliente: el envío que aprobó Marketing aparece en el chat del comprador, como vista previa simulada.
async function flujoLadoCliente(page, log, fragmento) {
  await irA(page, 'C01');
  await abrirAgente(page);
  const envio = await esperarControl(page, '#agente-panel [data-agente-envio]', 8000, 'el envío aprobado en el chat del comprador');
  const texto = norm(await envio.locator.textContent());
  assert.ok(texto.includes(fragmento), 'El envío aprobado debe aparecer del lado del cliente, en su chat');
  assert.match(texto, /Vista previa|simulaci/i, 'El envío del lado del cliente debe verse como vista previa simulada');
  await captura(page, log, 'cliente-04-envio-visto');
  paso(log, 'El envío aprobado por Marketing aparece del lado del cliente, como vista previa simulada');
  await cerrarAgente(page);
}
// Respaldo: «Prefiero no responder» no crea lead; con permiso, la baja corta el contacto y el lead deja de ser identificado.
async function flujoRespaldo(page, log) {
  await page.evaluate(() => window.M4.reset());
  await irA(page, 'C04');
  await abrirAgente(page);
  await responderTexto(page, log, 'Quiero que me llamen', 'respaldo: pedido de llamada');
  for (let i = 0; i < 6; i += 1) {
    const ultima = (await mensajesAgente(page)).at(-1) || '';
    if (/No guardé tus datos/.test(ultima)) break;
    await pulsarOpcion(page, log, /^Prefiero no responder$/, 'respaldo: el comprador prefiere no responder');
  }
  const cancelado = (await mensajesAgente(page)).at(-1) || '';
  assert.match(cancelado, /No guardé tus datos/, 'Sin datos de contacto, el chat debe decirlo y no guardar nada');
  assert.equal(await page.evaluate(() => window.M4.get().lead), null, 'Sin datos de contacto no debe crearse un lead');
  paso(log, 'Prefiero no responder: el chat no guarda datos de contacto ni crea un lead');

  await page.evaluate(() => window.M4.reset());
  await irA(page, 'C04');
  await abrirAgente(page);
  await capturarLead(page, log, { nombre: 'Luis Soto', empresa: null, negocio: /^Restaurante$/, correo: 'luis@restaurante.cl', permisoNovedades: /^Solo mi solicitud$/ });
  const idBaja = await page.evaluate(() => (window.M4.get().lead || {}).id || null);
  assert.ok(idBaja, 'La segunda captura debe crear el lead');
  await responderTexto(page, log, 'No me escriban', 'respaldo: baja');
  const tras = await page.evaluate(() => { const L = window.M4.get().lead || {}; return { consent: L.consent === true, mkt: L.marketingConsent === true }; });
  assert.deepEqual(tras, { consent: false, mkt: false }, 'La baja debe quitar el permiso de contacto del lead');
  const cons = (await estado(page)).crudo.consentimientos[idBaja] || {};
  assert.ok(cons.baja === true && cons.correo !== true && cons.whatsapp !== true, 'La baja debe dejar el canal sin permiso');
  assert.match((await mensajesAgente(page)).at(-1) || '', /No te enviaremos mensajes/, 'La baja debe confirmarse en el chat');
  paso(log, 'Baja: el chat la confirma, quita el permiso de contacto y no envía nada');
  await cerrarAgente(page);
}

// ---------- Revisiones finales ----------

function revisarEsquema(s) {
  assert.ok(s.crudo, `No existe localStorage["${KEY}"]`);
  assert.equal(typeof s.crudo.conversaciones, 'object', 'conversaciones debe ser un objeto por cuenta');
  assert.ok(Array.isArray(s.crudo.traspasos), 'traspasos debe ser una lista');
  for (const rol of ['ventas', 'marketing', 'jefatura']) {
    assert.ok(Array.isArray(s.crudo.notificaciones?.[rol]), `notificaciones.${rol} debe ser una lista`);
  }
  assert.ok(Array.isArray(s.crudo.registro), 'registro debe ser una lista');
  assert.equal(typeof s.crudo.consentimientos, 'object', 'consentimientos debe ser un objeto por cuenta');
}

function revisarRegistro(s) {
  assert.ok(s.registro.length > 0, 'El registro del agente está vacío');
  for (const e of s.registro) {
    assert.ok(NIVELES.includes(e.nivel), `Nivel de control inválido en el registro: ${JSON.stringify(e.nivel)}`);
    assert.equal(typeof e.accion, 'string', 'Cada entrada del registro debe decir qué acción se hizo');
  }
  const vistos = new Set(s.registro.map((e) => e.nivel));
  for (const nivel of NIVELES) assert.ok(vistos.has(nivel), `Falta el nivel «${nivel}» en el registro`);
  for (const e of s.registro.filter((x) => x.nivel === 'persona')) {
    assert.ok(norm(e.decidio), 'Cada decisión de una persona debe registrar quién decidió');
  }
}

async function correrCombinacion(navegador, size, log) {
  const browser = await navegador.lanzar();
  try {
    await barridoCliente(browser, size, log);
    for (const rol of ['marketing', 'ventas', 'jefatura']) await barridoCrm(browser, size, log, rol);

    const { context, page } = await abrirSesion(browser, size, log);
    try {
      await flujoComprador(page, size, log);
      // Diagnóstico: AGENTE_VERIFY_SIN_PORTAL=1 omite solo el portal para probar el resto del flujo.
      if (process.env.AGENTE_VERIFY_SIN_PORTAL === '1') {
        log.portal = 'omitido';
        process.stderr.write(`  aviso ${log.etiqueta}: portal omitido por AGENTE_VERIFY_SIN_PORTAL=1\n`);
      } else {
        await flujoPortal(page, size, log);
      }
      await flujoMarketing(page, size, log);
      await flujoVentas(page, size, log);
      await flujoJefatura(page, size, log);
      await flujoRespaldo(page, log);

      const s = await estado(page);
      revisarEsquema(s);
      revisarRegistro(s);
      assert.ok(s.traspasos.length >= 2, `Deben existir dos traspasos (llamada del comprador y Marketing a Ventas); hay ${s.traspasos.length}`);
      const clear = await page.evaluate(() => window.__clearCalls || 0);
      assert.equal(clear, 0, 'La página llamó a localStorage.clear() durante el recorrido');
      log.resumen = {
        traspasos: s.traspasos.length,
        avisosVentas: s.notificaciones.ventas.length,
        niveles: [...new Set(s.registro.map((e) => e.nivel))],
        registros: s.registro.length,
        localStorageClear: clear,
      };
      paso(log, 'Registro con nivel de control en cada acción, sin localStorage.clear');
    } finally {
      await context.close();
    }
    assert.deepEqual(log.errores, [], `Errores de JavaScript, consola o red: ${log.errores.join(' | ')}`);
    assert.deepEqual(log.sinRespuesta, [], `Clics sin respuesta: ${log.sinRespuesta.join(' | ')}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await comprobarServidor(INDEX);
  const archivos = revisarArchivos();
  assert.deepEqual(archivos.faltan, [], `Faltan archivos del agente (subagentes A y B): ${archivos.faltan.join(', ')}`);
  assert.deepEqual(archivos.sinCarga, [], `index.html no carga estos archivos del agente: ${archivos.sinCarga.join(', ')}`);
  assert.deepEqual(archivos.conClear, [], `Estos archivos llaman a localStorage.clear(): ${archivos.conClear.join(', ')}`);
  assert.ok(fs.existsSync(CHROME_PATH), `No encuentro Chrome en ${CHROME_PATH}`);
  assert.ok(fs.existsSync(EDGE_PATH), `No encuentro Edge en ${EDGE_PATH}`);

  const resultados = [];
  for (const navegador of NAVEGADORES) {
    for (const size of SIZES) {
      // Diagnóstico: AGENTE_VERIFY_SOLO=chrome-1280 corre una sola combinación. La corrida válida no lo usa.
      if (process.env.AGENTE_VERIFY_SOLO && `${navegador.nombre}-${size.width}`.toLowerCase() !== process.env.AGENTE_VERIFY_SOLO.toLowerCase()) continue;
      const log = {
        etiqueta: `${navegador.nombre}-${size.width}x${size.height}`,
        navegador: navegador.nombre,
        viewport: `${size.width}x${size.height}`,
        pasos: [],
        clics: 0,
        sinRespuesta: [],
        errores: [],
        resumen: null,
      };
      process.stderr.write(`Corrida ${navegador.nombre} ${size.width}x${size.height}\n`);
      try {
        await conLimite(correrCombinacion(navegador, size, log), 480000, log.etiqueta);
        resultados.push({ navegador: log.navegador, viewport: log.viewport, status: 'PASS', pasos: log.pasos.length, clics: log.clics, sinRespuesta: 0, errores: 0, resumen: log.resumen });
      } catch (error) {
        resultados.push({
          navegador: log.navegador,
          viewport: log.viewport,
          status: 'FAIL',
          ultimoPaso: log.pasos.at(-1) || null,
          error: String(error.message).split('\n')[0],
          clics: log.clics,
          sinRespuesta: log.sinRespuesta,
          errores: log.errores.slice(0, 5),
        });
      }
    }
  }
  const fallos = resultados.filter((r) => r.status === 'FAIL').length;
  const salida = { status: fallos ? 'FAIL' : 'PASS', url: INDEX, capturas: OUT, resultados };
  process.stdout.write(`${JSON.stringify(salida, null, 2)}\n`, () => process.exit(fallos ? 1 : 0));
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
