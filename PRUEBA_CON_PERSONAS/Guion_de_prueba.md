# Guion de prueba con personas · réplica de la ronda 1 del 15-oct (EP3)

**Marley Coffee · prototipo final · 09-nov-2026**

Para el moderador. Mantén intactas las tareas y métricas comparables de la ronda del 15 de octubre. En esta versión el formulario C03 es obligatorio y aparece antes del diagnóstico C04: identifica el contacto y registra el primer evento de lead scoring. El permiso para responder es requerido; el permiso de marketing es opcional y separado. Prueba el diseño, no a la persona; cualquier módulo extra va separado de la comparación EP3.

## 1. Diseño (igual que el 15-oct)

- **Cinco sesiones moderadas**, con la medición integrada del prototipo:
- cliente: `prototipo.html?test=sitio` → búsqueda espontánea → resultado → sitio → formulario y cotización;
  - equipo comercial: `prototipo.html?test=crm`.
- **Una tarea por participante.** La herramienta la pone sola según el perfil que elijas.
- **Medidas** (las mismas del 15-oct):
  - resultado: **autónomo**, **con apoyo** o **bloqueado**;
  - tiempo en segundos;
  - facilidad **SEQ** (1 a 7), al terminar la tarea;
  - **toques sin respuesta** como «x de y» (sin respuesta de los toques totales);
  - **SUS** (0 a 100), al final;
  - tiempo por pantalla y mapa de calor (en el informe).
- **Criterios de éxito:** están en `Comparacion_ronda1_ronda2.md`.

| Código | Perfil | Entorno | Tarea | Cómo abrir |
|---|---|---|---|---|
| P1 | Administración de hotel | computador | T1 cotización | `prototipo.html?test=sitio` → Cliente o negocio → Hotel |
| P2 | Administración de restaurante | celular | T1 cotización | `prototipo.html?test=sitio` en el celular → Cliente o negocio → Restaurante |
| P3 | Dueña de cafetería | celular | T1 cotización | `prototipo.html?test=sitio` en el celular → Cliente o negocio → Cafetería |
| P4 | Ejecutiva comercial (CRM) | computador propuesto; verificar antecedente | T7 atender el chat | `prototipo.html?test=crm` → Trabajador/a de Marley Coffee → Ventas |
| P5 | Jefatura de ventas y KAM | celular | T9 tablero directivo | `prototipo.html?test=crm` en el celular → Trabajador/a de Marley Coffee → Jefatura |

Notas de la tabla:

- El informe del 15-oct no indica el dispositivo de P4. Para esta ronda se propone computador; si se recupera el dato original, úsalo y registra el dispositivo realmente empleado.
- En el paso 1 del CRM dice «se hace en computador», pero el paso 3 deja elegir **Celular**. Para P5 se elige Celular, como en el 15-oct.
- En celular la herramienta **no ofrece grabar la pantalla**. Las notas, el tiempo y el informe sí se generan.

**Consignas de cada tarea** (son las que muestra la herramienta; léelas en voz alta):

- **T1 · Hotel (P1):** «En tu hotel, quieres mejorar el café que ofreces durante el desayuno. Encuentra una alternativa que se ajuste a tu operación.»
- **T1 · Restaurante (P2):** «En tu restaurante, quieres renovar la experiencia de café para tus clientes. Encuentra una alternativa que se ajuste a tu operación.»
- **T1 · Cafetería (P3):** «En tu cafetería, quieres mejorar el café que sirves. Encuentra una alternativa que se ajuste a tu operación.»
- **T7 · Ventas (P4):** «Eres ejecutiva de Marley Coffee: ingresa al CRM con tu cuenta (usuario paula.diaz, contraseña demo). Un cliente te está esperando en el chat. Atiéndelo y respóndele.»
- **T9 · Jefatura (P5):** «Eres jefatura de Marley Coffee: ingresa al CRM con tu cuenta (usuario jefatura, contraseña demo). ¿Cuántos clientes están comprando y cuántos SQL hay? ¿Qué zona trae más MQL? Dile la respuesta al moderador.»

## 2. Antes de empezar

1. Pide el consentimiento (`Consentimiento_informado.md`). Sin consentimiento no se empieza.
2. Cada participante tiene que tener el perfil de su código (tabla de la sección 1). Si ya participó el 15-oct, mira la sección 7.
3. Todos los datos son ficticios. Si la persona pregunta por datos reales, no los ingrese.
4. Antes de empezar revisa el código del paso 3. La herramienta propone el siguiente (P2, P3…). Cámbialo al código de la persona.
5. Anota en la planilla la fecha, la versión (`prototipo.html · 09-nov-2026`) y tu nombre como observador.

