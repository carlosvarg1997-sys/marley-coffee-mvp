/* crm/crm-carga.js · carga bajo demanda del agente del CRM (crm-agente.*) y del tablero de metas (crm-dashboard.*).
 * Solo se pide en las rutas R (R00 a R17), igual que crm-v2: las páginas de cliente no suman ese peso
 * (límite de 2.500.000 bytes en celular). Los archivos se cargan en orden: primero la hoja del agente,
 * luego su script (que espera window.MarleyAgente.listo antes de dibujar) y después el tablero.
 * Si una ruta falla, se vuelve a intentar en el siguiente cambio de ruta. */
(function () {
  'use strict';
  if (window.__crmCarga) return;
  window.__crmCarga = true;
  var RUTA_CRM = /^#R(?:0\d|1[0-9])(?:\?|$)/;
  var ARCHIVOS = [
    ['css', 'crm/crm-agente.css'],
    ['js', 'crm/crm-agente.js'],
    ['css', 'crm/crm-dashboard.css'],
    ['js', 'crm/crm-dashboard.js']
  ];
  var pedido = null;
  function cargar(tipo, url) {
    return new Promise(function (ok, mal) {
      var el = document.createElement(tipo === 'css' ? 'link' : 'script');
      if (tipo === 'css') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; }
      el.onload = function () { ok(); };
      el.onerror = function () { mal(new Error('No se pudo cargar ' + url)); };
      document.head.appendChild(el);
    });
  }
  function cargarCrm() {
    if (pedido || !RUTA_CRM.test(location.hash || '')) return;
    pedido = ARCHIVOS.reduce(function (previo, a) { return previo.then(function () { return cargar(a[0], a[1]); }); }, Promise.resolve());
    pedido.catch(function () { pedido = null; });
  }
  window.addEventListener('hashchange', cargarCrm);
  cargarCrm();
})();
