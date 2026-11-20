# Piloto local de Marley Coffee Empresas · 20 de noviembre

Carlitos, te espera revisar C01, C05 y C09 con Claude. El piloto está guardado localmente y hay tres controles generales pendientes.

La vista local abre en http://127.0.0.1:8896/. La rama `codex/premium-sintesis-20nov` parte de `204ffb2`. Las capturas, mediciones JSON y salidas de los verificadores están en la carpeta hermana `marley-premium-20nov-evidencia/`.

## Qué cambió y prueba del mismo sitio

| Vista | Cambio | Elementos reconocibles al comparar las capturas |
|---|---|---|
| C01 | Una frase de apoyo, aire entre titular y acción y acceso al asistente en el flujo de la página. «EMPRESAS» también queda en amarillo en el menú móvil. | Hero negro, foto de Keep On Moving en la misma columna, sobretítulo amarillo, título Festivo, logo dorado y «Ver el producto» amarillo. La base tiene foto en C01. El hero B2B con video pertenece a C02. |
| C05 | Total neto referencial desde la primera vista, paso «Propuesta» marcado y un desplegable para máquina, insumos y condiciones. Al abrirlo aparecen el porqué de la máquina, los precios de línea y la acción de confirmación al cierre. | Misma guía numerada, cabecera, superficie, CTA amarillo y orden de máquina, insumos, pago y servicio. Una línea fina separa los bloques al abrirlos. |
| C09 | El pedido deja primero su estado, folio y acción. «Ayuda y postventa» y «Recomendar» abren sus datos desde la tarjeta. Productos, precios y correo conservan su detalle. | Banda negra «Mi portal» con el nombre de la cuenta, tarjeta blanca, barra amarilla y etapas Confirmado, En espera y Recibido. En celular, la misma guía usa dos filas para evitar partir palabras. |
| CRM | «Recomendar» en la ficha de Ventas, borrador visible en Marketing, «Por aprobar» en «Hoy» de Jefatura y repintado de R17 al resolver el JSON. | Colores por rol, cuatro entradas principales y simulación local. Se probó R17 con la respuesta demorada. |

## Palabras visibles antes → después

Se cuentan palabras completas en la primera vista de Chrome, incluido el encabezado de navegación. Los importes y folios cuentan como una palabra. Los despliegues parten cerrados y las capturas usan el mismo caso ficticio en ambos lados.

| Vista | 1280×551 | 1912×733 | 390×844 |
|---|---:|---:|---:|
| C01 | 44 → 39 | 46 → 43 | 35 → 32 |
| C05 | 90 → 47 | 105 → 72 | 74 → 70 |
| C09 | 62 → 49 | 86 → 65 | 67 → 49 |
| Hoy · Ventas | 91 → 75 | 103 → 81 | 99 → 73 |
| Hoy · Marketing | 99 → 52 | 110 → 63 | 106 → 52 |
| Hoy · Jefatura | 107 → 49 | 160 → 52 | 118 → 42 |

En C05, el contenido principal pasa de 71 a 33 palabras a 1280×551. A 390×844 entra más pie de página tras la síntesis, mientras que el contenido principal pasa de 71 a 33. Las tres vistas del piloto respetan los topes de altura medidos y los inicios de rol quedan bajo 1.300 px en escritorio.

## Conservación comprobada

- Festivo y Pressura cargan en Chrome y Edge en los cinco tamaños del piloto. Las capturas abiertas muestran las fotos existentes de máquina y productos. Las ayudas y los avisos se revisaron con clic y rueda.
- El hero de C02 conserva su póster y solicita el video después de mover la rueda. Se conservan las definiciones publicadas del typewriter y la cámara. C06 conserva la foto oscura a sangre y «Siguiente: ir a mi portal». C10 conserva la banda de partida y la cotización al lado en escritorio.
- Se cotejaron precio principal y desglose de C05, folio, barra de avance, recepción, recompra y correos de prueba en C09. Las rutas de diagnóstico y catálogo, el feed, el buscador, las landings, los precios JSON y el modelo de datos conservan sus archivos de origen. En los casos recorridos se comprobó la opción «Prefiero no responder».
- Los 12 HTML comparados conservan metadatos, JSON-LD, textos alternativos, enlaces y un H1 en el HTML. `index.html` es la fuente y `prototipo.html` es su copia byte por byte.

