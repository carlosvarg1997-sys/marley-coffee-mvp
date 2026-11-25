# Nota para el informe V4.3: agente conversacional

Esta nota dice qué debe actualizar el informe. No edita el informe. Todo lo que aquí se describe es una **simulación**: el motor responde con reglas y con los datos del prototipo, no usa un modelo real ni llamadas externas, y no tiene claves.

## Qué existe hoy

- **Agente del comprador (sitio y portal):** responde dudas con información aprobada del prototipo (comodato, carga base, kit y filtro, condiciones, plazos y productos con sus precios). Recomienda la máquina con unas pocas preguntas, arma o ajusta la propuesta, pide confirmación antes de pasar el caso a una persona, repite un pedido como solicitud (sin cobro) y muestra el estado del pedido. **Captura al lead desde el chat:** cuando la persona pide que la llamen o que le escriban, el asistente le pide nombre, empresa (si quiere), correo o WhatsApp y sus permisos, de a una pregunta y con «Prefiero no responder» en cada paso. Con esos datos crea o actualiza el lead en el CRM, con su origen («chat del sitio»), su cotización, sus respuestas y su conversación. Sin permiso de contacto no se guarda ningún dato; la baja corta el contacto.
- **Agente del CRM (Marketing, Ventas y Jefatura):** barra «Pídele al agente» en el Hoy de cada rol, con sugerencias por rol. Marketing consulta un lead (cotización, puntajes con su porqué, origen y campaña, actividad en el sitio y chat), revisa si cumple MQL, lo pasa a Ventas con un resumen y aprueba el mensaje que el agente redacta antes del envío simulado. Ventas recibe el aviso y pide un resumen de la cuenta o una canasta. Jefatura revisa lo que espera su aprobación y confirma.
- **Línea de tiempo por cuenta:** chat web, WhatsApp, correo y notas, con los envíos simulados.

## 9.2 Remarketing, CRM y agentes

- Describir el agente del comprador y el agente del CRM con los flujos de arriba, como simulación determinista.
- En remarketing: el agente no envía nada sin permiso de promoción. El prototipo bloquea el canal que no tiene consentimiento registrado. Los envíos de Marketing son simulados; no sale ningún correo ni WhatsApp real.
- Aclarar que la campaña de remarketing con anuncios sigue siendo un plan: el prototipo no tiene datos de medios reales.
- Mencionar la línea de tiempo multicanal por cuenta y que lo que el cliente conversa en el sitio aparece en el CRM con su resumen.
- Usar los criterios de MQL del CRM tal como están en el prototipo: contacto identificado, negocio B2B, permiso de promoción registrado e interés de 40 o más. Confirmar que el texto del informe usa la misma definición.
- El permiso para responder la solicitud y el permiso de novedades (promoción) son distintos: sin novedades, el lead no llega a MQL aunque haya pedido que lo llamen.
- El interés de un lead se calcula con las reglas de R6P (datos con permiso +25, pidió ejecutivo +15, ajustó la propuesta +15, abrió el cotizador +10, terminó el diagnóstico +10). La lista del CRM y el estado del portal usan el mismo cálculo, así que dan el mismo puntaje.

## 11 Arquitectura y agentes

- **Motor:** un solo motor de respuestas, determinista, con intenciones en español que toleran tildes y errores de tipeo. Lee los datos del prototipo y deja en el estado lo que realmente ocurre (mensajes, traspasos, avisos, envíos y registro).
- **Paneles:** el del comprador (en celular, una hoja a pantalla completa) y la barra del CRM sobre el Hoy de cada rol. Los dos leen el mismo estado.
- **Persistencia:** el estado se guarda en el navegador con una clave propia. El prototipo no borra todo el almacenamiento.
- **Control en cada acción:** tres niveles visibles: regla sin IA (criterio fijo, por ejemplo MQL), sugerencia de la IA (canasta, mensaje redactado) y decisión de una persona (confirmar, aprobar el envío). Además, un registro con el dato usado, la sugerencia y quién decidió.
- **Lo que no hay:** modelo de lenguaje real, envíos reales por WhatsApp o correo, ni conexión con un CRM productivo. Son el paso siguiente y requieren aprobación de Carlitos.
- **Verificación:** `qa/verify-agente-conversacional.cjs` recorre el flujo completo en Chrome y en Edge, a 1280×551 y 390×844. El comprador empieza anónimo, pide que lo llamen y da sus datos en el chat; Marketing lo busca por su nombre, revisa cotización, puntajes, origen y conversación, cumple MQL, lo pasa a Ventas y aprueba el mensaje; el envío aparece del lado del cliente; Ventas y Jefatura siguen el caso. Además prueba «Prefiero no responder» (no se crea lead) y la baja (sin contacto). Verifica respuestas, traspasos, aviso en Ventas, envío aprobado, registro con su nivel, ausencia de `localStorage.clear()` y clics sin respuesta. Es una prueba técnica: no reemplaza la prueba con personas.

