# Guion del moderador · ronda final E0–E9 y cuestionarios

**Marley Coffee Empresas · versión de kit 11-nov-2026**  
Cinco sesiones externas exploratorias (A o B) y hasta tres sesiones internas exploratorias (C). No son una muestra representativa.

## Preparación

- **Modo local:** abre [`inicio.html`](inicio.html) desde `http://localhost` o `http://127.0.0.1`. Selecciona participante/perfil y camino. La consola limpia los datos del prototipo salvo `mc_prueba_*`, prepara la sesión y abre `sesion.html?fase=inicial` en otra pestaña. Registra la versión exacta antes de la sesión.
- En la pestaña de la persona, presenta la bienvenida y el consentimiento. La casilla «Acepto participar» es obligatoria. El cuestionario inicial se responde allí, una pregunta por pantalla; la consola permanece en la pestaña del moderador.
- Verifica que formularios, correos, pedidos, tickets y referidos sean simulados y no hagan llamadas externas. Si aparece un envío real o se pide un dato personal real, detén esa pantalla.
- No uses nombres, correos, teléfonos ni datos de clientes reales. En E3 usa solo la ficha ficticia del perfil correspondiente en [Fichas_datos_ficticios.html](Fichas_datos_ficticios.html). Si el formulario no es local/simulado o pide un dato fuera de la ficha, detén E3 y no improvises.
- Prepara cronómetro, versión del CSV y tarjetas de salto. Comprueba el viewport/dispositivo real y anótalo. No presentes emulación como teléfono real. En E3 entrega la ficha ficticia; para C entrega solo la ficha de credenciales del rol.
- Lee el consentimiento. Sin aceptación, no comienza la sesión. La bienvenida resume qué se hará y el número de preguntas iniciales, de pausa y finales.
- No mostrar este guion al participante durante la tarea. Las tarjetas de tiempo se leen literalmente.

## Modo remoto (sitio publicado)

1. En el computador del moderador abre la versión publicada de [`inicio.html`](inicio.html). El host no local activa el modo remoto: no borra datos del computador. Selecciona participante, perfil y camino A/B o C por rol. C encadenada queda deshabilitado; solo funciona con las dos sesiones en el mismo equipo.
2. Pulsa el camino para generar el enlace y el QR. Comparte el enlace por el canal acordado o deja que la persona escanee el QR. No uses una URL localhost para un teléfono separado del computador.
3. La persona abre el enlace en su teléfono. Si viene de WhatsApp o Instagram, dile: **«Sigue en esta misma pestaña hasta el final; vuelve aquí después de cada tarjeta.»** Presenta el consentimiento y espera «Acepto participar». La persona responde el bloque inicial y toca «Comenzar recorrido».
4. Mantén la consola en el computador y la persona en el teléfono. Registra etapas, tiempos, errores, resultado, nota y SEQ. No esperes que el teléfono aparezca como otra pestaña del computador: son dispositivos separados.
5. En cada pausa, di: **«Cuando estés listo, toca la tarjeta de pausa que aparece en tu pantalla y responde las preguntas. Avísame al terminar.»** Luego pulsa «Marcar hecho» en la consola. Para los saltos, di: **«Toca la tarjeta que dice 3 días después en tu teléfono.»** y marca el salto como hecho. Antes de E7 repite con **«Un mes después»**. Lee «Decisión tomada» y «Caso resuelto» desde las tarjetas impresas; son recordatorios.
6. Tras E9, di: **«Toca la tarjeta de preguntas finales en tu teléfono y responde el bloque.»** Cuando confirme que terminó, marca el cierre como hecho. A y B-Google tienen el menú «⋯» del portal solo como respaldo en modo local; en remoto usa las tarjetas de la persona y los botones de registro de esta consola.
7. Al final, la persona verá su código y el número de respuestas; puede compartir el texto, copiarlo o descargar el archivo. En el computador abre [respuestas.html](respuestas.html), pega el texto o elige el archivo y pulsa «Importar respuestas». Comprueba que se hayan unido la sesión, las respuestas y las etapas que registraste.

