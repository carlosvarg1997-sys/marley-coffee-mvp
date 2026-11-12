(() => {
  'use strict';
  const KEY = Object.freeze({ active: 'mc_prueba_sesion_actual_v1', answers: 'mc_prueba_respuestas_v1', sessions: 'mc_prueba_sesiones_v1' });
  const VERSION = '2026-11-11-v1';
  const CSV_COLUMNS = Object.freeze(['sesion_id','sesion_origen','participante','camino','rol','perfil','momento','etapa','pregunta_id','tipo','respuesta','respuesta_texto','otra_texto','omitida','ms_respuesta','guardado_en','version_banco']);
  const PLANILLA_COLUMNS = Object.freeze(['participante','camino','rol','perfil','tarea','exito_sin_ayuda','tiempo_s','errores','primer_clic','SEQ_1a7','comentarios','toques_sin_respuesta','toques_totales','datos_iniciales_s','fecha','version','observador','sesion_id']);
  const safeRead = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch (_) { return fallback; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.error('No se pudo guardar la sesión de prueba:', error); return false; } };
  const uuid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : `MC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const readActive = () => safeRead(KEY.active, null);
  const readAnswers = () => { const value = safeRead(KEY.answers, []); return Array.isArray(value) ? value : []; };
  const readSessions = () => { const value = safeRead(KEY.sessions, []); return Array.isArray(value) ? value : []; };
  const upsertSession = (session) => {
    if (!session?.id) return false;
    const archive = readSessions();
    const i = archive.findIndex(item => item.id === session.id);
    const next = { ...(i >= 0 ? archive[i] : {}), ...session };
    if (i >= 0) archive[i] = next; else archive.push(next);
    safeWrite(KEY.sessions, archive);
    if (readActive()?.id === session.id) safeWrite(KEY.active, next);
    return true;
  };
  const setActive = (session) => { safeWrite(KEY.active, session); upsertSession(session); return session; };
  const updateActive = (patch) => {
    const current = readActive();
    if (!current?.id) return null;
    const next = { ...current, ...patch, actualizado_en: new Date().toISOString() };
    setActive(next);
    return next;
  };
  const loadBank = async () => {
    const url = new URL('preguntas.json', location.href);
    if (url.origin !== location.origin) throw new Error('El banco debe cargarse desde este mismo origen.');
    const response = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo abrir preguntas.json (${response.status}).`);
    const bank = await response.json();
    if (bank.version !== VERSION || !bank.preguntas || !bank.fases) throw new Error('La versión o la estructura del banco no coincide.');
    return bank;
  };
  const personType = (session) => ['ventas','marketing','jefatura'].includes(session?.rol) ? 'internos' : 'externos';
  const phaseQuestions = (bank, phase, session) => {
    const list = bank?.fases?.[phase];
    if (!list) return [];
    const ids = Array.isArray(list) ? list : list[personType(session)];
    return (ids || []).map(id => ({ id, ...bank.preguntas[id] })).filter(item => item.tipo);
  };
  const stagesFor = (bank, session) => ['ventas','marketing','jefatura'].includes(session?.rol)
    ? (bank.etapas.internos[session.rol] || [])
    : (bank.etapas.externos || []);
  const responseKey = (row) => [row.sesion_id,row.momento,row.etapa,row.pregunta_id].join('|');
  const REMOTE_PATHS = new Set(['A','B-Meta','B-LinkedIn','B-Google','C']);
  const REMOTE_ROLES = new Set(['externo','ventas','marketing','jefatura']);
  const REMOTE_PROFILES = new Set(['restaurante','hotel','cafeteria','oficina','eventos','panaderia','conveniencia','interno']);
  const REMOTE_PHASES = new Set(['inicial','pausa1','pausa2','pausa_c','final','salto_3d','salto_30d']);
  const REMOTE_MOMENTS = new Set(['inicial','pausa1','pausa2','pausa_c','final','etapa']);
  const safeRemoteSession = (raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^MC-(?:P[1-5]|I[1-3])-[a-z0-9-]{6,48}$/i.test(raw.id)) throw new Error('El código de sesión no es válido.');
    if (!REMOTE_PATHS.has(raw.camino) || !REMOTE_ROLES.has(raw.rol) || !REMOTE_PROFILES.has(raw.perfil) || raw.modo !== 'remoto') throw new Error('La sesión no corresponde a un camino remoto permitido.');
    if (raw.rol === 'externo' ? !/^P[1-5]$/.test(raw.participante) || raw.camino === 'C' || raw.perfil === 'interno' : raw.camino !== 'C' || !/^I[1-3]$/.test(raw.participante) || raw.perfil !== 'interno') throw new Error('El participante, el camino y el perfil no coinciden.');
    if (raw.camino === 'B-Meta' && !['restaurante','cafeteria','panaderia','conveniencia'].includes(raw.perfil)) throw new Error('El perfil no corresponde al camino de Meta.');
    if (raw.camino === 'B-LinkedIn' && !['hotel','oficina','eventos'].includes(raw.perfil)) throw new Error('El perfil no corresponde al camino de LinkedIn.');
    if (raw.id !== `MC-${raw.participante}-${raw.id.split('-').slice(2).join('-')}`) throw new Error('El código de sesión no coincide con el participante.');
    const expectedRole = { I1:'ventas', I2:'marketing', I3:'jefatura' }[raw.participante];
    if (expectedRole && raw.rol !== expectedRole) throw new Error('El rol no coincide con el código de participante.');
    if (raw.version_banco !== VERSION) throw new Error('La sesión usa una versión distinta del banco de preguntas.');
    const allowedStates = new Set(['preparada','en_recorrido','consentimiento_aceptado','inicial_completo','cerrada']);
    if (!allowedStates.has(raw.estado)) throw new Error('El estado de la sesión no es válido.');
    const session = {
      id: raw.id, participante: raw.participante, camino: raw.camino, rol: raw.rol, perfil: raw.perfil,
      modo: 'remoto', estado: raw.estado, destino: typeof raw.destino === 'string' ? raw.destino.slice(0,3000) : '',
      inicio: typeof raw.inicio === 'string' ? raw.inicio.slice(0,40) : '',
      sesion_origen: '', version_banco: VERSION,
      fases_hechas: Array.isArray(raw.fases_hechas) ? [...new Set(raw.fases_hechas.filter(value => REMOTE_PHASES.has(value)))].slice(0,7) : []
    };
    ['consentimiento_en','recorrido_iniciado_en','ultima_pausa_en','cerrada_en','actualizado_en'].forEach(key => { if (typeof raw[key] === 'string' && raw[key].length <= 40) session[key] = raw[key]; });
    if (typeof raw.ultima_pausa === 'string' && ['pausa1','pausa2','pausa_c'].includes(raw.ultima_pausa)) session.ultima_pausa = raw.ultima_pausa;
    if (Number.isFinite(Number(raw.sus_score)) && Number(raw.sus_score) >= 0 && Number(raw.sus_score) <= 100) session.sus_score = Number(raw.sus_score);
    if (typeof raw.sus_completo === 'boolean') session.sus_completo = raw.sus_completo;
    return session;
  };
  const safeRemoteResponse = (raw, session) => {
    if (!raw || typeof raw !== 'object' || raw.sesion_id !== session.id || raw.version_banco !== VERSION) throw new Error('Hay una respuesta con código o versión distintos.');
    if (!REMOTE_MOMENTS.has(raw.momento) || typeof raw.etapa !== 'string' || raw.etapa.length > 32 || !/^[a-z0-9_-]{1,80}$/i.test(raw.pregunta_id || '') || typeof raw.tipo !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(raw.tipo)) throw new Error('Hay una respuesta con campos inválidos.');
    if (raw.participante !== session.participante || raw.camino !== session.camino || raw.rol !== session.rol || raw.perfil !== session.perfil) throw new Error('Los metadatos de una respuesta no coinciden con la sesión.');
    if (raw.respuesta !== null && !['string','number','boolean'].includes(typeof raw.respuesta) && !Array.isArray(raw.respuesta)) throw new Error('El valor de una respuesta tiene un formato no permitido.');
    if (Array.isArray(raw.respuesta) && (raw.respuesta.length > 40 || raw.respuesta.some(value => typeof value !== 'string' || value.length > 500))) throw new Error('Una respuesta múltiple excede el formato permitido.');
    if (typeof raw.respuesta === 'string' && raw.respuesta.length > 10000) throw new Error('Una respuesta supera el límite permitido.');
    if (typeof raw.respuesta_texto !== 'string' || raw.respuesta_texto.length > 10000 || typeof raw.otra_texto !== 'string' || raw.otra_texto.length > 1000) throw new Error('El texto de una respuesta tiene un formato no permitido.');
    if (typeof raw.omitida !== 'boolean' || !Number.isFinite(Number(raw.ms_respuesta)) || Number(raw.ms_respuesta) < 0 || typeof raw.guardado_en !== 'string' || !Number.isFinite(Date.parse(raw.guardado_en))) throw new Error('Una respuesta no tiene fecha o tiempo válidos.');
    const row = {};
    CSV_COLUMNS.forEach(key => { row[key] = raw[key] ?? (key === 'sesion_origen' || key === 'etapa' || key === 'otra_texto' || key === 'respuesta_texto' ? '' : ''); });
    row.sesion_origen = '';
    row.ms_respuesta = Number(raw.ms_respuesta);
    row.omitida = raw.omitida;
    return row;
  };
  const validateRemotePackage = (raw) => {
    if (!raw || typeof raw !== 'object' || raw.version_banco !== VERSION) throw new Error(`El archivo debe usar el banco ${VERSION}.`);
    const session = safeRemoteSession(raw.sesion);
    if (!Array.isArray(raw.respuestas) || raw.respuestas.length > 1000) throw new Error('El paquete no contiene una lista de respuestas válida.');
    const responses = raw.respuestas.map(row => safeRemoteResponse(row, session));
    return { version_banco: VERSION, sesion: session, respuestas: responses };
  };
  const remotePackage = (sessionId) => {
    const session = readActive()?.id === sessionId ? readActive() : readSessions().find(item => item.id === sessionId);
    if (!session || session.modo !== 'remoto') throw new Error('No existe esa sesión remota en este navegador.');
    return validateRemotePackage({ version_banco: VERSION, sesion: session, respuestas: readAnswers().filter(row => row.sesion_id === sessionId) });
  };
  const encodeRemoteText = (data) => {
    const bytes = new TextEncoder().encode(JSON.stringify(validateRemotePackage(data)));
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const encoded = btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return `MC-PRUEBA v1\n${encoded}`;
  };
  const decodeRemoteText = (source) => {
    const text = String(source ?? '').replace(/^\uFEFF/,'').trim();
    if (text.startsWith('MC-PRUEBA v1\n') || text.startsWith('MC-PRUEBA v1\r\n')) {
      const lines = text.split(/\r?\n/);
      if (lines.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(lines[1])) throw new Error('El texto debe tener el encabezado y una sola línea codificada.');
      const base64 = lines[1].replace(/-/g,'+').replace(/_/g,'/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return validateRemotePackage(JSON.parse(new TextDecoder().decode(bytes)));
    }
    try { return validateRemotePackage(JSON.parse(text)); }
    catch (error) { if (error instanceof SyntaxError) throw new Error('Pega un texto MC-PRUEBA v1 o el archivo JSON exportado desde la sesión.'); throw error; }
  };
  const mergeRemotePackage = (raw) => {
    const incoming = validateRemotePackage(raw);
    const oldAnswers = localStorage.getItem(KEY.answers);
    const oldSessions = localStorage.getItem(KEY.sessions);
    const oldActive = localStorage.getItem(KEY.active);
    const currentAnswers = readAnswers();
    const rows = new Map(currentAnswers.map(row => [responseKey(row), row]));
    let added = 0, replaced = 0, kept = 0;
    for (const row of incoming.respuestas) {
      const key = responseKey(row);
      const old = rows.get(key);
      if (!old) { rows.set(key,row); added += 1; continue; }
      const oldTime = Date.parse(old.guardado_en) || 0;
      const newTime = Date.parse(row.guardado_en) || 0;
      if (newTime >= oldTime) { rows.set(key,row); replaced += 1; } else kept += 1;
    }
    const archive = readSessions();
    const index = archive.findIndex(session => session.id === incoming.sesion.id);
    const oldSession = index >= 0 ? archive[index] : {};
    const mergedSession = { ...oldSession, ...incoming.sesion, fases_hechas: [...new Set([...(oldSession.fases_hechas || []), ...(incoming.sesion.fases_hechas || [])])] };
    if (index >= 0) archive[index] = mergedSession; else archive.push(mergedSession);
    try {
      localStorage.setItem(KEY.answers,JSON.stringify([...rows.values()]));
      localStorage.setItem(KEY.sessions,JSON.stringify(archive));
      if (readActive()?.id === mergedSession.id) localStorage.setItem(KEY.active,JSON.stringify(mergedSession));
    } catch (error) {
      [[KEY.answers,oldAnswers],[KEY.sessions,oldSessions],[KEY.active,oldActive]].forEach(([key,value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key,value); } catch (_) {} });
      throw new Error('No se pudieron guardar las respuestas importadas en este navegador.');
    }
    window.dispatchEvent(new CustomEvent('mc-prueba-change',{detail:{kind:'import',session:mergedSession}}));
    return { sesiones: 1, respuestas: incoming.respuestas.length, agregadas: added, reemplazadas: replaced, conservadas: kept, sesion: mergedSession };
  };
  const saveAnswer = (session, answer) => {
    if (!session?.id) throw new Error('No hay una sesión activa.');
    const row = {
      sesion_id: session.id,
      sesion_origen: session.sesion_origen || '',
      participante: session.participante || '',
      camino: session.camino || '',
      rol: session.rol || '',
      perfil: session.perfil || '',
      momento: answer.momento || '',
      etapa: answer.etapa || '',
      pregunta_id: answer.pregunta_id || '',
      tipo: answer.tipo || '',
      respuesta: answer.respuesta ?? '',
      respuesta_texto: answer.respuesta_texto ?? '',
      otra_texto: answer.otra_texto || '',
      omitida: Boolean(answer.omitida),
      ms_respuesta: Math.max(0, Number(answer.ms_respuesta) || 0),
      guardado_en: new Date().toISOString(),
      version_banco: session.version_banco || VERSION
    };
    const rows = readAnswers();
    const key = responseKey(row);
    const i = rows.findIndex(item => responseKey(item) === key);
    if (i >= 0) rows[i] = row; else rows.push(row);
    if (!safeWrite(KEY.answers, rows)) throw new Error('El navegador no pudo guardar esta respuesta.');
    upsertSession(session);
    window.dispatchEvent(new CustomEvent('mc-prueba-change', { detail: { kind: 'answer', row } }));
    return row;
  };
  const susScore = (values) => {
    if (!Array.isArray(values) || values.length !== 10 || values.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) return null;
    const total = values.reduce((sum, raw, index) => sum + (index % 2 === 0 ? Number(raw) - 1 : 5 - Number(raw)), 0);
    return Number((total * 2.5).toFixed(2));
  };
  // UMUX-Lite (2 ítems de acuerdo 1–5) → 0–100. Reemplaza al SUS desde el 11-nov; el SUS queda para sesiones antiguas.
  const umuxScore = (values) => {
    if (!Array.isArray(values) || values.length !== 2 || values.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) return null;
    return Number((((Number(values[0]) - 1) + (Number(values[1]) - 1)) / 8 * 100).toFixed(2));
  };
  const susForSession = (sessionId, rows = readAnswers()) => {
    const mine = rows.filter(row => row.sesion_id === sessionId && !row.omitida);
    const umux = new Map(mine.filter(row => /^umux_[12]$/.test(row.pregunta_id)).map(row => [row.pregunta_id, Number(row.respuesta)]));
    if (umux.size || rows.some(row => row.sesion_id === sessionId && /^umux_[12]$/.test(row.pregunta_id))) return umuxScore([umux.get('umux_1'), umux.get('umux_2')]);
    const map = new Map(mine.filter(row => /^sus_(?:[1-9]|10)$/.test(row.pregunta_id)).map(row => [row.pregunta_id, Number(row.respuesta)]));
    return susScore(Array.from({ length: 10 }, (_, i) => map.get(`sus_${i + 1}`)));
  };
  const finishSession = (session) => {
    const score = susForSession(session.id);
    const next = { ...session, estado: 'cerrada', cerrada_en: new Date().toISOString(), sus_score: score, sus_completo: score !== null };
    setActive(next);
    window.dispatchEvent(new CustomEvent('mc-prueba-change', { detail: { kind: 'session', session: next } }));
    return next;
  };
  const csvValue = (value) => {
    let text = Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : String(value ?? '');
    if (/^\s*[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"','""').replace(/\r?\n/g,' ')}"`;
  };
  const csvText = (rows, columns = CSV_COLUMNS) => '\uFEFF' + [columns.map(csvValue).join(','), ...rows.map(row => columns.map(key => csvValue(row[key])).join(','))].join('\r\n');
  const download = (filename, content, type = 'text/csv;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.hidden = true;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const stageRow = (row) => {
    if (row.momento !== 'etapa' || row.pregunta_id !== 'registro_etapa') return null;
    try { return typeof row.respuesta === 'string' ? JSON.parse(row.respuesta) : row.respuesta; } catch (_) { return null; }
  };
  const summaryRows = (sessions = readSessions(), rows = readAnswers()) => sessions.map(session => {
    const stageRows = rows.filter(row => row.sesion_id === session.id && row.momento === 'etapa');
    const stages = stageRows.map(stageRow).filter(Boolean);
    const validSeq = stages.map(stage => Number(stage.seq)).filter(value => value >= 1 && value <= 7);
    const times = stages.map(stage => Number(stage.ms_respuesta)).filter(value => value >= 0);
    const successes = stages.filter(stage => stage.resultado === 'Logrado').length;
    const notes = rows.filter(row => row.sesion_id === session.id && row.respuesta_texto && row.momento !== 'etapa').map(row => `${row.pregunta_id}: ${row.respuesta_texto}`).join(' · ');
    return {
      participante: session.participante || '', camino: session.camino || '', rol: session.rol || 'externo', perfil: session.perfil || '',
      tarea: 'Resumen de sesión', exito_sin_ayuda: stages.length ? `${successes}/${stages.length}` : '',
      tiempo_s: times.length ? Math.round(times.reduce((a,b)=>a+b,0)/1000) : '',
      errores: stages.reduce((sum,stage)=>sum + (Number(stage.errores)||0),0), primer_clic: '',
      SEQ_1a7: validSeq.length ? (validSeq.reduce((a,b)=>a+b,0)/validSeq.length).toFixed(1) : '',
      comentarios: notes, toques_sin_respuesta: '', toques_totales: '', datos_iniciales_s: '',
      fecha: session.inicio || '', version: session.version_banco || VERSION, observador: '', sesion_id: session.id,
      etapas_completadas: stages.length, SUS: session.sus_score ?? susForSession(session.id, rows) ?? '', estado: session.estado || ''
    };
  });
  const exportLong = () => download('respuestas_largo.csv', csvText(readAnswers()));
  const exportSummary = () => download('resumen_por_persona.csv', csvText(summaryRows(), [...PLANILLA_COLUMNS,'etapas_completadas','SUS','estado']));
  const exportJSON = () => download('respuestas_ronda_final.json', '\uFEFF' + JSON.stringify({ version_banco: VERSION, sesiones: readSessions(), respuestas: readAnswers() }, null, 2), 'application/json;charset=utf-8');
  const nextParticipant = (participant) => {
    const match = String(participant || '').match(/^([PI])(\d+)$/);
    if (!match) return 'P1';
    const max = match[1] === 'P' ? 5 : 3;
    return `${match[1]}${Number(match[2]) % max + 1}`;
  };
  window.MCPrueba = Object.freeze({ KEY, VERSION, CSV_COLUMNS, PLANILLA_COLUMNS, uuid, readActive, readAnswers, readSessions, setActive, updateActive, upsertSession, loadBank, personType, phaseQuestions, stagesFor, saveAnswer, susScore, umuxScore, susForSession, finishSession, csvText, download, summaryRows, exportLong, exportSummary, exportJSON, nextParticipant, stageRow, remotePackage, encodeRemoteText, decodeRemoteText, mergeRemotePackage });
})();
