# Ronda final E0–E9 · kit de prueba y consola

**Propósito:** observar el recorrido completo en el prototipo final y registrar problemas por etapa.  
**Alcance:** cinco personas, cinco perfiles y diez tareas por persona; resultados exploratorios, no representativos.  
**Kit anterior:** queda intacto en `PRUEBA_CON_PERSONAS/`.

## Ejecutar una sesión

1. **Modo local:** sirve la carpeta raíz en `http://127.0.0.1` o `http://localhost` y abre [inicio.html](inicio.html). En local, la consola y la persona usan el mismo equipo.
2. Elige participante, perfil y camino: A, B-Meta, B-LinkedIn, B-Google o C por rol. Al preparar una sesión, se limpian los datos del prototipo de este origen y `sessionStorage`; las claves `mc_prueba_*` que guardan respuestas y sesiones se conservan. La bienvenida se abre en una pestaña nueva y la consola queda abierta.
3. En la pestaña de la persona, lee la bienvenida, presenta el [consentimiento](Consentimiento_informado.md) y espera que marque «Acepto participar». Contesta el cuestionario inicial de a una pregunta. «Prefiero no responder» registra `omitida=true`; las respuestas se guardan al instante.
4. «Comenzar recorrido» lleva al destino que preparó la consola. A y B-Google abren el módulo del sitio; su SERP comienza en blanco. B-Meta/LinkedIn abren el feed simulado. Para E3, entrega la [ficha de datos ficticios](Fichas_datos_ficticios.html). No dictes palabras clave ni ingreses datos reales.
5. En la consola, para cada E0–E9 o tarea interna, marca «Empezó» y «Terminó», registra resultado, SEQ, errores y nota. Abre la pausa correspondiente: después de E2 y E4 para externos, y después de la tarea 1 para C. Tras completar E4 y la pausa de propuesta, lee la tarjeta «3 días después» y pulsa «Saltar 3 días» antes de E5. Antes de E6, lee «Decisión tomada» (solo recordatorio). Tras completar E6, pulsa «Saltar un mes» antes de E7. Antes de E9, lee «Caso resuelto» (solo recordatorio). Los dos saltos con botones se hacen desde esta consola. Al terminar todas las etapas, abre el cuestionario final.
6. Mientras haya una sesión del kit activa, el portal oculta el botón «⋯» de su módulo de prueba, para que la persona no abra el menú del moderador por error. Los saltos y el cierre se hacen siempre desde la consola. El instrumento común del kit se aplica desde `sesion.html?fase=final`; UMUX-Lite es el cierre vigente.
7. Para revisar y exportar, abre [respuestas.html](respuestas.html). Los filtros afectan la vista y las exportaciones. «Reiniciar datos» limpia el prototipo, pero conserva las respuestas. El borrado de investigación solo se ofrece en `respuestas.html`, después de ofrecer exportación y escribir `BORRAR`.
8. **Prueba encadenada (opcional).** Después de que una persona externa haya registrado el lead ficticio en E3, vuelve a la consola, marca «Atender el lead de la persona anterior» y abre C por rol. La sesión interna guarda su `sesion_origen`; el traspaso de `marleyMVP:v7:prototype:test-sitio` a `marleyMVP:v7:prototype` ocurre una sola vez.
   - Termina la sesión A o B en este navegador, al menos hasta que la persona deje su correo en E3.
   - Vuelve a `inicio.html`, marca «Atender el lead de la persona anterior» y abre C por rol. C no borra nada.
   - El lead ficticio aparece «En vivo» en Mi día, Mis clientes y Leads y puntajes, con su origen: «Orgánico · Google (búsqueda simulada)» (A), «Google Ads · cpc (búsqueda simulada)» (B-Google), «Meta Ads · paid_social» o «LinkedIn Ads · paid_social».
   - Para encadenar varios roles, marca la opción en cada uno: cada rol ve lo que dejó el anterior.
   - Sin un lead previo, el lanzador avisa y no abre.
   - Verificado con Playwright: A, B-Google y B-Meta encadenados con Ventas, Marketing y Jefatura; sin errores de JavaScript.