Si el portal todavía no muestra tarjetas remotas, abre directamente [`sesion.html`](sesion.html) desde el teléfono con la fase y un `volver` válido del mismo sitio. Anota la limitación y no completes tareas que la persona no pudo realizar.

## Cinco perfiles

| Código | Perfil para reclutamiento | Escenario |
|---|---|---|
| P1 | Encargada/o de compras de un restaurante | El equipo quiere revisar cómo ofrece café a sus clientes antes de elegir una alternativa. |
| P2 | Jefe/a de cocina de un hotel | Quiere revisar el servicio de café durante el desayuno y considerar la operación en distintos momentos. |
| P3 | Dueña/o o administradora/or de una cafetería | Está evaluando cómo mejorar el equipo o los insumos sin decidir antes de entender las condiciones. |
| P4 | Administradora/or de una oficina | La oficina quiere ofrecer café durante la jornada y necesita evaluar cómo organizarlo. |
| P5 | Coordinador/a de eventos y catering | Necesita evaluar una alternativa para futuros eventos o reuniones de empresa. |

Los cargos son perfiles de prueba, no clientes Marley ni compradores verificados. Si el participante no cumple el perfil, no sustituyas su rol en el análisis: registra la diferencia.

## Apertura literal

> Gracias por participar. Estamos evaluando el recorrido, no tus conocimientos. Algunas partes son simuladas. No hay una respuesta correcta. Si algo no se entiende, puedes decidir qué harías normalmente o detenerte. Yo no te indicaré dónde hacer clic ni qué palabras usar. No uses datos reales. ¿Aceptas comenzar?

Pide aceptación del documento de consentimiento. Si se acordó pensar en voz alta, di una sola vez: **«Cuéntame lo que estás pensando, sin que yo te guíe.»** No repitas ni amplíes las consignas.

## Regla de moderación

- Lee cada consigna tal cual. No menciones nombres de botones, menús, filtros, etapas del CRM, productos, conceptos de oferta ni términos de búsqueda.
- Si pregunta «¿qué hago?», responde: **«Haz lo que te parezca más natural en esta situación.»**
- Si pregunta si una respuesta es correcta: **«No hay una respuesta correcta; estamos evaluando el recorrido.»**
- No confirmes si una opción sirve. No completes frases, no señales la pantalla y no repitas una palabra de la interfaz.
- Si pide ayuda para avanzar, di: **«No puedo guiarte durante esta tarea; puedes continuar o dejarla.»** Registra la solicitud de ayuda. La tarea deja de contar como éxito sin ayuda.
- No impongas un límite de tiempo. Si la persona abandona, registra la tarea como bloqueada y pasa al siguiente tramo solo si acepta continuar.
- Después de cada E o tarea C, pregunta únicamente: **«¿Qué tan fácil o difícil fue esta tarea?»** Escala 1 = muy difícil, 7 = muy fácil. Registra SEQ en la consola; no justifiques ni discutas la respuesta.
- En la consola marca «Empezó» al leer la consigna y «Terminó» cuando la persona cierre la tarea. Registra resultado, errores y nota. Primer clic/toque y toques sin respuesta quedan en la planilla de respaldo en papel; no registres la consulta exacta en el CRM, y si se recoge, va en el CSV de búsqueda separado.

## Elegir camino externo A o B

Usa las consignas de E0–E2 según el camino asignado; E3–E9 son comunes. No dictes palabras clave, nombres de botones ni términos del anuncio. El selector del lanzador asocia participante y perfil; no cambies el camino durante la sesión.

### A · Google directo, orgánico

La búsqueda simulada abre en blanco. Lee E0 y permite que la persona escriba con sus propias palabras. Si elige un resultado orgánico, continúa por la solución o guía que le interese, llega al portal y sigue E3–E9. Si elige espontáneamente un resultado patrocinado u otro destino, registra el camino real sin corregirle.

### B · Anuncio Meta o LinkedIn

