"""Genera siete páginas de solución y el índice. Solo escribe en captacion/soluciones."""
from pathlib import Path
from html import escape
import csv
import json
import unicodedata
from collections import Counter

HERE = Path(__file__).resolve().parent
ORIGIN = 'https://empresas.marleycoffee.cl'
BASE = ORIGIN + '/captacion/soluciones/'
CONTENT = ORIGIN + '/captacion/contenidos/'
DATE = '10 de noviembre de 2026'
KEYWORD_FILE = HERE.parents[2] / 'ecosistema_captacion_10nov' / 'CLASIFICACION_FRASES_B2B_09NOV.csv'

def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',value.casefold().strip()) if not unicodedata.combining(c))

EXPECTED_CLASS_COUNTS = {'coherente':83,'fuera':7,'investigar':2,'revision':5}

def route_phrase(phrase):
    key=norm(phrase)
    exact={'coffee break para oficinas':'oficinas','coffee break empresas':'eventos-catering','servicio de coffee break':'eventos-catering'}
    if key in exact:
        return exact[key]
    rules=[
      (('evento','catering','coffee break'),'eventos-catering'),
      (('hotel','hostal'),'hoteles'),
      (('oficina','oficinas'),'oficinas'),
      (('restaurante','restaurantes'),'restaurantes'),
      (('cafeteria',),'cafeterias'),
      (('panaderia','panaderias'),'panaderias'),
      (('minimarket','conveniencia','tienda'),'conveniencia'),
    ]
    for terms,slug in rules:
        if any(term in key for term in terms):
            return slug
    return 'index'

