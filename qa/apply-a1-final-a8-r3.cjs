const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const required = (source, search, replacement, label) => {
  const count = source.split(search).length - 1;
  if (!count) throw new Error(`No se encontró el fragmento requerido: ${label}`);
  return source.replaceAll(search, replacement);
};

html = required(
  html,
  "else if (pw !== 'demo') R.ui.loginErr = 'La contraseña no coincide: en el prototipo es demo.';",
  "else if (pw !== 'prueba') R.ui.loginErr = 'La contraseña de prueba no coincide.';",
  'validación de contraseña R00'
);
html = html.replace(/contraseña\s+demo/gi, 'contraseña de prueba');
const nameMatches = (html.match(/Elena\s+Demostración/gi) || []).length;
if (!nameMatches) throw new Error('No se encontró el nombre ficticio Elena Demostración');
html = html.replace(/Elena\s+Demostración/gi, 'Elena Fuentes');

const brokenLink = '<a class="tool-btn" href="diagramas.html" target="_blank" rel="noopener">Diagramas</a>';
html = required(html, brokenLink, '', 'enlace roto de diagramas');
html = html.replaceAll("window.MARLEY_FLOW_URL='diagramas.html';", "window.MARLEY_FLOW_URL='#C10';");
html = html.replaceAll("|| 'diagramas.html'", "|| '#C10'");
html = html.replace(/F7BE00|CBA600|EFC600/gi, 'F3C900');

const appended = `
<style id="a1-final-a8-r3">
:where(a,button,input,select,textarea,summary,video[controls],[role="button"],[role="link"]):focus-visible{outline:3px solid #171717!important;outline-offset:3px!important;box-shadow:0 0 0 6px #F3C900!important}
.m5-roles-head p{color:#171717!important}
#m9-add-grano{background-color:#FFFFFF!important;color:#171717!important}
:where(.b2c-main,.m5,.m4,.journey-shell) :is(a[href],button,select,textarea,[role="button"],[role="link"]){min-height:44px;min-width:44px}
:where(.b2c-main,.m5,.m4,.journey-shell) a[href]{display:inline-flex;align-items:center}
.journey-shell :is(input:not([type="hidden"]),select,textarea){min-height:44px}
.journey-shell label.check{display:flex;align-items:center;min-height:44px;padding-block:8px}
.a1-r3-first-action{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 18px}
.m5 .m5-exp-intro .a1-r3-first-action .m5-btn{min-height:48px;min-width:120px;width:auto}
.journey-shell .a1-r3-first-action .btn{min-height:48px;min-width:44px}
@media(max-width:760px){
 .b2c-main .b2c-chat{position:static!important;inset:auto!important;margin:12px auto!important;max-width:calc(100% - 24px)}
 .m5 .m5-top{position:static!important;top:auto!important}
 .m5 .m5-stage-pin{position:static!important;top:auto!important;height:auto!important;min-height:0!important;overflow:visible!important}
 .m5 .m5-mbar{display:none!important;position:static!important;transform:none!important}
 .m7-launcher{position:static!important;inset:auto!important;width:max-content;max-width:calc(100% - 24px);margin:14px auto!important}
 body.m4-body .m4-strip{position:static!important;top:auto!important}
 body.m4-body .m4-float{position:static!important;inset:auto!important;margin:12px auto!important}
}
</style>
<script id="a1-final-a8-r3-copy-and-cta">
(function(){
  const safeText=(value)=>String(value)
    .replace(/\\bElena\\s+Demostración\\b/gi,(match)=>match===match.toUpperCase()?'ELENA FUENTES':'Elena Fuentes')
    .replace(/\\bdemostración(es)?\\b/gi,(match,plural)=>{const base=plural?'pruebas':'prueba';return match===match.toUpperCase()?base.toUpperCase():match[0]===match[0].toUpperCase()?base[0].toUpperCase()+base.slice(1):base;})
    .replace(/\\bdemo\\b/gi,(match)=>match===match.toUpperCase()?'PRUEBA':match[0]===match[0].toUpperCase()?'Prueba':'prueba');
  const cleanNode=(root)=>{
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){const next=safeText(root.nodeValue);if(next!==root.nodeValue)root.nodeValue=next;return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root!==document.body)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){const next=safeText(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}
    if(root.querySelectorAll){
      const nodes=[root,...root.querySelectorAll('[aria-label],[title],[placeholder],[alt]')];
      for(const el of nodes)for(const attr of ['aria-label','title','placeholder','alt'])if(el.hasAttribute?.(attr)){const next=safeText(el.getAttribute(attr));if(next!==el.getAttribute(attr))el.setAttribute(attr,next);}
    }
  };
  const placeCtas=()=>{
    const current=document.body?.dataset.current||(location.hash||'').slice(1).split('?')[0];
    if(current==='C08'){
      const intro=document.querySelector('#m4-main .m5-exp-intro');
      const title=intro?.querySelector('.m5-exp-title');
      const description=title?.nextElementSibling;
      const cta=[...document.querySelectorAll('.m5-stage-beat .m5-actions .m5-btn--ghost')].find((el)=>el.textContent.trim().toLocaleUpperCase('es-CL')==='COTIZAR');
      if(intro&&cta&&cta.parentElement!==intro){
        const row=intro.querySelector(':scope > .a1-r3-first-action')||document.createElement('div');
        row.className='m5-actions a1-r3-first-action';
        if(!row.isConnected){(description||title||intro).insertAdjacentElement('afterend',row);}
        row.appendChild(cta);
      }
    }
    if(current==='C14'){
      const content=document.querySelector('.journey-shell .portal-content');
      const callout=content?.querySelector('.callout');
      const cta=[...content?.querySelectorAll('.task-actions button.btn.primary')||[]].find((el)=>el.textContent.trim().toLocaleLowerCase('es-CL')==='añadir a mi propuesta');
      if(content&&callout&&cta&&cta.parentElement!==content.querySelector(':scope > .a1-r3-first-action')){
        const row=document.createElement('div');row.className='a1-r3-first-action';row.appendChild(cta);callout.insertAdjacentElement('afterend',row);
      }
    }
    if(current==='C15'){
      const content=document.querySelector('.journey-shell .portal-content');
      const heading=content?.querySelector('.view-heading');
      const row=content?.querySelector(':scope > .action-row');
      if(heading&&row&&row.previousElementSibling!==heading){row.classList.add('a1-r3-first-action');heading.insertAdjacentElement('afterend',row);}
    }
  };
  document.title=safeText(document.title);
  cleanNode(document.body);
  const observer=new MutationObserver((records)=>{
    for(const record of records){
      if(record.type==='characterData')cleanNode(record.target);
      for(const node of record.addedNodes||[])cleanNode(node);
    }
    placeCtas();
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  placeCtas();
  window.addEventListener('hashchange',()=>setTimeout(placeCtas,0));
})();
</script>
`;
if (html.includes('id="a1-final-a8-r3"')) throw new Error('El parche final A8 r3 ya está aplicado');
const closing = html.lastIndexOf('</body>');
if (closing < 0) throw new Error('No se encontró </body> para agregar las correcciones');
html = html.slice(0, closing) + appended + html.slice(closing);
fs.writeFileSync(file, html, 'utf8');
process.stdout.write(JSON.stringify({file, nameMatches, appendedBytes: Buffer.byteLength(appended), remainingColors: [...html.matchAll(/(?:F7BE00|CBA600|EFC600)/gi)].length}) + '\n');
