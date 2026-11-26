/* Compra ordenada · Marley Coffee Empresas (25-nov, B1).
   Se carga al entrar a C04, C05, C06 o C09 (lo pone el cargador de index.html). Envuelve M4C.SCREENS y usa M4 (estado), MarleyApp (ruta) y M9Catalog (carrito).
   Total único: el pack muestra MC_TOTAL_PROPUESTA(s) y sus líneas salen de MC_COTIZACION(s), la misma regla que el agente, el CRM y la C05 anterior.
   Cambiar una cantidad guarda el carrito con M9Catalog.save, así el total se recalcula con esa misma regla.
   C04: «Cuéntanos de tu negocio» → «Te ayudamos a elegir» y «Ya sé qué máquina quiero» (salta el cuestionario, guarda la señal).
   C05: pack de inicio («Ver mis productos», «Aceptar mi pack» = T2, contacto al aceptar), sugerencia después de aceptar.
   C06: confirmación con un solo CTA «Ir a mi portal» (T3). C09: gancho del portal (recursos/portal/portal.js). */
(function () {
  'use strict';
  if (window.MarleyCompra || !window.M4 || !window.M4C || !window.MarleyApp) return;
  var M = window.M4, C = window.M4C, D = window.M4D || {};
  var OF = null, cargando = null;
  var portalCarga = null;
  var ui = { selector: false, verProductos: false, contacto: false, editando: false, error: '' };
  var OFERTA = 'recursos/datos/oferta_por_buyer.json';
  var GUIA = 'recursos/portal/guia-elegir-maquina.html';
  var RESPALDO = 'recursos/productos/catalog/consumibles.webp';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clp(n) { return n == null ? 'precio con tu ejecutivo' : (D.fmtCLP ? D.fmtCLP(n) : '$ ' + Math.round(n).toLocaleString('es-CL')); }
  function ruta() { return (location.hash || '#C01').slice(1).split('?')[0]; }
  function ir(r) { window.MarleyApp.go(r); }
  function pintar() { if (window.MarleyApp && window.MarleyApp.render) window.MarleyApp.render(); }
  function cargar() {
    if (OF) return Promise.resolve(OF);
    if (!cargando) cargando = fetch(OFERTA).then(function (r) {
      if (!r.ok) throw new Error('No se cargó el catálogo');
      return r.json();
    }).then(function (j) { OF = j; return OF; }).catch(function () { cargando = null; return null; });
    return cargando;
  }
  function cot(s) { return window.MC_COTIZACION ? window.MC_COTIZACION(s || M.get()) : null; }
  function totalDe(s) { return window.MC_TOTAL_PROPUESTA ? window.MC_TOTAL_PROPUESTA(s || M.get()) : null; }
  function tipoDe(s) { var c = cot(s); return c && c.comprador ? c.comprador.id : null; }
  function guiaHref(s) { var t = tipoDe(s); return GUIA + (t ? '?tipo=' + encodeURIComponent(t) : ''); }

  // Pack: líneas de la cotización (mismas que el total) con su cantidad.
  function pack(s) {
    var c = cot(s); if (!c) return null;
    var cant = {}; c.items.forEach(function (it) { cant[it.id] = it.qty; });
    var lineas = c.lineas.map(function (l) { return { k: l.k, id: l.id, t: l.t, d: l.d, foto: l.foto, fotoNota: l.foto_nota, precio: l.precio, qty: cant[l.id] || 0 }; });
    return { lineas: lineas, enPack: lineas.filter(function (l) { return l.qty > 0; }), total: totalDe(s), kit: c.kit, filtro: c.filtro, comprador: c.comprador };
  }
  // Cambia una cantidad en el carrito legado (M9Catalog.save): el total sale de MC_TOTAL_PROPUESTA con la misma regla.
  function escribir(id, qty) {
    var s = M.get(), c = cot(s); if (!c || !window.M9Catalog) return false;
    var mapa = {}; c.items.forEach(function (it) { mapa[it.id] = it.qty; });
    if (qty > 0) mapa[id] = qty; else delete mapa[id];
    var periodo = {}; (window.M9Catalog.lines() || []).forEach(function (x) { periodo[x.id] = x.period; });
    var lista = Object.keys(mapa).map(function (k) { return { id: k, qty: mapa[k], period: periodo[k] || 'inicial' }; });
    if (!lista.length) { ui.error = 'Deja al menos un producto en tu pack.'; return false; }
    var tipo = c.comprador ? c.comprador.id : null;
    window.M9Catalog.save(lista);
    M.update(function (st) { st.compra = Object.assign({}, st.compra || {}, { negocioPack: tipo }); });
    ui.error = '';
    return true;
  }
  function maq(k) {
    var j = OF && OF.maquinas && OF.maquinas[k];
    if (j) return { id: k, name: j.nombre, kind: j.tipo, line: j.linea, cupsTxt: j.tazas, format: j.formato, staff: j.atencion, photo: 'recursos/maquinas/' + k + '_foto.webp' };
    var m = (D.MACHINES || {})[k] || {};
    return { id: k, name: m.name || 'Bar', kind: m.kind || '', line: m.line || '', cupsTxt: m.cupsTxt || '', format: m.format || '', staff: m.staff || '', photo: m.photo || m.img || 'recursos/maquinas/bar.webp' };
  }
  function maquinaDe(s) { var k = (C.quoteState(s) || {}).machine || (s.proposal && s.proposal.machine) || 'bar'; return { key: k, m: maq(k) }; }
  function senal(st, id) {
    var val = { sabeMaquina: true, maquinaElegida: id };
    if (st.lead) st.lead.senales = Object.assign({}, st.lead.senales || {}, val);
    else st.compra = Object.assign({}, st.compra || {}, { senales: Object.assign({}, (st.compra || {}).senales || {}, val) });
  }
  function fusionarSenal(st) {
    if (st.lead && st.compra && st.compra.senales) { st.lead.senales = Object.assign({}, st.lead.senales || {}, st.compra.senales); delete st.compra.senales; }
  }
  function elegirMaquina(id) {
    var s = M.get(), m = maq(id); if (!m) return;
    var biz = s.answers && s.answers.negocio || (OF && OF.buyers && OF.buyers.filter(function (b) { return b.maquina === id; })[0] || {}).negocio || 'Hotel';
    if (!s.lead && M.startQuote) M.startQuote(biz);
    M.answer('negocio', biz);
    var d = (M.DEFAULTS || {})[biz] || {};
    ['volumen', 'operacion', 'preferencias'].forEach(function (k) { var v = M.get().answers[k]; if (d[k] && (v == null || (Array.isArray(v) ? !v.length : !v))) M.answer(k, d[k]); });
    M.update(function (st) { st.diag.step = 2; }); // Salta las preguntas y arma la propuesta con la máquina elegida.
    if (!M.get().diag.done) M.confirmStep();
    M.setQuote({ machine: id });
    M.update(function (st) {
      senal(st, id); fusionarSenal(st);
      st.catalogJourney = Object.assign({}, st.catalogJourney || {}, { machine: id, machineSource: 'cliente' });
      st.compra = Object.assign({}, st.compra || {}, { origen: 'sabe-maquina' });
    });
    ui.selector = false; ui.editando = false;
    ir('C05');
  }
  function aceptar() {
    M.acceptProposal();
    if (window.M4Journey && window.M4Journey.proposalAccepted) window.M4Journey.proposalAccepted();
    M.update(function (st) { fusionarSenal(st); st.compra = Object.assign({}, st.compra || {}, { paso: 'cruce', pendiente: false }); });
    ui.contacto = false; ui.error = '';
    pintar();
  }

  /* ---------- HTML ---------- */
  function cabecera(eyebrow, titulo, lead, id) {
    return '<p class="cmp-eyebrow">' + esc(eyebrow) + '</p><h1 id="' + (id || 'cmp-t') + '" data-vida="titulo" tabindex="-1">' + esc(titulo) + '</h1>' + (lead ? '<p class="cmp-lead">' + lead + '</p>' : '');
  }
  function miniaturas(p) {
    return p.enPack.slice(0, 8).map(function (l) {
      return '<img src="' + esc(l.foto) + '" alt="' + esc(l.t) + '" width="44" height="44" loading="lazy" data-zoom data-zoom-grupo="miniaturas-pack" onerror="this.onerror=null;this.src=\'' + RESPALDO + '\'">';
    }).join('');
  }
  function detalle(p) {
    var cards = p.lineas.map(function (l) {
      return '<article class="cmp-card mc-card"><img src="' + esc(l.foto) + '" alt="' + esc(l.t) + '" width="600" height="750" loading="lazy" data-zoom data-zoom-grupo="productos" onerror="this.onerror=null;this.src=\'' + RESPALDO + '\'">' +
        '<div><h3>' + esc(l.t) + '</h3><p>' + esc(l.d || 'Formato a confirmar') + '</p>' + (l.fotoNota ? '<p class="cmp-nota">' + esc(l.fotoNota) + '</p>' : '') + '<p class="mc-price"><span class="mc-price-label">Precio por formato</span><strong class="mc-price-value">' + clp(l.precio) + '</strong><small>+ IVA · referencial</small></p>' +
        '<p class="cmp-sub">' + (l.qty > 0 ? 'En tu pack: ' + clp(l.precio * l.qty) : 'No está en tu pack') + '</p>' +
        '<div class="cmp-qty"><button type="button" class="cmp-step" data-pack-cant="' + esc(l.id) + ':-1" aria-label="Quitar uno de ' + esc(l.t) + '">−</button>' +
        '<input type="number" inputmode="numeric" min="0" max="999" value="' + l.qty + '" data-pack-cant-input="' + esc(l.id) + '" aria-label="Cantidad de ' + esc(l.t) + '">' +
        '<button type="button" class="cmp-step" data-pack-cant="' + esc(l.id) + ':1" aria-label="Agregar uno de ' + esc(l.t) + '">+</button></div></div></article>';
    }).join('');
    return '<section id="pack-productos" class="cmp-detalle" aria-label="Productos del pack"><p class="cmp-hint">Desliza para ver cada producto. Cambia una cantidad y el total se recalcula.</p>' +
      '<div class="cmp-deck" tabindex="0" role="region" aria-label="Lista deslizable de productos">' + cards + '</div>' +
      '<p class="cmp-fijos">Kit de instalación: ' + clp(p.kit) + ' · Filtro: ' + clp(p.filtro) + ' <small>referenciales, sin IVA</small></p>' +
      '<p class="cmp-total-bar mc-price" aria-live="polite"><span class="mc-price-label">Total neto referencial</span><b class="mc-price-value" data-pack-total="' + p.total + '" data-vida="cuenta" data-valor="' + p.total + '">' + clp(p.total) + '</b><small>+ IVA · referencial</small></p>' +
      '<p class="cmp-error" role="status">' + esc(ui.error) + '</p>' +
      '<button type="button" class="cmp-link" data-pack-accion="cerrar-productos">Ocultar productos</button></section>';
  }
  function contactoHTML(s) {
    var l = s.lead || {};
    var D = window.M4D;
    var comuna = D.comuna(s.answers.comuna) ? '' : '<label><span>Comuna de tu local</span><select id="m4FComuna" name="comuna" required><option value="">Elige tu comuna</option>' +
      Object.values(D.ZONES).map(function (z) {
        var lugares = z.id === 'regiones' ? D.REGIONES : D.COMUNAS.filter(function (c) { return c.zone === z.id; });
        return '<optgroup label="' + esc(z.name) + '">' + lugares.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></label>';
    return '<form id="pack-contacto" class="cmp-form" novalidate><h2>¿A dónde te escribimos?</h2><p>Lo último es dejar tus datos: así guardamos tu pack y el equipo te contacta.</p>' +
      '<label><span>Nombre</span><input id="m4FName" name="name" autocomplete="name" value="' + esc(l.name || '') + '" placeholder="Tu nombre"></label>' +
      '<label><span>Correo electrónico</span><input id="m4FEmail" name="email" type="email" autocomplete="email" value="' + esc(l.email || '') + '" placeholder="nombre@empresa.cl"></label>' +
      '<label><span>Celular (opcional)</span><input id="m4FPhone" name="phone" type="tel" inputmode="numeric" placeholder="+56 9"></label>' +
      comuna +
      '<label class="cmp-check"><input type="checkbox" name="consent"><span>Autorizo que Marley Coffee use estos datos para responder esta solicitud.</span></label>' +
      '<p class="cmp-error" role="status">' + esc(ui.error) + '</p>' +
      '<button type="submit" class="m5-btn mc-btn mc-btn--main" data-pack-accion="confirmar-contacto" data-evt="pack-aceptar-con-datos">Aceptar mi pack</button></form>';
  }
  function cruceHTML() {
    var mug = (D.PRODUCTS || {}).mug || { name: 'Taza mug negro Marley Coffee', img: 'recursos/productos/taza-mug-negro.webp' };
    return '<section id="cross-sell" class="cmp-cruce" aria-labelledby="cmp-cruce-t"><p class="cmp-eyebrow">Pack aceptado</p><h2 id="cmp-cruce-t">¿Sumas un complemento a tu pack?</h2>' +
      '<div class="cmp-cruce-card mc-card"><img src="' + 'https://coffeemarleycl.vtexassets.com/arquivos/ids/156020-600-750/TazonMug-NegroDorado-Frontal.jpg' + '" alt="' + esc(mug.name) + '" width="600" height="750" loading="lazy" data-zoom data-zoom-grupo="sugerencia">' +
      '<div><b>' + esc(mug.name) + '</b><p>Para tus clientes en cada taza. Su precio lo confirma tu ejecutivo y no suma al total.</p><p class="cmp-precio">Precio con tu ejecutivo</p></div></div>' +
      '<div class="cmp-acciones"><button type="button" class="m5-btn mc-btn mc-btn--main" data-cross="agregar" data-evt="cruce-agregar">Agregar</button>' +
      '<button type="button" class="m5-btn mc-btn mc-btn--sec" data-cross="no-gracias" data-evt="cruce-no-gracias">No, gracias</button></div></section>';
  }
  function botonAceptar() {
    return '<button type="button" class="m5-btn mc-btn mc-btn--main" data-pack-accion="aceptar" data-cierra-tarea="T2" data-cta-principal="aceptar-pack" data-evt="pack-aceptar">Aceptar mi pack</button>';
  }
  function botonVerProductos() {
    return '<button type="button" class="m5-btn mc-btn mc-btn--sec" data-pack-accion="ver-productos" data-evt="pack-ver-productos" aria-controls="pack-productos" aria-expanded="' + ui.verProductos + '">' + (ui.verProductos ? 'Ocultar productos' : 'Ver mis productos') + '</button>';
  }
  function pantallaC05(s, p) {
    if (s.compra && s.compra.paso === 'cruce') return '<section class="cmp-sec"><div class="cmp-wrap">' + cruceHTML() + '</div></section>';
    var maquina = maquinaDe(s), mq = maquina.m, com = p.comprador, etiq = com && com.etiqueta ? com.etiqueta.toLowerCase() : '';
    var titulo = 'Tu pack de inicio';
    var scene = window.M4D.BUSINESS[s.answers?.negocio || com?.negocio]?.scene || 'hotel';
    var ejemplo = '<figure class="mc-pack-scene"><figcaption>Así se vería el café en tu ' +
      esc(({Hotel:'hotel',Restaurante:'restaurante','Cafetería':'cafetería',Oficinas:'oficina',OCS:'oficina'})[s.answers?.negocio] || 'negocio') +
      '</figcaption>' + window.M5UI.film(scene, { mode: 'once', deferred: true }) + '</figure>';
    var saludo = com && com.mensaje ? '<p class="cmp-saludo">' + esc(com.mensaje) + '</p>' : '';
    var motivo = s.catalogJourney?.machineSource === 'cliente' ? 'Elegiste esta máquina directamente.' : window.R5?.porque?.(s, maquina.key) || mq.kind;
    var extra = s.compra && s.compra.extra ? '<p class="cmp-ok">Sumaste la taza de la marca a tu pack: su precio lo confirma tu ejecutivo.</p>' : '';
    // DS4: desde 1024 px, la máquina a la izquierda y una tarjeta fija a la derecha con
    // el total y las acciones. DS5: la máquina sale de #pack-resumen; el resumen queda
    // solo con miniaturas (≤96 px), cantidad, total + IVA y «Ver mis productos».
    return '<section class="cmp-sec" aria-labelledby="cmp-pack-t"><div class="cmp-wrap cmp-pack-wrap">' +
      cabecera('Tu pack', titulo, '', 'cmp-pack-t') + saludo +
      '<div class="cmp-pack">' +
      '<div class="cmp-pack-main">' +
      '<div class="cmp-maquina"><img src="' + esc(mq.photo) + '" alt="' + esc(mq.name) + '" width="160" height="140" loading="lazy" data-zoom data-zoom-grupo="maquina"><div><b>' + esc(mq.name) + '</b><span>' + esc(mq.cupsTxt) + '</span><small>' + esc(mq.staff) + '</small><p class="cmp-motivo">' + esc(motivo) + '</p></div></div>' +
      ejemplo + extra +
      '</div>' +
      '<aside id="pack-resumen" class="cmp-pack-card" aria-label="Resumen de tu pack">' +
      '<div class="cmp-total premium-quote-total mc-price"><span class="mc-price-label">Total neto referencial</span><strong class="mc-price-value" data-pack-total="' + p.total + '" data-vida="cuenta" data-valor="' + p.total + '">' + clp(p.total) + '</strong><small>+ IVA · referencial</small></div>' +
      '<div class="cmp-acciones cmp-acciones--pack">' + botonAceptar() + botonVerProductos() + '</div>' +
      '<div class="cmp-linea"><div class="cmp-minis">' + miniaturas(p) + '</div><p>' + p.enPack.length + ' productos, más el kit de instalación y el filtro.' + (com ? ' Elegidos para ' + esc(etiq) + '.' : '') + '</p></div>' +
      '<p class="cmp-nota">Precios netos referenciales, de la cotización del 19-oct-2026. Modelo, mínimo mensual y plazo de entrega: los confirma el equipo.</p>' +
      '</aside>' +
      '</div>' + (ui.verProductos ? detalle(p) : '<div id="pack-productos" hidden></div>') + (ui.contacto ? contactoHTML(s) : '') +
      '<section class="cmp-cambios mc-card" aria-label="Cambios a tu pack"><details><summary>Ver opciones para cambiar tu pack</summary><div class="cmp-cambios-lista"><button type="button" class="cmp-link" data-pack-accion="cambiar-maquina" data-evt="pack-cambiar-maquina">Cambiar máquina</button><button type="button" class="cmp-link" data-pack-accion="cambiar-respuestas" data-evt="pack-cambiar-respuestas">Cambiar respuestas</button><button type="button" class="cmp-link" data-pack-accion="guardar-despues" data-evt="guardar-propuesta">Guardar y seguir después</button><details><summary>Ver la guía y hablar con el asistente</summary><a class="cmp-link" href="' + esc(guiaHref(s)) + '" data-evt="lead-magnet-guia-maquina">Guía para elegir máquina</a><button type="button" class="cmp-link" data-m7-open="ayuda" data-evt="pack-abrir-ayuda">Te ayudamos a decidir</button></details></div></details></section>' +
      '<div class="cmp-cierre"><div class="cmp-acciones">' + botonAceptar() + '</div></div>' +
      '</div></section>';
  }
  function selectorHTML(s) {
    var cartas = ['bar', 'pods', 'cafe_al_paso', 'oficina'].map(function (k) {
      var m = maq(k);
      return '<article class="cmp-maq mc-card"><img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '" width="160" height="140" loading="lazy" data-zoom data-zoom-grupo="maquinas">' +
        '<div class="cmp-maq-txt"><b>' + esc(m.name) + '</b><span>' + esc(m.kind) + '</span><small>' + esc(m.cupsTxt) + ' · ' + esc(m.format) + ' · ' + esc(m.staff) + '</small><button type="button" class="mc-btn mc-btn--sec" data-maquina-id="' + k + '" data-evt="maquina-elegida">Elegir ' + esc(m.name) + '</button></div></article>';
    }).join('');
    return '<section class="cmp-sec cmp-sel"><div class="cmp-wrap">' + cabecera('Ya sabes lo que quieres', 'Elige tu máquina', 'Cada máquina rinde distinto según sus funciones. Elige la que ya conoces y saltamos las preguntas.', 'cmp-sel-t') +
      '<div class="cmp-maquinas">' + cartas + '</div><p class="cmp-pie"><button type="button" class="cmp-link" data-solucion-accion="volver-preguntas">Volver a las preguntas</button> · <a class="cmp-link" href="' + esc(guiaHref(s)) + '" data-evt="lead-magnet-guia-maquina">Guía para elegir máquina</a></p></div></section>';
  }
  function bloqueSalida() {
    return '<div class="cmp-salida"><button type="button" class="mc-btn mc-btn--sec" data-solucion-accion="ya-se-maquina" data-evt="ya-se-maquina">Ya sé qué máquina quiero</button><span>Elígela y saltamos las preguntas.</span></div>';
  }
  function pantallaC06(s, p) {
    var mq = maquinaDe(s);
    var extra = s.compra && s.compra.extra ? '<p class="cmp-nota">Taza mug negro Marley Coffee: precio con tu ejecutivo. No suma al total.</p>' : '';
    return '<section class="cmp-sec cmp-confirm"><div class="cmp-wrap">' +
      cabecera('Listo', 'Tu pack quedó confirmado', 'Guardamos tu solicitud. El equipo confirma precio, disponibilidad e instalación antes de formalizar. La confirmación de esta prueba es <mark data-vida="clave">simulada</mark>.', 'cmp-c06-t') +
      '<div class="cmp-resumen-card mc-card"><p><b>' + esc(mq.m.name) + '</b> en comodato · ' + p.enPack.length + ' productos</p><p class="mc-price"><span class="mc-price-label">Total neto referencial</span><strong class="mc-price-value">' + clp(p.total) + '</strong><small>+ IVA · referencial</small></p></div>' + extra +
      '<div class="cmp-acciones"><a class="m5-btn mc-btn mc-btn--main" href="#C09" data-go="C09" data-cierra-tarea="T3" data-cta-principal="ir-portal" data-evt="ir-a-mi-portal">Ir a mi portal</a></div>' +
      '</div></section>';
  }

  /* ---------- Envoltorios de pantalla ---------- */
  function envolver(id, fn) {
    var orig = C.SCREENS[id];
    if (!orig || orig.__cmp) return;
    var nuevo = function () {
      try { return fn(orig); } catch (e) { console.error('compra ' + id, e); return orig(); }
    };
    nuevo.__cmp = true;
    C.SCREENS[id] = nuevo;
  }
  envolver('C04', function (orig) {
    var s = M.get();
    if (C.ui.machineShortcut) { delete C.ui.machineShortcut; ui.selector = true; }
    if (ui.selector) return selectorHTML(s);
    if (s.diag && s.diag.done && !ui.editando) { setTimeout(function () { ir('C05'); }, 0); return orig(); }
    var html = orig();
    var tramo2 = /^(operacion|preferencias)$/.test(s.diag && s.diag.r5QuestionStep || '');
    html = html.replace(/<h1 id="r4-titulo">[^<]*<\/h1>/, '<h1 id="r4-titulo" data-vida="titulo">' + (tramo2 ? 'Te ayudamos a elegir tu solución' : 'Cuéntanos de tu negocio') + '</h1>');
    if (tramo2) html = html.replace(/<p class="r5-c04-bajada">[^<]*<\/p>/, '<p class="r5-c04-bajada">Te ayudamos a elegir la máquina según sus funciones: café para tu volumen y tu forma de servir.</p>');
    html = html.replace(/data-r4-next>/g, 'data-r4-next data-cta-principal="continuar-c04" data-evt="cta-continuar">');
    return html.replace('<div class="r5-single-question"', bloqueSalida() + '<div class="r5-single-question"');
  });
  envolver('C05', function (orig) {
    var s = M.get();
    if (!s.proposal) return orig();
    var p = pack(s);
    if (!p) return orig();
    // Si cambió el tipo de negocio, el carrito vuelve a la cotización de ese tipo.
    if (p.comprador && s.compra && s.compra.negocioPack && s.compra.negocioPack !== p.comprador.id && window.M9Catalog) {
      window.M9Catalog.save([]);
      M.update(function (st) { st.compra = Object.assign({}, st.compra || {}, { negocioPack: p.comprador.id }); });
      p = pack(M.get()) || p;
    }
    cargar();
    return pantallaC05(M.get(), p);
  });
  envolver('C06', function (orig) {
    var s = M.get(), p = pack(s);
    if (!p) return orig();
    return pantallaC06(s, p);
  });
  envolver('C09', function (orig) {
    queueMicrotask(montarPortal);
    return '<div class="cmp-c09-viejo">' + orig() + '</div><div id="portal-host" class="cmp-portal-host"></div>';
  });

  function cargarCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  function montarPortal() {
    var host = document.getElementById('portal-host');
    if (!host || host.getAttribute('data-montado')) return;
    cargarCss('recursos/portal/portal.css?v=20261126ultima');
    if (window.MarleyPortal) { renderPortal(host); return; }
    if (!portalCarga) portalCarga = new Promise(function (resolve, reject) {
      var sc = document.createElement('script'); sc.src = 'recursos/portal/portal.js?v=20261126ultima';
      sc.onload = resolve; sc.onerror = reject; document.body.appendChild(sc);
    }).catch(function () { portalCarga = null; });
    portalCarga.then(function () { renderPortal(host); });
  }
  function renderPortal(host) {
    if (!host.isConnected || host.hasAttribute('data-montado') || !window.MarleyPortal) return;
    window.MarleyPortal.render(host);
    host.setAttribute('data-montado', '1');
  }

  function actualizarCantidad(id, qty, control) {
    var carrusel = document.querySelector('.cmp-deck');
    var posicion = carrusel ? carrusel.scrollLeft : 0;
    var atributo = control.hasAttribute('data-pack-cant') ? 'data-pack-cant' : 'data-pack-cant-input';
    var selector = '[' + atributo + '="' + CSS.escape(control.getAttribute(atributo)) + '"]';
    var teniaFoco = document.activeElement === control;
    escribir(id, qty);
    pintar();
    var nuevo = document.querySelector('.cmp-deck');
    if (nuevo) nuevo.scrollLeft = posicion;
    if (teniaFoco) document.querySelector(selector)?.focus({ preventScroll: true });
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var mq = t.closest && t.closest('[data-maquina-id]');
    if (mq && (ruta() === 'C04' || ruta() === 'C05')) { e.preventDefault(); e.stopImmediatePropagation(); elegirMaquina(mq.getAttribute('data-maquina-id')); return; }
    var sol = t.closest && t.closest('[data-solucion-accion]');
    if (sol) {
      e.preventDefault(); e.stopImmediatePropagation();
      var a = sol.getAttribute('data-solucion-accion');
      if (a === 'ya-se-maquina') { ui.selector = true; pintar(); }
      if (a === 'volver-preguntas') { ui.selector = false; pintar(); }
      return;
    }
    var acc = t.closest && t.closest('[data-pack-accion]');
    if (acc && acc.getAttribute('data-pack-accion') === 'confirmar-contacto') return;
    if (acc) {
      e.preventDefault(); e.stopImmediatePropagation();
      var k = acc.getAttribute('data-pack-accion');
      if (k === 'ver-productos' || k === 'cerrar-productos') {
        ui.verProductos = k === 'ver-productos' && !ui.verProductos;
        pintar();
        document.querySelector(ui.verProductos ? '.cmp-deck' : '[data-pack-accion="ver-productos"]')?.focus();
      }
      if (k === 'cambiar-maquina') { ui.selector = true; ir('C04'); }
      if (k === 'guardar-despues') { M.update(function (st) { st.compra = Object.assign({}, st.compra || {}, { pendiente: true }); }); ir('C02'); }
      if (k === 'cambiar-respuestas') { ui.editando = true; M.update(function (st) { st.diag.done = false; st.diag.step = 0; }); ir('C04'); }
      if (k === 'aceptar') {
        var s = M.get();
        if (!C.contactReady(s) || !window.M4D.comuna(s.answers.comuna)) { ui.contacto = true; ui.error = ''; pintar(); setTimeout(function () { var n = document.getElementById('m4FName'); if (n) n.focus(); }, 0); }
        else aceptar();
      }
      return;
    }
    var cant = t.closest && t.closest('[data-pack-cant]');
    if (cant) {
      e.preventDefault(); e.stopImmediatePropagation();
      var partes = cant.getAttribute('data-pack-cant').split(':'), id = partes[0], delta = Number(partes[1]);
      var actual = (pack(M.get()) || { lineas: [] }).lineas.filter(function (l) { return l.id === id; })[0];
      var nuevo = Math.max(0, Math.min(999, (actual ? actual.qty : 0) + delta));
      actualizarCantidad(id, nuevo, cant);
      return;
    }
    var cruce = t.closest && t.closest('[data-cross]');
    if (cruce) {
      e.preventDefault(); e.stopImmediatePropagation();
      var agregar = cruce.getAttribute('data-cross') === 'agregar';
      M.update(function (st) { st.compra = Object.assign({}, st.compra || {}, { paso: 'fin', extra: agregar ? 'mug' : null }); });
      ir('C06');
    }
  }, true);
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.getAttribute || !el.getAttribute('data-pack-cant-input')) return;
    var id = el.getAttribute('data-pack-cant-input'), v = Math.max(0, Math.min(999, parseInt(el.value, 10) || 0));
    actualizarCantidad(id, v, el);
  }, true);
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'pack-contacto') return;
    e.preventDefault(); e.stopImmediatePropagation();
    var f = e.target, campos = new FormData(f);
    var name = String(campos.get('name')).trim(), mail = String(campos.get('email')).trim(), phone = String(campos.get('phone')).trim();
    function error(campo, texto) { f.querySelector('.cmp-error').textContent = texto; f.elements.namedItem(campo).focus(); }
    if (!name) return error('name', 'Escribe tu nombre para guardar el pack.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return error('email', 'Escribe un correo válido, por ejemplo nombre@empresa.cl.');
    var comuna = campos.get('comuna') || M.get().answers.comuna;
    if (!window.M4D.comuna(comuna)) return error('comuna', 'Elige la comuna de tu local para saber quién te atiende.');
    if (!campos.has('consent')) return error('consent', 'Marca el permiso para que el equipo te responda.');
    M.saveContact({ name: name, email: mail, phone: phone, comuna: comuna, consent: true, marketingConsent: false });
    aceptar();
  }, true);
  window.addEventListener('hashchange', function () {
    var r = ruta();
    if (r !== 'C04') { ui.selector = false; }
    if (r === 'C05' || r === 'C06') { ui.editando = false; }
    if (r !== 'C05') { ui.verProductos = false; ui.contacto = false; }
  });

  window.MarleyCompra = { version: '1.1', pack: function () { return pack(M.get()); }, total: function () { return totalDe(M.get()); }, cargar: cargar };
  cargar().then(function (oferta) { if (oferta && ruta() === 'C04' && ui.selector) pintar(); });
})();
