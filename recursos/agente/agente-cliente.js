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

  // Chat incrustado en #agente-portal (lo pone B2 en el portal). Se monta cuando aparece el contenedor,
  // también después de cada render del portal, que puede reemplazarlo. Nada se superpone a la página.
  // Marco provisional: el campo #agente-entrada existe desde que aparece el portal (sin esperar al motor).
  // El núcleo lo reemplaza por el chat completo cuando termina de cargar.
  var MARCO_PROVISIONAL = "<section class='agente-hoja agente-hoja--incrustado' data-agente-estado='asistente' role='region' aria-label='Asistente de Marley'>" +
    "<header class='agente-cab agente-cab--incrustado'><div><p class='agente-kicker'>Marley Coffee Empresas · simulación</p>" +
    "<h3 class='agente-titulo'>Asistente de Marley</h3>" +
    "<p class='agente-aviso'>Asistente de IA de Marley; una persona revisa precios y excepciones. Sin envíos reales.</p></div></header>" +
    "<div class='agente-log' role='log' aria-live='polite' aria-label='Conversación con el asistente'><p class='agente-texto'>Cargando el asistente…</p></div>" +
    "<form class='agente-form' autocomplete='off'><textarea id='agente-entrada' rows='1' maxlength='500' placeholder='Tu pregunta…' aria-label='Escribe tu pregunta' disabled></textarea>" +
    "<button id='agente-enviar' type='submit' class='agente-enviar' disabled>Enviar</button></form></section>";
  function montarEnPortal() {
    var host = document.getElementById("agente-portal");
    if (!host || host.querySelector(":scope > [data-agente-modo=\"incrustado\"]")) return;
    host.querySelectorAll(":scope > .mp-agente-espera").forEach(function (n) { n.remove(); });
    var marco = document.createElement("div");
    marco.className = "agente-incrustado";
    marco.setAttribute("data-agente-modo", "incrustado");
    marco.innerHTML = MARCO_PROVISIONAL;
    host.appendChild(marco);
    cargarHoja().catch(function () {});
    cargarChat().then(function (c) { if (c && c.montar) c.montar(host); }).catch(function () {});
  }
  if (window.MutationObserver) new MutationObserver(montarEnPortal).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", montarEnPortal);
  montarEnPortal();
})();
