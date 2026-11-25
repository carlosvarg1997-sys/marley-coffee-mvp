/* Marley Coffee Empresas · chat del comprador · punto de entrada v1.0
 * Engancha los botones «Te ayudamos a decidir» ([data-m7-open] en C01 a C09). La primera vez carga el
 * motor (agente-motor.js), la hoja de estilos (agente-hoja.css) y la hoja del chat (agente-cliente-nucleo.js).
 * Así el chat no suma peso a la carga inicial de la página. El panel de operación (R) sigue su flujo propio.
 */
(function () {
  "use strict";
  if (window.__agenteClienteEntrada) return;
  window.__agenteClienteEntrada = true;
  if (!document.getElementById("agente-panel")) {
    var base = document.createElement("div");
    base.id = "agente-panel";
    base.hidden = true;
    document.body.appendChild(base);
  }
  var hoja = null;
  var chat = null;
  var ruta = function () { return (location.hash || "#C01").slice(1).split("?")[0]; };
  function cargarHoja() {
    if (!hoja) {
      hoja = new Promise(function (ok, mal) {
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = "recursos/agente/agente-hoja.css";
        l.onload = ok;
        l.onerror = function () { hoja = null; mal(new Error("No se pudo cargar la hoja del chat.")); };
        document.head.appendChild(l);
      });
    }
    return hoja;
  }
  function cargarChat() {
    if (window.MarleyAgenteClienteNucleo) return Promise.resolve(window.MarleyAgenteClienteNucleo);
    if (!chat) {
      chat = window.MarleyAgenteCargar().then(function () {
        return cargarHoja();
      }).then(function () {
        return new Promise(function (ok, mal) {
          var s = document.createElement("script");
          s.src = "recursos/agente/agente-cliente-nucleo.js";
          s.onload = function () { ok(window.MarleyAgenteClienteNucleo); };
          s.onerror = function () { chat = null; mal(new Error("No se pudo cargar el chat.")); };
          document.head.appendChild(s);
        });
      });
    }
    return chat;
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target && ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
    var b = t && t.closest ? t.closest("[data-m7-open]") : null;
    if (!b || !/^C0[1-9]$/.test(ruta())) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    cargarChat().then(function (c) { c.abrir(b); }).catch(function () {});
  }, true);
})();