Abre el feed correspondiente al perfil seleccionado. Lee E0–E2 como están escritos: explora el feed, decide si continúa desde la pieza y revisa la página de llegada. No señales la pieza ni nombres el CTA. Meta: restaurante, cafetería, panadería o conveniencia. LinkedIn: hotel, oficina o eventos.

### B · Anuncio Google dentro de SERP

Abre la misma búsqueda vacía, con una pieza patrocinada disponible según el perfil. No preescribas la consulta ni digas que busque un anuncio. Registra si lo ve, si lo elige y por qué; si prefiere un resultado orgánico, no le redirijas. La intención de comparar B con una ruta de pago se registra aunque la persona no toque el anuncio.

### C · CRM de trabajadores internos

Abre el lanzador por el rol Ventas, Marketing o Jefatura. Entra en R00 con la ficha de prueba. El inicio usa la entrada normal del CRM, no `?test=crm`: ese modo disponible hoy solo admite Ventas/Jefatura y restringe cada sesión a una tarea, mientras C necesita las tres funciones y una secuencia. Lee una consigna por vez, registra SEQ tras cada una y aplica SUS al final. Las pantallas contienen una muestra sintética con orígenes simulados; el reinicio impide afirmar que son los leads de una sesión externa A/B. No registres nombres de esa muestra.

**Variante encadenada (opcional).** Si la sesión interna va justo después de una externa en el mismo navegador, marca en la consola «Atender el lead de la persona anterior» antes de abrir C. El lead ficticio que dejó la persona externa aparece «En vivo», con su origen. La sesión queda como `C-encadenada` y guarda el `sesion_origen` externo. En la consigna 1 de Ventas di «el prospecto que acaba de llegar» en vez de «un prospecto». No uses esta variante si entre ambas sesiones se reinició el navegador o se abrió otro camino.

**C · Ventas (I1)**

1. «Encuentra un prospecto que haya llegado desde una búsqueda y explica qué información te permite reconocer su origen.»
2. «Revisa un contacto que Marketing haya considerado calificado. Decide si ya lo tomarías como oportunidad de ventas; si la pantalla te permite registrar esa decisión, hazlo y cuéntame qué revisaste.»
3. «Prepara una propuesta de prueba para un negocio del listado. Deja identificados los datos que confirmarías antes de compartirla; no la envíes fuera del prototipo.»
4. «Busca una cuenta que pueda necesitar una reposición. Revisa qué confirmarías antes de dejar la gestión preparada.»
5. «Revisa una cuenta que haya reducido o pausado sus compras. Explica qué averiguarías antes de proponer un contacto.»
6. «Revisa una recomendación de otro negocio. Decide qué dato y permiso confirmarías antes de continuar.»

**C · Marketing (I2)**

1. «Encuentra un prospecto recién incorporado y explica cómo reconocerías de dónde llegó.»
2. «Revisa una pieza y un registro de campaña de ejemplo. Explica si puedes relacionar el contenido con el origen del contacto.»
3. «Revisa un contacto y decide si hay información suficiente para considerarlo calificado por Marketing. Si la pantalla ofrece esa decisión, regístrala.»
4. «Considera que un contacto pidió respuesta, pero no autorizó contenido promocional. Decide qué seguimiento sería apropiado y qué dejarías detenido.»

**C · Jefatura (I3)**

1. «Revisa la vista general. Cuéntame qué decisión tomarías con la información disponible y qué dato te falta.»
2. «Revisa una propuesta pendiente. Decide qué se puede aprobar o qué información pedirías antes de hacerlo.»
3. «Revisa una recomendación de cliente. Explica qué debería revisar una persona antes de aceptarla.»
4. «Revisa los seguimientos que el equipo dejó preparados. Decide qué acciones necesitan aprobación humana y cuáles deben respetar un permiso pendiente.»

La actividad interna se centra en prospectos de ejemplo con fuentes como búsqueda orgánica y campañas. El registro sembrado en el CRM no queda atado a P1–P5, aunque sus etiquetas de origen sirvan para practicar la lectura del CRM. Separa este hallazgo de las observaciones externas.