PAGES = [
 dict(slug='restaurantes', buyer='Restaurantes', title='Café para restaurantes: compara equipo y servicio',
      seo_title='Café para restaurantes | Marley Coffee',
      description='Compara opciones de café para restaurantes según carta, consumo en hora punta, espacio y responsabilidades acordadas.',
      answer='Para evaluar una solución de café para un restaurante, parte por la carta, las tazas en hora punta, el espacio y quién prepara cada bebida. Con esos datos puedes comparar equipos, productos y responsabilidades que se confirmen por escrito para tu operación.',
      how=[('1. Describe el servicio','Indica las bebidas que ofreces, el flujo esperado y cómo se concentra la demanda.'),('2. Reúne datos de operación','Registra consumo diario, hora punta, espacio, conexiones y quién operará el equipo.'),('3. Compara la propuesta','Revisa por separado equipo, productos, instalación, limpieza, soporte, costos y término del acuerdo.')],
      faqs=[('¿Qué máquina de café conviene para un restaurante?','Depende de la carta, la hora punta, el espacio y quién prepara las bebidas. Compara esos datos con la ficha del modelo disponible.'),('¿Cuánto café necesita mi restaurante?','Estima tazas diarias × días de atención × gramos de tu receta y divide por 1.000 para obtener kilos orientativos.'),('¿Qué incluye un comodato de máquina?','No presupongas productos, instalación o mantenimiento. Pide que cada compromiso y cobro aplicable aparezca en la propuesta.')],
      guides=['como-elegir-maquina-cafe','cuanto-cafe-necesita-mi-negocio','comodato-maquina-de-cafe'],
      compare=[('Carta y volumen','Bebidas, tazas por día y hora punta.'),('Operación','Espacio, conexiones, limpieza y personas responsables.'),('Condiciones','Productos, soporte, costos y término por escrito.')]),
 dict(slug='hoteles', buyer='Hoteles', title='Café para hoteles: planifica desayuno y horas punta',
      seo_title='Café para hoteles | Marley Coffee',
      description='Planifica el café de un hotel con ocupación, horarios de desayuno, consumo observado, reposición y necesidades del equipo.',
      answer='Para planificar el café de un hotel, estima cuántos huéspedes desayunan, en qué horario se concentra el servicio y qué consumo registras. Después revisa equipo, reposición, responsables y condiciones específicas en una propuesta escrita.',
      how=[('1. Define los momentos de servicio','Distingue desayuno, reuniones y otros puntos donde se sirven bebidas.'),('2. Estima la demanda','Usa ocupación y consumo observado; no conviertas un ejemplo hipotético en una previsión.'),('3. Revisa operación e higiene','Confirma espacio, personal, limpieza, reposición e instrucciones del fabricante y reglas aplicables.')],
      faqs=[('¿Cómo calculo el café para el desayuno de un hotel?','Multiplica huéspedes que desayunan por tazas estimadas por persona y contrasta con los registros reales del establecimiento.'),('¿La máquina puede atender una hora punta?','Pide la capacidad del modelo y compárala con tu volumen concentrado, la carta y el flujo del desayuno.'),('¿El servicio considera café para reuniones?','Detalla cada punto de servicio y su demanda; disponibilidad y condiciones se confirman en la propuesta.')],
      guides=['cafe-desayuno-hotel','como-evitar-quedarse-sin-cafe','como-elegir-maquina-cafe'],
      compare=[('Servicio','Desayuno, reuniones y puntos de autoservicio.'),('Demanda','Ocupación, horario punta y consumo observado.'),('Operación','Equipo, insumos, reposición, limpieza y responsables.')]),
 dict(slug='cafeterias', buyer='Cafeterías', title='Café para cafeterías: elige según carta y ritmo de atención',
      seo_title='Café para cafeterías | Marley Coffee',
      description='Evalúa café y equipo para una cafetería con su carta, ritmo de preparación, consumo diario, espacio y condiciones acordadas.',
      answer='Para elegir una solución de café para una cafetería, revisa primero la carta, las recetas, el ritmo de preparación y el espacio disponible. El consumo y las fichas del equipo te ayudan a comparar alternativas; la compatibilidad y las condiciones deben confirmarse para tu local.',
      how=[('1. Registra recetas y dosis','Separa las bebidas y anota la dosis real que ocupa cada receta.'),('2. Revisa capacidad y flujo','Considera la demanda por hora, quién prepara las bebidas, espacio, conexiones y limpieza.'),('3. Confirma compatibilidad','Contrasta los productos y la ficha del equipo con tu operación antes de acordar una propuesta.')],
      faqs=[('¿Qué máquina necesita una cafetería pequeña?','No existe un tamaño universal. Compara carta, tazas en hora punta, espacio, conexiones y operación con la ficha del equipo.'),('¿Qué café en grano sirve para mi cafetería?','Define el perfil y método que busca tu carta; confirma disponibilidad y compatibilidad con el proveedor.'),('¿Cómo estimo el consumo mensual?','Calcula cada receta con tus tazas diarias, días de atención y gramos por taza; luego suma los resultados.')],
      guides=['como-elegir-maquina-cafe','cuanto-cafe-necesita-mi-negocio','comprar-arrendar-o-comodato'],
      compare=[('Carta','Bebidas, receta y método de preparación.'),('Ritmo','Tazas al día y concentración por hora.'),('Local','Espacio, conexiones, limpieza y responsables.')]),
 dict(slug='oficinas', buyer='Oficinas', title='Café para oficinas: organiza consumo y autoservicio',
      seo_title='Café para oficinas | Marley Coffee',
      description='Organiza el café de una oficina con consumo estimado, zonas de atención, modalidad de servicio, espacio y reposición.',
      answer='Para organizar café en una oficina, estima el consumo por jornada, identifica dónde se servirá y decide cómo las personas prepararán sus bebidas. Luego compara equipo, productos, limpieza y reposición con las necesidades del espacio y las condiciones que se acuerden.',
      how=[('1. Identifica las zonas','Anota cuántas personas usan cada punto de café y en qué momentos.'),('2. Define el servicio','Compara atención por una persona y autoservicio; revisa espacio, conexiones y tareas de limpieza.'),('3. Planifica reposición','Calcula consumo con tus registros y confirma con el proveedor plazos y disponibilidad.')],
      faqs=[('¿Qué cafetera conviene para una oficina pequeña?','Evalúa usuarios, consumo en hora punta, espacio, bebidas y quién se hace cargo de la limpieza.'),('¿Cuántas máquinas necesita una oficina?','Depende de la distribución y los tiempos de espera observados; no hay una proporción universal.'),('¿Qué incluye el comodato de una máquina para oficina?','El comodato legal es un préstamo gratuito de uso. Productos y servicios adicionales deben constar por separado en la propuesta.')],
      guides=['como-elegir-maquina-cafe','comodato-maquina-de-cafe','como-evitar-quedarse-sin-cafe'],
      compare=[('Usuarios','Personas por zona y horarios de mayor uso.'),('Servicio','Autoservicio o atención; bebidas que se preparan.'),('Operación','Espacio, limpieza, insumos y reposición.')]),
 dict(slug='eventos-catering', buyer='Eventos y catering', title='Café para eventos y catering: planifica el servicio',
      seo_title='Café para eventos y catering | Marley Coffee',
      description='Planifica café para eventos según asistentes, duración, formato de servicio, picos de demanda, equipo e insumos.',
      answer='Para planificar café en un evento, parte por asistentes, duración, formato de servicio y momentos de mayor demanda. Esa estimación ayuda a organizar equipo, personas, insumos y reposición, que deben confirmarse para cada lugar y propuesta.',
      how=[('1. Describe el evento','Indica asistentes, duración, horarios, lugar y bebidas previstas.'),('2. Calcula el flujo','Estima tazas por tramo horario y considera esperas, personal y autoservicio.'),('3. Confirma logística','Revisa equipo, electricidad, agua, montaje, limpieza, transporte e insumos con quienes proveen el servicio.')],
      faqs=[('¿Cuánto café debo calcular para un evento?','Usa asistentes esperados, tazas estimadas y registros de eventos similares; separa el cálculo por horarios si cambia la demanda.'),('¿Qué necesito para un coffee break de empresa?','Define horario, asistentes, espacio, servicio, bebidas, equipo y responsables; confirma disponibilidad y costos en una propuesta.'),('¿Se puede adaptar el servicio al lugar?','Describe conexiones, acceso y restricciones del recinto para revisar qué opciones son viables.')],
      guides=['cuanto-cafe-necesita-mi-negocio','como-elegir-maquina-cafe','como-evitar-quedarse-sin-cafe'],
      compare=[('Asistencia','Invitados, horarios y duración.'),('Formato','Autoservicio, atención y ritmo de servicio.'),('Logística','Lugar, conexiones, montaje, insumos y reposición.')]),
 dict(slug='conveniencia', buyer='Conveniencia', title='Café para minimarkets y tiendas de conveniencia',
      seo_title='Café para tiendas de conveniencia | Marley Coffee',
      description='Evalúa café en una tienda de conveniencia según espacio, flujo de clientes, modalidad de preparación y reposición.',
      answer='Para evaluar café en una tienda de conveniencia, revisa espacio, flujo de clientes, bebidas que ofrecerás y quién se hará cargo del equipo. Compara capacidad, limpieza, insumos y reposición con la operación del local y confirma los términos por escrito.',
      how=[('1. Mapea el punto de venta','Mide el espacio, tránsito, conexiones y visibilidad del área de café.'),('2. Elige el formato de atención','Define preparación asistida o autoservicio y las tareas de limpieza y reposición.'),('3. Ajusta al flujo','Estima consumo por horario y revisa que el equipo y los insumos correspondan al local.')],
      faqs=[('¿Qué máquina de café sirve para un minimarket?','Depende del espacio, el flujo, el menú y la forma de atención; compara esos datos con la ficha del modelo.'),('¿Cómo organizo la reposición de café?','Multiplica el consumo diario promedio por el plazo confirmado y suma la reserva que definas.'),('¿Qué requisitos de instalación debo revisar?','Consulta conexiones, espacio, limpieza, seguridad del área y las instrucciones del fabricante.')],
      guides=['como-elegir-maquina-cafe','como-evitar-quedarse-sin-cafe','comprar-arrendar-o-comodato'],
      compare=[('Local','Espacio, tránsito, conexiones y seguridad.'),('Preparación','Autoservicio o atención y bebidas previstas.'),('Abastecimiento','Consumo, plazo confirmado y reserva.')]),
 dict(slug='panaderias', buyer='Panaderías', title='Café para panaderías: ajusta equipo y consumo al local',
      seo_title='Café para panaderías | Marley Coffee',
      description='Compara opciones de café para una panadería según carta, flujo por horario, espacio, equipo y necesidades de reposición.',
      answer='Para incorporar café en una panadería, define qué bebidas ofrecerás, cuándo se concentra el flujo y quién preparará el servicio. Con el espacio y el consumo estimado puedes comparar equipos y reposición, sujetos a compatibilidad y condiciones confirmadas.',
      how=[('1. Define la oferta','Elige bebidas y recetas que tengan sentido para tu vitrina y clientes.'),('2. Revisa el flujo','Observa la demanda por horario para estimar la carga de trabajo.'),('3. Comprueba el espacio','Considera equipo, conexiones, limpieza, insumos y coordinación con la venta de productos horneados.')],
      faqs=[('¿Qué cafetera necesita una panadería?','Depende de la carta, el espacio, las tazas en hora punta y quién prepara las bebidas.'),('¿Cómo calculo los kilos de café para mi panadería?','Multiplica tazas por día por días abiertos y gramos de tu receta, y divide el resultado por 1.000.'),('¿Puedo combinar panadería y autoservicio de café?','Revisa espacio, flujo, higiene y responsabilidades de limpieza antes de definir el formato.')],
      guides=['como-elegir-maquina-cafe','cuanto-cafe-necesita-mi-negocio','comprar-arrendar-o-comodato'],
      compare=[('Oferta','Bebidas, recetas y relación con la vitrina.'),('Flujo','Demanda por horario y personas responsables.'),('Espacio','Equipo, conexiones, higiene y reposición.')]),
]

