/* cargar-vida.js: vida.css y vida.js se piden a la primera interacción. */
(function(){'use strict';if(window.__vidaCarga)return;window.__vidaCarga=1;
var E=['scroll','wheel','touchstart','pointerdown','keydown','hashchange'],p=null,z=null;
function c(t,u){return new Promise(function(k,m){var e=document.createElement(t=='css'?'link':'script');
if(t=='css'){e.rel='stylesheet';e.href=u}else e.src=u;e.onload=k;e.onerror=m;document.head.appendChild(e)})}
function v(){if(p)return;E.forEach(function(n){window.removeEventListener(n,v,true)});
p=c('css','recursos/vida/vida.css').then(function(){return c('js','recursos/vida/vida.js')})
.then(function(){if(z)window.MarleyVida.abrir(z);z=null}).catch(function(){})}
E.forEach(function(n){window.addEventListener(n,v,{capture:true,passive:true})});
document.addEventListener('click',function(e){var q=e.target.closest&&e.target.closest('[data-zoom]');
if(!q||window.MarleyVida)return;e.preventDefault();e.stopPropagation();z=q;v()},true)})();