## 3. Cómo correr cada sesión

Los pasos son los mismos para P1 a P5. Cambia el perfil según la tabla.

1. Abre la dirección del perfil. Aparece «TEST DE USABILIDAD · PASO 1 DE 3».
2. **Paso 1:** elige «Cliente o negocio» (P1 a P3) o «Trabajador/a de Marley Coffee» (P4 y P5).
3. **Paso 2:** elige el negocio (Hotel, Restaurante o Cafetería) o el rol (Ventas o Jefatura).
4. **Paso 3 «Antes de empezar»:**
   - **Nombre de la persona:** escribe el código (P1…P5), **no el nombre**.
   - **Código para citarla en el informe:** elige el mismo código.
   - **Qué hace la persona:** una frase corta, sin datos de contacto (por ejemplo, «administración de hotel»).
   - **Dispositivo:** Computador o Celular, según la tabla.
   - **Grabar esta pestaña:** aparece solo en computador. Si la persona acepta, déjalo marcado. Al empezar, el navegador pregunta qué compartir: elige «Esta pestaña». El prototipo solicita solo pantalla, sin audio. Comprueba el selector del navegador y realiza un ensayo ficticio antes de la primera sesión; si no funciona, continúa sin grabación y conserva las observaciones escritas.
   - Marca el consentimiento y pulsa **Comenzar test**.
5. Lee la consigna en voz alta (está en la pantalla «TU TAREA»). Pulsa **Comenzar tarea**. Se abre en la misma pestaña una simulación de búsqueda orgánica y el cronómetro empieza antes de que escriba. La persona escribe su consulta libre, sin sugerencias ni keywords; luego elige un resultado y sigue al sitio. La simulación no muestra resultados ni posiciones reales de Google. El test retoma automáticamente la sesión al entrar al sitio y suma el tiempo de búsqueda al tiempo de la tarea.
6. Mientras la persona trabaja, no ayudes antes de 60 segundos bloqueada. Si ayudas, el resultado es **con apoyo**.
7. Cuando termine o se rinda, pulsa **Terminé**.
8. Pregunta: «¿Qué tan fácil o difícil fue esta tarea?» (1 muy difícil, 7 muy fácil) y elige el número.
9. Marca el resultado: **Logrado** (autónomo), **Con ayuda** (con apoyo) o **No logrado** (bloqueado).
10. Pulsa **Ir al cuestionario final**. La persona responde las 10 preguntas del SUS.
11. En la pantalla de resultados:
    - **Descargar informe PDF:** si se abre una ventana de impresión, elige «Guardar como PDF». Si se descarga un HTML, ábrelo e imprime a PDF.
    - **Tareas (CSV, hoja 08)** y **Notas (CSV, hoja 10):** guárdalas junto al informe.
    - Abre **Archivos para el Excel del análisis** y descarga **Búsqueda (CSV · SEO/AEO/GEO)**. Conserva la consulta exacta solo en este archivo de investigación; no la pases a la ficha CRM.
    - **Ver mapa de calor:** opcional.

Guarda los archivos con el código: `P1_informe.pdf`, `P1_tareas.csv`, `P1_notas.csv`.

Durante la tarea puedes marcar momentos con **Alt+1** (duda), **Alt+2** (frase), **Alt+3** (gesto), **Alt+4** (error) o **Alt+5** (idea). Una nota rápida queda vacía hasta que escribas su texto. Los comentarios de la persona se anotan a mano, con la cita literal.

Si la prueba de celular se hace desde el computador con «Ver en celular», no es un celular real: anótalo en `comentario`.

## 4. Planilla (`Registro_resultados.csv`)

Una fila por participante y tarea:

- `participante`: P1 a P5 (el extra es X1, sección 5).
- `perfil`: texto corto (por ejemplo, administración de hotel).
- `tarea`: T1 cotización, T7 atender chat o T9 tablero directivo.
- `entorno`: computador o celular.
- `resultado`: `autonomo` (Logrado), `con_apoyo` (Con ayuda) o `bloqueado` (No logrado).
- `tiempo_s`: tiempo de la tarea, del informe.
- `tiempo_solicitud_seguimiento_s`: medida exploratoria si la persona pide seguimiento; desde que abre el formulario hasta que lo envía. No es M8.
- `tiempo_contacto_inicial_s`: desde el primer foco en C03 hasta que envía correctamente el formulario obligatorio. Es la medición candidata para M8; compara con EP3 solo si coinciden los campos y las condiciones de inicio y término.
- `facilidad_seq_1a7`: la respuesta del paso 8.
- `toques_sin_respuesta`: «x de y». Por ejemplo, `2 de 31`: 2 toques sin respuesta de 31 toques (las columnas «Sin respuesta» y «Clics» del informe).
- `sus_0a100`: del informe.
- `comentario`: cita literal de la persona y notas de observación.
- `observador`: tu nombre.
- `fecha` y `version`: fecha de la sesión y `prototipo.html · 09-nov-2026`.
- `misma_persona_que_ronda1`: `si` o `no` (sección 7).

