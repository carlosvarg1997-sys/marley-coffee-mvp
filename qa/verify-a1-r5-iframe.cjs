// R5: mode, fictitious E3 prefill, iframe safety, prefixed paths and storage jumps.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'EVIDENCIA_10NOV');
const PREFIX = '/marley-coffee-mvp/';
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf' };
const fixtures = {
  P1: { nombre:'Camila Rojas', correo:'camila.rojas@example.com', empresa:'Restaurante ficticio 01 · Patio del Sur', telefono:'+56 9 0000 0001', perfil:'restaurante' },
  P4: { nombre:'Daniela Fuentes', correo:'daniela.fuentes@example.com', empresa:'Oficina ficticia 04 · Norte Claro', telefono:'+56 9 0000 0004', perfil:'oficina' },
};
const report = { base:'lab.test under /marley-coffee-mvp/', cases:[], wheel:[], modes:[], consoleErrors:[] };

function startServer() {
  const server = http.createServer((req,res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400).end(); return; }
    if (pathname.startsWith(PREFIX)) pathname = '/' + pathname.slice(PREFIX.length);
    const target = path.resolve(ROOT, '.' + pathname);
    const relative = path.relative(ROOT,target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    fs.stat(target,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404).end();return;}
      const headers={'Content-Type':MIME[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
      const range=req.headers.range;
      if(range&&/\.mp4$/i.test(target)){
        const match=/bytes=(\d+)-(\d*)/.exec(range);
        if(match){const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):stat.size-1,stat.size-1);headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers);fs.createReadStream(target,{start,end}).pipe(res);return;}
      }
      headers['Content-Length']=stat.size;res.writeHead(200,headers);fs.createReadStream(target).pipe(res);
    });
  });
  return new Promise((resolve,reject)=>{
    const tryPort=(port)=>{server.once('error',(error)=>{if(error.code==='EADDRINUSE'&&port<8910)tryPort(port+1);else reject(error);});server.listen(port,'127.0.0.1',()=>resolve({server,port}));};
    tryPort(8894);
  });
}