## Pausas y cuestionarios

- Externos: completa el cuestionario inicial (6 preguntas). Después de E2, la persona responde `Pausa 1 · llegada` (4 preguntas); después de E4, responde `Pausa 2 · contacto y propuesta` (4 preguntas). En local, el moderador abre cada pausa desde la consola; en remoto, la persona toca la tarjeta correspondiente en su teléfono. Tras E9, responde el cuestionario final externo (9 preguntas, incluido SUS).
- Internos: completa el cuestionario inicial (4 preguntas). Después de la primera tarea del rol, abre `Pausa C · origen del contacto` (3 preguntas). Tras la última tarea del rol, abre el cuestionario final interno (7 preguntas, incluido SUS).
- En local, cada pausa abre en una pestaña nueva y la persona la cierra para volver al recorrido. En remoto, responde en la misma pestaña del teléfono y vuelve con el botón de pantalla. No muestres la consola ni este guion durante las tareas.
- En local, los saltos de 3 días y un mes se hacen desde los botones de la consola. En remoto, primero la persona toca la tarjeta de salto en el teléfono y luego el moderador marca «Hecho» en la consola. Las tarjetas «Decisión tomada» y «Caso resuelto» son recordatorios impresos, sin botón de salto. Mientras la sesión del kit está activa, el portal oculta su botón «⋯»; en A y B-Google queda solo como respaldo local. El SUS impreso de Cuestionario_SUS.md es respaldo si falla la vista digital.
- Las respuestas se guardan localmente al contestar cada pregunta. `omitida=true` significa que se eligió «Prefiero no responder» o que una abierta opcional se dejó en blanco. No vuelvas a preguntar una respuesta omitida.

## Secuencia de tareas

Lee el escenario que corresponda al perfil una vez al inicio. Las consignas E0–E9 se leen exactamente igual para los cinco perfiles.

### E0 · Momento cero

**A o B-Google:** «Piensa en la situación que te conté. Empieza como lo harías normalmente para encontrar una alternativa para tu negocio.»  
**B-Meta o B-LinkedIn:** «Revisa esta pantalla como lo harías normalmente. Continúa si algo te resulta pertinente.»

**Observar:** si comienza sin ayuda, tiempo hasta la primera acción, consulta que escribe en el simulador y dudas. No sugieras una consulta, marca ni categoría.

### E1 · Elección

**A o B-Google:** «Continúa con la opción que elegirías y sigue hasta donde te resulte útil.»  
**B-Meta o B-LinkedIn:** «Decide si quieres continuar desde esta pieza y haz lo que harías normalmente.»

**Observar:** primer clic, resultado elegido, retrocesos, si distingue anuncios, resultados orgánicos o respuestas de contenido. No describas los resultados ni menciones cuál abrir.

### E2 · Comprensión

**A o B-Google:** «Revisa esta información como lo harías antes de decidir. Avísame cuando tengas una idea de qué ofrece y qué te faltaría saber.»  
**B-Meta o B-LinkedIn:** «Revisa esta página como lo harías antes de decidir. Avísame cuando tengas una idea de qué ofrece y qué te faltaría saber.»

**Observar:** qué entiende que se ofrece, qué condición busca y si reconoce el siguiente paso. No resumas la página.

### E3 · Primer contacto

**Material:** [Fichas_datos_ficticios.html](Fichas_datos_ficticios.html). Entrega solo la ficha del perfil de la sesión; no la completes con datos de la persona.

**Consigna:** «Si decides pedir información para tu negocio, completa lo que te parezca necesario con los datos ficticios preparados para esta prueba.»

**Observar:** si decide solicitar contacto, errores, abandono y claridad de permisos. Cronometra **datos iniciales** desde el primer foco en un campo hasta confirmación válida. Registra aparte el tiempo de la tarea completa. Si el envío no es local/simulado, detente.

### E4 · Diagnóstico y propuesta

