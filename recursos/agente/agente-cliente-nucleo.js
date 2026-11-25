/* NÚCLEO de la hoja del comprador (se carga bajo demanda desde agente-cliente.js).
 * Chat del comprador · Marley Coffee Empresas (v1.0)
 * Se abre desde el botón existente «Te ayudamos a decidir» (los [data-m7-open] de las rutas C01 a C09).
 * Todo lo responde window.MarleyAgente.motor (determinista, sin modelo externo). Esta capa solo dibuja.
 * Rotulado como simulación. Foco atrapado, Escape, aria-live y botones de 44 px.
 */
(function () {
  'use strict';
  if (window.__agenteClienteListo) return;
  const A = window.MarleyAgenteNucleo;
  if (!A || !A.motor) return;
  window.__agenteClienteListo = true;

  const RAIZ_ID = 'agente-panel';
  let raiz = null;
  let disparador = null;
  let ocupado = false;
  let pendiente = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clp = (n) => (Number.isFinite(Number(n)) && n !== null ? '$' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : 'Por confirmar');
  const rutaActual = () => (location.hash || '#C01').slice(1).split('?')[0];
  const esRutaComprador = () => /^C0[1-9]$/.test(rutaActual());
  // Misma regla que el motor: en el portal (C09) la cuenta es la que muestra el portal; en lo demás, el lead de la sesión.
  const cuentaActual = () => {
    try {
      const s = window.M4 ? window.M4.get() : null;
      const cuentas = window.M4D && Array.isArray(window.M4D.ACCOUNTS) ? window.M4D.ACCOUNTS : [];
      if (rutaActual() === 'C09' && cuentas.length) return String((cuentas.find((a) => a.id === (s && s.demoAccountId)) || cuentas[0]).id);
      return (s && s.lead && s.lead.id) || 'cliente-local';
    } catch (_) { return 'cliente-local'; }
  };
  const ctxCliente = () => ({ lado: 'cliente', rol: 'comprador', cuentaId: cuentaActual(), ruta: rutaActual() });
  const ESPERA = () => 400 + Math.floor(Math.random() * 501); // 400 a 900 ms, como pide el contrato
  const CANAL = { web: 'chat del sitio', whatsapp: 'WhatsApp', correo: 'correo', nota: 'nota' };

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

  // ---------- Mensajes y chips ----------
  function pintarMensaje(m) {
    const comprador = m.rol === 'comprador';
    const clase = comprador ? 'comprador' : (m.envio ? 'equipo' : 'agente');
    const autor = comprador ? 'Tú' : (m.envio ? `Mensaje simulado por ${CANAL[m.canal] || m.canal}` : 'Asistente de IA de Marley');
    const tarjetas = (m.tarjetas || []).map(pintarTarjeta).join('');
    // Lo que Marketing o Ventas envían (simulado) aparece como vista previa del correo o WhatsApp.
    const cuerpo = m.envio
      ? `<section class="agente-card agente-preview" data-agente-envio data-canal="${esc(m.canal)}"><h3>Vista previa (simulación)</h3><p class="agente-nota">${esc(CANAL[m.canal] || m.canal)} · para ${esc(m.para || 'contacto registrado')}</p><p>${esc(m.texto)}</p><p class="agente-nota">Aprobado por una persona de Marley. No salió nada real.</p></section>`
      : `<p class="agente-texto">${esc(m.texto)}</p>`;
    return `<article class="agente-msg agente-msg--${clase}" data-agente-mensaje data-rol="${esc(m.rol)}">
      <p class="agente-autor">${esc(autor)}</p>
      ${cuerpo}${tarjetas}</article>`;
  }
  function pintarChips(lista) {
    const caja = raiz.querySelector('#agente-chips');
    const items = Array.isArray(lista) ? lista : [];
    caja.innerHTML = items.map((c) => `<button type="button" class="agente-chip" data-agente-chip="${esc(c.id)}">${esc(c.texto)}</button>`).join('');
    caja.hidden = items.length === 0 || ocupado;
  }
  function render() {
    if (!raiz) return;
    const log = raiz.querySelector('#agente-log');
    const items = historial();
    const txt = pendiente ? `<article class="agente-msg agente-msg--comprador agente-pendiente" data-agente-mensaje data-rol="comprador"><p class="agente-autor">Tú</p><p class="agente-texto">${esc(pendiente)}</p></article>` : '';
    log.innerHTML = items.map(pintarMensaje).join('') + txt;
    const ultimo = items.slice().reverse().find((m) => m.rol === 'agente' && !m.envio);
    pintarChips(ultimo && Array.isArray(ultimo.chips) ? ultimo.chips : []);
    log.scrollTop = log.scrollHeight;
  }
  function setOcupado(v) {
    if (!raiz) return;
    const campo = raiz.querySelector('#agente-entrada');
    const boton = raiz.querySelector('#agente-enviar');
    const estado = raiz.querySelector('#agente-escribiendo');
    campo.disabled = v;
    boton.disabled = v;
    estado.hidden = !v;
  }

  // ---------- Envío (el motor responde; la interfaz espera 400 a 900 ms) ----------
  function enviar(entrada, etiqueta) {
    if (ocupado || !raiz) return;
    ocupado = true;
    pendiente = etiqueta || entrada.texto || null;
    setOcupado(true);
    render();
    setTimeout(() => {
      try {
        A.motor.responder(ctxCliente(), Object.assign({}, entrada, etiqueta ? { etiqueta } : {}));
      } catch (_) {
        // El motor ya deja su respaldo; si falla, se muestra el historial tal como está.
      }
      pendiente = null;
      ocupado = false;
      setOcupado(false);
      render();
      const campo = raiz.querySelector('#agente-entrada');
      if (campo && !raiz.hidden) campo.focus();
    }, ESPERA());
  }

  // ---------- Panel ----------
  function crear() {
    const div = document.getElementById(RAIZ_ID) || document.createElement('div');
    div.id = RAIZ_ID;
    div.className = 'agente-panel';
    div.hidden = true;
    div.innerHTML = `
      <div class="agente-fondo" data-agente-cerrar aria-hidden="true"></div>
      <section class="agente-hoja" role="dialog" aria-modal="true" aria-labelledby="m7-title" aria-describedby="agente-aviso">
        <header class="agente-cab">
          <div>
            <p class="agente-kicker">Marley Coffee Empresas · simulación</p>
            <h2 id="m7-title" tabindex="-1">Te ayudamos a decidir</h2>
            <p id="agente-aviso" class="agente-aviso">Asistente de IA de Marley; una persona revisa precios y excepciones. Sin envíos reales.</p>
          </div>
          <button type="button" class="agente-cerrar" data-agente-cerrar aria-label="Cerrar el asistente">×</button>
        </header>
        <div id="agente-log" class="agente-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversación con el asistente"></div>
        <p id="agente-escribiendo" class="agente-escribiendo" role="status" hidden>Escribiendo…</p>
        <div id="agente-chips" class="agente-chips" role="group" aria-label="Opciones rápidas" hidden></div>
        <div class="agente-acciones">
          <button type="button" class="agente-persona" data-agente-accion="derivar-persona">Hablar con una persona (con resumen)</button>
        </div>
        <form id="agente-form" class="agente-form" autocomplete="off">
          <label for="agente-entrada" class="agente-sr">Escribe tu pregunta</label>
          <textarea id="agente-entrada" rows="1" maxlength="500" placeholder="Escribe tu pregunta…"></textarea>
          <button id="agente-enviar" type="submit" class="agente-enviar">Enviar</button>
        </form>
      </section>`;
    if (!div.isConnected) document.body.appendChild(div);
    raiz = div;
    raiz.addEventListener('click', onClick);
    raiz.querySelector('#agente-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const campo = raiz.querySelector('#agente-entrada');
      const v = campo.value.trim();
      if (!v || ocupado) return;
      campo.value = '';
      enviar({ texto: v });
    });
    raiz.querySelector('#agente-entrada').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        raiz.querySelector('#agente-form').requestSubmit();
      }
    });
    raiz.addEventListener('keydown', onTab);
  }

  function onClick(ev) {
    const t = ev.target && ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-agente-cerrar]')) { cerrar(); return; }
    if (ocupado) return;
    const chip = t.closest('[data-agente-chip]');
    if (chip) {
      const etiqueta = chip.textContent.trim();
      enviar({ opcion: chip.dataset.agenteChip }, etiqueta);
      return;
    }
    const acc = t.closest('[data-agente-accion]');
    if (acc && acc.dataset.agenteAccion === 'derivar-persona') {
      enviar({ opcion: 'persona' }, 'Hablar con una persona');
    }
  }

  // Foco atrapado dentro de la hoja mientras está abierta.
  function onTab(ev) {
    if (ev.key !== 'Tab' || !raiz || raiz.hidden) return;
    const foco = Array.from(raiz.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => el.offsetParent !== null);
    if (!foco.length) return;
    const primero = foco[0];
    const ultimo = foco[foco.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  }

  function abrir(origen) {
    if (!raiz) crear();
    disparador = origen || document.activeElement;
    raiz.hidden = false;
    document.body.classList.add('agente-abierto');
    render();
    raiz.querySelector('#m7-title').focus({ preventScroll: true });
    if (!historial().length && !ocupado) enviar({ opcion: 'inicio' }, '');
  }

  function cerrar() {
    if (!raiz || raiz.hidden) return;
    raiz.hidden = true;
    document.body.classList.remove('agente-abierto');
    const d = disparador;
    disparador = null;
    if (d && typeof d.focus === 'function' && document.contains(d)) d.focus({ preventScroll: true });
  }


  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && raiz && !raiz.hidden) { ev.preventDefault(); cerrar(); }
  });
  window.addEventListener('hashchange', () => { if (!esRutaComprador()) cerrar(); });

  // Si el equipo escribe al comprador mientras la hoja está abierta, se ve al instante.
  A.eventos.on('mensaje', () => { if (raiz && !raiz.hidden && !ocupado) render(); });
  A.eventos.on('envio', () => { if (raiz && !raiz.hidden && !ocupado) render(); });
  window.addEventListener('storage', (ev) => { if (ev.key === 'marley.agente.v1' && raiz && !raiz.hidden && !ocupado) render(); });

  crear();
  window.MarleyAgenteClienteNucleo = { abrir: (o) => abrir(o), cerrar, esRuta: esRutaComprador };
})();
