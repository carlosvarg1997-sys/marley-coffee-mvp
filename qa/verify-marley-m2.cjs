'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const variants = [
  ['index.html', 'prototype'],
  ['prototipo.html', 'prototype'],
  ['mockups.html', 'mockups'],
  ['wireframes.html', 'wireframes'],
];
const expectedWeights = {
  cotizar: 10, form1: 20, portal: 8, diag_inicio: 5, negocio: 4, volumen: 5,
  operacion: 4, preferencias: 4, canal: 3, recomendacion: 8, propuesta: 15,
  ejecutivo: 12, expansion: 12,
};
const expectedOrder = [
  ...Object.keys(expectedWeights), 'comuna',
];
const buyerSegments = [
  'Hotel', 'Restaurante', 'Cafetería', 'Eventos o catering',
  'OCS', 'Conveniencia', 'Panadería',
];
const screenIds = [
  ...Array.from({ length: 13 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`),
];

function fakeElement() {
  const classes = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  return {
    innerHTML: '', dataset: {}, classList: classes, style: {}, hidden: false, open: false,
    setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, prepend() {}, remove() {},
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, contains() { return false; }, replaceChildren() {}, getAttribute() { return null; },
    hasAttribute() { return false; }, getBoundingClientRect() { return { height: 0 }; },
    scrollIntoView() {},
  };
}

function createContext(mode, app) {
  const classes = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const listeners = {};
  const intervals = [];
  const body = Object.assign(fakeElement(), { classList: classes, dataset: {} });
  const doc = {
    body,
    documentElement: Object.assign(fakeElement(), { classList: classes, dataset: {} }),
    title: '', activeElement: null, readyState: 'complete',
    querySelector(selector) { return selector === '#app' ? app : null; },
    querySelectorAll() { return []; },
    getElementById(id) { return id === 'app' ? app : null; },
    createElement() { return fakeElement(); },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {}, dispatchEvent() { return true; }, listeners,
  };
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const ctx = {
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, Set, Map, Intl, Promise,
    URL, URLSearchParams, document: doc,
    location: { hash: '#C01', search: '', pathname: '/prototipo.html', origin: 'file://', protocol: 'file:', replace(value) { this.hash = value; } },
    localStorage: storage, sessionStorage: storage,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {},
    runIntervals() { intervals.forEach((fn) => fn()); },
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, scrollTo() {},
    innerWidth: 1280, scrollY: 0,
    matchMedia() { return { matches: false, addEventListener() {} }; },
    MarleyApp: { go() {}, handles() { return false; }, leave() {} },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    MARLEY_ARTIFACT_MODE: mode, MARLEY_STATIC: false, MARLEY_EXTRA_ASSETS: {}, M4_TEST: '',
  };
  ctx.window = ctx;
  ctx.document = doc;
  vm.createContext(ctx);
  return ctx;
}

function scriptsOf(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1], code: m[2] }));
}

function moduleIndices(scripts, markers) {
  const indexes = markers.map((marker) => scripts.findIndex((s) => s.code.includes(marker)));
  for (let i = 0; i < markers.length; i++) {
    assert.notEqual(indexes[i], -1, `Missing source module: ${markers[i]}`);
  }
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function cleanMarkup(markup) {
  return String(markup).replace(/data:[^"'<>]*;base64,[^"'<>]*/gi, '');
}

function verifyDemoShell(html, file) {
  const css = html.match(/<style id="m4-demo-shell-style">([\s\S]*?)<\/style>/i)?.[1] || '';
  const script = html.match(/<script id="m4-demo-shell-script">([\s\S]*?)<\/script>/i)?.[1] || '';
  assert.ok(css && script, `${file}: demo control shell is present`);
  assert.match(css, /#m4-demo-dock\{position:relative;top:auto;z-index:10000;display:flex;justify-content:flex-end;align-items:center;min-height:38px/, `${file}: desktop controls occupy only a compact row`);
  assert.match(css, /@media\(max-width:767px\)/, `${file}: mobile breakpoint is defined`);
  assert.match(css, /#m4-demo-dock\{position:relative;left:auto;right:auto;bottom:auto;top:auto;height:auto;min-height:36px;z-index:10000;overflow:visible;display:flex;justify-content:flex-end;align-items:center;padding:0 12px;pointer-events:auto\}/, `${file}: minimized mobile control stays in document flow`);
  assert.match(css, /#m4-demo-dock \.m4-demo-launcher\{display:inline-flex;position:static;[^}]*min-height:32px/, `${file}: mobile launcher is compact and does not float over content`);
  assert.match(script, /let controlsHidden = true;/, `${file}: demo controls start minimized`);
  assert.match(script, /marley-demo-controls-hidden-v4/, `${file}: storage key is versioned after the expanded-bar preference`);
  assert.doesNotMatch(script, /localStorage\.getItem\(KEY\)/, `${file}: a saved expanded preference cannot reopen the controls`);
  assert.match(script, /m4-demo-during-task/, `${file}: demo controls disappear while a participant is completing the task`);
  assert.match(script, /if \(isMobile\(\)\) setHidden\(true\);/, `${file}: closing the mobile sheet returns to minimized state`);
  assert.match(css, /max-height:min\(85dvh,760px\)/, `${file}: mobile control sheet is bounded and scrollable`);
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Herramientas de revisión" hidden/, `${file}: mobile sheet starts closed and labeled`);
  assert.match(script, /(?:params\.get\('qa'\) !== '1' \|\| params\.has\('test'\)|new URLSearchParams\(location\.search\)\.get\('qa'\) !== '1'\) return)/, `${file}: review controls only start on an explicit QA route`);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('qa'\) !== '1'\) return ''/, `${file}: customer and participant routes reserve no moderator strip`);
  assert.doesNotMatch(script, /aria-label="Abrir controles de demostración"[^>]*>Demo<\/button>/, `${file}: no floating Demo tab is rendered`);
  assert.match(script, /localStorage\.setItem\(KEY/, `${file}: hidden preference is saved`);
  assert.match(script, /event\.key === 'Escape'/, `${file}: Escape closes the mobile sheet`);
  assert.match(script, /focusBeforeOpen/, `${file}: sheet manages focus on open and close`);
  if (['index.html', 'prototipo.html'].includes(file)) {
    assert.match(html, /\.m5-crm \.m4-chip\{max-width:100%;white-space:normal;overflow-wrap:anywhere\}/, `${file}: long CRM chips can wrap within their cards`);
    assert.match(html, /\.m5-crm \.m4-card h2,\.m5-crm \.m4-card h3\{overflow-wrap:anywhere\}/, `${file}: long CRM headings cannot force horizontal overflow`);
  }
}

function hasCreamHue(hex) {
  const channels = hex.match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const [r, g, b] = channels;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0 || lightness < 0.78) return false;
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return hue >= 28 && hue <= 65;
}

function verifyBlackWhiteHome(html, file) {
  const style = html.match(/<style id="ux-black-white-hero-20261109">([\s\S]*?)<\/style>/i)?.[1] || '';
  assert.ok(style, `${file}: black/white hero overrides are present`);
  assert.doesNotMatch(html, /--(?:cream|sand)\s*:\s*(?!#fff\b)[^;]+/i, `${file}: cream/sand tokens resolve to white`);
  assert.doesNotMatch(html, /--(?:y-soft|green-soft|gr-soft|rd-soft)\s*:\s*#(?:fff4cc|e8f0e3|eaf0e1|fde6ec)\b/i, `${file}: pale cream and tinted status fills are removed`);
  assert.match(style, /html,body,#app\{background-color:#fff!important\}/, `${file}: app canvas is white outside the black hero`);
  assert.match(style, /\.m4\{--cream:#fff!important;--sand:#fff!important;--bg:#fff!important;--ink:#171717!important;--ink2:#333!important;--muted:#5d5d5d!important;--line:#e1e1e1!important;--green-soft:#fff!important;--gr-soft:#fff!important;--rd-soft:#fff!important;--y-soft:#fff!important;background:#fff!important\}/, `${file}: all client and CRM tabs use white surfaces and dark readable copy`);
  assert.doesNotMatch(html, /#efe2b8/i, `${file}: old cream tint is removed from callout borders`);
  assert.match(style, /\.m5 \.ux-hero-scroll\{[^}]*background:#000!important/, `${file}: home hero background is black`);
  assert.match(style, /\.m5 \.ux-hero-scroll \.ux-hero-media\{position:absolute!important;inset:0!important;[^}]*height:100%/, `${file}: home video fills the hero background`);
  assert.match(style, /\.ux-hero-media::after\{[^}]*background:linear-gradient\([^}]+rgba\(0,0,0,\.94\)/, `${file}: mobile video has a dark legibility overlay`);
  assert.match(style, /object-fit:cover/, `${file}: video and poster crop to the full background`);
  assert.match(style, /height:calc\(100svh - 99px\)/, `${file}: mobile hero fits below the prototype controls`);
  assert.match(style, /\.m5 \.ux-hero-scroll \.ux-hero-copy\{[^}]*color:#fff/, `${file}: home copy is light over the dark video`);
  assert.match(style, /\.m5 \.ux-hero-scroll \.ux-hero-copy h1\{color:#fff!important/, `${file}: home heading has white contrast`);
  assert.match(style, /\.m5 \.ux-hero-scroll \.ux-hero-copy>p\{color:rgba\(255,255,255,\.90\)!important/, `${file}: home body copy has white contrast`);
  assert.match(html, /Ayúdame a elegir una máquina/i, `${file}: approved primary CTA copy remains`);
  assert.match(html, /Ya sé cuál me interesa/i, `${file}: approved direct-choice CTA copy remains`);

  // 12-nov: sin excepciones. «Por revisar» en el CRM usa gris neutro con barra amarilla; el crema queda fuera de todo (Carlitos).
  const declarations = html.matchAll(/(?<![\w-])background(?:-color)?\s*:\s*[^;}]+/gi);
  for (const declaration of declarations) {
    for (const color of declaration[0].matchAll(/#([0-9a-f]{6})\b/gi)) {
      assert.equal(hasCreamHue(color[1]), false, `${file}: no cream-tinted background (#${color[1]})`);
    }
  }
}

function scorePath(M, segment, commune) {
  M.reset();
  M.saveContact({ name: 'Prueba Marley', email: 'compras@example.cl', consent: true, marketingConsent: false });
  M.startQuote();
  M.answer('negocio', segment);
  M.confirmStep();
  M.setComuna(commune);
  M.confirmStep();
  M.confirmStep();
  M.viewProposal();
  M.chooseChannel('correo');
  return M.get();
}

function verifyScoring(ctx, file) {
  const M = ctx.M4;
  assert.deepEqual(Array.from(M.B2B_SEGMENTS), buyerSegments, `${file}: B2B buyer segments`);
  assert.deepEqual(Array.from(M.M2_ORDER), expectedOrder, `${file}: M2 event order`);
  for (const [key, points] of Object.entries(expectedWeights)) {
    assert.equal(M.EV[key].pts, points, `${file}: M2 points for ${key}`);
  }
  const expectedBands = [
    [0, 'Exploración'], [19, 'Exploración'], [20, 'Identificado'], [39, 'Identificado'],
    [40, 'Calificado'], [59, 'Calificado'], [60, 'Alta intención'], [79, 'Alta intención'],
    [80, 'Prioridad máxima'], [100, 'Prioridad máxima'],
  ];
  for (const [score, label] of expectedBands) {
    assert.equal(M.band(score).name, label, `${file}: band at ${score}`);
  }

  if (['index.html', 'prototipo.html'].includes(file)) {
    M.reset();
    M.startQuote();
    M.answer('negocio', 'Hotel');
    M.confirmStep();
    assert.equal(M.get().lead, null, `${file}: anonymous quote intent does not create a lead`);
    assert.equal(M.score(), 0, `${file}: no lead score is assigned before valid contact`);
    assert.equal(M.get().events.find((event) => event.key === 'cotizar')?.pts, 0, `${file}: pre-contact intent is held at zero`);
    const anonymousEvents = M.get().events.map((event) => event.key);
    assert.ok(anonymousEvents.length > 1, `${file}: anonymous exploration produces multiple unscored events`);
    M.saveContact({ name: 'Primer contacto', email: 'primero@example.cl', consent: true, marketingConsent: false });
    assert.equal(M.get().events.find((event) => event.key === 'form1')?.pts, 20, `${file}: valid contact records the form scoring event once`);
    for (const event of M.get().events.filter((item) => anonymousEvents.includes(item.key))) {
      assert.equal(event.pts, 0, `${file}: identifying later does not retroactively score ${event.key}`);
    }
    assert.equal(M.score(), 20, `${file}: the valid first contact receives only the form points`);
    const firstScore = M.score();
    M.saveContact({ name: 'Primer contacto', email: 'primero@example.cl', consent: true, marketingConsent: false });
    assert.equal(M.score(), firstScore, `${file}: reloading and resubmitting does not duplicate first-contact points`);
    assert.equal(M.get().lead.marketingConsent, false, `${file}: response permission does not imply marketing consent`);
    assert.equal(M.get().sched.some((item) => item.type === 'abandono' && !item.done), false, `${file}: opted-out contact receives no abandonment marketing schedule`);

    M.reset();
    M.saveContact({ name: 'Permisos', email: 'permisos@example.cl', consent: true, marketingConsent: true });
    M.startQuote();
    assert.equal(M.get().sched.some((item) => item.type === 'abandono' && !item.done), true, `${file}: an opted-in lead may enter the simulated reminder queue`);
    M.saveContact({ name: 'Permisos', email: 'permisos@example.cl', consent: true, marketingConsent: false });
    assert.equal(M.get().lead.marketingConsent, false, `${file}: later opt-out overwrites prior marketing permission`);
    assert.equal(M.get().sched.some((item) => item.type === 'abandono' && !item.done), false, `${file}: later opt-out cancels queued abandonment reminders`);
    M.update((s) => { s.sched.push({ id: 'legacy-optout', type: 'abandono', at: M.now() - 100, done: false, owner: M.TAB, data: {} }); });
    const mailBeforeAbandonmentTick = M.get().emails.length;
    ctx.runIntervals();
    assert.equal(M.get().emails.length, mailBeforeAbandonmentTick, `${file}: stale queued reminder is rechecked against current marketing permission`);

    ctx.location.search = '?utm_source=google&utm_medium=cpc&utm_campaign=hotel&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_assignment=alternada&mc_order=alternativas-primero&mc_query_id=2&mc_surface=guia-solucion&mc_entry_surface=resultado-guia';
    M.reset();
    M.saveContact({ name: 'Origen', email: 'origen@example.cl', consent: true, marketingConsent: false });
    assert.equal(M.get().lead.attribution?.utmSource, 'google', `${file}: UTM source is retained on the lead`);
    assert.equal(M.get().lead.attribution?.utmMedium, 'cpc', `${file}: paid medium is retained on the lead`);
    assert.equal(M.get().lead.attribution?.sessionId, 'SERP-1', `${file}: search-lab session survives into CRM`);
    assert.equal(M.get().lead.attribution?.phase, 'title', `${file}: search-lab experiment phase survives into CRM`);
    assert.equal(M.get().lead.attribution?.variant, 'B', `${file}: search-lab variant survives into CRM`);
    assert.equal(M.get().lead.attribution?.surface, 'guia-solucion', `${file}: last search journey surface survives into CRM`);
    assert.equal(M.get().lead.attribution?.entrySurface, 'resultado-guia', `${file}: original SERP click surface survives through the guide`);
    assert.equal(M.get().lead.attribution?.assignment, 'alternada', `${file}: experiment assignment survives into CRM`);
    assert.equal(M.get().lead.attribution?.resultOrder, 'alternativas-primero', `${file}: result order survives into CRM`);
    ctx.location.search = '';
  }

  for (const segment of buyerSegments) {
    const state = scorePath(M, segment, 'Las Condes');
    assert.equal(state.answers.negocio, segment, `${file}: selected segment ${segment}`);
    assert.equal(M.score(), 85, `${file}: proposal-first M2 path score for ${segment} in Las Condes`);
    assert.equal(M.isMQL(), true, `${file}: MQL for ${segment}`);
    assert.equal(M.sqlCandidate(), true, `${file}: SQL candidate for ${segment}`);
    assert.equal(M.stage(), 'MQL', `${file}: SQL remains pending a human decision`);
    // This path tests proposal scoring after the catalog is complete. Keep the
    // catalog's interactive "continue exploring" branch out of the unit fixture.
    ctx.M9Catalog.nextExploration = () => false;
    M.acceptProposal('ampliada');
    assert.equal(M.score(), 100, `${file}: score cap after proposal and expansion`);
    const eventKeys = M.get().events.filter((e) => M.M2_ORDER.includes(e.key)).map((e) => e.key);
    assert.equal(new Set(eventKeys).size, 13, `${file}: proposal-first route records M2 signals plus comuna; portal remains a later step`);
    assert.equal(M.stage(), 'MQL', `${file}: accepted proposal does not auto-accept SQL`);
    M.setRole('marketing');
    M.acceptSql();
    assert.equal(M.stage(), 'MQL', `${file}: marketing cannot accept SQL`);
    M.setRole('jefatura');
    M.acceptSql();
    assert.equal(M.stage(), 'MQL', `${file}: jefatura cannot accept SQL`);
    M.setRole('ventas');
    M.acceptSql();
    if (['index.html', 'prototipo.html'].includes(file)) {
      assert.equal(M.stage(), 'MQL', `${file}: SQL stays blocked until a person records MQL`);
      M.update((s) => { s.events.push({ key: `cycle:${s.lead.id}:lead_qualified:MQL`, eventName: 'lead_qualified', qualification_status: 'MQL', actor_role: 'Marketing', actor_type: 'human', pts: 0, at: M.now() }); });
      M.acceptSql();
    }
    assert.equal(M.stage(), 'SQL', `${file}: human acceptance moves lead to SQL`);
    assert.equal(M.get().sql.by, ctx.M4D.ROLE_MENUS.ventas.user, `${file}: SQL records the acting sales user`);
  }

  M.reset();
  scorePath(M, 'Hotel', 'Las Condes');
  for (const role of ['marketing', 'jefatura']) {
    M.setRole(role);
    assert.doesNotMatch(ctx.M4R.SCREENS.R07(), /data-a="accept-sql"/, `${file}: ${role} cannot see SQL acceptance in the agent queue`);
  }
  M.setRole('ventas');
  if (['index.html', 'prototipo.html'].includes(file)) {
    assert.doesNotMatch(ctx.M4R.SCREENS.R07(), /data-a="accept-sql"/, `${file}: sales cannot accept SQL before a person marks MQL`);
    M.update((s) => { s.events.push({ key: `cycle:${s.lead.id}:lead_qualified:MQL`, eventName: 'lead_qualified', qualification_status: 'MQL', actor_role: 'Marketing', actor_type: 'human', pts: 0, at: M.now() }); });
  }
  assert.match(ctx.M4R.SCREENS.R07(), /data-a="accept-sql"/, `${file}: sales sees the human SQL acceptance action`);

  const scenarioScores = [];
  for (const [commune, expected] of [['Las Condes', 85], ['Santiago Centro', 81], ['Maipú', 78]]) {
    const state = scorePath(M, 'Hotel', commune);
    assert.equal(M.score(), expected, `${file}: proposal-first scenario score for ${commune}`);
    scenarioScores.push(M.score());
    M.enterPortal();
    assert.equal(M.get().events.filter((e) => e.key === 'portal').length, 1, `${file}: portal event deduplication`);
    const firstCommuneCount = M.get().events.filter((e) => e.key === 'comuna').length;
    M.setComuna('Las Condes');
    M.setComuna('Maipú');
    assert.equal(M.get().events.filter((e) => e.key === 'comuna').length, firstCommuneCount, `${file}: comuna remains one signal`);
    assert.equal(M.score(), 86, `${file}: changing the commune recalculates zone points after the later portal event`);
  }

  M.reset();
  M.saveContact({ name: 'Caso de prueba', email: 'audit@example.test', consent: true });
  M.startQuote();
  M.answer('negocio', 'Hotel');
  M.confirmStep();
  M.answer('comuna', 'Las Condes');
  M.confirmStep();
  assert.equal(M.score(), 54, `${file}: initial commune score`);
  M.stepBack();
  M.answer('comuna', 'Maipú');
  M.confirmStep();
  assert.equal(M.score(), 47, `${file}: diagnostic commune edit updates score`);
  assert.equal(M.get().lead.execId, ctx.M4D.execFor('Maipú').id, `${file}: diagnostic commune edit updates assignment`);
  assert.equal(M.get().events.filter((e) => e.key === 'comuna').length, 1, `${file}: diagnostic commune remains deduplicated`);
  M.stepBack();
  M.answer('comuna', 'Las Condes');
  M.confirmStep();
  assert.equal(M.score(), 54, `${file}: diagnostic commune edit works in reverse`);
  M.stepBack();
  M.answer('comuna', 'Comuna de prueba');
  M.confirmStep();
  const unknown = M.get().events.find((event) => event.key === 'comuna');
  assert.equal(unknown.pts, 0, `${file}: unknown commune has no geographic points`);
  assert.match(unknown.label, /zona por confirmar/, `${file}: unknown commune is labeled correctly`);
  assert.equal(M.get().lead.execId, null, `${file}: unknown commune does not retain a previous assignment`);
  M.stepBack();
  assert.match(ctx.M4C.SCREENS.C04(), /Comuna de prueba · zona por confirmar/, `${file}: saved unknown commune is visible`);

  M.reset();
  M.saveCreatorInterest({ name: 'Creador demo', email: 'creador@example.cl', creatorProfile: 'demo' });
  assert.equal(M.isMQL(), false, `${file}: creator partnership is not classified as a B2B buyer`);
  return scenarioScores;
}

function verifyActiveScreens(ctx, file) {
  const M = ctx.M4;
  M.reset();
  M.setRole('ventas');
  const clientScreens = Object.entries(ctx.M4C.SCREENS);
  const crmScreens = Object.entries(ctx.M4R.SCREENS);
  assert.ok(clientScreens.length >= 8, `${file}: client screen generators loaded`);
  assert.ok(crmScreens.length >= 9, `${file}: CRM screen generators loaded`);
  for (const [id, render] of clientScreens) {
    const markup = render();
    assert.equal(typeof markup, 'string', `${file}: ${id} returns markup`);
    assert.ok(markup.length > 500, `${file}: ${id} renders meaningful markup`);
    assert.doesNotMatch(cleanMarkup(markup), /\bundefined\b|\bNaN\b/, `${file}: ${id} contains no missing helper values`);
  }
  for (const [id, render] of crmScreens) {
    const markup = render();
    assert.equal(typeof markup, 'string', `${file}: ${id} returns CRM markup`);
    assert.ok(markup.length > 500, `${file}: ${id} renders meaningful CRM markup`);
    assert.doesNotMatch(cleanMarkup(markup), /\bundefined\b|\bNaN\b/, `${file}: ${id} contains no missing helper values`);
  }
  const scoreRules = ctx.M4R.SCREENS.R09();
  assert.match(scoreRules, /Engagement Score v1\.1/);
  for (const key of ctx.M4.M2_ORDER) assert.ok(scoreRules.includes(ctx.M4.EV[key].label), `${file}: R09 shows ${key}`);
  for (const key of ctx.M4.M2_ORDER.filter((item) => item !== 'comuna')) {
    assert.ok(scoreRules.includes('+' + ctx.M4.EV[key].pts), `${file}: R09 shows the canonical ${key} points`);
  }
  assert.match(scoreRules, /Prioridad máxima/);
  return { client: clientScreens.length, crm: crmScreens.length };
}

function verifyPointService(ctx, file) {
  const M = ctx.M4;
  M.reset();
  ctx.location.hash = '#C09';
  for (const [account, point] of [['AC-121', 'oficina-centro'], ['AC-122', 'tienda-centro'], ['AC-123', 'panaderia-principal']]) {
    M.setDemoContext(account, point);
    const markup = ctx.M4C.SCREENS.C09();
    assert.match(markup, /Cuenta y punto de atención/, `${file}: account selector for ${account}`);
    assert.doesNotMatch(cleanMarkup(markup), /\bundefined\b|\bNaN\b/, `${file}: valid account markup for ${account}`);
  }
  M.setDemoContext('AC-121', 'oficina-centro');
  assert.equal(ctx.M7Chat.context().accountId, 'AC-121', `${file}: OCS account context`);
  assert.equal(ctx.M7Chat.context().pointId, 'oficina-centro', `${file}: first OCS point context`);
  ctx.M7Chat.sendClient('La máquina tiene una falla');
  const first = ctx.M7Chat.get();
  assert.ok(first.ticket && first.paused, `${file}: incident pauses commercial actions`);
  assert.equal(first.ticket.pointId, 'oficina-centro', `${file}: incident belongs to selected point`);
  assert.equal(M.get().serviceCases[ctx.M7Chat.context().scope].ticket.id, first.ticket.id, `${file}: incident reaches the CRM state`);
  M.setDemoContext('AC-121', 'oficina-poniente');
  assert.equal(ctx.M7Chat.context().pointId, 'oficina-poniente', `${file}: second OCS point context`);
  assert.equal(ctx.M7Chat.get().ticket, null, `${file}: incident does not leak to another point`);
  const context = ctx.M7Chat.context();
  let draft = ctx.M7Chat.transition(ctx.M7Chat.fresh(), { type: 'intent', intent: 'reponer', label: 'Reponer' }, context, 1000);
  draft = ctx.M7Chat.transition(draft, { type: 'reorder-confirm' }, context, 2000);
  assert.equal(draft.order.accountId, 'AC-121', `${file}: reorder account`);
  assert.equal(draft.order.pointId, 'oficina-poniente', `${file}: reorder point`);
  assert.equal(draft.order.qty, 2, `${file}: reorder keeps requested quantity`);
  const again = ctx.M7Chat.transition(draft, { type: 'reorder-confirm' }, context, 3000);
  assert.equal(again.operations.length, draft.operations.length, `${file}: retry does not duplicate the reorder`);
  ctx.M7Chat.sendClient('Quiero reponer café');
  const submitted = ctx.M7Chat.confirmReorder();
  assert.ok(submitted.order, `${file}: customer confirms a point reorder`);
  const orderId = submitted.order.id;
  assert.equal(M.get().serviceCases[context.scope].order.id, orderId, `${file}: reorder reaches the CRM`);
  M.select('AC-121');
  ctx.location.hash = '#R04';
  M.setRole('marketing');
  assert.equal(ctx.M7Chat.reviewOrder(orderId, 'En revisión'), false, `${file}: marketing cannot review a reorder`);
  M.setRole('ventas');
  assert.equal(ctx.M7Chat.reviewOrder(orderId, 'En revisión'), true, `${file}: sales reviews the selected reorder`);
  assert.equal(M.get().serviceCases[context.scope].order.status, 'En revisión', `${file}: reviewed status reaches account state`);
  assert.match(ctx.M4R.SCREENS.R04(), /En revisión/, `${file}: CRM shows the reviewed status`);
  ctx.location.hash = '#C09';
  assert.match(ctx.M4C.SCREENS.C09(), /En revisión/, `${file}: customer sees the same reviewed status`);
  M.setDemoContext('AC-121', 'oficina-centro');
  assert.equal(ctx.M7Chat.get().ticket.id, first.ticket.id, `${file}: returning restores the original point history`);
  M.setRole('ventas');
  M.select('AC-121');
  ctx.location.hash = '#R04';
  assert.equal(ctx.M7Chat.context().pointId, 'oficina-centro', `${file}: CRM opens the same point`);
  assert.match(ctx.M4R.SCREENS.R04(), /Postventa por punto/, `${file}: account screen includes point service history`);
}

function verifyProposalReview(ctx, file) {
  const M = ctx.M4;
  scorePath(M, 'Hotel', 'Las Condes');
  assert.ok(M.get().proposal, `${file}: proposal exists for review`);
  const subject = M.reviewSubject();
  M.setRole('marketing');
  assert.equal(M.reviewProposal(subject, 'validada'), false, `${file}: marketing cannot validate review`);
  M.setRole('ventas');
  assert.equal(M.reviewProposal(subject, 'en_revision'), true, `${file}: sales takes review`);
  assert.equal(M.reviewProposal(subject, 'en_revision'), true, `${file}: retry is accepted`);
  let task = M.get().reviewTasks.find((item) => item.subject === subject);
  assert.equal(task.history.length, 1, `${file}: retry does not duplicate history`);
  assert.equal(M.reviewProposal(subject, 'validada'), true, `${file}: sales records review`);
  task = M.get().reviewTasks.find((item) => item.subject === subject);
  assert.equal(task.by, ctx.M4D.ROLE_MENUS.ventas.user, `${file}: review records actual demo actor`);
  assert.match(ctx.M4C.SCREENS.C06(), /revisión interna de esta versión quedó registrada/i, `${file}: portal shows review status`);
  assert.equal(ctx.M9Catalog.add('grano'), true, `${file}: cart can be changed`);
  assert.notEqual(M.reviewSubject(), subject, `${file}: cart edit changes review version`);
  assert.equal(M.reviewProposal(subject, 'validada'), false, `${file}: old review version is rejected`);
  assert.doesNotMatch(ctx.M4C.SCREENS.C06(), /revisión interna de esta versión quedó registrada/i, `${file}: old validation is not shown for the new version`);
}

function verifyOperationalTasks(ctx, file) {
  const M = ctx.M4;
  M.reset();
  ctx.location.hash = '#C09';
  M.setDemoContext('AC-122', 'tienda-centro');
  M.requestService('capacitacion');
  M.setDemoContext('AC-122', 'tienda-norte');
  M.requestService('capacitacion');
  const services = M.get().services.filter((item) => item.account === 'AC-122');
  assert.equal(services.length, 2, `${file}: each point keeps its own service request`);
  const subject = 'servicio:' + services[1].id;
  M.setRole('marketing');
  assert.equal(M.reviewTask(subject, 'validada'), false, `${file}: marketing cannot approve service`);
  M.setRole('ventas');
  assert.equal(M.reviewTask(subject, 'en_revision'), true, `${file}: sales takes service review`);
  assert.equal(M.reviewTask(subject, 'validada'), true, `${file}: sales records service review`);
  assert.match(ctx.M4C.SCREENS.C09(), /Revisión registrada/, `${file}: customer sees the point service status`);
  M.shareReferral();
  const referral = M.get().referral;
  assert.equal(referral.account, 'AC-122', `${file}: referral belongs to the selected account`);
  const referralSubject = 'referido:' + referral.account + ':' + referral.code;
  assert.equal(M.reviewTask(referralSubject, 'validada'), false, `${file}: sales cannot approve referral`);
  M.setRole('jefatura');
  assert.equal(M.reviewTask(referralSubject, 'validada'), true, `${file}: management reviews referral`);
  assert.equal(M.get().reviewTasks.find((item) => item.subject === referralSubject).role, 'jefatura', `${file}: referral actor is recorded`);
  assert.match(ctx.M4R.SCREENS.R07(), /Revisar referido/, `${file}: referral appears in the agent queue`);
}

function verifyBuyerLogic(ctx, file) {
  const M = ctx.M4;
  const expected = {
    Hotel: 'desayuno',
    Restaurante: 'mesa',
    'Cafetería': 'molienda',
    'Eventos o catering': 'asistentes',
    OCS: 'cobertura',
    Conveniencia: 'surtido',
    'Panadería': 'estándar',
  };
  for (const [segment, keyword] of Object.entries(expected)) {
    const action = M.nextActionFor({ negocio: segment, operacion: 'Revisión', puntos: '1 punto', volumen: 'No lo sé' });
    assert.ok(action.toLowerCase().includes(keyword), `${file}: ${segment} receives a relevant next action`);
    assert.match(action, /Consumo por confirmar/, `${file}: unknown consumption is preserved for ${segment}`);
  }
  const one = M.nextActionFor({ negocio: 'OCS', operacion: 'Reposición programada', puntos: '1 punto' });
  const many = M.nextActionFor({ negocio: 'OCS', operacion: 'Mantención y soporte', puntos: 'Más de 20 puntos' });
  assert.notEqual(one, many, `${file}: OCS action responds to points and operation`);
  scorePath(M, 'OCS', 'Las Condes');
  M.setRole('ventas');
  M.select(M.get().lead.id);
  const action = M.nextActionFor(M.get().answers);
  // Haiku P3: en C05 queda un solo aviso (tope de alto de 2.500 px); la acción por comprador se muestra como «Próximo paso sugerido» en la ficha del CRM (línea siguiente).
  assert.ok(ctx.M4R.SCREENS.R04().includes(action), `${file}: CRM shows the same buyer-specific action`);
}

function verifyUserHandlers(ctx, file) {
  const M = ctx.M4;
  const changes = ctx.document.listeners.change || [];
  const clicks = ctx.document.listeners.click || [];
  const change = changes.find((fn) => fn.toString().includes("a === 'demo-account'"));
  const click = clicks.find((fn) => fn.toString().includes('act(el.dataset.a, el, e)'));
  assert.ok(change && click, `${file}: actual interface handlers loaded`);
  ctx.location.hash = '#C09';
  M.reset();
  change({ target: { dataset: { a: 'demo-account' }, value: 'AC-121', tagName: 'SELECT' } });
  change({ target: { dataset: { a: 'demo-point' }, value: 'oficina-poniente', tagName: 'SELECT' } });
  assert.equal(M.demoAccount().id, 'AC-121', `${file}: account selector changes state`);
  assert.equal(M.pointFor(M.demoAccount()).id, 'oficina-poniente', `${file}: point selector changes state`);
  ctx.M7Chat.sendClient('Quiero reponer café');
  const order = ctx.M7Chat.confirmReorder().order;
  M.select('AC-121');
  M.setRole('ventas');
  ctx.location.hash = '#R04';
  ctx.document.getElementById('app').contains = () => true;
  const reviewButton = {
    dataset: { a: 'review-point-order', v: 'AC-121', point: 'oficina-poniente', order: order.id, status: 'En revisión' },
    tagName: 'BUTTON', matches() { return false; }, closest(selector) { return selector === '[data-a],[data-go]' ? this : null; },
  };
  click({ target: reviewButton, preventDefault() {} });
  assert.equal(ctx.M7Chat.get().order.status, 'En revisión', `${file}: CRM reorder button updates the selected point`);
  ctx.location.hash = '#C04';
  M.reset();
  M.saveContact({ name: 'Caso de prueba', email: 'audit@example.test', consent: true });
  M.startQuote();
  M.answer('negocio', 'Hotel');
  M.confirmStep();
  change({ target: { dataset: { a: 'comuna' }, value: 'Las Condes', tagName: 'SELECT' } });
  M.confirmStep();
  M.stepBack();
  change({ target: { dataset: { a: 'comuna' }, value: 'Maipú', tagName: 'SELECT' } });
  M.confirmStep();
  assert.equal(M.score(), 47, `${file}: diagnostic selector recalculates score`);
  scorePath(M, 'Hotel', 'Las Condes');
  ctx.location.hash = '#R07';
  M.setRole('ventas');
  const subject = M.reviewSubject();
  ctx.document.getElementById('app').contains = () => true;
  const button = {
    dataset: { a: 'review-proposal', v: subject, status: 'en_revision' },
    tagName: 'BUTTON', matches() { return false; }, closest(selector) { return selector === '[data-a],[data-go]' ? this : null; },
  };
  click({ target: button, preventDefault() {} });
  assert.equal(M.get().reviewTasks.find((item) => item.subject === subject)?.status, 'en_revision', `${file}: review button records the action`);
  M.setRole('marketing');
  button.dataset.status = 'validada';
  click({ target: button, preventDefault() {} });
  assert.equal(M.get().reviewTasks.find((item) => item.subject === subject)?.status, 'en_revision', `${file}: review button enforces role`);
}

function verifyFallbackScreens(html, file, mode) {
  const scripts = scriptsOf(html);
  scripts.forEach((script, i) => {
    if (!/application\/(?:ld\+)?json/i.test(script.attrs)) new vm.Script(script.code, { filename: `${file}#${i}` });
  });
  const markers = [
    'const ARTIFACT_MODE = window.MARLEY_ARTIFACT_MODE',
    'const MARLEY_ASSETS=Object.freeze',
    'Marley Coffee HORECA · implementación funcional local v2',
  ];
  const indexes = moduleIndices(scripts, markers);
  const app = fakeElement();
  const ctx = createContext(mode, app);
  for (const i of indexes) vm.runInContext(scripts[i].code, ctx, { filename: `${file}#${i}`, timeout: 5000 });
  assert.equal(typeof ctx.render, 'function', `${file}: fallback screen renderer exists`);
  for (const id of screenIds) {
    ctx.location.hash = `#${id}`;
    ctx.render();
    assert.equal(ctx.current(), id, `${file}: fallback route ${id}`);
    assert.ok(app.innerHTML.length > 500, `${file}: fallback screen ${id} renders`);
  }
}

function verifyMachineEntryRoutes(ctx, file) {
  const M = ctx.M4, catalog = ctx.M9Catalog;
  const gatedRoute = ['index.html', 'prototipo.html'].includes(file);
  // R4 (13-nov): «Tu negocio» (C04) pide el contacto si falta; el formulario aparte C03 solo se exige para ver la propuesta (C05–C07).
  const firstTarget = 'C04';
  let destination = null;
  const app = ctx.MarleyApp;
  if (!M.STATIC && ['index.html', 'prototipo.html'].includes(file)) {
    M.reset();
    ctx.location.hash = '#C05';
    app.render();
    assert.equal(ctx.location.hash, '#C03', `${file}: direct proposal deep link is redirected to mandatory contact`);
    M.saveContact({ name: 'Contacto de ruta', email: 'ruta@example.cl', consent: true, marketingConsent: false });
    app.go('C04', { afterContact: true });
    assert.equal(ctx.location.hash, 'C04', `${file}: valid contact continues to the diagnostic without losing its saved route`);
  }

  ctx.MarleyApp = { go(id) { destination = id; }, render() {} };
  const click = ctx.document.listeners.click.find(fn => String(fn).includes('[data-m10-machine]'));
  assert.ok(click, `${file}: machine chooser actions are registered`);
  const invoke = (attribute, dataset = {}) => {
    const target = { dataset, hasAttribute(key) { return key === attribute; } };
    click({ target: { closest() { return target; } }, preventDefault() {}, stopImmediatePropagation() {} });
  };

  M.reset();
  catalog.chooseMachine('pods', 'cliente');
  invoke('data-m10-machine', { m10Machine: 'pods' });
  assert.equal(destination, firstTarget, `${file}: machine choice follows this variant's entry route`);
  assert.equal(catalog.journey().machine, 'pods', `${file}: direct choice is retained`);
  assert.equal(catalog.journey().machineSource, 'cliente', `${file}: direct choice remains a customer preference`);
  assert.equal(catalog.journey().productsSkipped, true, `${file}: catalog can be skipped`);

  M.reset();
  destination = null;
  invoke('data-m10-unknown');
  assert.equal(destination, firstTarget, `${file}: guided route follows this variant's entry route`);
  assert.equal(catalog.journey().machine, 'orientacion', `${file}: recommendation route does not force a machine`);
  assert.equal(catalog.journey().machineSource, 'diagnostico', `${file}: guided route is distinguished from direct choice`);

  M.reset();
  catalog.chooseMachine('pods', 'cliente');
  destination = null;
  invoke('data-m10-machine', { m10Machine: 'pods' });
  assert.equal(destination, firstTarget, `${file}: direct machine choice keeps this variant's entry route`);

  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (gatedRoute) {
    assert.match(source, /const hasFirstContact = \(s = M\.get\(\)\) => M\.identified\(s\) && s\.events\.some\(\(e\) => e\.key === 'form1'\)/, `${file}: valid contact and form1 unlock the diagnostic`);
    assert.match(source, /location\.replace\('#C03'\)/, `${file}: direct diagnostic/proposal routes return to contact capture`);
    assert.match(source, /m4FMarketing[\s\S]*?opcional/, `${file}: marketing permission is independent and optional`);
    assert.match(source, /M\.saveContact\(\{ name, email, phone, consent: Boolean\(d\.get\('consent'\)\), marketingConsent \}\)/, `${file}: marketing choice is saved on every contact form submission`);
    assert.match(source, /attribution: s\.lead\.attribution \|\| null/, `${file}: attribution details reach the CRM lead view`);
    assert.doesNotMatch(source, /if\s*\(!creator && !s\.proposal\)[\s\S]*?data-go=\"C04\"/, `${file}: no first-time button bypasses contact capture`);
  }

  M.reset();
  catalog.chooseMachine('pods', 'cliente');
  destination = null;
  invoke('data-m10-finish');
  assert.equal(destination, 'C10', `${file}: optional products-first path remains available`);
}

function verifyVariant(file, mode) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  verifyDemoShell(html, file);
  verifyBlackWhiteHome(html, file);
  if (['index.html', 'prototipo.html'].includes(file)) {
    assert.match(html, /journey: 'full'/, `${file}: site test opens the integrated search journey`);
    assert.match(html, /if \(!S && TEST === 'crm'\) goStart/, `${file}: site test does not navigate to the Marley home during setup`);
    assert.match(html, /if \(TEST === 'sitio'\) startSearchJourney\(DEF\[0\], PICK\.negocio\); else showTask\(\);/, `${file}: consented site test opens the search directly without an extra task-start screen`);
    assert.match(html, /scenario: scenario \|\| ''/, `${file}: the SERP receives only the task scenario, not a suggested keyword`);
    assert.match(html, /body\.classList\.add\('m4t-search-entry'\)/, `${file}: pretest screens cannot expose the site behind the consent flow`);
    assert.match(html, /body\.m4t-search-entry:not\(\.m4t-session-started\) #m4-demo-dock\{display:none!important\}/, `${file}: moderator toolbar stays out of the participant's search-first entry`);
    assert.match(html, /q\.get\('journey'\) === 'resume'/, `${file}: search-result handoff resumes the same task`);
    assert.match(html, /resumeGoogle \|\| confirm\(/, `${file}: integrated return does not interrupt the participant with a resume prompt`);
    assert.match(html, /journeyElapsedMs/, `${file}: total task timing includes the search phase`);
    assert.match(html, /searchCsvData\(\)/, `${file}: moderator can export the query record from the test report`);
    assert.doesNotMatch(html, /Desde esta página, busca cómo pedir una propuesta/, `${file}: test prompt does not seed the search keywords`);
  }
  assert.match(html, /\?movil=1&v=\$\{mobileVersion\}/, `${file}: mobile preview URL is versioned to avoid stale markup`);
  const scripts = scriptsOf(html);
  const markers = [
    'window.M4D =', 'Marley Coffee Empresas · v5 · datos nuevos', 'window.M4 = (() =>',
    'window.M4UI = (() =>', 'window.M5UI = (() =>', 'window.M9Catalog = (() =>',
    'window.M4C = (() =>', 'window.M4R = (() =>', 'window.M4N = (() =>',
    'window.MarleyApp = (() =>', 'window.M7Chat = (() =>', 'window.M8UX = (() =>', 'window.M7Connections = (() =>',
  ];
  const indexes = moduleIndices(scripts, markers);
  const ctx = createContext(mode, fakeElement());
  for (const i of indexes) vm.runInContext(scripts[i].code, ctx, { filename: `${file}#${i}`, timeout: 5000 });
  verifyPackJourney(ctx, file);
  assert.match(html, /Ayúdame a elegir una máquina/, `${file}: home offers the guided path`);
  assert.match(html, /Ya sé cuál me interesa/, `${file}: home offers the direct path`);
  assert.match(html, /Ver packs y productos/, `${file}: products remain easy to reach`);
  assert.match(html, /Continuar con \$\{esc\(m\.name\)\}/, `${file}: selected machine has a contextual continue action`);
  if (['index.html', 'prototipo.html'].includes(file)) {
    assert.match(html, /const weighted=\(window\.M4\?\.M2_ORDER\|\|\[\]\)\.filter\(\(key\)=>key!=='comuna'\)/, `${file}: the test view derives score rules from the canonical event table`);
    assert.match(html, /Ver pesos de Engagement v1\.1 · 13 eventos/, `${file}: scoring details disclose all weighted events`);
    assert.match(html, /navegación anterior al contacto permanece anónima y en cero/i, `${file}: the scoring details explain the pre-contact rule`);
    assert.doesNotMatch(html, /Los demás eventos no tienen peso asignado/i, `${file}: scoring copy does not contradict the canonical M2 event table`);
    assert.match(html, /m5-foot-guide[^>]*href="guia-servicio-cafe\.html"/, `${file}: the full useful guide is reachable without crowding the home flow`);
    assert.match(html, /Prospectos de la muestra[\s\S]*Cuentas para reactivar/, `${file}: acquisition prospects and reactivation accounts remain separate CRM bases`);
    assert.match(html, /Una recompra en esta base cuenta como reactivación o retención, no como alta nueva/, `${file}: a reactivated existing account is not miscounted as a new customer`);
  }
  verifyMachineEntryRoutes(ctx, file);
  const scenarios = verifyScoring(ctx, file);
  const screens = verifyActiveScreens(ctx, file);
  verifyPointService(ctx, file);
  verifyProposalReview(ctx, file);
  verifyOperationalTasks(ctx, file);
  verifyBuyerLogic(ctx, file);
  verifyUserHandlers(ctx, file);
  verifyFallbackScreens(html, file, mode);
  return { file, scenarios, screens, fallbackScreens: screenIds.length };
}

function verifyPackJourney(ctx, file) {
  const M = ctx.M4, catalog = ctx.M9Catalog, app = ctx.MarleyApp;
  let destination = null;
  ctx.MarleyApp = { go(id) { destination = id; }, render() {} };
  M.reset();
  const click = ctx.document.listeners.click.find(fn => String(fn).includes('[data-m9-pack]'));
  assert.ok(click, `${file}: catalog pack action is registered`);
  const pack = { dataset: { m9Pack: 'inicio' }, hasAttribute(key) { return key === 'data-m9-pack'; } };
  const event = { target: { closest() { return pack; } }, preventDefault() {}, stopImmediatePropagation() {} };
  const beforeScore = M.score();
  click(event);
  assert.deepEqual(Array.from(catalog.lines(), x => x.id), ['grano', 'milk'], `${file}: suggested pack adds existing products`);
  if (['index.html', 'prototipo.html'].includes(file)) {
    assert.match(catalog.catalogHTML(), /cantidad inicial no estima tu consumo/i, `${file}: packs do not imply a verified monthly consumption`);
    assert.match(catalog.catalogHTML(), /inicio editable/i, `${file}: initial pack quantities are visibly adjustable`);
  }
  assert.equal(M.score(), beforeScore, `${file}: choosing a pack does not inflate score`);
  catalog.setQuantity('grano', 3);
  click(event);
  assert.equal(catalog.lines().find(x => x.id === 'grano').qty, 3, `${file}: repeating a pack preserves edited quantities`);
  assert.equal(catalog.lines().length, 2, `${file}: repeating a pack does not duplicate products`);
  catalog.remove('milk');
  catalog.add('tea');
  assert.deepEqual(Array.from(catalog.lines(), x => x.id), ['grano', 'tea'], `${file}: products can be individually changed`);
  assert.equal(catalog.nextExploration(), 'C10', `${file}: products appear before contact`);
  catalog.reviewProducts();
  assert.notEqual(destination, 'C11', `${file}: machine choice is not mandatory before diagnosis`);
  assert.equal(catalog.journey().machine, 'orientacion', `${file}: machine defaults to guidance`);
  assert.deepEqual(Array.from(catalog.snapshot(M.get()).items, x => x.id), ['grano', 'tea'], `${file}: selection preserved in proposal snapshot`);
  M.answer('negocio', 'Hotel');
  M.confirmStep();
  M.saveContact({ name: 'Prueba', email: 'prueba@example.test', consent: true });
  M.enterPortal();
  M.setComuna('Las Condes');
  M.confirmStep();
  M.confirmStep();
  M.viewProposal();
  assert.ok(M.get().proposal, `${file}: diagnostic produces a proposal`);
  assert.deepEqual(Array.from(M.get().proposal.catalogCart.items, x => x.id), ['grano', 'tea'], `${file}: proposed products persist for the CRM`);
  M.update(s => { s.catalogJourney = { ...s.catalogJourney, machine: 'pods' }; });
  assert.match(catalog.summaryHTML(M.get()), /Formato por confirmar[\s\S]*orientación actual es Pods/, `${file}: client sees a contextual Pods/grain validation note`);
  assert.match(catalog.summaryHTML(M.get(), { internal: true }), /Formato por confirmar/, `${file}: CRM sees the same contextual validation note`);
  M.update(s => { s.catalogJourney = { ...s.catalogJourney, machine: 'bar' }; });
  assert.doesNotMatch(catalog.summaryHTML(M.get()), /Formato por confirmar/, `${file}: unrelated machine recommendations do not get the note`);
  M.update(s => { s.answers.negocio = 'OCS'; s.answers.operacion = 'Autoservicio'; s.call = { ficha: { maquina: 'bar' } }; });
  assert.equal(M.recommendation(M.get(), { fresh: true }).machine, ctx.M4D.machineFor(M.get().answers), `${file}: fresh recommendation follows current diagnostic, not a stale sales note`);
  const directChooser = ctx.document.listeners.click.find(fn => String(fn).includes('[data-m10-machine]'));
  assert.ok(directChooser, `${file}: machine selector actions are registered`);
  const machineButton = { dataset: { m10Machine: 'pods' }, hasAttribute(key) { return key === 'data-m10-machine'; } };
  directChooser({ target: { closest() { return machineButton; } }, preventDefault() {}, stopImmediatePropagation() {} });
  const direct = M.recommendation(M.get(), { fresh: true });
  assert.equal(direct.machine, 'pods', `${file}: a direct choice survives a conflicting fresh diagnostic`);
  assert.equal(direct.diagnosticMachine, ctx.M4D.machineFor(M.get().answers), `${file}: diagnostic remains available as an explicit alternative`);
  assert.equal(direct.machineSource, 'cliente', `${file}: source of machine choice stays visible`);
  assert.match(catalog.summaryHTML(M.get(), { internal: true }), /Preferencia del cliente[\s\S]*Pods/, `${file}: CRM receives the user's machine preference`);
  assert.equal(M.get().proposal.machine, 'pods', `${file}: direct selection updates the active proposal`);
  const alternative = direct.diagnosticMachine;
  catalog.chooseMachine(alternative,'diagnostico');
  assert.equal(M.get().proposal.machine, alternative, `${file}: explicit switch updates the proposal machine`);
  assert.equal(M.recommendation(M.get(), { fresh: true }).machine, alternative, `${file}: explicit diagnostic choice replaces the manual preference`);
  assert.match(catalog.machinesHTML(), /data-m10-machine=\"bar\"/, `${file}: C11 lets a customer choose a machine`);
  M.reset();
  destination = null;
  catalog.begin({ machine: 'pods' });
  assert.equal(destination, 'C10', `${file}: direct machine selection continues to products`);
  assert.match(catalog.catalogHTML(), /Máquina de interés:[\s\S]*Pods/, `${file}: catalog confirms the direct machine choice`);
  assert.equal(catalog.journey().machine, 'pods', `${file}: direct selection persists into the product step`);
  assert.equal(catalog.journey().machineSource, 'cliente', `${file}: direct path is distinguished from diagnosis`);
  catalog.reviewProducts();
  assert.equal(catalog.journey().machine, 'pods', `${file}: choosing packs does not erase the machine preference`);
  ctx.MarleyApp = app;
  M.reset();
}

function verifySearchLab() {
  const file = path.join(root, 'PRUEBA_CON_PERSONAS', 'serp-seo-aeo-geo.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/i, 'search lab stays out of indexing');
  assert.match(html, /no consulta Google en vivo ni predice posiciones o citas reales/i, 'simulated SERP results are not presented as live rankings or citations');
  assert.match(html, /no son una respuesta generada ni citas reales/i, 'AI summary is not presented as a real Google or AI citation');
  assert.match(html, /aria-label="Accesos directos"/, 'search result exposes direct sitelinks');
  assert.match(html, /id="faq"[\s\S]*Otras preguntas[\s\S]*¿Cómo elijo una máquina/, 'AEO answers appear as expandable related questions');
  assert.match(html, /id="ai-overview"[\s\S]*Cotización para empresas[\s\S]*Catálogo de café[\s\S]*no son una respuesta generada/i, 'GEO concept has official sources and explicit simulation disclosure');
  assert.match(html, /id="blog"[\s\S]*Contenido útil|id="blog"[\s\S]*Blog/, 'value article is testable');
  assert.match(html, /id="query" name="q" type="search" autocomplete="off" placeholder="Buscar en la web" aria-label="Buscar en la web" required/, 'participant enters their own query without suggestions');
  assert.match(html, /aria-label="Google · simulación de búsqueda"/, 'the first study screen is clearly a Google-style search simulation');
  assert.match(html, /id="task-context"[^>]*hidden/, 'task scenario remains hidden unless it is explicitly passed by the integrated test');
  assert.match(html, /main\{width:100%;min-width:0\}/, 'mobile main fits the viewport');
  assert.match(html, /form\{flex-direction:column;width:100%;max-width:100%;min-width:0\}/, 'mobile search form stays within its content column');
  assert.match(html, /form input,form button\{width:100%;min-width:0\}/, 'mobile search input and button do not cause horizontal overflow');
  assert.match(html, /\.notice,\.task-context\{width:100%;overflow-wrap:anywhere\}/, 'mobile notice and scenario text wrap inside the viewport');
  assert.match(html, /const taskScenarios=\{[\s\S]*hotel:[\s\S]*restaurante:[\s\S]*cafeteria:[\s\S]*eventos:/, 'the search entry can show the selected buyer task without seeding a keyword');
  assert.match(html, /el\.target=integratedJourney\?'_self':'_blank'/, 'integrated journey continues in the same tab');
  assert.match(html, /linkQuery\.set\('journey','resume'\)/, 'prototype return resumes the active usability session');
  assert.match(html, /journey_started_at/, 'search duration is carried into the prototype test without query text');
  assert.match(html, /\['title','description'\]\.includes\(params\.get\('phase'\)\)/, 'title and description are tested in separate phases');
  assert.match(html, /titleVariants=\{A:[\s\S]*descriptionVariants=\{A:/, 'A/B variants are defined for the two isolated phases');
  assert.match(html, /read\(sessionStorage,sessionKey,null\)/, 'search-lab session restores after refresh');
  assert.match(html, /session\.queries\.push\(item\)/, 'search-lab retains the full query sequence');
  assert.match(html, /'session_id','participant','phase','variant'/, 'search-lab export identifies session, participant, phase, and variant');
  assert.match(html, /mc_session|sessionId/, 'prototype links carry a local session handoff');
  assert.match(html, /q\.set\('mc_surface',el\.dataset\.surface/, 'SERP links preserve the selected surface into attribution');
  assert.match(html, /data-screen="C11"/, 'direct machine path retains its screen instead of resetting to home');
  assert.match(html, /data-screen="C10"/, 'direct products path retains its screen instead of resetting to home');
  assert.match(html, /data-result="marley"[\s\S]*data-result="guide"[\s\S]*data-result="compare"/, 'SERP stimulus includes alternatives and can control result order');
  assert.match(html, /data-result="content"[\s\S]*captacion\/contenidos\/index\.html/, 'SERP exposes the existing content hub as a controlled organic result');
  assert.doesNotMatch(html.slice(0, html.indexOf('<section class="results"')), /Marley Coffee|máquina de café|café para empresas/i, 'brand/category language is hidden before the spontaneous query');
  assert.doesNotMatch(html, /<script[^>]+src=|\bfetch\s*\(/i, 'search lab makes no external analytics or network requests');
  const script = html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(script, 'search lab includes local interaction logic');
  new vm.Script(script[1], { filename: file });
  return { file: path.basename(file), indexable: false, phases: ['title', 'description'], interactions: 'local-only' };
}

function mapStorage() {
  const values = new Map();
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); }, values };
}

function bootSearchLab(search, sessionStorage, localStorage) {
  const listeners = {};
  const makeNode = (extra = {}) => Object.assign({
    value: '', textContent: '', hidden: false, href: '', download: '', dataset: {}, children: [], handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
    removeAttribute(name) { delete this[name]; },
    append(...children) { this.children = this.children.filter((node) => !children.includes(node)); this.children.push(...children); },
    scrollIntoView() {}, click() {}, matches(selector) { return selector === '[data-prototype]' ? Boolean(this.dataset.prototype) : selector === '[data-handoff]' ? Boolean(this.dataset.handoff) : Boolean(this.dataset.prototype || this.dataset.handoff); },
  }, extra);
  const nodes = Object.fromEntries(['search','query','results','query-label','serp-list','brand-result','guide-result','compare-result','content-result','organic-title','organic-description','task-context','task-text','download','ai-overview','ai-title','ai-copy','faq','faq-title'].map((id) => [id, makeNode({ id })]));
  nodes.results.hidden = true;
  nodes['task-context'].hidden = true;
  nodes['organic-title'].dataset.surface = 'resultado-organico'; nodes['organic-title'].dataset.prototype = '1'; nodes['organic-title'].dataset.screen = 'C02';
  nodes['guide-result'].dataset.surface = 'resultado-guia'; nodes['guide-result'].dataset.handoff = '../guia-servicio-cafe.html';
  nodes['content-result'].dataset.surface = 'resultado-contenido'; nodes['content-result'].dataset.handoff = '../captacion/contenidos/index.html';
  const faqItems=[0,1,2].map(()=>makeNode({open:false}));
  nodes.faq.querySelectorAll=(selector)=>selector==='details'?faqItems:[];
  const addPrototypeLink=(id,surface,screen)=>{nodes[id]=makeNode({id,dataset:{surface,prototype:'1',screen}});};
  addPrototypeLink('sitelink-quote','acceso-cotizar','C04');
  addPrototypeLink('sitelink-products','acceso-packs','C10');
  addPrototypeLink('sitelink-machines','acceso-maquinas','C11');
  addPrototypeLink('sitelink-service','acceso-servicio','C02');
  addPrototypeLink('faq-machine','faq-maquinas','C11');
  addPrototypeLink('faq-diagnostico','faq-diagnostico','C04');
  addPrototypeLink('faq-packs','faq-packs','C10');
  const links = ['organic-title', 'guide-result', 'sitelink-quote','sitelink-products','sitelink-machines','sitelink-service','faq-machine','faq-diagnostico','faq-packs','compare-result','content-result'].map((id) => nodes[id]);
  let blob = null;
  const document = {
    getElementById(id) { return nodes[id] || null; },
    querySelectorAll(selector) { return selector === '[data-prototype],[data-handoff]' ? links : []; },
    createElement() { return makeNode({ click() {} }); },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  const context = vm.createContext({
    document, location: { search, href: 'file:///prototype/PRUEBA_CON_PERSONAS/serp-seo-aeo-geo.html'+search },
    sessionStorage, localStorage, URLSearchParams, Blob, Date, Math, JSON, Array, Object, String, Number, RegExp,
    URL: { createObjectURL(value) { blob = value; return 'blob:local-test'; }, revokeObjectURL() {} },
    matchMedia() { return { matches: true }; }, setTimeout(fn) { return 1; }, console,
  });
  const html = fs.readFileSync(path.join(root, 'PRUEBA_CON_PERSONAS', 'serp-seo-aeo-geo.html'), 'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/i)[1], context, { filename: 'serp-seo-aeo-geo.html' });
  return { nodes, listeners, getBlob() { return blob; } };
}

async function verifySearchLabSession() {
  const sessionStorage = mapStorage(), localStorage = mapStorage(), search = '?phase=title&pid=P1';
  let page = bootSearchLab(search, sessionStorage, localStorage);
  page.nodes.query.value = 'café para mi local';
  page.nodes.search.handlers.submit({ preventDefault() {} });
  assert.equal(page.nodes.results.hidden, false, 'search results appear only after the query is entered');
  assert.match(page.nodes['organic-title'].href, /mc_session=SERP-/i, 'first-party result carries a session handoff');
  assert.match(page.nodes['organic-title'].href, /mc_phase=title&mc_variant=A/, 'handoff records its actual phase and assigned variant');
  assert.match(page.nodes['organic-title'].href, /mc_surface=resultado-organico/, 'handoff records which result the participant selected');
  assert.match(page.nodes['sitelink-machines'].href, /#C11$/, 'machine sitelink remains a direct machine path');
  assert.match(page.nodes['sitelink-products'].href, /#C10$/, 'product sitelink remains a direct products path');
  assert.match(page.nodes['sitelink-quote'].href, /#C04$/, 'quote sitelink opens first-contact route');
  assert.equal(page.nodes['ai-overview'].hidden,false,'query-relevant AI overview appears after a B2B search');
  assert.equal(page.nodes.faq.hidden,false,'query-relevant FAQ answers appear after a B2B search');
  assert.match(page.nodes['guide-result'].href, /^\.\.\/guia-servicio-cafe\.html\?/, 'guide result preserves its destination while handing off attribution');
  assert.match(page.nodes['guide-result'].href, /mc_surface=resultado-guia/, 'guide result records its entry surface');
  assert.match(page.nodes['content-result'].href, /^\.\.\/captacion\/contenidos\/index\.html\?/, 'content hub result preserves its destination while handing off attribution');
  assert.match(page.nodes['content-result'].href, /mc_surface=resultado-contenido/, 'content hub result records its entry surface');
  assert.ok(page.nodes['serp-list'].children.includes(page.nodes['content-result']), 'value-content result appears in the SERP');
  const click = page.listeners.click[0];
  click({ target: { closest() { return page.nodes['organic-title']; } } });
  page.nodes.query.value = 'cómo abastecer café en una cafetería';
  page.nodes.search.handlers.submit({ preventDefault() {} });
  page = bootSearchLab(search, sessionStorage, localStorage);
  assert.equal(page.nodes.results.hidden, false, 'refresh restores the last results view');
  page.nodes.download.handlers.click();
  const csv = await page.getBlob().text();
  assert.match(csv, /"session_id","participant","phase","variant","assignment","result_order","query_index","query"/);
  assert.match(csv, /"P1","title","A"/);
  assert.match(csv, /café para mi local/);
  assert.match(csv, /cómo abastecer café en una cafetería/);
  assert.match(csv, /resultado-organico/);
  const integratedStorage = mapStorage(), integratedLocal = mapStorage();
  const integrated = bootSearchLab('?phase=description&pid=P2&journey=full&scenario=hotel&journey_started_at=1700000000000&sid=MC-P2-demo&return=prototipo.html', integratedStorage, integratedLocal);
  assert.equal(integrated.nodes.results.hidden, true, 'integrated journey opens on the blank Google-style search, before results or the site');
  assert.equal(integrated.nodes['task-context'].hidden, false, 'selected business task is visible before the participant searches');
  assert.match(integrated.nodes['task-text'].textContent, /hotel.*café del desayuno/i, 'task is clear without prescribing the search words');
  assert.equal(integrated.nodes.query.value, '', 'query is blank when the test journey starts');
  integrated.nodes.query.value = 'café para el desayuno de mi hotel';
  integrated.nodes.search.handlers.submit({ preventDefault() {} });
  assert.equal(integrated.nodes['organic-title'].target, '_self', 'integrated organic result stays in the test tab');
  assert.equal(integrated.nodes['content-result'].target, '_self', 'integrated content result stays in the test tab');
  assert.match(integrated.nodes['organic-title'].href, /test=sitio.*qa=1.*journey=resume/, 'site return keeps test mode and resumes without a new preflight');
  assert.match(integrated.nodes['organic-title'].href, /return=prototipo\.html/, 'site return preserves the prototype entry file');
  const organicHandoffParams = new URL(integrated.nodes['organic-title'].href, 'http://localhost/').searchParams;
  assert.equal([...organicHandoffParams.values()].includes(integrated.nodes.query.value), false, 'raw query is not copied into the CRM-facing URL');
  const integratedClick = integrated.listeners.click[0];
  integratedClick({ target: { closest() { return integrated.nodes['organic-title']; } } });
  assert.match(integrated.nodes['organic-title'].href, /mc_first_click_surface=resultado-organico/, 'site return records selected surface for test attribution');
  assert.match(integrated.nodes['organic-title'].href, /mc_first_click_ms=\d+/, 'site return records time to first search-result click');
  return { reload: 'PASS', queryRows: 2, variant: 'A', firstClick: 'retained', integratedSameTab: 'PASS', csv: 'PASS' };
}

function verifyMotion(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(html, /class="ux-hero ux-hero-scroll" data-driver/, `${file}: scroll-linked home video remains in place`);
  assert.match(html, /data-typewriter/, `${file}: animated headline remains in place`);
  assert.match(html, /V\.cam\('barras'/, `${file}: machine camera animation remains in place`);
  assert.match(html, /document\.documentElement\.dataset\.motion === 'off' \|\| prefersReduced\(\)/, `${file}: UI motion test flag reaches animation controls`);
  assert.match(html, /mode === 'still'[\s\S]*prefersReduced\(\)/, `${file}: video preference remains separate from the UI motion comparison`);
}

function verifyGuide() {
  const file = path.join(root, 'guia-servicio-cafe.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/, 'academic guide stays out of indexing');
  assert.equal((html.match(/<h1\b/g)||[]).length, 1, 'guide has one H1');
  assert.match(html, /<meta name="description" content="[^"]{50,155}"/, 'guide description is concise for a search snippet');
  assert.match(html, /Quien administra o compra[\s\S]*Quien prepara el café/, 'guide includes business decision makers and coffee staff');
  assert.match(html, /¿Tengo que saber qué máquina elegir\?/, 'guide answers a buyer question directly');
  assert.match(html, /compatibilidad[\s\S]*se confirman con el equipo/, 'guide avoids unverified commercial claims');
  assert.match(html, /@media\(max-width:600px\)/, 'guide has a mobile layout');
  assert.match(html, /prefers-reduced-motion:reduce/, 'guide respects reduced motion');
  assert.match(html, /data-attribution-handoff/, 'guide CTAs can carry experiment attribution forward');
  assert.match(html, /mc_entry_surface/, 'guide preserves the original SERP surface');
  assert.doesNotMatch(html, /application\/ld\+json/, 'guide does not imply special GEO schema guarantees');
  return { file: path.basename(file), indexable: false, h1: 1, mobile: true };
}

function verifyGuideAttribution() {
  const anchors = [
    { href: 'index.html?utm_source=guia_contenido&utm_medium=owned_content#C02', dataset: { surface: 'guia-solucion' } },
    { href: 'index.html?utm_source=guia_contenido&utm_medium=owned_content#C10', dataset: { surface: 'guia-productos' } },
    { href: 'blog-empresas.html', dataset: { surface: 'guia-mas-contenido' } },
  ];
  const html = fs.readFileSync(path.join(root, 'guia-servicio-cafe.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  assert.equal(scripts.length, 1, 'guide has one local attribution handoff script');
  const context = vm.createContext({
    URL, URLSearchParams,
    location: { href: 'file:///prototype/guia-servicio-cafe.html?utm_source=marley-serp-lab&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_assignment=alternada&mc_order=alternativas-primero&mc_query_id=2&mc_surface=resultado-guia', search: '?utm_source=marley-serp-lab&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_assignment=alternada&mc_order=alternativas-primero&mc_query_id=2&mc_surface=resultado-guia' },
    document: { querySelectorAll(selector) { return selector === '[data-attribution-handoff]' ? anchors : []; } },
  });
  vm.runInContext(scripts[0], context, { filename: 'guia-servicio-cafe.html' });
  const solution = new URL(anchors[0].href, context.location.href);
  assert.equal(solution.searchParams.get('mc_session'), 'SERP-1', 'guide preserves the search session into CRM');
  assert.equal(solution.searchParams.get('mc_entry_surface'), 'resultado-guia', 'guide carries the original SERP surface');
  assert.equal(solution.searchParams.get('mc_surface'), 'guia-solucion', 'guide CTA records its latest surface');
  assert.equal(solution.searchParams.get('utm_source'), 'marley-serp-lab', 'guide does not overwrite experiment attribution with default owned content');
  assert.equal(solution.hash, '#C02', 'guide keeps its solution destination');
  const products = new URL(anchors[1].href, context.location.href);
  assert.equal(products.hash, '#C10', 'guide keeps its products destination');
  const moreContent = new URL(anchors[2].href, context.location.href);
  assert.equal(moreContent.searchParams.get('mc_session'), 'SERP-1', 'guide preserves the search session into the content hub');
  assert.equal(moreContent.searchParams.get('mc_entry_surface'), 'resultado-guia', 'guide carries the original SERP surface to the content hub');
  assert.equal(moreContent.searchParams.get('mc_surface'), 'guia-mas-contenido', 'guide records the content-hub CTA');
  assert.equal(moreContent.pathname, '/prototype/blog-empresas.html', 'guide links to the content hub');
  return { session: 'SERP-1', originalSurface: 'resultado-guia', CTA: 'guia-solucion', destinations: ['C02','C10'] };
}

function verifyBlogHub() {
  const file = path.join(root, 'blog-empresas.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/, 'prototype content hub stays out of indexing');
  assert.equal((html.match(/<h1\b/g)||[]).length, 1, 'content hub has one H1');
  assert.match(html, /Cómo organizar el café para una oficina/, 'hub includes an office service article');
  assert.match(html, /Cómo coordinar el café en un hotel o restaurante/, 'hub includes a hotel and restaurant article');
  assert.match(html, /Cómo preparar una lista de productos sin perder flexibilidad/, 'hub includes a products and replenishment article');
  assert.match(html, /Preguntas frecuentes[\s\S]*<details>/, 'hub exposes concise buyer FAQs');
  assert.match(html, /@media\(max-width:680px\)/, 'content hub has a mobile layout');
  assert.match(html, /data-attribution-handoff/, 'hub carries the experiment into the prototype and guide');
  assert.match(html, /mc_entry_surface/, 'hub preserves the original search-result surface');
  assert.doesNotMatch(html, /application\/ld\+json/, 'hub does not claim GEO results through special schema');
  return {file:path.basename(file),indexable:false,h1:1,articles:3,mobile:true};
}

function verifyBlogHubAttribution() {
  const anchor={href:'index.html#C02',dataset:{surface:'oficinas-solucion'}};
  const html=fs.readFileSync(path.join(root,'blog-empresas.html'),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(script,'content hub includes attribution handoff logic');
  const search='?utm_source=marley-serp-lab&mc_source=serp_lab&mc_session=SERP-1&mc_phase=title&mc_variant=B&mc_query_id=2&mc_surface=resultado-contenido';
  const context=vm.createContext({URL,URLSearchParams,location:{href:'file:///prototype/blog-empresas.html'+search,search},document:{querySelectorAll(selector){return selector==='[data-attribution-handoff]'?[anchor]:[];}}});
  vm.runInContext(script[1],context,{filename:'blog-empresas.html'});
  const next=new URL(anchor.href,context.location.href);
  assert.equal(next.searchParams.get('mc_session'),'SERP-1','hub carries the SERP session into the site');
  assert.equal(next.searchParams.get('mc_entry_surface'),'resultado-contenido','hub preserves the original search surface');
  assert.equal(next.searchParams.get('mc_surface'),'oficinas-solucion','hub CTA records the last user action');
  assert.equal(next.hash,'#C02','hub CTA keeps the guided path');
  return {session:'SERP-1',originalSurface:'resultado-contenido',CTA:'oficinas-solucion'};
}

async function main() {
  const results = variants.map(([file, mode]) => verifyVariant(file, mode));
  const searchLab = { ...verifySearchLab(), runtime: await verifySearchLabSession() };
  const guide = { ...verifyGuide(), attribution: verifyGuideAttribution() };
  const blog = { ...verifyBlogHub(), attribution: verifyBlogHubAttribution() };
  verifyMotion('index.html');
  verifyMotion('prototipo.html');
  console.log(JSON.stringify({
    status: 'PASS',
    variants: results.length,
    buyerSegments: buyerSegments.length,
    m2WeightedEvents: Object.keys(expectedWeights).length,
    geographicEvent: 'comuna',
    scenarioScores: results[0].scenarios,
    activeScreensPerVariant: results[0].screens,
    fallbackScreensPerVariant: results[0].fallbackScreens,
    searchLab,
    guide,
    blog,
    results,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
