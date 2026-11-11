"""Genera páginas estáticas del centro de contenidos. Solo escribe en esta carpeta."""
from pathlib import Path
from html import escape
import json
import re

HERE = Path(__file__).resolve().parent
DATE = '10 de noviembre de 2026'
SCA = ('Specialty Coffee Association · prácticas de preparación de espresso', 'https://sca.coffee/sca-news/25-magazine/issue-3/defining-ever-changing-espresso-25-magazine-issue-3-zyx36')
BCN = ('Biblioteca del Congreso Nacional de Chile · Código Civil, artículos 1793, 1915 y 2174', 'https://www.bcn.cl/leychile/navegar?idNorma=172986')
MINSAL = ('Ministerio de Salud de Chile · Reglamento Sanitario de los Alimentos', 'https://www.minsal.cl/reglamento-sanitario-de-los-alimentos/')
MACHINE = ('Nespresso Professional · ficha técnica de una máquina profesional (referencia externa)', 'https://www.nespresso.com/shared_res/mos/free_html/au/NespressoProfessional-FactSheet/Professional_Machine_Fact_Sheet_MOMENTO_Interactive_A4.pdf')
STOCK = ('Universidad de Arkansas · sistemas y punto de reposición de inventario', 'https://uark.pressbooks.pub/210h3scmtbbultra25/chapter/8-4-systems-of-how-much-to-order-and-when-to-order/')

MONTH_CALC = '''
<section class="ct-calculator" aria-labelledby="consumo-titulo">
  <h2 id="consumo-titulo">Calcula tu consumo</h2><p>Comienza con este ejemplo editable y reemplázalo por los datos de tu negocio.</p>
  <form id="ct-consumo" class="ct-form">
    <div class="ct-field"><label for="cons-tazas">Tazas por día</label><input id="cons-tazas" name="tazas" type="number" min="1" max="100000" step="1" value="80" required></div>
    <div class="ct-field"><label for="cons-dias">Días de atención al mes</label><input id="cons-dias" name="dias" type="number" min="1" max="31" step="1" value="26" required></div>
    <div class="ct-field"><label for="cons-gramos">Gramos por taza</label><input id="cons-gramos" name="gramos" type="number" min="0.1" max="1000" step="any" value="9" required></div>
    <div class="ct-form-actions"><button class="nm-btn" type="submit">Calcular consumo <span aria-hidden="true">→</span></button></div>
    <div class="ct-calc-result" id="ct-consumo-resultado" role="status" aria-live="polite"></div>
  </form>
</section>'''

STOCK_CALC = '''
<section class="ct-calculator" aria-labelledby="stock-titulo">
  <h2 id="stock-titulo">Calcula cuándo volver a pedir</h2><p>Ejemplo editable. Usa el plazo que confirmaste con tu proveedor y la reserva que hayas definido.</p>
  <form id="ct-stock" class="ct-form">
    <div class="ct-field"><label for="stock-consumo">Consumo diario (kg)</label><input id="stock-consumo" name="consumo" type="number" min="0.01" max="100000" step="any" value="1" required></div>
    <div class="ct-field"><label for="stock-entrega">Días hasta recibir el pedido</label><input id="stock-entrega" name="entrega" type="number" min="1" max="365" step="1" value="3" required></div>
    <div class="ct-field"><label for="stock-reserva">Reserva elegida (kg)</label><input id="stock-reserva" name="reserva" type="number" min="0" max="100000" step="any" value="2" required></div>
    <div class="ct-form-actions"><button class="nm-btn" type="submit">Calcular punto de pedido <span aria-hidden="true">→</span></button></div>
    <div class="ct-calc-result" id="ct-stock-resultado" role="status" aria-live="polite"></div>
  </form>
</section>'''

