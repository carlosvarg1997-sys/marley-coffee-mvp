/* Marley Coffee · CRM · Tablero de metas y KPIs por área (subagente D, 24-nov-2026).
   Un bloque #crm-tablero por rol: Ventas en «Hoy» (R01), Marketing en «Hoy» (R11) y Jefatura en «Metas y canales» (R06).
   Solo lee window.M4, M4R, M4D y R6P. No escribe estado, no usa localStorage y no toca crm-v2.js.
   «Simulación» = datos de demostración del CRM. «Meta del informe» = informe revisado y modelo V5 (Excel). */
(() => {
  'use strict';
  if (window.__crmTableroCargado) return;
  window.__crmTableroCargado = true;

  const RAIZ_ID = 'crm-v2-root';
  const DIA = 86400000;
  const POR_MEDIR = 'por medir en el piloto';
  const RUTA_ROL = { R01: 'ventas', R11: 'marketing', R06: 'jefatura' };

  // Cifras del modelo V5 (Excel) y del informe revisado. Cada una indica su celda o página.
  const V5 = {
    altasCentral: 39.25, altasPrudente: 24, altasExpansion: 60,  // V5 Resumen B5:B7
    cacPauta: 1043478, cacAmpliado: 1397101,                     // V5 Resumen K6:L6
    roasCentral: 2.25, roasCohorte: 6.39, equilibrio: 4.17,       // V5 Resumen J6; informe p. 38
    roiCentral: 6.2, roiPrudente: -58.7, roiExpansion: 62.4,      // V5 Resumen I5:I7
    aporteMeta: 4.4,                                              // V5 Resumen N6 (4,44 %)
    ticketPrimera: 795257, ticketReposicion: 534318,              // V5 Resumen B12:B13
    margen: 30, margenHistorico: 35,                              // Supuestos B7 y B76
    inversion36: 291.4                                            // Inversion actual E11 (MM CLP)
  };
  const OBJ_GENERAL = 'Ventas food service +12 %';
  const NOTA_BASE = 'Simulación = datos de prueba del CRM. Meta del informe = informe revisado (nov-2026) y modelo V5 (Excel). Lo que el CRM aún no registra dice «por medir en el piloto».';

  const CABECERAS = {
    ventas: {
      kicker: 'Tablero de metas · Ventas',
      titulo: 'Lo que Ventas mueve hacia la meta',
      objetivos: [
        ['SQL aceptados:', '+25 % frente a la base de leads calificados.'],
        ['Reposición digital HORECA:', 'de 18 % a 40 %.'],
        ['Cuentas actuales:', '100 activadas (hipótesis del equipo).'],
        ['Ticket:', '+10 % en cuentas activadas (hipótesis del equipo).']
      ]
    },
    marketing: {
      kicker: 'Tablero de metas · Marketing',
      titulo: 'Captación, calificación y costo de adquirir',
      objetivos: [
        ['Leads calificados:', '+25 %, medido con SQL aceptados.'],
        ['Umbral MQL:', 'interés de 40 puntos o más, con permiso y negocio B2B.'],
        ['Pauta del modelo:', 'CAC central de $1.043.478 y ROAS de 2,25× (equilibrio 4,17×).']
      ]
    },
    jefatura: {
      kicker: 'Tablero de metas · Jefatura',
      titulo: 'Metas del programa y decisiones pendientes',
      objetivos: [
        ['Retención:', '86 % → 90 %.'],
        ['NPS:', '42 → 52.'],
        ['OTIF y quiebres:', 'OTIF de al menos 96 % y quiebres OCS −30 %.'],
        ['Reposición digital:', 'HORECA de 18 % a 40 %.'],
        ['Modelo V5 central:', 'ROI +6,2 % a 36 meses.']
      ]
    }
  };

  // Formato chileno y utilidades seguras.
  const numero = (n, dec = 0) => Number(n).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const clp = n => '$ ' + numero(Math.round(n));
  const pct = (n, dec = 0) => numero(n, dec) + ' %';
  const acotar = n => Math.max(0, Math.min(100, n));
  // Espacio no separable antes de «%» y después de «$», para que una cifra no se corte en dos líneas.
  const esc = v => String(v ?? '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .replace(/ %/g, ' %')
    .replace(/\$ /g, '$ ');

  // Cifras de demostración: misma regla que la pantalla del CRM, sin escribir nada.
  function calcular() {
    const st = (window.M4 && window.M4.get && window.M4.get()) || {};
    const ap = st.crm2 || {};
    const pasos = st.marketingPasos || {};
    const M4R = window.M4R || {};
    const M4D = window.M4D || {};
    const P = window.R6P || null;
    const hoy = Number(M4D.REF || Date.now());
    const pasoDe = l => pasos[l.id] || {};

    let lista = [];
    try { lista = M4R.leads ? M4R.leads(st) : []; } catch (_) { lista = []; }
    const leads = (Array.isArray(lista) && lista.length ? lista : (M4D.PROSPECTS || []))
      .map(l => (l.live ? l : { ...l, dataTest: true }));

    let cuentaLista = [];
    try { cuentaLista = M4R.accounts ? M4R.accounts(st) : []; } catch (_) { cuentaLista = []; }
    const cuentas = Array.isArray(cuentaLista) && cuentaLista.length ? cuentaLista : (M4D.ACCOUNTS || []);
    const pedidos = cuentas.flatMap(c => c.orders || []);
    const statsDe = c => { try { return (window.M4 && window.M4.accountStats ? window.M4.accountStats(c) : c.st) || {}; } catch (_) { return c.st || {}; } };

    // Interés (R6P), MQL y SQL: MQL = interés 40 o más + contacto identificado + negocio B2B + permiso.
    const interes = l => { try { return Number(P.interes(l).puntaje) || 0; } catch (_) { return Number(l.score) || 0; } };
    const permiso = l => {
      const guardado = ap.permissions && ap.permissions[l.id] ? ap.permissions[l.id].promotion : undefined;
      const valor = [guardado, l.marketingConsent, l.permissions && l.permissions.promotion, l.consent && l.consent.marketing]
        .find(x => x !== undefined && x !== null);
      if (valor === true || valor === 'true' || valor === 'si') return true;
      if (valor === false || valor === 'false' || valor === 'no') return false;
      return Boolean(l.dataTest) && ['MQL', 'SQL'].includes(l.stage);
    };
    const esMql = l => Boolean(l.name || l.contactName) && Boolean(l.email || l.phone || l.company)
      && Boolean(l.business || l.company) && permiso(l) && interes(l) >= 40;
    const esSql = l => {
      const e = pasoDe(l).estado;
      if (e === 'aceptado' || e === 'sql') return true;
      if (['devuelto', 'esperando', 'pendiente'].includes(e)) return false;
      return l.stage === 'SQL';
    };
    const sql = leads.filter(esSql).length;
    const enEspera = leads.filter(l => ['esperando', 'pendiente'].includes(pasoDe(l).estado)).length;
    const mql = leads.filter(esMql).length;

    // Origen del contacto (primer toque).
    const origen = { organico: 0, campana: 0, referido: 0, otros: 0 };
    leads.forEach(l => {
      const s = String(l.source || (l.attribution && l.attribution.firstTouch && l.attribution.firstTouch.source) || '');
      if (/org[aá]nic/i.test(s)) origen.organico++;
      else if (/referid/i.test(s)) origen.referido++;
      else if (/campa[ñn]a|google ads|pauta/i.test(s)) origen.campana++;
      else origen.otros++;
    });

    // Costo: escenario de prueba del R06 (búsqueda, LinkedIn y Meta) y cuentas nuevas de los últimos 90 días.
    const cac = ap.cac || {};
    const gasto = Number(cac.search ?? 600000) + Number(cac.linkedin ?? 1000000) + Number(cac.meta ?? 400000);
    const nuevas = cuentas.filter(c => statsDe(c).segment === 'Nuevo').length;
    const nuevasCac = Number(cac.newAccounts) > 0 ? Number(cac.newAccounts) : nuevas;
    const cpl = leads.length ? gasto / leads.length : null;
    const cacDemo = nuevasCac > 0 ? gasto / nuevasCac : null;

    // Ventas, ticket y canasta de los pedidos de prueba.
    const ventas90 = pedidos.filter(o => hoy - Number(o.at || 0) <= 90 * DIA).reduce((s, o) => s + Number(o.total || 0), 0);
    const ticket = pedidos.length ? pedidos.reduce((s, o) => s + Number(o.total || 0), 0) / pedidos.length : null;
    const canasta = pedidos.length ? pedidos.reduce((s, o) => s + (o.items || []).length, 0) / pedidos.length : null;

    // Reposición digital: pedidos repetidos con canal registrado que llegan por el portal.
    const canalDe = o => String(o.channel || o.source || o.salesChannel || '');
    const repetidos = pedidos
      .filter(o => o.eventName === 'repeat_order_confirmed' || Boolean(o.sourceOrderId))
      .filter(o => canalDe(o).trim() !== '');
    const reposicionDigital = repetidos.length
      ? 100 * repetidos.filter(o => /portal|digital|web/i.test(canalDe(o))).length / repetidos.length
      : null;

    // NPS: promotores (9-10) menos detractores (0-6), usando el último NPS de cada cuenta.
    const ultimosNps = cuentas.map(c => (c.orders || [])
      .filter(o => o.npsScore !== null && o.npsScore !== undefined && Number.isFinite(Number(o.npsScore)))
      .reduce((mejor, o) => (!mejor || Number(o.at) > Number(mejor.at) ? o : mejor), null))
      .filter(Boolean).map(o => Number(o.npsScore));
    const nps = ultimosNps.length
      ? 100 * (ultimosNps.filter(s => s >= 9).length - ultimosNps.filter(s => s <= 6).length) / ultimosNps.length
      : null;

    // Retención (proxy): cuenta que compra dentro de su ciclo, con la misma regla de alerta del CRM (1,3 veces el ciclo).
    const conPedidos = cuentas.filter(c => (c.orders || []).length);
    const enRiesgo = conPedidos.filter(c => {
      const s = statsDe(c);
      const ultimo = Math.max(...c.orders.map(o => Number(o.at) || 0));
      const ciclo = Number(s.freqDays || c.freq || 0);
      return s.segment === 'Inactivo' || (ciclo > 0 && (hoy - ultimo) / DIA > ciclo * 1.3);
    }).length;
    const retencion = conPedidos.length ? 100 * (conPedidos.length - enRiesgo) / conPedidos.length : null;

    // Aprobaciones: solicitudes pendientes de Jefatura más los ejemplos de prueba de «Por aprobar».
    const existentes = ap.jefeAprob || [];
    const aprobaciones = existentes.filter(i => ['pendiente', 'pidio_info'].includes(i.estado)).length
      + (leads.length && !existentes.some(i => i.id === 'crm2-sample-proposal') ? 1 : 0)
      + (cuentas.some(c => c.referral) && !existentes.some(i => i.id === 'crm2-sample-referral') ? 1 : 0);

    let legadas = [];
    try { legadas = M4R.quoted ? M4R.quoted(st) : []; } catch (_) { legadas = []; }
    const propuestas = (ap.quotes || []).length + (Array.isArray(legadas) ? legadas.length : 0);

    return {
      leads: leads.length, mql, sql, enEspera, pipeline: sql + enEspera, propuestas, origen,
      gasto, cpl, cacDemo, nuevas, nuevasCac, ventas90, ticket, canasta,
      reposicionDigital, nps, retencion, conPedidos: conPedidos.length, enRiesgo, aprobaciones
    };
  }

  // KPIs de Ventas.
  function kpisVentas(d) {
    const rep = d.reposicionDigital;
    const repAvance = rep == null ? null : ((rep - 18) / (40 - 18)) * 100;
    const ritmo = V5.altasCentral * 90 / 365;
    const altasAvance = (d.nuevas / ritmo) * 100;
    return [
      {
        id: 'pipeline', nombre: 'Pipeline abierto', fase: 'Todo el ciclo',
        valor: `${numero(d.pipeline)} oportunidades`,
        valorDetalle: `${numero(d.sql)} SQL y ${numero(d.enEspera)} traspasos en espera (datos de prueba)`,
        meta: 'No tiene meta numérica', metaDetalle: 'Cada traspaso termina en SQL o en devolución con motivo.',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: Ventas food service +12 % (objetivo general).',
        que: 'Oportunidades abiertas de Ventas: contactos aceptados como SQL y traspasos de Marketing que esperan respuesta.',
        como: 'SQL (aceptados o marcados como SQL) más leads con estado «esperando» o «pendiente». Cifra de datos de prueba del CRM.',
        importa: 'Es el inventario comercial. Sin pipeline no hay de dónde crecer, aunque Marketing genere contactos.',
        fuente: 'Informe p. 23 (traspaso con cierre de ciclo) y p. 31 (Tabla 15: qué ve Ventas en «Hoy»). Glosario p. 53 (SQL).'
      },
      {
        id: 'propuestas', nombre: 'Propuestas', fase: 'Interactuar',
        valor: `${numero(d.propuestas)} propuestas`,
        valorDetalle: 'registradas en esta sesión (datos de prueba)',
        meta: '95 % dentro de plazo', metaDetalle: 'En ≤ 2 días hábiles. Umbral propuesto del piloto.',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR} (el CRM no mide el plazo todavía)`,
        objetivo: 'Responde a: tiempo de respuesta y propuesta en plazo (SLA propuesto).',
        que: 'Propuestas completas que Ventas envía a un contacto o cuenta: máquina, carga inicial y condiciones.',
        como: 'Propuestas completas en 2 días hábiles o menos, dividido por las propuestas elegibles.',
        importa: 'Mide si Ventas responde a tiempo. Si el porcentaje cae, el piloto ajusta el flujo, la información o la dotación.',
        fuente: 'Excel «KPIs explicados», filas 9 y 10 (umbral propuesto del piloto). Informe p. 32 (contacto en ≤ 1 día hábil).'
      },
      {
        id: 'cierres', nombre: 'Cierres (SQL a primera factura)', fase: 'Interactuar',
        valor: POR_MEDIR,
        valorDetalle: 'requiere la primera factura del ERP',
        meta: 'Por establecer en el piloto', metaDetalle: 'Hipótesis del modelo: 14,3 % de los SQL pagados y 20 % de los no pagados llegan a cuenta.',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: Ventas food service +12 % (objetivo general).',
        que: 'Proporción de oportunidades SQL que terminan en primera factura.',
        como: 'Cuentas SQL con primera factura, dividido por el total de SQL. Se mide cruzando el CRM con el ERP.',
        importa: 'Separa un contacto interesado de una venta real. El modelo asume que solo una de cada siete SQL pagados se vuelve cuenta.',
        fuente: 'Excel «KPIs explicados», fila 11; «Supuestos» B26 (0,143) y B27 (0,20).'
      },
      {
        id: 'cuentas-nuevas', nombre: 'Cuentas nuevas (90 días)', fase: 'Todo el ciclo',
        valor: `${numero(d.nuevas)} cuentas`,
        valorDetalle: 'con primera compra en los últimos 90 días (datos de prueba)',
        meta: `${numero(V5.altasCentral)} altas en el año 1`,
        metaDetalle: `Escenario central V5. Prudente ${numero(V5.altasPrudente)}; expansión ${numero(V5.altasExpansion)}.`,
        avance: altasAvance,
        avanceTexto: `Avance: ${pct(acotar(altasAvance))} del ritmo de 90 días (${numero(V5.altasCentral)} × 90/365 = ${numero(ritmo, 1)})`,
        objetivo: 'Responde a: Ventas food service +12 % (objetivo general) y altas del modelo.',
        que: 'Cuentas que compran por primera vez y pasan a la base de clientes.',
        como: 'Cuentas cuya primera factura cae en los últimos 90 días. La meta anual se reparte en 90 días de forma lineal (supuesto de este tablero).',
        importa: 'Es el motor principal del modelo, junto con el desarrollo de cartera y la permanencia. Sin altas, el +12 % depende solo de las cuentas actuales.',
        fuente: 'Excel «V5 Resumen» B5:B7 (24, 39,25 y 60 altas en Y1). Informe p. 38 (24/24/24 prudente; 39/45/50 central).'
      },
      {
        id: 'ticket', nombre: 'Ticket promedio', fase: 'Deleitar',
        valor: d.ticket == null ? POR_MEDIR : clp(d.ticket),
        valorDetalle: 'promedio por pedido (datos de prueba)',
        meta: '+10 % en cuentas activadas',
        metaDetalle: `Referencias del modelo: primera compra ${clp(V5.ticketPrimera)}; reposición mensual ${clp(V5.ticketReposicion)}.`,
        avance: null, avanceTexto: 'Avance: por medir (falta la base de cuentas activadas)',
        objetivo: 'Responde a: Ticket +10 % en cuentas activadas (hipótesis del equipo).',
        que: 'Valor medio de cada pedido.',
        como: 'Ventas netas dividido por el número de pedidos válidos.',
        importa: 'Es la palanca para crecer con las mismas cuentas. El modelo supone +10 % de compra adicional por activación (Supuestos B6).',
        fuente: 'Excel «KPIs explicados», fila 19; «V5 Resumen» B12:B13; informe p. 12 (Tabla 8).'
      },
      {
        id: 'canasta', nombre: 'Canasta por pedido', fase: 'Deleitar',
        valor: d.canasta == null ? POR_MEDIR : `${numero(d.canasta, 1)} productos`,
        valorDetalle: 'productos distintos por pedido (datos de prueba)',
        meta: 'Referencia: 14 productos (no es meta)',
        metaDetalle: 'Primera carga del modelo: 14 productos por $1.331.220 netos, más kit (informe p. 36).',
        avance: null, avanceTexto: 'Avance: no aplica; la primera carga no es una meta de canasta.',
        objetivo: 'Responde a: Ticket +10 % (venta complementaria: insumos y vasos).',
        que: 'Cuántos productos distintos trae cada pedido.',
        como: 'Promedio de productos distintos por pedido.',
        importa: 'Una canasta más completa (café, insumos y vasos) sostiene el ticket y reduce la compra en otro proveedor.',
        fuente: 'Informe p. 12 (venta complementaria según el uso) y p. 36 (primera carga de 14 productos).'
      },
      kpiReposicion(d, repAvance, 'Responde a: Reposición digital HORECA 18 % → 40 % (Deleitar).')
    ];
  }

  // Reposición digital: lo ven Ventas y Jefatura, con la misma definición.
  function kpiReposicion(d, avance, objetivo) {
    const rep = d.reposicionDigital;
    return {
      id: 'reposicion-digital', nombre: 'Reposición digital HORECA', fase: 'Deleitar',
      valor: rep == null ? POR_MEDIR : pct(rep),
      valorDetalle: rep == null ? 'se mide con pedidos repetidos que indiquen canal' : 'pedidos repetidos por portal (datos de prueba)',
      meta: '40 %', metaDetalle: 'Base del informe: 18 %. El 82 % de la reposición HORECA ocurre fuera del canal digital.',
      avance, avanceTexto: avance == null ? `Avance: ${POR_MEDIR}` : `Avance: ${pct(acotar(avance))} del camino de 18 % a 40 %`,
      objetivo,
      que: 'Parte de los pedidos de reposición que el cliente hace por el portal, sin llamar ni escribir.',
      como: 'Pedidos repetidos digitales, dividido por los pedidos repetidos elegibles.',
      importa: 'Libera a los ocho digitadores que hoy ingresan pedidos a mano y da continuidad al recordatorio de reposición.',
      fuente: 'Informe p. 12 (Tabla 8: 18 % a 40 %), p. 9 (82 % fuera del canal digital). Excel «KPIs explicados», fila 13.'
    };
  }

  // KPIs de Marketing.
  function kpisMarketing(d) {
    const o = d.origen;
    return [
      {
        id: 'leads', nombre: 'Leads (contactos)', fase: 'Atraer',
        valor: `${numero(d.leads)} contactos`, valorDetalle: 'en el CRM (datos de prueba)',
        meta: '+25 % en leads calificados', metaDetalle: 'Base sin registrar: pendiente de Marley.',
        avance: null, avanceTexto: 'Avance: por medir (falta la base del período anterior)',
        objetivo: 'Responde a: Leads calificados +25 % (objetivo específico de captación).',
        que: 'Personas o negocios que dejaron datos, preguntaron o cotizaron.',
        como: 'Contactos del CRM con origen registrado.',
        importa: 'Es la materia prima del embudo. El +25 % se mide sobre leads calificados, no sobre todo el volumen.',
        fuente: 'Informe p. 12 (Tabla 8) y p. 23 (puntaje de leads).'
      },
      {
        id: 'mql', nombre: 'MQL (calificados por Marketing)', fase: 'Atraer',
        valor: `${numero(d.mql)} MQL`, valorDetalle: 'interés de 40 o más, con contacto, negocio B2B y permiso',
        meta: 'Interés de 40 puntos o más', metaDetalle: 'Umbral del informe. Se calibra en el piloto con SQL aceptados (días 30 y 90).',
        avance: null, avanceTexto: 'Avance: no aplica; es un umbral de calificación.',
        objetivo: 'Responde a: Leads calificados +25 % (MQL es el paso previo a Ventas).',
        que: 'Lead que Marketing considera listo para Ventas: tiene señales suficientes de interés y de encaje.',
        como: 'Interés de 40 o más sobre 100, con contacto identificado, negocio B2B y permiso de promoción. El valor esperado solo ordena la atención.',
        importa: 'Evita pasar contactos fríos a Ventas. Los pesos son hipótesis: el piloto compara los MQL con los SQL aceptados antes de cambiarlos.',
        fuente: 'Informe p. 23 (puntaje de leads y umbral MQL). Glosario p. 53.'
      },
      {
        id: 'sql', nombre: 'SQL (aceptados por Ventas)', fase: 'Atraer',
        valor: `${numero(d.sql)} SQL`, valorDetalle: 'oportunidades aceptadas por Ventas (datos de prueba)',
        meta: '+25 % (SQL aceptados)', metaDetalle: 'Base sin registrar: pendiente de Marley.',
        avance: null, avanceTexto: 'Avance: por medir (falta la base).',
        objetivo: 'Responde a: Leads calificados +25 % (se mide con SQL aceptados).',
        que: 'Oportunidad que Ventas acepta porque ve potencial real de cierre.',
        como: 'SQL aceptados por período, sin duplicar cuentas.',
        importa: 'Es el indicador que el informe usa para medir la meta de leads. El modelo supone que 40 % de los leads llega a SQL (Supuestos B25).',
        fuente: 'Excel «KPIs explicados», fila 7; «Supuestos» B25; informe p. 12 y glosario p. 53.'
      },
      {
        id: 'cpl', nombre: 'Costo por lead (CPL)', fase: 'Atraer',
        valor: d.cpl == null ? POR_MEDIR : clp(d.cpl),
        valorDetalle: `gasto de prueba ${clp(d.gasto)} entre ${numero(d.leads)} contactos`,
        meta: 'No fijada en el informe', metaDetalle: 'Se fija en el piloto con gasto real.',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: costo de adquisición del escenario central (V5).',
        que: 'Cuánto cuesta conseguir un contacto.',
        como: 'Gasto de captación del período, dividido por los contactos del mismo período.',
        importa: 'Permite comparar canales antes de subir la pauta. No confundirlo con el CPC (costo por clic). Los CPL previstos de LinkedIn (Supuestos B41:B46) son estimaciones sin prueba propia y no se usan como meta.',
        fuente: 'Glosario p. 53; «Supuestos» B36:B46 (CPC y CPL previstos, hipótesis de planificación).'
      },
      {
        id: 'cac', nombre: 'CAC (costo por cuenta nueva)', fase: 'Finanzas',
        valor: d.cacDemo == null ? POR_MEDIR : clp(d.cacDemo),
        valorDetalle: `gasto de prueba dividido por ${numero(d.nuevasCac)} cuentas nuevas`,
        meta: clp(V5.cacPauta),
        metaDetalle: `Escenario central, solo pauta. Con creatividad y gestión imputadas: ${clp(V5.cacAmpliado)}.`,
        avance: null, avanceTexto: 'Avance: menor es mejor; comparar con el central cuando haya gasto real.',
        objetivo: 'Responde a: costo de adquisición del escenario central (V5).',
        que: 'Inversión de marketing y ventas atribuida a cada cuenta nueva que factura.',
        como: 'Gasto atribuido dividido por las cuentas nuevas con primera factura. Modelo: $18 MM de pauta ÷ 17,25 altas pagadas = $1.043.478.',
        importa: 'Dice cuánto cuesta ganar una cuenta. Si el CAC supera lo que deja cada cuenta, el crecimiento no se paga.',
        fuente: 'Excel «V5 Resumen» K6:L6; «KPIs explicados» fila 20. Informe p. 37 y glosario p. 53.'
      },
      {
        id: 'roas', nombre: 'ROAS (retorno de anuncios)', fase: 'Finanzas',
        valor: POR_MEDIR, valorDetalle: 'sin ventas atribuidas a anuncios en los datos de prueba',
        meta: `${numero(V5.roasCentral, 2)}× en el año 1`,
        metaDetalle: `Cohorte de 12 meses: ${numero(V5.roasCohorte, 2)}×. Equilibrio de pauta: ${numero(V5.equilibrio, 2)}×.`,
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: retorno de la pauta (escenario central V5).',
        que: 'Ventas atribuidas a anuncios por cada peso invertido en pauta.',
        como: 'Ventas atribuidas a anuncios, dividido por el costo de anuncios.',
        importa: 'Con 30 % de margen y 80 % de incrementalidad (hipótesis), la pauta se paga solo sobre 4,17×. Sin comprobación, no se escala.',
        fuente: 'Informe p. 38 (Tabla 19); Excel «V5 Resumen» J6; glosario p. 53.'
      },
      {
        id: 'origen', nombre: 'Origen de los contactos', fase: 'Atraer',
        valor: `${numero(o.organico)} · ${numero(o.campana)} · ${numero(o.referido)} · ${numero(o.otros)}`,
        valorDetalle: 'orgánico · campañas · referido · otros (datos de prueba)',
        meta: '17 pagadas · 7 orgánicas · 5 referidas · 10 de ejecutivos',
        metaDetalle: 'Altas del año 1 en el escenario central. No es la mezcla de contactos.',
        avance: null, avanceTexto: 'Avance: no aplica; es una mezcla objetivo.',
        objetivo: 'Responde a: Leads calificados +25 % y altas no pagadas del modelo.',
        que: 'De dónde llega cada contacto: primer toque registrado.',
        como: 'Campo de origen del contacto, agrupado en orgánico, campañas (pagadas), referido y otros.',
        importa: 'Muestra qué canal trae las cuentas. El modelo supone que más de la mitad de las altas no viene de pauta, por eso pesan el referido y el ejecutivo.',
        fuente: 'Excel «Supuestos» B33:B35 (7 orgánicas, 5 referidas, 10 de ejecutivos). Informe p. 37 (17,25 pagadas).'
      }
    ];
  }

  // KPIs de Jefatura.
  function kpisJefatura(d) {
    const ret = d.retencion;
    const retAvance = ret == null ? null : ((ret - 86) / (90 - 86)) * 100;
    const nps = d.nps;
    const npsAvance = nps == null ? null : ((nps - 42) / (52 - 42)) * 100;
    return [
      {
        id: 'ventas-vs-meta', nombre: 'Ventas frente a la meta +12 %', fase: 'Objetivo general',
        valor: clp(d.ventas90), valorDetalle: 'ventas de prueba en 90 días. Base comparable pendiente de Marley.',
        meta: '+12 %', metaDetalle: 'Ventas netas Food Service de 12 meses comparables (meta del brief).',
        avance: V5.aporteMeta, avanceTexto: `Avance modelado: ${pct(V5.aporteMeta, 1)} de la meta (escenario central V5; no son ventas reales)`,
        objetivo: 'Responde a: Ventas food service +12 % (objetivo general).',
        que: 'Cuánto crecen las ventas netas Food Service frente a los 12 meses comparables.',
        como: '(Ventas netas de los últimos 12 meses ÷ ventas comparables) − 1. Hoy no hay base comparable: la entrega Marley.',
        importa: 'Es la meta general del brief. El informe advierte que no se declara cumplida sin base real.',
        fuente: 'Excel «KPIs explicados» fila 5; «Supuestos» B13 (base pendiente); «V5 Resumen» N6 (4,4 %). Informe p. 37-38.'
      },
      {
        id: 'margen', nombre: 'Margen de contribución', fase: 'Finanzas',
        valor: `${numero(V5.margen)} %`, valorDetalle: 'supuesto de contribución, no margen real de Marley',
        meta: 'Validar con Finanzas (no es meta)', metaDetalle: `Sensibilidad de 25 % a 45 %. Histórico EP5 y V3: ${numero(V5.margenHistorico)} %.`,
        avance: null, avanceTexto: 'Avance: no aplica; es un supuesto.',
        objetivo: 'Responde a: retorno del modelo (contribución sobre ventas adicionales).',
        que: 'Parte de cada venta incremental que queda como contribución.',
        como: 'Contribución incremental estimada, dividido por las ventas incrementales.',
        importa: 'Convierte ventas en retorno. El calculador de Metas y canales aún usa 35 % (EP5) y el modelo V5 usa 30 %; conviene unificarlos antes de decidir.',
        fuente: '«Supuestos» B7 (0,30), B76 (0,35), B63:B64 (0,25 y 0,45). «KPIs explicados» fila 23.'
      },
      {
        id: 'retorno', nombre: 'Retorno del modelo (ROI a 36 meses)', fase: 'Finanzas',
        valor: `+${numero(V5.roiCentral, 1)} %`, valorDetalle: 'escenario central (simulación del modelo)',
        meta: 'No fijada en el informe',
        metaDetalle: `Referencias: central +${numero(V5.roiCentral, 1)} %; prudente ${numero(V5.roiPrudente, 1)} %; expansión +${numero(V5.roiExpansion, 1)} %.`,
        avance: null, avanceTexto: 'Avance: no aplica; es un escenario, no una meta.',
        objetivo: 'Responde a: retorno del programa a 36 meses (modelo V5).',
        que: 'Saldo neto incremental del programa a 36 meses, dividido por la inversión total.',
        como: `Saldo a 36 meses (+$18,0 MM) ÷ inversión de ${numero(V5.inversion36, 1)} MM = +6,2 %.`,
        importa: 'Dice si el programa se paga. El escenario prudente pierde dinero, por eso el piloto decide por fases.',
        fuente: 'Excel «V5 Resumen» H6:I6 e «Inversion actual» E11. Informe p. 36-37 (Tabla 17).'
      },
      {
        id: 'nps', nombre: 'NPS (recomendación)', fase: 'Deleitar',
        valor: nps == null ? POR_MEDIR : numero(nps),
        valorDetalle: nps == null ? 'no hay encuestas NPS en los datos de prueba' : 'promotores menos detractores, último NPS por cuenta (datos de prueba)',
        meta: '52', metaDetalle: 'Base del informe: 42 (Tabla 8).',
        avance: npsAvance, avanceTexto: npsAvance == null ? `Avance: ${POR_MEDIR}` : `Avance: ${pct(acotar(npsAvance))} del camino de 42 a 52`,
        objetivo: 'Responde a: NPS 42 → 52 (Deleitar).',
        que: 'Qué tan probable es que el cliente recomiende Marley, en una escala de 0 a 10.',
        como: '% de promotores (9-10) menos % de detractores (0-6), sobre las encuestas comparables.',
        importa: 'Anticipa recompra y referidos. El informe lo lee junto con la reposición y el cumplimiento, nunca solo.',
        fuente: 'Informe p. 12 (Tabla 8) y p. 39 (criterio de interpretación). Excel «KPIs explicados» fila 16.'
      },
      {
        id: 'retencion', nombre: 'Retención de cuentas', fase: 'Deleitar',
        valor: ret == null ? POR_MEDIR : pct(ret),
        valorDetalle: `proxy de datos de prueba: ${numero(d.conPedidos - d.enRiesgo)} de ${numero(d.conPedidos)} cuentas compran dentro de su ciclo`,
        meta: '90 %', metaDetalle: 'Base del informe: 86 % (Tabla 8).',
        avance: retAvance, avanceTexto: retAvance == null ? `Avance: ${POR_MEDIR}` : `Avance: ${pct(acotar(retAvance))} del camino de 86 % a 90 %`,
        objetivo: 'Responde a: Retención 86 % → 90 % (Deleitar).',
        que: 'Cuentas de la cohorte que siguen comprando.',
        como: 'Cuentas que siguen comprando, dividido por las cuentas base de la cohorte. En estos datos de prueba se usa un proxy: cuentas que compran dentro de 1,3 veces su ciclo.',
        importa: 'Una cuenta que se va sin aviso pierde su venta futura. El modelo supone que la permanencia sube de 86 % a 90 % con el programa.',
        fuente: 'Informe p. 12 (Tabla 8). Excel «KPIs explicados» fila 17 y «Supuestos» B10:B11.'
      },
      {
        id: 'otif', nombre: 'OTIF (entrega completa y a tiempo)', fase: 'Deleitar',
        valor: POR_MEDIR, valorDetalle: 'el CRM de prueba no registra entregas a tiempo',
        meta: '≥ 96 %', metaDetalle: 'Meta del brief (Tabla 8). Sin línea base medida.',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: OTIF de al menos 96 % y quiebres OCS −30 % (Deleitar).',
        que: 'Pedidos entregados completos y a tiempo, sobre el total de pedidos entregados.',
        como: 'Pedidos completos y a tiempo, dividido por los pedidos entregados.',
        importa: 'Si el OTIF cae, el informe frena la captación: prometer más de lo que la operación cumple daña la cuenta.',
        fuente: 'Informe p. 12 (Tabla 8), p. 27 (frenar captación) y p. 41 (Tabla 21). Excel «KPIs explicados» fila 14.'
      },
      {
        id: 'quiebres', nombre: 'Quiebres de stock OCS', fase: 'Deleitar',
        valor: POR_MEDIR, valorDetalle: 'el CRM de prueba no registra quiebres',
        meta: '−30 %', metaDetalle: 'Sobre la tasa base de quiebres OCS (base sin registrar).',
        avance: null, avanceTexto: `Avance: ${POR_MEDIR}`,
        objetivo: 'Responde a: OTIF de al menos 96 % y quiebres OCS −30 % (Deleitar).',
        que: 'Veces que un producto no está disponible cuando el cliente lo pide.',
        como: '(Tasa actual de quiebres ÷ tasa base) − 1.',
        importa: 'Un quiebre convierte una reposición en reclamo. El informe pide detener la escala cuando hay quiebres sin fecha.',
        fuente: 'Informe p. 12 (Tabla 8) y p. 41 (Tabla 21). Excel «KPIs explicados» fila 15.'
      },
      kpiReposicion(d, d.reposicionDigital == null ? null : ((d.reposicionDigital - 18) / (40 - 18)) * 100,
        'Responde a: Reposición digital HORECA 18 % → 40 % (Deleitar).'),
      {
        id: 'aprobaciones', nombre: 'Aprobaciones pendientes', fase: 'Gobierno',
        valor: `${numero(d.aprobaciones)} pendientes`,
        valorDetalle: 'incluye los ejemplos de prueba de «Por aprobar»',
        meta: 'Solo excepciones',
        metaDetalle: 'Descuentos fuera de lista, comodato bajo el volumen mínimo, plazos especiales y canje de referidos.',
        avance: null, avanceTexto: 'Avance: no aplica; es una cola de decisiones, no una meta.',
        objetivo: 'Responde a: decisiones de Jefatura (solo excepciones).',
        que: 'Solicitudes que esperan una decisión de Jefatura antes de avanzar.',
        como: 'Solicitudes pendientes o con información pedida, más los ejemplos de prueba del CRM.',
        importa: 'El informe reserva a Jefatura solo las excepciones. Si la cola crece, la operación se frena sin que nadie lo vea.',
        fuente: 'Informe p. 31 (Tabla 15: qué decide Jefatura).'
      }
    ];
  }

  // Render.
  function kpiHtml(k) {
    const barra = k.avance == null || !Number.isFinite(k.avance)
      ? '<div class="crm-kpi__barra crm-kpi__barra--vacia" role="img" aria-label="Avance por medir en el piloto"><i style="width:0%"></i></div>'
      : `<div class="crm-kpi__barra" role="img" aria-label="Avance ${numero(acotar(k.avance), 1)} %"><i style="width:${acotar(k.avance).toFixed(1)}%"></i></div>`;
    const pendiente = k.valor === POR_MEDIR ? ' crm-kpi__valor--pendiente' : '';
    return `<article class="crm-kpi" data-kpi="${esc(k.id)}">
      <header class="crm-kpi__cab"><h3>${esc(k.nombre)}</h3><span class="crm-kpi__fase">${esc(k.fase)}</span></header>
      <div class="crm-kpi__cifras">
        <div class="crm-kpi__bloque"><span class="crm-kpi__rotulo">Simulación</span><b class="crm-kpi__valor${pendiente}">${esc(k.valor)}</b><small>${esc(k.valorDetalle)}</small></div>
        <div class="crm-kpi__bloque crm-kpi__bloque--meta"><span class="crm-kpi__rotulo">Meta del informe</span><b class="crm-kpi__valor">${esc(k.meta)}</b><small>${esc(k.metaDetalle)}</small></div>
      </div>
      <div class="crm-kpi__avance">${barra}<small>${esc(k.avanceTexto)}</small></div>
      <p class="crm-kpi__objetivo" data-meta-objetivo>${esc(k.objetivo)}</p>
      <details class="crm-kpi__explica" data-kpi-explicacion>
        <summary>¿Qué significa?</summary>
        <dl>
          <dt>Qué es</dt><dd>${esc(k.que)}</dd>
          <dt>Cómo se calcula</dt><dd>${esc(k.como)}</dd>
          <dt>Por qué importa</dt><dd>${esc(k.importa)}</dd>
          <dt>Fuente</dt><dd>${esc(k.fuente)}</dd>
        </dl>
      </details>
    </article>`;
  }

  function construir(rol, ruta) {
    const cab = CABECERAS[rol];
    let kpis = [];
    let aviso = '';
    try {
      const d = calcular();
      kpis = rol === 'ventas' ? kpisVentas(d) : rol === 'marketing' ? kpisMarketing(d) : kpisJefatura(d);
    } catch (error) {
      console.warn('[crm-tablero] no se pudieron calcular las cifras', error);
      aviso = '<p class="crm-tablero__nota">No se pudieron calcular las cifras en este momento. Las metas del informe sí se muestran.</p>';
    }
    const objetivos = cab.objetivos.map(([fuerte, texto]) => `<li><b>${esc(fuerte)}</b> ${esc(texto)}</li>`).join('');
    return `<section id="crm-tablero" class="crm-tablero" data-rol="${rol}" data-ruta="${ruta}" aria-labelledby="crm-tablero-titulo">
      <header class="crm-tablero__cab">
        <p class="crm-tablero__kicker">${esc(cab.kicker)}</p>
        <h2 id="crm-tablero-titulo" class="crm-tablero__titulo">${esc(cab.titulo)}</h2>
        <p class="crm-tablero__nota">${esc(NOTA_BASE)}</p>
        ${aviso}
        <div class="crm-tablero__general"><span>Objetivo general</span><b>${esc(OBJ_GENERAL)}</b></div>
        <ul class="crm-tablero__objetivos" aria-label="Objetivos específicos del área">${objetivos}</ul>
      </header>
      <div class="crm-tablero__grid">${kpis.map(kpiHtml).join('')}</div>
    </section>`;
  }

  // Lo pone al inicio del contenido de la pantalla que corresponde. Crm-v2 vuelve a dibujar la pantalla
  // completa al cambiar de ruta o de estado; por eso se vuelve a poner cada vez que desaparece.
  function sincronizar() {
    const raiz = document.getElementById(RAIZ_ID);
    if (!raiz) return;
    const shell = raiz.querySelector('.crm2-shell');
    const contenido = raiz.querySelector('.crm2-content');
    const existente = document.getElementById('crm-tablero');
    const ruta = (location.hash || '').replace(/^#/, '').split('?')[0];
    const rolPantalla = shell ? (shell.className.match(/crm2-role-(ventas|marketing|jefatura)/) || [])[1] : null;
    const rol = rolPantalla && RUTA_ROL[ruta] === rolPantalla && !raiz.hidden ? rolPantalla : null;
    if (!rol || !contenido) {
      if (existente) existente.remove();
      return;
    }
    if (existente && existente.dataset.rol === rol && existente.dataset.ruta === ruta
      && existente.parentElement === contenido) return;
    if (existente) existente.remove();
    // Va justo después de la barra del agente del CRM (crm-agente.js), si existe; si no, al inicio.
    const barraAgente = contenido.querySelector(':scope > #crm-agente-barra, :scope > .crm-agente');
    const html = construir(rol, ruta);
    if (barraAgente) barraAgente.insertAdjacentHTML('afterend', html);
    else contenido.insertAdjacentHTML('afterbegin', html);
  }

  // setTimeout en vez de requestAnimationFrame: rAF no corre en pestañas ocultas y el bloque no aparecería.
  let pendiente = 0;
  const programar = () => {
    if (pendiente) return;
    pendiente = setTimeout(() => {
      pendiente = 0;
      try { sincronizar(); } catch (error) { console.warn('[crm-tablero]', error); }
    }, 0);
  };
  const vigilante = new MutationObserver(programar);
  let raizVigilada = null;
  function vigilarRaiz() {
    const raiz = document.getElementById(RAIZ_ID);
    if (raiz && raiz !== raizVigilada) {
      raizVigilada = raiz;
      vigilante.observe(raiz, { childList: true, subtree: true });
      programar();
    }
  }
  function iniciar() {
    new MutationObserver(vigilarRaiz).observe(document.body, { childList: true });
    window.addEventListener('hashchange', programar);
    vigilarRaiz();
    programar();
  }
  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar, { once: true });
})();