## Verificadores y pendientes

| Control | Resultado |
|---|---|
| `verify-crm-v2`, `verify-a8-portal`, `verify-r6-crm`, `verify-r6-mkt-jefatura`, `verify-landing-w10` | PASS contra el servidor local. |
| `verify-piloto-premium` | PASS. 104 clics con respuesta y 0 fallidos en los recorridos probados de C01–C10 y R00–R17. Compara 12 HTML, prueba el consentimiento y la opción de omitir y demora la respuesta de R17 para comprobar que se repinta. |
| `verify-r5-caminos` | FAIL. C02 excede el alto, C10 tiene un borde heredado fuera de paleta, cuatro landings exceden su alto y la entrada directa a C11 del recorrido presenta errores de carga. Los colores y las alturas citados se cotejaron con la base. |
| `verify-r6-puntaje` | FAIL. R09 legado mide 2.539 px en el escenario completo de Chrome móvil. El mismo verificador con `204ffb2` reproduce 2.539 px. |
| `verify-a1-final-a8-r3` | FAIL. Primera carga de C02 supera 2,5 MB en el servidor simple, CTA de C08 bajo el primer pliegue de las vistas cortas y reglas de elementos fijos en escritorio. En la base C02 también supera 2,5 MB y el CTA de C08 cae en las mismas coordenadas. |
| Detector visual canónico y `aos mejora constatar` | 0 hallazgos en ambos. El detector visual recorrió 30 combinaciones de ruta, navegador y tamaño. |
| Agent OS, revisión del texto público | PASS. |

Los verificadores del CRM anterior se ejecutan con su circuito de compatibilidad. El CRM que se monta en el prototipo se prueba aparte con `verify-crm-v2` y el recorrido del piloto. Se actualizaron pruebas que intentaban pulsar dentro de un detalle cerrado o esperar una pantalla con un selector antiguo. Se preservaron los umbrales de altura y carga.

La primera ejecución del verificador CRM escribió capturas en la carpeta histórica que tenía configurada para el 16-nov. El destino quedó configurable y el valor predeterminado ahora usa una carpeta temporal por ejecución.

## Referencias y evidencia

- Marley Coffee Chile. La foto protagoniza la sección y un solo mensaje acompaña al producto. Se aplicó ese principio al texto de C01 y se usó una sola franja tricolor bajo el título de C05. [Sitio oficial](https://www.marleycoffee.cl/)
- Nespresso Professional Chile. La entrada por oficinas, hoteles o restaurantes se entiende con una foto, una frase y una acción. La captura del sitio a 1280×551 muestra el aviso de cookies y una carga parcial del logo. El criterio por negocio se contrastó con su página oficial de soluciones. [Nespresso Professional](https://www.nespresso.com/pro/cl/es), [Soluciones por negocio](https://www.nespresso.com/pro/cl/es/business-coffee-solutions)
- La tabla 23 del informe final y los PDF autoguiados del 19-nov aportaron las decisiones y la localización de fricciones. Los 13 clics sin respuesta en C04 y C09 son de la ronda de personas. Los 104 clics del piloto son comprobaciones de navegador.

El árbol de evidencia contiene `chrome/antes/`, `chrome/despues/` y `msedge/despues/`. Las tres vistas del cliente y los tres inicios de rol tienen capturas a 1280×551, 1912×733 y 390×844, además de 1440×900 y 360×740. Las capturas `-scroll` muestran las vistas que tienen desplazamiento y las `-detalle` muestran el contenido desplegado.

**No visto.** El comportamiento con personas en una nueva ronda y la publicación del piloto.

## Reproducción local

```powershell
py -3.12 -m http.server 8896 --bind 127.0.0.1 --directory .
node qa/medir-piloto-premium.cjs http://127.0.0.1:8896/ ../marley-premium-20nov-evidencia
node qa/verify-piloto-premium.cjs http://127.0.0.1:8896/
```

Para actualizar la copia pública durante una edición local, guardar `index.html` y copiar sus bytes a `prototipo.html`. La vuelta atrás del código está en los commits de esta rama.