PAGES = [
  dict(slug='cuanto-cafe-necesita-mi-negocio', tag='Calculadora', cats='calculadoras guias',
    title='¿Cuánto café necesita mi negocio al mes?',
    summary='Multiplica las tazas que sirves al día por tus días de atención y por los gramos de café de cada receta. Divide el resultado por 1.000 para obtener kilos orientativos al mes.',
    teaser='Convierte tus tazas diarias en una estimación mensual que puedes ajustar.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_consumo_cafe&utm_content=portal_cta#C03', sources=[SCA],
    body='''<h2>Parte por tu operación</h2><p>Registra cuántas tazas sirves en un día habitual y cuántos días abres al mes. Para los gramos por taza, usa la dosis real de tu receta o consúltala con quien prepara el café.</p><div class="ct-callout"><p><strong>Fórmula:</strong> tazas diarias × días de atención × gramos por taza ÷ 1.000 = kilos de café al mes.</p></div>'''+MONTH_CALC+'''<h2>Qué revisar antes de hacer un pedido</h2><ul><li>Si tu semana tiene días de consumo muy distintos, calcula un promedio con tus propios registros.</li><li>Si sirves recetas con distintas dosis, haz el cálculo por separado y suma los kilos.</li><li>Considera mermas, cambios de temporada y café de respaldo: este cálculo no los incluye automáticamente.</li></ul><p>La dosis depende de la receta y la preparación. La investigación de la Specialty Coffee Association muestra distintas prácticas de espresso; no establece una dosis única para todos los negocios.</p>'''),
  dict(slug='comodato-maquina-de-cafe', tag='Respuesta', cats='respuestas guias',
    title='¿Qué es el comodato de una máquina de café?',
    summary='El comodato es un préstamo de uso: una parte entrega un bien para usarlo y luego devolverlo. En una propuesta de café, revisa por separado qué se acuerda sobre productos, mantenimiento y término del servicio.',
    teaser='Entiende el préstamo de uso y qué conviene revisar por escrito.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_comodato&utm_content=portal_cta#C03', sources=[BCN],
    body='''<h2>El préstamo y los productos</h2><p>El Código Civil chileno describe el comodato como un préstamo gratuito de un bien que debe restituirse después de su uso. Esa definición se refiere al préstamo: revisa de forma separada los productos y servicios que se propongan para tu operación.</p><div class="ct-callout"><p>La propuesta comercial de Marley puede incluir abastecimiento de productos. Montos, frecuencias y demás condiciones se confirman en cada propuesta.</p></div><h2>Antes de firmar, pide claridad sobre</h2><ul><li><strong>La máquina:</strong> modelo, instalación, uso previsto y devolución.</li><li><strong>El abastecimiento:</strong> productos compatibles, frecuencia y condiciones de compra acordadas.</li><li><strong>El soporte:</strong> quién realiza limpieza, mantenimiento y reparaciones, y qué se incluye.</li><li><strong>El contrato:</strong> duración, cobros aplicables y condiciones de término.</li></ul><p>Conserva la propuesta y sus condiciones por escrito. El detalle aplicable depende del acuerdo que se firme.</p>'''),
  dict(slug='comprar-arrendar-o-comodato', tag='Comparación', cats='respuestas guias',
    title='¿Comprar, arrendar o pedir una máquina en comodato?',
    summary='La compra, el arriendo y el comodato distribuyen de forma diferente el pago, el uso del equipo y las responsabilidades. Compáralos con tu consumo, presupuesto y condiciones por escrito.',
    teaser='Tres formas de acceder a una máquina y las preguntas para compararlas.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_comparacion&utm_content=portal_cta#C03', sources=[BCN],
    body='''<h2>Las diferencias, sin letra chica</h2><table class="ct-table"><thead><tr><th scope="col">Alternativa</th><th scope="col">Qué conviene revisar</th></tr></thead><tbody><tr><td>Comprar</td><td>Precio de adquisición, entrega, garantía, mantenimiento y disponibilidad de insumos.</td></tr><tr><td>Arrendar</td><td>Precio por el uso, duración, servicios incluidos y condiciones de término.</td></tr><tr><td>Comodato</td><td>Préstamo de uso y devolución del equipo; revisar por separado los compromisos de productos y servicios.</td></tr></tbody></table><h2>Compara el costo completo</h2><p>Reúne los costos confirmados de equipo, productos, instalación, soporte y término durante el mismo período. Pide una aclaración cuando algún monto no esté definido; no lo trates como cero.</p><div class="ct-callout"><p><strong>Para comparar:</strong> suma los costos conocidos del período y anota aparte los costos o condiciones que faltan confirmar. El resultado no es una cotización.</p></div><h2>Qué alternativa conviene</h2><p>Depende de tu volumen, la capacidad de inversión, la operación y las condiciones concretas. El Código Civil distingue la compraventa, el arrendamiento y el comodato; revisa la documentación que corresponda antes de decidir.</p>'''),
  dict(slug='como-elegir-maquina-cafe', tag='Guía', cats='guias respuestas',
    title='¿Qué máquina de café conviene según mis tazas diarias?',
    summary='La cantidad diaria es un punto de partida. También importa cuántas tazas necesitas en la hora de mayor demanda, quién prepara el café, las bebidas que ofreces y el espacio disponible.',
    teaser='Prepara la información para encontrar un equipo acorde a tu operación.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_equipo&utm_content=portal_cta#C03', sources=[MACHINE],
    body='''<h2>Cuatro datos que ayudan a elegir</h2><ol><li><strong>Volumen y hora punta:</strong> anota el consumo diario y cuánto se concentra en el momento de mayor demanda.</li><li><strong>Tipo de servicio:</strong> define si habrá una persona preparando bebidas o si será de autoservicio.</li><li><strong>Carta:</strong> identifica café solo, bebidas con leche u otras preparaciones.</li><li><strong>Instalación:</strong> mide el espacio y revisa agua, electricidad y limpieza que requiere el equipo.</li></ol><h2>Qué pedir en la ficha del equipo</h2><p>Consulta capacidad recomendada, dimensiones, conexiones, limpieza y soporte. Una ficha técnica externa de Nespresso Professional muestra esos tipos de datos para uno de sus equipos; es solo una referencia de lectura y no corresponde al catálogo de Marley.</p><div class="ct-callout"><p>No existe una regla universal que asigne una máquina a un número fijo de tazas. La recomendación y el modelo disponible se confirman según tu operación.</p></div><h2>Si ya tienes una máquina en mente</h2><p>Parte con esa preferencia y revisa si su capacidad y funcionamiento corresponden a tu negocio. Si todavía no sabes cuál elegir, una orientación con estos datos puede ayudarte a comparar.</p>'''),
  dict(slug='cafe-desayuno-hotel', tag='Caso práctico', cats='casos guias',
    title='¿Cómo organizar el café del desayuno en un hotel?',
    summary='Estima cuántos huéspedes desayunan, cuántas tazas podrían pedir y en qué horario se concentra la atención. Con eso puedes organizar equipos, personas, insumos y reposición.',
    teaser='Un escenario de planificación para el desayuno y sus horas de mayor demanda.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_desayuno_hotel&utm_content=portal_cta#C03', sources=[MINSAL,MACHINE],
    body='''<h2>Un ejemplo para empezar</h2><p>En un escenario hipotético, si esperas <strong>50 huéspedes</strong> y calculas <strong>1,2 tazas por persona</strong>, podrías planificar <strong>60 tazas</strong> para el desayuno. Ajusta ambas cifras con la ocupación y los hábitos observados en tu hotel.</p><div class="ct-callout"><p><strong>Fórmula:</strong> huéspedes que desayunan × tazas estimadas por persona = tazas del servicio. Es un ejemplo, no una previsión real.</p></div><h2>Organiza el servicio en tres momentos</h2><ol><li><strong>Antes:</strong> revisa la previsión de huéspedes, café, leche, vasos o tazas y responsables.</li><li><strong>Durante:</strong> observa la hora de mayor demanda y cómo se ordena el autoservicio o la atención.</li><li><strong>Después:</strong> registra consumo, sobrantes y tareas de limpieza para ajustar la siguiente jornada.</li></ol><h2>Higiene y equipo</h2><p>Consulta los requisitos sanitarios que correspondan a tu establecimiento y las instrucciones del fabricante del equipo. El Reglamento Sanitario de los Alimentos del Ministerio de Salud reúne las condiciones aplicables a la elaboración y manejo de alimentos en Chile.</p>'''),
  dict(slug='como-evitar-quedarse-sin-cafe', tag='Calculadora', cats='calculadoras guias',
    title='¿Cómo evitar quedarse sin café en el negocio?',
    summary='Revisa tu consumo y pide antes de que el stock disponible caiga por debajo de lo que necesitarás mientras llega el siguiente pedido. Agrega una reserva definida para tu operación.',
    teaser='Identifica un punto de pedido con tu consumo y tu plazo de entrega.',
    cta='Ver opciones para mi negocio', target='../../index.html?utm_source=guia_contenido&utm_medium=owned_content&utm_campaign=contenido_reposicion&utm_content=portal_cta#C03', sources=[STOCK],
    body='''<h2>Calcula un punto de reposición</h2><p>Una forma sencilla de planificar es multiplicar el consumo diario promedio por los días que tarda en llegar un pedido y sumar la reserva que decidas mantener.</p><div class="ct-callout"><p><strong>Fórmula:</strong> consumo diario × días hasta recibir el pedido + reserva elegida = punto de reposición orientativo.</p></div>'''+STOCK_CALC+'''<h2>Adapta el resultado a tu negocio</h2><ul><li>Usa la misma unidad para consumo y stock, por ejemplo kilos de café del mismo producto.</li><li>Revisa pedidos que ya vienen en camino y confirma el plazo con tu proveedor.</li><li>Si hay feriados, temporadas o demanda irregular, ajusta la reserva y vuelve a calcular.</li><li>Revisa también fechas de vencimiento y almacenamiento para evitar exceso y desperdicio.</li></ul><p>Este método simplificado supone un consumo promedio y un plazo estimado. La reserva reduce incertidumbre, pero no garantiza que nunca habrá quiebres.</p>''')
]

