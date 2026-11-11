# Ronda final E0–E9 · kit de moderación y consola

**Propósito:** observar el recorrido completo en el prototipo final y registrar problemas por etapa.  
**Alcance:** cinco personas, cinco perfiles y diez tareas por persona; resultados exploratorios, no representativos.  
**Kit anterior:** queda intacto en `PRUEBA_CON_PERSONAS/`.

## Ejecutar una sesión

1. Sirve la carpeta raíz solo en `http://127.0.0.1` o `http://localhost`; abre [inicio.html](inicio.html). El lanzador bloquea otros hosts.
2. Elige participante, perfil y camino: A, B-Meta, B-LinkedIn, B-Google o C por rol. Al preparar una sesión, se limpian los datos del prototipo de este origen y `sessionStorage`; las claves `mc_prueba_*` que guardan respuestas y sesiones se conservan. La bienvenida se abre en una pestaña nueva y la consola queda abierta.
3. En la pestaña de la persona, lee la bienvenida, presenta el [consentimiento](Consentimiento_informado.md) y espera que marque «Acepto participar». Contesta el cuestionario inicial de a una pregunta. «Prefiero no responder» registra `omitida=true`; las respuestas se guardan al instante.
4. «Comenzar recorrido» lleva al destino que preparó la consola. A y B-Google abren el módulo del sitio; su SERP comienza en blanco. B-Meta/LinkedIn abren el feed simulado. Para E3, entrega la [ficha de datos ficticios](Fichas_datos_ficticios.html). No dictes palabras clave ni ingreses datos reales.
5. En la consola, para cada E0–E9 o tarea interna, marca «Empezó» y «Terminó», registra resultado, SEQ, errores y nota. Abre la pausa correspondiente: después de E2 y E4 para externos, y después de la tarea 1 para C. Tras completar E4 y la pausa de propuesta, lee la tarjeta «3 días después» y pulsa «Saltar 3 días» antes de E5. Antes de E6, lee «Decisión tomada» (solo recordatorio). Tras completar E6, pulsa «Saltar un mes» antes de E7. Antes de E9, lee «Caso resuelto» (solo recordatorio). Los dos saltos con botones se hacen desde esta consola. Al terminar todas las etapas, abre el cuestionario final.
6. Mientras haya una sesión del kit activa, el portal oculta el botón «⋯» de su módulo de prueba, para que la persona no abra el menú del moderador por error. Los saltos y el cierre se hacen siempre desde la consola. El instrumento común del kit se aplica desde `sesion.html?fase=final`; el SUS impreso queda como respaldo si falla la vista digital.
7. Para revisar y exportar, abre [respuestas.html](respuestas.html). Los filtros afectan la vista y las exportaciones. «Reiniciar datos» limpia el prototipo, pero conserva las respuestas. El borrado de investigación solo se ofrece en `respuestas.html`, después de ofrecer exportación y escribir `BORRAR`.
8. **Prueba encadenada (opcional).** Después de que una persona externa haya registrado el lead ficticio en E3, vuelve a la consola, marca «Atender el lead de la persona anterior» y abre C por rol. La sesión interna guarda su `sesion_origen`; el traspaso de `marleyMVP:v7:prototype:test-sitio` a `marleyMVP:v7:prototype` ocurre una sola vez.
   - Termina la sesión A o B en este navegador, al menos hasta que la persona deje su correo en E3.
   - Vuelve a `inicio.html`, marca «Atender el lead de la persona anterior» y abre C por rol. C no borra nada.
   - El lead ficticio aparece «En vivo» en Mi día, Mis clientes y Leads y puntajes, con su origen: «Orgánico · Google (búsqueda simulada)» (A), «Google Ads · cpc (búsqueda simulada)» (B-Google), «Meta Ads · paid_social» o «LinkedIn Ads · paid_social».
   - Para encadenar varios roles, marca la opción en cada uno: cada rol ve lo que dejó el anterior.
   - Sin un lead previo, el lanzador avisa y no abre.
   - Verificado con Playwright: A, B-Google y B-Meta encadenados con Ventas, Marketing y Jefatura; sin errores de JavaScript.

El CRM contiene una muestra sintética con fuentes «Orgánico (Google)» y de campaña. El inicio limpio no la vincula a la sesión externa A/B; sirve para probar lectura de origen, permisos y tareas internas. No la reportes como lead generado por una persona ni como conversión real. El feed `captacion/anuncios/feed-simulado.html` existe al 11-nov-2026; si no carga el día de la sesión, conserva esa ruta en el botón y anota el bloqueo, sin cambiar el archivo de A4.

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
- `sesion.html`, `preguntas.json`, `cuestionarios.js` y `cuestionarios.css`: bienvenida, consentimiento, cuestionarios digitales y guardado local con el banco `2026-11-11-v1`.
- `respuestas.html`: vista por camino, filtros, estadísticas, SUS y exportaciones CSV/JSON.
- `Fichas_internos_CRM.html`: tres fichas imprimibles con cuentas de prueba por rol.
- `evidencia/fichas-e3-A4.pdf`: versión A4 de apoyo, una ficha por página.
- `Planilla_registro.csv`: una fila en blanco por participante y tarea.
- `Registro_busqueda.csv`: consulta literal y clics de E0, separado del CRM.
- `Consentimiento_informado.md`: aceptación de participación, captura de búsqueda y grabación opcional por separado.
- `Cuestionario_SUS.md` y `SUS_resultados.csv`: diez ítems y una fila por participante.
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
8. Al terminar, revisa las filas guardadas en [respuestas.html](respuestas.html). La [planilla](Planilla_registro.csv) y el SUS impreso son respaldos en papel; no rellenes resultados no observados.

**Umbrales:** ≥80 % de tareas sin ayuda; SEQ ≥5,5/7; SUS ≥68/100; datos iniciales <30 s; toques sin respuesta <10 %. Con cinco personas, los hallazgos son exploratorios.

## Comprobación del lanzador

Desde la raíz del prototipo, inicia `py -3.12 -m http.server 8877 --bind 127.0.0.1`. En otra terminal ejecuta `node PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/evidencia/verificar_lanzador.cjs http://127.0.0.1:8877`. El script recorre A, B-Meta, B-LinkedIn, B-Google, C-Ventas, C-Jefatura y C-encadenada, revisa el almacenamiento y la apertura en pestaña nueva, toma capturas, verifica respuestas/exportaciones y confirma el SUS con valores conocidos. Después ejecuta `node PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/evidencia/verificar_matriz_cuestionarios.cjs http://127.0.0.1:8877`: comprueba robots, H1, desborde y objetivos táctiles en 320, 360, 390, 768, 1024, 1366 y 1440 px para la consola, la sesión y las respuestas.