## Modo remoto (sitio publicado)

1. Abre [inicio.html](inicio.html) en la URL publicada, desde el computador del moderador. Selecciona el código de participante, perfil y camino; la opción encadenada queda deshabilitada porque el teléfono y el computador no comparten datos.
2. Pulsa el camino. La consola crea una sesión en este computador, muestra un enlace y un QR locales, y **no borra ni modifica el almacenamiento ajeno al prototipo**. Copia el enlace o pide a la persona que escanee el QR.
3. La persona abre el enlace en su celular. Si lo abrió desde WhatsApp o Instagram, debe seguir en esa misma pestaña hasta el final. Presenta la bienvenida y el consentimiento; espera la aceptación y deja que responda el bloque inicial antes de tocar «Comenzar recorrido».
4. Modera y registra cada etapa en el computador. En las pausas, pídele que toque la tarjeta correspondiente en su teléfono y responda; cuando termine, marca «Hecho» en la consola. Antes de E5 y E7, pídele que toque «3 días después» o «Un mes después» en el teléfono y luego marca el salto como hecho en el computador. Lee «Decisión tomada» y «Caso resuelto» como recordatorios impresos.
5. Después de E9, pídele que toque la tarjeta de preguntas finales en su teléfono. Cuando termine, marca el cierre como hecho en la consola. La sesión remota del teléfono queda cerrada al terminar el bloque final.
6. En el teléfono verá únicamente su código y el número de respuestas para revisar qué se enviará. Puede compartir el texto con la función del dispositivo, copiarlo o descargar el archivo JSON. No se envía nada automáticamente.
7. En el computador abre [respuestas.html](respuestas.html), pega el texto que entrega la persona o elige su archivo y pulsa «Importar respuestas». La importación valida el formato y la versión, fusiona respuestas por fecha y conserva las etapas que anotó el moderador. Los datos quedan en el navegador del computador.

El enlace del QR apunta a la misma publicación desde donde se abrió la consola. No uses una URL localhost para una persona que está en otro equipo. El flujo local descrito arriba no cambia.

El CRM contiene una muestra sintética con fuentes «Orgánico (Google)» y de campaña. El inicio limpio no la vincula a la sesión externa A/B; sirve para probar lectura de origen, permisos y tareas internas. No la reportes como lead generado por una persona ni como conversión real. El feed `captacion/anuncios/feed-simulado.html` existe al 11-nov-2026; si no carga el día de la sesión, conserva esa ruta en el botón y anota el bloqueo, sin cambiar el archivo de A4.

## Prueba autoguiada (prueba.html)

La prueba autoguiada sirve para que cada persona recorra el prototipo por su cuenta. No requiere consola ni envío de datos en línea.

1. Abre `prueba.html`, acepta participar y elige A (búsqueda), B (Meta, LinkedIn o Google) o C (equipo interno). En A y B, elige el tipo de negocio; en C, el área de trabajo.
2. Responde las preguntas iniciales. El cuestionario tiene 6 preguntas para caminos externos y 4 para el equipo interno; puedes omitir cualquiera.
3. Recorre las tareas que aparecen en la barra de prueba junto al sitio o CRM. Después de cada tarea, registra si la lograste, qué tan fácil fue y un comentario opcional. La página conserva el avance si se recarga.
4. En caminos externos, responde las dos pausas. Antes de seguir, la prueba muestra «3 días después» y «Un mes después»; el avance se habilita cuando el recorrido confirma que la propuesta o el contrato de prueba están listos. En C, hay una pausa después de la primera tarea.
5. Responde el bloque final: 9 preguntas externas o 7 internas. El puntaje de usabilidad es UMUX-Lite (0–100); la ficha ficticia de E3 se usa solo dentro del prototipo y no se incluye en los archivos.
6. En resultados, descarga el informe PDF, los datos JSON y el CSV de tareas. El PDF reúne camino, tareas, respuestas, pausas, saltos, descargas observadas y páginas visitadas; no incluye nombre, correo ni teléfono.
7. Nada se envía automáticamente. Tú decides si compartes el informe con quien te invitó. Para comenzar otra prueba, primero descarga el PDF y pulsa «Hacer otra prueba».

