/* B2 · Portal del cliente · Marley Coffee Empresas (25-nov-2026).
 * window.MarleyPortal.render(host) pinta cuatro pestañas (Mi pedido, Repetir pedido,
 * Ayuda y postventa, Recomendar) con el estado de window.M4 y con sus acciones existentes
 * (M4Journey, MCMail, R3C2, M4D). Sin localStorage y sin llamadas externas: las firmas,
 * los correos y los envíos son simulados. */
(function () {
  'use strict';
  if (window.MarleyPortal) { return; }

  var VERSION = '25-nov-b2';
  var formatoEscritorio = window.matchMedia('(min-width: 768px)');
  var TABS = [
    { id: 'pedido', t: 'Mi pedido' },
    { id: 'repetir', t: 'Repetir pedido' },
    { id: 'ayuda', t: 'Ayuda y postventa' },
    { id: 'recomendar', t: 'Recomendar' }
  ];
  var ETAPAS = [
    { id: 'confirmado', t: 'Confirmado', d: 'Tu propuesta quedó aceptada y tu folio está registrado.' },
    { id: 'firmado', t: 'Contrato firmado', d: 'Firmaste el contrato de comodato (simulación): la máquina queda en préstamo mientras compras café.' },
    { id: 'preparacion', t: 'En preparación', d: 'Preparamos tu máquina y tus insumos. La fecha y el plazo de entrega se confirman con tu ejecutivo.' },
    { id: 'camino', t: 'En camino', d: 'Tu pedido va en camino (simulación). Cuando llegue, confírmalo en esta pantalla.' },
    { id: 'instalado', t: 'Instalado', d: 'Tu pedido llegó y la instalación quedó registrada en la simulación.' }
  ];
  var PASOS = {
    'sin-propuesta': { titulo: 'Tu pedido', lead: 'Tu pedido todavía no está confirmado. Cuando tu propuesta esté aceptada, aquí verás tu contrato y tu avance.' },
    firma: { titulo: 'Firma tu contrato', lead: 'Tu propuesta está aceptada. Revisa el contrato y fírmalo para avanzar.' },
    aviso: { titulo: 'Contrato firmado', lead: 'Simula el paso del tiempo para ver cómo llega tu pedido.' },
    confirmar: { titulo: 'Confirma tu pedido', lead: 'El aviso de reposición está listo. Confirma tu pedido para que comience la preparación.' },
    preparacion: { titulo: 'Tu pedido está en preparación', lead: 'Tu pedido está confirmado. Puedes seguir su avance en la línea de abajo.' },
    camino: { titulo: 'Tu pedido va en camino', lead: 'Tu pedido va <mark data-vida="clave">en camino</mark>. Cuando llegue, confírmalo aquí.' },
    recibido: { titulo: 'Pedido recibido', lead: 'Recibiste tu pedido. Cuando toque reponer, lo repites en un toque.' },
    reponer: { titulo: '¿Quieres repetir tu pedido?', lead: 'Repite tu pedido con los mismos productos o ajústalo a tu consumo.' }
  };
  var MOTIVOS = ['La máquina no funciona', 'Me faltan insumos o el pedido no llegó', 'El café no sale como antes', 'Facturación o pago', 'Otro'];
  var RAPIDAS = [
    { id: 'donde', q: '¿Dónde viene mi pedido?' },
    { id: 'firmo', q: '¿Cómo firmo?' },
    { id: 'horario', q: 'Cambiar horario de entrega' },
    { id: 'falla', q: 'Tengo una falla' },
    { id: 'repito', q: '¿Cómo repito mi pedido?' },
    { id: 'incluye', q: '¿Qué incluye mi pedido?' }
  ];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var ESTIMADO = 'estimado de la simulación';
  var CARITAS = { contento: ['🙂', 'Contento'], regular: ['😐', 'Más o menos'], 'no-contento': ['🙁', 'No contento'] };
  var CANALES = { google: 'Google', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', instagram: 'Instagram', referido: 'Recomendar a otro negocio' };
  var ICONOS_CANALES = { google:'★', whatsapp:'↗', linkedin:'▤', instagram:'▧', referido:'✉' };

  var st = {
    tab: 'pedido',
    etapa: null,
    dialogo: false,
    rapida: null,
    aviso: null,
    errores: {},
    cantidades: null,
    formularios: {},
    host: null,
    foco: null,
    agenteAbierto: null,
    agenteRender: null,
    rapida: null,
    textoRapida: null,
    toast: null,
    toastTimer: null,
    encuesta: null,
    vistaCanal: null,
    resumenAyuda: null
  };

  /* ---------- utilidades ---------- */
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmt(n) {
    return '$' + new Intl.NumberFormat('es-CL').format(Math.round(Number(n) || 0));
  }
  function diaMes(ts) {
    var d = ts ? new Date(Number(ts)) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    return d.getDate() + ' ' + MESES[d.getMonth()];
  }
  function cantidad(v) {
    var n = Math.floor(Number(v));
    if (!isFinite(n) || n < 0) { return 0; }
    return Math.min(20, n);
  }

  /* ---------- lectura de datos del prototipo ---------- */
  function estado() {
    try { return window.M4 && window.M4.get ? window.M4.get() : null; } catch (_) { return null; }
  }
  function datos() {
    try { return window.R3C2 && window.R3C2.data ? window.R3C2.data() : null; } catch (_) { return null; }
  }
  function lineas() {
    var d = datos();
    return d && d.prices && d.prices.lines ? d.prices.lines : [];
  }
  function linea(clave) {
    var L = lineas();
    for (var i = 0; i < L.length; i++) {
      if (L[i].k === clave || L[i].catalogId === clave) { return L[i]; }
    }
    return null;
  }
  function comprador(s) {
    try { return (window.R3C2 && window.R3C2.buyerFor && window.R3C2.buyerFor(s)) || {}; } catch (_) { return {}; }
  }
  function ficha(maquina) {
    var d = datos();
    return d && d.offer && d.offer.maquinas && d.offer.maquinas[maquina] ? d.offer.maquinas[maquina] : {};
  }
  function maquinaM4(maquina) {
    return window.M4D && window.M4D.MACHINES && window.M4D.MACHINES[maquina] ? window.M4D.MACHINES[maquina] : {};
  }
  function maquinaDe(x) {
    var clave = x.s.proposal?.machine || x.s.quote?.machine || x.comp.maquina || '';
    var f = ficha(clave);
    var m = maquinaM4(clave);
    return {
      nombre: f.nombre || m.name || 'Tu máquina',
      tipo: f.tipo || m.kind || '',
      tazas: f.tazas || m.cupsTxt || '',
      formato: f.formato || m.format || '',
      atencion: f.atencion || m.staff || '',
      foto: f.foto || m.img || ''
    };
  }
  function folioDe(s) {
    try { return window.mcFolio ? window.mcFolio(s) : ''; } catch (_) { return ''; }
  }
  function soloItems(items) {
    return (items || []).filter(function (it) { return it && it.k && Number(it.qty) > 0; })
      .map(function (it) { return { k: it.k, qty: Number(it.qty) }; });
  }
  function totalItems(items) {
    return (items || []).reduce(function (suma, it) {
      var l = linea(it.k);
      return suma + (l ? Number(l.precio) * Number(it.qty) : 0);
    }, 0);
  }
  function journey() { return window.M4Journey || null; }

  /* ---------- escritura: solo acciones y eventos del estado existente ---------- */
  function mutar(fn) {
    if (!window.M4 || !window.M4.update) { return; }
    window.M4.update(function (s) { fn(s); });
  }
  function evento(s, nombre, texto, extra) {
    s.events = s.events || [];
    var c = s.customerCycle || {};
    var ev = {
      key: 'portal:' + ((s.lead && s.lead.id) || 'sin-lead') + ':' + nombre + ':' + s.events.length,
      eventName: nombre,
      label: texto,
      pts: 0,
      at: window.M4.now(),
      accountId: c.accountId || null,
      buyer: c.buyer || null,
      simulated: true
    };
    Object.keys(extra || {}).forEach(function (k) { ev[k] = extra[k]; });
    s.events.push(ev);
  }
  function postventa(s, lista, escribir) {
    if (escribir) {
      s.postventa ||= {};
      return s.postventa[lista] ||= [];
    }
    return s.postventa?.[lista] || [];
  }
  function fichaPostventa(s, lista, pedidoId) {
    return postventa(s, lista).find(v => v.cuentaId === s.customerCycle?.accountId && v.pedidoId === pedidoId);
  }
  function escribirPostventa(s, lista, pedidoId, datos) {
    var fila = fichaPostventa(s, lista, pedidoId);
    if (fila) { Object.assign(fila, datos); return; }
    postventa(s, lista, true).push(Object.assign({ cuentaId: s.customerCycle.accountId, pedidoId, ts: window.M4.now() }, datos));
  }

  function pedidoParaEncuesta(x) {
    var pedidos = x.c.orders || [];
    var pendiente = pedidos.findLast(p => {
      if (!p.receivedAt) return false;
      var r = fichaPostventa(x.s, 'respuestas', p.id);
      return !r || r.nps === null && !(r.carita === 'no-contento' && fichaPostventa(x.s, 'ayudas', p.id));
    });
    var seguimiento = pedidos.findLast(p => p.receivedAt && fichaPostventa(x.s, 'ayudas', p.id)?.estado === 'resuelta' &&
      !fichaPostventa(x.s, 'respuestas', p.id)?.seguimientoAt);
    return pendiente || seguimiento || (x.p?.receivedAt ? x.p : null);
  }
  function momento(x, pedidoId) { return x.c.orders?.[0]?.id === pedidoId ? 'primera' : 'recompra'; }
  function tarjetasCanales(conChecks, elegidos = []) {
    return '<div class="mp-canales">' + Object.entries(CANALES).map(([id, canal]) => {
      var etiqueta = '<span aria-hidden="true">' + ICONOS_CANALES[id] + '</span> ' + esc(canal);
      if (!conChecks) return '<button type="button" class="mp-btn mp-btn--sec" data-mp-postaccion="canal" data-canal="' + id + '">' + etiqueta + '</button>';
      return '<label><input type="checkbox" name="canales" value="' + id + '"' +
        (elegidos.includes(id) ? ' checked' : '') + '> ' + etiqueta + '</label>';
    }).join('') + '</div>';
  }
  function vistaCanal(x, id, abierta) {
    var info = st.formularios.recomendar || {};
    var negocio = x.c.company || 'tu negocio';
    var m = maquinaDe(x);
    var imagen = m.foto ? '<img class="mp-canal-foto" src="' + esc(m.foto) + '" width="160" height="120" loading="lazy" alt="' + esc(m.nombre) + '">' : '';
    var reseña = '<label class="mp-campo">Borrador de tu reseña<textarea rows="2" maxlength="600" placeholder="Cuenta tu experiencia con el servicio.">' +
      esc(abierta || '') + '</textarea></label>';
    var cuerpos = {
      google: '<div class="mp-canal-muestra"><b>Marley Coffee Empresas</b><small>Perfil de Empresa en Google</small><span aria-label="Escala de una a cinco estrellas">☆ ☆ ☆ ☆ ☆</span>' + reseña + '</div><p>Las reseñas aparecen en Google Maps y en la búsqueda local. Ayudan a que otros negocios encuentren la ficha y evalúen el servicio.</p>',
      whatsapp: '<div class="mp-canal-muestra"><b>Mensaje para WhatsApp</b><p>Hola, te comparto Marley Coffee Empresas por si estás buscando café para tu negocio.</p><div class="mp-canal-enlace"><b>Marley Coffee Empresas</b><small>' + esc(journey()?.referralUrl?.(x.c) || '') + '</small></div></div>',
      linkedin: '<div class="mp-canal-muestra"><b>' + esc(negocio) + ' · Publicación de LinkedIn</b><p>Así servimos café en nuestro negocio con Marley Coffee Empresas.</p>' + imagen + '</div>',
      instagram: '<div class="mp-canal-muestra"><b>' + esc(negocio) + ' · Historia de Instagram</b>' + imagen + '<span>@marleycoffee.chile</span></div>',
      referido: '<div class="mp-canal-muestra"><b>Correo para ' + esc(info.negocio || 'otro negocio') + '</b><p>De parte de ' + esc(negocio) + ': te comparto una guía para elegir máquina y atender el café de tu equipo o de tus clientes.</p><a class="mp-link" href="' + esc(buyerGuia(x.comp, 'guia-elegir-maquina.html')) + '">Ver la guía para elegir máquina</a></div>' +
        (st.tab === 'recomendar' ? '' : boton('mp-btn--sec', 'data-portal-tab="recomendar"', 'Abrir Recomendar'))
    };
    return '<div class="mp-canal-vista" data-canal-vista="' + id + '"><h3>Así se vería en ' + esc(id === 'referido' ? 'un correo' : CANALES[id]) +
      '</h3><p class="mp-fino">Vista previa simulada: no se publica ni se envía nada.</p>' + cuerpos[id] + '</div>';
  }
  function invitacion(x, p) {
    if (!p) return '';
    var r = fichaPostventa(x.s, 'respuestas', p.id);
    var ayuda = fichaPostventa(x.s, 'ayudas', p.id);
    var caras = Object.entries(CARITAS).map(([id, datos]) =>
      '<button type="button" class="mp-carita" data-mp-postaccion="cara" data-cara="' + id +
      '" data-pedido="' + esc(p.id) + '" aria-pressed="' + String(r?.carita === id) + '"><span aria-hidden="true">' +
      datos[0] + '</span>' + datos[1] + '</button>').join('');
    var resuelta = ayuda?.estado === 'resuelta' && !r?.seguimientoAt;
    var contenido = resuelta
      ? '<p>Tu solicitud quedó resuelta. Cuéntanos cómo te fue y deja tu reseña cuando quieras.</p>' +
        boton('mp-btn--sec', 'data-mp-postaccion="seguimiento" data-pedido="' + esc(p.id) + '"', 'Contar cómo me fue')
      : ayuda?.estado === 'resuelta' ? '<p role="status">Gracias por contarnos cómo te fue con Soporte.</p>'
      : ayuda ? '<p role="status">Tu solicitud está ' + (ayuda.estado === 'tomada' ? 'en manos de Soporte.' : 'en espera de Soporte.') + '</p>'
      : r?.nps != null ? '<p role="status">Gracias por contarnos cómo te fue.</p>'
      : '<div class="mp-caritas">' + caras + '</div>';
    return '<div class="mp-satisfaccion mp-bloque" data-mp-satisfaccion="' + esc(p.id) + '">' +
      '<h3>¿Cómo te fue con tu pedido?</h3>' + (p.id === x.p?.id ? '' : '<p class="mp-fino">Pedido ' + (x.c.orders.indexOf(p) + 1) + '</p>') + contenido +
      '<button type="button" class="mp-link" data-mp-postaccion="canal" data-canal="google" data-pedido="' + esc(p.id) +
      '">' + (r?.carita === 'no-contento' ? 'O deja tu reseña en Google' : 'Ver cómo dejar una reseña en Google') + '</button></div>';
  }
  function encuestaHTML(x) {
    var e = st.encuesta;
    if (!e) return '';
    var contenido;
    if (e.modo === 'preview') {
      contenido = vistaCanal(x, e.canal, fichaPostventa(x.s, 'respuestas', e.pedido)?.abierta);
    } else if (e.modo === 'ayuda') {
      contenido = '<h3>Te ayudamos ahora</h3><form class="mp-form" data-mp-form="incidencia">' +
        '<label class="mp-campo">¿Qué pasó?<select name="motivo" required><option value="">Elige un motivo</option>' +
        MOTIVOS.map(m => '<option' + (e.motivo === m ? ' selected' : '') + '>' + esc(m) + '</option>').join('') + '</select></label>' +
        '<label class="mp-campo">Cuéntanos qué pasó<textarea name="detalle" required maxlength="600">' + esc(e.detalle || '') + '</textarea></label>' +
        '<label class="mp-campo" data-mp-foto' + (e.motivo === MOTIVOS[0] ? '' : ' hidden') + '>Foto de la falla (opcional)<input type="file" accept="image/*" name="foto"><small>En esta prueba solo se registra el nombre de la foto.</small></label>' +
        '<label class="mp-campo">¿Cuándo te acomoda que te contactemos?<input type="text" name="horario" required maxlength="100" value="' +
        esc(e.horario || '') + '"></label><button class="mp-btn mp-btn--primario" type="submit">Pedir ayuda</button></form>' +
        boton('mp-link', 'data-mp-postaccion="canal" data-canal="google" data-pedido="' + esc(e.pedido) + '"', 'O deja tu reseña en Google');
    } else {
      contenido = '<h3>Cuéntanos cómo te fue</h3><form class="mp-form" data-mp-form="satisfaccion">' +
        '<fieldset class="mp-campo"><legend>¿Qué tan probable es que nos recomiendes?</legend><div class="mp-nps">' +
        Array.from({length:11}, (_, i) => '<label><input type="radio" name="nps" value="' + i + '" required' +
          (String(e.nps) === String(i) ? ' checked' : '') + '><span>' + i + '</span></label>').join('') +
        '</div><small>0 = nada probable · 10 = muy probable</small></fieldset>' +
        '<label class="mp-campo">¿Qué te gustó o qué mejorarías?<textarea name="abierta" maxlength="600">' + esc(e.abierta || '') + '</textarea></label>' +
        '<fieldset class="mp-campo"><legend>¿Por dónde nos recomendarías?</legend>' + tarjetasCanales(true, e.canales) + '</fieldset>' +
        '<div data-mp-vista-inline aria-live="polite">' + (e.canal ? vistaCanal(x, e.canal, e.abierta) : '') + '</div>' +
        '<button class="mp-btn mp-btn--primario" type="submit">Guardar respuesta</button></form>';
    }
    return '<dialog class="mp-encuesta" data-mp-encuesta aria-label="' + (e.modo === 'preview' ? 'Vista previa de recomendación' : 'Satisfacción con tu pedido') +
      '"><div class="mp-encuesta-interior">' + boton('mp-btn--sec mp-encuesta-cerrar', 'data-mp-postaccion="cerrar"', 'Cerrar') +
      contenido + '</div></dialog>';
  }

  /* ---------- estado de la cuenta ---------- */
  function contexto(s) {
    var c = (s && s.customerCycle) || {};
    var pedidos = c.orders || [];
    var p = pedidos.length ? pedidos[pedidos.length - 1] : null;
    var d = datos() || {};
    var precios = d.prices || {};
    var aceptada = Boolean(s && s.proposal && s.proposal.status === 'aceptada');
    var paso = 'sin-propuesta';
    if (p) {
      if (!p.waitPassed) { paso = 'preparacion'; }
      else if (!p.receivedAt) { paso = 'camino'; }
      else if (!p.replenishDue) { paso = 'recibido'; }
      else { paso = 'reponer'; }
    } else if (c.contractSignedAt) {
      paso = c.replenishmentNotice ? 'confirmar' : 'aviso';
    } else if (aceptada) {
      paso = 'firma';
    }
    var items = p ? soloItems(p.items) : soloItems(journey() && journey().baseItems ? journey().baseItems(s) : []);
    var subtotal = totalItems(items);
    var totalPropuesta = window.MC_TOTAL_PROPUESTA?.(s);
    var kit = precios.kit ? Number(precios.kit.precio) : 0;
    var filtro = precios.filter ? Number(precios.filter.precio) : 0;
    return {
      s: s,
      c: c,
      p: p,
      numero: pedidos.length,
      aceptada: aceptada,
      paso: paso,
      items: items,
      subtotal: subtotal,
      kit: kit,
      filtro: filtro,
      total: p ? (Number(p.total) || subtotal) : (totalPropuesta ?? ((subtotal + kit + filtro) || null)),
      comp: comprador(s),
      d: d
    };
  }
  function avance(x) {
    var c = x.c, p = x.p, s = x.s;
    var hecho = {
      confirmado: x.aceptada || Boolean(p),
      firmado: Boolean(c.contractSignedAt),
      preparacion: Boolean(c.replenishmentNotice || p),
      camino: Boolean(p && p.waitPassed),
      instalado: Boolean(p && p.receivedAt)
    };
    var fechas = {
      confirmado: p ? p.at : (s.proposal && s.proposal.acceptedAt),
      firmado: c.contractSignedAt,
      preparacion: p ? p.waitPassedAt : null,
      camino: p ? p.receivedAt : null,
      instalado: p ? p.receivedAt : null
    };
    var actual = ETAPAS[0].id;
    for (var i = 0; i < ETAPAS.length && hecho[ETAPAS[i].id]; i++) { actual = ETAPAS[i].id; }
    return { hecho: hecho, fechas: fechas, actual: actual };
  }
  function etapaPor(id) {
    for (var i = 0; i < ETAPAS.length; i++) { if (ETAPAS[i].id === id) { return ETAPAS[i]; } }
    return ETAPAS[0];
  }

  /* ---------- piezas de HTML ---------- */
  function boton(clase, atributos, texto) {
    return '<button type="button" class="mp-btn ' + clase + '" ' + atributos + '>' + esc(texto) + '</button>';
  }
  function cabecera(x) {
    var nombre = x.c.company || (x.s.lead && x.s.lead.company) || 'tu negocio';
    return '<header class="mp-cabecera">' +
      '<p class="mp-kicker">Mi portal · ' + esc(x.comp.etiqueta || 'Empresa') + '</p>' +
      '<h1 class="mp-titulo" data-vida="titulo">Hola, ' + esc(nombre) + '</h1>' +
      '<p class="mp-saludo">' + esc(x.comp.mensaje || 'Tu café para el día a día, con reposición antes de que se acabe.') + '</p>' +
      '<p class="mp-folio">Folio <b>' + esc(folioDe(x.s) || 'por asignar') + '</b></p>' +
      '<button type="button" class="mp-ayuda-movil" data-portal-tab="ayuda">¿Necesitas ayuda?</button>' +
      '</header>';
  }
  function pestanas(x) {
    return '<nav id="portal-tabs" class="mp-tabs" role="tablist" aria-label="Secciones de tu portal">' +
      TABS.map(function (t) {
        var activa = st.tab === t.id;
        return '<button type="button" role="tab" id="mp-tab-' + t.id + '" class="mp-tab' + (activa ? ' is-activa' : '') + '" data-portal-tab="' + t.id + '" aria-selected="' + (activa ? 'true' : 'false') + '" aria-controls="mp-panel-' + t.id + '">' + esc(t.t) + '</button>';
      }).join('') + '</nav>';
  }
  function avisosYErrores(tab) {
    var out = '';
    if (st.errores[tab]) { out += '<p class="mp-error" role="alert">' + esc(st.errores[tab]) + '</p>'; }
    if (st.aviso && st.aviso.tab === tab) { out += '<p class="mp-aviso-ok" role="status">' + esc(st.aviso.texto) + '</p>'; }
    return out;
  }
  function correoDe(x) {
    var s = x.s, lista = s.emails || [], m = null;
    if (x.p) { m = lista.filter(function (e) { return e.orderId === x.p.id; })[0] || null; }
    if (!m) { m = lista.filter(function (e) { return e.journeyCode === 'E08'; })[0] || null; }
    if (!m) { m = lista.filter(function (e) { return e.journeyCode === 'E06'; })[0] || null; }
    return m;
  }
  function avisoCorreo(x) {
    var m = correoDe(x);
    if (!m) { return ''; }
    return '<div class="mp-aviso" role="status">' +
      '<p><b>Correo simulado enviado</b> a ' + esc(m.to || 'tu correo de prueba') + '</p>' +
      '<p class="mp-fino">Es una prueba: no se envió ningún correo real.</p>' +
      '<button type="button" class="mp-link" data-portal-accion="ver-correo" data-mail-id="' + esc(m.id) + '" data-evt="ver_correo_simulado">Ver correo simulado</button>' +
      '</div>';
  }

  /* ---------- Mi pedido ---------- */
  function ctaPedido(x) {
    var evt = 'data-cta-principal="pedido-principal"';
    switch (x.paso) {
      case 'firma':
        return boton('mp-btn--primario', 'data-portal-accion="firmar-contrato" data-cierra-tarea="T4" ' + evt + ' data-evt="pedido_firmar_contrato"', 'Firmar contrato (simulación)');
      case 'aviso':
      case 'preparacion':
      case 'recibido':
      case 'confirmar':
      case 'camino':
        return boton('mp-btn--primario', 'data-portal-accion="avanzar-tiempo" ' + evt + ' data-evt="pedido_avance_tiempo"', 'Simular avance de tiempo');
      case 'reponer':
        return boton('mp-btn--primario', 'data-portal-accion="ir-repetir" ' + evt + ' data-evt="pedido_ir_repetir"', 'Repetir mi pedido');
      default:
        return boton('mp-btn--primario', 'data-portal-tab="ayuda" ' + evt + ' data-evt="pedido_hablar_persona"', 'Hablar con una persona');
    }
  }
  function franja(x, av) {
    var etapaVista = etapaPor(st.etapa || av.actual);
    var items = ETAPAS.map(function (e, i) {
      var hecha = av.hecho[e.id];
      var actual = e.id === av.actual;
      var texto = hecha
        ? (av.fechas[e.id] ? 'Hecho el ' + diaMes(av.fechas[e.id]) : 'Hecho')
        : (actual ? 'Fecha: ' + ESTIMADO : 'Pendiente');
      var clase = hecha ? ' is-hecha' : (actual ? ' is-actual' : '');
      var nombreEtapa = e.id === 'instalado' && x.numero > 1 ? 'Entregado' : e.t;
      return '<li class="mp-etapa' + clase + '">' +
        '<button type="button" class="mp-etapa-btn" data-etapa="' + e.id + '" aria-pressed="' + (etapaVista.id === e.id ? 'true' : 'false') + '"' + (actual ? ' aria-current="step"' : '') + '>' +
        '<span class="mp-etapa-n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="mp-etapa-txt"><b>' + esc(nombreEtapa) + '</b>' + (actual ? '<em>Ahora</em>' : '') + '<small>' + esc(texto) + '</small></span>' +
        '</button></li>';
    }).join('');
    /* La explicación aparece al tocar una etapa (en la carga solo se marca la etapa actual). */
    var detalle = st.etapa ? (etapaVista.id === 'instalado' && x.numero > 1
      ? '<b>Entregado.</b> Tu recompra llegó en la simulación.'
      : '<b>' + esc(etapaVista.t) + '.</b> ' + esc(etapaVista.d)) : '';
    return '<ol id="portal-franja" class="mp-franja" aria-label="Avance de tu pedido">' + items + '</ol>' +
      (av.hecho.instalado ? '' : '<p class="mp-fino">Fecha estimada de llegada por confirmar. Las etapas muestran el avance simulado.</p>') +
      '<p id="portal-franja-detalle" class="mp-franja-detalle" aria-live="polite">' + detalle + '</p>';
  }
  function resumenPedido(x) {
    var m = maquinaDe(x);
    var maquinaHTML = '<div class="mp-maquina">' +
      (m.foto ? '<img class="mp-maquina-foto" src="' + esc(m.foto) + '" alt="' + esc(m.nombre) + '" width="96" height="96" data-zoom data-zoom-grupo="pedido-maquina">' : '') +
      '<div class="mp-maquina-txt"><b>' + esc(m.nombre) + '</b>' +
      (m.tipo ? '<span>' + esc(m.tipo) + '</span>' : '') +
      '<small>' + esc([m.tazas, m.formato].filter(Boolean).join(' · ')) + '</small>' +
      (m.atencion ? '<small>' + esc(m.atencion) + '</small>' : '') +
      '</div></div>';
    var lista = x.items.map(function (it) {
      var l = linea(it.k) || {};
      return '<li class="mp-prod">' +
        (l.foto ? '<img class="mp-thumb" src="' + esc(l.foto) + '" alt="' + esc(l.t) + '" width="56" height="56" loading="lazy" data-zoom data-zoom-grupo="pedido-productos">' : '<span class="mp-thumb mp-thumb--vacia" aria-hidden="true"></span>') +
        '<span class="mp-prod-txt"><b>' + esc(l.t || it.k) + '</b><small>' + (it.qty > 1 ? it.qty + ' formatos · ' : '') + esc(l.d || 'Formato a confirmar') + '</small>' + (l.foto_nota ? '<small>Foto de referencia de 227 g</small>' : '') + '</span>' +
        '<span class="mp-prod-precio">' + fmt((l.precio || 0) * it.qty) + '</span>' +
        '</li>';
    }).join('');
    var total = x.total == null ? '' : '<div class="mp-total">' +
      '<p><span>' + (x.p ? 'Total del pedido' : 'Pack de partida') + '</span>' +
      '<b data-vida="cuenta" data-valor="' + Math.round(x.total) + '">' + fmt(x.total) + '</b></p>' +
      (x.p ? '' : '<small>Incluye kit de instalación (' + fmt(x.kit) + ') y filtro (' + fmt(x.filtro) + ').</small>') +
      '<small>+ IVA · referencial</small></div>';
    var productos = x.items.length ? '<ul class="mp-lista" aria-label="Productos">' + lista + '</ul>' : '<p class="mp-fino">Los productos se confirman con tu ejecutivo.</p>';
    if (x.p?.receivedAt) productos = '<details class="mp-productos-entregados"><summary>Ver los productos entregados</summary>' + productos + '</details>';
    return '<div class="mp-bloque" aria-labelledby="mp-h-pediste">' +
      '<h2 id="mp-h-pediste" class="mp-h3">Lo que pediste</h2>' +
      '<p class="mp-folio-linea">Folio <b>' + esc(folioDe(x.s) || 'por asignar') + '</b> · ' + (x.p ? 'Pedido ' + x.numero : 'Pack de partida, por confirmar') + '</p>' +
      maquinaHTML +
      productos +
      (x.p?.receivedAt ? '' : '<p class="mp-fino mp-modalidad">Modalidad: comodato. La máquina queda en préstamo mientras compras café.</p>') +
      total +
      '</div>';
  }
  function explicacionesPedido(x) {
    var a = x.s.answers || {};
    var b = a.negocio || x.c.business || 'negocio';
    var especial = { OCS: 'oficina', Oficinas: 'oficina', Conveniencia: 'tienda de conveniencia', 'Eventos o catering': 'negocio de eventos o catering' };
    var nombre = especial[b] || b.toLowerCase();
    var m = maquinaDe(x);
    var directo = x.s.catalogJourney?.machineSource === 'cliente';
    var respuestas = [['Tazas que indicaste', a.volumen], ['Forma de servir', a.operacion], ['Preferencias', a.preferencias]]
      .filter(([, v]) => v?.length).map(([k, v]) => '<li><b>' + esc(k) + ':</b> ' + esc(Array.isArray(v) ? v.join(', ') : v) + '</li>').join('');
    return '<div class="mp-explicaciones"><details><summary>Ver por qué elegimos esta solución para tu ' + esc(nombre) + '</summary>' +
      '<p>' + esc(directo ? 'Elegiste la máquina ' + m.nombre + ' directamente.' : 'La máquina ' + m.nombre + ' se seleccionó según tu tipo de negocio y la forma de servir café.') + '</p>' +
      '<ul>' + (directo ? '' : respuestas) + '<li><b>Capacidad:</b> ' + esc(m.tazas || 'A confirmar con el equipo') +
      '</li><li><b>Atención:</b> ' + esc(m.atencion || 'A confirmar con el equipo') + '</li></ul></details>' +
      '<details><summary>Ver qué incluye el comodato</summary><p>La máquina queda en préstamo mientras compras café.</p>' +
      '<p>La carga base incluye café e insumos, kit de instalación y filtro. La referencia corresponde a negocios de flujo bajo o medio. Se paga antes de instalar y no corresponde a una mensualidad.</p>' +
      '<p>El equipo confirma modelo, mínimo mensual y plazo.</p></details></div>';
  }
  function panelPedido(x) {
    var P = PASOS[x.paso] || PASOS['sin-propuesta'];
    var av = avance(x);
    var cta = '<div class="mp-accion">' + ctaPedido(x) + '</div>';
    var correo = avisoCorreo(x);
    var tecnico = '<details class="mp-tecnico"><summary>Ver datos del pedido y días simulados</summary><ul class="mp-tecnico-lista">' +
      '<li>Cuenta de prueba: ' + esc(x.c.accountId || '—') + '</li>' +
      '<li>Contrato simulado: ' + esc(x.c.contractId || 'sin firmar') + '</li>' +
      '<li>Días simulados: ' + esc(String(x.c.simulatedDays || 0)) + '</li>' +
      (x.p ? '<li>Registro del pedido: ' + esc(x.p.id) + '</li>' : '') +
      '</ul>' + (x.c.contractSignedAt && !av.hecho.instalado
        ? boton('mp-btn--sec', 'data-portal-accion="avanzar-tiempo" data-dias="30" data-evt="pedido_avance_mes"', 'Simular que pasó un mes')
        : '') + '</details>';
    return '<section id="mp-panel-pedido" class="mp-panel' + (av.hecho.instalado ? ' mp-pedido-entregado' : '') + '" role="tabpanel" aria-labelledby="mp-tab-pedido" data-portal-panel="pedido">' +
      '<header class="mp-cabeza-panel">' +
      '<h2 class="mp-h2" data-vida="titulo">' + esc(P.titulo) + '</h2>' +
      '<p class="mp-lead">' + P.lead + '</p></header>' +
      avisosYErrores('pedido') +
      invitacion(x, pedidoParaEncuesta(x)) +
      cta +
      (x.aceptada || x.p ? explicacionesPedido(x) : '') +
      resumenPedido(x) +
      '<div class="mp-bloque" aria-labelledby="mp-h-avance"><h2 id="mp-h-avance" class="mp-h3">Cómo va tu pedido</h2>' +
      franja(x, av) +
      '<details class="mp-rapidas-pedido" data-rapidas' + (st.textoRapida && st.rapida === 'donde' ? ' open' : '') + '><summary>Ver qué puedes preguntar sobre tu pedido</summary><div class="mp-chips">' + chipsRapidas('pedido') + '</div>' +
      (st.textoRapida && st.rapida === 'donde' ? '<p id="portal-rapida-respuesta" class="mp-respuesta" role="status">' + esc(st.textoRapida) + '</p>' : '') + '</details>' +
      '</div>' +
      (correo && av.hecho.instalado ? '<details class="mp-correo-pedido"><summary>Ver aviso de correo de tu pedido</summary>' + correo + '</details>' : correo) +
      '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre">' + cta + '</div>' +
      tecnico +
      '</section>';
  }

  /* ---------- Repetir pedido ---------- */
  function baseRepetir(x) {
    if (!x.p) { return {}; }
    if (!st.cantidades || st.cantidades.id !== x.p.id) {
      var q = {};
      (x.p.items || []).forEach(function (it) { if (it && it.k) { q[it.k] = Number(it.qty) || 0; } });
      st.cantidades = { id: x.p.id, q: q };
    }
    return st.cantidades.q;
  }
  function agregadas(x) {
    return ((x.c.orderComplementChoices) || []).filter(function (ch) { return ch.status === 'added'; });
  }
  function sugerencias(x, base) {
    var maximo = window.matchMedia && window.matchMedia('(min-width: 768px)').matches ? 3 : 2;
    var recs = [];
    try { recs = (window.R7P && window.R7P.recomendaciones && window.R7P.recomendaciones(x.s)) || []; } catch (_) { recs = []; }
    var candidatos = [];
    recs.forEach(function (r) {
      if (r && r.productoId && candidatos.indexOf(r.productoId) < 0) { candidatos.push(r.productoId); }
    });
    var clave = (x.comp.lineas_clave || []);
    clave.forEach(function (k) { if (candidatos.indexOf(k) < 0) { candidatos.push(k); } });
    lineas().forEach(function (l) { if (candidatos.indexOf(l.k) < 0 && candidatos.indexOf(l.catalogId) < 0) { candidatos.push(l.k); } });
    var out = [];
    candidatos.forEach(function (id) {
      if (out.length >= maximo) { return; }
      var l = linea(id);
      if (!l || base[l.k] !== undefined) { return; }
      if (out.some(function (o) { return o.l.k === l.k; })) { return; }
      var r = recs.filter(function (rec) { return rec && rec.productoId === id; })[0];
      var porQue = r && r.porQue ? r.porQue
        : clave.indexOf(l.k) >= 0 ? 'Está entre los productos clave para tu tipo de negocio.'
        : 'Complementa tu pedido. Uso y compatibilidad a confirmar con tu ejecutivo.';
      out.push({ l: l, pid: l.catalogId || l.k, porQue: porQue });
    });
    return out;
  }
  function totalRepetir(x, base) {
    var suma = 0;
    Object.keys(base).forEach(function (k) {
      var l = linea(k);
      if (l) { suma += Number(l.precio) * (Number(base[k]) || 0); }
    });
    agregadas(x).forEach(function (ch) {
      var l = linea(ch.productId);
      if (l && !(Number(base[l.k]) > 0)) { suma += Number(l.precio); }
    });
    return suma;
  }
  function filaRepetir(k, qty) {
    var l = linea(k) || { t: k, d: '', precio: 0, foto: '' };
    return '<div class="mp-linea">' +
      (l.foto ? '<img class="mp-thumb" src="' + esc(l.foto) + '" alt="' + esc(l.t) + '" width="56" height="56" loading="lazy" data-zoom data-zoom-grupo="repetir-productos">' : '') +
      '<div class="mp-linea-txt"><b>' + esc(l.t) + '</b><small>' + esc(l.d || 'Formato a confirmar') + '</small><small>' + fmt(l.precio) + ' + IVA · referencial</small></div>' +
      '<label class="mp-cant"><span>Cantidad de ' + esc(l.t) + '</span><input type="number" name="q-' + esc(k) + '" min="0" max="20" step="1" inputmode="numeric" value="' + esc(qty) + '"></label>' +
      '</div>';
  }
  function panelRepetir(x) {
    var p = x.p;
    var cab = '<header class="mp-cabeza-panel">' +
      '<h2 class="mp-h2" data-vida="titulo">¿Quieres repetir tu pedido?</h2>';
    if (!p || !p.receivedAt || !p.replenishDue) {
      var texto = !p ? 'Cuando tengas un pedido confirmado, podrás repetirlo desde aquí.'
        : !p.receivedAt ? 'Confirma que llegó tu pedido para repetirlo desde aquí.'
        : 'Podrás volver a pedir cuando avance el tiempo de la simulación.';
      return '<section id="mp-panel-repetir" class="mp-panel" role="tabpanel" aria-labelledby="mp-tab-repetir" data-portal-panel="repetir">' +
        cab + '<p class="mp-lead">' + esc(texto) + '</p></header>' +
        avisosYErrores('repetir') +
        '<div class="mp-accion"><button type="button" class="mp-btn mp-btn--primario" data-portal-tab="pedido" data-cta-principal="repetir-ver-pedido" data-evt="repetir_ver_pedido">Ver mi pedido</button></div>' +
        recordatorio(x) +
        '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre"><button type="button" class="mp-btn mp-btn--primario" data-portal-tab="pedido" data-cta-principal="repetir-ver-pedido" data-evt="repetir_ver_pedido">Ver mi pedido</button></div>' +
        '</section>';
    }
    var base = baseRepetir(x);
    var filas = Object.keys(base).map(function (k) { return filaRepetir(k, base[k]); }).join('');
    var sug = sugerencias(x, base);
    var elegidas = agregadas(x).map(function (ch) { return ch.productId; });
    var sugHTML = sug.length ? '<div class="mp-bloque mp-sugerencias" role="group" aria-labelledby="mp-h-sug"><h3 id="mp-h-sug" class="mp-h3">Te puede servir</h3>' +
      '<p class="mp-fino">Puedes agregarlas o dejarlas. Solo se suman si las aceptas.</p><ul class="mp-sug-lista">' +
      sug.map(function (sg) {
        var agregada = elegidas.indexOf(sg.pid) >= 0;
        var descartada = (x.c.orderComplementChoices || []).some(function (ch) { return ch.productId === sg.pid && ch.status === 'dismissed'; });
        var estadoTxt = agregada ? 'Agregado a tu repetición.' : (descartada ? 'Dejado para después.' : '');
        return '<li class="mp-sug">' +
          (sg.l.foto ? '<img class="mp-thumb" src="' + esc(sg.l.foto) + '" alt="' + esc(sg.l.t) + '" width="56" height="56" loading="lazy" data-zoom data-zoom-grupo="repetir-sugeridos">' : '') +
          '<div class="mp-sug-txt"><b>' + esc(sg.l.t) + '</b><small>' + esc(sg.porQue) + '</small><small>' + fmt(sg.l.precio) + ' por línea</small>' + (estadoTxt ? '<small role="status">' + esc(estadoTxt) + '</small>' : '') + '</div>' +
          '<div class="mp-sug-acc">' +
          '<button type="button" class="mp-btn mp-btn--sec" data-portal-sugerencia="' + esc(sg.pid) + '" data-portal-decision="agregar" aria-pressed="' + (agregada ? 'true' : 'false') + '" data-evt="repetir_sugerencia_agregar">Agregar</button>' +
          '<button type="button" class="mp-btn mp-btn--sec" data-portal-sugerencia="' + esc(sg.pid) + '" data-portal-decision="no" aria-pressed="' + (descartada ? 'true' : 'false') + '" data-evt="repetir_sugerencia_no">No, gracias</button>' +
          '</div></li>';
      }).join('') + '</ul></div>' : '';
    var total = totalRepetir(x, base);
    var ctaRep = '<div class="mp-accion"><button type="submit" form="mp-form-repetir" class="mp-btn mp-btn--primario" data-cta-principal="repetir-confirmar" data-cierra-tarea="T5" data-evt="repetir_confirmar">Confirmar repetición</button></div>';
    return '<section id="mp-panel-repetir" class="mp-panel" role="tabpanel" aria-labelledby="mp-tab-repetir" data-portal-panel="repetir">' +
      cab + '<p class="mp-lead">Cambia las cantidades si quieres. Con 0 quitas un producto.</p></header>' +
      avisosYErrores('repetir') +
      ctaRep +
      '<form id="mp-form-repetir" class="mp-form" data-mp-form="repetir" aria-label="Cantidades de tu repetición">' +
      '<div class="mp-bloque"><h3 class="mp-h3">Tus productos</h3>' + (filas ? '<div class="mp-lineas">' + filas + '</div>' : '<p class="mp-fino">Agrega al menos un producto para repetir tu pedido.</p>') + '</div>' +
      '</form>' +
      sugHTML +
      '<div class="mp-total mp-total--repetir"><p><span>Total neto (más IVA)</span><b data-mp-total-repetir>' + fmt(total) + '</b></p><small>+ IVA · referencial</small></div>' +
      recordatorio(x) +
      '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre">' + ctaRep + '</div>' +
      '</section>';
  }
  function recordatorio(x) {
    var activo = Boolean(x.c.portalRecordatorioAt);
    return '<section class="mp-tarjeta" aria-labelledby="mp-h-recordatorio"><h3 id="mp-h-recordatorio" class="mp-h3">Recordatorio del próximo pedido</h3>' +
      '<p class="mp-fino">Te avisamos antes de que se acabe el café. Simulación: no se envía ningún correo real.</p>' +
      (activo ? '<p class="mp-aviso-ok" role="status">Recordatorio activado (simulación).</p>' :
        '<button type="button" class="mp-btn mp-btn--sec" data-portal-accion="recordatorio" data-lead-magnet="recordatorio-pedido" data-evt="repetir_recordatorio">Activa el recordatorio de tu próximo pedido</button>') +
      '</section>';
  }

  /* ---------- Ayuda y postventa ---------- */
  function respuestaRapida(x, id) {
    var av = avance(x), etapa = etapaPor(av.actual);
    var nombres = x.items.map(function (it) { var l = linea(it.k); return l ? l.t : it.k; }).join(', ');
    var m = maquinaDe(x);
    switch (id) {
      case 'donde': return 'Ahora tu pedido está en la etapa «' + etapa.t + '». ' + etapa.d + ' Las fechas se confirman con tu ejecutivo.';
      case 'incluye': return 'Incluye la máquina ' + m.nombre + (nombres ? ' y estos productos: ' + nombres : '') + '. Los precios son netos referenciales; los confirma tu ejecutivo.';
      case 'firmo': return 'En Mi pedido toca «Firmar contrato (simulación)», revisa el resumen y confirma. Es una simulación: no crea un contrato legal ni un cobro.';
      case 'repito': return 'Cuando toque reponer, abre «Repetir pedido», ajusta las cantidades y confirma. Te sugerimos productos que puedes agregar o dejar.';
      case 'horario': return 'Escríbelo en el chat de abajo. El agente anota el horario que prefieres para que tu ejecutivo lo confirme.';
      case 'falla': return 'Cuéntanos qué pasa con la máquina. Te paso con una persona de Soporte y, mientras llega, el agente sigue contigo.';
      default: return '';
    }
  }
  /* Chips de preguntas rápidas: al tocarlos, el chat del agente responde (marley:portal-pregunta). */
  function chipsRapidas(donde) {
    var lista = donde === 'pedido' ? RAPIDAS.filter(function (r) { return r.id === 'donde'; }) : RAPIDAS;
    return lista.map(function (r) {
      var activa = st.rapida === r.id;
      return '<button type="button" class="mp-chip' + (activa ? ' is-activa' : '') + '" data-portal-rapida="' + r.id + '" aria-pressed="' + (activa ? 'true' : 'false') + '" data-evt="' + donde + '_rapida_' + r.id + '">' + esc(r.q) + '</button>';
    }).join('');
  }
  function panelAyuda(x) {
    var f = st.formularios.ayuda || {};
    var caso = x.c.supportCase;
    var mensajes = (x.c.supportMensajes || []).length;
    var solicitud = fichaPostventa(x.s, 'ayudas', x.p?.id);
    var respuestaEquipo = x.s.crm2?.postventaGestion?.ayudas?.[x.c.accountId] || x.s.crm2?.postventaGestion?.ayudas?.[x.s.lead?.id];
    var rapidas = chipsRapidas('ayuda');
    var respuesta = st.textoRapida || '';
    var estadoCaso = caso ? '<div class="mp-tarjeta" role="status"><p class="mp-kicker">Tu caso</p><p><b>Caso abierto · ' + esc(caso.type) + '</b></p><p class="mp-fino">Estado: recibido. Una persona de Soporte te contactará; el estado se actualiza aquí.' + (mensajes ? ' Mensajes enviados: ' + mensajes + '.' : '') + '</p></div>' : '';
    var guia = buyerGuia(x.comp, 'guia-cuidado-maquina.html');
    return '<section id="mp-panel-ayuda" class="mp-panel" role="tabpanel" aria-labelledby="mp-tab-ayuda" data-portal-panel="ayuda">' +
      '<header class="mp-cabeza-panel">' +
      '<h2 class="mp-h2" data-vida="titulo">¿En qué te ayudamos?</h2>' +
      '<p class="mp-lead">Cuéntanos qué pasa. Si es urgente, pide hablar con una persona de Soporte.</p></header>' +
      avisosYErrores('ayuda') +
      '<div class="mp-accion"><button type="submit" form="mp-form-ayuda" class="mp-btn mp-btn--primario" data-cta-principal="ayuda-enviar" data-cierra-tarea="T6" data-evt="ayuda_enviar">Enviar</button></div>' +
      '<form id="mp-form-ayuda" class="mp-form mp-bloque" data-mp-form="ayuda" aria-label="Pedir ayuda">' +
      '<label class="mp-campo"><span>¿Qué tipo de ayuda necesitas?</span><select name="type" required>' +
      '<option value="">Elige una opción</option>' +
      MOTIVOS.map(function (m) { return '<option value="' + esc(m) + '"' + (f.type === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="mp-campo"><span>Cuéntanos qué pasa</span><textarea name="detail" rows="3" minlength="3" maxlength="600" required>' + esc(f.detail || '') + '</textarea></label>' +
      '</form>' +
      estadoCaso +
      (respuestaEquipo?.respuesta ? '<section class="mp-tarjeta"><h3>Respuesta de postventa</h3><p>' + esc(respuestaEquipo.respuesta) + '</p></section>' : '') +
      (solicitud ? '<details class="mp-tarjeta"><summary>Ver mi solicitud de postventa</summary><p>' + esc(solicitud.resumen) + '</p></details>' : '') +
      '<details class="mp-bloque mp-consultas" data-rapidas' + (respuesta ? ' open' : '') + '><summary>Ver preguntas rápidas para el asistente</summary><div class="mp-chips">' + rapidas + '</div>' +
      (respuesta ? '<p id="portal-rapida-respuesta" class="mp-respuesta" role="status">' + esc(respuesta) + '</p>' : '') + '</details>' +
      (formatoEscritorio.matches ? '' : agenteHTML(x)) +
      // DS5: la guía es contenido secundario de la pestaña; se pliega para no pasar el alto máximo en celular.
      '<details class="mp-tarjeta mp-guia"><summary class="mp-guia-resumen"><span class="mp-guia-t">Ver la guía de cuidado de tu máquina</span></summary>' +
      '<div class="mp-guia-cuerpo"><p class="mp-fino">Qué revisar, cómo pedir ayuda y los datos de tu máquina.</p>' +
      '<a class="mp-btn mp-btn--sec" href="' + esc(guia) + '" data-lead-magnet="guia-cuidado" data-evt="ayuda_guia_cuidado">Abrir la guía de cuidado</a></div></details>' +
      '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre"><button type="submit" form="mp-form-ayuda" class="mp-btn mp-btn--primario" data-cta-principal="ayuda-enviar" data-cierra-tarea="T6" data-evt="ayuda_enviar">Enviar</button></div>' +
      '</section>';
  }
  function buyerGuia(comp, archivo) {
    var id = comp && comp.id ? comp.id : '';
    return 'recursos/portal/' + archivo + (id ? '?tipo=' + encodeURIComponent(id) : '');
  }

  /* ---------- Recomendar ---------- */
  function panelRecomendar(x) {
    var c = x.c;
    var enviada = Boolean(c.referralSentAt && c.referralBusiness);
    var f = st.formularios.recomendar || {};
    var cab = '<header class="mp-cabeza-panel">' +
      '<h2 class="mp-h2" data-vida="titulo">Recomienda Marley a otro negocio</h2>';
    var guia = buyerGuia(x.comp, 'guia-elegir-maquina.html');
    var avisoGuia = st.guia ? '<div class="mp-aviso" role="status"><p><b>Guía enviada (simulación) a ' + esc(st.guia.persona) + '</b></p>' +
      '<p>Le llega de parte de ' + esc(c.company || 'tu negocio') + '. No se envió ningún correo real.</p>' +
      '<a class="mp-link" href="' + esc(guia) + '" data-evt="recomendar_ver_guia">Ver la guía que recibe</a></div>' : '';
    var canales = '<details class="mp-tarjeta mp-canales-detalle"' + (st.vistaCanal ? ' open' : '') + '><summary>Ver cómo recomendar por cada canal</summary>' +
      tarjetasCanales(false) + '<div data-mp-vista-inline aria-live="polite">' +
      (st.vistaCanal ? vistaCanal(x, st.vistaCanal) : '') + '</div></details>';
    if (enviada) {
      return '<section id="mp-panel-recomendar" class="mp-panel" role="tabpanel" aria-labelledby="mp-tab-recomendar" data-portal-panel="recomendar">' +
        cab + '<p class="mp-lead">Gracias por recomendarnos.</p></header>' +
        avisosYErrores('recomendar') +
        '<div class="mp-aviso" role="status"><p><b>Recomendación enviada a ' + esc(c.referralBusiness) + '.</b></p>' +
        '<p>Jefatura la revisa antes de contactar a esa persona.</p></div>' +
        '<div class="mp-accion"><button type="button" class="mp-btn mp-btn--primario" data-portal-tab="pedido" data-cta-principal="recomendar-ver-pedido" data-evt="recomendar_ver_pedido">Ver mi pedido</button></div>' +
        canales +
        '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre"><button type="button" class="mp-btn mp-btn--primario" data-portal-tab="pedido" data-cta-principal="recomendar-ver-pedido" data-evt="recomendar_ver_pedido">Ver mi pedido</button></div>' +
        '</section>';
    }
    var ctaEnviar = '<button type="submit" form="mp-form-recomendar" name="accion" value="enviar" class="mp-btn mp-btn--primario" data-cta-principal="recomendar-enviar" data-cierra-tarea="T6" data-evt="recomendar_enviar">Enviar recomendación</button>';
    return '<section id="mp-panel-recomendar" class="mp-panel" role="tabpanel" aria-labelledby="mp-tab-recomendar" data-portal-panel="recomendar">' +
      cab + '<p class="mp-lead">Escribe los datos de la persona de otro negocio. Jefatura revisa cada recomendación antes de contactarla.</p></header>' +
      avisosYErrores('recomendar') +
      '<div class="mp-accion">' + ctaEnviar + '</div>' +
      '<form id="mp-form-recomendar" class="mp-form mp-bloque" data-mp-form="recomendar" aria-label="Datos de la recomendación">' +
      '<label class="mp-campo"><span>Nombre del negocio</span><input type="text" name="negocio" required minlength="2" maxlength="100" value="' + esc(f.negocio || '') + '"></label>' +
      '<label class="mp-campo"><span>Nombre de la persona de contacto</span><input type="text" name="persona" required minlength="2" maxlength="80" value="' + esc(f.persona || '') + '"></label>' +
      '<label class="mp-campo"><span>Correo o teléfono de contacto</span><input type="text" name="contacto" required minlength="5" maxlength="120" value="' + esc(f.contacto || '') + '"></label>' +
      '<fieldset class="mp-campo mp-radios"><legend>¿Esta persona aceptó que la contactemos?</legend>' +
      '<label><input type="radio" name="permiso" value="si" required' + (f.permiso === 'si' ? ' checked' : '') + '> Sí, aceptó que la contactemos</label>' +
      '<label><input type="radio" name="permiso" value="no"' + (f.permiso === 'no' ? ' checked' : '') + '> Todavía no</label>' +
      '</fieldset>' +
      '</form>' +
      canales +
      '<section class="mp-tarjeta mp-guia" aria-labelledby="mp-h-guia-elegir"><p class="mp-kicker">Guía</p><h3 id="mp-h-guia-elegir" class="mp-h3">Compártele la guía para elegir máquina</h3>' +
      '<p class="mp-fino">Muestra las cuatro máquinas y cómo elegir la tuya. Solo se envía si esa persona aceptó que la contactemos.</p>' +
      '<button type="submit" form="mp-form-recomendar" name="accion" value="guia" class="mp-btn mp-btn--sec" data-lead-magnet="guia-elegir-maquina" data-evt="recomendar_compartir_guia">Compártele la guía para elegir máquina</button>' +
      avisoGuia + '</section>' +
      '<div class="mp-espaciador" aria-hidden="true"></div><div class="mp-cierre">' + ctaEnviar + '</div>' +
      '</section>';
  }

  /* ---------- Agente y pie ---------- */
  /* El agente está en todas las pestañas: en escritorio, a un costado y siempre abierto; en celular, plegado
     (una toque lo abre) salvo en «Ayuda y postventa», donde se abre solo. */
  function agenteHTML(x) {
    var escritorio = Boolean(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);
    var abierto = escritorio || (st.agenteAbierto === null ? st.tab === 'ayuda' : st.agenteAbierto);
    st.agenteRender = abierto;
    return '<details class="mp-agente" id="mp-agente" data-mp-agente' + (abierto ? ' open' : '') + '>' +
      '<summary class="mp-agente-resumen">Habla con el agente de Marley</summary>' +
      '<div class="mp-agente-cuerpo" aria-labelledby="mp-h-agente">' +
      '<p class="mp-kicker">Agente de Marley</p>' +
      '<h2 id="mp-h-agente" class="mp-h3">Pregunta lo que necesites</h2>' +
      '<p class="mp-fino">Resuelve lo simple: dónde viene tu pedido, qué incluye, cómo firmas o repites. Si hace falta, te pasa con una persona de Soporte.</p>' +
      '<div id="agente-portal" class="mp-agente-marco"><p class="mp-agente-espera">Conversación con el agente de Marley.</p></div>' +
      '</div></details>';
  }
  function dialogoHTML(x) {
    if (!st.dialogo) { return ''; }
    var lista = x.items.map(function (it) {
      var l = linea(it.k) || {};
      return '<li>' + esc(l.t || it.k) + ' · ' + it.qty + ' × ' + fmt(l.precio) + '</li>';
    }).join('');
    var m = maquinaDe(x);
    return '<div class="mp-fondo" data-mp-fondo>' +
      '<div class="mp-dialogo" role="dialog" aria-modal="true" aria-labelledby="mp-dialogo-t" tabindex="-1" data-mp-dialogo>' +
      '<p class="mp-kicker">Contrato (simulación)</p>' +
      '<h2 id="mp-dialogo-t" class="mp-h3">Resumen del contrato</h2>' +
      '<p><b>Comodato:</b> ' + esc((x.d.offer && x.d.offer.modalidad_maquina) || 'Marley presta la máquina y tú compras los insumos.') + '</p>' +
      '<p class="mp-fino">Condiciones comerciales, disponibilidad y formalización a confirmar con el equipo.</p>' +
      '<ul class="mp-dialogo-lista"><li><b>Máquina:</b> ' + esc(m.nombre) + '</li>' + lista + '<li><b>Total neto, más IVA:</b> ' + fmt(x.total) + '</li></ul>' +
      '<div class="mp-acciones">' +
      '<button type="button" class="mp-btn mp-btn--primario" data-portal-accion="confirmar-firma" data-evt="pedido_firmar_confirmar">Firmar contrato (simulación)</button>' +
      '<button type="button" class="mp-btn mp-btn--sec" data-mp-cerrar data-evt="pedido_contrato_cerrar">Cerrar</button>' +
      '</div>' +
      '<p class="mp-fino">La firma registra un evento de prueba. No crea un contrato legal ni un cobro.</p>' +
      '</div></div>';
  }
  function nota() {
    return '<p class="mp-nota">Prototipo de prueba: firmas, correos y envíos son simulados. Precios netos referenciales; los confirma tu ejecutivo.</p>';
  }

  /* ---------- render ---------- */
  function paneles(x) {
    if (st.tab === 'repetir') { return panelRepetir(x); }
    if (st.tab === 'ayuda') { return panelAyuda(x); }
    if (st.tab === 'recomendar') { return panelRecomendar(x); }
    return panelPedido(x);
  }
  function renderLocal() {
    /* Solo se pinta en el contenedor vigente: si la app ya lo reemplazó, el gancho de C09 monta el nuevo. */
    if (st.host && st.host.isConnected) { render(st.host); }
  }
  formatoEscritorio.addEventListener('change', renderLocal);
  function refresh() {
    if (window.MarleyApp && typeof window.MarleyApp.render === 'function') {
      try { window.MarleyApp.render(); } catch (_) { /* el render de la app es opcional aquí */ }
    }
    renderLocal();
  }
  /* Cualquier cambio del estado (firma, avance de tiempo, pedido, correo) vuelve a pintar el portal en ese mismo
     momento, aunque la app conserve el mismo contenedor. Si llega un cambio mientras se pinta, se repinta al terminar. */
  var pintando = false, pendiente = false;
  function alCambiarEstado() {
    if (st.host && st.host.isConnected) { render(st.host); }
  }
  function engancharEstado() {
    if (st.enganchado || !window.M4 || !window.M4.subscribe) { return; }
    st.enganchado = true;
    window.M4.subscribe(alCambiarEstado);
  }
  function render(host) {
    if (!host) { return; }
    if (pintando) { pendiente = true; return; }
    pintando = true;
    try { pintarPortal(host); } finally { pintando = false; }
    if (pendiente) { pendiente = false; render(host); }
  }
  function pintarPortal(host) {
    st.host = host;
    engancharEstado();
    if (!host.__mpBound) {
      host.addEventListener('click', onClick);
      host.addEventListener('submit', onSubmit);
      host.addEventListener('input', onInput);
      host.addEventListener('change', onInput);
      host.addEventListener('keydown', onKey);
      host.addEventListener('toggle', onToggle, true);
      host.addEventListener('cancel', ev => { if (ev.target.matches('[data-mp-encuesta]')) { ev.preventDefault(); volverEncuesta(); } }, true);
      host.__mpBound = true;
    }
    var s = estado();
    var d = datos();
    if (!s || !d || !d.prices) {
      host.innerHTML = '<section class="mp-portal" data-mp-portal><p class="mp-fino">Tu portal se está preparando.</p></section>';
      return;
    }
    var x = contexto(s);
    if (st.cuenta !== x.c.accountId) {
      st.cuenta = x.c.accountId;
      st.encuesta = null;
      st.vistaCanal = null;
    }
    if (st.dialogo && (x.c.contractSignedAt || !x.aceptada)) { st.dialogo = false; }
    var desplazamiento = host.querySelector('#portal-tabs')?.scrollLeft || 0;
    host.innerHTML = '<div class="mp-portal" data-mp-portal data-vista="' + esc(st.tab) + '" data-comprador="' + esc(x.comp.id || '') + '">' +
      toastHTML() +
      cabecera(x) +
      pestanas(x) +
      '<div class="mp-cuerpo">' +
      '<div class="mp-principal">' + paneles(x) + '</div>' +
      (st.tab === 'ayuda' && !formatoEscritorio.matches ? '' : agenteHTML(x)) +
      '</div>' +
      nota() +
      dialogoHTML(x) +
      encuestaHTML(x) +
      '</div>';
    var encuesta = host.querySelector('[data-mp-encuesta]');
    if (encuesta && !encuesta.open) encuesta.showModal();
    var tabs = host.querySelector('#portal-tabs');
    var tabActiva = tabs.querySelector('[aria-selected="true"]');
    if (tabActiva) {
      tabs.scrollLeft = desplazamiento;
      var ventana = tabs.getBoundingClientRect();
      var botonActivo = tabActiva.getBoundingClientRect();
      if (botonActivo.left < ventana.left + 4) tabs.scrollLeft += botonActivo.left - ventana.left - 4;
      if (botonActivo.right > ventana.right - 16) tabs.scrollLeft += botonActivo.right - ventana.right + 16;
    }
    var foco = st.foco;
    st.foco = null;
    if (st.dialogo) {
      var dlg = host.querySelector('[data-mp-dialogo]');
      if (dlg) { dlg.focus(); }
    } else if (foco) {
      var el = host.querySelector(foco);
      if (el && el.focus) { el.focus({ preventScroll: true }); }
    }
  }

  /* ---------- eventos ---------- */
  function setTab(id) {
    if (!TABS.some(function (t) { return t.id === id; })) { return; }
    st.tab = id;
    st.errores = {};
    st.dialogo = false;
    st.encuesta = null;
    st.textoRapida = null;
    if (st.aviso && st.aviso.tab !== id) { st.aviso = null; }
    st.foco = '#mp-tab-' + id;
    renderLocal();
    if (window.frameElement?.classList.contains('ag-journey-frame')) {
      dispatchEvent(new CustomEvent('marley:portal-tab', { detail: id }));
    }
  }
  function avanzarTiempo(dias) {
    var J = journey();
    var x = contexto(estado());
    var p = x.p;
    if (!J) { return; }
    if (!J.jumpDays(dias === '30' || p?.receivedAt ? 30 : 3)) return;
    st.etapa = null;
    refresh();
    var encuesta = st.host?.querySelector('[data-mp-satisfaccion]');
    encuesta?.scrollIntoView({ block: 'nearest' });
  }
  function confirmarRecepcion() {
    var J = journey();
    var p = contexto(estado()).p;
    if (!J || !p) { return; }
    J.advanceOrderWait(p.id);
    J.confirmOrderReceived(p.id);
    refresh();
  }
  function decidirSugerencia(pid, decision) {
    var J = journey();
    var x = contexto(estado());
    if (!J || !x.p) { return; }
    J.chooseOrderComplement(pid, decision === 'agregar' ? 'added' : 'dismissed', x.p.id);
    st.foco = '[data-portal-sugerencia="' + pid + '"][data-portal-decision="' + decision + '"]';
    refresh();
  }
  function activarRecordatorio() {
    mutar(function (s) {
      if (!s.customerCycle) { return; }
      s.customerCycle.portalRecordatorioAt = window.M4.now();
      evento(s, 'reminder_enabled_simulated', 'Recordatorio del próximo pedido activado (simulación)', {});
    });
    st.aviso = { tab: 'repetir', texto: 'Recordatorio activado (simulación). No se envió ningún correo real.' };
    refresh();
  }
  function verCorreo(id) {
    var m = (estado() && estado().emails || []).filter(function (e) { return e.id === id; })[0];
    if (m && window.MCMail && window.MCMail.open) { window.MCMail.open(m); }
  }
  function confirmarRepeticion(form) {
    var J = journey();
    var x = contexto(estado());
    if (!J || !x.p || !x.p.receivedAt || !x.p.replenishDue) {
      st.errores.repetir = 'La repetición se activa cuando toque reponer (simulación).';
      renderLocal();
      return;
    }
    var base = baseRepetir(x);
    var items = Object.keys(base).filter(function (k) { return Number(base[k]) > 0; })
      .map(function (k) { return { k: k, qty: Number(base[k]) }; });
    if (!items.length) {
      st.errores.repetir = 'Agrega al menos un producto para repetir tu pedido.';
      renderLocal();
      return;
    }
    var nuevo = J.placeOrder(items, { sourceOrderId: x.p.id });
    if (!nuevo) {
      st.errores.repetir = 'No se pudo confirmar la repetición. Revisa tu pedido anterior e inténtalo de nuevo.';
      renderLocal();
      return;
    }
    st.cantidades = null;
    st.errores = {};
    setTab('pedido');
    st.aviso = { tab: 'pedido', texto: 'Repetición confirmada: pedido ' + (x.numero + 1) + '. Aquí puedes seguir su avance.' };
    refresh();
  }
  function enviarAyuda(form) {
    var tipo = form.elements.type ? form.elements.type.value : '';
    var detalle = form.elements.detail ? String(form.elements.detail.value || '').trim() : '';
    if (!tipo || detalle.length < 3) {
      st.errores.ayuda = 'Elige un tipo de ayuda y cuéntanos qué pasa en al menos 3 letras.';
      renderLocal();
      return;
    }
    mutar(function (s) {
      var c = s.customerCycle;
      if (!c) { return; }
      if (!c.supportCase) {
        var id = 'CAS-' + ((s.lead && s.lead.id) || 'portal');
        c.supportCase = { id: id, type: tipo, detail: detalle, at: window.M4.now() };
        evento(s, 'support_case_opened', 'Caso de soporte abierto', { case_id: id, case_type: tipo });
      } else {
        c.supportMensajes = c.supportMensajes || [];
        c.supportMensajes.push({ type: tipo, detail: detalle, at: window.M4.now() });
        evento(s, 'support_message_sent', 'Mensaje enviado a Soporte', { case_id: c.supportCase.id, case_type: tipo });
      }
      if (window.M4Journey && window.M4Journey.addMail) { window.M4Journey.addMail(s, 'E10'); }
    });
    st.formularios.ayuda = {};
    st.errores = {};
    st.aviso = { tab: 'ayuda', texto: 'Recibimos tu consulta. Una persona de Soporte la revisa; el estado se actualiza aquí.' };
    refresh();
  }
  function datosRecomendar(form) {
    var v = {
      negocio: String(form.elements.negocio.value || '').trim(),
      persona: String(form.elements.persona.value || '').trim(),
      contacto: String(form.elements.contacto.value || '').trim(),
      permiso: (form.querySelector('input[name="permiso"]:checked') || {}).value || ''
    };
    st.formularios.recomendar = v;
    return v;
  }
  function errorRecomendar(v, paraGuia) {
    if (v.negocio.length < 2) { return 'Escribe el nombre del negocio.'; }
    if (v.persona.length < 2) { return 'Escribe el nombre de la persona de contacto.'; }
    if (v.contacto.length < 5) { return 'Escribe un correo o teléfono de contacto.'; }
    if (v.permiso !== 'si') { return paraGuia ? 'Primero confirma que esa persona aceptó que la contactemos. Sin ese permiso no le enviamos nada.' : 'Confirma que esa persona aceptó que la contactemos. Sin ese permiso no la contactamos.'; }
    return '';
  }
  function enviarRecomendacion(form) {
    var v = datosRecomendar(form);
    var error = errorRecomendar(v, false);
    if (error) { st.errores.recomendar = error; renderLocal(); return; }
    mutar(function (s) {
      var c = s.customerCycle;
      if (!c || c.referralSentAt) { return; }
      c.referralConsent = true;
      c.referralBusiness = v.negocio.slice(0, 100);
      c.referralPersona = v.persona.slice(0, 80);
      c.referralContacto = v.contacto.slice(0, 120);
      c.referralPersonaAcepta = true;
      c.referralSentAt = window.M4.now();
      var pedidoId = c.orders?.at(-1)?.id || null;
      var referidoId = 'REF-' + c.accountId + '-' + c.referralSentAt;
      escribirPostventa(s, 'referidos', pedidoId, {
        id: referidoId, negocio: c.referralBusiness, contacto: c.referralContacto, permiso: true, estado: 'enviado'
      });
      var beneficio = window.M4D.LM.LM7.gives;
      (s.jefeAprob ||= []).push({ id: referidoId, referidoId, cuenta: c.accountId,
        titulo: 'Beneficio por referido · ' + c.referralBusiness, tipo: 'referido', estado: 'pendiente',
        motivo: 'Recomendación desde el portal', detalle: beneficio, beneficio,
        checklist: { permission: true, b2b: true, benefit: true }, at: c.referralSentAt });
      evento(s, 'referral_sent', 'Recomendación enviada a revisión de Jefatura', { referred_business: c.referralBusiness, permission: true });
    });
    st.formularios.recomendar = {};
    st.errores = {};
    st.aviso = { tab: 'recomendar', texto: 'Recomendación enviada. Jefatura la revisa antes de contactar a esa persona.' };
    refresh();
  }
  function compartirGuia(form) {
    var v = datosRecomendar(form);
    var error = errorRecomendar(v, true);
    if (error) { st.errores.recomendar = error; renderLocal(); return; }
    var x = contexto(estado());
    mutar(function (s) {
      var c = s.customerCycle;
      if (!c) { return; }
      c.referralGuiaAt = window.M4.now();
      evento(s, 'referral_guide_shared', 'Guía para elegir máquina compartida (simulación)', { permission: true });
    });
    st.errores = {};
    st.guia = { persona: v.persona, negocio: x.c.company || '' };
    refresh();
  }
  /* Pregunta rápida: dispara marley:portal-pregunta sobre #agente-portal con detail.texto; el motor del chat responde.
     No vuelve a pintar el portal (así el chat conserva su conversación). Si el chat aún no está montado,
     deja la respuesta del portal como respaldo. */
  function preguntarAlAgente(el) {
    var id = el.getAttribute('data-portal-rapida');
    var rapida = RAPIDAS.filter(function (r) { return r.id === id; })[0];
    if (!rapida) { return; }
    st.rapida = id;
    var grupo = el.closest('[data-rapidas]');
    if (grupo) {
      Array.prototype.forEach.call(grupo.querySelectorAll('[data-portal-rapida]'), function (b) {
        var activa = b.getAttribute('data-portal-rapida') === id;
        b.setAttribute('aria-pressed', activa ? 'true' : 'false');
        b.classList.toggle('is-activa', activa);
      });
    }
    var det = document.getElementById('mp-agente');
    if (det && !det.open) { det.open = true; }
    var agente = document.getElementById('agente-portal');
    var montado = Boolean(agente && agente.querySelector('[data-agente-modo="incrustado"]'));
    st.textoRapida = montado ? null : respuestaRapida(contexto(estado()), id);
    if (grupo) { actualizarRespuesta(grupo, st.textoRapida); }
    /* detail.texto es el contrato; detail.pregunta lo lee hoy el listener del agente (agente-cliente-nucleo.js). */
    if (agente) { agente.dispatchEvent(new CustomEvent('marley:portal-pregunta', { bubbles: true, detail: { texto: rapida.q, pregunta: rapida.q } })); }
  }
  function actualizarRespuesta(grupo, texto) {
    var caja = grupo.querySelector('#portal-rapida-respuesta');
    if (!texto) { if (caja) { caja.parentNode.removeChild(caja); } return; }
    if (!caja) {
      caja = document.createElement('p');
      caja.id = 'portal-rapida-respuesta';
      caja.className = 'mp-respuesta';
      caja.setAttribute('role', 'status');
      grupo.appendChild(caja);
    }
    caja.textContent = texto;
  }
  function cerrarDialogo() {
    st.dialogo = false;
    st.foco = '[data-portal-accion="firmar-contrato"]';
    renderLocal();
  }
  function volverEncuesta() {
    var previa = st.encuesta;
    st.encuesta = previa?.volver || null;
    if (!st.encuesta && previa?.pedido) st.foco = '[data-mp-satisfaccion] button';
    renderLocal();
  }
  function registrarResena(pedido) {
    var anterior = st.encuesta;
    var abrir = function (s) {
      if (!s.customerCycle?.accountId) return;
      escribirPostventa(s, 'resenas', pedido || null, { canal: 'google', estado: 'vista-previa' });
    };
    if (estado().customerCycle?.accountId) mutar(abrir);
    // M4 puede repintar el portal durante la mutación.
    if (anterior && st.encuesta !== anterior) st.encuesta = anterior;
  }
  function abrirCanal(canal, pedido) {
    if (!CANALES[canal]) return;
    if (!pedido && st.tab === 'recomendar') {
      st.vistaCanal = canal;
      if (canal === 'google') registrarResena(contexto(estado()).p?.id);
      renderLocal();
      return;
    }
    var volver = st.encuesta;
    st.encuesta = { modo: 'preview', pedido, canal, volver };
    if (canal === 'google') registrarResena(pedido);
    renderLocal();
  }
  function elegirCarita(el) {
    var pedido = el.dataset.pedido, cara = el.dataset.cara;
    var x = contexto(estado());
    if (!x.c.orders?.some(p => p.id === pedido && p.receivedAt)) return;
    var r = fichaPostventa(x.s, 'respuestas', pedido);
    var modo = cara === 'no-contento' ? 'ayuda' : 'nps';
    if (el.dataset.mpPostaccion === 'seguimiento') {
      st.encuesta = { modo: 'nps', pedido, seguimiento: true, canales: [] };
      renderLocal();
      return;
    }
    if (!CARITAS[cara] || r?.nps != null) return;
    st.encuesta = { modo, pedido, nps: r?.nps, abierta: r?.abierta, canales: r?.canales || [] };
    mutar(s => escribirPostventa(s, 'respuestas', pedido, { momento: momento(x, pedido), carita: cara, nps: null, abierta: '', canales: [] }));
    renderLocal();
  }
  function guardarSatisfaccion(form) {
    var e = st.encuesta;
    if (!e || !form.checkValidity()) return;
    var marcada = form.querySelector('[name="nps"]:checked');
    var nps = Number(marcada?.value);
    if (!Number.isInteger(nps) || nps < 0 || nps > 10) return;
    var abierta = form.elements.abierta.value.trim();
    var canales = [...form.querySelectorAll('[name="canales"]:checked')].map(n => n.value);
    st.encuesta = null;
    mutar(s => {
      var r = fichaPostventa(s, 'respuestas', e.pedido);
      var pedido = s.customerCycle?.orders.find(p => p.id === e.pedido);
      if (!r || !pedido?.receivedAt) return;
      if (e.seguimiento) {
        if (r.seguimientoAt || fichaPostventa(s, 'ayudas', e.pedido)?.estado !== 'resuelta') return;
        r.seguimientoAt = window.M4.now();
        r.seguimiento = { nps, abierta, canales };
        evento(s, 'postventa_seguimiento', 'Seguimiento de soporte registrado', { order_id: e.pedido, nps_score: nps });
        return;
      }
      if (r.nps != null) return;
      Object.assign(r, { nps, abierta, canales });
      Object.assign(pedido, { npsScore: nps, npsComment: abierta, npsAt: window.M4.now() });
      s.customerCycle.npsScore = nps;
      s.customerCycle.npsComment = abierta;
      evento(s, 'nps_submitted', 'Satisfacción registrada', { order_id: e.pedido, nps_score: nps });
      if (nps <= 6 && /falla|no funciona|avería/i.test(abierta)) {
        escribirPostventa(s, 'ayudas', e.pedido, { motivo: MOTIVOS[0], resumen: abierta, estado: 'abierta' });
      }
    });
    if (canales.includes('referido')) setTab('recomendar');
    else renderLocal();
  }
  function pedirAyudaPedido(form) {
    var e = st.encuesta;
    if (!e || !form.checkValidity()) return;
    var motivo = form.elements.motivo.value;
    var detalle = form.elements.detalle.value.trim();
    var horario = form.elements.horario.value.trim();
    var foto = motivo === MOTIVOS[0] ? form.elements.foto.files[0]?.name : '';
    if (!detalle || !horario) return;
    var resumen = motivo + '. ' + detalle + ' · Horario: ' + horario + (foto ? ' · Foto: ' + foto.slice(0, 120) : '');
    st.encuesta = null;
    mutar(s => {
      if (fichaPostventa(s, 'ayudas', e.pedido)) return;
      escribirPostventa(s, 'ayudas', e.pedido, { motivo, resumen, estado: 'abierta' });
      evento(s, 'support_case_opened', 'Solicitud de postventa abierta', { order_id: e.pedido, case_type: motivo });
    });
    setTab('ayuda');
    var det = st.host.querySelector('#mp-agente');
    if (det) det.open = true;
    var host = st.host.querySelector('#agente-portal');
    host?.scrollIntoView({ block: 'nearest' });
    var intentos = 0;
    var entregar = function () {
      var destino = st.host?.querySelector('#agente-portal');
      if (st.tab !== 'ayuda' || !destino) return;
      if (!window.MarleyAgenteClienteNucleo && intentos++ < 40) { setTimeout(entregar, 150); return; }
      if (window.MarleyAgenteClienteNucleo) {
        var agente = window.MarleyAgente;
        var cuenta = window.M4.get().lead?.id;
        var texto = motivo === MOTIVOS[0] ? 'La máquina no funciona. Necesito soporte.' : 'Tengo un reclamo sobre mi pedido.';
        var vinculados = 0;
        var vincularResumen = function () {
          var traspaso = agente?.espera.estado(cuenta).traspaso;
          if (!traspaso || traspaso.tipo !== 'soporte' || !['esperando', 'tomada'].includes(traspaso.estado)) {
            if (vinculados++ < 30) setTimeout(vincularResumen, 150);
            return;
          }
          var estado = agente.estado.get();
          var actual = estado.traspasos.find(t => t.id === traspaso.id);
          if (!actual || (actual.resumen || '').includes(resumen)) return;
          actual.resumen = [actual.resumen, resumen].filter(Boolean).join('\n');
          actual.postventaPedidoId = e.pedido;
          agente.estado.guardar(estado);
          agente.eventos.emitir('traspaso', actual);
        };
        destino.dispatchEvent(new CustomEvent('marley:portal-pregunta', { bubbles: true, detail: { texto } }));
        setTimeout(vincularResumen, 1000);
      }
    };
    entregar();
  }
  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) { return; }
    var post = t.closest('[data-mp-postaccion]');
    if (post) {
      ev.preventDefault();
      if (post.dataset.mpPostaccion === 'cerrar') volverEncuesta();
      else if (post.dataset.mpPostaccion === 'canal') abrirCanal(post.dataset.canal, post.dataset.pedido);
      else elegirCarita(post);
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-mp-fondo') && t === ev.target) { cerrarDialogo(); return; }
    var el = t.closest('[data-portal-tab],[data-etapa],[data-portal-rapida],[data-portal-sugerencia],[data-mp-cerrar],[data-portal-accion]');
    if (!el || el.type === 'submit') { return; }
    if (el.hasAttribute('data-portal-tab')) { ev.preventDefault(); setTab(el.getAttribute('data-portal-tab')); return; }
    if (el.hasAttribute('data-etapa')) { ev.preventDefault(); st.etapa = el.getAttribute('data-etapa'); renderLocal(); return; }
    if (el.hasAttribute('data-portal-rapida')) {
      ev.preventDefault();
      preguntarAlAgente(el);
      return;
    }
    if (el.hasAttribute('data-portal-sugerencia')) {
      ev.preventDefault();
      decidirSugerencia(el.getAttribute('data-portal-sugerencia'), el.getAttribute('data-portal-decision'));
      return;
    }
    if (el.hasAttribute('data-mp-cerrar')) { ev.preventDefault(); cerrarDialogo(); return; }
    var accion = el.getAttribute('data-portal-accion');
    if (!accion) { return; }
    ev.preventDefault();
    if (accion === 'firmar-contrato') { st.dialogo = true; renderLocal(); return; }
    if (accion === 'avanzar-tiempo') { avanzarTiempo(el.dataset.dias); return; }
    if (accion === 'confirmar-recepcion') { confirmarRecepcion(); return; }
    if (accion === 'ir-repetir') { setTab('repetir'); return; }
    if (accion === 'recordatorio') { activarRecordatorio(); return; }
    if (accion === 'ver-correo') { verCorreo(el.getAttribute('data-mail-id')); return; }
    if (accion === 'confirmar-firma') { firmarContrato(); return; }
    if (accion === 'confirmar-pedido') { confirmarPedido(); return; }
    if (accion === 'cerrar-toast') { ocultarToast(); return; }
  }
  function onSubmit(ev) {
    var form = ev.target;
    var tipo = form && form.getAttribute ? form.getAttribute('data-mp-form') : null;
    if (!tipo) { return; }
    ev.preventDefault();
    var accion = ev.submitter && ev.submitter.getAttribute('name') === 'accion' ? ev.submitter.value : 'enviar';
    if (tipo === 'repetir') { confirmarRepeticion(form); }
    else if (tipo === 'satisfaccion') { guardarSatisfaccion(form); }
    else if (tipo === 'incidencia') { pedirAyudaPedido(form); }
    else if (tipo === 'ayuda') { enviarAyuda(form); }
    else if (tipo === 'recomendar') { if (accion === 'guia') { compartirGuia(form); } else { enviarRecomendacion(form); } }
  }
  function onInput(ev) {
    var t = ev.target;
    var form = t && t.form;
    var tipo = form && form.getAttribute ? form.getAttribute('data-mp-form') : null;
    if (!tipo) { return; }
    if ((tipo === 'satisfaccion' || tipo === 'incidencia') && st.encuesta) {
      var e = st.encuesta;
      if (t.name === 'canales' && ev.type === 'change') {
        e.canales = [...form.querySelectorAll('[name="canales"]:checked')].map(n => n.value);
        e.canal = t.checked ? t.value : e.canales.at(-1);
        if (t.checked && t.value === 'google') registrarResena(e.pedido);
        var vista = st.host.querySelector('[data-mp-encuesta] [data-mp-vista-inline]');
        if (vista) vista.innerHTML = e.canal ? vistaCanal(contexto(estado()), e.canal, e.abierta) : '';
      } else if (t.name === 'motivo' && ev.type === 'change') {
        e.motivo = t.value;
        form.querySelector('[data-mp-foto]').hidden = t.value !== MOTIVOS[0];
      } else if (['nps','abierta','detalle','horario'].includes(t.name)) {
        e[t.name] = t.value;
      }
      return;
    }
    if (tipo === 'repetir') {
      if (t.name && t.name.indexOf('q-') === 0 && st.cantidades) {
        st.cantidades.q[t.name.slice(2)] = cantidad(t.value);
        var x = contexto(estado());
        var total = st.host && st.host.querySelector('[data-mp-total-repetir]');
        if (total) { total.textContent = fmt(totalRepetir(x, baseRepetir(x))); }
      }
      return;
    }
    st.formularios[tipo] = st.formularios[tipo] || {};
    if (t.type === 'radio') {
      if (t.checked) { st.formularios[tipo][t.name] = t.value; }
    } else {
      st.formularios[tipo][t.name] = t.value;
    }
  }
  /* Solo guarda lo que decide la persona: el evento que dispara el propio render no cambia la preferencia. */
  function onToggle(ev) {
    var t = ev.target;
    if (t && t.id === 'mp-agente' && Boolean(t.open) !== Boolean(st.agenteRender)) {
      st.agenteAbierto = Boolean(t.open);
      st.agenteRender = Boolean(t.open);
    }
  }
  function onKey(ev) {
    if (!st.dialogo) { return; }
    if (ev.key === 'Escape') { ev.preventDefault(); cerrarDialogo(); return; }
    if (ev.key !== 'Tab' || !st.host) { return; }
    var dlg = st.host.querySelector('[data-mp-dialogo]');
    if (!dlg) { return; }
    var foco = Array.prototype.slice.call(dlg.querySelectorAll('button, a[href], input, select, textarea'));
    if (!foco.length) { return; }
    var primero = foco[0], ultimo = foco[foco.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  }
  /* ---------- Acciones propias del portal (no dependen de los controles de prueba de la app) ---------- */
  function firmarContrato() {
    st.dialogo = false;
    if (!journey()?.signContract?.()) renderLocal();
  }
  function confirmarPedido() {
    var J = journey();
    var s = estado();
    if (!J || !s || !J.placeOrder || !J.baseItems) { return; }
    J.placeOrder(J.baseItems(s));
    refresh();
  }

  /* ---------- Aviso «Correo enviado» del portal ----------
     Va en el flujo del portal, arriba (a la derecha en escritorio): no se superpone al CTA principal ni al chat.
     Se cierra solo a los 3 segundos y tiene botón para cerrarlo. Fuera del portal, sigue el aviso de la app. */
  var AVISO_MS = 3000;
  function toastHTML() {
    var t = st.toast;
    if (!t) { return ''; }
    return '<div class="mp-toast" role="status" aria-live="polite" data-mp-toast>' +
      '<p><b>Correo enviado</b>' + (t.asunto ? ' · ' + esc(t.asunto) : '') + '</p>' +
      '<div class="mp-toast-acc">' +
      (t.id ? '<button type="button" class="mp-link" data-portal-accion="ver-correo" data-mail-id="' + esc(t.id) + '" data-evt="ver_correo_aviso">Ver correo</button>' : '') +
      '<button type="button" class="mp-toast-cerrar" data-portal-accion="cerrar-toast" aria-label="Cerrar aviso" data-evt="cerrar_aviso_correo">Cerrar</button>' +
      '</div></div>';
  }
  function mostrarToast(correo) {
    var enPortal = Boolean(st.host && st.host.isConnected && document.body && document.body.dataset.current === 'C09');
    if (!enPortal) { return false; }
    st.toast = { id: (correo && correo.id) || null, asunto: (correo && correo.subject) || '' };
    clearTimeout(st.toastTimer);
    st.toastTimer = setTimeout(ocultarToast, AVISO_MS);
    renderLocal();
    var el = st.host && st.host.querySelector('[data-mp-toast]');
    if (el && el.scrollIntoView) {
      var reducir = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      el.scrollIntoView({ block: 'nearest', behavior: reducir ? 'auto' : 'smooth' });
    }
    return true;
  }
  function ocultarToast() {
    clearTimeout(st.toastTimer);
    st.toastTimer = null;
    if (!st.toast) { return; }
    st.toast = null;
    renderLocal();
  }
  (function engancharAviso() {
    var previo = window.MCToast;
    window.MCToast = {
      show: function (correo) { if (!mostrarToast(correo) && previo && previo.show) { previo.show(correo); } },
      hide: function () { ocultarToast(); if (previo && previo.hide) { previo.hide(); } }
    };
  })();

  document.addEventListener('r3:listo', function () { renderLocal(); });

  window.MarleyPortal = {
    version: VERSION,
    render: render
  };
})();