M8 mide el tiempo de captura inicial (<30 s). En esta versión C03 vuelve a estar antes de C04, como primer contacto. Cronometra desde el primer foco en un campo hasta el envío válido. Antes de compararlo con EP3, verifica que los campos, validaciones y límites de tiempo sean equivalentes; si no coinciden, presenta la medida como contextual y conserva la referencia de la ronda 1 por separado. Para P1 a P3, registra también el tiempo hasta la propuesta, errores y abandono. `tiempo_solicitud_seguimiento_s` mide otra acción y no sustituye M8.

## 5. Participante extra (opcional, se informa aparte)

Un participante de **oficina (OCS)**. No entra en la comparación con el EP3.

«Iniciar test» no tiene perfil de oficina. Por eso se corre a mano:

1. Abre `prototipo.html` (sin `?test`).
2. Cronómetro y planilla a mano. Código **X1**.
3. Consigna propuesta (**no viene de la herramienta**; confirmar con Carlitos antes de usarla): «Tienes oficinas y quieres cambiar el café que sirves a tu equipo. Busca cómo pedir una propuesta para tu negocio.»
4. Anota a mano el resultado, el tiempo, la facilidad (1 a 7) y los toques sin respuesta.
5. Informa el resultado en un bloque aparte.

## 6. Al final de cada sesión

- Pregunta: «¿Qué te dio confianza y qué no?» Anota la respuesta literal.
- Agradece. Recuerda que puede pedir que se borre la grabación.

## 7. Misma persona o persona nueva

- **Si la persona ya participó el 15-oct** (es una de las personas de la ronda 1): escribe `si` en `misma_persona_que_ronda1` y explícalo en `comentario`. Ya conoce la versión anterior, así que el resultado se lee con cuidado.
- **Si es persona nueva:** escribe `no`. Debe tener el mismo perfil que su código (tabla de la sección 1).

Con cinco personas, los resultados son tendencias, no estadísticas. Así lo dice el EP3.

## 8. Anexo opcional · tareas complementarias (no comparables con el EP3)

Solo si el tiempo alcanza, y después de la tarea de la herramienta. No están en «Iniciar test»: se leen y se cronometran a mano. Se anotan en la planilla con `tarea` = `anexo T1` a `anexo T6`, y no entran en los criterios de la comparación.

- **anexo T1 · Empresas:** encuentra dónde Marley Coffee atiende a empresas y explica con tus palabras qué ofrece.
- **anexo T2 · Máquinas:** compara las máquinas y explica qué se paga antes de instalar y qué se paga cada mes. No confundas la carga inicial con la reposición.
- **anexo T3 · Cotización:** arma la cotización con datos ficticios hasta ver la propuesta.
- **anexo T4 · Seguimiento:** encuentra el número de seguimiento y explica qué pasa después.
- **anexo T5 · CRM, rol Ventas:** encuentra esa solicitud, entiende qué necesita el cliente y decide el siguiente paso sin inventar precio ni stock.
- **anexo T6 · Mi cuenta:** pide una reposición en una sede y avisa un problema en otra.
- **anexo T7 · CRM, reactivación:** desde «Mi día», abre «Mis clientes» y la pestaña «Reactivación». Desde «Mi día», encuentra cómo revisar un cliente que dejó de comprar antes de proponerle una acción. No le indiques qué filtro usar. Observa si la cola conserva el caso y confirma si se contacta automáticamente (no lo hace).


## 9. Módulos exploratorios (fuera de la comparación EP3)

Usarlos solo después de las tareas principales. Requieren consentimiento y datos ficticios. Registrar en `Registro_modulos_exploratorios.csv`; no mezclar sus resultados con T1/T7/T9, SEQ, SUS ni M8.

### X1 · Elección directa o recomendación

