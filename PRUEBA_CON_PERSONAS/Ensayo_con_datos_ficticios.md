# Ensayo de «Iniciar test» · 06-nov-2026 · datos ficticios

**Qué se probó:** una sesión completa del test de cliente (perfil Hotel), con el moderador como «persona de ensayo». Código P1 y datos ficticios. Versión: `prototipo.html` de esta carpeta (commit `3612f6f` del repositorio). El informe de ejemplo está en `Ensayo_informe_datos_ficticios.html`.

## Qué funcionó

- Los tres pasos de «Iniciar test» (tipo de persona, negocio, datos de la sesión) y el inicio del cronómetro.
- Tiempos: la tarea quedó con 74 s; el informe muestra tiempos por etapa, pausa más larga y primera acción.
- Notas: la nota rápida con Alt+2 quedó con su hora (00:44) y la etiqueta «T1 · frase». Se guarda vacía hasta que se escribe el texto.
- Facilidad (6 de 7), resultado («Con ayuda») y nota del moderador: guardados y mostrados en el informe.
- Cuestionario SUS (10 preguntas): puntaje calculado bien (75 con las respuestas de prueba; referencia 68).
- Informe por persona: «Descargar informe PDF» generó el informe completo (título, tabla de la tarea, tiempos, SUS y notas). Como el prototipo no tiene servidor propio, la descarga salió como página para imprimir a PDF.
- Pantalla de resultados: «Tareas (CSV, hoja 08)», «Notas (CSV, hoja 10)», «Acciones con sus segundos (CSV)» y «Datos completos (JSON)» están disponibles.

## Qué no se pudo probar

- **Grabación de pantalla:** pide permiso «Esta pestaña». El navegador integrado no permite capturar la pantalla. Hay que probarla en el computador de la prueba, con una sesión ficticia, antes de la primera persona.
- **Tarea de CRM** (Ventas o Jefatura): no se ensayó una sesión completa. Sí se revisaron los pasos 1 a 3 de `?test=crm`: ofrece T7 (Ventas) y T9 (Jefatura), con sus consignas.
- **Celular:** no se probó en un celular real. La herramienta no ofrece grabar la pantalla en celular.
- **Mapa de calor** y **video grabado**: no se probaron (depende de la grabación).
- **Descarga de CSV:** se vio el botón; no se descargó en este ensayo.

## Puntos para decidir (no se cambiaron)

1. **Resuelto el 06-nov: una tarea por participante,** como en el 15-oct. «Iniciar test» mide T1 para cliente y T7 o T9 para CRM. Las tareas T2 a T6 quedan como anexo opcional del guion, no comparable con el EP3.
2. **Nombres en el informe.** El título del informe toma lo que se escriba en «Nombre de la persona». Por eso el guion pide escribir solo el código (P1, P2…).
3. **Permisos.** Durante el ensayo, el navegador integrado avisó que la página pidió acceso a cámara y micrófono. El código de «Iniciar test» solo pide la pantalla, sin micrófono. El origen del aviso no quedó identificado. Confirmar en el computador de la prueba que no aparece ningún permiso de micrófono o cámara.
4. **Consentimiento y celular.** El consentimiento dice que se graba solo la pantalla, sin voz, y solo en computador. La herramienta no ofrece grabar en celular: detecta el dispositivo y oculta la opción.

## Antes de la primera sesión

- Probar una sesión ficticia en el computador de la prueba (Edge o Chrome), incluida la grabación de pantalla, y revisar que el informe se imprime a PDF.
- Revisar que el código P se suma bien en la segunda sesión. Antes de cada sesión, el código del paso 3 se cambia al de la persona (P1 a P5).
- Probar en un celular real antes de la primera sesión de celular: `?test=sitio` (P2 y P3) y `?test=crm` (P5).
