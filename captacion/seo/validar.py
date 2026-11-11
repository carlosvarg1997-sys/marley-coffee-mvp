"""Valida HTML/JSON-LD, XML, metadatos y el mapa exacto de clasificación."""
from pathlib import Path
from html.parser import HTMLParser
from xml.etree import ElementTree as ET
from collections import Counter
import csv
import json
import re
import unicodedata

ROOT=Path(__file__).resolve().parents[2]
SEO=ROOT/'captacion'/'seo'
CONTENT=ROOT/'captacion'/'contenidos'
SOLUTIONS=ROOT/'captacion'/'soluciones'
KEYWORDS=ROOT.parent/'ecosistema_captacion_10nov'/'CLASIFICACION_FRASES_B2B_09NOV.csv'
ALLOWED={'Organization','BreadcrumbList','Article','FAQPage'}
EXPECTED={'coherente':83,'fuera':7,'investigar':2,'revision':5}
GUIDES={'cuanto-cafe-necesita-mi-negocio','comodato-maquina-de-cafe','comprar-arrendar-o-comodato','como-elegir-maquina-cafe','cafe-desayuno-hotel','como-evitar-quedarse-sin-cafe'}
BUYERS={'restaurantes','hoteles','cafeterias','oficinas','eventos-catering','conveniencia','panaderias'}

def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFD',value.casefold()) if unicodedata.category(c)!='Mn').strip()

class CheckPage(HTMLParser):
    def __init__(self):
        super().__init__();self.title='';self.description='';self.canonical='';self.robots='';self.lang='';self.h1=[];self.faqs=[];self._title=False;self._h1=False;self._summary=False;self._faq_details=False;self._ld=False;self._ld_data=[];self.schemas=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='html': self.lang=a.get('lang','')
        if tag=='title':self._title=True
        if tag=='h1':self._h1=True;self.h1.append('')
        if tag=='details' and 'ct-faq' in a.get('class','').split():self._faq_details=True
        if tag=='summary' and self._faq_details:self._summary=True;self.faqs.append('')
        if tag=='meta' and a.get('name')=='description':self.description=a.get('content','')
        if tag=='meta' and a.get('name')=='robots':self.robots=a.get('content','')
        if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href','')
        if tag=='script' and a.get('type')=='application/ld+json':self._ld=True;self._ld_data=[]
    def handle_data(self,data):
        if self._title:self.title+=data
        if self._h1:self.h1[-1]+=data
        if self._summary:self.faqs[-1]+=data
        if self._ld:self._ld_data.append(data)
    def handle_endtag(self,tag):
        if tag=='title':self._title=False
        if tag=='h1':self._h1=False
        if tag=='summary':self._summary=False
        if tag=='details':self._faq_details=False
        if tag=='script' and self._ld:
            self.schemas.append(json.loads(''.join(self._ld_data)));self._ld=False

def check(path):
    parser=CheckPage();raw=path.read_text(encoding='utf-8');parser.feed(raw)
    assert parser.lang=='es-CL',(path,'lang')
    assert parser.title and len(parser.title)<=60,(path,'title',len(parser.title))
    assert parser.description and len(parser.description)<=155,(path,'description',len(parser.description))
    assert len(parser.h1)==1 and parser.h1[0].strip(),(path,'H1',parser.h1)
    assert parser.canonical.startswith('https://empresas.marleycoffee.cl/'),(path,'canonical',parser.canonical)
    assert parser.robots.replace(' ','').lower()=='noindex,nofollow',(path,'robots',parser.robots)
    types=[x.get('@type') for x in parser.schemas]
    assert set(types)<=ALLOWED,(path,'schema type',types)
    assert all(x in types for x in ['Organization','BreadcrumbList']),(path,'base schema',types)
    assert 'Product' not in types and 'Review' not in types and 'AggregateRating' not in types,(path,'forbidden schema',types)
    article=next((x for x in parser.schemas if x.get('@type')=='Article'),None)
    if article: assert article.get('headline')==parser.h1[0].strip(),(path,'Article headline must match visible H1',article.get('headline'),parser.h1[0])
    faq=next((x for x in parser.schemas if x.get('@type')=='FAQPage'),None)
    if faq:
        visible=[x.strip() for x in parser.faqs]
        schema=[x['name'] for x in faq.get('mainEntity',[])]
        assert schema==visible and len(schema)>0,(path,'FAQ visible/schema mismatch',schema,visible)
    if path.parent==CONTENT and path.name!='index.html':
        assert 'Fuentes y fecha de consulta' in raw and '<th scope="col">URL</th>' in raw,(path,'source table')
        assert 'Consultado el 10 de noviembre de 2026' in raw,(path,'source date')
    if path.parent==CONTENT:
        assert re.search(r'<span class="ct-display-word" aria-hidden="true">',raw),(path,'decorative word semantics')
        assert '<section class="ct-answer"' in raw or '<div class="ct-answer"' in raw,(path,'direct answer')
        assert 'recursos/escenas/' in raw,(path,'real local photo')
        if path.name!='index.html':
            assert len(re.findall(r'<a class="nm-btn"[^>]*data-attribution-handoff',raw))==1,(path,'single next step')
            assert 'ct-fact-table' in raw or 'ct-fact-sheet' in raw,(path,'visible formula/comparison/supposition table')
    if path.parent==SOLUTIONS:
        assert re.search(r'<span class="ct-display-word" aria-hidden="true">',raw),(path,'buyer word semantics')
        assert re.search(r'<img class="sol-machine[^>]*aria-hidden="true"',raw),(path,'decorative machine cutout')
        assert 'recursos/escenas/' in raw and 'ct-answer' in raw,(path,'photo and direct answer')
        if path.name!='index.html':
            assert len(re.findall(r'<a class="nm-btn"[^>]*data-attribution-handoff',raw))==1,(path,'single portal CTA')
            assert '#C03' in raw and 'recursos/maquinas/' in raw,(path,'portal CTA/machine')
            assert len(re.findall(r'href="\.\./contenidos/[^\"]+\.html"',raw))>=3,(path,'related guide links')
            assert 'FAQPage' in types,(path,'buyer FAQ schema')
    assert '/captacion/landing/' not in raw,(path,'campaign landing link')
    return {'path':path.relative_to(ROOT).as_posix(),'title_chars':len(parser.title),'description_chars':len(parser.description),'schema':types}

