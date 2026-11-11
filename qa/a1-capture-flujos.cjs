// Captura las vistas de los siete caminos desde el lanzador, con datos ficticios.
// Captura la versión disponible de A7 y conserva enlaces de sesión por fase.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const KIT = path.join(ROOT, 'PRUEBA_CON_PERSONAS', 'RONDA_FINAL_E0_E9');
const BASE = 'http://127.0.0.1:8877';
const LAUNCHER = '/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/inicio.html';
const EVIDENCE = path.join(KIT, 'evidencia', 'flujos');
const q = (value) => String(value).replace(/&/g, '&amp;');

function n(id, tipo, etapa, titulo, pantalla, url, hace, observar, metrica, miniatura, extra = {}) {
  return { id, tipo, etapa, titulo, pantalla, url, hace, observar, metrica, miniatura, ...extra };
}
const externalTasks = {
  E0: ['Empieza como lo harías normalmente; escribe tu búsqueda con tus palabras.', 'Primera acción, tiempo, consulta y dudas.', 'tiempo a primera acción · consulta · errores · SEQ'],
  E1: ['Elige el resultado o anuncio que usarías y continúa.', 'Primer clic, retrocesos y distinción entre anuncio y orgánico.', 'resultado elegido · clic · retrocesos · SEQ'],
  E2: ['Revisa la información y avisa cuando entiendas qué ofrece y qué falta.', 'Comprensión de la oferta, condiciones y siguiente paso.', 'tiempo · comprensión · condición buscada · SEQ'],
  E3: ['Si decides pedir información, usa solo la ficha ficticia entregada.', 'Decisión de contacto, errores y claridad de permisos.', 'tiempo de captura · permiso de respuesta · errores · SEQ'],
  E4: ['Continúa con el diagnóstico y explica qué revisarías antes de avanzar.', 'Diagnóstico, propuesta preliminar y condiciones pendientes.', 'tiempo · respuestas del diagnóstico · decisión · SEQ'],
  E5: ['Retoma la situación desde donde quedaste.', 'Encuentra el mensaje y distingue seguimiento de marketing.', 'tiempo · correo encontrado · claridad · SEQ'],
  E6: ['Continúa como después de confirmar que el negocio avanzará.', 'Próximos pasos, responsable, permisos y pendientes.', 'tiempo · contrato simulado · próximos pasos · SEQ'],
  E7: ['Revisa el historial y prepara el siguiente pedido.', 'Cantidad, reposición y confirmación antes de repetir.', 'tiempo · pedido · repetición · SEQ'],
  E8: ['Informa el problema y averigua qué pasa después.', 'Facilidad para reportar, clasificación, estado y expectativas.', 'tiempo · caso · CSAT 1–5 · comentario · SEQ'],
  E9: ['Decide si quieres compartir algo; no recomiendes un negocio real.', 'Invitación opcional, permiso y diferencia entre enlace y lead.', 'NPS 0–10 · decisión · SEQ'],
};
const initialQ = (id, stage, internal = false, image = null) => n(id, 'cuestionario', stage, internal ? 'Cuestionario inicial · bienvenida y preguntas C' : 'Cuestionario inicial · bienvenida y preguntas', 'sesion.html?fase=inicial', 'sesion.html?fase=inicial', 'Acepta el consentimiento y responde las preguntas iniciales antes de comenzar.', 'Claridad de entrada, aceptación, comodidad con escalas, alternativas y preguntas abiertas.', 'consentimiento · respuestas por sesión · tiempo por respuesta', image, { pendienteA7: true, archivo: 'sesion.html' });
const pauseQ = (id, stage, phase, label, image = null) => n(id, 'cuestionario', stage, label, `sesion.html?fase=${phase}`, `sesion.html?fase=${phase}`, 'Completa el bloque breve de pausa y vuelve al recorrido.', 'Comprensión de lo recorrido hasta este punto y dudas espontáneas.', 'respuestas por pausa · omisiones · tiempo por respuesta', image, { pendienteA7: true, archivo: 'sesion.html' });
const finalQ = (id, stage, internal = false, image = null) => n(id, 'cuestionario', stage, internal ? 'Cuestionario final · equipo interno' : 'Cuestionario final · camino externo', 'sesion.html?fase=final', 'sesion.html?fase=final', 'Responde las preguntas finales y cierra la sesión.', 'SUS, confianza, intención, información faltante y comentarios.', 'SUS · respuestas por sesión · tiempo por respuesta', image, { pendienteA7: true, archivo: 'sesion.html' });
const responses = (id, image = null) => n(id, 'cierre', 'E9', 'Respuestas y exportación', 'respuestas.html', 'respuestas.html', 'El moderador revisa y exporta las respuestas al cierre.', 'Completitud de registros, camino, participante y etapa.', 'conteos · CSV largo · resumen por persona', image, { pendienteA7: true, archivo: 'respuestas.html' });

function startNode(id, title, asset) {
  return n(id, 'entrada', 'C-entrada', title, 'inicio.html', 'inicio.html', 'El moderador elige participante, perfil y camino en el lanzador.', 'Se inicia con la asignación correcta y datos ficticios.', 'camino · código participante · perfil', asset);
}
function view(id, stage, title, screen, url, taskKey, asset, extra = {}) {
  const [hace, observar, metrica] = externalTasks[taskKey] || ['Sigue la consigna del rol en el guion.', 'Comprensión, decisiones, dudas y errores.', 'tiempo · resultado · SEQ · errores · nota'];
  return n(id, 'vista', stage, title, screen, url, hace, observar, metrica, asset, extra);
}