SOLUTION_VISUALS = {
 'restaurantes':dict(h1='¿Qué café y máquina convienen para un restaurante?',word='RESTAURANTES',machine='bar.webp',machine_width=398,machine_height=450,photo='restaurante/poster.webp',mobile='restaurante/poster_m.webp',alt='Preparación de café en una barra de restaurante.'),
 'hoteles':dict(h1='¿Cómo organizar el café para un hotel?',word='HOTELES',machine='oficina.webp',machine_width=444,machine_height=442,photo='hotel/poster.webp',mobile='hotel/poster_m.webp',alt='Café dispuesto para el servicio de un hotel.'),
 'cafeterias':dict(h1='¿Qué máquina y café necesita una cafetería?',word='CAFETERÍAS',machine='bar.webp',machine_width=398,machine_height=450,photo='cafeteria/poster.webp',mobile='cafeteria/poster_m.webp',alt='Máquinas de café en una cafetería.'),
 'oficinas':dict(h1='¿Cómo elegir café y equipo para una oficina?',word='OFICINAS',machine='oficina.webp',machine_width=444,machine_height=442,photo='oficina/poster.webp',mobile='oficina/poster_m.webp',alt='Máquina y taza de café en un punto de oficina.'),
 'eventos-catering':dict(h1='¿Cómo planificar café para eventos y catering?',word='EVENTOS',machine='cafe_al_paso.webp',machine_width=395,machine_height=532,photo='evento/poster.webp',mobile='evento/poster_m.webp',alt='Entrega de café durante un servicio de evento.'),
 'conveniencia':dict(h1='¿Cómo ofrecer café en una tienda de conveniencia?',word='CONVENIENCIA',machine='cafe_al_paso.webp',machine_width=395,machine_height=532,photo='conveniencia-autoatencion-concept.jpg',width=1536,height=1024,alt='Zona de autoservicio de café en una tienda de conveniencia.'),
 'panaderias':dict(h1='¿Qué solución de café necesita una panadería?',word='PANADERÍAS',machine='bar.webp',machine_width=398,machine_height=450,photo='panaderia-barra-concept.jpg',width=1536,height=1024,alt='Barra de café dentro de una panadería.'),
}
INDEX_VISUAL=dict(h1='¿Qué solución de café necesita tu negocio?',word='NEGOCIOS',machine='oficina.webp',machine_width=444,machine_height=442,photo='hero/poster.webp',mobile='hero/poster_m.webp',alt='Máquina y taza de café en servicio.')

