'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const INPUT = process.argv[2] || 'http://127.0.0.1:8880/index.html';
const inputUrl = new URL(INPUT);
const BASE = inputUrl.origin + inputUrl.pathname.replace(/\/index\.html\/?$/i,'').replace(/\/$/,'');
const URL_FOR = screen => BASE + '/index.html' + (screen ? '#' + screen : '');
const SIZES = [{width:390,height:900},{width:1440,height:900}];
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const reports = [];

async function openPage(browser,size) {
  const context = await browser.newContext({
    viewport:{width:size.width,height:size.height},
    isMobile:size.width < 768,
    hasTouch:size.width < 768
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push('pageerror: ' + error.message));
  page.on('console',message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  await page.goto(URL_FOR(''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.MarleyApp && window.M4 && window.R7P,null,{timeout:12000});
  return {context,page,errors};
}

async function go(page,screen) {
  await page.evaluate(screen => MarleyApp.go(screen,{evaluation:true}),screen);
  await page.waitForFunction(screen => document.body.dataset.current === screen,screen,{timeout:8000});
  await page.waitForTimeout(120);
}

async function click(locator) {
  assert.ok(await locator.count(),'No se encontró el control esperado.');
  await locator.scrollIntoViewIfNeeded();
  await locator.click({timeout:5000});
}

async function verifyViewport(browser,size) {
  const {context,page,errors} = await openPage(browser,size);
  try {
    await go(page,'C02');
    const home = await page.evaluate(() => ({
      height:document.documentElement.scrollHeight,
      h1:document.querySelectorAll('#m4-main h1').length,
        folds:[...document.querySelectorAll('#m4-main details[data-r7-fold]')].map(node => node.open),
        foldLefts:Object.fromEntries([...document.querySelectorAll('#m4-main details[data-r7-fold]')].map(node => [node.dataset.r7Fold,node.getBoundingClientRect().left]))
    }));
    assert.equal(home.h1,1,'C02 debe tener un H1.');
    assert.ok(home.height <= (size.width < 768 ? 2500 : 1800),'C02 excede el tope R6: ' + home.height);
    assert.ok(home.folds.length >= 3,'C02 no agrupó sus bloques secundarios.');
    assert.ok(home.folds.every(open => !open),'Los acordeones C02 deben iniciar cerrados.');
    assert.ok(Math.abs(home.foldLefts.servicios-home.foldLefts.insumos) <= 1,'El acordeón de acompañamiento debe alinear su borde con el de insumos.');

    await go(page,'C04');
    await page.locator('[data-r7-start-guide]').waitFor({state:'visible',timeout:5000});
    const beforeContact = await page.evaluate(() => {
      const guide=document.querySelector('[data-r7-start-guide]');
      const contact=document.querySelector('#m4FName');
      return {
        height:document.documentElement.scrollHeight,
        h1:document.querySelectorAll('#m4-main h1').length,
        title:guide && guide.querySelector('h2') && guide.querySelector('h2').textContent,
        prompt:guide && guide.innerText.includes('Elige tu tipo de negocio abajo y te mostramos tu canasta de inicio'),
        selectorCount:guide ? guide.querySelectorAll('select').length : -1,
        ordered:Boolean(guide && contact && (guide.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING))
      };
    });
    assert.equal(beforeContact.h1,1,'C04 debe tener un H1.');
    assert.ok(beforeContact.height <= (size.width < 768 ? 2500 : 1800),'C04 excede el tope R6: ' + beforeContact.height);
    assert.equal(beforeContact.title,'¿Qué necesito para comenzar a ofrecer café?');
    assert.ok(beforeContact.ordered,'La guía debe aparecer antes de los datos de contacto.');
    assert.ok(beforeContact.prompt,'Antes de responder el formulario, la guía debe indicar cómo ver la canasta.');
    assert.equal(beforeContact.selectorCount,0,'C04 no debe repetir el selector del formulario dentro de la guía.');
    await click(page.locator('#m4-main [data-a="answer"][data-k="negocio"][data-v="Panadería"]'));
    await page.waitForFunction(() => document.querySelector('[data-r7-start-guide]')?.innerText.toUpperCase().includes('CANASTA DE INICIO · PANADERÍAS'),null,{timeout:5000});
    assert.ok((await page.locator('[data-r7-start-guide]').innerText()).includes('CANASTA DE INICIO · PANADERÍAS'),'El selector de negocio no actualiza la canasta.');
    assert.ok((await page.locator('[data-r7-start-guide]').innerText()).includes('comodato'),'La guía omite condiciones de comodato.');

    await go(page,'C10');
    const catalog = await page.evaluate(() => {
      const text=document.querySelector('#m4-main').innerText;
      const cards=[...document.querySelectorAll('.r5-prod')];
      const pack=document.querySelector('.r5-pack-card');
      return {
        height:document.documentElement.scrollHeight,
        h1:document.querySelectorAll('#m4-main h1').length,
        count:cards.length,
        visibleRecommendations:[...document.querySelectorAll('.r7-feature-product [data-r7-recommendation]')].map(card=>({product:card.dataset.r7ProductId,order:card.dataset.r7RecOrder,text:card.innerText,visible:Boolean(card.offsetWidth&&card.offsetHeight&&card.getClientRects().length)})),
        cupPhoto:(()=>{const img=document.querySelector('.r7-feature-product .r7-cup-photo');return img?{src:img.getAttribute('src'),alt:img.alt,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading}:null;})(),
        resourceImage:(()=>{const img=document.querySelector('.r7-resource-photo');return img?{src:img.getAttribute('src'),alt:img.alt,width:img.getAttribute('width'),height:img.getAttribute('height'),loading:img.loading}:null;})(),
        featured:(()=>{const button=document.querySelector('.r7-feature-product [data-r7-rec-order="1"] [data-r7-accept]');return Boolean(button&&button.offsetWidth>0&&button.offsetHeight>0&&button.getClientRects().length);})(),
        statuses:cards.filter(card => card.querySelector('.r7-price-status') && card.querySelector('.r7-price-unit')).length,
        selected:document.querySelectorAll('.r5-prod.is-in').length,
        vat:text.includes('IVA (19 %) no incluido'),
        photoGeometry:(()=>{const frame=document.querySelector('.r7-feature-product .r7-cup-photo-frame');const card=document.querySelector('.r7-feature-product [data-r7-rec-order="1"]');if(!frame||!card)return null;const f=frame.getBoundingClientRect(),c=card.getBoundingClientRect();return {frameWidth:f.width,frameHeight:f.height,cardWidth:c.width,leftOffset:f.left-c.left,widthRatio:f.width/c.width,aspect:f.width/f.height};})(),
        status:text.includes('Referencial · cotización oct-2026'),
        unit:cards.map(card => card.querySelector('.r7-price-unit')?.textContent || '').join(' ').includes('$61.731/kg neto') && cards.map(card => card.querySelector('.r7-price-unit')?.textContent || '').join(' ').includes('$188/set vaso+tapa neto'),
        initial:pack && pack.textContent.toLowerCase().includes('no un monto mensual'),
        hasDifference:!/\butilidad\b/i.test(text)
      };
    });
    assert.equal(catalog.h1,1,'C10 debe tener un H1.');
    assert.ok(catalog.height <= (size.width < 768 ? 2500 : 1800),'C10 excede el tope R6: ' + catalog.height);
    assert.equal(catalog.count,9,'Se esperaban las 9 líneas cotizadas.');
    assert.equal(catalog.statuses,9,'Cada producto debe llevar estado de precio y detalle unitario.');
    assert.ok(catalog.featured,'El vaso con marca debe tener una acción visible para verlo en productos.');
    assert.deepEqual(catalog.visibleRecommendations.map(item=>item.product),['vaso65','vanilla'],'El vaso con marca debe mostrarse primero y Vainilla segunda.');
    assert.ok(catalog.visibleRecommendations.every(item=>item.visible),'Los dos complementos deben estar visibles.');
    assert.ok(catalog.visibleRecommendations[0].text.includes('ayuda al local a presentar mejor su bebida a su cliente'),'Falta explicar el valor del vaso con marca.');
    assert.ok(catalog.cupPhoto && catalog.cupPhoto.src.includes('vaso-marley-kraft-maquina.webp') && catalog.cupPhoto.width === '500' && catalog.cupPhoto.height === '700','C10 debe usar la foto kraft real, con dimensiones intrínsecas.');
    assert.ok(catalog.photoGeometry,'La recomendación debe mostrar el encuadre de la foto.');
    if (size.width < 768) {
      assert.ok(catalog.photoGeometry.widthRatio > .95,'A 390 px la foto debe ocupar todo el ancho de la tarjeta.');
      assert.ok(catalog.photoGeometry.aspect >= 1.30 && catalog.photoGeometry.aspect <= 1.48,'A 390 px la foto debe conservar un recorte cercano a 4:3.');
    } else {
      assert.ok(catalog.photoGeometry.leftOffset <= 1,'A 1440 px la foto debe ir a la izquierda del texto.');
      assert.ok(catalog.photoGeometry.widthRatio >= .38 && catalog.photoGeometry.widthRatio <= .42,'A 1440 px la foto debe ocupar 40 % del ancho de la tarjeta.');
    }
    assert.match(catalog.cupPhoto.alt,/vaso kraft.*marca Marley.*máquina/i,'La foto del vaso debe tener un alt descriptivo en español.');
    assert.equal(catalog.cupPhoto.loading,'lazy','La foto del vaso debe usar carga diferida.');
    assert.equal(catalog.visibleRecommendations[0].text.includes('Foto real pendiente'),false,'No debe quedar el placeholder del vaso donde ya hay foto real.');
    assert.ok(catalog.visibleRecommendations[0].text.toLowerCase().includes('vaso con marca marley'),'El nombre visible del vaso debe ser neutro.');
    assert.ok(catalog.visibleRecommendations[0].text.includes('Precio referencial · cotización oct-2026'),'El precio del vaso debe identificarse como referencial.');
    assert.ok(catalog.visibleRecommendations[0].text.includes('$134 neto por set vaso+tapa'),'El precio del vaso de 6,5 oz debe coincidir con la cotización.');
    assert.ok(catalog.vat,'C10 debe hacer explícito el IVA.');
    assert.ok(catalog.status,'C10 debe mostrar fecha/estado de precio.');
    assert.ok(catalog.unit,'Faltan precios por kilo o unidad derivados.');
    assert.ok(catalog.initial,'La compra inicial debe separarse de la mensualidad.');
    assert.ok(catalog.hasDifference,'La pantalla no debe mostrar el término prohibido.');
    assert.ok(catalog.resourceImage && catalog.resourceImage.src.includes('vaso-marley-negro-barra.webp') && catalog.resourceImage.width === '900' && catalog.resourceImage.height === '568' && catalog.resourceImage.loading === 'lazy','El recurso B2B2C debe incluir la foto negra optimizada y con carga diferida.');
    assert.match(catalog.resourceImage.alt,/vaso negro.*marca Marley.*barra/i,'El recurso B2B2C debe describir la foto en español.');
    assert.equal(catalog.visibleRecommendations.length,2,'El portal debe mostrar dos complementos como maximo.');
    const apiRecommendations=await page.evaluate(() => R7P.recomendaciones({buyer:'hotel'}));
    assert.equal(apiRecommendations.length,2,'R7P debe devolver dos recomendaciones como maximo.');
    assert.ok(apiRecommendations.some(item => item.productoId === 'vanilla'),'Vainilla debe corresponder a la ficha visible.');

    const selectedBefore = catalog.selected;
    const firstRec = page.locator('.r7-feature-product [data-r7-recommendation]').first();
    await firstRec.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {const img=document.querySelector('.r7-feature-product .r7-cup-photo');return img && img.complete && img.naturalWidth > 0 && img.naturalWidth <= 900;},null,{timeout:5000});
    await click(page.locator('#r7-pilot > summary'));
    const resourcesToggle=page.locator('#r7-pilot .r7-fold').filter({hasText:'¿Qué dos recursos probar con el negocio?'}).locator('summary').first();
    await resourcesToggle.scrollIntoViewIfNeeded();
    await click(resourcesToggle);
    const b2b2cToggle=page.locator('.r7-resource').filter({hasText:'Kit imprimible'}).locator('details > summary');
    await b2b2cToggle.scrollIntoViewIfNeeded();
    await click(b2b2cToggle);
    await page.waitForFunction(() => {const img=document.querySelector('.r7-resource-photo');return img && img.complete && img.naturalWidth > 0 && img.naturalWidth <= 900;},null,{timeout:5000});
    await click(b2b2cToggle);
    await page.waitForFunction(() => window.R7P.eventos('recomendacion_vista').length > 0,null,{timeout:5000});
    const recId = await firstRec.getAttribute('data-r7-rec-id');
    const productId = await firstRec.getAttribute('data-r7-product-id');
    await click(firstRec.locator('[data-r7-accept]'));
    assert.equal(await page.locator('.r5-prod.is-in').count(),selectedBefore,'Aceptar una recomendación no debe agregar productos automáticamente.');
    assert.ok(await page.evaluate(recId => R7P.eventos({evento:'recomendacion_aceptada',recomendacionId:recId}).length > 0,recId),'No se registró aceptación explícita.');
    const vanillaRec=page.locator('.r7-feature-product [data-r7-rec-order="2"]');
    const vanillaRecId=await vanillaRec.getAttribute('data-r7-rec-id');
    await vanillaRec.scrollIntoViewIfNeeded();
    await page.waitForFunction(id => R7P.eventos({evento:'recomendacion_vista',recomendacionId:id}).length > 0,vanillaRecId,{timeout:5000});
    assert.equal(await page.locator('.r5-prod.is-in').count(),selectedBefore,'Mostrar Vainilla no debe agregar productos automáticamente.');
    await click(vanillaRec.locator('.r5-prod[data-r5-prod="vanilla"] [data-m9-add]'));
    assert.ok(await page.locator('.r5-prod.is-in').count() > selectedBefore,'El producto solo debe agregarse tras la acción explícita en el catálogo.');
    assert.ok(await page.evaluate(id => R7P.eventos({evento:'recomendacion_aceptada',recomendacionId:id}).length > 0,vanillaRecId),'Agregar Vainilla debe registrar aceptación explícita.');

    await click(page.locator('#m9-continue'));
    await page.waitForFunction(() => document.body.dataset.current === 'C04',null,{timeout:8000});
    const orderClick = await page.evaluate(() => R7P.eventos('clic_a_pedido').slice(-1)[0] || null);
    assert.ok(orderClick && orderClick.idRecorrido,'El clic debe registrar un recorrido anónimo.');
    const protectedResult = await page.evaluate(() => R7P.registrarEvento('pedido_confirmado',{}));
    assert.equal(protectedResult,false,'Una llamada local no puede confirmar un pedido.');
    const qaResult = await page.evaluate(({productId,idRecorrido}) => R7P.registrarPedidoConfirmado({
      origen:'qa-verifier',datoPrueba:true,estado:'confirmado',idRecorrido,productos:[productId,'vanilla']
    }),{productId,idRecorrido:orderClick.idRecorrido});
    assert.equal(qaResult,true,'El verificador debe poder crear un evento rotulado como dato de prueba.');
    const events = await page.evaluate(() => ({
      confirmed:R7P.eventos('pedido_confirmado').slice(-1)[0],
      bought:R7P.eventos('recomendacion_comprada')
    }));
    assert.equal(events.confirmed.estado,'dato_de_prueba');
    assert.equal(events.confirmed.origen,'qa-verifier');
    assert.equal(events.confirmed.idRecorrido,orderClick.idRecorrido);
    assert.ok(events.bought.some(item => item.recomendacionId === recId),'La compra del vaso requiere confirmacion.');
    assert.ok(events.bought.some(item => item.recomendacionId === vanillaRecId),'La compra de Vainilla requiere confirmacion.');

    await go(page,'C10');
    await click(page.locator('#r7-calculadora > summary'));
    await page.locator('#r7-sale-price').fill('1000');
    const difference=await page.locator('#r7-calc-result').innerText();
    assert.ok(difference.includes('Diferencia entre precio de venta y costos registrados'),'No se mostró la diferencia solicitada.');
    assert.ok(difference.includes('$318'),'La receta 8 g + vaso 9 oz debe calcular $318 de diferencia con venta neta de $1.000.');
    assert.ok(!(await page.locator('#m4-main').innerText()).match(/\butilidad\b/i),'No se permite la etiqueta prohibida.');

    const result = {
      viewport:size.width + '×' + size.height,
      heights:{C02:home.height,C04:beforeContact.height,C10:catalog.height},
      products:catalog.count,
      priceLabels:catalog.statuses,
      recommendationEvents:await page.evaluate(() => R7P.eventos().filter(item => item.evento.startsWith('recomendacion_')).map(item => item.evento)),
      orderEvents:await page.evaluate(() => R7P.eventos().filter(item => item.evento.includes('pedido')).map(item => item.evento)),
      calculator:difference
    };
    assert.equal(errors.length,0,'Errores de consola o página: ' + errors.join(' | '));
    reports.push(result);
    console.log(JSON.stringify({ok:true,...result}));
  } finally {
    await context.close();
  }
}

(async() => {
  const browser=await chromium.launch({headless:true,executablePath:CHROME});
  try {
    for (const size of SIZES) await verifyViewport(browser,size);
  } finally {
    await browser.close();
  }
  console.log('R7 portal PASS · 390 y 1440 · sin errores de consola.');
})().catch(error => {
  console.error('R7 portal FAIL:',error.stack || error.message || error);
  process.exit(1);
});


