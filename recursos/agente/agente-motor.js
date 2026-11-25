/* Marley Coffee Empresas · agente conversacional · punto de entrada v1.0
 * Expone window.MarleyAgente según CONTRATO_AGENTE_24NOV.md. Es liviano a propósito: el motor
 * completo (agente-motor-nucleo.js) se carga cuando hace falta: al abrir el chat del comprador o
 * al entrar a una ruta del CRM (R). Así la carga inicial de las páginas de cliente no crece.
 * Mientras carga, motor.responder devuelve un aviso (sin datos inventados). Para esperar al motor:
 * MarleyAgente.listo.then(fn).
 */
(function () {
  "use strict";
  if (window.MarleyAgente) return;
  var RUTA = "recursos/agente/agente-motor-nucleo.js";
  var carga = null;
  var pendientes = [];
  var nucleo = function () { return window.MarleyAgenteNucleo || null; };
  var VACIO = function () { return { conversaciones: {}, traspasos: [], notificaciones: { ventas: [], marketing: [], jefatura: [] }, registro: [], consentimientos: {} }; };
  function cargar() {
    if (nucleo()) return Promise.resolve(nucleo());
    if (!carga) {
      carga = new Promise(function (ok, mal) {
        var s = document.createElement("script");
        s.src = RUTA;
        s.onload = function () {
          var n = nucleo();
          pendientes.splice(0).forEach(function (p) { n.eventos.on(p[0], p[1]); });
          ok(n);
        };
        s.onerror = function () { carga = null; mal(new Error("No se pudo cargar el motor del agente.")); };
        document.head.appendChild(s);
      });
    }
    return carga;
  }
  function leerLocal() {
    try {
      var raw = localStorage.getItem("marley.agente.v1");
      return Object.assign(VACIO(), raw ? JSON.parse(raw) : {});
    } catch (_) { return VACIO(); }
  }
  var AVISO = "Estoy cargando el asistente. Intenta de nuevo en un momento.";
  var api = {
    version: "1.0",
    cargado: function () { return Boolean(nucleo()); },
    motor: {
      responder: function (ctx, entrada) {
        var n = nucleo();
        if (n) return n.motor.responder(ctx, entrada);
        cargar().catch(function () {});
        return { mensajes: [{ rol: "agente", texto: AVISO, chips: [{ id: "inicio", texto: "Intentar de nuevo" }], tarjetas: [] }], acciones: [], registro: { datoUsado: "Motor aún no cargado", sugerencia: "Reintentar", nivel: "regla" } };
      }
    },
    datos: {
      lead: function (x) { return nucleo() ? nucleo().datos.lead(x) : null; },
      cuenta: function (x) { return nucleo() ? nucleo().datos.cuenta(x) : null; },
      cotizacion: function (x) { return nucleo() ? nucleo().datos.cotizacion(x) : null; },
      pedidos: function (x) { return nucleo() ? nucleo().datos.pedidos(x) : []; },
      buscar: function (t) { return nucleo() ? nucleo().datos.buscar(t) : []; },
      recomendacion: function (x) { return nucleo() ? nucleo().datos.recomendacion(x) : null; }
    },
    estado: {
      get: function () { return nucleo() ? nucleo().estado.get() : leerLocal(); },
      guardar: function (e) { return nucleo() ? nucleo().estado.guardar(e) : e; },
      registrar: function (a) { return nucleo() ? nucleo().estado.registrar(a) : null; }
    },
    canales: { enviar: function (o) { return nucleo() ? nucleo().canales.enviar(o) : { ok: false, motivo: "El motor aún no está cargado." }; } },
    eventos: {
      on: function (tipo, fn) {
        if (nucleo()) return nucleo().eventos.on(tipo, fn);
        var par = [tipo, fn];
        pendientes.push(par);
        return function () { var i = pendientes.indexOf(par); if (i >= 0) pendientes.splice(i, 1); };
      },
      emitir: function (tipo, det) { if (nucleo()) nucleo().eventos.emitir(tipo, det); }
    }
  };
  Object.defineProperty(api, "listo", { get: cargar });
  window.MarleyAgente = api;
  window.MarleyAgenteCargar = cargar;
  if (/^#R/.test(location.hash || "")) cargar().catch(function () {});
  window.addEventListener("hashchange", function () { if (/^#R/.test(location.hash || "")) cargar().catch(function () {}); });
})();