def scene_photo(visual, slug):
    photo=f'../../recursos/escenas/{visual["photo"]}'
    mobile=visual.get('mobile')
    source=f'<source media="(max-width: 560px)" srcset="../../recursos/escenas/{mobile}">' if mobile else ''
    width=visual.get('width',1440)
    height=visual.get('height',804)
    return f'''<figure class="ct-feature-bleed ct-scene-{slug}"><picture>{source}<img src="{photo}" width="{width}" height="{height}" alt="{escape(visual['alt'],quote=True)}" loading="lazy" decoding="async"></picture></figure>'''

def fact_rows(rows):
    return ''.join(f'<tr><th scope="row">{escape(k)}</th><td class="ct-fact-leader" aria-hidden="true"><span></span></td><td class="ct-fact-value">{escape(v)}</td></tr>' for k,v in rows)

def keyword_groups():
    if not KEYWORD_FILE.exists():
        raise FileNotFoundError(f'Falta la fuente de frases: {KEYWORD_FILE}')
    rows = list(csv.DictReader(KEYWORD_FILE.open(encoding='utf-8-sig', newline='')))
    classes=Counter(row['clase'].strip().casefold() for row in rows)
    if len(rows)!=97 or dict(classes)!=EXPECTED_CLASS_COUNTS:
        raise ValueError(f'Clasificación inesperada en {KEYWORD_FILE}: {len(rows)} filas, {dict(classes)}')
    groups={'index':{'url':BASE+'index.html','intent':'Intención comercial genérica B2B, sin comprador específico','phrases':[]}}
    groups.update({p['slug']:{'url':BASE+p['slug']+'.html','intent':f'Intención comercial para {p["buyer"].lower()}','phrases':[]} for p in PAGES})
    unassigned={name:[] for name in ('fuera','investigar','revision')}
    seen=set()
    for row in rows:
        phrase = row['frase'].strip()
        key=norm(phrase)
        if key in seen:
            raise ValueError(f'Frase repetida en la clasificación: {phrase!r}')
        seen.add(key)
        category=row['clase'].strip().casefold()
        if category=='coherente':
            groups[route_phrase(phrase)]['phrases'].append(phrase)
        elif category in unassigned:
            unassigned[category].append({'phrase':phrase,'reason':row['motivo'].strip()})
        else:
            raise ValueError(f'Clase desconocida: {category!r} para {phrase!r}')
    assigned=[phrase for group in groups.values() for phrase in group['phrases']]
    if len(assigned)!=83 or len({norm(x) for x in assigned})!=83:
        raise ValueError('Hay palabras clave duplicadas entre páginas')
    return {
      'source':{'file':'ecosistema_captacion_10nov/CLASIFICACION_FRASES_B2B_09NOV.csv','classification_date':'2026-11-09','consulted_date':'2026-11-11'},
      'counts':{'total':len(rows),**dict(classes)},
      'groups':groups,
      'not_assigned_to_commercial_pages':unassigned,
      'routing_note':'Las 83 frases coherentes se asignan una sola vez. Los modificadores de comprador definen la URL; las frases sin comprador específico quedan en el índice de soluciones. Investigar y revision no se asignan a páginas comerciales.'
    }

