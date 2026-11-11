"""Extrae texto de páginas A2 para el control público AOS."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re

ROOT=Path(__file__).resolve().parents[2]
FILES=sorted((ROOT/'captacion'/'contenidos').glob('*.html'))+sorted((ROOT/'captacion'/'soluciones').glob('*.html'))+[ROOT/'captacion'/'seo'/'index.html']

class Extract(HTMLParser):
    def __init__(self):super().__init__();self.skip=0;self.body=False;self.parts=[];self.title=''
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','noscript','svg'):self.skip+=1
        if tag=='body':self.body=True
        if self.body and not self.skip and tag in ('br','li','p','div','section','article','h1','h2','h3','tr','td','th','button','a','summary'):self.parts.append(' ')
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript','svg') and self.skip:self.skip-=1
        if tag=='body':self.body=False
    def handle_data(self,data):
        if self.body and not self.skip:self.parts.append(data)

result=[]
for path in FILES:
    raw=path.read_text(encoding='utf-8');parser=Extract();parser.feed(raw)
    title=re.search(r'<title>(.*?)</title>',raw,re.I|re.S)
    desc=re.search(r'<meta\s+name="description"\s+content="(.*?)"',raw,re.I|re.S)
    body=' '.join(' '.join(parser.parts).split())
    result.append({'page':path.relative_to(ROOT).as_posix(),'text':('Title: '+(title.group(1) if title else '')+'\nDescription: '+(desc.group(1) if desc else '')+'\nVisible text: '+body)})
print(json.dumps(result,ensure_ascii=True))