paths=sorted(CONTENT.glob('*.html'))+sorted(SOLUTIONS.glob('*.html'))+[SEO/'index.html']
results=[check(p) for p in paths]
assert len(results)==16,('expected 16 HTML pages',len(results))

tree=ET.parse(SEO/'sitemap.xml');assert tree.getroot().tag.endswith('urlset')
ns={'sm':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls=tree.findall('.//sm:url',ns);assert not urls,'Sitemap remains empty while the prototype is noindex.'

with KEYWORDS.open(encoding='utf-8-sig',newline='') as stream: rows=list(csv.DictReader(stream))
counts=Counter(row['clase'].strip().casefold() for row in rows)
assert len(rows)==97 and dict(counts)==EXPECTED,('classification source changed',len(rows),dict(counts))
keyword_map=json.loads((SOLUTIONS/'keyword_map.json').read_text(encoding='utf-8'))
assert keyword_map['source']['file']=='ecosistema_captacion_10nov/CLASIFICACION_FRASES_B2B_09NOV.csv'
assert keyword_map['source']['classification_date']=='2026-11-09'
groups=keyword_map['groups'];assert set(groups)=={'index',*BUYERS}
assigned=[phrase for group in groups.values() for phrase in group['phrases']]
assert len(assigned)==83 and len({norm(x) for x in assigned})==83
assert {norm(x) for x in assigned}=={norm(row['frase']) for row in rows if row['clase'].strip().casefold()=='coherente'},'Assigned phrases must match the exact coherent class in the CSV.'
unassigned=keyword_map['not_assigned_to_commercial_pages']
assert {k:len(v) for k,v in unassigned.items()}=={'fuera':7,'investigar':2,'revision':5}
for category in ('fuera','investigar','revision'):
    expected={norm(row['frase']) for row in rows if row['clase'].strip().casefold()==category}
    actual={norm(item['phrase']) for item in unassigned[category]}
    assert actual==expected,(category,'classification phrases do not match CSV')
assert all(not ({norm(item['phrase']) for item in unassigned[c]} & {norm(x) for x in assigned}) for c in unassigned)
seo_raw=(SEO/'index.html').read_text(encoding='utf-8')
assert 'CLASIFICACION_FRASES_B2B_09NOV.csv' in seo_raw and 'investigacion_08nov/universo_frases_b2b.csv' not in seo_raw
assert all(phrase in seo_raw for phrase in assigned),'SEO page must expose each exact coherent phrase in its page group.'
robots=(SEO/'robots.txt').read_text(encoding='utf-8')
for bot in ['GPTBot','ClaudeBot','Google-Extended','OAI-SearchBot','Claude-SearchBot','PerplexityBot']:
    assert f'User-agent: {bot}' in robots,('robots policy missing bot',bot)
print(json.dumps({'ok':True,'html_pages':len(results),'jsonld_valid':sum(len(x['schema']) for x in results),'sitemap_urls':len(urls),'keyword_phrases':len(assigned),'keyword_groups':{key:len(group['phrases']) for key,group in groups.items()},'classification_counts':dict(counts),'pages':results},ensure_ascii=False,indent=2))
