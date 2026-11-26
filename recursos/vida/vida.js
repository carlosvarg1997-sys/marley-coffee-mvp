/* recursos/vida/vida.js · zoom de imágenes, títulos, claves, totales y botones.
 * Lo carga cargar-vida.js a la primera interacción. Sin JS, la página se ve completa y quieta.
 * Cada efecto corre una vez por elemento (nada en bucle). Con prefers-reduced-motion no se mueve nada. */
(function () {
  'use strict';
  if (window.MarleyVida) return;

  var raiz = document.documentElement;
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches || raiz.dataset.motion === 'off';
  var conIO = 'IntersectionObserver' in window;
  var animar = !quieto && conIO;
  var SEL = '[data-zoom],[data-vida="titulo"],mark[data-vida="clave"],[data-vida="cuenta"][data-valor]';
  var io = null;
  var vistos = {};

  function fmt(n) { return Math.round(n).toLocaleString('es-CL'); }
  function token(fin, v) {
    if (fin.indexOf(fmt(v)) >= 0) return fmt(v);
    return (fin.match(/\d[\d.,]*/) || [''])[0];
  }

  // ---------- Títulos, claves y totales ----------
  function contar(el) {
    var fin = el.__fin, v = parseFloat(el.getAttribute('data-valor')) || 0, tok = token(fin, v);
    if (!tok) return;
    var t0 = 0;
    function paso(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fin.replace(tok, fmt(v * e)) : fin;
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
  function activar(el, i) {
    io.unobserve(el);
    if (el.getAttribute('data-vida') === 'cuenta') return contar(el);
    if (el.getAttribute('data-vida') === 'titulo') el.style.transitionDelay = (i * 60) + 'ms';
    el.classList.remove('vida-oculto');
  }
  function preparar(el, nuevo) {
    if (el.hasAttribute('data-zoom')) return prepararZoom(el);
    if (el.__vp) return;
    el.__vp = true;
    var tipo = el.getAttribute('data-vida');
    if (tipo === 'cuenta') el.__fin = el.textContent;
    var r = el.getBoundingClientRect();
    var enPantalla = r.bottom > 0 && r.top < window.innerHeight;
    if (!nuevo && enPantalla) return; // lo que ya está en pantalla al cargar no se anima
    var clave = location.hash + '|' + (tipo === 'cuenta' ? el.getAttribute('data-valor') : el.textContent.trim().slice(0, 120));
    if (vistos[clave]) return;
    vistos[clave] = 1;
    if (!animar) return;
    if (tipo !== 'cuenta') {
      el.classList.add('vida-oculto');
    }
    io.observe(el);
  }
  function escanear(nodo, nuevo) {
    if (!nodo || nodo.nodeType !== 1) return;
    var lista = (nodo.matches(SEL) ? [nodo] : []).concat([].slice.call(nodo.querySelectorAll(SEL)));
    lista.forEach(function (el) { preparar(el, nuevo); });
  }

  // ---------- Zoom ----------
  var vz = null, foco = null, inertes = [], scrollPrevio = '', grupo = [], pos = 0;
  var img = null, escena = null, cuenta = null, st = { s: 1, x: 0, y: 0 };
  var punteros = {}, pinza = 0, ultTap = { t: 0, x: 0, y: 0 };

  function prepararZoom(el) {
    if (el.__zoom) return;
    el.__zoom = 1;
    var im = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!im) return;
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Ampliar imagen: ' + (im.alt || 'imagen'));
  }
  function srcDe(el) {
    var im = el.tagName === 'IMG' ? el : el.querySelector('img');
    return { src: el.getAttribute('data-zoom-src') || (im ? im.currentSrc || im.src : ''), alt: (im && im.alt) || 'Imagen' };
  }
  function grupoDe(el) {
    var g = el.getAttribute('data-zoom-grupo');
    if (g === null) return [el];
    var lista = [].slice.call(document.querySelectorAll('[data-zoom][data-zoom-grupo]')).filter(function (n) {
      return n.getAttribute('data-zoom-grupo') === g && (n === el || n.getClientRects().length > 0);
    });
    return lista;
  }
  function relativo(x, y) {
    var r = escena.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  }
  function puntos() { return Object.keys(punteros).map(function (k) { return punteros[k]; }); }
  function aplicar() {
    img.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.s + ')';
    escena.style.cursor = st.s > 1 ? 'grab' : 'zoom-in';
  }
  function limitar() {
    if (st.s <= 1) { st.s = 1; st.x = 0; st.y = 0; return; }
    var r = escena.getBoundingClientRect();
    var mx = (st.s - 1) * r.width / 2, my = (st.s - 1) * r.height / 2;
    st.x = Math.max(-mx, Math.min(mx, st.x));
    st.y = Math.max(-my, Math.min(my, st.y));
  }
  function zoomEn(f, p) {
    var s2 = Math.min(4, Math.max(1, st.s * f)), k = s2 / st.s;
    st.x = p.x - (p.x - st.x) * k;
    st.y = p.y - (p.y - st.y) * k;
    st.s = s2;
    limitar();
    aplicar();
  }
  function suave() {
    if (!img) return;
    img.classList.add('vz-suave');
    setTimeout(function () { if (img) img.classList.remove('vz-suave'); }, 200);
  }
  function mostrar() {
    var d = srcDe(grupo[pos]);
    img.src = d.src;
    img.alt = d.alt;
    cuenta.textContent = (pos + 1) + ' de ' + grupo.length;
    vz.setAttribute('aria-label', 'Ampliar imagen ' + (pos + 1) + ' de ' + grupo.length + ': ' + d.alt);
    st = { s: 1, x: 0, y: 0 };
    aplicar();
  }
  function navegar(d) {
    if (grupo.length < 2) return;
    pos = (pos + d + grupo.length) % grupo.length;
    mostrar();
  }
  function abrirZoom(el) {
    if (vz || !el) return;
    grupo = grupoDe(el);
    pos = Math.max(0, grupo.indexOf(el));
    foco = el;
    vz = document.createElement('div');
    vz.className = 'vz';
    vz.setAttribute('role', 'dialog');
    vz.setAttribute('aria-modal', 'true');
    vz.innerHTML = '<div class="vz-caja"><div class="vz-barra"><p class="vz-cuenta" aria-live="polite"></p>' +
      '<button type="button" class="vz-btn" data-accion="cerrar">Cerrar</button></div>' +
      '<div class="vz-escena"><img class="vz-img" alt="" draggable="false"></div>' +
      '<div class="vz-nav"><button type="button" class="vz-btn" data-accion="anterior">Anterior</button>' +
      '<button type="button" class="vz-btn" data-accion="alejar">Alejar</button>' +
      '<button type="button" class="vz-btn" data-accion="acercar">Acercar</button>' +
      '<button type="button" class="vz-btn" data-accion="siguiente">Siguiente</button></div>' +
      '<p class="vz-nota">Rueda o doble clic para acercar. En el celular, pellizca o toca dos veces.</p></div>';
    img = vz.querySelector('.vz-img');
    escena = vz.querySelector('.vz-escena');
    cuenta = vz.querySelector('.vz-cuenta');
    if (grupo.length < 2) [].forEach.call(vz.querySelectorAll('[data-accion=anterior],[data-accion=siguiente]'), function (b) { b.hidden = true; });
    inertes = [].filter.call(document.body.children, function (n) { return !n.inert && n.tagName !== 'SCRIPT'; });
    inertes.forEach(function (n) { n.inert = true; });
    scrollPrevio = raiz.style.overflow;
    raiz.style.overflow = 'hidden';
    document.body.appendChild(vz);
    escena.addEventListener('pointerdown', function (e) {
      escena.setPointerCapture(e.pointerId);
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      pinza = puntos().length === 2 ? Math.hypot(puntos()[0].x - puntos()[1].x, puntos()[0].y - puntos()[1].y) : 0;
    });
    escena.addEventListener('pointermove', function (e) {
      if (!punteros[e.pointerId]) return;
      var ant = punteros[e.pointerId], v = puntos();
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      v = puntos();
      if (v.length === 2) {
        var d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
        if (pinza) zoomEn(d / pinza, relativo((v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2));
        pinza = d;
      } else if (v.length === 1 && st.s > 1) {
        st.x += e.clientX - ant.x;
        st.y += e.clientY - ant.y;
        limitar();
        aplicar();
      }
    });
    function fin(e) {
      delete punteros[e.pointerId];
      pinza = 0;
      if (e.type !== 'pointerup' || e.pointerType !== 'touch' || puntos().length) return;
      var ahora = Date.now();
      if (ahora - ultTap.t < 300 && Math.abs(e.clientX - ultTap.x) < 30 && Math.abs(e.clientY - ultTap.y) < 30) {
        ultTap.t = 0;
        suave();
        if (st.s > 1) { st = { s: 1, x: 0, y: 0 }; aplicar(); } else zoomEn(2.5, relativo(e.clientX, e.clientY));
      } else {
        ultTap = { t: ahora, x: e.clientX, y: e.clientY };
      }
    }
    escena.addEventListener('pointerup', fin);
    escena.addEventListener('pointercancel', fin);
    escena.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomEn(e.deltaY < 0 ? 1.12 : 1 / 1.12, relativo(e.clientX, e.clientY));
    }, { passive: false });
    escena.addEventListener('dblclick', function (e) {
      suave();
      if (st.s > 1) { st = { s: 1, x: 0, y: 0 }; aplicar(); } else zoomEn(2.5, relativo(e.clientX, e.clientY));
    });
    mostrar();
    vz.querySelector('[data-accion=cerrar]').focus();
  }
  function cerrarZoom() {
    if (!vz) return;
    vz.parentNode.removeChild(vz);
    vz = null;
    img = null;
    inertes.forEach(function (n) { n.inert = false; });
    inertes = [];
    raiz.style.overflow = scrollPrevio;
    if (foco && foco.isConnected) { if (!foco.hasAttribute('tabindex')) foco.tabIndex = -1; foco.focus({ preventScroll: true }); }
  }
  function trampa(e) {
    var f = [].slice.call(vz.querySelectorAll('button:not([hidden])')), i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); }
    else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { f[0].focus(); e.preventDefault(); }
  }

  document.addEventListener('click', function (e) {
    if (vz) {
      if (e.target === vz) return cerrarZoom();
      var b = e.target.closest && e.target.closest('[data-accion]');
      if (!b || !vz.contains(b)) return;
      e.stopPropagation();
      var a = b.getAttribute('data-accion');
      if (a === 'cerrar') cerrarZoom();
      else if (a === 'anterior') navegar(-1);
      else if (a === 'siguiente') navegar(1);
      else if (a === 'acercar') zoomEn(1.25, { x: 0, y: 0 });
      else if (a === 'alejar') zoomEn(0.8, { x: 0, y: 0 });
      return;
    }
    var z = e.target.closest && e.target.closest('[data-zoom]');
    if (!z) return;
    e.preventDefault();
    e.stopPropagation();
    abrirZoom(z);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!vz) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.hasAttribute && e.target.hasAttribute('data-zoom')) {
        e.preventDefault();
        abrirZoom(e.target);
      }
      return;
    }
    var k = e.key;
    if (k === 'Tab') return trampa(e);
    if (k === 'Escape') cerrarZoom();
    else if (k === 'ArrowRight') navegar(1);
    else if (k === 'ArrowLeft') navegar(-1);
    else if (k === '+' || k === '=') zoomEn(1.25, { x: 0, y: 0 });
    else if (k === '-') zoomEn(0.8, { x: 0, y: 0 });
    else if (k === '0') { st = { s: 1, x: 0, y: 0 }; aplicar(); }
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ---------- Arranque ----------
  if (animar) raiz.classList.add('vida-on');
  if (animar) io = new IntersectionObserver(function (lista) {
    lista.filter(function (e) { return e.isIntersecting; }).forEach(function (e, i) { activar(e.target, i); });
  }, { rootMargin: '0px 0px -10% 0px' });
  escanear(document.body, false);
  if (window.MutationObserver) {
    new MutationObserver(function (lista) {
      lista.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { escanear(n, true); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('hashchange', function () { vistos = {}; });
  window.MarleyVida = { abrir: abrirZoom, escanear: function (n) { escanear(n, true); } };
})();