ORIGIN = 'https://empresas.marleycoffee.cl'
CONTENT_PATH = '/captacion/contenidos/'
SEO_TITLES = {
    'cuanto-cafe-necesita-mi-negocio':'Calcular consumo de café mensual | Marley Coffee',
    'comodato-maquina-de-cafe':'Comodato de máquina de café | Marley Coffee',
    'comprar-arrendar-o-comodato':'Comprar, arrendar o pedir en comodato | Marley Coffee',
    'como-elegir-maquina-cafe':'Elegir máquina de café para un negocio | Marley Coffee',
    'cafe-desayuno-hotel':'Café para desayuno de hotel | Marley Coffee',
    'como-evitar-quedarse-sin-cafe':'Punto de reposición de café | Marley Coffee',
}
SEO_DESCRIPTIONS = {
    'cuanto-cafe-necesita-mi-negocio':'Estima los kilos de café al mes con tus tazas diarias, días de atención y receta. Ajusta los supuestos a tu operación.',
    'comodato-maquina-de-cafe':'Qué significa el comodato de una máquina de café en Chile y qué revisar por separado en una propuesta de productos y servicios.',
    'comprar-arrendar-o-comodato':'Compara compra, arriendo y comodato de una máquina según el costo total, uso del equipo y condiciones acordadas.',
    'como-elegir-maquina-cafe':'Revisa consumo, hora punta, carta, espacio y operación antes de comparar máquinas de café para tu negocio.',
    'cafe-desayuno-hotel':'Organiza el servicio de café del desayuno con una estimación de tazas, demanda punta, equipo e insumos.',
    'como-evitar-quedarse-sin-cafe':'Calcula un punto de reposición orientativo con consumo diario, plazo de entrega y la reserva que definas.',
}
ARTICLE_VISUALS = {
 'cuanto-cafe-necesita-mi-negocio':('CONSUMO','oficina','Máquina y taza de café en un punto de atención.'),
 'comodato-maquina-de-cafe':('COMODATO','hero','Máquina de café y taza durante la preparación.'),
 'comprar-arrendar-o-comodato':('COMPARAR','restaurante','Preparación de café en una barra de restaurante.'),
 'como-elegir-maquina-cafe':('MÁQUINA','cafeteria','Máquinas de café en una cafetería.'),
 'cafe-desayuno-hotel':('DESAYUNO','hotel','Café dispuesto para el servicio de un hotel.'),
 'como-evitar-quedarse-sin-cafe':('REPOSICIÓN','evento','Entrega de café en un servicio de atención.'),
}