Si abres `prueba.html` con una sesión en curso, retomas el punto donde quedaste. Al comenzar una prueba nueva se limpian solo las claves del prototipo y la sesión del kit; otras claves del mismo sitio se conservan. Los cuestionarios y el informe se procesan dentro de este navegador.

**URL publicada prevista:** `https://carlosvarg1997-sys.github.io/marley-coffee-mvp/prueba.html`.

## Variantes de camino

- **A · Google directo:** búsqueda simulada en blanco → resultado orgánico → solución/guía → portal → E3–E9.
- **B · Meta / LinkedIn:** feed simulado → anuncio → landing → E3–E9.
- **B · Google:** búsqueda simulada en blanco → anuncio patrocinado → landing → E3–E9.
- **C · interno:** entrada R00 del CRM y tareas del rol seleccionado. La variante `C-encadenada` conserva el origen de la sesión externa anterior.
- Las seis variantes usan los mismos campos de respuesta y la misma estructura de exportación. Los datos quedan en `localStorage` de este navegador; no se envían a servicios.

## Archivos

- `Guion_moderador.md`: apertura, consignas E0–E9, reglas de no ayuda y observación.
- `Tarjetas_salto_de_tiempo.html`: cuatro saltos imprimibles; Festivo, Pressura y firma tricolor; PDF A4 y capturas en `evidencia/`.
- `Fichas_datos_ficticios.html`: cinco fichas E3 imprimibles, una por perfil, con datos de formulario de ejemplo.
- `inicio.html` y `consola.js`: lanzador y consola del moderador; prepara la sesión, conserva las respuestas durante el reinicio, abre cuestionarios y registra etapas.
- `../../prueba.html`, `autoguiada.js` y `autoguiada.css`: prueba autoguiada para clientes, con recorridos A/B/C, cuestionarios, barra de tareas y descargas locales.
- `fichas.json`: fichas sintéticas que precargan E3 en pruebas autoguiadas y sesiones moderadas; los archivos exportados omiten estos datos.
- `sesion.html`, `preguntas.json`, `cuestionarios.js` y `cuestionarios.css`: bienvenida, consentimiento, cuestionarios digitales y guardado local con el banco `2026-11-11-v1`.
- `respuestas.html`: vista por camino, filtros, estadísticas UMUX-Lite y soporte de sesiones antiguas SUS con exportaciones CSV/JSON.
- `Fichas_internos_CRM.html`: tres fichas imprimibles con cuentas de prueba por rol.
- `evidencia/fichas-e3-A4.pdf`: versión A4 de apoyo, una ficha por página.
- `Planilla_registro.csv`: una fila en blanco por participante y tarea.
- `Registro_busqueda.csv`: consulta literal y clics de E0, separado del CRM.
- `Consentimiento_informado.md`: aceptación de participación, captura de búsqueda y grabación opcional por separado.
- `Cuestionario_SUS.md` y `SUS_resultados.csv`: respaldo impreso y resultados de versiones anteriores; el cierre vigente usa UMUX-Lite.
- `Plantilla_analisis.md`: umbrales, fórmulas y espacio para hallazgos.
- `flujos.html`: vista de flujos por camino (enlace del artefacto de A1; no se edita desde este kit).

## Perfiles y asignación sugerida

