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
  const susForSession = (sessionId, rows = readAnswers()) => {
    const map = new Map(rows.filter(row => row.sesion_id === sessionId && /^sus_(?:[1-9]|10)$/.test(row.pregunta_id) && !row.omitida).map(row => [row.pregunta_id, Number(row.respuesta)]));
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
  window.MCPrueba = Object.freeze({ KEY, VERSION, CSV_COLUMNS, PLANILLA_COLUMNS, uuid, readActive, readAnswers, readSessions, setActive, updateActive, upsertSession, loadBank, personType, phaseQuestions, stagesFor, saveAnswer, susScore, susForSession, finishSession, csvText, download, summaryRows, exportLong, exportSummary, exportJSON, nextParticipant, stageRow });
})();
