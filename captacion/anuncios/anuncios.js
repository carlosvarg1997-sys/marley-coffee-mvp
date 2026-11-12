(() => {
  const app = document.getElementById('app');
  if (!app) return;
  const page = app.dataset.page;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (n) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
  const urlFor = (s) => s || '#';
  const load = async () => {
    const response = await fetch('anuncios-data.json');
    if (!response.ok) throw new Error(`No se pudo leer anuncios-data.json (${response.status})`);
    return response.json();
  };
  const nav = (d) => `<header class="ad-top"><div class="ad-top-inner"><div class="ad-brandline"><span class="nm-firma" aria-hidden="true"></span><span>Marley Coffee Empresas · planificación de medios</span><span class="ad-chip yellow">Borrador local</span></div><nav class="ad-nav" aria-label="Canales de publicidad">${d.site.navigation.map(item=>`<a href="${esc(item.file)}" ${item.id===page?'aria-current="page"':''}>${esc(item.label)}</a>`).join('')}</nav></div></header>`;
  const footer = (d) => `<footer class="ad-footer"><span>${esc(d.site.status)} · ${esc(d.site.asOf)}</span><p>${esc(d.site.disclaimer)}</p></footer>`;
  const shell = (d,{kicker,title,subtitle,side,warning='',body}) => `${nav(d)}<main id="contenido" class="ad-main"><section class="ad-hero"><div><p class="ad-kicker">${esc(kicker)}</p><h1 class="nm-h1">${esc(title)}</h1><p class="nm-lead">${esc(subtitle)}</p></div><aside class="ad-hero-side">${side}</aside></section>${warning?`<div class="ad-warning">${warning}</div>`:''}${body}</main>${footer(d)}`;
  const section = (title,tag,content,extra='') => `<section class="ad-section ${extra}"><div class="ad-section-head"><h2 class="nm-h2">${esc(title)}</h2>${tag?`<span class="ad-label">${esc(tag)}</span>`:''}</div>${content}</section>`;
  const pair = (label,value) => `<div class="ad-pair"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const artSizes={feed:[1080,1350],reel:[1080,1920],square:[1200,1200],wide:[1280,720]};
  const subjectAssets={bar:'assets/cutouts/bar.webp',office:'assets/cutouts/office.webp',pods:'assets/cutouts/pods.webp',cafe:'assets/cutouts/cafe.webp',mug:'assets/cutouts/mug.webp'};
  const subjectSpecs={bar:{width:430,optico:0},office:{width:400,optico:0},pods:{width:420,optico:0},cafe:{width:350,optico:0},mug:{width:420,optico:.07}};
  const textLines=(value)=>esc(value).replace(/\\n/g,'<br>');
  const creativeFrame=({template,format='feed',series='CUENTAS CLARAS',number='01/01',exportId='',content='',cta='DESLIZA →',previewOnly=false})=>{
    const [width,height]=artSizes[format]||artSizes.feed;
    const stageHeight=format==='reel'?1350:height;
    const stageTop=format==='reel'?285:0;
    const attrs=exportId&&!previewOnly?'data-export="'+esc(exportId)+'" data-export-width="'+width+'" data-export-height="'+height+'"':'';
    const stage='<div class="slide-stage" style="width:'+width+'px;height:'+stageHeight+'px;top:'+stageTop+'px"><div class="esquinas"><i></i></div><div class="marca"><span>MARLEY COFFEE · EMPRESAS</span><span>'+esc(series)+' · '+esc(number)+'</span></div><div class="vertical">EMPRESAS</div>'+content+'<span class="firma" aria-hidden="true"></span><span class="desliza">'+esc(cta)+'</span><div class="grano" aria-hidden="true"></div></div>';
    const slide='<section class="slide s-'+template+' s-'+format+'" '+attrs+' data-design-width="'+width+'" data-design-height="'+height+'" data-safe-top="'+(format==='reel'?285:0)+'" style="width:'+width+'px;height:'+height+'px">'+stage+'</section>';
    return '<div class="creative-preview" data-design-width="'+width+'" data-design-height="'+height+'" style="aspect-ratio:'+width+'/'+height+'">'+slide+'</div>';
  };
  const ccArt=({template='t',word='TAZAS',hookTop='ANTES DE ELEGIR',highlight='MÁQUINA',hookTail=',',hookBottom='CUENTA TUS',support='',subject='bar',series='CUENTAS CLARAS',number='01/01',format='feed',photo='',exportId='',previewOnly=false,value='80',label='Tazas al día',rows=[['Mañana','45 tazas'],['Tarde','35 tazas'],['Mes · 26 días · 9 g por taza','18,7 kg']],note='Valores de ejemplo. El consumo real se confirma en tu propuesta.',cta='DESLIZA →'})=>{
    const [width]=artSizes[format]||artSizes.feed;
    let content='';
    if(template==='t'){
      const spec=subjectSpecs[subject]||subjectSpecs.bar;
      const id='sujeto-'+(exportId||format+'-'+word).replace(/[^a-zA-Z0-9_-]/g,'-');
      const top=format==='wide'?82:format==='square'?145:176;
      const wordTop=format==='wide'?330:format==='square'?330:318;
      const supportAt=format==='wide'?228:format==='square'?915:1120;
      const targetWordWidth=Math.round(width*.875);
      content='<p class="gancho centro" style="top:'+top+'px">'+textLines(hookTop)+' <mark>'+textLines(highlight)+'</mark>'+textLines(hookTail)+'<br>'+textLines(hookBottom)+'</p>'+
        '<h2 class="gigante" data-ancho="'+targetWordWidth+'" data-centro="1" style="top:'+wordTop+'px">'+esc(word)+'</h2>'+
        '<div class="sombra" data-sombra-de="'+id+'"></div>'+
        '<img class="sujeto" id="'+id+'" data-monta="0.17" data-ancho-sujeto="'+spec.width+'" data-optico="'+spec.optico+'" src="'+(subjectAssets[subject]||subjectAssets.bar)+'" alt="" aria-hidden="true">'+
        '<p class="apoyo centro" style="top:'+supportAt+'px">'+textLines(support)+'</p>';
    }else if(template==='z'){
      const image=photo||'../../recursos/escenas/barras/cam_lit.webp';
      const hookTopPos=format==='wide'?76:176;
      const supportAt=format==='wide'?215:748;
      const wordAt=format==='wide'?365:900;
      const left=format==='wide'?70:76;
      content='<img class="fondo" src="'+esc(image)+'" alt="" aria-hidden="true"><div class="velo" aria-hidden="true"></div>'+
        '<p class="gancho" style="top:'+hookTopPos+'px;left:'+left+'px">'+textLines(hookTop)+' <mark>'+textLines(highlight)+'</mark>'+textLines(hookTail)+'<br>'+textLines(hookBottom)+'</p>'+
        '<p class="apoyo" style="top:'+supportAt+'px;left:'+left+'px;max-width:'+(format==='wide'?650:860)+'px">'+textLines(support)+'</p>'+
        '<h2 class="gigante" data-ancho="860" style="left:'+left+'px;top:'+wordAt+'px">'+esc(word)+'</h2>';
    }else if(template==='dato'){
      const rowsMarkup=rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('');
      const labelLeft=value.length>2?690:560;
      content='<p class="gancho" style="top:150px;left:76px">'+textLines(hookTop)+' <mark>'+textLines(highlight)+'</mark>'+textLines(hookTail)+'<br>'+textLines(hookBottom)+'</p>'+
        '<h2 class="gigante dato-valor" style="left:62px;top:330px;font-size:560px;color:#F3C900">'+esc(value)+'</h2>'+
        '<p class="etiqueta" style="left:'+labelLeft+'px;top:548px">'+textLines(label)+'</p>'+
        '<dl class="ficha" style="left:76px;right:76px;top:870px">'+rowsMarkup+'</dl>'+
        '<p class="nota" style="left:76px;top:1124px;max-width:900px">'+textLines(note)+'</p>';
    }else{throw new Error('Plantilla A4 desconocida: '+template);}
    return creativeFrame({template,format,series,number,exportId,content,cta,previewOnly});
  };
  const adjustApprovedSlides=async()=>{
    await document.fonts.ready;
    const slides=[...document.querySelectorAll('.slide[data-design-width]')];
    await Promise.all(slides.flatMap(slide=>[...slide.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))));
    slides.forEach(slide=>{
      const designWidth=Number(slide.dataset.designWidth||1080);
      slide.querySelectorAll('.gigante[data-ancho]').forEach(h=>{
        const requested=Number(h.dataset.ancho);let lo=40,hi=900;
        for(let i=0;i<22;i++){const mid=(lo+hi)/2;h.style.fontSize=mid+'px';(h.scrollWidth>requested?hi=mid:lo=mid);}
        h.style.fontSize=lo+'px';
        if(h.dataset.centro)h.style.left=((designWidth-h.scrollWidth)/2)+'px';
      });
      slide.querySelectorAll('.sujeto[data-monta]').forEach(img=>{
        if(!img.naturalWidth||!img.naturalHeight)return;
        const heading=slide.querySelector('.gigante');if(!heading)return;
        const requested=Number(img.dataset.anchoSujeto);
        const width=Math.min(requested,img.naturalWidth*1.1);img.style.width=width+'px';
        const height=width*img.naturalHeight/img.naturalWidth;
        const fontSize=parseFloat(heading.style.fontSize),base=heading.offsetTop+heading.offsetHeight;
        const top=base-Number(img.dataset.monta)*fontSize;
        const optical=Number(img.dataset.optico||0)*width;
        img.style.left=((designWidth-width)/2+optical)+'px';img.style.top=top+'px';
        const shadow=slide.querySelector('[data-sombra-de="'+img.id+'"]');
        if(shadow){shadow.style.width=(width*.7)+'px';shadow.style.left=((designWidth-width*.7)/2+optical*1.6)+'px';shadow.style.top=(top+height-26)+'px';}
      });
    });
    document.querySelectorAll('.creative-preview').forEach(frame=>{
      const slide=frame.querySelector('.slide');if(!slide)return;
      const width=Number(frame.dataset.designWidth),height=Number(frame.dataset.designHeight);
      const scale=Math.min(1,frame.clientWidth/width);
      frame.style.height=(height*scale)+'px';
      slide.style.transform='scale('+scale+')';
    });
    document.body.dataset.plantillasListas='1';
  };
  const hyp = (h,buyer,stage,variable='')=>{
    const nativeSearch=page==='google';
    const system=nativeSearch?'Formato nativo de Search; se conserva la lectura estándar de Google sin vestir la SERP con el estilo de marca.':'Sistema visual aprobado constante: T·producto, Z·escena o Dato·Cuentas claras; palabra gigante, gancho con una palabra amarilla, marcas de esquina, firma tricolor y caja blanca solo en zona limpia. Sujeto completo, centrado y a escala real. Display pequeño: palabra y CTA.';
    const testVariable=variable||h.variable||(nativeSearch?'Tensión del mensaje: qué incluye el comodato frente a cómo mantener continuidad. Cambiar solo el texto; conservar consulta, destino, palabras clave y recursos.':'Tensión del mensaje: claridad de condiciones frente a continuidad del servicio. Mantener composición, sujeto, audiencia y CTA; cambiar una sola variable por prueba.');
    const values=[['Comprador',buyer||h.buyer],['Fase',stage||h.stage],['Evidencia',h.evidence],['Tensión',h.tension],['Mecanismo',h.mechanism],['Sistema visual constante',system],['Variable',testVariable],['Indicador',h.indicator],['Resguardo',h.guard],['Regla de decisión',h.decision]];
    return '<div class="ad-hypothesis"><h4>Ficha de hipótesis</h4><dl>'+values.map(([k,v])=>pair(k,v)).join('')+'</dl></div>';
  };

  const sourceLinks = (sources) => `<ul class="ad-source-list">${sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label)}</a><small>${esc(s.platform||'')} · consulta ${esc(s.checked||'10-nov-2026')} · ${esc(s.status||'Fuente oficial')}</small></li>`).join('')}</ul>`;
  const link = (label,url,ghost=false) => `<a class="ad-button${ghost?' ghost':''}" href="${esc(urlFor(url))}">${esc(label)}</a>`;
  const printUrl = (label,url) => `<div class="ad-url"><strong>${esc(label)}:</strong> ${esc(url)}</div>`;

  function renderIndex(d){
    const allocated=d.budget.rows.reduce((sum,row)=>sum+row.amountCLP,0);
    const channels=d.site.navigation.filter(x=>!['index','remarketing'].includes(x.id));
    const channelIntro={google:'Búsqueda con intención; 4 grupos RSA con destinos separados.',meta:'Reel de 18 s, carrusel de cinco tarjetas y formulario de una pregunta.',linkedin:'Documento de seis páginas, imagen única y formulario de cuatro campos.',youtube:'Vídeo in-stream de 20 s y bumper de seis segundos.',display:'Cuatro tamaños exactos en HTML/CSS, sujetos a elegibilidad.'};
    const channelCards=`<div class="ad-grid three">${channels.map((c)=>`<article class="ad-card"><div class="ad-card-top"><span class="ad-chip">${esc(c.label)}</span><span class="ad-label">Plan A4</span></div><h3>${esc(c.label)}</h3><p>${esc(channelIntro[c.id])}</p>${link('Ver maquetas',c.file,true)}</article>`).join('')}</div><div class="ad-actions">${link('Ver escenarios de remarketing','remarketing.html')}</div>`;
    const budgetRows=d.budget.rows.map(r=>`<tr><td>${esc(r.channel)}</td><td class="amount">${money(r.amountCLP)}</td><td>${esc(r.note)}</td></tr>`).join('');
    const budgetTable=`<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Partida del contexto</th><th>Presupuesto simulado</th><th>Supuesto visible</th></tr></thead><tbody>${budgetRows}<tr><td><strong>Total de pauta del plan</strong></td><td class="amount"><strong>${money(allocated)}</strong></td><td>La línea simulada de YouTube está incluida en el presupuesto global y no se suma aparte.</td></tr></tbody></table></div><p class="ad-scroll-note">${esc(d.budget.assumption)}</p>`;
    const testVariables={
      Search:'Mensaje: “qué incluye el comodato” frente a “cómo mantener continuidad”; mantener consulta, destino y formato RSA constantes.',
      Meta:'Gancho del Reel: consumo diario frente a condiciones por escrito; conservar arte, público y CTA.',
      LinkedIn:'Tensión del texto: preguntas antes de comparar frente a continuidad operativa; formato y audiencia constantes dentro de cada prueba.',
      YouTube:'Gancho de apertura: consumo del local frente a claridad del comodato; conservar duración, cierre y destino.',
      Display:'Mensaje: condiciones por escrito frente a continuidad del servicio; comparar dentro del mismo tamaño de banner.'
    };
    const experimentRows=d.experiments.map(e=>`<tr><td>${esc(e.channel)}</td><td>${esc(e.hypothesis)}</td><td>${esc(testVariables[e.channel]||e.variable)}</td><td>${esc(e.indicator)}</td><td>${esc(e.guard)}</td><td>${esc(e.rule)}</td></tr>`).join('');
    const experimentTable=`<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Canal</th><th>Hipótesis</th><th>Variable</th><th>Indicador</th><th>Resguardo</th><th>Regla</th></tr></thead><tbody>${experimentRows}</tbody></table></div>`;
    const linkedinStats=d.linkedin.audiences.map(a=>`<article class="ad-stat"><strong>${esc(a.size)}</strong><span>${esc(a.name)} · ${esc(a.status)}</span><p>${esc(a.forecast)}</p><small>${esc(a.source)}</small></article>`).join('');
    const forecastSection=`<div class="ad-stat-grid">${linkedinStats}</div><p class="ad-scroll-note">Cada rango es previsión de la herramienta, no resultado. La audiencia Meta de 20.400–24.000 también es una previsión de tamaño y fue marcada como demasiado pequeña; no equivale a alcance.</p>`;
    const sources=sourceLinks(d.sources);
    const body=section('Canales y piezas','abrir cada formato',channelCards)+section('Presupuesto simulado','CLP · plan de medios',budgetTable)+section('Previsiones disponibles','no son resultados',forecastSection)+section('Tabla de experimentos','indicadores en CRM',experimentTable)+section('Especificaciones y referencias','ayuda oficial consultada',sources);
    return shell(d,{kicker:'Publicidad · preparación A4',title:'Una decisión clara por canal.',subtitle:'Maquetas de anuncios, hipótesis y condiciones para una captación B2B medible. Solo hay previsiones medidas; esta carpeta no activa campañas.',side:`<strong>Estado de trabajo</strong>Plan de pauta v2 · corte 10-nov-2026.<br>Las condiciones comerciales se confirman en la propuesta Marley Coffee.<br><br><strong>Control de integridad</strong>${money(allocated)} distribuidos frente a un total de contexto de ${money(d.budget.totalCLP)}.`,warning:'Todas las piezas son borradores de revisión. Ningún anuncio, audiencia, píxel, formulario o presupuesto se activó.',body});
  }

  function renderGoogle(d){
    const g=d.google;
    const groupCards=g.groups.map((x)=>{
      const headlines=x.rsa.headlines.map((t,i)=>`<div class="ad-asset"><span>Título ${String(i+1).padStart(2,'0')}</span><p>${esc(t)}</p><small class="ad-count" data-count="${esc(t)}" data-limit="30"></small></div>`).join('');
      const descriptions=x.rsa.descriptions.map((t,i)=>`<div class="ad-asset"><span>Descripción ${i+1}</span><p>${esc(t)}</p><small class="ad-count" data-count="${esc(t)}" data-limit="90"></small></div>`).join('');
      const keywords=x.keywords.map(k=>`<span class="ad-keyword">${esc(k)}</span>`).join('');
      const sitelinks=x.sitelinks.map(s=>`<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('');
      return `<article class="ad-card"><div class="ad-card-top"><span class="ad-chip yellow">Grupo · ${esc(x.name)}</span><span class="ad-chip">${esc(x.stage)}</span></div><div class="ad-grid"><div><h3>Vista de resultado de búsqueda</h3><div class="ad-search"><div class="ad-search-brand">Google</div><div class="ad-search-box">cafetera café negocio</div><div class="ad-search-result"><div class="url"><span class="ad-ad-label">Anuncio</span>marleycoffee.cl › empresas</div><h3>${esc(x.rsa.headlines.slice(0,3).join(' · '))}</h3><p>${esc(x.rsa.descriptions[0])}</p>${sitelinks?`<ul>${sitelinks}</ul>`:''}</div></div><p class="ad-scroll-note">Vista de maqueta; combinaciones reales de títulos y extensiones dependen de la plataforma.</p></div><div><h3>15 títulos · máximo 30</h3><div class="ad-assets">${headlines}</div><h3 style="margin-top:20px">4 descripciones · máximo 90</h3><div class="ad-assets">${descriptions}</div></div></div><div class="ad-section" style="padding-bottom:0;border:0"><h3>Palabras clave seleccionadas del universo coherente</h3><p>Selección de este grupo tomada del CSV regenerado desde las 83 frases coherentes. Las demás frases no seleccionadas no se convierten en negativas.</p><div class="ad-keywords">${keywords}</div><p class="ad-label" style="margin-top:16px">Negativas en concordancia exacta</p><div class="ad-keywords">${g.negativeKeywords.map(k=>`<span class="ad-keyword">[${esc(k)}]</span>`).join('')}</div><p class="ad-scroll-note">${esc(g.negativeMatch)} · Universo: ${esc(g.sourceNote)}</p></div>${printUrl('Destino principal',x.primaryUrl)}${hyp(x.hypothesis,x.buyer,x.stage)}</article>`;
    }).join('');
    const sourceList=sourceLinks(d.sources.filter(s=>s.platform.startsWith('Google')));
    const body=section('Cuatro grupos de búsqueda','15 títulos · 4 descripciones cada uno',`<div class="ad-grid">${groupCards}</div>`)+section('Criterio de agrupación y límites','fuentes oficiales',`<div class="ad-grid"><article class="ad-card"><h3>Lectura del universo</h3><p>${esc(g.sourceNote)}</p><p><strong>Destinos separados:</strong> restaurantes y cafeterías tienen su propio grupo, anuncio adaptable y landing, alineados con la intención de búsqueda.</p><p><strong>Previsión:</strong> ${esc(g.googleForecast)}</p><p>Recursos de anuncio: enlaces a categorías existentes; no se agregan ofertas, precios, llamadas de urgencia ni condiciones.</p></article><article class="ad-card"><h3>Ayuda oficial consultada</h3>${sourceList}</article></div>`);
    return shell(d,{kicker:'Google Ads · Search',title:g.title,subtitle:g.subtitle,side:`<strong>Nombre de campaña según taxonomía</strong>CL_GOOGLE_SEARCH_OBJETIVO_AUDIENCIA_OFERTA_FECHA_V01<br><br><strong>Destino</strong>Landings locales separadas de restaurantes, cafeterías, hoteles y oficinas; UTMs visibles en cada anuncio.`,warning:'El planificador entrega un universo pequeño. No se proyectan impresiones, clics, contactos o conversiones del grupo; verifica términos reales antes de cualquier decisión.',body});
  }

  function renderMeta(d){
    const m=d.meta;
    const scenes=m.reel.scenes.map(s=>'<div class="ad-scene"><time>'+esc(s.time)+'</time><p><strong>'+esc(s.overlay)+'</strong><br>'+esc(s.visual)+'<br><span class="ad-label">Locución:</span> '+esc(s.voiceover)+'</p></div>').join('');
    const carousel=[
      {template:'t',word:'TAZAS',hookTop:'ANTES DE ELEGIR',highlight:'MÁQUINA',hookTail:',',hookBottom:'CUENTA TUS',support:'Empieza por el consumo real de tu local.',subject:'mug'},
      {template:'z',word:'RITMO',hookTop:'LAS',highlight:'TAZAS',hookBottom:'MARCAN EL',support:'Anota a qué horas se juntan para definir la máquina.',photo:'../../recursos/escenas/restaurante/fin.webp'},
      {template:'dato',word:'80',hookTop:'UN DÍA DE',highlight:'SERVICIO',hookBottom:'COMO EJEMPLO',value:'80',label:'tazas\\nal día',rows:[['Mañana','45 tazas'],['Tarde','35 tazas'],['Mes · 26 días · 9 g por taza','18,7 kg']],note:'Valores de ejemplo. El consumo real se confirma en tu propuesta.'},
      {template:'z',word:'ALCANCE',hookTop:'ANTES DE COMPARAR',highlight:'PREGUNTA',hookBottom:'POR SERVICIO',support:'Confirma canal, responsabilidades y alcance en la propuesta.',photo:'../../recursos/escenas/oficina/fin.webp'},
      {template:'t',word:'PROPUESTA',hookTop:'ANTES DE DECIDIR',highlight:'ACLARA',hookBottom:'TU',support:'Confirma las condiciones en tu propuesta.',subject:'bar'}
    ];
    const cards=m.carousel.cards.map((c,i)=>'<article class="ad-carousel-card">'+ccArt({...carousel[i],number:'0'+(i+1)+'/05',format:'feed',series:'CUENTAS CLARAS',cta:'DESLIZA →',exportId:'meta-carrusel-'+String(i+1).padStart(2,'0')})+'<div class="inner"><h4>'+esc(c.title)+'</h4><p>'+esc(c.body)+'</p></div></article>').join('');
    const reelArt=ccArt({...carousel[0],number:'01/01',format:'reel',series:'CUENTAS CLARAS',cta:'DESLIZA →',exportId:'meta-reel'});
    const fields=m.instantForm.prefillFields.map(f=>'<div class="ad-field"><label>'+esc(f)+'</label><div class="ad-input">Campo precompletado por la plataforma</div></div>').join('');
    const form='<div class="ad-form-mock"><span class="ad-chip">Formulario instantáneo · maqueta</span><h3>'+esc(m.instantForm.formTitle)+'</h3><p>'+esc(m.instantForm.intro)+'</p>'+fields+'<div class="ad-field"><label>'+esc(m.instantForm.question)+'</label><div class="ad-input">'+esc(m.instantForm.answerPlaceholder)+'</div></div><div class="ad-check">✓ <span>'+esc(m.instantForm.privacy)+'</span></div><div class="ad-check">○ <span>Quiero recibir guías y novedades. (Opcional; permiso separado.)</span></div><button class="ad-button" type="button">Enviar solicitud</button><p class="ad-scroll-note">Confirmación: '+esc(m.instantForm.confirmation)+' · <a href="'+esc(m.instantForm.confirmationUrl)+'">'+esc(m.instantForm.confirmationCta)+'</a>. La UTM se conserva en este enlace de salida; no se presume que el envío nativo la incluya.</p></div>';
    const src=sourceLinks(d.sources.filter(s=>s.platform.startsWith('Meta')));
    const reelHyp=hyp(m.reel.hypothesis,undefined,undefined,'Gancho: consumo diario frente a condiciones por escrito. Mantener una sola versión visual, audiencia y CTA.');
    const carouselHyp=hyp(m.carousel.hypothesis,undefined,undefined,'Tensión del mensaje: consumo y horarios frente a condiciones por escrito; mantener formato, sujeto, público y CTA.');
    const formHyp=hyp(m.instantForm.hypothesis,undefined,undefined,'Pregunta del formulario: “¿Cuántas tazas sirves al día?”. Mantener los campos precompletados y el permiso promocional separado.');
    const body=section('Reel · guion gráfico','18 segundos · 9:16','<div class="ad-meta"><div><div class="ad-phone"><div class="ad-phone-bar">Instagram · Reels</div><div class="ad-phone-screen"><div class="ad-social-head"><span class="ad-avatar">MC</span><span>Marley Coffee Empresas · Patrocinado</span></div><div class="ad-social-copy">'+esc(m.reel.copy)+'</div><div class="ad-reel-frame">'+reelArt+'</div></div><div class="ad-social-foot"><span>Me gusta · Comentar · Compartir</span><span>'+esc(m.reel.cta)+' →</span></div></div><p class="ad-reel-time">'+m.reel.durationSeconds+' s · Vertical 9:16 · zona segura: 250 px arriba y abajo. Esta etiqueta queda fuera de la pieza.</p></div><div><h3>Secuencia de escenas</h3><div class="ad-scene-list">'+scenes+'</div>'+printUrl('Destino con UTM',m.reel.url)+reelHyp+'</div></div>')+
      section('Carrusel · cinco tarjetas','T · producto · Z · escena · Dato','<div class="ad-card"><p><strong>Texto principal:</strong> '+esc(m.carousel.copy)+'</p><div class="ad-carousel-strip">'+cards+'</div><p><span class="ad-chip">CTA · '+esc(m.carousel.cta)+'</span><span class="ad-chip">1080 × 1350 px</span></p>'+printUrl('Destino con UTM',m.carousel.url)+carouselHyp+'</div>')+
      section('Formulario instantáneo','una pregunta personalizada','<div class="ad-meta"><div>'+form+'</div><div class="ad-card"><h3>Público medido</h3><div class="ad-stat-grid"><div class="ad-stat"><strong>'+esc(m.audience.size)+'</strong><span>'+esc(m.audience.label)+'</span></div><div class="ad-stat"><strong>'+esc(m.audience.location)+'</strong><span>'+esc(m.audience.name)+' · '+esc(m.audience.asOf)+'</span></div></div><p>'+esc(m.audience.caveat)+'</p>'+formHyp+'</div></div>')+
      section('Especificaciones consultadas','ayuda oficial de formatos','<div class="ad-card"><p>'+esc(m.specNote)+'</p>'+src+'</div>');
    return shell(d,{kicker:'Meta · Instagram y Facebook',title:m.title,subtitle:m.subtitle,side:'<strong>Público medido</strong>'+esc(m.audience.name)+' · '+esc(m.audience.size)+' · '+esc(m.audience.location)+'.<br><br><strong>Previsión de tamaño, no de entrega</strong>'+esc(m.audience.label)+'<br><br><strong>Nombre</strong>CL_META_REELS_RESTAURANTES_CONTINUIDAD_202612_V01',warning:'La herramienta marcó este público como demasiado pequeño. La maqueta no acepta la recomendación de objetivo, no guarda campañas ni activa una audiencia.',body});
  }

  function renderLinkedin(d){
    const l=d.linkedin;
    const doc=l.documentAd;
    const docOptions=[
      {template:'t',word:'GUÍA',hookTop:'ANTES DE',highlight:'FIRMAR,',hookBottom:'REVISA LA',support:'Preguntas para conversar sobre máquina, café y condiciones con datos de tu negocio.',subject:'mug'},
      {template:'dato',word:'80',hookTop:'EJEMPLO DE UN',highlight:'DÍA',hookBottom:'DE SERVICIO',value:'80',label:'tazas\\nal día',rows:[['Mañana','45 tazas'],['Tarde','35 tazas'],['Mes · 26 días · 9 g por taza','18,7 kg']],note:'Valores de ejemplo. Usa los datos de tu local y confirma el consumo en la propuesta.'},
      {template:'z',word:'SERVICIO',hookTop:'DEFINE EL',highlight:'EQUIPO',hookBottom:'PARA TU',support:'¿Qué equipo se propone y para qué preparaciones de tu negocio?',photo:'../../recursos/escenas/barras/cam_lit.webp'},
      {template:'dato',word:'03',hookTop:'TRES PUNTOS',highlight:'POR ACLARAR',hookBottom:'EN LA PROPUESTA',value:'03',label:'puntos por\\nconfirmar',rows:[['Máquina','a confirmar'],['Café','a confirmar'],['Servicio','si corresponde']],note:'Confirma el alcance en la propuesta; no des por incluido lo que no aparece.'},
      {template:'z',word:'SERVICIO',hookTop:'UN CANAL',highlight:'CLARO',hookBottom:'AYUDA CON EL',support:'Pregunta por canal, reposición y responsables ante una incidencia.',photo:'../../recursos/escenas/barras/cam_lamp_3.webp'},
      {template:'z',word:'CONDICIONES',hookTop:'QUÉ QUEDA',highlight:'POR',hookBottom:'ESCRITO',support:'Aclara los compromisos de cada parte y las condiciones de término en la propuesta.',photo:'../../recursos/escenas/hotel/fin.webp'}
    ];
    const makeDocArt=(i)=>ccArt({...docOptions[i],series:'CUENTAS CLARAS',number:'0'+(i+1)+'/06',format:'feed',cta:i===0?'DESLIZA →':'SIGUIENTE →',exportId:'linkedin-documento-'+String(i+1).padStart(2,'0')});
    const pages=doc.pages.map((p,i)=>'<div class="doc-slide" aria-label="Página '+esc(p.number)+': '+esc(p.title)+'">'+makeDocArt(i)+'</div>').join('');
    const formFields=l.leadForm.fields.map(f=>'<div class="ad-field"><label>'+esc(f)+'</label><div class="ad-input">Precompletado por LinkedIn</div></div>').join('');
    const form='<div class="ad-form-mock"><span class="ad-chip">LinkedIn · formulario de generación de contactos</span><h3>'+esc(l.leadForm.formName)+'</h3><p><strong>'+esc(l.leadForm.offerHeadline)+'</strong><br>'+esc(l.leadForm.offerDetail)+'</p>'+formFields+'<div class="ad-check">✓ <span>'+esc(l.leadForm.privacy)+'</span></div><button class="ad-button" type="button">'+esc(l.leadForm.cta)+'</button><p class="ad-scroll-note">'+esc(l.leadForm.confirmation)+' <a href="'+esc(l.leadForm.confirmationUrl)+'">Continuar a la propuesta</a></p></div>';
    const imageArt=ccArt({template:'t',word:'PROPUESTA',hookTop:'ANTES DE FIRMAR,',highlight:'ACLARA',hookBottom:'TU',support:'Máquina, alcance y condiciones se confirman en la propuesta.',subject:'bar',series:'CUENTAS CLARAS',number:'01/01',format:'square',cta:'VER PROPUESTA →',exportId:'linkedin-imagen'});
    const image='<div class="ad-linkedin"><article class="ad-li-post"><div class="ad-li-header"><span class="ad-li-logo">MC</span><span><strong>Marley Coffee Empresas</strong><br>Patrocinado</span></div><p class="ad-li-copy">'+esc(l.singleImage.intro)+'</p><div class="ad-li-doc">'+imageArt+'<div class="ad-li-doc-caption"><h4>'+esc(l.singleImage.imageHeadline)+'</h4><p>'+esc(l.singleImage.description)+'</p></div></div><div class="ad-li-actions"><span>Recomendar</span><span>Comentar</span><span>Compartir</span><span>'+esc(l.singleImage.cta)+'</span></div></article></div>';
    const audienceCards=l.audiences.map(a=>'<article class="ad-card"><div class="ad-card-top"><span class="ad-chip yellow">'+esc(a.status)+'</span><span class="ad-chip">'+esc(a.size)+'</span></div><h3>'+esc(a.name)+'</h3><p>'+esc(a.forecast)+'</p><p><strong>Comprador:</strong> '+esc(a.buyer)+'</p><small>'+esc(a.source)+'</small></article>').join('');
    const sources=sourceLinks(d.sources.filter(s=>s.platform.startsWith('LinkedIn')));
    const documentHyp=hyp(doc.hypothesis,undefined,undefined,'Mensaje: guía de preguntas y datos del negocio. Mantener portada T, interiores Dato/Z, audiencia y formulario constantes.');
    const imageHyp=hyp(l.singleImage.hypothesis,undefined,undefined,'Mensaje: qué revisar antes de comparar. Mantener composición T, producto, audiencia y CTA constantes.');
    const formHyp=hyp(l.leadForm.hypothesis,undefined,undefined,'Campos: tres de contacto/contexto laboral más empresa; mantener oferta, público y aviso de privacidad constantes.');
    const body=section('Previsiones de Campaign Manager','rotuladas según archivo de origen','<div class="ad-grid three">'+audienceCards+'</div><p class="ad-scroll-note">Las cifras son previsiones de herramienta, no resultados. El Markdown rehecho del 9-nov registra 28.000+ con rangos de clics y contactos; el PDF v3 contiene estimaciones distintas para 120.000+ y un proxy parcial de oficinas de 240.000+. Se conserva la fuente de cada lectura.</p>')+
      section('Anuncio de documento','portada T · interiores Dato y Z','<div class="ad-meta"><div class="ad-doc-viewer"><div class="ad-doc-toolbar"><span>Vista del documento · '+doc.pageCount+' páginas</span><span>'+esc(doc.cta)+' →</span></div><div class="cc-doc-grid">'+pages+'</div></div><div><div class="ad-card"><span class="ad-chip">Sponsored Document Ad · maqueta</span><h3>'+esc(doc.headline)+'</h3><p>'+esc(doc.intro)+'</p><p class="ad-label">'+esc(doc.pageCount)+' páginas · 1080 × 1350 px</p><p>Nombre: '+esc(doc.campaignName)+'</p>'+printUrl('Destino con UTM',doc.confirmationUrl)+'</div>'+documentHyp+'</div></div>')+
      section('Imagen única','plantilla T · 1200 × 1200 px','<div class="ad-meta"><div>'+image+'</div><div class="ad-card"><span class="ad-chip">Single Image Ad · '+esc(l.singleImage.dimensions)+'</span><h3>'+esc(l.singleImage.imageHeadline)+'</h3><div class="ad-assets"><div class="ad-asset"><span>Texto introductorio</span><p>'+esc(l.singleImage.intro)+'</p><small class="ad-count" data-count="'+esc(l.singleImage.intro)+'" data-limit="150"></small></div><div class="ad-asset"><span>Titular</span><p>'+esc(l.singleImage.headline)+'</p><small class="ad-count" data-count="'+esc(l.singleImage.headline)+'" data-limit="70"></small></div><div class="ad-asset"><span>Descripción</span><p>'+esc(l.singleImage.description)+'</p><small class="ad-count" data-count="'+esc(l.singleImage.description)+'" data-limit="70"></small></div></div>'+printUrl('Destino con UTM',l.singleImage.url)+imageHyp+'</div></div>')+
      section('Formulario nativo','cuatro campos · permiso separado','<div class="ad-meta"><div>'+form+'</div><div class="ad-card"><h3>Datos mínimos y permiso separado</h3><p>Los cuatro campos recogen contacto y contexto laboral para responder a la solicitud. El permiso de comunicaciones promocionales se explica por separado; no se incorpora teléfono.</p>'+formHyp+'</div></div>')+
      section('Especificaciones oficiales','fuentes consultadas','<div class="ad-card"><p>'+esc(l.specNote)+'</p>'+sources+'</div>');
    return shell(d,{kicker:'LinkedIn · contenido patrocinado',title:l.title,subtitle:l.subtitle,side:'<strong>Campaña de documento</strong>'+esc(doc.campaignName)+'<br><br><strong>Previsiones</strong>Lecturas de Campaign Manager, rotuladas como previsión; no son métricas observadas.<br><br><strong>Nombre de campaña</strong>CL_LINKEDIN_[FORMATO]_[OBJETIVO]_[AUDIENCIA]_[OFERTA]_202612_V01',warning:'Las audiencias 120.000+, 28.000+ y 240.000+ proceden de lecturas distintas. Office 240.000+ es un proxy parcial del PDF v3, no un tamaño confirmado por el Markdown.',body});
  }

  function renderYoutube(d){
    const y=d.youtube;
    const youtubeBudget=d.budget.rows.find(row=>row.channel==='YouTube').amountCLP;
    const videoScenes=y.video.scenes.map(s=>'<div class="ad-scene"><time>'+esc(s.time)+'</time><p><strong>'+esc(s.overlay)+'</strong><br>'+esc(s.visual)+'<br><span class="ad-label">Locución:</span> '+esc(s.voiceover)+'</p></div>').join('');
    const beats=y.bumper.beats.map(s=>'<div class="ad-scene"><time>'+esc(s.time)+'</time><p>'+esc(s.overlay)+'</p></div>').join('');
    const videoArt=ccArt({template:'z',word:'RITMO',hookTop:'CADA SERVICIO',highlight:'DEJA',hookBottom:'SU',support:'Conecta consumo, horarios y preparaciones en la conversación.',photo:'../../recursos/escenas/barras/cam_lit.webp',series:'CUENTAS CLARAS',number:'01/02',format:'wide',cta:'VER PROPUESTA →',exportId:'youtube-video'});
    const bumperArt=ccArt({template:'z',word:'PROPUESTA',hookTop:'LO QUE SE ACUERDA',highlight:'QUEDA',hookBottom:'EN LA',support:'Pregunta qué incluye la propuesta para tu negocio.',photo:'../../recursos/escenas/hotel/fin.webp',series:'CUENTAS CLARAS',number:'02/02',format:'wide',cta:'CONOCER MÁS →',exportId:'youtube-bumper'});
    const videoHyp=hyp(y.video.hypothesis,undefined,undefined,'Gancho de apertura: consumo y horarios frente a claridad del comodato. Mantener duración, cierre y destino.');
    const bumperHyp=hyp(y.bumper.hypothesis,undefined,undefined,'Mensaje: claridad de las condiciones antes de decidir. Mantener formato Z, duración y destino.');
    const body=section('Miniatura del anuncio in-stream','1280 × 720 px · Z horizontal','<div class="ad-meta"><div><div class="ad-video">'+videoArt+'<span class="ad-video-play" aria-hidden="true"></span></div><p class="ad-scroll-note">Guion: '+esc(y.video.durationSeconds)+' s · '+esc(y.video.format)+'. La etiqueta técnica queda fuera del cuadro.</p></div><div><div class="ad-scene-list">'+videoScenes+'</div>'+printUrl('Destino con UTM',y.video.url)+videoHyp+'</div></div>')+
      section('Miniatura del bumper','1280 × 720 px · Z horizontal','<div class="ad-meta"><div><div class="ad-bumper">'+bumperArt+'</div><p class="ad-scroll-note">Bumper: '+esc(y.bumper.durationSeconds)+' s · '+esc(y.bumper.format)+'. Imagen fija de apertura; la nota técnica queda fuera del cuadro.</p></div><div><div class="ad-scene-list">'+beats+'</div>'+printUrl('Destino con UTM',y.bumper.url)+bumperHyp+'</div></div>')+
      section('Presupuesto simulado','partida del contexto · sin aprobación','<div class="ad-grid"><article class="ad-stat"><strong>'+money(youtubeBudget)+'</strong><span>partida YouTube del plan</span><p>Es presupuesto simulado. El calendario y la distribución quedan pendientes.</p></article><article class="ad-card"><h3>Regla de control</h3><p>La previsión de presupuesto no equivale a alcance ni resultados. Audiencia, medición y aprobación siguen pendientes.</p><p>Esta partida está incluida en el total del plan, no se agrega como monto adicional.</p></article></div>')+
      section('Especificación oficial','duración por subtipo',sourceLinks(d.sources.filter(s=>s.platform==='YouTube')));
    return shell(d,{kicker:'YouTube · Google Ads',title:y.title,subtitle:y.subtitle,side:'<strong>Nombre de campaña</strong>'+esc(y.video.campaignName)+'<br><br><strong>Control</strong>Presupuesto simulado sujeto a revisión. Calendario, audiencia y medición no están aprobados; no se guardó ni activó una campaña.',warning:'La ayuda oficial distingue los formatos: bumper de hasta 6 s y vídeo saltable. La maqueta usa 20 s para el in-stream saltable.',body});
  }

  function renderDisplay(d){
    const display=d.display;
    const banners=display.banners.map(b=>{
      const url=display.creative.urlBase+'&utm_content='+encodeURIComponent(b.content);
      const layout=b.height<=90?'small':b.height>b.width?'tall':'standard';
      const bannerHyp={...display.hypotheses,variable:'Mensaje: claridad de condiciones frente a continuidad del servicio; conservar titular, público y destino dentro de cada tamaño.'};
      const word='COMODATO';
      const bannerClass='cc-banner--'+layout+' cc-banner--'+b.id;
      const bannerPhoto=b.id==='300x250'?'../../recursos/escenas/barras/cam_lit.webp':b.id==='300x600'?'../../recursos/escenas/barras/cam_lamp_3.webp':'';
      const photoMarkup=bannerPhoto?'<img class="cc-banner-photo-bg" src="'+bannerPhoto+'" alt="" aria-hidden="true">':'';
      const art='<div class="cc-banner '+bannerClass+'" data-export="display-'+b.id+'" data-export-width="'+b.width+'" data-export-height="'+b.height+'" style="width:'+b.width+'px;height:'+b.height+'px"><span class="cc-banner-tint" aria-hidden="true"></span>'+photoMarkup+'<span class="cc-banner-word">'+word+'</span><span class="cc-banner-signature" aria-hidden="true"></span><span class="cc-banner-cta">'+esc(display.creative.cta)+' →</span></div>';
      return '<article class="ad-card"><div class="ad-card-top"><span class="ad-chip yellow">'+b.width+' × '+b.height+' px</span><span class="ad-label">HTML/CSS local</span></div><div class="ad-banner-stage" data-w="'+b.width+'" data-h="'+b.height+'">'+art+'</div><p class="ad-scroll-note">Tamaño nominal: '+b.width+' × '+b.height+' px · '+(layout==='small'?'solo palabra y CTA':'palabra, escena y CTA')+'.</p>'+printUrl('Destino con UTM',url)+hyp(bannerHyp)+'</article>';
    }).join('');
    const src=sourceLinks(d.sources.filter(s=>s.platform.startsWith('Google Display')));
    const body=section('Banners de remarketing','tamaños nominales exactos','<div class="ad-grid">'+banners+'</div>')+
      section('Hipótesis y límites de producción','maqueta, no paquete subible','<div class="ad-grid"><article class="ad-card">'+hyp(display.hypotheses)+'<p>'+esc(display.uploadNote)+'</p></article><article class="ad-card"><h3>Requisitos consultados</h3>'+src+'</article></div>')+
      section('Condición de audiencia','leer escenarios antes de servir','<div class="ad-card"><p>'+esc(d.remarketing.googleMinimum)+'</p><p>'+esc(d.remarketing.frequency.label)+'</p><p>'+esc(d.remarketing.frequency.status)+'</p>'+link('Ver cinco escenarios','remarketing.html',true)+'</div>');
    return shell(d,{kicker:'Google Display · HTML/CSS',title:display.title,subtitle:display.subtitle,side:'<strong>Nombre</strong>'+esc(display.campaignName)+'<br><br><strong>Alcance</strong>Maquetas responsivas con tamaños nominales de 300 × 250, 728 × 90, 320 × 50 y 300 × 600. Cada pieza lleva una URL etiquetada.',warning:'No subir: el HTML/CSS mostrado es maqueta local, no un ZIP HTML5 validado. La cuenta y la lista de público no se modificaron.',body});
  }

  function renderRemarketing(d){
    const r=d.remarketing;
    const cards=r.scenarios.map(s=>`<article class="ad-card"><div class="ad-card-top"><span class="ad-chip yellow">${esc(s.id.toUpperCase())}</span><span class="ad-chip">${esc(s.window)}</span></div><h3>${esc(s.name)}</h3><p><strong>Público / origen:</strong> ${esc(s.audience)}</p><p><strong>Acción:</strong> ${esc(s.action)}</p><p><strong>Texto de referencia:</strong> “${esc(s.copy)}”</p><p><strong>Exclusión:</strong> ${esc(s.exclusion)}</p><p><strong>Condición:</strong> ${esc(s.condition)}</p>${s.destination.startsWith('../')?printUrl('Destino propuesto',s.destination):`<div class="ad-empty">${esc(s.destination)}</div>`}${hyp(s.hypothesis)}</article>`).join('');
    const exclusionText=r.exclusions.join(' ');
    const body=section('Cinco escenarios de recuperación','fases y permisos distintos',`<div class="ad-grid">${cards}</div>`)+section('Reglas compartidas','antes de considerar cualquier audiencia',`<div class="ad-grid"><article class="ad-card"><h3>Exclusiones</h3><p>${esc(exclusionText)}</p></article><article class="ad-card"><h3>Tamaño y frecuencia</h3><p>${esc(r.googleMinimum)}</p><p>${esc(r.frequency.label)}</p><p>${esc(r.frequency.status)}</p><p>${esc(r.assumptions)}</p></article></div>`)+section('Relación con las maquetas','formatos de apoyo',`<div class="ad-actions">${link('Display HTML/CSS','display.html')}${link('YouTube bumper','youtube.html',true)}${link('Formulario Meta','meta.html',true)}</div>`)+section('Fuente de tamaño mínimo','Google Ads Help',`<p><a href="${esc(r.googleSource)}" target="_blank" rel="noreferrer">Audience Manager · tamaños mínimos de listas de datos</a></p>`);
    return shell(d,{kicker:'Recuperación · retargeting condicionado',title:r.title,subtitle:r.subtitle,side:`<strong>Control global</strong>Clientes activos excluidos de captación.<br><br><strong>Frecuencia propuesta</strong>${esc(r.frequency.label)}<br>${esc(r.frequency.status)}<br><br><strong>Google Ads</strong>${esc(r.googleMinimum)}`,warning:'Las ventanas de 30 y 90 días y la frecuencia son supuestos de diseño, no métricas observadas. No se crea ni sincroniza ninguna audiencia.',body});
  }

  const renderers={index:renderIndex,google:renderGoogle,meta:renderMeta,linkedin:renderLinkedin,youtube:renderYoutube,display:renderDisplay,remarketing:renderRemarketing};
  function scaleBanners(){
    document.querySelectorAll('.ad-banner-stage').forEach(stage=>{
      const banner=stage.querySelector('.cc-banner');
      const width=Number(stage.dataset.w),height=Number(stage.dataset.h);
      const scale=Math.min(1,(stage.parentElement.clientWidth-2)/width);
      stage.style.width=`${Math.round(width*scale)}px`;
      stage.style.height=`${Math.round(height*scale)}px`;
      banner.style.transform=`scale(${scale})`;
    });
  }
  load().then((d)=>{
    const render=renderers[page];
    if(!render) throw new Error(`Página desconocida: ${page}`);
    app.innerHTML=render(d);
    document.querySelectorAll('[data-count]').forEach(el=>{
      const text=el.dataset.count;
      const count=Array.from(text).length;
      const limit=Number(el.dataset.limit);
      el.textContent=`${count} / ${limit} caracteres${count<=limit?' · dentro del límite':' · excede el límite'}`;
      if(count>limit) el.style.color='var(--nm-error)';
    });
    adjustApprovedSlides().then(()=>scaleBanners());
    window.addEventListener('resize',()=>{adjustApprovedSlides().then(()=>scaleBanners());},{passive:true});
  }).catch((error)=>{
    app.innerHTML=`<main class="ad-main"><h1 class="nm-h1">No se pudo cargar el prototipo</h1><p class="nm-p">${esc(error.message)}. Abre las páginas mediante un servidor HTTP local.</p></main>`;
  });
})();