def schema(title, description, canonical, slug=None, faqs=None, schema_name=None):
    visible_name=schema_name or title
    crumbs = [{'@type':'ListItem','position':1,'name':'Inicio','item':ORIGIN+'/'},
              {'@type':'ListItem','position':2,'name':'Soluciones','item':BASE+'index.html'}]
    if slug:
        crumbs.append({'@type':'ListItem','position':3,'name':visible_name,'item':canonical})
    data = [
      {'@context':'https://schema.org','@type':'Organization','name':'Marley Coffee Empresas','url':ORIGIN+'/'},
      {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':crumbs},
    ]
    if slug:
        data.append({'@context':'https://schema.org','@type':'Article','headline':visible_name,'description':description,'inLanguage':'es-CL','mainEntityOfPage':canonical,'publisher':{'@type':'Organization','name':'Marley Coffee Empresas'}})
        data.append({'@context':'https://schema.org','@type':'FAQPage','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in faqs]})
    return ''.join('<script type="application/ld+json">'+json.dumps(x,ensure_ascii=False).replace('</','<\\/')+'</script>' for x in data)

def head(title, description, canonical, body_class, slug=None, faqs=None, schema_name=None):
    ld = schema(title,description,canonical,slug,faqs,schema_name)
    return f'''<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0B0B0C"><title>{escape(title)}</title><meta name="description" content="{escape(description,quote=True)}"><link rel="canonical" href="{canonical}"><link rel="stylesheet" href="../marca/negro-marley.css"><link rel="stylesheet" href="../contenidos/contenidos.css"><link rel="stylesheet" href="soluciones.css">{ld}</head><body class="nm {body_class}" data-surface="{escape(body_class,quote=True)}"><a class="nm-skip" href="#contenido">Saltar al contenido</a><header class="ct-barra"><div class="nm-wrap"><a href="index.html" class="ct-brand"><span class="ld-logo" aria-hidden="true"></span><span>Empresas</span></a><nav aria-label="Navegación principal"><a class="ct-head-link" href="../contenidos/index.html">Contenidos</a><a class="ct-head-link" href="index.html">Soluciones</a></nav></div></header>'''

FOOTER = f'''<footer class="ct-footer"><div class="nm-wrap"><p>Marley Coffee Empresas · Contenido de orientación.</p><p>Dominio de producción pendiente de confirmación.</p></div></footer><script src="../contenidos/contenidos.js" defer></script></body></html>'''

def render_page(p, groups):
    canonical = BASE+p['slug']+'.html'
    visual=SOLUTION_VISUALS[p['slug']]
    how = ''.join(f'<li><strong>{escape(heading[3:] if len(heading)>2 and heading[0].isdigit() and heading[1:3]==". " else heading)}:</strong> {escape(body)}</li>' for heading,body in p['how'])
    table = fact_rows(p['compare'])
    guides = ''.join(f'<li><a href="../contenidos/{slug}.html">{escape(next(g["title"] for g in CONTENT_GUIDES if g["slug"]==slug))}</a></li>' for slug in p['guides'])
    faq = ''.join(f'<details class="ct-faq"><summary class="ct-disclosure-toggle">{escape(q)}</summary><p>{escape(a)}</p></details>' for q,a in p['faqs'])
    legal_note = ('<p class="sol-source"><strong>Referencia legal:</strong> <a href="https://www.bcn.cl/leychile/navegar?idNorma=172986" target="_blank" rel="noopener noreferrer">Código Civil de Chile, artículo 2174</a> · consultado el '+DATE+'.</p>') if p['slug']=='oficinas' else ''
    cta = f'../../index.html?utm_source=solucion_organica&utm_medium=owned_content&utm_campaign=solucion_{p["slug"]}&utm_content=portal_cta#C03'
    photo=scene_photo(visual,p['slug'])
    machine=f'<img class="sol-machine" src="../../recursos/maquinas/{visual["machine"]}" width="{visual["machine_width"]}" height="{visual["machine_height"]}" alt="" aria-hidden="true" fetchpriority="high">'
    html = head(p['seo_title'],p['description'],canonical,'sol-'+p['slug'],p['slug'],p['faqs'],visual['h1'])
    return html+f'''<main id="contenido" class="ct-article nm-wrap sol-page"><a class="ct-back" href="index.html">← Soluciones por negocio</a><article><header class="ct-editorial-head sol-hero"><p class="nm-eyebrow">Marley Coffee · Empresas · {escape(p['buyer'])}</p><span class="ct-display-word" aria-hidden="true">{escape(visual['word'])}</span>{machine}<h1 class="nm-h1">{escape(visual['h1'])}</h1></header><section class="ct-answer" aria-label="Respuesta directa"><span class="ct-kicker">En breve</span><p>{escape(p['answer'])}</p></section>{photo}<div class="ct-content"><section aria-labelledby="como-funciona"><h2 id="como-funciona">Cómo funciona la evaluación</h2><ol>{how}</ol><p>Compatibilidad, disponibilidad, servicios, soporte y condiciones comerciales se confirman para cada operación en una propuesta.</p></section><section aria-labelledby="puntos-comparar"><h2 id="puntos-comparar">Qué comparar</h2><div class="ct-table-wrap"><table class="ct-table ct-fact-table"><tbody>{table}</tbody></table></div></section><section class="ct-faqs" aria-labelledby="preguntas"><h2 id="preguntas">Preguntas habituales de compradores</h2>{faq}</section>{legal_note}<section class="ct-related" aria-labelledby="guias-rel"><h2 id="guias-rel">Guías relacionadas</h2><ul>{guides}</ul><p><a href="../contenidos/index.html">Ver las seis guías y calculadoras</a></p></section></div><aside class="ct-next"><h2>Revisa opciones para tu operación.</h2><p>Comparte tus necesidades en el portal; las condiciones se confirman en una propuesta.</p><a class="nm-btn" href="{cta}" data-attribution-handoff data-screen="C03" data-surface="solucion-{p['slug']}">Ir al portal <span aria-hidden="true">→</span></a></aside></article></main>'''+FOOTER

CONTENT_GUIDES = [
 {'slug':'cuanto-cafe-necesita-mi-negocio','title':'¿Cuánto café necesita mi negocio al mes?'},
 {'slug':'comodato-maquina-de-cafe','title':'¿Qué es el comodato de una máquina de café?'},
 {'slug':'comprar-arrendar-o-comodato','title':'¿Comprar, arrendar o pedir una máquina en comodato?'},
 {'slug':'como-elegir-maquina-cafe','title':'¿Qué máquina de café conviene según mis tazas diarias?'},
 {'slug':'cafe-desayuno-hotel','title':'¿Cómo organizar el café del desayuno en un hotel?'},
 {'slug':'como-evitar-quedarse-sin-cafe','title':'¿Cómo evitar quedarse sin café en el negocio?'},
]

def render_index(keyword_map):
    title='Soluciones de café para negocios | Marley Coffee'
    description='Explora soluciones de café para restaurantes, hoteles, cafeterías, oficinas, eventos, tiendas de conveniencia y panaderías.'
    canonical=BASE+'index.html'
    visual=INDEX_VISUAL
    cards=''.join(f'<a class="ct-card sol-card" href="{p["slug"]}.html"><span class="ct-card-kind">{escape(p["buyer"])}</span><h2>{escape(p["title"])}</h2><p>{escape(p["answer"].split(".")[0])}.</p><span class="ct-card-arrow">Explorar <span aria-hidden="true">→</span></span></a>' for p in PAGES)
    group_total=sum(len(group['phrases']) for group in keyword_map['groups'].values())
    counts=keyword_map['counts']
    note=f'<p class="sol-keyword-note">Mapa basado en <code>{escape(keyword_map["source"]["file"])}</code>, clasificación del 9 de noviembre de 2026: {group_total} frases coherentes en grupos exclusivos. Las clases investigar ({counts["investigar"]}) y revision ({counts["revision"]}) se documentan aparte; no se asignan a páginas comerciales.</p>'
    machine=f'<img class="sol-machine sol-index-machine" src="../../recursos/maquinas/{visual["machine"]}" width="{visual["machine_width"]}" height="{visual["machine_height"]}" alt="" aria-hidden="true" fetchpriority="high">'
    return head(title,description,canonical,'sol-index')+f'''<main id="contenido" class="sol-index-main"><section class="ct-hero sol-index-hero"><picture><source media="(max-width: 560px)" srcset="../../recursos/escenas/{visual['mobile']}"><img src="../../recursos/escenas/{visual['photo']}" width="1440" height="804" alt="" fetchpriority="high"></picture><div class="nm-wrap"><div class="ct-hero-copy"><p class="nm-eyebrow">Marley Coffee · Empresas</p><span class="ct-display-word" aria-hidden="true">{escape(visual['word'])}</span>{machine}<h1 class="nm-h1">{escape(visual['h1'])}</h1><p class="nm-lead">Revisa qué información conviene preparar para evaluar una propuesta acorde a tu operación.</p><a class="nm-btn" href="#soluciones">Explora tu rubro <span aria-hidden="true">→</span></a></div></div></section><section class="nm-wrap sol-index-answer"><div class="ct-answer" aria-label="Respuesta directa"><span class="ct-kicker">En breve</span><p>La mejor ruta depende de dónde servirás el café y cómo trabaja tu equipo. Elige tu tipo de negocio para revisar los datos que conviene preparar y comparar.</p></div></section><section class="nm-wrap" id="soluciones"><div class="sol-grid">{cards}</div>{note}<p><a class="nm-btn sol-hub-link" href="../contenidos/index.html">Ir al hub de contenidos <span aria-hidden="true">→</span></a></p></section></main>'''+FOOTER

if __name__ == '__main__':
    HERE.mkdir(parents=True,exist_ok=True)
    keyword_map = keyword_groups()
    (HERE/'index.html').write_text(render_index(keyword_map),encoding='utf-8')
    for page in PAGES:
        (HERE/(page['slug']+'.html')).write_text(render_page(page,keyword_map),encoding='utf-8')
    (HERE/'keyword_map.json').write_text(json.dumps(keyword_map,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Generadas {len(PAGES)} soluciones y su índice; {sum(len(g["phrases"]) for g in keyword_map["groups"].values())} frases en grupos exclusivos.')
