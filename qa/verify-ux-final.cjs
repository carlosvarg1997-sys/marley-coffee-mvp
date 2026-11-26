'use strict';
// Verificador final del encargo «mejoras finales del prototipo Marley Coffee Empresas» (25-nov-2026).
// Subagente F. Revisa los 11 puntos de la sección F de CONTRATO_UX_FINAL_25NOV.md con los selectores de «Puntos de unión».
//
// Uso (desde la carpeta del repositorio):
//   node qa/verify-ux-final.cjs                                  levanta su propio servidor (la copia del repositorio bajo /marley-coffee-mvp/)
//   node qa/verify-ux-final.cjs https://carlosvarg1997-sys.github.io/marley-coffee-mvp/
//   node qa/verify-ux-final.cjs http://127.0.0.1:8907/ --navegador=chrome --tamanos=390x844 --puntos=2,4
// Opciones: --navegador=chrome|edge|ambos · --tamanos=WxH,... · --puntos=1,2,...,11 · --estricto (lo pendiente cuenta como falla).
// Chrome corre en los 7 tamaños y Edge en 1280x551 y 390x844. Cada comprobación sale PASS, FALLA (con su causa) o
// PENDIENTE de X cuando la pieza todavía no existe y la entrega X. Con --estricto, lo pendiente también falla.
// Informe JSON y capturas fuera del repositorio: $MARLEY_UX_FINAL_OUT o la carpeta F del encargo.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium: lanzadorChrome } = require('./playwright-system-chrome.cjs');
const { chromium: lanzadorEdge } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const RAIZ = path.resolve(__dirname, '..');
const EDGE_EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const EVIDENCIA = process.env.MARLEY_UX_FINAL_OUT || 'C:/Users/HP/Documents/Codex/2026-11-15/ten/work/marley-ux-final-25nov-evidencia/F/ux-final';
const TAMANOS = {
  chrome: [[1280, 551], [1366, 625], [1536, 730], [1912, 733], [1440, 900], [390, 844], [360, 640]],
  edge: [[1280, 551], [390, 844]],
};
// Puntos que se comparan entre tipos de comprador o que son caros: solo en los dos tamaños de referencia.
const REFERENCIA = ['1280x551', '390x844'];
// Los siete tipos de negocio de B2B_SEGMENTS del prototipo (Hotel, Restaurante, Cafetería, Eventos o catering, OCS, Conveniencia, Panadería).
const TIPOS = [
  { nombre: 'Hotel', patron: 'hotel' },
  { nombre: 'Restaurante', patron: 'restaurante' },
  { nombre: 'Cafetería', patron: 'cafeteria' },
  { nombre: 'Eventos o catering', patron: 'eventos o catering|eventos|catering' },
  { nombre: 'Oficina (OCS)', patron: 'oficinas?|ocs' },
  { nombre: 'Conveniencia', patron: 'conveniencia' },
  { nombre: 'Panadería', patron: 'panaderia' },
];

const NOMBRES = {
  '1.a': 'Misma secuencia de pantallas para todos los tipos de comprador',
  '1.b': 'Saludo distinto por tipo de comprador',
  '2.a': 'Las condiciones van antes del CTA al formulario',
  '2.b': 'El CTA principal se repite abajo en cada pantalla del cliente',
  '2.c': 'El CTA principal se repite arriba y abajo en las 4 pestañas del portal',
  '3.a': 'Selector de máquinas con foto y funciones',
  '3.b': '«Ya sé qué máquina quiero» salta el cuestionario y deja elegida la máquina',
  '3.c': 'La lista y la ficha del CRM muestran el mismo puntaje',
  '3.d': 'Quien salta el cuestionario suma lo mismo que quien lo completa (diagnóstico 10 + 5)',
  '4.a': 'Pack resumido: fotos chicas, cantidad, total más IVA y «Ver mis productos»',
  '4.b': 'Detalle del pack: vista grande, deslizable, con zoom y cantidades editables',
  '4.c': '«Aceptar mi pack» funciona sin abrir el detalle',
  '4.d': 'Sugerencia después de aceptar, sin competir con «Aceptar»',
  '4.e': '«No, gracias» cierra la sugerencia',
  '5.a': 'Después de comprar: un solo «Ir a mi portal» y ningún bucle',
  '5.b': 'Portal con 4 pestañas',
  '5.c': 'Mi pedido: franja de llegada con etapa actual, fecha estimada y explicación',
  '5.d': '«Firmar contrato (simulación)» avanza la franja y muestra el aviso',
  '5.e': 'Sin pestañas nuevas ni vuelta al catálogo',
  '6.a': 'El agente del portal responde lo simple',
  '6.b': 'El agente deriva una falla de la máquina con «Te paso con una persona de Soporte»',
  '6.c': 'El agente sigue atendiendo mientras llega la persona',
  '6.d': 'La persona se une y el cliente ve el resumen',
  '6.e': 'El CRM muestra la conversación en espera y «Tomar conversación»',
  '6.f': 'El chat conserva la misma conversación al cambiar de pestaña',
  '7.a': 'Tarea de correo en el CRM: borrador con canal y editable',
  '7.b': '«Más corto» cambia el borrador',
  '7.c': '«Envíalo» se manda en segundo plano y muestra «Correo enviado a …»',
  '7.d': 'El envío queda en la línea de tiempo',
  '7.e': 'El cliente recibe el mensaje en su portal (correo simulado)',
  '7.f': 'Aviso al compañero en su «Hoy»',
  '8.a': 'Prueba autoguiada: franja de tarea y sin ventana lateral durante la tarea',
  '8.b': 'El CTA de cierre abre el cuestionario de la tarea',
  '8.c': 'El cuestionario bloquea hasta guardar',
  '8.d': 'Al guardar, la prueba avanza a la pantalla pedida',
  '8.e': '«No lo logré» abre el cuestionario con esa opción marcada',
  '8.f': 'Cuestionario sin desborde lateral y a pantalla completa en celular',
  '9.a': 'Sin scroll lateral en ninguna pantalla',
  '9.b': 'Margen lateral mínimo (20 px celular, 32 px escritorio)',
  '9.c': 'Espacio mínimo entre bloques (24 px) y secciones (40 px)',
  '9.d': 'Relleno mínimo en cajas (12 px) y chips o botones (8 px)',
  '10.a': 'Con reducir movimiento todo queda quieto',
  '10.b': 'Con reducir movimiento lo visible sigue visible',
  '10.c': 'Se ve igual con y sin reducir movimiento',
  '10.d': 'Todo lo animable es visible sin JavaScript',
  '11.a': 'Ningún clic sin respuesta',
  '11.b': 'Ningún error de consola, de página, de red ni llamada externa',
  '11.c': 'Ningún localStorage.clear',
  '11.d': 'Ninguna pestaña emergente (popup)',
};

