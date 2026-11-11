const { chromium } = require('./playwright-system-chrome.cjs');
const base=process.argv[2]||'http://127.0.0.1:8879/';
const label=(e)=>(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80);
async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'}),page=await ctx.newPage();
  await page.goto(new URL('/index.html#C02',base).toString(),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.M4&&window.MarleyApp&&window.M4D),null,{timeout:10000});await page.waitForTimeout(300);
  const data=[];
  async function go(hash){await page.evaluate(h=>window.MarleyApp.go(h,{evaluation:true}),hash);await page.waitForFunction(h=>document.body.dataset.current===h,hash,{timeout:5000}).catch(async()=>{const state=await page.evaluate(()=>({current:document.body.dataset.current,hash:location.hash}));throw new Error(`Route ${hash} did not settle: ${JSON.stringify(state)}`)});await page.waitForTimeout(80)}
  const summary=(hash)=>page.evaluate((hash)=>{
   const chain=e=>{const a=[];for(let n=e;n&&a.length<6;n=n.parentElement)a.push(`${n.tagName.toLowerCase()}${n.id?`#${n.id}`:''}${typeof n.className==='string'&&n.className.trim()?'.'+n.className.trim().split(/\s+/).join('.'):''}`);return a};
   const label=e=>(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80);
   const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
   const targetTexts=hash==='C14'?['Añadir a mi propuesta']:hash==='C15'?['Revisar soporte']:hash==='C08'?['COTIZAR','CONTINUAR MI SOLUCIÓN','Te ayudamos a decidir']:hash==='C03'?['CONFIRMAR PROPUESTA']:hash==='C04'?['VER MI PROPUESTA']:hash==='C05'?['CONFIRMAR PROPUESTA']:[];
   const ctas=[...document.querySelectorAll('button,a[href],[role=button]')].filter(vis).filter(e=>targetTexts.some(t=>label(e).toLowerCase().includes(t.toLowerCase()))).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:label(e),path:chain(e),top:Math.round(r.top),bottom:Math.round(r.bottom),position:s.position,background:s.backgroundColor}});
   const h1=[...document.querySelectorAll('h1')].find(vis);const h1Data=h1?{text:label(h1),path:chain(h1),top:Math.round(h1.getBoundingClientRect().top),bottom:Math.round(h1.getBoundingClientRect().bottom)}:null;
   const fixed=[...document.querySelectorAll('body *')].filter(e=>vis(e)&&['fixed','sticky'].includes(getComputedStyle(e).position)).map(e=>{const r=e.getBoundingClientRect();return{path:chain(e),text:label(e),position:getComputedStyle(e).position,top:Math.round(r.top),bottom:Math.round(r.bottom)}});
   let grano=document.querySelector('#m9-add-grano');
   const granos=[...document.querySelectorAll('[id],[class]')].filter(e=>(e.id+' '+e.className).toLowerCase().includes('grano')).map(e=>({path:chain(e),bg:getComputedStyle(e).backgroundColor,cls:e.className,id:e.id}));
   const support=[...document.querySelectorAll('*')].filter(e=>vis(e)&&(e.childElementCount===0)&&e.textContent.includes('Cada rol ve solo lo que necesita')).map(e=>{const s=getComputedStyle(e);return{text:e.textContent,style:{color:s.color,bg:s.backgroundColor,fontSize:s.fontSize,fontWeight:s.fontWeight},path:chain(e)}});
   const mbar=document.querySelector('.m5-mbar'),launcher=document.querySelector('#m7-launcher'),chat=document.querySelector('.b2c-chat');
   const portal=document.querySelector('section.portal-content');const portalChildren=portal&&['C14','C15'].includes(hash)?[...portal.children].map(e=>({tag:e.tagName.toLowerCase(),cls:e.className,id:e.id,text:label(e),path:chain(e)})):null;
   return{hash,width:innerWidth,scrollHeight:document.documentElement.scrollHeight,h1:h1Data,ctas,fixed:fixed.filter(x=>['m5-top','m5-stage-pin','m5-mbar','m7-launcher','b2c-chat','m4-strip'].some(y=>x.path.join(' ').includes(y))),parents:{mbar:mbar?chain(mbar):null,launcher:launcher?chain(launcher):null,chat:chat?chain(chat):null},granos,grano:grano?{bg:getComputedStyle(grano).backgroundColor,path:chain(grano)}:null,support,portalChildren};
  },hash);
  data.push(await page.evaluate(()=>({hash:'initial-direct',current:document.body.dataset.current,video:[...document.querySelectorAll('video')].map(v=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,poster:v.getAttribute('poster'),preload:v.preload,readyState:v.readyState})),resources:performance.getEntriesByType('resource').filter(r=>/\.mp4|\.webm|\.m4v/i.test(r.name)).map(r=>({name:r.name.split('/').pop(),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))})));
  await page.evaluate(()=>window.M4?.loadExample?.());
  for(const h of ['C01','C03','C04','C05','C08','C10','C14','C15','R00','R01','R02']){await go(h);data.push(await summary(h));}
  process.stdout.write(JSON.stringify(data,null,2)+'\n');await ctx.close();
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
