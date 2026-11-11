# Integración A1 · CRM por comprador

**Entrega A7:** `compradores.json` + `compradores.schema.json` + playbook. Códigos/slugs son los de `MAPA.md`; el modelo no modifica el portal.

## Contrato de integración

1. Cargar las siete fichas desde `captacion/crm/compradores.json` y mapear `buyer` con estos valores: `restaurante`, `hotel`, `cafeteria`, `oficina`, `eventos`, `conveniencia`, `panaderia`. Mantener los slugs fijados en el mapa.
2. Mostrar el embudo único en el orden del JSON: lead → MQL → SQL → propuesta → cierre → alta → activa → reposición → en riesgo → reactivación → promotora. Mostrar criterios de entrada/salida y dueño de la siguiente acción.
3. Crear lead solo tras envío válido y confirmación del servidor. `landing_viewed`, `form_start` y `form_step_completed` por sí solos no crean una ficha identificada.
4. Mantener permisos separados: respuesta a solicitud, recordatorios y marketing. No enviar correo, mensaje ni anuncio desde el asistente sin su condición de permiso.
5. Registrar `lead_qualified` con propiedad `qualification_status=MQL|SQL`. La transición a SQL exige actor humano de Ventas. No crear un evento nuevo para la aceptación, no cambiar los pesos de puntaje actuales ni inventar un umbral.
6. Para propuesta, guardar ID/versión. `quote_sent` ocurre solo después de envío confirmado; un borrador no es propuesta enviada. `contract_signed`, `order_confirmed` y `repeat_order_confirmed` reflejan operaciones observadas, no inferidas.
7. Conservar primer/último origen y UTMs ya capturados; la consulta escrita en E0 queda en el registro de investigación separado, nunca en la ficha CRM.
8. Añadir los seis ejemplos supervisados (bienvenida, calificación, propuesta, reposición, postventa y referidos) con señal, borrador, revisión humana y consecuencia. Ninguno ejecuta una comunicación o pedido automáticamente.
9. Vincular guías, soluciones y emails mediante IDs del JSON. Las soluciones y los correos están asignados a A2/A3: verificar sus archivos finales antes de habilitar los enlaces.
10. Para reposición, riesgo e inactividad, no fijar días. Cadencia, SLA, cobertura, condiciones, stock y beneficios quedan «a definir con Marley» hasta fuente operativa.
11. Presentar métricas como conteos y fórmulas. Cualquier ejemplo de muestra debe conservar la etiqueta «ejemplo; no es dato Marley».
12. Recuperación: visitas anónimas → anuncio elegible, no email; formulario abandonado → E04 solo con paso 1 enviado y permiso; E05/E09/E11/E12 requieren permiso de marketing; E03 depende de plazo a definir; clientes activos salen de captación general.

## Eventos permitidos

Web: `landing_viewed`, `form_start`, `form_step_completed`, `lead_created`, `quote_requested` y eventos de landing definidos en el mapa. CRM: `lead_qualified`, `quote_sent`, `contract_signed`, `order_confirmed`, `repeat_order_confirmed`, `support_case_opened`, `csat_submitted`, `referral_sent`, `referral_lead_created`. Para estado de alta/en riesgo usar campos internos con evidencia; el mapa no define un evento propio.

## Verificación de integración

- [ ] Los siete buyers aparecen con código correcto.
- [ ] MQL y SQL se distinguen; solo Ventas acepta SQL.
- [ ] Un lead anónimo o un borrador no crea contacto.
- [ ] Las preferencias de permiso son independientes.
- [ ] No se disparan comunicaciones ni pedidos en modo prototipo.
- [ ] No se añadieron eventos ni umbrales de scoring.
- [ ] Origen, primera/última visita y referral quedan relacionados al lead confirmado.
- [ ] Los estados de SLA, cobertura y cadencia muestran «a definir con Marley».
