"""Genera robots, sitemap, llms.txt y el inventario técnico de SEO."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import json
import re

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ORIGIN = 'https://empresas.marleycoffee.cl'
CONSULTED = '10 de noviembre de 2026'

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=''; self.description=''; self.canonical=''; self.robots=''; self.h1=''; self.types=[]
        self._title=False; self._h1=False; self._json=False; self._json_text=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='title': self._title=True
        if tag=='h1' and not self.h1: self._h1=True
        if tag=='meta' and a.get('name')=='description': self.description=a.get('content','')
        if tag=='meta' and a.get('name')=='robots': self.robots=a.get('content','')
        if tag=='link' and a.get('rel')=='canonical': self.canonical=a.get('href','')
        if tag=='script' and a.get('type')=='application/ld+json': self._json=True; self._json_text=[]
    def handle_data(self, data):
        if self._title: self.title+=data
        if self._h1: self.h1+=data
        if self._json: self._json_text.append(data)
    def handle_endtag(self, tag):
        if tag=='title': self._title=False
        if tag=='h1': self._h1=False
        if tag=='script' and self._json:
            try: self.types.append(json.loads(''.join(self._json_text)).get('@type',''))
            except json.JSONDecodeError: self.types.append('JSON ERROR')
            self._json=False

def pages():
    result=[]
    for folder in [ROOT/'captacion'/'contenidos', ROOT/'captacion'/'soluciones']:
        for path in sorted(folder.glob('*.html')):
            parser=PageParser(); parser.feed(path.read_text(encoding='utf-8'))
            result.append((path.relative_to(ROOT).as_posix(),parser))
    # El inventario incluye esta misma ficha para hacer explícito su noindex.
    return result

def robots():
    return '''# Archivo de propuesta: copiar a la raíz del host cuando se confirme el dominio.
# Dejar rastreables las páginas noindex para que el buscador pueda leer su meta robots.
User-agent: *
Allow: /

# Propuesta de exclusión de rastreo automático de entrenamiento generativo.
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /

# Permitir acceso para recuperación en búsqueda y solicitudes iniciadas por usuarios.
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /

# Actualizar la URL al instalar el sitemap en la raíz del dominio confirmado.
Sitemap: https://empresas.marleycoffee.cl/sitemap.xml
'''

def source_rows():
    rows=[
      ('Código Civil de Chile, arts. 1793, 1915 y 2174','Definición legal de compraventa, arrendamiento y comodato.','https://www.bcn.cl/leychile/navegar?idNorma=172986'),
      ('Reglamento Sanitario de los Alimentos, BCN','Fuente normativa para la referencia general a higiene de alimentos.','https://www.bcn.cl/leychile/navegar?idNorma=71271'),
      ('Specialty Coffee Association','Las dosis y prácticas de preparación de espresso varían.','https://sca.coffee/sca-news/25-magazine/issue-3/defining-ever-changing-espresso-25-magazine-issue-3-zyx36'),
      ('Nespresso Professional, ficha MOMENTO','Ejemplo de los campos técnicos que puede incluir una ficha externa; no es un modelo Marley.','https://www.nespresso.com/shared_res/mos/free_html/au/NespressoProfessional-FactSheet/Professional_Machine_Fact_Sheet_MOMENTO_Interactive_A4.pdf'),
      ('University of Arkansas Pressbooks','Referencia metodológica sobre punto de reposición; el cálculo del sitio se etiqueta como simplificación.','https://uark.pressbooks.pub/210h3scmtbbultra25/chapter/8-4-systems-of-how-much-to-order-and-when-to-order/'),
      ('Google Search Central: robots.txt','Robots controla rastreo; no sustituye una meta noindex y no garantiza retirar una URL del índice.','https://developers.google.com/search/docs/crawling-indexing/robots/intro'),
      ('Google Search Central: sitemaps','Sitemap UTF-8 con URLs absolutas preferidas; es una sugerencia de rastreo, no garantía de indexación.','https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview'),
      ('OpenAI: crawlers','Distingue OAI-SearchBot, GPTBot y ChatGPT-User, con controles de robots independientes.','https://developers.openai.com/api/docs/bots'),
      ('Anthropic: web crawlers','Información de ClaudeBot, Claude-SearchBot y Claude-User.','https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler'),
      ('Perplexity: crawlers','Información de PerplexityBot y Perplexity-User.','https://docs.perplexity.ai/guides/bots'),
      ('Google crawlers and fetchers','Google-Extended es un control independiente de Google Search.','https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers'),
      ('web.dev: Core Web Vitals thresholds','Objetivos de campo recomendados al percentil 75: LCP ≤2,5 s, INP ≤200 ms y CLS ≤0,1.','https://web.dev/articles/defining-core-web-vitals-thresholds'),
    ]
    return ''.join(f'<tr><th scope="row">{escape(name)}</th><td>{escape(support)}</td><td><a href="{url}" target="_blank" rel="noopener noreferrer">{escape(url)}</a></td><td>Consultado el {CONSULTED}.</td></tr>' for name,support,url in rows)

def keyword_group(rel, keyword_map):
    if not rel.startswith('captacion/soluciones/'):
        return '<small>Intención informativa propia; sin frases comerciales del CSV.</small>'
    slug='index' if rel.endswith('/index.html') else Path(rel).stem
    group=keyword_map['groups'][slug]
    phrases=group['phrases']
    terms=''.join(f'<li>{escape(term)}</li>' for term in phrases)
    return f'<small>{len(phrases)} frases · {escape(group["intent"])}</small><details><summary class="ct-disclosure-toggle">Ver grupo de frases</summary><ul>{terms}</ul></details>'

def unassigned_class(keyword_map, class_name, label):
    items=keyword_map['not_assigned_to_commercial_pages'][class_name]
    terms=''.join(f'<li><strong>{escape(item["phrase"])}</strong> — {escape(item["reason"])}</li>' for item in items)
    return f'<details><summary class="ct-disclosure-toggle">{label} ({len(items)}) · sin asignación comercial</summary><ul>{terms}</ul></details>'

def create_index():
    rows=[]
    keyword_map=json.loads((ROOT/'captacion'/'soluciones'/'keyword_map.json').read_text(encoding='utf-8'))
    for rel,p in pages():
        types=', '.join(x for x in p.types if x) or '—'
        rows.append(f'<tr><th scope="row"><code>{escape(rel)}</code></th><td>{escape(p.title)}<br><small>{len(p.title)} caracteres</small></td><td>{escape(p.description)}<br><small>{len(p.description)} caracteres</small></td><td><code>{escape(p.canonical)}</code></td><td>{escape(p.h1 or "sin H1")}</td><td>{keyword_group(rel,keyword_map)}</td><td>{escape(types)}</td><td>{escape(p.robots or "—")}</td><td>Presupuesto común; metas al final de esta ficha.</td></tr>')
    title='SEO técnico y publicación | Marley Coffee'
    description='Inventario de metadatos, datos estructurados, rastreo y presupuesto de rendimiento del prototipo B2B.'
    canonical=ORIGIN+'/captacion/seo/index.html'
    counts=keyword_map['counts']
    source_note=f'''<p><strong>Fuente exacta:</strong> <code>{escape(keyword_map['source']['file'])}</code>, clasificación del 9 de noviembre de 2026; consultada el 11 de noviembre de 2026. El archivo contiene {counts['total']} frases: {counts['coherente']} coherentes, {counts['fuera']} fuera, {counts['investigar']} para investigar y {counts['revision']} en revisión.</p><p>Los grupos exclusivos por comprador y las frases genéricas del índice están documentados por URL en <a href="../soluciones/keyword_map.json">keyword_map.json</a>. Cada frase coherente tiene un solo destino. Las clases investigar y revision no se asignan a páginas comerciales:</p>{unassigned_class(keyword_map,'investigar','Investigar')}{unassigned_class(keyword_map,'revision','En revisión')}{unassigned_class(keyword_map,'fuera','Fuera de alcance')}'''
    return f'''<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{canonical}"><link rel="stylesheet" href="../marca/negro-marley.css"><link rel="stylesheet" href="../contenidos/contenidos.css"><link rel="stylesheet" href="seo.css"><script type="application/ld+json">{{"@context":"https://schema.org","@type":"Organization","name":"Marley Coffee Empresas","url":"{ORIGIN}/"}}</script><script type="application/ld+json">{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"Inicio","item":"{ORIGIN}/"}},{{"@type":"ListItem","position":2,"name":"SEO técnico","item":"{canonical}"}}]}}</script></head><body class="nm"><a class="nm-skip" href="#contenido">Saltar al contenido</a><header class="ct-barra"><div class="nm-wrap"><a href="../contenidos/index.html" class="ct-brand"><span class="ld-logo" aria-hidden="true"></span><span>Empresas</span></a><nav aria-label="Navegación"><a class="ct-head-link" href="../contenidos/index.html">Contenidos</a><a class="ct-head-link" href="../soluciones/index.html">Soluciones</a></nav></div></header><main id="contenido" class="nm-wrap seo-main"><p class="nm-eyebrow">Ficha técnica · prototipo</p><h1 class="nm-h1">SEO técnico del hub y las soluciones.</h1><p class="nm-lead">Dominio propuesto: <code>{ORIGIN}/</code>. El subdominio de producción está pendiente de confirmación. Todas las páginas del prototipo llevan <code>noindex,nofollow</code>; los canonicals son propuestas, no URLs publicadas.</p><p>Al publicar: confirmar host, TLS y rutas; actualizar cada canonical; retirar la meta noindex solo en páginas aprobadas para indexación; copiar robots.txt, sitemap.xml y llms.txt a la raíz; poblar el sitemap solo con canonicals indexables; validar rastreo y medir Core Web Vitals reales. No se promete un resultado de posicionamiento ni citas de asistentes.</p><h2>Metadatos y schema por página</h2><div class="seo-table-wrap"><table class="ct-table seo-table"><thead><tr><th>Página</th><th>Title</th><th>Descripción</th><th>Canonical propuesto</th><th>H1 visible</th><th>Grupo de frases de búsqueda</th><th>Datos estructurados visibles</th><th>Robots</th><th>Presupuesto</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div><h2>Presupuesto de rendimiento</h2><ul><li>Objetivos de campo al percentil 75, por dispositivo: LCP ≤2,5 s; INP ≤200 ms; CLS ≤0,1. Son metas, no resultados medidos en este prototipo.</li><li>Peso transferido inicial en móvil ≤350 KiB comprimidos; CSS ≤120 KiB; JavaScript ≤60 KiB; HTML de página ≤30 KiB.</li><li>Hero de portada ≤120 KiB para móvil; carga diferida de imágenes fuera de pantalla; dimensiones explícitas para evitar saltos.</li><li>Sin reproductores, analítica ni scripts de terceros en el hub y las soluciones. Las fuentes de marca se cargan desde el CSS compartido.</li><li>En publicación, medir con datos de campo y separar el percentil 75 de móvil y escritorio. El límite de peso es una meta del equipo; Core Web Vitals se evalúa con umbrales oficiales.</li></ul><h2>Mapa de intención</h2><p>Una URL por comprador: restaurantes, hoteles, cafeterías, oficinas, eventos y catering, conveniencia y panaderías. Las seis guías responden intención informativa; las soluciones cubren intención comercial por negocio. Las consultas genéricas se conservan en el índice de soluciones, sin duplicarlas en páginas de comprador.</p><p>{source_note}</p><h2>Fuentes verificadas</h2><div class="seo-table-wrap"><table class="ct-table seo-table"><thead><tr><th>Fuente</th><th>Uso en este prototipo</th><th>URL abierta</th><th>Consulta</th></tr></thead><tbody>{source_rows()}</tbody></table></div><h2>Política de bots propuesta</h2><p><a href="robots.txt">robots.txt</a> permite a buscadores y bots de recuperación revisar contenido, y propone bloquear GPTBot, ClaudeBot y Google-Extended para rastreo de entrenamiento. Es una preferencia técnica por agente, no un control de acceso ni una regla global. Revisar con quien apruebe la política antes de ponerla en la raíz del dominio. La meta <code>noindex</code> permanece accesible a los rastreadores.</p><p><a href="llms.txt">Ver borrador llms.txt</a> · <a href="sitemap.xml">Ver sitemap.xml</a></p><h2>Estado de publicación</h2><p>Prototipo local. No desplegado. Recomendación: conservar <code>noindex</code> hasta aprobar el dominio, la revisión legal/comercial, las fuentes y el control de bots. Cuando exista una URL real, indexar solo las páginas permanentes aprobadas y retirar de sitemap cualquier URL que siga en noindex.</p></main><footer class="ct-footer"><div class="nm-wrap"><p>Marley Coffee Empresas · Documento técnico de prototipo.</p><p>URL y subdominio de producción pendientes.</p></div></footer></body></html>'''

if __name__=='__main__':
    HERE.mkdir(parents=True,exist_ok=True)
    (HERE/'robots.txt').write_text(robots(),encoding='utf-8')
    (HERE/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',encoding='utf-8')
    (HERE/'llms.txt').write_text(f'''# Marley Coffee Empresas\n\n> Prototipo de hub B2B en español de Chile. Dominio propuesto: {ORIGIN}/; subdominio de producción pendiente de confirmación. Todas las URLs listadas están en noindex en el prototipo.\n\n## Contenidos permanentes propuestos\n\n- [Hub de contenidos]({ORIGIN}/captacion/contenidos/index.html): respuestas, guías, calculadoras y casos hipotéticos.\n- [Soluciones por tipo de negocio]({ORIGIN}/captacion/soluciones/index.html): siete rutas para compradores.\n- [Portal B2B]({ORIGIN}/index.html#C03): acceso al portal de orientación.\n\n## Criterios de lectura\n\nLas cifras de calculadoras son entradas de ejemplo y deben reemplazarse por datos propios. Las condiciones de equipos, productos, mantenimiento, soporte y contratación se confirman en una propuesta vigente. Las fuentes legales y técnicas se enlazan junto a la afirmación que respaldan. No hay precios ni reseñas estructuradas.\n\n## Publicación\n\nEste archivo es un borrador. Confirmar dominio y canonicals, revisar la política de rastreo y quitar noindex solo de URLs aprobadas antes de copiarlo a la raíz del host.\n''',encoding='utf-8')
    (HERE/'index.html').write_text(create_index(),encoding='utf-8')
    print(f'Generados SEO técnico para {len(pages())} páginas: robots.txt, sitemap.xml, llms.txt e index.html.')
