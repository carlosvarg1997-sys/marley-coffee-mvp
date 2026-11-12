/* Landing de campaña por comprador · Marley Coffee Empresas (prototipo académico)

   Requisitos técnicos (no se experimenta con ellos):
   - La procedencia llega en el enlace de la campaña (utm_* y mc_*), se conserva y se entrega al portal.
   - Se distingue el primer origen conocido del último.
   - Tres estados: A visitante anónimo (solo eventos) · B contacto parcial enviado en el paso 1
     · C lead confirmado al enviar el paso 2. Nada de lo escrito se guarda si la persona no lo envía.
   - "lead_created" se registra solo después de la confirmación (aquí simulada) del servidor.
   - No se envía nada fuera de este navegador.

   Hipótesis que este archivo permite comparar (interruptores en la dirección):
   - ?f=inicio | despues   → formulario en el primer bloque o después del contexto
   - ?nav=min | contexto   → sin enlaces de salida o con enlaces de contexto
   - ?m=<mensaje>          → argumento del titular (por ejemplo: continuidad)
   - ?media=static, ?motion=off → sin video, sin movimiento */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('nm-js');

  const cfg = JSON.parse(document.getElementById('ld-config').textContent);
  const params = new URLSearchParams(location.search || '');
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) { return null; } };
  const guardar = (clave, valor) => { try { const json = JSON.stringify(valor); localStorage.setItem(clave, json); return localStorage.getItem(clave) === json; } catch (_) { return false; } };
  const borrar = (clave) => { try { localStorage.removeItem(clave); } catch (_) { /* sin almacenamiento */ } };
  const KIT_SESSION_KEY = 'mc_prueba_sesion_actual_v1';
  const kitSession = () => { const session = leer(KIT_SESSION_KEY); return session && session.id && session.estado !== 'cerrada' ? session : null; };
  function kitFichaValues(session) {
    const ficha = session?.ficha;
    if (!ficha || typeof ficha !== 'object') return null;
    const sources = [ficha, ficha.contacto, ficha.datos, ficha.persona, ficha.lead].filter((item) => item && typeof item === 'object');
    const pick = (keys) => {
      for (const source of sources) for (const key of keys) {
        let value = source[key];
        if (value && typeof value === 'object') value = value.nombre ?? value.name ?? value.valor ?? value.value ?? '';
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
      }
      return '';
    };
    return {
      nombre: pick(['nombre', 'nombreCompleto', 'name', 'fullName']),
      correo: pick(['correo', 'correoElectronico', 'email', 'mail']),
      empresa: pick(['empresa', 'company', 'negocio', 'business', 'razonSocial', 'razon_social']),
      telefono: pick(['telefono', 'teléfono', 'celular', 'phone', 'mobile']),
    };
  }
  function prefillKitForm(form) {
    const session = kitSession(), values = kitFichaValues(session);
    if (!form || !session || !values) return false;
    if (form.dataset.mcFichaSession !== String(session.id)) {
      form.dataset.mcFichaSession = String(session.id);
      const selectors = { nombre: '[name="nombre"]', correo: '[name="correo"]', empresa: '[name="empresa"]', telefono: '[name="telefono"]' };
      for (const [key, selector] of Object.entries(selectors)) {
        const input = form.querySelector(selector), value = values[key];
        if (!input || input.type === 'checkbox' || !value || String(input.value || '').trim()) continue;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return true;
  }
  function normalizeKitTargets() {
    const session = kitSession();
    if (!session || session.modo !== 'autoguiado' || window === window.top) return;
    document.querySelectorAll('a[target="_blank"]').forEach((anchor) => {
      try { if (new URL(anchor.href, location.href).origin === location.origin) anchor.target = '_self'; } catch (_) { /* enlace inválido */ }
    });
  }
  const normalizeTargetsObserver = new MutationObserver(normalizeKitTargets);
  normalizeTargetsObserver.observe(document.documentElement, { childList: true, subtree: true });
  normalizeKitTargets();

  const preferenciaMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  const movimientoForzadoOff = params.get('motion') === 'off';
  const sinMovimiento = preferenciaMovimiento.matches || movimientoForzadoOff;
  const medioEstatico = params.get('media') === 'static';

  /* ---------- Variantes de experimento ---------- */
  const variante = {
    f: params.get('f') === 'inicio' ? 'inicio' : 'despues',
    form: params.get('form') === 'directo' ? 'directo' : 'progresivo',
    nav: params.get('nav') === 'contexto' ? 'contexto' : 'min',
    m: cfg.mensajes && cfg.mensajes[params.get('m')] ? params.get('m') : cfg.mensajeBase,
    media: medioEstatico ? 'static' : 'video',
  };
  document.body.classList.add('ld--form-' + variante.f, 'ld--pasos-' + variante.form, 'ld--nav-' + variante.nav);
  const mensaje = cfg.mensajes ? cfg.mensajes[variante.m] : null;
  if (mensaje && variante.m !== cfg.mensajeBase) {
    $('#ld-h1').textContent = mensaje.h1;
    $('#ld-lead').textContent = mensaje.lead;
  }

  /* ---------- Procedencia: primer y último origen conocido ---------- */
  const CLAVES = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'fbclid', 'li_fat_id',
    'mc_source', 'mc_session', 'mc_phase', 'mc_variant', 'mc_assignment', 'mc_order', 'mc_query_id', 'mc_surface', 'mc_entry_surface',
    'mc_first_click_ms', 'mc_first_click_surface', 'test', 'qa', 'journey', 'journey_started_at', 'return'];
  const limpio = (v) => String(v || '').trim().slice(0, 120);
  const ultimoOrigen = {};
  CLAVES.forEach((k) => { const v = limpio(params.get(k)); if (v) ultimoOrigen[k] = v; });
  let primerOrigen = leer('mc_first_touch_v1');
  if (!primerOrigen) {
    primerOrigen = { at: new Date().toISOString(), landing: cfg.slug, params: { ...ultimoOrigen } };
    guardar('mc_first_touch_v1', primerOrigen);
  }

  function urlConOrigen(destino, superficie, pantalla) {
    const u = new URL(destino, location.href);
    Object.entries(ultimoOrigen).forEach(([k, v]) => u.searchParams.set(k, v));
    if (ultimoOrigen.mc_surface) u.searchParams.set('mc_entry_surface', ultimoOrigen.mc_entry_surface || ultimoOrigen.mc_surface);
    u.searchParams.set('mc_surface', superficie);
    u.searchParams.set('mc_landing', cfg.buyer);
    if (pantalla) u.hash = pantalla;
    return u.toString();
  }

  /* ---------- Medición simulada (no sale del navegador) ---------- */
  const eventos = (() => {
    try { const saved = JSON.parse(sessionStorage.getItem('mc_landing_events_v1') || '[]'); return Array.isArray(saved) ? saved.slice(-200) : []; }
    catch (_) { return []; }
  })();
  const panelQa = $('#ld-qa');
  function registrar(evento, datos = {}) {
    eventos.push({ event: evento, at: new Date().toISOString(), buyer: cfg.buyer, landing: cfg.slug, variant: variante, ...datos });
    if (eventos.length > 200) eventos.splice(0, eventos.length - 200);
    try { sessionStorage.setItem('mc_landing_events_v1', JSON.stringify(eventos)); } catch (_) { /* sin almacenamiento */ }
    pintarQa();
  }
  function pintarQa() {
    if (!panelQa || params.get('qa') !== '1' || params.get('test') === 'sitio' || params.has('journey')) return;
    panelQa.hidden = false;
    const ocultar = ['event', 'at', 'buyer', 'landing', 'variant'];
    panelQa.textContent = 'REVISIÓN (?qa=1) · medición simulada, no sale de este navegador'
      + '\n\nVariante: ' + JSON.stringify(variante)
      + '\nÚltimo origen: ' + (Object.keys(ultimoOrigen).length ? JSON.stringify(ultimoOrigen) : 'sin parámetros')
      + '\nPrimer origen: ' + JSON.stringify(primerOrigen.params) + ' · ' + primerOrigen.at
      + '\n\nEventos:\n' + eventos.map((e) => '· ' + e.event + ' ' + JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !ocultar.includes(k))))).join('\n');
  }

  /* ---------- Enlaces de contexto (solo en la variante nav=contexto) ---------- */
  $$('[data-contexto]').forEach((a) => {
    a.href = urlConOrigen(a.getAttribute('href'), 'landing-' + cfg.slug + '-' + a.dataset.contexto, a.dataset.pantalla || '');
    a.addEventListener('click', () => registrar('context_link_click', { surface: a.dataset.contexto }));
  });

  /* ---------- Video del héroe: póster, movimiento reducido y control ---------- */
  const video = $('[data-hero-video]');
  const controlVideo = $('#ld-video-toggle');
  const avisoMovimiento = $('#ld-motion-status');
  if (video && controlVideo && avisoMovimiento && !medioEstatico) {
    const movil = matchMedia('(max-width: 760px)').matches;
    let pausaManual = false;
    video.muted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    const actualizarControl = () => {
      const reproduciendo = !video.paused && !video.ended;
      controlVideo.textContent = reproduciendo ? 'Pausar video' : 'Reproducir video';
      controlVideo.setAttribute('aria-pressed', String(reproduciendo));
    };
    const mostrarPoster = () => {
      video.pause();
      video.classList.remove('es-activo');
      video.removeAttribute('src');
      video.load();
      actualizarControl();
    };
    const cargar = () => { if (!video.src) video.src = movil ? video.dataset.srcM : video.dataset.srcD; };
    const reproducir = () => {
      if (preferenciaMovimiento.matches || movimientoForzadoOff) {
        pausaManual = true;
        mostrarPoster();
        controlVideo.hidden = true;
        avisoMovimiento.hidden = false;
        return;
      }
      cargar();
      const intento = video.play();
      if (intento && typeof intento.catch === 'function') {
        intento.catch(() => { pausaManual = true; mostrarPoster(); });
      }
    };
    video.addEventListener('playing', () => { video.classList.add('es-activo'); actualizarControl(); });
    video.addEventListener('pause', actualizarControl);
    controlVideo.addEventListener('click', () => {
      if (preferenciaMovimiento.matches || movimientoForzadoOff) return;
      if (video.paused) { pausaManual = false; reproducir(); }
      else { pausaManual = true; mostrarPoster(); }
    });
    if (sinMovimiento) {
      pausaManual = true;
      mostrarPoster();
      controlVideo.hidden = true;
      avisoMovimiento.hidden = !preferenciaMovimiento.matches && !movimientoForzadoOff;
    } else {
      controlVideo.hidden = false;
      avisoMovimiento.hidden = true;
      actualizarControl();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entrada]) => {
          if (entrada.isIntersecting && !pausaManual) reproducir();
          else if (!entrada.isIntersecting && video.src) video.pause();
        }, { threshold: 0.15 }).observe(video);
      } else reproducir();
    }
    const cambioMovimiento = (evento) => {
      if (evento.matches || movimientoForzadoOff) {
        pausaManual = true;
        mostrarPoster();
        controlVideo.hidden = true;
        avisoMovimiento.hidden = false;
      } else if (!medioEstatico) {
        pausaManual = true;
        mostrarPoster();
        avisoMovimiento.hidden = true;
        controlVideo.hidden = false;
      }
    };
    if (typeof preferenciaMovimiento.addEventListener === 'function') preferenciaMovimiento.addEventListener('change', cambioMovimiento);
    else if (typeof preferenciaMovimiento.addListener === 'function') preferenciaMovimiento.addListener(cambioMovimiento);
  }

  /* ---------- Aparición suave: el contenido existe aunque no corra ---------- */
  const revelables = $$('.nm-revela');
  if (!sinMovimiento && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visible'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revelables.forEach((el) => io.observe(el));
  } else { revelables.forEach((el) => el.classList.add('es-visible')); }

  /* ---------- Calculadora ---------- */
  const num = (n, d = 0) => Number(n).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const rango = $('#c-base');
  const eventosInput = $('#c-eventos');
  const gramosInput = $('#c-gramos');
  const resumen = $('#ld-resumen');
  let calculo = null;
  let calculoTocado = false;

  function calcular() {
    const base = Number(rango.value);
    const porPersona = cfg.calc.mode === 'personas' ? Number(($('input[name="porpersona"]:checked') || {}).value || cfg.calc.porPersona) : 1;
    const tazasPorAsistente = cfg.calc.mode === 'eventos' ? Number(($('input[name="porpersona"]:checked') || {}).value || cfg.calc.porPersona) : 1;
    const dias = cfg.calc.mode === 'eventos' ? 0 : Number(($('input[name="dias"]:checked') || {}).value || cfg.calc.dias);
    const eventosMes = cfg.calc.mode === 'eventos' ? Number(eventosInput.value || cfg.calc.eventosMes) : 0;
    let gramos = Number(String(gramosInput.value).replace(',', '.'));
    if (!Number.isFinite(gramos) || gramos < 5 || gramos > 25) gramos = cfg.calc.gramos;
    const tazasDia = cfg.calc.mode === 'eventos' ? null : base * porPersona;
    const tazasEvento = cfg.calc.mode === 'eventos' ? base * tazasPorAsistente : null;
    const tazasMes = cfg.calc.mode === 'eventos' ? tazasEvento * eventosMes : tazasDia * dias;
    const kg = tazasMes * gramos / 1000;
    calculo = { mode: cfg.calc.mode, base, porPersona: cfg.calc.mode === 'eventos' ? tazasPorAsistente : porPersona,
      dias, eventosMes, gramos, tazasDia, tazasEvento, tazasMes, kg: Math.round(kg * 10) / 10, tocado: calculoTocado };
    $('#c-base-valor').textContent = num(base);
    $('#c-kg').textContent = num(kg, 1);
    $('#c-tazas').textContent = num(tazasMes);
    const fichaBase = $('#c-row-base');
    const fichaPersona = $('#c-row-porpersona');
    const fichaDias = $('#c-row-dias');
    const fichaEventos = $('#c-row-eventos');
    const fichaGramos = $('#c-row-gramos');
    const fichaKg = $('#c-row-kg');
    if (fichaBase) fichaBase.textContent = num(base) + ' ' + cfg.calc.unidad;
    if (fichaPersona) fichaPersona.textContent = num(cfg.calc.mode === 'eventos' ? tazasPorAsistente : porPersona) + ' tazas';
    if (fichaDias) fichaDias.textContent = num(dias) + ' d\u00edas';
    if (fichaEventos) fichaEventos.textContent = num(eventosMes) + ' eventos';
    if (fichaGramos) fichaGramos.textContent = num(gramos, Number.isInteger(gramos) ? 0 : 1) + ' g';
    if (fichaKg) fichaKg.textContent = num(kg, 1) + ' kg';
    rango.setAttribute('aria-valuetext', num(base) + ' ' + cfg.calc.unidad);
    if (eventosInput && $('#c-eventos-valor')) $('#c-eventos-valor').textContent = num(eventosMes);
    if (resumen) {
      resumen.textContent = '';
      const fuerte = document.createElement('strong');
      if (cfg.calc.mode === 'eventos') {
        fuerte.textContent = num(base);
        resumen.append(fuerte, document.createTextNode(' asistentes por evento · ' + num(eventosMes) + ' eventos al mes · ' + num(kg, 1) + ' kg al mes (cálculo orientativo)'));
      } else {
        fuerte.textContent = num(tazasDia);
        resumen.append(fuerte, document.createTextNode(' tazas al día · ' + num(kg, 1) + ' kg al mes (cálculo orientativo)'));
      }
    }
  }
  function tocarCalculo() {
    if (!calculoTocado) { calculoTocado = true; registrar('calculator_used', { mode: cfg.calc.mode }); }
    calcular();
  }
  if (rango) {
    rango.addEventListener('input', tocarCalculo);
    if (eventosInput) eventosInput.addEventListener('input', tocarCalculo);
    gramosInput.addEventListener('input', tocarCalculo);
    $$('input[name="dias"], input[name="porpersona"]').forEach((el) => el.addEventListener('change', tocarCalculo));
    calcular();
  }

  /* ---------- Formulario en el primer bloque (variante f=inicio) ---------- */
  const caja = $('#ld-form-caja');
  const ranura = $('#ld-hero-form');
  if (variante.f === 'inicio' && caja && ranura) {
    ranura.appendChild(caja);
    ranura.hidden = false;
    $$('a[href="#contacto"]').forEach((a) => a.setAttribute('href', '#ld-form-caja'));
    if (variante.form === 'directo') {
      const ctaHero = $('[data-cta="hero"]');
      if (ctaHero && ctaHero.firstChild) ctaHero.firstChild.textContent = 'Completar solicitud ';
    }
  }

  /* ---------- CTA internos ---------- */
  $$('[data-cta]').forEach((el) => el.addEventListener('click', () => registrar('cta_click', { surface: 'landing-' + cfg.slug + '-' + el.dataset.cta })));

  /* ---------- Formulario progresivo: estados A, B y C ---------- */
  const form = $('#ld-form');
  const exito = $('#ld-exito');
  const reglas = {
    nombre: (v) => (v.trim().length >= 3 ? '' : 'Escribe tu nombre y apellido.'),
    correo: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Revisa el correo: falta algo, como la @ o el dominio.'),
    empresa: (v) => (v.trim().length >= 2 ? '' : 'Escribe el nombre de tu negocio.'),
    telefono: (v) => (v.replace(/\D/g, '').length >= 8 ? '' : 'Escribe un teléfono con al menos 8 números.'),
  };
  const CAMPOS = { 1: ['nombre', 'correo'], 2: ['empresa', 'telefono'] };

  function validarCampo(nombre) {
    const input = form.elements[nombre];
    const texto = reglas[nombre](input.value);
    input.closest('.nm-campo').classList.toggle('es-error', Boolean(texto));
    input.setAttribute('aria-invalid', texto ? 'true' : 'false');
    $('#e-' + nombre).textContent = texto;
    return !texto;
  }
  function mostrarPaso(n, enfocar = true) {
    $$('.ld-form__paso', form).forEach((p) => { p.hidden = p.dataset.paso !== String(n); });
    $('#ld-paso-etiqueta').textContent = n === 1 ? 'Paso 1 de 2 · tus datos' : 'Paso 2 de 2 · tu negocio';
    form.dataset.paso = String(n);
    if (enfocar) { const primero = $('.ld-form__paso:not([hidden]) input:not([type="checkbox"])', form); if (primero) primero.focus({ preventScroll: variante.f === 'inicio' }); }
  }

  if (form) {
    form.dataset.form = variante.form;
    const hasKitFicha = prefillKitForm(form);
    if (variante.form === 'directo') {
      form.dataset.paso = 'directo';
      $('#ld-paso-etiqueta').textContent = 'Un paso · tus datos y tu negocio';
      $$('.ld-form__paso', form).forEach((p) => { p.hidden = false; });
      $('[data-accion="guardar"]', form).hidden = true;
      $('[data-accion="enviar"]', form).hidden = true;
      $('[data-accion="volver"]', form).hidden = true;
      $('[data-accion="directo"]', form).hidden = false;
    }
    const errorGuardado = document.createElement('p');
    errorGuardado.className = 'nm-error';
    errorGuardado.setAttribute('role', 'alert');
    errorGuardado.hidden = true;
    form.prepend(errorGuardado);
    const mostrarErrorGuardado = (mensaje) => {
      errorGuardado.textContent = mensaje || 'No pudimos guardar tu avance en este navegador. Revisa el almacenamiento y vuelve a intentarlo.';
      errorGuardado.hidden = false;
      errorGuardado.scrollIntoView({ block: 'nearest' });
    };
    Object.keys(reglas).forEach((nombre) => {
      const input = form.elements[nombre];
      input.addEventListener('blur', () => { if (input.value) validarCampo(nombre); });
      input.addEventListener('input', () => { if (input.closest('.nm-campo').classList.contains('es-error')) validarCampo(nombre); });
    });
    /* Estado A: el inicio del formulario es un evento anónimo; no guarda lo que se escribe. */
    form.addEventListener('focusin', () => registrar('form_start', {}), { once: true });

    /* Estado B guardado antes: se retoma una solicitud que la persona sí envió. */
    const borrador = leer('mc_landing_draft_v1');
    if (!hasKitFicha && variante.form === 'progresivo' && borrador && borrador.landing === cfg.slug && !leer('mc_landing_lead_v1')) {
      form.elements.nombre.value = borrador.name || '';
      form.elements.correo.value = borrador.email || '';
      form.elements.consent.checked = Boolean(borrador.consent);
      form.elements.marketing.checked = Boolean(borrador.marketingConsent);
      $('#ld-retoma').hidden = false;
      mostrarPaso(2, false);
      registrar('form_resumed', {});
    }

    $('[data-accion="volver"]', form).addEventListener('click', () => mostrarPaso(1));

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      errorGuardado.hidden = true;
      const paso = variante.form === 'directo' ? 'directo' : Number(form.dataset.paso || 1);
      const campos = paso === 'directo' ? CAMPOS[1].concat(CAMPOS[2]) : CAMPOS[paso];
      const validos = campos.map(validarCampo);
      const permiso = form.elements.consent.checked;
      const requierePermiso = paso === 'directo' || paso === 1;
      if (requierePermiso) $('#e-consent').textContent = permiso ? '' : 'Necesitamos tu permiso para responderte.';
      if (validos.includes(false) || (requierePermiso && !permiso)) {
        const primero = $('.nm-campo.es-error input', form) || form.elements.consent;
        primero.focus();
        registrar('form_error', { step: paso, fields: campos.filter((_, i) => !validos[i]).concat(requierePermiso && !permiso ? ['consent'] : []).join(',') });
        return;
      }
      if (paso === 1) {
        /* Estado B: contacto parcial que la persona envió, con la finalidad a la vista. */
        const guardado = guardar('mc_landing_draft_v1', {
          v: 1, at: new Date().toISOString(), buyer: cfg.buyer, landing: cfg.slug,
          name: form.elements.nombre.value.trim(), email: form.elements.correo.value.trim(),
          consent: true, marketingConsent: form.elements.marketing.checked,
          purpose: 'responder la solicitud', form: 'progresivo',
        });
        if (!guardado) { mostrarErrorGuardado(); return; }
        registrar('form_step_completed', { step: 1, form: variante.form, marketing_consent: form.elements.marketing.checked });
        mostrarPaso(2);
        return;
      }
      /* Estado B (directo): envío aceptado y datos solo en memoria mientras llega la confirmación simulada. */
      if (paso === 'directo') registrar('form_step_completed', { step: 1, form: 'directo', marketing_consent: form.elements.marketing.checked });
      /* Estado C: se confirma (aquí, simulado) y recién entonces existe el lead. */
      const boton = paso === 'directo' ? $('[data-accion="directo"]', form) : $('[data-accion="enviar"]', form);
      boton.disabled = true;
      const textoBoton = boton.firstChild.textContent;
      boton.firstChild.textContent = 'Enviando ';
      setTimeout(() => {
        const id = window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'ld-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
        const lead = {
          v: 1,
          id,
          at: new Date().toISOString(),
          buyer: cfg.buyer,
          landing: cfg.slug,
          name: form.elements.nombre.value.trim(),
          email: form.elements.correo.value.trim(),
          company: form.elements.empresa.value.trim(),
          phone: form.elements.telefono.value.trim(),
          consent: true,
          marketingConsent: form.elements.marketing.checked,
          calc: calculo,
          variant: variante,
          firstTouch: primerOrigen,
          lastTouch: { at: new Date().toISOString(), params: { ...ultimoOrigen, mc_surface: 'landing-' + cfg.slug + '-form' } },
        };
        if (!guardar('mc_landing_lead_v1', lead)) {
          boton.disabled = false;
          boton.firstChild.textContent = textoBoton;
          const persistido = leer('mc_landing_lead_v1');
          if (persistido && persistido.id === id) borrar('mc_landing_lead_v1');
          mostrarErrorGuardado('No pudimos confirmar y guardar tu solicitud en este navegador. No se creó un lead. Vuelve a intentarlo.');
          return;
        }
        if (paso !== 'directo') {
          const borradorActual = leer('mc_landing_draft_v1');
          if (borradorActual && borradorActual.landing === cfg.slug) borrar('mc_landing_draft_v1');
          registrar('form_step_completed', { step: 2, form: 'progresivo' });
        }
        registrar('lead_created', { form_type: 'landing', form: variante.form, marketing_consent: lead.marketingConsent,
          cups_per_day: calculo && Number.isFinite(calculo.tazasDia) ? calculo.tazasDia : null, confirmed_by: 'servidor simulado' });
        $('#ld-exito-titulo').textContent = 'Recibimos tu solicitud, ' + lead.name.split(/\s+/)[0] + '.';
        const destino = new URL(urlConOrigen(cfg.portal, 'landing-' + cfg.slug + '-form', cfg.pantalla));
        destino.searchParams.set('mc_handoff', id);
        $('#ld-continuar').href = destino.toString();
        form.hidden = true;
        exito.hidden = false;
        exito.focus({ preventScroll: false });
      }, 450);
    });
  }

  $('#ld-continuar') && $('#ld-continuar').addEventListener('click', () => registrar('quote_requested', { next: cfg.pantalla }));

  registrar('landing_viewed', { has_origin: Object.keys(ultimoOrigen).length > 0 });
})();