**Consigna:** «Continúa revisando la alternativa para tu negocio. Cuando tengas una decisión, cuéntame qué entendiste y qué revisarías antes de avanzar.»

**Observar:** si completa el diagnóstico, comprende que una propuesta es preliminar y encuentra condiciones pendientes. No expliques precios, stock, cobertura ni comodato.

### E5 · Seguimiento

Después de E4 y de terminar la pausa de propuesta, lee la tarjeta 1 y pulsa «Saltar 3 días» en la consola. Espera a que quede registrado antes de empezar E5.

**Consigna:** «Retoma la situación desde donde quedaste. Haz lo que harías normalmente antes de decidir.»

**Observar:** si encuentra el mensaje o la siguiente tarea, entiende de qué solicitud se trata y distingue seguimiento de marketing.

### E6 · Alta

Lee la tarjeta 2 como recordatorio antes de E6. No hay botón de salto en la consola para esta tarjeta.

**Consigna:** «Continúa como lo harías después de confirmar que tu negocio avanzará con esta alternativa.»

**Observar:** si identifica próximos pasos, responsable, permisos y datos pendientes. No anuncies fechas ni operación que no figure en el escenario.

### E7 · Reposición

Antes de E7, lee la tarjeta 3 y pulsa «Saltar un mes» en la consola. Espera a que quede registrado antes de empezar E7.

**Consigna:** «Ahora tu equipo necesita organizar el siguiente pedido. Revisa qué harías y qué confirmarías antes de dejarlo listo.»

**Observar:** si encuentra el historial y la acción de reposición, confirma cantidades y comprende que no se ha enviado un pedido real.

### E8 · Servicio

**Consigna:** «El equipo dejó de funcionar como esperabas y necesitas ayuda. Busca cómo informar el problema y averigua qué pasa después.»

**Observar:** facilidad para reportar, clasificación/severidad, estado y expectativa de plazo. No sugieras un tiempo de respuesta; si no aparece, registra la duda como evidencia.

### E9 · Recomendación

Lee la tarjeta 4 como recordatorio antes de E9. No hay botón de salto en la consola para esta tarjeta.

**Consigna:** «Una persona de otro negocio te pregunta por tu experiencia. Decide si quieres compartir algo y qué harías a continuación.»

**Observar:** si la invitación es opcional, si el permiso se entiende, si se diferencia enviar una referencia de crear un nuevo lead y si el sistema evita enviar algo sin autorización. No pidas que recomiende de verdad.

## Cierre

1. Pregunta: **«¿Qué te dio confianza y qué no?»** Registra la respuesta literal sin nombre ni datos personales.
2. Pregunta: **«¿Qué parte te resultó más difícil?»**
3. Pregunta abierta: **«¿Qué cambiarías para que esta experiencia te resultara más clara?»**
4. En local, desde la consola abre el cuestionario final; en remoto, pídele a la persona que toque la tarjeta final en su teléfono. Deja que responda el bloque digital, incluido el SUS de diez ítems, sin explicar qué respuesta conviene. Si falla, usa el SUS impreso como respaldo y registra la incidencia.
5. Agradece y recuerda que puede pedir retirar sus datos de investigación o borrar una grabación opcional.
6. Comprueba que no quedó una sesión con datos personales reales.

## Registro

- La consola registra una fila por respuesta y una fila de etapa por E0–E9 o C-* en `mc_prueba_respuestas_v1`; `respuestas.html` permite filtrar y exportar. Usa `Planilla_registro.csv` como respaldo en papel e incluye `sesion_id`.
- `SUS_resultados.csv` y el cuestionario impreso quedan como respaldo, no como registro digital principal.
- La consulta literal y el orden de resultados solo van en `Registro_busqueda.csv`, separado del CRM.
- En cada tarea, `exito_sin_ayuda` = `si` solo si completa el objetivo sin instrucción del moderador. Si pide ayuda, registra `no` aunque luego termine.
- Con cinco participantes, informa resultados como exploratorios. No declares validación general, causalidad ni significancia.
