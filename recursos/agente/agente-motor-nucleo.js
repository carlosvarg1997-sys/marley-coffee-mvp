/* NÚCLEO del motor (se carga bajo demanda desde agente-motor.js; el contrato usa window.MarleyAgente). 
 * Marley Coffee Empresas · agente conversacional · motor determinista v1.0
 * Simulación honesta: no hay modelo de lenguaje ni llamadas externas. El motor entiende
 * intenciones en español (tolera tildes y errores de tipeo), lee el prototipo (window.M4,
 * M4D, R6P y los JSON de recursos/datos) y responde con datos aprobados. Lo que no está
 * aprobado (precios especiales, crédito, mínimos, plazos sin fuente) se deriva a una persona:
 * nunca se inventa un precio ni un plazo.
 *
 * Contrato (CONTRATO_AGENTE_24NOV.md):
 *   motor.responder(ctx, entrada) -> { mensajes, acciones, registro }
 *   datos.{lead, cuenta, cotizacion, pedidos, buscar}
 *   estado.{get, guardar, registrar}  ·  canales.enviar({canal, cuentaId, para, texto, aprobadoPor})
 *   eventos.{on, emitir}  tipos: mensaje, traspaso, notificacion, envio, aprobacion
 * Persistencia: localStorage['marley.agente.v1']. Nunca se usa localStorage.clear().
 * responder() deja en el estado lo que sí ocurre (mensajes, traspasos, consentimientos,
 * cambios de cotización, registro) y emite eventos. Los paneles solo dibujan el resultado.
 */