Pide a una persona que ya sepa qué tipo de máquina prefiere que encuentre cómo empezar; a otra que no conozca las opciones, que encuentre una recomendación. Si la muestra no permite dos perfiles, usar el módulo como observación cualitativa, no comparación. No sugieras los nombres de los botones. Registra ruta, tiempo, cambios, retrocesos, ayuda y si entiende que la recomendación es preliminar.

### X2 · Recuerdo, video y animación

Después de la tarea principal y antes de mencionar movimiento, pregunta: **«¿Qué recuerdas de lo que viste?»** y copia la cita literal. Luego pregunta: **«¿Hubo algo que te llamara especialmente la atención? ¿Qué lo hizo memorable, si hubo algo?»** Registra por separado el recuerdo espontáneo, la reacción observable y la cita. No uses «wow» en la pregunta inicial ni atribuyas una expresión facial a una emoción sin confirmarla.

Para video, usa la misma cuenta y escena C09 con orden alternado: póster estático (`?media=static`) frente al clip pausado, que la persona decide reproducir. Conserva texto y CTA iguales. Primero pregunta qué entendió; después califica recuerdo, ayuda para imaginar su negocio y distracción en escala 1–7.

Para motion de interfaz, compara por separado el mismo recorrido con movimiento normal y `?motion=off`; no combines esta comparación con video. No cambies la preferencia de movimiento reducido del sistema. Si la persona tiene movimiento reducido activado, registra la experiencia accesible y no la incluyas en la comparación. Tras el recuerdo espontáneo, registra por condición cuánto contribuyó el movimiento a que la experiencia fuese memorable (1 = nada, 7 = mucho), si distrajo y qué elemento concreto produjo esa impresión. Esto mide percepción declarada, no prueba causalidad.

### X3 · Búsqueda espontánea, SEO, AEO, GEO y contenido (integrada en T1)

El camino de búsqueda forma parte ahora de la tarea principal, antes del sitio y del formulario. La pantalla se identifica como una simulación controlada: registra consultas y clics sin fingir posiciones reales. No se dan palabras clave, marcas ni sugerencias al participante.

1. El/la moderador/a lee solo la consigna natural de T1. La primera pantalla de búsqueda no presenta marca, rubro ni texto sugerido. El participante escribe con sus propias palabras y elige entre resultados; el orden Marley/alternativas alterna para reducir sesgo de posición.
2. La consulta exacta, el orden, el primer clic, su tiempo y los clics siguientes quedan en un CSV de investigación separado. La URL que abre el sitio lleva únicamente identificadores, variante y superficie; no lleva el texto de consulta. La atribución simulada queda visible en la ficha CRM después del contacto.
3. El resultado orgánico, la guía completa o el hub de contenidos aterrizan en la pantalla correspondiente en la misma pestaña. Los tres artículos breves del hub (oficina, hoteles/restaurantes y reposición) y la guía conservan la sesión y la atribución hasta el CTA hacia el sitio.
4. Para probar por separado título y meta description, inicia con `?phase=title` o `?phase=description`; se asigna A/B por separado y se alterna el orden de resultados. Nunca muestres A y B simultáneamente.
5. Al final del test descarga **Búsqueda (CSV · SEO/AEO/GEO)** desde los archivos de análisis. La respuesta directa AEO y el resumen/fuentes GEO son conceptos a evaluar, no resultados publicados de un buscador o citas reales de IA. Con cinco participantes se reportan patrones cualitativos, no ganador estadístico, lift, causalidad, posicionamiento ni citas GEO reales.

### X4 · CRM: adquisición, reactivación y permisos

En Ventas, inicia en «Mi día» y pide que revise una cuenta que dejó de comprar, sin decir «Reactiva» ni indicar el filtro. Registra si llega desde R01 a la cola correcta y si conserva el historial. En R02 confirma si encuentra negocio, comuna, solicitud, máquina y permisos; separa permiso para responder de permiso de marketing. En Marketing y Jefatura verifica que no puedan aceptar un SQL. Registra sugerencia del agente, dato de origen, incertidumbre, actor humano y resultado. Una recompra de una cuenta existente es reactivación/retención; no se cuenta como cliente nuevo. No usar datos reales ni enviar mensajes.

### X5 · Formulario y encuadre en mobile

En 320, 360 y 390 px revisa C02, C03, C04, C05, C07, R02 y R03. En C03, prueba primero un envío inválido y luego uno válido antes de abrir C04. Observa teclado, errores, foco, retorno, scroll, safe-area y que controles fijos no tapen CTA. Si se usa emulación, decláralo; no reportarlo como prueba en un teléfono real. Mantén videos y animaciones activos en la experiencia normal. El test de video y motion se hace por separado según X2.

