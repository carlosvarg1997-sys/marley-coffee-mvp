const { chromium } = require('./playwright-system-chrome.cjs');
const base = process.argv[2] || 'http://127.0.0.1:8879/';
const roleFor = (hash) => ['R05', 'R14', 'R15'].includes(hash) ? 'jefatura' : ['R09', 'R11', 'R12', 'R13'].includes(hash) ? 'marketing' : hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function route(page, hash, role = roleFor(hash)) {
  await page.evaluate(({hash,role})=>{window.M4?.setRole?.(role);window.MarleyApp.go(hash,{evaluation:true});},{hash,role});
  await page.waitForFunction((h)=>document.body.dataset.current===h,hash,{timeout:5000});
  await sleep(80);
}

async function main() {
  const browser=await chromium.launch({headless:true});
  try {
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), page=await ctx.newPage();
    await page.goto(new URL('/index.html',base).toString(),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(window.M4&&window.MarleyApp&&window.M4D),null,{timeout:10000}); await page.evaluate(()=>window.M4?.loadExample?.());
    const terms=[];
    for(let i=1;i<=15;i++){
      const h=`C${String(i).padStart(2,'0')}`;await route(page,h);
      const found=await page.evaluate((h)=>document.body.innerText.split(/\n+/).map(s=>s.trim()).filter(s=>/\bdemo\b|demostraci[oó]n/i.test(s)).map(text=>({hash:h,text})),h);terms.push(...found);
    }
    for(let i=0;i<=17;i++){
      const h=`R${String(i).padStart(2,'0')}`;await route(page,h);
      const found=await page.evaluate((h)=>document.body.innerText.split(/\n+/).map(s=>s.trim()).filter(s=>/\bdemo\b|demostraci[oó]n/i.test(s)).map(text=>({hash:h,text})),h);terms.push(...found);
    }
    const screenData=[];
    for(const width of [360,390,414]){
      await page.setViewportSize({width,height:width===360?800:width===390?844:896});
      for(const h of ['C01','C02','C03','C04','C05','C08','C12','C13','C14','R00','R01','R02']){
        await route(page,h);
        const data=await page.evaluate((h)=>{
          const vis=(e)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};
          const sel=(e)=>`${e.tagName.toLowerCase()}${e.id?`#${e.id}`:''}${typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).join('.'):''}`;
          const label=(e)=>(e.innerText||e.getAttribute('aria-label')||e.value||'').trim().replace(/\s+/g,' ').slice(0,80);
          const h1=[...document.querySelectorAll('h1')].find(vis), allButtons=[...document.querySelectorAll('button,a[href]')].filter(vis);
          const fixed=[...document.querySelectorAll('body *')].filter((e)=>vis(e)&&['fixed','sticky'].includes(getComputedStyle(e).position)).map((e)=>{const r=e.getBoundingClientRect();return{sel:sel(e),label:label(e),pos:getComputedStyle(e).position,top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right)}});
          const small=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link]')].filter((e)=>vis(e)&&!e.disabled).map((e)=>{const t=e.matches('input[type=checkbox],input[type=radio]')?(e.closest('label')||e):e,r=t.getBoundingClientRect();return{sel:sel(e),target:sel(t),w:Math.round(r.width),h:Math.round(r.height),label:label(e)}}).filter(x=>x.w<44||x.h<44);
          const ctas=allButtons.filter((e)=>/m5-btn|btn--(primary|secondary)|\.primary|\.secondary/.test(e.className||'')).map((e)=>{const r=e.getBoundingClientRect();return{sel:sel(e),label:label(e),top:Math.round(r.top),bottom:Math.round(r.bottom)}});
          const supportFound=[...document.querySelectorAll('*')].find((e)=>vis(e)&&((e.innerText||'').includes('Cada rol ve solo lo que necesita'))); let contrast=null;
          if(supportFound){const s=getComputedStyle(supportFound);contrast={sel:sel(supportFound),color:s.color,bg:s.backgroundColor,text:label(supportFound)}}
          const video=[...document.querySelectorAll('video')].map(v=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,poster:v.getAttribute('poster'),preload:v.preload,readyState:v.readyState,networkState:v.networkState}));
          const sources=performance.getEntriesByType('resource').filter(r=>/\.mp4|\.webm|\.m4v/i.test(r.name)).map(r=>({name:r.name.split('/').pop(),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}));
          return{hash:h,width:innerWidth,h1:h1?{text:label(h1),top:Math.round(h1.getBoundingClientRect().top),bottom:Math.round(h1.getBoundingClientRect().bottom)}:null,ctas,fixed,small:small.slice(0,15),support:Boolean(supportFound),contrast,video,sources,scrollHeight:document.documentElement.scrollHeight};
        },h);
        screenData.push(data);
      }
    }
    await route(page,'C08');
    const c08Scroll=[];
    for(const [stage,y] of [['inicio',0],['medio',500],['final',1500]]){await page.evaluate(v=>scrollTo(0,v),y);await sleep(100);c08Scroll.push(await page.evaluate((stage)=>({stage,y:scrollY,fixed:[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return (s.position==='fixed'||s.position==='sticky')&&r.width&&r.height}).map(e=>{const r=e.getBoundingClientRect();return{cls:e.className,top:Math.round(r.top),bottom:Math.round(r.bottom),text:(e.innerText||'').trim().slice(0,80)}})}),stage))}
    await route(page,'C02');
    const c02=await page.evaluate(()=>({bodyText:document.body.innerText.split(/\n+/).filter(x=>/\bdemo\b|demostraci[oó]n/i.test(x)),video:[...document.querySelectorAll('video')].map(v=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,poster:v.getAttribute('poster'),preload:v.preload,readyState:v.readyState})),media:[...document.querySelectorAll('video,source,iframe')].map(e=>({tag:e.tagName,src:e.getAttribute('src'),dataSrc:e.getAttribute('data-src'),poster:e.getAttribute('poster')})),resources:performance.getEntriesByType('resource').filter(r=>/\.mp4|\.webm|\.m4v/i.test(r.name)).map(r=>({name:r.name.split('/').pop(),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))}));
    process.stdout.write(JSON.stringify({terms,screenData,c08Scroll,c02},null,2)+'\n'); await ctx.close();
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