def feature_photo(scene, slug, alt):
    desktop=f'../../recursos/escenas/{scene}/poster.webp'
    mobile=f'../../recursos/escenas/{scene}/poster_m.webp'
    return f'''<figure class="ct-feature-bleed ct-scene-{slug}"><picture><source media="(max-width: 560px)" srcset="{mobile}"><img src="{desktop}" width="1440" height="804" alt="{escape(alt, quote=True)}" loading="lazy" decoding="async"></picture></figure>'''

def fact_rows(rows):
    return ''.join(f'<tr><th scope="row">{escape(k)}</th><td class="ct-fact-leader" aria-hidden="true"><span></span></td><td class="ct-fact-value">{escape(v)}</td></tr>' for k,v in rows)
FAQS = {
 'cuanto-cafe-necesita-mi-negocio':[
  ('¿Cómo calculo cuántos kilos de café necesito al mes?','Multiplica las tazas diarias por los días de atención y los gramos de café de la receta; divide el total por 1.000 para obtener kilos.'),
  ('¿Cuántos gramos de café se usan por taza?','Depende de la receta y del método. Usa la dosis que realmente ocupa tu negocio; no hay una cifra única para todas las bebidas.'),
  ('¿El cálculo incluye mermas y cambios de demanda?','No. Es una estimación base y debes ajustar por mermas, recetas, estacionalidad y variaciones de consumo observadas.')],
 'comodato-maquina-de-cafe':[
  ('¿Qué significa comodato en Chile?','El artículo 2174 del Código Civil define el comodato como préstamo gratuito de una especie para usarla y devolverla.'),
  ('¿El comodato incluye café o mantenimiento?','La definición legal del préstamo no fija esos servicios. Revisa productos, mantenimiento y demás condiciones en la propuesta y el contrato.'),
  ('¿Qué debo revisar antes de firmar?','Confirma por escrito el equipo, uso, devolución, productos, soporte, duración, cobros aplicables y término del acuerdo.')],
 'comprar-arrendar-o-comodato':[
  ('¿Qué diferencia hay entre arrendar y recibir en comodato?','En el arriendo se pacta el uso a cambio de una renta; el comodato definido en el artículo 2174 es gratuito y exige restituir la especie.'),
  ('¿Cómo comparo el costo de las tres alternativas?','Compara los costos confirmados durante el mismo período y anota aparte los montos, servicios o responsabilidades aún no definidos.'),
  ('¿Cuál opción le conviene más a mi negocio?','Depende del volumen, presupuesto, operación y condiciones por escrito; no hay una opción universalmente mejor.')],
 'como-elegir-maquina-cafe':[
  ('¿Cuántas tazas por día debe preparar una máquina comercial?','No hay un número universal. Evalúa también la hora punta, el tipo de bebida, la forma de servicio y la ficha del modelo.'),
  ('¿Qué debo medir antes de elegir una máquina?','Registra tazas diarias y en hora punta; revisa además carta, espacio, conexiones, limpieza y quién operará el equipo.'),
  ('¿Las máquinas de esta guía son modelos Marley?','No. La ficha citada es una referencia técnica externa; disponibilidad, compatibilidad y recomendación deben confirmarse con Marley.')],
 'cafe-desayuno-hotel':[
  ('¿Cómo estimo el café para un desayuno de hotel?','Multiplica los huéspedes que desayunan por las tazas estimadas por persona y contrasta el resultado con el consumo observado.'),
  ('¿Cuántas tazas toma cada huésped?','La guía no atribuye un promedio real: el ejemplo de 1,2 tazas es hipotético y debe reemplazarse con registros del hotel.'),
  ('¿Qué debo planificar además del café?','Considera la hora punta, responsables, equipo, tazas, leche, reposición y las prácticas de higiene aplicables al establecimiento.')],
 'como-evitar-quedarse-sin-cafe':[
  ('¿Cómo se calcula el punto de reposición de café?','Multiplica el consumo diario promedio por los días que tarda el pedido y suma la reserva definida para tu operación.'),
  ('¿Qué pasa si el consumo cambia mucho?','Recalcula con promedios por temporada o por día y ajusta la reserva según tus registros y el plazo confirmado.'),
  ('¿Este cálculo garantiza que no se agote el café?','No. Es un método orientativo que supone consumo y plazo promedio; pedidos demorados o demanda variable pueden cambiar el resultado.')],
}
ASSUMPTIONS = {
 'cuanto-cafe-necesita-mi-negocio':[('Ejemplo editable','80 tazas × 26 días × 9 g = 18,72 kg; son valores ilustrativos, no datos de Marley.'),('Alcance','No incluye mermas, inventario inicial, pedidos en tránsito ni variación de demanda.'),('Unidad','Se supone una dosis de café por taza; si hay recetas distintas, calcula cada una por separado.')],
 'comodato-maquina-de-cafe':[('Base legal','La definición citada corresponde al Código Civil chileno, art. 2174; el caso concreto depende del acuerdo.'),('Propuesta comercial','No se presume que productos, instalación, mantenimiento o soporte estén incluidos.'),('Decisión','La tabla orienta una revisión documental; no reemplaza las condiciones del contrato.')],
 'comprar-arrendar-o-comodato':[('Período','Los costos solo se pueden comparar si usan el mismo horizonte de tiempo.'),('Datos comerciales','No se publican precios, cargos ni servicios de Marley; solicita que se definan en la propuesta.'),('Alcance legal','La tabla es informativa y no determina la clasificación de un contrato específico.')],
 'como-elegir-maquina-cafe':[('Capacidad','No se asigna un volumen a un modelo sin ficha vigente y validación del proveedor.'),('Referencia','La ficha Nespresso citada es externa y no representa el catálogo Marley.'),('Instalación','Conexiones, limpieza, espacio y soporte deben confirmarse para el local y el modelo.')],
 'cafe-desayuno-hotel':[('Escenario','50 huéspedes y 1,2 tazas por persona son supuestos didácticos, no datos observados.'),('Demanda','La ocupación, asistencia al desayuno y hora punta varían por hotel y temporada.'),('Sanidad','El establecimiento debe revisar las reglas y procedimientos que le sean aplicables.')],
 'como-evitar-quedarse-sin-cafe':[('Ejemplo editable','1 kg/día × 3 días + 2 kg de reserva = 5 kg; usa tus propios datos.'),('Supuesto','El cálculo supone consumo diario promedio estable y plazo de entrega conocido.'),('Límite','No incorpora pedidos en camino ni garantiza disponibilidad ante retrasos o picos de demanda.')],
}

