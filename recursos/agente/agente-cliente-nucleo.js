/* NÚCLEO del chat del comprador · Marley Coffee Empresas (v1.1)
 * Se carga bajo demanda desde agente-cliente.js. Dos formas del mismo chat:
 *  - el panel («Te ayudamos a decidir», [data-m7-open] en C01 a C09): hoja superpuesta, Escape y foco atrapado;
 *  - el chat incrustado en #agente-portal (C09; B2 pone el contenedor y agente-cliente.js lo monta): sin superponer nada.
 * Todo lo responde window.MarleyAgenteNucleo.motor (determinista, sin modelo externo). Esta capa solo dibuja.
 * Estado visible (data-agente-estado en la hoja): asistente · esperando-persona · persona-unida.
 * Rotulado como simulación. aria-live y botones de 44 px.
 */
(function () {
  'use strict';
  if (window.__agenteClienteListo) return;
  const A = window.MarleyAgenteNucleo;
  if (!A || !A.motor) return;
  window.__agenteClienteListo = true;

  const RAIZ_ID = 'agente-panel';
  const ESPERA = () => 400 + Math.floor(Math.random() * 501); // 400 a 900 ms, como pide el contrato
  const CANAL = { web: 'chat del sitio', whatsapp: 'WhatsApp', correo: 'correo', nota: 'nota' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clp = (n) => (Number.isFinite(Number(n)) && n !== null ? '$' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : 'Por confirmar');
  const rutaActual = () => (location.hash || '#C01').slice(1).split('?')[0];
  const esRutaComprador = () => /^C0[1-9]$/.test(rutaActual());
  // Misma regla que el motor: en el portal (C09) la cuenta es la que muestra el portal; en lo demás, el lead de la sesión.
  const cuentaActual = () => {
    try {
      const s = window.M4 ? window.M4.get() : null;
      const cuentas = window.M4D && Array.isArray(window.M4D.ACCOUNTS) ? window.M4D.ACCOUNTS : [];
      if (rutaActual() === 'C09' && s?.customerCycle && s.lead?.id) return String(s.lead.id);
      if (rutaActual() === 'C09' && cuentas.length) return String((cuentas.find((a) => a.id === (s && s.demoAccountId)) || cuentas[0]).id);
      return (s && s.lead && s.lead.id) || 'cliente-local';
    } catch (_) { return 'cliente-local'; }
  };
  const ctxCliente = () => ({ lado: 'cliente', rol: 'comprador', cuentaId: cuentaActual(), ruta: rutaActual() });
  const instancias = [];
  let incrustado = null;

  function historial() {
    let st = null;
    try { st = A.estado.get(); } catch (_) { st = null; }
    const conv = st && st.conversaciones ? st.conversaciones : {};
    // Cada clave se lee una sola vez: con un comprador anónimo la cuenta es «cliente-local» y los mensajes no deben salir dobles.
    const claves = [...new Set(['cliente-local', cuentaActual()])];
    const mezcla = claves.reduce((acc, k) => acc.concat(conv[k] || []), []);
    return mezcla.filter((m) => m && m.canal !== 'nota').sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }

  // ---------- Tarjetas ----------
  function tarjetaCotizacion(t) {
    const lineas = (t.lineas || []).map((l) => `<li><span>${esc(l.t)}<small>${esc(l.d || '')}</small></span><b>${esc(clp(l.precio))}</b></li>`).join('');
    const cb = t.cargaBase || {};
    const pend = (t.pendientes || []).map((p) => `<li>${esc(p)}</li>`).join('');
    const maq = t.maquina || {};
    return `<section class="agente-card" aria-label="${esc(t.titulo || 'Cotización')}">
      <h3>${esc(t.titulo || 'Cotización')}</h3>
      <dl class="agente-filas">
        <div><dt>Máquina</dt><dd>${esc(maq.nombre || '—')}</dd></div>
        ${maq.tipo ? `<div><dt>Tipo</dt><dd>${esc(maq.tipo)}</dd></div>` : ''}
        <div><dt>Tazas al día</dt><dd>${esc(t.tazas != null ? t.tazas : 'Por confirmar')}</dd></div>
        ${t.consumo ? `<div><dt>Consumo estimado</dt><dd>${esc(t.consumo)}</dd></div>` : ''}
      </dl>
      ${lineas ? `<h4>Insumos (precio de referencia)</h4><ul class="agente-lista">${lineas}</ul>` : ''}
      ${Number.isFinite(Number(t.totalPropuesta)) ? `<dl class="agente-filas"><div class="agente-total"><dt>Total neto referencial</dt><dd>${esc(clp(t.totalPropuesta))} + IVA</dd></div></dl>` : ''}
      <h4>Carga base antes de instalar</h4>
      <dl class="agente-filas">
        <div><dt>Kit de instalación</dt><dd>${esc(clp(cb.kit))}</dd></div>
        <div><dt>Filtro</dt><dd>${esc(clp(cb.filtro))}</dd></div>
        <div><dt>Paquete de insumos de referencia</dt><dd>${esc(clp(cb.insumos))}</dd></div>
        <div class="agente-total"><dt>Total neto antes de instalar</dt><dd>${esc(clp(cb.total))} + IVA</dd></div>
      </dl>
      ${pend ? `<h4>Por confirmar con tu ejecutivo</h4><ul class="agente-pend">${pend}</ul>` : ''}
      ${t.nota ? `<p class="agente-nota">${esc(t.nota)}</p>` : ''}
    </section>`;
  }
  function tarjetaLista(t) {
    const items = (t.items || []).map((i) => `<li${i.fuerte ? ' class="agente-fuerte"' : ''}><span>${esc(i.t)}${i.d ? `<small>${esc(i.d)}</small>` : ''}</span>${i.v ? `<b>${esc(i.v)}</b>` : ''}</li>`).join('');
    return `<section class="agente-card"><h3>${esc(t.titulo || '')}</h3><ul class="agente-lista">${items}</ul>${t.nota ? `<p class="agente-nota">${esc(t.nota)}</p>` : ''}</section>`;
  }
  function tarjetaFicha(t) {
    const filas = (t.filas || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    return `<section class="agente-card"><h3>${esc(t.titulo || '')}</h3><dl class="agente-filas">${filas}</dl>${t.nota ? `<p class="agente-nota">${esc(t.nota)}</p>` : ''}</section>`;
  }
  function tarjetaFolio(t) {
    return `<section class="agente-card agente-folio-card"><h3>Folio ${esc(t.folio)}</h3><p><b>Estado:</b> ${esc(t.estado || '')}</p><p><b>Siguiente paso:</b> ${esc(t.siguiente || '')}</p></section>`;
  }
  function tarjetaMensaje(t) {
    return `<section class="agente-card agente-preview"><h3>Vista previa (simulación)</h3><p class="agente-nota">${esc(CANAL[t.canal] || t.canal)} · para ${esc(t.para || 'contacto registrado')}</p><p>${esc(t.texto)}</p><p class="agente-nota">${esc(t.estado || '')}</p></section>`;
  }
  function pintarTarjeta(t) {
    if (!t) return '';
    if (t.tipo === 'cotizacion') return tarjetaCotizacion(t);
    if (t.tipo === 'lista') return tarjetaLista(t);
    if (t.tipo === 'ficha') return tarjetaFicha(t);
    if (t.tipo === 'folio') return tarjetaFolio(t);
    if (t.tipo === 'mensaje') return tarjetaMensaje(t);
    return '';
  }

  // ---------- Mensajes ----------
  function pintarMensaje(m) {
    const tarjetas = (m.tarjetas || []).map(pintarTarjeta).join('');
    // Una persona del equipo que se une (lo escribe el CRM al tomar la conversación).
    if (m.rol === 'persona') {
      return `<article class="agente-msg agente-msg--persona" data-agente-mensaje data-rol="persona">
        <p class="agente-autor">${esc(m.autor || 'Una persona de Marley')}</p>
        <p class="agente-texto">${esc(m.texto)}</p>${tarjetas}</article>`;
    }
    const comprador = m.rol === 'comprador';
    const clase = comprador ? 'comprador' : (m.envio ? 'equipo' : 'agente');
    const autor = comprador ? 'Tú' : (m.envio ? `Mensaje simulado por ${CANAL[m.canal] || m.canal}` : 'Asistente de IA de Marley');
    // Lo que Marketing o Ventas envían (simulado) aparece como vista previa del correo o WhatsApp.
    const cuerpo = m.envio
      ? `<section class="agente-card agente-preview" data-agente-envio data-canal="${esc(m.canal)}"><h3>Vista previa (simulación)</h3><p class="agente-nota">${esc(CANAL[m.canal] || m.canal)} · para ${esc(m.para || 'contacto registrado')}</p><p>${esc(m.texto)}</p><p class="agente-nota">Aprobado por una persona de Marley. No salió nada real.</p></section>`
      : `<p class="agente-texto">${esc(m.texto)}</p>`;
    return `<article class="agente-msg agente-msg--${clase}" data-agente-mensaje data-rol="${esc(m.rol)}">
      <p class="agente-autor">${esc(autor)}</p>
      ${cuerpo}${tarjetas}</article>`;
  }

  // Estado de la espera según el motor: la persona que falta o la que ya se unió.
  function infoEstado() {
    const st = A.espera && A.espera.estado ? A.espera.estado(cuentaActual()) : null;
    if (!st || !st.estado) return null;
    const t = st.traspaso || {};
    if (st.estado === 'esperando-persona') {
      return { estado: 'esperando-persona', texto: `Esperando a ${t.a === 'ventas' ? 'una persona de Ventas' : 'una persona de Soporte'}. Mientras llega, sigo contigo.` };
    }
    return { estado: 'persona-unida', texto: `${t.tomadoPor || 'Una persona de Soporte'} se unió a la conversación. Ya tiene tu resumen: no tienes que repetirlo.` };
  }

  // ---------- Plantilla (el panel conserva sus ids; el chat incrustado no repite ids de la página) ----------
  function plantilla(modo) {
    const panel = modo === 'panel';
    const id = (nombre) => (panel ? ` id="${nombre}"` : '');
    const cab = panel
      ? `<header class="agente-cab"><div><p class="agente-kicker">Marley Coffee Empresas · simulación</p><h2${id('m7-title')} data-agente-parte="titulo" tabindex="-1">Te ayudamos a decidir</h2><p${id('agente-aviso')} class="agente-aviso">Asistente de IA de Marley; una persona revisa precios y excepciones. Sin envíos reales.</p></div><button type="button" class="agente-cerrar" data-agente-cerrar aria-label="Cerrar el asistente">×</button></header>`
      : `<header class="agente-cab agente-cab--incrustado"><div><p class="agente-kicker">Marley Coffee Empresas · simulación</p><h3 class="agente-titulo" data-agente-parte="titulo" tabindex="-1">Asistente de Marley</h3><p class="agente-aviso">Asistente de IA de Marley; una persona revisa precios y excepciones. Sin envíos reales.</p></div></header>`;
    const hoja = panel
      ? `<section class="agente-hoja" data-agente-estado="asistente" role="dialog" aria-modal="true" aria-labelledby="m7-title" aria-describedby="agente-aviso">`
      : `<section class="agente-hoja agente-hoja--incrustado" data-agente-estado="asistente" role="region" aria-label="Asistente de Marley">`;
    return `${panel ? '<div class="agente-fondo" data-agente-cerrar aria-hidden="true"></div>' : ''}
      ${hoja}
        ${cab}
        <p class="agente-estado" data-agente-parte="estado" hidden></p>
        <div${id('agente-log')} class="agente-log" data-agente-parte="log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversación con el asistente"></div>
        <p${id('agente-escribiendo')} class="agente-escribiendo" data-agente-parte="escribiendo" role="status" hidden>Escribiendo…</p>
        <div${id('agente-chips')} class="agente-chips" data-agente-parte="chips" role="group" aria-label="Opciones rápidas" hidden></div>
        <div class="agente-acciones"><button type="button" class="agente-persona" data-agente-accion="derivar-persona">Hablar con una persona (con resumen)</button></div>
        <form${id('agente-form')} class="agente-form" autocomplete="off" data-agente-parte="form">
          ${panel ? '<label class="agente-sr" for="agente-entrada">Escribe tu pregunta</label>' : ''}
          <textarea id="agente-entrada" data-agente-parte="entrada" rows="1" maxlength="500" placeholder="${panel ? 'Escribe tu pregunta…' : 'Tu pregunta…'}"${panel ? '' : ' aria-label="Escribe tu pregunta"'}></textarea>
          <button id="agente-enviar" type="submit" class="agente-enviar" data-agente-parte="enviar">Enviar</button>
        </form>
      </section>`;
  }

  // #agente-entrada y #agente-enviar existen una sola vez en la página: en el panel mientras está abierto;
  // si está cerrado, en el chat del portal (#agente-portal). Así los selectores sin ámbito siguen siendo únicos.
  function sincronizarIds() {
    const abierto = Boolean(panel) && !panel.raiz.hidden;
    const poner = (raiz, activo) => {
      const ta = raiz.querySelector('[data-agente-parte="entrada"]');
      const bt = raiz.querySelector('[data-agente-parte="enviar"]');
      if (ta) { if (activo) ta.id = 'agente-entrada'; else ta.removeAttribute('id'); }
      if (bt) { if (activo) bt.id = 'agente-enviar'; else bt.removeAttribute('id'); }
    };
    if (panel) poner(panel.raiz, abierto);
    instancias.forEach((c) => { if (c.modo === 'incrustado') poner(c.raiz, !abierto); });
  }

  // ---------- Una instancia del chat (panel o incrustado) ----------
  function crearChat(raiz, modo) {
    const est = { ocupado: false, pendiente: null, disparador: null };
    const q = (sel) => raiz.querySelector(sel);
    const hoja = () => raiz.querySelector('.agente-hoja');

    function pintarChips(lista) {
      const caja = q('[data-agente-parte="chips"]');
      const items = Array.isArray(lista) ? lista : [];
      caja.innerHTML = items.map((c) => `<button type="button" class="agente-chip" data-agente-chip="${esc(c.id)}">${esc(c.texto)}</button>`).join('');
      caja.hidden = items.length === 0 || est.ocupado;
    }
    function pintarEstado() {
      const info = infoEstado();
      const h = hoja();
      if (h) h.setAttribute('data-agente-estado', info ? info.estado : 'asistente');
      const banner = q('[data-agente-parte="estado"]');
      banner.hidden = !info;
      banner.className = 'agente-estado' + (info ? ' agente-estado--' + (info.estado === 'persona-unida' ? 'unida' : 'espera') : '');
      banner.textContent = info ? info.texto : '';
    }
    function render() {
      const log = q('[data-agente-parte="log"]');
      if (!log) return;
      const items = historial();
      const txt = est.pendiente ? `<article class="agente-msg agente-msg--comprador agente-pendiente" data-agente-mensaje data-rol="comprador"><p class="agente-autor">Tú</p><p class="agente-texto">${esc(est.pendiente)}</p></article>` : '';
      log.innerHTML = items.map(pintarMensaje).join('') + txt;
      const ultimo = items.slice().reverse().find((m) => m.rol === 'agente' && !m.envio);
      pintarChips(ultimo && Array.isArray(ultimo.chips) ? ultimo.chips : []);
      pintarEstado();
      log.scrollTop = log.scrollHeight;
    }
    function setOcupado(v) {
      est.ocupado = v;
      q('[data-agente-parte="entrada"]').disabled = v;
      q('[data-agente-parte="enviar"]').disabled = v;
      q('[data-agente-parte="escribiendo"]').hidden = !v;
      if (v) q('[data-agente-parte="chips"]').hidden = true;
    }
    // Pestaña del portal (acción «ir-pestana» del motor): en el panel se cierra la hoja para verla.
    function irPestana(p) {
      if (modo === 'panel') cerrar();
      const ir = () => {
        const tab = document.querySelector(`[data-portal-tab="${p}"]`);
        if (tab) { tab.click(); return true; }
        return false;
      };
      if (!ir()) { location.hash = '#C09'; setTimeout(ir, 700); }
    }
    // El motor responde en 400 a 900 ms; mientras tanto la interfaz muestra «Escribiendo…».
    function enviar(entrada, etiqueta) {
      if (est.ocupado) return;
      const contexto = ctxCliente();
      est.ocupado = true;
      est.pendiente = etiqueta || entrada.texto || null;
      setOcupado(true);
      render();
      setTimeout(() => {
        let salida = null;
        try { salida = A.motor.responder(contexto, Object.assign({}, entrada, etiqueta ? { etiqueta } : {})); } catch (_) { salida = null; }
        est.pendiente = null;
        est.ocupado = false;
        setOcupado(false);
        render();
        const acciones = salida && Array.isArray(salida.acciones) ? salida.acciones : [];
        if (contexto.cuentaId === cuentaActual() && esRutaComprador()) acciones.filter((a) => a.tipo === 'ir-pestana').forEach((a) => irPestana(a.pestana));
        const campo = q('[data-agente-parte="entrada"]');
        if (campo && !raiz.hidden && modo === 'panel') campo.focus();
      }, ESPERA());
    }
    function onClick(ev) {
      const t = ev.target && ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-agente-cerrar]')) { cerrar(); return; }
      if (est.ocupado) return;
      const chipEl = t.closest('[data-agente-chip]');
      if (chipEl) { enviar({ opcion: chipEl.dataset.agenteChip }, chipEl.textContent.trim()); return; }
      const acc = t.closest('[data-agente-accion]');
      if (acc && acc.dataset.agenteAccion === 'derivar-persona') enviar({ opcion: 'persona' }, 'Hablar con una persona');
    }
    // Foco atrapado dentro de la hoja mientras el panel está abierto.
    function onTab(ev) {
      if (ev.key !== 'Tab' || modo !== 'panel' || raiz.hidden) return;
      const foco = Array.from(raiz.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!foco.length) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
    }
    function abrir(origen) {
      est.disparador = origen || document.activeElement;
      raiz.hidden = false;
      sincronizarIds();
      document.body.classList.add('agente-abierto');
      render();
      const t = q('[data-agente-parte="titulo"]');
      if (t) t.focus({ preventScroll: true });
      if (!historial().length && !est.ocupado) enviar({ opcion: 'inicio' }, '');
    }
    function cerrar() {
      if (modo !== 'panel' || raiz.hidden) return;
      raiz.hidden = true;
      sincronizarIds();
      document.body.classList.remove('agente-abierto');
      const d = est.disparador;
      est.disparador = null;
      if (d && typeof d.focus === 'function' && document.contains(d)) d.focus({ preventScroll: true });
    }

    raiz.addEventListener('click', onClick);
    raiz.addEventListener('keydown', onTab);
    q('[data-agente-parte="form"]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const campo = q('[data-agente-parte="entrada"]');
      const v = campo.value.trim();
      if (!v || est.ocupado) return;
      campo.value = '';
      enviar({ texto: v });
    });
    q('[data-agente-parte="entrada"]').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        q('[data-agente-parte="form"]').requestSubmit();
      }
    });
    return { raiz, modo, render, enviar, abrir, cerrar, estaOcupado: () => est.ocupado };
  }

  // ---------- Panel flotante (el de siempre) ----------
  let panel = null;
  function crearPanel() {
    let div = document.getElementById(RAIZ_ID);
    if (!div) { div = document.createElement('div'); document.body.appendChild(div); }
    div.id = RAIZ_ID;
    div.className = 'agente-panel';
    div.hidden = true;
    div.innerHTML = plantilla('panel');
    const chat = crearChat(div, 'panel');
    instancias.push(chat);
    return chat;
  }

  // ---------- Chat incrustado en #agente-portal (lo monta agente-cliente.js; sin ids repetidos) ----------
  function montarIncrustado(host) {
    if (!host?.isConnected) return null;
    // El portal (B2) deja un texto de espera dentro de #agente-portal: el chat lo reemplaza.
    host.querySelectorAll(':scope > .mp-agente-espera').forEach((n) => n.remove());
    const previo = host.querySelector(':scope > [data-agente-modo="incrustado"]');
    if (previo && previo.__agenteChat) return previo.__agenteChat;
    if (previo) previo.remove(); // marco provisional de agente-cliente.js: se reemplaza por el chat completo
    const cuenta = cuentaActual();
    if (!incrustado || incrustado.cuenta !== cuenta) {
      const div = document.createElement('div');
      div.className = 'agente-incrustado';
      div.setAttribute('data-agente-modo', 'incrustado');
      div.innerHTML = plantilla('incrustado');
      const chat = crearChat(div, 'incrustado');
      div.__agenteChat = chat;
      incrustado = { cuenta, chat };
    }
    const { chat } = incrustado;
    host.appendChild(chat.raiz);
    if (!instancias.includes(chat)) instancias.push(chat);
    sincronizarIds();
    chat.render();
    if (!historial().length && !chat.estaOcupado()) chat.enviar({ opcion: 'inicio' }, '');
    return chat;
  }

  // Los botones rápidos del portal (B2) avisan con «marley:portal-pregunta» sobre #agente-portal; el evento burbujea a document,
  // así no se pierde aunque B2 vuelva a pintar el contenedor. Se lee «texto» y «pregunta» queda de respaldo.
  document.addEventListener('marley:portal-pregunta', (ev) => {
    const host = ev.target && ev.target.closest ? ev.target.closest('#agente-portal') : null;
    const d = ev.detail || {};
    const pregunta = d.texto || d.pregunta;
    if (!host || !pregunta) return;
    const previo = host.querySelector(':scope > [data-agente-modo="incrustado"]');
    const chat = previo && previo.__agenteChat ? previo.__agenteChat : montarIncrustado(host);
    if (chat) chat.enviar({ texto: String(pregunta) });
  });

  // Tras cada evento del motor (mensaje, envío, traspaso, aviso) se repinta lo que está en pantalla.
  function repintar() {
    for (let i = instancias.length - 1; i >= 0; i--) if (!instancias[i].raiz.isConnected) instancias.splice(i, 1);
    instancias.forEach((c) => { if (!c.estaOcupado() && (c.modo === 'incrustado' || !c.raiz.hidden)) c.render(); });
  }
  // Escape cierra solo el panel: no sigue hasta los demás manejadores del sitio (que cierran todos los «details» abiertos, incluido el agente del portal).
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && panel && !panel.raiz.hidden) { ev.preventDefault(); ev.stopPropagation(); panel.cerrar(); }
  });
  window.addEventListener('hashchange', () => { if (!esRutaComprador() && panel) panel.cerrar(); });
  ['mensaje', 'envio', 'traspaso', 'notificacion'].forEach((tipo) => A.eventos.on(tipo, repintar));
  window.addEventListener('storage', (ev) => { if (ev.key === 'marley.agente.v1') repintar(); });

  panel = crearPanel();
  sincronizarIds();
  window.MarleyAgenteClienteNucleo = {
    abrir: (o) => panel.abrir(o),
    cerrar: () => panel.cerrar(),
    esRuta: esRutaComprador,
    montar: (host) => montarIncrustado(host),
  };
})();
