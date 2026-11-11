/* Revisión HTTP, responsive, arte y accesibilidad del hub y sus seis piezas. */
const { chromium } = require('../../qa/playwright-system-chrome.cjs');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const files = ['index.html','cuanto-cafe-necesita-mi-negocio.html','comodato-maquina-de-cafe.html','comprar-arrendar-o-comodato.html','como-elegir-maquina-cafe.html','cafe-desayuno-hotel.html','como-evitar-quedarse-sin-cafe.html'];
const widths = [320,390,1440];
const ratio = (a,b) => { const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};const parse=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);const x=parse(a),y=parse(b);if(x.length!==3||y.length!==3)return 0;const l=c=>.2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);const [hi,lo]=[l(x),l(y)].sort((m,n)=>n-m);return (hi+.05)/(lo+.05); };

(async () => {
  const base = process.argv[2];
  assert(base && /^https?:\/\//.test(base), 'Uso: node captacion/contenidos/comprobar.cjs http://127.0.0.1:8890/captacion/contenidos/');
  const root = new URL(base);
  const evidence = path.join(__dirname, 'evidencia');
  fs.mkdirSync(evidence, { recursive:true });
  const browser = await chromium.launch({ headless:true });
  const result=[];
  for (const width of widths) {
    const context=await browser.newContext({viewport:{width,height:width<500?844:900},locale:'es-CL',isMobile:width<500,hasTouch:width<500});
    const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    for (const file of files) {
      const url=new URL(file,root); url.search='utm_source=busqueda&utm_medium=organic&utm_campaign=prueba_segura&mc_session=caso_1&mc_surface=serp&mc_query_id=q1&evil=secreto';
      await page.goto(url.href,{waitUntil:'networkidle'});
      const state=await page.evaluate(()=>{
        const outside=Array.from(document.querySelectorAll('h1,h2,h3,p,a,button,input,table,summary')).filter(el=>el.getClientRects().length&&!el.classList.contains('nm-skip')&&!el.closest('.ct-tabs')&&!el.closest('.ct-table-wrap')).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,left:r.left,right:r.right,text:(el.textContent||'').trim().slice(0,50)}}).filter(x=>x.left < -1 || x.right > innerWidth+1);
        const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent));
        const answer=document.querySelector('.ct-answer'); const answerText=answer?.querySelector('p');
        const contrast=(fg,bg)=>{const parse=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};const a=parse(fg),b=parse(bg);if(a.length!==3||b.length!==3)return 0;const lum=c=>.2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)};
        const cs=e=>getComputedStyle(e); const answerRatio=answer&&answerText?contrast(cs(answerText).color,cs(answer).backgroundColor):0;
        const button=document.querySelector('.ct-next .nm-btn,.ct-hero .nm-btn'); const buttonRatio=button?contrast(cs(button).color,cs(button).backgroundColor):0;
        const decor=document.querySelector('.ct-display-word'); const h1=document.querySelector('h1');
        const photos=[...document.querySelectorAll('.ct-feature-bleed img,.ct-hero picture img')];
        const lists=[...document.querySelectorAll('.ct-content ol')];
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,h1Count:document.querySelectorAll('h1').length,h1Text:h1?.innerText.trim(),robots:document.querySelector('meta[name="robots"]')?.content,title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,tabFit:!document.querySelector('.ct-tabs')||document.querySelector('.ct-tabs').scrollWidth<=document.querySelector('.ct-tabs').clientWidth+1,outside,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),ld,decorHidden:decor?.getAttribute('aria-hidden'),answerText:answerText?.innerText.trim(),answerBorder:answer?cs(answer).borderLeftColor:null,answerRatio,buttonRatio,photoSources:photos.map(i=>i.getAttribute('src')),photoReady:photos.every(i=>i.complete&&i.naturalWidth>0),steps:lists.map(e=>{const item=e.querySelector(':scope > li');const before=item?getComputedStyle(item,'::before'):null;return {columns:cs(e).gridTemplateColumns,items:e.querySelectorAll(':scope > li').length,numberContent:before?.content,numberColor:before?.color}})};
      });
      assert.equal(state.width,width,`${file} viewport`); assert(state.scroll<=width,`${file}: overflow ${state.scroll}px at ${width}`); assert.equal(state.h1Count,1,`${file}: one H1`);
      assert(state.h1Text.startsWith('¿')&&state.h1Text.endsWith('?'),`${file}: H1 must remain a complete question`);
      assert(state.robots?.replace(/\s/g,'').toLowerCase()==='noindex,nofollow',`${file}: robots`); assert(state.title.length<=60,`${file}: title ${state.title.length}`); assert(state.description.length<=155,`${file}: description ${state.description.length}`); assert(state.canonical.startsWith('https://empresas.marleycoffee.cl/'),`${file}: canonical`);
      assert.deepEqual(state.outside,[],`${file}: elements outside viewport ${JSON.stringify(state.outside)}`); assert.deepEqual(state.broken,[],`${file}: broken image`);
      assert.equal(state.decorHidden,'true',`${file}: giant decorative word must be aria-hidden`); assert(state.answerBorder.includes('243, 201, 0'),`${file}: answer border is not Marley yellow`); assert(state.answerRatio>=4.5,`${file}: answer contrast ${state.answerRatio.toFixed(2)}`); assert(state.buttonRatio>=4.5,`${file}: CTA contrast ${state.buttonRatio.toFixed(2)}`);
      assert(state.photoReady&&state.photoSources.some(src=>src?.includes('../../recursos/escenas/')),`${file}: local scene photo missing or unloaded`);
      if(width<=390) for(const step of state.steps){assert.equal(step.columns.trim().split(/\s+/).length,1,`${file}: steps must use one column at ${width}px`);assert(step.numberContent.includes('counter('),`${file}: numbered steps missing`);assert(step.numberColor.includes('243, 201, 0'),`${file}: step numbers not yellow`);}
      assert(!JSON.stringify(state.ld).includes('"@type":"Product"'),`${file}: forbidden Product schema`);
      const links=await page.locator('a[href]').evaluateAll(aa=>aa.map(a=>({href:a.href,external:a.origin!==location.origin,text:a.textContent.trim()})));
      assert(!links.some(a=>a.href.includes('/captacion/landing/')),`${file}: campaign landing link`);
      for(const link of links.filter(a=>!a.external)){const response=await fetch(link.href);assert(response.ok,`${file}: broken internal link ${link.href} (${response.status})`);}
      if(file==='index.html'){
        const tabNames=await page.getByRole('tab').allTextContents(); assert.deepEqual(tabNames.map(x=>x.trim()),['Respuestas','Guías','Calculadoras','Casos']); assert(state.tabFit,`${file}: tabs overflow`); assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);
        const card=page.locator('.ct-card').first(); const internal=new URL(await card.getAttribute('href'),page.url()); assert.equal(internal.search,'','internal card link stays clean');
        const handoff=new URL(await page.locator('[data-attribution-handoff]').first().getAttribute('href'),page.url()); assert.equal(handoff.searchParams.get('utm_source'),'busqueda'); assert.equal(handoff.searchParams.get('mc_query_id'),'q1'); assert.equal(handoff.searchParams.get('mc_entry_surface'),'serp'); assert(!handoff.searchParams.has('evil'));
        for(const tab of ['Respuestas','Guías','Calculadoras','Casos']){await page.getByRole('tab',{name:tab,exact:true}).click();assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);await page.screenshot({path:path.join(evidence,`hub-${tab.toLowerCase()}-r3-${width}.png`),fullPage:true});}
        await page.getByRole('tab',{name:'Respuestas',exact:true}).click();
      }
      if(file==='cuanto-cafe-necesita-mi-negocio.html'){
        await page.locator('#ct-consumo button').click(); assert((await page.locator('#ct-consumo-resultado').innerText()).includes('18,72 kg'));
        await page.fill('#cons-tazas','40');await page.fill('#cons-dias','22');await page.fill('#cons-gramos','18');await page.locator('#ct-consumo button').click();assert((await page.locator('#ct-consumo-resultado').innerText()).includes('15,84 kg'));
      }
      if(file==='como-evitar-quedarse-sin-cafe.html'){
        await page.locator('#ct-stock button').click();assert((await page.locator('#ct-stock-resultado').innerText()).includes('5 kg'));
        await page.fill('#stock-consumo','0.5');await page.fill('#stock-entrega','4');await page.fill('#stock-reserva','1');await page.locator('#ct-stock button').click();assert((await page.locator('#ct-stock-resultado').innerText()).includes('3 kg'));
      }
      if(file!=='index.html'){
        const faqs=await page.locator('.ct-faq summary').allTextContents(); const faqJson=state.ld.find(x=>x['@type']==='FAQPage');
        assert(faqJson,`${file}: FAQPage schema`); assert.deepEqual(faqJson.mainEntity.map(x=>x.name),faqs,`${file}: schema questions match visible FAQs`);
        assert(state.answerText.split(/[.!?]+/).filter(x=>x.trim()).length<=5,`${file}: direct answer exceeds five sentences`);
        assert(await page.locator('.ct-sources table').count(),`${file}: source table`); assert((await page.locator('.ct-sources').innerText()).includes('Consultado el 10 de noviembre de 2026'),`${file}: consultation date`);
        assert(await page.locator('.ct-related li').count()>=2,`${file}: related questions missing`);
        assert.equal(await page.locator('.ct-next [data-attribution-handoff]').count(),1,`${file}: one next step`);
        const next=new URL(await page.locator('.ct-next [data-attribution-handoff]').getAttribute('href'),page.url()); assert(next.pathname.endsWith('/index.html')&&next.hash==='#C03',`${file}: next step must go to the portal C03`); assert.equal(next.searchParams.get('mc_query_id'),'q1');
      }
      const slug=file.replace('.html',''); await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(evidence,`${slug}-r3-${width}.png`),fullPage:true});
      await page.screenshot({path:path.join(evidence,`${slug}-header-r3-${width}.png`),fullPage:false});
      result.push({file,width,scroll:state.scroll,title:state.title.length,description:state.description.length,answerContrast:+state.answerRatio.toFixed(2),ctaContrast:+state.buttonRatio.toFixed(2)});
    }
    assert.deepEqual(errors,[],`JavaScript errors at ${width}: ${errors.join('; ')}`); await context.close();
  }
  await browser.close(); console.log(JSON.stringify({ok:true,result,evidence},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
