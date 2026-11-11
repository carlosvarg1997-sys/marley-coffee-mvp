/* Barrido de cierre A8 para las rutas propiedad de A2. */
const { chromium } = require('../../qa/playwright-system-chrome.cjs');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const routes = [
  'captacion/contenidos/index.html',
  'captacion/contenidos/cafe-desayuno-hotel.html',
  'captacion/contenidos/como-elegir-maquina-cafe.html',
  'captacion/contenidos/como-evitar-quedarse-sin-cafe.html',
  'captacion/contenidos/comodato-maquina-de-cafe.html',
  'captacion/contenidos/comprar-arrendar-o-comodato.html',
  'captacion/contenidos/cuanto-cafe-necesita-mi-negocio.html',
  'captacion/soluciones/index.html',
  'captacion/soluciones/restaurantes.html',
  'captacion/soluciones/hoteles.html',
  'captacion/soluciones/cafeterias.html',
  'captacion/soluciones/oficinas.html',
  'captacion/soluciones/eventos-catering.html',
  'captacion/soluciones/conveniencia.html',
  'captacion/soluciones/panaderias.html',
  'captacion/seo/index.html'
];
const viewports = [
  { width:320, height:640 }, { width:360, height:800 },
  { width:390, height:844 }, { width:768, height:1024 },
  { width:1366, height:768 }, { width:1440, height:900 }
];
const summaryCounts = new Map([
  ['captacion/contenidos/cafe-desayuno-hotel.html',3],
  ['captacion/contenidos/como-elegir-maquina-cafe.html',3],
  ['captacion/contenidos/como-evitar-quedarse-sin-cafe.html',3],
  ['captacion/contenidos/comodato-maquina-de-cafe.html',3],
  ['captacion/contenidos/comprar-arrendar-o-comodato.html',3],
  ['captacion/contenidos/cuanto-cafe-necesita-mi-negocio.html',3],
  ['captacion/soluciones/restaurantes.html',3],
  ['captacion/soluciones/hoteles.html',3],
  ['captacion/soluciones/cafeterias.html',3],
  ['captacion/soluciones/oficinas.html',3],
  ['captacion/soluciones/eventos-catering.html',3],
  ['captacion/soluciones/conveniencia.html',3],
  ['captacion/soluciones/panaderias.html',3],
  ['captacion/seo/index.html',11]
]);

(async()=>{
  const base=process.argv[2];
  assert(base&&/^https?:\/\//.test(base),'Uso: node captacion/contenidos/comprobar_a8.cjs http://127.0.0.1:8890/');
  const browser=await chromium.launch({headless:true});
  const results=[]; const failures=[];
  for(const {width,height} of viewports){
    const context=await browser.newContext({viewport:{width,height},locale:'es-CL',isMobile:width<=390,hasTouch:width<=390});
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const route of routes){
      const url=new URL(route,base); url.searchParams.set('motion','off');
      await page.goto(url.href,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const state=await page.evaluate(()=>{
        const visible=el=>{const s=getComputedStyle(el);const closed=el.closest('details:not([open])');return el.getClientRects().length>0&&s.display!=='none'&&s.visibility!=='hidden'&&!el.closest('[hidden]')&&(!closed||(el.tagName==='SUMMARY'&&el.parentElement===closed))};
        const skip=document.querySelector('.nm-skip'); if(skip) skip.focus({preventScroll:true});
        const h1=[...document.querySelectorAll('h1')].filter(visible);
        const summaryMeasurements=[...document.querySelectorAll('summary')].filter(visible)
          .map((el,index)=>{const r=el.getBoundingClientRect();return {index:index+1,text:(el.innerText||'').trim().slice(0,100),width:r.width,height:r.height}});
        const targets=[...document.querySelectorAll('a,button,input,select,textarea,summary,[aria-expanded],[role="button"],[role="tab"]')]
          .filter(el=>visible(el)&&el.type!=='hidden')
          .map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,cls:el.className?.toString?.()||'',text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,70),width:r.width,height:r.height}})
          .filter(x=>x.width<44||x.height<44);
        const forbidden=['rgb(244, 241, 234)','rgb(243, 242, 239)','rgb(247, 247, 247)'];
        const cream=[...document.querySelectorAll('body *')].filter(el=>visible(el)&&forbidden.includes(getComputedStyle(el).backgroundColor)).map(el=>el.tagName+'.'+(el.className?.toString?.()||''));
        const robots=document.querySelector('meta[name="robots"]')?.content?.replace(/\s/g,'').toLowerCase()||'';
        const playingVideos=[...document.querySelectorAll('video')].filter(v=>!v.paused&&!v.ended).length;
        return {layoutWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,robots,h1Count:h1.length,h1Visible:!!h1[0],summaryMeasurements,smallTargets:targets,creamSurfaces:cream,playingVideos};
      });
      const item={route,width,height,...state}; results.push(item);
      if(state.layoutWidth!==width) failures.push({route,width,problem:`layoutWidth=${state.layoutWidth}`});
      if(state.scrollWidth>width) failures.push({route,width,problem:`horizontal overflow ${state.scrollWidth}>${width}`});
      if(state.robots!=='noindex,nofollow') failures.push({route,width,problem:`robots=${state.robots||'missing'}`});
      if(state.h1Count!==1||!state.h1Visible) failures.push({route,width,problem:`visible H1 count=${state.h1Count}`});
      const expectedSummaries=summaryCounts.get(route)||0;
      if(state.summaryMeasurements.length!==expectedSummaries) failures.push({route,width,problem:`visible summary count=${state.summaryMeasurements.length}; expected=${expectedSummaries}`});
      if(width<=1024&&state.summaryMeasurements.some(x=>x.height<44)) failures.push({route,width,problem:'summary below 44px',summaries:state.summaryMeasurements.filter(x=>x.height<44)});
      if(state.smallTargets.length) failures.push({route,width,problem:'targets below 44x44',targets:state.smallTargets});
      if(state.creamSurfaces.length) failures.push({route,width,problem:'forbidden cream surface',elements:state.creamSurfaces});
      if(state.playingVideos) failures.push({route,width,problem:`playing videos under reduced motion=${state.playingVideos}`});
    }
    if(errors.length) failures.push({width,problem:'page errors',errors});
    await context.close();
  }
  await browser.close();
  const evidence=path.join(__dirname,'evidencia','a8-r3-result.json');
  fs.mkdirSync(path.dirname(evidence),{recursive:true});
  fs.writeFileSync(evidence,JSON.stringify({ok:failures.length===0,routeCount:routes.length,viewportCount:viewports.length,results,failures},null,2));
  console.log(JSON.stringify({ok:failures.length===0,checked:results.length,failures,evidence},null,2));
  assert.equal(failures.length,0,'A8 A2 regression failures');
})().catch(e=>{console.error(e);process.exit(1)});
