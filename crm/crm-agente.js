/* crm-agente.js · Agente del CRM (subagente B). «Pídele al agente» en el Hoy de Ventas, Marketing y Jefatura.
   Simulación determinista: lee M4, M4D, M4R, R6P y R7P como lo hace crm-v2.js; guarda en localStorage['marley.agente.v1']
   mediante window.MarleyAgente.estado; envía por window.MarleyAgente.canales (simulado) y usa su motor para el texto libre
   que no reconoce. Sin claves, sin llamadas externas. No edita crm-v2.js: la barra se monta sobre el «Hoy» al renderizar. */
(() => {
  'use strict';
  if (window.MarleyCRMAgente) return;

  const VERSION = '1.8';
  const ROOT_ID = 'crm-v2-root';
  const AG_KEY = 'marley.agente.v1';
  const HOY = { R01: 'ventas', R11: 'marketing', R05: 'jefatura' };
  const ROLES = ['ventas', 'marketing', 'jefatura'];
  const CANAL = { web: 'Chat web', whatsapp: 'WhatsApp', correo: 'Correo', nota: 'Nota' };
  const ROL_TXT = { ventas: 'Ventas', marketing: 'Marketing', jefatura: 'Jefatura', comprador: 'Comprador', cliente: 'Comprador', bot: 'Asistente del sitio', agente: 'Agente', ejecutiva: 'Ejecutiva', sistema: 'Sistema', persona: 'Persona del equipo' };
  const PERMISO_TXT = { yes: 'Permiso de promoción registrado', no: 'Sin permiso de promoción', reply: 'Solo puede responder su solicitud', unknown: 'Permiso por confirmar' };
  const NIVEL_TXT = { regla: 'Regla sin IA', ia: 'Sugerencia de IA', persona: 'Decisión de persona' };
  const ETIQUETA_EVENTO = { diag_completo: 'Completó el diagnóstico', diag_personalizado: 'Usó el diagnóstico personalizado' };
  const OFERTA = [['hotel', 'hotel'], ['restaurant', 'restaurante'], ['cafeter', 'cafeteria'], ['panader', 'panaderia'], ['convenien', 'conveniencia'], ['evento', 'eventos'], ['catering', 'eventos'], ['oficina', 'oficina'], ['ocs', 'oficina']];
  const STOP = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'al', 'a', 'y', 'o', 'en', 'un', 'una', 'que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantas', 'cuantos', 'quien', 'lead', 'leads', 'cliente', 'clientes', 'cuenta', 'empresa', 'para', 'por', 'con', 'mi', 'me', 'te', 'se', 'lo', 'le', 'es', 'su', 'sus', 'hola', 'favor', 'puedes', 'dame', 'muestra', 'muestrame', 'pasalo', 'pasa', 'pasar', 'ventas', 'venta', 'cumple', 'pidio', 'tazas', 'dudas', 'resume', 'resumen', 'propon', 'canasta', 'propuesta', 'prepara', 'aprueba', 'aprobar', 'referido', 'aprobacion', 'espera', 'visita', 'agenda', 'agendar', 'ejecutivo', 'mql', 'sql', 'cotizo', 'cotizado', 'cotizacion', 'este', 'esta', 'ese', 'esa', 'algo', 'todo', 'todos', 'del', 'the', 'tuvo', 'tiene', 'tienen', 'pidio', 'pregunto', 'quiere', 'quieren', 'hizo', 'puede', 'hay', 'hace', 'hacer', 'dame', 'dime', 'muestra', 'mostrar', 'proximo', 'paso', 'siguiente', 'hoy', 'ahora', 'envia', 'enviar', 'manda', 'mensaje', 'correo', 'whatsapp', 'envio', 'texto', 'aprobado', 'hola', 'dime']);
  const ESPECIAL = /descuent|%|especial|excepci|condicion|sin cargo|gratis|rebaja/;
  // Palabras que no identifican a una empresa: no bastan para elegir un lead o una solicitud.
  const GENERICAS = new Set(['hotel', 'restaurante', 'restaurant', 'cafeteria', 'cafe', 'hostal', 'panaderia', 'oficina', 'oficinas', 'empresa', 'eventos', 'catering', 'conveniencia', 'tienda', 'referido', 'propuesta', 'cuenta', 'rubro']);

  // ---------- Estado de la barra (en memoria; lo persistente va a marley.agente.v1 y al estado del CRM) ----------
  const S = { rol: null, hilo: { ventas: [], marketing: [], jefatura: [] }, foco: {}, borradores: {}, pend: { ventas: 0, marketing: 0, jefatura: 0 }, enfocar: false };
  let barEl = null, hiloEl = null, avisosEl = null, sugEl = null, inputEl = null, estadoEl = null, regEl = null;
  let hostObs = null, apiTimer = null;

  // ---------- Utilidades ----------
  const norm = v => String(v ?? '').toLocaleLowerCase('es-CL').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const recorta = (t, n = 180) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const uid = p => `${p}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const ahora = () => { try { const m = window.M4; return m && typeof m.now === 'function' ? m.now() : Date.now(); } catch (_) { return Date.now(); } };
  const m4 = () => window.M4 || null;
  const est = () => { try { return (m4() && m4().get()) || {}; } catch (_) { return {}; } };
  const d4 = () => window.M4D || {};
  const r4 = () => window.M4R || {};
  const p6 = () => window.R6P || null;
  const crm = () => est().crm2 || {};
  const rolM4 = () => est().role || null;
  const money = n => {
    if (n === null || n === undefined || n === '') return 'Por confirmar';
    const x = Number(n);
    if (!Number.isFinite(x)) return 'Por confirmar';
    try { return d4().fmtCLP ? d4().fmtCLP(x) : '$ ' + new Intl.NumberFormat('es-CL').format(Math.round(x)); } catch (_) { return '$ ' + Math.round(x); }
  };
  const hace = ts => {
    if (!ts) return '';
    const min = Math.max(0, Math.round((ahora() - Number(ts)) / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
  };
  const hora = ts => { try { return new Date(Number(ts)).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const lineas = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
  const tarjeta = (titulo, cuerpo, clase = '') => `<section class="crm-agente-tarjeta ${clase}"><h3>${esc(titulo)}</h3>${cuerpo}</section>`;
  // Todo valor se escapa: los nombres y textos llegan de compradores y del registro.
  const filas = pares => `<dl class="crm-agente-dl">${pares.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const lista = items => `<ul class="crm-agente-lista">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const chips = items => `<div class="crm-agente-chips">${items.map(t => `<button type="button" class="crm-agente-chip" data-crm-agente-sugerencia="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  const niveles = ({ regla, ia, persona, registro }) => `<div class="crm-agente-niveles" role="group" aria-label="Controles de esta acción">
      <div class="crm-agente-nivel" data-nivel="regla"><b>${NIVEL_TXT.regla}</b><span>${esc(regla)}</span></div>
      <div class="crm-agente-nivel" data-nivel="ia"><b>${NIVEL_TXT.ia}</b><span>${esc(ia)}</span></div>
      <div class="crm-agente-nivel" data-nivel="persona"><b>${NIVEL_TXT.persona}</b><span>${esc(persona)}</span></div>
      ${registro ? `<p class="crm-agente-registrado">Queda en el registro: ${esc(registro)}</p>` : ''}
    </div>`;

  // ---------- Datos del CRM (mismas fuentes que crm-v2.js) ----------
  const leadsDe = () => {
    let items = [];
    try { items = (r4().leads ? r4().leads(est()) : []) || []; } catch (_) { items = []; }
    if (!items.length) items = (d4().PROSPECTS || []).slice();
    // Igual que crm-v2.js: los registros no vivos se marcan como dato de prueba (afecta el permiso de MQL).
    return items.map(item => (item.live ? item : Object.assign({}, item, { dataTest: true })));
  };
  const leadPorId = x => leadsDe().find(l => String(l.id) === String(x)) || null;
  const cuentasDe = () => { try { return (r4().accounts ? r4().accounts() : d4().ACCOUNTS) || []; } catch (_) { return d4().ACCOUNTS || []; } };
  const esVivo = l => Boolean(est().lead && l && String(est().lead.id) === String(l.id));
  const empresaDe = l => l?.company || l?.accountName || l?.business || 'Empresa sin nombre';
  const contactoDe = l => l?.name || l?.contactName || 'Contacto sin nombre';
  const origenDe = l => l?.source || l?.attribution?.firstTouch?.source || l?.utm_source || 'Origen sin dato registrado';
  const campanaDe = l => l?.campaign || l?.attribution?.firstTouch?.campaign || l?.utm_campaign || (/Campaña/i.test(String(l?.source || '')) ? l.source : 'Sin campaña asociada');
  const piezaDe = l => l?.piece || l?.contentPiece || l?.attribution?.firstTouch?.piece || l?.utm_content || 'Pieza sin registro';
  const userDe = rol => d4().ROLE_MENUS?.[rol]?.user || ({ ventas: 'Ventas', marketing: 'Equipo de marketing', jefatura: 'Jefatura' })[rol] || 'Equipo';
  const claves = l => [...new Set([l?.id, l?.cuentaId, l?.accountId].filter(v => v !== undefined && v !== null && v !== '').map(String))];

  function permisoDe(item) {
    const guardado = item?.id ? crm().permissions?.[item.id]?.promotion : undefined;
    const v = guardado ?? item?.marketingConsent ?? item?.permissions?.promotion ?? item?.consent?.marketing;
    if (v === true || v === 'true' || v === 'si') return 'yes';
    if (v === false || v === 'false' || v === 'no') return 'no';
    if (v == null && item?.dataTest && ['MQL', 'SQL'].includes(item?.stage)) return 'yes';
    if (item?.requestedReply || item?.request?.reply) return 'reply';
    return 'unknown';
  }
  const interesDe = l => { try { return (p6()?.interes ? p6().interes(l || {}) : null) || { puntaje: Number(l?.score) || 0, porque: '', eventos: [] }; } catch (_) { return { puntaje: Number(l?.score) || 0, porque: '', eventos: [] }; } };
  const valorDe = l => { try { return (p6()?.valor ? p6().valor(l || {}) : null) || { puntaje: 0, porque: '', porqueSinMontos: '' }; } catch (_) { return { puntaje: 0, porque: '', porqueSinMontos: '' }; } };
  const pasoDe = l => (est().marketingPasos || {})[l?.id] || {};
  const enVentas = l => ['esperando', 'pendiente', 'aceptado', 'sql'].includes(pasoDe(l).estado);

  // Regla de MQL: la misma que usa crm-v2.js (isMql), explicada criterio por criterio.
  function criteriosMql(l) {
    const puntaje = Number(interesDe(l)?.puntaje || 0);
    const lista = [
      { ok: Boolean(l?.name || l?.contactName) && Boolean(l?.email || l?.phone || l?.company), txt: 'Contacto identificado: nombre y un dato de contacto' },
      { ok: l?.b2b === undefined ? Boolean(l?.business || l?.company) : l.b2b === true, txt: 'Negocio B2B (tipo de negocio del diagnóstico)' },
      { ok: permisoDe(l) === 'yes', txt: 'Permiso de promoción registrado' },
      { ok: puntaje >= 40, txt: `Interés de 40 o más (hoy ${puntaje})` }
    ];
    return { cumple: lista.every(c => c.ok), lista, puntaje };
  }

  // Cotización: fuente principal = datos.cotizacion() de A (máquina, productos con precio, carga base); luego la propuesta del CRM.
  // Si el lead no cotizó, se muestra la recomendación del motor y se rotula como tal.
  function datosCotizacion(l) {
    const api = window.MarleyAgente;
    try { return api && api.datos && typeof api.datos.cotizacion === 'function' ? api.datos.cotizacion(l.id) : null; } catch (_) { return null; }
  }
  const sumaProductos = cot => (cot && Array.isArray(cot.lineas) ? cot.lineas.reduce((a, x) => a + (Number(x.precio) > 0 ? Number(x.precio) : 0), 0) : 0);
  function cotizacionDe(l) {
    const cs = (crm().quotes || []).filter(q => String(q.leadId) === String(l?.id));
    if (cs.length) {
      const q = cs[cs.length - 1];
      return { origen: 'Propuesta de Ventas (CRM)', delLead: true, folio: q.folio || q.id, maquina: q.machine || 'Máquina por confirmar', lineas: [], cargaBase: Number(q.amount) > 0 ? Number(q.amount) : null, estado: q.status || 'Borrador', modo: null, tazas: null, dias: null, servicios: [] };
    }
    const dq = datosCotizacion(l);
    if (dq && dq.machine) {
      const s = est();
      const delLead = dq.origen === 'ajuste' || Boolean(esVivo(l) && (s.quote || s.proposal));
      return {
        origen: delLead ? 'Portal · el comprador ajustó su cotización' : 'Recomendación del motor (el lead no ha cotizado)',
        delLead, folio: null,
        maquina: d4().MACHINES?.[dq.machine]?.name || dq.machine,
        lineas: (dq.lineas || []).map(x => ({ t: x.t, d: x.d, precio: x.precio })),
        cargaBase: Number(dq.cargaBase) > 0 ? Number(dq.cargaBase) : null,
        total: Number.isFinite(Number(dq.totalPropuesta)) ? Number(dq.totalPropuesta) : null,
        estado: delLead ? (s.proposal ? 'Propuesta enviada en el portal' : 'Cotización en el portal') : 'Referencial',
        modo: dq.mode === 'compra' ? 'Compra' : 'Comodato',
        tazas: dq.cups ?? null,
        dias: dq.days || 26,
        servicios: (dq.services || []).map(k => d4().SERVICES?.[k]?.name || d4().SERVICES?.[k]?.label || k)
      };
    }
    const s = est();
    if (esVivo(l) && (s.proposal || s.quote)) {
      const src = s.proposal || s.quote;
      const mk = d4().MACHINES?.[src.machine];
      return { origen: 'Portal · el comprador ajustó su cotización', delLead: true, folio: null, maquina: mk?.name || src.machine || 'Máquina por confirmar', lineas: [], cargaBase: null, estado: s.proposal ? 'Propuesta enviada en el portal' : 'Cotización en el portal', modo: src.mode === 'compra' ? 'Compra' : 'Comodato', tazas: src.cups ?? null, dias: src.days || 26, servicios: (src.services || []).map(k => d4().SERVICES?.[k]?.name || k) };
    }
    return null;
  }

  // Sugerencia de catálogo (referencial, no es cotización): misma lógica que crm-v2.js (packDescription).
  function sugerenciaDe(l) {
    // La misma máquina que el motor de C04 (la del chat, la canasta y el CRM). Si el motor no está listo, cae a la tabla del rubro.
    let clave = '';
    try { const r = window.MarleyAgente?.datos?.recomendacion?.(l?.id); clave = r && r.machine ? r.machine : ''; } catch (_) { clave = ''; }
    if (!clave) { try { clave = d4().machineFor ? d4().machineFor({ negocio: l?.business || '', volumen: l?.volumen || '' }) || '' : ''; } catch (_) { clave = ''; } }
    const mk = clave ? d4().MACHINES?.[clave] : null;
    let pack = null;
    try { pack = p6()?.packInicial ? p6().packInicial(l?.business || l?.buyer || '') : null; } catch (_) { pack = null; }
    const monto = Number(pack);
    return { clave, maquina: mk?.name || 'Máquina según el rubro', tipo: mk?.kind || 'Confirmar compatibilidad con Ventas', monto: Number.isFinite(monto) && monto > 0 ? monto : null };
  }

  function actividadDe(l) {
    const evDict = (m4() && m4().EV) || {};
    const out = [];
    if (esVivo(l)) (est().events || []).slice(-6).forEach(e => out.push({ texto: e.label || e.key, pts: e.pts ?? null }));
    (interesDe(l).eventos || []).forEach(k => {
      const e = evDict[k];
      const texto = e?.label || ETIQUETA_EVENTO[k] || String(k).replace(/_/g, ' ');
      if (!out.some(o => o.texto === texto)) out.push({ texto, pts: e?.pts ?? null });
    });
    return out;
  }

  // ---------- Conversaciones y línea de tiempo multicanal ----------
  const esComprador = m => /comprador|cliente/i.test(String(m.rol || ''));
  function mensajesDe(l) {
    const out = [];
    const ags = leerAgente();
    claves(l).forEach(k => (ags.conversaciones[k] || []).forEach(m => out.push({ canal: m.canal || 'web', rol: m.rol || 'agente', texto: String(m.texto || ''), ts: m.ts || null, origen: m.simulado ? 'envío simulado' : 'agente del sitio' })));
    const s = est();
    if (esVivo(l) && Array.isArray(s.conv?.msgs)) s.conv.msgs.forEach(m => { if (m.from && m.from !== 'sistema') out.push({ canal: 'web', rol: m.from, texto: String(m.text || ''), ts: m.at || null, origen: 'chat del portal' }); });
    const prueba = (d4().DEMO_CONVOS || []).find(c => String(c.lead) === String(l?.id));
    if (prueba && !esVivo(l)) prueba.msgs.forEach(([from, text]) => out.push({ canal: 'web', rol: from, texto: String(text || ''), ts: null, origen: 'dato de prueba' }));
    (crm().conversations?.[l?.id] || []).forEach(m => out.push({ canal: 'nota', rol: 'ventas', texto: String(m.text || ''), ts: m.at || null, origen: 'nota del CRM' }));
    return out.map((m, i) => Object.assign(m, { _i: i })).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0) || a._i - b._i);
  }
  const dudasDe = msgs => msgs.filter(m => esComprador(m) && (/[?¿]/.test(m.texto) || /\b(cuanto|como|incluye|precio|plazo|despacho|comodato|garantia|cuando|donde|tienen|puedo)\b/.test(norm(m.texto)))).map(m => m.texto);
  const consentimientoDe = l => leerAgente().consentimientos[claves(l)[0]] || {};
  function canalesDe(l) {
    const c = consentimientoDe(l);
    const opts = [{ v: 'web', t: 'Chat del portal' }];
    if (c.correo) opts.push({ v: 'correo', t: 'Correo · consentimiento registrado' });
    if (c.whatsapp) opts.push({ v: 'whatsapp', t: 'WhatsApp · consentimiento registrado' });
    const pref = norm(l?.channel);
    const quiere = pref === 'correo' ? 'correo' : ['llamada', 'telefono', 'whatsapp'].includes(pref) ? 'whatsapp' : 'web';
    return { opts, sugerido: opts.some(o => o.v === quiere) ? quiere : 'web', consentimiento: c };
  }
  function timelineHtml(l, conId) {
    const msgs = mensajesDe(l);
    const cuenta = { web: 0, whatsapp: 0, correo: 0, nota: 0 };
    msgs.forEach(m => { cuenta[m.canal] = (cuenta[m.canal] || 0) + 1; });
    const cliente = msgs.filter(esComprador);
    const ultimo = cliente[cliente.length - 1];
    const dudas = dudasDe(msgs);
    const resumen = ultimo
      ? `<b>Resumen del chat (IA):</b> el cliente escribió «${esc(recorta(ultimo.texto, 120))}». ${dudas.length ? `Dudas abiertas: ${dudas.length}.` : 'Sin dudas abiertas.'}`
      : 'Sin conversación registrada con el cliente.';
    const items = msgs.map(m => `<li class="crm-agente-tl-item" data-canal="${esc(m.canal)}"><span class="crm-agente-canal">${esc(CANAL[m.canal] || m.canal)}</span><div><b>${esc(ROL_TXT[m.rol] || m.rol)}</b><p>${esc(recorta(m.texto, 220))}</p><small>${esc(m.ts ? hace(m.ts) : m.origen)}</small></div></li>`).join('');
    return `<section class="crm-agente-timeline"${conId ? ' id="crm-agente-timeline"' : ''} aria-label="Línea de tiempo de ${esc(empresaDe(l))}">
      <header><h3>Línea de tiempo multicanal</h3><p>${esc(empresaDe(l))} · chat web ${cuenta.web} · WhatsApp ${cuenta.whatsapp} · correo ${cuenta.correo} · notas ${cuenta.nota}</p></header>
      <p class="crm-agente-resumen-chat">${resumen}</p>
      <ol class="crm-agente-tl">${items || '<li class="crm-agente-tl-vacio">Sin mensajes todavía.</li>'}</ol>
    </section>`;
  }

  // ---------- Almacenamiento del agente (marley.agente.v1 vía window.MarleyAgente.estado) ----------
  function leerAgente() {
    let st = null;
    try {
      const api = window.MarleyAgente;
      st = api && api.estado && typeof api.estado.get === 'function' ? api.estado.get() : JSON.parse(localStorage.getItem(AG_KEY) || 'null');
    } catch (_) { st = null; }
    if (!st || typeof st !== 'object') st = {};
    if (!st.conversaciones || typeof st.conversaciones !== 'object') st.conversaciones = {};
    if (!Array.isArray(st.traspasos)) st.traspasos = [];
    if (!st.notificaciones || typeof st.notificaciones !== 'object') st.notificaciones = {};
    ROLES.forEach(r => { if (!Array.isArray(st.notificaciones[r])) st.notificaciones[r] = []; });
    if (!Array.isArray(st.registro)) st.registro = [];
    if (!st.consentimientos || typeof st.consentimientos !== 'object') st.consentimientos = {};
    return st;
  }
  function guardarAgente(st) {
    try {
      const api = window.MarleyAgente;
      if (api && api.estado && typeof api.estado.guardar === 'function') api.estado.guardar(st);
      else localStorage.setItem(AG_KEY, JSON.stringify(st));
    } catch (_) { /* sin almacenamiento: la barra sigue funcionando en memoria */ }
  }
  function mutarAgente(fn) { const st = leerAgente(); const out = fn(st); guardarAgente(st); return out; }
  function anotar(st, rol, accion, datoUsado, sugerencia, nivel, decidio) {
    st.registro.push({ ts: ahora(), rol, accion, datoUsado: datoUsado || '—', sugerencia: sugerencia || '—', nivel, decidio: decidio || '—' });
    if (st.registro.length > 300) st.registro.splice(0, st.registro.length - 300);
  }
  function avisar(st, rol, texto, extra) {
    st.notificaciones[rol].unshift(Object.assign({ id: uid('AVI'), texto, ts: ahora(), leida: false }, extra || {}));
    if (st.notificaciones[rol].length > 40) st.notificaciones[rol].length = 40;
  }
  // Escritura en el estado del CRM (el mismo que usa crm-v2.js): marketingPasos, handoffs, jefeAprob, followups, quotes.
  function escribirCrm(fn) {
    const m = m4();
    if (!m || typeof m.update !== 'function') return false;
    m.update(s => { if (!s.crm2 || typeof s.crm2 !== 'object') s.crm2 = {}; fn(s.crm2, s); });
    return true;
  }
  // Envío simulado: usa window.MarleyAgente.canales.enviar (que valida consentimiento y registra) y, si no existe, deja el mismo registro.
  function enviarSimulado(p) {
    const api = window.MarleyAgente;
    if (api && api.canales && typeof api.canales.enviar === 'function') {
      try { const r = api.canales.enviar(p); return r && typeof r === 'object' ? r : { ok: true }; }
      catch (_) { return { ok: false, motivo: 'no se pudo registrar el envío' }; }
    }
    mutarAgente(st => {
      st.conversaciones[p.cuentaId] = st.conversaciones[p.cuentaId] || [];
      st.conversaciones[p.cuentaId].push({ canal: p.canal, rol: p.aprobadoPor, texto: p.texto, ts: ahora(), aprobadoPor: p.aprobadoPor, simulado: true });
    });
    return { ok: true };
  }
  const apiPresente = () => Boolean(window.MarleyAgente && window.MarleyAgente.canales);
  const traspasoDe = l => leerAgente().traspasos.find(t => String(t.leadId) === String(l?.id)) || null;

  // ---------- Reglas y sugerencias ----------
  // Lo pendiente del recorrido (referidos y propuestas especiales de la conversación o de Ventas), lo más reciente primero.
  function aprobacionesDelRecorrido() {
    return leerAgente().traspasos
      .filter(t => t.estado === 'por-aprobar')
      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
      .map(t => {
        const ref = t.tipo === 'referido';
        const l = leadPorId(t.leadId);
        const quien = l ? empresaDe(l) : recorta(t.resumen || 'sin nombre', 50);
        return { id: t.id, leadId: t.leadId, cuenta: t.leadId, titulo: `${ref ? 'Beneficio por referido' : 'Propuesta especial'} · ${quien}`, tipo: ref ? 'referido' : 'descuento fuera de lista', detalle: recorta(t.resumen || '', 200), motivo: ref ? 'Canje de referido' : 'Excepción comercial', estado: 'pendiente', recorrido: true, por: ref ? 'Agente del sitio' : 'Ventas', ts: Number(t.ts) || 0 };
      });
  }
  function aprobacionesPendientes() {
    const s = est();
    const actual = Array.isArray(s.jefeAprob) ? s.jefeAprob : [];
    const ids = new Set(actual.map(x => x.id));
    const out = aprobacionesDelRecorrido().concat(actual.filter(x => ['pendiente', 'pidio_info'].includes(x.estado)));
    const mql = leadsDe().find(l => l.stage === 'MQL') || leadsDe()[0];
    if (mql && !ids.has('crm2-sample-proposal')) out.push({ id: 'crm2-sample-proposal', leadId: mql.id, cuenta: mql.id, titulo: `Propuesta especial · ${empresaDe(mql)}`, tipo: 'descuento fuera de lista', detalle: 'Dato de prueba · descuento fuera de lista; monto excepcional no registrado. El pack de catálogo es solo referencial.', motivo: 'Excepción comercial', monto: sugerenciaDe(mql).monto, estado: 'pendiente', dataTest: true });
    const ref = cuentasDe().find(a => a.referral);
    if (ref && !ids.has('crm2-sample-referral')) out.push({ id: 'crm2-sample-referral', leadId: ref.id, cuenta: ref.id, titulo: `Beneficio por referido · ${ref.name}`, tipo: 'referido', detalle: `Dato de prueba · ${ref.referral}. Confirmar permiso, vínculo B2B y beneficio.`, motivo: 'Canje de referido', estado: 'pendiente', dataTest: true });
    return out;
  }
  const itemPorId = id => (Array.isArray(est().jefeAprob) ? est().jefeAprob : []).find(x => x.id === id) || aprobacionesPendientes().find(x => x.id === id) || null;
  const esReferido = it => /referid/.test(norm(`${it?.tipo || ''} ${it?.titulo || ''}`));
  const nombreItem = it => { const l = leadPorId(it?.leadId) || cuentasDe().find(a => String(a.id) === String(it?.cuenta)); return l ? (l.company || l.name || l.business || it.titulo) : (it?.titulo || 'sin nombre'); };
  function checklistDe(it) {
    const reg = (Array.isArray(est().jefeAprob) ? est().jefeAprob : []).find(x => x.id === it.id) || it;
    const cl = reg.checklist || {};
    const cuenta = cuentasDe().find(a => String(a.id) === String(it.cuenta)) || null;
    return { permiso: cl.permission === true || permisoDe(cuenta || {}) === 'yes', b2b: cl.b2b === true || Boolean(cuenta?.business), beneficio: cl.benefit === true && Boolean(reg.beneficio || it.beneficio) };
  }
  // Opciones por rol (contrato 26-nov, punto 4): solo el trabajo de cada rol y todas con resultado.
  // Ventas cierra y repone; Marketing capta, hace postventa y mueve evangelizadores; Jefatura aprueba y mira metas.
  function sugerenciaTexto(rol) {
    const l = leadFoco(rol) || leadPrioritario();
    const nombre = l ? empresaDe(l) : 'este lead';
    if (rol === 'marketing') return ['¿Qué detractores tengo?', 'Pide reseña a los promotores', '¿Qué referidos llegaron?', `¿Qué cotizó ${nombre}?`];
    if (rol === 'ventas') return ['Resume mi día', '¿Qué cuentas toca reponer?', `Prepara la propuesta de ${nombre}`, `Agenda una visita con ${nombre}`];
    const pend = aprobacionesPendientes()[0];
    return ['¿Qué espera mi aprobación?', '¿Cómo vamos con las metas?', pend ? `Aprueba ${esReferido(pend) ? 'el referido' : 'la propuesta'} de ${nombreItem(pend)}` : 'Aprueba la propuesta especial'];
  }
  const leadFoco = rol => (S.foco[rol] ? leadPorId(S.foco[rol]) : null);
  function leadPrioritario() {
    const vivo = leadsDe().find(l => esVivo(l));
    if (vivo) return vivo;
    const mql = leadsDe().find(l => l.stage === 'MQL' && !enVentas(l));
    return mql || leadsDe()[0] || null;
  }
  function buscarLead(texto) {
    const q = norm(texto);
    if (!q) return null;
    const toks = q.split(' ').filter(t => t.length >= 3 && !STOP.has(t));
    const distintivos = toks.filter(t => !GENERICAS.has(t));
    let mejor = null, sc = 0;
    leadsDe().forEach(l => {
      const hay = norm(`${l.id} ${contactoDe(l)} ${empresaDe(l)} ${l.business || ''} ${l.comuna || ''}`);
      const emp = norm(empresaDe(l));
      const id = norm(l.id);
      const contacto = norm(l.name || l.contactName);
      const frase = ` ${q} `;
      const exacto = id && frase.includes(` ${id} `) ? 30
        : contacto.includes(' ') && frase.includes(` ${contacto} `) ? 20
        : emp && frase.includes(` ${emp} `) ? 10 : 0;
      const aciertos = toks.reduce((a, t) => a + (hay.includes(t) ? 1 : 0), 0);
      // Los nombres distintivos deben estar todos: «Hotel Inexistente» no trae el lead de otro hotel.
      const distOk = distintivos.length ? distintivos.every(t => hay.includes(t)) : aciertos > 0;
      if (!exacto && !distOk) return;
      const s = exacto + aciertos;
      if (s > sc) { sc = s; mejor = l; }
    });
    // Sin un nombre que coincida no se elige otro lead: antes el buscador del motor traía a cualquiera (p. ej. MC-HOR-2040).
    return mejor;
  }
  function buscarAprobacion(texto) {
    const q = norm(texto);
    const toks = q.split(' ').filter(t => t.length >= 3 && !STOP.has(t) && !['aprueba', 'aprobar', 'apruebe', 'propuesta', 'referido', 'beneficio', 'condicion', 'especial', 'solicitud', 'aprobacion', 'descuento'].includes(t));
    const distintivos = toks.filter(t => !GENERICAS.has(t));
    // Candidatas: pendientes y ya aprobadas (para responder «ya está aprobada»). Sin nombre que coincida no se elige nada.
    const candidatos = [...aprobacionesPendientes(), ...(Array.isArray(est().jefeAprob) ? est().jefeAprob : []).filter(x => x.estado === 'aprobada')];
    let mejor = null, sc = 0;
    candidatos.forEach(it => {
      const hay = norm(`${it.titulo} ${it.tipo} ${nombreItem(it)} ${it.detalle || ''}`);
      const aciertos = toks.reduce((a, t) => a + (hay.includes(t) ? 1 : 0), 0);
      const distOk = distintivos.length ? distintivos.every(t => hay.includes(t)) : aciertos > 0;
      if (!distOk) return;
      let s = aciertos;
      if (/referid/.test(q) && esReferido(it)) s += 0.5;
      if (/propuesta|descuento|especial|condicion/.test(q) && !esReferido(it)) s += 0.5;
      if (s > sc) { sc = s; mejor = it; }
    });
    return mejor;
  }
  function ofertaDe(negocio) { const t = norm(negocio); const h = OFERTA.find(([k]) => t.includes(k)); return h ? h[1] : null; }
  function slotsVisita() {
    const base = new Date(ahora());
    const out = [];
    let k = 1;
    while (out.length < 2 && k < 15) {
      const f = new Date(base);
      f.setDate(base.getDate() + k);
      k++;
      const dow = f.getDay();
      if (dow === 0 || dow === 6) continue;
      const hh = out.length ? 16 : 10;
      f.setHours(hh, 0, 0, 0);
      const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}T${String(hh).padStart(2, '0')}:00`;
      const etiqueta = `${f.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} · ${String(hh).padStart(2, '0')}:00`;
      out.push({ iso, etiqueta });
    }
    return out;
  }
  function ejecutivoDe(l) {
    let ex = null;
    try { ex = d4().execFor ? d4().execFor(l?.comuna || '') : null; } catch (_) { ex = null; }
    return ex || (d4().EXECS || {}).paula || { name: 'Ejecutiva de zona', role: 'Ejecutiva' };
  }
  function resumenDe(l) {
    const cot = cotizacionDe(l), msgs = mensajesDe(l), dudas = dudasDe(msgs);
    return [
      `${empresaDe(l)} (${l.business || 'rubro sin dato'}, ${l.comuna || 'comuna sin dato'}).`,
      `Interés ${Number(interesDe(l).puntaje || 0)}/100 y valor ${Number(valorDe(l).puntaje || 0)}/100.`,
      cot ? (cot.delLead ? `Cotizó ${cot.maquina}.` : `Sin cotización del lead; el motor recomienda ${cot.maquina} (referencial).`) : 'Sin cotización registrada.',
      dudas.length ? `${dudas.length} duda(s) abierta(s): «${recorta(dudas[dudas.length - 1], 90)}».` : 'Sin dudas registradas.'
    ].join(' ');
  }
  function borradorPara(l, ex, canal) {
    const nombre = contactoDe(l).split(' ')[0];
    const maq = cotizacionDe(l)?.maquina || 'una máquina para tu negocio';
    const vol = l.volumen ? `, ${String(l.volumen).toLowerCase()} tazas al día` : '';
    const cierre = canal === 'web' ? 'Te respondemos por este mismo chat.' : 'Te escribimos por ese mismo canal.';
    return `Hola ${nombre}, soy ${primerNombreCRM(ex.name) || 'una persona del equipo'}, ejecutiva de ${zonaDe(ex)} de Marley Coffee. Revisé tu interés en ${maq} para ${empresaDe(l)}${vol}. Ya te asignamos a una persona de nuestro equipo para revisar tu propuesta y resolver tus dudas. ¿Te acomoda una llamada esta semana? ${cierre}`;
  }
  const destinoDe = (l, canal) => (canal === 'correo' ? (l.email || contactoDe(l)) : canal === 'whatsapp' ? (l.phone || contactoDe(l)) : 'Chat del portal');

  // ---------- Acciones del CRM (escriben en el estado y en el registro) ----------
  function pasarAVentas(l) {
    const mql = criteriosMql(l);
    if (enVentas(l)) {
      const tr = traspasoDe(l);
      return tarjeta('Ya está en Ventas', `<p>${esc(empresaDe(l))} ya fue pasado${tr ? ` a ${esc(tr.dueno)} (${esc(tr.zona || 'zona por confirmar')})` : ''}. Ventas lo ve en su Hoy.</p>`) +
        niveles({ regla: 'Un lead no se pasa dos veces: el traspaso queda único.', ia: 'Sin cambios sugeridos.', persona: 'Marketing puede seguir la conversación en la línea de tiempo.', registro: '' });
    }
    if (!mql.cumple) {
      const faltan = mql.lista.filter(c => !c.ok).map(c => esc(c.txt));
      mutarAgente(st => anotar(st, 'marketing', 'regla:mql-no-cumple', `faltan: ${faltan.length}`, 'Sin IA: no se crea el traspaso', 'regla', 'Regla del CRM'));
      return tarjeta('Todavía no cumple para MQL', `<p>No pasé a ${esc(empresaDe(l))} a Ventas. Faltan:</p>${lista(faltan)}`, 'crm-agente-alerta') +
        niveles({ regla: `No cumple: faltan ${faltan.length} criterio(s).`, ia: 'Propongo revisar el dato que falta antes de pasarlo.', persona: 'Marketing corrige el dato y vuelve a pedirlo.', registro: 'intento de traspaso sin MQL' });
    }
    const ex = ejecutivoDe(l);
    const resumen = resumenDe(l);
    const canal = canalesDe(l);
    const borr = { id: uid('BOR'), leadId: l.id, canal: canal.sugerido, opts: canal.opts, texto: borradorPara(l, ex, canal.sugerido), estado: 'pendiente' };
    S.borradores[borr.id] = borr;
    escribirCrm((crm, s) => {
      s.marketingPasos = s.marketingPasos || {};
      const viejo = s.marketingPasos[l.id] || {};
      s.marketingPasos[l.id] = Object.assign({}, viejo, { estado: 'esperando', motivo: 'MQL calificado', por: userDe('marketing'), at: ahora() });
      crm.handoffs = crm.handoffs || {};
      crm.handoffs[l.id] = { status: 'esperando', reason: 'MQL calificado', at: ahora() };
    });
    let tr = null;
    mutarAgente(st => {
      tr = { id: uid('TR'), leadId: l.id, de: 'marketing', a: 'ventas', dueno: ex.name, zona: zonaDe(ex), resumen, estado: 'pendiente', canal: canal.sugerido, ts: ahora() };
      st.traspasos.unshift(tr);
      avisar(st, 'ventas', `Marketing pasó a ${empresaDe(l)}. Dueño por zona: ${duenoTexto(l, ex)}.`, { leadId: l.id, traspasoId: tr.id, tipo: 'traspaso' });
      anotar(st, 'marketing', 'regla:mql-verificado', mql.lista.map(c => (c.ok ? 'sí' : 'no')).join(' · '), 'Sin IA: criterios de MQL', 'regla', 'Regla del CRM');
      anotar(st, 'marketing', 'traspaso:resumen', `dueño por zona: ${duenoTexto(l, ex)}`, recorta(resumen, 140), 'ia', 'Agente (resumen)');
      anotar(st, 'marketing', 'traspaso:confirmar', `lead ${l.id}`, 'Pedido de Marketing', 'persona', userDe('marketing'));
    });
    try { window.MarleyAgente?.eventos?.emitir?.('traspaso', { leadId: l.id, dueno: ex.name, traspasoId: tr.id }); } catch (_) { /* opcional */ }
    S.foco.marketing = l.id;
    const cuerpo = `${filas([['Dueño por zona', duenoTexto(l, ex)], ['Estado', 'Pendiente de Ventas · visible en su Hoy'], ['Resumen', resumen]])}`;
    const html = tarjeta('Traspaso creado para Ventas', cuerpo, 'crm-agente-ok') +
      niveles({
        regla: `MQL: cumple ${mql.lista.filter(c => c.ok).length} de 4 (contacto, B2B, permiso e interés).`,
        ia: `Resumen del traspaso y mensaje redactados; dueño por zona: ${duenoTexto(l, ex)}.`,
        persona: 'Marketing pidió pasarlo y aprueba el mensaje antes de enviarlo.',
        registro: 'criterios MQL, resumen, dueño y aprobación de Marketing'
      });
    return { html, borradorId: borr.id };
  }
  function borradorHtml(b) {
    const cerrado = b.estado !== 'pendiente';
    const cuerpo = b.estado === 'pendiente'
      ? `<label class="crm-agente-campo-solo">Canal
           <select data-crm-agente-canal>${b.opts.map(o => `<option value="${esc(o.v)}"${o.v === b.canal ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select></label>
         <label class="crm-agente-campo-solo">Mensaje (puedes editarlo)
           <textarea data-crm-agente-texto rows="4">${esc(b.texto)}</textarea></label>
         <div class="crm-agente-acciones">
           <button type="button" class="crm-agente-btn crm-agente-btn--ok" data-crm-agente-accion="aprobar-envio" data-id="${esc(b.id)}">Aprobar y enviar (simulado)</button>
           <button type="button" class="crm-agente-btn" data-crm-agente-accion="descartar-envio" data-id="${esc(b.id)}">Descartar</button>
         </div>`
      : `<p class="crm-agente-nota">${b.estado === 'enviado' ? `Enviado por ${esc(CANAL[b.canal] || b.canal)} (simulado) · aprobó ${esc(userDe('marketing'))} · ${esc(hora(b.enviadoAt))}` : 'Descartado por Marketing; no se envió nada.'}</p><p class="crm-agente-texto-fijo">${esc(b.texto)}</p>`;
    return tarjeta('Mensaje para el lead · aprobación de Marketing', cuerpo, `crm-agente-borrador ${cerrado ? 'is-' + b.estado : ''}`).replace('<section ', `<section data-crm-agente-borrador="${esc(b.id)}" `);
  }
  function htmlCotizacion(rol, l) {
    const cot = cotizacionDe(l), iv = interesDe(l), vv = valorDe(l);
    const mql = criteriosMql(l), msgs = mensajesDe(l), dudas = dudasDe(msgs), act = actividadDe(l);
    const montos = rol !== 'marketing';
    const productos = cot && cot.lineas && cot.lineas.length
      ? `<p class="crm-agente-nota">Productos de la cotización (precio de referencia, IVA no incluido):</p><ul class="crm-agente-lista crm-agente-canasta">${cot.lineas.map(x => `<li><b>${esc(x.t)}</b><span>${esc(x.d || '')}</span><small>${x.precio ? esc(money(x.precio)) : 'Precio por confirmar'}</small></li>`).join('')}</ul>${sumaProductos(cot) ? `<p class="crm-agente-nota">Suma de productos de referencia: <b>${esc(money(sumaProductos(cot)))}</b></p>` : ''}`
      : '';
    const cotBloque = cot
      ? (cot.delLead ? '' : '<p class="crm-agente-nota">El lead no ha cotizado: lo que ves es la recomendación del motor, referencial y sin cierre.</p>') +
        filas([
          ['Máquina', cot.maquina],
          ...(cot.total != null ? [['Total neto referencial', money(cot.total) + ' + IVA']] : []),
          ['Modo y consumo', `${cot.modo || 'Comodato'} · ${cot.tazas ? cot.tazas + ' tazas al día' : 'consumo por confirmar'} · ${cot.dias || 26} días`],
          ['Servicios', (cot.servicios || []).length ? cot.servicios.join(', ') : 'Sin servicios extra'],
          ['Carga base de referencia', cot.cargaBase ? money(cot.cargaBase) : 'Por confirmar'],
          ['Mensualidad', 'Por confirmar con Ventas (sin cierre de precio)'],
          ['Origen', `${cot.origen}${cot.estado ? ' · ' + cot.estado : ''}`]
        ]) + productos
      : `<p>No hay cotización del lead ni recomendación disponible para este rubro. Ventas la prepara con el catálogo.</p>`;
    const porqueI = lineas(iv.porque).map(x => `<li>${esc(x)}</li>`).join('');
    const porqueV = lineas(montos ? vv.porque : (vv.porqueSinMontos || vv.porque)).map(x => `<li>${esc(x)}</li>`).join('');
    const puntajes = `<div class="crm-agente-puntajes">
        <div class="crm-agente-puntaje"><b>${Number(iv.puntaje || 0)}<small>/100</small></b><span>Interés · señales de compra</span><ul>${porqueI || '<li>Sin señales registradas.</li>'}</ul></div>
        <div class="crm-agente-puntaje"><b>${Number(vv.puntaje || 0)}<small>/100</small></b><span>Valor esperado · tazas, rubro, zona</span><ul>${porqueV || '<li>Sin detalle de valor.</li>'}</ul></div>
      </div>`;
    const origen = filas([['Origen', origenDe(l)], ['Campaña', campanaDe(l)], ['Pieza', piezaDe(l)], ['Permiso', PERMISO_TXT[permisoDe(l)]], ['Comuna y rubro', `${l.comuna || 'Comuna sin dato'} · ${l.business || 'Rubro sin dato'}`], ['Volumen declarado', l.volumen || est().answers?.volumen || 'Sin dato']]);
    const sitio = act.length ? `<ul class="crm-agente-lista">${act.slice(0, 6).map(a => `<li>${esc(a.texto)}${a.pts != null ? ` <small>+${esc(a.pts)} pts</small>` : ''}</li>`).join('')}</ul>` : '<p>Sin actividad registrada en el sitio.</p>';
    const chatWeb = msgs.filter(m => m.canal === 'web' && m.rol !== 'sistema').slice(-4);
    const chat = chatWeb.length ? `<ul class="crm-agente-chat">${chatWeb.map(m => `<li><b>${esc(ROL_TXT[m.rol] || m.rol)}</b> ${esc(recorta(m.texto, 160))}</li>`).join('')}</ul>` : '<p>Sin conversación en el chat del portal.</p>';
    const pasoBtn = rol === 'marketing' && !enVentas(l) ? `<div class="crm-agente-acciones"><button type="button" class="crm-agente-btn crm-agente-btn--ok" data-crm-agente-accion="pasar-a-ventas" data-id="${esc(l.id)}">Pásalo a Ventas</button></div>` : '';
    const body = [
      tarjeta('Lo que cotizó', cotBloque),
      tarjeta('Puntajes y su porqué', puntajes),
      tarjeta('Origen y campaña', origen),
      tarjeta('Qué hizo en el sitio', sitio),
      tarjeta('Conversación con el agente del cliente', `${chat}<p class="crm-agente-nota">Dudas abiertas: ${dudas.length}.</p>`)
    ].join('');
    const ctrl = niveles({
      regla: `MQL: ${mql.cumple ? 'cumple' : 'no cumple'} (${mql.lista.filter(c => c.ok).length} de 4 criterios). ${enVentas(l) ? 'Ya está en Ventas.' : ''}`.trim(),
      ia: `Lectura: ${recorta(resumenDe(l), 170)}`,
      persona: enVentas(l) ? 'Ventas tiene el lead; Marketing sigue la conversación.' : rol === 'marketing' ? 'Marketing decide si lo pasa a Ventas.' : rol === 'ventas' ? 'Ventas decide la siguiente acción.' : 'Jefatura revisa puntajes y aprobaciones.',
      registro: 'consulta de cotización, puntajes y origen'
    });
    return `<p class="crm-agente-lead">${esc(contactoDe(l))} · ${esc(empresaDe(l))}</p>${body}${pasoBtn}${ctrl}`;
  }
  function htmlResumen(l) {
    const cot = cotizacionDe(l), msgs = mensajesDe(l), dudas = dudasDe(msgs), tr = traspasoDe(l);
    const cuerpo = [
      tarjeta('La cuenta', filas([['Empresa', empresaDe(l)], ['Contacto', contactoDe(l)], ['Rubro y comuna', `${l.business || 'Rubro sin dato'} · ${l.comuna || 'Comuna sin dato'}`], ['Volumen', l.volumen || 'Sin dato'], ['Permiso', PERMISO_TXT[permisoDe(l)]]])),
      tarjeta('Traspaso', tr ? filas([['Dueño', tr.dueno], ['Zona', tr.zona || 'Sin dato'], ['Recibido', hace(tr.ts)], ['Estado', tr.estado]]) : '<p>Sin traspaso desde Marketing.</p>'),
      tarjeta('Qué cotizó', cot ? (cot.delLead ? `<p>${esc(cot.maquina)} · ${esc(cot.estado)}</p>` : `<p>Sin cotización del lead. El motor recomienda ${esc(cot.maquina)} (referencial).</p>`) : '<p>Sin cotización registrada.</p>'),
      tarjeta('Dudas abiertas', dudas.length ? lista(dudas.slice(-3).map(d => esc(recorta(d, 140)))) : '<p>Ninguna registrada.</p>')
    ].join('');
    const ia = `Resumen: ${recorta(resumenDe(l), 170)} Próximo paso sugerido: proponer la canasta y agendar la visita.`;
    return `<p class="crm-agente-lead">${esc(contactoDe(l))} · ${esc(empresaDe(l))}</p>${cuerpo}${niveles({ regla: 'Datos del registro: cotización, traspaso, puntajes y chat.', ia, persona: 'Ventas decide: canasta, propuesta o visita.', registro: 'resumen de la cuenta' })}${chips(['Propón la canasta', 'Prepara la propuesta', 'Agenda la visita'])}`;
  }
  function htmlCanasta(l) {
    const oferta = ofertaDe(l.business);
    const can = oferta && window.R7P?.canastas?.inicio?.porNegocio ? window.R7P.canastas.inicio.porNegocio[oferta] : null;
    if (!can) return tarjeta('Canasta de inicio', `<p>No hay canasta de inicio para ${esc(l.business || 'este rubro')}. Ventas la arma con el catálogo.</p>`) + niveles({ regla: 'Sin canasta del catálogo para este rubro: no invento productos.', ia: 'Sin sugerencia.', persona: 'Ventas arma la canasta con el catálogo.', registro: 'consulta de canasta' });
    const precio = p => (p.precioNeto ? `${money(p.precioNeto)} neto` : 'Precio por confirmar');
    const items = (can.productos || []).map(p => `<li><b>${esc(p.producto)}</b><span>${esc(p.formato || '')}</span><small>${esc(precio(p))}${p.estadoPrecio ? ' · ' + esc(p.estadoPrecio) : ''}</small></li>`).join('');
    const nota = window.R7P?.canastas?.inicio?.nota || '';
    return tarjeta(`Canasta de inicio · ${can.negocio || ''}`, `${filas([['Máquina', can.maquina || 'Por confirmar'], ['Consumo orientativo', can.consumoOrientativo || 'Por confirmar']])}<ul class="crm-agente-lista crm-agente-canasta">${items || '<li>Sin productos cargados.</li>'}</ul><p class="crm-agente-nota">${esc(nota)}</p>`) +
      niveles({ regla: 'Canasta del catálogo por tipo de negocio, no consumo medido. Precios de referencia; IVA no incluido.', ia: `Sugiero esta canasta para ${can.negocio || 'el negocio'} y su máquina.`, persona: 'Ventas confirma cantidades y precio antes de proponer.', registro: 'propuesta de canasta' }) + chips(['Prepara la propuesta']);
  }
  function htmlPropuesta(l, texto) {
    const cot = cotizacionDe(l), sug = sugerenciaDe(l);
    const monto = cot && cot.cargaBase ? cot.cargaBase : sug.monto;
    const maquina = cot ? cot.maquina : sug.maquina;
    if (ESPECIAL.test(norm(texto)) || ESPECIAL.test(texto)) {
      const item = { id: uid('AP-AG'), leadId: l.id, cuenta: l.id, titulo: `Propuesta con condición especial · ${empresaDe(l)}`, tipo: 'condición especial', monto, motivo: 'Condición especial pedida por Ventas', detalle: `Solicitud desde el agente de Ventas: «${recorta(texto, 160)}». Monto excepcional no registrado.`, estado: 'pendiente', por: userDe('ventas'), at: ahora(), dataTest: true };
      escribirCrm((crm, s) => {
        s.jefeAprob = Array.isArray(s.jefeAprob) ? s.jefeAprob : [];
        s.jefeAprob.push(item);
        s.marketingPasos = s.marketingPasos || {};
        s.marketingPasos[l.id] = Object.assign({}, s.marketingPasos[l.id] || {}, { aprobacion: 'pendiente' });
        crm.handoffs = crm.handoffs || {};
        crm.handoffs[l.id] = Object.assign({}, crm.handoffs[l.id] || {}, { status: 'pendiente de aprobación', reason: 'condición especial', at: ahora() });
      });
      mutarAgente(st => {
        avisar(st, 'jefatura', `Ventas pidió una condición especial para ${empresaDe(l)}. Pendiente de aprobación.`, { leadId: l.id, tipo: 'aprobacion', aprobacionId: item.id });
        anotar(st, 'ventas', 'regla:condicion-especial', 'Condición especial detectada en el pedido', 'Sin IA: va a aprobación de Jefatura', 'regla', 'Regla del CRM');
        anotar(st, 'ventas', 'propuesta:aprobacion', `carga base ${monto ? money(monto) : 'por confirmar'}`, 'Borrador de propuesta con condición especial', 'ia', 'Agente (borrador)');
        anotar(st, 'ventas', 'propuesta:pedir-aprobacion', `lead ${l.id}`, 'Pedido de Ventas', 'persona', userDe('ventas'));
      });
      return tarjeta('Propuesta a aprobación de Jefatura', `<p>Traigo una condición especial, así que la propuesta no se envía: queda en <b>Por aprobar</b> de Jefatura.</p>${filas([['Solicitud', item.titulo], ['Carga base de referencia', monto ? money(monto) : 'Por confirmar'], ['Estado', 'Pendiente de Jefatura']])}`, 'crm-agente-alerta') +
        niveles({ regla: 'Las condiciones especiales requieren aprobación de Jefatura.', ia: 'Borrador listo con el pack de referencia; el monto excepcional queda sin registrar.', persona: 'Ventas pidió la condición; Jefatura decide.', registro: 'solicitud de aprobación' });
    }
    let folio = '';
    escribirCrm((crm, s) => {
      crm.quotes = Array.isArray(crm.quotes) ? crm.quotes : [];
      crm.quoteSeq = Number(crm.quoteSeq || 0) + 1;
      folio = `MC-PROP-${String(crm.quoteSeq).padStart(4, '0')}`;
      crm.quotes.push({ id: folio, folio, leadId: l.id, company: empresaDe(l), contact: contactoDe(l), machine: maquina, amount: monto, channel: 'agente', status: 'Borrador · sin enviar', at: ahora(), dataTest: true, rationale: 'Borrador preparado por el agente desde el catálogo; Ventas revisa precio y condiciones.' });
      crm.conversations = crm.conversations || {};
      crm.conversations[l.id] = Array.isArray(crm.conversations[l.id]) ? crm.conversations[l.id] : [];
      crm.conversations[l.id].push({ from: 'Ventas', text: `Borrador ${folio} preparado desde el agente · sin enviar.`, at: ahora(), simulated: true });
    });
    mutarAgente(st => {
      anotar(st, 'ventas', 'regla:pack-catalogo', `carga base ${monto ? money(monto) : 'por confirmar'}`, 'Sin IA: cotización de referencia, IVA no incluido', 'regla', 'Regla del CRM');
      anotar(st, 'ventas', 'propuesta:borrador', folio, 'Borrador de propuesta', 'ia', 'Agente (borrador)');
    });
    return tarjeta('Borrador de propuesta listo', `${filas([['Propuesta', folio], ['Máquina', maquina], ['Carga base de referencia', monto ? money(monto) : 'Por confirmar'], ['Estado', 'Borrador · sin enviar']])}<p class="crm-agente-nota">Precio referencial, sin IVA. Ventas revisa y envía desde Propuestas (simulado).</p>`, 'crm-agente-ok') +
      niveles({ regla: 'Cotización de referencia del motor; sin condiciones especiales.', ia: 'Borrador con la máquina y los productos de la recomendación.', persona: 'Ventas revisa y envía (simulado).', registro: `borrador ${folio}` });
  }
  function htmlVisita(l) {
    const slots = slotsVisita();
    const ex = ejecutivoDe(l);
    const btns = slots.map(s => `<button type="button" class="crm-agente-btn" data-crm-agente-accion="agendar-visita" data-id="${esc(l.id)}" data-fecha="${esc(s.iso)}" data-etiqueta="${esc(s.etiqueta)}">${esc(s.etiqueta)}</button>`).join('');
    return tarjeta('Propongo dos horarios para la visita', `<p>Visita a ${esc(empresaDe(l))} con ${esc(ex.name)} (${esc(ex.role)}). Solo días hábiles.</p><div class="crm-agente-acciones">${btns}</div>`) +
      niveles({ regla: 'Solo días hábiles y horario de oficina.', ia: 'Propongo los dos primeros huecos disponibles.', persona: 'Ventas elige el horario; nada se agenda sin tu clic.', registro: 'propuesta de visita' });
  }
  function accionAgendar(leadId, iso, etiqueta) {
    const l = leadPorId(leadId);
    if (!l) return;
    const dup = (crm().followups || []).some(f => String(f.leadId) === String(leadId) && f.date === iso && f.channel === 'visita');
    if (dup) return pushAgente(S.rol, tarjeta('Visita ya agendada', `<p>Ya está agendada para ${esc(etiqueta)}.</p>`));
    escribirCrm(crm => {
      crm.followups = Array.isArray(crm.followups) ? crm.followups : [];
      crm.followups.push({ id: `CRM2-FU-${crm.followups.length + 1}`, leadId, name: contactoDe(l), accountName: empresaDe(l), date: iso, channel: 'visita', status: 'Programado', reason: 'Visita agendada desde el agente (elegida por Ventas)', at: ahora(), permission: PERMISO_TXT[permisoDe(l)] });
    });
    const ex = ejecutivoDe(l);
    const key = claves(l)[0] || String(leadId);
    enviarSimulado({ canal: 'nota', cuentaId: key, para: ex.name, texto: `Visita agendada para ${etiqueta} con ${ex.name}.`, aprobadoPor: 'ventas' });
    mutarAgente(st => {
      avisar(st, 'marketing', `Ventas agendó una visita a ${empresaDe(l)} (${etiqueta}).`, { leadId, tipo: 'visita' });
      anotar(st, 'ventas', 'visita:agendar', etiqueta, 'Horario sugerido por el agente', 'persona', userDe('ventas'));
    });
    pushAgente(S.rol, tarjeta('Visita agendada', `${filas([['Empresa', empresaDe(l)], ['Cuándo', etiqueta], ['Con', ex.name]])}<p class="crm-agente-nota">Queda en Contactos y en la línea de tiempo.</p>`, 'crm-agente-ok') +
      niveles({ regla: 'Horario en día hábil; sin choque con otra visita.', ia: 'Horario sugerido por el agente.', persona: `${userDe('ventas')} eligió el horario.`, registro: 'visita agendada' }), { tl: l.id });
  }
  function accionEnviarBorrador(bid, card) {
    const b = S.borradores[bid];
    if (!b || b.estado !== 'pendiente') return notaRol('Ese mensaje ya no está pendiente.');
    const l = leadPorId(b.leadId);
    if (!l) return notaRol('No encuentro el lead de este mensaje.');
    const canal = card?.querySelector('[data-crm-agente-canal]')?.value || b.canal;
    const texto = (card?.querySelector('[data-crm-agente-texto]')?.value || b.texto || '').trim();
    if (!texto) return notaRol('El mensaje está vacío. Escribe un texto antes de aprobar.');
    const permitido = canalesDe(l).opts.some(o => o.v === canal);
    if (!permitido) return notaRol('Ese canal no tiene consentimiento registrado. Usa el chat del portal o pide consentimiento.');
    const key = claves(l)[0] || String(l.id);
    const r = enviarSimulado({ canal, cuentaId: key, para: destinoDe(l, canal), texto, aprobadoPor: 'marketing' });
    if (r && r.ok === false) return notaRol(`No se envió: ${r.motivo || 'falta un requisito del contacto'}.`);
    b.estado = 'enviado'; b.canal = canal; b.texto = texto; b.enviadoAt = ahora();
    mutarAgente(st => {
      if (!apiPresente()) anotar(st, 'marketing', 'envio:aprobar', `canal ${CANAL[canal]} · ${canal === 'web' ? 'chat del portal' : 'consentimiento registrado'}`, 'Texto redactado por IA y editado por Marketing', 'persona', userDe('marketing'));
      avisar(st, 'ventas', `Marketing envió un mensaje a ${empresaDe(l)} por ${CANAL[canal]} (simulado).`, { leadId: l.id, tipo: 'envio' });
    });
    S.borradores[bid] = b;
    pushAgente(S.rol, tarjeta('Envío simulado registrado', `<p>El mensaje quedó en la línea de tiempo de ${esc(empresaDe(l))} y en el lado del cliente. No salió del prototipo.</p>`, 'crm-agente-ok') +
      niveles({ regla: 'Solo se envía por un canal con consentimiento o en el chat del portal.', ia: 'Texto redactado por IA; Marketing lo editó o lo aceptó.', persona: `Aprobó ${userDe('marketing')}.`, registro: 'envío aprobado' }), { tl: l.id });
  }
  function accionDescartarBorrador(bid) {
    const b = S.borradores[bid];
    if (!b || b.estado !== 'pendiente') return;
    b.estado = 'descartado';
    mutarAgente(st => anotar(st, 'marketing', 'envio:descartar', `lead ${b.leadId}`, 'Mensaje sugerido por IA', 'persona', userDe('marketing')));
    refrescarHilo();
  }
  function htmlAprobacion(it) {
    const ya = (Array.isArray(est().jefeAprob) ? est().jefeAprob : []).find(x => x.id === it.id);
    if (ya && ya.estado === 'aprobada') return tarjeta('Ya está aprobada', filas([['Solicitud', it.titulo], ['Estado', 'Aprobada']]), 'crm-agente-ok') + niveles({ regla: 'Una solicitud aprobada no se vuelve a aprobar.', ia: 'Sin cambios sugeridos.', persona: `Aprobó ${userDe('jefatura')}.`, registro: '' });
    const ref = esReferido(it);
    const cl = ref ? checklistDe(it) : null;
    const faltan = ref ? [!cl.permiso && 'permiso de promoción', !cl.b2b && 'vínculo B2B', !cl.beneficio && 'beneficio'].filter(Boolean) : [];
    const cuerpo = `${filas([['Solicitud', it.titulo], ['Tipo', it.tipo || 'Excepción'], ['Monto', it.monto ? money(it.monto) : 'Sin monto registrado'], ['Detalle', recorta(it.detalle || '', 200)]])}`;
    const accion = faltan.length
      ? `<div class="crm-agente-acciones"><button type="button" class="crm-agente-btn" data-crm-agente-accion="confirmar-checklist" data-id="${esc(it.id)}">Confirmar permiso, vínculo y beneficio</button></div>`
      : `<div class="crm-agente-acciones"><button type="button" class="crm-agente-btn crm-agente-btn--ok" data-crm-agente-accion="confirmar-aprobacion" data-id="${esc(it.id)}" data-cierra-tarea="${ref ? 'C-J3' : 'C-J2'}">Confirmar aprobación</button><button type="button" class="crm-agente-btn" data-crm-agente-accion="cancelar">Cancelar</button></div>`;
    const reglaTxt = ref ? (faltan.length ? `Falta: ${faltan.join(', ')}. Sin esto no se puede aprobar el referido.` : 'Permiso, vínculo B2B y beneficio verificados.') : 'Excepción comercial: se aprueba con monto y condiciones registrados.';
    return tarjeta('¿Confirmas esta aprobación?', cuerpo + accion, 'crm-agente-confirmar') +
      niveles({ regla: reglaTxt, ia: ref ? 'Orden sugerido: referidos primero por su efecto en el canal.' : 'Revisa que el monto esté dentro de lo que Jefatura aprueba.', persona: 'Jefatura confirma; el agente registra y avisa a Marketing.', registro: faltan.length ? '' : 'aprobación pedida' });
  }
  function accionConfirmarChecklist(id) {
    const it = itemPorId(id);
    if (!it) return;
    const cuenta = cuentasDe().find(a => String(a.id) === String(it.cuenta));
    const referido = window.MarleyCRM2?.postventa?.referidos().find(r => String(r.cuentaId) === String(it.cuenta) && Boolean(r.ejemplo) === Boolean(it.dataTest));
    const beneficio = it.beneficio || (referido?.permiso === true ? d4().LM?.LM7?.gives : '');
    const permiso = referido ? referido.permiso === true : permisoDe(cuenta || {}) === 'yes';
    const negocio = referido?.negocio || cuenta?.business;
    if (!permiso || !negocio || !beneficio) {
      return notaRol('Falta registrar el permiso, el vínculo o el beneficio. Pide los datos a Marketing antes de aprobar.');
    }
    escribirCrm((crm, s) => {
      s.jefeAprob = Array.isArray(s.jefeAprob) ? s.jefeAprob : [];
      let reg = s.jefeAprob.find(x => x.id === id);
      if (!reg) { reg = { id: it.id, leadId: it.leadId, cuenta: it.cuenta, titulo: it.titulo, tipo: it.tipo, monto: it.monto || null, motivo: it.motivo, detalle: it.detalle, estado: 'pendiente', dataTest: true, at: ahora() }; s.jefeAprob.push(reg); }
      reg.checklist = Object.assign({}, reg.checklist || {}, { permission: true, b2b: true, benefit: true });
      reg.beneficio = beneficio;
    });
    mutarAgente(st => anotar(st, S.rol, 'aprobacion:checklist', `permiso, B2B y beneficio de ${nombreItem(it)}`, 'Regla: requisitos del referido', 'persona', userDe('jefatura')));
    pushAgente(S.rol, htmlAprobacion(itemPorId(id) || it));
  }
  function accionConfirmarAprobacion(id) {
    const it = itemPorId(id);
    if (!it) return notaRol('Esa solicitud ya no está en la lista.');
    const actual = (est().jefeAprob || []).find(x => x.id === id);
    if (actual && actual.estado === 'aprobada') return notaRol('Esa solicitud ya estaba aprobada.');
    if (esReferido(it)) {
      const cl = checklistDe(it);
      if (!cl.permiso || !cl.b2b || !cl.beneficio) return pushAgente(S.rol, htmlAprobacion(it));
    }
    const nota = 'Aprobada desde el agente de Jefatura';
    const referido = esReferido(it);
    const destino = referido ? 'marketing' : 'ventas';
    const nombreRol = referido ? 'Marketing' : 'Ventas';
    escribirCrm((crm, s) => {
      s.jefeAprob = Array.isArray(s.jefeAprob) ? s.jefeAprob : [];
      let reg = s.jefeAprob.find(x => x.id === id);
      if (!reg) { reg = { id: it.id, leadId: it.leadId, cuenta: it.cuenta, titulo: it.titulo, tipo: it.tipo, monto: it.monto || null, motivo: it.motivo, detalle: it.detalle, dataTest: true, at: ahora() }; s.jefeAprob.push(reg); }
      reg.estado = 'aprobada'; reg.nota = nota; reg.decidedAt = ahora(); reg.decididoPor = userDe('jefatura');
      s.actividadJefe = Array.isArray(s.actividadJefe) ? s.actividadJefe : [];
      s.actividadJefe.push({ id: it.leadId || it.cuenta || id, texto: `Aprobada: ${it.titulo} · desde el agente`, at: ahora() });
      if (it.leadId && s.marketingPasos?.[it.leadId]) s.marketingPasos[it.leadId].aprobacion = 'aprobada';
      crm.approvalHistory = Array.isArray(crm.approvalHistory) ? crm.approvalHistory : [];
      crm.approvalHistory.push({ id, decision: 'aprobada', note: nota, at: ahora() });
      const quote = (crm.quotes || []).findLast(q => q.leadId === it.leadId && q.status === 'Esperando aprobación');
      if (!referido && quote) quote.status = 'Aprobada por Jefatura';
      if (referido) {
        const ref = s.postventa?.referidos?.find(r => String(r.cuentaId) === String(it.cuenta));
        if (ref) ref.estado = 'aprobado';
      }
    });
    mutarAgente(st => {
      avisar(st, destino, `Jefatura aprobó: ${it.titulo}.`, { leadId: it.leadId || null, tipo: 'aprobacion' });
      anotar(st, S.rol, 'aprobacion:confirmar', it.titulo, 'Confirmación pedida por el agente', 'persona', userDe('jefatura'));
      // Lo que vino del recorrido sale de la lista de pendientes: su traspaso queda aprobado.
      const tr = st.traspasos.find(x => x.id === it.id) || null;
      if (tr) { tr.estado = 'aprobado'; tr.aprobadoPor = userDe('jefatura'); tr.aprobadoTs = ahora(); }
    });
    marcarEstadoFila(it.leadId || it.cuenta || id, 'aprobacion', `Aprobada hoy ${horaTexto(ahora())}`);
    pushAgente(S.rol, tarjeta('Aprobación registrada', `${filas([['Solicitud', it.titulo], ['Estado', 'Aprobada'], ['Aviso', nombreRol + ' recibe el aviso']])}`, 'crm-agente-ok') +
      niveles({ regla: referido ? 'Permiso, B2B y beneficio confirmados antes de aprobar.' : 'Excepción registrada con su detalle.', ia: 'Aviso preparado para ' + nombreRol + '.', persona: `Aprobó ${userDe('jefatura')}.`, registro: 'aprobación confirmada' }));
  }
  function htmlPendientes() {
    const lista2 = aprobacionesPendientes();
    if (!lista2.length) return tarjeta('Por aprobar', '<p>No tienes nada pendiente de aprobación.</p>') + niveles({ regla: 'Lista vacía: no hay solicitudes en Por aprobar.', ia: 'Sin sugerencias.', persona: 'Nada que decidir ahora.', registro: '' });
    const filasHtml = lista2.map(it => `<li><b>${esc(it.titulo)}</b><small>${esc(it.tipo || 'Excepción')} · ${it.monto ? esc(money(it.monto)) : 'sin monto'} · ${esc(it.por || 'Ventas')}</small><button type="button" class="crm-agente-btn crm-agente-btn--mini" data-crm-agente-accion="revisar-aprobacion" data-id="${esc(it.id)}">Revisar</button></li>`).join('');
    return tarjeta('Lo que espera tu aprobación', `<ul class="crm-agente-lista crm-agente-pendientes">${filasHtml}</ul>`) +
      niveles({ regla: 'Referidos y excepciones requieren tu confirmación; el agente no aprueba solo.', ia: `Orden sugerido: ${esc(nombreItem(lista2[0]))} primero.`, persona: 'Tú decides cada solicitud.', registro: 'consulta de pendientes' });
  }
  function htmlSinAprobacion(texto) {
    const pend = aprobacionesPendientes();
    return tarjeta('No encuentro esa solicitud', `<p>No hay una solicitud pendiente que coincida con «${esc(recorta(texto, 80))}».</p>${pend.length ? chips(pend.slice(0, 3).map(it => `Aprueba la propuesta de ${nombreItem(it)}`)) : ''}`) +
      niveles({ regla: 'Solo apruebo solicitudes que existen en Por aprobar.', ia: 'Te muestro lo pendiente.', persona: 'Tú eliges cuál revisar.', registro: '' });
  }

  // ---------- Respuestas de postventa, recomendados, reposición y metas (contrato 26-nov) ----------
  // El agente lee los mismos datos y ejemplos que la pestaña del rol; si no hay datos, lo dice y ofrece la acción útil.
  const pvApi = () => window.MarleyCRM2?.postventa || null;
  const crmApi = () => window.MarleyCRM2 || null;
  function htmlDetractores() {
    const lista = (pvApi()?.detractores?.() || []).filter(item => !item.resuelto);
    if (!lista.length) return tarjeta('Sin detractores pendientes', '<p>No hay respuestas con NPS de 0 a 6 ni caritas «no contento» esperando respuesta.</p>') + chips(['¿Qué referidos llegaron?', 'Pide reseña a los promotores']) + niveles({ regla: 'Detractor: NPS de 0 a 6 o carita «no contento».', ia: 'Sin casos abiertos en este momento.', persona: 'Marketing revisa la pestaña Postventa.', registro: 'consulta de detractores' });
    const items = lista.slice(0, 4).map(item => `<li><b>${esc(item.nombre)}</b> <small>NPS ${item.nps ?? 's/n'}/10 · ${esc(item.rubro)}${item.ejemplo ? ' · ejemplo' : ''}</small><p>${esc(recorta(item.abierta || item.ayuda?.resumen || 'Sin comentario registrado.', 120))}</p><button type="button" class="crm-agente-btn crm-agente-btn--mini" data-crm-agente-accion="abrir-tarea" data-tipo="detractor" data-id="${esc(item.cuentaId)}">Responder al detractor</button></li>`).join('');
    return tarjeta(`Detractores por resolver (${lista.length})`, `<ul class="crm-agente-lista crm-agente-pendientes">${items}</ul>`) +
      niveles({ regla: 'Primero se resuelve la fricción; la reseña se invita después y nunca se bloquea.', ia: `Sugiero responder primero a ${lista[0].nombre} (NPS ${lista[0].nps ?? 's/n'}).`, persona: 'Marketing edita y envía la respuesta.', registro: 'consulta de detractores' });
  }
  function htmlPromotores() {
    const lista = (pvApi()?.promotores?.() || []).filter(item => !item.resena || !item.referido);
    if (!lista.length) return tarjeta('Sin promotores por invitar', '<p>Todos los promotores registrados ya tienen su invitación a reseña o referido.</p>') + chips(['¿Qué detractores tengo?', '¿Qué referidos llegaron?']) + niveles({ regla: 'Promotor: NPS de 9 o 10.', ia: 'No queda ninguno sin invitar.', persona: 'Marketing revisa Recomendados.', registro: 'consulta de promotores' });
    const primero = lista[0];
    abrirTarea('resena', primero.cuentaId);
    const otros = lista.slice(1, 4).map(item => `<li><b>${esc(item.nombre)}</b> <small>NPS ${item.nps}/10 · ${esc(item.rubro)}</small></li>`).join('');
    return tarjeta('Reseña pedida al primer promotor', `<p>Armé la invitación para <b>${esc(primero.nombre)}</b> (NPS ${primero.nps}/10). Edítala y envíala cuando quieras.</p>${otros ? `<p>Quedan ${lista.length - 1} promotor(es) por invitar:</p><ul class="crm-agente-lista">${otros}</ul>` : ''}`) +
      niveles({ regla: 'Sin incentivos por reseñas y sin bloquear la reseña pública.', ia: 'Elegí al promotor con mayor NPS.', persona: 'Marketing aprueba y envía la invitación.', registro: 'invitación a reseña' });
  }
  function htmlReferidos() {
    const lista = pvApi()?.referidos?.() || [];
    if (!lista.length) return tarjeta('Sin referidos todavía', '<p>Ninguna cuenta recomendó a otro negocio en el registro.</p>') + chips(['¿Qué detractores tengo?', 'Pide reseña a los promotores']) + niveles({ regla: 'El negocio referido decide si quiere cotizar.', ia: 'Sin referidos registrados.', persona: 'Marketing invita a los promotores.', registro: 'consulta de referidos' });
    const items = lista.slice(0, 5).map(item => `<li><b>${esc(item.negocio)}</b> <small>${esc(item.nombre)} lo recomendó · ${esc(item.estado)}${item.ejemplo ? ' · ejemplo' : ''}</small><p>Contacto ${esc(item.contacto)} · permiso ${item.permiso ? 'registrado' : 'por confirmar'}.</p></li>`).join('');
    return tarjeta(`Referidos que llegaron (${lista.length})`, `<ul class="crm-agente-lista">${items}</ul>`) +
      niveles({ regla: 'Solo se contacta al negocio referido con su permiso.', ia: `${lista.filter(item => item.estado === 'enviado').length} esperan revisión.`, persona: 'Marketing confirma el permiso y pasa el lead a Ventas.', registro: 'consulta de referidos' });
  }
  function htmlMetas(rol) {
    const metas = crmApi()?.metas?.();
    if (!metas) return tarjeta('Metas y KPIs', '<p>No pude leer el tablero de metas en este momento.</p>') + chips(['¿Qué espera mi aprobación?']);
    const ventas = money(metas.ventas);
    const avance = metas.goal > 0 ? `${Math.round(metas.ventas / metas.goal * 100)} % de la meta` : 'Meta comercial sin registrar';
    const nps = metas.nps || {};
    const npsTxt = nps.n ? `${nps.nps > 0 ? '+' : ''}${nps.nps}` : 'Pendiente';
    const npsNota = nps.n ? `Meta 52 · ${nps.promoters} promotor(es), ${nps.passives} pasivo(s), ${nps.detractors} detractor(es) de ${nps.n} respuesta(s)` : 'Se obtiene con la encuesta del portal · meta 52';
    return tarjeta('Cómo vamos con las metas', filas([['Ventas netas · 90 días', `${ventas} · ${avance}`], ['NPS', `${npsTxt} · ${npsNota}`], ['Aprobaciones pendientes', String(metas.aprobaciones)], ['Acciones registradas hoy', String(metas.acciones)]]) +
      `<p class="crm-agente-nota">El NPS es promotores menos detractores: 9-10 suma, 7-8 no cuenta y 0-6 resta. Los ejemplos rotulados no suman al indicador.</p>`) +
      niveles({ regla: 'Cifras del tablero y del registro; no se estiman.', ia: nps.n ? 'El NPS ya tiene respuestas del portal.' : 'Falta la primera respuesta del portal para calcular el NPS.', persona: 'Jefatura decide dónde poner el foco.', registro: 'consulta de metas' }) + chips(['¿Qué espera mi aprobación?', 'Resume mi día']);
  }
  function htmlReponer(rol) {
    const lista = crmApi()?.reponer?.() || [];
    if (!lista.length) return tarjeta('Sin cuentas por reponer', '<p>Ninguna cuenta tiene el ciclo vencido en el registro.</p>') + chips(['Resume mi día', '¿Qué cuentas toca reponer?']) + niveles({ regla: 'Reponer = ciclo de compra vencido.', ia: 'Sin cuentas vencidas.', persona: 'Ventas revisa el historial.', registro: 'consulta de reposición' });
    const items = lista.slice(0, 4).map(item => `<li><b>${esc(item.nombre)}</b> <small>${esc(item.rubro)} · ${esc(item.comuna)}</small><p>Última compra hace ${esc(item.ultima ?? 'sin dato')} días · ciclo vencido hace ${Math.abs(Number(item.dias) || 0)} días.</p><button type="button" class="crm-agente-btn crm-agente-btn--mini" data-crm-agente-accion="abrir-ficha" data-id="${esc(item.id)}">Abrir la cuenta</button></li>`).join('');
    return tarjeta(`Cuentas que toca reponer (${lista.length})`, `<ul class="crm-agente-lista crm-agente-pendientes">${items}</ul>`) +
      niveles({ regla: 'La reposición sigue el historial; cantidades y despacho se confirman con la cuenta.', ia: `Sugiero empezar por ${lista[0].nombre}.`, persona: 'Ventas prepara la reposición.', registro: 'consulta de reposición' });
  }

  // ---------- Respuestas por intención ----------
  function interpretar(t) {
    if (!t) return { tipo: 'ayuda' };
    if (/\b(ayuda|opciones|que puedes|que haces|que sabes)\b/.test(t)) return { tipo: 'ayuda' };
    // Opciones nuevas del contrato 26-nov: primero las consultas propias de cada rol.
    if (/\b(detractor|detractores|postventa|satisfaccion|nps|caritas?)\b/.test(t)) return { tipo: 'detractores' };
    if (/\b(resena|resenas|promotor|promotores)\b/.test(t)) return { tipo: 'resena' };
    if (/\b(referido|referidos|recomendados?|recomendacion)\b/.test(t)) return { tipo: 'referidos' };
    if (/\b(metas?|kpis?|como vamos|objetivos?)\b/.test(t)) return { tipo: 'metas' };
    if (/\b(reponer|reposicion|reponer|volver a pedir|toca reponer)\b/.test(t)) return { tipo: 'reponer' };
    if (/\b(aprueba|aprueb[ae]r?|apruebe|aprobar)\b/.test(t)) return { tipo: 'aprobar' };
    if (/(aprobacion|pendient|por aprobar|espera mi|mis aprob)/.test(t)) return { tipo: 'pendientes' };
    if (/(pasal|pasa|pasar|traspas|deriv|mand|envi).*(venta|ejecutiv)|a ventas/.test(t)) return { tipo: 'pasar' };
    if (/(canast|propon|recomiend|sugier)/.test(t)) return { tipo: 'canasta' };
    if (/propuest|prepar|arm\b/.test(t)) return { tipo: 'propuesta' };
    if (/(visit|agend|reunion|cita)/.test(t)) return { tipo: 'visita' };
    if (/(mi dia|del dia|mi jornada|agenda de hoy|que tengo hoy)/.test(t)) return { tipo: 'dia' };
    if (/(resum|cuenta|historial|como va)/.test(t)) return { tipo: 'resumen' };
    if (/(cumpl|mql|calific)/.test(t)) return { tipo: 'mql' };
    if (/(ejecut|llam|telefon|hablar con)/.test(t)) return { tipo: 'ejecutivo' };
    if (/(taz|volumen)/.test(t)) return { tipo: 'volumen' };
    if (/(dud|pregunt|consult)/.test(t)) return { tipo: 'dudas' };
    if (/(cotiz|cotis)/.test(t)) return { tipo: 'cotizo' };
    if (/^(hola|buenas|buenos)/.test(t) && t.split(' ').length <= 4) return { tipo: 'saludo' };
    return { tipo: null };
  }
  const AYUDA = {
    marketing: 'Puedo mostrar los detractores con su ayuda abierta, pedir reseña a los promotores, listar los referidos que llegaron y decirte qué cotizó un lead, con sus puntajes y su origen.',
    ventas: 'Puedo resumir tu día, listar las cuentas que toca reponer, preparar la propuesta de una cuenta y agendar la visita.',
    jefatura: 'Puedo listar lo que espera tu aprobación y mostrarte cómo vamos con las metas, incluido el NPS.'
  };
  function leadDe(texto) {
    const l = buscarLead(texto);
    if (l) { S.usoFoco = false; return l; }
    const nombres = norm(texto).split(' ').filter(t => t.length >= 3 && !STOP.has(t) && !GENERICAS.has(t));
    if (nombres.length) return null; // se nombró un lead que no existe: no se reutiliza el foco
    S.usoFoco = true;
    return leadFoco(S.rol);
  }
  function pedirLead(texto) {
    const top = leadsDe().slice().sort((a, b) => Number(interesDe(b).puntaje || 0) - Number(interesDe(a).puntaje || 0)).slice(0, 3);
    return tarjeta('¿De qué lead hablas?', `<p>No encuentro ese nombre en el registro. Elige uno:</p>${chips(top.map(l => `${recorta(texto, 60)} ${empresaDe(l)}`))}`) +
      niveles({ regla: 'Sin lead identificado no consulto datos.', ia: 'Te ofrezco los tres con más interés.', persona: 'Tú eliges el lead.', registro: '' });
  }
  function ejecutar(rol, intent, texto) {
    const t = norm(texto);
    const soloVentas = () => tarjeta('Eso lo hace Ventas', `<p>Pásalo a Ventas desde Marketing y Ventas lo toma desde su Hoy.</p>`);
    switch (intent.tipo) {
      case 'ayuda': return tarjeta('Qué puedo hacer', `<p>${esc(AYUDA[rol] || '')}</p>`) + chips(sugerenciaTexto(rol));
      case 'saludo': return tarjeta('Hola', `<p>${esc(AYUDA[rol] || '')} Todo queda en el registro y nada sale sin aprobación de una persona.</p>`);
      case 'detractores':
        return rol === 'marketing' ? htmlDetractores() : tarjeta('Eso lo ve Marketing', '<p>La postventa, las caritas y el NPS son trabajo de Marketing.</p>') + chips(['Resume mi día']);
      case 'resena':
        return rol === 'marketing' ? htmlPromotores() : tarjeta('Eso lo hace Marketing', '<p>Pedir reseñas o referidos es del programa de Marketing.</p>') + chips(['Resume mi día']);
      case 'referidos':
        return rol === 'marketing' ? htmlReferidos() : tarjeta('Eso lo ve Marketing', '<p>Los referidos y las reseñas se mueven desde Marketing.</p>') + chips(['Resume mi día']);
      case 'metas':
        return rol === 'jefatura' ? htmlMetas('jefatura') : tarjeta('Las metas las sigue Jefatura', '<p>El tablero de metas y el NPS están en la vista de Jefatura.</p>') + chips(rol === 'ventas' ? ['Resume mi día'] : ['¿Qué detractores tengo?']);
      case 'reponer':
        return rol === 'ventas' ? htmlReponer('ventas') : tarjeta('Eso lo hace Ventas', '<p>La reposición de cuentas es trabajo de Ventas.</p>') + chips(rol === 'marketing' ? ['¿Qué detractores tengo?'] : ['¿Qué espera mi aprobación?']);
      case 'aprobar': {
        if (rol === 'marketing') {
          const pend = Object.values(S.borradores).filter(b => b.estado === 'pendiente').pop();
          if (!pend) return tarjeta('Nada espera tu aprobación', '<p>No hay un mensaje pendiente de Marketing.</p>');
          accionEnviarBorrador(pend.id, null);
          return { hecho: true };
        }
        if (rol !== 'jefatura') return tarjeta('Eso lo aprueba Jefatura', '<p>Las aprobaciones las confirma Jefatura desde su Hoy.</p>');
        const it = buscarAprobacion(texto);
        return it ? htmlAprobacion(it) : htmlSinAprobacion(texto);
      }
      case 'pendientes': return rol === 'jefatura' ? htmlPendientes() : tarjeta('Por aprobar', '<p>Las aprobaciones las revisa Jefatura. Si tienes una propuesta pendiente, la ves en su estado del CRM.</p>');
      case 'pasar': {
        if (rol !== 'marketing') return soloVentas();
        const l = leadDe(texto);
        return l ? pasarAVentas(l) : pedirLead(texto);
      }
      case 'canasta': case 'propuesta': case 'visita': {
        if (rol !== 'ventas') return soloVentas();
        const l = leadDe(texto) || (traspasoActivo() ? leadPorId(traspasoActivo().leadId) : null);
        if (!l) return pedirLead(texto);
        S.foco.ventas = l.id;
        if (intent.tipo === 'canasta') return htmlCanasta(l);
        if (intent.tipo === 'propuesta') return htmlPropuesta(l, texto);
        return htmlVisita(l);
      }
      case 'dia': {
        // Resumen del día con las mismas cifras que ve el rol en su Hoy; nada inventado.
        const leads = leadsDe();
        const cuentas = cuentasDe();
        const stats = c => (c && c.st) || (m4() && m4().accountStats ? m4().accountStats(c) : {});
        const porReponer = cuentas.filter(c => Number.isFinite(Number(stats(c).dueIn)) && Number(stats(c).dueIn) <= 0).length;
        const enRiesgo = cuentas.filter(c => { const s = stats(c); return s.lastAgo != null && s.freqDays != null && Number(s.lastAgo) > Number(s.freqDays); }).length;
        const listos = leads.filter(l => criteriosMql(l).cumple && !enVentas(l)).length;
        const devueltos = leads.filter(l => pasoDe(l).estado === 'devuelto').length;
        const aprob = aprobacionesPendientes().length;
        if (rol === 'jefatura') {
          return tarjeta('Tu día en el CRM', `<p>Hoy tienes <b>${aprob}</b> solicitud(es) esperando tu decisión.</p>${filas([['Aprobaciones pendientes', String(aprob)], ['Cuentas en riesgo', String(enRiesgo)], ['Reposiciones por revisar', String(porReponer)]])}`) +
            chips(['¿Qué espera mi aprobación?']) + niveles({ regla: 'Solo excepciones llegan a Jefatura.', ia: 'Ordené la cola por lo que espera tu decisión.', persona: 'Tú apruebas, pides información o rechazas.', registro: 'consulta del día' });
        }
        if (rol === 'marketing') {
          return tarjeta('Tu día en el CRM', `<p>Hoy hay <b>${listos}</b> lead(s) listos para pasar a Ventas y <b>${devueltos}</b> devuelto(s) por revisar.</p>${filas([['Listos para Ventas', String(listos)], ['Devueltos por Ventas', String(devueltos)], ['Contactos en el registro', String(leads.length)]])}`) +
            chips(sugerenciaTexto('marketing')) + niveles({ regla: 'MQL = contacto, negocio B2B, permiso e interés de 40 o más.', ia: 'Conté lo que ya cumple los cuatro criterios.', persona: 'Tú revisas y apruebas el traspaso.', registro: 'consulta del día' });
        }
        return tarjeta('Tu día en el CRM', `<p>Hoy tienes <b>${porReponer}</b> cuenta(s) por reponer, <b>${enRiesgo}</b> en riesgo y <b>${listos}</b> lead(s) listos para aceptar.</p>${filas([['Cuentas por reponer', String(porReponer)], ['Cuentas en riesgo', String(enRiesgo)], ['Leads listos para aceptar', String(listos)]])}`) +
          chips(['Propón la canasta', 'Agenda la visita']) + niveles({ regla: 'Reposición y riesgo salen del historial de compra y los tickets abiertos.', ia: 'Ordené el día por lo que vence primero.', persona: 'Tú eliges a quién atender y qué enviar.', registro: 'consulta del día' });
      }
      case 'resumen': {
        const l = leadDe(texto) || (rol === 'ventas' && traspasoActivo() ? leadPorId(traspasoActivo().leadId) : null);
        if (!l) return pedirLead(texto);
        S.foco[rol] = l.id;
        return htmlResumen(l);
      }
      case 'mql': case 'ejecutivo': case 'volumen': case 'dudas': case 'cotizo': {
        const l = leadDe(texto);
        if (!l) return pedirLead(texto);
        S.foco[rol] = l.id;
        if (intent.tipo === 'cotizo') return htmlCotizacion(rol, l);
        if (intent.tipo === 'mql') {
          const c = criteriosMql(l);
          return tarjeta(`${empresaDe(l)}: ${c.cumple ? 'sí cumple para MQL' : 'todavía no cumple para MQL'}`, lista(c.lista.map(x => `${x.ok ? '✓' : '✗'} ${esc(x.txt)}`))) +
            niveles({ regla: `Criterios de MQL: ${c.lista.filter(x => x.ok).length} de 4.`, ia: c.cumple ? 'Puede pasar a Ventas.' : 'Revisa el criterio que falta antes de pasarlo.', persona: 'Marketing decide.', registro: 'revisión de MQL' });
        }
        if (intent.tipo === 'ejecutivo') {
          const msgs = mensajesDe(l);
          const ev = [];
          if (norm(l.channel) === 'llamada') ev.push('Canal preferido: llamada');
          actividadDe(l).forEach(a => { if (/\b(persona|ejecutiv\w*|llam\w*|hablar)\b/i.test(a.texto)) ev.push(`En el sitio: ${a.texto}`); });
          msgs.forEach(m => { if (esComprador(m) && /(llam|ejecut|telefon|hablar)/.test(norm(m.texto))) ev.push(`«${recorta(m.texto, 90)}»`); });
          const si = ev.length > 0;
          return tarjeta(si ? 'Sí, pidió hablar con una persona' : 'No pidió ejecutivo', si ? lista(ev.map(esc)) : `<p>Su canal es ${esc(l.channel || 'chat')} y no hay pedido de llamada.</p>`) +
            niveles({ regla: si ? 'Registro: canal o mensaje de llamada.' : 'Sin pedido de llamada en el registro.', ia: si ? `Sugiero asignar a ${ejecutivoDe(l).name} (zona ${ejecutivoDe(l).zone || 'por comuna'}).` : 'Sin acción sugerida.', persona: 'Marketing decide si lo pasa a Ventas.', registro: 'consulta de ejecutivo' });
        }
        if (intent.tipo === 'volumen') {
          const vol = l.volumen || est().answers?.volumen;
          const cups = (d4().CUPS || {})[vol];
          return tarjeta('Volumen declarado', `<p>${vol ? `${esc(vol)} tazas al día.` : 'Sin volumen declarado.'}${cups ? ` Referencia del cotizador: ${cups} tazas al día.` : ''}</p>`) +
            niveles({ regla: 'Dato declarado en el registro.', ia: 'Úsalo para calibrar la máquina antes de proponer.', persona: 'Marketing o Ventas confirman el volumen.', registro: 'consulta de volumen' });
        }
        const msgs = mensajesDe(l), dudas = dudasDe(msgs);
        return tarjeta('Dudas del cliente', dudas.length ? lista(dudas.slice(-5).map(d => esc(recorta(d, 160)))) : '<p>No registra dudas en la conversación.</p>') +
          niveles({ regla: `Dudas registradas: ${dudas.length}.`, ia: dudas.length ? 'Respóndelas en la primera llamada, con datos aprobados del catálogo.' : 'Sin dudas que responder.', persona: 'Ventas responde y confirma precios.', registro: 'consulta de dudas' });
      }
      default: return null;
    }
  }
  const traspasoActivo = () => leerAgente().traspasos.find(t => t.estado === 'pendiente') || null;
  // Intención que el motor reconoció en un texto libre: la barra la ejecuta con sus propias funciones (dueña de las acciones).
  const MAPA_MOTOR = { pasar: 'pasar', propuesta: 'propuesta', visita: 'visita', aprobar_envio: 'aprobar', aprobaciones: 'pendientes' };
  function ejecutarDelegada(rol, a) {
    const tipo = MAPA_MOTOR[a.intencion];
    const sinAccion = () => tarjeta('Pídelo de otra forma', '<p>Usa una de las sugerencias de tu Hoy.</p>') + chips(sugerenciaTexto(rol));
    if (!tipo) return sinAccion();
    if (a.cuentaId && leadPorId(a.cuentaId)) S.foco[rol] = String(a.cuentaId);
    const r = ejecutar(rol, { tipo }, '');
    return r === null ? sinAccion() : r;
  }
  function respuestaMotor(rol, texto) {
    const api = window.MarleyAgente;
    if (!api || !api.motor || typeof api.motor.responder !== 'function') {
      return tarjeta('Pídelo de otra forma', `<p>Puedo responder con datos del registro. Prueba una sugerencia.</p>`) + chips(sugerenciaTexto(rol));
    }
    let out = null;
    try { out = api.motor.responder({ lado: 'crm', rol, cuentaId: S.foco[rol] || null, ruta: (location.hash || '#R00').slice(1) }, { texto }); } catch (_) { out = null; }
    // Si el motor reconoció una acción del CRM, la ejecuta esta barra; el motor solo interpreta el texto.
    const delegada = ((out && out.acciones) || []).find(a => a && a.tipo === 'crm-intencion');
    if (delegada) return ejecutarDelegada(rol, delegada);
    const msgs = (out && out.mensajes) || [];
    if (!msgs.length) return tarjeta('No entendí', `<p>Prueba con una sugerencia de la lista.</p>`) + chips(sugerenciaTexto(rol));
    if (out.registro) mutarAgente(st => anotar(st, rol, 'motor:consulta', out.registro.datoUsado, out.registro.sugerencia, out.registro.nivel || 'ia', 'Agente'));
    const sugeridas = msgs.flatMap(m => (m.chips || []).map(c => c.texto || c.label)).filter(Boolean).slice(0, 4);
    return tarjeta('Respuesta del agente', msgs.map(m => `<p>${esc(m.texto || '')}</p>`).join('')) +
      (sugeridas.length ? chips(sugeridas) : '') +
      niveles({ regla: 'Respuesta del motor con datos del prototipo.', ia: 'Texto libre: el motor sugiere; las acciones del CRM las haces con las sugerencias.', persona: 'Tú decides si haces algo.', registro: 'consulta libre' });
  }

  // ---------- Hilo y render de la barra ----------
  // Una respuesta puede ser texto (HTML) o { html, borradorId, tl }. El borrador de mensaje va como tarjeta
  // propia para que su estado (pendiente, enviado, descartado) se vea siempre al día.
  function emitirRespuesta(rol, res, tl) {
    if (!rol || res === null || res === undefined) return;
    const r = typeof res === 'string' ? { html: res } : res;
    if (r.borradorId) S.hilo[rol].unshift({ tipo: 'agente', borradorId: r.borradorId });
    S.hilo[rol].unshift({ tipo: 'agente', html: r.html || '', tl: r.tl !== undefined ? r.tl : (tl || null) });
    if (S.hilo[rol].length > 8) S.hilo[rol].length = 8;
    renderHilo();
    // La tarjeta del Hoy no tiene hilo propio: lo que responde el agente se ve en el panel de conversación.
    if (!hiloEl) {
      const objetivo = r.tl !== undefined ? r.tl : (tl || null);
      const lead = objetivo ? leadPorId(objetivo) : null;
      if (r.borradorId) PN.hilo.push({ tipo: 'agente', borradorId: r.borradorId });
      PN.hilo.push({ tipo: 'agente', html: (r.html || '') + (lead ? timelineHtml(lead, true) : '') });
      PN.hilo = PN.hilo.slice(-30);
      if (panelEl) { abrirPanel(); renderPanel(); }
    }
    renderAvisos();
    renderRegistro();
  }
  function pushAgente(rol, html, extra) { emitirRespuesta(rol, { html }, extra && extra.tl); }
  function notaRol(texto) { pushAgente(S.rol, tarjeta('Aviso', `<p>${esc(texto)}</p>`)); }
  function responder(rol, texto) {
    S.pend[rol] = Math.max(0, (S.pend[rol] || 1) - 1);
    let res = null, tl = null;
    try {
      const intent = interpretar(norm(texto));
      S.usoFoco = false;
      res = ejecutar(rol, intent, texto);
      if (res === null) res = respuestaMotor(rol, texto);
      if (S.usoFoco && S.foco[rol]) {
        const lf = leadPorId(S.foco[rol]);
        const nota = lf ? `<p class="crm-agente-nota">Hablo de ${esc(empresaDe(lf))}, el último lead que revisamos. Si quieres otro, escribe su nombre.</p>` : '';
        if (typeof res === 'string') res = nota + res;
        else if (res && res.html) res = Object.assign({}, res, { html: nota + res.html });
      }
      if (['cotizo', 'resumen', 'pasar'].includes(intent.tipo)) tl = S.foco[rol] || null;
    } catch (err) {
      res = tarjeta('No pude completar esto', `<p>${esc(err && err.message ? err.message : 'Error inesperado')}. Nada se cambió en el registro.</p>`, 'crm-agente-alerta');
    }
    if (res && res.hecho) { refrescarHilo(); return; }
    emitirRespuesta(rol, res, tl);
    if (S.enfocar && inputEl) { S.enfocar = false; try { inputEl.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
  }
  function procesar(texto) {
    const rol = S.rol;
    if (!rol) return;
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!limpio) return;
    S.hilo[rol].unshift({ tipo: 'usuario', texto: limpio });
    if (S.hilo[rol].length > 8) S.hilo[rol].length = 8;
    S.pend[rol] = (S.pend[rol] || 0) + 1;
    renderHilo();
    const demora = 400 + Math.round(Math.random() * 500);
    setTimeout(() => responder(rol, limpio), demora);
  }
  function accionar(accion, idv, btn) {
    if (accion === 'pasar-a-ventas') { const l = leadPorId(idv); if (l) { S.foco.marketing = l.id; return emitirRespuesta(S.rol, pasarAVentas(l), l.id); } return; }
    if (accion === 'aprobar-envio') return accionEnviarBorrador(idv, btn.closest('[data-crm-agente-borrador]'));
    if (accion === 'descartar-envio') return accionDescartarBorrador(idv);
    if (accion === 'agendar-visita') return accionAgendar(idv, btn.dataset.fecha, btn.dataset.etiqueta);
    if (accion === 'revisar-aprobacion') { const it = itemPorId(idv); return pushAgente(S.rol, it ? htmlAprobacion(it) : htmlSinAprobacion('')); }
    if (accion === 'confirmar-checklist') return accionConfirmarChecklist(idv);
    if (accion === 'confirmar-aprobacion') return accionConfirmarAprobacion(idv);
    if (accion === 'cancelar') return notaRol('Sin cambios: no aprobé nada.');
    if (accion === 'ver-aviso') return verAviso(idv);
    if (accion === 'ver-lead') { const l = leadPorId(idv); if (l) { S.foco[S.rol] = l.id; return pushAgente(S.rol, htmlCotizacion(S.rol, l), { tl: l.id }); } return; }
    if (accion === 'abrir-tarea') return abrirTarea(btn.dataset.tipo, idv);
    if (accion === 'abrir-ficha') { escribirCrm(crm => { crm.selectedAccount = idv; crm.selectedLead = null; crm.returnRoute = (location.hash || '#R01').slice(1).split('?')[0]; }); location.hash = 'R04'; return; }
    if (accion === 'abrir-ruta') { location.hash = idv; return; }
  }
  function refrescarHilo() { renderHilo(); renderAvisos(); renderRegistro(); }
  function verAviso(nid) {
    const rol = S.rol;
    let aviso = null;
    mutarAgente(st => { aviso = (st.notificaciones[rol] || []).find(n => n.id === nid) || null; if (aviso) aviso.leida = true; });
    if (!aviso) return refrescarHilo();
    if (aviso.aprobacionId && rol === 'jefatura') { const it = itemPorId(aviso.aprobacionId); return pushAgente(rol, it ? htmlAprobacion(it) : htmlPendientes()); }
    if (aviso.leadId) {
      const l = leadPorId(aviso.leadId);
      if (l) {
        S.foco[rol] = l.id;
        if (rol === 'ventas') return pushAgente(rol, htmlResumen(l), { tl: l.id });
        return pushAgente(rol, htmlCotizacion(rol, l), { tl: l.id });
      }
    }
    refrescarHilo();
  }

  function renderSugerencias() {
    if (!sugEl) return;
    const rol = S.rol;
    sugEl.innerHTML = rol ? sugerenciaTexto(rol).map(t => `<button type="button" class="crm-agente-chip" data-crm-agente-sugerencia="${esc(t)}">${esc(t)}</button>`).join('') : '';
  }
  function renderAvisos() {
    if (!avisosEl) return;
    const rol = S.rol;
    if (!rol) { avisosEl.innerHTML = ''; return; }
    const todas = (leerAgente().notificaciones[rol] || []).filter(n => !n.leida);
    avisosEl.innerHTML = todas.length
      ? `<h3 class="crm-agente-avisos-t">Avisos del agente <b>${todas.length}</b></h3>` + todas.slice(0, 3).map(n => `<article class="crm-agente-aviso" data-crm-notificacion="${esc(n.id)}" data-tipo="${esc(n.tipo || 'aviso')}"><p>${esc(n.texto)}</p><small>${esc(hace(n.ts))}</small><button type="button" class="crm-agente-btn crm-agente-btn--mini" data-crm-agente-accion="ver-aviso" data-id="${esc(n.id)}">Ver</button></article>`).join('')
      : '';
  }
  function renderRegistro() {
    if (!regEl) return;
    const reg = leerAgente().registro.slice(-8).reverse();
    regEl.innerHTML = reg.length
      ? `<ol class="crm-agente-reg">${reg.map(r => `<li><b>${esc(ROL_TXT[r.rol] || r.rol)}</b> · ${esc(r.accion)} · <span data-nivel="${esc(r.nivel)}">${esc(NIVEL_TXT[r.nivel] || r.nivel)}</span> · dato: ${esc(recorta(r.datoUsado, 80))} · decidió: ${esc(r.decidio)} <small>${esc(hora(r.ts))}</small></li>`).join('')}</ol>`
      : '<p>Aún no hay acciones registradas.</p>';
  }
  function renderHilo() {
    if (!hiloEl) return;
    const rol = S.rol;
    if (!rol) { hiloEl.innerHTML = ''; return; }
    const items = S.hilo[rol] || [];
    const pendientes = S.pend[rol] || 0;
    let tlUsada = false;
    const partes = [];
    if (pendientes > 0) partes.push('<p class="crm-agente-escribe" role="status">El agente revisa el registro…</p>');
    items.forEach(it => {
      if (it.tipo === 'usuario') { partes.push(`<p class="crm-agente-tu"><b>Tú</b><span>${esc(it.texto)}</span></p>`); return; }
      let html = it.html || '';
      if (it.tl && !tlUsada) {
        const l = leadPorId(it.tl);
        if (l) { tlUsada = true; html += timelineHtml(l, true); }
      }
      if (it.borradorId) html = borradorHtml(S.borradores[it.borradorId]);
      partes.push(`<article class="crm-agente-resp" data-rol="${esc(rol)}">${html}</article>`);
    });
    hiloEl.innerHTML = partes.join('') || '<p class="crm-agente-vacio">Pídele algo al agente o toca una sugerencia.</p>';
  }
  function setEstado(texto) { S.estadoTxt = texto; if (estadoEl) estadoEl.textContent = texto; }

  // Tarjeta del asistente en el «Hoy»: ícono, nombre, las opciones del rol a la vista y el campo para escribir.
  // Al tocar una opción o enviar, la conversación se abre en el panel (#crm-agente-chat), con burbujas y «escribiendo…».
  const ICONO_AGENTE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></svg>';
  function construirBarra() {
    if (barEl) return;
    barEl = document.createElement('section');
    barEl.id = 'crm-agente-barra';
    barEl.className = 'crm-agente crm-agente-tarjeta-asistente';
    barEl.setAttribute('aria-labelledby', 'crm-agente-titulo');
    barEl.innerHTML = `
      <header class="crm-agente-head">
        <span class="crm-agente-icono" aria-hidden="true">${ICONO_AGENTE}</span>
        <div class="crm-agente-head-txt">
          <h2 id="crm-agente-titulo" class="crm-agente-titulo">Asistente de IA del CRM</h2>
          <p class="crm-agente-sub" data-crm-agente-estado>Responde con datos del registro. Nada sale sin aprobación de una persona.</p>
        </div>
      </header>
      <div class="crm-agente-sugerencias" data-crm-agente-sugerencias role="group" aria-label="Qué le puedes pedir"></div>
      <form class="crm-agente-form" data-crm-agente-form role="search">
        <label class="crm-agente-label" for="crm-agente-entrada">Escríbele o toca una opción</label>
        <div class="crm-agente-campo">
          <input id="crm-agente-entrada" name="pregunta" type="text" autocomplete="off" maxlength="240" placeholder="Ej.: mándale un correo a Hotel Sol">
          <button type="submit" class="crm-agente-enviar">Pedir</button>
        </div>
      </form>
      <div class="crm-agente-avisos" data-crm-agente-avisos></div>`;
    hiloEl = null;
    avisosEl = barEl.querySelector('[data-crm-agente-avisos]');
    sugEl = barEl.querySelector('[data-crm-agente-sugerencias]');
    inputEl = barEl.querySelector('#crm-agente-entrada');
    estadoEl = barEl.querySelector('[data-crm-agente-estado]');
    regEl = null;
    if (S.estadoTxt) estadoEl.textContent = S.estadoTxt;
    barEl.querySelector('[data-crm-agente-form]').addEventListener('submit', ev => {
      ev.preventDefault();
      const texto = inputEl.value;
      inputEl.value = '';
      S.enfocar = true;
      abrirConversacion(texto);
    });
    barEl.addEventListener('click', onClick);
  }
  // La tarjeta no guarda la conversación: la abre en el panel y le pasa lo que la persona pidió.
  function abrirConversacion(texto) {
    if (!panelEl || !panelEl.isConnected) sincronizarPanel();
    procesarPanel(texto);
    if (pnInputEl) { try { pnInputEl.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
  }
  function onClick(ev) {
    const sug = ev.target.closest('[data-crm-agente-sugerencia]');
    if (sug && barEl.contains(sug)) { ev.preventDefault(); abrirConversacion(sug.dataset.crmAgenteSugerencia); return; }
    const btn = ev.target.closest('[data-crm-agente-accion]');
    if (!btn || !barEl.contains(btn)) return;
    ev.preventDefault();
    try { accionar(btn.dataset.crmAgenteAccion, btn.dataset.id || '', btn); }
    catch (err) { notaRol(`No pude completar esa acción: ${err && err.message ? err.message : 'error inesperado'}. Nada se cambió.`); }
  }
  let barFold = null;
  function quitarBarra() {
    if (barFold?.contains(barEl)) barFold.remove();
    else barEl?.remove();
  }
  // La tarjeta va a la vista en el Hoy de los tres roles: nada de plegarla.
  function accionesParaHoy() {
    return barEl;
  }

  // Monta la barra en el «Hoy» del rol (R01, R11, R05). crm-v2.js reemplaza el contenido en cada render; aquí se vuelve a poner.
  // Ficha del cliente (R04): la línea de tiempo multicanal del lead seleccionado.
  let fichaEl = null;
  function quitarFicha() { if (fichaEl && fichaEl.parentNode) fichaEl.parentNode.removeChild(fichaEl); }
  function sincronizarFicha(host) {
    const cont = host.querySelector('.crm2-content');
    const l = crm().selectedLead ? leadPorId(crm().selectedLead) : null;
    if (!cont || !l) { quitarFicha(); return; }
    if (!fichaEl) fichaEl = document.createElement('div');
    fichaEl.className = 'crm-agente crm-agente-ficha';
    fichaEl.innerHTML = `<p class="crm-agente-eyebrow">CONVERSACIÓN Y CANALES · AGENTE</p>${timelineHtml(l, true)}`;
    if (fichaEl.parentNode !== cont) cont.appendChild(fichaEl);
  }
  function sincronizar() {
    sincronizarPanel();
    const host = document.getElementById(ROOT_ID);
    const ruta = (location.hash || '#R00').slice(1).split('?')[0];
    if (host && !host.hidden && ruta === 'R04') { quitarBarra(); sincronizarFicha(host); return; }
    quitarFicha();
    const rolHoy = HOY[ruta];
    const contenido = host && !host.hidden ? host.querySelector('.crm2-content') : null;
    if (!rolHoy || !contenido || rolM4() !== rolHoy) { quitarBarra(); return; }
    construirBarra();
    if (S.rol !== rolHoy) { S.rol = rolHoy; renderSugerencias(); }
    const acciones = accionesParaHoy(ruta);
    if (acciones.parentNode !== contenido || contenido.firstElementChild !== acciones) {
      contenido.insertBefore(acciones, contenido.firstChild);
    }
    renderSugerencias();
    renderHilo();
    renderAvisos();
    renderRegistro();
  }
  function engancharHost() {
    const host = document.getElementById(ROOT_ID);
    if (!host || host.__agenteEnganchado) return;
    host.__agenteEnganchado = true;
    hostObs = new MutationObserver(() => sincronizar());
    hostObs.observe(host, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    sincronizar();
  }
  const TXT_LISTO = 'Responde con datos del registro. Nada sale sin aprobación de una persona.';
  const TXT_SIN_MOTOR = 'El texto libre no responde ahora; las acciones del CRM siguen funcionando.';
  // La barra no se dibuja hasta que el motor del agente está listo (MarleyAgente.listo, carga bajo demanda).
  // Si el motor no carga, la barra igual se dibuja y sus acciones funcionan; solo falta el texto libre.
  function arrancar() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', arrancar, { once: true }); return; }
    const api = window.MarleyAgente;
    setEstado('Preparando el agente…');
    Promise.resolve(api && api.listo)
      .then(() => setEstado(TXT_LISTO), () => setEstado(TXT_SIN_MOTOR))
      .then(() => {
        const bodyObs = new MutationObserver(engancharHost);
        bodyObs.observe(document.body, { childList: true });
        window.addEventListener('hashchange', sincronizar);
        engancharHost();
      });
  }

  // ---------- Panel del agente en todas las pestañas del CRM (botón y panel que no tapan los CTA) ----------
  // Tareas (correo, contactar, visita, avisar) con borrador editable, ajustes, envío en segundo plano,
  // conversaciones en espera y su toma. Solo este módulo y la barra escriben acciones del CRM; el motor interpreta.
  const PN = { hilo: [], borradores: {}, avisos: [], abierto: false, escribiendo: 0, rol: null, focoPrevio: null, ruta: null };
  let panelEl = null, pnCuerpoEl = null, pnLanzEl = null, pnContEl = null, pnHiloEl = null, pnEsperaEl = null, pnAvisoEl = null, pnSugEl = null, pnFormEl = null, pnInputEl = null, pnRegEl = null;
  const ETIQ_TAREA = { correo: 'Correo', contactar: 'Contacto', visita: 'Visita', recordatorio: 'Recordatorio de reposición', avisar: 'Aviso al equipo', resena: 'Invitación a dejar una reseña', referido: 'Invitación a recomendar', detractor: 'Respuesta al detractor', traspaso: 'Traspaso a Ventas', 'plan-marketing': 'Plan para Marketing' };
  const TAREAS_ROL = {
    ventas: ['contactar','correo','visita','recordatorio','avisar'],
    marketing: ['correo','traspaso','detractor','resena','referido','avisar'],
    jefatura: ['plan-marketing','avisar']
  };
  const CIERRES = { contactar:'C-V1', recordatorio:'C-V3', visita:'C-V4', traspaso:'C-M1', detractor:'C-M2', resena:'C-M3', referido:'C-M3', 'plan-marketing':'C-J1' };
  const MOTIVO_ESP = { falla: 'Falla o reclamo de la máquina', precio: 'Precio especial o crédito', persona: 'Pide hablar con una persona' };
  const pnRolActual = () => { const r = rolM4(); return ROLES.includes(r) ? r : null; };
  const pnUsuario = rol => (rol === 'ventas' ? (d4().ROLE_MENUS?.ventas?.user || 'Paula Díaz') : userDe(rol));
  const pnAtiende = rol => (rol === 'ventas' ? (d4().ROLE_MENUS?.ventas?.user || 'Ventas') : 'una persona de Soporte');
  const zonaDe = ex => (ex && d4().ZONES && d4().ZONES[ex.zone] ? d4().ZONES[ex.zone].name : (ex?.role || 'Zona por confirmar'));
  const primerNombreCRM = n => String(n || '').trim().split(/\s+/)[0] || '';
  const sinComuna = x => !x || !x.comuna || x.comuna === 'Sin comuna';
  // Dueño por zona: el mismo texto en el traspaso y en la firma del borrador (la zona es la misma).
  const duenoTexto = (x, ex) => `${ex.name} · ${zonaDe(ex)}${sinComuna(x) ? ' (sin comuna: asignado por zona por defecto)' : ' (comuna ' + x.comuna + ')'}`;
  function refDe(id) {
    const k = String(id ?? '');
    if (!k) return null;
    const l = leadPorId(k) || leadsDe().find(x => claves(x).includes(k)) || null;
    if (l) return { lead: l, cuenta: null, key: String(l.id) };
    const a = cuentasDe().find(x => String(x.id) === k) || null;
    return a ? { lead: null, cuenta: a, key: String(a.id) } : null;
  }
  function infoDe(ref) {
    if (!ref) return null;
    if (ref.lead) {
      const l = ref.lead;
      return { key: ref.key, x: l, contacto: contactoDe(l), saludo: primerNombreCRM(contactoDe(l)), empresa: empresaDe(l), email: l.email || '', telefono: l.phone || '', ejecutiva: ejecutivoDe(l), maquina: cotizacionDe(l)?.maquina || 'una máquina para tu negocio' };
    }
    const a = ref.cuenta;
    return { key: ref.key, x: a, contacto: a.name || 'la cuenta', saludo: '', empresa: a.name || 'la cuenta', email: '', telefono: '', ejecutiva: ejecutivoDe(a), maquina: 'una máquina para tu negocio' };
  }
  // Permiso de canal: con clientes, solo por los canales con permiso registrado (la misma regla que el motor).
  function permisoPara(info, canal) {
    const porCanal = window.MarleyAgente?.canales?.permiso?.(info.key, canal);
    if (typeof porCanal === 'boolean') return porCanal;
    const c = (leerAgente().consentimientos || {})[info.key] || {};
    return c[canal] === true && c.baja !== true;
  }
  function textoInicial(b) {
    const i = b.info, ex = i.ejecutiva || {};
    const saludo = i.saludo ? `Hola ${i.saludo}, ` : 'Hola, ';
    const firma = `— ${ex.name || 'Equipo de Marley'}, ${zonaDe(ex)}`;
    if (b.tipo === 'correo') return `${saludo}te escribo de Marley Coffee Empresas. Revisamos tu propuesta de ${b.maquina} para ${i.empresa}. ${primerNombreCRM(ex.name) || 'Una persona de tu zona'} puede resolver tus dudas y ajustar lo que necesites, sin compromiso. Si no quieres recibir más mensajes, responde BAJA.\n${firma}`;
    if (b.tipo === 'contactar') return `${saludo}soy ${primerNombreCRM(ex.name) || 'del equipo'} de Marley Coffee. ¿Te acomoda que revisemos tu propuesta de ${b.maquina} para ${i.empresa}? Respondo por este mismo chat.\n${firma}`;
    if (b.tipo === 'visita') return `Visita a ${i.empresa}${b.horario ? ' · ' + b.horario : ''}. A cargo de ${ex.name || 'la ejecutiva de la zona'}.`;
    if (b.tipo === 'recordatorio') return `${saludo}¿quieres repetir tu pedido de café? En tu portal puedes revisar los productos y ajustar las cantidades antes de confirmar.`;
    if (b.tipo === 'plan-marketing') return 'Marketing, revisemos el NPS frente a la meta 52 y los comentarios de postventa. Propongan una acción de mejora y el indicador que usarán para seguirla.';
    if (b.tipo === 'traspaso') return `Resumen para Ventas · ${i.empresa}: ${resumenDe(i.x)} Próximo paso sugerido: contactar y preparar la propuesta.`;
    if (b.tipo === 'resena') return `${saludo}¿quieres contar cómo te fue con el café de ${i.empresa}? En tu portal puedes ver cómo dejar una reseña en Google.\n${firma}`;
    if (b.tipo === 'referido') return `${saludo}¿conoces otro negocio al que le sirva el servicio de café de Marley? Te comparto el enlace para recomendarlo: el negocio decide si quiere cotizar, sin compromiso.\n${firma}`;
    if (b.tipo === 'detractor') {
      const caso = (window.MarleyCRM2?.postventa?.detractores?.() || []).find(item => String(item.cuentaId) === String(i.key));
      const motivo = caso?.ayuda?.motivo || caso?.abierta || 'lo que pasó con tu pedido';
      return `${saludo}soy ${primerNombreCRM(ex.name) || 'del equipo'} de Marley Coffee. Vi tu respuesta${caso && caso.nps != null ? ` (NPS ${caso.nps}/10)` : ''} y quiero ayudarte: ${recorta(motivo, 120)}. Cuéntame qué necesitas para que revisemos el caso.\n${firma}`;
    }
    return `${b.destinoNombre}: ${b.usuario} te pide que ${b.recado}. Cuenta: ${i.empresa}${i.contacto && i.contacto !== i.empresa ? ' (' + i.contacto + ')' : ''}.`;
  }
  const dividirFirma = t => { const ls = String(t || '').split('\n'); const i = ls.findIndex(l => /^— /.test(l)); return i >= 0 ? { cuerpo: ls.slice(0, i).join(' ').trim(), firma: ls.slice(i).join('\n') } : { cuerpo: String(t || '').trim(), firma: '' }; };
  const unirFirma = (cuerpo, firma) => (firma ? `${cuerpo}\n${firma}` : cuerpo);
  const sentencias = t => String(t).split(/(?<=[.!?])\s+/).filter(Boolean);
  // Ajustes sobre el texto que la persona ve y puede editar: «más corto», «más formal», «más cercano», «agrega …».
  function ajustarTexto(texto, ajuste, valor) {
    const { cuerpo, firma } = dividirFirma(texto);
    let nuevo = cuerpo;
    if (ajuste === 'corto') {
      const s = sentencias(cuerpo);
      if (s.length >= 3) nuevo = [s[0], s[1], s[s.length - 1]].join(' ');
      else if (s.length === 2) nuevo = s[0];
      nuevo = nuevo.replace(/,?\s*sin compromiso/i, '').replace(/\s*Respondo por este mismo chat\.?/, '').replace(/\s{2,}/g, ' ').trim();
      // Un aviso corto repite el nombre al empezar («Paula Díaz (Ventas): Paula Díaz te pide…»): se quita la repetición.
      if (nuevo === cuerpo) nuevo = cuerpo.replace(/^([^:\n]{2,60}):\s*\1\b\s*/i, '$1: ');
      if (nuevo === cuerpo) nuevo = cuerpo.replace(/\b(por favor|en cuanto puedas|cuando puedas)\b[,]?\s*/gi, '').trim();
    }
    if (ajuste === 'formal') {
      nuevo = nuevo.replace(/^Hola\s+([^,]+),/, 'Estimado/a $1,').replace(/^Hola,/, 'Estimado/a,')
        .replace(/\bte escribo\b/g, 'le escribo').replace(/\btu propuesta\b/g, 'su propuesta').replace(/\btus dudas\b/g, 'sus dudas')
        .replace(/\bajustar lo que necesites\b/g, 'ajustar lo que requiera').replace(/\bpuedes\b/g, 'puede')
        .replace(/\bno quieres\b/g, 'no desea').replace(/\bresponde BAJA\b/g, 'responda BAJA').replace(/\bte acomoda\b/g, 'le acomoda')
        .replace(/\bRespondo\b/g, 'Quedo atento').replace(/\bsoy\b/g, 'soy');
      if (nuevo === cuerpo) nuevo = cuerpo.replace(/\.?$/, '. Quedamos atentos.');
    }
    if (ajuste === 'cercano') {
      nuevo = nuevo.replace(/^Estimado\/a\s+([^,]+),/, '¡Hola $1!').replace(/^Estimado\/a,/, '¡Hola!')
        .replace(/^Hola\s+([^,]+),/, '¡Hola $1!').replace(/\ble escribo\b/g, 'te escribo').replace(/\bsu propuesta\b/g, 'tu propuesta')
        .replace(/\bsus dudas\b/g, 'tus dudas').replace(/\bpuede resolver\b/g, 'puede ayudarte a resolver').replace(/\bno desea\b/g, 'no quieres')
        .replace(/\bresponda BAJA\b/g, 'responde BAJA');
      if (nuevo === cuerpo) nuevo = '¡Hola! ' + cuerpo;
    }
    if (ajuste === 'agrega' && valor) {
      const extra = String(valor).trim().replace(/[.\s]+$/, '');
      if (extra) {
        const s = sentencias(nuevo);
        const frase = extra.charAt(0).toUpperCase() + extra.slice(1) + '.';
        const i = s.findIndex(x => /\bBAJA\b/.test(x));
        if (i >= 0) s.splice(i, 0, frase); else s.push(frase);
        nuevo = s.join(' ');
      }
    }
    return unirFirma(nuevo, firma);
  }
  // Tolera errores de tipeo en palabras de 5 letras o más (una letra de diferencia; dos en las muy largas).
  function distanciaCRM(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const tieneAlguna = (t, palabras) => t.split(' ').some(w => palabras.some(p => w === p || (p.length >= 5 && w.length >= 4 && distanciaCRM(w, p) <= (p.length >= 8 ? 2 : 1))));
  function parseTarea(texto) {
    const t = norm(texto);
    if (tieneAlguna(t, ['avisa', 'avisale', 'avisar', 'dile', 'digale', 'recuerdale'])) return 'avisar';
    if (tieneAlguna(t, ['visita', 'visitar']) || (tieneAlguna(t, ['agenda', 'agendar']) && tieneAlguna(t, ['visita', 'reunion', 'cita']))) return 'visita';
    if (tieneAlguna(t, ['whatsapp', 'wasap', 'guasap'])) return 'contactar';
    const correo = tieneAlguna(t, ['correo', 'mail', 'email']);
    if (correo && tieneAlguna(t, ['manda', 'mandale', 'mandar', 'envia', 'enviale', 'enviar', 'escribe', 'escribele', 'escribir'])) return 'correo';
    if (tieneAlguna(t, ['llama', 'llamale', 'llamar', 'contacta', 'contactale', 'contactar'])) return 'contactar';
    if (correo) return 'correo';
    return null;
  }
  function parseAjuste(texto) {
    const t = norm(texto);
    if (tieneAlguna(t, ['corto', 'breve', 'resumelo'])) return { tipo: 'corto' };
    if (tieneAlguna(t, ['formal'])) return { tipo: 'formal' };
    if (tieneAlguna(t, ['cercano', 'calido', 'amable'])) return { tipo: 'cercano' };
    const m = String(texto || '').match(/^\s*(\S+)\s+(.+)$/);
    if (m && tieneAlguna(norm(m[1]), ['agrega', 'agregale', 'anade', 'suma', 'incluye'])) return { tipo: 'agrega', valor: m[2] };
    return null;
  }
  function destinoRol(texto) {
    const t = norm(texto);
    if (/marketing/.test(t)) return 'marketing';
    if (/jefatura|gerencia|jefe/.test(t)) return 'jefatura';
    return 'ventas';
  }
  const nombreDestino = rol => (rol === 'ventas' ? `${pnAtiende('ventas')} (Ventas)` : (rol === 'marketing' ? 'Marketing' : 'Jefatura'));
  function recadoDe(texto) {
    const m = String(texto || '').match(/\bque\s+(.+)$/i);
    return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 140) : 'revises la cuenta y la llames';
  }
  function buscarRef(texto) {
    const l = buscarLead(texto);
    if (l) return refDe(l.id);
    const palabras = norm(texto).split(' ').filter(w => w.length >= 3 && !STOP.has(w) && !GENERICAS.has(w) && !/^(manda|mandale|correo|envia|enviale|avisa|avisale|llama|llamale|visita|agenda|agendar|escribe|escribele|contacta|whatsapp|mail|email|sobre|para|cuenta|hotel|que|con|sus|propuesta|llame|mañana|manana)$/.test(w));
    if (!palabras.length) return null;
    const hit = cuentasDe().find(x => { const h = norm(`${x.name || ''} ${x.business || ''}`); return palabras.some(w => h.includes(w)); });
    return hit ? refDe(hit.id) : null;
  }
  const borradorAbierto = () => Object.values(PN.borradores).filter(b => b.estado === 'editando').pop() || null;
  const esperasAbiertas = () => leerAgente().traspasos.filter(t => t.espera && t.estado === 'esperando').sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
  function abrirPanel() {
    if (!PN.abierto) {
      // El panel se abre a la vista (lateral en escritorio, hoja inferior en celular): se guarda el foco
      // para devolverlo al cerrar y se enfoca el campo del borrador o la conversación.
      try { PN.focoPrevio = document.activeElement; } catch (_) { PN.focoPrevio = null; }
      PN.abierto = true;
      renderLanzador();
    }
  }
  function cerrarPanel() {
    if (!PN.abierto) return;
    PN.abierto = false;
    renderLanzador();
    const previo = PN.focoPrevio;
    PN.focoPrevio = null;
    if (previo && typeof previo.focus === 'function' && previo.isConnected) { try { previo.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
  }
  function avisoPanel(texto) { PN.avisos.push(texto); if (PN.avisos.length > 6) PN.avisos.splice(0, PN.avisos.length - 6); }
  // Escribe en la conversación del cliente lo que el equipo toma o envía (lo ve el portal y la línea de tiempo).
  function avisarCliente(cuentaId) { try { window.MarleyAgente?.eventos?.emitir?.('mensaje', { cuentaId: String(cuentaId) }); } catch (_) { /* opcional */ } }

  // Tarea desde un botón de E (data-crm-agente-tarea) o desde texto: arma el borrador con los datos de la cuenta.
  function abrirTarea(tipo, cuentaId, texto) {
    const rol = pnRolActual();
    if (!TAREAS_ROL[rol]?.includes(tipo)) {
      PN.hilo.push({ tipo:'agente', html:'<p>Elige una de las acciones disponibles para tu rol.</p>' });
      renderPanel();
      return;
    }
    const info = tipo === 'plan-marketing' ? { key:'', empresa:'Marketing' } : infoDe(refDe(cuentaId));
    if (!info) { PN.hilo.push({ tipo: 'agente', html: tarjeta('Sin cuenta', '<p>No encuentro esa cuenta en el registro. Escribe su nombre o usa un botón de la lista.</p>', 'crm-agente-alerta') }); renderPanel(); return; }
    abrirPanel();
    const b = { id: uid('BR'), tipo, info, estado: 'editando', maquina: info.maquina, horario: '', destino: 'ventas', destinoNombre: '', usuario: pnUsuario(rol), recado: '', rol };
    if (tipo === 'visita') b.horarios = slotsVisita();
    if (tipo === 'avisar') {
      // Avisar a un compañero no se manda al mismo rol: Ventas avisa a Marketing y viceversa.
      const pedido = norm(texto || '');
      b.destino = /marketing|jefatura/.test(pedido) ? destinoRol(texto) : (rol === 'ventas' ? 'marketing' : 'ventas');
      b.destinoNombre = nombreDestino(b.destino);
      b.recado = recadoDe(texto || '');
    }
    b.texto = textoInicial(b);
    PN.borradores[b.id] = b;
    PN.hilo.push({ tipo: 'agente', html: `<p>Armé el borrador de <b>${esc(ETIQ_TAREA[tipo])}</b> con los datos de ${esc(info.empresa)}. Edítalo aquí mismo o pide ajustes: «más corto», «más formal», «más cercano» o «agrega …». «Envíalo» lo manda en segundo plano.</p>` });
    PN.hilo.push({ tipo: 'agente', borradorId: b.id });
    mutarAgente(st => anotar(st, rol, 'tarea:' + tipo, `cuenta ${info.empresa}`, 'Borrador armado con los datos de la cuenta', 'ia', 'Agente'));
    renderPanel(); renderLanzador();
    // El panel ya está a la vista (fijo); el foco va al borrador listo, sin arrastrar la página.
    const ta = pnHiloEl && pnHiloEl.querySelector(`[data-crm-agente-texto="${b.id}"]`);
    if (ta) { try { ta.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
    else if (pnInputEl) { try { pnInputEl.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
  }
  function ajustarBorrador(b, aj) {
    const ta = pnHiloEl ? pnHiloEl.querySelector(`[data-crm-agente-texto="${b.id}"]`) : null;
    if (ta) b.texto = ta.value;
    const original = b.texto;
    const siguiente = ajustarTexto(original, aj.tipo, aj.valor);
    const etiqueta = { corto: 'más corto', formal: 'más formal', cercano: 'más cercano', agrega: 'con lo que agregaste' }[aj.tipo] || 'como lo pediste';
    if (siguiente === original) {
      // Sin cambio real no se dice que cambió: la persona decide editar a mano.
      PN.hilo.push({ tipo: 'agente', html: `<p>Este texto ya está ${esc(etiqueta === 'más corto' ? 'lo más corto que puedo dejarlo sin perder lo esencial' : 'así')}. Puedes editarlo aquí mismo y enviarlo cuando quieras.</p>` });
      return null;
    }
    b.texto = siguiente;
    PN.hilo.push({ tipo: 'agente', html: `<p>Listo: lo dejé ${esc(etiqueta)}. Revísalo aquí y envíalo cuando quieras.</p>` });
    return null;
  }
  function descartarBorrador(id) {
    const b = PN.borradores[id];
    if (!b || b.estado !== 'editando') return;
    b.estado = 'descartado';
    const rol = pnRolActual() || 'ventas';
    mutarAgente(st => anotar(st, rol, 'borrador:descartar', recorta(b.texto, 80), 'Borrador descartado', 'persona', pnUsuario(rol)));
    PN.hilo.push({ tipo: 'agente', html: '<p>Borrador descartado. No se envió nada.</p>' });
    renderPanel(); renderRegistroPanel();
  }
  // «Envíalo»: sin permiso del cliente no sale nada (regla sin IA). Con permiso, se envía en segundo plano.
  function enviarBorrador(id) {
    const b = PN.borradores[id];
    if (!b || b.estado !== 'editando' || b.tipo === 'visita' && !b.horario) return;
    const rol = pnRolActual() || 'ventas';
    if (b.tipo === 'correo' || b.tipo === 'contactar') {
      const canal = b.tipo === 'correo' ? 'correo' : 'whatsapp';
      if (!permisoPara(b.info, canal)) {
        // Contactar tiene respaldo en el chat del portal, que es donde el cliente ya está hablando.
        // Correo y WhatsApp sin consentimiento no salen: primero se pide el permiso.
        if (b.tipo === 'contactar') {
          b.canalRespaldo = 'web';
          mutarAgente(st => anotar(st, rol, 'regla:sin-permiso-whatsapp', 'Sin permiso de WhatsApp registrado', 'Se usa el chat del portal, que el cliente inició', 'regla', 'Regla del CRM'));
        } else {
          b.estado = 'bloqueado';
          mutarAgente(st => anotar(st, rol, 'regla:sin-permiso-' + canal, `Sin permiso de ${canal === 'correo' ? 'correo' : 'WhatsApp'} registrado`, 'No se envía: primero se pide el permiso', 'regla', 'Regla del CRM'));
          avisoPanel(`No se envió: ${b.info.contacto} no tiene permiso de ${canal === 'correo' ? 'correo' : 'WhatsApp'} registrado.`);
          PN.hilo.push({ tipo: 'agente', html: tarjeta('Sin permiso del cliente', `<p>Con clientes solo se envía por los canales con permiso. ${esc(b.info.contacto)} no lo tiene para ${canal === 'correo' ? 'correo' : 'WhatsApp'}.</p>`, 'crm-agente-alerta') });
          renderPanel(); renderAviso(); renderRegistroPanel();
          return;
        }
      }
    }
    b.estado = 'enviando';
    avisoPanel('Enviando en segundo plano: puedes seguir trabajando.');
    renderPanel(); renderAviso();
    setTimeout(() => terminarEnvio(id, b), 600 + Math.round(Math.random() * 300));
  }
  const horaTexto = ts => { try { return new Date(Number(ts)).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  // Estado visible de la fila + contador (contrato 26-nov, punto 3): se escribe en el estado del CRM,
  // así crm-v2 vuelve a pintar la fila con «Contactado hoy 11:40» y el KPI suma en el mismo momento.
  function marcarEstadoFila(id, tipo, texto, extra) {
    try { window.MarleyCRM2?.toast?.(texto, 'La fila y el contador ya cambiaron.'); } catch (_) { /* aviso opcional */ }
    escribirCrm((crm, st) => {
      crm.rowState = crm.rowState || {};
      crm.rowState[String(id)] = { tipo, texto, kind: 'ok', at: ahora(), by: pnUsuario(pnRolActual() || 'ventas') };
      crm.counters = crm.counters || {};
      const clave = { contactar: 'contactos', correo: 'correos', visita: 'visitas', recordatorio:'reposiciones', avisar: 'avisos', resena: 'resenas', referido: 'referidos', detractor: 'respuestas', traspaso: 'traspasos', aprobacion: 'aprobaciones' }[tipo] || 'acciones';
      crm.counters[clave] = Number(crm.counters[clave] || 0) + 1;
      if (extra) extra(crm, st);
    });
  }
  function terminarEnvio(id, aprobado) {
    const b = PN.borradores[id] || aprobado;
    if (!b || b.estado !== 'enviando') return;
    const rol = b.rol || 'ventas';
    const quien = pnUsuario(rol);
    const info = b.info;
    let aviso = '';
    if (b.tipo === 'correo' || b.tipo === 'contactar') {
      const canal = b.tipo === 'correo' ? 'correo' : (b.canalRespaldo === 'web' ? 'web' : 'whatsapp');
      const para = canal === 'correo' ? (info.email || info.contacto) : canal === 'web' ? 'Chat del portal' : (info.telefono || info.contacto);
      const r = enviarSimulado({ canal, cuentaId: info.key, para, texto: b.texto, aprobadoPor: quien });
      if (!r || r.ok === false) { b.estado = 'editando'; avisoPanel(`No se envió: ${r && r.motivo ? r.motivo : 'falta el permiso del contacto'}.`); renderPanel(); renderAviso(); return; }
      b.estado = 'enviado';
      aviso = canal === 'web' ? `Contacto enviado por el chat del portal a ${info.empresa} (sin permiso de WhatsApp).` : `${canal === 'correo' ? 'Correo' : 'WhatsApp'} enviado a ${info.contacto} (${info.empresa}).`;
      const otro = rol === 'ventas' ? 'marketing' : 'ventas';
      mutarAgente(st => {
        anotar(st, rol, 'borrador:' + b.tipo, `datos de la cuenta y permiso de ${canal}`, 'Borrador armado por el agente', 'ia', 'Agente');
        anotar(st, rol, 'regla:permiso-' + canal, canal === 'web' ? 'Chat del portal iniciado por el cliente' : 'Consentimiento del contacto registrado', 'Con clientes, solo por canales con permiso', 'regla', 'Regla del CRM');
        anotar(st, rol, 'envio:' + canal, recorta(b.texto, 90), 'Texto aprobado y enviado por la persona', 'persona', quien);
        avisar(st, otro, `${quien} envió un ${canal === 'correo' ? 'correo' : 'WhatsApp'} a ${info.contacto} (${info.empresa}).`, { leadId: info.key, tipo: 'envio' });
      });
      marcarEstadoFila(info.key, b.tipo, `${b.tipo === 'correo' ? 'Correo enviado' : 'Contactado'} hoy ${horaTexto(ahora())}`, (crm, s) => {
        if (b.tipo !== 'contactar') return;
        const paso = (s.marketingPasos ||= {})[info.key] || {};
        s.marketingPasos[info.key] = { ...paso, estado:'aceptado', motivo:'En seguimiento', at:ahora() };
        (crm.handoffs ||= {})[info.key] = { status:'aceptado', reason:'En seguimiento', at:ahora() };
      });
    } else if (b.tipo === 'visita') {
      b.estado = 'enviado';
      aviso = `Visita propuesta a ${info.empresa} registrada en la línea de tiempo.`;
      mutarAgente(st => {
        st.conversaciones[info.key] = (st.conversaciones[info.key] || []).concat([{ canal: 'nota', rol, texto: b.texto, ts: ahora(), aprobadoPor: quien }]);
        anotar(st, rol, 'visita:proponer', `horario ${b.horario}`, 'Nota interna para la ejecutiva de la zona', 'persona', quien);
      });
      marcarEstadoFila(info.key, 'visita', 'Visita agendada', crm => {
        (crm.visitas ||= {})[info.key] = { horario:b.horario, fecha:b.fecha, at:ahora() };
      });
    } else if (b.tipo === 'recordatorio') {
      const r = enviarSimulado({ canal:'web', cuentaId:info.key, para:'Portal del cliente', texto:b.texto, aprobadoPor:quien });
      if (!r || r.ok === false) { b.estado = 'editando'; avisoPanel('No se pudo guardar el recordatorio en el portal.'); renderPanel(); return; }
      b.estado = 'enviado';
      aviso = 'Recordatorio enviado al portal.';
      marcarEstadoFila(info.key, 'recordatorio', 'Recordatorio enviado', (crm, s) => {
        const items = crm.replenishments ||= {};
        items[info.key] = { ...items[info.key], status:'Recordatorio enviado', reminderAt:ahora() };
        const c = s.customerCycle;
        const p = c?.orders?.at(-1);
        if (p?.receivedAt && [c.accountId,s.lead?.id].includes(info.key)) {
          p.replenishDue = true;
          p.replenishDueAt ||= ahora();
        }
      });
    } else if (b.tipo === 'plan-marketing') {
      b.estado = 'enviado';
      aviso = 'Marketing recibió el pedido de plan en su Hoy.';
      mutarAgente(st => avisar(st, 'marketing', b.texto, { tipo:'plan', por:quien }));
      marcarEstadoFila('plan-marketing', 'avisar', 'Plan solicitado a Marketing');
    } else if (b.tipo === 'traspaso') {
      b.estado = 'enviado';
      const ex = ejecutivoDe(info.x);
      aviso = `Traspaso enviado: ${info.empresa} aparece en el Hoy de Ventas con la marca «Nuevo».`;
      mutarAgente(st => {
        st.traspasos.unshift({ id: uid('TR'), leadId: info.key, de: 'marketing', a: 'ventas', dueno: ex.name, zona: zonaDe(ex), resumen: b.texto, estado: 'pendiente', canal: 'web', ts: ahora() });
        st.conversaciones[info.key] = (st.conversaciones[info.key] || []).concat([{ canal: 'nota', rol, texto: b.texto, ts: ahora(), aprobadoPor: quien }]);
        avisar(st, 'ventas', `Marketing pasó a ${info.empresa}. Dueño por zona: ${duenoTexto(info.x, ex)}.`, { leadId: info.key, tipo: 'traspaso' });
        anotar(st, rol, 'traspaso:enviar', recorta(b.texto, 90), 'Resumen revisado por Marketing', 'persona', quien);
      });
      marcarEstadoFila(info.key, 'traspaso', `Pasado a Ventas hoy ${horaTexto(ahora())}`, (crm, st) => {
        st.marketingPasos = st.marketingPasos || {};
        const previo = st.marketingPasos[info.key] || {};
        st.marketingPasos[info.key] = Object.assign({}, previo, { estado: 'esperando', motivo: 'MQL calificado', por: quien, at: ahora() });
        crm.handoffs = crm.handoffs || {};
        crm.handoffs[info.key] = { status: 'esperando', reason: 'MQL calificado', at: ahora() };
      });
    } else if (b.tipo === 'resena' || b.tipo === 'referido' || b.tipo === 'detractor') {
      b.estado = 'enviado';
      const etiqueta = { resena: 'Reseña pedida', referido: 'Referido pedido', detractor: 'Respondido' }[b.tipo];
      aviso = { resena: `Invitación a reseña enviada a ${info.empresa}. Queda como «Reseña pedida».`, referido: `Invitación a recomendar enviada a ${info.empresa}. Queda como «Referido pedido».`, detractor: `Respuesta enviada a ${info.empresa}. La ayuda queda como respondida.` }[b.tipo];
      const otro = rol === 'ventas' ? 'marketing' : 'ventas';
      mutarAgente(st => {
        const k = String(info.key);
        st.conversaciones[k] = (st.conversaciones[k] || []).concat([{ canal: 'web', rol, texto: b.texto, ts: ahora(), aprobadoPor: quien, simulado: true }]);
        anotar(st, rol, `postventa:${b.tipo}`, recorta(b.texto, 90), 'Texto aprobado y enviado por la persona', 'persona', quien);
        avisar(st, otro, `${quien} envió una ${b.tipo === 'detractor' ? 'respuesta al detractor' : b.tipo === 'resena' ? 'invitación a reseña' : 'invitación a recomendar'} de ${info.empresa}.`, { leadId: info.key, tipo: b.tipo });
      });
      marcarEstadoFila(info.key, b.tipo, `${etiqueta} hoy ${horaTexto(ahora())}`, crm => {
        if (b.tipo === 'detractor') { crm.postventaGestion = crm.postventaGestion || {}; crm.postventaGestion.ayudas = crm.postventaGestion.ayudas || {}; crm.postventaGestion.ayudas[String(info.key)] = { estado: 'respondida', respuesta:b.texto, at: ahora(), by: quien }; }
        if (b.tipo === 'resena') { crm.postventaGestion = crm.postventaGestion || {}; crm.postventaGestion.resenas = crm.postventaGestion.resenas || {}; crm.postventaGestion.resenas[String(info.key)] = { estado: 'pedida', canal: 'google', at: ahora(), by: quien }; }
        if (b.tipo === 'referido') { crm.postventaGestion = crm.postventaGestion || {}; crm.postventaGestion.referidos = crm.postventaGestion.referidos || {}; crm.postventaGestion.referidos[String(info.key)] = { estado: 'pedido', at: ahora(), by: quien }; }
      });
    } else {
      b.estado = 'enviado';
      aviso = `Aviso enviado a ${nombreDestino(b.destino)}: aparece en su Hoy.`;
      mutarAgente(st => {
        st.conversaciones[info.key] = (st.conversaciones[info.key] || []).concat([{ canal: 'nota', rol, texto: b.texto, ts: ahora(), aprobadoPor: quien }]);
        avisar(st, b.destino, b.texto, { leadId: info.key, tipo: 'aviso' });
        anotar(st, rol, 'aviso:' + b.destino, recorta(b.recado, 90), 'Aviso que la persona revisó y envió', 'persona', quien);
      });
      marcarEstadoFila(info.key, 'avisar', `Aviso enviado a ${nombreDestino(b.destino)}`);
    }
    avisoPanel(aviso);
    // El envío queda a la vista en la línea de tiempo del lead o de la cuenta, sin abrir la ficha.
    const leadEnvio = leadPorId(info.key) || refDe(info.key)?.cuenta || null;
    PN.hilo.push({ tipo: 'agente', html: `<p>${esc(aviso)}</p>${leadEnvio ? timelineHtml(leadEnvio, true) : ''}` });
    avisarCliente(info.key);
    renderPanel(); renderAviso(); renderEspera(); renderLanzador(); renderRegistroPanel(); refrescarHilo();
    sincronizar();
    window.dispatchEvent(new CustomEvent('marley:accion-completada', { detail: { tipo:b.tipo, cuentaId:info.key } }));
  }
  // «Tomar conversación»: la persona se une; el cliente lo ve en su chat con el resumen de lo que juntó el agente.
  function tomarConversacion(id) {
    const rol = pnRolActual() || 'ventas';
    const quien = pnAtiende(rol);
    let tr = null;
    mutarAgente(st => {
      tr = st.traspasos.find(t => t.id === id) || null;
      if (!tr || tr.estado !== 'esperando') { tr = null; return; }
      tr.estado = 'tomada'; tr.tomadoPor = quien; tr.tomadoRol = rol; tr.tomadoEn = ahora();
      const k = String(tr.leadId);
      st.conversaciones[k] = (st.conversaciones[k] || []).concat([{ canal: 'web', rol: 'persona', autor: quien, texto: `${quien} se unió a la conversación. Ya tiene tu resumen: ${tr.resumen || 'puedes seguir desde donde quedaste'}.`, ts: ahora(), tipo: 'union' }]);
      anotar(st, rol, 'conversacion:tomar', recorta(tr.resumen, 110), 'Tomar la conversación en espera con lo que juntó el agente', 'persona', quien);
    });
    if (!tr) { avisoPanel('Esa conversación ya no está en espera.'); renderAviso(); renderEspera(); return; }
    const info = infoDe(refDe(tr.leadId));
    avisoPanel(`Tomaste la conversación de ${info ? info.empresa : 'la cuenta'}. ${quien} se une en el chat del cliente.`);
    PN.hilo.push({ tipo: 'agente', html: tarjeta('Conversación tomada', `<p>${esc(quien)} ya está en el chat del cliente, con el resumen de lo que juntó el agente.</p>${filas([['Resumen', recorta(tr.resumen, 240)]])}`, 'crm-agente-ok') });
    avisarCliente(tr.leadId);
    renderPanel(); renderAviso(); renderEspera(); renderLanzador(); renderRegistroPanel();
    sincronizar();
  }
  // Acción de la barra o de sus tarjetas (aprobar, pasar a Ventas…) ejecutada desde el panel; su resultado se muestra aquí.
  function accionarPanel(acc, id, btn) {
    const rol = pnRolActual();
    if (!rol) return;
    S.rol = rol;
    const viejos = new Set(S.hilo[rol] || []);
    try { accionar(acc, id, btn); } catch (err) { avisoPanel('No pude completar esa acción. Nada se cambió.'); }
    const nuevos = (S.hilo[rol] || []).filter(x => !viejos.has(x)).reverse();
    nuevos.forEach(x => PN.hilo.push({ tipo: 'agente', html: x.html || '', borradorId: x.borradorId || null }));
    renderPanel(); renderAviso(); renderEspera(); renderLanzador(); renderRegistroPanel(); refrescarHilo();
  }
  // Respuesta del panel a texto libre: ajustes y envío del borrador abierto, tareas y consultas (con el motor de la barra).
  function responderPanel(texto) {
    const rol = pnRolActual();
    if (!rol) return { html: tarjeta('Elige tu rol', '<p>Entra con un rol del CRM para usar al agente.</p>') };
    const t = norm(texto);
    const abierto = borradorAbierto();
    const aj = parseAjuste(texto);
    if (abierto && aj) { ajustarBorrador(abierto, aj); return null; }
    if (abierto && /\b(enviala|enviarla|envialo|enviarlo|mandala|mandalo|envialas|enviaselo)\b/.test(t)) { enviarBorrador(abierto.id); return null; }
    if (abierto && /\b(descarta|descartalo|descartarlo|cancela|olvidalo)\b/.test(t)) { descartarBorrador(abierto.id); return null; }
    if (/(conversacion|chat)\w*[^.?]*\b(en espera|esperando)\b|\b(en espera|esperando)\b[^.?]*(conversacion|chat)|\btoma\w*\s+(la\s+)?(conversacion|chat)\b/.test(t)) {
      const lista = esperasAbiertas();
      if (!lista.length) return { html: tarjeta('Nada en espera', '<p>No hay conversaciones esperando a una persona.</p>') };
      return { html: tarjeta('En espera', `<p>${lista.length} conversación(es) esperando a una persona. Están arriba: toma una con «Tomar conversación».</p>`) };
    }
    const tarea = parseTarea(texto);
    if (tarea) {
      const ref = buscarRef(texto);
      if (!ref) return { html: tarjeta('¿Qué cuenta?', '<p>No encuentro esa cuenta. Escribe su nombre tal como aparece en el CRM.</p>') };
      abrirTarea(tarea, ref.key, texto);
      return null;
    }
    const intent = interpretar(t);
    S.usoFoco = false;
    let r = ejecutar(rol, intent, texto);
    if (r === null) r = respuestaMotor(rol, texto);
    if (r && r.hecho) return { html: tarjeta('Hecho', '<p>Listo. Quedó en el registro.</p>') };
    if (r && typeof r === 'object') return { html: r.html || '', borradorId: r.borradorId || null };
    return { html: String(r || '') };
  }
  function procesarPanel(texto) {
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!limpio || !pnRolActual()) return;
    abrirPanel();
    PN.hilo.push({ tipo: 'usuario', texto: limpio });
    PN.escribiendo += 1;
    renderPanel();
    setTimeout(() => {
      PN.escribiendo -= 1;
      let out = null;
      try { out = responderPanel(limpio); } catch (err) { out = { html: tarjeta('No pude completar esto', `<p>${esc(err && err.message ? err.message : 'Error inesperado')}. Nada se cambió en el registro.</p>`, 'crm-agente-alerta') }; }
      if (out) PN.hilo.push({ tipo: 'agente', html: out.html || '', borradorId: out.borradorId || null });
      PN.hilo = PN.hilo.slice(-30);
      renderPanel(); renderAviso(); renderEspera(); renderLanzador(); renderRegistroPanel();
    }, 400 + Math.round(Math.random() * 500));
  }
  // Muestra «escribiendo…» 400 a 900 ms antes de la acción (botones de E y ajustes).
  function conEspera(fn) {
    PN.escribiendo += 1;
    renderPanel();
    setTimeout(() => {
      PN.escribiendo -= 1;
      try { fn(); } catch (err) { PN.hilo.push({ tipo: 'agente', html: tarjeta('No pude completar esto', `<p>${esc(err && err.message ? err.message : 'Error inesperado')}. Nada se cambió en el registro.</p>`, 'crm-agente-alerta') }); }
      renderPanel(); renderAviso(); renderEspera(); renderLanzador(); renderRegistroPanel();
    }, 400 + Math.round(Math.random() * 500));
  }

  // ----- Pintado -----
  function burbujaBorrador(b) {
    const info = b.info;
    const editable = b.estado === 'editando';
    const canal = b.tipo === 'correo' ? 'correo' : (b.tipo === 'contactar' ? 'whatsapp' : null);
    const permiso = canal ? (permisoPara(info, canal) ? 'Permiso de ' + (canal === 'correo' ? 'correo' : 'WhatsApp') + ' registrado' : (b.tipo === 'contactar' ? 'Sin permiso de WhatsApp: se envía por el chat del portal' : 'Sin permiso: no se envía')) : 'Nota interna: no sale al cliente';
    const estadoTxt = { enviando: 'Enviando en segundo plano…', enviado: 'Enviado', bloqueado: 'Bloqueado: falta permiso', descartado: 'Descartado' }[b.estado] || '';
    const cierre = CIERRES[b.tipo] ? ` data-cierra-tarea="${CIERRES[b.tipo]}"` : '';
    const opciones = b.tipo === 'visita' && editable ? `<fieldset class="crm-agente-horarios"><legend>Elige un horario</legend>${b.horarios.map(slot => `<label><input type="radio" name="visita-${esc(b.id)}" data-crm-agente-horario="${esc(b.id)}" value="${esc(slot.iso)}"${b.fecha === slot.iso ? ' checked' : ''}> ${esc(slot.etiqueta)}</label>`).join('')}</fieldset>` : '';
    const para = b.tipo === 'avisar' ? `para ${b.destinoNombre}` : b.tipo === 'traspaso' ? 'para Ventas (resumen editable)' : b.tipo === 'visita' ? `nota interna para ${info.empresa}` : `para ${info.contacto} (${info.empresa})`;
    return `<div class="crm-agente-burbuja crm-agente-burbuja--agente crm-agente-burbuja--borrador" data-crm-agente-burbuja="agente" data-crm-agente-borrador="${esc(b.id)}" data-tipo="${esc(b.tipo)}" data-estado="${esc(b.estado)}">
      <p class="crm-agente-canal"><b>Borrador · ${esc(ETIQ_TAREA[b.tipo])}</b> · ${esc(para)}</p>
      <label class="crm-agente-sr" for="crm-agente-txt-${esc(b.id)}">Texto del borrador</label>
      <textarea id="crm-agente-txt-${esc(b.id)}" class="crm-agente-texto-borrador" data-crm-agente-texto="${esc(b.id)}" rows="5"${editable ? '' : ' disabled'}>${esc(b.texto)}</textarea>
      <div class="crm-agente-ajustes" role="group" aria-label="Ajustes del borrador">
        <button type="button" class="crm-agente-chip" data-crm-agente-ajuste="corto" data-id="${esc(b.id)}"${editable ? '' : ' disabled'}>Más corto</button>
        <button type="button" class="crm-agente-chip" data-crm-agente-ajuste="formal" data-id="${esc(b.id)}"${editable ? '' : ' disabled'}>Más formal</button>
        <button type="button" class="crm-agente-chip" data-crm-agente-ajuste="cercano" data-id="${esc(b.id)}"${editable ? '' : ' disabled'}>Más cercano</button>
      </div>
      ${opciones}
      <div class="crm-agente-decision">
        <button type="button" class="crm-agente-btn crm-agente-btn--ok" data-crm-agente-accion="enviar" data-id="${esc(b.id)}"${cierre}${editable && (b.tipo !== 'visita' || b.horario) ? '' : ' disabled'}>${b.tipo === 'visita' ? 'Agendar visita' : 'Enviar'}</button>
        <button type="button" class="crm-agente-btn" data-crm-agente-accion="descartar" data-id="${esc(b.id)}"${editable ? '' : ' disabled'}>Descartar</button>
        ${estadoTxt ? `<span class="crm-agente-estado-b" data-crm-agente-estado-b>${esc(estadoTxt)}</span>` : ''}
      </div>
      <dl class="crm-agente-niveles-b">
        <div><dt>Regla sin IA</dt><dd>${esc(permiso)}</dd></div>
        <div><dt>Sugerencia de IA</dt><dd>Borrador con los datos de la cuenta; puedes editarlo y pedir ajustes.</dd></div>
        <div><dt>Decisión de persona</dt><dd>${editable ? 'Revisa el borrador antes de confirmarlo.' : 'Decidida por una persona.'}</dd></div>
      </dl>
    </div>`;
  }
  function renderPanel() {
    if (!pnHiloEl) return;
    // Al repintar se conserva el foco y el cursor dentro del borrador: la persona sigue escribiendo donde estaba.
    const activo = document.activeElement;
    const idTexto = activo && pnHiloEl.contains(activo) && activo.matches('[data-crm-agente-texto]') ? activo.dataset.crmAgenteTexto : null;
    const selIni = idTexto ? activo.selectionStart : null;
    const selFin = idTexto ? activo.selectionEnd : null;
    const partes = PN.hilo.map(it => {
      if (it.borradorId && PN.borradores[it.borradorId]) return burbujaBorrador(PN.borradores[it.borradorId]);
      if (it.borradorId && S.borradores[it.borradorId]) return `<div class="crm-agente-burbuja crm-agente-burbuja--agente" data-crm-agente-burbuja="agente">${borradorHtml(S.borradores[it.borradorId])}</div>`;
      if (it.tipo === 'usuario') return `<div class="crm-agente-burbuja crm-agente-burbuja--usuario" data-crm-agente-burbuja="usuario"><p>${esc(it.texto)}</p></div>`;
      return `<div class="crm-agente-burbuja crm-agente-burbuja--agente" data-crm-agente-burbuja="agente">${it.html || ''}</div>`;
    });
    if (PN.escribiendo > 0) partes.push('<p class="crm-agente-escribe" data-crm-agente-escribe role="status">escribiendo…</p>');
    pnHiloEl.innerHTML = partes.join('') || '<p class="crm-agente-vacio">Pídele algo al agente: «mándale un correo a…», «avísale a Ventas que llame mañana a…», o toca una tarea de la lista.</p>';
    const decididas = new Set((est().jefeAprob || []).filter(item => item.estado === 'aprobada').map(item => String(item.id)));
    for (const button of pnHiloEl.querySelectorAll('[data-crm-agente-accion="confirmar-aprobacion"], [data-crm-agente-accion="confirmar-checklist"]')) {
      if (decididas.has(button.dataset.id)) button.remove();
    }
    if (idTexto) {
      const ta = pnHiloEl.querySelector(`[data-crm-agente-texto="${CSS.escape(idTexto)}"]`);
      if (ta) { try { ta.focus({ preventScroll: true }); ta.setSelectionRange(selIni, selFin); } catch (_) { /* foco opcional */ } }
    }
    pnHiloEl.scrollTop = pnHiloEl.scrollHeight;
  }
  function renderSugPanel() {
    if (!pnSugEl) return;
    const rol = pnRolActual();
    pnSugEl.innerHTML = rol ? sugerenciaTexto(rol).map(t => `<button type="button" class="crm-agente-chip" data-crm-agente-sugerencia="${esc(t)}">${esc(t)}</button>`).join('') : '';
  }
  function renderEspera() {
    if (!pnEsperaEl) return;
    const lista = esperasAbiertas();
    pnEsperaEl.hidden = lista.length === 0;
    if (!lista.length) { pnEsperaEl.innerHTML = ''; return; }
    pnEsperaEl.innerHTML = `<h3 class="crm-agente-espera-t">Conversaciones en espera <b>${lista.length}</b></h3>` + lista.map(t => {
      const d = (t.espera && t.espera.datos) || {};
      const info = infoDe(refDe(t.leadId));
      const empresa = info ? info.empresa : 'Cuenta';
      const juntado = t.espera.tema === 'falla'
        ? `Foto: ${d.foto === 'si' ? 'sí (simulada)' : (d.foto === 'no' ? 'no la tiene ahora' : 'pendiente')} · Horario: ${d.horario || 'pendiente'} · Dirección: ${d.direccion || 'pendiente'}`
        : (t.espera.tema === 'precio' ? `Condición: ${d.detalle || 'pendiente'} · Cuándo: ${d.cuando || 'pendiente'}` : `Lo que necesita: ${d.detalle || 'sin detalle'}`);
      return `<article class="crm-agente-espera-item" data-crm-espera-id="${esc(t.id)}">
        <p><b>${esc(empresa)}</b> · ${esc(MOTIVO_ESP[t.espera.tema] || 'Consulta')} · espera a ${esc(t.a === 'ventas' ? 'Ventas' : 'Soporte')}</p>
        <p class="crm-agente-nota">Lo que juntó el agente: ${esc(juntado)}.</p>
        <button type="button" class="crm-agente-btn crm-agente-btn--ok" data-crm-agente-accion="tomar-conversacion" data-id="${esc(t.id)}">Tomar conversación</button>
      </article>`;
    }).join('');
  }
  function renderLanzador() {
    if (!pnLanzEl) return;
    const rol = pnRolActual();
    const notif = rol ? (leerAgente().notificaciones[rol] || []).filter(n => !n.leida).length : 0;
    const total = esperasAbiertas().length + notif;
    const txt = total ? String(total) : '';
    if (pnContEl.textContent !== txt) pnContEl.textContent = txt;
    pnContEl.hidden = !total;
    pnContEl.setAttribute('aria-label', total ? `${total} pendientes del agente` : '');
    pnLanzEl.setAttribute('aria-expanded', PN.abierto ? 'true' : 'false');
    pnCuerpoEl.hidden = !PN.abierto;
    if (panelEl) panelEl.classList.toggle('is-abierto', PN.abierto);
    // Con la conversación abierta, la tarjeta se queda en su cabecera: un solo campo para escribir.
    if (barEl) barEl.classList.toggle('is-conversando', Boolean(PN.abierto && panelEl && panelEl.classList.contains('crm-agente-chat--en-hoy')));
  }
  function renderAviso() {
    if (!pnAvisoEl) return;
    const ult = PN.avisos.slice(-2);
    pnAvisoEl.hidden = !ult.length;
    pnAvisoEl.innerHTML = ult.map(a => `<span class="crm-agente-aviso-p">${esc(a)}</span>`).join('');
  }
  function renderRegistroPanel() {
    if (!pnRegEl) return;
    const reg = leerAgente().registro.slice(-6).reverse();
    pnRegEl.innerHTML = reg.length
      ? `<ol class="crm-agente-reg">${reg.map(r => `<li><b>${esc(ROL_TXT[r.rol] || r.rol)}</b> · ${esc(r.accion)} · <span data-nivel="${esc(r.nivel)}">${esc(NIVEL_TXT[r.nivel] || r.nivel)}</span> · dato: ${esc(recorta(r.datoUsado, 70))} · decidió: ${esc(r.decidio)} <small>${esc(hora(r.ts))}</small></li>`).join('')}</ol>`
      : '<p>Aún no hay acciones registradas.</p>';
  }

  // ----- Construcción y montaje (E vuelve a pintar #crm-v2-root en cada ruta: el panel se vuelve a poner) -----
  function construirPanel() {
    if (panelEl) return;
    panelEl = document.createElement('section');
    panelEl.id = 'crm-agente-chat';
    panelEl.className = 'crm-agente crm-agente-chat';
    panelEl.setAttribute('aria-label', 'Agente del CRM');
    panelEl.innerHTML = `
      <button type="button" class="crm-agente-lanzador" data-crm-agente-accion="alternar" aria-expanded="false" aria-controls="crm-agente-chat-cuerpo">
        <span class="crm-agente-icono" aria-hidden="true">${ICONO_AGENTE}</span>
        <span class="crm-agente-lanzador-txt"><b>Asistente de IA del CRM</b><small>Pídele una tarea o una consulta</small></span>
        <span class="crm-agente-lanzador-n" data-crm-agente-contador hidden></span>
      </button>
      <div id="crm-agente-chat-cuerpo" class="crm-agente-cuerpo" hidden>
        <div class="crm-agente-chat-cab">
          <b>Asistente de IA del CRM</b>
          <button type="button" class="crm-agente-cerrar" data-crm-agente-accion="alternar" aria-label="Ocultar la conversación">Ocultar</button>
        </div>
        <div class="crm-agente-espera" data-crm-espera hidden></div>
        <div class="crm-agente-hilo-chat" data-crm-agente-hilo-chat aria-live="polite" aria-relevant="additions"></div>
        <p class="crm-agente-avisos-chat" data-crm-aviso role="status" aria-live="polite" hidden></p>
        <div class="crm-agente-sugerencias-chat" data-crm-agente-sugerencias-chat role="group" aria-label="Sugerencias"></div>
        <form class="crm-agente-form-chat" data-crm-agente-form-chat autocomplete="off">
          <label class="crm-agente-sr" for="crm-agente-chat-entrada">Pídele algo al agente</label>
          <div class="crm-agente-campo">
            <input id="crm-agente-chat-entrada" type="text" maxlength="240" placeholder="Escribe una tarea o consulta" aria-describedby="crm-agente-chat-ejemplo">
            <button type="submit" class="crm-agente-enviar">Enviar</button>
          </div>
          <p id="crm-agente-chat-ejemplo" class="crm-agente-ejemplo">Ejemplo: «Mándale un correo a Hotel Altos del Parque».</p>
        </form>
        <details class="crm-agente-registro"><summary>Registro del agente</summary><div data-crm-agente-registro-chat></div></details>
      </div>`;
    pnLanzEl = panelEl.querySelector('.crm-agente-lanzador');
    pnContEl = panelEl.querySelector('[data-crm-agente-contador]');
    pnCuerpoEl = panelEl.querySelector('.crm-agente-cuerpo');
    pnEsperaEl = panelEl.querySelector('[data-crm-espera]');
    pnHiloEl = panelEl.querySelector('[data-crm-agente-hilo-chat]');
    pnAvisoEl = panelEl.querySelector('[data-crm-aviso]');
    pnSugEl = panelEl.querySelector('[data-crm-agente-sugerencias-chat]');
    pnFormEl = panelEl.querySelector('[data-crm-agente-form-chat]');
    pnInputEl = panelEl.querySelector('#crm-agente-chat-entrada');
    pnRegEl = panelEl.querySelector('[data-crm-agente-registro-chat]');
    panelEl.addEventListener('click', onPanelClick);
    panelEl.addEventListener('input', ev => {
      const radio = ev.target.closest?.('[data-crm-agente-horario]');
      if (radio) {
        const b = PN.borradores[radio.dataset.crmAgenteHorario];
        const slot = b?.horarios?.find(item => item.iso === radio.value);
        if (!slot || b.estado !== 'editando') return;
        b.fecha = slot.iso;
        b.horario = slot.etiqueta;
        b.texto = textoInicial(b);
        const form = radio.closest('[data-crm-agente-borrador]');
        form.querySelector('textarea').value = b.texto;
        form.querySelector('[data-crm-agente-accion="enviar"]').disabled = false;
        return;
      }
      const ta = ev.target && ev.target.closest ? ev.target.closest('[data-crm-agente-texto]') : null;
      if (ta && PN.borradores[ta.dataset.crmAgenteTexto]) PN.borradores[ta.dataset.crmAgenteTexto].texto = ta.value;
    });
    pnFormEl.addEventListener('submit', ev => { ev.preventDefault(); const v = pnInputEl.value; pnInputEl.value = ''; procesarPanel(v); });
    renderSugPanel(); renderRegistroPanel(); renderLanzador();
  }
  function onPanelClick(ev) {
    const t = ev.target && ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
    if (!t || !t.closest) return;
    const sug = t.closest('[data-crm-agente-sugerencia]');
    if (sug && panelEl.contains(sug)) { ev.preventDefault(); procesarPanel(sug.dataset.crmAgenteSugerencia); return; }
    const aj = t.closest('[data-crm-agente-ajuste]');
    if (aj && panelEl.contains(aj)) {
      ev.preventDefault();
      const b = PN.borradores[aj.dataset.id];
      if (b && b.estado === 'editando') conEspera(() => ajustarBorrador(b, { tipo: aj.dataset.crmAgenteAjuste }));
      return;
    }
    const btn = t.closest('[data-crm-agente-accion]');
    if (!btn || !panelEl.contains(btn)) return;
    ev.preventDefault();
    const acc = btn.dataset.crmAgenteAccion, id = btn.dataset.id || '';
    if (acc === 'alternar') { if (PN.abierto) cerrarPanel(); else { abrirPanel(); if (pnInputEl) { try { pnInputEl.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } } } return; }
    if (acc === 'enviar') { enviarBorrador(id); renderPanel(); return; }
    if (acc === 'descartar') { descartarBorrador(id); return; }
    if (acc === 'tomar-conversacion') { conEspera(() => tomarConversacion(id)); return; }
    accionarPanel(acc, id, btn);
  }
  // Sitio del panel: justo después de la tarjeta del «Hoy» (si la hay) o al principio del contenido de la ruta R.
  // En el Hoy la tarjeta es la que invita; el panel solo aparece cuando hay conversación abierta.
  function sincronizarPanel() {
    const host = document.getElementById(ROOT_ID);
    const ruta = (location.hash || '#R00').slice(1).split('?')[0];
    const contenido = host && !host.hidden ? host.querySelector('.crm2-content') : null;
    const rol = pnRolActual();
    if (!contenido || !rol || !/^R\d{2}$/.test(ruta)) { quitarPanel(); return; }
    // Cambiar de pestaña cierra la conversación: no queda un panel flotando sobre otra pantalla.
    if (PN.ruta !== ruta) { PN.ruta = ruta; PN.abierto = false; }
    construirPanel();
    const enHoy = ruta === 'R01' || ruta === 'R11' || ruta === 'R05';
    panelEl.classList.toggle('crm-agente-chat--en-hoy', enHoy);
    if (PN.rol !== rol) { PN.rol = rol; PN.hilo = []; PN.borradores = {}; PN.avisos = []; PN.abierto = false; renderSugPanel(); renderRegistroPanel(); }
    renderLanzador();
    const antes = barEl && barEl.parentNode === contenido ? barEl : null;
    const bien = antes ? panelEl.previousElementSibling === antes : contenido.firstElementChild === panelEl;
    if (panelEl.parentNode !== contenido || !bien) {
      contenido.insertBefore(panelEl, antes ? antes.nextSibling : contenido.firstChild);
      renderLanzador(); renderEspera(); renderAviso();
    }
  }
  function quitarPanel() { if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl); }
  // Botones de E: [data-crm-agente-tarea="correo|contactar|visita|avisar"][data-cuenta-id] (delegación en document).
  document.addEventListener('click', ev => {
    const t = ev.target && ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
    const b = t && t.closest ? t.closest('[data-crm-agente-tarea]') : null;
    if (!b || !pnRolActual()) return;
    const tipo = b.dataset.crmAgenteTarea;
    if (!ETIQ_TAREA[tipo]) return;
    ev.preventDefault();
    if (!panelEl || !panelEl.isConnected) sincronizarPanel();
    const cuenta = b.dataset.cuentaId || '';
    // 26-nov (Claude): si la persona ya cambió de pantalla o de rol mientras el motor cargaba,
    // no se abre el panel con un borrador viejo encima de otra pantalla.
    const rutaClic = location.hash;
    const rolClic = pnRolActual();
    conEspera(() => { if (location.hash !== rutaClic || pnRolActual() !== rolClic) return; abrirTarea(tipo, cuenta); });
  });
  // Escape cierra la conversación y devuelve el foco al control que la abrió (contrato 26-nov, punto 3).
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || !PN.abierto) return;
    ev.preventDefault();
    cerrarPanel();
  });

  window.MarleyCRMAgente = {
    version: VERSION,
    procesar,
    sincronizar,
    rol: () => S.rol,
    panel: {
      abrirTarea: (tipo, id) => conEspera(() => abrirTarea(tipo, id)),
      tomar: tomarConversacion,
      // Aprobar desde Por aprobar abre la confirmación del agente; la persona decide ahí y queda su nombre.
      aprobar: id => {
        const it = itemPorId(id);
        if (!it) return;
        abrirPanel();
        PN.hilo.push({ tipo: 'agente', html: htmlAprobacion(it) });
        renderPanel();
        const btn = pnHiloEl?.querySelector('[data-crm-agente-accion="confirmar-aprobacion"], [data-crm-agente-accion="confirmar-checklist"]');
        if (btn) { try { btn.focus({ preventScroll: true }); } catch (_) { /* foco opcional */ } }
      }
    }
  };
  arrancar();
})();