const flows = [
  {
    id: 'A', nombre: 'A · Google directo', grupo: 'externo', viewport: '390×844', inicio: 'inicio.html',
    nodes: [
      startNode('A-01', 'Entrada · lanzador', 'A-01.jpg'), initialQ('A-02', 'E0', false, 'A-14.jpg'),
      view('A-03', 'E0', 'Situación inicial del hotel', 'C01 · contexto del participante', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C01', 'E0', 'A-02.jpg', { requiereRecorrido: true }),
      view('A-04', 'E0', 'Búsqueda simulada en blanco', 'serp-seo-aeo-geo.html · consulta vacía', '../serp-seo-aeo-geo.html?test=sitio&camino=A&perfil=hotel', 'E0', 'A-03.jpg'),
      view('A-05', 'E1', 'Resultados de búsqueda', 'serp-seo-aeo-geo.html · orgánico y patrocinado', '../serp-seo-aeo-geo.html?test=sitio&camino=A&perfil=hotel', 'E1', 'A-04.jpg'),
      view('A-06', 'E2', 'Solución para hoteles', 'captacion/soluciones/hoteles.html', '../../captacion/soluciones/hoteles.html?utm_source=google&utm_medium=organic&utm_campaign=horeca_captacion', 'E2', 'A-05.jpg'),
      pauseQ('A-07', 'E2', 'pausa1', 'Pausa 1 · después de E2', 'A-15.jpg'),
      view('A-08', 'E3', 'Guardar avance en el portal', 'C03 · formulario de contacto', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C03', 'E3', 'A-06.jpg', { requiereRecorrido: true }),
      view('A-09', 'E4', 'Diagnóstico del negocio', 'C04 · diagnóstico en tres pasos', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C04', 'E4', 'A-07.jpg', { requiereRecorrido: true }),
      view('A-10', 'E4', 'Revisar propuesta preliminar', 'C05 · propuesta', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C05', 'E4', 'A-08.jpg', { requiereRecorrido: true }),
      pauseQ('A-11', 'E4', 'pausa2', 'Pausa 2 · después de E4', 'A-16.jpg'),
      view('A-12', 'E5', 'Bandeja de seguimiento', 'C05 · correos E01–E12', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C05', 'E5', 'A-09.jpg', { requiereRecorrido: true }),
      view('A-13', 'E6', 'Alta, bienvenida y próximos pasos', 'C06 · contrato simulado y portal', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C06', 'E6', 'A-10.jpg', { requiereRecorrido: true }),
      view('A-14', 'E7', 'Aviso de reposición y pedido', 'C09 · cuenta y repetición', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C09', 'E7', 'A-11.jpg', { requiereRecorrido: true }),
      view('A-15', 'E8', 'Servicio y evaluación CSAT', 'C09 · caso y CSAT', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C09', 'E8', 'A-12.jpg', { requiereRecorrido: true }),
      view('A-16', 'E9', 'Recomendación', 'C09 · NPS y enlace referido', '../../index.html?test=sitio&camino=A&participante=P2&tipo=cliente&negocio=hotel#C09', 'E9', 'A-13.jpg', { requiereRecorrido: true }),
      finalQ('A-17', 'E9', false, 'A-17.jpg'), responses('A-18', 'A-18.jpg'),
    ],
  },
  {
    id: 'B-Meta', nombre: 'B · Meta', grupo: 'externo', viewport: '390×844', inicio: 'inicio.html',
    nodes: [
      startNode('B-Meta-01', 'Entrada · lanzador', 'B-Meta-01.jpg'), initialQ('B-Meta-02', 'E0', false, 'B-Meta-15.jpg'),
      view('B-Meta-03', 'E0', 'Feed social simulado', 'captacion/anuncios/feed-simulado.html', '../../captacion/anuncios/feed-simulado.html?test=personas&camino=B-Meta&journey=full&red=meta&perfil=restaurante', 'E0', 'B-Meta-02.jpg'),
      view('B-Meta-04', 'E1', 'Anuncio de Meta', 'captacion/anuncios/feed-simulado.html · anuncio elegido', '../../captacion/anuncios/feed-simulado.html?test=personas&camino=B-Meta&journey=full&red=meta&perfil=restaurante', 'E1', 'B-Meta-03.jpg'),
      view('B-Meta-05', 'E2', 'Landing del anuncio', 'captacion/landing/restaurantes.html', '../../captacion/landing/restaurantes.html?utm_source=meta&utm_medium=paid_social&utm_campaign=mc_meta_empresas', 'E2', 'B-Meta-04.jpg'),
      pauseQ('B-Meta-06', 'E2', 'pausa1', 'Pausa 1 · después de E2', 'B-Meta-16.jpg'),
      view('B-Meta-07', 'E3', 'Formulario · paso 1', 'captacion/landing/restaurantes.html · contacto', '../../captacion/landing/restaurantes.html?utm_source=meta&utm_medium=paid_social&utm_campaign=mc_meta_empresas', 'E3', 'B-Meta-05.jpg'),
      view('B-Meta-08', 'E3', 'Formulario · paso 2', 'captacion/landing/restaurantes.html · negocio', '../../captacion/landing/restaurantes.html?utm_source=meta&utm_medium=paid_social&utm_campaign=mc_meta_empresas', 'E3', 'B-Meta-06.jpg'),
      view('B-Meta-09', 'E3', 'Solicitud recibida · pasar al portal', 'captacion/landing/restaurantes.html · confirmación', '../../captacion/landing/restaurantes.html?utm_source=meta&utm_medium=paid_social&utm_campaign=mc_meta_empresas', 'E3', 'B-Meta-07.jpg'),
      view('B-Meta-10', 'E4', 'Diagnóstico del negocio', 'C04 · diagnóstico en tres pasos', '../../index.html?test=personas&camino=B-Meta&participante=P1&tipo=cliente&negocio=restaurante#C04', 'E4', 'B-Meta-08.jpg', { requiereRecorrido: true }),
      view('B-Meta-11', 'E4', 'Revisar propuesta preliminar', 'C05 · propuesta', '../../index.html?test=personas&camino=B-Meta&participante=P1&tipo=cliente&negocio=restaurante#C05', 'E4', 'B-Meta-09.jpg', { requiereRecorrido: true }),
      pauseQ('B-Meta-12', 'E4', 'pausa2', 'Pausa 2 · después de E4', 'B-Meta-17.jpg'),
      ...[
        ['13', 'E5', 'Bandeja de seguimiento', 'C05 · correos E01–E12', 'E5'], ['14', 'E6', 'Alta, bienvenida y próximos pasos', 'C06 · contrato simulado y portal', 'E6'], ['15', 'E7', 'Aviso de reposición y pedido', 'C09 · cuenta y repetición', 'E7'], ['16', 'E8', 'Servicio y evaluación CSAT', 'C09 · caso y CSAT', 'E8'], ['17', 'E9', 'Recomendación', 'C09 · NPS y enlace referido', 'E9'],
      ].map(([suffix, stage, title, screen, key]) => view(`B-Meta-${suffix}`, stage, title, screen, `../../index.html?test=personas&camino=B-Meta&participante=P1&tipo=cliente&negocio=restaurante#${stage === 'E5' ? 'C05' : stage === 'E6' ? 'C06' : 'C09'}`, key, `B-Meta-${String(Number(suffix) - 4).padStart(2, '0')}.jpg`, { requiereRecorrido: true })),
      finalQ('B-Meta-18', 'E9', false, 'B-Meta-18.jpg'), responses('B-Meta-19', 'B-Meta-19.jpg'),
    ],
  },
  {
    id: 'B-LinkedIn', nombre: 'B · LinkedIn', grupo: 'externo', viewport: '390×844', inicio: 'inicio.html',
    nodes: [
      startNode('B-LinkedIn-01', 'Entrada · lanzador', 'B-LinkedIn-01.jpg'), initialQ('B-LinkedIn-02', 'E0', false, 'B-LinkedIn-15.jpg'),
      view('B-LinkedIn-03', 'E0', 'Feed social simulado', 'captacion/anuncios/feed-simulado.html', '../../captacion/anuncios/feed-simulado.html?test=personas&camino=B-LinkedIn&journey=full&red=linkedin&perfil=hotel', 'E0', 'B-LinkedIn-02.jpg'),
      view('B-LinkedIn-04', 'E1', 'Anuncio de LinkedIn', 'captacion/anuncios/feed-simulado.html · anuncio elegido', '../../captacion/anuncios/feed-simulado.html?test=personas&camino=B-LinkedIn&journey=full&red=linkedin&perfil=hotel', 'E1', 'B-LinkedIn-03.jpg'),
      view('B-LinkedIn-05', 'E2', 'Landing del anuncio', 'captacion/landing/hoteles.html', '../../captacion/landing/hoteles.html?utm_source=linkedin&utm_medium=paid_social&utm_campaign=mc_linkedin_empresas', 'E2', 'B-LinkedIn-04.jpg'),
      pauseQ('B-LinkedIn-06', 'E2', 'pausa1', 'Pausa 1 · después de E2', 'B-LinkedIn-16.jpg'),
      view('B-LinkedIn-07', 'E3', 'Formulario · paso 1', 'captacion/landing/hoteles.html · contacto', '../../captacion/landing/hoteles.html?utm_source=linkedin&utm_medium=paid_social&utm_campaign=mc_linkedin_empresas', 'E3', 'B-LinkedIn-05.jpg'),
      view('B-LinkedIn-08', 'E3', 'Formulario · paso 2', 'captacion/landing/hoteles.html · negocio', '../../captacion/landing/hoteles.html?utm_source=linkedin&utm_medium=paid_social&utm_campaign=mc_linkedin_empresas', 'E3', 'B-LinkedIn-06.jpg'),
      view('B-LinkedIn-09', 'E3', 'Solicitud recibida · pasar al portal', 'captacion/landing/hoteles.html · confirmación', '../../captacion/landing/hoteles.html?utm_source=linkedin&utm_medium=paid_social&utm_campaign=mc_linkedin_empresas', 'E3', 'B-LinkedIn-07.jpg'),
      view('B-LinkedIn-10', 'E4', 'Diagnóstico del negocio', 'C04 · diagnóstico en tres pasos', '../../index.html?test=personas&camino=B-LinkedIn&participante=P2&tipo=cliente&negocio=hotel#C04', 'E4', 'B-LinkedIn-08.jpg', { requiereRecorrido: true }),
      view('B-LinkedIn-11', 'E4', 'Revisar propuesta preliminar', 'C05 · propuesta', '../../index.html?test=personas&camino=B-LinkedIn&participante=P2&tipo=cliente&negocio=hotel#C05', 'E4', 'B-LinkedIn-09.jpg', { requiereRecorrido: true }),
      pauseQ('B-LinkedIn-12', 'E4', 'pausa2', 'Pausa 2 · después de E4', 'B-LinkedIn-17.jpg'),
      ...[
        ['13', 'E5', 'Bandeja de seguimiento', 'C05 · correos E01–E12', 'E5'], ['14', 'E6', 'Alta, bienvenida y próximos pasos', 'C06 · contrato simulado y portal', 'E6'], ['15', 'E7', 'Aviso de reposición y pedido', 'C09 · cuenta y repetición', 'E7'], ['16', 'E8', 'Servicio y evaluación CSAT', 'C09 · caso y CSAT', 'E8'], ['17', 'E9', 'Recomendación', 'C09 · NPS y enlace referido', 'E9'],
      ].map(([suffix, stage, title, screen, key]) => view(`B-LinkedIn-${suffix}`, stage, title, screen, `../../index.html?test=personas&camino=B-LinkedIn&participante=P2&tipo=cliente&negocio=hotel#${stage === 'E5' ? 'C05' : stage === 'E6' ? 'C06' : 'C09'}`, key, `B-LinkedIn-${String(Number(suffix) - 4).padStart(2, '0')}.jpg`, { requiereRecorrido: true })),
      finalQ('B-LinkedIn-18', 'E9', false, 'B-LinkedIn-18.jpg'), responses('B-LinkedIn-19', 'B-LinkedIn-19.jpg'),
    ],
  },
  {
    id: 'B-Google', nombre: 'B · Google Ads', grupo: 'externo', viewport: '390×844', inicio: 'inicio.html',
    nodes: [
      startNode('B-Google-01', 'Entrada · lanzador', 'B-Google-01.jpg'), initialQ('B-Google-02', 'E0', false, 'B-Google-16.jpg'),
      view('B-Google-03', 'E0', 'Situación inicial', 'C01 · contexto del participante', '../../index.html?test=sitio&camino=B-Google&participante=P1&tipo=cliente&negocio=restaurante#C01', 'E0', 'B-Google-02.jpg', { requiereRecorrido: true }),
      view('B-Google-04', 'E0', 'Búsqueda simulada en blanco', 'serp-seo-aeo-geo.html · consulta vacía', '../serp-seo-aeo-geo.html?test=sitio&camino=B-Google&perfil=restaurante', 'E0', 'B-Google-03.jpg'),
      view('B-Google-05', 'E1', 'Resultado patrocinado', 'serp-seo-aeo-geo.html · Google Ads', '../serp-seo-aeo-geo.html?test=sitio&camino=B-Google&perfil=restaurante', 'E1', 'B-Google-04.jpg'),
      view('B-Google-06', 'E2', 'Landing de Google Ads', 'captacion/landing/restaurantes.html', '../../captacion/landing/restaurantes.html?utm_source=google&utm_medium=cpc&utm_campaign=CL_GOOGLE_SEARCH_RESTAURANTES_COTIZA_202612_V01', 'E2', 'B-Google-05.jpg'),
      pauseQ('B-Google-07', 'E2', 'pausa1', 'Pausa 1 · después de E2', 'B-Google-17.jpg'),
      view('B-Google-08', 'E3', 'Formulario · paso 1', 'captacion/landing/restaurantes.html · contacto', '../../captacion/landing/restaurantes.html?utm_source=google&utm_medium=cpc&utm_campaign=CL_GOOGLE_SEARCH_RESTAURANTES_COTIZA_202612_V01', 'E3', 'B-Google-06.jpg'),
      view('B-Google-09', 'E3', 'Formulario · paso 2', 'captacion/landing/restaurantes.html · negocio', '../../captacion/landing/restaurantes.html?utm_source=google&utm_medium=cpc&utm_campaign=CL_GOOGLE_SEARCH_RESTAURANTES_COTIZA_202612_V01', 'E3', 'B-Google-07.jpg'),
      view('B-Google-10', 'E3', 'Solicitud recibida · pasar al portal', 'captacion/landing/restaurantes.html · confirmación', '../../captacion/landing/restaurantes.html?utm_source=google&utm_medium=cpc&utm_campaign=CL_GOOGLE_SEARCH_RESTAURANTES_COTIZA_202612_V01', 'E3', 'B-Google-08.jpg'),
      view('B-Google-11', 'E4', 'Diagnóstico del negocio', 'C04 · diagnóstico en tres pasos', '../../index.html?test=sitio&camino=B-Google&participante=P1&tipo=cliente&negocio=restaurante#C04', 'E4', 'B-Google-09.jpg', { requiereRecorrido: true }),
      view('B-Google-12', 'E4', 'Revisar propuesta preliminar', 'C05 · propuesta', '../../index.html?test=sitio&camino=B-Google&participante=P1&tipo=cliente&negocio=restaurante#C05', 'E4', 'B-Google-10.jpg', { requiereRecorrido: true }),
      pauseQ('B-Google-13', 'E4', 'pausa2', 'Pausa 2 · después de E4', 'B-Google-18.jpg'),
      ...[
        ['14', 'E5', 'Bandeja de seguimiento', 'C05 · correos E01–E12', 'E5'], ['15', 'E6', 'Alta, bienvenida y próximos pasos', 'C06 · contrato simulado y portal', 'E6'], ['16', 'E7', 'Aviso de reposición y pedido', 'C09 · cuenta y repetición', 'E7'], ['17', 'E8', 'Servicio y evaluación CSAT', 'C09 · caso y CSAT', 'E8'], ['18', 'E9', 'Recomendación', 'C09 · NPS y enlace referido', 'E9'],
      ].map(([suffix, stage, title, screen, key]) => view(`B-Google-${suffix}`, stage, title, screen, `../../index.html?test=sitio&camino=B-Google&participante=P1&tipo=cliente&negocio=restaurante#${stage === 'E5' ? 'C05' : stage === 'E6' ? 'C06' : 'C09'}`, key, `B-Google-${String(Number(suffix) - 5).padStart(2, '0')}.jpg`, { requiereRecorrido: true })),
      finalQ('B-Google-19', 'E9', false, 'B-Google-19.jpg'), responses('B-Google-20', 'B-Google-20.jpg'),
    ],
  },
];

const internalDefs = [
  {
    role: 'ventas', pathId: 'C-Ventas', label: 'C · Ventas', user: 'paula.diaz', code: 'I1', home: 'R01', title: 'Ejecutiva de Ventas',
    tasks: [
      ['R01', 'Encuentra un prospecto que llegó desde búsqueda', 'explica qué datos reconocen su origen'],
      ['R04', 'Revisa un contacto calificado por Marketing', 'decide manualmente si ya es oportunidad de ventas'],
      ['R08', 'Prepara una propuesta de prueba', 'identifica datos que confirmaría antes de compartirla'],
      ['R03', 'Busca una cuenta que necesite reposición', 'revisa qué confirmar antes de dejar la gestión preparada'],
      ['R03', 'Revisa una cuenta que redujo o pausó compras', 'explica qué averiguaría antes de contactar'],
      ['R17', 'Revisa una recomendación de otro negocio', 'decide qué dato y permiso confirmaría'],
    ],
  },
  {
    role: 'marketing', pathId: 'C-Marketing', label: 'C · Marketing', user: 'marketing', code: 'I2', home: 'R11', title: 'Equipo de Marketing',
    tasks: [
      ['R12', 'Encuentra un prospecto recién incorporado', 'explica cómo reconocer el origen'],
      ['R13', 'Revisa una pieza y su registro de campaña', 'relaciona contenido y origen del contacto'],
      ['R12', 'Revisa un contacto para calificación MQL', 'decide si hay información suficiente y registra la decisión si aparece'],
      ['R07', 'Evalúa un seguimiento con permiso limitado', 'separa respuesta solicitada de contenido promocional'],
    ],
  },
  {
    role: 'jefatura', pathId: 'C-Jefatura', label: 'C · Jefatura', user: 'jefatura', code: 'I3', home: 'R05', title: 'Jefatura comercial',
    tasks: [
      ['R05', 'Revisa la vista general', 'decide qué haría con la información disponible y qué dato falta'],
      ['R05', 'Revisa una propuesta pendiente', 'decide qué se puede aprobar o qué información pedir'],
      ['R17', 'Revisa una recomendación de cliente', 'indica qué debe revisar una persona antes de aceptarla'],
      ['R07', 'Revisa seguimientos preparados por el equipo', 'identifica qué acciones requieren aprobación y respetan permisos'],
    ],
  },
];

for (const def of internalDefs) {
  const id = def.pathId;
  const slug = id;
  const nodes = [
    startNode(`${id}-01`, 'Entrada · lanzador', `${slug}-01.jpg`),
    initialQ(`${id}-02`, 'C-entrada', true, `${slug}-10.jpg`),
    n(`${id}-03`, 'vista', 'C-entrada', 'Ingreso al CRM por rol', 'R00 · credenciales de prueba', `../../index.html?test=personas&camino=C&rol=${def.role}&participante=${def.code}#R00`, 'Entra con la ficha del rol asignado.', 'Reconoce su rol y llega a una vista con permisos correspondientes.', 'rol · tiempo de acceso · errores de ingreso', `${slug}-02.jpg`, { requiereRecorrido: true }),
  ];
  def.tasks.forEach(([screen, title, observe], index) => {
    const task = index + 1;
    nodes.push(n(`${id}-${String(task + 3).padStart(2, '0')}`, 'vista', `C-${task}`, `Tarea ${task} · ${title}`, `${screen} · ${def.title}`, `../../index.html?test=personas&camino=C&rol=${def.role}&participante=${def.code}#${screen}`, `Sigue la consigna C-${task} del guion del moderador; la tarea ${task} de ${def.title} es: ${title.toLocaleLowerCase()}.`, `${observe}.`, 'tiempo · resultado logrado/con ayuda/no logrado · SEQ 1–7 · errores · nota', `${slug}-${String(task + 2).padStart(2, '0')}.jpg`, { requiereRecorrido: true, tarea: task }));
    if (task === 1) nodes.push(pauseQ(`${id}-PAUSA-C`, 'C-1', 'pausa_c', 'Pausa C · después de la tarea 1', `${slug}-11.jpg`));
  });
  nodes.push(finalQ(`${id}-FINAL`, 'C-final', true, `${slug}-12.jpg`));
  flows.push({ id, nombre: def.label, grupo: 'interno', viewport: '1440×900', inicio: 'inicio.html', rol: def.role, tareas: def.tasks.length, nodes });
}

const findNode = (flowId, nodeId) => flows.find((flow) => flow.id === flowId).nodes.find((item) => item.id === nodeId);
function slugFile(flowId, seq) { return `${flowId}-${String(seq).padStart(2, '0')}.jpg`; }
function updateMiniatura(flowId, nodeId, file) { const item = findNode(flowId, nodeId); item.miniatura = `evidencia/flujos/${file}`; }

async function screenshot(page, flowId, nodeId) {
  const item = findNode(flowId, nodeId);
  if (!item) throw new Error(`Nodo no registrado: ${flowId}/${nodeId}`);
  const file = path.basename(item.miniatura || `${item.id}.jpg`);
  const dest = path.join(EVIDENCE, file);
  let bytes = null;
  for (const quality of [54, 48, 42, 36, 30]) {
    bytes = await page.screenshot({ path: dest, type: 'jpeg', quality, fullPage: false, animations: 'disabled' });
    if (bytes.length <= 120 * 1024) break;
  }
  if (!bytes || bytes.length > 120 * 1024) throw new Error(`${file} pesa ${bytes?.length ?? '0'} B; supera 120 KB`);
  item.miniatura = `evidencia/flujos/${file}`;
  item.bytes = bytes.length;
  return bytes.length;
}
async function screenshotStage(page, flowId, stage) {
  const item = flows.find((flow) => flow.id === flowId)?.nodes.find((candidate) => candidate.tipo === 'vista' && candidate.etapa === stage);
  if (!item) throw new Error(`No existe vista ${flowId}/${stage}`);
  return screenshot(page, flowId, item.id);
}

async function openLauncher(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE + LAUNCHER, { waitUntil: 'domcontentloaded' });
  return { context, page, pageErrors };
}
async function waitHash(page, hash) {
  try {
    await page.waitForFunction((wanted) => (location.hash || '').split('?')[0] === wanted, hash, { timeout: 15000 });
  } catch (error) {
    console.error('WAIT HASH DIAGNOSTIC', hash, page.url(), await page.locator('body').getAttribute('data-current'), (await page.locator('body').innerText()).slice(-700));
    throw error;
  }
  await page.waitForTimeout(150);
}
async function openLandingPath(page, route, participant, profile, name, email, company, queryForGoogle) {
  await page.locator('#participant').selectOption(participant);
  if (route === 'A' || route === 'B-Google') {
    await page.locator(`[data-route="${route}"]`).click();
    await waitHash(page, '#C01');
    await page.getByRole('button', { name: 'Ir a Google' }).click();
    await page.locator('#query').waitFor({ state: 'visible' });
    if (route === 'A') return { context: null, entryAtSerp: true };
    await page.locator('#query').fill(queryForGoogle || 'café para restaurante');
    await page.locator('#search button[type="submit"]').click();
    await page.locator('#serp-list').waitFor({ state: 'visible' });
    const sponsored = await page.locator('#sponsored-title').getAttribute('href');
    await page.locator('#sponsored-title').click();
    await page.locator('#f-nombre').waitFor({ state: 'visible' });
    return { landing: true, sponsored };
  }
  await page.locator(`[data-route="${route}"]`).click();
  await page.locator('#ad-link').waitFor({ state: 'visible' });
  await page.locator('#ad-link').click();
  await page.locator('#f-nombre').waitFor({ state: 'visible' });
  return { landing: true };
}
async function submitLanding(page, name, email, company) {
  await page.locator('#f-nombre').fill(name);
  await page.locator('#f-correo').fill(email);
  await page.locator('#f-consent').check();
  if (await page.locator('#f-marketing').count()) await page.locator('#f-marketing').uncheck();
  await page.locator('fieldset[data-paso="1"] button[type="submit"]').click();
  await page.locator('#f-empresa').waitFor({ state: 'visible' });
  await page.locator('#f-empresa').fill(company);
  await page.locator('#f-telefono').fill('912345678');
  await page.locator('[data-accion="enviar"]').click();
  await page.locator('#ld-exito').waitFor({ state: 'visible' });
}
async function completeDiagnosis(page, businessLabel) {
  await page.locator('.m5-qcard').waitFor({ state: 'visible' });
  const options = await page.locator('[data-a="answer"][data-k="negocio"]').evaluateAll((els) => els.map((el) => ({ value: el.getAttribute('data-v'), text: el.innerText })));
  const answer = options.find((item) => new RegExp(businessLabel, 'i').test(`${item.value} ${item.text}`)) || options[0];
  await page.locator(`[data-a="answer"][data-k="negocio"][data-v="${answer.value}"]`).click();
  const advance = async () => {
    const next = page.locator('[data-a="next"]');
    if (!(await next.isEnabled())) {
      const option = page.locator('.m5-qcard [data-a="answer"]').first();
      if (await option.count()) await option.click();
      else if (await page.locator('#m5Comuna').count()) await page.locator('#m5Comuna').selectOption({ index: 1 });
    }
    if (!(await next.isEnabled())) {
      throw new Error(`Diagnóstico ${await page.locator('.m5-qcard').innerText()} sigue sin habilitar Continuar.`);
    }
    await next.click();
  };
  await advance();
  await page.getByText('¿En qué comuna está tu local?', { exact: false }).waitFor({ state: 'visible' });
  if (await page.locator('#m5Comuna').count()) {
    await page.locator('#m5Comuna').selectOption('Las Condes');
    await page.waitForFunction(() => document.querySelector('#m5Comuna')?.value === 'Las Condes');
  }
  await page.waitForTimeout(250);
  const volumeOption = page.locator('[data-a="answer"][data-k="volumen"][data-v="De 150 a 400"]');
  if (await volumeOption.count()) await volumeOption.click();
  await advance();
  await advance();
  await waitHash(page, '#C10');
  await page.locator('.m9-catalog').waitFor({ state: 'visible' });
  await page.locator('#m9-continue').click();
  await waitHash(page, '#C04');
  await page.locator('.m5-qcard').waitFor({ state: 'visible' });
  await page.locator('[data-a="next"]').click();
  await waitHash(page, '#C05');
  await page.locator('.m5-propsec').waitFor({ state: 'visible' });
}
const journeyChecks = [];
async function sendModeratorJump(moderatorPage, page, sessionId, flowId, days) {
  const active = await moderatorPage.evaluate(() => window.MCPrueba.readActive());
  if (active?.id !== sessionId || active.estado === 'cerrada') throw new Error(`${flowId}: la consola no conserva la sesión activa antes del salto.`);
  const payload = { dias: days, sesion_id: sessionId, at: Date.now(), nonce: `${flowId}-${days}-${Date.now().toString(36)}` };
  await moderatorPage.evaluate(value => localStorage.setItem('mc_prueba_salto_v1', JSON.stringify(value)), payload);
  await page.waitForFunction(({ amount, nonce }) => {
    const cycle = window.M4?.get?.().customerCycle;
    return Boolean(cycle?.timeJumps?.[String(amount)] && cycle?.moderatorJumpNonces?.[nonce]);
  }, { amount: days, nonce: payload.nonce }, { timeout: 8000 });
  return payload;
}
async function completeE5toE9(page, flowId, name, moderatorPage, sessionId) {
  const inboxHeading = page.getByRole('heading', { name: 'Bandeja de seguimiento' });
  await inboxHeading.waitFor({ state: 'visible', timeout: 10000 });
  await sendModeratorJump(moderatorPage, page, sessionId, flowId, 3);
  await page.getByText('Recordatorio de tu propuesta', { exact: false }).waitFor({ state: 'visible' });
  await inboxHeading.scrollIntoViewIfNeeded();
  await screenshotStage(page, flowId, 'E5');
  await page.locator('[data-a="accept-prop"]').click();
  await waitHash(page, '#C06');
  await page.getByRole('button', { name: 'Simular firma de contrato' }).click();
  await page.getByText('Contrato simulado registrado', { exact: false }).waitFor();
  await screenshotStage(page, flowId, 'E6');
  await page.getByRole('link', { name: 'Ir a Mi cuenta' }).click();
  await waitHash(page, '#C09');
  await page.locator('.m5-cycle-head').waitFor({ state: 'visible' });
  await sendModeratorJump(moderatorPage, page, sessionId, flowId, 30);
  await page.getByText('E08 · Aviso de reposición', { exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await page.getByRole('button', { name: 'Repetir pedido' }).click();
  await screenshotStage(page, flowId, 'E7');
  const support = page.locator('form[data-cycle-form="support"]');
  await support.locator('[name="type"]').selectOption({ label: 'Producto o formato' });
  await support.locator('[name="detail"]').fill('Necesito revisar el formato para mi operación.');
  await support.locator('button[type="submit"]').click();
  await page.getByText('Caso CAS-', { exact: false }).waitFor();
  const csat = page.locator('form[data-cycle-form="csat"]');
  await csat.locator('[name="score"]').selectOption('4');
  await csat.locator('[name="comment"]').fill('La atención fue clara y pude dejar mi consulta.');
  await csat.locator('button[type="submit"]').click();
  await page.getByText('CSAT: 4/5', { exact: false }).waitFor();
  await screenshotStage(page, flowId, 'E8');
  await page.locator('[data-cycle-nps="10"]').click();
  await page.getByRole('button', { name: 'Preparar recomendación' }).click();
  await page.getByRole('button', { name: 'Registrar envío simulado' }).click();
  await page.getByRole('link', { name: 'Abrir enlace con UTM de referido' }).waitFor();
  await screenshotStage(page, flowId, 'E9');
  const endState = await page.evaluate(() => {
    const s = M4.get(), c = s.customerCycle;
    const events = s.events.map((event) => event.eventName);
    const leadEvent = s.events.find((event) => event.eventName === 'lead_created' && event.accountId === c?.accountId);
    const accountTimeline = s.events.filter((event) => event.accountId === c?.accountId || event.key?.includes(`cycle:${s.lead?.id}:`));
    return { enabled: M4Journey.enabled(), buyer: c?.buyer, origin: s.lead?.source || '', landingId: s.lead?.landing?.id || '', leadId: s.lead?.id, days: c?.simulatedDays, leadCreatedInCrm: Boolean(leadEvent && accountTimeline.includes(leadEvent)), crmOrigin: leadEvent?.source || s.lead?.source || '', emails: (s.emails || []).filter((item) => item.journeyCode).map((item) => item.journeyCode), events: [...new Set(events)].filter((name) => ['contract_signed', 'order_confirmed', 'repeat_order_confirmed', 'support_case_opened', 'csat_submitted', 'referral_sent'].includes(name)) };
  });
  const crmPage = await page.context().newPage();
  const crmErrors = [];
  crmPage.on('pageerror', (error) => crmErrors.push(error.message));
  const crmState = await page.evaluate(() => M4.get());
  await crmPage.setViewportSize({ width: 1440, height: 900 });
  await crmPage.goto(`${BASE}/index.html?qa=1#R17`, { waitUntil: 'domcontentloaded' });
  await crmPage.evaluate((state) => localStorage.setItem('marleyMVP:v7:prototype', JSON.stringify(state)), crmState);
  await crmPage.reload({ waitUntil: 'domcontentloaded' });
  await crmPage.waitForFunction(() => Boolean(window.M4 && window.M4R));
  await crmPage.evaluate((leadId) => { M4.setRole('ventas'); M4.select(leadId); }, endState.leadId);
  await crmPage.locator('[data-a1-buyer-profile]').waitFor({ state: 'visible' });
  await crmPage.locator('.a1crm-role-note[data-a1-role-view="ventas"]').waitFor({ state: 'visible' });
  const crmText = await crmPage.locator('#app').innerText();
  const crmTextNormalized = crmText.toLocaleLowerCase();
  if (!crmTextNormalized.includes(endState.crmOrigin.toLocaleLowerCase()) || !crmTextNormalized.includes(String(name).toLocaleLowerCase())) throw new Error(`${flowId}: CRM por comprador no muestra ${name} y su origen ${endState.crmOrigin}: ${crmText.slice(0, 1200)}`);
  endState.crmVisible = true;
  await crmPage.close();
  if (crmErrors.length) throw new Error(`${flowId} CRM page errors: ${crmErrors.join(' | ')}`);
  const expectedEvents = ['contract_signed', 'order_confirmed', 'repeat_order_confirmed', 'support_case_opened', 'csat_submitted', 'referral_sent'];
  if (!endState.enabled || endState.days !== 33 || !endState.origin || !endState.leadCreatedInCrm || !endState.crmOrigin || !endState.crmVisible || expectedEvents.some((name) => !endState.events.includes(name))) throw new Error(`${flowId}: ciclo E5–E9 incompleto, sin lead visible en CRM o sin origen: ${JSON.stringify(endState)}`);
  journeyChecks.push({ flow: flowId, ...endState });
}

const m4tBeforeAfter = [];
async function measureM4tForm(page, label) {
  const button = page.locator('#m4tMore');
  const chip = page.getByRole('button', { name: 'Otro correo' });
  const boxA = await button.boundingBox();
  const boxB = await chip.boundingBox();
  const overlap = boxA && boxB && Math.max(0, Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x)) * Math.max(0, Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y));
  m4tBeforeAfter.push({ label, viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), more: boxA, otherEmail: boxB, overlapPx2: overlap || 0 });
}

async function answerAllQuestions(page, finishText) {
  for (let index = 0; index < 80; index += 1) {
    const fields = page.locator('#question-fields');
    if (!(await fields.count())) break;
    const textEntry = fields.locator('textarea');
    if (await textEntry.count()) await textEntry.fill('Respuesta ficticia de prueba, sin nombres ni datos de contacto.');
    else {
      const radios = fields.locator('input[type="radio"]');
      const checks = fields.locator('input[type="checkbox"]');
      if (await radios.count()) await radios.first().check();
      else if (await checks.count()) await checks.first().check();
    }
    const next = page.locator('.mc-question-actions .mc-btn--primary');
    if (!(await next.count())) throw new Error('La pregunta no ofrece el botón para continuar.');
    await next.click();
    await page.waitForTimeout(35);
  }
  await page.getByRole('heading', { name: finishText, exact: true }).waitFor({ timeout: 10000 });
}
async function startParticipantSession(context, consolePage, flowId, route, participant, role) {
  if (participant) await consolePage.locator('#participant').selectOption(participant);
  const popupPromise = consolePage.waitForEvent('popup');
  const button = role
    ? consolePage.locator(`[data-route="C"][data-role="${role}"]`)
    : consolePage.locator(`[data-route="${route}"]`);
  await button.click();
  const personPage = await popupPromise;
  const pageErrors = [];
  personPage.on('pageerror', (error) => pageErrors.push(error.message));
  await personPage.waitForURL(/sesion\.html\?fase=inicial/);
  await personPage.locator('#consent-accepted').waitFor({ state: 'visible' });
  const sessionId = new URL(personPage.url()).searchParams.get('mc_session');
  const initialNode = flows.find((flow) => flow.id === flowId).nodes.find((item) => item.tipo === 'cuestionario' && item.titulo.startsWith('Cuestionario inicial'));
  await screenshot(personPage, flowId, initialNode.id);
  await personPage.locator('#consent-accepted').check();
  await personPage.getByRole('button', { name: 'Continuar a las preguntas iniciales' }).click();
  await personPage.locator('#question-fields').waitFor({ state: 'visible' });
  await answerAllQuestions(personPage, 'Comenzar recorrido');
  await personPage.getByRole('button', { name: 'Comenzar recorrido' }).click();
  await personPage.waitForFunction(() => !location.pathname.endsWith('/sesion.html'), null, { timeout: 15000 });
  await personPage.waitForLoadState('domcontentloaded');
  return { personPage, sessionId, pageErrors };
}
async function capturePhaseQuestionnaire(context, sessionId, flowId, phase, nodeId, finishText) {
  const page = await context.newPage();
  const url = `${BASE}/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/sesion.html?fase=${phase}&mc_session=${encodeURIComponent(sessionId)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#question-fields').waitFor({ state: 'visible', timeout: 10000 });
  await screenshot(page, flowId, nodeId);
  await answerAllQuestions(page, finishText);
  await page.close();
}
async function captureFinalAndResponses(context, sessionId, flowId, finalNodeId, responseNodeId) {
  const finalPage = await context.newPage();
  await finalPage.goto(`${BASE}/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/sesion.html?fase=final&mc_session=${encodeURIComponent(sessionId)}`, { waitUntil: 'domcontentloaded' });
  await finalPage.locator('#question-fields').waitFor({ state: 'visible', timeout: 10000 });
  await screenshot(finalPage, flowId, finalNodeId);
  await answerAllQuestions(finalPage, 'Gracias por participar');
  await finalPage.close();
  if (responseNodeId) {
    const responsePage = await context.newPage();
    await responsePage.goto(`${BASE}/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/respuestas.html`, { waitUntil: 'domcontentloaded' });
    await responsePage.locator('h1').first().waitFor({ state: 'visible' });
    await screenshot(responsePage, flowId, responseNodeId);
    await responsePage.close();
  }
}

async function captureA(browser) {
  const { context, page } = await openLauncher(browser, 390, 844);
  await screenshot(page, 'A', 'A-01');
  const { personPage, sessionId, pageErrors } = await startParticipantSession(context, page, 'A', 'A', 'P2', '');
  await waitHash(personPage, '#C01');
  await screenshot(personPage, 'A', 'A-03');
  await personPage.getByRole('button', { name: 'Ir a Google' }).click();
  await personPage.locator('#query').waitFor({ state: 'visible' });
  await screenshot(personPage, 'A', 'A-04');
  await personPage.locator('#query').fill('café para hotel');
  await personPage.locator('#search button[type="submit"]').click();
  await personPage.locator('#serp-list').waitFor({ state: 'visible' });
  await screenshot(personPage, 'A', 'A-05');
  const organic = new URL(await personPage.locator('#organic-title').getAttribute('href'), BASE);
  if (!organic.pathname.endsWith('/captacion/soluciones/hoteles.html') || organic.searchParams.get('utm_medium') !== 'organic') throw new Error('A: el resultado orgánico no llega a la solución de hoteles.');
  await personPage.locator('#organic-title').click();
  await personPage.waitForURL(/captacion\/soluciones\/hoteles\.html/);
  await screenshot(personPage, 'A', 'A-06');
  await capturePhaseQuestionnaire(context, sessionId, 'A', 'pausa1', 'A-07', 'Listo, vuelve a tu recorrido');
  await personPage.getByRole('link', { name: /IR AL PORTAL/i }).click();
  await waitHash(personPage, '#C03');
  await personPage.locator('#m4FEmail').waitFor({ state: 'visible' });
  await measureM4tForm(personPage, '390-postfix');
  await screenshot(personPage, 'A', 'A-08');
  await personPage.locator('#m4FName').fill('Rocío Fuentes');
  await personPage.locator('#m4FEmail').fill('rocio.fuentes@example.com');
  if (await personPage.locator('#m4FPhone').count()) await personPage.locator('#m4FPhone').fill('912345678');
  await personPage.locator('#m4FConsent').check();
  if (await personPage.locator('#m4FMarketing').count()) await personPage.locator('#m4FMarketing').check();
  await personPage.locator('#m4FName').evaluate((el) => el.form?.querySelector('button[type="submit"]')?.click());
  await waitHash(personPage, '#C04');
  await personPage.locator('.m5-qcard').waitFor({ state: 'visible' });
  await personPage.evaluate(() => M4.update((state) => { state.qaRunId = 'A1-FLUJOS-A-RF-390'; }));
  await screenshot(personPage, 'A', 'A-09');
  await completeDiagnosis(personPage, 'Hotel');
  await screenshot(personPage, 'A', 'A-10');
  await capturePhaseQuestionnaire(context, sessionId, 'A', 'pausa2', 'A-11', 'Listo, vuelve a tu recorrido');
  await completeE5toE9(personPage, 'A', 'Rocío Fuentes', page, sessionId);
  await captureFinalAndResponses(context, sessionId, 'A', 'A-17', 'A-18');
  if (pageErrors.length) throw new Error(`A page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function captureSocial(browser, flowId, route, participant, profile, formName, email, company) {
  const { context, page } = await openLauncher(browser, 390, 844);
  await screenshot(page, flowId, `${flowId}-01`);
  const { personPage, sessionId, pageErrors } = await startParticipantSession(context, page, flowId, route, participant, '');
  await personPage.locator('#ad-link').waitFor({ state: 'visible' });
  const e0Node = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E0' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e0Node.id);
  await personPage.locator('#ad-link').focus();
  const e1Node = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E1' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e1Node.id);
  await personPage.locator('#ad-link').click();
  await personPage.locator('#f-nombre').waitFor({ state: 'visible' });
  const e2Node = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E2' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e2Node.id);
  const pauseNode = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Pausa 1'));
  await capturePhaseQuestionnaire(context, sessionId, flowId, 'pausa1', pauseNode.id, 'Listo, vuelve a tu recorrido');
  const step1 = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E3' && x.titulo?.includes('paso 1'));
  const step2 = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E3' && x.titulo?.includes('paso 2'));
  const success = flows.find((f) => f.id === flowId).nodes.find((x) => x.etapa === 'E3' && x.titulo?.includes('Solicitud recibida'));
  await screenshot(personPage, flowId, step1.id);
  await personPage.locator('#f-nombre').fill(formName);
  await personPage.locator('#f-correo').fill(email);
  await personPage.locator('#f-consent').check();
  if (await personPage.locator('#f-marketing').count()) await personPage.locator('#f-marketing').check();
  await personPage.locator('fieldset[data-paso="1"] button[type="submit"]').click();
  await personPage.locator('#f-empresa').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, step2.id);
  await personPage.locator('#f-empresa').fill(company);
  await personPage.locator('#f-telefono').fill('912345678');
  await personPage.locator('[data-accion="enviar"]').click();
  await personPage.locator('#ld-exito').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, success.id);
  await personPage.locator('#ld-continuar').click();
  await waitHash(personPage, '#C04');
  await personPage.locator('.m5-qcard').waitFor({ state: 'visible' });
  await personPage.evaluate((run) => M4.update((state) => { state.qaRunId = run; }), `A1-FLUJOS-${flowId}-RF-390`);
  const e4Nodes = flows.find((f) => f.id === flowId).nodes.filter((x) => x.etapa === 'E4' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e4Nodes[0].id);
  await completeDiagnosis(personPage, profile);
  await screenshot(personPage, flowId, e4Nodes[1].id);
  const pause2 = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Pausa 2'));
  await capturePhaseQuestionnaire(context, sessionId, flowId, 'pausa2', pause2.id, 'Listo, vuelve a tu recorrido');
  await completeE5toE9(personPage, flowId, formName, page, sessionId);
  const final = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Cuestionario final'));
  const results = flows.find((f) => f.id === flowId).nodes.find((x) => x.tipo === 'cierre');
  await captureFinalAndResponses(context, sessionId, flowId, final.id, results.id);
  if (pageErrors.length) throw new Error(`${flowId} page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function captureGoogleAd(browser) {
  const flowId = 'B-Google';
  const { context, page } = await openLauncher(browser, 390, 844);
  await screenshot(page, flowId, 'B-Google-01');
  const { personPage, sessionId, pageErrors } = await startParticipantSession(context, page, flowId, 'B-Google', 'P1', '');
  await waitHash(personPage, '#C01');
  await screenshot(personPage, flowId, 'B-Google-03');
  await personPage.getByRole('button', { name: 'Ir a Google' }).click();
  await personPage.locator('#query').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, 'B-Google-04');
  await personPage.locator('#query').fill('café para restaurante');
  await personPage.locator('#search button[type="submit"]').click();
  await personPage.locator('#serp-list').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, 'B-Google-05');
  const paid = new URL(await personPage.locator('#sponsored-title').getAttribute('href'), BASE);
  await personPage.locator('#sponsored-title').click();
  await personPage.locator('#f-nombre').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, 'B-Google-06');
  const pause1 = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Pausa 1'));
  await capturePhaseQuestionnaire(context, sessionId, flowId, 'pausa1', pause1.id, 'Listo, vuelve a tu recorrido');
  const e3Nodes = flows.find((f) => f.id === flowId).nodes.filter((x) => x.etapa === 'E3' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e3Nodes[0].id);
  await personPage.locator('#f-nombre').fill('Antonia Vega');
  await personPage.locator('#f-correo').fill('antonia.vega@example.com');
  await personPage.locator('#f-consent').check();
  if (await personPage.locator('#f-marketing').count()) await personPage.locator('#f-marketing').check();
  await personPage.locator('fieldset[data-paso="1"] button[type="submit"]').click();
  await personPage.locator('#f-empresa').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, e3Nodes[1].id);
  await personPage.locator('#f-empresa').fill('Restaurante Patio Sur');
  await personPage.locator('#f-telefono').fill('987654321');
  await personPage.locator('[data-accion="enviar"]').click();
  await personPage.locator('#ld-exito').waitFor({ state: 'visible' });
  await screenshot(personPage, flowId, e3Nodes[2].id);
  await personPage.locator('#ld-continuar').click();
  await waitHash(personPage, '#C04');
  await personPage.locator('.m5-qcard').waitFor({ state: 'visible' });
  await personPage.evaluate(() => M4.update((state) => { state.qaRunId = 'A1-FLUJOS-B-GOOGLE-AV-390'; }));
  const e4Nodes = flows.find((f) => f.id === flowId).nodes.filter((x) => x.etapa === 'E4' && x.tipo === 'vista');
  await screenshot(personPage, flowId, e4Nodes[0].id);
  await completeDiagnosis(personPage, 'Restaurante');
  await screenshot(personPage, flowId, e4Nodes[1].id);
  const pause2 = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Pausa 2'));
  await capturePhaseQuestionnaire(context, sessionId, flowId, 'pausa2', pause2.id, 'Listo, vuelve a tu recorrido');
  await completeE5toE9(personPage, flowId, 'Antonia Vega', page, sessionId);
  const final = flows.find((f) => f.id === flowId).nodes.find((x) => x.titulo.startsWith('Cuestionario final'));
  const results = flows.find((f) => f.id === flowId).nodes.find((x) => x.tipo === 'cierre');
  await captureFinalAndResponses(context, sessionId, flowId, final.id, results.id);
  if (!paid.pathname.includes('/captacion/landing/')) throw new Error(`B-Google anuncio no llega a landing: ${paid.pathname}`);
  if (pageErrors.length) throw new Error(`B-Google page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function goCrmScreen(page, screen) {
  const current = await page.locator('body').getAttribute('data-current');
  if (current === screen) return;
  const menuLink = page.locator(`.m4-nav[href="#${screen}"]`).first();
  if (await menuLink.count() && await menuLink.isVisible()) await menuLink.click();
  else await page.evaluate((id) => { location.hash = `#${id}`; }, screen);
  await page.waitForFunction((id) => document.body.getAttribute('data-current') === id, screen, { timeout: 12000 });
  await page.waitForTimeout(140);
}
async function captureInternal(browser, def) {
  const { context, page } = await openLauncher(browser, 1440, 900);
  const flowId = def.pathId;
  await screenshot(page, flowId, `${flowId}-01`);
  const { personPage, sessionId, pageErrors } = await startParticipantSession(context, page, flowId, 'C', '', def.role);
  await waitHash(personPage, '#R00');
  const flow = flows.find((item) => item.id === flowId);
  await screenshot(personPage, flowId, `${flowId}-03`);
  await personPage.locator('#m4User').fill(def.user);
  await personPage.locator('#m4Pass').fill('prueba');
  await personPage.locator('.m5-login button[type="submit"]').click();
  await personPage.waitForFunction(() => (location.hash || '').split('?')[0] !== '#R00');
  const firstTask = def.tasks[0];
  await goCrmScreen(personPage, firstTask[0]);
  await screenshot(personPage, flowId, `${flowId}-04`);
  await personPage.evaluate((run) => M4.update((state) => { state.qaRunId = run; }), `A1-FLUJOS-${flowId}-1440`);
  const pause = flow.nodes.find((item) => item.titulo.startsWith('Pausa C'));
  await capturePhaseQuestionnaire(context, sessionId, flowId, 'pausa_c', pause.id, 'Listo, vuelve a tu recorrido');
  for (let index = 1; index < def.tasks.length; index += 1) {
    const [screen] = def.tasks[index];
    await goCrmScreen(personPage, screen);
    await screenshot(personPage, flowId, `${flowId}-${String(index + 4).padStart(2, '0')}`);
  }
  const final = flow.nodes.find((item) => item.titulo.startsWith('Cuestionario final'));
  await captureFinalAndResponses(context, sessionId, flowId, final.id, null);
  if (pageErrors.length) throw new Error(`${flowId} page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

function markMissingA7() {
  for (const flow of flows) for (const item of flow.nodes) {
    if (item.pendienteA7) {
      const target = path.resolve(KIT, item.archivo.split('?')[0]);
      item.pendienteArchivo = !fs.existsSync(target);
      if (!item.pendienteArchivo) delete item.pendienteA7;
    }
  }
}
function verifyManifest() {
  for (const flow of flows) {
    const ids = flow.nodes.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`IDs repetidos en ${flow.id}`);
    for (const item of flow.nodes) {
      for (const field of ['id', 'tipo', 'etapa', 'titulo', 'pantalla', 'url', 'hace', 'observar', 'metrica', 'miniatura']) {
        if (!(field in item)) throw new Error(`${flow.id}/${item.id}: falta ${field}`);
      }
      if (item.tipo === 'vista' && !item.miniatura) throw new Error(`${flow.id}/${item.id}: falta miniatura real`);
    }
  }
  if (flows.filter((flow) => flow.grupo === 'externo').length !== 4 || flows.filter((flow) => flow.grupo === 'interno').length !== 3) throw new Error('Debe haber 4 caminos externos y 3 internos.');
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    if (!process.argv.includes('--skip-a')) await captureA(browser);
    if (!process.argv.includes('--only-a')) {
      await captureSocial(browser, 'B-Meta', 'B-Meta', 'P1', 'Restaurante', 'Tomás Vidal', 'tomas.vidal@example.com', 'Restaurante Patio Sur');
      await captureSocial(browser, 'B-LinkedIn', 'B-LinkedIn', 'P2', 'Hotel', 'Rocío Fuentes', 'rocio.fuentes@example.com', 'Hotel Los Aromos');
      await captureGoogleAd(browser);
      for (const def of internalDefs) await captureInternal(browser, def);
    }
  } finally { await browser.close(); }
  markMissingA7();
  verifyManifest();
  const capturedFlows = process.argv.includes('--only-a')
    ? flows.filter((flow) => flow.id === 'A')
    : process.argv.includes('--skip-a')
      ? flows.filter((flow) => flow.id !== 'A')
      : flows;
  const weights = capturedFlows.flatMap((flow) => flow.nodes.filter((item) => item.miniatura).map((item) => ({ flow: flow.id, id: item.id, file: item.miniatura, bytes: fs.statSync(path.join(KIT, item.miniatura)).size })));
  if (weights.some((item) => item.bytes > 120 * 1024)) throw new Error('Una miniatura supera los 120 KB.');
  const totalBytes = weights.reduce((sum, item) => sum + item.bytes, 0);
  if (totalBytes > 8 * 1024 * 1024) throw new Error(`Miniaturas suman ${totalBytes} bytes, sobre 8 MB.`);
  const out = path.join(KIT, 'flujos.json');
  fs.writeFileSync(out, JSON.stringify({ version: '2026-11-11-a1-v1', actualizado: new Date().toISOString(), nota: 'Los archivos de cuestionario/respuestas de A7 se enlazan con sus nombres previstos; si faltan, el botón abre inicio.html e indica el motivo.', flows, m4tBeforeAfter }, null, 2) + '\n', 'utf8');
  const report = { caminos: capturedFlows.map((flow) => ({ id: flow.id, nodos: flow.nodes.length, vistas: flow.nodes.filter((item) => item.tipo === 'vista').length, cuestionariosPendientes: flow.nodes.filter((item) => item.pendienteArchivo).length })), recorridosE0E9: journeyChecks, miniaturas: { cantidad: weights.length, maxBytes: Math.max(...weights.map((item) => item.bytes)), totalBytes, limiteCadaUna: 120 * 1024, limiteTotal: 8 * 1024 * 1024 }, m4tBeforeAfter };
  const requiredJourneyIds = process.argv.includes('--only-a') ? ['A'] : process.argv.includes('--skip-a') ? ['B-Meta', 'B-LinkedIn', 'B-Google'] : ['A', 'B-Meta', 'B-LinkedIn', 'B-Google'];
  if (journeyChecks.length !== requiredJourneyIds.length || requiredJourneyIds.some((id) => !journeyChecks.some((check) => check.flow === id))) throw new Error(`No se completaron los recorridos requeridos ${requiredJourneyIds.join(', ')}: ${JSON.stringify(journeyChecks.map((check) => check.flow))}`);
  fs.writeFileSync(path.join(EVIDENCE, 'captura-reporte.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });

