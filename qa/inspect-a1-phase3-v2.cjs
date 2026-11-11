const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8891/';
const evidence = path.join(root, 'EVIDENCIA_10NOV');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roleFor = (hash) => ['R05', 'R14', 'R15'].includes(hash) ? 'jefatura'
  : ['R09', 'R11', 'R12', 'R13'].includes(hash) ? 'marketing'
    : hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;

async function go(page, hash) {
  await page.evaluate(({ hash, role }) => {
    if (window.M4?.setRole) window.M4.setRole(role);
    window.MarleyApp.go(hash, { evaluation: true });
  }, { hash, role: roleFor(hash) });
  await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 8000 });
  await wait(70);
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const result = { base, errors: [], r00: [], c03: [], c09: {}, c10: null, touch768: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (error) => result.errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error') result.errors.push({ type: 'console', message: message.text() }); });
    await page.goto(new URL('/index.html#R00', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp), null, { timeout: 10000 });
    await page.setViewportSize({ width: 320, height: 640 });
    for (const [label, delay] of [['15ms', 15], ['615ms', 600], ['1915ms', 1300]]) {
      await wait(delay);
      const sample = await page.evaluate((label) => {
        const visible = (e) => { const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0; };
        const whitePairs = [...document.querySelectorAll('body *')].filter((e) => visible(e) && (e.innerText||'').trim() && getComputedStyle(e).color === 'rgb(255, 255, 255)')
          .map((e) => { const s=getComputedStyle(e),r=e.getBoundingClientRect();let bg='rgba(0, 0, 0, 0)';for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'){bg=c;break;}}return {tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,100),color:s.color,fill:s.webkitTextFillColor,background:bg,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})
          .filter((e) => e.background === 'rgb(255, 255, 255)');
        const h1=document.querySelector('h1');
        return { label,current:document.body.dataset.current,h1:h1?{text:h1.innerText,color:getComputedStyle(h1).color,fill:getComputedStyle(h1).webkitTextFillColor}:null,whitePairs };
      }, label);
      result.r00.push(sample);
    }
    await page.screenshot({ path: path.join(evidence, 'A1_before_A8v2_R00_320x640.png') });

    for (const [width, height] of [[360,800],[390,844],[414,896],[768,1024],[1366,768],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await go(page, 'C03');
      const sample = await page.evaluate(({width,height}) => {
        const rect=(selector)=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,position:getComputedStyle(e).position,display:getComputedStyle(e).display};};
        const overlap=(a,b)=>a&&b?Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)):0;
        return {viewport:{width,height,scrollWidth:document.documentElement.scrollWidth},email:rect('#m4FEmail'),phone:rect('#m4FPhone'),launcher:rect('#m7-launcher'),cta:[...document.querySelectorAll('button,a')].map(e=>({text:(e.innerText||'').trim(),r:e.getBoundingClientRect()})).filter(e=>/continuar/i.test(e.text)).map(e=>({text:e.text,y:e.r.y,bottom:e.r.bottom,position:getComputedStyle(document.querySelectorAll('button,a')[0]).position})),emailOverlap:overlap(rect('#m7-launcher'),rect('#m4FEmail')),phoneOverlap:overlap(rect('#m7-launcher'),rect('#m4FPhone'))};
      }, {width,height});
      result.c03.push(sample);
      await page.screenshot({ path: path.join(evidence, `A1_before_A8v2_C03_${width}x${height}.png`) });
      if (width === 768) {
        const small = await page.evaluate(() => [...document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]')]
          .filter((e)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&!e.disabled;})
          .map((e)=>{const r=e.getBoundingClientRect();return{tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:(e.innerText||e.getAttribute('aria-label')||e.value||'').trim().replace(/\s+/g,' ').slice(0,70),width:Math.round(r.width),height:Math.round(r.height)}}).filter((e)=>e.height<44));
        result.touch768.push({hash:'C03',small});
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'C09');
    result.c09 = await page.evaluate(() => ({
      videos:[...document.querySelectorAll('video')].map((v)=>({className:v.className,controls:v.controls,tabIndex:v.tabIndex,focusVisible:v.matches(':focus-visible'),focusWithin:v.matches(':focus-within'),rect:v.getBoundingClientRect().toJSON(),parentClass:v.parentElement.className,html:v.outerHTML.slice(0,600)})),
      buttons:[...document.querySelectorAll('button,a[href],input,select,textarea')].filter((e)=>{const r=e.getBoundingClientRect();return r.width&&r.height}).map((e)=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,55),tabIndex:e.tabIndex,cls:typeof e.className==='string'?e.className:''})).slice(0,80),
    }));
    const video = page.locator('video').first();
    if (await video.count()) {
      await video.focus();
      for (let i=0;i<22;i++) {
        await page.keyboard.press('Tab');
        await wait(25);
        result.c09.tabStates ||= [];
        result.c09.tabStates.push(await page.evaluate(() => {
          const active=document.activeElement,s=getComputedStyle(active),video=document.querySelector('video'),v=getComputedStyle(video);
          return {tag:active.tagName,id:active.id,cls:typeof active.className==='string'?active.className:'',text:(active.innerText||active.getAttribute('aria-label')||'').trim().slice(0,60),focusVisible:active.matches(':focus-visible'),outline:s.outline,boxShadow:s.boxShadow,hostFocus:video.matches(':focus-visible'),hostWithin:video.matches(':focus-within'),hostOutline:v.outline,hostShadow:v.boxShadow};
        }));
      }
    }
    await page.screenshot({ path: path.join(evidence, 'A1_before_A8v2_C09_390x844.png') });

    await go(page, 'C10');
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(100);
    result.c10 = await page.evaluate(async () => {
      const target=document.querySelector('#m9-add-milk');
      const init={exists:Boolean(target),className:target?.className,bg:target?getComputedStyle(target).backgroundColor:null,transition:target?getComputedStyle(target).transition:null};
      const samples=[];let start=performance.now();
      await new Promise((resolve)=>{const tick=()=>{const elapsed=performance.now()-start;const el=document.querySelector('#m9-add-milk');samples.push({ms:+elapsed.toFixed(1),bg:el?getComputedStyle(el).backgroundColor:null});if(elapsed<850)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
      return {init,samples};
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await wait(25);
    result.c10.resizeSamples = await page.evaluate(async () => {
      const samples=[];let start=performance.now();
      await new Promise((resolve)=>{const tick=()=>{const elapsed=performance.now()-start;const el=document.querySelector('#m9-add-milk');samples.push({ms:+elapsed.toFixed(1),bg:el?getComputedStyle(el).backgroundColor:null});if(elapsed<850)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
      return samples;
    });
    await page.screenshot({ path: path.join(evidence, 'A1_before_A8v2_C10_768x1024.png') });

    for (const hash of ['C01','C02','C12']) {
      await page.setViewportSize({ width: 768, height: 1024 });
      await go(page, hash);
      const small=await page.evaluate(() => [...document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]')]
        .filter((e)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&!e.disabled;})
        .map((e)=>{const r=e.getBoundingClientRect();return{tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:(e.innerText||e.getAttribute('aria-label')||e.value||'').trim().replace(/\s+/g,' ').slice(0,70),width:Math.round(r.width),height:Math.round(r.height)}}).filter((e)=>e.height<44));
      result.touch768.push({hash,small});
      await page.screenshot({ path: path.join(evidence, `A1_before_A8v2_${hash}_768x1024.png`) });
    }
    await context.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(evidence,'A1_before_A8v2_diagnostics.json'),JSON.stringify(result,null,2)+'\n','utf8');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
})().catch((error)=>{console.error(error);process.exitCode=1;});
