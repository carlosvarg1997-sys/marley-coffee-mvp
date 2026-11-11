(() => {
  'use strict';
  const M = window.MCPrueba;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const participant = $('#participant');
  const profile = $('#profile');
  const relay = $('#relay');
  const status = $('#status');
  const panel = $('#moderator-console');
  const ROOT = new URL('../../', location.href);
  const MAIN_KEY = 'marleyMVP:v7:prototype';
  const SITE_KEY = 'marleyMVP:v7:prototype:test-sitio';
  const assigned = { P1: 'restaurante', P2: 'hotel', P3: 'cafeteria', P4: 'oficina', P5: 'eventos' };
  const networkProfiles = {
    'B-Meta': ['restaurante', 'cafeteria', 'panaderia', 'conveniencia'],
    'B-LinkedIn': ['hotel', 'oficina', 'eventos']
  };
  const roles = { ventas: 'I1', marketing: 'I2', jefatura: 'I3' };
  let bank = null;
  let activeSession = null;

  const say = (message, kind = '') => { status.textContent = message; status.dataset.kind = kind; };
  const isLocal = () => ['localhost', '127.0.0.1', '::1'].includes(location.hostname) || location.hostname.endsWith('.localhost');
  const externalPath = path => new URL(path, ROOT);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const leadName = raw => { try { const state = JSON.parse(raw || 'null'); return state?.lead?.name?.trim() || ''; } catch (_) { return ''; } };

  function resetPrototypeData() {
    if (!isLocal()) throw new Error('Abre la consola desde localhost; el almacenamiento no se modificó.');
    const keys = Object.keys(localStorage).filter(key => !key.startsWith('mc_prueba_'));
    keys.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    const remaining = Object.keys(localStorage).filter(key => !key.startsWith('mc_prueba_'));
    if (remaining.length || sessionStorage.length) throw new Error('No pude confirmar el borrado de los datos del prototipo.');
    return keys.length;
  }

  function carryLead() {
    try {
      const site = localStorage.getItem(SITE_KEY);
      let name = leadName(site);
      if (name) {
        localStorage.setItem(MAIN_KEY, site);
        if (localStorage.getItem(MAIN_KEY) !== site) throw new Error('No pude traspasar el lead al CRM.');
        localStorage.removeItem(SITE_KEY);
      } else name = leadName(localStorage.getItem(MAIN_KEY));
      if (!name) throw new Error('No hay un lead de una sesión externa en este navegador. Termina antes una sesión A o B hasta registrar E3.');
      sessionStorage.clear();
      return name;
    } catch (error) {
      say(error.message, 'error');
      return '';
    }
  }

  function makeTarget(path, role, sessionId, startedAt, camino) {
    const url = path === 'C'
      ? externalPath('index.html')
      : (path === 'A' || path === 'B-Google')
        ? externalPath('index.html')
        : externalPath('captacion/anuncios/feed-simulado.html');
    const params = path === 'C'
      ? { test: 'personas', camino, rol: role, participante: roles[role], perfil: 'interno', mc_session: sessionId, journey_started_at: startedAt }
      : { test: path === 'A' || path === 'B-Google' ? 'sitio' : 'personas', camino, participante: participant.value, pid: participant.value, perfil: profile.value, mc_session: sessionId, journey_started_at: startedAt };
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    if (path === 'C') url.hash = 'R00';
    else if (path === 'A' || path === 'B-Google') {
      url.searchParams.set('tipo', 'cliente');
      url.searchParams.set('negocio', profile.value);
      url.searchParams.set('marco', '1');
      url.searchParams.set('p', participant.value);
      if (path === 'B-Google') url.searchParams.set('red', 'google');
      url.hash = 'C01';
    } else {
      url.searchParams.set('journey', 'full');
      url.searchParams.set('red', path === 'B-Meta' ? 'meta' : 'linkedin');
    }
    return url;
  }

  const externalJourneys = new Set(['A', 'B-Meta', 'B-LinkedIn', 'B-Google']);
  const profileLabels = { restaurante: 'Restaurante', hotel: 'Hotel', cafeteria: 'Cafetería', oficina: 'Oficina', eventos: 'Eventos y catering', panaderia: 'Panadería', conveniencia: 'Conveniencia', interno: 'Uso interno' };
  const roleLabels = { ventas: 'Ventas', marketing: 'Marketing', jefatura: 'Jefatura', externo: 'Participante externo' };
  const timeJumpCards = {
    salto_3d: { before: 'E5', series: 'Salto 01/04', word: '3 DÍAS DESPUÉS', instruction: 'Tu negocio aún evalúa la propuesta. Continúa como lo harías normalmente antes de decidir.', note: 'Escenario de investigación. No es un SLA ni una promesa de respuesta.', dias: 3, button: 'Saltar 3 días', etapa: 'E5' },
    decision_tomada: { before: 'E6', series: 'Salto 02/04', word: 'DECISIÓN TOMADA', instruction: 'En esta simulación, el negocio decidió avanzar. Continúa desde lo que esperarías que ocurra después.', note: 'Escenario simulado; no existe contrato ni alta real.' },
    salto_30d: { before: 'E7', series: 'Salto 03/04', word: 'UN MES DESPUÉS', instruction: 'Desde el primer pedido del escenario, tu equipo necesita organizar el siguiente abastecimiento. Decide qué revisar antes.', note: 'Intervalo de prueba; no define la cadencia de reposición de Marley.', dias: 30, button: 'Saltar un mes', etapa: 'E7' },
    caso_resuelto: { before: 'E9', series: 'Salto 04/04', word: 'CASO RESUELTO', instruction: 'El caso de soporte aparece resuelto. Una persona de otro negocio pregunta por tu experiencia. Decide si quieres compartirla.', note: 'No se enviará una invitación ni se contactará a terceros.' }
  };

  function isExternalSession(session) {
    return Boolean(session && session.rol === 'externo' && externalJourneys.has(session.camino));
  }

  function jumpEvent(session, id) {
    return M.readAnswers().find(row => row.sesion_id === session?.id && row.momento === 'etapa' && row.pregunta_id === id && row.tipo === 'evento') || null;
  }

  function phaseIsComplete(session, phase) {
    const questions = M.phaseQuestions(bank, phase, session);
    const rows = M.readAnswers();
    return questions.length > 0 && questions.every(question => rows.some(row => row.sesion_id === session.id && row.momento === phase && row.pregunta_id === question.id));
  }

  function timeJumpReady(session, id) {
    const current = M.readActive();
    if (!isExternalSession(session) || current?.id !== session.id || session.estado !== 'en_recorrido') return false;
    if (id === 'salto_3d') {
      const e4 = M.stagesFor(bank, session).find(stage => stage.id === 'E4');
      return Boolean(e4 && stageIsComplete(session, e4) && phaseIsComplete(session, 'pausa2'));
    }
    if (id === 'salto_30d') {
      const e6 = M.stagesFor(bank, session).find(stage => stage.id === 'E6');
      return Boolean(jumpEvent(session, 'salto_3d') && e6 && stageIsComplete(session, e6));
    }
    return false;
  }

  function jumpGateCopy(session, id) {
    if (!isExternalSession(session)) return 'Los saltos se usan solo en recorridos externos A o B.';
    if (session.estado === 'cerrada') return 'La sesión está cerrada. No se registran saltos.';
    if (session.estado !== 'en_recorrido') return 'Vuelve al recorrido para habilitar el salto correspondiente.';
    if (id === 'salto_3d') {
      const e4 = M.stagesFor(bank, session).find(stage => stage.id === 'E4');
      if (!e4 || !stageIsComplete(session, e4)) return 'Completa y registra E4 antes de este salto.';
      if (!phaseIsComplete(session, 'pausa2')) return 'Abre y termina la pausa de propuesta antes de este salto.';
      return 'Salto disponible.';
    }
    if (!jumpEvent(session, 'salto_3d')) return 'Primero registra el salto de tres días.';
    const e6 = M.stagesFor(bank, session).find(stage => stage.id === 'E6');
    if (!e6 || !stageIsComplete(session, e6)) return 'Completa y registra E6 antes de este salto.';
    return 'Salto disponible.';
  }

  function updateEmptyJumpNotice(session) {
    const empty = $('#time-jumps-empty');
    const copy = $('#time-jumps-empty-copy');
    if (!empty || !copy) return;
    const externalActive = isExternalSession(session) && session.estado !== 'cerrada';
    empty.hidden = externalActive;
    if (!session) copy.textContent = 'No hay una sesión externa activa. Prepara un camino A o B para habilitar los saltos cuando corresponda.';
    else if (session.estado === 'cerrada') copy.textContent = 'La sesión está cerrada. Prepara otra sesión externa para habilitar los saltos.';
    else copy.textContent = 'Los saltos no están disponibles en sesiones internas. Elige un camino A o B para usarlos.';
  }

  function humanStatus(session) {
    if (session.estado === 'cerrada') return 'Cerrada';
    if (['en_recorrido', 'pausa1_abierta', 'pausa2_abierta', 'pausa_c_abierta', 'final_abierto'].includes(session.estado)) return 'En recorrido';
    return 'Preparada';
  }

  function showSession(session) {
    activeSession = session;
    panel.hidden = false;
    const internal = ['ventas', 'marketing', 'jefatura'].includes(session.rol);
    const stageList = M.stagesFor(bank, session);
    const pathText = session.camino === 'C-encadenada' ? 'C · encadenada' : session.camino;
    $('#console-status').textContent = humanStatus(session);
    $('#console-summary').innerHTML = [
      ['Participante', session.participante], ['Camino', pathText], ['Rol', roleLabels[session.rol] || 'Participante externo'],
      ['Perfil', profileLabels[session.perfil] || 'Sin perfil'], ['Inicio', session.inicio ? new Date(session.inicio).toLocaleString('es-CL') : '—'],
      ['Etapas', stageList.length + ' · ' + (internal ? 'tareas del rol' : 'recorrido externo')], ['Vínculo', session.sesion_origen ? 'Lead de sesión externa anterior' : 'Sin vínculo encadenado'],
      ['SUS', session.sus_completo ? session.sus_score + '/100' : 'Pendiente']
    ].map(([label, value]) => '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>').join('');
    updateEmptyJumpNotice(session);
    renderConsoleActions(session, stageList);
    renderStages(session, stageList);
  }
  function readStage(session, id) {
    const row = M.readAnswers().find(item => item.sesion_id === session.id && item.momento === 'etapa' && item.etapa === id && item.pregunta_id === 'registro_etapa');
    return row ? M.stageRow(row) : null;
  }

  function stageIsComplete(session, stage) {
    const record = readStage(session, stage.id);
    return Boolean(record?.empezo_en && record?.termino_en && record?.resultado && Number(record.seq) >= 1 && Number(record.seq) <= 7 && record.errores !== '' && Number.isFinite(Number(record.errores)) && Number(record.errores) >= 0);
  }

  function saveStage(session, stage, record) {
    const current = M.readActive();
    if (current?.id === session?.id) { session = current; activeSession = current; }
    const start = record.empezo_en ? new Date(record.empezo_en).getTime() : 0;
    const end = record.termino_en ? new Date(record.termino_en).getTime() : 0;
    record.ms_respuesta = start && end >= start ? end - start : 0;
    M.saveAnswer(session, {
      momento: 'etapa', etapa: stage.id, pregunta_id: 'registro_etapa', tipo: 'etapa',
      respuesta: JSON.stringify(record), respuesta_texto: [record.resultado, record.seq ? `SEQ ${record.seq}` : '', record.nota].filter(Boolean).join(' · '),
      omitida: false, ms_respuesta: record.ms_respuesta
    });
    refreshTimeJumpCards(session);
  }

  function makeSeqControl(stage, value, record) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'mc-seq';
    fieldset.innerHTML = `<legend>SEQ · facilidad de la tarea</legend><p class="mc-muted mc-seq__ends"><span>1 · Muy difícil</span><span>7 · Muy fácil</span></p><div class="mc-seq__scale"></div>`;
    const scale = $('.mc-seq__scale', fieldset);
    for (let n = 1; n <= 7; n += 1) {
      const label = document.createElement('label');
      label.className = 'mc-seq__option';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = `seq-${stage.id}`; input.value = String(n); input.checked = Number(value) === n;
      input.setAttribute('aria-label', `${n} de 7`);
      label.append(input, document.createTextNode(String(n)));
      input.addEventListener('change', () => { record.seq = n; saveStage(activeSession, stage, record); refreshStageSummary(activeSession); renderConsoleActions(activeSession, M.stagesFor(bank, activeSession)); refreshPauseButtons(activeSession); });
      scale.append(label);
    }
    return fieldset;
  }

  function stageStartGateCopy(session, stageId) {
    if (!isExternalSession(session)) return '';
    if (stageId === 'E5' && !jumpEvent(session, 'salto_3d')) return 'Registra el salto de tres días de la tarjeta anterior antes de empezar.';
    if (stageId === 'E7' && !jumpEvent(session, 'salto_30d')) return 'Registra el salto de un mes de la tarjeta anterior antes de empezar.';
    return '';
  }

  function makeTimeJumpCard(session, id) {
    const item = timeJumpCards[id];
    const card = document.createElement('section');
    card.className = 'mc-timejump-card';
    card.dataset.timejumpCard = id;
    card.id = 'timejump-' + id;
    const top = document.createElement('div');
    top.className = 'mc-timejump-card__top';
    const series = document.createElement('span');
    series.textContent = item.series + ' · antes de ' + item.before;
    const brand = document.createElement('strong');
    brand.textContent = 'Marley Coffee · Empresas';
    top.append(series, brand);
    const word = document.createElement('h3');
    word.className = 'mc-timejump-card__word';
    word.textContent = item.word;
    const instruction = document.createElement('p');
    instruction.className = 'mc-timejump-card__instruction';
    instruction.textContent = item.instruction;
    const note = document.createElement('p');
    note.className = 'mc-timejump-card__note';
    note.textContent = item.note;
    const state = document.createElement('p');
    state.className = 'mc-timejump-card__status';
    state.id = 'timejump-status-' + id;
    state.setAttribute('role', 'status');
    const signature = document.createElement('div');
    signature.className = 'mc-timejump-card__signature';
    signature.setAttribute('aria-hidden', 'true');
    card.append(top, word, instruction, note, state, signature);
    if (item.button) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.type = 'button';
      button.dataset.timejump = id;
      button.dataset.days = String(item.dias);
      button.textContent = item.button;
      button.setAttribute('aria-describedby', state.id);
      card.append(button);
    } else {
      state.textContent = 'Recordatorio: lee la tarjeta impresa antes de continuar.';
    }
    refreshTimeJumpCard(session, card);
    return card;
  }

  function refreshTimeJumpCard(session, card) {
    const id = card.dataset.timejumpCard;
    const item = timeJumpCards[id];
    const state = $('.mc-timejump-card__status', card);
    const button = $('[data-timejump]', card);
    if (!button) return;
    const alreadyRecorded = Boolean(jumpEvent(session, id));
    const enabled = timeJumpReady(session, id) && !alreadyRecorded;
    button.disabled = !enabled;
    button.title = alreadyRecorded ? 'Este salto ya quedó registrado.' : jumpGateCopy(session, id);
    card.dataset.enabled = enabled ? 'true' : 'false';
    state.textContent = alreadyRecorded ? 'Salto registrado. La etapa siguiente ya está habilitada.' : jumpGateCopy(session, id);
  }

  function refreshTimeJumpCards(session) {
    $$('[data-timejump-card]').forEach(card => refreshTimeJumpCard(session, card));
  }

  function recordTimeJump(id) {
    const item = timeJumpCards[id];
    const current = M.readActive();
    if (!item || !current || current.id !== activeSession?.id || !isExternalSession(current) || current.estado !== 'en_recorrido') {
      say('No hay una sesión externa activa para registrar este salto.', 'error');
      if (current) showSession(current);
      return;
    }
    if (!timeJumpReady(current, id) || jumpEvent(current, id)) {
      say(jumpGateCopy(current, id), 'error');
      showSession(current);
      return;
    }
    const payload = {
      dias: item.dias,
      sesion_id: current.id,
      at: Date.now(),
      nonce: window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    };
    localStorage.setItem('mc_prueba_salto_v1', JSON.stringify(payload));
    M.saveAnswer(current, {
      momento: 'etapa',
      etapa: item.etapa,
      pregunta_id: id,
      tipo: 'evento',
      respuesta: JSON.stringify(payload),
      respuesta_texto: item.dias === 3 ? 'Salto de tiempo: 3 días después' : 'Salto de tiempo: un mes después',
      otra_texto: '',
      omitida: false,
      ms_respuesta: 0
    });
    showSession(M.readActive());
    say(item.dias === 3 ? 'Salto de 3 días enviado y registrado para esta sesión.' : 'Salto de un mes enviado y registrado para esta sesión.', 'ok');
  }
  function renderStages(session, stages) {
    const holder = $('#console-stages');
    holder.replaceChildren();
    const readOnly = session.estado === 'cerrada';
    for (const [index, stage] of stages.entries()) {
      const jumpBefore = { E5: 'salto_3d', E6: 'decision_tomada', E7: 'salto_30d', E9: 'caso_resuelto' }[stage.id];
      if (jumpBefore && isExternalSession(session) && session.estado !== 'cerrada') holder.append(makeTimeJumpCard(session, jumpBefore));
      const record = readStage(session, stage.id) || { etapa: stage.id, titulo: stage.titulo, empezo_en: '', termino_en: '', resultado: '', seq: '', errores: '', nota: '', ms_respuesta: 0 };
      const article = document.createElement('article');
      article.className = 'mc-stage';
      article.id = `stage-${stage.id}`;
      article.innerHTML = `<div><span class="mc-chip">${escapeHtml(stage.id)}</span><h3>${escapeHtml(stage.titulo)}</h3><p>${escapeHtml(stage.texto || 'Registra lo observado durante esta etapa.')}</p><div class="mc-stage__meta"><span>Empezó: ${record.empezo_en ? new Date(record.empezo_en).toLocaleTimeString('es-CL') : '—'}</span><span>Terminó: ${record.termino_en ? new Date(record.termino_en).toLocaleTimeString('es-CL') : '—'}</span></div></div><div class="mc-stage__body"><div class="mc-stage__actions"><button class="btn" type="button" data-stage-start="${escapeHtml(stage.id)}" ${readOnly || record.empezo_en ? 'disabled' : ''}>Empezó</button><button class="btn" type="button" data-stage-end="${escapeHtml(stage.id)}" ${readOnly || !record.empezo_en || record.termino_en ? 'disabled' : ''}>Terminó</button><span class="mc-chip" data-stage-time>${record.ms_respuesta ? `${Math.round(record.ms_respuesta / 1000)} s` : 'Sin tiempo'}</span></div><div class="mc-stage__form" ${record.termino_en && !readOnly ? '' : 'hidden'}><label class="mc-field">Resultado<select class="mc-select" data-stage-result><option value="">Elige un resultado</option><option>Logrado</option><option>Con ayuda</option><option>No logrado</option></select></label><label class="mc-field">Errores<input class="mc-input" data-stage-errors type="number" min="0" step="1" inputmode="numeric" placeholder="0" required></label><label class="mc-field mc-field--wide">Nota de observación<textarea class="mc-textarea" data-stage-note maxlength="1000" placeholder="Describe solo lo que observaste; evita nombres y datos de contacto."></textarea></label></div></div>`;
      const form = $('.mc-stage__form', article);
      const result = $('[data-stage-result]', article); if (result) result.value = record.resultado || '';
      const errors = $('[data-stage-errors]', article); if (errors) errors.value = record.errores ?? '';
      const note = $('[data-stage-note]', article); if (note) note.value = record.nota || '';
      const startButton = $('[data-stage-start]', article);
      const endButton = $('[data-stage-end]', article);
      const startGate = stageStartGateCopy(session, stage.id);
      if (startButton) {
        startButton.disabled = readOnly || Boolean(record.empezo_en) || Boolean(startGate);
        if (startGate) {
          startButton.title = startGate;
          const gateNote = document.createElement('p');
          gateNote.className = 'mc-note';
          gateNote.textContent = startGate;
          article.firstElementChild.append(gateNote);
        }
      }
      startButton?.addEventListener('click', () => {
        record.empezo_en = new Date().toISOString();
        saveStage(activeSession, stage, record);
        renderStages(activeSession, stages);
        refreshStageSummary(activeSession);
      });
      endButton?.addEventListener('click', () => {
        record.termino_en = new Date().toISOString();
        saveStage(activeSession, stage, record);
        renderStages(activeSession, stages);
        refreshStageSummary(activeSession);
      });
      if (record.termino_en) form?.append(makeSeqControl(stage, record.seq, record));
      const persistField = () => {
        if (!record.termino_en) return;
        record.resultado = result?.value || '';
        record.errores = errors?.value === '' ? '' : Number(errors.value);
        record.nota = note?.value || '';
        saveStage(activeSession, stage, record);
        refreshStageSummary(activeSession);
        renderConsoleActions(activeSession, stages);
        refreshPauseButtons(activeSession);
      };
      result?.addEventListener('change', persistField);
      errors?.addEventListener('input', persistField);
      note?.addEventListener('input', persistField);
      holder.append(article);
      const pausePhase = !['ventas', 'marketing', 'jefatura'].includes(session.rol)
        ? ({ E2: 'pausa1', E4: 'pausa2' })[stage.id]
        : index === 0 ? 'pausa_c' : '';
      if (pausePhase) holder.append(makePauseCard(session, pausePhase, stage.id, stageIsComplete(session, stage)));
    }
    refreshStageSummary(session);
    refreshTimeJumpCards(session);
  }

  function makePauseCard(session, phase, stageId, enabled) {
    const card = document.createElement('section');
    card.className = 'mc-pause-card';
    const label = { pausa1: 'Pausa 1 · llegada', pausa2: 'Pausa 2 · contacto y propuesta', pausa_c: 'Pausa C · origen del contacto' }[phase];
    card.dataset.stageAfter = stageId;
    card.innerHTML = `<div><strong>${escapeHtml(label)}</strong><span>Después de ${escapeHtml(stageId)}</span></div><button class="btn" type="button" data-open-phase="${phase}" ${enabled ? '' : 'disabled'}>Abrir cuestionario</button>`;
    $('[data-open-phase]', card).addEventListener('click', event => openPhase(event.currentTarget.dataset.openPhase, session));
    return card;
  }

  function refreshPauseButtons(session) {
    if (!session) return;
    $$('.mc-pause-card').forEach(card => {
      const stage = M.stagesFor(bank, session).find(item => item.id === card.dataset.stageAfter);
      const button = $('[data-open-phase]', card);
      if (stage && button) button.disabled = !stageIsComplete(session, stage);
    });
  }

  function renderConsoleActions(session, stages) {
    const holder = $('#console-actions');
    holder.replaceChildren();
    const internal = ['ventas', 'marketing', 'jefatura'].includes(session.rol);
    const complete = stages.every(stage => stageIsComplete(session, stage));
    const action = document.createElement('div');
    action.className = 'mc-row';
    if (session.estado === 'cerrada') {
      const thanks = document.createElement('p');
      thanks.className = 'mc-note mc-note--success';
      thanks.textContent = `Sesión cerrada. Puntaje SUS: ${session.sus_completo ? `${session.sus_score}/100` : 'incompleto'}. Siguiente código sugerido: ${M.nextParticipant(session.participante)}.`;
      holder.append(thanks); return;
    }
    if (session.estado === 'preparada') {
      const reopen = document.createElement('button');
      reopen.className = 'btn'; reopen.type = 'button'; reopen.textContent = 'Abrir bienvenida en otra pestaña';
      reopen.addEventListener('click', () => openPhase('inicial', session));
      action.append(reopen);
    }
    if (complete) {
      const final = document.createElement('button');
      final.className = 'btn btn--primary'; final.type = 'button'; final.textContent = 'Abrir cuestionario final';
      final.addEventListener('click', () => openPhase('final', session));
      action.append(final);
    } else {
      const remaining = stages.filter(stage => !stageIsComplete(session, stage)).length;
      const note = document.createElement('p'); note.className = 'mc-note'; note.textContent = `Quedan ${remaining} ${internal ? 'tareas' : 'etapas'} por registrar antes del cierre.`; action.append(note);
    }
    holder.append(action);
  }

  function refreshStageSummary(session) {
    const body = $('#console-stage-summary');
    if (!body || !session) return;
    body.replaceChildren();
    const stages = M.stagesFor(bank, session);
    for (const stage of stages) {
      const record = readStage(session, stage.id);
      const tr = document.createElement('tr');
      const cells = [stage.id, record?.resultado || 'Pendiente', record?.ms_respuesta ? `${Math.round(record.ms_respuesta / 1000)} s` : '—', record?.errores ?? '—', record?.seq || '—', record?.nota || '—'];
      cells.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
      body.append(tr);
    }
  }

  function openPhase(phase, session) {
    const child = window.open('', '_blank');
    if (!child) { say('El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para abrir el cuestionario.', 'error'); return; }
    const url = new URL('sesion.html', location.href);
    url.searchParams.set('fase', phase); url.searchParams.set('mc_session', session.id);
    const state = phase === 'final' ? 'final_abierto' : phase === 'inicial' ? session.estado : `${phase}_abierta`;
    activeSession = M.updateActive({ estado: state });
    child.location.href = url.href;
    say(`Cuestionario ${phaseName(phase)} abierto en otra pestaña.`, 'ok');
    showSession(activeSession);
  }

  function phaseName(phase) { return ({ inicial: 'inicial', pausa1: 'Pausa 1', pausa2: 'Pausa 2', pausa_c: 'Pausa C', final: 'final' })[phase] || phase; }

  async function prepareSession(path, role) {
    if (!isLocal()) throw new Error('Abre esta página desde localhost.');
    const external = path !== 'C';
    const profileValue = profile.value;
    if (external && !/^P[1-5]$/.test(participant.value)) throw new Error('Elige un participante externo P1–P5.');
    if (networkProfiles[path] && !networkProfiles[path].includes(profileValue)) {
      throw new Error(path === 'B-Meta' ? 'Meta admite restaurante, cafetería, panadería o conveniencia.' : 'LinkedIn admite hotel, oficina o eventos.');
    }
    const previous = M.readActive();
    const chained = path === 'C' && relay.checked;
    let sourceId = '';
    let carried = '';
    if (chained) {
      if (!previous || !/^P[1-5]$/.test(previous.participante) || !/^(A|B-)/.test(previous.camino)) throw new Error('La sesión anterior no es una sesión externa de esta ronda.');
      sourceId = previous.id;
      carried = carryLead();
      if (!carried) return;
    } else resetPrototypeData();

    const camino = chained ? 'C-encadenada' : path;
    const roleCode = external ? participant.value : roles[role];
    const id = `MC-${roleCode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = String(Date.now());
    const target = makeTarget(path, role, id, startedAt, camino);
    if (chained) target.searchParams.set('encadenada', '1');
    const session = {
      id, participante: roleCode, camino, rol: external ? 'externo' : role,
      perfil: external ? profileValue : 'interno', destino: target.href,
      inicio: new Date().toISOString(), estado: 'preparada', sesion_origen: sourceId,
      version_banco: M.VERSION
    };
    M.setActive(session);
    const child = window.open('', '_blank');
    if (!child) {
      showSession(session);
      say('La sesión quedó preparada, pero el navegador bloqueó la pestaña nueva. Usa «Abrir bienvenida en otra pestaña».', 'error');
      return;
    }
    const welcome = new URL('sesion.html', location.href);
    welcome.searchParams.set('fase', 'inicial'); welcome.searchParams.set('mc_session', id);
    child.location.href = welcome.href;
    showSession(session);
    say(chained ? `Sesión encadenada preparada; lead ficticio de ${carried} conservado.` : `Sesión ${path} preparada; datos del prototipo reiniciados y respuestas conservadas.`, 'ok');
  }

  participant.addEventListener('change', () => { if (assigned[participant.value]) profile.value = assigned[participant.value]; });
  $('#reset').addEventListener('click', () => {
    try {
      const cleared = resetPrototypeData();
      const count = M.readAnswers().length;
      say(`Datos del prototipo reiniciados (${cleared}). Se conservan ${count} respuestas y las sesiones de investigación.`, 'ok');
    } catch (error) { say(error.message, 'error'); }
  });
  $$('[data-route]').forEach(button => button.addEventListener('click', () => {
    prepareSession(button.dataset.route, button.dataset.role || '').catch(error => say(error.message, 'error'));
  }));
  $('#console-stages').addEventListener('click', event => {
    const button = event.target.closest('[data-timejump]');
    if (button) recordTimeJump(button.dataset.timejump);
  });
  window.addEventListener('storage', event => {
    if (!event.key?.startsWith('mc_prueba_') || !bank) return;
    const next = M.readActive();
    if (next?.id === activeSession?.id) showSession(next);
  });

  M.loadBank().then(data => {
    bank = data;
    const current = M.readActive();
    if (current) showSession(current);
    if (!isLocal()) say('Modo bloqueado: esta consola solo prepara sesiones y limpia datos desde localhost.', 'error');
  }).catch(error => say(error.message, 'error'));
})();
