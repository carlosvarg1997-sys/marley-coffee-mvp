'use strict';

// R6 · Ventas (Codex). Chrome + Edge, 390×844 y 1440×900.
// Usa el servidor local indicado por la tanda; no modifica los datos canónicos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const BASE_INPUT = process.argv[2] || 'http://127.0.0.1:8880';
const BASE_URL = new URL(BASE_INPUT);
const BASE = BASE_URL.pathname.replace(/\/$/, '').endsWith('/index.html')
  ? BASE_URL.origin + BASE_URL.pathname.replace(/\/index\.html\/?$/, '')
  : BASE_URL.origin + BASE_URL.pathname.replace(/\/$/, '');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROUTES = [
  ['R01','Atender hoy'],['R02','Conversaciones'],['R08','Cotizaciones'],['R03','Clientes y recompras']
];
const SIZES = [{width:390,height:844},{width:1440,height:900}];
const results = [];

const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const urlFor = (route='') => BASE.replace(/\/$/,'') + '/index.html' + (route ? '#' + route : '');
const visible = el => {
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.02;
};

async function newPage(browser,size) {
  const context=await browser.newContext({
    viewport:{width:size.width,height:size.height},
    isMobile:size.width<768,hasTouch:size.width<768
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(urlFor(),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.M4&&window.M4R&&window.R6P&&window.MarleyApp,{timeout:10000});
  return {context,page,errors};
}

async function go(page,role,route) {
  await page.evaluate(({role,route})=>{
    M4.setRole(role);
    MarleyApp.go(route,{evaluation:true});
  },{role,route});
  await page.waitForFunction(route=>document.body.dataset.current===route,route,{timeout:8000});
  await page.waitForTimeout(60);
}

async function signature(page) {
  return page.evaluate(()=>JSON.stringify({
    hash:location.hash,screen:document.body.dataset.current,
    text:document.querySelector('#m4-main')?.innerText||'',
    rev:M4.get()?.rev,selected:M4.get()?.sel,
    states:[...document.querySelectorAll('#m4-main details')].map(x=>x.open),
    toast:document.querySelector('#m4-toasts')?.innerText||''
  }));
}

async function clickSafe(target) {
  assert.ok(await target.count(),'control no encontrado');
  await target.scrollIntoViewIfNeeded({timeout:2500}).catch(()=>{});
  await target.click({timeout:3000}).catch(async()=>target.evaluate(el=>el.click()));
}

async function clickResponse(page,target,label) {
  const before=await signature(page);
  await target.scrollIntoViewIfNeeded({timeout:2500}).catch(()=>{});
  const elapsed=await target.evaluate(el=>{
    const start=performance.now();
    el.click();
    return Math.round((performance.now()-start)*100)/100;
  });
  await page.waitForTimeout(120);
  const after=await signature(page);
  assert.notEqual(after,before,label+' no produjo cambio visible ni de estado');
  assert.ok(elapsed<=400,label+' tardó '+elapsed+' ms');
  return elapsed;
}

async function screenMetrics(page) {
  return page.evaluate(()=>{
    const visible=el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      if(!(r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.02))return false;
      for(let p=el.parentElement;p;p=p.parentElement){
        if(p.hidden||(p.tagName==='DETAILS'&&!p.open&&el!==p.querySelector('summary')&&!p.querySelector('summary')?.contains(el)))return false;
      }
      return true;
    };
    const h1=[...document.querySelectorAll('h1')].find(x=>!x.classList.contains('b2c-sr-only'));
    const small=[...document.querySelectorAll('#m4-main button:not([disabled]),#m4-main a[href],#m4-main summary,#m4-main input,#m4-main select,#m4-main textarea')]
      .filter(visible).map(el=>({text:(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().slice(0,45),h:Math.round(el.getBoundingClientRect().height),w:Math.round(el.getBoundingClientRect().width)}))
      .filter(x=>x.h<43.5||x.w<43.5);
    return {
      screen:document.body.dataset.current,
      h1:h1?.textContent.trim()||'',
      height:document.documentElement.scrollHeight,
      width:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
      smallControls:small,
      emptyControls:[...document.querySelectorAll('#m4-main button,#m4-main a[href]')].filter(visible)
        .filter(el=>!(el.innerText||'').trim()&&!el.getAttribute('aria-label')).length
    };
  });
}

async function auditRoutes(browser,browserName) {
  for(const size of SIZES) {
    const {context,page,errors}=await newPage(browser,size);
    try {
      const entries=await page.evaluate(()=>{
        M4.setRole('ventas');
        return M4D.ROLE_MENUS.ventas.menu.map(x=>[x[0],x[1]]);
      });
      assert.deepEqual(entries,ROUTES,'menú de Ventas debe tener cuatro rutas y nombres acordados');
      for(const [route,label] of ROUTES) {
        await go(page,'ventas',route);
        const m=await screenMetrics(page);
        results.push({browser:browserName,viewport:size.width+'×'+size.height,route,metric:m});
        assert.equal(m.screen,route);
        assert.equal(m.h1,label,'el H1 debe coincidir con la entrada del menú '+route);
        assert.equal(m.scrollWidth,m.width,'desborde horizontal en '+route+' a '+size.width);
        assert.equal(m.emptyControls,0,'control sin nombre en '+route);
        if(route==='R01'&&size.width===1440)assert.ok(m.height<=1300,'R01 supera 1300 px: '+m.height);
        if(route==='R02'&&size.width===390)assert.ok(m.height<=2500,'R02 supera 2500 px: '+m.height);
        assert.deepEqual(m.smallControls,[],'controles menores de 44 px en '+route+' '+size.width+': '+JSON.stringify(m.smallControls));
      }
      await go(page,'ventas','R10');
      const m10=await screenMetrics(page);
      assert.equal(m10.h1,'Clientes y recompras','R10 debe volver a la sección de agenda con el nombre vigente');
      assert.equal(m10.scrollWidth,m10.width);
      assert.deepEqual(m10.smallControls,[]);
      assert.deepEqual(errors,[],'errores de JavaScript en '+browserName);
    } finally { await context.close(); }
  }
}

async function auditPrimaryPath(browser,browserName) {
  const {context,page,errors}=await newPage(browser,{width:390,height:844});
  try {
    await go(page,'ventas','R01');
    assert.ok(await page.locator('.r6-v-next').count(),'R01 sin Siguiente atención');
    const hero=page.locator('.r6-v-next [data-r6-v-action="open-ficha"]');
    await clickResponse(page,hero,'Abrir ficha desde Siguiente atención');
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    const id=await page.evaluate(()=>M4.get().sel);
    assert.ok(id,'R04 no conserva el lead elegido desde R01');
    const blocks=await page.locator('#m4-main .r6-v-grid>.r6-v-card h2').allTextContents();
    assert.deepEqual(blocks.map(x=>x.trim()),['Qué hizo','Qué está cotizando','Venta sugerida por el agente']);
    const header=await page.evaluate(()=>({
      chips:document.querySelectorAll('.r6-v-ficha-head .r6-chip').length,
      interest:!!document.querySelector('.r6-v-ficha-head .r6-v-interest'),
      value:!!document.querySelector('.r6-v-ficha-head [class*="r6-chip--val-"]'),
      because:!!document.querySelector('.r6-v-ficha-head .r6-v-because')
    }));
    assert.ok(header.chips>=2&&header.interest&&header.value&&header.because,'R04 debe mostrar los chips y la explicación de R6P');

    await clickResponse(page,page.locator('.r6-v-ficha-head [data-r6-v-action="open-quote"]'),'Abrir en Cotizaciones');
    await page.waitForFunction(()=>document.body.dataset.current==='R08');
    assert.equal(await page.evaluate(()=>M4.get().sel),id,'R08 perdió el lead seleccionado');
    assert.equal(await page.locator('.r6-v-ref').count(),6,'R08 debe mostrar seis cotizaciones referenciales');
    assert.ok((await page.locator('.r6-v-selected').innerText()).toLowerCase().includes('lead seleccionado'),'R08 no identifica el lead actual');
    await clickResponse(page,page.locator('.r6-v-selected [data-r6-v-action="open-ficha"]'),'Volver a ficha desde Cotizaciones');
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    assert.equal(await page.evaluate(()=>M4.get().sel),id,'R08 → R04 debe conservar el mismo lead');

    const create=page.locator('#m4-main [data-r3-action="create-quote"]');
    if(await create.count()) {
      await clickResponse(page,create.first(),'Crear cotización');
      await page.waitForFunction(()=>document.body.dataset.current==='R08');
    }

    await go(page,'ventas','R01');
    await clickResponse(page,page.locator('.m4-toolbar [data-a="cola-filter"][data-v="cotizaciones"]'),'Filtro Cotizaciones');
    assert.equal(await page.locator('#m4-main .r6-v-table tbody tr').count(),9,'el filtro Cotizaciones debe corresponder a R08: tres ejemplos y seis referenciales');
    const r01Metrics=await screenMetrics(page);
    assert.equal(r01Metrics.scrollWidth,r01Metrics.width);
    assert.deepEqual(errors,[],'errores de JavaScript en recorrido principal de '+browserName);
  } finally { await context.close(); }
}

async function seedLiveMql(page) {
  return page.evaluate(()=>{
    M4.loadExample();
    M4.setRole('ventas');
    const id=M4.get().lead.id;
    M4.update(s=>{
      s.marketingPasos=s.marketingPasos||{};
      s.marketingPasos[id]={estado:'esperando',motivo:'Volumen suficiente',at:M4.now()};
      s.events=s.events||[];
      s.events.push({
        key:'qa-human-mql-'+id,eventName:'lead_qualified',
        qualification_status:'MQL',actor_type:'human',actor_role:'Marketing',
        actor_id:'Marketing',label:'Marketing revisó y marcó el MQL',pts:0,at:M4.now()
      });
    });
    M4.select(id);
    MarleyApp.go('R04',{evaluation:true});
    return id;
  });
}

async function auditDecisions(browser,browserName) {
  const {context,page,errors}=await newPage(browser,{width:1440,height:900});
  try {
    let id=await seedLiveMql(page);
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    const accept=page.locator('#m4-main [data-r6-v-action="accept-sql"]');
    assert.equal(await accept.count(),1,'R04 debe exponer Aceptar como SQL para el contacto en vivo');
    assert.equal(await accept.isDisabled(),false,'MQL revisado por Marketing debe quedar aceptable');
    await clickResponse(page,accept,'Aceptar como SQL');
    await page.waitForFunction(id=>Boolean(M4.get().sql)&&M4.get().marketingPasos?.[id]?.estado==='aceptado',id);
    await page.evaluate(()=>{M4.setRole('marketing');MarleyApp.go('R12',{evaluation:true});});
    await page.waitForFunction(()=>document.body.dataset.current==='R12');
    const moreLeads=page.locator('#m4-main summary').filter({hasText:'Ver los demás leads'}).first();
    if(await moreLeads.count())await moreLeads.click();
    const acceptedBadge=page.locator('#m4-main [data-r6-handoff="'+id+'"]');
    assert.ok(await acceptedBadge.count(),'R12 no muestra el lead aceptado por Ventas');
    assert.ok((await acceptedBadge.innerText()).includes('SQL aceptado'),'Marketing no ve SQL aceptado para el mismo lead en R12');

    id=await seedLiveMql(page);
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    await clickResponse(page,page.locator('#m4-main [data-r6-v-action="return-open"]'),'Abrir devolución');
    await page.locator('[data-r6-v-reason]').selectOption({label:'No contesta'});
    await clickResponse(page,page.locator('#m4-main [data-r6-v-action="return-confirm"]'),'Devolver a Marketing');
    await page.waitForFunction(id=>M4.get().marketingPasos?.[id]?.estado==='devuelto'&&M4.get().marketingPasos?.[id]?.motivoDevolucion==='No contesta',id);
    await page.evaluate(()=>{M4.setRole('marketing');MarleyApp.go('R12',{evaluation:true});});
    await page.waitForFunction(()=>document.body.dataset.current==='R12');
    const rest=page.locator('#m4-main summary').filter({hasText:'Ver los demás leads'}).first();
    if(await rest.count())await rest.click();
    const returnedBadge=page.locator('#m4-main [data-r6-handoff="'+id+'"]');
    assert.ok(await returnedBadge.count(),'R12 no muestra el lead devuelto por Ventas');
    assert.ok((await returnedBadge.innerText()).includes('No contesta'),'R12 no muestra el motivo de devolución del mismo lead');
    await page.evaluate(()=>MarleyApp.go('R16',{evaluation:true}));
    await page.waitForFunction(()=>document.body.dataset.current==='R16');
    assert.ok((await page.locator('#m4-main').innerText()).includes('No contesta'),'R16 no muestra el motivo de devolución');

    id=await seedLiveMql(page);
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    await clickResponse(page,page.locator('#m4-main [data-r6-v-action="approval-open"]'),'Abrir excepción');
    await page.locator('[data-r6-v-type]').selectOption({label:'Descuento fuera de lista'});
    await page.locator('[data-r6-v-note]').fill('Revisar excepción de descuento fuera de lista.');
    await page.locator('[data-r6-v-amount]').fill('50000');
    await clickResponse(page,page.locator('#m4-main [data-r6-v-action="approval-confirm"]'),'Enviar a aprobación');
    const requestId=await page.evaluate(id=>{
      const x=(M4.get().jefeAprob||[]).find(a=>a.leadId===id&&a.estado==='pendiente');
      return x&&x.id;
    },id);
    assert.ok(requestId,'la excepción no se guardó en jefeAprob como pendiente');

    await page.evaluate(()=>{M4.setRole('jefatura');MarleyApp.go('R05',{evaluation:true});});
    await page.waitForFunction(()=>document.body.dataset.current==='R05');
    assert.ok((await page.locator('#m4-main').innerText()).includes('Descuento fuera de lista'),'R05 no muestra la solicitud pendiente');
    await page.evaluate(()=>MarleyApp.go('R07',{evaluation:true}));
    await page.waitForFunction(()=>document.body.dataset.current==='R07');
    const approve=page.locator('[data-r6-action="aprob-ok"][data-v="'+requestId+'"]');
    assert.equal(await approve.count(),1,'R07 no muestra el control para decidir la solicitud');
    await clickResponse(page,approve,'Aprobar excepción desde R07');
    await page.waitForFunction(id=>(M4.get().jefeAprob||[]).some(x=>x.id===id&&x.estado==='aprobada'),requestId);

    await page.evaluate(id=>{M4.setRole('ventas');M4.select(id);MarleyApp.go('R04',{evaluation:true});},id);
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    assert.ok((await page.locator('#m4-main').innerText()).includes('Aprobada'),'R04 no muestra la decisión aprobada de Jefatura');
    await page.evaluate(()=>MarleyApp.go('R08',{evaluation:true}));
    await page.waitForFunction(()=>document.body.dataset.current==='R08');
    assert.ok((await page.locator('#m4-main').innerText()).includes('Aprobada'),'R08 no muestra la decisión aprobada de Jefatura');

    await page.evaluate(id=>{
      M4.update(s=>{const x=(s.jefeAprob||[]).find(a=>a.leadId===id);if(x){x.estado='pidio_info';x.nota='Falta respaldo de presupuesto';}});
      MarleyApp.go('R04',{evaluation:true});
    },id);
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    assert.ok((await page.locator('#m4-main').innerText()).includes('Pidió información: Falta respaldo de presupuesto'),'R04 no muestra la nota de Jefatura');
    await page.evaluate(()=>MarleyApp.go('R08',{evaluation:true}));
    await page.waitForFunction(()=>document.body.dataset.current==='R08');
    assert.ok((await page.locator('#m4-main').innerText()).includes('Pidió información: Falta respaldo de presupuesto'),'R08 no muestra la nota de Jefatura');
    assert.deepEqual(errors,[],'errores de JavaScript al ejecutar decisiones en '+browserName);
  } finally { await context.close(); }
}

async function auditRoleFiches(browser,browserName) {
  const {context,page,errors}=await newPage(browser,{width:390,height:844});
  try {
    const id=await page.evaluate(()=>{
      M4.loadExample();
      M4.select(M4.get().lead.id);
      M4.setRole('marketing');
      MarleyApp.go('R04',{evaluation:true});
      return M4.get().lead.id;
    });
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    const marketing=await page.evaluate(()=>({
      chips:document.querySelectorAll('#m4-main .r6-v-role-chips .r6-chip').length,
      chipText:document.querySelector('#m4-main .r6-v-role-chips')?.innerText||'',
      preserved:(document.querySelector('#m4-main')?.innerText||'').includes('ACTIVIDAD RECIENTE')
    }));
    assert.ok(marketing.chips>=2,'R04 de Marketing debe conservar chips R6P');
    assert.ok(!marketing.chipText.includes('$'),'los chips de Marketing no deben mostrar montos');
    assert.ok(marketing.preserved,'R04 de Marketing perdió su ficha previa');
    await page.evaluate(()=>{M4.setRole('jefatura');MarleyApp.go('R04',{evaluation:true});});
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    const manager=await page.evaluate(()=>({
      chips:document.querySelectorAll('#m4-main .r6-v-role-chips .r6-chip').length,
      preserved:(document.querySelector('#m4-main')?.innerText||'').includes('ACTIVIDAD RECIENTE')
    }));
    assert.ok(manager.chips>=2,'R04 de Jefatura debe conservar chips R6P');
    assert.ok(manager.preserved,'R04 de Jefatura perdió su ficha previa');
    assert.equal(await page.evaluate(()=>M4.get().lead.id),id);
    assert.deepEqual(errors,[],'errores de JavaScript en fichas por rol de '+browserName);
  } finally { await context.close(); }
}

async function auditCompactR02(browser,browserName) {
  const {context,page,errors}=await newPage(browser,{width:390,height:844});
  try {
    await go(page,'ventas','R02');
    const result=await page.evaluate(()=>({
      height:document.documentElement.scrollHeight,
      thread:!!document.querySelector('#m4-main .m4-inbox-thread'),
      threadFirst:document.querySelector('#m4-main .m4-inbox')?.firstElementChild?.classList.contains('m4-inbox-thread'),
      foldedList:!!document.querySelector('#m4-main details.r6-v-fold-list:not([open])'),
      foldedSide:!!document.querySelector('#m4-main details.r6-v-fold-side:not([open])')
    }));
    assert.ok(result.height<=2500,'R02 excede 2500 px a 390: '+result.height);
    assert.ok(result.thread&&result.threadFirst,'R02 debe dejar la conversación activa visible');
    assert.ok(result.foldedList&&result.foldedSide,'R02 debe plegar lista y panel secundario');
    assert.deepEqual(errors,[],'errores de JavaScript en R02 de '+browserName);
  } finally { await context.close(); }
}

async function auditAdditionalActions(browser,browserName) {
  const {context,page,errors}=await newPage(browser,{width:390,height:844});
  try {
    await page.evaluate(()=>{
      M4.loadExample();
      M4.setRole('ventas');
      M4.select('MC-HOR-2031');
      MarleyApp.go('R04',{evaluation:true});
    });
    await page.waitForFunction(()=>document.body.dataset.current==='R04');
    const copy=page.locator('#m4-main [data-r6-v-action="copy-draft"]');
    assert.equal(await copy.count(),1,'la ficha debe ofrecer Copiar al borrador');
    await clickResponse(page,copy,'Copiar al borrador');
    await page.waitForFunction(()=>document.body.dataset.current==='R08');
    const draft=await page.evaluate(()=>M4.get().r6VentasDrafts?.['MC-HOR-2031']);
    assert.ok(draft&&draft.status==='borrador'&&draft.lines?.length,'Copiar al borrador no guardó líneas cotizables');
    const quoteText=await page.locator('#m4-main').innerText();
    assert.match(quoteText,/Borradores copiados desde la ficha/i,'R08 no muestra el borrador copiado');

    await go(page,'ventas','R03');
    await clickResponse(page,page.locator('#m4-main .r6-v-tabs a[data-go="R10"]'),'Abrir agenda desde Clientes y recompras');
    await page.waitForFunction(()=>document.body.dataset.current==='R10');
    assert.equal((await page.locator('#m4-main .r6-v-tabs a[aria-current="page"]').innerText()).trim(),'Agenda');
    await clickResponse(page,page.locator('#m4-main .r6-v-tabs a[data-go="R03"]'),'Volver a Clientes y recompras');
    await page.waitForFunction(()=>document.body.dataset.current==='R03');

    await go(page,'ventas','R01');
    await clickResponse(page,page.locator('.m4-nav[data-go="R02"]').first(),'Menú de Ventas: Conversaciones');
    await page.waitForFunction(()=>document.body.dataset.current==='R02');
    assert.deepEqual(errors,[],'errores de JavaScript en acciones adicionales de '+browserName);
  } finally { await context.close(); }
}

async function runFor(name,executablePath) {
  assert.ok(fs.existsSync(executablePath),'navegador no encontrado: '+executablePath);
  const browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu']});
  try {
    await auditRoutes(browser,name);
    await auditPrimaryPath(browser,name);
    await auditDecisions(browser,name);
    await auditRoleFiches(browser,name);
    await auditCompactR02(browser,name);
    await auditAdditionalActions(browser,name);
    console.log(name+': rutas, recorrido, decisiones y compactación R02 OK');
  } finally { await browser.close(); }
}

(async()=>{
  await runFor('Chrome',CHROME_PATH);
  await runFor('Edge',EDGE_PATH);
  console.log(JSON.stringify({checks:results.length,summary:'R6 Ventas verificado en Chrome y Edge'},null,2));
})().catch(error=>{
  console.error(error.stack||error);
  process.exitCode=1;
});
