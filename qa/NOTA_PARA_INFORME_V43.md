# Nota para el informe V4.3: agente conversacional

Esta nota dice qué debe actualizar el informe. No edita el informe. Todo lo que aquí se describe es una **simulación**: el motor responde con reglas y con los datos del prototipo, no usa un modelo real ni llamadas externas, y no tiene claves.

## Qué existe hoy

- **Agente del comprador (sitio y portal):** responde dudas con información aprobada del prototipo (comodato, carga base, kit y filtro, condiciones, plazos y productos con sus precios). Recomienda la máquina con unas pocas preguntas, arma o ajusta la propuesta, pide confirmación antes de pasar el caso a una persona, repite un pedido como solicitud (sin cobro) y muestra el estado del pedido.
- **Agente del CRM (Marketing, Ventas y Jefatura):** barra «Pídele al agente» en el Hoy de cada rol, con sugerencias por rol. Marketing consulta un lead (cotización, puntajes con su porqué, origen y campaña, actividad en el sitio y chat), revisa si cumple MQL, lo pasa a Ventas con un resumen y aprueba el mensaje que el agente redacta antes del envío simulado. Ventas recibe el aviso y pide un resumen de la cuenta o una canasta. Jefatura revisa lo que espera su aprobación y confirma.
- **Línea de tiempo por cuenta:** chat web, WhatsApp, correo y notas, con los envíos simulados.

## 9.2 Remarketing, CRM y agentes

- Describir el agente del comprador y el agente del CRM con los flujos de arriba, como simulación determinista.
- En remarketing: el agente no envía nada sin permiso de promoción. El prototipo bloquea el canal que no tiene consentimiento registrado. Los envíos de Marketing son simulados; no sale ningún correo ni WhatsApp real.
- Aclarar que la campaña de remarketing con anuncios sigue siendo un plan: el prototipo no tiene datos de medios reales.
- Mencionar la línea de tiempo multicanal por cuenta y que lo que el cliente conversa en el sitio aparece en el CRM con su resumen.
- Usar los criterios de MQL del CRM tal como están en el prototipo: contacto identificado, negocio B2B, permiso de promoción registrado e interés de 40 o más. Confirmar que el texto del informe usa la misma definición.

## 11 Arquitectura y agentes

- **Motor:** un solo motor de respuestas, determinista, con intenciones en español que toleran tildes y errores de tipeo. Lee los datos del prototipo y deja en el estado lo que realmente ocurre (mensajes, traspasos, avisos, envíos y registro).
- **Paneles:** el del comprador (en celular, una hoja a pantalla completa) y la barra del CRM sobre el Hoy de cada rol. Los dos leen el mismo estado.
- **Persistencia:** el estado se guarda en el navegador con una clave propia. El prototipo no borra todo el almacenamiento.
- **Control en cada acción:** tres niveles visibles: regla sin IA (criterio fijo, por ejemplo MQL), sugerencia de la IA (canasta, mensaje redactado) y decisión de una persona (confirmar, aprobar el envío). Además, un registro con el dato usado, la sugerencia y quién decidió.
- **Lo que no hay:** modelo de lenguaje real, envíos reales por WhatsApp o correo, ni conexión con un CRM productivo. Son el paso siguiente y requieren aprobación de Carlitos.
- **Verificación:** `qa/verify-agente-conversacional.cjs` recorre el flujo del comprador y el de Marketing, Ventas y Jefatura en Chrome y en Edge, a 1280×551 y 390×844. Verifica respuestas, traspasos, aviso en Ventas, envío aprobado, registro con su nivel, ausencia de `localStorage.clear()` y clics sin respuesta. Es una prueba técnica: no reemplaza la prueba con personas.

## Guía de defensa: 5 preguntas nuevas

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

## Pendientes antes de imprimir (no van al texto del informe)

- **Repetir pedido desde el agente del comprador:** corregido. En el portal (C09) el chat habla de la cuenta que muestra el portal y repite su último pedido como solicitud, sin cobro. Probar el recorrido completo antes de imprimir.
- **Lead de la demostración:** la demostración de Marketing usa a Fernanda Rojas (MC-HOR-2040), que cumple MQL en la muestra. No se logró que el comprador del chat sea el lead de la demostración: en una sesión nueva el comprador es anónimo y, para identificarlo, el chat tendría que pedir nombre, empresa, correo y permiso de promoción. Carlitos decide si se construye. Hay además una diferencia de datos: Elena Fuentes (ejemplo) tiene interés 25 en la lista del CRM y 80 en el estado del portal, porque la lista no recibe los eventos del estado. Corregir antes de usarla como lead.
- **Foco del lead en Marketing:** corregido. «¿Cumple para MQL?» y «Pásalo a Ventas», sin nombre, usan el lead en foco; se quitó el respaldo que traía otro lead.
- **Sugerencias de Jefatura:** corregido. Primero va lo pendiente del recorrido (el referido o la propuesta especial más recientes).
- **Máquina recomendada:** corregido. Chat, canasta y CRM usan el motor de C04: para un restaurante, Pods; para un hotel, Bar, según el diagnóstico.
- **Total de la propuesta:** corregido. El agente muestra el mismo total que C05 y «Mi cotización» («Total neto referencial» + IVA).
- **Calculadora de R06:** margen de 30 % y umbral de ROAS de 4,17× (1 ÷ (0,30 × 0,80)), según el modelo económico revisado, hoja «Supuestos». El margen base de 35 % del puntaje de valor sigue como supuesto del prototipo; calibrarlo antes de citarlo.
- **OTIF 92 %:** retirado del texto público del portal; en las pantallas internas aparece como simulación. El informe no debe citarlo como dato.
