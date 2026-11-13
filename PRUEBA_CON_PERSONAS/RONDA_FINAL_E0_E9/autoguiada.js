(() => {
  'use strict';

  const AUTO_KEY = 'mc_prueba_autoguiada_v1';
  const ACTIVE_KEY = 'mc_prueba_sesion_actual_v1';
  const JUMP_KEY = 'mc_prueba_salto_v1';
  const BANK_URL = new URL('PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/preguntas.json', location.href);
  const FICHAS_URL = new URL('PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/fichas.json', location.href);
  const KIT_URL = new URL('PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/', location.href);
  const app = document.getElementById('app');
  const PROFILE_LABELS = {
    restaurante:'Restaurante', hotel:'Hotel', cafeteria:'Cafetería', oficina:'Oficina',
    eventos:'Eventos y catering', panaderia:'Panadería', conveniencia:'Tienda de conveniencia'
  };
  const ROLE_LABELS = { ventas:'Ventas', marketing:'Marketing', jefatura:'Jefatura' };
  const ROLE_CODES = { ventas:'I1', marketing:'I2', jefatura:'I3' };
  const ROLE_TASKS = { ventas:6, marketing:4, jefatura:4 };
  const META_PROFILES = ['restaurante','cafeteria','panaderia','conveniencia'];
  const LINKEDIN_PROFILES = ['hotel','oficina','eventos'];
  const PATHS = new Set(['A','B-Meta','B-LinkedIn','B-Google','C']);
  const ALLOWED_EXACT = new Set(['index.html','captacion/anuncios/feed-simulado.html','PRUEBA_CON_PERSONAS/serp-seo-aeo-geo.html']);
  const PHASE_LABELS = { inicial:'Preguntas iniciales', pausa1:'Pausa 1 · llegada', pausa2:'Pausa 2 · propuesta', pausa_c:'Pausa · trabajo interno', final:'Preguntas finales' };
  const TASK_TITLES = {
    E0:'Empieza', E1:'Elige una alternativa', E2:'Conoce la propuesta', E3:'Contacto', E4:'Revisa la alternativa',
    E5:'Retoma tu decisión', E6:'Próximos pasos', E7:'Organiza el siguiente pedido', E8:'Busca ayuda', E9:'Recomienda',
    'C-V1':'Origen del contacto','C-V2':'Calificación','C-V3':'Propuesta de prueba','C-V4':'Reposición',
    'C-V5':'Cuenta en riesgo','C-V6':'Recomendación',
    'C-M1':'Lead y origen','C-M2':'Contenido y campaña','C-M3':'Calificación','C-M4':'Permisos y seguimiento',
    'C-J1':'Vista general','C-J2':'Propuesta y aprobación','C-J3':'Aprobación de referido','C-J4':'Recuperación y permisos'
  };
  const EXTERNAL_TASKS = [
    { id:'T1', origen:['E0','E1'], titulo:'Encuentra una solución para tu negocio', consigna:{
      busqueda:'Busca una alternativa para tu negocio como lo harías normalmente y llega a una página que te interese.',
      ad:'Explora la publicación como lo harías al buscar una alternativa y llega a una página que te interese.' } },
    { id:'T2', origen:['E2','E3','E4'], titulo:'Revisa tu propuesta', consigna:'Revisa tu propuesta y explica qué máquina, qué productos y cuánto pagas.' },
    { id:'T3', origen:['E6'], titulo:'Confirma y cuenta qué pasa después', consigna:'Confirma si quieres avanzar y cuenta qué pasa después.' },
    { id:'T4', origen:['E5'], titulo:'Retoma tu decisión', consigna:'Retoma tu decisión desde donde quedaste.' },
    { id:'T5', origen:['E7'], titulo:'Repite tu pedido', consigna:'Repite tu pedido desde el historial.' },
    { id:'T6', origen:['E8','E9'], titulo:'Pide ayuda o recomienda a otro negocio', consigna:'Pide ayuda por un problema y, si quieres, recomienda a otro negocio.' }
  ];
  // Etapas del recorrido (12-nov): las preguntas van por lo que se está haciendo, no por pantalla.
  const STAGE_NAMES = { T1:'Buscar y considerar', T2:'Cotizar', T3:'Aceptar', T4:'Seguimiento', T5:'Recomprar', T6:'Ayuda y recomendación' };
  const AG_VERSION = '2026-11-12-etapas';
  const MODES = ['inicial','pausa1','pausa2','pausa_c','final'];

  let bank = null;
  let fichas = [];
  let state = null;
  let iframeRef = null;
  let jumpPoll = null;
  let questionOpenedAt = 0;

  const isoNow = () => new Date().toISOString();
  const parseStored = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  };
  const persist = () => {
    try {
      localStorage.setItem(AUTO_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      showFatal('Este navegador no pudo guardar el avance. Revisa el espacio disponible e inténtalo de nuevo.');
      return false;
    }
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const cleanText = (value) => String(value ?? '').replace(/\u0000/g,'').slice(0,500);
  const randomToken = (length) => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(length);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i=0;i<length;i++) bytes[i] = Math.floor(Math.random()*256);
    return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
  };
  const randomId = () => 'T-' + randomToken(6);
  const randomNonce = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : randomToken(20);
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CL');
  };
  const formatDuration = (ms) => {
    const seconds = Math.max(0,Math.round((Number(ms)||0)/1000));
    const minutes = Math.floor(seconds/60);
    return minutes ? minutes + ' min ' + (seconds%60) + ' s' : seconds + ' s';
  };
  const newDraft = () => ({
    schema:1, version_banco:'2026-11-11-v1', phase:'welcome', consentimiento:null,
    camino:'', perfil:'', rol:'', session:null, respuestas:[], tareas:[], saltos:[],
    pausas:[], recorrido:[], clics:[], clicksByScreen:{}, descargas:{disponibles:[],tocadas:[]},
    drafts:{}, questionIndex:0, taskIndex:0, interstitialAfter:'', evaluating:false,
    pdf_downloaded:false, exports:{}, started_at:'', finished_at:''
  });

  function prototypeReset() {
    const prefixes = ['marleyMVP:','m4test:','mc_landing_','mc_first_touch_','m4:','m4notes','marley-','marleyHorecaDemo:'];
    const exact = [ACTIVE_KEY,JUMP_KEY];
    const keys = [];
    for (let i=0;i<localStorage.length;i++) {
      const key = localStorage.key(i);
      if (key && (exact.includes(key) || prefixes.some(prefix => key.startsWith(prefix)))) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
    try { sessionStorage.clear(); } catch (_) {}
    return keys;
  }
  function showFatal(message) {
    if (!app) return;
    app.setAttribute('aria-busy','false');
    app.innerHTML = '<section class="ag-screen" role="alert"><p class="ag-kicker">Prueba autoguiada</p><h1 class="ag-title">No se pudo iniciar</h1><p class="ag-lede">' + escapeHtml(message) + '</p><a class="ag-btn ag-btn--primary" href="prueba.html">Volver al inicio</a></section>';
  }
  function routeName(url) {
    try {
      const parsed = new URL(url, location.href);
      const base = new URL('.', location.href).pathname;
      let path = parsed.pathname.startsWith(base) ? parsed.pathname.slice(base.length) : parsed.pathname.replace(/^\//,'');
      path = decodeURIComponent(path || '');
      return path + parsed.hash;
    } catch (_) { return ''; }
  }
  function allowedDestination(raw) {
    let url;
    try { url = new URL(raw, location.href); } catch (_) { return null; }
    if (url.origin !== location.origin) return null;
    const base = new URL('.', location.href).pathname;
    if (!url.pathname.startsWith(base)) return null;
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    const isLanding = /^captacion\/landing\/[a-z0-9-]+\.html$/i.test(relative);
    const isEmail = /^captacion\/correos\/[a-z0-9_-]+\.html$/i.test(relative);
    if (!ALLOWED_EXACT.has(relative) && !isLanding && !isEmail) return null;
    return url;
  }
  function browserSummary() {
    const ua = navigator.userAgent || '';
    let name = 'Navegador web';
    if (/Edg\//.test(ua)) name = 'Microsoft Edge';
    else if (/Chrome\//.test(ua)) name = 'Chrome';
    else if (/Firefox\//.test(ua)) name = 'Firefox';
    else if (/Safari\//.test(ua)) name = 'Safari';
    return { ancho:window.innerWidth, alto:window.innerHeight, navegador:name };
  }
  function makeTarget(path, profile, role, code, startedAt) {
    const isC = path === 'C';
    const isSearch = path === 'A' || path === 'B-Google';
    const file = isC || isSearch ? 'index.html' : 'captacion/anuncios/feed-simulado.html';
    const url = new URL(file, location.href);
    const fixture = fichas.find(item => item.perfil === profile);
    const participant = isC ? (ROLE_CODES[role] || 'I1') : (fixture?.codigo || 'P1');
    const params = isC
      ? {test:'personas',camino:'C',rol:role,participante:participant,perfil:'interno',mc_session:code,journey_started_at:String(startedAt)}
      : {test:isSearch?'sitio':'personas',camino:path,participante:participant,pid:participant,perfil:profile,mc_session:code,journey_started_at:String(startedAt)};
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,value));
    if (isC) url.hash = 'R00';
    else if (isSearch) {
      url.searchParams.set('tipo','cliente');
      url.searchParams.set('negocio',profile);
      url.searchParams.set('marco','1');
      url.searchParams.set('p',participant);
      if (path === 'B-Google') url.searchParams.set('red','google');
      url.hash = 'C01';
    } else {
      url.searchParams.set('journey','full');
      url.searchParams.set('red',path === 'B-Meta'?'meta':'linkedin');
    }
    return allowedDestination(url.href);
  }
  function isInternal() { return state?.camino === 'C'; }
  function phaseQuestions(phase) {
    const phaseList = bank?.fases_autoguiada?.[phase] || bank?.fases?.[phase];
    const ids = Array.isArray(phaseList) ? phaseList : (phaseList?.[isInternal()?'internos':'externos'] || []);
    return ids.map(id => ({id,...(bank.preguntas[id] || {})})).filter(item => item.tipo);
  }
  function stages() {
    return isInternal() ? (bank.etapas.internos?.[state.rol] || []) : EXTERNAL_TASKS;
  }
  function stagePrompt(stage) {
    if (isInternal()) return cleanText(stage.texto || stage.titulo || '');
    if (stage.id === 'T1') return cleanText(stage.consigna[state.camino === 'B-Meta' || state.camino === 'B-LinkedIn' ? 'ad' : 'busqueda']);
    return cleanText(stage.consigna || '');
  }
  function labelForStage(stage) { return TASK_TITLES[stage.id] || stage.titulo || 'Tarea'; }
  function makeSession(path, profile, role) {
    const code = randomId();
    const startedAt = Date.now();
    const destination = makeTarget(path,profile,role,code,startedAt);
    if (!destination) throw new Error('No pude preparar una ruta permitida dentro de este sitio.');
    const profileFixture = path === 'C' ? null : fichas.find(item => item.perfil === profile);
    if (path !== 'C' && !profileFixture) throw new Error('No encontré la ficha ficticia para este perfil.');
    const device = browserSummary();
    return {
      id:code, participante:'Autoguiada', camino:path, rol:path === 'C'?role:'externo',
      perfil:path === 'C'?'interno':profile, inicio:new Date(startedAt).toISOString(),
      inicio_ms:startedAt, destino:destination.href, dispositivo:device, estado:'preparada',
      consentimiento:state.consentimiento, ficha:profileFixture ? {
        nombre:profileFixture.nombre, correo:profileFixture.correo, empresa:profileFixture.empresa,
        telefono:profileFixture.telefono, comuna:profileFixture.comuna,
        tazas_al_dia:profileFixture.tazas_al_dia, ficticia:true
      } : null
    };
  }
  function setPortalSession() {
    if (!state?.session) return;
    const session = state.session;
    const portalRecord = {
      id:session.id, participante:'Autoguiada', camino:session.camino, perfil:session.perfil,
      rol:session.rol, modo:'autoguiado', estado:'en_recorrido',
      inicio:session.inicio, destino:session.destino, fases_hechas:[],
      version_banco:bank.version
    };
    if (session.ficha) portalRecord.ficha = {...session.ficha};
    try { localStorage.setItem(ACTIVE_KEY,JSON.stringify(portalRecord)); }
    catch (_) { throw new Error('El navegador no pudo preparar los datos ficticios del recorrido.'); }
  }
  function updatePortalPhases(phase) {
    try {
      const active = parseStored(ACTIVE_KEY);
      if (!active || active.id !== state?.session?.id) return;
      const phases = new Set(active.fases_hechas || []);
      phases.add(phase);
      active.fases_hechas = Array.from(phases);
      localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));
    } catch (_) {}
  }
  function saveQuestion(question, phase, draft, stageId) {
    const skipped = Boolean(draft?.skip);
    let value = draft?.value ?? '';
    let otherText = cleanText(draft?.other || '');
    let display = '';
    if (skipped) {
      value = '';
      otherText = '';
      display = 'Prefiero no responder';
    } else if (question.tipo === 'open') {
      value = cleanText(draft?.value || '');
      display = value;
    } else if (question.tipo === 'multi') {
      const values = Array.isArray(value) ? value : [];
      const selectedOptions = values.map(raw => optionFor(question,raw)).filter(Boolean);
      value = selectedOptions.map(option => option.text);
      display = selectedOptions.map(option => option.text).join(' · ');
      if (otherText && selectedOptions.some(option => option.other)) display = display.replace(/Otra\s*\([^)]*\)/i,'Otra: ' + otherText);
    } else if (question.tipo === 'agreement' || question.tipo === 'frequency') {
      const selected = optionFor(question,value);
      value = selected ? Number(selected.value) : '';
      display = selected?.text || '';
    } else {
      const selected = optionFor(question,value);
      if (selected) {
        value = selected.text;
        display = selected.other && otherText ? 'Otra: ' + otherText : selected.text;
      } else {
        value = String(value || '');
        display = value;
      }
    }
    const isOptionalBlank = question.tipo === 'open' && !String(value).trim();
    const row = {
      sesion_id:state.session.id, sesion_origen:'', participante:state.session.id,
      camino:state.camino, rol:state.session.rol, perfil:state.session.perfil,
      momento:phase, etapa:stageId || phase, pregunta_id:question.id, tipo:question.tipo,
      respuesta:value, respuesta_texto:display, otra_texto:otherText,
      omitida:skipped || isOptionalBlank, ms_respuesta:Math.max(0,Date.now()-questionOpenedAt),
      guardado_en:isoNow(), version_banco:bank.version
    };
    const index = state.respuestas.findIndex(item => item.sesion_id === row.sesion_id && item.momento === row.momento && item.etapa === row.etapa && item.pregunta_id === row.pregunta_id);
    if (index >= 0) state.respuestas[index] = row; else state.respuestas.push(row);
    persist();
  }
  function consentRow() {
    if (!state.session || !state.consentimiento?.aceptado) return;
    const row = {
      sesion_id:state.session.id, sesion_origen:'', participante:state.session.id,
      camino:state.camino, rol:state.session.rol, perfil:state.session.perfil,
      momento:'inicial', etapa:'consentimiento', pregunta_id:'consentimiento',
      tipo:'consentimiento', respuesta:'Acepto participar', respuesta_texto:'Acepto participar',
      otra_texto:'', omitida:false, ms_respuesta:0,
      guardado_en:state.consentimiento.at, version_banco:bank.version
    };
    if (!state.respuestas.some(item => item.pregunta_id === row.pregunta_id && item.sesion_id === row.sesion_id)) state.respuestas.push(row);
  }
  function optionFor(question,value) {
    if (question.tipo === 'agreement' || question.tipo === 'frequency') {
      return optionList(question).find(item => String(item.value) === String(value) || item.text === String(value)) || null;
    }
    const options = question.opciones || [];
    return options.map(item => typeof item === 'string' ? {text:item,other:false,exclusive:false} : {
      text:String(item.texto || ''), other:Boolean(item.otra), exclusive:Boolean(item.excluyente)
    }).find(item => item.text === String(value)) || null;
  }
  function optionList(question) {
    if (question.tipo === 'agreement') return [
      'Muy en desacuerdo','En desacuerdo','Ni de acuerdo ni en desacuerdo','De acuerdo','Muy de acuerdo'
    ].map((text,index)=>({value:String(index+1),text,other:false,exclusive:false}));
    if (question.tipo === 'frequency') return (question.opciones || []).map((item,index)=>({
      value:String(index+1),text:typeof item==='string'?item:String(item.texto||''),other:false,exclusive:false
    }));
    return (question.opciones || []).map(item => typeof item === 'string' ? {text:item,other:false,exclusive:false} : {
      text:String(item.texto || ''),other:Boolean(item.otra),exclusive:Boolean(item.excluyente)
    });
  }
  function draftFor(question) { return state.drafts?.[question.id] || {value:question.tipo==='multi'?[]:'',other:'',skip:false}; }
  function questionControls(question,draft) {
    const multiple = question.tipo === 'multi';
    const open = question.tipo === 'open';
    if (open) {
      return '<label class="ag-sr-only" for="answer-open">Tu respuesta</label><textarea id="answer-open" class="ag-field ag-open-field" maxlength="500" aria-describedby="question-help" placeholder="Escribe tu respuesta"></textarea><p class="ag-help" id="question-help">Máximo 500 caracteres. No escribas nombres ni datos de contacto.</p>';
    }
    const options = optionList(question);
    const choices = options.map((option,index) => {
      const raw = option.value ?? option.text;
      const selected = multiple ? (Array.isArray(draft.value) && draft.value.includes(raw)) : String(draft.value) === raw;
      const inputType = multiple ? 'checkbox' : 'radio';
      const otherField = option.other ? '<span class="ag-other-field" data-other-for="' + escapeHtml(raw) + '" data-visible="' + (selected?'true':'false') + '"><input class="ag-field" id="other-' + index + '" data-other-text="' + escapeHtml(raw) + '" type="text" maxlength="120" aria-label="¿Cuál otra?" placeholder="¿Cuál?"></span>' : '';
      const labelClass = 'ag-option' + (option.other?' ag-option-other':'');
      const checked = selected?' checked':'';
      return '<label class="' + labelClass + '"><input type="' + inputType + '" name="q-answer" value="' + escapeHtml(raw) + '" data-excluyente="' + (option.exclusive?'true':'false') + '" data-otra="' + (option.other?'true':'false') + '"' + checked + '><span>' + escapeHtml((question.tipo==='agreement'||question.tipo==='frequency') && option.text ? raw + ' · ' + option.text : raw) + '</span>' + otherField + '</label>';
    }).join('');
    return '<div class="ag-option-list">' + choices + '</div>';
  }
  function renderQuestion(phase) {
    const questions = phaseQuestions(phase);
    if (!questions.length) { finishPhase(phase); return; }
    const index = Math.max(0,Math.min(Number(state.questionIndex)||0,questions.length-1));
    const question = questions[index];
    const draft = draftFor(question);
    questionOpenedAt = Date.now();
    const pct = Math.round(((index+1)/questions.length)*100);
    const totalLabel = questions.length;
    const blockLabel = PHASE_LABELS[phase] || 'Preguntas';
    const skipChecked = draft.skip?' checked':'';
    const backDisabled = index === 0;
    const embedded=Boolean(app.querySelector('.ag-journey')&&phase!=='inicial');
    const container=embedded?app.querySelector('.ag-taskbar'):app;
    if(embedded){container.classList.remove('is-collapsed');container.classList.add('is-modal');}
    const questionOpen=embedded?'<div class="ag-modal ag-question-inbar" role="dialog" aria-modal="true" aria-labelledby="question-title">':'<section class="ag-question-screen" aria-label="' + escapeHtml(blockLabel) + '">' + brandMarkup();
    const questionClose=embedded?'</div>':'</section>';
    container.innerHTML = questionOpen
      + '<p class="ag-step">' + escapeHtml(blockLabel) + ' · Pregunta ' + (index+1) + ' de ' + totalLabel + '</p>'
      + '<div class="ag-progress" role="progressbar" aria-label="Avance de preguntas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>'
      + '<h1 class="ag-question-title" id="question-title">' + escapeHtml(question.texto || '') + '</h1>'
      + '<form class="ag-question-form" id="question-form" novalidate><fieldset class="ag-fieldset" aria-labelledby="question-title"><legend class="ag-sr-only">' + escapeHtml(question.texto || '') + '</legend>'
      + questionControls(question,draft)
      + '<label class="ag-option ag-option--skip"><input id="skip-answer" type="checkbox"' + skipChecked + '><span>Prefiero no responder</span></label>'
      + '</fieldset><p class="ag-status" id="question-status" role="status"></p><div class="ag-question-actions">'
      + '<button class="ag-btn" id="question-back" type="button"' + (backDisabled?' disabled':'') + '>Volver</button>'
      + '<button class="ag-btn ag-btn--primary" id="question-next" type="submit">' + (index+1===questions.length?'Continuar':'Siguiente') + '</button>'
      + '</div></form>' + questionClose;
    const form = document.getElementById('question-form');
    const status = document.getElementById('question-status');
    const skip = document.getElementById('skip-answer');
    const updateDraft = () => {
      if (!state.drafts) state.drafts = {};
      const existing = draftFor(question);
      const next = {...existing};
      next.skip = skip.checked;
      if (question.tipo === 'open') next.value = document.getElementById('answer-open')?.value || '';
      else if (question.tipo === 'multi') next.value = Array.from(form.querySelectorAll('input[name="q-answer"]:checked')).map(input=>input.value);
      else next.value = form.querySelector('input[name="q-answer"]:checked')?.value || '';
      const otherInput = form.querySelector('[data-other-text]');
      next.other = otherInput?.value || '';
      state.drafts[question.id] = next;
      persist();
      applySkipState();
    };
    const applySkipState = () => {
      form.querySelectorAll('input[name="q-answer"],#answer-open,[data-other-text]').forEach(input=>{input.disabled=skip.checked;});
      const list=form.querySelector('.ag-option-list');
      if(list) list.style.opacity=skip.checked?'.55':'1';
      const open=document.getElementById('answer-open');
      if(open) open.style.opacity=skip.checked?'.55':'1';
    };
    if (question.tipo === 'open') {
      const open = document.getElementById('answer-open');
      open.value = String(draft.value || '');
      open.addEventListener('input',updateDraft);
    } else {
      form.querySelectorAll('input[name="q-answer"]').forEach(input=>input.addEventListener('change',event=>{
        if (question.tipo === 'multi') {
          const item=optionFor(question,event.target.value);
          const checked=event.target.checked;
          if(item?.exclusive && checked) form.querySelectorAll('input[name="q-answer"]').forEach(other=>{if(other!==event.target)other.checked=false;});
          else if(checked) form.querySelectorAll('input[name="q-answer"][data-excluyente="true"]').forEach(other=>{other.checked=false;});
        }
        form.querySelectorAll('[data-other-for]').forEach(holder=>{
          const checkedInput=form.querySelector('input[name="q-answer"][value="' + CSS.escape(holder.getAttribute('data-other-for')) + '"]');
          holder.dataset.visible=checkedInput?.checked?'true':'false';
        });
        updateDraft();
      }));
      const other= form.querySelector('[data-other-text]');
      if(other) {
        other.value=draft.other || '';
        other.addEventListener('input',updateDraft);
      }
    }
    skip.addEventListener('change',updateDraft);
    applySkipState();
    document.getElementById('question-back').addEventListener('click',()=>{
      if(index>0){state.questionIndex=index-1;persist();renderQuestion(phase);}
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const currentDraft=state.drafts?.[question.id] || draftFor(question);
      const hasValue=question.tipo==='multi' ? Array.isArray(currentDraft.value)&&currentDraft.value.length>0 : Boolean(String(currentDraft.value||'').trim());
      if(!currentDraft.skip && question.tipo!=='open' && !hasValue) {
        status.textContent='Elige una opción o marca «Prefiero no responder».';
        status.dataset.kind='error';
        return;
      }
      const selectedOther = question.tipo==='multi'
        ? (Array.isArray(currentDraft.value)&&currentDraft.value.some(value=>optionFor(question,value)?.other))
        : optionFor(question,currentDraft.value)?.other;
      if(!currentDraft.skip && selectedOther && !String(currentDraft.other||'').trim()) {
        status.textContent='Completa cuál otra opción querías indicar.';
        status.dataset.kind='error';
        return;
      }
      saveQuestion(question,phase,currentDraft);
      if(index+1<questions.length){state.questionIndex=index+1;persist();renderQuestion(phase);}
      else finishPhase(phase);
    });
    app.setAttribute('aria-busy','false');
  }

  function brandMarkup() {
    return '<div class="ag-brand" aria-label="Marley Coffee Empresas"><span class="ag-brand-mark" aria-hidden="true">M</span><span class="ag-brand-word">Marley Coffee<small>Empresas · prueba autoguiada</small></span></div><div class="ag-signature" aria-hidden="true"></div>';
  }
  function renderWelcome() {
    app.innerHTML = '<section class="ag-screen">' + brandMarkup()
      + '<p class="ag-kicker">Prueba autoguiada</p><h1 class="ag-title">Gracias por participar</h1>'
      + '<p class="ag-note">Prototipo académico (Duoc UC). No es un sitio oficial de Marley Coffee.</p>'
      + '<p class="ag-lede">Elige un camino, recórrelo con tareas, responde unas preguntas y descarga tu informe.</p>'
      + '<ol class="ag-steps"><li>Eliges el camino y respondes las preguntas iniciales.</li><li>Recorres el sitio o el CRM con tareas breves.</li><li>Respondes las preguntas finales y descargas tus resultados.</li></ol>'
      + '<div class="ag-card"><h2>Antes de empezar</h2><p>Nada se envía. Tus respuestas quedan en este navegador hasta que descargues el informe. Tú decides si lo envías.</p>'
      + '<p style="margin-top:12px"><a class="ag-consent-links" href="' + KIT_URL.href + 'Consentimiento_informado.md" target="_blank" rel="noopener">Leer el consentimiento completo</a></p>'
      + '<label class="ag-check"><input id="consent-check" type="checkbox"' + (state.consentimiento?.aceptado?' checked':'') + '><span>Acepto participar</span></label>'
      + '<div class="ag-actions"><button id="welcome-next" type="button" class="ag-btn ag-btn--primary"' + (state.consentimiento?.aceptado?'':' disabled') + '>Continuar</button></div>'
      + '<p class="ag-status" id="welcome-status" role="status"></p></div></section>';
    const checkbox=document.getElementById('consent-check');
    const button=document.getElementById('welcome-next');
    checkbox.addEventListener('change',()=>{
      state.consentimiento=checkbox.checked?{aceptado:true,at:isoNow()}:null;
      button.disabled=!checkbox.checked;
      persist();
    });
    button.addEventListener('click',()=>{
      if(!state.consentimiento?.aceptado){document.getElementById('welcome-status').textContent='Acepta participar para continuar.';return;}
      state.phase='choice';persist();renderChoice();
    });
    app.setAttribute('aria-busy','false');
  }
  function renderChoice() {
    const selected=state.pickedPath||'';
    let config='';
    if(selected==='A') config='<label class="ag-select-label"><span class="ag-label">Tipo de negocio</span><select class="ag-field" id="profile-choice"><option value="">Elige un tipo de negocio</option>' + profileOptions() + '</select></label>';
    else if(selected.startsWith('B-')) {
      const allowed=selected==='B-Meta'?META_PROFILES:selected==='B-LinkedIn'?LINKEDIN_PROFILES:Object.keys(PROFILE_LABELS);
      config='<label class="ag-select-label"><span class="ag-label">Tipo de negocio</span><select class="ag-field" id="profile-choice"><option value="">Elige un tipo de negocio</option>' + profileOptions(allowed) + '</select></label>';
    } else if(selected==='C') config='<label class="ag-select-label"><span class="ag-label">Área de trabajo</span><select class="ag-field" id="role-choice"><option value="">Elige un área</option><option value="ventas">Ventas</option><option value="marketing">Marketing</option><option value="jefatura">Jefatura</option></select></label>';
    const selectedProfile=state.pickedProfile||'';
    const selectedRole=state.pickedRole||'';
    app.innerHTML='<section class="ag-screen">' + brandMarkup()
      + '<p class="ag-kicker">Paso 1 · Elige tu recorrido</p><h1 class="ag-title">¿Qué quieres probar?</h1>'
      + '<p class="ag-lede">Elige el camino que más se parece a lo que necesitas revisar.</p>'
      + '<div class="ag-choice-grid" role="group" aria-label="Caminos de prueba">'
      + choiceCard('A','Buscando en Google','Explora una búsqueda y sigue una alternativa.',selected==='A')
      + choiceCard('B','Desde un anuncio','Elige Meta, LinkedIn o Google.',selected.startsWith('B-'))
      + choiceCard('C','Equipo interno de Marley','Revisa el CRM según tu área de trabajo.',selected==='C')
      + '</div>'
      + (selected==='B'?'<div class="ag-card"><h2>Elige dónde viste el anuncio</h2><div class="ag-actions"><button class="ag-btn" type="button" data-network="B-Meta" aria-pressed="' + (state.pickedNetwork==='B-Meta') + '">Meta</button><button class="ag-btn" type="button" data-network="B-LinkedIn" aria-pressed="' + (state.pickedNetwork==='B-LinkedIn') + '">LinkedIn</button><button class="ag-btn" type="button" data-network="B-Google" aria-pressed="' + (state.pickedNetwork==='B-Google') + '">Google</button></div></div>':'')
      + (config?'<div class="ag-card"><h2>Personaliza tu recorrido</h2><div class="ag-form-grid">' + config + '</div></div>':'')
      + '<div class="ag-actions"><button id="choice-back" class="ag-btn" type="button">Volver</button><button id="choice-next" class="ag-btn ag-btn--primary" type="button" disabled>Responder preguntas iniciales</button></div>'
      + '<p class="ag-status" id="choice-status" role="status"></p></section>';
    app.querySelectorAll('[data-path]').forEach(button=>button.addEventListener('click',()=>{
      state.pickedPath=button.dataset.path;
      if(state.pickedPath==='B') state.pickedNetwork='';
      if(state.pickedPath!=='B') state.pickedNetwork='';
      state.pickedProfile='';
      state.pickedRole='';
      persist();renderChoice();
    }));
    app.querySelectorAll('[data-network]').forEach(button=>button.addEventListener('click',()=>{
      state.pickedNetwork=button.dataset.network;
      state.pickedPath=button.dataset.network;
      state.pickedProfile='';
      persist();renderChoice();
    }));
    const profile=document.getElementById('profile-choice');
    if(profile) {
      profile.value=selectedProfile;
      profile.addEventListener('change',()=>{state.pickedProfile=profile.value;persist();updateChoiceNext();});
    }
    const role=document.getElementById('role-choice');
    if(role) {
      role.value=selectedRole;
      role.addEventListener('change',()=>{state.pickedRole=role.value;persist();updateChoiceNext();});
    }
    document.getElementById('choice-back').addEventListener('click',()=>{state.phase='welcome';persist();renderWelcome();});
    document.getElementById('choice-next').addEventListener('click',()=>{
      const path=state.pickedPath;
      if(!PATHS.has(path)){document.getElementById('choice-status').textContent='Elige un camino para continuar.';return;}
      if(path==='C'&&!ROLE_CODES[state.pickedRole]){document.getElementById('choice-status').textContent='Elige un área para continuar.';return;}
      if(path!=='C'&&!state.pickedProfile){document.getElementById('choice-status').textContent='Elige un tipo de negocio para continuar.';return;}
      try {
        state.camino=path;state.perfil=path==='C'?'interno':state.pickedProfile;state.rol=path==='C'?state.pickedRole:'externo';
        state.session=makeSession(path,state.perfil,state.rol);
        state.started_at=state.session.inicio;
        state.respuestas=[];state.tareas=[];state.saltos=[];state.pausas=[];state.recorrido=[];state.clics=[];state.clicksByScreen={};state.descargas={disponibles:[],tocadas:[]};state.drafts={};
        consentRow();state.phase='inicial';state.questionIndex=0;persist();renderQuestion('inicial');
      } catch(error) { document.getElementById('choice-status').textContent=error.message;document.getElementById('choice-status').dataset.kind='error'; }
    });
    updateChoiceNext();
    app.setAttribute('aria-busy','false');
  }
  function choiceCard(path,title,copy,pressed) {
    return '<button class="ag-choice" type="button" data-path="' + path + '" aria-pressed="' + (pressed?'true':'false') + '"><strong>' + path + ' · ' + escapeHtml(title) + '</strong><span>' + escapeHtml(copy) + '</span></button>';
  }
  function profileOptions(allow) {
    return Object.entries(PROFILE_LABELS).filter(([key])=>!allow||allow.includes(key)).map(([key,label])=>'<option value="' + key + '">' + escapeHtml(label) + '</option>').join('');
  }
  function updateChoiceNext() {
    const button=document.getElementById('choice-next');
    if(!button)return;
    const path=state.pickedPath||'';
    button.disabled=path==='C'?!ROLE_CODES[state.pickedRole]:(!PATHS.has(path)||!state.pickedProfile);
  }
  function beginJourney() {
    state.phase='journey';state.estado='en_recorrido';state.questionIndex=0;state.taskIndex=0;state.evaluating=false;
    state.version_autoguiada=AG_VERSION;
    const list=stages();
    state.tareas=list.map((stage,index)=>({etapa:stage.id,etapa_nombre:isInternal()?(ROLE_LABELS[state.rol]||'Equipo interno'):(STAGE_NAMES[stage.id]||''),intro_visto:false,numero:index+1,titulo:labelForStage(stage),consigna:stagePrompt(stage),empezo_en:'',termino_en:'',duracion_ms:0,resultado:'',seq:'',comentario:'',pantallas:[],origen_etapas:stage.origen||[]}));
    setPortalSession();
    persist();
    renderJourney(true);
  }
  function finishPhase(phase) {
    updatePortalPhases(phase);
    if(phase==='inicial') { beginJourney();return; }
    if(phase==='pausa1') { state.pausas.push({fase:phase,termino_en:isoNow()});state.phase='journey';state.evaluating=false;startCurrentTask();persist();renderJourney();return; }
    if(phase==='pausa2') { state.pausas.push({fase:phase,termino_en:isoNow()});state.phase='journey';state.evaluating=false;startCurrentTask();persist();renderJourney();return; }
    if(phase==='pausa_c') { state.pausas.push({fase:phase,termino_en:isoNow()});state.phase='journey';state.taskIndex=1;state.evaluating=false;startCurrentTask();persist();renderJourney();return; }
    if(phase==='final') {
      state.finished_at=isoNow();state.phase='complete';state.evaluating=false;
      const values=['umux_1','umux_2'].map(id=>state.respuestas.find(row=>row.pregunta_id===id&&row.momento==='final'&&!row.omitida)?.respuesta);
      state.umux_score=window.MCPrueba?.umuxScore ? window.MCPrueba.umuxScore(values) : scoreUmux(values);
      try {
        const active=parseStored(ACTIVE_KEY);
        if(active?.id===state.session.id){active.estado='cerrada';active.cerrada_en=isoNow();active.umux_score=state.umux_score;active.fases_hechas=Array.from(new Set([...(active.fases_hechas||[]),'final']));localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));}
      } catch(_){}
      persist();renderResults();return;
    }
    state.phase='journey';persist();renderJourney();
  }
  function scoreUmux(values) {
    if(!Array.isArray(values)||values.length!==2||values.some(value=>!Number.isInteger(Number(value))||Number(value)<1||Number(value)>5))return null;
    return Number((((Number(values[0])-1)+(Number(values[1])-1))/8*100).toFixed(2));
  }
  function startCurrentTask() {
    const task=state.tareas?.[state.taskIndex];
    if(!task||task.empezo_en)return;
    task.empezo_en=isoNow();task.empezo_ms=Date.now();
    task.termino_en='';task.duracion_ms=0;
    persist();
  }
  function taskFinished() {
    const task=state.tareas?.[state.taskIndex];
    if(!task)return;
    if(!task.empezo_en)startCurrentTask();
    task.termino_en=isoNow();task.termino_ms=Date.now();
    task.duracion_ms=Math.max(0,task.termino_ms-(Number(task.empezo_ms)||task.termino_ms));
    state.evaluating=true;persist();renderJourney();
  }
  function saveTaskEvaluation() {
    const form=document.getElementById('task-evaluation');
    const status=document.getElementById('task-evaluation-status');
    const result=form?.querySelector('input[name="task-result"]:checked')?.value;
    const seq=form?.querySelector('input[name="task-seq"]:checked')?.value;
    const comment=cleanText(document.getElementById('task-comment')?.value||'');
    const task=state.tareas[state.taskIndex];
    const stageAnswers=stageQuestionsFor(task).map(question=>({question,value:form?.querySelector('input[name="stage-' + question.id + '"]:checked')?.value}));
    if(!result||!seq||stageAnswers.some(item=>!item.value)){status.textContent='Responde las preguntas para continuar. El comentario es opcional.';status.dataset.kind='error';return;}
    task.resultado=result;task.seq=Number(seq);task.comentario=comment;
    task.preguntas_etapa={};
    stageAnswers.forEach(({question,value})=>{saveQuestion(question,'etapa',{value},task.etapa);task.preguntas_etapa[question.id]=value;});
    state.evaluating=false;
    const completed=state.taskIndex;
    state.taskIndex+=1;
    if(!isInternal()) {
      if(completed===2) {state.phase='jump3';persist();renderJourney();return;}
      if(completed===3) {state.phase='jump30';persist();renderJourney();return;}
    }
    if(state.taskIndex>=state.tareas.length){state.phase='final';state.questionIndex=0;persist();renderQuestion('final');return;}
    state.phase='journey';persist();renderJourney();
  }
  function renderJourney(first=false) {
    if(jumpPoll){clearInterval(jumpPoll);jumpPoll=null;}
    if(!document.querySelector('.ag-journey')) {
      const destination=allowedDestination(state.session.destino);
      if(!destination){showFatal('La dirección preparada no pertenece a una ruta permitida de este sitio.');return;}
      app.innerHTML='<section class="ag-journey" aria-label="Recorrido guiado">'
        + '<div class="ag-frame-region"><iframe class="ag-journey-frame" title="Recorrido del sitio o CRM" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
        + '<aside class="ag-taskbar" aria-label="Barra de tareas"></aside></section>';
      iframeRef=app.querySelector('.ag-journey-frame');
      iframeRef.addEventListener('load',onFrameLoad);
      iframeRef.src=(state.last_iframe_url&&allowedDestination(state.last_iframe_url)?.href)||destination.href;
      state.last_iframe_url=iframeRef.src;
    } else iframeRef=app.querySelector('.ag-journey-frame');
    const bar=app.querySelector('.ag-taskbar');
    if(!bar)return;
    if(state.phase==='journey') renderTaskbar(bar);
    else if(state.phase==='jump3') renderJumpCard(bar,3);
    else if(state.phase==='jump30') renderJumpCard(bar,30);
    app.setAttribute('aria-busy','false');
  }
  function onFrameLoad() {
    if(!iframeRef)return;
    let win,doc;
    try { win=iframeRef.contentWindow;doc=iframeRef.contentDocument; } catch (_) { return; }
    if(!win||!doc)return;
    const initial=win.location.href;
    recordRoute('load',initial);
    try { win.addEventListener('hashchange',()=>recordRoute('hashchange',win.location.href)); } catch(_){}
    doc.addEventListener('click',onFrameClick,true);
    observeDownloads(doc);
    startGoogleSimulation(win,doc);
  }
  function startGoogleSimulation(win,doc,attempt=0) {
    if(!['A','B-Google'].includes(state?.camino)||state.taskIndex!==0||state.search_started)return;
    let current;
    try { current=new URL(win.location.href); } catch(_){return;}
    const indexUrl=new URL('index.html',location.href);
    if(current.origin!==location.origin||current.pathname!==indexUrl.pathname||current.hash!=='#C01')return;
    const start=doc.getElementById('m4tStart');
    if(!start) {
      if(attempt<12)setTimeout(()=>startGoogleSimulation(win,doc,attempt+1),60);
      return;
    }
    state.search_started=true;persist();
    try { start.click(); } catch(_) {}
  }
  function recordRoute(kind,rawUrl) {
    const url=allowedDestination(rawUrl);
    if(!url)return;
    const key=url.href;
    const event={tipo:kind,url:routeName(key),at:isoNow(),ms:Date.now()};
    state.recorrido.push(event);
    state.last_iframe_url=key;
    const task=state.tareas?.[state.taskIndex];
    if(task&&!task.pantallas.includes(event.url))task.pantallas.push(event.url);
    persist();
  }
  function screenKey(doc) {
    try { return routeName(doc.defaultView.location.href)||'pantalla'; } catch (_) { return 'pantalla'; }
  }
  function isDownloadLink(link) {
    if(!link)return false;
    const href=link.getAttribute('href')||'';
    const pathname=(link.download||href).split(/[?#]/)[0].toLowerCase();
    return Boolean(link.hasAttribute('download')||/\.(pdf|csv|xlsx?)$/i.test(pathname));
  }
  function downloadDescriptor(link,doc) {
    let href='';
    try { href=new URL(link.getAttribute('href')||'',doc.location.href).href; } catch(_){}
    const parsed=(()=>{try{return new URL(href);}catch(_){return null;}})();
    if(parsed&&parsed.origin!==location.origin)return null;
    const url=parsed?routeName(parsed.href):'';
    return {url,label:cleanText(link.textContent||link.getAttribute('aria-label')||link.download||'Archivo'),at:isoNow(),pantalla:screenKey(doc)};
  }
  function observeDownloads(doc) {
    const scan=()=>{
      doc.querySelectorAll('a').forEach(link=>{
        if(!isDownloadLink(link))return;
        const item=downloadDescriptor(link,doc);
        if(!item||!item.url)return;
        if(!state.descargas.disponibles.some(existing=>existing.url===item.url&&existing.pantalla===item.pantalla))
          state.descargas.disponibles.push(item);
      });
      persist();
    };
    scan();
    try { new MutationObserver(scan).observe(doc.body||doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','download']}); } catch(_){}
  }
  function onFrameClick(event) {
    const target=event.target?.nodeType===1?event.target:event.target?.parentElement;
    if(!target)return;
    // 13-nov: el texto de una casilla u opción (<label>) también es interactivo: al tocarlo se marca su control.
    // Antes esos clics se contaban como «sin respuesta» y la métrica salía inflada.
    const interactive=target.closest('a,button,input,select,textarea,summary,label,[role="button"],[role="link"],[onclick],[tabindex]:not([tabindex="-1"])');
    const doc=event.currentTarget;
    const key=screenKey(doc);
    if(!state.clicksByScreen[key])state.clicksByScreen[key]={clics:0,interactivos:0,sin_respuesta:0};
    const screen=state.clicksByScreen[key];
    screen.clics+=1;
    if(interactive)screen.interactivos+=1;else screen.sin_respuesta+=1;
    const label=interactive?.getAttribute('aria-label')||interactive?.getAttribute('title')||interactive?.id||interactive?.tagName||'zona sin control';
    state.clics.push({pantalla:key,at:isoNow(),interactivo:Boolean(interactive),objetivo:cleanText(label).slice(0,80)});
    if(interactive&&interactive.tagName==='A'&&isDownloadLink(interactive)) {
      const item=downloadDescriptor(interactive,doc);
      if(item&&!state.descargas.tocadas.some(existing=>existing.url===item.url&&existing.pantalla===item.pantalla))
        state.descargas.tocadas.push(item);
    }
    persist();
  }
  function portalSignal() {
    try {
      const win=iframeRef?.contentWindow;
      if(!win)return {proposal:false,accepted:false,signed:false,source:'sin recorrido'};
      const appState=win.M4?.get?.();
      if(appState) {
        const accepted=appState.proposal?.status==='aceptada';
        return {
          proposal:Boolean(appState.proposal)&&!accepted,
          accepted,
          signed:Boolean(appState.customerCycle?.contractSignedAt),
          source:'M4Journey/M4'
        };
      }
      const api=win.MarleyPrueba?.estado?.();
      if(api)return {proposal:false,accepted:false,signed:Boolean(api.contratoFirmado),source:'MarleyPrueba'};
    } catch (_) {}
    return {proposal:false,accepted:false,signed:false,source:'sin señal'};
  }
  function pausa2Registrada() {
    return Boolean(state?.pausas?.some(item=>item.fase==='pausa2'&&item.termino_en));
  }
  function tareaAnteriorTerminada() {
    const previous=state?.tareas?.[state.taskIndex-1];
    return Boolean(previous?.termino_en&&previous?.resultado);
  }
  function jumpReady(days) {
    return tareaAnteriorTerminada();
  }
  function adaptarTareaTresDias(accepted) {
    const task=state.tareas?.[state.taskIndex];
    if(!task||task.etapa!=='T4')return;
    task.propuesta_aceptada_al_saltar=Boolean(accepted);
    task.titulo=accepted?'Revisa tu pedido en el portal':'Retoma tu decisión';
    task.consigna=accepted?'Revisa en tu portal qué pasa con tu pedido.':'Retoma tu decisión.';
  }
  function stageKicker(task) {
    return 'Etapa ' + (state.taskIndex+1) + ' de ' + state.tareas.length + (task?.etapa_nombre ? ' · ' + task.etapa_nombre : '');
  }
  function setBarMode(bar,modal) { bar.classList.toggle('is-modal',Boolean(modal)); bar.classList.remove('is-collapsed'); }
  function renderTaskbar(bar) {
    const task=state.tareas[state.taskIndex];
    if(!task) {state.phase='final';state.questionIndex=0;persist();renderQuestion('final');return;}
    if(state.evaluating) {renderTaskEvaluation(bar);return;}
    if(!task.intro_visto||state.task_details_open) {renderTaskIntro(bar,task);return;}
    setBarMode(bar,false);
    bar.innerHTML='<div class="ag-strip-info"><span class="ag-strip-kicker">' + escapeHtml(stageKicker(task)) + '</span><h1 class="ag-strip-title">' + escapeHtml(task.titulo) + '</h1></div>'
      + '<div class="ag-strip-actions"><button class="ag-btn" type="button" data-action="task-details">Ver tarea</button>'
      + '<button class="ag-btn ag-btn--primary" type="button" data-action="task-done">Terminé</button></div>';
    bar.querySelector('[data-action="task-details"]')?.addEventListener('click',()=>{state.task_details_open=true;persist();renderJourney();});
    bar.querySelector('[data-action="task-done"]')?.addEventListener('click',taskFinished);
  }
  function renderTaskIntro(bar,task) {
    setBarMode(bar,true);
    const again=Boolean(task.intro_visto);
    bar.innerHTML='<div class="ag-modal" role="dialog" aria-modal="true" aria-labelledby="ag-intro-title"><p class="ag-modal-kicker">' + escapeHtml(stageKicker(task)) + '</p>'
      + '<h1 class="ag-taskbar-title" id="ag-intro-title">' + escapeHtml(task.titulo) + '</h1>'
      + '<p class="ag-task-prompt">' + escapeHtml(task.consigna) + '</p>'
      + '<p class="ag-modal-how">Verás el sitio en pantalla completa. Cuando termines, toca «Terminé» abajo y te haremos unas pocas preguntas. No hay respuestas correctas.</p>'
      + '<div class="ag-modal-actions"><button class="ag-btn ag-btn--primary" type="button" data-action="task-start">' + (again?'Seguir con la tarea':'Empezar la tarea') + '</button>'
      + '<button class="ag-btn ag-btn--quiet" type="button" data-action="finish-early">Terminar la prueba</button></div></div>';
    bar.querySelector('[data-action="task-start"]')?.addEventListener('click',()=>{task.intro_visto=true;state.task_details_open=false;startCurrentTask();persist();renderJourney();});
    bar.querySelector('[data-action="finish-early"]')?.addEventListener('click',finishEarly);
  }
  function stageQuestionsFor(task) {
    if(isInternal()||!task)return [];
    const ids=bank?.preguntas_etapa?.[task.etapa]||[];
    return ids.map(id=>({id,...(bank.preguntas[id]||{})})).filter(item=>item.tipo);
  }
  function stageQuestionHtml(question) {
    const name='stage-' + question.id;
    if(question.tipo==='agreement') {
      const options=optionList(question).map(option=>'<label title="' + escapeHtml(option.text) + '"><input type="radio" name="' + name + '" value="' + option.value + '"><span>' + option.value + '</span></label>').join('');
      return '<fieldset><legend>' + escapeHtml(question.texto) + '</legend><div class="ag-task-progress">1 = Muy en desacuerdo · 5 = Muy de acuerdo</div><div class="ag-agree-grid">' + options + '</div></fieldset>';
    }
    const options=optionList(question).map(option=>'<label><input type="radio" name="' + name + '" value="' + escapeHtml(option.text) + '"><span>' + escapeHtml(option.text) + '</span></label>').join('');
    return '<fieldset><legend>' + escapeHtml(question.texto) + '</legend><div class="ag-result-options">' + options + '</div></fieldset>';
  }
  function renderTaskEvaluation(bar) {
    const task=state.tareas[state.taskIndex];
    setBarMode(bar,true);
    questionOpenedAt=Date.now();
    const seq=Array.from({length:7},(_,index)=>{
      const number=index+1;
      return '<label><input type="radio" name="task-seq" value="' + number + '"><span>' + number + '</span></label>';
    }).join('');
    bar.innerHTML='<div class="ag-modal" role="dialog" aria-modal="true" aria-labelledby="ag-eval-title"><p class="ag-modal-kicker">' + escapeHtml(stageKicker(task)) + '</p>'
      + '<h1 class="ag-taskbar-title" id="ag-eval-title">¿Cómo te fue?</h1><p class="ag-modal-how">' + escapeHtml(task.titulo) + '</p>'
      + '<form class="ag-result-form" id="task-evaluation"><fieldset><legend>¿Lo lograste?</legend><div class="ag-result-options">'
      + '<label><input type="radio" name="task-result" value="Logrado"><span>Sí</span></label>'
      + '<label><input type="radio" name="task-result" value="Con ayuda"><span>En parte</span></label>'
      + '<label><input type="radio" name="task-result" value="No logrado"><span>No</span></label>'
      + '</div></fieldset><fieldset><legend>¿Qué tan fácil o difícil fue?</legend><div class="ag-task-progress">1 = Muy difícil · 7 = Muy fácil</div><div class="ag-seq-grid">' + seq + '</div></fieldset>'
      + stageQuestionsFor(task).map(stageQuestionHtml).join('')
      + '<label for="task-comment">¿Algo te confundió o te hizo dudar? <span class="ag-task-progress">Opcional</span></label><textarea id="task-comment" class="ag-textarea" maxlength="500" placeholder="Hasta 500 caracteres. No escribas nombres ni datos de contacto."></textarea>'
      + '<p class="ag-status" id="task-evaluation-status" role="status"></p><div class="ag-modal-actions"><button class="ag-btn ag-btn--primary" type="submit">Guardar y seguir</button><button class="ag-btn" type="button" data-action="return-task">Volver a la tarea</button></div></form></div>';
    document.getElementById('task-evaluation').addEventListener('submit',event=>{event.preventDefault();saveTaskEvaluation();});
    bar.querySelector('[data-action="return-task"]')?.addEventListener('click',()=>{state.evaluating=false;persist();renderJourney();});
  }
  function renderJumpCard(bar,days) {
    const gate=portalSignal();
    const ready=jumpReady(days);
    const title=days===3?'3 días después':'Un mes después';
    const prompt=days===3?'Pasaron tres días desde tu última tarea. Continúa cuando quieras retomar tu caso.':'Pasó un mes desde tu última tarea. Puedes avanzar aunque el contrato todavía no esté firmado.';
    setBarMode(bar,true);
    bar.innerHTML='<div class="ag-modal" role="dialog" aria-modal="true" aria-labelledby="ag-jump-title"><p class="ag-modal-kicker">Salto de tiempo</p><div class="ag-interstitial"><h1 class="ag-taskbar-title" id="ag-jump-title">' + title + '</h1><p>' + prompt + '</p>'
      + '<p class="' + (ready?'ag-jump-ready':'ag-jump-wait') + '" role="status">' + (ready?'El recorrido está listo para avanzar.':'Completa el paso correspondiente en la pantalla del recorrido para habilitar el avance.') + '</p>'
      + (days===30&&!gate.signed?'<p class="ag-help" data-contract-simulation>Para seguir, simulamos que firmaste el contrato.</p>':'')
      + '<button class="ag-btn ag-btn--primary" type="button" data-action="jump" ' + (ready?'':'disabled') + '>Avanzar el tiempo</button>'
      + '<button class="ag-btn ag-btn--quiet" type="button" data-action="finish-early">Terminar la prueba</button></div></div>';
    bar.querySelector('[data-action="jump"]')?.addEventListener('click',()=>applyJump(days));
    bar.querySelector('[data-action="finish-early"]')?.addEventListener('click',finishEarly);
    jumpPoll=setInterval(()=>{
      if(!document.querySelector('.ag-taskbar')||!['jump3','jump30'].includes(state.phase)){clearInterval(jumpPoll);jumpPoll=null;return;}
      const nowReady=jumpReady(days);
      const button=bar.querySelector('[data-action="jump"]');
      const status=bar.querySelector('[role="status"]');
      if(button&&!simulandoFirma)button.disabled=!nowReady;
      if(status&&!simulandoFirma){status.textContent=nowReady?'El recorrido está listo para avanzar.':'Completa el paso correspondiente en la pantalla del recorrido para habilitar el avance.';status.classList.toggle('ag-jump-ready',nowReady);status.classList.toggle('ag-jump-wait',!nowReady);}
    },700);
  }
  function waitFor(predicate,timeout=2500) {
    return new Promise(resolve=>{
      const started=Date.now();
      const poll=()=>{
        let value=false;try{value=predicate();}catch(_){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){resolve(false);return;}
        setTimeout(poll,100);
      };
      poll();
    });
  }
  async function simulateContractForMonth() {
    let gate=portalSignal();
    if(gate.signed)return {signed:true,accepted:false};
    const win=iframeRef?.contentWindow;
    if(!win)return {signed:false,accepted:false};
    let accepted=false;
    try {
      const current=win.M4?.get?.();
      if(current?.proposal&&current.proposal.status!=='aceptada') {
        if(typeof win.M4?.acceptProposal!=='function')return {signed:false,accepted:false};
        win.M4.acceptProposal();
        accepted=true;
        await waitFor(()=>win.M4?.get?.()?.proposal?.status==='aceptada');
      }
      if(win.location.hash!=='#C06'&&typeof win.MarleyApp?.go==='function')win.MarleyApp.go('C06');
      const hasButton=await waitFor(()=>{
        const button=win.document.querySelector('[data-cycle-action="sign-contract"]');
        return button&&button.getClientRects().length?button:false;
      });
      if(!hasButton)return {signed:false,accepted};
      hasButton.click();
      const signed=await waitFor(()=>Boolean(win.M4?.get?.()?.customerCycle?.contractSignedAt));
      gate=portalSignal();
      return {signed:Boolean(signed||gate.signed),accepted};
    } catch(_) { return {signed:false,accepted}; }
  }
  let simulandoFirma=false;
  async function applyJump(days) {
    if(simulandoFirma||!jumpReady(days))return;
    const gate=portalSignal();
    let signature={signed:Boolean(gate.signed),accepted:false};
    if(days===30&&!gate.signed) {
      const status=app.querySelector('.ag-taskbar [role="status"]');
      const button=app.querySelector('.ag-taskbar [data-action="jump"]');
      if(status)status.textContent='Para seguir, simulamos que firmaste el contrato.';
      if(button)button.disabled=true;
      simulandoFirma=true;
      try { signature=await simulateContractForMonth(); }
      finally { simulandoFirma=false; if(button)button.disabled=false; }
      if(!signature.signed) {
        const failed=app.querySelector('.ag-taskbar [role="status"]');
        if(failed){failed.textContent='No pudimos registrar la firma simulada en el recorrido. Vuelve al paso anterior e inténtalo de nuevo.';failed.dataset.kind='error';}
        return;
      }
    }
    if(days===3)adaptarTareaTresDias(gate.accepted);
    const payload={dias:days,sesion_id:state.session.id,at:Date.now(),nonce:randomNonce()};
    try { localStorage.setItem(JUMP_KEY,JSON.stringify(payload)); }
    catch (_) { const status=app.querySelector('.ag-taskbar [role="status"]');if(status)status.textContent='No se pudo guardar el avance del tiempo en este navegador.';return; }
    const stage=days===3?'E5':'E7';
    const row={
      sesion_id:state.session.id,sesion_origen:'',participante:state.session.id,
      camino:state.camino,rol:state.session.rol,perfil:state.session.perfil,
      momento:'etapa',etapa:stage,pregunta_id:days===3?'salto_3d':'salto_30d',tipo:'evento',
      respuesta:JSON.stringify(payload),respuesta_texto:days===3?'Pasaron 3 días':'Pasó un mes',
      otra_texto:'',omitida:false,ms_respuesta:0,guardado_en:isoNow(),version_banco:bank.version
    };
    state.respuestas.push(row);
    state.saltos.push({...payload,hecho_en:isoNow(),fuente:gate.source,contrato_simulado:days===30&&!gate.signed,propuesta_aceptada_al_saltar:Boolean(gate.accepted),propuesta_aceptada_para_firma:Boolean(signature.accepted)});
    state.phase='journey';state.evaluating=false;state.task_details_open=false;
    if(jumpPoll){clearInterval(jumpPoll);jumpPoll=null;}
    persist();renderJourney();
  }
  function finishEarly() {
    if(!window.confirm('¿Quieres terminar el recorrido ahora? Después responderás las preguntas finales y podrás descargar el informe.'))return;
    state.termino_anticipado=true;state.phase='final';state.questionIndex=0;state.evaluating=false;
    persist();renderQuestion('final');
  }

  function answerText(row) {
    if(row.omitida)return 'Prefiero no responder';
    if(Array.isArray(row.respuesta))return row.respuesta.join(' · ');
    if(row.respuesta_texto)return row.respuesta_texto;
    return String(row.respuesta ?? '—');
  }
  function redacted(value) {
    return String(value ?? '')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[correo omitido]')
      .replace(/\+?\s*56\s*9\s*\d{4}\s*\d{4}/g,'[teléfono omitido]')
      .replace(/\b9\s*\d{4}\s*\d{4}\b/g,'[teléfono omitido]');
  }
  function reportSession() {
    const session=state.session||{};
    return {
      codigo:session.id, camino:session.camino, perfil:session.perfil, rol:session.rol,
      inicio:session.inicio, fin:state.finished_at, estado:state.termino_anticipado?'terminada antes del final':'completa',
      dispositivo:session.dispositivo, consentimiento:state.consentimiento, destino:session.destino
    };
  }
  function reportData() {
    return {
      version_banco:bank.version,
      version_autoguiada:state.version_autoguiada||AG_VERSION,
      sesion:reportSession(),
      respuestas:state.respuestas.map(row=>({...row,respuesta_texto:redacted(row.respuesta_texto),otra_texto:redacted(row.otra_texto),respuesta:typeof row.respuesta==='string'?redacted(row.respuesta):row.respuesta})),
      tareas:state.tareas.map(task=>({...task,comentario:redacted(task.comentario)})),
      pausas:state.pausas,saltos:state.saltos,
      recorrido:state.recorrido.map(item=>({...item,url:redacted(item.url)})),
      clics:state.clics,clicksByScreen:state.clicksByScreen,
      descargas:state.descargas,umux_score:state.umux_score
    };
  }
  function totalDuration() {
    if(!state.started_at)return 0;
    return Math.max(0,(Date.parse(state.finished_at||isoNow())||Date.now())-(Date.parse(state.started_at)||Date.now()));
  }
  function renderResults() {
    if(jumpPoll){clearInterval(jumpPoll);jumpPoll=null;}
    iframeRef=null;
    const tasks=state.tareas||[];
    const complete=tasks.filter(task=>task.resultado==='Logrado').length;
    const seqValues=tasks.map(task=>Number(task.seq)).filter(value=>value>=1&&value<=7);
    const seqMean=seqValues.length?(seqValues.reduce((sum,value)=>sum+value,0)/seqValues.length).toFixed(1).replace('.',','):'—';
    const profile=state.camino==='C'?ROLE_LABELS[state.rol]:PROFILE_LABELS[state.perfil];
    const pending=!state.pdf_downloaded;
    const available=state.descargas?.disponibles||[];
    const tapped=state.descargas?.tocadas||[];
    app.innerHTML='<section class="ag-results"><div class="ag-results-inner">' + brandMarkup()
      + '<p class="ag-kicker">Prueba ' + escapeHtml(state.session?.id||'') + '</p><h1>' + (state.termino_anticipado?'Prueba terminada':'Gracias por participar') + '</h1>'
      + (pending?'<p class="ag-warning">Antes de empezar otra prueba, descarga este informe para conservar tus resultados.</p>':'')
      + '<p class="ag-lede">' + escapeHtml(state.camino==='C'?'Equipo interno · '+profile:state.camino+' · '+profile) + ' · ' + formatDuration(totalDuration()) + '</p>'
      + '<div class="ag-kpi-grid"><div class="ag-kpi"><strong>' + complete + ' / ' + tasks.length + '</strong><span>Tareas logradas</span></div>'
      + '<div class="ag-kpi"><strong>' + seqMean + '</strong><span>Facilidad media (1–7)</span></div>'
      + '<div class="ag-kpi"><strong>' + (state.umux_score==null?'—':String(state.umux_score).replace('.',',')) + '</strong><span>UMUX-Lite (0–100)</span></div>'
      + '<div class="ag-kpi"><strong>' + formatDuration(totalDuration()) + '</strong><span>Tiempo total</span></div></div>'
      + '<section class="ag-result-section"><h2>Descargas del recorrido</h2><p>' + available.length + ' disponibles · ' + tapped.length + ' seleccionadas</p></section>'
      + '<section class="ag-result-section"><h2>Próximo paso</h2><p>Envía el informe a quien te invitó a la prueba.</p></section>'
      + '<div class="ag-result-actions"><button id="download-pdf" class="ag-btn ag-btn--primary" type="button">Descargar informe PDF</button>'
      + '<button id="download-json" class="ag-btn" type="button">Descargar datos (JSON)</button>'
      + '<button id="download-csv" class="ag-btn" type="button">Descargar tareas (CSV)</button>'
      + '<button id="new-test" class="ag-btn ag-btn--quiet" type="button"' + (pending?' disabled':'') + '>Hacer otra prueba</button></div>'
      + '<p class="ag-status" id="result-status" role="status">' + (pending?'El informe PDF todavía no se ha descargado.':'El PDF quedó descargado en este dispositivo.') + '</p>'
      + '<details class="ag-result-section"><summary>Resumen de tareas</summary><div class="ag-table-wrap"><table class="ag-table"><thead><tr><th>Tarea</th><th>Resultado</th><th>Tiempo</th><th>Facilidad</th></tr></thead><tbody>'
      + tasks.map(task=>'<tr><td>' + escapeHtml((task.etapa_nombre?task.etapa_nombre+' · ':'')+task.titulo) + '</td><td>' + escapeHtml(task.resultado||'No completada') + '</td><td>' + escapeHtml(formatDuration(task.duracion_ms)) + '</td><td>' + escapeHtml(task.seq||'—') + '</td></tr>').join('')
      + '</tbody></table></div></details></div></section>';
    document.getElementById('download-pdf').addEventListener('click',downloadPdf);
    document.getElementById('download-json').addEventListener('click',downloadJson);
    document.getElementById('download-csv').addEventListener('click',downloadTasksCsv);
    document.getElementById('new-test').addEventListener('click',startAnother);
    app.setAttribute('aria-busy','false');
  }
  function startAnother() {
    if(!state.pdf_downloaded) {
      const status=document.getElementById('result-status');
      status.textContent='Descarga el informe PDF antes de empezar otra prueba.';
      status.dataset.kind='error';return;
    }
    prototypeReset();
    state=newDraft();persist();renderWelcome();
  }
  function markExport(name) {
    state.exports=state.exports||{};
    state.exports[name]=isoNow();persist();
  }
  function downloadBlob(name,blob) {
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;anchor.hidden=true;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function downloadJson() {
    const text='\uFEFF'+JSON.stringify(reportData(),null,2);
    downloadBlob('autoguiada_'+state.session.id+'.json',new Blob([text],{type:'application/json;charset=utf-8'}));
    markExport('json');
    document.getElementById('result-status').textContent='Datos JSON descargados.';
  }
  function csvCell(value) {
    let text=Array.isArray(value)?JSON.stringify(value):String(value??'');
    if(/^\s*[=+\-@\t\r]/.test(text))text="'"+text;
    return '"' + text.replace(/"/g,'""').replace(/\r?\n/g,' ') + '"';
  }
  function downloadTasksCsv() {
    const columns=['sesion_id','camino','rol','perfil','tarea','titulo','empezo_en','termino_en','duracion_ms','resultado','seq','comentario','pantallas','etapa_nombre','preguntas_etapa'];
    const rows=state.tareas.map(task=>({
      sesion_id:state.session.id,camino:state.camino,rol:state.session.rol,perfil:state.session.perfil,
      tarea:task.etapa,titulo:task.titulo,empezo_en:task.empezo_en,termino_en:task.termino_en,
      duracion_ms:task.duracion_ms,resultado:task.resultado,seq:task.seq,
      comentario:redacted(task.comentario),pantallas:task.pantallas,
      etapa_nombre:task.etapa_nombre||'',preguntas_etapa:task.preguntas_etapa?JSON.stringify(task.preguntas_etapa):''
    }));
    const csv='\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>columns.map(column=>csvCell(row[column])).join(','))].join('\r\n');
    downloadBlob('autoguiada_'+state.session.id+'_tareas.csv',new Blob([csv],{type:'text/csv;charset=utf-8'}));
    markExport('csv');
    document.getElementById('result-status').textContent='Tareas CSV descargadas.';
  }
  function downloadPdf() {
    const data=reportData();
    const bytes=buildPdf(data);
    downloadBlob('autoguiada_'+state.session.id+'_informe.pdf',new Blob([bytes],{type:'application/pdf'}));
    state.pdf_downloaded=true;markExport('pdf');renderResults();
  }
  function pdfSections(data) {
    const session=data.sesion;
    const responseLines=(moment)=> {
      const rows=data.respuestas.filter(row=>row.momento===moment&&row.pregunta_id!=='consentimiento');
      if(!rows.length)return ['Sin respuestas registradas.'];
      return rows.map(row=>{
        const question=bank.preguntas[row.pregunta_id]?.texto||row.pregunta_id;
        return redacted(question)+' · '+redacted(answerText(row));
      });
    };
    const taskLines=data.tareas.length?data.tareas.map((task,index)=>(index+1)+'. '+(task.etapa_nombre?task.etapa_nombre+' · ':'')+task.titulo+' | '+(task.resultado||'No completada')+' | '+formatDuration(task.duracion_ms)+' | Facilidad '+(task.seq||'—')+'/7'+(task.comentario?' | '+redacted(task.comentario):'')):['No se registraron tareas.'];
    const pauseLines=data.pausas.length?data.pausas.map(item=>PHASE_LABELS[item.fase]+' · '+formatDate(item.termino_en||item.empezo_en)):['Sin pausas registradas.'];
    const stageRows=data.respuestas.filter(row=>row.momento==='etapa'&&row.tipo!=='evento');
    const stageLines=stageRows.length?stageRows.map(row=>(STAGE_NAMES[row.etapa]||row.etapa)+' · '+redacted(bank.preguntas[row.pregunta_id]?.texto||row.pregunta_id)+' · '+redacted(answerText(row))):['Sin preguntas por etapa registradas.'];
    const jumpLines=data.saltos.length?data.saltos.map(item=>(item.dias===3?'3 días después':'Un mes después')+' · '+formatDate(item.hecho_en)+' · evento local registrado'):['Sin saltos registrados.'];
    const downloadLines=(data.descargas.disponibles||[]).length?data.descargas.disponibles.map(item=>item.label+' · '+item.url+' · '+((data.descargas.tocadas||[]).some(done=>done.url===item.url&&done.pantalla===item.pantalla)?'seleccionada':'no seleccionada')):['No se detectaron archivos descargables en las pantallas visitadas.'];
    const journeyLines=data.recorrido.length?data.recorrido.map(item=>formatDate(item.at)+' · '+item.tipo+' · '+item.url):['No se registraron pantallas del recorrido.'];
    const clickLines=Object.entries(data.clicksByScreen||{}).map(([screen,value])=>screen+' · '+value.clics+' clics · '+value.sin_respuesta+' sin respuesta');
    return [
      {title:'Portada',lines:[
        'Informe de prueba autoguiada',
        'Camino: '+(session.camino==='C'?'Equipo interno':session.camino),
        'Perfil o rol: '+(session.camino==='C'?ROLE_LABELS[session.rol]:PROFILE_LABELS[session.perfil]),
        'Fecha: '+formatDate(session.inicio),
        'Duración: '+formatDuration((Date.parse(session.fin)||Date.now())-(Date.parse(session.inicio)||Date.now())),
        'Tamaño de pantalla: '+session.dispositivo.ancho+' × '+session.dispositivo.alto+' · '+session.dispositivo.navegador,
        'Código: '+session.codigo,
        'Estado: '+session.estado
      ]},
      {title:'Cuestionario inicial',lines:responseLines('inicial')},
      {title:'Tabla de tareas',lines:taskLines},
      {title:'Preguntas por etapa',lines:stageLines.concat(data.pausas.length?['','Pausas de la versión anterior:'].concat(pauseLines).concat(['pausa1','pausa2','pausa_c'].flatMap(phase=>['','— '+(PHASE_LABELS[phase]||phase)].concat(responseLines(phase)))):[])},
      {title:'Saltos de tiempo',lines:jumpLines},
      {title:'Cuestionario final y UMUX-Lite',lines:responseLines('final').concat(['','Puntaje UMUX-Lite: '+(data.umux_score==null?'incompleto':String(data.umux_score).replace('.',',')+' / 100')])},
      {title:'Descargas disponibles y seleccionadas',lines:downloadLines},
      {title:'Anexo · recorrido y horas',lines:journeyLines},
      {title:'Anexo · clics por pantalla',lines:clickLines.length?clickLines:['Sin clics registrados.']}
    ];
  }
  function pdfWrap(text,max=92) {
    const words=String(text||'').split(/\s+/);
    const lines=[];let line='';
    words.forEach(word=>{
      if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}
      else line=(line+' '+word).trim();
    });
    if(line)lines.push(line);
    return lines.length?lines:[''];
  }
  const CP1252_EXTRA={'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8A,'‹':0x8B,'Œ':0x8C,'Ž':0x8E,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9A,'›':0x9B,'œ':0x9C,'ž':0x9E,'Ÿ':0x9F};
  const CP1252_EXTRA_BY_CODE={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
  function cp1252Bytes(text) {
    const out=[];
    for(const char of String(text??'')) {
      const code=char.codePointAt(0);
      let byte=code<=255?code:(CP1252_EXTRA_BY_CODE[code]??0x3F);
      if(byte===0x0A||byte===0x0D)byte=0x20;
      if(byte===0x5C||byte===0x28||byte===0x29)out.push(0x5C);
      out.push(byte);
    }
    return new Uint8Array(out);
  }
  function asciiBytes(text) { return new TextEncoder().encode(String(text)); }
  function concatBytes(arrays) {
    const size=arrays.reduce((sum,item)=>sum+item.length,0);
    const output=new Uint8Array(size);let offset=0;
    arrays.forEach(item=>{output.set(item,offset);offset+=item.length;});
    return output;
  }
  function toUnicodeCMap() {
    const special={0x80:0x20AC,0x82:0x201A,0x83:0x0192,0x84:0x201E,0x85:0x2026,0x86:0x2020,0x87:0x2021,0x88:0x02C6,0x89:0x2030,0x8A:0x0160,0x8B:0x2039,0x8C:0x0152,0x8E:0x017D,0x91:0x2018,0x92:0x2019,0x93:0x201C,0x94:0x201D,0x95:0x2022,0x96:0x2013,0x97:0x2014,0x98:0x02DC,0x99:0x2122,0x9A:0x0161,0x9B:0x203A,0x9C:0x0153,0x9E:0x017E,0x9F:0x0178};
    const mappings=[];
    for(let byte=0x20;byte<=0xFF;byte++)mappings.push('<'+byte.toString(16).padStart(2,'0').toUpperCase()+'> <'+(special[byte]??byte).toString(16).padStart(4,'0').toUpperCase()+'>');
    const blocks=[];
    for(let index=0;index<mappings.length;index+=100){const part=mappings.slice(index,index+100);blocks.push(part.length+' beginbfchar',...part,'endbfchar');}
    const cmap=['/CIDInit /ProcSet findresource begin','12 dict begin','begincmap','/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def','/CMapName /WinAnsiUnicode def','/CMapType 2 def','1 begincodespacerange','<20> <FF>','endcodespacerange',...blocks,'endcmap','CMapName currentdict /CMap defineresource pop','end','end'].join('\n');
    const stream=asciiBytes(cmap);
    return concatBytes([asciiBytes('4 0 obj\n<< /Length '+stream.length+' >>\nstream\n'),stream,asciiBytes('\nendstream\nendobj\n')]);
  }
  function buildPdf(data) {
    const sections=pdfSections(data);
    const pages=[];let lines=[];
    sections.forEach(section=>{
      if(lines.length)lines.push({kind:'gap',text:''});
      lines.push({kind:'section',text:section.title.toLocaleUpperCase('es-CL')});
      section.lines.forEach(line=>pdfWrap(line).forEach(part=>lines.push({kind:'body',text:part})));
    });
    let current=[];let y=780;
    lines.forEach(line=>{
      const height=line.kind==='section'?21:13;
      if(y<58){pages.push(current);current=[];y=780;}
      current.push({kind:line.kind,text:line.text,y});
      y-=height;
    });
    if(current.length||!pages.length)pages.push(current);
    const header=concatBytes([asciiBytes('%PDF-1.4\n%'),new Uint8Array([0xE2,0xE3,0xCF,0xD3]),asciiBytes('\n')]);
    const objects=[];
    objects.push(asciiBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
    const pageIds=pages.map((_,index)=>5+index*2);
    objects.push(asciiBytes('2 0 obj\n<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ') + '] /Count '+pages.length+' >>\nendobj\n'));
    objects.push(asciiBytes('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 4 0 R >>\nendobj\n'));
    objects.push(toUnicodeCMap());
    pages.forEach((page,index)=>{
      const pageId=5+index*2;const streamId=pageId+1;
      objects.push(asciiBytes(pageId+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>\nendobj\n'));
      const commandParts=[asciiBytes('')];
      commandParts.push(pdfTextCommand(48,812,8,'Marley Coffee · Informe autoguiado'));
      page.forEach(line=>{
        if(line.kind==='gap')return;
        const size=line.kind==='section'?13:(line.y===780&&index===0?17:9);
        const y=line.y;
        commandParts.push(pdfTextCommand(48,y,size,line.text));
      });
      commandParts.push(pdfTextCommand(500,28,8,'Página '+(index+1)+' de '+pages.length));
      const stream=concatBytes(commandParts);
      objects.push(concatBytes([
        asciiBytes(streamId+' 0 obj\n<< /Length '+stream.length+' >>\nstream\n'),
        stream,asciiBytes('\nendstream\nendobj\n')
      ]));
    });
    const offsets=[0];let position=header.length;
    objects.forEach(object=>{offsets.push(position);position+=object.length;});
    const xrefOffset=position;
    let xref='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
    for(let index=1;index<offsets.length;index++)xref+=String(offsets[index]).padStart(10,'0')+' 00000 n \n';
    const trailer='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF';
    return concatBytes([header,...objects,asciiBytes(xref+trailer)]);
  }
  function pdfTextCommand(x,y,size,text) {
    return concatBytes([
      asciiBytes('BT /F1 '+size+' Tf '+x+' '+y+' Td ('),
      cp1252Bytes(redacted(text)),
      asciiBytes(') Tj ET\n')
    ]);
  }

  async function initialise() {
    if(!app){return;}
    try {
      if(location.protocol==='file:')throw new Error('Abre esta página desde el sitio servido por HTTP, no desde un archivo local.');
      app.setAttribute('aria-busy','true');
      const [bankResponse,fichaResponse]=await Promise.all([
        fetch(BANK_URL.href,{credentials:'same-origin',cache:'no-store'}),
        fetch(FICHAS_URL.href,{credentials:'same-origin',cache:'no-store'})
      ]);
      if(!bankResponse.ok||!fichaResponse.ok)throw new Error('No se pudieron cargar los materiales de la prueba desde este sitio.');
      bank=await bankResponse.json();const fixtureData=await fichaResponse.json();
      if(bank.version!=='2026-11-11-v1'||!bank.preguntas||!bank.fases||!fixtureData.ficticio||!Array.isArray(fixtureData.fichas))throw new Error('La versión de los materiales no coincide.');
      fichas=fixtureData.fichas;
      state=parseStored(AUTO_KEY);
      if(!state||state.schema!==1) {
        prototypeReset();state=newDraft();persist();
      } else if(state.phase==='complete'&&state.pdf_downloaded) {
        prototypeReset();state=newDraft();persist();
      } else if(!state.session) {
        const consent=state.consentimiento;
        prototypeReset();state=newDraft();
        if(consent?.aceptado)state.consentimiento=consent;
        persist();
      }
      consentRow();
      routeState();
    } catch(error) { showFatal(error.message||'No se pudo preparar esta prueba.'); }
  }
  function routeState() {
    if(!state)state=newDraft();
    if(state.phase==='welcome')renderWelcome();
    else if(state.phase==='choice')renderChoice();
    else if(MODES.includes(state.phase))renderQuestion(state.phase);
    else if(['journey','jump3','jump30'].includes(state.phase))renderJourney();
    else if(state.phase==='complete')renderResults();
    else {state=newDraft();prototypeReset();persist();renderWelcome();}
  }

  window.addEventListener('beforeunload',()=>{if(jumpPoll)clearInterval(jumpPoll);});
  window.addEventListener('resize',()=>{
    if(state?.phase==='journey') {
      const bar=app.querySelector('.ag-taskbar');
      if(bar&&!state.evaluating)renderTaskbar(bar);
    }
  });
  initialise();
})();