P1 compras de restaurante · P2 jefatura de cocina de hotel · P3 dueña/o de cafetería · P4 administración de oficina · P5 coordinación de eventos/catering. Para alternar A/B y respetar afinidad, asignación sugerida: P1 A · P2 B-LinkedIn · P3 A · P4 B-LinkedIn · P5 A. B-Meta y B-Google quedan listos para sustituciones o sesiones exploratorias adicionales. Cambia la asignación si el perfil no corresponde al canal; registra el camino real. I1 Ventas · I2 Marketing · I3 Jefatura. Los caminos B-Meta admiten restaurante, cafetería, panadería y conveniencia; B-LinkedIn admite hotel, oficina y eventos.

## Antes de usar

1. Confirma con A1 qué archivo/versión local contiene el recorrido E0–E9 y prueba que el formulario/portal no envíe datos externos.
2. Antes de cada sesión, comprueba que se puede abrir `inicio.html` desde `localhost`; usa «Reiniciar datos» si harás una demostración previa. La limpieza preserva todas las claves `mc_prueba_*`.
3. **Tarea de preparación:** el equipo completa el campo `[correo del equipo de investigación, lo completa el equipo antes de la sesión]` en el consentimiento con su canal de consultas y retiro de datos. Verifica que funciona antes de reclutar. Sin el dato, no inicies la sesión; no añadas nombres ni correos reales al kit.
4. Externos: asigna P1–P5 y abre la ficha E3 correspondiente. Internos: asigna I1/I2/I3 y entrega solo la ficha de credenciales del rol. Las cuentas son solo demo; no se usan en sistemas reales.
5. Lee el consentimiento y registra dispositivo/fecha/versión. No grabes audio. La grabación de pantalla es opcional.
6. Lee las consignas literalmente. No entregues palabras de búsqueda, labels, filtros, nombres de estados ni ayuda de navegación.
7. Si el feed, el CRM o un envío simulado no responde como se documenta, pausa y anota el bloqueo; no improvises sustitutos ni uses datos reales.
8. Al terminar, revisa las filas guardadas en [respuestas.html](respuestas.html). La [planilla](Planilla_registro.csv) y el cuestionario impreso de versiones anteriores son respaldos en papel; no rellenes resultados no observados.

**Umbrales de la ronda moderada:** ≥80 % de tareas sin ayuda; SEQ ≥5,5/7; UMUX-Lite ≥70/100; datos iniciales <30 s; toques sin respuesta <10 %. Con cinco personas, los hallazgos son exploratorios.

## Comprobación del lanzador

Desde la raíz del prototipo, inicia `py -3.12 -m http.server 8877 --bind 127.0.0.1`. En otra terminal ejecuta `node PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/evidencia/verificar_lanzador.cjs http://127.0.0.1:8877`. El script recorre A, B-Meta, B-LinkedIn, B-Google, C-Ventas, C-Jefatura y C-encadenada, revisa el almacenamiento y la apertura en pestaña nueva, toma capturas, verifica respuestas/exportaciones y confirma UMUX-Lite con valores conocidos. Después ejecuta `node PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/evidencia/verificar_matriz_cuestionarios.cjs http://127.0.0.1:8877`: comprueba robots, H1, desborde y objetivos táctiles en 320, 360, 390, 768, 1024, 1366 y 1440 px para la consola, la sesión y las respuestas.


## Cambio del 11-nov (22:00): cuestionario final más corto

Por pedido de Carlitos, el cuestionario final bajó a **9 preguntas para externos** y **7 para internos**. El SUS (10 afirmaciones) se reemplazó por **UMUX-Lite**, su versión validada de 2 afirmaciones («Las funciones de este sistema cubren lo que necesito» y «Este sistema es fácil de usar», escala 1–5). El puntaje va de 0 a 100: ((respuesta 1 − 1) + (respuesta 2 − 1)) / 8 × 100. Como referencia exploratoria, 70 o más se lee como comparable al umbral SUS de 68. En las exportaciones, la columna `sus_score` guarda este puntaje UMUX-Lite para las sesiones nuevas.
