const { chromium } = require('./playwright-system-chrome.cjs');
const base = process.argv[2] || 'http://127.0.0.1:8879/';
const report = [];
const routes = Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`)
  .concat(Array.from({ length: 18 }, (_, i) => `R${String(i).padStart(2, '0')}`));
const roleFor = (hash) => ['R05', 'R14', 'R15'].includes(hash) ? 'jefatura' : ['R09', 'R11', 'R12', 'R13'].includes(hash) ? 'marketing' : hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.push({ type: 'pageerror', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error') report.push({ type: 'console', message: message.text() }); });
    await page.goto(new URL('/index.html', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.M4D), null, { timeout: 10000 });
    await page.evaluate(() => window.M4?.loadExample?.());
    for (const hash of routes) {
      await page.evaluate(({ hash, role }) => { window.M4?.setRole?.(role); window.MarleyApp.go(hash, { evaluation: true }); }, { hash, role: roleFor(hash) });
      await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 5000 });
      const result = await page.evaluate((hash) => {
        const visible = (e) => { const r=e.getBoundingClientRect(),s=getComputedStyle(e); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0; };
        const name = (e) => `${e.tagName.toLowerCase()}${e.id?`#${e.id}`:''}${typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).join('.'):''}`;
        const text = (e) => (e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,100);
        const terms = document.body.innerText.split(/\n+/).map((x)=>x.trim()).filter((x)=>/\bdemo\b|demostraci[oó]n/i.test(x));
        const fixed = [...document.querySelectorAll('body *')].filter((e)=>visible(e)&&['fixed','sticky'].includes(getComputedStyle(e).position)).map((e)=>{const r=e.getBoundingClientRect();return {selector:name(e),text:text(e),top:Math.round(r.top),left:Math.round(r.left),right:Math.round(r.right),bottom:Math.round(r.bottom),height:Math.round(r.height)}});
        const h1=[...document.querySelectorAll('h1')].find(visible), buttons=[...document.querySelectorAll('button,a[href],[role=button]')].filter(visible).map((e)=>{const r=e.getBoundingClientRect();return {selector:name(e),text:text(e),top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)}});
        const small=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link]')].filter((e)=>visible(e)&&!e.disabled).map((e)=>{const t=e.matches('input[type=checkbox],input[type=radio]')?(e.closest('label')||e):e,r=t.getBoundingClientRect();return {selector:name(e),target:name(t),width:Math.round(r.width),height:Math.round(r.height),text:text(e)}}).filter((x)=>x.width<44||x.height<44);
        const warm=[...document.querySelectorAll('body *')].filter(visible).map((e)=>({selector:name(e),bg:getComputedStyle(e).backgroundColor})).filter((x)=>{const m=x.bg.match(/\d+/g);return m&&+m[0]>235&&+m[1]>235&&+m[2]>235&&(+m[0]-(+m[2]))>=5;});
        return {hash,terms, fixed, h1:h1?text(h1):'', buttons,small,warm:warm.slice(0,30),broken:[...document.querySelectorAll('a[href]')].filter((a)=>a.href.includes('diagramas.html')).map((a)=>({text:text(a),href:a.getAttribute('href')}))};
      }, hash);
      if (result.terms.length||result.fixed.length||result.small.length||result.warm.length||result.broken.length||['C03','C04','C05','C08','C14','C15','R00','R01','R02'].includes(hash)) report.push(result);
    }
    await page.evaluate(() => window.MarleyApp.go('C02', { evaluation:true }));
    await page.waitForFunction(() => document.body.dataset.current === 'C02');
    await page.waitForTimeout(100);
    report.push(await page.evaluate(() => ({hash:'C02-video',video:[...document.querySelectorAll('video')].map((v)=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,poster:v.getAttribute('poster'),preload:v.preload,readyState:v.readyState,networkState:v.networkState})),resources:performance.getEntriesByType('resource').filter((r)=>/\.mp4|\.webm|\.m4v/i.test(r.name)).map((r)=>({name:r.name,duration:Math.round(r.duration),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))})));
    await context.close();
    const context2=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'});
    const p2=await context2.newPage(); await p2.goto(new URL('/index.html',base).toString(),{waitUntil:'domcontentloaded'}); await p2.waitForFunction(()=>Boolean(window.M4&&window.MarleyApp&&window.M4D),null,{timeout:10000}); await p2.evaluate(()=>window.M4?.loadExample?.());
    for(const hash of ['C03','C04','C05','C08','C14','C15']){await p2.evaluate((h)=>window.MarleyApp.go(h,{evaluation:true}),hash);await p2.waitForFunction((h)=>document.body.dataset.current===h,hash,{timeout:5000});report.push(await p2.evaluate((hash)=>{const v=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};const h=[...document.querySelectorAll('h1')].find(v),btn=[...document.querySelectorAll('button,a[href]')].filter(v).find((e)=>/m5-btn|primary|secondary/.test(e.className||'')),r=btn?.getBoundingClientRect();return{hash,width:innerWidth,firstScreen:{h1:h?{text:h.innerText,top:Math.round(h.getBoundingClientRect().top),bottom:Math.round(h.getBoundingClientRect().bottom)}:null,cta:btn?{text:btn.innerText,top:Math.round(r.top),bottom:Math.round(r.bottom)}:null,scrollHeight:document.documentElement.scrollHeight}}},hash))}
    await context2.close();
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  } finally { await browser.close(); }
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