// ---------- resultados ----------
const ok = (id, datos) => ({ id, estado: 'PASS', datos });
const falla = (id, causa, datos) => ({ id, estado: 'FALLA', causa, datos });
const pend = (id, dueno, causa) => ({ id, estado: 'PENDIENTE', dueno, causa });

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const sleep = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Utilidades que se inyectan en cada página (y cada marco) antes de que cargue su código.
function utilidadesEnPagina() {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const vis = (el) => {
    if (!el || el.nodeType !== 1 || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    if (el.closest('[hidden],[inert]')) return false;
    for (let nodo = el; nodo; nodo = nodo.parentElement) {
      if (nodo.matches('details:not([open])') && !nodo.querySelector(':scope > summary')?.contains(el)) return false;
    }
    return true;
  };
  const visibles = (sel, patron) => {
    const re = patron ? new RegExp(patron) : null;
    const salida = [];
    document.querySelectorAll(sel).forEach((el, i) => {
      if (!vis(el)) return;
      const texto = norm(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`);
      if (!re || re.test(texto)) salida.push({ i, texto: texto.slice(0, 160) });
    });
    return salida;
  };
  window.__F = { norm, vis, visibles };
}

function contarLimpiezas() {
  window.__clearCalls = 0;
  const original = Storage.prototype.clear;
  Storage.prototype.clear = function clear(...args) {
    window.__clearCalls += 1;
    return original.apply(this, args);
  };
}

// ---------- servidor propio (la copia del repositorio bajo un prefijo, como GitHub Pages) ----------
function servirRepo(prefijo) {
  const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.pdf': 'application/pdf', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
  return new Promise((resolver) => {
    const servidor = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url === prefijo) { res.writeHead(301, { Location: `${prefijo}/` }); res.end(); return; }
      if (!url.startsWith(`${prefijo}/`)) { res.writeHead(404); res.end('fuera de la subcarpeta'); return; }
      let rel = url.slice(prefijo.length + 1);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const archivo = path.resolve(RAIZ, rel);
      if (!archivo.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
      fs.readFile(archivo, (error, datos) => {
        if (error) { res.writeHead(404); res.end('no existe'); return; }
        res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(datos);
      });
    });
    servidor.listen(0, '127.0.0.1', () => resolver(servidor));
  });
}

function baseDe(raw) {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  if (/\.html?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/[^/]*$/, '');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

// ---------- sesiones ----------
async function crearSesion(c, { reducido = false, sinJS = false, etiqueta = '' } = {}) {
  const context = await c.browser.newContext({
    viewport: { width: c.w, height: c.h },
    isMobile: c.w < 768,
    hasTouch: c.w < 768,
    reducedMotion: reducido ? 'reduce' : 'no-preference',
    javaScriptEnabled: !sinJS,
    locale: 'es-CL',
  });
  await context.addInitScript(utilidadesEnPagina);
  await context.addInitScript(contarLimpiezas);
  const s = { c, base: c.base, context, etiqueta, errores: [], popups: [], principal: null, page: null, maquinaId: null, saludo: '' };
  (c.sesiones ||= []).push(s);
  context.on('page', (p) => { if (s.principal && p !== s.principal) s.popups.push(p.url() || 'about:blank'); });
  const page = await context.newPage();
  s.page = page;
  s.principal = page;
  page.setDefaultTimeout(10000);
  const mismoOrigen = (url) => { try { return new URL(url).origin === new URL(s.base).origin; } catch (_) { return false; } };
  // El sondeo /api/ping solo existe en un servidor con la app: en un servidor estático (local) responde 404 a propósito.
  const sondeoLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(s.base).hostname);
  const sondeo = (url) => sondeoLocal && /\/api\/ping(\?|$)/.test(url || '');
  page.on('pageerror', (e) => s.errores.push({ tipo: 'error de página', detalle: String(e.message).slice(0, 200) }));
  page.on('console', (m) => { if (m.type() === 'error' && !sondeo(m.location()?.url)) s.errores.push({ tipo: 'consola', detalle: m.text().slice(0, 200) }); });
  page.on('requestfailed', (r) => { const motivo = r.failure()?.errorText || ''; if (mismoOrigen(r.url()) && motivo !== 'net::ERR_ABORTED' && !sondeo(r.url())) s.errores.push({ tipo: 'red', detalle: `${r.url().slice(0, 160)} (${motivo})` }); });
  page.on('response', (r) => { if (r.status() >= 400 && mismoOrigen(r.url()) && !sondeo(r.url())) s.errores.push({ tipo: 'HTTP', detalle: `${r.status()} ${r.url().slice(0, 160)}` }); });
  page.on('request', (r) => { if (!mismoOrigen(r.url()) && ['xhr', 'fetch', 'websocket', 'eventsource', 'script'].includes(r.resourceType())) s.errores.push({ tipo: 'llamada externa', detalle: `${r.resourceType()} ${r.url().slice(0, 160)}` }); });
  return s;
}

async function cerrarSesion(s) {
  try {
    const n = await s.page.evaluate(() => window.__clearCalls || 0);
    if (n > 0) s.errores.push({ tipo: 'localStorage.clear', detalle: `${n} llamada(s)` });
  } catch (_) { /* la página ya no existe */ }
  await s.context.close().catch(() => {});
}

// ---------- navegación y espera ----------
async function irA(s, ruta) {
  const p = s.page;
  await p.goto(new URL(`index.html#${ruta}`, s.base).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.__F), null, { timeout: 15000 });
  await p.waitForFunction((r) => document.body.dataset.current === r, ruta, { timeout: 8000 }).catch(() => {});
  await sleep(250);
}

async function irRuta(s, ruta) {
  await s.page.evaluate((r) => window.MarleyApp.go(r, { evaluation: true }), ruta);
  await s.page.waitForFunction((r) => document.body.dataset.current === r, ruta, { timeout: 8000 }).catch(() => {});
  await sleep(300);
}

async function rutaActual(p) {
  return p.evaluate(() => document.body.dataset.current || (location.hash || '').slice(1).split('?')[0]);
}

async function esperarVisible(objetivo, sel, patron = null, ms = 6000) {
  const limite = Date.now() + ms;
  do {
    const lista = await objetivo.evaluate(([a, b]) => window.__F.visibles(a, b), [sel, patron]).catch(() => []);
    if (lista.length) return lista;
    await sleep(150);
  } while (Date.now() < limite);
  return [];
}

async function esperarOculto(objetivo, sel, ms = 6000) {
  const limite = Date.now() + ms;
  do {
    const lista = await objetivo.evaluate(([a]) => window.__F.visibles(a, null), [sel]).catch(() => [{}]);
    if (!lista.length) return true;
    await sleep(150);
  } while (Date.now() < limite);
  return false;
}

async function textoEspera(p, texto, ms = 6000) {
  const limite = Date.now() + ms;
  do {
    const ok = await p.evaluate((t) => window.__F.norm(document.body.innerText).includes(t), texto).catch(() => false);
    if (ok) return true;
    await sleep(150);
  } while (Date.now() < limite);
  return false;
}

// Pulsa el primer control visible que coincide. Si otro elemento lo tapa, el error sube a quien llama.
async function clic(objetivo, sel, patron = null, indice = 0) {
  const lista = await esperarVisible(objetivo, sel, patron, 4000);
  const hit = lista[indice];
  if (!hit) return false;
  const loc = objetivo.locator(sel).nth(hit.i);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 5000 });
  return true;
}

// ---------- medidas en la página ----------
const leerCtas = (p) => p.evaluate(() => {
  const F = window.__F;
  const grupos = {};
  document.querySelectorAll('[data-cta-principal]').forEach((el) => { if (F.vis(el)) (grupos[el.dataset.ctaPrincipal] ||= []).push(el); });
  const docH = document.documentElement.scrollHeight;
  const hojas = [...document.querySelectorAll('body *')].filter((el) => F.vis(el) && (el.childElementCount === 0 || el.tagName === 'IMG'));
  const aire = (el) => {
    const r = el.getBoundingClientRect();
    const arriba0 = r.top + scrollY;
    const abajo0 = r.bottom + scrollY;
    let encima = null;
    let debajo = null;
    for (const o of hojas) {
      if (el.contains(o) || o.contains(el)) continue;
      const q = o.getBoundingClientRect();
      const solapa = Math.min(q.right, r.right) - Math.max(q.left, r.left) > Math.min(q.width, r.width) * 0.3;
      if (!solapa) continue;
      const qt = q.top + scrollY;
      const qb = q.bottom + scrollY;
      if (qb <= arriba0 + 1) encima = Math.max(encima ?? -Infinity, qb);
      if (qt >= abajo0 - 1) debajo = Math.min(debajo ?? Infinity, qt);
    }
    return {
      gapArriba: encima === null ? null : Math.round(arriba0 - encima),
      gapAbajo: debajo === null ? Math.round(docH - abajo0) : Math.round(debajo - abajo0),
    };
  };
  const destino = (el) => el.getAttribute('href') || el.getAttribute('data-cierra-tarea') || el.getAttribute('data-evt') || el.getAttribute('data-go') || '';
  return Object.entries(grupos).map(([id, els]) => {
    const ultimo = els[els.length - 1];
    const abajoUltimo = ultimo.getBoundingClientRect().bottom + scrollY;
    const panel = ultimo.closest('.mp-panel')?.getBoundingClientRect();
    const posicionUltimo = panel
      ? (ultimo.getBoundingClientRect().top - panel.top) / panel.height
      : (ultimo.getBoundingClientRect().top + scrollY) / docH;
    return {
      id,
      veces: els.length,
      textos: els.map((e) => F.norm(e.innerText || e.getAttribute('aria-label') || '')),
      destinos: els.map(destino),
      posicionUltimo: Math.round(posicionUltimo * 100),
      aireUltimo: aire(ultimo),
      // Hay contenido (fuera del pie) debajo del último CTA: si el CTA está arriba, hace falta repetirlo al final.
      contenidoDebajo: hojas.some((o) => !o.closest('footer') && (o.getBoundingClientRect().top + scrollY) >= abajoUltimo + 40),
    };
  });
});

const ctaOk = (g) => g.veces >= 2 && g.textos[0] === g.textos[g.textos.length - 1] && g.destinos[0] === g.destinos[g.destinos.length - 1]
  && g.posicionUltimo >= 50 && (g.aireUltimo.gapArriba === null || g.aireUltimo.gapArriba >= 24) && g.aireUltimo.gapAbajo >= 24;

// Regla 2.b: la repetición arriba y abajo aplica cuando el CTA está arriba y sigue contenido debajo.
// Un CTA único al final del contenido (pasos de formulario, cuestionario o confirmación) no necesita repetirse.
const sinRepetirOk = (g) => g.veces === 1 && !g.contenidoDebajo;

function motivoCta(g) {
  if (g.veces < 2) return g.contenidoDebajo
    ? `«${g.textos[0]}» aparece 1 vez y hay contenido debajo: hace falta repetirlo al final`
    : `«${g.textos[0]}» aparece 1 vez`;
  const m = [];
  if (g.textos[0] !== g.textos[g.textos.length - 1]) m.push('arriba y abajo tienen textos distintos');
  if (g.destinos[0] !== g.destinos[g.destinos.length - 1]) m.push('arriba y abajo llevan a destinos distintos');
  if (g.posicionUltimo < 50) m.push('el de abajo no está al final');
  if (g.aireUltimo.gapArriba !== null && g.aireUltimo.gapArriba < 24) m.push(`${g.aireUltimo.gapArriba} px de aire arriba (mínimo 24)`);
  if (g.aireUltimo.gapAbajo < 24) m.push(`${g.aireUltimo.gapAbajo} px de aire abajo (mínimo 24)`);
  return m.join(', ');
}

// ---------- comprobaciones por punto ----------
async function p2Inicio(s) {
  const r = await s.page.evaluate(() => {
    const F = window.__F;
    const cond = [...document.querySelectorAll('h1,h2,h3,h4,p,strong,span,div,section')]
      .filter((el) => F.vis(el) && F.norm(el.innerText).startsWith('asi funciona marley coffee empresas'))
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    const t1 = [...document.querySelectorAll('#condiciones [data-cierra-tarea="T1"]')].find(F.vis);
    const maquinas = [...document.querySelectorAll('#condiciones .cmp-home-maquina')];
    const arriba = (el) => Math.round(el.getBoundingClientRect().top + scrollY);
    return {
      condiciones: cond ? arriba(cond) : null,
      cta: t1 ? arriba(t1) : null,
      maquinas: maquinas.length,
      finMaquinas: Math.round(Math.max(0, ...maquinas.map(el => el.getBoundingClientRect().bottom + scrollY)))
    };
  });
  if (r.condiciones === null) return pend('2.a', 'B1', 'falta el bloque «Así funciona Marley Coffee Empresas» en C02');
  if (r.cta === null) return pend('2.a', 'B1', 'falta el CTA T1 («Cuéntanos de tu negocio») en C02');
  if (r.condiciones < r.cta && r.maquinas === 4 && r.finMaquinas <= r.cta) return ok('2.a', r);
  if (r.maquinas !== 4 || r.finMaquinas > r.cta) return falla('2.a', 'el CTA de condiciones debe venir después de las cuatro máquinas', r);
  return falla('2.a', `las condiciones (y=${r.condiciones}) van después del CTA al formulario (y=${r.cta})`, r);
}

async function p2Pantalla(s, pantalla, dueno = 'B1') {
  const datos = await leerCtas(s.page);
  if (!datos.length) return { id: '2.b', estado: 'PENDIENTE', dueno, causa: `${pantalla}: no hay CTA con data-cta-principal` };
  const fallos = datos.filter((g) => !ctaOk(g) && !sinRepetirOk(g)).map((g) => `${pantalla}: ${motivoCta(g)}`);
  if (fallos.length) return { id: '2.b', estado: 'FALLA', causa: fallos.join(' · '), datos };
  return { id: '2.b', estado: 'PASS', datos: { pantalla, grupos: datos.map((g) => g.id) } };
}

async function p2Pestanas(s, medirPestana) {
  const p = s.page;
  const pestanas = await esperarVisible(p, '#portal-tabs [data-portal-tab]', null, 3000);
  if (!pestanas.length) return pend('2.c', 'B2', 'falta #portal-tabs con las pestañas del portal');
  const fallos = [];
  const datos = [];
  for (const k of ['pedido', 'repetir', 'ayuda', 'recomendar']) {
    if (!(await clic(p, `#portal-tabs [data-portal-tab="${k}"]`).catch(() => false))) { fallos.push(`no abre la pestaña «${k}»`); continue; }
    await sleep(350);
    const ctas = await leerCtas(p);
    datos.push({ pestana: k, ctas: ctas.map((g) => g.id) });
    if (!ctas.some(ctaOk)) fallos.push(`pestaña «${k}»: ${ctas.length ? ctas.map(motivoCta).join('; ') : 'sin CTA principal'}`);
    if (medirPestana) await medirPestana(k);
  }
  await clic(p, '#portal-tabs [data-portal-tab="pedido"]').catch(() => false);
  return fallos.length ? falla('2.c', fallos.join(' · '), datos) : ok('2.c', datos);
}

async function p3Tarjetas(s) {
  const datos = await s.page.evaluate(() => {
    const F = window.__F;
    return [...document.querySelectorAll('[data-maquina-id]')].filter(F.vis).map((el) => {
      const tarjeta = el.closest('article') || el;
      const foto = tarjeta.querySelector('img[data-zoom]');
      return { id: el.dataset.maquinaId, foto: Boolean(foto?.getAttribute('src')), letras: F.norm(tarjeta.innerText).length };
    });
  });
  const malas = datos.filter((d) => !d.foto || d.letras < 30);
  if (datos.length !== 4) return falla('3.a', `hay ${datos.length} tarjeta(s) de máquina; hacen falta las cuatro con foto y funciones`, datos);
  if (malas.length) return falla('3.a', `tarjetas sin foto o sin funciones: ${malas.map((m) => m.id).join(', ')}`, datos);
  return ok('3.a', { tarjetas: datos.length });
}

// «Ya sé qué máquina quiero»: no hay señal nueva; la máquina queda elegida por el cliente (catalogJourney) y el puntaje la cuenta como diagnóstico (3.d).
async function p3Senal(s) {
  const id = s.maquinaId;
  await sleep(600);
  const estado = await s.page.evaluate(() => {
    const st = window.M4?.get?.() || {};
    return { origen: st.compra?.origen ?? null, machine: st.quote?.machine ?? null };
  });
  if (estado.origen === 'sabe-maquina' && String(estado.machine) === String(id)) return ok('3.b', { maquina: id, origen: estado.origen });
  return falla('3.b', `el cliente eligió ${id} directo, pero el estado no queda como «sabe-maquina» con esa máquina (compra.origen: ${estado.origen} · quote.machine: ${estado.machine})`, { maquina: id, estado });
}

async function p4Resumen(s) {
  const r = await s.page.evaluate(() => {
    const F = window.__F;
    const caja = document.querySelector('#pack-resumen');
    if (!caja || !F.vis(caja)) return null;
    const fotos = [...caja.querySelectorAll('img')].filter(F.vis);
    const ver = [...caja.querySelectorAll('[data-pack-accion="ver-productos"]')].some(F.vis);
    return {
      fotos: fotos.length,
      anchoMaxFoto: Math.round(Math.max(0, ...fotos.map((f) => f.getBoundingClientRect().width))),
      iva: /\biva\b/.test(F.norm(caja.innerText)),
      total: /\$\s?[\d.]+/.test(caja.innerText),
      verProductos: ver,
      alto: Math.round(caja.getBoundingClientRect().height),
    };
  });
  if (!r) return falla('4.a', 'no se ve #pack-resumen');
  const causas = [];
  if (!r.verProductos) causas.push('falta «Ver mis productos» ([data-pack-accion="ver-productos"])');
  if (!r.iva) causas.push('no dice IVA');
  if (!r.total) causas.push('no muestra el total con $');
  if (r.fotos > 8 || r.anchoMaxFoto > 96) causas.push(`fotos no chicas (${r.fotos} fotos, hasta ${r.anchoMaxFoto} px)`);
  return causas.length ? falla('4.a', causas.join('; '), r) : ok('4.a', r);
}

async function p4Detalle(s) {
  const p = s.page;
  const resultados = [];
  if (!(await clic(p, '#pack-resumen [data-pack-accion="ver-productos"]').catch(() => false))) {
    return [falla('4.b', 'no pude pulsar «Ver mis productos» dentro de #pack-resumen')];
  }
  if (!(await esperarVisible(p, '#pack-productos', null, 4000)).length) return [falla('4.b', 'al pulsar «Ver mis productos» no se abre #pack-productos')];
  const datos = await p.evaluate(() => {
    const F = window.__F;
    const cont = document.querySelector('#pack-productos');
    const fotos = [...cont.querySelectorAll('img')].filter(F.vis);
    const zooms = [...cont.querySelectorAll('[data-zoom]')];
    const cantidades = [...cont.querySelectorAll('input[type="number"]')].filter(F.vis);
    const deck = cont.querySelector('.cmp-deck');
    const total = Number(cont.querySelector('[data-pack-total]')?.dataset.packTotal);
    return {
      fotos: fotos.length,
      zooms: zooms.length,
      gruposZoom: new Set(zooms.map((z) => z.getAttribute('data-zoom-grupo')).filter(Boolean)).size,
      cantidades: cantidades.length,
      vw: document.documentElement.clientWidth,
      anchoMaxFoto: Math.round(Math.max(0, ...fotos.map((f) => f.getBoundingClientRect().width))),
      desliza: Boolean(deck && /auto|scroll/.test(getComputedStyle(deck).overflowX) && deck.scrollWidth > deck.clientWidth + 2),
      tarjetasAnchoCompleto: Boolean(deck && [...deck.children].every(card => Math.abs(card.getBoundingClientRect().width - deck.clientWidth) <= 1)),
      total,
    };
  });
  const causas = [];
  if (datos.fotos < 2) causas.push(`solo ${datos.fotos} foto(s) en el detalle`);
  if (!datos.zooms) causas.push('las imágenes del detalle no tienen data-zoom');
  if (!datos.cantidades) causas.push('las cantidades no son editables (input number)');
  if (datos.vw < 768 && !(datos.desliza && datos.tarjetasAnchoCompleto)) causas.push('en celular el carrusel no se desliza o muestra más de una tarjeta a la vez');
  resultados.push(causas.length ? falla('4.b', causas.join('; '), datos) : ok('4.b', datos));
  // Cambio de cantidad: el total tiene que moverse.
  if (datos.cantidades) {
    const antes = datos.total;
    await p.evaluate(() => {
      const n = [...document.querySelectorAll('#pack-productos input[type="number"]')].find((x) => window.__F.vis(x));
      if (!n) return;
      n.value = String(Number(n.value || 1) + 1);
      n.dispatchEvent(new Event('input', { bubbles: true }));
      n.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sleep(400);
    const despues = await p.evaluate(() => Number(document.querySelector('#pack-productos [data-pack-total]')?.dataset.packTotal));
    if (!Number.isFinite(antes) || !Number.isFinite(despues) || despues <= antes) resultados.push(falla('4.b', `al aumentar la cantidad no sube el total (${antes} → ${despues})`));
  }
  // Zoom: doble clic abre la imagen en grande; Escape la cierra.
  const zoom = p.locator('#pack-productos [data-zoom]').first();
  if (await zoom.count()) {
    await zoom.dblclick({ timeout: 4000 }).catch(() => {});
    const abre = await esperarVisible(p, '[role="dialog"][aria-modal="true"], dialog[open], [data-zoom-visor], [data-zoom-ventana]', null, 2000);
    if (!abre.length) resultados.push(pend('4.b', 'C', 'el zoom todavía no abre la imagen en grande (data-zoom)'));
    else {
      await p.keyboard.press('Escape');
      const cierra = await esperarOculto(p, '[role="dialog"][aria-modal="true"], dialog[open], [data-zoom-visor], [data-zoom-ventana]', 2000);
      if (!cierra) resultados.push(falla('4.b', 'el zoom no se cierra con Escape'));
    }
  }
  return resultados;
}

async function p4Aceptar(s) {
  const p = s.page;
  const detalleAbierto = (await esperarVisible(p, '#pack-productos', null, 300)).length > 0;
  if (!(await clic(p, '[data-pack-accion="aceptar"]').catch(() => false))) return falla('4.c', 'falta «Aceptar mi pack» ([data-pack-accion="aceptar"])');
  const contacto = await esperarVisible(p, 'input[type="email"], input[type="text"], input[type="tel"]', null, 4000);
  const cruce = await esperarVisible(p, '#cross-sell', null, 4000);
  if (detalleAbierto) return falla('4.c', 'el detalle del pack estaba abierto antes de aceptar (la prueba debe aceptar sin abrirlo)');
  if (!contacto.length && !cruce.length) return falla('4.c', '«Aceptar mi pack» no responde sin abrir el detalle (no aparece el contacto ni la sugerencia)');
  return ok('4.c', { contacto: contacto.length > 0, sugerencia: cruce.length > 0 });
}

async function p4CrossAntes(s) {
  const visible = await p4Sugerencia(s, false);
  return visible;
}

async function p4Sugerencia(s, despuesDeAceptar = true) {
  const p = s.page;
  const r = await p.evaluate(() => {
    const F = window.__F;
    const caja = document.querySelector('#cross-sell');
    const visible = Boolean(caja && F.vis(caja));
    if (!visible) return { visible: false };
    const aceptar = document.querySelector('[data-pack-accion="aceptar"]');
    return {
      visible: true,
      agregar: Boolean(caja.querySelector('[data-cross="agregar"]')),
      noGracias: Boolean(caja.querySelector('[data-cross="no-gracias"]')),
      premarcadas: caja.querySelectorAll('input[type="checkbox"]:checked').length,
      competeConAceptar: Boolean(aceptar && F.vis(aceptar) && caja.parentElement && caja.parentElement.contains(aceptar)),
      texto: F.norm(caja.innerText).slice(0, 160),
    };
  });
  if (!despuesDeAceptar) {
    return r.visible ? falla('4.d', 'la sugerencia aparece antes de aceptar el pack', r) : ok('4.d', { antesDeAceptar: 'oculta' });
  }
  if (!r.visible) return falla('4.d', 'no aparece la sugerencia (#cross-sell) después de aceptar');
  const causas = [];
  if (!r.agregar) causas.push('falta «Agregar» ([data-cross="agregar"])');
  if (!r.noGracias) causas.push('falta «No, gracias» ([data-cross="no-gracias"])');
  if (r.premarcadas) causas.push('hay casillas premarcadas');
  if (r.competeConAceptar) causas.push('la sugerencia compite con «Aceptar» en el mismo bloque');
  return causas.length ? falla('4.d', causas.join('; '), r) : ok('4.d', r);
}

async function p4NoGracias(s) {
  const p = s.page;
  const oculta = await esperarOculto(p, '#cross-sell', 3000);
  const llego = (await esperarVisible(p, '[data-cierra-tarea="T3"]', 'ir a mi portal', 2000)).length > 0;
  return oculta || llego ? ok('4.e', { oculta, llego }) : falla('4.e', '«No, gracias» no cierra la sugerencia');
}

async function p5Confirmacion(s) {
  const p = s.page;
  const r = await p.evaluate(() => {
    const F = window.__F;
    const t3 = [...document.querySelectorAll('[data-cierra-tarea="T3"]')].filter(F.vis);
    const controles = [...document.querySelectorAll('a[href], button, [role="button"], [data-go]')].filter((el) => F.vis(el) && !el.closest('header, nav, footer'));
    const catalogo = controles.filter((el) => {
      const href = el.getAttribute('href') || '';
      const go = el.getAttribute('data-go') || '';
      const txt = F.norm(el.innerText || el.getAttribute('aria-label') || '');
      if (/#C(02|08|1[0-5])\b/.test(href) || /^C(02|08|1[0-5])$/.test(go)) return !/ir a mi portal/.test(txt);
      return /volver al|seguir comprando|catalogo|ver productos|ver maquinas|mas productos|ver cafe/.test(txt) && !/ir a mi portal/.test(txt);
    }).map((el) => F.norm(el.innerText || el.getAttribute('href') || '').slice(0, 40));
    const pestanas = [...document.querySelectorAll('a[target="_blank"]')].filter(F.vis).length;
    return { t3: t3.length, textoT3: t3.map((el) => F.norm(el.innerText)), catalogo, pestanas };
  });
  const causas = [];
  if (r.t3 !== 1) causas.push(`debe haber un solo «Ir a mi portal» y hay ${r.t3}`);
  else if (!r.textoT3[0] || !r.textoT3[0].includes('ir a mi portal')) causas.push(`el CTA de cierre dice «${r.textoT3[0]}»`);
  if (r.catalogo.length) causas.push(`CTA que vuelve al catálogo: ${r.catalogo.join(', ')}`);
  if (r.pestanas) causas.push(`${r.pestanas} enlace(s) abren otra pestaña`);
  return causas.length ? falla('5.a', causas.join('; '), r) : ok('5.a', r);
}

// Después del recorrido: mi pedido, firma del contrato y ninguna pestaña nueva.
async function p5Portal(s) {
  const p = s.page;
  const salida = [];
  const pestanas = await p.evaluate(() => {
    const F = window.__F;
    return [['pedido', 'mi pedido'], ['repetir', 'repetir pedido'], ['ayuda', 'ayuda y postventa'], ['recomendar', 'recomendar']].map(([k, etiqueta]) => {
      const el = document.querySelector(`#portal-tabs [data-portal-tab="${k}"]`);
      return { k, etiqueta, vis: Boolean(el && F.vis(el)), texto: el ? F.norm(el.innerText) : '' };
    });
  });
  const malas = pestanas.filter((x) => !x.vis || !x.texto.includes(x.etiqueta));
  salida.push(malas.length ? falla('5.b', `pestañas incompletas: ${malas.map((m) => m.k).join(', ')}`, pestanas) : ok('5.b', pestanas.map((x) => x.etiqueta)));
  await clic(p, '#portal-tabs [data-portal-tab="pedido"]').catch(() => false);
  await sleep(300);

  const etapas = await p.evaluate(() => {
    const F = window.__F;
    return [...document.querySelectorAll('#portal-franja [data-etapa]')].map((el) => ({
      texto: F.norm(el.innerText),
      actual: el.matches('[aria-current], [data-actual], .actual, .is-actual, .current, .is-current') && el.getAttribute('aria-current') !== 'false',
    }));
  });
  const esperadas = ['confirmado', 'contrato firmado', 'en preparacion', 'en camino', 'instalado'];
  if (!etapas.length) {
    salida.push(pend('5.c', 'B2', 'falta la franja #portal-franja con [data-etapa]'));
  } else {
    const faltan = esperadas.filter((e) => !etapas.some((x) => x.texto.includes(e)));
    const actuales = etapas.filter((x) => x.actual).length;
    const estimada = await textoEspera(p, 'estimad', 1000);
    const causas = [];
    if (faltan.length) causas.push(`faltan etapas: ${faltan.join(', ')}`);
    if (actuales !== 1) causas.push(`la etapa actual debe estar marcada una vez y hay ${actuales}`);
    if (!estimada) causas.push('no aparece la fecha estimada');
    salida.push(causas.length ? falla('5.c', causas.join('; '), etapas) : ok('5.c', { etapas: etapas.length }));
    // Tocar una etapa explica qué pasa.
    const antesTexto = await p.evaluate(() => document.body.innerText);
    await p.locator('#portal-franja [data-etapa]').nth(1).click({ timeout: 4000 }).catch(() => {});
    await sleep(400);
    const despuesTexto = await p.evaluate(() => document.body.innerText);
    if (antesTexto === despuesTexto) salida.push(falla('5.c', 'al tocar una etapa no cambia la explicación'));
  }

  // Firma del contrato (simulación).
  const firmar = await clic(p, '[data-portal-accion="firmar-contrato"]').catch(() => false);
  if (!firmar) {
    salida.push(pend('5.d', 'B2', 'falta «Firmar contrato (simulación)» ([data-portal-accion="firmar-contrato"])'));
  } else {
    const resumen = await esperarVisible(p, '[role="dialog"], dialog[open], #portal-contrato, [data-contrato-resumen]', 'comodato', 4000);
    if (!resumen.length) {
      salida.push(falla('5.d', 'al firmar no se abre el resumen del contrato con los textos de comodato'));
    } else {
      const indiceAntes = await p.evaluate(() => [...document.querySelectorAll('#portal-franja [data-etapa]')].findIndex((el) => el.matches('[aria-current], [data-actual], .actual, .is-actual, .current, .is-current')));
      await p.locator('[data-portal-accion="confirmar-firma"]').click({ timeout: 5000 });
      await p.waitForFunction(indice => [...document.querySelectorAll('#portal-franja [data-etapa]')].findIndex(el => el.getAttribute('aria-current') === 'step') > indice, indiceAntes, { timeout: 3000 }).catch(() => {});
      const avance = await p.evaluate(() => [...document.querySelectorAll('#portal-franja [data-etapa]')].findIndex((el) => el.matches('[aria-current], [data-actual], .actual, .is-actual, .current, .is-current')));
      const aviso = await esperarVisible(p, '.mp-toast, .mp-correo', 'correo enviado|correo simulado', 2500);
      const causas = [];
      if (!(avance > indiceAntes)) causas.push('la franja no avanza al firmar');
      if (!aviso.length) causas.push('no aparece el aviso del correo simulado');
      salida.push(causas.length ? falla('5.d', causas.join('; '), { indiceAntes, avance }) : ok('5.d', { indiceAntes, avance }));
    }
  }
  return salida;
}

async function p6Agente(s) {
  const p = s.page;
  await clic(p, '#portal-tabs [data-portal-tab="ayuda"]').catch(() => false);
  if (await p.locator('#mp-agente:not([open]) > summary').isVisible()) await p.locator('#mp-agente > summary').click();
  const caja = await esperarVisible(p, '#agente-portal [data-agente-parte="entrada"]', null, 8000);
  if (!caja.length) return [pend('6.a', 'D', 'falta #agente-portal (el agente del portal)')];
  const salida = [];
  const chat = await p.locator('#agente-portal [data-agente-modo="incrustado"]').elementHandle();
  await clic(p, '#portal-tabs [data-portal-tab="pedido"]');
  await clic(p, '#portal-tabs [data-portal-tab="ayuda"]');
  const mismoChat = await chat?.evaluate(el => el === document.querySelector('#agente-portal [data-agente-modo="incrustado"]'));
  salida.push(mismoChat ? ok('6.f', {}) : falla('6.f', 'cambiar de pestaña reinicia la instancia del chat'));
  const preguntar = async (texto) => {
    const campo = p.locator('#agente-portal #agente-entrada').first();
    if (!(await campo.isVisible().catch(() => false))) return { error: 'sin #agente-entrada dentro de #agente-portal' };
    const antes = await p.evaluate(() => document.querySelectorAll('#agente-portal [data-agente-mensaje]').length);
    await campo.fill(texto);
    const enviar = p.locator('#agente-portal #agente-enviar').first();
    if (await enviar.isVisible().catch(() => false)) await enviar.click(); else await campo.press('Enter');
    const recoger = () => p.evaluate(([n, pregunta]) => {
      const F = window.__F;
      const nuevos = [...document.querySelectorAll('#agente-portal [data-agente-mensaje]')].slice(n).filter(m => m.dataset.rol !== 'comprador')
        .map((m) => (m.innerText || '').trim())
        .filter((t) => t && F.norm(t) !== F.norm(pregunta));
      const escribiendo = /escribiendo/.test(F.norm(document.querySelector('#agente-portal')?.innerText || ''));
      return { texto: nuevos.join(' | '), escribiendo };
    }, [antes, texto]);
    const limite = Date.now() + 9000;
    let info = { texto: '', escribiendo: false };
    do {
      await sleep(250);
      info = await recoger();
      if (info.texto && !info.escribiendo) break;
    } while (Date.now() < limite);
    // Un segundo mensaje del agente (por ejemplo, la petición de datos) llega después: se espera y se vuelve a leer.
    await sleep(1200);
    info = await recoger();
    return { respuesta: info.texto };
  };
  const simples = [
    ['¿Dónde viene mi pedido?', /pedido|etapa|llega|camino|entrega|preparacion/],
    ['¿Qué incluye el comodato?', /comodato|incluye|maquina|prestamo/],
    ['¿Cómo firmo el contrato?', /firm|contrato/],
    ['¿Cómo repito mi pedido?', /repet|pedido/],
    ['¿Puedo cambiar el horario de entrega?', /horario|entrega/],
  ];
  const malas = [];
  const datos = [];
  for (const [pregunta, patron] of simples) {
    const r = await preguntar(pregunta);
    if (r.error) return [pend('6.a', 'D', r.error)];
    const bien = patron.test(norm(r.respuesta));
    datos.push({ pregunta, respuesta: r.respuesta.slice(0, 160), bien });
    if (!bien) malas.push(`«${pregunta}» → ${r.respuesta ? `«${r.respuesta.slice(0, 80)}»` : 'sin respuesta'}`);
  }
  salida.push(malas.length ? falla('6.a', malas.join(' · '), datos) : ok('6.a', datos));

  const falla1 = await preguntar('La máquina tiene una falla');
  const textoFalla = norm(falla1.respuesta);
  const deriva = /te paso con una persona de soporte/.test(textoFalla);
  const pideDatos = /foto|horario|direccion/.test(textoFalla);
  const botonDeriva = await esperarVisible(p, '#agente-portal [data-agente-accion="derivar-persona"]', null, 1500);
  const causas6b = [];
  if (!deriva) causas6b.push('no dice «Te paso con una persona de Soporte»');
  if (!/sigo contigo/.test(textoFalla)) causas6b.push('no dice que sigue atendiendo («sigo contigo»)');
  if (!pideDatos) causas6b.push('no pide foto, horario o dirección');
  if (botonDeriva.length) await p.locator('#agente-portal [data-agente-accion="derivar-persona"]').nth(botonDeriva[0].i).click().catch(() => {});
  const enEspera = await esperarVisible(p, '#agente-portal [data-agente-estado="esperando-persona"]', null, 4000);
  if (!enEspera.length) causas6b.push('no queda en «esperando-persona»');
  salida.push(causas6b.length ? falla('6.b', causas6b.join('; '), { respuesta: falla1.respuesta.slice(0, 200) }) : ok('6.b', { respuesta: falla1.respuesta.slice(0, 160) }));

  const sigue = await preguntar('¿Cómo repito mi pedido?');
  salida.push(sigue.respuesta ? ok('6.c', { respuesta: sigue.respuesta.slice(0, 120) }) : falla('6.c', 'mientras llega la persona el agente deja de responder'));

  salida.push(...await p6Crm(s));
  await irRuta(s, 'C09');
  await clic(p, '#portal-tabs [data-portal-tab="ayuda"]').catch(() => false);
  if (await p.locator('#mp-agente:not([open]) > summary').isVisible()) await p.locator('#mp-agente > summary').click();
  const unida = await esperarVisible(p, '#agente-portal [data-agente-estado="persona-unida"]', null, 6000);
  if (!unida.length) {
    salida.push(falla('6.d', 'después de tomar la conversación, el portal no indica que se unió la persona'));
  } else {
    const resumen = await p.evaluate(() => window.__F.norm(document.querySelector('#agente-portal')?.innerText || ''));
    salida.push(/falla|maquina|resumen|foto/.test(resumen) ? ok('6.d', { resumen: resumen.slice(0, 160) }) : falla('6.d', 'la persona se une, pero el cliente no ve el resumen de lo que ya contó'));
  }
  return salida;
}

async function p6Crm(s) {
  const p = s.page;
  if (!(await entrarCRM(s, 'ventas'))) return [pend('6.e', 'D', 'no aparece el ingreso de Ventas en R00')];
  await irRuta(s, 'R01');
  await clic(p, '#crm-agente-chat .crm-agente-lanzador[aria-expanded="false"]').catch(() => false);
  const espera = await esperarVisible(p, '[data-crm-espera]', null, 6000);
  if (!espera.length) return [pend('6.e', 'D', 'en Ventas no aparece la conversación en espera ([data-crm-espera])')];
  const resumen = await p.evaluate(() => window.__F.norm(document.querySelector('[data-crm-espera]')?.innerText || ''));
  const caso = p.locator('[data-crm-espera-id]').filter({ hasText: /falla|máquina/i }).first();
  const id = await caso.getAttribute('data-crm-espera-id', { timeout: 5000 });
  await caso.locator('[data-crm-agente-accion="tomar-conversacion"]').click();
  const cambio = await p.waitForFunction(id => window.MarleyAgente.estado.get().traspasos.some(t => t.id === id && t.estado === 'tomada' && t.tomadoPor), id, { timeout: 5000 }).then(() => true).catch(() => false);
  const causas = [];
  if (!/falla|maquina/.test(resumen)) causas.push('la conversación en espera no muestra lo que juntó el agente');
  if (!cambio) causas.push('al tomar la conversación no cambia su estado');
  return causas.length ? [falla('6.e', causas.join('; '), { resumen: resumen.slice(0, 160) })] : [ok('6.e', { resumen: resumen.slice(0, 160) })];
}

async function entrarCRM(s, rol) {
  const p = s.page;
  await p.evaluate(() => window.M4.setRole(null)).catch(() => {});
  await irRuta(s, 'R00');
  const boton = await esperarVisible(p, `[data-c2="choose-role"][data-role="${rol}"]`, null, 8000);
  if (!boton.length) return false;
  await p.locator(`[data-c2="choose-role"][data-role="${rol}"]`).nth(boton[0].i).click();
  await sleep(400);
  return true;
}

async function p7Crm(s) {
  const p = s.page;
  const salida = [];
  if (!(await entrarCRM(s, 'ventas'))) return [falla('7.a', 'no se pudo entrar como Ventas')];
  const leadId = await p.evaluate(() => window.M4.get().lead?.id);
  if (!leadId) return [falla('7.a', 'la compra de prueba no creó un contacto')];
  await irRuta(s, 'R02');
  const fila = p.locator('[data-c2="open-lead"]').filter({ hasText: s.nombreLead || 'Salto Ficticio' }).first();
  await fila.click({ timeout: 7000 });
  const accion = await esperarVisible(p, '[data-crm-agente-tarea="correo"][data-cuenta-id]', null, 6000);
  if (!accion.length) return [pend('7.a', 'D', 'no hay botones de acción del agente en Ventas ([data-crm-agente-tarea="correo"])')];
  await p.locator('[data-crm-agente-tarea="correo"][data-cuenta-id]').nth(accion[0].i).click({ timeout: 5000 });
  const chat = await esperarVisible(p, '#crm-agente-chat', null, 5000);
  if (!chat.length) return [falla('7.a', 'al pulsar «Correo» no se abre el agente (#crm-agente-chat)')];
  const borrador = p.locator('#crm-agente-chat textarea[data-crm-agente-texto]').last();
  await borrador.waitFor({ state: 'visible', timeout: 6000 });
  let texto = await borrador.inputValue();
  const canalCorreo = /correo/.test(norm(await p.evaluate(() => document.querySelector('#crm-agente-chat')?.innerText || '')));
  salida.push(texto.length >= 60 && canalCorreo ? ok('7.a', { largo: texto.length, muestra: texto.slice(0, 120) }) : falla('7.a', `el borrador no aparece con su canal (largo ${texto.length})`));
  const antes = texto;
  if (await clic(p, '[data-crm-agente-ajuste="corto"]').catch(() => false)) {
    await sleep(900);
    texto = await borrador.inputValue();
    salida.push(texto && texto.length < antes.length ? ok('7.b', { antes: antes.length, despues: texto.length }) : falla('7.b', `«Más corto» no acorta el borrador (${antes.length} → ${texto.length})`));
  } else {
    salida.push(pend('7.b', 'D', 'falta el ajuste «corto» ([data-crm-agente-ajuste="corto"])'));
  }
  const entrada = p.locator('#crm-agente-chat-entrada');
  await entrada.fill('Envíalo');
  await entrada.press('Enter');
  const aviso = await esperarVisible(p, '[data-crm-aviso]', 'correo enviado a', 6000);
  salida.push(aviso.length ? ok('7.c', { aviso: aviso[0].texto.slice(0, 100) }) : falla('7.c', 'después de «envíalo» no aparece el aviso «Correo enviado a …»'));
  const linea = await p.evaluate(([id, exacto]) => {
    const log = window.MarleyAgente?.estado?.get()?.conversaciones?.[id] || [];
    return log.some(m => m.canal === 'correo' && m.envio && m.aprobadoPor && m.texto === exacto);
  }, [leadId, texto]);
  salida.push(linea ? ok('7.d', { registrado: true }) : falla('7.d', 'el historial del contacto no contiene el correo aprobado'));
  // Llegada al portal del cliente (simulado).
  const muestra = norm(texto).slice(0, 24);
  await p.evaluate(() => window.M4.setRole(null)).catch(() => {});
  await irRuta(s, 'C09');
  await clic(p, '#portal-tabs [data-portal-tab="ayuda"]').catch(() => false);
  if (await p.locator('#mp-agente:not([open]) > summary').isVisible()) await p.locator('#mp-agente > summary').click();
  const llego = await esperarVisible(p, '#agente-portal [data-agente-mensaje]', muestra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 6000);
  salida.push(llego.length ? ok('7.e', { muestra }) : falla('7.e', 'el mensaje aprobado no aparece en la conversación del comprador'));
  // Aviso al compañero: una tarea «avisar» aparece en el Hoy.
  if (!(await entrarCRM(s, 'ventas'))) return [...salida, falla('7.f', 'no se pudo volver a Ventas para avisar a Marketing')];
  await irRuta(s, 'R02');
  await fila.click({ timeout: 7000 });
  await clic(p, '#crm-agente-chat .crm-agente-lanzador[aria-expanded="false"]').catch(() => false);
  await entrada.fill(`Avísale a Marketing que revise la propuesta de ${s.nombreLead || 'Salto Ficticio'}`);
  await entrada.press('Enter');
  const enviarAviso = p.locator('[data-crm-agente-borrador][data-tipo="avisar"] [data-crm-agente-accion="enviar"]:enabled').last();
  const preparado = await enviarAviso.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
  if (!preparado) return [...salida, falla('7.f', 'El agente no preparó el aviso al compañero a partir del nombre del contacto')];
  await enviarAviso.click({ timeout: 6000 });
  const avisoInterno = await esperarVisible(p, '[data-crm-aviso]', 'aviso enviado a marketing', 6000);
  await entrarCRM(s, 'marketing');
  const notif = await esperarVisible(p, '[data-crm-notificacion][data-tipo="aviso"]', 'revise la propuesta', 6000);
  salida.push(avisoInterno.length && notif.length ? ok('7.f', { notificaciones: notif.length }) : falla('7.f', 'Marketing no recibió en «Hoy» el aviso aprobado desde Ventas'));
  return salida;
}

// 3.d: verifica la regla que usa el CRM, incluidos los dos aportes y el motivo visible.
// 3.c: el puntaje que muestra la lista de R12 es el mismo que muestra la ficha del lead.
async function p3Crm(s) {
  const p = s.page;
  const salida = [];
  const puntos = await p.evaluate(() => {
    const { partes = {} } = window.R6P.interes(window.M4.get());
    return { completo: partes.diag_completo?.aporte, personalizado: partes.diag_personalizado?.aporte, motivo: partes.diag_personalizado?.porQue };
  });
  salida.push(puntos.completo === 10 && puntos.personalizado === 5 && /eligio la maquina directo/.test(norm(puntos.motivo || ''))
    ? ok('3.d', puntos)
    : falla('3.d', `puntaje o motivo del salto incorrecto: ${JSON.stringify(puntos)}`, puntos));
  if (!(await entrarCRM(s, 'marketing'))) return [...salida, pend('3.c', 'E', 'no aparece el ingreso de Marketing')];
  await irRuta(s, 'R12');
  if (!(await p.evaluate(() => Boolean(document.querySelector('#crm-v2-root'))))) return [...salida, pend('3.c', 'E', 'no carga la pantalla de leads (R12)')];
  const nombre = s.nombreLead || 'Salto Ficticio';
  const filas = await esperarVisible(p, '[data-c2="open-lead"]', norm(nombre), 6000);
  if (!filas.length) return [...salida, falla('3.c', `en R12 no aparece el lead «${nombre}» que saltó el cuestionario`)];
  const valorLista = (filas[0].texto.match(/valor (\d+)\/100/) || [])[1] ?? null;
  const interesLista = (filas[0].texto.match(/interes (\d+)\/100/) || [])[1] ?? null;
  await p.locator('[data-c2="open-lead"]').nth(filas[0].i).click({ timeout: 5000 });
  await sleep(700);
  const ficha = await p.evaluate(() => window.__F.norm(document.body.innerText));
  const valorFicha = (ficha.match(/valor esperado[^\d]{0,12}(\d+)\/100/) || [])[1] ?? null;
  const interesFicha = (ficha.match(/interes[^\d]{0,20}(\d+)\/100/) || [])[1] ?? null;
  const causas = [];
  if (valorLista === null) causas.push('la lista no muestra «Valor N/100»');
  if (valorFicha === null) causas.push('la ficha no muestra «Valor esperado · N/100»');
  if (valorLista !== null && valorFicha !== null && valorLista !== valorFicha) causas.push(`la lista muestra ${valorLista} y la ficha ${valorFicha}`);
  if (interesLista !== null && interesFicha !== null && interesLista !== interesFicha) causas.push(`interés: lista ${interesLista}, ficha ${interesFicha}`);
  salida.push(causas.length
    ? falla('3.c', causas.join('; '), { valorLista, valorFicha, interesLista, interesFicha })
    : ok('3.c', { valor: valorLista, interes: interesLista }));
  return salida;
}

// Avanza una pantalla de la prueba autoguiada: elige la primera opción sin respuesta, acepta el consentimiento y sigue.
// No pulsa «Empezar de cero» (reinicia la prueba).
async function avanzarPrueba(p) {
  await p.evaluate(() => {
    const F = window.__F;
    document.querySelectorAll('select').forEach((x) => { if (F.vis(x) && x.selectedIndex <= 0 && x.options.length > 1) { x.selectedIndex = 1; x.dispatchEvent(new Event('change', { bubbles: true })); } });
    const grupos = {};
    document.querySelectorAll('input[type="radio"]').forEach((r) => { if (F.vis(r)) (grupos[r.name] ||= []).push(r); });
    Object.values(grupos).forEach((lista) => { if (!lista.some((r) => r.checked)) (lista[0].closest('label') || lista[0]).click(); });
    document.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      const etiqueta = F.norm(c.closest('label')?.innerText || c.name || c.id);
      if (F.vis(c) && !c.checked && /consent|acept|autoriz|entiendo/.test(etiqueta)) (c.closest('label') || c).click();
    });
    document.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((t) => { if (F.vis(t) && !t.value) { t.value = 'Prueba ficticia'; t.dispatchEvent(new Event('input', { bubbles: true })); } });
  }).catch(() => {});
  await clic(p, 'button', '^(?!.*cero)(?:empezar|continuar|siguiente|responder preguntas|comenzar|iniciar|guardar|listo|seguir|confirmar|ir al recorrido|acepto)(?![a-z])').catch(() => false);
  await sleep(400);
}

// Pantallas de la prueba: las medidas se hacen con la prueba abierta en su camino A.
async function p8Prueba(c) {
  const s = await crearSesion(c, { etiqueta: 'prueba-autoguiada' });
  const salida = [];
  try {
    const p = s.page;
    await p.goto(new URL('prueba.html', s.base).toString(), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => Boolean(window.__F), null, { timeout: 10000 }).catch(() => {});
    // Bienvenida, consentimiento y, después, el paso «¿Qué quieres probar?».
    for (let k = 0; k < 8 && !(await esperarVisible(p, '[data-path="A"]', null, 200)).length; k += 1) await avanzarPrueba(p);
    if (!(await clic(p, '[data-path="A"]').catch(() => false))) return [pend('8.a', 'A', 'no llego al paso «¿Qué quieres probar?» (no encuentro [data-path="A"])')];
    // Preguntas iniciales hasta la franja de tarea.
    let llego = false;
    for (let k = 0; k < 14 && !llego; k += 1) {
      llego = (await esperarVisible(p, '#ag-pill', null, 300)).length > 0;
      if (!llego) await avanzarPrueba(p);
    }
    if (!llego) return [pend('8.a', 'A', 'no llego a la franja de tarea (#ag-pill) desde el camino A')];
    salida.push((await esperarVisible(p, '#ag-eval', null, 300)).length ? falla('8.a', 'hay un cuestionario abierto antes de que la persona pulse el CTA de la tarea') : ok('8.a', { franja: true }));

    const handle = await p.waitForSelector('iframe.ag-journey-frame, iframe[title*="Recorrido"]', { timeout: 12000 }).catch(() => null);
    if (!handle) return [...salida, pend('8.b', 'A', 'el recorrido no aparece en el marco (iframe.ag-journey-frame)')];
    const frame = await handle.contentFrame();
    // Este caso prueba el cierre de tarea dentro del marco. La entrada por búsqueda se verifica en su propio recorrido.
    await frame.goto(new URL('index.html?test=sitio#C02', s.base).href, { waitUntil: 'load', timeout: 25000 });
    await frame.waitForFunction(() => window.MarleyApp && document.body.dataset.current === 'C02', null, { timeout: 12000 });
    await frame.evaluate(() => document.fonts.ready);
    const enCurso = await p.evaluate(() => { const e = JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1') || 'null'); return e?.tareas?.[e.taskIndex]?.etapa || null; });
    const etapa = enCurso || 'T1';
    const cta = await esperarVisible(frame, `[data-cierra-tarea="${etapa}"]`, null, 10000);
    if (!cta.length) return [...salida, pend('8.b', 'A y B1', `el marco de la prueba está en #${(frame.url().split('#')[1] || '').split('?')[0] || '(sin ruta)'} y ahí no aparece el CTA que cierra la tarea «${etapa}» (data-cierra-tarea="${etapa}"); el CTA T1 está en C02 y el camino A entra por C01: falta decidir cuál es la entrada`)];
    const urlAntes = frame.url();
    const cierre = frame.locator(`[data-cierra-tarea="${etapa}"]`).nth(cta[0].i);
    await cierre.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await cierre.click({ timeout: 12000 });
    const abre = await esperarVisible(p, '#ag-eval', null, 5000);
    if (!abre.length) {
      if (process.env.DEPURAR_8B) {
        const estado = await p.evaluate(() => { const e = JSON.parse(localStorage.getItem('mc_prueba_autoguiada_v1') || 'null'); return { fase: e?.phase, evaluando: e?.evaluating, indice: e?.taskIndex, etapa: e?.tareas?.[e?.taskIndex]?.etapa, ag: Boolean(document.querySelector('#ag-eval')), agVisible: Boolean(document.querySelector('#ag-eval')?.getBoundingClientRect().width) }; }).catch((x) => String(x.message));
        process.stderr.write(`[8b-estado] ${JSON.stringify(estado)} url=${frame.url().slice(0, 120)}\n`);
      }
      salida.push(falla('8.b', 'al pulsar el CTA de cierre no se abre el cuestionario (#ag-eval)'));
      return salida;
    }
    salida.push(ok('8.b', { cuestionario: true }));
    await sleep(500);
    const urlAbierta = frame.url();
    await p.keyboard.press('Escape');
    await sleep(500);
    const sigue = (await esperarVisible(p, '#ag-eval', null, 300)).length > 0;
    salida.push(sigue && urlAbierta === urlAntes ? ok('8.c', { sigueAbierto: true }) : falla('8.c', sigue ? 'el sitio avanzó antes de guardar' : 'Escape cierra el cuestionario sin guardar'));

    const medida = await p.evaluate(() => {
      const el = document.querySelector('#ag-eval');
      const r = el ? el.getBoundingClientRect() : null;
      return { scrollW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, vw: innerWidth, vh: innerHeight, izq: r ? Math.round(r.left) : null, der: r ? Math.round(r.right) : null, ancho: r ? Math.round(r.width) : 0, alto: r ? Math.round(r.height) : 0 };
    });
    const causas8f = [];
    if (medida.scrollW > medida.cw) causas8f.push(`desborde lateral (${medida.scrollW} px en ${medida.cw})`);
    if (medida.izq < 0 || medida.der > medida.vw) causas8f.push('el cuestionario se sale de la pantalla');
    if (medida.vw < 768 && (medida.ancho < 0.9 * medida.vw || medida.alto < 0.85 * medida.vh)) causas8f.push(`en celular no ocupa la pantalla completa (${medida.ancho}×${medida.alto})`);
    salida.push(causas8f.length ? falla('8.f', causas8f.join('; '), medida) : ok('8.f', medida));

    await responderYGuardar(p, 'Logrado');
    const cerro = await esperarOculto(p, '#ag-eval', 6000);
    await sleep(800);
    const urlDespues = frame.url();
    salida.push(cerro && urlDespues !== urlAbierta ? ok('8.d', { de: urlAbierta.split('#')[1] || '', a: urlDespues.split('#')[1] || '' }) : falla('8.d', cerro ? 'al guardar la prueba no avanza a la pantalla pedida' : 'al guardar, el cuestionario sigue abierto'));

    const noEncuentro = await esperarVisible(p, '[data-action="no-encuentro"]', null, 4000);
    if (!noEncuentro.length) salida.push(pend('8.e', 'A', 'falta la opción «No lo logré» en la franja ([data-action="no-encuentro"])'));
    else {
      await p.locator('[data-action="no-encuentro"]').nth(noEncuentro[0].i).click({ timeout: 5000 });
      const abre2 = await esperarVisible(p, '#ag-eval', null, 4000);
      const marcada = await p.evaluate(() => Boolean(document.querySelector('#task-evaluation input[name="task-result"][value="No logrado"]')?.checked));
      salida.push(abre2.length && marcada ? ok('8.e', { marcada: true }) : falla('8.e', abre2.length ? '«No lo logré» abre el cuestionario sin marcar esa opción' : '«No lo logré» no abre el cuestionario'));
      await responderYGuardar(p, 'No logrado');
    }
  } finally {
    await cerrarSesion(s);
  }
  return salida;
}

async function responderYGuardar(p, resultado) {
  await p.evaluate((valor) => {
    const f = document.querySelector('#task-evaluation') || document.querySelector('#ag-eval form');
    if (!f) return;
    const marcar = (r) => { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
    const elegida = f.querySelector(`input[name="task-result"][value="${valor}"]`);
    if (elegida) marcar(elegida);
    const grupos = {};
    f.querySelectorAll('input[type="radio"]').forEach((x) => { (grupos[x.name] ||= []).push(x); });
    Object.values(grupos).forEach((lista) => { if (!lista.some((x) => x.checked)) marcar(lista[0]); });
    f.querySelectorAll('textarea').forEach((t) => { if (!t.value) t.value = 'Prueba ficticia.'; });
  }, resultado);
  // Guardar: el botón del cuestionario es #task-save («Guardar y seguir»).
  if (await p.locator('#task-save').count()) await p.locator('#task-save').click({ timeout: 5000 }).catch(() => {});
  else await clic(p, '#ag-eval button', '^(?:guardar|listo|enviar|continuar|siguiente)').catch(() => false);
}

// Medidas de aire en la página visible. Devuelve números y ejemplos, sin juzgar.
const medirAire = (p, pantalla) => p.evaluate((nombre) => {
  const F = window.__F;
  const vw = document.documentElement.clientWidth;
  const movil = vw < 768;
  const margenMin = movil ? 20 : 32;
  const fijo = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const pos = getComputedStyle(e).position; if (pos === 'fixed' || pos === 'sticky') return true; } return false; };
  const visibles = [...document.querySelectorAll('body *')].filter((el) => F.vis(el) && !fijo(el));
  const textoPropio = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  const rectTexto = n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
  const marcoVisible = (el, r) => {
    let left = r.left, right = r.right;
    for (let nodo = el.parentElement; nodo && nodo !== document.body; nodo = nodo.parentElement) {
      if (!/^(auto|scroll|clip|hidden)$/.test(getComputedStyle(nodo).overflowX)) continue;
      const marco = nodo.getBoundingClientRect();
      left = Math.max(left, marco.left + nodo.clientLeft);
      right = Math.min(right, marco.left + nodo.clientLeft + nodo.clientWidth);
    }
    return right > left ? { left, right } : null;
  };
  let margenMinimo = Infinity;
  let peorMargen = '';
  let margenMal = 0;
  for (const el of visibles.filter(el => !el.closest('svg'))) {
    for (const n of textoPropio(el)) {
      const visible = marcoVisible(el, rectTexto(n));
      if (!visible) continue;
      const m = Math.min(visible.left, vw - visible.right);
      if (m < margenMinimo) { margenMinimo = m; peorMargen = `${F.norm(n.textContent).slice(0, 40)} (${el.tagName.toLowerCase()}${el.classList.length ? `.${el.classList[0]}` : ''})`; }
      if (m < margenMin - 0.5) margenMal += 1;
    }
  }
  // Titular y bajada pertenecen a la misma unidad. Aquí medimos paneles, secciones y grupos de acción.
  const bloques = 'section,article,form,fieldset,details,#pack-resumen,.cmp-maquina,.cmp-cierre,.r5-single-question,.cmp-salida,.mp-cabecera,.mp-accion,.mp-cierre';
  const huecos = [];
  const padres = new Set(visibles.map((el) => el.parentElement).filter(Boolean));
  for (const padre of padres) {
    if (fijo(padre)) continue;
    const hijos = [...padre.children].filter(h => h.matches(bloques) && F.vis(h) && !fijo(h));
    hijos.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    for (let i = 0; i < hijos.length - 1; i += 1) {
      const a = hijos[i].getBoundingClientRect();
      const b = hijos[i + 1].getBoundingClientRect();
      const solapa = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 * Math.min(a.width, b.width);
      if (!solapa || b.top < a.bottom - 1) continue;
      const hueco = b.top - a.bottom;
      const seccion = padre.matches('main,.mp-panel') && (hijos[i].tagName === 'SECTION' || hijos[i + 1].tagName === 'SECTION');
      if (hueco < (seccion ? 40 : 24)) {
        const selector = el => `${el.tagName.toLowerCase()}${el.classList.length ? `.${el.classList[0]}` : ''}`;
        huecos.push({ tipo: seccion ? 'seccion' : 'bloque', px: Math.round(hueco), antes: selector(hijos[i]), despues: selector(hijos[i + 1]), texto: F.norm(hijos[i].innerText || hijos[i].tagName).slice(0, 40) });
      }
    }
  }
  const relleno = [];
  for (const el of visibles) {
    const st = getComputedStyle(el);
    const conBorde = parseFloat(st.borderTopWidth) > 0 || parseFloat(st.borderLeftWidth) > 0;
    const conFondo = st.backgroundColor && st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent';
    const textos = textoPropio(el);
    if (!(conBorde || conFondo) || !textos.length || st.display === 'inline' || el.closest('[aria-hidden="true"]')) continue;
    const control = el.closest('button,a,summary,[role="button"]');
    if (control && control !== el) continue;
    const clase = typeof el.className === 'string' ? el.className : '';
    const chip = el.tagName === 'BUTTON' || el.tagName === 'A' || el.matches('.r3-step-guide li > span,.m5-sug') || /chip|btn|pill|tag|badge|boton/.test(clase);
    const minimo = chip ? 8 : 12;
    const caja = el.getBoundingClientRect();
    const inset = Math.min(...textos.map(n => {
      const r = rectTexto(n);
      return Math.min(r.top - caja.top, caja.bottom - r.bottom, r.left - caja.left, caja.right - r.right);
    }));
    const padding = Math.min(...['Top', 'Right', 'Bottom', 'Left'].map(lado => parseFloat(st[`padding${lado}`])));
    const pad = Math.max(inset, padding);
    if (pad < minimo - 0.5) relleno.push({ px: Math.round(pad), minimo, tag: el.tagName, clase, texto: F.norm(el.innerText || '').slice(0, 40) });
  }
  return {
    pantalla: nombre,
    vw,
    scrollW: document.documentElement.scrollWidth,
    margenMin,
    margenMinimo: Number.isFinite(margenMinimo) ? Math.round(margenMinimo) : null,
    peorMargen,
    margenMal,
    huecos: huecos.slice(0, 8),
    huecosTotal: huecos.length,
    relleno: relleno.slice(0, 8),
    rellenoTotal: relleno.length,
    aireCargado: Boolean(document.querySelector('link[href*="recursos/vida/aire.css"]')),
  };
}, pantalla).catch((e) => ({ pantalla, error: e.message }));

// Saludo visible de la pantalla (el del agente o el encabezado): es lo que cambia por tipo de comprador.
const leerSaludo = (p) => p.evaluate(() => {
  const F = window.__F;
  const el = [...document.querySelectorAll('[data-saludo], [data-agente-mensaje], h1')].find((x) => F.vis(x));
  return el ? el.innerText.trim().slice(0, 200) : '';
}).catch(() => '');

// Recorrido de compra. Cada paso llama a su gancho (hooks) y devuelve el paso en que se detuvo, si no pudo seguir.
async function recorrer(s, tipo, { hasta = 'portal', hooks = {} } = {}) {
  const p = s.page;
  const pasos = [];
  const res = { pasos };
  const parar = (dueno, causa, id, tipoParada = 'pendiente') => { res.parada = { dueno, causa, id, tipo: tipoParada }; return res; };
  const paso = async (nombre) => {
    pasos.push({ paso: nombre, ruta: await rutaActual(p) });
    if (hooks[nombre]) await hooks[nombre](s);
  };
  try {
    await irA(s, 'C02');
    await paso('home');
    if (hasta === 'home') return res;
    if (!(await clic(p, '[data-cierra-tarea="T1"]').catch(() => false))) return parar('B1', 'no hay CTA T1 (data-cierra-tarea="T1") que lleve a «Cuéntanos de tu negocio» en C02', '2.a');
    if (!(await textoEspera(p, 'cuentanos de tu negocio', 6000))) return parar('B1', 'el CTA T1 no abre «Cuéntanos de tu negocio»', '2.a');
    await paso('formulario');
    if (!(await elegirTipo(p, tipo))) return parar('B1', `en «Cuéntanos de tu negocio» no encuentro la opción de tipo «${tipo.nombre}»`, '1.a');
    // «Cuéntanos de tu negocio» tiene varios pasos («Paso 1 de N»): cada uno se responde y se sigue hasta «Te ayudamos a elegir tu solución».
    let llegoMotor = false;
    for (let k = 0; k < 8 && !llegoMotor; k += 1) {
      if (await textoEspera(p, 'te ayudamos a elegir tu solucion', 300)) { llegoMotor = true; break; }
      if (!(await completarFormulario(p))) return parar('B1', 'en «Cuéntanos de tu negocio» no encuentro cómo seguir (botón continuar) en el paso ' + (k + 1), '1.a');
      await sleep(500);
    }
    if (!llegoMotor && !(await textoEspera(p, 'te ayudamos a elegir tu solucion', 4000))) return parar('B1', 'después del formulario no aparece «Te ayudamos a elegir tu solución»', '1.a');
    await paso('motor');
    if (!(await clic(p, '[data-solucion-accion="ya-se-maquina"]').catch(() => false))) return parar('B1', 'falta la salida «Ya sé qué máquina quiero» (data-solucion-accion="ya-se-maquina")', '3.b');
    const tarjetas = await esperarVisible(p, '[data-maquina-id]', null, 6000);
    if (!tarjetas.length) return parar('B1', 'al pulsar «Ya sé qué máquina quiero» no aparece el selector de máquinas ([data-maquina-id])', '3.a');
    await paso('maquinas');
    s.maquinaId = await p.evaluate((i) => document.querySelectorAll('[data-maquina-id]')[i]?.dataset.maquinaId || '', tarjetas[0].i);
    await clic(p, '[data-maquina-id]').catch(() => false);
    await paso('maquina');
    if (hasta === 'maquina') return res;
    const pack = await esperarVisible(p, '#pack-resumen', null, 10000);
    if (!pack.length) {
      const cuestionario = await esperarVisible(p, 'fieldset, [data-solucion-pregunta], [data-motor-pregunta]', null, 500);
      if (cuestionario.length) return parar('B1', 'al elegir la máquina sigue el cuestionario en vez de ir al pack', '3.b', 'falla');
      return parar('B1', 'al elegir la máquina no aparece el pack (#pack-resumen)', '4.a');
    }
    await paso('pack');
    if (hasta === 'pack') return res;
    if (!(await clic(p, '[data-pack-accion="aceptar"]').catch(() => false))) return parar('B1', 'falta «Aceptar mi pack» ([data-pack-accion="aceptar"])', '4.c');
    s.nombreLead = 'Salto Ficticio';
    await completarContacto(p, s.nombreLead);
    if (!(await esperarVisible(p, '#cross-sell', null, 6000)).length) return parar('B1', 'después de aceptar el pack no aparece la sugerencia (#cross-sell)', '4.d');
    await paso('cross');
    if (await p.locator('#mcm-toast').isVisible()) return parar('B1', 'el aviso flotante de correo invade la sugerencia del pack', '4.e', 'falla');
    try {
      if (!(await clic(p, '[data-cross="no-gracias"]'))) return parar('B1', 'falta «No, gracias» en la sugerencia ([data-cross="no-gracias"])', '4.e');
    } catch (error) {
      return parar('B1', `no se puede pulsar «No, gracias»: ${String(error.message).split('\n').slice(0, 5).join(' ').slice(0, 275)}`, '4.e', 'falla');
    }
    // La confirmación cambia de pantalla un momento después del clic: se espera antes de registrar la pantalla.
    await esperarVisible(p, '[data-cierra-tarea="T3"]', 'ir a mi portal', 4000);
    await paso('noGracias');
    if (!(await esperarVisible(p, '[data-cierra-tarea="T3"]', 'ir a mi portal', 6000)).length) return parar('B1', 'no aparece la confirmación con «Ir a mi portal» (data-cierra-tarea="T3")', '5.a');
    await paso('confirmacion');
    res.rutasConfirmacion = [];
    const anotarRuta = frame => {
      if (frame === p.mainFrame()) res.rutasConfirmacion.push(new URL(frame.url()).hash.slice(1).split('?')[0]);
    };
    p.on('framenavigated', anotarRuta);
    try {
      if (!(await clic(p, '[data-cierra-tarea="T3"]').catch(() => false))) return parar('B1', 'no puedo pulsar «Ir a mi portal»', '5.a', 'falla');
      if (!(await esperarVisible(p, '#portal-tabs', null, 8000)).length) return parar('B2', '«Ir a mi portal» no abre el portal (#portal-tabs)', '5.b');
    } finally {
      p.off('framenavigated', anotarRuta);
    }
    await paso('portal');
    return res;
  } catch (error) {
    return parar('B1', `el recorrido se cortó: ${String(error.message).split('\n')[0].slice(0, 200)}`, pasos.length ? '2.b' : '2.a', 'falla');
  }
}

async function elegirTipo(p, tipo) {
  const selectores = 'label, button, [role="radio"], [role="option"], [role="button"], [data-tipo], [data-negocio], [data-segmento], a, li';
  for (const patron of [`^(?:${tipo.patron})$`, `^(?:${tipo.patron})(?![a-z])`]) {
    const lista = await esperarVisible(p, selectores, patron, 2500);
    const hit = lista.find((x) => x.texto.length < 60);
    if (hit) {
      await p.locator(selectores).nth(hit.i).click({ timeout: 5000 });
      return true;
    }
  }
  return p.evaluate((patron) => {
    const F = window.__F;
    const re = new RegExp(`^(?:${patron})(?![a-z])`);
    for (const sel of document.querySelectorAll('select')) {
      if (!F.vis(sel)) continue;
      const idx = [...sel.options].findIndex((o) => re.test(F.norm(o.textContent)));
      if (idx >= 0) { sel.selectedIndex = idx; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    }
    return false;
  }, tipo.patron);
}

async function completarFormulario(p) {
  await p.evaluate(() => {
    const F = window.__F;
    const grupos = {};
    document.querySelectorAll('input[type="radio"]').forEach((r) => { if (F.vis(r) || F.vis(r.closest('label'))) (grupos[r.name] ||= []).push(r); });
    Object.values(grupos).forEach((lista) => {
      if (!lista.some((r) => r.checked)) (lista[1] || lista[0]).click();
    });
    // Respuestas en botones (data-a="answer"): si el paso no tiene ninguna marcada, se marca la primera.
    const respuestas = [...document.querySelectorAll('[data-a="answer"]')].filter((b) => F.vis(b));
    if (respuestas.length && !respuestas.some((b) => b.getAttribute('aria-pressed') === 'true')) respuestas[0].click();
    document.querySelectorAll('input[type="number"]').forEach((n) => {
      if (F.vis(n) && !n.value) { n.value = '12'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    document.querySelectorAll('input[type="text"], input:not([type])').forEach((t) => {
      const pista = F.norm(`${t.name} ${t.id} ${t.placeholder} ${t.getAttribute('aria-label') || ''}`);
      if (F.vis(t) && !t.value && /comuna/.test(pista)) { t.value = 'Providencia'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    document.querySelectorAll('select').forEach((x) => {
      if (F.vis(x) && x.selectedIndex <= 0 && x.options.length > 1) { x.selectedIndex = 1; x.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  return clic(p, 'button, [role="button"], a, input[type="submit"]', '^(?:continuar|siguiente|seguir|avanzar|ver mi|ver la|listo|enviar|guardar)(?![a-z])').catch(() => false);
}

// Captura de contacto de «Aceptar mi pack»: datos ficticios, consentimiento y envío del mismo formulario (no «Guardar y seguir después»).
async function completarContacto(p, nombre = 'Prueba ficticia') {
  const campos = await esperarVisible(p, 'input[type="email"]', null, 2500);
  if (!campos.length) return false;
  await p.evaluate((nombre) => {
    const F = window.__F;
    document.querySelectorAll('input').forEach((t) => {
      if (!F.vis(t) || t.value || ['checkbox', 'radio', 'hidden', 'number', 'file', 'submit', 'button'].includes(t.type)) return;
      const pista = F.norm(`${t.name} ${t.id} ${t.placeholder} ${t.autocomplete} ${t.getAttribute('aria-label') || ''}`);
      let valor = nombre;
      if (t.type === 'email' || /correo|mail/.test(pista)) valor = 'prueba.ficticia@example.com';
      else if (t.type === 'tel' || /telefono|fono|celular|whatsapp/.test(pista)) valor = '+56 9 0000 0000';
      else if (/empresa|negocio/.test(pista)) valor = 'Negocio ficticio';
      t.value = valor;
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Consentimiento para contactar (dato ficticio de la prueba): solo la casilla de consentimiento de esta captura.
    document.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      if (F.vis(c) && !c.checked && /consent/.test(F.norm(`${c.name} ${c.id}`))) c.click();
    });
  }, nombre);
  return p.evaluate(() => {
    const F = window.__F;
    const correo = [...document.querySelectorAll('input[type="email"]')].find((e) => F.vis(e));
    const bloque = correo?.closest('form') || correo?.closest('[role="dialog"], dialog') || correo?.parentElement?.parentElement;
    if (!bloque) return false;
    const botones = [...bloque.querySelectorAll('button, input[type="submit"]')].filter((b) => F.vis(b) && !b.disabled);
    const texto = (b) => F.norm(b.innerText || b.value || '');
    const envio = botones.find((b) => b.type === 'submit' && !/despues|cambiar|volver/.test(texto(b)))
      || botones.find((b) => /aceptar mi pack|confirmar|enviar|continuar|guardar/.test(texto(b)) && !/despues/.test(texto(b)));
    if (!envio) return false;
    envio.click();
    return true;
  });
}

async function barridoClics(p, s, texto) {
  const selector = 'a[href],button,summary,[role="button"],[data-go],[data-cierra-tarea],[data-portal-tab],[data-cta-principal]';
  const visiblesAhora = () => p.evaluate(sel => {
    const F = window.__F;
    return [...document.querySelectorAll(sel)].map((el, i) => ({ i, el }))
      .filter(({ el }) => F.vis(el) && !el.disabled && !el.closest('header, footer, nav')
        && !(el.tagName === 'A' && (el.target === '_blank' || /^(mailto:|tel:|javascript:)/i.test(el.getAttribute('href') || '') || (/^https?:/i.test(el.getAttribute('href') || '') && !(el.getAttribute('href') || '').includes(location.host)))))
      .filter(({ el }) => !/reiniciar|borrar|eliminar|cerrar sesion|salir|reset/.test(F.norm(el.innerText || el.getAttribute('aria-label') || '')))
      .map(({ i, el }) => ({ i, nombre: F.norm(el.innerText || el.getAttribute('aria-label') || el.getAttribute('href') || '').slice(0, 50), key: el.dataset.evt || el.getAttribute('href') || el.dataset.a || '' }));
  }, selector);
  const controles = await visiblesAhora();
  const sinRespuesta = [];
  const muestra = controles.slice(0, texto.max);
  for (const item of muestra) {
    if (texto.recarga) {
      await irA(s, texto.ruta);
      if (texto.ruta === 'C02') {
        await p.waitForFunction(() => Boolean(document.querySelector('.cmp-home-maquina')));
        await p.evaluate(() => window.dispatchEvent(new Event('keydown')));
        await p.waitForFunction(() => Boolean(document.querySelector('.cmp-home-maquina img[role="button"]')));
      }
    }
    const equivalentes = (control) => control.nombre === item.nombre && control.key === item.key;
    const ordinal = controles.filter(control => control.i < item.i && equivalentes(control)).length;
    const candidato = (await visiblesAhora()).filter(equivalentes)[ordinal];
    if (!candidato) { sinRespuesta.push(`${item.nombre} (desaparece al recargar)`); continue; }
    const control = p.locator(selector).nth(candidato.i);
    await control.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.evaluate(() => {
      if (!window.__mutObs) {
        window.__mut = 0;
        window.__mutObs = new MutationObserver(() => { window.__mut += 1; });
        window.__mutObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      }
    });
    const antes = await p.evaluate(() => ({ hash: location.hash, mut: window.__mut || 0, scroll: scrollY }));
    const popAntes = s.popups.length;
    let error = '';
    await control.click({ timeout: 5000 }).catch((e) => { error = e.message.split('\n').find(line => /intercepts pointer events|not stable|not visible/.test(line))?.trim() || e.message.split('\n')[0]; });
    await sleep(500);
    const despues = await p.evaluate(() => ({ hash: location.hash, mut: window.__mut || 0, scroll: scrollY })).catch(() => ({ hash: '', mut: 0, scroll: 0 }));
    const respondio = !error && (despues.hash !== antes.hash || despues.mut > antes.mut || Math.abs(despues.scroll - antes.scroll) > 2 || s.popups.length > popAntes);
    if (!respondio) {
      const tapado = /intercepts pointer events|another element/i.test(error);
      sinRespuesta.push(`${item.nombre || `control ${item.i}`}${tapado ? ' (tapado por otro elemento)' : error ? ` (${error.slice(0, 60)})` : ''}`);
    }
  }
  return { total: controles.length, probados: muestra.length, sinRespuesta };
}

async function movimiento(c) {
  const salida = [];
  const a = await crearSesion(c, { reducido: true, etiqueta: 'reducir-movimiento' });
  let reducido = null;
  try {
    await irA(a, 'C02');
    await a.page.evaluate(() => document.fonts.ready);
    await a.page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'), null, { timeout: 10000 }).catch(() => {});
    reducido = await a.page.evaluate(() => {
      const F = window.__F;
      const corriendo = document.getAnimations().filter((x) => x.playState === 'running');
      const infinitas = corriendo.filter((x) => x.effect?.getComputedTiming?.().iterations === Infinity);
      const vida = [...document.querySelectorAll('[data-vida]')];
      const opacos = vida.filter((el) => getComputedStyle(el).opacity !== '1' || !F.vis(el)).length;
      const visibles = [...document.querySelectorAll('[data-vida], [data-zoom], button, a[href]')].filter(F.vis).slice(0, 80);
      const medidas = visibles.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)]; });
      const textos = visibles.map((el) => F.norm(el.innerText || el.getAttribute('aria-label') || '').slice(0, 40));
      return { corriendo: corriendo.length, infinitas: infinitas.length, vida: vida.length, opacos, medidas, textos };
    });
  } finally { await cerrarSesion(a); }
  if (!reducido.vida) salida.push(pend('10.a', 'C', 'C02 no tiene elementos data-vida todavía'));
  else if (reducido.corriendo || reducido.infinitas) salida.push(falla('10.a', `con reducir movimiento siguen ${reducido.corriendo} animación(es) (${reducido.infinitas} en bucle)`, reducido));
  else salida.push(ok('10.a', { vida: reducido.vida }));
  if (reducido.vida) {
    if (reducido.opacos) salida.push(falla('10.b', `${reducido.opacos} elemento(s) data-vida no quedan visibles con reducir movimiento`));
    else salida.push(ok('10.b', { vida: reducido.vida }));
  }
  const n = await crearSesion(c, { reducido: false, etiqueta: 'movimiento-normal' });
  let normal = null;
  try {
    await irA(n, 'C02');
    await n.page.evaluate(() => document.fonts.ready);
    // Sin reducir movimiento, los elementos «data-vida» aparecen animados: se espera a que terminen antes de medir.
    await n.page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'), null, { timeout: 10000 }).catch(() => {});
    normal = await n.page.evaluate(() => {
      const F = window.__F;
      const visibles = [...document.querySelectorAll('[data-vida], [data-zoom], button, a[href]')].filter(F.vis).slice(0, 80);
      const medidas = visibles.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)]; });
      const textos = visibles.map((el) => F.norm(el.innerText || el.getAttribute('aria-label') || '').slice(0, 40));
      return { medidas, textos };
    });
    normal = { medidas: normal.medidas, textos: normal.textos };
  } finally { await cerrarSesion(n); }
  if (reducido.vida && normal) {
    // Tras terminar las animaciones, ¿siguen cambiando los controles? Si sí, es real: se nombran los textos que faltan o sobran.
    const restar = (lista, otra) => { const r = [...lista]; for (const t of otra) { const i = r.indexOf(t); if (i >= 0) r.splice(i, 1); } return r; };
    const soloReducido = restar(reducido.textos, normal.textos);
    const soloNormal = restar(normal.textos, reducido.textos);
    if (reducido.medidas.length !== normal.medidas.length || soloReducido.length || soloNormal.length) {
      salida.push(falla('10.c', `con y sin reducir movimiento cambian los controles visibles aun tras terminar las animaciones (${reducido.medidas.length} y ${normal.medidas.length}; solo con reducir: «${soloReducido.slice(0, 3).join('», «') || '—'}»; solo sin reducir: «${soloNormal.slice(0, 3).join('», «') || '—'}»)`));
    } else {
      const dif = Math.max(0, ...reducido.medidas.map((m, i) => Math.max(...m.map((v, k) => Math.abs(v - normal.medidas[i][k])))));
      salida.push(dif <= 1 ? ok('10.c', { elementos: normal.medidas.length }) : falla('10.c', `con y sin reducir movimiento la posición cambia hasta ${dif} px`));
    }
  }
  const j = await crearSesion(c, { sinJS: true, etiqueta: 'sin-javascript' });
  try {
    await j.page.goto(new URL('index.html#C02', j.base).toString(), { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const sinJs = await j.page.evaluate(() => [...document.querySelectorAll('[data-vida]')].map((el) => getComputedStyle(el).opacity));
    if (!sinJs.length) salida.push(pend('10.d', 'C', 'sin JavaScript no hay elementos data-vida que revisar todavía'));
    else salida.push(sinJs.every((o) => o === '1') ? ok('10.d', { elementos: sinJs.length }) : falla('10.d', 'sin JavaScript hay elementos data-vida invisibles'));
  } finally { await cerrarSesion(j); }
  return salida;
}

// Escanea el código del sitio (no las pruebas ni el repositorio de QA) buscando localStorage.clear fuera de comentarios.
function escanearClear() {
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  const archivos = ['index.html', 'prototipo.html', 'prueba.html', 'crm.html', 'blog-empresas.html', 'guia-servicio-cafe.html'].map((f) => path.join(RAIZ, f));
  const recorrer = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(html|js)$/i.test(e.name)) archivos.push(f);
    }
  };
  ['crm', 'recursos', 'PRUEBA_CON_PERSONAS', 'captacion'].forEach((d) => recorrer(path.join(RAIZ, d)));
  const con = [];
  for (const f of archivos) {
    if (!fs.existsSync(f)) continue;
    if (/localStorage\s*\.\s*clear\s*\(/.test(sinComentarios(fs.readFileSync(f, 'utf8')))) con.push(path.relative(RAIZ, f).replace(/\\/g, '/'));
  }
  return con;
}

// Una corrida completa por navegador y tamaño.
async function corrida(c, selecciona) {
  const salida = [];
  const partes = [];
  const add = (...lista) => lista.flat().filter(Boolean).forEach((x) => partes.push(x));
  c.sesiones = [];
  const aire = [];
  const referencia = REFERENCIA.includes(`${c.w}x${c.h}`);
  const capturas = path.join(EVIDENCIA, 'capturas');
  fs.mkdirSync(capturas, { recursive: true });
  const capturar = async (s, nombre) => {
    try { await s.page.screenshot({ path: path.join(capturas, `${c.navegador}-${c.w}x${c.h}-${nombre}.jpg`), type: 'jpeg', quality: 80, animations: 'disabled' }); } catch (_) { /* sin captura */ }
  };
  const pasoAire = async (s, pantalla) => { aire.push(await medirAire(s.page, pantalla)); };
  const ctasPantallas = [];

  // A) Recorrido de referencia (Hotel): puntos 2, 3, 4, 5, 6, 7, 9 y parte de 11.
  const ref = await crearSesion(c, { etiqueta: 'referencia' });
  try {
    const hooks = {
      home: async (s) => { add(await p2Inicio(s)); ctasPantallas.push(await p2Pantalla(s, 'C02 (inicio)')); await pasoAire(s, 'C02'); await capturar(s, 'inicio'); },
      formulario: async (s) => { ctasPantallas.push(await p2Pantalla(s, 'Cuéntanos de tu negocio')); await pasoAire(s, 'formulario'); },
      motor: async (s) => { s.saludo = await s.page.evaluate(() => { const F = window.__F; const el = [...document.querySelectorAll('[data-saludo], [data-agente-mensaje], h1')].find(F.vis); return el ? el.innerText.trim().slice(0, 200) : ''; }); ctasPantallas.push(await p2Pantalla(s, 'Te ayudamos a elegir tu solución')); await pasoAire(s, 'motor'); },
      maquinas: async (s) => { add(await p3Tarjetas(s)); await capturar(s, 'maquinas'); },
      maquina: async (s) => { add(await p3Senal(s)); },
      pack: async (s) => {
        add(await p4Resumen(s));
        add(await p4Detalle(s));
        add(await p4Sugerencia(s, false));
        ctasPantallas.push(await p2Pantalla(s, 'Pack de inicio').catch(() => null));
        await pasoAire(s, 'pack');
        await capturar(s, 'pack');
      },
      cross: async (s) => { add(await p4Sugerencia(s, true)); await capturar(s, 'sugerencia'); },
      noGracias: async (s) => { add(await p4NoGracias(s)); },
      confirmacion: async (s) => { add(await p5Confirmacion(s)); await pasoAire(s, 'confirmacion'); await capturar(s, 'confirmacion'); },
      portal: async (s) => {
        add(await p2Pestanas(s, async (tab) => {
          if (selecciona('9')) await pasoAire(s, `portal ${tab}`);
          if (referencia && (tab === 'pedido' || tab === 'ayuda')) await capturar(s, `portal-${tab}`);
        }));
      },
    };
    const r = await recorrer(ref, TIPOS[0], { hooks });
    if (r.parada) {
      // La parada se reporta como FALLA si fue un defecto ya visible; si no, como pendiente de su dueño.
      if (r.parada.tipo === 'falla') add(falla(r.parada.id, r.parada.causa));
      else add(pend(r.parada.id, r.parada.dueno, r.parada.causa));
      for (const id of ['2.a', '2.b', '2.c', '3.a', '3.b', '3.c', '3.d', '4.a', '4.b', '4.c', '4.d', '4.e', '5.a', '5.b', '5.c', '5.d', '5.e', '6.a', '6.b', '6.c', '6.d', '6.e', '7.a', '7.b', '7.c', '7.d', '7.e', '7.f']) {
        if (!partes.some((p) => p.id === id)) add(pend(id, r.parada.dueno, `no se llegó a esta pantalla: ${r.parada.causa}`));
      }
    } else {
      // Pantalla de portal: 5.b-5.d; después, agente, CRM y tareas.
      if (selecciona('5')) {
        const rutas = r.rutasConfirmacion;
        const popups = ref.popups.length;
        const directo = rutas.includes('C09') && rutas.every(ruta => ruta === 'C09');
        add(directo && !popups ? ok('5.e', { rutas, popups }) : falla('5.e', `la confirmación pasó por ${rutas.join(' → ') || 'ninguna ruta'} y abrió ${popups} pestaña(s)`));
        add(await p5Portal(ref));
      }
      if (selecciona('6')) add(await p6Agente(ref));
      if (selecciona('7')) add(await p7Crm(ref));
      if (selecciona('3')) add(await p3Crm(ref));
    }
  } catch (error) {
    add(falla('11.b', `la corrida de referencia se cortó: ${String(error.message).split('\n').slice(0, 4).join(' ').slice(0, 250)}`));
    await capturar(ref, 'error-referencia');
  } finally {
    await cerrarSesion(ref);
  }
  // Los CTA de cada pantalla del recorrido (2.b) se consolidan en un solo resultado.
  partes.push(...ctasPantallas.filter(Boolean));

  // B) Misma base para los siete tipos (solo en los tamaños de referencia).
  if (referencia && selecciona('1')) {
    const recorridos = [];
    for (const tipo of TIPOS) {
      const s = await crearSesion(c, { etiqueta: `tipo-${tipo.nombre}` });
      try {
        // El saludo personalizado por tipo aparece en el pack («Tu pack de inicio para hoteles»), no en el formulario.
        const hooksTipo = { pack: async (x) => { x.saludo = await leerSaludo(x.page); } };
        const r = await recorrer(s, tipo, { hasta: 'portal', hooks: hooksTipo });
        recorridos.push({ tipo: tipo.nombre, pasos: r.pasos.map((x) => `${x.paso}@${x.ruta}`), saludo: s.saludo, parada: r.parada || null });
      } catch (error) {
        recorridos.push({ tipo: tipo.nombre, pasos: [], saludo: '', parada: { dueno: 'B1', causa: String(error.message).split('\n')[0].slice(0, 160) } });
      } finally {
        await cerrarSesion(s);
      }
    }
    const paradas = recorridos.filter((x) => x.parada);
    if (paradas.length) add(pend('1.a', [...new Set(paradas.map((x) => x.parada.dueno))].join(' y '), `${paradas.length} tipo(s) no llegan al portal: ${paradas.map((x) => `${x.tipo} (${x.parada.causa})`).join('; ')}`));
    else {
      const secuencias = new Set(recorridos.map((x) => x.pasos.join('>')));
      add(secuencias.size === 1 ? ok('1.a', { pasos: recorridos[0].pasos, tipos: recorridos.length }) : falla('1.a', `los recorridos difieren entre tipos: ${recorridos.map((x) => `${x.tipo}: ${x.pasos.join('>')}`).join(' | ')}`));
      const saludos = recorridos.map((x) => norm(x.saludo));
      const vacios = recorridos.filter((x) => !norm(x.saludo)).map((x) => x.tipo);
      if (vacios.length) add(pend('1.b', 'B1', `sin saludo visible en: ${vacios.join(', ')}`));
      else add(new Set(saludos).size === saludos.length ? ok('1.b', recorridos.map((x) => ({ tipo: x.tipo, saludo: x.saludo.slice(0, 120) }))) : falla('1.b', 'hay saludos repetidos entre tipos de comprador'));
    }
    salida.tabla = recorridos.map((x) => ({ tipo: x.tipo, pasos: x.pasos.join(' > '), saludo: x.saludo.slice(0, 160), parada: x.parada ? x.parada.causa : null }));
  }

  // C) Aceptar sin abrir el detalle (4.c).
  if (selecciona('4')) {
    const s = await crearSesion(c, { etiqueta: 'aceptar-sin-detalle' });
    try {
      const r = await recorrer(s, TIPOS[0], { hasta: 'pack' });
      if (r.parada) add(pend('4.c', r.parada.dueno, r.parada.causa));
      else add(await p4Aceptar(s));
    } finally {
      await cerrarSesion(s);
    }
  }

  // D) Prueba autoguiada (8.a-8.f).
  if (selecciona('8')) {
    try { add(await p8Prueba(c)); } catch (error) { add(falla('8.b', `la prueba autoguiada se cortó: ${String(error.message).split('\n').slice(0, 6).join(' ').slice(0, 360)}`)); }
  }

  // E) Movimiento y JavaScript (10.a-10.d).
  if (selecciona('10')) {
    try { add(await movimiento(c)); } catch (error) { add(falla('10.a', `la prueba de movimiento se cortó: ${String(error.message).split('\n')[0].slice(0, 200)}`)); }
  }

  // F) Barrido de clics en C02 (sesión nueva) y en el portal de la referencia no se repite aquí (ver 11.a en la corrida de referencia).
  if (referencia && selecciona('11')) {
    const s = await crearSesion(c, { etiqueta: 'barrido-C02' });
    try {
      await irA(s, 'C02');
      const r = await barridoClics(s.page, s, { max: 30, recarga: true, ruta: 'C02' });
      add(r.sinRespuesta.length ? falla('11.a', `${r.sinRespuesta.length} de ${r.probados} controles de C02 no responden: ${r.sinRespuesta.slice(0, 8).join(' · ')}`, r) : ok('11.a', { probados: r.probados, total: r.total }));
    } catch (error) {
      add(pend('11.a', 'B1', `el barrido de C02 no pudo correr: ${String(error.message).split('\n')[0].slice(0, 120)}`));
    } finally {
      await cerrarSesion(s);
    }
  }

  // Todas las sesiones están cerradas: se leen sus errores, su limpieza de almacenamiento y sus pestañas emergentes.
  const erroresTodos = (c.sesiones || []).flatMap((s) => s.errores.map((e) => ({ ...e, sesion: s.etiqueta })));
  const popups = (c.sesiones || []).flatMap((s) => s.popups.map((url) => ({ sesion: s.etiqueta, url })));

  // G) Errores de consola, red y llamadas externas; localStorage.clear (11.b y 11.c).
  if (selecciona('11')) {
    const utiles = erroresTodos.filter((e) => e.tipo !== 'localStorage.clear');
    const clears = erroresTodos.filter((e) => e.tipo === 'localStorage.clear');
    if (utiles.length) {
      const unicos = [...new Map(utiles.map((e) => [`${e.tipo}|${e.detalle}`, e])).values()].slice(0, 8);
      add(falla('11.b', `${utiles.length} error(es): ${unicos.map((e) => `${e.tipo} (${e.sesion}): ${e.detalle}`).join(' · ')}`));
    } else add(ok('11.b', {}));
    add(clears.length ? falla('11.c', `se llamó localStorage.clear (${clears.map((e) => e.sesion).join(', ')})`) : ok('11.c', {}));
  }

  // H) Pestañas emergentes (popup) en cualquier sesión (11.d; también lo mira 5.a-5.e en el recorrido).
  if (selecciona('11') || selecciona('5')) {
    if (popups.length) add(falla('11.d', `se abrieron ${popups.length} pestaña(s) emergente(s): ${popups.slice(0, 3).map((x) => `${x.sesion} → ${x.url.slice(0, 80)}`).join(' · ')}`));
    else add(ok('11.d', {}));
  }

  return { salida, partes, aire, erroresTodos, tabla: salida.tabla || null, referencia };
}

// Consolida las partes de cada comprobación en un resultado por identificador.
function consolidar(partes) {
  const grupos = new Map();
  for (const p of partes) {
    if (!grupos.has(p.id)) grupos.set(p.id, []);
    grupos.get(p.id).push(p);
  }
  return [...grupos.entries()].map(([id, lista]) => {
    const fallas = lista.filter((x) => x.estado === 'FALLA');
    const pendientes = lista.filter((x) => x.estado === 'PENDIENTE');
    const estado = fallas.length ? 'FALLA' : pendientes.length ? 'PENDIENTE' : 'PASS';
    return {
      id,
      nombre: NOMBRES[id] || id,
      estado,
      causas: [...new Set(fallas.map((x) => x.causa).concat(pendientes.map((x) => x.causa)))].filter(Boolean),
      duenos: [...new Set(pendientes.map((x) => x.dueno).filter(Boolean))],
      datos: lista.map((x) => x.datos).filter((d) => d !== undefined).slice(0, 4),
    };
  });
}

// Análisis de aire: 9.a sin scroll lateral; 9.b-9.d según las medidas (pendiente de C si aire.css aún no carga).
function resultadosAire(mediciones) {
  const salida = [];
  const validas = mediciones.filter((m) => !m.error);
  if (!validas.length) return [pend('9.a', 'C', 'no se pudo medir el aire')];
  const conScroll = validas.filter((m) => m.scrollW > m.vw);
  salida.push(conScroll.length ? falla('9.a', `scroll lateral en: ${conScroll.map((m) => `${m.pantalla} (${m.scrollW}/${m.vw} px)`).join(', ')}`) : ok('9.a', { pantallas: validas.length }));
  const cargado = validas.some((m) => m.aireCargado);
  const marcar = (id, nombre, malas, detalle) => {
    if (!malas.length) return ok(id, detalle);
    const causa = malas.map((m) => `${m.pantalla}: ${nombre(m)}`).join(' · ');
    return cargado ? falla(id, causa) : pend(id, 'C', `${causa} (aire.css todavía no está cargado)`);
  };
  salida.push(marcar('9.b', (m) => `margen mínimo ${m.margenMinimo} px (${m.peorMargen})`, validas.filter((m) => m.margenMal > 0), { mediciones: validas.length }));
  salida.push(marcar('9.c', (m) => `${m.huecosTotal} espacio(s) menor(es) de lo pedido`, validas.filter((m) => m.huecosTotal > 0), { mediciones: validas.length }));
  salida.push(marcar('9.d', (m) => `${m.rellenoTotal} caja(s) con relleno menor de lo pedido`, validas.filter((m) => m.rellenoTotal > 0), { mediciones: validas.length }));
  return salida;
}

async function correrPool(items, limite, fn) {
  const salida = [];
  let i = 0;
  const hilos = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const k = i;
      i += 1;
      salida[k] = await fn(items[k]);
    }
  });
  await Promise.all(hilos);
  return salida;
}

async function main() {
  const args = process.argv.slice(2);
  const opcion = (nombre, defecto) => { const h = args.find((a) => a.startsWith(`--${nombre}=`)); return h ? h.split('=').slice(1).join('=') : defecto; };
  const baseArg = args.find((a) => !a.startsWith('--'));
  const estricto = args.includes('--estricto');
  const navegadores = opcion('navegador', 'ambos') === 'ambos' ? ['chrome', 'edge'] : opcion('navegador', 'ambos').split(',');
  const tamanosFiltro = opcion('tamanos', '');
  const puntosFiltro = opcion('puntos', '').split(',').filter(Boolean);
  const selecciona = (n) => puntosFiltro.length === 0 || puntosFiltro.includes(String(n));

  let servidor = null;
  let base;
  if (baseArg) base = baseDe(baseArg);
  else {
    servidor = await servirRepo('/marley-coffee-mvp');
    base = `http://127.0.0.1:${servidor.address().port}/marley-coffee-mvp/`;
  }
  const combos = [];
  for (const nav of navegadores) {
    for (const [w, h] of (TAMANOS[nav] || [])) {
      if (tamanosFiltro && !tamanosFiltro.split(',').includes(`${w}x${h}`)) continue;
      combos.push({ navegador: nav, w, h });
    }
  }
  const lanzar = async (c) => {
    const lanzador = c.navegador === 'edge' ? lanzadorEdge : lanzadorChrome;
    const opciones = c.navegador === 'edge' ? { headless: true, executablePath: EDGE_EXE } : { headless: true };
    return lanzador.launch(opciones);
  };
  const resultados = [];
  const tablaTipos = [];
  const aireTodos = [];
  const erroresGlobales = [];
  const terminadas = [];
  const incompletas = [];
  const inicio = Date.now();
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  const archivo = path.join(EVIDENCIA, 'informe-ux-final.json');
  const cuenta = (estado) => resultados.filter((r) => r.estado === estado).length;
  const guardar = (fin) => {
    const informe = {
      encargo: 'Mejoras finales del prototipo Marley Coffee Empresas (26-nov-2026)',
      base,
      fecha: new Date().toISOString(),
      segundos: Math.round((Date.now() - inicio) / 1000),
      estricto,
      fin,
      combos: combos.map((c) => `${c.navegador} ${c.w}x${c.h}`),
      terminadas,
      incompletas,
      resumen: { PASS: cuenta('PASS'), FALLA: cuenta('FALLA'), PENDIENTE: cuenta('PENDIENTE') },
      resultados,
      tablaTipos,
      aire: aireTodos,
      errores: erroresGlobales,
    };
    fs.writeFileSync(archivo, JSON.stringify(informe, null, 2) + '\n');
    return informe;
  };

  const clearEnCodigo = escanearClear();
  if (clearEnCodigo.length) erroresGlobales.push({ tipo: 'localStorage.clear en el código', detalle: clearEnCodigo.join(', ') });

  await correrPool(combos, 1, async (combo) => {
    const etiqueta = `${combo.navegador} ${combo.w}x${combo.h}`;
    let browser;
    try {
      browser = await lanzar(combo);
      const r = await corrida({ ...combo, browser, base }, selecciona);
      const porId = consolidar(r.partes);
      for (const x of porId) {
        if (!selecciona(x.id.split('.')[0])) continue;
        resultados.push({ navegador: combo.navegador, tamano: `${combo.w}x${combo.h}`, ...x });
      }
      if (r.aire.length) {
        const aireRes = resultadosAire(r.aire);
        for (const x of aireRes) {
          if (!selecciona('9')) continue;
          resultados.push({ navegador: combo.navegador, tamano: `${combo.w}x${combo.h}`, ...consolidar([x])[0] });
        }
        aireTodos.push({ navegador: combo.navegador, tamano: `${combo.w}x${combo.h}`, mediciones: r.aire });
      }
      if (r.tabla) tablaTipos.push({ navegador: combo.navegador, tamano: `${combo.w}x${combo.h}`, filas: r.tabla });
      for (const e of r.erroresTodos) erroresGlobales.push({ navegador: combo.navegador, tamano: `${combo.w}x${combo.h}`, ...e });
      terminadas.push(etiqueta);
    } catch (error) {
      incompletas.push({ combo: etiqueta, detalle: String(error.message).split('\n')[0] });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    guardar(false);
    process.stderr.write(`  ${terminadas.includes(etiqueta) ? 'listo' : 'incompleto'} ${etiqueta}\n`);
  });

  if (servidor) servidor.close();

  const informe = guardar(true);

  // Resumen en pantalla: por comprobación, con los tamaños donde falla o queda pendiente.
  const ids = [...new Set(resultados.map((r) => r.id))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  for (const id of ids) {
    const filas = resultados.filter((r) => r.id === id);
    const estado = filas.some((f) => f.estado === 'FALLA') ? 'FALLA' : filas.some((f) => f.estado === 'PENDIENTE') ? 'PENDIENTE' : 'PASS';
    const lugares = filas.filter((f) => f.estado !== 'PASS').map((f) => `${f.navegador} ${f.tamano}`);
    const causas = [...new Set(filas.flatMap((f) => f.causas || []))].slice(0, 3);
    const duenos = [...new Set(filas.flatMap((f) => f.duenos || []))];
    const linea = `[${estado}] ${id} ${NOMBRES[id] || ''}`;
    process.stdout.write(`${linea}${lugares.length ? ` · en ${lugares.length} de ${filas.length}` : ''}${duenos.length ? ` · pendiente de ${duenos.join(' y ')}` : ''}\n`);
    for (const c of causas) process.stdout.write(`      - ${c.slice(0, 300)}\n`);
  }
  if (erroresGlobales.length) process.stdout.write(`Errores de consola, red, llamadas externas o localStorage.clear: ${erroresGlobales.length}\n`);
  process.stdout.write(`Resumen: PASS ${informe.resumen.PASS} · FALLA ${informe.resumen.FALLA} · PENDIENTE ${informe.resumen.PENDIENTE} (${informe.segundos} s)\n`);
  process.stdout.write(`Informe: ${archivo}\n`);
  const fallos = incompletas.length + informe.resumen.FALLA + (estricto ? informe.resumen.PENDIENTE : 0);
  process.exitCode = fallos > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