def jsonld(title, description, canonical, surface, article=False, faqs=None):
    blocks = [{'@context':'https://schema.org','@type':'Organization','name':'Marley Coffee Empresas','url':ORIGIN+'/'},
      {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[
       {'@type':'ListItem','position':1,'name':'Inicio','item':ORIGIN+'/'},
       {'@type':'ListItem','position':2,'name':'Contenidos','item':ORIGIN+CONTENT_PATH+'index.html'},
       {'@type':'ListItem','position':3,'name':title,'item':canonical}]}]
    if article:
        blocks.append({'@context':'https://schema.org','@type':'Article','headline':title,'description':description,'inLanguage':'es-CL','mainEntityOfPage':canonical,'publisher':{'@type':'Organization','name':'Marley Coffee Empresas'}})
    if faqs:
        blocks.append({'@context':'https://schema.org','@type':'FAQPage','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in faqs]})
    return ''.join(f'<script type="application/ld+json">{json.dumps(x,ensure_ascii=False).replace("</","<\\/")}</script>' for x in blocks)

def header(title, description, surface, body_class='', canonical=None, schema=''):
    canonical = canonical or ORIGIN+CONTENT_PATH+'index.html'
    return f'''<!doctype html>
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0B0B0C"><title>{escape(title)}</title><meta name="description" content="{escape(description, quote=True)}"><link rel="canonical" href="{canonical}"><link rel="icon" href="../../recursos/marca/logo.webp"><link rel="stylesheet" href="../marca/negro-marley.css"><link rel="stylesheet" href="contenidos.css">{schema}</head>
<body class="nm {body_class}" data-surface="{escape(surface, quote=True)}"><a class="nm-skip" href="#contenido">Saltar al contenido</a>
<header class="ct-barra"><div class="nm-wrap"><a href="index.html" class="ct-brand"><span class="ld-logo" aria-hidden="true"></span><span>Empresas</span></a><nav aria-label="Navegación principal"><a class="ct-head-link" href="../soluciones/index.html">Soluciones</a><a class="ct-head-link" href="../../index.html#C03" data-attribution-handoff data-screen="C03" data-surface="contenido-nav">Portal</a></nav></div></header>'''

FOOTER = '''<footer class="ct-footer"><div class="nm-wrap"><p>Marley Coffee Empresas · Ideas para tu negocio</p><p>Las condiciones comerciales se confirman en tu propuesta.</p></div></footer><script src="contenidos.js" defer></script></body></html>'''

def cards(items=None):
    output=[]
    for p in (items or PAGES):
        output.append(f'''<a class="ct-card" data-categories="{p['cats']}" href="{p['slug']}.html"><span class="ct-card-kind">{escape(p['tag'])}</span><h3>{escape(p['title'])}</h3><p>{escape(p['teaser'])}</p><span class="ct-card-arrow">Leer guía <span aria-hidden="true">→</span></span></a>''')
    return '\n'.join(output)

def tabpanel(category, title, subset, selected=False):
    return f'<section id="panel-{category}" role="tabpanel" aria-labelledby="tab-{category}" tabindex="0"{"" if selected else " hidden"}><h3 class="ct-panel-title">{title}</h3><div class="ct-grid">'+cards(subset)+'</div></section>'

def home():
    title='Guías de café para negocios | Marley Coffee'
    summary='Respuestas, guías y calculadoras para planificar el café de tu negocio. Prototipo; dominio B2B pendiente de confirmación.'
    canonical=ORIGIN+CONTENT_PATH+'index.html'
    tabs=''.join(f'<button id="tab-{k}" class="ct-tab" role="tab" type="button" aria-controls="panel-{k}" aria-selected="{str(i==0).lower()}" tabindex="{0 if i==0 else -1}">{label}</button>' for i,(k,label) in enumerate([('respuestas','Respuestas'),('guias','Guías'),('calculadoras','Calculadoras'),('casos','Casos')]))
    panels=tabpanel('respuestas','Respuestas directas', [PAGES[1],PAGES[2]], True)+tabpanel('guias','Guías para tu operación', [PAGES[0],PAGES[3],PAGES[4],PAGES[5]])+tabpanel('calculadoras','Calcula con tus propios datos', [PAGES[0],PAGES[5]])+tabpanel('casos','Escenarios de planificación', [PAGES[4]])
    return header(title,summary,'contenido-hub',canonical=canonical,schema=jsonld(title,summary,canonical,'contenido-hub'))+f'''<main id="contenido"><section class="ct-hero"><picture><source media="(max-width: 560px)" srcset="../../recursos/escenas/hero/poster_m.webp"><img src="../../recursos/escenas/hero/poster.webp" width="1440" height="804" alt="" fetchpriority="high"></picture><div class="nm-wrap"><div class="ct-hero-copy"><p class="nm-eyebrow">Marley Coffee · Empresas</p><span class="ct-display-word" aria-hidden="true">CAFÉ</span><h1 class="nm-h1">¿Cómo planificar el café para tu negocio?</h1><p class="nm-lead">Respuestas prácticas para elegir tu equipo, planificar el consumo y mantener tu servicio en marcha.</p><a href="#guias" class="nm-btn">Explorar contenidos <span aria-hidden="true">→</span></a></div></div></section>
<section class="ct-hub-answer nm-wrap"><div class="ct-answer" aria-label="Respuesta breve"><span class="ct-kicker">En breve</span><p>Para organizar el café de tu negocio, estima el consumo, compara el equipo y define cómo repondrás. Las guías muestran fórmulas y supuestos para que puedas usar tus propios datos.</p></div></section>
<section class="ct-browse nm-wrap" id="guias"><div class="ct-browse-head"><div><p class="nm-eyebrow">Empieza por tu pregunta</p><h2 class="nm-h2">Encuentra una respuesta.</h2></div><p class="nm-p">Seis piezas para comparar opciones, planificar consumo y organizar el servicio.</p></div><div class="ct-tabs" role="tablist" aria-label="Tipos de contenido">{tabs}</div>{panels}</section></main>'''+FOOTER

def article(p, i):
    related=[PAGES[(i+1)%len(PAGES)],PAGES[(i+2)%len(PAGES)]]
    source_html=''.join(f'<tr><th scope="row">{escape(name)}</th><td><a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(url)}</a></td><td>Consultado el {DATE}.</td></tr>' for name,url in p['sources'])
    rel_html=''.join(f'<li><a href="{x["slug"]}.html">{escape(x["title"])}</a></li>' for x in related)
    faq_html=''.join(f'<details class="ct-faq"><summary class="ct-disclosure-toggle">{escape(q)}</summary><p>{escape(a)}</p></details>' for q,a in FAQS[p['slug']])
    assumptions=fact_rows(ASSUMPTIONS[p['slug']])
    seo_title=SEO_TITLES[p['slug']]
    seo_description=SEO_DESCRIPTIONS[p['slug']]
    canonical=ORIGIN+CONTENT_PATH+p['slug']+'.html'
    schema=jsonld(p['title'],seo_description,canonical,'contenido-'+p['slug'],True,FAQS[p['slug']])
    word,scene,alt=ARTICLE_VISUALS[p['slug']]
    body=p['body']
    comparison_sheet='''<dl class="ct-fact-sheet"><div class="ct-fact-row"><dt>Comprar</dt><dd>Precio de adquisición, entrega, garantía, mantenimiento y disponibilidad de insumos.</dd></div><div class="ct-fact-row"><dt>Arrendar</dt><dd>Precio por el uso, duración, servicios incluidos y condiciones de término.</dd></div><div class="ct-fact-row"><dt>Comodato</dt><dd>Préstamo de uso y devolución; revisa por separado los compromisos de productos y servicios.</dd></div></dl>'''
    if p['slug']=='comprar-arrendar-o-comodato':
        body=re.sub(r'<table class="ct-table"><thead><tr><th scope="col">Alternativa</th>.*?</table>',comparison_sheet,body,count=1,flags=re.S)
    body=re.sub(r'<div class="ct-callout">(?=<p><strong>Fórmula:)', '<div class="ct-callout ct-formula">', body)
    photo=feature_photo(scene,p['slug'],alt)
    return header(seo_title,seo_description,'contenido-'+p['slug'],'article',canonical,schema)+f'''<main id="contenido" class="ct-article nm-wrap"><a class="ct-back" href="index.html">← Hub de contenidos</a><article><header class="ct-editorial-head"><p class="nm-eyebrow">{escape(p['tag'])} · Marley Coffee Empresas</p><span class="ct-display-word" aria-hidden="true">{escape(word)}</span><h1 class="nm-h1">{escape(p['title'])}</h1><span class="ct-meta">Actualizado el {DATE}</span></header>{photo}<section class="ct-answer" aria-label="Respuesta breve"><span class="ct-kicker">En breve</span><p>{escape(p['summary'])}</p></section><div class="ct-content">{body}<section class="ct-assumptions" aria-labelledby="supuestos"><h2 id="supuestos">Supuestos y límites</h2><div class="ct-table-wrap"><table class="ct-table ct-fact-table"><tbody>{assumptions}</tbody></table></div></section><section class="ct-faqs" aria-labelledby="preguntas"><h2 id="preguntas">Preguntas frecuentes</h2>{faq_html}</section><section class="ct-sources" aria-labelledby="fuentes"><h2 id="fuentes">Fuentes y fecha de consulta</h2><div class="ct-table-wrap"><table class="ct-table"><thead><tr><th scope="col">Fuente</th><th scope="col">URL</th><th scope="col">Fecha de consulta</th></tr></thead><tbody>{source_html}</tbody></table></div></section><section class="ct-related" aria-labelledby="relacionadas"><h2 id="relacionadas">Preguntas relacionadas</h2><ul>{rel_html}</ul><p><a href="../soluciones/index.html">Ver soluciones por tipo de negocio</a></p></section></div><aside class="ct-next"><h2>Sigamos con tu negocio.</h2><p>Revisa las opciones disponibles en el portal y comparte lo que necesita tu operación.</p><a class="nm-btn" href="{p['target']}" data-attribution-handoff data-screen="C03" data-surface="contenido-{p['slug']}">{escape(p['cta'])} <span aria-hidden="true">→</span></a></aside></article></main>'''+FOOTER

if __name__ == '__main__':
    (HERE/'index.html').write_text(home(),encoding='utf-8')
    for i,page in enumerate(PAGES):
        (HERE/(page['slug']+'.html')).write_text(article(page,i),encoding='utf-8')
    print(f'Generadas {len(PAGES)} guías y un índice en {HERE}')
