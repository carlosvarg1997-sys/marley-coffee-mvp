/* Marley Coffee · CRM V2. A new role-first view over the existing M4 data model. */
(() => {
  'use strict';

  const M = window.M4, D = window.M4D, R = window.M4R, P = window.R6P;
  if (!M || !D || !R || !P) return;

  const ROOT_ID = 'crm-v2-root';
  const DATA_KEY = 'crm2';
  const NAV = {
    ventas: [
      ['R01', 'Hoy', 'home'], ['R02', 'Contactos', 'people'],
      ['R03', 'Clientes', 'building'], ['R08', 'Propuestas', 'file']
    ],
    marketing: [
      ['R11', 'Hoy', 'home'], ['R12', 'Leads', 'people'],
      ['R16', 'Recuperar', 'clock'], ['R13', 'Campañas', 'campaign']
    ],
    jefatura: [
      ['R05', 'Hoy', 'home'], ['R07', 'Por aprobar', 'check'],
      ['R06', 'Metas y canales', 'chart'], ['R14', 'Equipo y operación', 'building']
    ]
  };
  const ROUTE = {
    R00: { role: null, page: 'entry', menu: null, title: 'Ingreso al CRM' },
    R01: { role: 'ventas', page: 'salesToday', menu: 'R01', title: 'Hoy' },
    R02: { role: 'ventas', page: 'salesContacts', menu: 'R02', title: 'Contactos' },
    R03: { role: 'ventas', page: 'salesClients', menu: 'R03', title: 'Clientes' },
    R04: { role: null, page: 'detail', menu: null, title: 'Ficha del cliente' },
    R05: { role: 'jefatura', page: 'managerSummary', menu: 'R05', title: 'Resumen' },
    R06: { role: 'jefatura', page: 'managerGoals', menu: 'R06', title: 'Metas y canales' },
    R07: { role: 'jefatura', page: 'managerApprovals', menu: 'R07', title: 'Por aprobar' },
    R08: { role: 'ventas', page: 'salesQuotes', menu: 'R08', title: 'Propuestas' },
    R09: { role: 'jefatura', page: 'managerGoals', menu: 'R06', title: 'Puntaje y metas' },
    R10: { role: 'ventas', page: 'salesClients', menu: 'R03', title: 'Reposición' },
    R11: { role: 'marketing', page: 'marketingToday', menu: 'R11', title: 'Hoy' },
    R12: { role: 'marketing', page: 'marketingLeads', menu: 'R12', title: 'Leads' },
    R13: { role: 'marketing', page: 'marketingCampaigns', menu: 'R13', title: 'Campañas' },
    R14: { role: 'jefatura', page: 'managerTeam', menu: 'R14', title: 'Equipo y operación' },
    R15: { role: 'jefatura', page: 'managerOperations', menu: 'R14', title: 'Operación' },
    R16: { role: 'marketing', page: 'marketingRecover', menu: 'R16', title: 'Recuperar' },
    R17: { role: null, page: 'buyerCRM', menu: 'R14', title: 'CRM por comprador' }
  };
  const ICON = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3"/>',
    file: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6m-6 4h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    campaign: '<path d="m4 12 15-7v14L4 12zm0 0v6a2 2 0 0 0 2 2h2l2-5M19 10a3 3 0 0 1 0 4"/>',
    check: '<path d="m5 12 4 4L19 6"/><path d="M21 12a9 9 0 1 1-5.8-8.4"/>',
    chart: '<path d="M4 19V5m0 14h17M8 15l4-5 3 2 5-7"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zm13 1h2a2 2 0 1 1 0 4h-2M7 4v2m4-2v2m4-2v2"/>'
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const currentState = () => M.get() || {};
  const appState = () => currentState()[DATA_KEY] || {};
  const icon = name => `<svg class="crm2-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ICON.file}</svg>`;
  const money = n => n == null || n === '' || !Number.isFinite(Number(n)) ? 'Sin monto registrado' : (D.fmtCLP ? D.fmtCLP(Number(n)) : '$' + new Intl.NumberFormat('es-CL').format(Number(n)));
  const fmtDate = value => value ? new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha registrada';
  const now = () => M.now ? M.now() : Date.now();
  const save = mutator => M.update(st => {
    if (!st[DATA_KEY] || typeof st[DATA_KEY] !== 'object') st[DATA_KEY] = {};
    mutator(st[DATA_KEY], st);
  });
  const localRoute = () => (location.hash || '#R00').slice(1).split('?')[0];
  const active = () => /^R(?:0\d|1[0-7])$/.test(localRoute()) || /(?:^|\/)crm\.html$/i.test(location.pathname);
  const routeRole = (route, role) => route === 'R06' && role === 'marketing' ? 'marketing' : ROUTE[route]?.role || null;
  const homeFor = role => ({ ventas: 'R01', marketing: 'R11', jefatura: 'R05' }[role] || 'R00');
  const userFor = role => D.ROLE_MENUS?.[role]?.user || ({ ventas: 'Ventas', marketing: 'Marketing', jefatura: 'Jefatura' }[role] || 'Equipo Marley');
  const roleTitle = role => ({ ventas: 'Ventas', marketing: 'Marketing', jefatura: 'Jefatura' }[role] || 'CRM interno');
  const root = () => document.getElementById(ROOT_ID);

  function leads() {
    let items = [];
    try { items = (R.leads(currentState()) || []).slice(); } catch (_) { items = []; }
    if (!items.length) items = (D.PROSPECTS || []).slice();
    const live = currentState().lead;
    if (live?.id && !items.some(item => item.id === live.id)) items.unshift(Object.assign({}, live, { live: true }));
    items = items.concat(liveReferralLeads());
    return items.map(item => item.live ? item : Object.assign({}, item, { dataTest: true }));
  }
  function accounts() {
    let base;
    try { base = (R.accounts(currentState()) || []).slice(); } catch (_) { base = (D.ACCOUNTS || []).slice(); }
    const live = liveAccount();
    return live ? [...base.filter(item => String(item.id) !== String(live.id)), live] : base;
  }
  const leadById = id => leads().find(item => String(item.id) === String(id)) || null;
  const accountById = id => accounts().find(item => String(item.id) === String(id)) || (D.ACCOUNTS || []).find(item => String(item.id) === String(id)) || null;
  const scoreInterest = item => { try { return P.interes(item || {}); } catch (_) { return { puntaje: Number(item?.score) || 0, partes: {} }; } };
  const scoreValue = item => { try { return P.valor(item || {}); } catch (_) { return { puntaje: 0, partes: {} }; } };
  const scorePriority = item => { try { return P.prioridad(item || {}); } catch (_) { return { texto: 'Atender normal', clave: 'normal', orden: 3 }; } };
  const whyValue = (item, showAmounts = false) => { try { return P.frasePorque(item || {}, { montos: showAmounts }); } catch (_) { return 'El puntaje combina señales del negocio y su actividad.'; } };
  const scoreAccount = item => { try { return P.cuenta(item || {}); } catch (_) { return item?.st || {}; } };
  const isReferral = item => /referid/i.test(String(item?.source || '')) || Boolean(item?.referralLead || item?.referrerAccountId || item?.referralCode);
  const accountStats = item => item?.st || (M.accountStats ? M.accountStats(item) : {});
  const accountDue = item => Number(accountStats(item)?.dueIn);
  const accountNeedsReorder = item => Number.isFinite(accountDue(item)) && accountDue(item) <= 0;
  const openTickets = id => {
    let list = [];
    try { list = window.M4R3?.postventa?.() || []; } catch (_) { list = []; }
    return list.filter(ticket => String(ticket.customerId || ticket.folio || '') === String(id) && !/cerrad|resuelt|finaliz/i.test(String(ticket.status || '')));
  };
  const riskReason = account => {
    const tickets = openTickets(account.id);
    if (tickets.length) return `Postventa pendiente: ${tickets[0].type || tickets[0].detail || 'revisar caso'}`;
    const stats = accountStats(account);
    if (stats.lastAgo != null && stats.freqDays != null && Number.isFinite(Number(stats.lastAgo)) && Number.isFinite(Number(stats.freqDays)) && Number(stats.lastAgo) > Number(stats.freqDays)) return `Sin compra hace ${stats.lastAgo} días; su ciclo medio es ${stats.freqDays} días.`;
    const score = lastNps(account); if (score != null && score <= 6) return `NPS detractor registrado: ${score}/10.`;
    return 'Revisar frecuencia y estado de servicio antes de contactar.';
  };
  const accountAtRisk = account => openTickets(account.id).length > 0 || (accountStats(account).lastAgo != null && accountStats(account).freqDays != null && Number(accountStats(account).lastAgo) > Number(accountStats(account).freqDays)) || isDetractor(account);
  // Cuenta viva del portal: su ciclo (customerCycle) se lee como una cuenta más del CRM. Todo es dato de prueba.
  const DAY_MS = Number(D.DAY || 86400000);
  const isRepeatOrder = order => order?.eventName === 'repeat_order_confirmed' || Boolean(order?.sourceOrderId);
  const reorderChannel = order => String(order?.channel || order?.source || order?.salesChannel || '');
  const keyText = value => String(value || '').trim().toLocaleLowerCase('es-CL');
  function liveCycle() { const c = currentState().customerCycle; return c && c.accountId ? c : null; }
  function liveAccount() {
    const c = liveCycle();
    if (!c || !Array.isArray(c.orders) || !c.orders.length) return null;
    const orders = c.orders.map(order => ({ id: order.id, eventName: order.eventName, at: Number(order.at || 0), items: order.items || [], total: Number(order.total || 0), sourceOrderId: order.sourceOrderId || null, status: order.status || 'Pedido confirmado', receivedAt: order.receivedAt || null, waitPassed: Boolean(order.waitPassed), npsScore: order.npsScore ?? null, npsComment: order.npsComment || '', npsAt: order.npsAt || null, channel: 'portal', live: true }));
    const last = orders[orders.length - 1];
    const gaps = orders.slice(1).map((order, index) => (order.at - orders[index].at) / DAY_MS);
    const avgGap = gaps.length ? Math.round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length) : 0;
    const freqDays = avgGap >= 1 ? avgGap : null;
    const lastAgo = Math.max(0, Math.round((now() - last.at) / DAY_MS));
    const total = orders.reduce((sum, order) => sum + order.total, 0);
    return { id: c.accountId, name: c.company || 'Cuenta del portal', business: c.business || 'Negocio sin dato', comuna: c.comuna || 'Comuna sin dato', source: c.origin || '', orders, live: true, referral: null, st: { lastAgo, freqDays, dueIn: freqDays == null ? NaN : freqDays - lastAgo, avg: total / orders.length, first: orders[0].at, last: last.at, orders: orders.length } };
  }
  // Referido que la cuenta autorizó en su encuesta: aún no llega como formulario del negocio referido.
  function liveReferralLeads() {
    const c = liveCycle();
    if (!c || c.referralConsent !== true || !c.referralBusiness) return [];
    const business = String(c.referralBusiness).trim();
    const already = (currentState().referralLeads || []).some(item => keyText(item.business || item.company) === keyText(business) && String(item.referrerAccountId || '') === String(c.accountId));
    if (already) return [];
    const order = (c.orders || []).at(-1) || {};
    return [{ id: `REF-${c.accountId}`, name: 'Contacto por confirmar', company: business, business, comuna: 'Por confirmar', source: `Referido · ${c.company || 'cuenta del portal'}`, referralLead: true, referralPending: true, referrerAccountId: c.accountId, referralCode: c.accountCode, stage: 'Lead', at: Number(c.referralSentAt || order.npsAt || order.receivedAt || 0), live: false, dataTest: true }];
  }
  function npsEntries(account) {
    const rows = (account?.orders || []).filter(order => order.npsScore !== null && order.npsScore !== undefined && Number.isFinite(Number(order.npsScore))).map(order => ({ score: Number(order.npsScore), at: Number(order.npsAt || order.receivedAt || order.at || 0), orderId: order.id }));
    if (!rows.length && account?.nps != null && Number.isFinite(Number(account.nps))) rows.push({ score: Number(account.nps), at: 0, orderId: null });
    return rows;
  }
  function lastNps(account) {
    const rows = npsEntries(account).sort((a, b) => b.at - a.at);
    return rows.length ? rows[0].score : null;
  }
  function isDetractor(account) { const score = lastNps(account); return score != null && score <= 6; }
  function isPromoter(account) { const score = lastNps(account); return score != null && score >= 9; }
  function npsSummary() {
    const responses = accounts().flatMap(account => npsEntries(account));
    const n = responses.length;
    const promoters = responses.filter(item => item.score >= 9).length;
    const passives = responses.filter(item => item.score >= 7 && item.score <= 8).length;
    const detractors = responses.filter(item => item.score <= 6).length;
    const average = n ? responses.reduce((sum, item) => sum + item.score, 0) / n : null;
    return { n, promoters, passives, detractors, average, nps: n ? Math.round((promoters - detractors) / n * 100) : null };
  }
  function npsMetric(summary) {
    if (!summary.n) return metric('NPS', 'Pendiente', 'Se obtiene con la encuesta que responde el comprador al confirmar la recepción de un pedido del portal · meta 52');
    const avg = summary.average.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const sign = summary.nps > 0 ? '+' : '';
    return metric('NPS', `${sign}${summary.nps}`, `Meta 52 · promedio ${avg} de 10 · ${summary.promoters} promotor${summary.promoters === 1 ? '' : 'es'}, ${summary.passives} pasivo${summary.passives === 1 ? '' : 's'}, ${summary.detractors} detractor${summary.detractors === 1 ? '' : 'es'} de ${summary.n} respuesta${summary.n === 1 ? '' : 's'}`);
  }
  function riskShort(account) {
    if (openTickets(account.id).length) return 'Postventa abierta';
    const score = lastNps(account);
    if (score != null && score <= 6) return `NPS ${score}/10 · detractor`;
    const lastAgo = accountStats(account).lastAgo;
    return lastAgo == null ? 'Sin fecha de compra' : `Hace ${lastAgo} días sin compra`;
  }
  function productLabel(key) {
    let lines = [];
    try { lines = window.R3C2?.data?.().prices?.lines || []; } catch (_) { lines = []; }
    const line = lines.find(item => item.k === key || item.catalogId === key);
    return line?.t || D.PRODUCTS?.[key]?.name || String(key || 'Producto');
  }
  const stockLabel = status => status === 'agotado' ? 'Sin disponibilidad · escenario de prueba' : status === 'bajo' ? 'Disponibilidad baja · escenario de prueba' : 'Alerta de stock · escenario de prueba';
  function stockRequestRows() {
    const s = currentState();
    const c = s.customerCycle || {};
    const accountId = c.accountId || null;
    const accountName = c.company || 'Cuenta del portal';
    const list = (c.stockAlertRequests || []).map(item => ({ productId: item.productId, status: item.status, at: Number(item.at || 0), accountId, accountName }));
    const seen = new Set(list.map(item => `${item.productId}|${item.status}`));
    (s.events || []).filter(event => event.eventName === 'stock_alert_requested').forEach(event => {
      const key = `${event.product_id}|${event.stock_status}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ productId: event.product_id, status: event.stock_status, at: Number(event.at || 0), accountId, accountName });
    });
    return list.sort((a, b) => b.at - a.at);
  }
  function stockBlockBody() {
    const requests = stockRequestRows();
    if (!requests.length) return `<div class="crm2-list">${empty('Sin alertas de stock en la prueba', 'Aparecen cuando el comprador pide «Avísame cuando vuelva» en un producto sin disponibilidad. No consultan inventario real.')}</div>`;
    const rows = limitedList(requests, item => {
      const title = productLabel(item.productId);
      const sub = `${stockLabel(item.status)} · ${item.accountName}`;
      const meta = `Aviso pedido ${fmtDate(item.at)}`;
      return item.accountId && accountById(item.accountId) ? row(title, sub, meta, `data-c2="open-account" data-id="${esc(item.accountId)}"`, 'Avísame cuando vuelva') : staticRow(title, sub, meta, 'Avísame cuando vuelva');
    }, 'Ver todos los avisos');
    return `<div class="crm2-list">${rows}</div>`;
  }
  function staticRow(title, subtitle, meta, badge = '') {
    return `<div class="crm2-row crm2-row--static"><span class="crm2-row-main"><b>${esc(title)}</b><span>${esc(subtitle)}</span></span><span class="crm2-row-side">${badge ? `<span class="crm2-row-badge">${esc(badge)}</span>` : ''}<small>${esc(meta || '')}</small></span></div>`;
  }
  function referralStatus(lead) {
    if (lead?.referralPending) return 'Permiso del referido por confirmar';
    return permission(lead).key === 'yes' ? 'Permiso del referido registrado' : 'Permiso del referido por confirmar';
  }
  function promoterStatus() {
    const c = liveCycle();
    return c?.referralConsent === true && c.referralBusiness ? `Permiso registrado para ${c.referralBusiness}` : 'La cuenta confirma la invitación en su portal';
  }
  function referralNewBody() {
    const referrals = leads().filter(isReferral).sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
    const promoters = accounts().filter(isPromoter);
    const entries = [...referrals.map(lead => ({ kind: 'lead', item: lead })), ...promoters.map(account => ({ kind: 'promoter', item: account }))];
    if (!entries.length) return empty('Sin referidos nuevos', 'Aparecen cuando el negocio referido completa el formulario o cuando una cuenta promotora registra su permiso.');
    return `<div class="crm2-list">${limitedList(entries, entry => entry.kind === 'lead'
      ? row(contactName(entry.item), `${companyName(entry.item)} · ${sourceOf(entry.item)}`, referralStatus(entry.item), `data-c2="open-lead" data-id="${esc(entry.item.id)}"`, 'Referido nuevo')
      : row(entry.item.name || 'Cuenta', `${entry.item.business || 'Negocio sin dato'} · Promotor NPS ${lastNps(entry.item)}/10`, promoterStatus(), `data-c2="open-account" data-id="${esc(entry.item.id)}"`, 'Invitar a recomendar'), 'Ver todos los referidos')}</div>`;
  }
  function replenishBlock(account) {
    const requests = stockRequestRows().filter(item => String(item.accountId) === String(account.id));
    const stockRows = requests.length
      ? requests.map(item => staticRow(productLabel(item.productId), stockLabel(item.status), `Aviso pedido ${fmtDate(item.at)}`, 'Avísame cuando vuelva')).join('')
      : '<p class="crm2-small-note">Sin alertas de stock ni avisos «Avísame cuando vuelva» en esta cuenta. Aparecen cuando el comprador pide aviso de un producto sin disponibilidad.</p>';
    return `<div class="crm2-replenish"><p class="crm2-eyebrow">REPOSICIÓN · ALERTAS DE STOCK</p><div class="crm2-list">${stockRows}</div></div>`;
  }
  function historyRow(order) {
    const kind = order.live ? (isRepeatOrder(order) ? 'Pedido repetido' : 'Primer pedido') : '';
    const received = order.receivedAt ? ` · recibido ${fmtDate(order.receivedAt)}` : '';
    const nps = order.npsScore !== null && order.npsScore !== undefined && Number.isFinite(Number(order.npsScore)) ? ` · NPS ${Number(order.npsScore)}/10` : '';
    return `<p class="crm2-activity"><b>${esc(order.id)} · ${money(order.total)}</b><small>${fmtDate(order.at)}${kind ? ` · ${kind}` : ''} · ${esc(order.status || 'Estado por confirmar')}${received}${nps}</small></p>`;
  }
  function livePurchase(account) {
    const orders = (account.orders || []).slice().reverse();
    const last = orders[0];
    const freq = accountStats(account).freqDays;
    const cycle = freq ? `Cada ${freq} días, promedio entre pedidos` : 'Se calcula con la distancia entre dos pedidos confirmados';
    const reception = !last ? 'Sin pedido' : last.receivedAt ? `Confirmada el ${fmtDate(last.receivedAt)}` : 'Pendiente: la cuenta confirma la recepción en su portal';
    return `<div class="crm2-purchase-summary"><p><b>Último pedido</b><span>${esc(last?.id || 'Sin pedido registrado')} · ${last?.total ? money(last.total) : 'Sin monto'} · ${esc(last?.status || 'Estado por confirmar')}</span></p><p><b>Recepción</b><span>${esc(reception)}</span></p><p><b>Ciclo</b><span>${esc(cycle)}</span></p><p><b>Productos</b><span>${esc(productNames(last))}</span></p></div><details class="crm2-fold"><summary>Historial de compras (${orders.length})</summary><div class="crm2-fold-body">${orders.slice(0, 5).map(historyRow).join('') || '<p>Sin historial de compra.</p>'}</div></details>`;
  }
  function liveReferralDetails(account) {
    const c = liveCycle();
    if (!account?.live || !c) return '';
    const pending = c.referralConsent === true && c.referralBusiness;
    const score = lastNps(account);
    if (pending) return `<div class="crm2-referral-details"><b>Recomendación pendiente</b>${labelValue('Negocio recomendado', c.referralBusiness)}${labelValue('Permiso del referido', 'Por confirmar con el negocio referido')}${labelValue('Beneficio para quien refiere', 'Sin beneficio registrado · no pasa a Jefatura')}</div>`;
    if (score != null && score >= 9) return `<div class="crm2-referral-details"><b>Invitación a recomendar</b>${labelValue('Estado', `Promotor NPS ${score}/10 · la cuenta confirma la invitación en su portal`)}</div>`;
    return '';
  }
  const sourceOf = item => item?.source || item?.attribution?.firstTouch?.source || item?.utm_source || 'Origen sin dato registrado';
  const campaignOf = item => item?.campaign || item?.attribution?.firstTouch?.campaign || item?.utm_campaign || (/Campaña/i.test(String(item?.source || '')) ? item.source : 'Sin campaña asociada');
  const pieceOf = item => item?.piece || item?.contentPiece || item?.attribution?.firstTouch?.piece || item?.utm_content || 'Pieza sin registro';
  const permission = item => {
    const saved = item?.id ? appState().permissions?.[item.id]?.promotion : undefined;
    const value = saved ?? item?.marketingConsent ?? item?.permissions?.promotion ?? item?.consent?.marketing;
    if (value === true || value === 'true' || value === 'si') return { key: 'yes', label: 'Promoción autorizada' };
    if (value === false || value === 'false' || value === 'no') return { key: 'no', label: 'Sin permiso de promoción' };
    if (value == null && item?.dataTest && ['MQL','SQL'].includes(item?.stage)) return { key: 'yes', label: 'Permiso registrado · dato de prueba' };
    if (item?.requestedReply || item?.request?.reply) return { key: 'reply', label: 'Puede responder su solicitud' };
    return { key: 'unknown', label: 'Permiso de promoción sin dato' };
  };
  const progressFor = lead => currentState().marketingPasos?.[lead.id] || {};
  const statusOfLead = lead => {
    const pass = progressFor(lead);
    if (pass.estado === 'aceptado' || pass.estado === 'sql') return 'SQL aceptado';
    if (pass.estado === 'devuelto') return `Devuelto: ${pass.motivoDevolucion || pass.motivo || 'revisar motivo'}`;
    if (pass.estado === 'esperando' || pass.estado === 'pendiente') return 'Esperando a Ventas';
    if (lead.stage === 'SQL') return 'SQL · dato de prueba';
    if (lead.stage === 'MQL') return 'MQL · dato de prueba';
    return `${lead.stage || 'Contacto nuevo'}${lead.dataTest ? ' · dato de prueba' : ''}`;
  };
  const contactName = lead => lead?.name || lead?.contactName || 'Contacto sin nombre';
  const companyName = lead => lead?.company || lead?.accountName || lead?.business || 'Empresa sin nombre';
  const valueLabel = lead => {
    const result = scoreValue(lead);
    const n = Number(result?.puntaje ?? lead?.valueScore ?? 0);
    const banda = result?.banda || (n >= 60 ? 'alto' : n >= 45 ? 'medio' : 'estandar');
    return `${banda === 'alto' ? 'Valor alto' : banda === 'medio' ? 'Valor medio' : 'Valor estándar'} · ${n}/100`;
  };
  const interestLabel = lead => `${Number(scoreInterest(lead)?.puntaje ?? 0)}/100`;
  const priorityLabel = lead => scorePriority(lead)?.texto || 'Atender normal';
  const crmQuotes = () => appState().quotes || [];
  const legacyQuotes = () => { try { const legacy = R.quoted(currentState()); return Array.isArray(legacy) ? legacy : []; } catch (_) { return []; } };
  const latestQuoteFor = lead => crmQuotes().slice().reverse().find(quote => quote.leadId === lead.id) || null;

  function machineFor(lead) {
    let key = '';
    try { key = D.machineFor?.(lead?.business || lead?.buyer || '') || ''; } catch (_) { key = ''; }
    const machine = key ? D.MACHINES?.[key] : null;
    const pack = (() => { try { return P.packInicial(lead?.business || lead?.buyer || ''); } catch (_) { return null; } })();
    return { key, name: machine?.name || 'Máquina sugerida según el rubro', kind: machine?.kind || 'Confirmar compatibilidad con Ventas', pack };
  }
  function packDescription(lead) {
    const offer = machineFor(lead);
    const amount = Number(offer.pack);
    return { ...offer, amount: Number.isFinite(amount) && amount > 0 ? amount : null };
  }
  function isMql(lead) {
    const score = Number(scoreInterest(lead)?.puntaje || 0);
    const identified = Boolean(lead?.name || lead?.contactName) && Boolean(lead?.email || lead?.phone || lead?.company);
    const b2b = Boolean(lead?.business || lead?.company);
    return identified && b2b && permission(lead).key === 'yes' && score >= 40;
  }
  function leadsReady() { return leads().filter(lead => isMql(lead) && !['aceptado','sql'].includes(progressFor(lead).estado)); }
  function passedLeads() { return leads().filter(lead => ['esperando','pendiente'].includes(progressFor(lead).estado)); }
  function returnedLeads() { return leads().filter(lead => progressFor(lead).estado === 'devuelto'); }
  function sortedNewest(items) { return items.slice().sort((a,b) => Number(b.at || b.createdAt || 0) - Number(a.at || a.createdAt || 0)); }
  function searchItems(query) {
    const q = String(query || '').trim().toLocaleLowerCase('es-CL');
    if (!q) return [];
    const ls = leads().filter(item => `${contactName(item)} ${companyName(item)} ${sourceOf(item)} ${item.id || ''}`.toLocaleLowerCase('es-CL').includes(q)).map(item => ({ type: 'lead', id: item.id, title: contactName(item), subtitle: `${companyName(item)} · ${sourceOf(item)}` }));
    const as = accounts().filter(item => `${item.name || ''} ${item.business || ''} ${item.id || ''}`.toLocaleLowerCase('es-CL').includes(q)).map(item => ({ type: 'account', id: item.id, title: item.name, subtitle: `${item.business || 'Cuenta'} · ${item.comuna || 'Comuna sin dato'}` }));
    return [...ls, ...as].slice(0, 5);
  }
  let currentToast = null;
  let requestedReview = null;
  let selectedReviewId = null;
  let permissionReviewId = null;
  let reviewPermissionOnDetail = false;
  let recommendationPanelId = null;
  function showToast() {
    const host = root()?.querySelector('[data-crm2-toast]');
    if (!host) return;
    host.innerHTML = currentToast ? `<div class="crm2-toast-item" role="status"><b>${esc(currentToast.title)}</b>${currentToast.detail ? `<span>${esc(currentToast.detail)}</span>` : ''}</div>` : '';
  }
  function toast(title, detail = '') {
    currentToast = { title, detail };
    showToast();
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { currentToast = null; showToast(); }, 5200);
  }
  function goto(route) {
    const next = ROUTE[route] ? route : 'R00';
    if (next !== 'R04') recommendationPanelId = null;
    if (next !== 'R04') permissionReviewId = null;
    if (next !== 'R07') selectedReviewId = null;
    if (localRoute() === next) render();
    else location.hash = next;
  }
  function menuRouteFor(route, role) {
    if (route === 'R06' && role === 'marketing') return 'R12';
    if (route === 'R09') return 'R06';
    if (route === 'R10') return 'R03';
    if (route === 'R15' || route === 'R17') return 'R14';
    return ROUTE[route]?.menu || NAV[role]?.[0]?.[0];
  }

  function labelValue(label, value) { return `<div class="crm2-kv"><span>${esc(label)}</span><b>${esc(value || 'Sin dato registrado')}</b></div>`; }
  function statusPill(text, kind = '') { return `<span class="crm2-status ${kind ? `crm2-status--${kind}` : ''}"><span aria-hidden="true">${kind === 'good' ? '✓' : kind === 'wait' ? '◷' : kind === 'blocked' ? '!' : '·'}</span>${esc(text)}</span>`; }
  function block(title, copy, body, extra = '') {
    const short = Boolean(copy) && copy.length <= 45;
    const more = copy && !short ? `<details class="crm2-note"><summary>Más información</summary><p>${esc(copy)}</p></details>` : '';
    return `<section class="crm2-block ${extra}"><header class="crm2-block-head"><div class="crm2-block-title"><h2>${esc(title)}</h2>${short ? `<p>${esc(copy)}</p>` : ''}</div>${more}</header>${body}</section>`;
  }
  function row(title, subtitle, meta, action, badge = '') {
    return `<button class="crm2-row" type="button" ${action} aria-label="${esc(title)}. ${esc(subtitle)}"><span class="crm2-row-main"><b>${esc(title)}</b><span>${esc(subtitle)}</span></span><span class="crm2-row-side">${badge ? `<span class="crm2-row-badge">${esc(badge)}</span>` : ''}<small>${esc(meta || '')}</small>${icon('arrow')}</span></button>`;
  }
  function empty(title, detail) { return `<div class="crm2-empty"><b>${esc(title)}</b><p>${esc(detail)}</p></div>`; }
  function limitedList(items, renderer, label = 'Ver todos', limit = 4) {
    const shown = items.slice(0, limit).map(renderer).join('');
    const extra = items.length > limit ? `<details class="crm2-more"><summary>${esc(label)} (${items.length})</summary><div class="crm2-more-body">${items.slice(limit).map(renderer).join('')}</div></details>` : '';
    return shown + extra || empty('Sin elementos para revisar', 'No hay registros en este estado.');
  }
  function listFilter() { return appState().filters || {}; }
  function leadRow(lead, mode = 'sales') {
    const id = esc(lead.id);
    const source = sourceOf(lead);
    const stage = statusOfLead(lead);
    const priority = priorityLabel(lead);
    const sub = `${companyName(lead)} · ${source}${mode === 'marketing' ? ` · ${permissionShort(lead)}` : ''}`;
    const meta = mode === 'marketing' ? `Interés ${interestLabel(lead)} · Valor ${scoreValue(lead)?.puntaje ?? 0}/100` : `${priority} · ${valueLabel(lead)}`;
    return row(contactName(lead), sub, meta, `data-c2="open-lead" data-id="${id}"`, stage);
  }
  function accountRow(account, mode = 'client') {
    const stats = accountStats(account);
    const meta = mode === 'reorder' ? (accountNeedsReorder(account) ? 'Toca reponer' : (stats.freqDays ? `Ciclo · ${stats.freqDays} días` : 'Ciclo por calcular')) : mode === 'risk' ? riskShort(account) : `Última compra · ${stats.lastAgo == null ? 'sin dato' : `hace ${stats.lastAgo} días`}`;
    const stateLabel = appState().replenishments?.[account.id]?.status || (mode === 'risk' ? 'En riesgo' : accountNeedsReorder(account) && accountAtRisk(account) ? 'Reposición · cuenta en riesgo' : accountNeedsReorder(account) ? 'Reposición por revisar' : accountAtRisk(account) ? 'En riesgo' : 'Cliente activo');
    return row(account.name || 'Cuenta sin nombre', `${account.business || 'Negocio sin dato'} · ${account.comuna || 'Comuna sin dato'}`, meta, `data-c2="open-account" data-id="${esc(account.id)}"`, stateLabel);
  }
  const permissionShort = item => permission(item).key === 'yes' ? 'Permiso sí' : permission(item).key === 'no' ? 'Sin permiso' : permission(item).key === 'reply' ? 'Solo respuesta solicitada' : 'Permiso por confirmar';
  function titleSub(route, role) {
    const map = {
      salesToday: ['Hoy', ''],
      salesContacts: ['Contactos', ''],
      salesClients: ['Clientes', ''],
      salesQuotes: ['Propuestas', ''],
      marketingToday: ['Hoy', ''],
      marketingChannels: ['Ventas y origen', ''],
      marketingLeads: ['Leads', ''],
      marketingRecover: ['Recuperar', ''],
      marketingCampaigns: ['Campañas', ''],
      managerSummary: ['Hoy', ''],
      managerApprovals: ['Por aprobar', ''],
      managerGoals: ['Metas y canales', ''],
      managerTeam: ['Equipo y operación', ''],
      managerOperations: ['Operación', ''],
      buyerCRM: ['CRM por comprador', ''],
      detail: ['Ficha', '']
    };
    const name = route === 'R06' && role === 'marketing' ? 'marketingChannels' : ROUTE[route]?.page || 'salesToday';
    return map[name] || [ROUTE[route]?.title || roleTitle(role), ''];
  }

  function entryPage() {
    const roleCard = (role, dest, description) => `<button type="button" class="crm2-role-card" data-c2="choose-role" data-role="${role}"><span class="crm2-role-icon">${icon(role === 'ventas' ? 'people' : role === 'marketing' ? 'campaign' : 'chart')}</span><span><b>${esc(roleTitle(role))}</b><small>${esc(description)}</small></span><span class="crm2-role-arrow">${icon('arrow')}</span></button>`;
    return `<main class="crm2-entry"><div class="crm2-entry-panel"><div class="crm2-entry-brand">${icon('coffee')}<span>MARLEY COFFEE</span><small>CRM interno</small><img class="crm2-entry-visual" src="recursos/productos/keep-on-moving-grano.webp" alt="Café Marley Coffee Keep on Moving"></div><p class="crm2-eyebrow">INGRESO DE TRABAJADORES</p><h1>¿Qué necesitas hacer?</h1><p>Abre la vista de tu rol para empezar por la tarea de hoy.</p><div class="crm2-role-list">${roleCard('ventas','R01','Atender oportunidades, clientes y propuestas')}${roleCard('marketing','R11','Revisar leads, permisos y campañas')}${roleCard('jefatura','R05','Ver resultados y decisiones pendientes')}</div><p class="crm2-entry-note">Prototipo de evaluación · no valida cuentas reales.</p></div></main>`;
  }
  function shell(route, role, title, subtitle, content, actionbar = '') {
    const activeRoute = menuRouteFor(route, role);
    const menu = NAV[role] || [];
    const nav = menu.map(([id, label, glyph]) => `<a class="crm2-nav-link ${activeRoute === id ? 'is-active' : ''}" href="#${id}" data-c2-go="${id}" ${activeRoute === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${esc(label)}</span></a>`).join('');
    const userName = userFor(role);
    const visual = role === 'marketing'
      ? ['recursos/maquinas/cafe_al_paso_foto.webp', 'Máquina Marley Coffee de café al paso']
      : role === 'jefatura'
        ? ['recursos/maquinas/oficina_foto.webp', 'Máquina Marley Coffee para oficina']
        : ['recursos/maquinas/bar_foto.webp', 'Máquina de espresso Marley Coffee para barra'];
    return `<div class="crm2-shell crm2-role-${role}">
      <aside class="crm2-sidebar" aria-label="Navegación del CRM">
        <a class="crm2-brand" href="#${homeFor(role)}" data-c2-go="${homeFor(role)}"><span class="crm2-brand-mark">M</span><span><b>MARLEY COFFEE</b><small>Empresas · CRM</small></span></a>
        <div class="crm2-role-label"><span class="crm2-avatar">${esc(userName.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase())}</span><span><b>${esc(roleTitle(role))}</b><small>${esc(userName)}</small></span></div>
        <nav class="crm2-nav">${nav}</nav>
        <button class="crm2-logout" type="button" data-c2="logout">Cerrar sesión</button>
      </aside>
      <div class="crm2-workspace">
        <header class="crm2-topbar"><div class="crm2-mobile-brand"><span class="crm2-brand-mark">M</span><b>${esc(roleTitle(role))}</b></div><div class="crm2-search-wrap">${icon('search')}<input type="search" data-c2-search placeholder="Buscar" aria-label="Buscar contacto o cuenta" autocomplete="off"><div class="crm2-search-results" data-c2-search-results hidden></div></div><button class="crm2-alerts" type="button" data-c2-go="${role === 'jefatura' ? 'R07' : role === 'marketing' ? 'R16' : 'R01'}" aria-label="Ver avisos">${icon('bell')}<span>Avisos</span><b>${alertCount(role)}</b></button></header>
        <main class="crm2-main"><header class="crm2-page-head"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</header><div class="crm2-content">${content}</div></main>
      </div>
      ${actionbar}
      <div class="crm2-toast-host" data-crm2-toast aria-live="polite" aria-atomic="true"></div>
      ${quoteDialog()}
    </div>`;
  }
  function routeTitle(route) { return ROUTE[route]?.title || 'la lista'; }
  function alertCount(role) {
    if (role === 'jefatura') return pendingApprovals().length;
    if (role === 'marketing') return returnedLeads().length + leadsReady().length;
    return passedLeads().length + accounts().filter(accountNeedsReorder).length;
  }
  function actionBar(buttons, returnButton = false) {
    return `<div class="crm2-actionbar">${returnButton ? `<button type="button" class="crm2-btn crm2-btn--quiet" data-c2="back" aria-label="Volver a ${esc(routeTitle(appState().returnRoute || homeFor(currentState().role)))}"><span>← Volver</span></button>` : ''}${buttons}</div>`;
  }
  function primary(label, action, extra = '') { return `<button type="button" class="crm2-btn crm2-btn--primary" data-c2="${action}" ${extra}>${esc(label)}</button>`; }
  function secondary(label, action, extra = '') { return `<button type="button" class="crm2-btn crm2-btn--secondary" data-c2="${action}" ${extra}>${esc(label)}</button>`; }

  function salesToday() {
    const passed = sortedNewest(passedLeads());
    const qualified = sortedNewest(leads().filter(lead => lead.stage === 'MQL' && isMql(lead) && !progressFor(lead).estado));
    const due = accounts().filter(accountNeedsReorder).sort((a,b) => accountDue(a) - accountDue(b));
    const risk = accounts().filter(accountAtRisk).sort((a,b) => Number(isDetractor(b)) - Number(isDetractor(a)) || Number(accountStats(b).lastAgo || 0) - Number(accountStats(a).lastAgo || 0));
    const referrals = leads().filter(isReferral);
    const referralAccounts = accounts().filter(account => account.referral);
    const waiting = currentState().crm2?.followups || [];
    const dueIds = new Set(due.map(account => String(account.id)));
    const candidates = [
      ...(passed.length ? passed.slice(0,1).map(lead => ({ kind:'lead', item:lead, label:'Traspaso de Marketing' })) : qualified.slice(0,1).map(lead => ({ kind:'lead', item:lead, label:'Revisar MQL' }))),
      ...due.slice(0,1).map(account => ({ kind:'account', item:account, label:'Revisar reposición' })),
      ...risk.filter(account => !dueIds.has(String(account.id))).slice(0,1).map(account => ({ kind:'account', item:account, label:'Revisar postventa' })),
      ...referralAccounts.slice(0,1).map(account => ({ kind:'referral-account', item:account, label:'Confirmar permiso' })),
      ...referrals.slice(0,1).map(lead => ({ kind:'lead', item:lead, label:'Revisar referido' }))
    ];
    const unique = new Set();
    const queue = candidates.filter(entry => { const kind = entry.kind === 'referral-account' ? 'account' : entry.kind; const key = `${kind}-${entry.item.id}`; if (unique.has(key)) return false; unique.add(key); return true; });
    const queueBody = queue.length ? limitedList(queue, entry => {
      const item = entry.item;
      const isLead = entry.kind === 'lead';
      const isReferralAccount = entry.kind === 'referral-account';
      const action = isLead ? `data-c2="open-lead" data-id="${esc(item.id)}"` : `data-c2="open-account" data-id="${esc(item.id)}"`;
      const meta = isLead ? sourceOf(item) : isReferralAccount ? item.referral : riskReason(item);
      const badge = isLead ? priorityLabel(item) : isReferralAccount ? 'Referido' : (accountNeedsReorder(item) ? 'Reposición' : 'En riesgo');
      const company = isLead ? companyName(item) : item.business || 'Cuenta';
      return row(isLead ? contactName(item) : item.name, isLead ? `${entry.label} · ${company}` : entry.label, meta, action, badge);
    }, 'Ver todas las prioridades') : empty('Nada urgente por ahora', 'Aquí aparecen traspasos, reposiciones y casos de postventa.');
    const responseBody = waiting.length ? limitedList(waiting, item => row(item.name || item.accountName || 'Contacto', `${item.channel || 'Canal por confirmar'} · ${item.date ? fmtDate(item.date) : 'Seguimiento registrado'}`, item.status || 'Esperando respuesta', `data-c2="open-lead" data-id="${esc(item.leadId || item.id)}"`, 'Esperan respuesta')) : `<div class="crm2-inline-note">Las conversaciones y propuestas viven en la ficha del contacto.</div>`;
    return block('A atender hoy', '', queueBody) + `<details class="crm2-fold"><summary>Referidos nuevos</summary>${referralNewBody()}</details><details class="crm2-fold"><summary>Esperan respuesta</summary>${responseBody}</details>`;
  }
  function buyerCrmLink() {
    return '<p class="crm2-route-helper"><a href="#R17" data-c2-go="R17">Abrir CRM por comprador</a></p>';
  }
  function salesContacts() {
    const f = listFilter();
    const source = sortedNewest(leads()).filter(lead => !f.origin || sourceOf(lead) === f.origin).filter(lead => !f.referred || isReferral(lead));
    const options = [...new Set(leads().map(sourceOf))].filter(Boolean).sort();
    const filters = `<div class="crm2-filterbar"><label>Origen<select data-c2-filter="origin"><option value="">Todos</option>${options.map(item => `<option ${item === f.origin ? 'selected' : ''} value="${esc(item)}">${esc(item)}</option>`).join('')}</select></label><button class="crm2-chip-button ${f.referred ? 'is-selected' : ''}" type="button" data-c2="toggle-referrals">Referidos</button></div>`;
    const contacts = source.length ? limitedList(source, lead => leadRow(lead,'sales'), 'Ver todos los contactos') : empty('No hay contactos en este filtro','Cambia el origen o revisa el buscador.');
    return block('Contactos y origen', 'Encuentra el primer contacto, la campaña y la prioridad sin abrir varias pantallas.', filters + `<div class="crm2-list">${contacts}</div>`) + buyerCrmLink();
  }
  function salesClients() {
    const all = accounts();
    const due = all.filter(accountNeedsReorder).sort((a,b) => accountDue(a)-accountDue(b));
    const dueIds = new Set(due.map(account => String(account.id)));
    const risk = all.filter(accountAtRisk).filter(account => !dueIds.has(String(account.id))).sort((a,b) => Number(isDetractor(b))-Number(isDetractor(a)) || Number(accountStats(b).lastAgo||0)-Number(accountStats(a).lastAgo||0));
    const other = all.filter(account => !due.includes(account) && !risk.includes(account));
    const first = localRoute() === 'R10' ? due : due;
    return block('Toca reponer', 'La sugerencia sigue el historial; confirma cantidades y despacho con la cuenta.', `<div class="crm2-list">${limitedList(first,account => accountRow(account,'reorder'),'Ver todas las reposiciones')}</div>`) +
      block('En riesgo', 'Si hay una incidencia abierta, la postventa va antes de la venta.', `<div class="crm2-list">${limitedList(risk,account => accountRow(account,'risk'),'Ver todas las cuentas en riesgo')}</div>`) +
      `<details class="crm2-fold"><summary>Todos los clientes (${all.length})</summary><div class="crm2-list">${other.map(account => accountRow(account,'client')).join('') || empty('Sin clientes adicionales','')}</div></details>`;
  }
  function salesQuotes() {
    const generated = crmQuotes().slice().reverse();
    const existing = legacyQuotes();
    const body = [...generated.map(quote => `<article class="crm2-quote-row"><div><b>${esc(quote.folio || quote.id)} · ${esc(quote.company || 'Contacto')}</b><span>${esc(quote.machine || 'Máquina por confirmar')} · ${esc(quote.channel || 'Canal sin registro')}</span><small>${esc(quote.status || 'Borrador')} · Dato de prueba</small></div><strong>${quote.amount ? money(quote.amount) : 'Monto por confirmar'}</strong></article>`), ...existing.map(quote => `<article class="crm2-quote-row"><div><b>${esc(quote.id || 'Cotización')} · ${esc(quote.company || quote.name || 'Contacto')}</b><span>${esc(quote.machine || 'Propuesta registrada')}</span><small>${esc(quote.status || 'Estado sin registro')} · Dato de prueba</small></div><strong>${quote.amount ? money(quote.amount) : 'Revisar el detalle'}</strong></article>`)].join('');
    return block('Propuestas de ejemplo', 'El monto proviene del catálogo del prototipo; el envío siempre queda simulado.', body ? `<div class="crm2-quote-list">${body}</div>` : empty('Todavía no hay propuestas', 'Abre una ficha y prepara una propuesta para crear el primer borrador.')) +
      `<details class="crm2-fold"><summary>Datos que se confirman antes de compartir</summary><div class="crm2-fold-body"><p>Contacto, volumen, compatibilidad y disponibilidad se confirman con la cuenta. El prototipo no consulta stock ni envía mensajes reales.</p></div></details>`;
  }

  function marketingToday() {
    const ready = leadsReady();
    const returned = returnedLeads();
    const referralRequests = (appState().referralRequests || []).filter(item => item.status === 'Por confirmar');
    const sales = salesInPeriod();
    const sql = leads().filter(lead => statusOfLead(lead).startsWith('SQL')).length;
    const mql = leads().filter(isMql).length;
    const leadBody = ready.length ? limitedList(ready, lead => row(contactName(lead), companyName(lead), `Interés ${interestLabel(lead)} · Valor ${scoreValue(lead)?.puntaje ?? 0}/100`, `data-c2="open-lead" data-id="${esc(lead.id)}"`, permissionShort(lead)), 'Ver todos los leads') : empty('No hay un lead listo para pasar', 'La calificación requiere contacto identificado, negocio B2B, permiso y 40 puntos de interés.');
    const returnedBody = returned.length ? limitedList(returned, lead => row(contactName(lead), `${companyName(lead)} · ${sourceOf(lead)}`, `Motivo: ${progressFor(lead).motivoDevolucion || progressFor(lead).motivo || 'revisar ficha'}`, `data-c2="open-lead" data-id="${esc(lead.id)}"`, 'Devuelto por Ventas')) : `<div class="crm2-inline-note">Sin devoluciones pendientes.</div>`;
    const referralBody = referralRequests.length ? `<div class="crm2-list">${limitedList(referralRequests, item => { const lead = leadById(item.leadId) || {}; return row(contactName(lead), `${companyName(lead)} · ${item.reason}`, item.status, `data-c2="open-lead" data-id="${esc(item.leadId)}"`, 'Referido'); }, 'Ver todos los referidos')}</div>` : '';
    return marketingDraftBlock() + block('Para pasar a Ventas', '', leadBody) + `<details class="crm2-fold"><summary>Traspaso y ventas</summary><div class="crm2-fold-body"><p>${mql} MQL · ${sql} SQL aceptados</p><p>Ventas del período de prueba <b>${money(sales)}</b></p>${returnedBody}${referralBody}</div></details>`;
  }
  function marketingDraftBlock() {
    const segments = Object.keys(D.SEGMENT_CONTENT || {});
    if (!segments.length) return '';
    const draft = appState().marketingDraft;
    const options = segments.map(segment => `<option${draft?.segment === segment ? ' selected' : ''} value="${esc(segment)}">${esc(segment === 'OCS' ? 'Oficinas' : segment)}</option>`).join('');
    const preview = draft ? `<section class="crm2-draft-preview" data-crm2-draft-preview tabindex="-1" aria-labelledby="crm2-draft-heading"><h3 id="crm2-draft-heading">Vista previa</h3><p class="crm2-draft-state" role="status">${draft.confirmedAt ? 'Borrador confirmado' : 'Borrador creado'}</p><p><strong>${esc(draft.subject)}</strong></p><p>${esc(draft.body)}</p><a href="guia-servicio-cafe.html">Guía para planificar el servicio de café</a>${draft.confirmedAt ? '' : `<div>${primary('Confirmar borrador', 'confirm-marketing-draft')}</div>`}</section>` : '';
    const generate = draft && !draft.confirmedAt ? secondary : primary;
    return block('Contenido de campaña', '', `<div class="crm2-draft-controls"><label>Negocio<select data-crm2-draft-segment>${options}</select></label>${generate(draft ? 'Generar otro borrador' : 'Generar borrador', 'generate-marketing-draft')}</div>${preview}`, 'crm2-draft-block');
  }
  function generateMarketingDraft(confirm) {
    if (currentState().role !== 'marketing') return;
    if (confirm) {
      if (!appState().marketingDraft || appState().marketingDraft.confirmedAt) return;
      save(crm => { crm.marketingDraft.confirmedAt = now(); });
    } else {
      const segment = root()?.querySelector('[data-crm2-draft-segment]')?.value;
      const source = D.SEGMENT_CONTENT?.[segment];
      if (!source?.nutre) return;
      const audience = segment === 'OCS' ? 'oficinas' : segment.toLocaleLowerCase('es-CL');
      save(crm => { crm.marketingDraft = { segment, subject: source.nutre, body: `¿Estás organizando el servicio de café para ${audience}? Revisa qué productos necesitas, cuánto sirves al día y cómo organizar la reposición. La guía te ayuda a preparar esos datos antes de cotizar.`, createdAt: now() }; });
    }
    render();
    root()?.querySelector('[data-crm2-draft-preview]')?.focus();
  }
  function marketingChannels() {
    const bySource = new Map();
    for (const lead of leads()) {
      const source = sourceOf(lead);
      const item = bySource.get(source) || { count:0, mql:0, sql:0 };
      item.count += 1;
      if (isMql(lead)) item.mql += 1;
      if (statusOfLead(lead).startsWith('SQL')) item.sql += 1;
      bySource.set(source, item);
    }
    const channels = [...bySource.entries()].sort((a,b) => b[1].count-a[1].count);
    const rows = channels.length ? limitedList(channels, ([source,item]) => row(source, `${item.count} leads · ${item.mql} MQL · ${item.sql} SQL`, 'Conteo · dato de prueba', 'data-c2-go="R12"', 'Ver leads'), 'Ver todos los orígenes') : empty('Sin origen registrado','Los contactos aparecen cuando existe una fuente en el registro.');
    return block('Leads, MQL y SQL por origen', 'El origen orienta la revisión; no demuestra que el canal causó la venta.', `<div class="crm2-list">${rows}</div>`) +
      block('Ventas del período', 'Total agregado del prototipo; no se atribuye ingreso a un canal.', `<div class="crm2-inline-note"><b>${money(salesInPeriod())} · Dato de prueba</b></div>`);
  }
  function marketingLeads() {
    const list = sortedNewest(leads());
    const renderLead = lead => {
      const pass = progressFor(lead);
      const action = `data-c2="open-lead" data-id="${esc(lead.id)}"`;
      return row(contactName(lead), `${companyName(lead)} · Llegó por ${sourceOf(lead)} · ${permissionShort(lead)}`, `Interés ${interestLabel(lead)} · Valor ${scoreValue(lead)?.puntaje ?? 0}/100`, action, pass.estado === 'devuelto' ? `Devuelto: ${pass.motivoDevolucion || pass.motivo || 'motivo registrado'}` : statusOfLead(lead));
    };
    const items = list.length ? limitedList(list, renderLead, 'Ver todos los leads') : empty('Sin leads registrados','No se encontraron contactos en M4D.PROSPECTS.');
    return block('Contactos más recientes', 'Origen y campaña quedan visibles; el puntaje prioriza, no excluye.', items) +
      `<details class="crm2-fold"><summary>Cómo se interpreta el puntaje</summary><div class="crm2-fold-body"><p>Interés mide acciones; valor esperado combina tazas, rubro, zona, locales y margen. Marketing no ve montos individuales.</p></div></details>` + buyerCrmLink();
  }
  function recoveryCandidates() {
    const list = leads();
    const data = [];
    const live = currentState();
    const requestLead = list.find(item => item.stage === 'Lead') || list[0];
    if (requestLead) {
      const scenario = Object.assign({}, requestLead, { marketingConsent:false, requestedReply:true, crm2DemoRequest:true, dataTest:true });
      data.push({ type:'request', item:scenario, reason:'Solicitud de respuesta · dato de prueba', permission:permission(scenario) });
    }
    if (live.lead && live.proposal && !['aceptada','aprobada'].includes(live.proposal.status)) data.push({ type:'lead', item:live.lead, reason:'Vio una propuesta sin aceptarla', permission:permission(live.lead) });
    list.filter(item => permission(item).key === 'no' || permission(item).key === 'unknown').slice(0,2).forEach(item => data.push({ type:'lead', item, reason:permission(item).key === 'no' ? 'Sin permiso de promoción' : 'Permiso sin dato', permission:permission(item) }));
    const abandoner = list.find(item => item.stage === 'Lead' || Number(scoreInterest(item)?.puntaje || 0) < 40);
    if (abandoner) data.push({ type:'lead', item:abandoner, reason:'Abandonó antes de calificar', permission:permission(abandoner) });
    accounts().filter(account => Number(accountStats(account).lastAgo) > Number(accountStats(account).freqDays) && !openTickets(account.id).length).slice(0,2).forEach(item => data.push({ type:'account', item, reason:'Cliente inactivo sin ticket abierto', permission:permission(item) }));
    const stateRows = (appState().followups || []).filter(item => item.status === 'Programado' || item.status === 'Requiere aprobación');
    stateRows.forEach(item => data.push({ type:'followup', item, reason:item.reason || 'Seguimiento preparado', permission:permission(item) }));
    const seen = new Set();
    return data.filter(entry => { const id = `${entry.type}-${entry.item.id}`; if (seen.has(id)) return false; seen.add(id); return true; });
  }
  function marketingRecover() {
    const list = recoveryCandidates();
    const markup = list.length ? limitedList(list, entry => {
      const item = entry.item;
      const id = entry.type === 'followup' ? item.leadId || item.id : item.id;
      const title = entry.type === 'account' ? item.name : contactName(item);
      const permissionLabel = entry.permission.label;
      const restricted = entry.permission.key !== 'yes';
      const content = entry.type === 'account' ? 'Revisar servicio antes de una promoción.' : (D.SEGMENT_CONTENT?.[item.business]?.nutre || D.SEGMENT_CONTENT?.[item.business]?.explora || 'Pieza sugerida según el segmento; revisar antes de usar.');
      const requested = Boolean(item.requestedReply || item.request?.reply);
      const replyControl = restricted ? requested ? secondary('Responder solicitud','reply-request',`data-id="${esc(id)}" ${item.crm2DemoRequest ? 'data-demo-request="true"' : ''}`) : `<span class="crm2-blocked-copy">Sin solicitud de respuesta; no contactar.</span>` : secondary('Programar','schedule',`data-id="${esc(id)}" data-kind="${entry.type}"`);
      const permissionControl = !restricted ? secondary('Nutrir (con permiso)','nurture',`data-id="${esc(id)}"`) : `<span class="crm2-blocked-copy">Promoción bloqueada hasta registrar el permiso.</span>`;
      const openControl = entry.type !== 'account' ? secondary('Abrir ficha','open-lead',`data-id="${esc(id)}"`) : secondary('Abrir ficha','open-account',`data-id="${esc(id)}"`);
      return `<article class="crm2-recovery-row"><div><p class="crm2-eyebrow">${esc(entry.reason)}</p><h3>${esc(title)}</h3><p>${esc(entry.type === 'account' ? item.business || 'Cuenta' : companyName(item))} · ${esc(sourceOf(item))}</p><div class="crm2-recovery-meta">${statusPill(permissionLabel, restricted ? 'blocked' : 'good')}<span>${esc(content)}</span></div><div class="crm2-row-actions">${openControl}${replyControl}${permissionControl}</div></div></article>`;
    }, 'Ver todos los seguimientos') : '';
    const body = markup || empty('No hay seguimientos preparados','Cuando un contacto se estanque, el motivo y su permiso aparecerán aquí.');
    return block('Recuperación por motivo', 'Los casos con promoción bloqueada solo permiten responder una solicitud que la persona inició.', body) + marketingActivity();
  }
  function marketingActivity() {
    const s = currentState();
    const events = (s.events || []).map(event => ({ kind:event.eventName || 'Actividad', actor:event.actor_name || event.actor_role || 'CRM', at:event.at, text:event.label || event.text || event.eventName || 'Actividad registrada' }));
    const emails = (s.emails || []).filter(email => /^E\d{2}$/.test(email.journeyCode || '')).map(email => ({ kind:'Correo generado', actor:email.from || 'Marley Coffee', at:email.at, text:email.subject || 'Correo guardado en la prueba', emailId:email.journeyCode, href:email.href }));
    const allFeed = [...events, ...emails].sort((a,b) => Number(b.at || 0) - Number(a.at || 0));
    const feed = allFeed.slice(0,5);
    const welcome = emails.find(email => email.emailId === 'E01');
    if (welcome && !allFeed.includes(welcome)) allFeed.push(welcome);
    const older = allFeed.filter(item => !feed.includes(item));
    const renderFeed = items => `<ol class="m7c-feed">${items.map(item => `<li><span class="m7c-feed-dot" aria-hidden="true"></span><div><p class="m7c-feed-meta">${esc(item.kind)} · <time>${esc(fmtDate(item.at))}</time></p><h3>${esc(item.actor)}</h3><p>${esc(item.text)}</p>${item.emailId ? `<a class="m7c-email-template-link" href="${esc(item.href || `captacion/correos/${item.emailId}.html`)}" target="_blank" rel="noopener">Abrir correo ${esc(item.emailId)}</a>` : ''}</div></li>`).join('')}</ol>`;
    const body = feed.length ? `${renderFeed(feed)}${older.length ? `<details class="crm2-fold"><summary>Ver actividad anterior (${older.length})</summary>${renderFeed(older)}</details>` : ''}` : empty('Sin actividad registrada','Los eventos y correos de prueba del contacto aparecerán aquí cuando existan.');
    return block('Actividad del contacto', 'Historial local; un correo generado aquí no significa que se haya enviado.', body);
  }
  function campaignRows() {
    const grouped = new Map();
    leads().forEach(lead => {
      const campaign = campaignOf(lead);
      if (!grouped.has(campaign)) grouped.set(campaign, []);
      grouped.get(campaign).push(lead);
    });
    return [...grouped.entries()].filter(([name]) => name && name !== 'Sin campaña asociada').map(([name, people]) => ({ name, people }));
  }
  function marketingCampaigns() {
    const campaigns = campaignRows();
    const body = campaigns.length ? campaigns.slice(0,4).map(campaign => {
      const leadsHtml = campaign.people.slice(0,3).map(lead => `<button class="crm2-campaign-lead" type="button" data-c2="open-lead" data-id="${esc(lead.id)}"><b>${esc(contactName(lead))}</b><span>${esc(sourceOf(lead))}</span></button>`).join('');
      return `<article class="crm2-campaign"><div><p class="crm2-eyebrow">CAMPAÑA · DATO DE PRUEBA</p><h3>${esc(campaign.name)}</h3><p>${campaign.people.length} contacto${campaign.people.length === 1 ? '' : 's'} con ese origen registrado.</p></div><details><summary>Ver piezas y contactos</summary><div class="crm2-campaign-details"><p><b>Origen:</b> ${esc(campaign.name)}</p><p><b>Pieza:</b> ${esc(pieceOf(campaign.people[0]))}</p><p><b>Contenido del rubro:</b> ${esc(D.SEGMENT_CONTENT?.[campaign.people[0]?.business]?.explora || 'Sin pieza asociada en el registro.')}</p>${leadsHtml}</div></details></article>`;
    }).join('') : empty('Sin campañas registradas','El origen del contacto se conserva aunque no haya una campaña asociada.');
    const tactics = Object.entries(D.FLY_TACTICS || {}).map(([stage, items]) => `<details><summary>${esc(stage)} · ${items.length} tácticas</summary><div class="crm2-tactic-list">${items.slice(0,3).map(item => `<p><b>${esc(item.t)}</b><span>${esc(item.m || item.d)}</span></p>`).join('')}</div></details>`).join('');
    return marketingDraftBlock() + block('Campañas y origen', '', body) + `<details class="crm2-fold"><summary>Contenido del flywheel</summary><div class="crm2-fold-body">${tactics || 'Sin tácticas registradas.'}</div></details>`;
  }

  function salesInPeriod() {
    const cutoff = Number(D.REF || now()) - 90 * Number(D.DAY || 86400000);
    return accounts().flatMap(item => item.orders || []).filter(order => Number(order.at || 0) >= cutoff).reduce((sum, order) => sum + Number(order.total || 0), 0);
  }
  function digitalReorderMetrics() {
    const orders = accounts().flatMap(item => item.orders || []);
    const received = orders.filter(order => order.receivedAt).length;
    const known = orders.filter(order => isRepeatOrder(order) && reorderChannel(order));
    if (!known.length) return { value:'Pendiente', note:`Se calcula con los pedidos repetidos del portal: aparece cuando una cuenta confirma un segundo pedido · ${received} recepciones confirmadas · meta 40 %` };
    const digital = known.filter(order => /portal|digital|web/i.test(reorderChannel(order))).length;
    return { value:`${Math.round(digital / known.length * 100)} %`, note:`${digital} de ${known.length} pedidos repetidos con canal registrado · ${received} recepciones confirmadas · meta 40 %` };
  }
  function metric(label, value, note, key = false) { return `<article class="crm2-metric"><span>${esc(label)}</span><b class="${key ? 'crm2-metric-key' : ''}">${esc(value)}</b><small>${esc(note)}</small></article>`; }
  function managerSummary() {
    const sales = salesInPeriod();
    const sql = leads().filter(lead => statusOfLead(lead).startsWith('SQL')).length;
    const goal = Number(appState().goalSales || 0);
    const qualified = leads().filter(isMql).length;
    const npsInfo = npsSummary();
    const digital = digitalReorderMetrics();
    const approvals = pendingApprovals();
    const followups = managerFollowups();
    const quickReview = [
      ['Propuestas', approvals.find(item => item.tipo !== 'referido')],
      ['Referidos', approvals.find(item => item.tipo === 'referido')],
      ['Recuperación', followups.find(item => item.status === 'Requiere aprobación')],
      ['Permisos', followups.find(item => item.status === 'Bloqueado')],
    ].map(([label, item]) => item
      ? row(label, item.titulo || item.name, '', `data-c2="review-approval" data-id="${esc(item.id)}"`, item.status === 'Bloqueado' ? 'Falta permiso' : '')
      : `<p class="crm2-queue-empty"><strong>${label}</strong> · Sin pendientes</p>`).join('');
    const salesNote = goal > 0 ? `${Math.round(sales / goal * 100)} % de la meta ingresada (${money(goal)}); datos de prueba` : 'Meta comercial sin registrar · muestra financiera de prueba';
    const metricGrid = `<div class="crm2-metrics">${metric('Ventas netas · 90 días', money(sales), salesNote, true)}${metric('Leads calificados', String(qualified), `${sql} SQL aceptados · meta del informe: +25 % vs base; base sin registrar`)}${metric('Reposición digital', digital.value, digital.note)}${npsMetric(npsInfo)}</div>`;
    const details = `<details class="crm2-fold"><summary>Todos los indicadores</summary><div class="crm2-fold-body crm2-kpi-details">${labelValue('Retención','Meta 90 % · base 86 %')}${labelValue('Quiebres OCS','Meta: −30 %')}${labelValue('OTIF','Meta: 96 %')}${labelValue('Ticket neto','Meta: +10 % en cuentas activadas')}${labelValue('Cuentas activadas','Meta: 100 en doce meses')}${labelValue('CAC','Escenario del piloto · revisar en Metas y canales')}</div></details>`;
    return block('Por aprobar', '', quickReview, 'crm2-approval-queue') + `<details class="crm2-fold"><summary>Resultados del programa</summary><div class="crm2-fold-body">${metricGrid}${details}</div></details>`;
  }
  function approvalSampleItems() {
    const s = currentState();
    const actual = (s.jefeAprob || []).slice();
    const existingIds = new Set(actual.map(item => item.id));
    const sample = [];
    const lead = leads().find(item => item.stage === 'MQL') || leads()[0];
    const referralAccount = accountById(appState().referralReview?.accountId) || accounts().find(item => item.referral);
    if (lead && !existingIds.has('crm2-sample-proposal')) {
      const pack = packDescription(lead);
      sample.push({ id:'crm2-sample-proposal', leadId:lead.id, cuenta:lead.id, titulo:`Propuesta especial · ${companyName(lead)}`, tipo:'descuento fuera de lista', detalle:'Dato de prueba · descuento fuera de lista; monto excepcional no registrado. El pack de catálogo es solo referencial.', motivo:'Excepción comercial', monto:pack.amount, estado:'pendiente', dataTest:true, lead });
    }
    if (referralAccount && !existingIds.has('crm2-sample-referral')) {
      sample.push({ id:'crm2-sample-referral', cuenta:referralAccount.id, leadId:referralAccount.id, titulo:`Beneficio por referido · ${referralAccount.name}`, tipo:'referido', detalle:`Dato de prueba · ${referralAccount.referral}. Confirmar permiso, vínculo B2B y beneficio.` , motivo:'Canje de referido', estado:'pendiente', dataTest:true, account:referralAccount });
    }
    return [...actual.filter(item => ['pendiente','pidio_info'].includes(item.estado)), ...sample.filter(item => !actual.some(a => a.id === item.id))];
  }
  function pendingApprovals() { return approvalSampleItems().filter(item => ['pendiente','pidio_info'].includes(item.estado)); }
  function managerFollowups() {
    const records = appState().followups || [];
    const saved = records.filter(item => ['Requiere aprobación', 'Bloqueado'].includes(item.status));
    const firstMql = leads().find(lead => lead.stage === 'MQL') || leads()[0];
    const noPermissionLead = leads().find(lead => lead.stage === 'Lead') || leads().at(-1);
    const samples = [
      ...(firstMql ? [{ id:'CRM2-DEMO-APPROVAL', leadId:firstMql.id, name:contactName(firstMql), reason:'Dato de prueba · pieza promocional requiere revisión humana.', status:'Requiere aprobación', dataTest:true }] : []),
      ...(noPermissionLead ? [{ id:'CRM2-DEMO-BLOCKED', leadId:noPermissionLead.id, name:contactName(noPermissionLead), reason:'Dato de prueba · permiso promocional sin registro.', status:'Bloqueado', dataTest:true }] : []),
    ];
    return [...saved, ...samples.filter(example => !records.some(item => item.id === example.id || item.status === example.status))];
  }
  function managerApprovals() {
    const firstSelected = (left, right) => Number(right.id === selectedReviewId) - Number(left.id === selectedReviewId);
    const items = pendingApprovals().sort(firstSelected);
    const body = items.length ? items.map(item => {
      const isReferralApproval = item.tipo === 'referido';
      const amount = item.monto ? `<div class="crm2-approval-amount"><small>${item.tipo === 'referido' ? 'Monto de beneficio no registrado' : 'Pack de catálogo · referencial'}</small><b>${money(item.monto)}</b></div>` : '<span class="crm2-inline-note">Monto no registrado</span>';
      const referralAccount = isReferralApproval ? accountById(item.cuenta) : null;
      const referralChecklist = item.checklist || {};
      const permissionVerified = referralChecklist.permission === true && permission(referralAccount).key === 'yes';
      const b2bVerified = referralChecklist.b2b === true && Boolean(referralAccount?.business);
      const benefitVerified = referralChecklist.benefit === true && Boolean(item.benefit || item.beneficio);
      const canApprove = !isReferralApproval || (permissionVerified && b2bVerified && benefitVerified);
      const decisionStatus = item.estado === 'pidio_info' ? 'Información solicitada a Ventas' : 'Pendiente de decisión';
      const checks = isReferralApproval ? `<ul class="crm2-checklist"><li>${statusPill(`Permiso del referido · ${permissionVerified ? 'registrado' : 'por confirmar'}`,permissionVerified ? 'good' : 'wait')}</li><li>${statusPill(`Negocio B2B · ${b2bVerified ? 'registrado' : 'por confirmar'}`,b2bVerified ? 'good' : 'wait')}</li><li>${statusPill(`Beneficio · ${benefitVerified ? 'registrado' : 'por confirmar'}`,benefitVerified ? 'good' : 'wait')}</li></ul>${!canApprove ? '<p class="crm2-small-note">Aprobar queda bloqueado hasta registrar los tres datos. No se asigna un monto al beneficio.</p>' : ''}` : `<ul class="crm2-checklist"><li>${statusPill('Excepción y motivo · revisar','wait')}</li><li>${statusPill('Monto del catálogo · referencial','wait')}</li></ul>`;
      return `<article class="crm2-approval" data-approval="${esc(item.id)}"><div class="crm2-approval-head"><div><p class="crm2-eyebrow">${item.dataTest ? 'DATO DE PRUEBA' : 'SOLICITUD'} · ${esc(item.tipo || 'excepción')}</p><h3>${esc(item.titulo || 'Solicitud pendiente')}</h3><p>${esc(item.detalle || item.motivo || 'Motivo sin registro')}</p></div>${amount}</div>${statusPill(decisionStatus,item.estado === 'pidio_info' ? 'wait' : '')}${checks}<label class="crm2-note-field">Nota para Ventas<input type="text" data-approval-note="${esc(item.id)}" value="${esc(item.nota || '')}" placeholder="Escribe qué falta confirmar"></label><div class="crm2-row-actions">${primary('Aprobar','decide-approval',`data-id="${esc(item.id)}" data-decision="aprobada" ${canApprove ? '' : 'disabled title="Faltan datos verificables del referido"'}`)}${secondary('Pedir información','decide-approval',`data-id="${esc(item.id)}" data-decision="pidio_info"`)}${secondary('Rechazar','decide-approval',`data-id="${esc(item.id)}" data-decision="descartada"`)}</div></article>`;
    }).join('') : empty('No hay solicitudes pendientes','Las decisiones registradas quedan vinculadas a su propuesta o referido.');
    const followups = managerFollowups().sort(firstSelected);
    const followupHtml = followups.length ? `<div class="crm2-list">${followups.map(item => {
      const person = leadById(item.leadId) || accountById(item.leadId);
      const approvedPermission = permission(person).key === 'yes' && item.status === 'Requiere aprobación';
      const direct = approvedPermission ? primary('Aprobar recuperación', 'approve-recovery', `data-id="${esc(item.id)}"`) : '';
      return `<article class="crm2-followup-review" data-followup="${esc(item.id)}"><p>${esc(item.name)} · ${esc(item.status === 'Bloqueado' ? 'Bloqueado: falta permiso' : item.status)}</p><p>${esc(item.reason)}</p><div class="crm2-row-actions">${direct}${secondary('Revisar permiso','review-followup',`data-id="${esc(item.leadId || item.id)}"`)}</div></article>`;
    }).join('')}</div>` : `<div class="crm2-inline-note">Los seguimientos sin permiso de promoción permanecen bloqueados.</div>`;
    const proposals = block('Solicitudes de Ventas', 'Aprobar, pedir información o rechazar; la respuesta vuelve a la ficha.', body);
    const recovery = block('Seguimientos preparados', 'Un bloqueo de permiso no ofrece un botón para enviar.', followupHtml);
    return followups[0]?.id === selectedReviewId ? recovery + proposals : proposals + recovery;
  }
  function saveMetaForm() {
    const goal = appState().goalSales;
    const cac = appState().cac || {};
    const spend = Number(cac.search ?? 600000) + Number(cac.linkedin ?? 1000000) + Number(cac.meta ?? 400000);
    const accountsCount = Number(cac.newAccounts || 0);
    const result = accountsCount > 0 ? money(spend / accountsCount) : 'Ingresa cuentas nuevas';
    const config = typeof P.config === 'function' ? P.config() : (P.config || {});
    const scores = Object.entries(config.pesos || {}).map(([name, value]) => labelValue(config.pesoLabels?.[name] || name.replace(/([A-Z])/g,' $1'), `${Math.round(Number(value) * 100)} %`)).join('');
    return `<div class="crm2-goal-form"><label>Meta comercial en pesos<input type="number" min="0" inputmode="numeric" data-c2-field="goalSales" value="${esc(goal || '')}" placeholder="Ingresa la meta registrada"></label><button type="button" class="crm2-btn crm2-btn--secondary" data-c2="save-goal">Guardar meta</button><small>La meta de ventas se registra separada de la meta operativa de reposición.</small></div>
      <details class="crm2-fold"><summary>Calculadora de costo por adquisición · escenario del piloto</summary><div class="crm2-fold-body"><p>Escenario de 90 días · datos de prueba. Cambia gasto y cuentas nuevas para recalcular; no representa gasto conectado.</p><div class="crm2-cac-grid"><label>Search<input type="number" min="0" inputmode="numeric" data-cac="search" value="${esc(cac.search ?? 600000)}"></label><label>LinkedIn<input type="number" min="0" inputmode="numeric" data-cac="linkedin" value="${esc(cac.linkedin ?? 1000000)}"></label><label>Meta<input type="number" min="0" inputmode="numeric" data-cac="meta" value="${esc(cac.meta ?? 400000)}"></label><label>Cuentas nuevas de prueba<input type="number" min="0" inputmode="numeric" data-cac="newAccounts" value="${esc(cac.newAccounts ?? '')}" placeholder="Ingresa el conteo"></label></div><div class="crm2-cac-result"><span>Gasto total del escenario</span><b>${money(spend)}</b><span>Costo por adquisición</span><b>${esc(result)}</b></div><p class="crm2-small-note">ROAS para cubrir pauta: 3,57× · margen 35 % × incrementalidad 80 % (EP5).</p><button type="button" class="crm2-btn crm2-btn--secondary" data-c2="save-cac">Guardar escenario</button></div></details>
      <details class="crm2-fold"><summary>Puntaje y fundamento</summary><div class="crm2-fold-body"><p>Interés: señales verificables de compra. Valor esperado: tazas 35 %, rubro 25 %, zona 20 %, locales 10 % y margen 10 %. El margen base es 35 % parejo y queda por calibrar.</p><p>Priorizar no excluye: atender ya, atender normal, recuperar con prioridad y nutrir en lote.</p><div class="crm2-kpi-details">${scores || '<p>Pesos disponibles en R6P.</p>'}</div><button type="button" class="crm2-btn crm2-btn--secondary" data-c2-go="R09">Abrir fundamento del puntaje</button></div></details>`;
  }
  function managerGoals() {
    const rows = sortedNewest(leads()).slice(0,4).map(lead => row(contactName(lead), `${companyName(lead)} · ${sourceOf(lead)}`, `${interestLabel(lead)} interés · ${scoreValue(lead)?.puntaje ?? 0}/100 valor`, `data-c2="open-lead" data-id="${esc(lead.id)}"`, 'Dos ejes')).join('');
    return block('Meta editable', 'El valor monetario queda vacío hasta que Jefatura registre el objetivo aprobado.', saveMetaForm()) + block('Canales y oportunidades', 'Origen y actividad del contacto ayudan a distribuir la atención.', `<div class="crm2-list">${rows || empty('Sin contactos','')}</div>`);
  }
  function managerTeam() {
    const countByRole = (role) => role === 'ventas' ? leads().length : role === 'marketing' ? leadsReady().length : pendingApprovals().length;
    const work = `<div class="crm2-team-grid">${Object.entries({ventas:'Contactos a cargo',marketing:'Listos para pasar',jefatura:'Pendientes de aprobación'}).map(([role,label])=>`<article><span>${esc(label)}</span><b>${countByRole(role)}</b><small>${role === 'ventas' ? 'Dato de prueba · equipo comercial' : role === 'marketing' ? 'Dato de prueba · calificación' : 'Solicitudes por revisar'}</small></article>`).join('')}</div>`;
    const tickets = window.M4R3?.postventa?.() || [];
    const open = tickets.filter(ticket => !/cerrad|resuelt|finaliz/i.test(String(ticket.status || '')));
    const ops = open.slice(0,3).map(ticket => row(ticket.customer?.name || ticket.folio || 'Caso de postventa', `${ticket.type || 'Incidencia'} · ${ticket.status || 'Recibido'}`, ticket.responsible || 'Responsable sin dato', `data-c2="open-account" data-id="${esc(ticket.customerId || ticket.folio)}"`, 'Postventa')).join('');
    return block('Carga y operación del equipo', 'Conteos del prototipo; no son productividad ni niveles de servicio reales.', work) + block('Postventa primero', 'Los casos abiertos se revisan antes de preparar una venta.', `<div class="crm2-list">${ops || empty('Sin tickets abiertos','Postventa no registra casos pendientes.')}</div><details class="crm2-fold"><summary>CRM por comprador y etapas</summary><div class="crm2-fold-body"><p>Acceso preservado en <a href="#R17" data-c2-go="R17">CRM por comprador</a>, con permisos y siguiente acción.</p></div></details>`) + block('Alertas de stock', 'Escenario de prueba; sin inventario real.', stockBlockBody());
  }
  function managerOperations() {
    const all = accounts();
    const tickets = window.M4R3?.postventa?.() || [];
    const open = tickets.filter(ticket => !/cerrad|resuelt|finaliz/i.test(String(ticket.status || '')));
    const risk = all.filter(accountAtRisk);
    const body = [...open.slice(0,3).map(ticket => row(ticket.customer?.name || ticket.folio, `${ticket.type || 'Postventa'} · ${ticket.status || 'Recibido'}`, ticket.responsible || 'Equipo sin asignar', `data-c2="open-account" data-id="${esc(ticket.customerId || ticket.folio)}"`, 'Postventa')), ...risk.slice(0,2).map(account => accountRow(account,'risk'))].join('');
    return block('Casos que requieren revisión', 'Postventa abierta y cuentas cuyo ciclo de compra necesita una comprobación humana.', `<div class="crm2-list">${body || empty('Sin alertas operativas','No hay casos o ciclos vencidos en los datos de prueba.')}</div>`) + `<details class="crm2-fold"><summary>Pedidos e inventario</summary><div class="crm2-fold-body"><p>El prototipo usa historial local; stock, despacho y OTIF no están conectados. Confirma las fuentes operativas antes de comprometer disponibilidad.</p><a class="crm2-text-link" href="#R17" data-c2-go="R17">Ver CRM por comprador</a></div></details>`;
  }

  function getSelected() {
    const s = appState();
    const legacySelection = currentState().sel;
    const selectedLead = s.selectedLead || (!s.selectedAccount && legacySelection && !String(legacySelection).startsWith('AC-') ? legacySelection : null);
    const selectedAccount = s.selectedAccount || (!s.selectedLead && String(legacySelection || '').startsWith('AC-') ? legacySelection : null);
    const lead = selectedLead ? leadById(selectedLead) : null;
    const account = selectedAccount ? accountById(selectedAccount) : null;
    return { lead: lead || (account ? null : leads()[0] || null), account };
  }
  function activityFor(lead) {
    const events = (lead?.events || []).map(event => ({ label:event.label || event.key || 'Actividad', at:event.at || lead.at, source:'Evento' }));
    const m4Events = (currentState().events || []).filter(event => event.leadId === lead?.id || event.id === lead?.id).map(event => ({ label:event.label || event.eventName || event.text, at:event.at, source:'CRM' }));
    const approvalEvents = (currentState().actividadJefe || []).filter(event => String(event.id) === String(lead?.id)).map(event => ({ label:event.text || 'Decisión de Jefatura', at:event.at, source:'Jefatura' }));
    const followupEvents = (appState().followups || []).filter(event => String(event.leadId) === String(lead?.id)).map(event => ({ label:`${event.status || 'Seguimiento'} · ${event.reason || event.channel || 'contacto preparado'}`, at:event.at, source:'Seguimiento' }));
    const contactEvent = appState().contacted?.[lead?.id] ? [{ label:'Contacto registrado', at:appState().contacted[lead.id].at, source:'Ventas' }] : [];
    const progress = progressFor(lead || {});
    const transferEvents = progress.estado ? [{ label:`${statusOfLead(lead)}${progress.motivoDevolucion ? ` · ${progress.motivoDevolucion}` : ''}`, at:progress.at, source:'Traspaso' }] : [];
    return [...events, ...m4Events, ...approvalEvents, ...followupEvents, ...contactEvent, ...transferEvents].sort((a,b)=>Number(b.at||0)-Number(a.at||0)).slice(0,5);
  }
  function postventaFor(account) { return openTickets(account?.id); }
  function productNames(order) {
    return (order?.items || []).map(item => `${productLabel(item.p ?? item.k)} × ${item.qty}`).join(' · ') || 'Productos sin detalle';
  }
  function accountValue(account) {
    const value = scoreAccount(account);
    return value?.valor?.puntaje ?? value?.puntaje ?? account?.st?.fin ?? 'Sin puntaje';
  }
  function npsChip(score) { return statusPill(`NPS ${score}/10 · ${score >= 9 ? 'promotor' : score >= 7 ? 'pasivo' : 'detractor'}`, score <= 6 ? 'blocked' : score >= 9 ? 'good' : ''); }
  function landingContext(lead) {
    if (!lead?.landing) return '';
    const touch = item => [item?.source || item?.params?.utm_source, item?.campaign || item?.params?.utm_campaign].filter(Boolean).join(' · ');
    const calc = lead.landing.calc;
    return `<details class="crm2-fold" data-crm2-landing-context><summary>Origen y contexto de la solicitud</summary><div class="crm2-fold-body">${labelValue('Primer origen', touch(lead.attribution?.firstTouch))}${labelValue('Último origen', touch(lead.attribution?.lastTouch))}${calc?.tocado ? labelValue('Consumo orientativo', `${calc.tazasDia} tazas al día`) : ''}</div></details>`;
  }
  function accountRecommendation(account) {
    const saved = appState().recommendations?.[account.id];
    return `<section class="crm2-inline-panel" tabindex="-1" aria-labelledby="crm2-recommend-title"><h2 id="crm2-recommend-title">Recomendar a otro negocio</h2><p>${esc(account.name)}</p><p>${saved ? 'Invitación de prueba guardada. El negocio decide si quiere recomendar.' : 'Prepara una invitación para que esta cuenta recomiende Marley Coffee a otro negocio.'}</p><div class="crm2-row-actions">${saved ? '' : primary('Guardar invitación','save-account-recommendation',`data-id="${esc(account.id)}"`)}${secondary('Cerrar','close-inline')}</div></section>`;
  }
  function detailPage(role) {
    const s = appState();
    const { lead, account } = getSelected();
    const isAccount = Boolean(account);
    const item = account || lead;
    if (!item) return block('Ficha del cliente','No hay un registro seleccionado.',empty('Sin ficha','Vuelve a la lista para elegir un contacto o cuenta.'));
    const origin = sourceOf(item);
    const priority = isAccount ? (accountNeedsReorder(account) ? 'Toca reponer' : (riskReason(account).startsWith('Postventa') || isDetractor(account) ? 'Servicio primero' : 'Cliente activo')) : priorityLabel(lead);
    const value = isAccount ? `Valor de cuenta · ${accountValue(account)}/100` : valueLabel(lead);
    const perm = permission(item);
    const identity = `<div class="crm2-detail-identity"><div><p class="crm2-eyebrow">${esc(isAccount ? 'CUENTA' : 'CONTACTO')} · ${esc(isAccount ? item.id : item.id || 'Dato de prueba')}</p></div><div class="crm2-detail-chips">${statusPill(priority, priority.includes('Servicio') ? 'blocked' : '')}${statusPill(value,'')}${statusPill(origin,'')}${isAccount && lastNps(account) != null ? npsChip(lastNps(account)) : ''}${role === 'marketing' && !isAccount ? statusPill(perm.label,perm.key === 'yes' ? 'good' : 'wait') : ''}</div></div>`;
    const actionReason = lead ? whyValue(lead, role === 'jefatura' || role === 'ventas') : riskReason(account);
    const activity = isAccount ? `<div class="crm2-detail-facts">${labelValue('Frecuencia',accountStats(account).freqDays ? `Cada ${accountStats(account).freqDays} días` : 'Sin historial suficiente')}${labelValue('Última compra',accountStats(account).lastAgo == null ? 'Sin dato' : `Hace ${accountStats(account).lastAgo} días`)}${labelValue('Ticket promedio',Number.isFinite(Number(accountStats(account).avg)) ? money(accountStats(account).avg) : 'Sin dato')}</div>` : `<div class="crm2-detail-facts">${labelValue('Origen',origin)}${labelValue('Landing',item.landing?.slug || item.entryPage || 'Sin registro')}${labelValue('Campaña',campaignOf(item))}${labelValue('Primer contacto',fmtDate(item.at || item.createdAt))}</div><p class="crm2-score-reason">${esc(actionReason)}</p><div class="crm2-score-dual">${statusPill(`Interés · ${interestLabel(lead)}`)}${statusPill(`Valor esperado · ${scoreValue(lead)?.puntaje ?? 0}/100`)}</div>`;
    const interest = Number(scoreInterest(lead)?.puntaje || 0);
    const identified = Boolean(lead?.name || lead?.contactName) && Boolean(lead?.email || lead?.phone || lead?.company);
    const b2b = Boolean(lead?.business || lead?.company);
    const qualification = !isAccount && role === 'marketing' ? `<div class="crm2-qualification"><b>Requisitos para pasar a Ventas</b><ul class="crm2-checklist"><li>${statusPill(identified ? 'Contacto identificado' : 'Falta identificar el contacto',identified ? 'good' : 'wait')}<span>${identified ? 'Nombre y negocio registrados en esta muestra.' : 'Agrega un dato de contacto verificable.'}</span></li><li>${statusPill(b2b ? 'Negocio B2B registrado' : 'Falta confirmar B2B',b2b ? 'good' : 'wait')}<span>${esc(lead?.business || 'Tipo de negocio sin dato')} · validar que corresponda a una cuenta B2B.</span></li><li>${statusPill(perm.key === 'yes' ? perm.label : 'Falta permiso de promoción',perm.key === 'yes' ? 'good' : 'wait')}<span>Una solicitud de respuesta no habilita campañas.</span></li><li>${statusPill(interest >= 40 ? `Interés ${interest}/100 · cumple ≥ 40` : `Interés ${interest}/100 · falta llegar a 40`,interest >= 40 ? 'good' : 'wait')}<span>Interés y valor son ejes distintos; el valor no reemplaza estos requisitos.</span></li></ul></div>` : '';
    const history = activityFor(lead);
    const historyDetails = `<details class="crm2-fold"><summary>Ver actividad (${history.length})</summary><div class="crm2-fold-body">${history.map(event=>`<p class="crm2-activity"><b>${esc(event.label)}</b><small>${esc(event.source)} · ${fmtDate(event.at)}</small></p>`).join('') || '<p>Sin actividad registrada.</p>'}</div></details>`;
    const accountOrders = isAccount ? (item.orders || []).slice().reverse() : [];
    const quote = lead ? latestQuoteFor(lead) : null;
    const suggestion = lead ? packDescription(lead) : null;
    const purchase = isAccount ? `<div class="crm2-purchase-summary"><p><b>Último pedido</b><span>${esc(accountOrders[0]?.id || 'Sin pedido registrado')} · ${accountOrders[0]?.total ? money(accountOrders[0].total) : 'Sin monto'}</span></p><p><b>Productos</b><span>${esc(productNames(accountOrders[0]))}</span></p></div><details class="crm2-fold"><summary>Historial de compras (${accountOrders.length})</summary><div class="crm2-fold-body">${accountOrders.slice(0,5).map(order=>`<p class="crm2-activity"><b>${esc(order.id)} · ${money(order.total)}</b><small>${fmtDate(order.at)} · ${esc(order.status || 'Estado sin dato')}</small></p>`).join('') || '<p>Sin historial de compra.</p>'}</div></details>` : `<div class="crm2-purchase-summary"><p><b>Qué cotiza</b><span>${quote ? `${esc(quote.machine || 'Máquina')} · ${quote.amount ? money(quote.amount) : 'Monto por confirmar'} · ${esc(quote.status || 'Borrador')}` : `${esc(item.machine || 'Aún no cotiza')} · ${esc(item.volumen || 'Volumen sin confirmar')}`}</span></p><p><b>Sugerencia de Ventas</b><span>${esc(suggestion.name)} · ${esc(suggestion.kind)}${suggestion.amount ? ` · ${money(suggestion.amount)} referencial` : ''}</span></p><p><b>Por qué encaja</b><span>${esc(whyValue(lead,false))}</span></p></div><button type="button" class="crm2-text-link" data-c2-go="R08">Abrir en Propuestas</button>`;
    const convo = s.conversations?.[item.id] || (s.conv?.leadId === item.id ? s.conv.msgs || [] : []);
    const conversation = `<details class="crm2-fold"><summary>Conversación (${convo.length})</summary><div class="crm2-fold-body">${convo.map(message=>`<p class="crm2-activity"><b>${esc(message.from || 'Equipo')}</b><span>${esc(message.text || message.body || '')}</span></p>`).join('') || '<p>La conversación aparecerá aquí cuando se registre una propuesta o un mensaje simulado.</p>'}<button type="button" class="crm2-btn crm2-btn--secondary" data-c2="quote" data-id="${esc(item.id)}">Enviar propuesta por este chat</button></div></details>`;
    const tickets = isAccount ? postventaFor(account) : [];
    const referrerAccount = !isAccount && isReferral(item) ? accountById(item.referrerAccountId) : null;
    const referralDetails = isAccount && item.referral ? `<div class="crm2-referral-details"><b>Recomendación registrada</b>${labelValue('Recomendó',item.referral)}${labelValue('Permiso del referido','Pendiente de confirmar')}${labelValue('Negocio B2B',item.business ? `${item.business} · validar actividad y vínculo` : 'Sin dato')}${labelValue('Beneficio para quien refiere',item.benefit || item.beneficio || 'Sin beneficio registrado')}</div>` : !isAccount && isReferral(item) ? `<div class="crm2-referral-details"><b>Recomendación registrada</b>${labelValue('Origen','Origen referido')}${labelValue('Cuenta que recomienda',referrerAccount?.name || item.referrerAccountId || 'Sin cuenta asociada')}${labelValue('Código de referido',item.referralCode || 'Sin código registrado')}${labelValue('Negocio B2B',item.business ? `${item.business} · validar actividad y vínculo` : 'Sin dato')}${labelValue('Permiso del referido', item.referralPending ? 'Por confirmar con el negocio referido' : perm.label)}${labelValue('Beneficio para quien refiere',item.benefit || item.referralBenefit || 'Sin beneficio registrado · no pasa a Jefatura')}</div>` : '';
    const postventa = tickets.length ? `<div class="crm2-alert-panel"><b>Resolver postventa antes de vender</b><span>${esc(tickets[0].type || tickets[0].detail || 'Caso abierto')} · ${esc(tickets[0].status || 'Pendiente')}</span></div>` : '';
    const actions = isAccount
      ? role === 'ventas' ? '' : `<div class="crm2-detail-actions">${secondary('Preparar reposición', 'open-reorder', `data-id="${esc(item.id)}"`)}${secondary('Agendar contacto', 'start-followup', `data-id="${esc(item.id)}"`)}</div>`
      : role === 'ventas' ? '' : `<div class="crm2-detail-actions"><button class="crm2-btn crm2-btn--primary" type="button" data-c2="quote" data-id="${esc(item.id)}">Preparar propuesta</button>${role === 'marketing' ? `${isMql(item) ? statusPill('MQL registrado','good') : `<button class="crm2-btn crm2-btn--secondary" type="button" data-c2="mark-mql" data-id="${esc(item.id)}">Marcar como calificado (MQL)</button>`}${progressFor(item).estado ? statusPill(statusOfLead(item),progressFor(item).estado==='devuelto'?'blocked':'good') : `<button class="crm2-btn crm2-btn--secondary" type="button" data-c2="pass-sales" data-id="${esc(item.id)}">Pasar a Ventas</button>`}` : ''}</div>`;
    const referralDataAction = !isAccount && isReferral(item) && role === 'ventas' ? `<div class="crm2-detail-actions">${secondary('Pedir datos a Marketing','request-referral-data',`data-id="${esc(item.id)}"`)}</div>` : '';
    const permissionControls = !isAccount && role === 'marketing' ? `<p class="crm2-small-note">Registra una preferencia solo después de verificar la elección explícita del contacto.</p>${secondary('Confirmar permiso promocional','permission-yes',`data-id="${esc(item.id)}"`)} ${secondary('Registrar sin permiso','permission-no',`data-id="${esc(item.id)}"`)}` : '';
    const canSchedule = role !== 'marketing' || perm.key === 'yes';
    const scheduleControl = canSchedule ? secondary('Programar seguimiento','schedule',`data-id="${esc(item.id)}" data-kind="${isAccount ? 'account' : 'lead'}"`) : `<span class="crm2-blocked-copy">Marketing no programa promociones sin permiso registrado.</span>`;
    const permissionFirst = permissionReviewId === String(item.id);
    const folded = `<details class="crm2-fold" data-crm2-permissions${permissionFirst ? ' open' : ''}><summary>Permisos y preferencias</summary><div class="crm2-fold-body">${labelValue('Permiso de promoción',perm.label)}${permissionControls}${scheduleControl} ${secondary('Registrar contacto','mark-contacted',`data-id="${esc(item.id)}"`)}</div></details>`;
    const group1 = block('Quién es', '', identity + referralDetails + (isAccount ? liveReferralDetails(account) : ''));
    const group2 = block('Qué hizo', 'La actividad reciente explica el siguiente paso.', activity + qualification + historyDetails + (isAccount ? '' : conversation + landingContext(lead)));
    const recommendation = isAccount && role === 'ventas' && recommendationPanelId === String(item.id) ? accountRecommendation(item) : '';
    const group3 = block(isAccount ? 'Compra y reposición' : 'Qué cotiza y qué hacer ahora', isAccount ? 'Usa el historial para preparar la siguiente reposición.' : 'La sugerencia acompaña la decisión; precio y stock se confirman antes de compartir.', `${postventa}${isAccount && item.live ? livePurchase(account) : purchase}${isAccount ? replenishBlock(account) : ''}${actions}${referralDataAction}<div data-inline-panel>${recommendation}</div>${permissionFirst ? '' : folded}`);
    let actionbar = '';
    if (!isAccount && role === 'ventas') {
      const reasonSelect = `<select class="crm2-action-select" data-return-reason="${esc(item.id)}" aria-label="Motivo de devolución"><option value="">Motivo para devolver</option><option>Falta volumen</option><option>No contesta</option><option>Cotiza a futuro</option><option>Falta presupuesto</option></select>`;
      const exceptionSelect = `<select class="crm2-action-select" data-approval-kind="${esc(item.id)}" aria-label="Tipo de excepción"><option value="">Tipo de excepción</option><option>Descuento fuera de lista</option><option>Comodato bajo volumen mínimo</option><option>Plazo o condición especial</option></select>`;
      const more = `<details class="crm2-action-more"><summary>Más</summary><div class="crm2-action-more-menu"><label>Motivo para devolver${reasonSelect}</label>${secondary('Devolver a Marketing','return-lead',`data-id="${esc(item.id)}"`)}<label>Tipo de excepción${exceptionSelect}</label>${secondary('Enviar a aprobación','send-approval',`data-id="${esc(item.id)}"`)}</div></details>`;
      actionbar = actionBar(`${primary('Preparar propuesta','quote',`data-id="${esc(item.id)}"`)}${secondary('Aceptar como SQL','accept-sql',`data-id="${esc(item.id)}" ${isMql(item) ? '' : 'disabled title="Marketing debe validar el MQL primero"'}`)}${more}`, true);
    } else if (isAccount && role === 'ventas') {
      const id = `data-id="${esc(item.id)}"`;
      const more = `<details class="crm2-action-more"><summary>Más</summary><div class="crm2-action-more-menu">${secondary('Agendar contacto','start-followup',id)}${item.referral ? secondary('Revisar referido','open-referral',id) : ''}</div></details>`;
      actionbar = actionBar(`${primary('Preparar reposición','open-reorder',id)}${secondary('Recomendar','recommend-account',id)}${more}`, true);
    }
    else actionbar = actionBar('', true);
    return { content: (permissionFirst ? folded : '') + group1 + group2 + group3, actionbar };
  }

  function openQuoteDialog(id) {
    const item = leadById(id) || currentState().lead || leads()[0];
    if (!item) { toast('No se puede preparar la propuesta','Selecciona un contacto primero.'); return; }
    quoteWizard = { leadId:item.id, step:1, channel:'mensaje', focus:document.activeElement };
    const dialog = root()?.querySelector('[data-quote-dialog]');
    if (!dialog) return;
    renderQuoteStep(dialog);
    dialog.showModal();
    dialog.querySelector('button')?.focus();
  }
  let quoteWizard = null;
  function quoteDialog() {
    return `<dialog class="crm2-dialog" data-quote-dialog aria-labelledby="crm2-quote-title"><div class="crm2-dialog-head"><div><p class="crm2-eyebrow">PROPUESTA · PASO A PASO</p><h2 id="crm2-quote-title">Preparar propuesta</h2></div><button class="crm2-icon-button" type="button" data-c2="close-dialog" aria-label="Cerrar">${icon('close')}</button></div><div class="crm2-dialog-progress" data-quote-progress></div><div class="crm2-dialog-body" data-quote-body></div><div class="crm2-dialog-actions" data-quote-actions></div></dialog>`;
  }
  function renderQuoteStep(dialog) {
    const lead = leadById(quoteWizard?.leadId);
    const target = dialog.querySelector('[data-quote-body]');
    const actions = dialog.querySelector('[data-quote-actions]');
    const progress = dialog.querySelector('[data-quote-progress]');
    if (!lead || !target || !actions) return;
    progress.innerHTML = [1,2,3].map(n=>`<span class="${quoteWizard.step >= n ? 'is-active' : ''}">${n}</span>`).join('');
    if (quoteWizard.step === 1) {
      const suggest = packDescription(lead);
      target.innerHTML = `<h3>Máquina y pack sugeridos</h3><p>${esc(companyName(lead))} · ${esc(lead.business || 'Rubro sin dato')}</p><div class="crm2-suggestion"><b>${esc(suggest.name)}</b><span>${esc(suggest.kind)}</span><strong>${suggest.amount ? `${money(suggest.amount)} · valor referencial del catálogo` : 'Monto pendiente de confirmar'}</strong></div><p class="crm2-small-note">${esc(whyValue(lead,false))}</p><p>El catálogo no confirma disponibilidad ni condiciones de comodato.</p>`;
      actions.innerHTML = `<button type="button" class="crm2-btn crm2-btn--quiet" data-c2="close-dialog">Cancelar</button>${primary('Siguiente','quote-next')}`;
    } else if (quoteWizard.step === 2) {
      target.innerHTML = `<h3>Datos que Ventas confirma</h3><ul class="crm2-checklist"><li>${statusPill('Contacto y permiso','wait')}<span>Confirmar quién recibirá la propuesta y qué permiso corresponde.</span></li><li>${statusPill('Volumen y pack','wait')}<span>Revisar consumo y productos base del negocio.</span></li><li>${statusPill('Precio, stock y condiciones','wait')}<span>Validar catálogo vigente, disponibilidad y oferta antes de compartir.</span></li></ul><p class="crm2-small-note">La propuesta de este prototipo es de prueba; estos datos no se envían fuera del navegador.</p>`;
      actions.innerHTML = `${secondary('Atrás','quote-back')}${primary('Siguiente','quote-next')}`;
    } else {
      target.innerHTML = `<h3>¿Cómo quieres dejar el envío simulado?</h3><p>Elige el canal para registrar la propuesta en el CRM. No se enviará un correo ni un mensaje real.</p><fieldset class="crm2-radio-set"><legend>Canal</legend><label><input type="radio" name="quote-channel" value="mensaje" ${quoteWizard.channel === 'mensaje' ? 'checked' : ''}> Mensaje en la conversación</label><label><input type="radio" name="quote-channel" value="correo" ${quoteWizard.channel === 'correo' ? 'checked' : ''}> Correo de prueba</label><label><input type="radio" name="quote-channel" value="ambos" ${quoteWizard.channel === 'ambos' ? 'checked' : ''}> Ambos · dentro del prototipo</label></fieldset>`;
      actions.innerHTML = `${secondary('Atrás','quote-back')}${primary('Registrar envío simulado','quote-send')}`;
      target.querySelectorAll('input[name="quote-channel"]').forEach(input => input.addEventListener('change', () => { quoteWizard.channel = input.value; }));
    }
  }
  function saveQuote() {
    const lead = leadById(quoteWizard?.leadId);
    if (!lead) return;
    const offer = packDescription(lead);
    let saved = null;
    save((crm, st) => {
      crm.quotes = Array.isArray(crm.quotes) ? crm.quotes : [];
      crm.conversations = crm.conversations || {};
      crm.quoteSeq = Number(crm.quoteSeq || 0) + 1;
      const folio = `MC-PROP-${String(crm.quoteSeq).padStart(4,'0')}`;
      saved = { id:folio, folio, leadId:lead.id, company:companyName(lead), contact:contactName(lead), machine:offer.name, amount:offer.amount, channel:quoteWizard.channel, status:'Enviada · simulación', at:now(), dataTest:true, rationale:whyValue(lead,false) };
      crm.quotes.push(saved);
      crm.conversations[lead.id] = Array.isArray(crm.conversations[lead.id]) ? crm.conversations[lead.id] : [];
      crm.conversations[lead.id].push({ from:'Ventas', text:`Propuesta ${folio} registrada por ${quoteWizard.channel} · solo simulación.`, at:now(), simulated:true });
      st.marketingPasos = st.marketingPasos || {};
    });
    const dialog = root()?.querySelector('[data-quote-dialog]');
    dialog?.close();
    quoteWizard?.focus?.focus?.();
    quoteWizard = null;
    toast('Propuesta registrada',`${saved?.folio || ''} · Enviada solo en el prototipo.`);
    render();
  }

  function detailActionBar(role, route) {
    return detailPage(role).actionbar;
  }
  function renderRoute(route, role) {
    let title, subtitle, content, bar = '';
    const pageName = route === 'R06' && role === 'marketing' ? 'marketingChannels' : ROUTE[route]?.page;
    if (pageName === 'entry') return entryPage();
    if (pageName === 'detail') {
      const detail = detailPage(role);
      [title, subtitle] = titleSub(route, role);
      const sel = getSelected(); const it = sel.account || sel.lead;
      if (it) { title = sel.account ? (sel.account.name || 'Cuenta') : contactName(sel.lead); subtitle = (sel.account ? [sel.account.business, sel.account.comuna] : [companyName(sel.lead), sel.lead.comuna]).filter(Boolean).join(' · '); }
      content = detail.content; bar = detail.actionbar;
    } else {
      const pageFn = {
        salesToday, salesContacts, salesClients, salesQuotes,
        marketingToday, marketingChannels, marketingLeads, marketingRecover, marketingCampaigns,
        managerSummary, managerApprovals, managerGoals, managerTeam, managerOperations, buyerCRM
      }[pageName];
      content = pageFn ? pageFn() : empty('Vista no disponible','Selecciona una opción del menú.');
      [title, subtitle] = titleSub(route, role);
      if (pageName === 'managerGoals' && route === 'R09') title = 'Puntaje y fundamento';
    }
    return shell(route, role, title, subtitle, content, bar);
  }
  function buyerCRM() {
    const legacyMarkup = window.M7BuyerCRM?.render?.()?.replace(/a definir con Marley/gi, 'por confirmar con el equipo Marley');
    if (!legacyMarkup) return block('CRM por comprador', 'El contrato de etapas no está disponible en esta vista.', empty('Vista en preparación','No se pudo construir la ficha por comprador.'));
    const template = document.createElement('template');
    template.innerHTML = legacyMarkup;
    const main = template.content.querySelector('#m4-main');
    if (!main) return block('CRM por comprador', 'Cargando contrato de etapas y perfiles.', '<p role="status">Leyendo el contrato local de compradores…</p>');
    for (const heading of main.querySelectorAll('h1')) {
      const nested = document.createElement('h2');
      nested.textContent = heading.textContent;
      heading.replaceWith(nested);
    }
    const get = selector => main.querySelector(selector);
    const header = get('.a1crm-header');
    const roleNote = get('.a1crm-role-note');
    const decision = Array.from(main.children).find(node => node.classList?.contains('a1crm-card') && !node.hasAttribute('data-a1-buyer-profile'));
    const scopeNote = header?.querySelector('.a1crm-note');
    const scopeCopy = (scopeNote?.textContent || '').trim();
    scopeNote?.remove();
    const runIdNode = get('[data-a1-run-id]');
    const runId = runIdNode?.textContent?.trim() || '';
    if (runIdNode) {
      const label = runIdNode.previousElementSibling;
      label?.remove();
      runIdNode.remove();
    }
    const fold = (title, selector) => {
      const node = get(selector);
      return node ? `<details class="crm2-fold crm2-buyer-fold"><summary>${esc(title)}</summary><div class="crm2-fold-body">${node.outerHTML}</div></details>` : '';
    };
    const primary = `${header?.outerHTML || ''}${decision?.outerHTML || ''}`;
    const roleFold = roleNote ? `<details class="crm2-fold crm2-buyer-fold"><summary>Prioridad de este rol</summary><div class="crm2-fold-body">${roleNote.outerHTML}</div></details>` : '';
    const scopeFold = scopeCopy ? `<details class="crm2-fold crm2-buyer-fold"><summary>Alcance del prototipo</summary><div class="crm2-fold-body"><p>${esc(scopeCopy)}</p></div></details>` : '';
    const runFold = runId ? `<details class="crm2-fold crm2-buyer-fold"><summary>Datos de prueba</summary><div class="crm2-fold-body"><p>ID de corrida interna: <span data-a1-run-id>${esc(runId)}</span></p></div></details>` : '';
    return block('Contacto y decisión actual', 'Una ficha activa; el perfil, las etapas y las reglas quedan agrupados por tarea.', primary || '<p role="status">No hay un contacto seleccionado.</p>') +
      roleFold + scopeFold + runFold +
      fold('Perfil de compra y roles', '[data-a1-buyer-profile]') +
      fold('Contenido por etapa', '.a1crm-stage-content') +
      fold('Embudo · 11 etapas', '[data-a1-funnel]') +
      fold('Siguiente acción por estado', '[data-a1-next-actions]') +
      fold('Asistentes supervisados', '[data-a1-assistants]') +
      fold('Recuperación y permisos', '[data-a1-recovery]') +
      fold('Indicadores y fórmulas', '[data-a1-indicators]') +
      fold('Catálogo de correos · 12 piezas', '[data-a1-email-catalog]');
  }

  function render() {
    const host = root();
    if (!host) return;
    if (!active()) { host.hidden = true; document.body.classList.remove('crm-v2-active'); return; }
    host.hidden = false;
    document.body.classList.add('crm-v2-active');
    let route = ROUTE[localRoute()] ? localRoute() : 'R00';
    let role = currentState().role;
    const required = routeRole(route, role);
    if (required && role !== required) {
      M.setRole(required);
      role = required;
    }
    if (route === 'R04' && !role) { route = 'R00'; }
    if (route !== 'R00' && !role) { route = 'R00'; }
    if (route === 'R17' && role === 'ventas') { /* route is preserved for legacy CRM por comprador */ }
    host.innerHTML = renderRoute(route, role);
    bindQuoteDialog();
    if (host.querySelector('[data-c2-search]') && searchValue) host.querySelector('[data-c2-search]').value = searchValue;
    showToast();
    if (route === 'R04' && reviewPermissionOnDetail) {
      requestAnimationFrame(() => {
        if (!reviewPermissionOnDetail || localRoute() !== 'R04') return;
        const details = host.querySelector('[data-crm2-permissions]');
        if (!details) return;
        reviewPermissionOnDetail = false;
        details.open = true;
        details.querySelector('summary').focus({ preventScroll: true });
        details.scrollIntoView({ block:'center' });
      });
    }
    if (route === 'R07' && requestedReview) {
      requestAnimationFrame(() => {
        if (!requestedReview || localRoute() !== 'R07') return;
        const id = CSS.escape(requestedReview);
        const review = host.querySelector(`[data-approval="${id}"], [data-followup="${id}"]`);
        if (!review) return;
        if (!review.matches('button')) review.tabIndex = -1;
        review.focus({ preventScroll: true });
        review.scrollIntoView({ block:'center' });
        if (document.activeElement === review) requestedReview = null;
      });
    }
  }
  window.MarleyCRM2 = { render };
  let searchValue = '';
  function bindQuoteDialog() {
    const dialog = root()?.querySelector('[data-quote-dialog]');
    if (!dialog || dialog.dataset.bound === 'true') return;
    dialog.dataset.bound = 'true';
    dialog.addEventListener('cancel', event => { quoteWizard = null; });
    dialog.addEventListener('close', () => { const focus = quoteWizard?.focus; quoteWizard = null; focus?.focus?.(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
      const button = event.target.closest('[data-c2]');
      if (!button) return;
      if (button.dataset.c2 === 'close-dialog') { dialog.close(); quoteWizard = null; }
      if (button.dataset.c2 === 'quote-next') { quoteWizard.step = Math.min(3, quoteWizard.step + 1); renderQuoteStep(dialog); dialog.querySelector('[data-quote-actions] button:last-child')?.focus(); }
      if (button.dataset.c2 === 'quote-back') { quoteWizard.step = Math.max(1, quoteWizard.step - 1); renderQuoteStep(dialog); dialog.querySelector('[data-quote-actions] button:last-child')?.focus(); }
      if (button.dataset.c2 === 'quote-send') saveQuote();
    });
  }

  function approvalDecision(id, decision) {
    const currentApproval = pendingApprovals().find(item => item.id === id);
    if (decision === 'aprobada' && currentApproval?.tipo === 'referido') {
      const referralAccount = accountById(currentApproval.cuenta);
      const checklist = currentApproval.checklist || {};
      const verified = checklist.permission === true && permission(referralAccount).key === 'yes' && checklist.b2b === true && Boolean(referralAccount?.business) && checklist.benefit === true && Boolean(currentApproval.benefit || currentApproval.beneficio);
      if (!verified) { toast('Aprobación bloqueada','Confirma y registra permiso, vínculo B2B y beneficio antes de aprobar.'); return; }
    }
    const note = root()?.querySelector(`[data-approval-note="${CSS.escape(id)}"]`)?.value?.trim() || '';
    if (decision === 'pidio_info' && !note) { toast('Falta una nota','Indica qué dato debe confirmar Ventas.'); root()?.querySelector(`[data-approval-note="${CSS.escape(id)}"]`)?.focus(); return; }
    save((crm, st) => {
      st.jefeAprob = Array.isArray(st.jefeAprob) ? st.jefeAprob : [];
      let item = st.jefeAprob.find(entry => entry.id === id);
      if (!item) {
        const sample = approvalSampleItems().find(entry => entry.id === id);
        if (!sample) return;
        item = { id:sample.id, leadId:sample.leadId, cuenta:sample.cuenta, titulo:sample.titulo, tipo:sample.tipo, monto:sample.monto || null, motivo:sample.motivo, detalle:sample.detalle, dataTest:true, at:now() };
        st.jefeAprob.push(item);
      }
      item.estado = decision;
      item.nota = note;
      item.decidedAt = now();
      st.actividadJefe = Array.isArray(st.actividadJefe) ? st.actividadJefe : [];
      st.actividadJefe.push({ id:item.leadId || item.cuenta || id, texto:`${decision === 'aprobada' ? 'Aprobada' : decision === 'pidio_info' ? 'Pidió información' : 'Rechazada'}: ${item.titulo}${note ? ` · ${note}` : ''}`, at:now() });
      if (item.leadId && st.marketingPasos?.[item.leadId]) st.marketingPasos[item.leadId].aprobacion = decision;
      crm.approvalHistory = Array.isArray(crm.approvalHistory) ? crm.approvalHistory : [];
      crm.approvalHistory.push({ id, decision, note, at:now() });
    });
    toast(decision === 'aprobada' ? 'Aprobación registrada' : decision === 'pidio_info' ? 'Información solicitada' : 'Propuesta rechazada', 'La decisión queda en la ficha de Ventas.');
    render();
  }
  function withLead(id, callback) {
    const lead = leadById(id);
    if (!lead) { toast('Contacto no encontrado','Vuelve a la lista y selecciona un registro.'); return; }
    callback(lead);
  }
  function passToSales(id) {
    withLead(id, lead => {
      if (!isMql(lead)) { toast('Aún no se puede pasar','Revisa contacto, tipo de negocio, permiso y puntaje de interés.'); return; }
      save((crm, st) => {
        st.marketingPasos = st.marketingPasos || {};
        const old = st.marketingPasos[id] || {};
        st.marketingPasos[id] = Object.assign({}, old, { estado:'esperando', motivo:'MQL calificado', por:userFor('marketing'), at:now() });
        crm.handoffs = crm.handoffs || {};
        crm.handoffs[id] = { status:'esperando', reason:'MQL calificado', at:now() };
      });
      toast('Lead pasado a Ventas', 'Aparece en “Hoy” y en Contactos de Ventas.');
      render();
    });
  }
  function acceptSql(id) {
    withLead(id, lead => {
      if (!isMql(lead)) { toast('No cumple MQL','Marketing debe revisar los datos antes de enviarlo a Ventas.'); return; }
      save((crm, st) => {
        st.marketingPasos = st.marketingPasos || {};
        const old = st.marketingPasos[id] || {};
        st.marketingPasos[id] = Object.assign({}, old, { estado:'aceptado', acceptedBy:userFor('ventas'), at:now() });
        crm.sqlByLead = crm.sqlByLead || {};
        crm.sqlByLead[id] = { status:'SQL aceptado', at:now(), by:userFor('ventas') };
        if (st.lead?.id === id && M.acceptSql) { try { M.acceptSql(); } catch (_) {} }
      });
      toast('Oportunidad aceptada como SQL','Marketing ve el cierre del traspaso.');
      render();
    });
  }
  function returnLead(id) {
    const select = root()?.querySelector(`[data-return-reason="${CSS.escape(id)}"]`);
    const reason = select?.value || '';
    if (!reason) { toast('Elige un motivo','Marketing verá la razón de la devolución.'); select?.focus(); return; }
    withLead(id, lead => {
      save((crm, st) => {
        st.marketingPasos = st.marketingPasos || {};
        const old = st.marketingPasos[id] || {};
        st.marketingPasos[id] = Object.assign({}, old, { estado:'devuelto', motivoDevolucion:reason, por:userFor('ventas'), at:now() });
        crm.handoffs = crm.handoffs || {};
        crm.handoffs[id] = { status:'devuelto', reason, at:now() };
      });
      toast('Contacto devuelto a Marketing', `Motivo: ${reason}.`);
      render();
    });
  }
  function sendForApproval(id) {
    const select = root()?.querySelector(`[data-approval-kind="${CSS.escape(id)}"]`);
    const kind = select?.value || '';
    if (!kind) { toast('Elige qué necesita aprobación','Solo las excepciones comerciales pasan a Jefatura.'); select?.focus(); return; }
    withLead(id, lead => {
      const offer = packDescription(lead);
      save((crm, st) => {
        st.jefeAprob = Array.isArray(st.jefeAprob) ? st.jefeAprob : [];
        const next = st.jefeAprob.length + 1;
        st.jefeAprob.push({ id:`AP-CRM2-${next}`, leadId:id, cuenta:id, titulo:`${kind} · ${companyName(lead)}`, tipo:kind, monto:offer.amount, motivo:kind, detalle:`Solicitud de Ventas · ${whyValue(lead,false)}`, estado:'pendiente', por:userFor('ventas'), at:now(), dataTest:true });
        crm.handoffs = crm.handoffs || {};
        crm.handoffs[id] = { status:'pendiente de aprobación', reason:kind, at:now() };
      });
      toast('Enviado a Jefatura','La solicitud aparece en “Por aprobar”.');
      render();
    });
  }
  function saveFollowup(id, kind, status = 'Programado') {
    const date = root()?.querySelector('[data-followup-date]')?.value || '';
    const channel = root()?.querySelector('[data-followup-channel]')?.value || '';
    if (!date || !channel) { toast('Completa fecha y canal','El seguimiento no se guardará incompleto.'); return; }
    const person = leadById(id) || accountById(id) || {};
    const permissionState = permission(person);
    if (currentState().role === 'marketing' && permissionState.key !== 'yes') {
      save(crm => {
        crm.followups = Array.isArray(crm.followups) ? crm.followups : [];
        crm.followups.push({ id:`CRM2-FU-${crm.followups.length+1}`, leadId:id, name:person.name || contactName(person), accountName:person.name || companyName(person), date, channel, status:'Bloqueado', reason:'Permiso promocional no registrado', at:now(), permission:permissionState.label });
      });
      toast('Seguimiento promocional bloqueado','Sin permiso registrado, Marketing no agenda una promoción.');
      render();
      return;
    }
    save(crm => {
      crm.followups = Array.isArray(crm.followups) ? crm.followups : [];
      crm.followups.push({ id:`CRM2-FU-${crm.followups.length+1}`, leadId:id, name:person.name || contactName(person), accountName:person.name || companyName(person), date, channel, status, reason:'Seguimiento comercial', at:now(), permission:permission(person).label });
    });
    if (status === 'Requiere aprobación') toast('Solicitud registrada', 'Jefatura la verá en “Por aprobar”.');
    else toast('Seguimiento programado', 'Quedó visible en “Esperan respuesta”.');
    render();
  }
  function approveRecovery(id) {
    if (currentState().role !== 'jefatura') return;
    const item = managerFollowups().find(entry => entry.id === id);
    if (!item || item.status !== 'Requiere aprobación') return;
    const person = leadById(item.leadId) || accountById(item.leadId);
    if (permission(person).key !== 'yes') { toast('Falta el permiso', 'Verifica la preferencia registrada antes de aprobar.'); return; }
    save(crm => {
      crm.followups ||= [];
      const existing = crm.followups.find(entry => entry.id === id);
      const decision = { status: 'Aprobado', approvedAt: now(), approvedBy: userFor('jefatura') };
      if (existing) Object.assign(existing, decision);
      else crm.followups.push({ ...item, ...decision });
    });
    toast('Recuperación aprobada', 'La decisión queda en el historial de la ficha.');
    render();
  }
  function buildReorder(id) {
    const account = accountById(id);
    if (!account) return;
    const last = (account.orders || []).at(-1);
    const orderItems = (last?.items || []).map(item => ({ p: item.p ?? item.k, qty: item.qty }));
    const productList = orderItems.map(item => `<li><label>${esc(productLabel(item.p ?? item.k))}<input type="number" min="0" step="1" inputmode="numeric" data-reorder-qty="${esc(item.p)}" value="${esc(item.qty)}" aria-label="Cantidad de ${esc(productLabel(item.p ?? item.k))}"></label></li>`).join('') || '<li>Sin productos del último pedido para sugerir cantidades.</li>';
    const panel = root()?.querySelector('[data-inline-panel]');
    if (!panel) return;
    panel.innerHTML = `<section class="crm2-inline-panel"><div><p class="crm2-eyebrow">REPOSICIÓN · DATO DE PRUEBA</p><h2>${esc(account.name)}</h2><p>Se sugieren las cantidades del último pedido; confirma con la cuenta qué necesita ahora.</p><ul>${productList}</ul><p class="crm2-small-note">Inventario, precio vigente y despacho no están conectados. Déjalos por confirmar.</p></div><label>Nota de preparación<input data-reorder-note placeholder="Dato por confirmar"></label><div class="crm2-row-actions">${primary('Dejar lista','save-reorder',`data-id="${esc(id)}"`)}${secondary('Cancelar','close-inline')}</div></section>`;
    panel.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }
  function saveReorder(id) {
    const host = root();
    const note = host?.querySelector('[data-reorder-note]')?.value || '';
    const account = accountById(id);
    if (!account) return;
    const items = [...(host?.querySelectorAll('[data-reorder-qty]') || [])].map(input => ({ product:input.dataset.reorderQty, quantity:Number(input.value) }));
    if (items.some(item => !Number.isFinite(item.quantity) || item.quantity < 0)) { toast('Revisa las cantidades','Usa números iguales o mayores que cero.'); return; }
    if (items.length && !items.some(item => item.quantity > 0)) { toast('Agrega una cantidad','La reposición necesita al menos un producto.'); return; }
    save(crm => {
      crm.replenishments = crm.replenishments || {};
      crm.replenishments[id] = { status:'Reposición lista', accountId:id, lastOrder:account.orders?.at(-1)?.id || null, items, note, inventory:'Por confirmar', shipping:'Por confirmar', at:now(), dataTest:true };
    });
    toast('Reposición lista','La cuenta quedó preparada; cantidades y despacho siguen por confirmar.');
    render();
  }

  function detailOpen(id, type, returnRoute) {
    const back = returnRoute || localRoute();
    save(crm => { crm.returnRoute = back; crm.selectedLead = type === 'lead' ? id : null; crm.selectedAccount = type === 'account' ? id : null; });
    goto('R04');
  }
  function selectedReferral(accountId) {
    const account = accountById(accountId);
    if (!account?.referral) { toast('No hay referido registrado','Esta cuenta no tiene un origen de referido en los datos actuales.'); return; }
    save(crm => { crm.referralReview = { accountId, referrer:account.referral, permission:'Pendiente de confirmar', b2b:Boolean(account.business), benefit:'Sin beneficio registrado', dataTest:true }; });
    toast('Referido abierto','Confirma los permisos y el beneficio antes de continuar.');
    goto('R07');
  }
  function recommendAccount(id, confirm = false) {
    const account = accountById(id);
    if (!account || currentState().role !== 'ventas') return;
    recommendationPanelId = String(id);
    if (confirm) save(crm => { crm.recommendations ||= {}; crm.recommendations[id] ||= { createdAt: now(), by: userFor('ventas') }; });
    render();
    root()?.querySelector('[data-inline-panel] .crm2-inline-panel')?.focus();
  }
  function showSchedule(id) {
    const item = leadById(id) || accountById(id);
    if (currentState().role === 'marketing' && permission(item).key !== 'yes') { toast('Seguimiento bloqueado','Sin permiso promocional registrado, solo se responde una solicitud iniciada por la persona.'); return; }
    const panel = root()?.querySelector('[data-inline-panel]');
    if (!panel) return;
    const kind = accountById(id) ? 'account' : 'lead';
    const attrs = `data-id="${esc(id)}" data-kind="${kind}"`;
    panel.innerHTML = `<section class="crm2-inline-panel"><h2>Agendar contacto</h2><label>Fecha<input type="date" data-followup-date required></label><label>Canal<select data-followup-channel><option value="">Elige un canal</option><option>Correo</option><option>Llamada</option><option>Mensaje en el CRM</option></select></label><div class="crm2-row-actions">${primary('Guardar seguimiento','save-followup',attrs)}${currentState().role === 'marketing' ? secondary('Pedir aprobación','save-followup',`${attrs} data-review="true"`) : ''}${secondary('Cancelar','close-inline')}</div></section>`;
    panel.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }
  function replyRequest(id, demoRequest = false) {
    const original = leadById(id) || accountById(id);
    const item = demoRequest && original ? Object.assign({},original,{ marketingConsent:false,requestedReply:true,dataTest:true }) : original;
    if (!item?.requestedReply && !item?.request?.reply) { toast('Seguimiento bloqueado','No hay una solicitud de respuesta registrada.'); return; }
    save(crm => { crm.followups = Array.isArray(crm.followups) ? crm.followups : []; crm.followups.push({ id:`CRM2-FU-${crm.followups.length+1}`, leadId:id, name:contactName(item), reason:'Respuesta a solicitud iniciada por la persona', status:'Programado', channel:'Respuesta solicitada', requestedReply:true, marketingConsent:false, permission:'Sin permiso de promoción', at:now(), dataTest:Boolean(demoRequest) }); });
    toast('Respuesta preparada','Solo responde la solicitud; no se inició una promoción.');
    render();
  }
  function requestReferralData(id) {
    const lead = leadById(id);
    if (!lead || !isReferral(lead)) { toast('No hay referido registrado','Confirma el origen antes de pedir datos.'); return; }
    save(crm => {
      crm.referralRequests = Array.isArray(crm.referralRequests) ? crm.referralRequests : [];
      if (!crm.referralRequests.some(item => item.leadId === id && item.status === 'Por confirmar')) {
        crm.referralRequests.push({ id:`CRM2-REF-${crm.referralRequests.length + 1}`, leadId:id, status:'Por confirmar', reason:'Confirmar permiso, negocio y posible beneficio del referido', at:now(), dataTest:Boolean(lead.dataTest) });
      }
    });
    toast('Datos pedidos a Marketing','Se creó un seguimiento interno; no se contactó a nadie.');
    render();
  }
  function saveGoal() {
    const input = root()?.querySelector('[data-c2-field="goalSales"]');
    const value = Number(input?.value || 0);
    if (!value || value < 0) { toast('Ingresa una meta válida','No se guardó una meta vacía.'); input?.focus(); return; }
    save(crm => { crm.goalSales = value; });
    toast('Meta guardada',money(value));
    render();
  }
  function saveCac() {
    const data = {};
    root()?.querySelectorAll('[data-cac]').forEach(input => { data[input.dataset.cac] = input.value === '' ? '' : Number(input.value); });
    save(crm => { crm.cac = Object.assign({}, crm.cac || {}, data); });
    toast('Escenario guardado','Los valores siguen rotulados como datos de prueba.');
    render();
  }
  function savePermission(id, approved) {
    const lead = leadById(id) || accountById(id);
    if (!lead) return;
    save(crm => { crm.permissions = crm.permissions || {}; crm.permissions[id] = { promotion:approved, at:now(), by:userFor(currentState().role) }; });
    toast(approved ? 'Permiso registrado' : 'Permiso promocional detenido', 'La preferencia queda visible en la ficha.');
    render();
  }

  function onClick(event) {
    const goLink = event.target.closest('[data-c2-go]');
    if (goLink) { event.preventDefault(); goto(goLink.dataset.c2Go); return; }
    const button = event.target.closest('[data-c2]');
    if (!button) return;
    const action = button.dataset.c2, id = button.dataset.id;
    if (action === 'choose-role') { M.setRole(button.dataset.role); goto(homeFor(button.dataset.role)); return; }
    if (action === 'logout') { M.setRole(null); searchValue=''; goto('R00'); return; }
    if (action === 'back') { const dest = appState().returnRoute || homeFor(currentState().role); goto(dest); return; }
    if (action === 'open-lead') { detailOpen(id,'lead'); return; }
    if (action === 'open-account') { detailOpen(id,'account'); return; }
    if (action === 'toggle-referrals') { save(crm=>{crm.filters=crm.filters||{};crm.filters.referred=!crm.filters.referred;}); render(); return; }
    if (action === 'quote') { openQuoteDialog(id); return; }
    if (action === 'pass-sales') { passToSales(id); return; }
    if (action === 'mark-mql') {
      withLead(id, lead => {
        if (!isMql(lead)) { toast('Falta información','Verifica el permiso, el negocio y el interés antes de marcar MQL.'); return; }
        save((crm, st) => { st.marketingPasos = st.marketingPasos || {}; const old=st.marketingPasos[id]||{}; st.marketingPasos[id]=Object.assign({},old,{estado:old.estado||'mql',mqlAt:now(),mqlBy:userFor('marketing')}); crm.mqlByLead=crm.mqlByLead||{}; crm.mqlByLead[id]={at:now(),by:userFor('marketing')}; });
        toast('Calificación MQL registrada','Puedes revisar el paso a Ventas en la ficha.'); render();
      }); return;
    }
    if (action === 'accept-sql') { acceptSql(id); return; }
    if (action === 'return-lead') { returnLead(id); return; }
    if (action === 'send-approval') { sendForApproval(id); return; }
    if (action === 'decide-approval') { approvalDecision(id,button.dataset.decision); return; }
    if (action === 'review-approval') { requestedReview = selectedReviewId = id; goto('R07'); return; }
    if (action === 'review-followup') { permissionReviewId = id; reviewPermissionOnDetail = true; detailOpen(id,accountById(id) ? 'account' : 'lead','R07'); return; }
    if (action === 'approve-recovery') { approveRecovery(id); return; }
    if (action === 'schedule') { showSchedule(id); return; }
    if (action === 'start-followup') { showSchedule(id); return; }
    if (action === 'save-followup') { saveFollowup(id,button.dataset.kind || 'lead', button.dataset.review === 'true' ? 'Requiere aprobación' : 'Programado'); return; }
    if (action === 'reply-request') { replyRequest(id,button.dataset.demoRequest === 'true'); return; }
    if (action === 'request-referral-data') { requestReferralData(id); return; }
    if (action === 'nurture') {
      const item = leadById(id) || accountById(id);
      if (permission(item).key !== 'yes') { toast('Nutrición bloqueada','Se requiere permiso promocional registrado.'); return; }
      showSchedule(id); return;
    }
    if (action === 'mark-contacted') {
      save(crm=>{crm.contacted=crm.contacted||{};crm.contacted[id]={at:now(),by:userFor(currentState().role)};});
      toast('Contacto registrado','Quedó en la actividad de la ficha.'); render(); return;
    }
    if (action === 'permission-yes') { savePermission(id,true); return; }
    if (action === 'permission-no') { savePermission(id,false); return; }
    if (action === 'open-reorder') { buildReorder(id); return; }
    if (action === 'save-reorder') { saveReorder(id); return; }
    if (action === 'close-inline') { recommendationPanelId = null; const panel=root()?.querySelector('[data-inline-panel]'); if(panel)panel.innerHTML=''; return; }
    if (action === 'open-referral') { selectedReferral(id); return; }
    if (action === 'recommend-account') { recommendAccount(id); return; }
    if (action === 'save-account-recommendation') { recommendAccount(id, true); return; }
    if (action === 'generate-marketing-draft') { generateMarketingDraft(false); return; }
    if (action === 'confirm-marketing-draft') { generateMarketingDraft(true); return; }
    if (action === 'save-goal') { saveGoal(); return; }
    if (action === 'save-cac') { saveCac(); return; }
    if (action === 'close-dialog') { root()?.querySelector('[data-quote-dialog]')?.close(); quoteWizard=null; return; }
  }
  function onChange(event) {
    const input = event.target;
    if (input.matches('[data-c2-filter="origin"]')) {
      const value = input.value;
      save(crm=>{crm.filters=crm.filters||{};crm.filters.origin=value;}); render(); return;
    }
    if (input.matches('[data-cac]')) {
      const cac = {}; root()?.querySelectorAll('[data-cac]').forEach(el=>{cac[el.dataset.cac]=el.value===''?'':Number(el.value);});
      save(crm=>{crm.cac=Object.assign({},crm.cac||{},cac);});
      const route = localRoute(); if (route === 'R06' || route === 'R09') { const activeInput = input; render(); const restored=root()?.querySelector(`[data-cac="${activeInput.dataset.cac}"]`); restored?.focus(); }
    }
  }
  function onInput(event) {
    const input = event.target;
    if (input.matches('[data-c2-search]')) {
      searchValue = input.value;
      const results = root()?.querySelector('[data-c2-search-results]');
      if (!results) return;
      const list = searchItems(searchValue);
      results.hidden = !searchValue.trim();
      results.innerHTML = list.map(item=>`<button type="button" data-c2-search-open="${item.type}" data-id="${esc(item.id)}"><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small></button>`).join('') || (searchValue.trim() ? '<p>No se encontraron coincidencias.</p>' : '');
    }
    if (input.matches('[data-approval-note]')) input.setAttribute('value',input.value);
  }
  function onSubmit(event) { event.preventDefault(); }
  function onRootClick(event) {
    const result = event.target.closest('[data-c2-search-open]');
    if (!result) return;
    event.preventDefault();
    detailOpen(result.dataset.id,result.dataset.c2SearchOpen);
  }
  function boot() {
    if (!document.body) return;
    if (!root()) {
      const host = document.createElement('div');
      host.id = ROOT_ID;
      host.hidden = true;
      document.body.appendChild(host);
      host.addEventListener('click', onClick);
      host.addEventListener('click', onRootClick);
      host.addEventListener('input', onInput);
      host.addEventListener('change', onChange);
      host.addEventListener('submit', onSubmit);
    }
    window.addEventListener('hashchange', render);
    window.addEventListener('popstate', render);
    M.subscribe?.(() => { if (active() && !quoteWizard) render(); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