(function () {
  'use strict';
  if (window.MarleyAgenteNucleo) return;

  const VERSION = '1.0';
  const CLAVE = 'marley.agente.v1';
  const JSON_PRECIOS = 'recursos/datos/precios_cotizacion_19oct.json';
  const JSON_OFERTA = 'recursos/datos/oferta_por_buyer.json';
  const CANALES = ['web', 'whatsapp', 'correo', 'nota'];
  const ROLES_CRM = ['marketing', 'ventas', 'jefatura'];
  const CLIENTE_LOCAL = 'cliente-local';

  // ---------- Utilidades ----------
  const ahora = () => Date.now();
  const id = (p) => `${p}-${ahora().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const limpio = (s) => sinTildes(s).replace(/[^a-z0-9%.,$\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const palabras = (s) => limpio(s).split(' ').filter(Boolean);
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const fmt = (n) => (Number.isFinite(Number(n)) && n !== null ? '$' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : 'Por confirmar');
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  // Comuna real del lead: «Sin comuna» no es una comuna (el dueño sale por zona por defecto).
  const comunaReal = (c) => (c && c !== 'Sin comuna' ? String(c) : '');
  const seguro = (fn, respaldo = null) => { try { const v = fn(); return v === undefined ? respaldo : v; } catch (_) { return respaldo; } };

  function distancia(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }
  // Tolerancia a errores de tipeo: palabras cortas exactas; las largas admiten 1 o 2 errores.
  function parecida(token, palabra) {
    if (token === palabra) return true;
    if (palabra.length <= 3 || token.length <= 3) return false;
    if (token.startsWith(palabra) || palabra.startsWith(token)) return Math.min(token.length, palabra.length) >= 4;
    // Tolerancia: 1 error hasta 8 letras; 2 errores solo en palabras largas (evita que «cuenta» llegue a «fuente»).
    const tol = palabra.length >= 9 ? 2 : 1;
    return Math.abs(token.length - palabra.length) <= tol && distancia(token, palabra) <= tol;
  }
  // Para nombres de leads y cuentas: coincidencia exacta o con un error en palabras de 5 letras o más.
  function nombreCoincide(token, palabra) {
    if (token === palabra) return true;
    return palabra.length >= 5 && token.length >= 5 && distancia(token, palabra) <= 1;
  }
  function puntaje(tokens, frases) {
    let mejor = 0;
    for (const frase of frases) {
      const ws = frase.split(' ');
      if (ws.every((w) => tokens.some((t) => parecida(t, w)))) mejor = Math.max(mejor, ws.length);
    }
    return mejor;
  }
  function detectar(texto, tabla) {
    const tokens = palabras(texto);
    if (!tokens.length) return null;
    let mejor = null;
    let mejorPuntaje = 0;
    for (const it of tabla) {
      const p = puntaje(tokens, it.frases);
      if (p > mejorPuntaje) { mejor = it.id; mejorPuntaje = p; }
    }
    return mejor;
  }
  function numeroEn(texto) {
    const m = limpio(texto).replace(/(\d)\.(?=\d{3}\b)/g, '$1').match(/\b\d{1,5}\b/);
    return m ? Number(m[0]) : null;
  }
  const MAQUINA_ALIAS = {
    bar: ['bar', 'barra', 'espresso profesional'],
    pods: ['pods', 'pod'],
    oficina: ['oficina', 'superautomatica'],
    cafe_al_paso: ['cafe al paso', 'al paso', 'automatica', 'autoservicio'],
  };
  function maquinaEn(texto) {
    const t = palabras(texto);
    for (const [mid, alias] of Object.entries(MAQUINA_ALIAS)) {
      if (alias.some((a) => a.split(' ').every((w) => t.some((x) => parecida(x, w))))) return mid;
    }
    return null;
  }

  // ---------- Datos del prototipo y de recursos/datos (solo lectura) ----------
  let PRECIOS = null;
  let OFERTA = null;
  let cargando = false;
  function cargarDatos() {
    if ((PRECIOS && OFERTA) || cargando || typeof fetch !== 'function') return;
    cargando = true;
    const pedir = (url) => fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
    Promise.all([pedir(JSON_PRECIOS), pedir(JSON_OFERTA)])
      .then(([p, o]) => { PRECIOS = p; OFERTA = o; cargando = false; })
      .catch(() => { cargando = false; });
  }
  const M4 = () => (window.M4 && typeof window.M4.get === 'function' ? window.M4 : null);
  const D4 = () => window.M4D || null;
  const R6 = () => window.R6P || null;
  const estadoProto = () => seguro(() => (M4() ? M4().get() : null), null) || {};
  const lineasPrecio = () => (PRECIOS && Array.isArray(PRECIOS.lineas) ? PRECIOS.lineas : []);
  const kitPrecio = () => (PRECIOS && PRECIOS.instalacion ? PRECIOS.instalacion.precio : null);
  const filtroPrecio = () => (PRECIOS && PRECIOS.filtro ? PRECIOS.filtro.precio : null);
  const cargaBase = () => (PRECIOS && PRECIOS.totales ? PRECIOS.totales.antes_de_instalar : null);
  const insumosRef = () => (PRECIOS && PRECIOS.totales ? PRECIOS.totales.insumos : null);
  const aConfirmar = () => (PRECIOS && Array.isArray(PRECIOS.a_confirmar) ? PRECIOS.a_confirmar : []);
  const faqPor = (clave) => {
    const f = (D4() && Array.isArray(D4().FAQ) ? D4().FAQ : []).find((x) => sinTildes(x[0]).includes(clave));
    return f ? f[1] : null;
  };
  const nombreMaquina = (mid) => (OFERTA && OFERTA.maquinas && OFERTA.maquinas[mid] ? OFERTA.maquinas[mid].nombre : null) || (D4() && D4().MACHINES && D4().MACHINES[mid] ? D4().MACHINES[mid].name : mid);
  const infoMaquina = (mid) => {
    const o = (OFERTA && OFERTA.maquinas && OFERTA.maquinas[mid]) || {};
    const d = (D4() && D4().MACHINES && D4().MACHINES[mid]) || {};
    return { id: mid, nombre: o.nombre || d.name || mid, tipo: o.tipo || d.kind || '', tazas: o.tazas || d.cupsTxt || '', atencion: o.atencion || d.staff || '', linea: o.linea || d.line || '', fit: Array.isArray(d.fit) ? d.fit : [] };
  };
  const nombreProducto = (k) => {
    const p = D4() && D4().PRODUCTS ? D4().PRODUCTS[k] : null;
    return p ? p.name : k;
  };
  const NEGOCIO_ETIQUETA = { OCS: 'Oficina', Hotel: 'Hotel', Restaurante: 'Restaurante', 'Cafetería': 'Cafetería', 'Eventos o catering': 'Eventos o catering', Conveniencia: 'Conveniencia', 'Panadería': 'Panadería', Otro: 'Otro negocio' };
  const NEGOCIO_FRASE = { Hotel: 'un hotel', Restaurante: 'un restaurante', 'Cafetería': 'una cafetería', 'Eventos o catering': 'un negocio de eventos o catering', OCS: 'una oficina', Conveniencia: 'un local de conveniencia', 'Panadería': 'una panadería', Otro: 'tu negocio' };
  // «De 150 a 400» se dice «150 a 400» (la oración pone el «de»); «Menos de 50» queda «menos de 50».
  const volumenFrase = (v) => {
    if (!v || v === 'No lo sé') return null;
    const t = String(v).replace(/^De /, '');
    return t.charAt(0).toLowerCase() + t.slice(1);
  };
  const CUPS_DE = (v) => {
    const c = D4() && D4().CUPS ? D4().CUPS[v] : null;
    return Number.isFinite(Number(c)) && c !== null ? Number(c) : null;
  };

  // Lead del comprador (estado del prototipo) o prospecto del CRM (M4D.PROSPECTS).
  function puntajesDe(x) {
    const r = R6();
    const out = { interes: null, valor: null };
    if (!r) return out;
    const i = seguro(() => r.interes(x), null);
    if (i) out.interes = { puntaje: i.puntaje, porque: i.porque, mql: !!i.mql, sqlCandidato: !!i.sqlCandidate, temperatura: i.temperatura || '' };
    const v = seguro(() => r.valor(x), null);
    if (v) out.valor = { puntaje: v.puntaje, porque: v.porque };
    return out;
  }
  const prospectos = () => (D4() && Array.isArray(D4().PROSPECTS) ? D4().PROSPECTS : []);
  const cuentasCRM = () => (D4() && Array.isArray(D4().ACCOUNTS) ? D4().ACCOUNTS : []);
  function leadDeProspecto(p) {
    const respuestas = respuestasDe(p);
    return {
      id: p.id, nombre: p.name || '', empresa: p.company || '', negocio: p.business || null, comuna: p.comuna || null,
      canal: p.channel || null, fuente: p.source || null, campana: p.source || null, etapa: p.stage || null,
      hace: typeof p.agoMin === 'number' ? p.agoMin : null, origen: 'crm', puntaje: p.score ?? null,
      respuestas, puntajes: puntajesDe(p), b2b: null, telefono: '', permisoPromo: permisoPromoDe(p.id, { marketingConsent: p.marketingConsent, etapa: p.stage }), ejecutiva: seguro(() => D4().execFor(p.comuna).name, null),
      zona: seguro(() => D4().ZONES[D4().execFor(p.comuna).zone].name, null), eventos: [],
    };
  }
  function leadDeEstado(s) {
    const L = s.lead || {};
    const a = s.answers || {};
    return {
      id: L.id, nombre: L.name || '', empresa: L.company || '', negocio: a.negocio || null, comuna: a.comuna || null,
      canal: L.channel || null, fuente: L.source || 'Sitio Marley Coffee Empresas', campana: (L.attribution && (L.attribution.campaign || L.attribution.label)) || L.source || null,
      etapa: s.proposal ? 'Propuesta' : 'Diagnóstico', hace: null, origen: 'sitio', puntaje: null, respuestas: a,
      puntajes: puntajesDe(s), ejecutiva: seguro(() => D4().execFor(a.comuna).name, null),
      zona: seguro(() => D4().ZONES[D4().execFor(a.comuna).zone].name, null),
      eventos: (s.events || []).map((e) => (M4() && M4().EV && M4().EV[e.key] ? M4().EV[e.key].label : e.key)),
      email: L.email || '', telefono: L.phone || '', consentimientoSitio: !!L.consent,
      b2b: Boolean(M4() && M4().B2B_SEGMENTS && M4().B2B_SEGMENTS.includes(a.negocio)),
      permisoPromo: permisoPromoDe(L.id, { marketingConsent: L.marketingConsent, etapa: null }),
    };
  }
  function respuestasDe(p) {
    const base = (M4() && M4().DEFAULTS && M4().DEFAULTS[p.business]) || {};
    return {
      negocio: p.business || 'Otro', comuna: p.comuna || null, volumen: p.volumen || base.volumen || 'No lo sé',
      operacion: base.operacion || 'Mixto', preferencias: Array.isArray(base.preferencias) ? base.preferencias.slice() : ['Espresso y cappuccino'],
      supuesto: true,
    };
  }
  function recomendarCon(respuestas, base = {}) {
    const m = M4();
    if (!m) return { machine: 'bar', cups: null, base: [] };
    const syn = Object.assign({}, estadoProto(), { answers: respuestas, quote: null, proposal: null, lmi: [], services: [], call: null }, base);
    return seguro(() => m.recommendation(syn), { machine: 'bar', cups: null, base: [] });
  }

  // ---------- Estado (localStorage['marley.agente.v1']) ----------
  let copiaMemoria = null;
  const vacio = () => ({ conversaciones: {}, traspasos: [], notificaciones: { ventas: [], marketing: [], jefatura: [] }, registro: [], consentimientos: {}, capturas: {} });
  function leerEstado() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) {
        const e = JSON.parse(raw);
        if (e && typeof e === 'object') return Object.assign(vacio(), e);
      }
    } catch (_) { /* sin almacenamiento: se usa la copia en memoria */ }
    return copiaMemoria ? clonar(copiaMemoria) : vacio();
  }
  function guardarEstado(e) {
    const out = Object.assign(vacio(), e || {});
    Object.keys(out.conversaciones).forEach((k) => {
      if (out.conversaciones[k].length > 300) out.conversaciones[k] = out.conversaciones[k].slice(-300);
    });
    out.registro = out.registro.slice(-500);
    out.traspasos = out.traspasos.slice(-200);
    copiaMemoria = clonar(out);
    try { localStorage.setItem(CLAVE, JSON.stringify(out)); } catch (_) { /* sin almacenamiento: queda en memoria */ }
    return out;
  }
  function registrar(accion) {
    const e = leerEstado();
    const r = Object.assign({ ts: ahora(), rol: null, accion: '', datoUsado: '', sugerencia: '', nivel: 'regla', decidio: null }, accion || {});
    e.registro.push(r);
    guardarEstado(e);
    return r;
  }
  function agregarMensaje(cuentaId, msg) {
    const e = leerEstado();
    const k = String(cuentaId);
    e.conversaciones[k] = Array.isArray(e.conversaciones[k]) ? e.conversaciones[k] : [];
    const m = Object.assign({ canal: 'web', rol: 'agente', texto: '', ts: ahora() }, msg);
    e.conversaciones[k].push(m);
    guardarEstado(e);
    emitir('mensaje', { cuentaId: k, mensaje: m });
    return m;
  }
  function consentimientoDe(cuentaId) {
    const idCuenta = String(cuentaId);
    const c = leerEstado().consentimientos[idCuenta] || {};
    const s = estadoProto(), lead = s.lead;
    const esSuSolicitud = lead && [lead.id, s.customerCycle?.accountId].some(id => id && String(id) === idCuenta);
    const correoSolicitud = Boolean(esSuSolicitud && lead.consent === true && lead.email && s.proposal?.status === 'aceptada');
    return { whatsapp: c.baja !== true && c.whatsapp === true, correo: c.baja !== true && (c.correo === true || c.correo == null && correoSolicitud), baja: c.baja === true };
  }
  function fijarConsentimiento(cuentaId, canal, valor) {
    const e = leerEstado();
    const k = String(cuentaId);
    const previo = Object.assign({ whatsapp: false, correo: false, baja: false }, e.consentimientos[k] || {});
    if (canal === 'todos') {
      e.consentimientos[k] = { whatsapp: false, correo: false, baja: true, ts: ahora() };
    } else {
      e.consentimientos[k] = Object.assign(previo, { [canal]: valor === true, baja: valor === true ? false : previo.baja, ts: ahora() });
    }
    guardarEstado(e);
    return e.consentimientos[k];
  }
  function avisar(rol, aviso) {
    const e = leerEstado();
    const destino = ROLES_CRM.includes(rol) ? rol : 'ventas';
    e.notificaciones[destino] = Array.isArray(e.notificaciones[destino]) ? e.notificaciones[destino] : [];
    e.notificaciones[destino].push(Object.assign({ id: id('N'), ts: ahora(), leida: false }, aviso));
    guardarEstado(e);
    emitir('notificacion', { rol: destino, aviso });
  }
  function traspasoNuevo(datos) {
    const e = leerEstado();
    const t = Object.assign({ id: id('TR'), leadId: null, de: 'cliente', a: 'ventas', tipo: 'venta', resumen: '', estado: 'asignado', dueno: null, criterios: null, borrador: null, ts: ahora() }, datos || {});
    e.traspasos.push(t);
    guardarEstado(e);
    emitir('traspaso', t);
    avisar(t.a, { tipo: t.tipo, texto: t.aviso || `Traspaso ${t.tipo} de ${t.de}`, leadId: t.leadId, traspasoId: t.id });
    return t;
  }
  function cambiarTraspaso(traspasoId, cambios) {
    const e = leerEstado();
    const t = e.traspasos.find((x) => x.id === traspasoId);
    if (!t) return null;
    Object.assign(t, cambios || {});
    guardarEstado(e);
    emitir('traspaso', t);
    return t;
  }

  // ---------- Eventos ----------
  const suscriptores = {};
  function emitir(tipo, detalle) {
    (suscriptores[tipo] || []).slice().forEach((fn) => { try { fn(detalle); } catch (_) { /* un oyente roto no corta el resto */ } });
  }
  const eventos = {
    on(tipo, fn) {
      if (typeof fn !== 'function') return () => {};
      (suscriptores[tipo] = suscriptores[tipo] || []).push(fn);
      return () => { suscriptores[tipo] = (suscriptores[tipo] || []).filter((f) => f !== fn); };
    },
    emitir,
  };

  // ---------- Envíos (simulados) ----------
  function enviar(opts) {
    const o = opts || {};
    if (!CANALES.includes(o.canal)) return { ok: false, motivo: 'Canal no válido.' };
    if (!o.aprobadoPor) return { ok: false, motivo: 'Falta la aprobación de una persona o del contacto.' };
    if (!o.texto || !String(o.texto).trim()) return { ok: false, motivo: 'El mensaje está vacío.' };
    const cuentaId = String(o.cuentaId || CLIENTE_LOCAL);
    if ((o.canal === 'whatsapp' || o.canal === 'correo') && consentimientoDe(cuentaId)[o.canal] !== true) {
      return { ok: false, motivo: `Falta el consentimiento del contacto para ${o.canal === 'correo' ? 'correo' : 'WhatsApp'}.` };
    }
    const ts = ahora();
    // El mensaje sale de Marley hacia el contacto: rol «agente»; quién lo aprobó queda en aprobadoPor.
    agregarMensaje(cuentaId, { canal: o.canal, rol: 'agente', texto: String(o.texto), ts, envio: true, simulado: true, para: o.para || null, aprobadoPor: o.aprobadoPor });
    registrar({ ts, rol: o.aprobadoPor, accion: 'envio-' + o.canal, datoUsado: 'Texto aprobado y consentimiento del contacto', sugerencia: 'Borrador del agente', nivel: 'persona', decidio: o.aprobadoPor });
    emitir('envio', { cuentaId, canal: o.canal, para: o.para || null, texto: String(o.texto), aprobadoPor: o.aprobadoPor, ts });
    return { ok: true, envio: { canal: o.canal, cuentaId, para: o.para || null, texto: String(o.texto), ts, simulado: true } };
  }

  // ---------- Helpers de respuesta ----------
  const chip = (cid, texto) => ({ id: cid, texto });
  const msg = (texto, chips = [], tarjetas = []) => ({ rol: 'agente', texto, chips, tarjetas });
  const res = (mensajes, acciones = [], registroIA = null) => ({ mensajes, acciones, registro: registroIA });
  const reg = (datoUsado, sugerencia, nivel = 'regla') => ({ datoUsado, sugerencia, nivel });

  function normCtx(ctx) {
    const c = ctx || {};
    const lado = c.lado === 'crm' ? 'crm' : 'cliente';
    const rol = lado === 'crm' ? (ROLES_CRM.includes(c.rol) ? c.rol : 'ventas') : 'comprador';
    const s = estadoProto();
    const ruta = c.ruta || ((location.hash || '').slice(1).split('?')[0]) || 'C01';
    let cuentaId = c.cuentaId ? String(c.cuentaId) : (lado === 'cliente' ? (s.lead && s.lead.id) || CLIENTE_LOCAL : (s.sel || 'sin-cuenta'));
    // En el portal (C09) el chat habla de la misma cuenta que muestra el portal: ahí se repiten sus pedidos.
    const cuentaPortal = cuentasCRM().find((a) => a.id === s.demoAccountId) || cuentasCRM()[0] || null;
    if (lado === 'cliente' && ruta === 'C09') {
      if (s.customerCycle && s.lead?.id) cuentaId = String(s.lead.id);
      else if (cuentaPortal) cuentaId = String(cuentaPortal.id);
    }
    return { lado, rol, cuentaId, ruta };
  }
  // Si el comprador ya tiene lead, su conversación previa (cliente-local) pasa a su cuenta.
  function migrarConversacion(cuentaId) {
    if (!cuentaId || cuentaId === CLIENTE_LOCAL) return;
    migrarCuenta(CLIENTE_LOCAL, cuentaId);
  }
  // Une la conversación de una cuenta con la de otra, por hora. Pasa cuando el comprador anónimo se vuelve lead.
  function migrarCuenta(desde, hacia) {
    if (!desde || !hacia || desde === hacia) return;
    const e = leerEstado();
    const origen = Array.isArray(e.conversaciones[desde]) ? e.conversaciones[desde] : null;
    if (!origen) return;
    const destino = Array.isArray(e.conversaciones[hacia]) ? e.conversaciones[hacia] : [];
    e.conversaciones[hacia] = destino.concat(origen).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    delete e.conversaciones[desde];
    guardarEstado(e);
  }
  function historial(cuentaId, n = 30) {
    const arr = leerEstado().conversaciones[String(cuentaId)];
    return Array.isArray(arr) ? arr.slice(-n) : [];
  }

  // ---------- Intenciones del comprador ----------
  const INTENCIONES_CLIENTE = [
    { id: 'trampa', frases: ['ignora', 'instrucciones', 'precio de costo', 'costo real', 'otro cliente', 'de otro', 'que pidio', 'contrasena', 'clave de', 'prompt', 'api key'] },
    { id: 'negociar', frases: ['descuento', 'rebaja', 'precio especial', 'mejor precio', 'me haces', 'hazme', 'credito', 'cuotas', 'financiar', 'financiamiento'] },
    { id: 'baja', frases: ['no me escriban', 'no me contacten', 'dar de baja', 'darme de baja', 'no quiero recibir', 'no contactar', 'borrar mis datos', 'eliminar mis datos'] },
    { id: 'soporte', frases: ['soporte', 'falla', 'fallo', 'no funciona', 'se rompio', 'problema', 'reclamo', 'queja', 'incidencia', 'averia', 'error'] },
    { id: 'persona', frases: ['hablar con alguien', 'hablar con una persona', 'persona', 'humano', 'ejecutiva', 'ejecutivo', 'asesor', 'vendedor', 'llamen', 'llamar', 'llamada', 'llamame', 'telefono'] },
    { id: 'referido', frases: ['recomendar a', 'recomendar marley', 'referir', 'referido', 'conocido', 'otro negocio', 'otro hotel', 'otra cafeteria', 'otro restaurante', 'otra oficina', 'un amigo'] },
    { id: 'contacto', frases: ['whatsapp', 'wasap', 'correo', 'email', 'mail', 'escribeme', 'mandame', 'enviame', 'escribanme'] },
    { id: 'repetir', frases: ['repite', 'repetir', 'mismo pedido', 'volver a pedir', 'reponer', 'reposicion', 'repeticion', 'pedir de nuevo'] },
    { id: 'incluye', frases: ['que incluye', 'que incluyen', 'que trae', 'que contiene', 'que lleva', 'que viene en', 'incluye'] },
    { id: 'firma', frases: ['como firmo', 'firmar contrato', 'contrato firmado', 'firmar', 'firmo', 'firma'] },
    { id: 'horario', frases: ['cambiar el horario', 'cambiar horario', 'horario de entrega', 'hora de entrega', 'cambiar la hora', 'manana o tarde', 'en la manana', 'en la tarde', 'dia de entrega', 'horario'] },
    { id: 'estado', frases: ['estado', 'en que va', 'donde esta', 'seguimiento', 'mi pedido', 'pedido', 'cuando llega', 'va en camino'] },
    { id: 'despacho', frases: ['despachan', 'despacho', 'regiones', 'fuera de santiago', 'plazo de entrega', 'entrega', 'envio a'] },
    { id: 'comodato', frases: ['comodato', 'en que consiste', 'como funciona el', 'modelo de negocio', 'que es el comodato'] },
    { id: 'carga', frases: ['carga base', 'antes de instalar', 'pago inicial', 'kit', 'filtro', 'instalacion', 'primer pago'] },
    { id: 'organico', frases: ['organico', 'organica'] },
    { id: 'eventos', frases: ['evento', 'eventos', 'catering', 'coffee experience', 'activacion', 'material pop'] },
    { id: 'productos', frases: ['producto', 'productos', 'cafe', 'grano', 'leche', 'chocolate', 'vainilla', 'vaso', 'vasos', 'azucar', 'revolvedores', 'insumos', 'catalogo', 'cuanto cuesta', 'cuanto vale', 'cuanto sale', 'precio', 'precios'] },
    { id: 'propuesta', frases: ['mi propuesta', 'mi cotizacion', 'ver propuesta', 'ver cotizacion', 'resumen de mi'] },
    { id: 'ajustar', frases: ['cambia', 'cambiar', 'ajusta', 'ajustar', 'prefiero', 'tazas', 'taza'] },
    { id: 'maquina', frases: ['maquina', 'equipo', 'recomienda', 'recomiendame', 'me conviene', 'cual me sirve', 'cotizar', 'cotizacion', 'cotiza', 'elegir', 'pods', 'oficina', 'cafe al paso'] },
    { id: 'condiciones', frases: ['condiciones', 'garantia', 'minimo', 'factura', 'boleta', 'contrato', 'mantencion', 'plazo de pago'] },
    { id: 'ayuda', frases: ['ayuda', 'que puedes', 'que sabes', 'opciones', 'menu', 'que hago', 'como te uso'] },
    { id: 'cierre', frases: ['gracias', 'chao', 'adios', 'hasta luego', 'eso es todo', 'nada mas'] },
    { id: 'saludo', frases: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'buen dia', 'hey'] },
  ];

  function saludoCliente(c, s) {
    const a = s.answers || {};
    // En el portal el chat habla de la cuenta que muestra el portal, no del lead de la sesión.
    const cuentaPortal = c && c.ruta === 'C09' ? cuentasCRM().find((x) => String(x.id) === String(c.cuentaId)) : null;
    const nombre = s.lead && s.lead.name ? primerNombre(s.lead.name) : '';
    const hola = cuentaPortal ? `Hola, desde el portal de ${cuentaPortal.name}.` : (nombre ? `Hola, ${nombre}.` : 'Hola.');
    const base = 'Soy el asistente de IA de Marley Coffee: una persona del equipo revisa precios y excepciones.';
    let linea = '¿Qué necesitas resolver hoy?';
    let chips;
    if (s.proposal) {
      const estado = s.proposal.status === 'aceptada' ? 'aceptada; coordinamos la instalación' : (s.proposal.status === 'enviada' ? 'enviada al equipo' : 'lista para revisar');
      linea = `Tu propuesta ${s.proposal.id ? s.proposal.id + ' ' : ''}está ${estado}. ¿Qué quieres hacer con ella?`;
      chips = [chip('propuesta', 'Ver mi propuesta'), chip('ajustar', 'Cambiar máquina o tazas'), chip('persona', 'Hablar con una persona')];
    } else if (a.negocio) {
      const vol = volumenFrase(a.volumen);
      linea = `Veo que estás armando una propuesta para ${NEGOCIO_FRASE[a.negocio] || 'tu negocio'}${vol ? ` de ${vol} tazas al día` : ''}. ¿La revisamos?`;
      chips = [chip('propuesta', 'Ver mi propuesta'), chip('ajustar', 'Cambiar máquina o tazas'), chip('persona', 'Hablar con una persona')];
    } else {
      chips = [chip('maquina', 'Recomiéndame una máquina'), chip('carga', 'Cuánto es la carga base'), chip('comodato', 'Qué es el comodato'), chip('persona', 'Quiero hablar con una persona')];
    }
    return msg(`${hola} ${base} ${linea}`, chips);
  }

  function ayudaCliente() {
    return msg('Puedo decirte dónde va tu pedido, qué incluye, cómo firmas el contrato, cómo repites y cambiar el horario de entrega. También resuelvo dudas con información aprobada y recomiendo una máquina. Si hay una falla o un precio especial, te paso con una persona y sigo contigo mientras llega.', [
      chip('estado', 'Estado de mi pedido'), chip('incluye', 'Qué incluye mi pedido'), chip('firma', 'Cómo firmo el contrato'), chip('horario', 'Cambiar horario de entrega'), chip('maquina', 'Recomiéndame una máquina'), chip('persona', 'Hablar con una persona'),
    ]);
  }

  // Preguntas de la recomendación (mismas que C04): negocio, tazas, forma de servicio y comuna (opcional).
  // Se preguntan siempre en orden, aunque C04 haya pre-marcado valores según el tipo de negocio.
  function preguntaWizard(paso) {
    const Q = (M4() && M4().QUESTIONS) || [];
    if (paso === 'negocio') {
      const opts = ['Hotel', 'Restaurante', 'Cafetería', 'Eventos o catering', 'OCS', 'Conveniencia', 'Otro'];
      return msg('Para recomendarte una máquina necesito cuatro datos. Primero: ¿qué tipo de negocio tienes?', opts.map((o) => chip('wiz:negocio:' + o, NEGOCIO_ETIQUETA[o] || o)));
    }
    if (paso === 'volumen') {
      const vol = Q.find((q) => q.key === 'volumen');
      const opts = (vol && vol.options) || ['Menos de 50', 'De 50 a 150', 'De 150 a 400', 'Más de 400', 'No lo sé'];
      return msg('Segundo: ¿cuántas tazas sirves en un día normal?', opts.map((o, i) => chip('wiz:volumen:' + i, o)));
    }
    if (paso === 'operacion') {
      const ope = Q.find((q) => q.key === 'operacion');
      const opts = (ope && ope.options) || ['Barra con barista', 'Autoservicio', 'A la mesa o a la habitación', 'Mixto'];
      return msg('Tercero: ¿cómo sirves el café?', opts.map((o, i) => chip('wiz:operacion:' + i, o)));
    }
    const comunas = ['Vitacura', 'Providencia', 'Santiago Centro', 'Ñuñoa'];
    return msg('Último dato, opcional: ¿en qué comuna está tu local? Sirve para asignarte la ejecutiva de tu zona.', [...comunas.map((c) => chip('wiz:comuna:' + encodeURIComponent(c), c)), chip('wiz:comuna:none', 'Seguir sin comuna')]);
  }

  function recomendacionCliente(s, acciones) {
    const a = s.answers || {};
    guardarCotizacionChat();
    const rec = recomendarCon(a, { quote: s.quote || null });
    const mid = rec.machine || 'bar';
    const info = infoMaquina(mid);
    const cups = Number.isFinite(Number(rec.cups)) ? Number(rec.cups) : CUPS_DE(a.volumen);
    const texto = `Con tus respuestas, la máquina sugerida es ${info.nombre}: ${info.tipo.toLowerCase()}. ${info.atencion ? 'Atención: ' + info.atencion.toLowerCase() + '.' : ''} Es una sugerencia del motor de recomendación de Marley Coffee; la propuesta exacta la confirma tu ejecutivo.`;
    acciones.push({ tipo: 'recomendacion', maquina: mid, tazas: cups, nivel: 'ia' });
    return msg(texto, [
      chip('propuesta', 'Ver mi propuesta con esta máquina'), chip('ajustar', 'Cambiar máquina o tazas'), chip('persona', 'Hablar con una persona'),
    ], [{ tipo: 'ficha', titulo: 'Máquina sugerida', filas: [['Máquina', info.nombre], ['Tipo', info.tipo], ['Tazas al día (referencia)', info.tazas || '—'], ['Atención', info.atencion || '—']], nota: 'Sugerencia del motor de recomendación. Se ajusta con tus respuestas.' }]);
  }

  function cotizacionCliente(s) {
    const q = s.quote || {};
    const p = s.proposal || null;
    const rec = recomendarCon(s.answers || {}, { quote: s.quote || null });
    const machine = (p && p.machine) || q.machine || rec.machine || 'bar';
    const cups = p && p.cups != null ? p.cups : (q.cups != null ? q.cups : (Number.isFinite(Number(rec.cups)) ? Number(rec.cups) : CUPS_DE((s.answers || {}).volumen)));
    const services = (p && Array.isArray(p.services) ? p.services : Array.isArray(q.services) ? q.services : []).slice();
    return { machine, cups, services, days: (p && p.days) || 26, mode: 'comodato', origen: p ? 'propuesta' : (q.machine ? 'ajuste' : 'recomendacion'), propuestaId: p ? p.id || null : null, estado: p ? p.status || null : null };
  }
  // Total neto de la propuesta: el mismo número que muestran C05 y «Mi cotización» (el prototipo lo calcula en un solo lugar).
  function totalPropuesta() {
    return seguro(() => (typeof window.MC_TOTAL_PROPUESTA === 'function' ? window.MC_TOTAL_PROPUESTA(estadoProto()) : null), null);
  }
  function tarjetaCotizacion(cot, titulo = 'Tu propuesta en comodato') {
    const info = infoMaquina(cot.machine);
    const est = seguro(() => (D4() && cot.cups ? D4().estimate({ machine: cot.machine, cups: cot.cups, days: cot.days || 26, services: cot.services || [] }) : null), null);
    const consumo = est && Number.isFinite(est.units) ? `${String(est.units).replace('.', ',')} ${est.unit} al mes (estimado con ${cot.cups} tazas al día)` : 'Por confirmar con tu ejecutivo';
    return {
      tipo: 'cotizacion', titulo, totalPropuesta: estadoProto().proposal ? totalPropuesta() : null,
      maquina: { id: info.id, nombre: info.nombre, tipo: info.tipo, tazas: info.tazas },
      tazas: cot.cups != null ? cot.cups : null, consumo,
      lineas: lineasPrecio().map((l) => ({ t: l.t, d: l.d, precio: l.precio })),
      cargaBase: { kit: kitPrecio(), filtro: filtroPrecio(), insumos: insumosRef(), total: cargaBase() },
      pendientes: aConfirmar(), nota: (PRECIOS && PRECIOS.nota_cliente) || 'Precios netos referenciales; los confirma tu ejecutivo.',
    };
  }

  function respuestaFaqComodato() {
    return faqPor('comodato') || 'Marley Coffee presta la máquina en comodato y el cliente compra insumos mensualmente.';
  }
  function tarjetaCargaBase() {
    return {
      tipo: 'lista', titulo: 'Carga base antes de instalar (referencia, netos + IVA)',
      items: [
        { t: 'Kit de instalación', v: fmt(kitPrecio()) },
        { t: 'Filtro', v: fmt(filtroPrecio()) },
        { t: 'Paquete de insumos de referencia', v: fmt(insumosRef()) },
        { t: 'Total antes de instalar', v: fmt(cargaBase()), fuerte: true },
      ],
      nota: 'No es una mensualidad. El mínimo mensual, el plazo de entrega y la compatibilidad de insumos con cada máquina los confirma tu ejecutivo.',
    };
  }
  function tarjetaProductos(filtro) {
    const lineas = lineasPrecio().filter((l) => !filtro || l.k === filtro || sinTildes(l.t).includes(filtro));
    return {
      tipo: 'lista', titulo: 'Insumos con precio de referencia (netos + IVA)',
      items: lineas.map((l) => ({ t: l.t, d: l.d, v: fmt(l.precio) })),
      nota: (PRECIOS && PRECIOS.sin_precio_canonico) || 'Los demás productos se ven con tu ejecutivo.',
    };
  }

  // Pedidos del comprador: los de su cuenta (la que muestra el portal, C09) o, si no hay cuenta, los del estado de M4.
  function pedidosDeComprador(c, s) {
    if (s.customerCycle && String(s.lead?.id) === String(c?.cuentaId)) return s.customerCycle.orders || [];
    const acc = cuentasCRM().find((a) => String(a.id) === String(c && c.cuentaId));
    if (acc && Array.isArray(acc.orders) && acc.orders.length) return acc.orders;
    return Array.isArray(s.orders) ? s.orders : (s.order ? [s.order] : []);
  }
  function estadoPedidoCliente(c, s) {
    const pedidos = pedidosDeComprador(c, s);
    if (pedidos.length) {
      const o = pedidos[pedidos.length - 1];
      return { pedido: o, texto: `Tu último pedido (${o.id || 'sin folio'}) está en estado «${o.status || 'en proceso'}». El equipo confirma precio, disponibilidad y despacho.` };
    }
    if (s.proposal && s.proposal.status === 'aceptada') {
      const etapa = s.customerCycle?.replenishmentNotice ? 'En preparación' : s.customerCycle?.contractSignedAt ? 'Contrato firmado' : 'Confirmado';
      return { pedido: null, texto: `Tu pedido está en la etapa «${etapa}». Puedes seguirlo en «Mi pedido». El equipo confirma la fecha de instalación.` };
    }
    if (s.proposal) {
      return { pedido: null, texto: `Tu propuesta está ${s.proposal.status === 'enviada' ? 'enviada al equipo' : 'lista para revisar'}. Cuando la aceptes, el seguimiento aparece aquí.` };
    }
    return { pedido: null, texto: 'Todavía no tienes un pedido en esta prueba. Cuando aceptes una propuesta, el seguimiento aparece aquí.' };
  }

  function resumenClienteTexto(s, motivo) {
    const a = s.answers || {};
    const cot = cotizacionCliente(s);
    const partes = [
      `Contacto: ${(s.lead && s.lead.name) || 'sin nombre registrado'}${s.lead && s.lead.company ? ' · ' + s.lead.company : ''}`,
      `Negocio: ${NEGOCIO_ETIQUETA[a.negocio] || a.negocio || 'sin dato'}${a.comuna ? ' · ' + a.comuna : ''}`,
      `Tazas al día: ${a.volumen || 'sin dato'}`,
      `Máquina: ${nombreMaquina(cot.machine)}`,
      `Propuesta: ${s.proposal ? (s.proposal.status || 'lista') : 'sin propuesta aceptada'}`,
      `Motivo de la derivación: ${motivo}`,
      'El comprador no recibió precios especiales ni plazos nuevos.',
    ];
    return partes.join('\n');
  }

  // ---------- Espera de una persona: el agente sigue atendiendo mientras llega (Soporte o Ventas) ----------
  // El traspaso con «espera» queda en estado «esperando» hasta que alguien del equipo la toma («tomada»).
  const PASOS_ESPERA = { falla: ['foto', 'horario', 'direccion'], precio: ['detalle', 'cuando'], persona: [] };
  const DESTINO_ESPERA = { falla: 'soporte', precio: 'ventas', persona: 'ventas' };
  const MOTIVO_ESPERA = { falla: 'Falla o reclamo de la máquina', precio: 'Precio especial o crédito', persona: 'Pide hablar con una persona' };
  const HORARIO_OPC = { manana: 'En la mañana', tarde: 'En la tarde', flex: 'Me acomoda cualquiera' };
  const CUANDO_OPC = { semana: 'Esta semana', mes: 'Este mes', averiguo: 'Solo averiguo' };
  const PENDIENTE = { foto: 'la foto de la falla', horario: 'el horario de la visita', direccion: 'la dirección del local', detalle: 'lo que necesitas', cuando: 'cuándo te escriben' };
  const NO_ES_DATO = ['cierre', 'saludo', 'ayuda', 'baja', 'trampa'];
  const INTENCION_PERSONA = ['persona', 'soporte', 'negociar', 'persona_ventas'];
  const PESTANAS = { pedido: 'Mi pedido', repetir: 'Repetir pedido', ayuda: 'Ayuda y postventa', recomendar: 'Recomendar' };
  const quienAtiende = (t) => (t && t.tomadoPor) || 'una persona de Soporte';
  const quienEspera = (t) => (t && t.a === 'ventas' ? 'una persona de Ventas' : 'una persona de Soporte');
  function esperaDe(cuentaId) {
    const k = String(cuentaId);
    const lista = leerEstado().traspasos.filter((t) => t.espera && String(t.leadId) === k && t.de === 'cliente');
    return lista.length ? lista[lista.length - 1] : null;
  }
  // Lo que ve el comprador: «esperando-persona» (falta alguien) o «persona-unida» (ya la atiende el equipo).
  function estadoEspera(cuentaId) {
    const t = esperaDe(cuentaId);
    if (!t) return { estado: null, traspaso: null };
    if (t.estado === 'esperando') return { estado: 'esperando-persona', traspaso: t };
    if (t.estado === 'tomada') return { estado: 'persona-unida', traspaso: t };
    return { estado: null, traspaso: t };
  }
  function nombreCuenta(cuentaId, s) {
    const acc = cuentasCRM().find((a) => String(a.id) === String(cuentaId));
    if (acc) return acc.business ? `${acc.name} (${acc.business})` : acc.name;
    const l = s && s.lead ? s.lead : null;
    return (l && (l.company || l.name)) || 'el comprador';
  }
  function resumenEspera(t, cuenta) {
    const esp = t.espera || {};
    const d = esp.datos || {};
    const partes = [`${MOTIVO_ESPERA[esp.tema] || 'Consulta'} de ${cuenta}.`];
    if (esp.tema === 'falla') partes.push(`Foto: ${d.foto === 'si' ? 'sí (simulada)' : d.foto === 'no' ? 'no la tiene ahora' : 'pendiente'}.`, `Horario: ${d.horario || 'pendiente'}.`, `Dirección: ${d.direccion || 'pendiente'}.`);
    if (esp.tema === 'precio') partes.push(`Condición que busca: ${d.detalle || 'pendiente'}.`, `Cuándo: ${d.cuando || 'pendiente'}.`);
    if (esp.tema === 'persona' && d.detalle) partes.push(`Lo que necesita: ${d.detalle}.`);
    return partes.join(' ');
  }
  function filasEspera(esp) {
    const d = esp.datos || {};
    if (esp.tema === 'falla') return [['Motivo', MOTIVO_ESPERA.falla], ['Foto', d.foto === 'si' ? 'Sí (simulada)' : d.foto === 'no' ? 'No la tiene ahora' : 'Pendiente'], ['Horario', d.horario || 'Pendiente'], ['Dirección', d.direccion || 'Pendiente']];
    if (esp.tema === 'precio') return [['Motivo', MOTIVO_ESPERA.precio], ['Condición que busca', d.detalle || 'Pendiente'], ['Cuándo', d.cuando || 'Pendiente']];
    return [['Motivo', MOTIVO_ESPERA.persona], ['Lo que necesita', d.detalle || 'Sin detalle']];
  }
  function preguntaEspera(esp) {
    const paso = esp.paso;
    if (paso === 'foto') return msg('¿Puedes mandarme una foto de la falla? Así la persona llega con lo que necesita. Es una simulación: no se sube ninguna imagen real.', [chip('espera:foto:si', 'Adjuntar foto (simulación)'), chip('espera:foto:no', 'No tengo foto ahora')]);
    if (paso === 'horario') return msg('¿En qué horario te acomoda que te visiten?', Object.keys(HORARIO_OPC).map((k) => chip('espera:horario:' + k, HORARIO_OPC[k])));
    if (paso === 'direccion') return msg('¿En qué dirección está el local? Escríbela aquí; la persona la necesita para llegar.');
    if (paso === 'detalle') return msg(esp.tema === 'precio' ? 'Cuéntame en una frase qué condición buscas. No prometo precios: lo revisa Ventas.' : 'Cuéntame en una frase qué necesitas que resuelva la persona.');
    if (paso === 'cuando') return msg('¿Cuándo te acomoda que te escriban?', Object.keys(CUANDO_OPC).map((k) => chip('espera:cuando:' + k, CUANDO_OPC[k])));
    return null;
  }
  function recordatorioEspera(t) {
    return msg(`Sigo contigo mientras llega ${quienEspera(t)}. Nos falta ${PENDIENTE[t.espera.paso] || 'un dato'}.`, [chip('espera:seguir', 'Seguir con eso')]);
  }
  function iniciarEspera(c, s, tema, acciones) {
    const destino = DESTINO_ESPERA[tema];
    const pasos = PASOS_ESPERA[tema].slice();
    const cuenta = nombreCuenta(c.cuentaId, s);
    const folio = tema === 'falla' ? 'SOP-' + ahora().toString(36).slice(-5).toUpperCase() : null;
    const esp = { tema, pasos, paso: pasos[0] || null, datos: {}, folio };
    const t = traspasoNuevo({
      leadId: c.cuentaId, de: 'cliente', a: destino, tipo: tema === 'falla' ? 'soporte' : 'venta', estado: 'esperando', espera: esp,
      resumen: '', aviso: `${destino === 'soporte' ? 'Soporte' : 'Ventas'}: ${MOTIVO_ESPERA[tema].toLowerCase()} · ${cuenta}`,
    });
    const e = leerEstado();
    const tr = e.traspasos.find((x) => x.id === t.id);
    if (tr) { tr.resumen = resumenEspera(tr, cuenta); guardarEstado(e); }
    registrar({ ts: t.ts, rol: 'comprador', accion: 'derivar-' + destino, datoUsado: MOTIVO_ESPERA[tema], sugerencia: 'Derivar a una persona y seguir atendiendo', nivel: 'regla', decidio: 'comprador' });
    acciones.push({ tipo: 'espera', tema, destino, traspasoId: t.id, folio });
    const intro = {
      falla: `Lamento la falla${folio ? ' (solicitud ' + folio + ')' : ''}. Te paso con una persona de Soporte; mientras llega, sigo contigo.`,
      precio: 'Los precios especiales y el crédito los revisa una persona de Ventas; yo no los puedo ofrecer. Te paso con una persona; mientras llega, sigo contigo.',
      persona: 'Te paso con una persona de Ventas. Ya tiene tu resumen: no tienes que repetir nada. Mientras llega, sigo contigo.',
    }[tema];
    const mensajes = [msg(intro, [])];
    if (pasos.length && tr) mensajes.push(preguntaEspera(tr.espera));
    return res(mensajes, acciones, reg('Derivación a una persona con resumen', 'Derivar y seguir atendiendo', 'regla'));
  }
  // Lee la respuesta del comprador para el paso pendiente. Chip («espera:…») o texto tolerante; null si no responde ese paso.
  function valorPaso(paso, opcion, texto) {
    if (opcion) {
      const [tipo, a, b] = String(opcion).split(':');
      if (tipo !== 'espera') return null;
      if (paso === 'foto' && a === 'foto') return b === 'si' ? 'si' : (b === 'no' ? 'no' : null);
      if (paso === 'horario' && a === 'horario') return HORARIO_OPC[b] || null;
      if (paso === 'cuando' && a === 'cuando') return CUANDO_OPC[b] || null;
      return null;
    }
    const t = sinTildes(texto || '').trim();
    if (!t) return null;
    if (paso === 'foto') {
      if (/\b(no tengo|sin foto|no puedo|no la tengo|ahora no|no hay)\b/.test(t) || /^no\b/.test(t)) return 'no';
      if (/\b(foto|imagen|adjunt|te la mando|te la envio|listo)\b/.test(t) || /^(si|ok|dale|claro)\b/.test(t)) return 'si';
      return null;
    }
    if (paso === 'horario') {
      if (/manana/.test(t)) return HORARIO_OPC.manana;
      if (/tarde/.test(t)) return HORARIO_OPC.tarde;
      if (/cualquier|flexib|acomoda|da igual|lo que sea/.test(t)) return HORARIO_OPC.flex;
      return null;
    }
    if (paso === 'cuando') {
      if (/semana/.test(t)) return CUANDO_OPC.semana;
      if (/\bmes\b/.test(t)) return CUANDO_OPC.mes;
      if (/averig|mirando|pronto|solo ver|todavia no/.test(t)) return CUANDO_OPC.averiguo;
      return null;
    }
    const it = detectar(t, INTENCIONES_CLIENTE);
    if (NO_ES_DATO.includes(it)) return null;
    if (paso === 'direccion') return t.length >= 6 && /[a-z]/.test(t) ? String(texto).trim().slice(0, 160) : null;
    if (paso === 'detalle') return t.length >= 4 ? String(texto).trim().slice(0, 200) : null;
    return null;
  }
  function avanzarEspera(c, s, t, paso, valor, acciones) {
    const e = leerEstado();
    const tr = e.traspasos.find((x) => x.id === t.id);
    if (!tr || !tr.espera) return null;
    tr.espera.datos[paso] = valor;
    tr.espera.paso = tr.espera.pasos[tr.espera.pasos.indexOf(paso) + 1] || null;
    tr.resumen = resumenEspera(tr, nombreCuenta(c.cuentaId, s));
    guardarEstado(e);
    emitir('traspaso', tr);
    if (tr.espera.paso) return res([preguntaEspera(tr.espera)], acciones, reg('Dato que dio el comprador: ' + paso, 'Pedir el siguiente dato', 'regla'));
    registrar({ ts: ahora(), rol: 'comprador', accion: 'espera-resumen', datoUsado: tr.resumen, sugerencia: 'Esperar a la persona con el resumen', nivel: 'persona', decidio: 'comprador' });
    const lo = tr.espera.tema === 'falla' ? `${quienEspera(tr)} verá tu resumen (falla, foto, horario y dirección); no tienes que repetirlo` : `${quienEspera(tr)} verá tu resumen con la condición que buscas; no prometo precios`;
    return res([msg(`Listo: ya tengo lo necesario. ${lo.charAt(0).toUpperCase() + lo.slice(1)}. Mientras llega, sigo contigo.`, [chip('estado', 'Ver el estado'), chip('ayuda', 'Hacer otra consulta')], [{ tipo: 'ficha', titulo: 'Resumen para la persona', filas: filasEspera(tr.espera) }])], acciones, reg('Resumen de la conversación', 'Esperar a la persona con el resumen', 'persona'));
  }
  // Con una espera abierta: primero los pasos que pidió la persona; luego, la conversación normal (el agente sigue atendiendo).
  function responderConEspera(c, s, t, texto, opcion, acciones) {
    const esp = t.espera || {};
    const reg0 = (datoUsado, nivel = 'regla') => reg(datoUsado, 'Respuesta aprobada del prototipo', nivel);
    const it = !opcion && texto ? detectar(texto, INTENCIONES_CLIENTE) : (opcion || null);
    const pidePersona = INTENCION_PERSONA.includes(it);
    if (opcion && String(opcion).indexOf('espera:') === 0) {
      const [, a] = String(opcion).split(':');
      if (a === 'seguir') return esp.paso ? res([preguntaEspera(esp)], acciones, reg0('Dato pendiente de la persona')) : res([msg('Ya tengo lo necesario. Mientras llega la persona, sigo contigo.', [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Resumen completo'));
      if (t.estado !== 'esperando' || !esp.paso) return res([msg('Esa respuesta ya no hace falta. Sigo contigo.', [chip('ayuda', 'Ver opciones')])], acciones, reg0('Respuesta de espera no vigente'));
      const v = valorPaso(esp.paso, opcion, '');
      if (v === null) return res([preguntaEspera(esp)], acciones, reg0('Opción no reconocida'));
      return avanzarEspera(c, s, t, esp.paso, v, acciones);
    }
    if (t.estado === 'tomada') {
      if (pidePersona) return res([msg(`Ya te atiende ${quienAtiende(t)}. Tu mensaje queda en la conversación.`, [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Persona ya en la conversación', 'persona'));
      return null;
    }
    if (esp.paso) {
      const v = valorPaso(esp.paso, opcion, texto);
      if (v !== null) return avanzarEspera(c, s, t, esp.paso, v, acciones);
    }
    if (pidePersona) {
      return res([msg(`Ya tienes ${quienEspera(t)} en camino. Sigo contigo: ${esp.paso ? 'nos falta ' + (PENDIENTE[esp.paso] || 'un dato') + '.' : 'tu resumen ya está listo.'}`, esp.paso ? [chip('espera:seguir', 'Seguir con eso')] : [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Solicitud abierta: no se duplica'));
    }
    return null;
  }
  // Horario de entrega: el cambio queda solicitado; Logística confirma el día y la hora (no se prometen).
  function preguntaHorario() {
    return msg('Puedo dejar solicitado el cambio de horario de entrega. ¿En qué franja te acomoda?', [chip('horario:manana', 'En la mañana'), chip('horario:tarde', 'En la tarde'), chip('ayuda', 'Cancelar')]);
  }
  function solicitarHorario(c, s, franja, acciones) {
    const etiqueta = franja === 'tarde' ? 'la tarde' : 'la mañana';
    const t = traspasoNuevo({ leadId: c.cuentaId, de: 'cliente', a: 'ventas', tipo: 'horario', estado: 'solicitud', resumen: `Cambio de horario de entrega pedido por el comprador: ${etiqueta}. Logística confirma día y hora según la ruta de la zona.`, aviso: `Cambio de horario de entrega (${etiqueta}): confirmar con Logística` });
    acciones.push({ tipo: 'horario', franja, traspasoId: t.id });
    registrar({ ts: t.ts, rol: 'comprador', accion: 'cambio-horario', datoUsado: 'Franja elegida por el comprador', sugerencia: 'Confirmar con Logística antes de prometer la hora', nivel: 'persona', decidio: 'comprador' });
    return res([msg(`Dejé solicitado el cambio a ${etiqueta}. Logística confirma el día y la hora exacta según la ruta de tu zona; no te prometo un horario que todavía no esté confirmado.`, [chip('estado', 'Ver el estado'), chip('ayuda', 'Hacer otra consulta')], [{ tipo: 'folio', folio: t.id, estado: 'Solicitud registrada', siguiente: 'Logística confirma el día y la hora.' }])], acciones, reg('Franja elegida por el comprador', 'Solicitud de horario', 'persona'));
  }
  function respuestaIncluye(c, s, acciones, reg0) {
    const pedidos = pedidosDeComprador(c, s);
    if (pedidos.length) {
      const o = pedidos[pedidos.length - 1];
      const filas = (o.items || []).map((i) => [nombreProducto(i.p), `${i.qty} u.`]);
      return res([msg(`Tu pedido ${o.id || ''} incluye los productos de la lista y la máquina en comodato. Antes de instalar se paga la carga base de referencia.`, [chip('estado', 'Ver el estado'), chip('repetir', 'Repetir mi pedido'), chip('carga', 'Cuánto es la carga base')], [{ tipo: 'ficha', titulo: 'Lo que incluye tu pedido', filas: filas.length ? filas : [['Productos', 'Sin detalle en el registro']] }, tarjetaCargaBase()])], acciones, reg0('Pedido del comprador y carga base del prototipo'));
    }
    if (s.proposal) return res([msg('Tu propuesta incluye la máquina en comodato y los insumos de referencia. Antes de instalar se paga la carga base de referencia.', [chip('propuesta', 'Ver mi propuesta'), chip('carga', 'Cuánto es la carga base')], [tarjetaCargaBase()])], acciones, reg0('Propuesta del comprador y carga base'));
    return res([msg('Todavía no hay un pedido ni una propuesta. Cuando armes tu propuesta, te muestro qué incluye.', [chip('maquina', 'Recomiéndame una máquina')])], acciones, reg0('Sin pedido ni propuesta'));
  }
  function respuestaFirma(c, s, acciones, reg0) {
    const hay = pedidosDeComprador(c, s).length > 0 || Boolean(s.proposal && s.proposal.status === 'aceptada');
    if (!hay) return res([msg('Todavía no hay un contrato para firmar. Cuando aceptes tu pack o tu propuesta, el contrato de comodato aparece en «Mi pedido».', [chip('propuesta', 'Ver mi propuesta'), chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Contrato aún no disponible'));
    return res([msg('Puedes firmar el contrato de comodato desde «Mi pedido», con el botón «Firmar contrato (simulación)». Abre el resumen con los textos del contrato y, al firmar, la franja de llegada avanza. Es una simulación: no firmas nada real.', [chip('ir:pedido', 'Ir a Mi pedido'), chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Textos de comodato del prototipo'));
  }
  // Navegación del portal: el agente pide a la página que abra la pestaña (acción «ir-pestana»).
  function irPestana(p, acciones, reg0) {
    if (!PESTANAS[p]) return res([msg('Esa pestaña ya no está disponible. Elige otra opción.', [chip('ayuda', 'Ver opciones')])], acciones, reg0('Pestaña no vigente'));
    acciones.push({ tipo: 'ir-pestana', pestana: p });
    return res([msg(`Te llevo a «${PESTANAS[p]}».`, [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Pestaña del portal'));
  }

  // Si hay una captura de datos en curso, sus respuestas van primero; lo demás sigue por el camino normal.
  function responderCliente(c, texto, opcion) {
    const s = estadoProto();
    migrarConversacion(c.cuentaId);
    const acciones = [];
    const reg0 = (datoUsado, nivel = 'regla') => reg(datoUsado, 'Respuesta aprobada del prototipo', nivel);
    const cap = puedeCapturar(c) ? capturaDe(c.cuentaId) : null;
    if (cap) {
      if (opcion && opcion.indexOf('cap:') === 0) return responderCaptura(c, s, cap, opcion, '', acciones);
      if (!opcion && capturaEsDato(cap, s, texto)) return responderCaptura(c, s, cap, '', texto, acciones);
      if (!opcion && detectar(texto, INTENCIONES_CLIENTE) === 'baja') return bajaCliente(c, s, acciones);
      const salida = responderClienteNormal(c, s, texto, opcion, acciones, reg0);
      salida.mensajes.push(preguntaCaptura(cap, s));
      return salida;
    }
    // Con una persona en camino (o en la conversación), la espera manda; si no responde, sigue la conversación normal.
    const espera = esperaDe(c.cuentaId);
    const viva = espera && (espera.estado === 'esperando' || espera.estado === 'tomada') ? espera : null;
    if (viva) {
      const previa = responderConEspera(c, s, viva, texto, opcion, acciones);
      if (previa) return previa;
    }
    const salida = responderClienteNormal(c, s, texto, opcion, acciones, reg0);
    if (viva && viva.estado === 'esperando' && viva.espera.paso) salida.mensajes.push(recordatorioEspera(viva));
    return salida;
  }
  function responderClienteNormal(c, s, texto, opcion, acciones, reg0) {
    if (opcion) return despacharOpcionCliente(c, s, opcion, acciones, reg0);
    // «Repetir» gana sobre «pedido»: «quiero repetir mi último pedido» no es una consulta de estado.
    const it = /\b(repet|repit|reposic|repon|volver a pedir|pedir de nuevo)/.test(sinTildes(texto)) ? 'repetir' : detectar(texto, INTENCIONES_CLIENTE);
    switch (it) {
      case 'trampa':
        return res([msg('No comparto costos internos ni datos de otros clientes. Puedo ayudarte con lo publicado: productos, carga base y tu propuesta.', [chip('productos', 'Ver productos y precios'), chip('propuesta', 'Ver mi propuesta')])], acciones, reg0('Regla de privacidad y de precios publicados'));
      case 'negociar':
        return iniciarEspera(c, s, 'precio', acciones);
      case 'baja':
        return bajaCliente(c, s, acciones);
      case 'soporte':
        return iniciarEspera(c, s, 'falla', acciones);
      case 'incluye':
        return respuestaIncluye(c, s, acciones, reg0);
      case 'firma':
        return respuestaFirma(c, s, acciones, reg0);
      case 'horario':
        return res([preguntaHorario()], acciones, reg0('Franja de entrega del comprador', 'Pedir franja y confirmar con Logística', 'regla'));
      case 'persona':
        return pedirDatosOPasar(c, s, 'persona', 'Quiero hablar con una persona', acciones);
      case 'referido':
        return ofrecerReferido(acciones);
      case 'contacto':
        return ofrecerCanal(c, s, acciones);
      case 'repetir':
        return ofrecerRepetir(c, s, acciones);
      case 'estado': {
        const e = estadoPedidoCliente(c, s);
        return res([msg(e.texto, [chip('repetir', 'Repetir mi pedido'), chip('soporte', 'Abrir una solicitud de soporte'), chip('referido', 'Recomendar a otro negocio')], e.pedido ? [{ tipo: 'ficha', titulo: 'Seguimiento', filas: [['Folio', e.pedido.id || '—'], ['Estado', e.pedido.status || '—']] }] : [])], acciones, reg0('Estado del portal y de la propuesta'));
      }
      case 'despacho': {
        const fq = faqPor('despachan') || faqPor('santiago');
        return res([msg(`${fq || 'Despachamos en la Región Metropolitana por ruta según la comuna; en regiones, por transporte.'} El plazo exacto lo confirma tu ejecutivo.`, [chip('persona', 'Hablar con una persona'), chip('maquina', 'Recomiéndame una máquina')])], acciones, reg0('Respuesta aprobada del FAQ'));
      }
      case 'comodato':
        return res([msg(respuestaFaqComodato(), [chip('carga', 'Cuánto es la carga base'), chip('maquina', 'Recomiéndame una máquina')])], acciones, reg0('FAQ aprobado: comodato'));
      case 'carga':
        return res([msg('Antes de instalar se paga una carga base de referencia. Aquí va el detalle, con los precios aprobados del prototipo.', [chip('productos', 'Ver productos y precios'), chip('persona', 'Hablar con una persona')], [tarjetaCargaBase()])], acciones, reg0('precios_cotizacion_19oct.json'));
      case 'organico': {
        const fq = faqPor('organico');
        return res([msg(fq || 'Parte del catálogo es orgánico certificado.', [chip('productos', 'Ver productos y precios')])], acciones, reg0('FAQ aprobado: orgánico'));
      }
      case 'eventos': {
        const fq = faqPor('eventos');
        return res([msg(fq || 'Sí, hacemos eventos y catering con la marca.', [chip('persona', 'Hablar con una persona')])], acciones, reg0('FAQ aprobado: eventos'));
      }
      case 'productos': {
        const mid = maquinaEn(texto);
        if (mid || /maquina|equipo/.test(limpio(texto))) {
          return res([msg('La máquina va en comodato: Marley la presta y tú compras los insumos. Lo que se paga antes de instalar es la carga base de referencia.', [chip('carga', 'Ver la carga base'), chip('maquina', 'Recomiéndame una máquina')], [tarjetaCargaBase()])], acciones, reg0('FAQ modalidad y precios aprobados'));
        }
        const prod = lineasPrecio().find((l) => sinTildes(texto).includes(sinTildes(l.t).split(' ')[0]) || sinTildes(texto).includes(l.k));
        const tarjeta = tarjetaProductos(prod ? prod.k : null);
        return res([msg(prod ? `${prod.t}: ${fmt(prod.precio)} netos + IVA (${prod.d}). Precio de referencia de la cotización del 19-oct-2026; lo confirma tu ejecutivo.` : 'Estos son los insumos con precio de referencia. Los precios son netos + IVA.', [chip('carga', 'Cuánto es la carga base'), chip('maquina', 'Recomiéndame una máquina')], [tarjeta])], acciones, reg0('precios_cotizacion_19oct.json'));
      }
      case 'propuesta':
        return res([msg('Esta es tu propuesta con la máquina y las tazas que tienes guardadas. Si quieres cambiar algo, dímelo.', [chip('ajustar', 'Cambiar máquina o tazas'), chip('persona', 'Hablar con una persona')], [tarjetaCotizacion(cotizacionCliente(s))])], acciones, reg0('Cotización guardada en el prototipo'));
      case 'ajustar':
        return ajustarCliente(c, s, texto, acciones);
      case 'maquina':
        return res([preguntaWizard('negocio')], acciones, reg0('Inicio del diagnóstico de cuatro preguntas'));
      case 'condiciones':
        return res([msg('Las condiciones comerciales, el mínimo mensual, el plazo de entrega y la compatibilidad de insumos con cada máquina las confirma tu ejecutivo. No las invento aquí.', [chip('persona', 'Hablar con una persona'), chip('carga', 'Cuánto es la carga base')])], acciones, reg0('Lista de pendientes a confirmar'));
      case 'ayuda':
        return res([ayudaCliente()], acciones, reg0('Menú del agente'));
      case 'cierre':
        return res([msg(cierreCliente(s), [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Cierre con estado y siguiente paso'));
      case 'saludo':
        return res([saludoCliente(c, s)], acciones, reg0('Contexto del comprador'));
      default:
        return noEntendi(c, s, acciones);
    }
  }

  function cierreCliente(s) {
    const cot = s.proposal ? `Tu propuesta ${s.proposal.id || ''} queda ${s.proposal.status === 'aceptada' ? 'aceptada' : 'guardada'}.` : 'Tu consulta queda guardada en esta prueba.';
    const paso = s.proposal && s.proposal.status === 'aceptada' ? 'Siguiente paso: coordinar la instalación con tu ejecutiva.' : 'Siguiente paso: revisar tu propuesta cuando te acomode.';
    return `Gracias. ${cot} ${paso}`;
  }

  function noEntendi(c, s, acciones) {
    const previa = historial(c.cuentaId, 2).filter((m) => m.rol === 'agente');
    const ultima = previa[previa.length - 1];
    if (ultima && ultima.noEntendi) {
      return res([msg('Sigo sin entender. Te paso con una persona del equipo con un resumen de lo que escribiste, para que no repitas nada.', [chip('persona_ventas', 'Sí, pásalo a Ventas'), chip('ayuda', 'Ver opciones')])], acciones, reg('Regla: a la segunda, ofrecer persona', 'regla'));
    }
    return res([Object.assign(msg('No tengo una respuesta aprobada para eso. ¿Te refieres a alguna de estas opciones?', [chip('maquina', 'Recomiéndame una máquina'), chip('carga', 'Cuánto es la carga base'), chip('persona', 'Hablar con una persona')]), { noEntendi: true })], acciones, reg('Recuperación digna: una sola vez con opciones', 'regla'));
  }

  function ofrecerDerivacion(c, s, motivo, acciones) {
    return res([msg('Puedo pasar tu caso a Ventas con un resumen, para que no repitas tu historia. Antes de enviarlo, ¿lo confirmas?', [chip('persona_ventas', 'Sí, pásalo a Ventas'), chip('ayuda', 'Todavía no')], [{ tipo: 'ficha', titulo: 'Resumen que recibiría Ventas', filas: [['Motivo', motivo]], nota: resumenClienteTexto(s, motivo) }])], acciones, reg('Resumen de la conversación', 'Derivar a una persona', 'persona'));
  }

  function abrirSoporte(c, s, acciones) {
    return iniciarEspera(c, s, 'falla', acciones);
  }

  function ofrecerReferido(acciones) {
    return res([msg('Gracias por pensar en otro negocio. ¿A cuál recomiendas? Solo lo contactamos si esa persona nos da permiso.', [chip('ref:hotel', 'Un hotel'), chip('ref:restaurante', 'Un restaurante'), chip('ref:cafeteria', 'Una cafetería'), chip('ref:oficina', 'Una oficina')])], acciones, reg('Regla: referidos con permiso', 'regla'));
  }

  function ofrecerCanal(c, s, acciones) {
    if (puedeCapturar(c) && !identificadoEstado(s)) return iniciarCaptura(c, s, 'contacto', acciones);
    const cons = consentimientoDe(c.cuentaId);
    const tieneCorreo = !!(s.lead && s.lead.email);
    const texto = cons.whatsapp || cons.correo
      ? `Ya tenemos tu permiso${cons.whatsapp ? ' para WhatsApp' : ''}${cons.correo ? ' para correo' : ''}. ¿Por cuál canal te escribimos?`
      : 'Puedo seguir por WhatsApp o por correo, pero solo si me das tu permiso. ¿Lo autorizas?';
    const chips = [chip('consent:whatsapp:si', 'Sí, por WhatsApp'), chip('consent:correo:si', 'Sí, por correo'), chip('consent:no', 'No, gracias')];
    if (cons.whatsapp) chips.unshift(chip('envio:whatsapp', 'Enviarme la vista previa por WhatsApp'));
    if (cons.correo || tieneCorreo) chips.unshift(chip('envio:correo', 'Enviarme la vista previa por correo'));
    return res([msg(texto, chips)], acciones, reg('Consentimiento del contacto', 'Seguir por otro canal con permiso', 'persona'));
  }

  function vistaPreviaCanal(c, s, canal) {
    const nombre = s.lead && s.lead.name ? primerNombre(s.lead.name) : '';
    const cot = cotizacionCliente(s);
    const texto = `${nombre ? 'Hola ' + nombre + ', ' : 'Hola, '}te escribimos de Marley Coffee Empresas. Tu propuesta de ${nombreMaquina(cot.machine)} queda guardada: revísala cuando te acomode. Las condiciones se confirman con tu ejecutivo. Si no quieres recibir más mensajes, responde BAJA.`;
    return texto;
  }

  function ajustarCliente(c, s, texto, acciones) {
    const mid = maquinaEn(texto);
    const n = numeroEn(texto);
    if (!mid && (n === null || n <= 0)) {
      return res([msg('¿Qué quieres cambiar: la máquina o las tazas al día?', [chip('ajustar:maquina', 'Cambiar máquina'), chip('ajustar:tazas', 'Cambiar tazas al día')])], acciones, reg('Pregunta de ajuste', 'regla'));
    }
    if (mid) return cambiarMaquina(c, s, mid, acciones);
    return cambiarTazas(c, s, n, acciones);
  }
  function cambiarMaquina(c, s, mid, acciones) {
    const cot = cotizacionCliente(s);
    const cambio = { machine: mid };
    cambiarPropuesta(s, cambio, acciones, 'machine');
    const nueva = cotizacionCliente(estadoProto());
    acciones.push({ tipo: 'cotizacion', maquina: mid, tazas: nueva.cups, nivel: 'persona' });
    registrar({ rol: 'comprador', accion: 'cambiar-maquina', datoUsado: 'Máquina elegida por el comprador', sugerencia: 'Sugerencia previa: ' + nombreMaquina(cot.machine), nivel: 'persona', decidio: 'comprador' });
    return res([msg(`Listo: cambié la máquina a ${nombreMaquina(mid)}. Lo ves reflejado en «Mi cotización» y en tu propuesta. Los precios siguen siendo de referencia.`, [chip('propuesta', 'Ver mi propuesta'), chip('ajustar:tazas', 'Cambiar tazas al día'), chip('persona', 'Hablar con una persona')], [tarjetaCotizacion(nueva)])], acciones, reg('Cambio elegido por el comprador', 'Cambio de máquina', 'persona'));
  }
  function cambiarTazas(c, s, n, acciones) {
    const cambio = { cups: n };
    cambiarPropuesta(s, cambio, acciones, 'cups');
    const nueva = cotizacionCliente(estadoProto());
    acciones.push({ tipo: 'cotizacion', maquina: nueva.machine, tazas: n, nivel: 'persona' });
    registrar({ rol: 'comprador', accion: 'cambiar-tazas', datoUsado: 'Tazas al día indicadas por el comprador', sugerencia: 'Consumo estimado con 26 días', nivel: 'persona', decidio: 'comprador' });
    return res([msg(`Listo: ajusté la cotización a ${n} tazas al día. El consumo estimado cambia; el precio de la carga base de referencia no cambia. Lo ves en «Mi cotización» y en tu propuesta.`, [chip('propuesta', 'Ver mi propuesta'), chip('ajustar:maquina', 'Cambiar máquina'), chip('persona', 'Hablar con una persona')], [tarjetaCotizacion(nueva)])], acciones, reg('Tazas indicadas por el comprador', 'Ajuste de tazas', 'persona'));
  }
  // Escribe el cambio en el estado del prototipo (cotización y, si existe, la propuesta).
  function cambiarPropuesta(s, cambio, acciones, clave) {
    const m = M4();
    if (!m) return;
    seguro(() => m.update((st) => {
      st.quote = Object.assign({}, st.quote || {}, cambio, { mode: 'comodato', days: (st.proposal && st.proposal.days) || 26, editedByClient: true });
      if (st.proposal && st.proposal.status !== 'aceptada') Object.assign(st.proposal, cambio);
    }));
    acciones.push({ tipo: 'ajuste-cotizacion', campo: clave, valor: cambio[clave] });
  }

  function ofrecerRepetir(c, s, acciones) {
    const pedidos = pedidosDeComprador(c, s);
    if (!pedidos.length) {
      return res([msg('Cuando confirmes que tu primer pedido llegó, abre «Repetir pedido» para ajustar cantidades y confirmar. Puedes revisar su estado en «Mi pedido».', [chip('estado', 'Ver el estado'), chip('ir:repetir', 'Ir a Repetir pedido')])], acciones, reg('Pedidos del comprador', 'regla'));
    }
    const o = pedidos[pedidos.length - 1];
    return res([msg('Repetir es un toque: en «Repetir pedido» ajustas las cantidades y confirmas. Puedo registrar la solicitud para repetir tu último pedido. No hay cobro ni fecha comprometida: el equipo confirma precio, disponibilidad y despacho antes de que sea una compra.', [chip('repetir:confirmar', 'Confirmar la solicitud'), chip('ir:repetir', 'Ir a Repetir pedido'), chip('ayuda', 'Cancelar')], [{ tipo: 'ficha', titulo: 'Repetir pedido', filas: [['Pedido', o.id || 'último pedido'], ['Estado', o.status || '—']] }])], acciones, reg('Último pedido del comprador', 'Repetir pedido con confirmación', 'persona'));
  }

  function despacharOpcionCliente(c, s, opcion, acciones, reg0) {
    const [tipo, a, b] = opcion.split(':');
    if (opcion === 'inicio') return res([saludoCliente(c, s)], acciones, reg0('Contexto del comprador'));
    if (opcion === 'ayuda') return res([ayudaCliente()], acciones, reg0('Menú del agente'));
    if (opcion === 'maquina' || opcion === 'recomendar') return res([preguntaWizard('negocio')], acciones, reg0('Inicio del diagnóstico de cuatro preguntas'));
    if (tipo === 'wiz') return responderWizard(c, s, a, b, acciones);
    if (opcion === 'propuesta') return despacharIntencionCliente(c, s, 'propuesta', '', acciones, reg0);
    if (opcion === 'carga') return despacharIntencionCliente(c, s, 'carga', '', acciones, reg0);
    if (opcion === 'productos') return despacharIntencionCliente(c, s, 'productos', '', acciones, reg0);
    if (opcion === 'comodato') return despacharIntencionCliente(c, s, 'comodato', '', acciones, reg0);
    if (opcion === 'estado') return despacharIntencionCliente(c, s, 'estado', '', acciones, reg0);
    if (opcion === 'repetir') return ofrecerRepetir(c, s, acciones);
    if (opcion === 'repetir:confirmar') return confirmarRepetir(c, s, acciones);
    if (opcion === 'soporte') return abrirSoporte(c, s, acciones);
    if (opcion === 'referido') return ofrecerReferido(acciones);
    if (opcion === 'persona') return pedirDatosOPasar(c, s, 'persona', 'Quiero hablar con una persona', acciones);
    if (opcion === 'persona_ventas') {
      if (puedeCapturar(c) && !identificadoEstado(s)) return iniciarCaptura(c, s, 'persona', acciones);
      return iniciarEspera(c, s, 'persona', acciones);
    }
    if (tipo === 'ir') return irPestana(a, acciones, reg0);
    if (opcion === 'incluye') return respuestaIncluye(c, s, acciones, reg0);
    if (opcion === 'firma') return respuestaFirma(c, s, acciones, reg0);
    if (opcion === 'horario') return res([preguntaHorario()], acciones, reg0('Franja de entrega del comprador', 'Pedir franja y confirmar con Logística', 'regla'));
    if (tipo === 'horario' && a) return solicitarHorario(c, s, a, acciones);
    if (tipo === 'espera') return res([msg('Esa respuesta ya no hace falta. Sigo contigo.', [chip('ayuda', 'Ver opciones')])], acciones, reg0('Respuesta de espera no vigente'));
    if (opcion === 'ajustar') return res([msg('¿Qué quieres cambiar?', [chip('ajustar:maquina', 'Cambiar máquina'), chip('ajustar:tazas', 'Cambiar tazas al día')])], acciones, reg0('Pregunta de ajuste'));
    if (tipo === 'ajustar' && a === 'maquina') return res([msg('¿Qué máquina prefieres?', ['bar', 'pods', 'oficina', 'cafe_al_paso'].map((m) => chip('ajustar:m:' + m, nombreMaquina(m))))], acciones, reg0('Lista de máquinas'));
    if (tipo === 'ajustar' && a === 'm') return cambiarMaquina(c, s, b, acciones);
    if (tipo === 'ajustar' && a === 'tazas') return res([msg('¿Cuántas tazas sirves en un día normal?', [chip('ajustar:t:50', '50'), chip('ajustar:t:150', '150'), chip('ajustar:t:250', '250'), chip('ajustar:t:400', '400')])], acciones, reg0('Pregunta de tazas'));
    if (tipo === 'ajustar' && a === 't') return cambiarTazas(c, s, Number(b), acciones);
    if (tipo === 'envio') return confirmarEnvioCliente(c, s, a, acciones);
    if (tipo === 'consent') return responderConsentimiento(c, s, a, b, acciones);
    if (tipo === 'ref') return confirmarReferido(c, s, a, acciones);
    if (tipo === 'refpermiso') return registrarReferido(c, s, a, b, acciones);
    if (tipo === 'faq') return res([msg(faqPor(a) || 'Lo confirma tu ejecutivo.', [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('FAQ aprobado'));
    if (opcion === 'cierre') return res([msg(cierreCliente(s), [chip('ayuda', 'Hacer otra consulta')])], acciones, reg0('Cierre con estado y siguiente paso'));
    return res([msg('Esa opción ya no está disponible. Elige otra desde el menú.', [chip('ayuda', 'Ver opciones')])], acciones, reg0('Opción no vigente'));
  }

  function despacharIntencionCliente(c, s, it, texto, acciones, reg0) {
    const fake = { lado: 'cliente', rol: 'comprador', cuentaId: c.cuentaId, ruta: c.ruta };
    switch (it) {
      case 'propuesta': return res([msg('Esta es tu propuesta con la máquina y las tazas que tienes guardadas. Si quieres cambiar algo, dímelo.', [chip('ajustar', 'Cambiar máquina o tazas'), chip('persona', 'Hablar con una persona')], [tarjetaCotizacion(cotizacionCliente(s))])], acciones, reg0('Cotización guardada'));
      case 'carga': return res([msg('Antes de instalar se paga una carga base de referencia. Aquí va el detalle, con los precios aprobados del prototipo.', [chip('productos', 'Ver productos y precios'), chip('persona', 'Hablar con una persona')], [tarjetaCargaBase()])], acciones, reg0('precios_cotizacion_19oct.json'));
      case 'productos': return res([msg('Estos son los insumos con precio de referencia. Los precios son netos + IVA.', [chip('carga', 'Cuánto es la carga base')], [tarjetaProductos(null)])], acciones, reg0('precios_cotizacion_19oct.json'));
      case 'comodato': return res([msg(respuestaFaqComodato(), [chip('carga', 'Cuánto es la carga base'), chip('maquina', 'Recomiéndame una máquina')])], acciones, reg0('FAQ aprobado: comodato'));
      case 'estado': { const e = estadoPedidoCliente(c, s); return res([msg(e.texto, [chip('repetir', 'Repetir mi pedido'), chip('soporte', 'Abrir una solicitud de soporte')])], acciones, reg0('Estado del portal')); }
      default: return ayudaRespuesta(fake, acciones, reg0);
    }
  }
  function ayudaRespuesta(fake, acciones, reg0) { return res([ayudaCliente()], acciones, reg0('Menú del agente')); }

  function responderWizard(c, s, clave, valor, acciones) {
    const Q = (M4() && M4().QUESTIONS) || [];
    const m = M4();
    if (!m) return res([msg('No puedo leer el diagnóstico en este momento.', [])], acciones, reg('Prototipo no disponible', 'Sin acción', 'regla'));
    if (clave === 'negocio') seguro(() => m.answer('negocio', valor));
    if (clave === 'volumen') {
      const vol = (Q.find((q) => q.key === 'volumen') || {}).options || [];
      seguro(() => m.answer('volumen', vol[Number(valor)] || valor));
    }
    if (clave === 'operacion') {
      const ope = (Q.find((q) => q.key === 'operacion') || {}).options || [];
      seguro(() => m.answer('operacion', ope[Number(valor)] || valor));
    }
    if (clave === 'comuna') {
      if (valor !== 'none') seguro(() => m.setComuna(decodeURIComponent(valor)));
      else seguro(() => m.update((st) => { st.answers = Object.assign({}, st.answers || {}, { comunaOmitida: true }); }));
    }
    acciones.push({ tipo: 'diagnostico', campo: clave });
    const siguiente = { negocio: 'volumen', volumen: 'operacion', operacion: 'comuna' }[clave];
    if (siguiente) return res([preguntaWizard(siguiente)], acciones, reg('Respuesta del diagnóstico', 'Siguiente pregunta', 'regla'));
    seguro(() => M4().update((st) => { st.diag.done = true; }));
    registrar({ rol: 'comprador', accion: 'diagnostico-completo', datoUsado: 'Cuatro respuestas del diagnóstico', sugerencia: 'Recomendación de máquina', nivel: 'ia', decidio: 'comprador' });
    return res([recomendacionCliente(estadoProto(), acciones)], acciones, reg('Cuatro respuestas del diagnóstico y motor de C04', 'Recomendación de máquina', 'ia'));
  }

  function confirmarRepetir(c, s, acciones) {
    const pedidos = pedidosDeComprador(c, s);
    const o = pedidos[pedidos.length - 1];
    if (!o) return ofrecerRepetir(c, s, acciones);
    const folio = 'REP-' + ahora().toString(36).slice(-5).toUpperCase();
    const t = traspasoNuevo({ leadId: c.cuentaId, de: 'cliente', a: 'ventas', tipo: 'reposicion', resumen: `Solicitud de repetir pedido ${o.id || ''} (folio ${folio}). Pendiente de confirmar precio, disponibilidad y despacho.`, estado: 'solicitud', aviso: `Reposición ${folio}: confirmar precio y despacho` });
    acciones.push({ tipo: 'repetir-pedido', folio, pedidoId: o.id || null, traspasoId: t.id, estado: 'solicitud-registrada' });
    registrar({ rol: 'comprador', accion: 'repetir-pedido', datoUsado: 'Último pedido del comprador', sugerencia: 'Solicitud registrada; sin cobro', nivel: 'persona', decidio: 'comprador' });
    return res([msg(`Registré la solicitud ${folio} en esta prueba. No hay cobro ni fecha comprometida: el equipo confirma precio, disponibilidad y despacho.`, [chip('estado', 'Ver el estado'), chip('ayuda', 'Hacer otra consulta')], [{ tipo: 'folio', folio, estado: 'Solicitud registrada', siguiente: 'El equipo confirma precio, disponibilidad y despacho.' }])], acciones, reg('Último pedido', 'Solicitud de reposición', 'persona'));
  }

  function responderConsentimiento(c, s, canal, valor, acciones) {
    if (valor !== 'si') {
      return res([msg('Entendido. No enviaremos mensajes por WhatsApp ni por correo. Puedes seguir en este chat.', [chip('ayuda', 'Ver opciones')])], acciones, reg('Sin permiso del comprador', 'Respetar la decisión', 'persona'));
    }
    const canalReal = canal === 'correo' ? 'correo' : 'whatsapp';
    fijarConsentimiento(c.cuentaId, canalReal, true);
    acciones.push({ tipo: 'consentimiento', canal: canalReal, valor: true });
    registrar({ rol: 'comprador', accion: 'consentimiento-' + canalReal, datoUsado: 'Permiso dado por el comprador', sugerencia: 'Vista previa antes de enviar', nivel: 'persona', decidio: 'comprador' });
    const texto = vistaPreviaCanal(c, s, canalReal);
    return res([msg(`Gracias. Esta es la vista previa del mensaje que te llegaría por ${canalReal === 'correo' ? 'correo' : 'WhatsApp'} (simulación; no se envía nada real):`, [chip('envio:' + canalReal, 'Enviar la vista previa simulada'), chip('ayuda', 'Ahora no')], [{ tipo: 'mensaje', canal: canalReal, para: (s.lead && s.lead.email) || 'contacto registrado', texto, estado: 'Vista previa' }])], acciones, reg('Permiso del comprador', 'Vista previa simulada', 'persona'));
  }
  function confirmarEnvioCliente(c, s, canal, acciones) {
    const canalReal = canal === 'correo' ? 'correo' : 'whatsapp';
    const texto = vistaPreviaCanal(c, s, canalReal);
    const out = enviar({ canal: canalReal, cuentaId: c.cuentaId, para: (s.lead && s.lead.email) || null, texto, aprobadoPor: 'cliente' });
    if (!out.ok) return res([msg(out.motivo + ' Antes necesito tu permiso.', [chip('contacto', 'Ver cómo seguir por otro canal')])], acciones, reg('Falta permiso', 'Bloqueo de envío', 'regla'));
    acciones.push({ tipo: 'envio-simulado', canal: canalReal });
    return res([msg(`Listo: quedó registrada la vista previa del mensaje por ${canalReal === 'correo' ? 'correo' : 'WhatsApp'} en tu historial (simulación; no se envió nada real).`, [chip('ayuda', 'Hacer otra consulta')])], acciones, reg('Permiso del comprador', 'Envío simulado', 'persona'));
  }

  function ofrecerReferidoNombre(tipo) {
    return { hotel: 'Hotel', restaurante: 'Restaurante', cafeteria: 'Cafetería', oficina: 'Oficina' }[tipo] || 'Otro negocio';
  }
  function confirmarReferido(c, s, tipo, acciones) {
    const negocio = ofrecerReferidoNombre(tipo);
    return res([msg(`Anoté que quieres recomendar un ${negocio.toLowerCase()}. ¿Esa persona te dio permiso para que la contactemos?`, [chip(`refpermiso:${tipo}:si`, 'Sí, tiene permiso'), chip(`refpermiso:${tipo}:no`, 'No, no la contactemos'), chip('ayuda', 'Cancelar')])], acciones, reg('Regla: referidos con permiso', 'Referido pendiente de permiso', 'persona'));
  }
  function registrarReferido(c, s, tipo, permiso, acciones) {
    const negocio = ofrecerReferidoNombre(tipo);
    if (permiso !== 'si') {
      registrar({ rol: 'comprador', accion: 'referido-sin-permiso', datoUsado: 'Referido sin permiso', sugerencia: 'No contactar', nivel: 'persona', decidio: 'comprador' });
      return res([msg('Entendido: no contactaremos a esa persona. Gracias por pensar en Marley Coffee.', [chip('ayuda', 'Hacer otra consulta')])], acciones, reg('Sin permiso', 'No contactar', 'persona'));
    }
    const t = traspasoNuevo({ leadId: c.cuentaId, de: 'cliente', a: 'marketing', tipo: 'referido', resumen: `Referido de ${negocio} recomendado por el comprador. Permiso dado para contactar. Pendiente de aprobación de Jefatura.`, estado: 'por-aprobar', aviso: `Referido de ${negocio}: pendiente de aprobación` });
    acciones.push({ tipo: 'referido', negocio, permiso: true, traspasoId: t.id });
    registrar({ rol: 'comprador', accion: 'referido', datoUsado: 'Tipo de negocio y permiso del referido', sugerencia: 'Aprobación de Jefatura antes de contactar', nivel: 'persona', decidio: 'comprador' });
    return res([msg(`Gracias. Registré el referido de ${negocio.toLowerCase()}. Jefatura lo revisa antes de contactarlo; no prometemos fecha.`, [chip('ayuda', 'Hacer otra consulta')], [{ tipo: 'folio', folio: t.id, estado: 'Por aprobar', siguiente: 'Jefatura revisa el referido.' }])], acciones, reg('Referido con permiso', 'Aprobación de Jefatura', 'persona'));
  }

  // ---------- Captura del lead desde el chat (datos con permiso) ----------
  // El comprador da sus datos de a uno, con «Prefiero no responder» en cada paso, y solo se piden los que faltan.
  // Nada llega al CRM hasta que autoriza el contacto por correo o WhatsApp; el permiso de novedades (promoción) se pide aparte.
  // Al terminar, el lead queda en el estado de M4 (el CRM lo lee con su origen, su cotización y su conversación).
  const RX_CORREO = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;
  const NEGOCIOS_CAPTURA = ['Hotel', 'Restaurante', 'Cafetería', 'Eventos o catering', 'OCS', 'Conveniencia', 'Otro'];
  const INTENCIONES_NO_DATO = ['baja', 'trampa', 'negociar', 'saludo', 'cierre', 'ayuda', 'persona', 'contacto', 'soporte'];
  function puedeCapturar(c) { return Boolean(c) && c.ruta !== 'C09'; }
  function identificadoEstado(s) { const m = M4(); return Boolean(m && typeof m.identified === 'function' && m.identified(s)); }
  function telefonoEn(texto) {
    const digitos = String(texto || '').replace(/\D/g, '');
    if (digitos.length < 8 || digitos.length > 15) return null;
    return String(texto).trim().startsWith('+') ? '+' + digitos : digitos;
  }
  function textoLibre(texto, max) {
    return String(texto || '').replace(RX_CORREO, ' ').replace(/\+?\d[\d\s-]{6,}\d/g, ' ').replace(/[,;|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function nombreDe(texto) {
    return textoLibre(texto, 60).replace(/^(hola[,.]?\s+)?(me llamo|mi nombre es|soy)\s+/i, '').trim();
  }
  function negocioEn(texto) {
    const t = sinTildes(texto);
    if (/oficina|\bocs\b/.test(t)) return 'OCS';
    if (/hotel|hostal|alojamiento/.test(t)) return 'Hotel';
    if (/restaur|bistro|grill|brasa/.test(t)) return 'Restaurante';
    if (/cafe/.test(t)) return 'Cafetería';
    if (/evento|catering/.test(t)) return 'Eventos o catering';
    if (/conveniencia|almacen|minimarket|bodega/.test(t)) return 'Conveniencia';
    if (/\botro\b/.test(t)) return 'Otro';
    return null;
  }
  function capturaDe(cuentaId) { return leerEstado().capturas[String(cuentaId)] || null; }
  function guardarCaptura(cuentaId, cap) {
    const e = leerEstado();
    if (cap) e.capturas[String(cuentaId)] = cap; else delete e.capturas[String(cuentaId)];
    guardarEstado(e);
    return cap || null;
  }
  // Próximo dato que falta: primero lo que el lead ya tiene (C01 a C09) no se vuelve a pedir.
  function pasoCaptura(cap, s) {
    const d = cap.datos || {};
    const L = s.lead || {};
    const a = s.answers || {};
    if (d.nombre === undefined && !L.name) return 'nombre';
    if (d.empresa === undefined && !L.company) return 'empresa';
    if (d.negocio === undefined && !a.negocio) return 'negocio';
    if (!d.canal) return 'canal';
    if (d.canal === 'correo' && !(d.correo || L.email)) return 'dato';
    if (d.canal === 'whatsapp' && !(d.whatsapp || L.phone)) return 'dato';
    if (d.permiso === undefined) return 'permiso';
    if (d.promo === undefined) return 'promo';
    return 'listo';
  }
  function preguntaCaptura(cap, s) {
    const paso = pasoCaptura(cap, s);
    const d = cap.datos || {};
    const omitir = chip('cap:omitir', 'Prefiero no responder');
    const via = d.canal === 'whatsapp' ? 'WhatsApp' : 'correo';
    if (paso === 'nombre') return msg('¿Cómo te llamas?', [omitir]);
    if (paso === 'empresa') return msg('¿Cómo se llama tu negocio o empresa?', [omitir]);
    if (paso === 'negocio') return msg('¿Qué tipo de negocio tienes?', NEGOCIOS_CAPTURA.map((n) => chip('cap:negocio:' + n, NEGOCIO_ETIQUETA[n] || n)).concat([omitir]));
    if (paso === 'canal') return msg('¿Prefieres que te escribamos por correo o por WhatsApp?', [chip('cap:canal:correo', 'Por correo'), chip('cap:canal:whatsapp', 'Por WhatsApp'), omitir]);
    if (paso === 'dato') return msg(d.canal === 'whatsapp' ? 'Escribe tu número de WhatsApp, con código de país (por ejemplo, +56 9 1234 5678).' : 'Escribe tu correo (por ejemplo, nombre@tuempresa.cl).', [omitir]);
    if (paso === 'permiso') return msg(`¿Me autorizas a contactarte por ${via} para responder tu solicitud? Puedes pedir la baja cuando quieras.`, [chip('cap:permiso:si', 'Sí, autorizo'), omitir]);
    if (paso === 'promo') return msg(`¿Quieres además recibir novedades y ofertas de Marley Coffee por ${via}?`, [chip('cap:promo:si', 'Sí, novedades'), chip('cap:promo:no', 'Solo mi solicitud'), omitir]);
    return msg('Listo.', []);
  }
  // ¿El texto libre responde a la captura? Si no, el chat lo trata como una pregunta normal y vuelve a pedir el dato.
  function capturaEsDato(cap, s, texto) {
    const t = sinTildes(texto);
    const paso = pasoCaptura(cap, s);
    if (/prefiero no responder/.test(t) || RX_CORREO.test(texto) || telefonoEn(texto)) return true;
    if (paso === 'canal') return /whats|wasap|celular|fono|correo|mail/.test(t);
    if (paso === 'permiso') return /^(si|claro|dale|ok|okay|acepto|autorizo|de acuerdo|no|mejor no|prefiero)\b/.test(t);
    if (paso === 'promo') return /novedad|oferta|^solo|^no\b|^si\b|^acepto|^claro/.test(t);
    if (paso === 'negocio') return Boolean(negocioEn(texto));
    if (paso === 'empresa') return texto.length <= 80 && !['baja', 'trampa', 'negociar'].includes(detectar(texto, INTENCIONES_CLIENTE));
    if (paso === 'nombre') { const it = detectar(texto, INTENCIONES_CLIENTE); return texto.length <= 60 && !(it && INTENCIONES_NO_DATO.includes(it)); }
    return false;
  }
  function iniciarCaptura(c, s, pendiente, acciones) {
    const e = leerEstado();
    e.capturas[String(c.cuentaId)] = { pendiente, datos: {}, ts: ahora() };
    guardarEstado(e);
    const cap = e.capturas[String(c.cuentaId)];
    registrar({ rol: 'comprador', accion: 'captura-inicio', datoUsado: pendiente === 'persona' ? 'Pidió hablar con una persona' : 'Pidió seguir por otro canal', sugerencia: 'Pedir solo los datos que faltan y el permiso', nivel: 'regla', decidio: 'comprador' });
    const intro = pendiente === 'persona' ? 'Para que una persona de nuestro equipo comercial te contacte, te hago unas preguntas cortas.' : 'Para seguir por otro canal, te hago unas preguntas cortas.';
    const q = preguntaCaptura(cap, s);
    return res([msg(`${intro} En cada una puedes elegir «Prefiero no responder». ${q.texto}`, q.chips)], acciones, reg('Regla: pedir solo lo que falta y con permiso', 'Captura de datos de contacto', 'regla'));
  }
  function pedirDatosOPasar(c, s, pendiente, motivo, acciones) {
    if (puedeCapturar(c) && !identificadoEstado(s)) return iniciarCaptura(c, s, pendiente, acciones);
    return ofrecerDerivacion(c, s, motivo, acciones);
  }
  function responderCaptura(c, s, cap, opcion, texto, acciones) {
    const d = cap.datos;
    const paso = pasoCaptura(cap, s);
    const tt = sinTildes(texto || '');
    let omitir = false;
    const rehacer = (prefijo) => {
      guardarCaptura(c.cuentaId, cap);
      const q = preguntaCaptura(cap, s);
      return res([msg(prefijo + q.texto, q.chips)], acciones, reg('Dato que falta', 'Volver a pedir el dato', 'regla'));
    };
    if (opcion) {
      const partes = opcion.split(':');
      const clave = partes[1];
      const valor = partes[2];
      if (clave === 'omitir') omitir = true;
      else if (clave === 'canal' && (valor === 'correo' || valor === 'whatsapp')) d.canal = valor;
      else if (clave === 'negocio' && NEGOCIOS_CAPTURA.includes(valor)) d.negocio = valor;
      else if (clave === 'permiso') { if (valor === 'si') d.permiso = true; else return cancelarCaptura(c, acciones, 'Sin permiso de contacto'); }
      else if (clave === 'promo') d.promo = valor === 'si';
    } else if (/prefiero no responder/.test(tt)) {
      omitir = true;
    } else {
      const correo = (String(texto || '').match(RX_CORREO) || [])[0] || null;
      const tel = correo ? null : telefonoEn(texto);
      if (correo) { d.correo = correo.toLowerCase(); if (!d.canal) d.canal = 'correo'; }
      if (tel) { d.whatsapp = tel; if (!d.canal) d.canal = 'whatsapp'; }
      if (paso === 'nombre') {
        const n = nombreDe(texto);
        if (n) d.nombre = n;
        else if (!correo && !tel) return rehacer('Escribe tu nombre, por ejemplo «Ana Pérez». ');
      } else if (paso === 'empresa') {
        const emp = textoLibre(texto, 80);
        if (emp.length >= 2) d.empresa = emp; else return rehacer('Escribe el nombre de tu negocio. ');
      } else if (paso === 'negocio') {
        const n = negocioEn(texto);
        if (n) d.negocio = n; else return rehacer('Elige una de estas opciones. ');
      } else if (paso === 'canal') {
        if (/whats|wasap|celular|fono/.test(tt)) d.canal = 'whatsapp';
        else if (/correo|mail/.test(tt)) d.canal = 'correo';
        else if (!d.canal) return rehacer('Responde correo o WhatsApp. ');
      } else if (paso === 'dato') {
        if (d.canal === 'whatsapp' && !d.whatsapp) return rehacer('Escribe un número de WhatsApp con al menos 8 dígitos. ');
        if (d.canal !== 'whatsapp' && !d.correo) return rehacer('Ese correo no parece válido. ');
      } else if (paso === 'permiso') {
        if (/^(si|claro|dale|ok|okay|acepto|autorizo|de acuerdo)\b/.test(tt)) d.permiso = true;
        else if (/^(no|mejor no|prefiero)\b/.test(tt)) return cancelarCaptura(c, acciones, 'Sin permiso de contacto');
        else return rehacer('Responde sí o no. ');
      } else if (paso === 'promo') {
        if (/novedad|oferta|^si\b|^acepto|^claro/.test(tt)) d.promo = true;
        else if (/^solo|^no\b/.test(tt)) d.promo = false;
        else return rehacer('Responde sí o no. ');
      }
    }
    if (omitir) {
      if (paso === 'nombre' || paso === 'empresa' || paso === 'negocio') d[paso] = null;
      else if (paso === 'promo') d.promo = false;
      else return cancelarCaptura(c, acciones, 'Prefiero no responder');
    }
    if (pasoCaptura(cap, s) !== 'listo') {
      guardarCaptura(c.cuentaId, cap);
      return res([preguntaCaptura(cap, s)], acciones, reg('Dato que dio la persona', 'Pedir el siguiente dato', 'persona'));
    }
    return completarCaptura(c, cap, s, acciones);
  }
  function cancelarCaptura(c, acciones, motivo) {
    guardarCaptura(c.cuentaId, null);
    registrar({ rol: 'comprador', accion: 'captura-cancelada', datoUsado: motivo, sugerencia: 'No guardar datos de contacto ni escribir', nivel: 'persona', decidio: 'comprador' });
    return res([msg('Entendido. No guardé tus datos de contacto y no te escribiremos. Puedes seguir en este chat con tu propuesta.', [chip('propuesta', 'Ver mi propuesta'), chip('ayuda', 'Hacer otra consulta')])], acciones, reg('Respeto la decisión de la persona', 'Sin datos de contacto', 'persona'));
  }
  function eventoEnEstado(st, key, label) {
    const m = M4();
    const EV = (m && m.EV) || {};
    if (!Array.isArray(st.events) || st.events.some((e) => e.key === key)) return;
    st.events.push({ key, pts: (EV[key] && EV[key].pts) || 0, label, at: m ? m.now() : Date.now() });
  }
  // Permiso de promoción como lo lee el CRM: lo que se guardó en el CRM manda; luego el dato del lead.
  function permisoPromoDe(id, item) {
    const st = estadoProto();
    const guardado = st.crm2 && st.crm2.permissions && st.crm2.permissions[id] ? st.crm2.permissions[id].promotion : undefined;
    const v = guardado !== undefined && guardado !== null ? guardado : (item && typeof item.marketingConsent === 'boolean' ? item.marketingConsent : undefined);
    if (v === true || v === 'si' || v === 'true') return 'yes';
    if (v === false || v === 'no' || v === 'false') return 'no';
    if (v === undefined && item && ['MQL', 'SQL'].includes(item.etapa)) return 'yes';
    return 'unknown';
  }
  function completarCaptura(c, cap, s, acciones) {
    const m = M4();
    const d = cap.datos;
    const L0 = s.lead || {};
    const prevId = L0.id || null;
    const canal = d.canal === 'whatsapp' ? 'whatsapp' : 'correo';
    const correo = d.correo || L0.email || '';
    const telefono = d.whatsapp || L0.phone || '';
    const nombre = typeof d.nombre === 'string' ? d.nombre : (L0.name || '');
    const empresa = typeof d.empresa === 'string' ? d.empresa : '';
    const promo = d.promo === true;
    if (!m || typeof m.saveContact !== 'function') return res([msg('No puedo guardar tus datos en este momento. Lo confirma una persona del equipo.', [chip('persona', 'Hablar con una persona')])], acciones, reg('Prototipo no disponible', 'Sin guardar', 'persona'));
    if (typeof d.negocio === 'string') seguro(() => m.answer('negocio', d.negocio));
    seguro(() => m.saveContact({ name: nombre, email: correo, phone: telefono, consent: true, marketingConsent: promo }));
    const lead = m.get().lead;
    if (!lead) return res([msg('No pude registrar el contacto en este momento. Lo confirma una persona del equipo.', [chip('persona', 'Hablar con una persona')])], acciones, reg('Error controlado', 'Derivar a una persona', 'persona'));
    seguro(() => m.update((st) => {
      const Lt = st.lead;
      if (empresa) Lt.company = empresa;
      if (!prevId) Lt.source = 'Chat del sitio';
      Lt.channel = canal;
      Lt.followupChannel = canal;
      Lt.chatAt = Lt.chatAt || m.now();
      if (cap.pendiente === 'persona') {
        Lt.consultationRequested = true;
        Lt.contactRequestedAt = Lt.contactRequestedAt || m.now();
        eventoEnEstado(st, 'ejecutivo', 'Pidió hablar con una persona (chat del sitio)');
      }
      if (st.quote && st.quote.machine) eventoEnEstado(st, 'cotizar', 'Cotizó en el chat del sitio');
    }));
    const nuevoId = String(lead.id);
    const desde = String(c.cuentaId);
    migrarCuenta(CLIENTE_LOCAL, nuevoId);
    if (desde !== nuevoId) migrarCuenta(desde, nuevoId);
    guardarCaptura(desde, null);
    guardarCaptura(nuevoId, null);
    c.cuentaId = nuevoId;
    fijarConsentimiento(nuevoId, canal, true);
    avisar('marketing', { tipo: 'lead', texto: `Nuevo contacto desde el chat del sitio: ${nombre || 'sin nombre'}${empresa ? ' · ' + empresa : ''}. Permiso de novedades: ${promo ? 'sí' : 'no'}.`, leadId: nuevoId });
    registrar({ rol: 'comprador', accion: 'captura-lead', datoUsado: 'Nombre, empresa, dato de contacto y permiso que dio la persona', sugerencia: 'Crear o actualizar el lead del CRM con su origen (chat del sitio)', nivel: 'persona', decidio: 'comprador' });
    registrar({ rol: 'comprador', accion: promo ? 'permiso-novedades' : 'sin-permiso-novedades', datoUsado: 'Respuesta a la pregunta de novedades', sugerencia: promo ? 'Puede llegar a MQL si cumple el resto' : 'Solo responder su solicitud', nivel: 'persona', decidio: 'comprador' });
    const s2 = estadoProto();
    const primer = nombre ? primerNombre(nombre) : '';
    const destino = canal === 'whatsapp' ? `WhatsApp (${telefono})` : `correo (${correo})`;
    const listo = msg(`Listo${primer ? ', ' + primer : ''}. Guardé tus datos${empresa ? ' de ' + empresa : ''} y tu consulta. Te escribiremos por ${destino} solo para responder tu solicitud${promo ? '; como lo autorizaste, también recibirás novedades' : ''}. Puedes pedir la baja cuando quieras.`);
    if (cap.pendiente === 'persona') {
      const der = ofrecerDerivacion(c, s2, 'Quiero hablar con una persona', acciones);
      return res([listo].concat(der.mensajes), acciones, reg('Datos con permiso del comprador', 'Resumen para Ventas antes de pasar el caso', 'persona'));
    }
    if (cap.pendiente === 'contacto') {
      const pv = responderConsentimiento(c, s2, canal, 'si', acciones);
      return res([listo].concat(pv.mensajes), acciones, pv.registro || reg('Permiso del comprador', 'Vista previa simulada', 'persona'));
    }
    listo.chips = [chip('propuesta', 'Ver mi propuesta'), chip('persona', 'Hablar con una persona'), chip('ayuda', 'Hacer otra consulta')];
    return res([listo], acciones, reg('Datos con permiso del comprador', 'Lead creado en el CRM', 'persona'));
  }
  // Baja: sin envíos y sin permiso de contacto. Si el lead existe, deja de contar como identificado (el CRM no lo marca MQL).
  function bajaCliente(c, s, acciones) {
    fijarConsentimiento(c.cuentaId, 'todos', false);
    guardarCaptura(c.cuentaId, null);
    if (puedeCapturar(c) && s.lead && String(s.lead.id) === String(c.cuentaId)) {
      seguro(() => M4().update((st) => { if (st.lead) { st.lead.consent = false; st.lead.marketingConsent = false; } }));
    }
    acciones.push({ tipo: 'consentimiento', canal: 'todos', valor: false });
    registrar({ rol: 'comprador', accion: 'baja', datoUsado: 'Petición de la persona', sugerencia: 'Respetar la baja: sin envíos ni permiso de contacto', nivel: 'persona', decidio: 'comprador' });
    return res([msg('Listo. No te enviaremos mensajes por WhatsApp ni por correo. Puedes seguir usando este chat cuando quieras.', [chip('ayuda', 'Ver qué más puedo hacer')])], acciones, reg('Petición de la persona', 'Respetar la baja', 'persona'));
  }
  // La cotización que ve el comprador en el chat queda en el estado: el CRM la muestra como «Lo que cotizó».
  function guardarCotizacionChat() {
    const m = M4();
    if (!m) return;
    const cot = cotizacionCliente(estadoProto());
    if (!cot.machine) return;
    seguro(() => m.update((st) => {
      if (!st.quote || !st.quote.machine) st.quote = Object.assign({}, st.quote || {}, { machine: cot.machine, cups: cot.cups, mode: 'comodato', days: 26, services: cot.services || [], origen: 'chat' });
    }));
  }

  // ---------- CRM: el agente como forma de trabajo ----------
  const INTENCIONES_CRM = [
    { id: 'aprobar_envio', frases: ['aprueba el envio', 'aprobar el envio', 'aprueba el mensaje', 'aprueba el correo', 'envia el mensaje', 'enviar el mensaje', 'aprueba el whatsapp'] },
    { id: 'pasar', frases: ['pasalo a ventas', 'pasar a ventas', 'pasa a ventas', 'traspasa', 'traspaso', 'derivalo', 'mandalo a ventas', 'pasalo'] },
    { id: 'aprobar_ref', frases: ['aprueba', 'aprobar', 'aprobalo', 'autoriza', 'autorizar'] },
    { id: 'aprobaciones', frases: ['espera mi aprobacion', 'mi aprobacion', 'aprobaciones', 'por aprobar', 'pendientes', 'que me toca'] },
    { id: 'mql', frases: ['mql', 'cumple', 'calificado', 'calificacion', 'sql', 'criterios'] },
    { id: 'cotizo', frases: ['que cotizo', 'cotizo', 'cotizacion', 'que pidio', 'que eligio', 'que armo', 'cotizaste'] },
    { id: 'puntaje', frases: ['puntaje', 'interes', 'valor esperado', 'porque', 'score'] },
    { id: 'origen', frases: ['origen', 'campana', 'de donde', 'fuente'] },
    { id: 'sitio', frases: ['hizo en el sitio', 'recorrido', 'visitas', 'actividad', 'navego', 'sitio'] },
    { id: 'conversacion', frases: ['conversacion', 'chat', 'hablo', 'agente del cliente', 'que dijo'] },
    { id: 'dudas', frases: ['dudas', 'duda', 'pregunto', 'preguntas', 'consulto'] },
    { id: 'ejecutivo', frases: ['pidio ejecutivo', 'pidio llamada', 'ejecutiva', 'ejecutivo', 'pidio persona'] },
    { id: 'tazas', frases: ['cuantas tazas', 'tazas', 'volumen', 'consumo'] },
    { id: 'resumen', frases: ['resume', 'resumen', 'resumeme', 'como va la cuenta', 'estado de la cuenta'] },
    { id: 'canasta', frases: ['canasta', 'propon la canasta', 'propon', 'recomienda productos'] },
    { id: 'propuesta', frases: ['prepara la propuesta', 'arma la propuesta', 'prepara', 'propuesta'] },
    { id: 'visita', frases: ['agenda la visita', 'agenda', 'agendar', 'visita', 'visitar'] },
    { id: 'ayuda', frases: ['ayuda', 'que puedes', 'opciones', 'que hago'] },
  ];
  const PERMISOS_CRM = {
    marketing: ['cotizo', 'mql', 'puntaje', 'origen', 'sitio', 'conversacion', 'dudas', 'ejecutivo', 'tazas', 'pasar', 'aprobar_envio', 'ayuda'],
    ventas: ['resumen', 'canasta', 'propuesta', 'visita', 'cotizo', 'puntaje', 'dudas', 'origen', 'conversacion', 'ayuda'],
    jefatura: ['aprobaciones', 'aprobar_ref', 'resumen', 'cotizo', 'puntaje', 'mql', 'ayuda'],
  };
  // Opciones por rol (26-nov): las mismas que muestra la tarjeta del CRM. El agente del CRM interpreta
  // estos textos con sus propias respuestas; aquí solo se ofrecen para que ninguna opción quede sin salida.
  const SUGERENCIAS_CRM = {
    marketing: [['detractores', '¿Qué detractores tengo?'], ['resena', 'Pide reseña a los promotores'], ['referidos', '¿Qué referidos llegaron?'], ['cotizo', '¿Qué cotizó este lead?']],
    ventas: [['dia', 'Resume mi día'], ['reponer', '¿Qué cuentas toca reponer?'], ['propuesta', 'Prepara la propuesta'], ['visita', 'Agenda la visita']],
    jefatura: [['aprobaciones', '¿Qué espera mi aprobación?'], ['metas', '¿Cómo vamos con las metas?']],
  };
  const quienHace = { pasar: 'Marketing', aprobar_envio: 'Marketing', aprobar_ref: 'Jefatura', aprobaciones: 'Jefatura', resumen: 'Ventas', canasta: 'Ventas', propuesta: 'Ventas', visita: 'Ventas' };

  function sugerenciasCRM(rol) {
    return (SUGERENCIAS_CRM[rol] || []).map(([id, texto]) => chip('crm:' + id, texto));
  }
  // Palabras que nunca identifican a un lead (tipos de negocio, áreas y verbos del CRM).
  const PALABRAS_GENERICAS = ['hotel', 'cafe', 'cafeteria', 'restaurante', 'bistro', 'brasa', 'marley', 'coffee', 'empresas', 'ventas', 'eventos', 'marketing', 'jefatura', 'cuenta', 'lead', 'propuesta', 'canasta', 'visita', 'resumen', 'sitio', 'pasalo', 'llamada', 'oficinas', 'almacen', 'panaderia', 'hostal', 'grill', 'cliente', 'contacto'];
  // Busca a qué lead o cuenta se refiere el texto; si no nombra ninguno, usa el seleccionado.
  function buscarEntidades(texto) {
    const out = [];
    const t = limpio(texto);
    const tokens = palabras(texto);
    const fuentes = [
      ...prospectos().map((p) => ({ tipo: 'lead', id: p.id, nombre: p.name || '', empresa: p.company || '' })),
      ...cuentasCRM().map((a) => ({ tipo: 'cuenta', id: a.id, nombre: a.name || '', empresa: '' })),
    ];
    const s = estadoProto();
    if (s.lead && s.lead.id) fuentes.push({ tipo: 'lead', id: s.lead.id, nombre: s.lead.name || '', empresa: s.lead.company || '' });
    const idMatch = t.match(/\b(mc-[a-z0-9-]+|ac-\d{3})\b/);
    if (idMatch) {
      const hit = fuentes.find((f) => f.id.toLowerCase() === idMatch[1]);
      if (hit) return [hit];
    }
    // Nombre completo escrito en la pregunta («Ana Pérez»): gana sobre otro lead que solo comparte el apellido.
    const completo = fuentes.find((f) => f.nombre && limpio(f.nombre).split(' ').length >= 2 && t.includes(limpio(f.nombre)));
    if (completo) return [completo];
    for (const f of fuentes) {
      const pal = palabras(`${f.nombre} ${f.empresa}`).filter((w) => w.length >= 4 && !PALABRAS_GENERICAS.includes(w));
      const hits = pal.filter((w) => tokens.some((x) => nombreCoincide(x, w))).length;
      if (hits > 0) out.push({ f, hits });
    }
    out.sort((x, y) => y.hits - x.hits);
    return out.length ? [out[0].f] : [];
  }
  function leadCRM(id) {
    const s = estadoProto();
    if (s.lead && s.lead.id === id) return leadDeEstado(s);
    const p = prospectos().find((x) => x.id === id);
    if (p) return leadDeProspecto(p);
    return null;
  }

  function tarjetasLead(lead, cuentaId) {
    const out = [];
    const p = lead.puntajes || {};
    const filasCot = [];
    const cot = lead.origen === 'sitio' ? cotizacionCliente(estadoProto()) : { machine: recomendarCon(lead.respuestas || {}).machine || 'bar', cups: CUPS_DE(lead.respuestas && lead.respuestas.volumen), days: 26, services: [] };
    const info = infoMaquina(cot.machine);
    filasCot.push(['Máquina', info.nombre], ['Tazas al día', cot.cups != null ? String(cot.cups) : (lead.respuestas && lead.respuestas.volumen) || 'Sin dato']);
    if (lead.origen !== 'sitio') filasCot.push(['Fuente', 'Sin propuesta guardada: máquina sugerida por su tipo de negocio (supuesto)']);
    out.push({ tipo: 'cotizacion', titulo: lead.origen === 'sitio' ? 'Lo que cotizó' : 'Máquina que le recomendaría el motor', maquina: { id: info.id, nombre: info.nombre, tipo: info.tipo, tazas: info.tazas }, tazas: cot.cups, consumo: null, lineas: lineasPrecio().map((l) => ({ t: l.t, d: l.d, precio: l.precio })), cargaBase: { kit: kitPrecio(), filtro: filtroPrecio(), insumos: insumosRef(), total: cargaBase() }, pendientes: aConfirmar(), nota: lead.origen === 'sitio' ? 'Precios de referencia.' : 'Sin propuesta guardada: los precios son los de referencia del catálogo.' });
    out.push({ tipo: 'ficha', titulo: 'Puntajes', filas: [
      ['Interés', p.interes ? `${p.interes.puntaje}/100 · ${p.interes.temperatura || ''}`.trim() : 'Sin puntaje'],
      ['Porqué del interés', p.interes ? p.interes.porque : '—'],
      ['Valor esperado', p.valor ? `${p.valor.puntaje}/100` : 'Sin puntaje'],
      ['Porqué del valor', p.valor ? p.valor.porque : '—'],
    ] });
    out.push({ tipo: 'ficha', titulo: 'Origen y campaña', filas: [['Origen', lead.fuente || 'Sin dato'], ['Campaña', lead.campana || 'Sin dato'], ['Canal de contacto', lead.canal || 'Sin dato'], ['Ejecutiva de zona', lead.ejecutiva ? `${lead.ejecutiva} (${lead.zona || 'zona'})` : 'Sin asignar']] });
    const sitio = lead.eventos && lead.eventos.length ? lead.eventos : (lead.hace != null ? [`Última actividad hace ${lead.hace} min`] : ['Sin actividad registrada']);
    out.push({ tipo: 'lista', titulo: 'Lo que hizo en el sitio', items: sitio.map((t) => ({ t })) });
    const conv = historial(cuentaId, 6).filter((m) => m.canal !== 'nota');
    out.push({ tipo: 'lista', titulo: 'Conversación con el agente del cliente', items: conv.length ? conv.map((m) => ({ t: `${m.rol === 'comprador' ? 'Cliente' : 'Agente'}: ${m.texto}` })) : [{ t: 'Sin conversación registrada con el agente.' }] });
    return out;
  }

  // Mismo criterio que el CRM (crm-v2 isMql y crm-agente): contacto identificado, negocio B2B, permiso de promoción e interés de 40 o más.
  function criterioMQL(lead) {
    const i = (lead.puntajes && lead.puntajes.interes) || null;
    const puntaje = i ? Number(i.puntaje) || 0 : 0;
    const b2b = lead.b2b === null || lead.b2b === undefined ? Boolean(lead.negocio) : lead.b2b === true;
    const lista = [
      { ok: Boolean(lead.nombre) && Boolean(lead.email || lead.telefono || lead.empresa), txt: 'contacto identificado (nombre y un dato de contacto)' },
      { ok: b2b, txt: 'negocio B2B' },
      { ok: lead.permisoPromo === 'yes', txt: 'permiso de promoción registrado' },
      { ok: puntaje >= 40, txt: `interés de 40 o más (hoy ${puntaje})` },
    ];
    const faltan = lista.filter((c) => !c.ok).map((c) => c.txt);
    const cumple = faltan.length === 0;
    const texto = cumple
      ? `Sí cumple para MQL: contacto identificado, negocio B2B, permiso de promoción e interés de ${puntaje}/100.`
      : `Todavía no cumple para MQL. Falta: ${faltan.join('; ')}.`;
    return { cumple, texto, porque: i ? i.porque : null, lista, faltan };
  }

  function mensajeBorrador(lead) {
    const nombre = lead.nombre ? primerNombre(lead.nombre) : '';
    const cotizo = lead.origen === 'sitio' ? 'estuviste revisando una propuesta' : 'pediste información';
    const negocio = NEGOCIO_FRASE[lead.negocio] || 'tu negocio';
    const eje = lead.ejecutiva || 'una ejecutiva de tu zona';
    const texto = `${nombre ? 'Hola ' + nombre + ', ' : 'Hola, '}te escribe el equipo de Marley Coffee Empresas. Vimos que ${cotizo} para ${negocio}${comunaReal(lead.comuna) ? ' en ' + comunaReal(lead.comuna) : ''}. ${eje} puede revisarla contigo y responder tus dudas, sin compromiso. Si no quieres recibir más mensajes, responde BAJA.`;
    const canal = lead.canal === 'correo' ? 'correo' : (lead.canal === 'llamada' ? 'whatsapp' : 'web');
    return { canal, texto };
  }

  function responderCRM(c, texto, opcion) {
    const rol = c.rol;
    if (opcion) return despacharOpcionCRM(c, opcion);
    const it = detectar(texto, INTENCIONES_CRM);
    if (!it || it === 'ayuda') return res([msg(`Desde ${etiquetaRol(rol)} puedo ayudarte con esto. Elige una opción o escríbeme qué necesitas.`, sugerenciasCRM(rol))], [], reg('Permisos por rol', 'Opciones sugeridas por rol', 'regla'));
    if (!PERMISOS_CRM[rol].includes(it)) {
      return res([msg(`Eso lo hace ${quienHace[it] || 'otro rol'}. Desde ${etiquetaRol(rol)} te puedo ayudar con:`, sugerenciasCRM(rol))], [], reg('Permisos por rol', 'Redirigir a quien corresponde', 'regla'));
    }
    return ejecutarCRM(c, it, texto);
  }
  const etiquetaRol = (r) => ({ marketing: 'Marketing', ventas: 'Ventas', jefatura: 'Jefatura' }[r] || r);

  // Las acciones que escriben (pasar a Ventas, preparar propuesta, dejar visita, aprobar un envío) las ejecuta la barra
  // del CRM (crm/crm-agente.js), que es su única dueña. Este motor solo interpreta el texto y dice a qué lead se refiere.
  const DELEGADAS_TXT = { pasar: 'pasar a Ventas', propuesta: 'preparar la propuesta', visita: 'agendar la visita', aprobar_envio: 'aprobar el mensaje', aprobar_ok: 'confirmar la aprobación' };
  function delegarCRM(c, it, cuentaId, texto) {
    return res([msg(`Para ${DELEGADAS_TXT[it] || 'esa acción'} usa la barra del CRM: así queda registrada con tu nombre.`, sugerenciasCRM(c.rol))], [{ tipo: 'crm-intencion', intencion: it, cuentaId: cuentaId || null, rol: c.rol, texto: texto || '' }], reg('Texto interpretado por el motor', 'Delegar la acción a la barra del CRM', 'regla'));
  }

  function ejecutarCRM(c, it, texto) {
    const ents = buscarEntidades(texto);
    const cuentaId = ents[0] ? ents[0].id : c.cuentaId;
    const lead = leadCRM(cuentaId);
    const acciones = [];
    const sinLead = () => res([msg('No encuentro ese lead. Escribe su nombre o su código (por ejemplo, MC-HOR-2036) y lo busco.', sugerenciasCRM(c.rol))], [], reg('Búsqueda por nombre o código', 'Pedir identificador', 'regla'));
    switch (it) {
      case 'cotizo': {
        if (!lead) return sinLead();
        const mensajes = [msg(`Esto es lo que ${lead.nombre || 'este lead'} (${lead.empresa || lead.negocio || 'sin empresa'}) tiene en cotización, con los puntajes y su origen:`, sugerenciasCRM(c.rol), tarjetasLead(lead, cuentaId))];
        return res(mensajes, acciones, reg('Cotización, puntajes, origen, sitio y conversación', 'Resumen para decidir', 'ia'));
      }
      case 'mql': {
        if (!lead) return sinLead();
        const q = criterioMQL(lead);
        return res([msg(q.texto, c.rol === 'marketing' && q.cumple ? [chip('crm:pasar', 'Pásalo a Ventas')] : sugerenciasCRM(c.rol), [{ tipo: 'ficha', titulo: 'Criterios de MQL', filas: [['Interés', lead.puntajes && lead.puntajes.interes ? `${lead.puntajes.interes.puntaje}/100` : 'Sin puntaje'], ['Porqué', q.porque || '—']] }])], acciones, reg('Puntaje de interés y regla de MQL', 'Cumple o no cumple (regla)', 'regla'));
      }
      case 'puntaje': {
        if (!lead) return sinLead();
        return res([msg(`Puntajes de ${lead.nombre || 'este lead'}:`, sugerenciasCRM(c.rol), tarjetasLead(lead, cuentaId).filter((t) => t.titulo === 'Puntajes'))], acciones, reg('Puntajes con su porqué', 'Referencia de puntaje', 'regla'));
      }
      case 'origen': {
        if (!lead) return sinLead();
        return res([msg(`${lead.nombre || 'Este lead'} llegó por ${lead.fuente || 'un origen sin dato'}${lead.campana && lead.campana !== lead.fuente ? ', campaña ' + lead.campana : ''}.`, sugerenciasCRM(c.rol), tarjetasLead(lead, cuentaId).filter((t) => t.titulo === 'Origen y campaña'))], acciones, reg('Origen y campaña del registro', 'Referencia', 'regla'));
      }
      case 'sitio': {
        if (!lead) return sinLead();
        return res([msg('Esto es lo que hizo en el sitio:', sugerenciasCRM(c.rol), tarjetasLead(lead, cuentaId).filter((t) => t.titulo === 'Lo que hizo en el sitio'))], acciones, reg('Actividad registrada', 'Referencia', 'regla'));
      }
      case 'conversacion': {
        if (!lead) return sinLead();
        return res([msg('Esta es la conversación con el agente del cliente:', sugerenciasCRM(c.rol), tarjetasLead(lead, cuentaId).filter((t) => t.titulo.startsWith('Conversación')))], acciones, reg('Historial del agente', 'Referencia', 'regla'));
      }
      case 'dudas': {
        if (!lead) return sinLead();
        const preg = historial(cuentaId, 40).filter((m) => m.rol === 'comprador').map((m) => ({ t: m.texto }));
        return res([msg(preg.length ? `Estas son las preguntas que hizo ${lead.nombre || 'el lead'} en el chat:` : 'No hay preguntas registradas de este lead en el chat.', sugerenciasCRM(c.rol), preg.length ? [{ tipo: 'lista', titulo: 'Preguntas del chat', items: preg }] : [])], acciones, reg('Mensajes del comprador', 'Referencia', 'regla'));
      }
      case 'ejecutivo': {
        if (!lead) return sinLead();
        const pidio = historial(cuentaId, 60).some((m) => m.rol === 'comprador' && /persona|llam/.test(sinTildes(m.texto))) || (lead.canal === 'llamada');
        return res([msg(pidio ? `Sí: ${lead.nombre || 'el lead'} pidió hablar con una persona o una llamada.` : `No hay registro de que ${lead.nombre || 'el lead'} pidiera ejecutiva o llamada.`, sugerenciasCRM(c.rol))], acciones, reg('Mensajes y canal de contacto', 'Referencia', 'regla'));
      }
      case 'tazas': {
        if (!lead) return sinLead();
        const v = lead.respuestas && lead.respuestas.volumen;
        const supuesto = lead.respuestas && lead.respuestas.supuesto;
        return res([msg(v && v !== 'No lo sé' ? `Volumen de ${lead.nombre || 'el lead'}: ${volumenFrase(v)} tazas al día${supuesto ? ' (supuesto según su tipo de negocio)' : ''}.` : 'No tiene un volumen de tazas declarado.', sugerenciasCRM(c.rol))], acciones, reg(supuesto ? 'Tipo de negocio (supuesto)' : 'Respuesta del diagnóstico', supuesto ? 'Dato supuesto, confirmar' : 'Dato declarado', supuesto ? 'ia' : 'regla'));
      }
      case 'pasar': case 'propuesta': case 'visita': case 'aprobar_envio': return delegarCRM(c, it, cuentaId, texto);
      case 'resumen': return resumenCuentaCRM(c, lead, cuentaId);
      case 'canasta': return canastaCRM(c, lead, cuentaId);
      case 'aprobaciones': return listaAprobaciones(c);
      case 'aprobar_ref': return aprobarCRM(c, texto);
      default: return res([msg('No tengo una respuesta para eso. Elige una opción.', sugerenciasCRM(c.rol))], [], reg('Permisos por rol', 'Opciones', 'regla'));
    }
  }

  function pasarAVentas(c, lead, cuentaId) {
    if (!lead) return res([msg('No encuentro el lead a pasar. Escribe su nombre o código.', sugerenciasCRM(c.rol))], [], reg('Búsqueda', 'Pedir identificador', 'regla'));
    const q = criterioMQL(lead);
    if (!q.cumple) {
      return res([msg(`No lo paso todavía: ${q.texto} Te muestro lo que falta antes de decidir.`, sugerenciasCRM(c.rol), [{ tipo: 'ficha', titulo: 'Criterios de MQL', filas: [['Porqué', q.porque || '—']] }])], [], reg('Criterio de MQL (regla)', 'No pasar: no cumple', 'regla'));
    }
    const ejecutiva = lead.ejecutiva || 'la ejecutiva de zona';
    const resumen = [
      `Lead ${lead.nombre || 'sin nombre'}${lead.empresa ? ' · ' + lead.empresa : ''} (${lead.id})`,
      `Negocio: ${NEGOCIO_ETIQUETA[lead.negocio] || lead.negocio || 'sin dato'}${comunaReal(lead.comuna) ? ' · ' + comunaReal(lead.comuna) : ' · sin comuna (zona por defecto)'}`,
      `Interés ${lead.puntajes.interes ? lead.puntajes.interes.puntaje : '—'}/100 · valor ${lead.puntajes.valor ? lead.puntajes.valor.puntaje : '—'}/100`,
      `Origen: ${lead.fuente || 'sin dato'}${lead.campana && lead.campana !== lead.fuente ? ' · campaña ' + lead.campana : ''}`,
      `Canal preferido: ${lead.canal || 'sin dato'}`,
      `Dueño por zona: ${ejecutiva}${lead.zona ? ' (' + lead.zona + ')' : ''}${comunaReal(lead.comuna) ? '' : ' · sin comuna: zona por defecto'}`,
    ].join('\n');
    const borrador = mensajeBorrador(lead);
    const estadoBorrador = consentimientoDe(cuentaId)[borrador.canal] === true || borrador.canal === 'web' ? 'pendiente-aprobacion' : 'bloqueado-sin-consentimiento';
    const t = traspasoNuevo({
      leadId: cuentaId, de: 'marketing', a: 'ventas', tipo: 'venta', resumen, estado: 'asignado', dueno: ejecutiva,
      criterios: { mql: true, interes: lead.puntajes.interes ? lead.puntajes.interes.puntaje : null },
      borrador: { canal: borrador.canal, para: lead.nombre || 'contacto', texto: borrador.texto, estado: estadoBorrador },
      aviso: `${lead.nombre || 'Lead'} pasó de Marketing: ${ejecutiva}`,
    });
    agregarMensaje(cuentaId, { canal: 'nota', rol: 'marketing', texto: `Traspaso a Ventas (${t.id}) creado por Marketing con resumen. Ventas recibe el aviso.`, ts: ahora() });
    registrar({ rol: c.rol, accion: 'pasar-a-ventas', datoUsado: 'Criterios de MQL y ejecutiva de la zona', sugerencia: 'Traspaso con resumen y mensaje de seguimiento', nivel: 'persona', decidio: c.rol });
    const aviso = estadoBorrador === 'pendiente-aprobacion'
      ? `Listo: creé el traspaso ${t.id} a ${ejecutiva} y avisé a Ventas. Redacté el mensaje para ${lead.nombre || 'el lead'} por ${borrador.canal === 'web' ? 'el chat' : borrador.canal}. Antes de enviarlo, Marketing lo aprueba.`
      : `Listo: creé el traspaso ${t.id} a ${ejecutiva} y avisé a Ventas. El mensaje queda bloqueado: falta el consentimiento del contacto para ${borrador.canal}.`;
    return res([msg(aviso, [chip('crm:aprobar_envio', 'Aprobar el mensaje'), chip('crm:cotizo', 'Ver qué cotizó')], [{ tipo: 'mensaje', canal: borrador.canal, para: lead.nombre || 'contacto', texto: borrador.texto, estado: estadoBorrador === 'pendiente-aprobacion' ? 'Pendiente de aprobación de Marketing' : 'Bloqueado: sin consentimiento' }])], [{ tipo: 'traspaso', id: t.id, leadId: cuentaId, a: 'ventas' }, { tipo: 'notificacion', rol: 'ventas', texto: `Traspaso ${t.id}` }, { tipo: 'borrador', estado: estadoBorrador }], reg('Criterios de MQL y zona', 'Traspaso y mensaje personalizado', 'ia'));
  }

  function aprobarEnvioCRM(c, lead, cuentaId) {
    const t = leerEstado().traspasos.slice().reverse().find((x) => x.leadId === cuentaId && x.borrador && x.borrador.estado === 'pendiente-aprobacion');
    if (!t) return res([msg('No hay un mensaje pendiente de aprobación para este lead.', sugerenciasCRM(c.rol))], [], reg('Borradores', 'Nada pendiente', 'regla'));
    const out = enviar({ canal: t.borrador.canal, cuentaId, para: t.borrador.para, texto: t.borrador.texto, aprobadoPor: c.rol });
    if (!out.ok) {
      cambiarTraspaso(t.id, { borrador: Object.assign({}, t.borrador, { estado: 'bloqueado-sin-consentimiento' }) });
      return res([msg(`No puedo enviarlo: ${out.motivo}`, sugerenciasCRM(c.rol))], [{ tipo: 'envio', estado: 'bloqueado' }], reg('Consentimiento del contacto', 'Bloqueo de envío', 'regla'));
    }
    cambiarTraspaso(t.id, { borrador: Object.assign({}, t.borrador, { estado: 'enviado-simulado' }) });
    registrar({ rol: c.rol, accion: 'aprobar-envio', datoUsado: 'Borrador del agente', sugerencia: 'Mensaje personalizado', nivel: 'persona', decidio: c.rol });
    return res([msg(`Aprobado. El mensaje quedó enviado en la línea de tiempo (simulación; no sale nada real). Ventas lo ve en su historial.`, sugerenciasCRM(c.rol))], [{ tipo: 'envio', canal: t.borrador.canal, cuentaId }], reg('Borrador aprobado por Marketing', 'Envío simulado', 'persona'));
  }

  function resumenCuentaCRM(c, lead, cuentaId) {
    const acc = cuentasCRM().find((a) => a.id === cuentaId);
    if (acc) {
      const pedidos = Array.isArray(acc.orders) ? acc.orders : [];
      const ult = pedidos[pedidos.length - 1];
      const habituales = (acc.prods || []).map((k) => nombreProducto(k)).slice(0, 4);
      return res([msg(`Resumen de ${acc.name}: ${acc.business} en ${acc.comuna}. ${pedidos.length} pedidos registrados${ult ? ', el último con total ' + fmt(ult.total) : ''}.`, sugerenciasCRM(c.rol), [{ tipo: 'ficha', titulo: 'Cuenta', filas: [['Negocio', acc.business], ['Comuna', acc.comuna], ['Pedidos', String(pedidos.length)], ['Productos habituales', habituales.join(', ') || 'Sin dato']], nota: 'Datos del CRM de demostración.' }])], [], reg('Pedidos y productos de la cuenta', 'Resumen para decidir', 'ia'));
    }
    if (!lead) return res([msg('No encuentro la cuenta. Escribe su nombre o código.', sugerenciasCRM(c.rol))], [], reg('Búsqueda', 'Pedir identificador', 'regla'));
    const cot = recomendarCon(lead.respuestas || {});
    return res([msg(`Resumen de ${lead.nombre || 'el lead'}: ${NEGOCIO_ETIQUETA[lead.negocio] || lead.negocio || 'negocio sin dato'}${lead.comuna ? ' en ' + lead.comuna : ''}. Máquina que sugiere el motor: ${nombreMaquina(cot.machine || 'bar')}.`, sugerenciasCRM(c.rol), [{ tipo: 'ficha', titulo: 'Resumen de la cuenta', filas: [['Contacto', lead.nombre || 'Sin nombre'], ['Empresa', lead.empresa || 'Sin dato'], ['Negocio', NEGOCIO_ETIQUETA[lead.negocio] || lead.negocio || 'Sin dato'], ['Comuna', lead.comuna || 'Sin dato'], ['Canal', lead.canal || 'Sin dato']] }])], [], reg('Datos del lead', 'Resumen para decidir', 'ia'));
  }

  function canastaCRM(c, lead, cuentaId) {
    const base = lead ? recomendarCon(lead.respuestas || {}) : { machine: 'bar', base: [] };
    const sugeridos = (base.base || []).map((k) => nombreProducto(k));
    const tarjeta = tarjetaProductos(null);
    return res([msg(`Propuesta de canasta para ${lead ? lead.nombre || 'la cuenta' : 'la cuenta'}: ${nombreMaquina(base.machine || 'bar')} con los insumos de referencia. Precios netos + IVA; lo que no tenga precio aprobado va con la ejecutiva.${sugeridos.length ? ' Productos de la marca que sugiere el motor: ' + sugeridos.join(', ') + '.' : ''}`, sugerenciasCRM(c.rol), [tarjeta])], [], reg('Motor de recomendación y precios de referencia', 'Canasta sugerida (la ejecutiva decide)', 'ia'));
  }

  function propuestaCRM(c, lead, cuentaId, texto) {
    if (!lead) return res([msg('No encuentro el lead para la propuesta.', sugerenciasCRM(c.rol))], [], reg('Búsqueda', 'Pedir identificador', 'regla'));
    const especial = /descuento|rebaja|precio especial|credito|cuotas|%/.test(sinTildes(texto));
    if (especial) {
      const t = traspasoNuevo({ leadId: cuentaId, de: 'ventas', a: 'jefatura', tipo: 'aprobacion', resumen: `Propuesta de ${lead.nombre || 'el lead'} con condición especial pedida: ${texto.slice(0, 160)}. No se envía hasta aprobación.`, estado: 'por-aprobar', aviso: `Aprobación pendiente: condición especial de ${lead.nombre || 'un lead'}` });
      registrar({ rol: c.rol, accion: 'propuesta-condicion-especial', datoUsado: 'Pedido de condición especial', sugerencia: 'Aprobación de Jefatura', nivel: 'persona', decidio: null });
      return res([msg('Esta propuesta lleva una condición especial. Queda en aprobación de Jefatura y no se envía hasta que la aprueben.', [chip('crm:aprobaciones', 'Ver aprobaciones pendientes')], [{ tipo: 'folio', folio: t.id, estado: 'Por aprobar (Jefatura)', siguiente: 'Jefatura decide' }])], [{ tipo: 'aprobacion', id: t.id, estado: 'pendiente' }], reg('Condición especial pedida', 'Aprobación de una persona', 'persona'));
    }
    const cot = recomendarCon(lead.respuestas || {});
    const cotTarjeta = tarjetaCotizacion({ machine: cot.machine || 'bar', cups: CUPS_DE((lead.respuestas || {}).volumen), days: 26, services: [] }, 'Propuesta preparada (borrador)');
    registrar({ rol: c.rol, accion: 'preparar-propuesta', datoUsado: 'Respuestas del diagnóstico y precios de referencia', sugerencia: 'Borrador de propuesta', nivel: 'ia', decidio: null });
    return res([msg('Preparé un borrador de propuesta con la máquina sugerida. No se envía: la ejecutiva lo revisa y lo manda.', sugerenciasCRM(c.rol), [cotTarjeta])], [{ tipo: 'borrador-propuesta', leadId: cuentaId }], reg('Respuestas del diagnóstico', 'Borrador para revisión humana', 'ia'));
  }

  function visitaCRM(c, lead, cuentaId) {
    if (!lead) return res([msg('No encuentro el lead para la visita.', sugerenciasCRM(c.rol))], [], reg('Búsqueda', 'Pedir identificador', 'regla'));
    const ejecutiva = lead.ejecutiva || 'la ejecutiva de zona';
    const t = traspasoNuevo({ leadId: cuentaId, de: c.rol, a: 'ventas', tipo: 'visita', resumen: `Visita pendiente para ${lead.nombre || 'el lead'}. La fecha y la hora las confirma ${ejecutiva}.`, estado: 'pendiente-fecha', dueno: ejecutiva, aviso: `Visita pendiente con ${lead.nombre || 'el lead'}` });
    registrar({ rol: c.rol, accion: 'agendar-visita', datoUsado: 'Zona del lead', sugerencia: 'Dejar visita pendiente; fecha la confirma la ejecutiva', nivel: 'persona', decidio: null });
    return res([msg(`Dejé la visita pendiente con ${ejecutiva}. La fecha y la hora las confirma ella; yo no propongo horarios.`, sugerenciasCRM(c.rol), [{ tipo: 'folio', folio: t.id, estado: 'Pendiente de fecha', siguiente: `${ejecutiva} confirma la visita` }])], [{ tipo: 'traspaso', id: t.id, leadId: cuentaId, a: 'ventas' }], reg('Zona y ejecutiva', 'Visita sin fecha inventada', 'persona'));
  }

  function listaAprobaciones(c) {
    const pendientes = leerEstado().traspasos.filter((t) => t.estado === 'por-aprobar');
    if (!pendientes.length) return res([msg('No tienes nada por aprobar ahora.', sugerenciasCRM(c.rol))], [], reg('Traspasos por aprobar', 'Sin pendientes', 'regla'));
    const chips = pendientes.map((t) => chip('crm:aprobar_ref:' + t.id, `Aprobar: ${t.tipo === 'referido' ? 'referido' : 'aprobación'} ${t.id}`));
    const filas = pendientes.map((t) => [t.id, t.resumen.slice(0, 140)]);
    return res([msg(`Tienes ${pendientes.length} ${pendientes.length === 1 ? 'cosa' : 'cosas'} por aprobar. Elige una para revisarla; la decisión queda con tu nombre.`, chips, [{ tipo: 'ficha', titulo: 'Por aprobar', filas }])], [], reg('Traspasos con estado por aprobar', 'Lista para decidir', 'persona'));
  }

  function aprobarCRM(c, texto) {
    const pendientes = leerEstado().traspasos.filter((t) => t.estado === 'por-aprobar');
    const id = (texto.match(/\b(tr|rep|sop)-[a-z0-9-]+/i) || [])[0];
    const t = id ? pendientes.find((x) => x.id.toLowerCase() === id.toLowerCase()) : (pendientes.length === 1 ? pendientes[0] : null);
    if (!t) return listaAprobaciones(c);
    return res([msg(`¿Confirmas la aprobación de ${t.tipo === 'referido' ? 'el referido' : 'esta solicitud'} ${t.id}? Queda registrada con tu nombre.`, [chip('crm:aprobar_ok:' + t.id, 'Sí, apruébalo'), chip('crm:aprobaciones', 'Ahora no')])], [], reg('Traspaso por aprobar', 'Confirmar antes de registrar', 'persona'));
  }

  function despacharOpcionCRM(c, opcion) {
    if (opcion.startsWith('crm:')) {
      const [, clave, extra] = opcion.split(':');
      if (clave === 'aprobar_ok' && extra) return delegarCRM(c, 'aprobar_ok', c.cuentaId, extra);
      if (clave === 'aprobar_ref' && extra) return aprobarCRM(c, extra);
      const mapa = { cotizo: 'cotizo', mql: 'mql', dudas: 'dudas', pasar: 'pasar', resumen: 'resumen', canasta: 'canasta', propuesta: 'propuesta', visita: 'visita', aprobaciones: 'aprobaciones', aprobar_envio: 'aprobar_envio', ayuda: 'ayuda' };
      const it = mapa[clave];
      if (!it || it === 'ayuda') return res([msg('Elige una opción.', sugerenciasCRM(c.rol))], [], reg('Opciones por rol', 'Sugerencias', 'regla'));
      if (!PERMISOS_CRM[c.rol].includes(it)) return res([msg(`Eso lo hace ${quienHace[it] || 'otro rol'}.`, sugerenciasCRM(c.rol))], [], reg('Permisos por rol', 'Redirigir', 'regla'));
      const lead = leadCRM(c.cuentaId);
      return ejecutarCRM(Object.assign({}, c, { cuentaId: c.cuentaId }), it, lead ? (lead.nombre || '') : '');
    }
    if (opcion === 'aprobar-envio') return delegarCRM(c, 'aprobar_envio', c.cuentaId, '');
    return res([msg('Esa opción ya no está vigente.', sugerenciasCRM(c.rol))], [], reg('Opción no vigente', 'Sugerencias', 'regla'));
  }

  function confirmarAprobacion(c, tid) {
    const t = cambiarTraspaso(tid, { estado: 'aprobado', aprobadoPor: c.rol, aprobadoTs: ahora() });
    if (!t) return res([msg('Ese traspaso ya no está pendiente.', sugerenciasCRM(c.rol))], [], reg('Traspaso', 'Sin cambios', 'regla'));
    registrar({ rol: c.rol, accion: 'aprobar', datoUsado: t.resumen.slice(0, 120), sugerencia: 'Aprobación pedida por el agente', nivel: 'persona', decidio: c.rol });
    avisar('marketing', { tipo: 'aprobacion', texto: `Aprobado por ${etiquetaRol(c.rol)}: ${t.id}`, traspasoId: t.id, leadId: t.leadId });
    emitir('aprobacion', { traspasoId: t.id, decidio: c.rol, ts: ahora() });
    return res([msg(`Registré la aprobación ${t.id} con tu nombre. Marketing recibe el aviso.`, sugerenciasCRM(c.rol))], [{ tipo: 'aprobacion', id: t.id, estado: 'aprobado', decidio: c.rol }], reg('Decisión humana registrada', 'Aprobación confirmada', 'persona'));
  }

  // ---------- Respuesta principal ----------
  function responder(ctx, entrada) {
    const c = normCtx(ctx);
    const e = entrada || {};
    const texto = typeof e.texto === 'string' ? e.texto.trim() : '';
    const opcion = typeof e.opcion === 'string' ? e.opcion : '';
    if (!PRECIOS || !OFERTA) {
      cargarDatos();
      const aviso = msg('Estoy cargando los precios aprobados del prototipo. Intenta de nuevo en un momento.', [chip('inicio', 'Intentar de nuevo')]);
      if (c.lado === 'cliente') agregarMensaje(c.cuentaId, { canal: 'web', rol: 'agente', texto: aviso.texto, chips: aviso.chips, tarjetas: [], ts: ahora() });
      return res([aviso], [], reg('Datos aún no cargados', 'Reintentar', 'regla'));
    }
    let salida;
    try {
      salida = c.lado === 'crm' ? responderCRM(c, texto, opcion) : responderCliente(c, texto, opcion);
    } catch (err) {
      salida = res([msg('No pude leer ese dato ahora. Lo confirma una persona del equipo.', [chip('persona', 'Hablar con una persona')])], [], reg('Error controlado', 'Derivar a una persona', 'persona'));
    }
    if (!salida.registro) salida.registro = reg('Consulta respondida con datos del prototipo', 'Respuesta', 'regla');
    if (c.lado === 'cliente') {
      const etiqueta = typeof e.etiqueta === 'string' && e.etiqueta ? e.etiqueta : texto;
      if (etiqueta) agregarMensaje(c.cuentaId, { canal: 'web', rol: 'comprador', texto: etiqueta, ts: ahora() });
      salida.mensajes.forEach((m) => agregarMensaje(c.cuentaId, { canal: 'web', rol: 'agente', texto: m.texto, chips: m.chips || [], tarjetas: m.tarjetas || [], noEntendi: m.noEntendi === true, ts: ahora() }));
    }
    return salida;
  }

  // ---------- API pública ----------
  const datos = {
    lead(idLead) {
      const s = estadoProto();
      if (s.lead && s.lead.id === idLead) return leadDeEstado(s);
      const p = prospectos().find((x) => x.id === idLead);
      return p ? leadDeProspecto(p) : null;
    },
    cuenta(idCuenta) {
      const acc = cuentasCRM().find((a) => a.id === idCuenta);
      if (acc) return { id: acc.id, nombre: acc.name, negocio: acc.business, comuna: acc.comuna, frecuencia: acc.freq, margen: acc.margin, productos: (acc.prods || []).map(nombreProducto), referido: acc.referral || null, pedidos: (acc.orders || []).length };
      const lead = datos.lead(idCuenta);
      return lead ? { id: lead.id, nombre: lead.nombre, negocio: lead.negocio, comuna: lead.comuna, frecuencia: null, margen: null, productos: [], referido: null, pedidos: 0 } : null;
    },
    cotizacion(idCotizacion) {
      const s = estadoProto();
      if (s.lead && s.lead.id === idCotizacion) return Object.assign(cotizacionCliente(s), { lineas: lineasPrecio(), cargaBase: cargaBase(), totalPropuesta: s.proposal ? totalPropuesta() : null });
      const p = prospectos().find((x) => x.id === idCotizacion);
      if (!p) return null;
      const r = recomendarCon(respuestasDe(p));
      return { machine: r.machine || 'bar', cups: CUPS_DE(respuestasDe(p).volumen), services: [], days: 26, mode: 'comodato', origen: 'recomendacion', propuestaId: null, estado: null, lineas: lineasPrecio(), cargaBase: cargaBase() };
    },
    pedidos(idCuenta) {
      const acc = cuentasCRM().find((a) => a.id === idCuenta);
      if (acc) return (acc.orders || []).map((o) => ({ id: o.id, fecha: o.at, total: o.total, estado: o.status, lineas: (o.items || []).map((i) => ({ producto: nombreProducto(i.p), cantidad: i.qty })) }));
      const s = estadoProto();
      if (s.lead && s.lead.id === idCuenta) {
        const lista = Array.isArray(s.orders) ? s.orders : (s.order ? [s.order] : []);
        return lista.map((o) => ({ id: o.id || null, fecha: null, total: null, estado: o.status || null, lineas: [] }));
      }
      return [];
    },
    buscar(texto) {
      return buscarEntidades(String(texto || '')).map((f) => ({ tipo: f.tipo, id: f.id, nombre: f.nombre, empresa: f.empresa }));
    },
    // Máquina que recomienda el motor de C04 para un lead del CRM (mismas respuestas que usa el chat).
    recomendacion(idLead) {
      const s = estadoProto();
      let respuestas = null;
      if (s.lead && String(s.lead.id) === String(idLead)) respuestas = s.answers || {};
      else { const p = prospectos().find((x) => String(x.id) === String(idLead)); if (p) respuestas = respuestasDe(p); }
      if (!respuestas) return null;
      const r = recomendarCon(respuestas);
      return { machine: r.machine || null, nombre: nombreMaquina(r.machine || 'bar'), cups: Number.isFinite(Number(r.cups)) ? Number(r.cups) : null };
    },
  };

  window.MarleyAgenteNucleo = {
    version: VERSION,
    motor: { responder },
    datos,
    espera: { estado: estadoEspera, de: esperaDe },
    estado: { get: leerEstado, guardar: guardarEstado, registrar },
    canales: { enviar, permiso: (cuentaId, canal) => consentimientoDe(cuentaId)[canal] === true },
    eventos,
  };

  cargarDatos();
})();