function localStatus(port,relativePath) {
  return new Promise((resolve,reject)=>{
    const request=http.request({hostname:'127.0.0.1',port,path:`${PREFIX}${relativePath}`,method:'HEAD'},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
    request.once('error',reject);request.end();
  });
}

function sessionFor(pathway,participant,mode='autoguiado') {
  const ficha=fixtures[participant];
  return {id:`QA-R5-${pathway}-${participant}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,participante:participant,camino:pathway,rol:'externo',perfil:ficha.perfil,modo:mode,estado:'en_recorrido',fases_hechas:[],ficha:{nombre:ficha.nombre,correo:ficha.correo,empresa:ficha.empresa,telefono:ficha.telefono}};
}

async function choose(host,pathway='A',participant='P1',mode='autoguiado') {
  await host.goto(host._r5Host,{waitUntil:'domcontentloaded'});
  await host.locator('#camino').selectOption(pathway);
  await host.locator('#participante').selectOption(participant);
  await host.locator('#modo').selectOption(mode);
  await host.locator('#abrir').click();
  const session=await host.evaluate(()=>window.__qaSession);
  await host.waitForFunction(()=>document.querySelector('#recorrido')?.contentWindow?.location?.href!=='about:blank',{},{timeout:10000}).catch(()=>{});
  await host.waitForFunction(()=>document.querySelector('#estado')?.textContent.includes('modo'),null,{timeout:5000});
  return session;
}

async function currentFrame(host,pattern=/index\.html|captacion\/landing\//) {
  await host.waitForFunction(()=>{try{return document.querySelector('#recorrido')?.contentWindow?.document?.readyState==='complete';}catch(_){return false;}},null,{timeout:15000});
  const frame=host.frames().find((item)=>item!==host.mainFrame()&&pattern.test(item.url()));
  if(!frame)throw new Error(`No aparece el iframe del recorrido: ${host.url()}`);
  return frame;
}

async function wheel(host,frame,label) {
  const before=await frame.evaluate(()=>({y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),x:document.documentElement.scrollWidth,w:innerWidth}));
  const rect=await host.locator('#recorrido').boundingBox();
  await host.mouse.move(rect.x+Math.max(12,rect.width/2),rect.y+Math.max(55,Math.min(rect.height-12,rect.height/2)));
  await host.mouse.wheel(0,Math.max(400,Math.min(700,before.max||400)));
  await host.waitForTimeout(90);
  const after=await frame.evaluate(()=>({y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),x:document.documentElement.scrollWidth,w:innerWidth}));
  assert.ok(after.x<=after.w+1,`${label}: no horizontal overflow (${after.x}/${after.w})`);
  report.wheel.push({label,before,after,usedMouseWheel:true});
  await frame.evaluate(()=>window.scrollTo(0,0));
  return after;
}

async function wheelClickInFrame(host,frame,selector,label) {
  const card=frame.locator('#m4t .m4t-card').first(),cardBox=await card.boundingBox(),iframeBox=await host.locator('#recorrido').boundingBox();
  for(let i=0;i<9;i++){
    const target=frame.locator(selector),rect=await target.evaluate(element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,viewport:innerHeight};});
    if(rect.top>=0&&rect.top+rect.height<=rect.viewport){
      const x=iframeBox.x+rect.left+rect.width/2,y=iframeBox.y+rect.top+rect.height/2;
      await host.mouse.click(x,y);
      await frame.waitForTimeout(80);
      return;
    }
    await host.mouse.move(cardBox.x+cardBox.width/2,cardBox.y+cardBox.height/2);
    await host.mouse.wheel(0,620);
    await frame.waitForTimeout(90);
  }
  throw new Error(`${label}: ${selector} stayed outside the iframe viewport after mouse wheel`);
}

async function capture(host,name) {
  const out=path.join(EVIDENCE,name);
  await host.screenshot({path:out,fullPage:true});
  return out;
}

async function prefillCase(browser,base,participant,pathway) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const host=await context.newPage();host._r5Host=`${base}/qa/a1-r5-iframe-host.html`;
  const errors=[];host.on('pageerror',error=>errors.push(error.message));host.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const session=await choose(host,pathway,participant,'autoguiado');
  const frame=await currentFrame(host,/index\.html|captacion\/landing\//);
  const fixture=fixtures[participant];
  if(pathway==='A'){
    await frame.locator('#m4Contact').waitFor({state:'visible',timeout:12000});
    const values=await frame.locator('#m4Contact').evaluate(form=>({name:form.querySelector('#m4FName')?.value,email:form.querySelector('#m4FEmail')?.value,phone:form.querySelector('#m4FPhone')?.value,companyField:Boolean(form.querySelector('[name="company"],[name="empresa"]')),consent:form.querySelector('#m4FConsent')?.checked,marketing:form.querySelector('#m4FMarketing')?.checked,formEvents:M4.get().events.filter(event=>event.key==='form1').length,leadEmail:M4.get().lead?.email||''}));
    assert.equal(values.name,fixture.nombre);assert.equal(values.email,fixture.correo);assert.ok(values.phone.replace(/\D/g,'').endsWith(participant==='P1'?'00000001':'00000004'));assert.equal(values.companyField,false,'portal E3 does not include an empresa field');assert.equal(values.consent,false);assert.equal(values.marketing,false);assert.equal(values.formEvents,0);assert.equal(values.leadEmail,'');
    await wheel(host,frame,`${pathway}/${participant}/C03 E3 portal @390`);
    await capture(host,`A1_r5_E3_portal_${participant}_390.png`);
    const mode=await frame.evaluate(()=>({hidden:document.documentElement.classList.contains('mc-kit-hide-m4t'),cards:document.querySelectorAll('#a1-remote-cards').length,more:document.querySelector('#m4tMore')?getComputedStyle(document.querySelector('#m4tMore')).display:'absent'}));
    assert.equal(mode.hidden,true,'autoguiado oculta el control del moderador');assert.equal(mode.cards,0,'autoguiado no monta las tarjetas remotas');
    report.cases.push({pathway,participant,session:session.id,portalPrefill:values,mode});
  } else {
    await frame.locator('#ld-form').waitFor({state:'visible',timeout:12000});
    const values=await frame.locator('#ld-form').evaluate(form=>({name:form.elements.nombre?.value,email:form.elements.correo?.value,company:form.elements.empresa?.value,phone:form.elements.telefono?.value,consent:form.elements.consent?.checked,marketing:form.elements.marketing?.checked,lead:localStorage.getItem('mc_landing_lead_v1'),draft:localStorage.getItem('mc_landing_draft_v1')}));
    assert.equal(values.name,fixture.nombre);assert.equal(values.email,fixture.correo);assert.equal(values.company,fixture.empresa);assert.equal(values.phone,fixture.telefono);assert.equal(values.consent,false);assert.equal(values.marketing,false);assert.equal(values.lead,null);assert.equal(values.draft,null);
    await wheel(host,frame,`${pathway}/${participant}/landing E3 @390`);
    await capture(host,`A1_r5_E3_landing_${participant}_390.png`);
    report.cases.push({pathway,participant,session:session.id,landingPrefill:values});
  }
  assert.deepEqual(errors,[],`${pathway}/${participant}: console/page errors`);report.consoleErrors.push(...errors);
  await context.close();
}

async function sendJump(writer,sessionId,days) {
  const nonce=`QA-${days}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  await writer.evaluate(({days,sessionId,nonce})=>localStorage.setItem('mc_prueba_salto_v1',JSON.stringify({dias:days,sesion_id:sessionId,at:Date.now(),nonce})),{days,sessionId,nonce});
  return nonce;
}

async function completeJourney(browser,base,pathway,participant) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const host=await context.newPage();host._r5Host=`${base}/qa/a1-r5-iframe-host.html`;
  const errors=[];host.on('pageerror',error=>errors.push(error.message));host.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const session=await choose(host,pathway,participant,'autoguiado');
  let frame=await currentFrame(host,/index\.html|captacion\/landing\//);
  const fixture=fixtures[participant];
  const writer=await context.newPage();writer.on('pageerror',error=>errors.push(error.message));await writer.goto(`${base}/qa/a1-r5-iframe-host.html?writer=1`,{waitUntil:'domcontentloaded'});

  if(pathway==='A'){
    await frame.locator('#m4FConsent').check();
    await frame.locator('#m4FMarketing').check();
    await frame.locator('#m4Contact button[type="submit"]').click();
    await frame.waitForFunction(()=>String(location.hash).startsWith('#C04'),null,{timeout:12000});
  }else{
    await frame.locator('#f-consent').check();
    await frame.locator('#f-marketing').check();
    await frame.locator('fieldset[data-paso="1"] button[type="submit"]').click();
    await frame.locator('#f-empresa').fill(fixture.empresa);
    await frame.locator('#f-telefono').fill(fixture.telefono);
    await frame.locator('[data-accion="enviar"]').click();
    await frame.locator('#ld-exito').waitFor({state:'visible'});
    const handoff=new URL(await frame.locator('#ld-continuar').getAttribute('href'),frame.url());
    assert.match(handoff.pathname,/\/marley-coffee-mvp\/index\.html$/,'landing handoff preserves GitHub Pages prefix');
    assert.ok(!decodeURIComponent(handoff.href).includes(fixture.nombre));
    await frame.locator('#ld-continuar').click();
    await frame.waitForFunction(()=>String(location.hash).startsWith('#C04'),null,{timeout:12000});
  }
  await frame.locator('.m5-qcard').waitFor({state:'visible',timeout:12000});
  await frame.waitForFunction(()=>M4.get().customerCycle&&M4.get().customerCycle.accountId,null,{timeout:10000});
  let state=await frame.evaluate(()=>({test:M4.TEST,score:M4.score(),email:M4.get().lead.email,company:M4.get().lead.company,consent:M4.get().lead.consent,marketing:M4.get().lead.marketingConsent,events:M4.get().events.filter(event=>event.key==='form1').length,leadCreated:M4.get().events.filter(event=>event.eventName==='lead_created').length,landing:Boolean(M4.get().lead.landing?.id),cards:document.querySelectorAll('#a1-remote-cards').length}));
  assert.equal(state.email,fixture.correo);assert.equal(state.consent,true);assert.equal(state.marketing,true);assert.equal(state.events,1);assert.equal(state.leadCreated,1);assert.equal(state.cards,0);assert.equal(state.landing,pathway!=='A');
  await wheel(host,frame,`${pathway}/${participant}/C04 E2 diagnóstico @390`);
  if(pathway==='A')await capture(host,`A1_r5_E3_portal_${participant}_390.png`);

  await frame.locator('[data-a="answer"][data-k="negocio"]').first().click();
  await frame.locator('[data-a="next"]').click();
  await frame.locator('#m5Comuna').selectOption({label:'Las Condes'});
  await frame.locator('[data-a="next"]').click();
  await frame.locator('[data-a="next"]').click();
  await frame.waitForFunction(()=>String(location.hash).startsWith('#C10'),null,{timeout:10000});
  await frame.locator('.m9-catalog').waitFor({state:'visible'});
  await wheel(host,frame,`${pathway}/${participant}/C10 productos @390`);
  await frame.locator('#m9-continue').click();
  await frame.waitForFunction(()=>String(location.hash).startsWith('#C04'),null,{timeout:10000});
  await frame.locator('.m5-qcard').waitFor({state:'visible'});
  await frame.locator('[data-a="next"]').click();
  await frame.waitForFunction(()=>String(location.hash).startsWith('#C05'),null,{timeout:10000});
  await frame.locator('.m5-propsec').waitFor({state:'visible'});
  // Haiku P3: la bandeja de seguimiento pasó a C09 (<details> «Mensajes de seguimiento»); no se espera en C05.
  await frame.waitForFunction(()=>window.MarleyPrueba?.estado?.().propuestaVisible===true,null,{timeout:8000});
  await wheel(host,frame,`${pathway}/${participant}/C05 propuesta E4-E5 @390`);
  await capture(host,`A1_r5_E5_${pathway.replace(/[^A-Za-z0-9]/g,'_')}_390.png`);
  let api=await frame.evaluate(()=>MarleyPrueba.estado());
  assert.equal(api.pantalla,'C05');assert.equal(api.leadIdentificado,true);assert.equal(api.propuestaVisible,true);assert.equal(api.contratoFirmado,false);

  const nonce3=await sendJump(writer,session.id,3);
  await frame.waitForFunction((nonce)=>Boolean(M4.get().customerCycle?.timeJumps?.['3'])&&Boolean(M4.get().customerCycle?.moderatorJumpNonces?.[nonce]),nonce3,{timeout:10000});
  assert.equal(await frame.evaluate(()=>M4.get().emails.filter(item=>item.journeyCode==='E03').length),1,'three-day storage jump creates E03 once');
  api=await frame.evaluate(()=>MarleyPrueba.estado());assert.equal(api.saltos[3],true);

  await frame.locator('[data-a="accept-prop"]').click();
  await frame.waitForFunction(()=>String(location.hash).startsWith('#C06'),null,{timeout:10000});
  await frame.getByRole('button',{name:'Simular firma de contrato'}).click();
  await frame.getByText('Contrato simulado registrado',{exact:false}).waitFor();
  await frame.waitForFunction(()=>MarleyPrueba.estado().contratoFirmado===true,null,{timeout:8000});
  api=await frame.evaluate(()=>MarleyPrueba.estado());assert.equal(api.contratoFirmado,true);
  await wheel(host,frame,`${pathway}/${participant}/C06 alta @390`);
  await frame.getByRole('link',{name:'Ir a Mi cuenta'}).click();
  await frame.waitForFunction(()=>String(location.hash).startsWith('#C09'),null,{timeout:10000});
  await frame.locator('.m5-cycle-head').waitFor({state:'visible'});

  const nonce30=await sendJump(writer,session.id,30);
  await frame.waitForFunction((nonce)=>Boolean(M4.get().customerCycle?.timeJumps?.['30'])&&Boolean(M4.get().customerCycle?.moderatorJumpNonces?.[nonce]),nonce30,{timeout:10000});
  await frame.getByRole('button',{name:'Confirmar pedido'}).waitFor({state:'visible'});
  assert.equal(await frame.evaluate(()=>M4.get().emails.filter(item=>item.journeyCode==='E08').length),1,'one-month storage jump creates E08 once');
  await frame.getByRole('button',{name:'Confirmar pedido'}).click();
  // Diseño ronda 3: «Repetir pedido» abre la confirmación con cantidades; el primero es el pedido más reciente.
  await frame.getByRole('button',{name:'Repetir pedido'}).first().click();
  await frame.getByRole('button',{name:'Confirmar pedido'}).click();
  await wheel(host,frame,`${pathway}/${participant}/C09 reposición E7 @390`);
  // Diseño R3 (13-nov): ayuda por tipo de problema; «Hablar con una persona» abre el caso.
  await frame.locator('[data-r3-support-type="El café no sale como antes"]').click();
  await frame.locator('[data-r3-talk]').click();
  await frame.getByText(/Caso \S+ abierto/).first().waitFor();
  const csat=frame.locator('form[data-cycle-form="csat"]');
  await csat.locator('[name="score"]').selectOption('4');
  await csat.locator('[name="comment"]').fill('La atención fue clara y pude dejar mi consulta.');
  await csat.locator('button[type="submit"]').click();
  await frame.getByText('CSAT: 4/5',{exact:false}).waitFor();
  await frame.locator('[data-cycle-nps="10"]').click();
  // Diseño ronda 3: confirmar el permiso del otro negocio antes de preparar el enlace.
  await frame.getByLabel('Confirmo que el otro negocio me dio su permiso',{exact:false}).check();
  await frame.getByRole('button',{name:'Preparar recomendación'}).click();
  const referral=frame.getByRole('link',{name:'Abrir enlace con UTM de referido'});
  const referralURL=new URL(await referral.getAttribute('href'),frame.url());
  assert.match(referralURL.pathname,/\/marley-coffee-mvp\/captacion\/landing\//,'referral link preserves the GH Pages prefix');
  assert.equal(referralURL.searchParams.get('utm_source'),'referido');
  await frame.getByRole('button',{name:'Registrar envío simulado'}).click();
  await frame.waitForFunction(()=>M4.get().events.filter(event=>event.eventName==='referral_sent').length===1,null,{timeout:8000});
  await wheel(host,frame,`${pathway}/${participant}/C09 E8-E9 recomendación @390`);
  await capture(host,`A1_r5_E9_${pathway.replace(/[^A-Za-z0-9]/g,'_')}_390.png`);
  const final=await frame.evaluate(()=>({api:MarleyPrueba.estado(),counts:Object.fromEntries(['contract_signed','order_confirmed','repeat_order_confirmed','support_case_opened','csat_submitted','referral_sent'].map(name=>[name,M4.get().events.filter(event=>event.eventName===name).length])),emails:M4.get().emails.filter(item=>['E03','E06','E08','E10','E11'].includes(item.journeyCode)).map(item=>item.journeyCode),blankInternal:[...document.querySelectorAll('a[target="_blank"]')].filter(anchor=>{try{return new URL(anchor.href,location.href).origin===location.origin;}catch(_){return false;}}).length,modeHidden:document.documentElement.classList.contains('mc-kit-hide-m4t'),cards:document.querySelectorAll('#a1-remote-cards').length}));
  assert.deepEqual(final.counts,{contract_signed:1,order_confirmed:1,repeat_order_confirmed:1,support_case_opened:1,csat_submitted:1,referral_sent:1});
  assert.deepEqual(final.emails.sort(),['E03','E06','E08','E10','E11'].sort());
  assert.equal(final.api.saltos[3],true);assert.equal(final.api.saltos[30],true);assert.equal(final.api.contratoFirmado,true);assert.equal(final.blankInternal,0);assert.equal(final.modeHidden,true);assert.equal(final.cards,0);

  const wheelMatrix=[];
  for(const [width,height] of [[360,800],[390,844],[414,896],[768,1024],[1440,900]]){
    await host.setViewportSize({width,height});
    for(const route of ['C03','C04','C05','C06','C09']){
      await frame.evaluate(value=>{location.hash='#'+value;},route);
      await frame.waitForFunction(value=>document.body.dataset.current===value,route,{timeout:8000});
      const dims=await wheel(host,frame,`${pathway}/${participant}/${route} @${width}`);
      wheelMatrix.push({route,width,height,overflow:dims.x-dims.w,documentHeight:dims.max});
    }
  }
  await host.setViewportSize({width:390,height:844});
  await frame.evaluate(()=>parent.postMessage({m4t:'salir'},'*'));
  await host.waitForFunction(()=>document.body.dataset.m4tMessage==='salir',null,{timeout:5000});
  await frame.evaluate(()=>parent.postMessage({m4t:'nuevo'},'*'));
  await host.waitForFunction(()=>document.body.dataset.m4tMessage==='nuevo',null,{timeout:5000});
  assert.deepEqual(errors,[],`${pathway}/${participant}: no browser or console errors`);
  report.consoleErrors.push(...errors);report.cases.push({pathway,participant,session:session.id,lead:state,final,wheelMatrix});
  await context.close();
}

async function testModesAndPrefixedKit(browser,base) {
  for(const mode of ['local','remoto','autoguiado']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),host=await context.newPage();host._r5Host=`${base}/qa/a1-r5-iframe-host.html`;
    const session=await choose(host,'A','P1',mode);let frame=await currentFrame(host,/index\.html/);
    let actual=await frame.evaluate(()=>({hidden:document.documentElement.classList.contains('mc-kit-hide-m4t'),rootDisplay:document.querySelector('#m4t')?getComputedStyle(document.querySelector('#m4t')).display:'absent',more:document.querySelector('#m4tMore')?getComputedStyle(document.querySelector('#m4tMore')).display:'absent',cards:document.querySelectorAll('#a1-remote-cards').length,action:document.querySelector('#a1-remote-cards a[data-a1-card-action]')?.href||''}));
    assert.equal(actual.hidden,mode==='remoto'||mode==='autoguiado');
    if(mode==='local'){
      await frame.locator('button[data-q="cliente"]').click();
      await frame.locator('button[data-p="restaurante"]').click();
      await frame.locator('#m4tNombre').fill('Participante QA');
      const card=frame.locator('#m4t .m4t-card').first();
      const beforeCardScroll=await card.evaluate(element=>element.scrollTop);
      await wheelClickInFrame(host,frame,'#m4tOk','A local consent');
      const afterCardScroll=await card.evaluate(element=>element.scrollTop);
      assert.ok(afterCardScroll>beforeCardScroll,'M4T local setup card scrolls with the mouse wheel');
      report.wheel.push({label:'A/local/M4T consentimiento @390',before:{card:beforeCardScroll},after:{card:afterCardScroll},usedMouseWheel:true});
      assert.equal(await frame.locator('#m4tOk').isChecked(),true,'A local consent clicked after scrolling');
      if(await frame.locator('#m4tRec').count())await frame.locator('#m4tRec').uncheck();
      await wheelClickInFrame(host,frame,'#m4tGo','A local start test');
      frame=await currentFrame(host,/serp-seo-aeo-geo\.html/);await wheel(host,frame,'A/local búsqueda simulada @390');
      const searchState=await frame.evaluate(()=>JSON.parse(localStorage.getItem('m4test:sesion:sitio')||'null'));
      assert.ok(searchState?.journey?.type==='google-search-simulation','A local test reached the simulated search');
      const resume=new URL('../index.html',frame.url());resume.search=new URLSearchParams({test:'sitio',journey:'resume',journey_started_at:String(searchState.journey.startedAt),tipo:'cliente',negocio:'restaurante',return:'index.html',pid:'P1',sid:searchState.journey.id}).toString();resume.hash='C03';
      await frame.goto(resume.toString());frame=await currentFrame(host,/index\.html/);
      await frame.locator('#m4tMore').waitFor({state:'visible',timeout:12000});
      actual=await frame.evaluate(()=>({hidden:document.documentElement.classList.contains('mc-kit-hide-m4t'),rootDisplay:document.querySelector('#m4t')?getComputedStyle(document.querySelector('#m4t')).display:'absent',more:document.querySelector('#m4tMore')?getComputedStyle(document.querySelector('#m4tMore')).display:'absent',cards:document.querySelectorAll('#a1-remote-cards').length,action:''}));
      assert.notEqual(actual.more,'none','local moderated session keeps the M4T button visible');
      await capture(host,'A1_r5_M4T_local_390.png');
    }
    if(mode==='remoto'){
      assert.equal(actual.cards,1,'remote mode alone shows the participant pause card');
      const pauseURL=new URL(actual.action);
      assert.match(pauseURL.pathname,/\/marley-coffee-mvp\/PRUEBA_CON_PERSONAS\/RONDA_FINAL_E0_E9\/sesion\.html$/);
      assert.equal(pauseURL.searchParams.get('fase'),'pausa1');
      const response=await frame.evaluate(async href=>(await fetch(href,{method:'HEAD'})).status,actual.action);
      assert.equal(response,200,'KIT_PATH works under the GitHub Pages subfolder');
    }
    if(mode==='autoguiado'){assert.ok(['none','absent'].includes(actual.rootDisplay),'autoguiado suppresses the M4T modal as well as its button');assert.equal(actual.more,'absent');await capture(host,'A1_r5_M4T_autoguiado_390.png');}
    report.modes.push({mode,session:session.id,...actual});
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),host=await context.newPage();host._r5Host=`${base}/qa/a1-r5-iframe-host.html`;
  await choose(host,'B-Google','P1','local');
  let frame=await currentFrame(host,/index\.html/);
  await frame.locator('button[data-q="cliente"]').click();await frame.locator('button[data-p="restaurante"]').click();
  await frame.locator('#m4tNombre').fill('Participante QA');
  const card=frame.locator('#m4t .m4t-card').first();
  const before=await card.evaluate(element=>element.scrollTop);
  await wheelClickInFrame(host,frame,'#m4tOk','B-Google local consent');
  const after=await card.evaluate(element=>element.scrollTop);assert.ok(after>before,'B-Google local M4T card scrolls with the mouse wheel');
  assert.equal(await frame.locator('#m4tOk').isChecked(),true,'B-Google local consent clicked after scrolling');
  report.wheel.push({label:'B-Google/local/M4T consentimiento @390',before:{card:before},after:{card:after},usedMouseWheel:true});
  if(await frame.locator('#m4tRec').count())await frame.locator('#m4tRec').uncheck();
  await wheelClickInFrame(host,frame,'#m4tGo','B-Google local start test');
  frame=await currentFrame(host,/serp-seo-aeo-geo\.html/);await wheel(host,frame,'B-Google/local búsqueda simulada @390');
  await frame.locator('#query').fill('café para restaurantes');await frame.locator('#search button[type="submit"]').click();
  await frame.locator('#results:not([hidden])').waitFor({state:'visible'});await wheel(host,frame,'B-Google/local resultados @390');
  await frame.locator('#sponsored-title').click();frame=await currentFrame(host,/captacion\/landing\//);await wheel(host,frame,'B-Google/local landing @390');
  await frame.locator('#f-consent').check();await frame.locator('#f-marketing').check();
  await frame.locator('fieldset[data-paso="1"] button[type="submit"]').click();
  await frame.locator('#f-empresa').fill(fixtures.P1.empresa);await frame.locator('#f-telefono').fill(fixtures.P1.telefono);
  await frame.locator('[data-accion="enviar"]').click();await frame.locator('#ld-exito').waitFor({state:'visible'});
  await frame.locator('#ld-continuar').click();frame=await currentFrame(host,/index\.html/);await frame.locator('#m4tMore').waitFor({state:'visible',timeout:12000});
  const actual=await frame.evaluate(()=>({more:getComputedStyle(document.querySelector('#m4tMore')).display,hidden:document.documentElement.classList.contains('mc-kit-hide-m4t')}));
  assert.equal(actual.hidden,false);assert.notEqual(actual.more,'none','B-Google local session keeps the M4T button visible');
  await capture(host,'A1_r5_M4T_local_B-Google_390.png');report.modes.push({mode:'local',pathway:'B-Google',session:await host.evaluate(()=>window.__qaSession.id),...actual});
  await context.close();
}

async function main() {
  fs.mkdirSync(EVIDENCE,{recursive:true});
  const {server,port}=await startServer();
  const base=`http://lab.test:${port}${PREFIX.slice(0,-1)}`;
  const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP lab.test 127.0.0.1']});
  try {
    assert.equal(await localStatus(port,'index.html'),200);
    assert.equal(await localStatus(port,'PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/sesion.html'),200);
    const modesOnly=process.argv.includes('--modes-only');
    if(!modesOnly){
      await prefillCase(browser,base,'P1','A');
      await prefillCase(browser,base,'P4','A');
      await prefillCase(browser,base,'P1','B-Meta');
      await completeJourney(browser,base,'A','P1');
      await completeJourney(browser,base,'B-Meta','P1');
    }
    await testModesAndPrefixedKit(browser,base);
    const portal=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    assert.doesNotMatch(portal,/KIT_PATH\s*=\s*['"]\//,'KIT_PATH is relative');
    assert.doesNotMatch(portal,/return `\$\{location\.origin\}\/captacion\//,'referral URLs are relative to the deployment prefix');
    assert.doesNotMatch(portal,/window\.top\.location/,'portal does not navigate the top window');
    assert.ok(portal.includes("fetch('/api/ping'"),'the existing local-only ping remains in place');
    const pingAt=portal.indexOf("fetch('/api/ping'");const pingGuard=portal.slice(Math.max(0,pingAt-150),pingAt);
    assert.ok(pingGuard.includes('localhost')&&pingGuard.includes('location.hostname'),'the existing ping is guarded to localhost');
    fs.writeFileSync(path.join(EVIDENCE,'A1_r5_report.json'),JSON.stringify(report,null,2));
    console.log(`PASS R5 · ${report.cases.length} cases · ${report.wheel.length} wheel checks · ${report.modes.length} modes · ${report.consoleErrors.length} console errors`);
  } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
