# Marley Coffee Empresas · prototipo de doble entrada

Esta entrega local permite empezar por una recomendación de máquina o por un modelo que el comprador ya tenga en mente. La preferencia manual se conserva; una alternativa sugerida solo reemplaza esa elección si el usuario lo solicita.

## Abrir y probar

1. Abre PowerShell en esta carpeta.
2. Ejecuta `python -m http.server 8874 --bind 127.0.0.1`.
3. Abre `http://127.0.0.1:8874/index.html`. También está disponible `prototipo.html`.

- **Ayúdame a elegir una máquina:** cuestionario breve, orientación y propuesta preliminar sin pedir contacto primero.
- **Ya sé cuál me interesa:** selección de equipo, tres respuestas para ajustar la propuesta y opción de revisar productos.
- **Ver packs y productos:** entrada opcional al catálogo, antes o después de elegir equipo.
- **Seguimiento:** se solicita solo si el comprador lo decide; las acciones del prototipo son simuladas y locales.

El menú de demostración permite recorrer las pantallas del sitio y CRM. Usa solo datos ficticios; no se conecta a correo, CRM, pedidos ni inventario real.

## Archivos

- `index.html`: entrada principal; `prototipo.html`, `mockups.html` y `wireframes.html` son variantes.
- `INFORME_PRUEBAS_07NOV.md`: evidencia disponible, alcance, análisis y conclusiones de esta pasada.
- `qa/verify-marley-m2.cjs`: verificador automático ejecutado con PASS.
- `PRUEBA_CON_PERSONAS/`: guion, consentimiento y registro para una futura ronda; contiene ejemplos ficticios.
- `recursos/`: recursos visuales que requiere el prototipo.

La carpeta `EVIDENCIA_07NOV/` conserva capturas de una revisión anterior. No las uses como evidencia de la nueva portada con doble entrada. Las capturas de la revisión actual se visualizaron en el hilo; esta pasada no pudo guardarlas como archivos debido a que el control de captura de Windows se detuvo al no poder identificar con certeza la URL de la ventana Chrome activa.

Esta versión no se ha desplegado. Precios, disponibilidad, instalación y condiciones comerciales deben validarse con Marley Coffee antes de una implementación real.
