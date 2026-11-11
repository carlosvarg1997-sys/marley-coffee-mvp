/* Responsive, arte, atribución y mapa exacto del CSV de soluciones. */
const { chromium } = require('../../qa/playwright-system-chrome.cjs');
const fs=require('fs'); const path=require('path'); const assert=require('assert');
const files=['index.html','restaurantes.html','hoteles.html','cafeterias.html','oficinas.html','eventos-catering.html','conveniencia.html','panaderias.html'];
const widths=[320,390,1440];
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').trim();

(async()=>{
  const base=process.argv[2]; assert(base&&/^https?:\/\//.test(base),'Uso: node captacion/soluciones/comprobar.cjs http://127.0.0.1:8890/captacion/soluciones/');
  const root=new URL(base); const evidence=path.join(__dirname,'evidencia'); fs.mkdirSync(evidence,{recursive:true});
  const map=JSON.parse(fs.readFileSync(path.join(__dirname,'keyword_map.json'),'utf8'));
  const groups=map.groups; const terms=Object.values(groups).flatMap(x=>x.phrases);
  assert.equal(map.source.file,'ecosistema_captacion_10nov/CLASIFICACION_FRASES_B2B_09NOV.csv');
  assert.equal(map.source.classification_date,'2026-11-09'); assert.equal(map.counts.total,97); assert.equal(map.counts.coherente,83); assert.equal(map.counts.fuera,7); assert.equal(map.counts.investigar,2); assert.equal(map.counts.revision,5);
  assert.equal(terms.length,83,'83 phrases routed from the exact coherent class'); assert.equal(new Set(terms.map(norm)).size,83,'No duplicate phrases in page groups');
  assert.deepEqual(Object.keys(map.not_assigned_to_commercial_pages).sort(),['fuera','investigar','revision']);
  assert.equal(map.not_assigned_to_commercial_pages.investigar.length,2); assert.equal(map.not_assigned_to_commercial_pages.revision.length,5); assert.equal(map.not_assigned_to_commercial_pages.fuera.length,7);
  const browser=await chromium.launch({headless:true}); const result=[];
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:width<500?844:900},locale:'es-CL',isMobile:width<500,hasTouch:width<500}); const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    for(const file of files){
      const url=new URL(file,root); url.search='utm_source=ads&utm_medium=cpc&mc_session=prueba&mc_surface=landing&mc_query_id=q2&evil=secreto'; await page.goto(url.href,{waitUntil:'networkidle'});
      const state=await page.evaluate(()=>{
        const outside=[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&!e.closest('.ct-table-wrap')&&!e.closest('.nm-skip')).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:(e.textContent||'').trim().slice(0,45),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}}).filter(x=>x.left< -1||x.right>visualViewport.width+1);
        const json=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)); const cs=e=>getComputedStyle(e);
        const contrast=(fg,bg)=>{const parse=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};const a=parse(fg),b=parse(bg);if(a.length!==3||b.length!==3)return 0;const lum=c=>.2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)};
        const answer=document.querySelector('.ct-answer'), answerP=answer?.querySelector('p'), button=document.querySelector('.ct-next .nm-btn,.sol-index-hero .nm-btn');
        const decor=document.querySelector('.ct-display-word'), machine=document.querySelector('.sol-machine'), h1=document.querySelector('h1'); const hero=machine?.closest('.sol-hero,.sol-index-hero'); const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
        const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const photos=[...document.querySelectorAll('.ct-feature-bleed img,.ct-hero picture img')];
        const ol=document.querySelector('.ct-content ol'); const item=ol?.querySelector(':scope > li'); const before=item?getComputedStyle(item,'::before'):null;
        const body=document.body; const answerRatio=answer&&answerP?contrast(cs(answerP).color,cs(answer).backgroundColor):0; const buttonRatio=button?contrast(cs(button).color,cs(button).backgroundColor):0;
        return {width:visualViewport.width,layoutWidth:innerWidth,docWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth,metaViewport:document.querySelector('meta[name="viewport"]')?.content,zoom:cs(document.body).zoom,scroll:document.documentElement.scrollWidth,h1Count:document.querySelectorAll('h1').length,h1Text:h1?.innerText.trim(),h1Max:cs(h1).maxWidth,h1Width:cs(h1).width,robots:document.querySelector('meta[name="robots"]')?.content,title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,outside,json,decorHidden:decor?.getAttribute('aria-hidden'),machineHidden:machine?.getAttribute('aria-hidden'),machineSrc:machine?.getAttribute('src'),machineRect:machine?box(machine):null,decorRect:decor?box(decor):null,h1Rect:h1?box(h1):null,heroRect:hero?box(hero):null,machineContained:!!machine&&!!hero&&box(machine).left>=box(hero).left+6&&box(machine).right<=box(hero).right-6&&box(machine).top>=box(hero).top+6&&box(machine).bottom<=box(hero).bottom-6,machineWordOverlap:!!machine&&!!decor&&hit(box(machine),box(decor)),machineH1Overlap:!!machine&&!!h1&&hit(box(machine),box(h1)),answerBorder:answer?cs(answer).borderLeftColor:null,answerRatio,buttonRatio,photoSources:photos.map(i=>i.getAttribute('src')),photoReady:photos.every(i=>i.complete&&i.naturalWidth>0),steps:ol?{columns:cs(ol).gridTemplateColumns,numberContent:before?.content,numberColor:before?.color,items:ol.querySelectorAll(':scope > li').length}:null};
      });
      assert.equal(state.width,width,`${file} visual viewport changed: ${JSON.stringify(state)}`); assert(state.scroll<=width,`${file}: overflow ${state.scroll}px at ${width}; outside ${JSON.stringify(state.outside)}`); assert.equal(state.h1Count,1,`${file}: one H1`); assert(state.h1Text.startsWith('¿')&&state.h1Text.endsWith('?'),`${file}: full question H1`);
      assert(state.robots?.replace(/\s/g,'').toLowerCase()==='noindex,nofollow',`${file}: noindex,nofollow`); assert(state.title.length<=60,`${file}: title ${state.title.length}`); assert(state.description.length<=155,`${file}: description ${state.description.length}`); assert(state.canonical.startsWith('https://empresas.marleycoffee.cl/'),`${file}: canonical`); assert.deepEqual(state.outside,[],`${file}: outside viewport ${JSON.stringify(state.outside)}`);
      assert.equal(state.decorHidden,'true',`${file}: buyer word aria-hidden`); assert.equal(state.machineHidden,'true',`${file}: cutout machine aria-hidden`); assert(state.machineSrc.includes('../../recursos/maquinas/'),`${file}: local machine cutout`); assert(state.machineContained,`${file}: cutout is clipped or too close to the hero edge ${JSON.stringify({machine:state.machineRect,hero:state.heroRect})}`); assert(state.machineWordOverlap,`${file}: machine is not mounted on buyer word ${JSON.stringify({machine:state.machineRect,word:state.decorRect})}`); assert(!state.machineH1Overlap,`${file}: machine image box collides with H1 ${JSON.stringify({machine:state.machineRect,h1:state.h1Rect,max:state.h1Max,width:state.h1Width})}`);
      assert(state.answerBorder.includes('243, 201, 0'),`${file}: answer border is not yellow`); assert(state.answerRatio>=4.5,`${file}: answer contrast ${state.answerRatio.toFixed(2)}`); assert(state.buttonRatio>=4.5,`${file}: CTA contrast ${state.buttonRatio.toFixed(2)}`); assert(state.photoReady&&state.photoSources.some(src=>src?.includes('../../recursos/escenas/')),`${file}: local scene photo missing/unloaded`);
      if(width<=390&&state.steps){assert.equal(state.steps.columns.trim().split(/\s+/).length,1,`${file}: steps must use one column at ${width}px`);assert(state.steps.numberContent.includes('counter('),`${file}: numbered steps missing`);assert(state.steps.numberColor.includes('243, 201, 0'),`${file}: step numbers not yellow`);}
      assert(!JSON.stringify(state.json).includes('"@type":"Product"'),`${file}: Product schema`);
      const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>({href:a.href,external:a.origin!==location.origin}))); assert(!links.some(l=>l.href.includes('/captacion/landing/')),`${file}: campaign landing link`);
      for(const l of links.filter(x=>!x.external)){const response=await fetch(l.href);assert(response.ok,`${file}: broken link ${l.href} ${response.status}`);}
      if(file==='index.html'){
        assert.equal(await page.locator('.sol-card').count(),7,'7 solution cards');
        const href=await page.locator('.sol-card').first().getAttribute('href');assert(!href.includes('?'),'Internal solution card is untagged');
        assert((await page.locator('.sol-keyword-note').innerText()).includes('CLASIFICACION_FRASES_B2B_09NOV.csv'),'Index cites exact classification CSV');
      }else{
        const visibleQuestions=await page.locator('.ct-faq summary').allTextContents(); const faqSchema=state.json.find(x=>x['@type']==='FAQPage');
        assert(faqSchema,`${file}: FAQPage`); assert.deepEqual(faqSchema.mainEntity.map(x=>x.name),visibleQuestions,`${file}: FAQ visible and schema match`);
        assert.equal(await page.locator('.ct-next [data-attribution-handoff]').count(),1,`${file}: one portal handoff CTA`);
        const buttonUrl=new URL(await page.locator('.ct-next [data-attribution-handoff]').getAttribute('href'),page.url()); assert.equal(buttonUrl.hash,'#C03',`${file}: portal CTA C03`); assert.equal(buttonUrl.searchParams.get('utm_source'),'ads'); assert.equal(buttonUrl.searchParams.get('mc_entry_surface'),'landing'); assert(!buttonUrl.searchParams.has('evil'));
        const answerText=await page.locator('.ct-answer p').innerText(); assert(answerText.split(/[.!?]+/).filter(x=>x.trim()).length<=5,`${file}: answer exceeds five sentences`);
        assert(await page.locator('.ct-related a[href^="../contenidos/"]').count()>=3,`${file}: links to related guides`);
      }
      const slug=file.replace('.html',''); await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:path.join(evidence,`${slug}-r3-${width}.png`),fullPage:true}); await page.screenshot({path:path.join(evidence,`${slug}-header-r3-${width}.png`),fullPage:false});
      result.push({file,width,scroll:state.scroll,title:state.title.length,description:state.description.length,answerContrast:+state.answerRatio.toFixed(2),ctaContrast:+state.buttonRatio.toFixed(2)});
    }
    assert.deepEqual(errors,[],`JavaScript errors at ${width}: ${errors.join('; ')}`); await context.close();
  }
  await browser.close(); console.log(JSON.stringify({ok:true,keywordPhrases:terms.length,result,evidence},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