## Guía de defensa: 6 preguntas nuevas

1. **¿El agente es inteligencia artificial de verdad?**
   Es una simulación. Interpreta intenciones en español con reglas, responde con los datos del prototipo y no usa un modelo real ni servicios externos. Un modelo real sería el paso siguiente y pediría aprobación.

2. **¿Qué pasa si el cliente pregunta algo que el agente no sabe?**
   No inventa precios, plazos ni garantías. Responde solo con información aprobada. Lo que no está publicado se pasa a una persona con un resumen, para que el cliente no repita su historia.

3. **¿Quién aprueba lo que se envía a un cliente?**
   Una persona. Marketing revisa el mensaje que redacta el agente y lo aprueba antes del envío simulado. El registro guarda quién lo aprobó.

4. **¿Qué significan los tres niveles de control?**
   Regla sin IA: un criterio fijo, como el de MQL. Sugerencia de la IA: una propuesta del agente, como una canasta o un borrador. Decisión de una persona: la confirmación humana. Cada acción deja un registro con el dato usado, la sugerencia y quién decidió.

5. **¿Cómo se respeta el permiso del cliente?**
   Sin permiso de promoción o sin consentimiento del canal, el agente no envía por ese canal. Antes de pasar un caso a una persona, muestra el resumen y pide confirmación al cliente.

6. **¿Qué pasa si la persona no quiere dar sus datos?**
   Puede elegir «Prefiero no responder» en cada pregunta. Sin un correo o WhatsApp con permiso, no se guarda ningún dato de contacto y no se crea un lead; el chat sigue respondiendo con información aprobada. La baja quita el permiso de contacto y el lead deja de contar como identificado.

## Pendientes antes de imprimir (no van al texto del informe)

- **Repetir pedido desde el agente del comprador:** corregido. En el portal (C09) el chat habla de la cuenta que muestra el portal y repite su último pedido como solicitud, sin cobro. Probar el recorrido completo antes de imprimir.
- **Lead de la demostración:** resuelto. El lead de la demostración lo crea el comprador en el chat cuando da sus datos y sus permisos (origen «chat del sitio»). Si nadie da sus datos, Marketing usa a Fernanda Rojas (MC-HOR-2040), que cumple MQL en la muestra. Antes, la lista del CRM daba interés 25 a Elena Fuentes y el portal 80, porque la lista no recibía los eventos del estado; ahora ambas usan el mismo cálculo.
- **Lo que queda fuera de la simulación:** la captura de datos es simulada. No se envía ningún correo ni WhatsApp real, y el asistente no usa un modelo de lenguaje; sigue siendo un paso que requiere aprobación de Carlitos.
- **Foco del lead en Marketing:** corregido. «¿Cumple para MQL?» y «Pásalo a Ventas», sin nombre, usan el lead en foco; se quitó el respaldo que traía otro lead.
- **Sugerencias de Jefatura:** corregido. Primero va lo pendiente del recorrido (el referido o la propuesta especial más recientes).
- **Máquina recomendada:** corregido. Chat, canasta y CRM usan el motor de C04: para un restaurante, Pods; para un hotel, Bar, según el diagnóstico.
- **Total de la propuesta:** corregido. El agente muestra el mismo total que C05 y «Mi cotización» («Total neto referencial» + IVA).
- **Calculadora de R06:** margen de 30 % y umbral de ROAS de 4,17× (1 ÷ (0,30 × 0,80)), según el modelo económico revisado, hoja «Supuestos». El margen base de 35 % del puntaje de valor sigue como supuesto del prototipo; calibrarlo antes de citarlo.
- **OTIF 92 %:** retirado del texto público del portal; en las pantallas internas aparece como simulación. El informe no debe citarlo como dato.
