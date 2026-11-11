# Marley Coffee Empresas · prototipo de doble entrada

Esta copia local incorpora el formulario obligatorio antes del cuestionario, con permiso para responder separado del permiso opcional de marketing. El flujo conserva dos entradas: pedir orientación para una máquina o partir por una máquina ya conocida. Packs y productos siguen siendo una elección opcional; sus cantidades y compatibilidad se confirman con el equipo. El sitio oficial sirve solo para contrastar catálogo, nombres e imágenes; no se replica su diseño B2B.

## Versión publicada

- [Abrir el portal B2B](https://carlosvarg1997-sys.github.io/marley-coffee-mvp/): muestra la portada normal.
- [Iniciar la prueba del sitio desde Google](https://carlosvarg1997-sys.github.io/marley-coffee-mvp/?test=sitio): usa esta ruta para probar el recorrido. Pide perfil, nombre/código y consentimiento de la persona; al pulsar «Comenzar test» abre la búsqueda simulada con el campo vacío. El portal aparece solo después de elegir un resultado.
- [Iniciar la prueba del CRM](https://carlosvarg1997-sys.github.io/marley-coffee-mvp/?test=crm).

La última versión observada en `main` es `91b380195a7196f72900e1f4f679f5a07a8f2439`. Los enlaces de arriba abren esa versión. El paquete local de esta carpeta incluye optimización de imágenes y videos y una pasada actual de QA, pero aún no está publicado: el conector de GitHub devolvió `403 Resource not accessible by integration` al preparar un asset y `gh auth status` informó que su token es inválido. No confundas este paquete local con la versión que hoy sirve Pages. La búsqueda es simulada; no consulta Google ni mide rankings o tráfico reales.
## Abrir y probar

1. En esta carpeta, ejecuta `python -m http.server 8874 --bind 127.0.0.1`.
2. `http://127.0.0.1:8874/index.html` muestra la portada B2C/B2B normal.
3. Para el test completo, abre `http://127.0.0.1:8874/index.html?test=sitio`. Selecciona cliente y tipo de negocio, registra nombre/código y consentimiento; al tocar «Comenzar test» aparece Google simulado con búsqueda en blanco. Escribe la consulta sin sugerencias, elige un resultado y recién entonces se abre el sitio.
4. Para recorrer CRM, abre `http://127.0.0.1:8874/index.html?test=crm` y selecciona Ventas o Jefatura. Los datos son ficticios.
- **Ayúdame a elegir:** primero deja datos de contacto y luego responde el diagnóstico; la recomendación es preliminar.
- **Ya sé cuál me interesa:** permite avanzar por elección directa; el contacto se pide antes del cuestionario y se conserva la preferencia.
- **Packs y productos:** entrada opcional antes o después de elegir máquina.
- **Contacto:** obligatorio antes del cuestionario. La demo guarda los datos en este navegador; el permiso para responder no equivale a aceptar novedades u ofertas.
- **Seguimiento:** después de ver la propuesta, la persona decide si solicita revisión humana.
- **Videos y movimiento:** la portada conserva el video que avanza y retrocede con el scroll, la escritura del título y la cámara que recorre las máquinas. En C09 «Mi cuenta», «Así podría verse con Marley Coffee» queda como contenido de deleite para clientes activos; CRM permite preparar un borrador local, no enviarlo.
- **SEO/AEO/GEO y blog en test:** la simulación no indexable empieza con consulta en blanco, sin sugerencias ni palabras clave. Alterna title/meta description y orden; incluye respuesta FAQ, fuentes GEO claramente simuladas, la guía completa y un hub con tres artículos de valor para oficinas, hoteles/restaurantes y reposición. La sesión y atribución llegan al CTA del sitio; la consulta exacta se guarda en el CSV de investigación, separado del CRM. La búsqueda no consulta Google ni IA en vivo.

## Evidencia y prueba con personas

- `INFORME_PRUEBAS_08NOV.md`: verificaciones, capturas, análisis, decisión de videos y conclusiones.
- `EVIDENCIA_08NOV/`: línea base. `EVIDENCIA_09NOV/`: capturas actuales de QA local a 320, 390 y 1440 px, del hero/poster, scroll del video, SERP, catálogo y CRM. No son capturas de la publicación de Pages.
- `qa/verify-marley-m2.cjs`: verificador automatizado; confirma flujo, lead scoring y persistencia en cuatro variantes, búsqueda libre, retorno en la misma pestaña y CSV.
- `?qa=1`: muestra el lanzador compacto de controles para revisión; el panel se abre por acción de quien modera y se oculta durante la tarea.
- `?media=static` y `?motion=off`: variantes controladas para módulos exploratorios, no para la comparación EP3.
- `PRUEBA_CON_PERSONAS/`: guion, consentimiento, planilla y simulación SERP para una ronda pendiente. Incluye fases A/B de title y meta description, con una variable por fase y consultas escritas por participantes, sin darles palabras clave. `blog-empresas.html` reúne tres artículos breves y `guia-servicio-cafe.html` contiene la guía completa; ambos siguen en `noindex` y son borradores de prototipo. Las pruebas de lenguaje, movimiento y video son exploratorias; no se mezclan con indicadores EP3.

## Alcance

La demostración guarda acciones localmente y usa datos ficticios. No envía correos, no contacta clientes ni se conecta a CRM, inventario o pedidos reales. La búsqueda es una simulación controlada: no mide posiciones reales, citas GEO ni tráfico de Google. Precios, disponibilidad, instalación y condiciones comerciales requieren confirmación de Marley Coffee. La copia local r6 pasa la suite automatizada y las comprobaciones Chrome a 320, 390 y 1440 px; el rendimiento de red móvil y la inspección visual de la versión pública siguen pendientes. No hay ronda nueva con participantes.
