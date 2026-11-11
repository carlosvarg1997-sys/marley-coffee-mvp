# Informe de pruebas y análisis · 7 de noviembre de 2026

## Pruebas realizadas

- El verificador `node qa/verify-marley-m2.cjs` dio **PASS** en `index.html`, `prototipo.html`, `mockups.html` y `wireframes.html`. Revisa siete segmentos B2B, 13 eventos ponderados, tres escenarios con puntajes 93, 89 y 86, diez pantallas de cliente, 17 de CRM y 22 pantallas de respaldo por variante.
- Se observó la portada en escritorio y las dos entradas: recomendación guiada y selección directa de máquina. “Ver packs y productos” queda como entrada opcional.
- Ruta guiada: desde C02 se abrió C04, se completó un caso de hotel y se llegó a una propuesta preliminar sin entregar correo. La propuesta orienta sobre máquina y abastecimiento; el catálogo y el seguimiento son opcionales.
- Ruta directa: desde C02 se eligió una máquina en C11, se continuó a C04 y luego a C05. La selección Pods se mantuvo durante el diagnóstico; la propuesta ofreció Bar como alternativa explícita. Solo cambió a Bar al pulsar “Cambiar mi selección a Bar”. No hubo reemplazo silencioso.
- La revisión anterior confirmó que C05 se lee en vista móvil de 390 × 844. La captura visual de esta pasada mostró legibles la portada dual y la propuesta directa en escritorio. El panel de revisión de esta sesión no permitió guardar nuevas capturas locales; las imágenes existentes en `EVIDENCIA_07NOV` son de una revisión previa y no documentan la nueva portada dual.
- Agent OS ejecutó control de texto público: **PASS, sin incidencias**.
- `aos mejora constatar` devolvió **0 hallazgos en 3 detectores del repositorio**: animación temprana, desalineación de variantes y sintaxis JavaScript. No es una auditoría visual de todas las pantallas.
- Todas estas pruebas corresponden a una copia local. No se publicó el sitio ni se conectó a CRM, correo, inventario o servicios reales.

## Análisis y conclusiones

La experiencia ahora ofrece dos comienzos que responden a intenciones distintas. Quien no sabe qué equipo elegir obtiene orientación y una propuesta antes de compartir datos; quien ya tiene un modelo en mente conserva esa preferencia y puede partir por ella. Los packs siguen disponibles sin obligar a completar un catálogo y el seguimiento queda para cuando el comprador decida avanzar.

En la ruta directa todavía se piden tres respuestas sobre negocio, ubicación/consumo y operación antes de mostrar la propuesta. Son necesarias para contextualizar el consumo y revisar el ajuste del equipo; el tiempo y la utilidad de esas preguntas deben medirse con personas. La propuesta se presenta como preliminar y no como una cotización contractual.

El recorrido de demostración no envía correos ni solicitudes, no crea contratos o pedidos y no confirma precios, disponibilidad, instalación ni condiciones. Esos datos se validan con Marley Coffee. La prueba con participantes reales sigue pendiente; las puntuaciones automáticas y la inspección local no sustituyen esa validación.
