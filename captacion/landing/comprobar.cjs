// Verifica las landings de campaña servidas desde un único origen HTTP local.
// Uso: node captacion/landing/comprobar.cjs [http://127.0.0.1:8800]
// Usa Chrome del sistema y el Playwright ya instalado en el equipo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const ORIGEN = process.argv[2] || 'http://127.0.0.1:8800';
const SOLO_FORMULARIOS = process.argv.includes('--forms-only');
const SOLO_MOVIMIENTO = process.argv.includes('--motion-only');
const URLS = `${ORIGEN.replace(/\/$/, '')}/captacion/landing`;
const EVIDENCIA = path.join(__dirname, 'evidencia');
const VIEWPORTS = [
  { id: '360', width: 360, height: 800, mobile: true },
  { id: '390', width: 390, height: 844, mobile: true },
  { id: '1440', width: 1440, height: 900, mobile: false },
];
const A8_VIEWPORTS = [
  { id: '320x640', width: 320, height: 640, mobile: true },
  { id: '360x800', width: 360, height: 800, mobile: true },
  { id: '390x844', width: 390, height: 844, mobile: true },
  { id: '768x1024', width: 768, height: 1024, mobile: true },
  { id: '1366x768', width: 1366, height: 768, mobile: false },
  { id: '1440x900', width: 1440, height: 900, mobile: false },
];
const SLUGS = ['restaurantes', 'hoteles', 'cafeterias', 'oficinas', 'eventos-catering', 'conveniencia', 'panaderias', 'empresas'];
const HOJA_ESPERADA = [
  'Qué incluye|La máquina, los productos y los servicios de tu propuesta, uno por uno.',
  'Quién responde|A quién llamas si algo falla y por qué canal.',
  'Qué documento recibes|El documento y las condiciones se confirman en la propuesta.',
  'Cómo se termina|Las condiciones para cerrar el servicio, sin letra chica.',
];
const MODOS = [
  { id: 'base', query: 'media=static&motion=off' },
  { id: 'directo', query: 'form=directo&media=static&motion=off' },
  { id: 'inicio-progresivo', query: 'f=inicio&media=static&motion=off' },
  { id: 'inicio-directo', query: 'f=inicio&form=directo&media=static&motion=off' },
];
let comprobaciones = 0;
const fallos = [];

function ruta(slug, query = '') {
  return `${URLS}/${slug}.html${query ? `?${query}` : ''}`;
}

async function inspeccionar(page) {
  return page.evaluate(() => {
    const visible = (el) => Boolean(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
    const params = new URLSearchParams(location.search);
    let cta = null;
    if (params.get('f') === 'inicio' && params.get('form') !== 'directo') cta = document.querySelector('.ld-hero__form [data-accion="guardar"]');
    else if (params.get('f') === 'inicio' && params.get('form') === 'directo') cta = document.querySelector('.ld-hero [data-cta="hero"]');
    else cta = document.querySelector('.ld-hero [data-cta="hero"]');
    const r = cta && visible(cta) ? cta.getBoundingClientRect() : null;
    const allIds = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
    const h1 = document.querySelector('h1');
    const pill = document.querySelector('.ld-opciones input:checked + span');
    const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (value) => rgb(value).map((c) => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const config = JSON.parse(document.querySelector('#ld-config').textContent);
    const externalLinks = Array.from(document.querySelectorAll('a[href]')).filter((a) => {
      if (!visible(a)) return false;
      try { return new URL(a.href, location.href).origin !== location.origin; } catch (_) { return true; }
    }).map((a) => a.href);
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      ctaVisible: Boolean(r && r.top >= 0 && r.bottom <= innerHeight),
      ctaTop: r ? Math.round(r.top) : null,
      h1: h1?.innerText || '',
      h1Visible: visible(h1),
      robots: document.querySelector('meta[name="robots"]')?.content?.trim().toLowerCase() || '',
      touchTargets: ['#c-base', '#f-consent', '#f-marketing'].map((selector) => {
        const el = document.querySelector(selector);
        const box = el?.getBoundingClientRect();
        return { selector, width: box ? Math.round(box.width) : 0, height: box ? Math.round(box.height) : 0 };
      }),
      interactiveTargets: Array.from(document.querySelectorAll('a[href], button, input[type="checkbox"], input[type="range"], summary')).filter(visible).map((el) => {
        const box = el.getBoundingClientRect();
        return { selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(), width: Math.round(box.width), height: Math.round(box.height) };
      }).concat(Array.from(document.querySelectorAll('label')).filter((el) => el.querySelector('input[type="radio"]') && visible(el)).map((el) => {
        const box = el.getBoundingClientRect();
        return { selector: 'radio-label', width: Math.round(box.width), height: Math.round(box.height) };
      })),
      selectedPill: pill ? {
        background: getComputedStyle(pill).backgroundColor,
        ratio: contrast(getComputedStyle(pill).color, getComputedStyle(pill).backgroundColor),
      } : null,
      formula: document.querySelector('.ld-resultado .nm-nota')?.innerText || '',
      buyer: config.buyer,
      genericNamesSector: /restaurante|hotel|cafeter|oficin|evento|catering|conveniencia|panader/i.test(document.body.innerText),
      fichaRows: Array.from(document.querySelectorAll('.ld-ficha__fila')).map((row) => ({
        label: row.querySelector('.ld-ficha__etiqueta')?.textContent.trim() || '',
        value: row.querySelector('.ld-ficha__valor')?.textContent.trim() || '',
        dots: getComputedStyle(row.querySelector('.ld-ficha__puntos')).borderBottomStyle,
        font: getComputedStyle(row.querySelector('.ld-ficha__etiqueta')).fontFamily,
      })),
      hojaCopy: Array.from(document.querySelectorAll('.ld-hoja__item')).map((row) => `${row.querySelector('h3')?.textContent.trim()}|${row.querySelector('p')?.textContent.trim()}`),
      directFormVisible: visible(document.querySelector('[data-accion="directo"]')),
      formMode: document.querySelector('#ld-form')?.dataset.form,
      fMode: document.body.classList.contains('ld--form-inicio') ? 'inicio' : 'despues',
      messageExpected: params.get('m') && config.mensajes[params.get('m')] ? config.mensajes[params.get('m')].h1 : null,
      externalLinks,
      duplicateIds: allIds.filter((id, i) => allIds.indexOf(id) !== i),
      remainingTemplateMarker: document.body.innerText.includes('@@'),
    };
  });
}

async function navegar(context, page, url, meta = {}) {
  const errores = [];
  const onConsole = (m) => { if (m.type() === 'error') errores.push(m.text()); };
  const onPageError = (e) => errores.push(String(e));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  await page.goto(url, { waitUntil: 'networkidle' });
  const datos = await inspeccionar(page);
  comprobaciones++;
  const tipo = `${meta.slug || new URL(url).pathname.split('/').pop()} · ${meta.viewport || 'funcional'} · ${meta.variant || ''}`;
  const issues = [];
  if (datos.overflow) issues.push(`desborde ${datos.overflow}px`);
  if (meta.requireCta !== false && !datos.ctaVisible) issues.push(`CTA no visible (top=${datos.ctaTop})`);
  if (!datos.h1.trim() || !datos.h1Visible) issues.push('H1 vacío o no visible');
  if (datos.robots !== 'noindex,nofollow') issues.push(`robots inválido: ${datos.robots || 'ausente'}`);
  if (datos.touchTargets.some((target) => target.width < 44 || target.height < 44)) issues.push(`objetivo táctil menor de 44px: ${JSON.stringify(datos.touchTargets)}`);
  if (datos.interactiveTargets.some((target) => target.width < 44 || target.height < 44)) issues.push(`interacción menor de 44px: ${JSON.stringify(datos.interactiveTargets.filter((target) => target.width < 44 || target.height < 44))}`);
  if (!datos.selectedPill || datos.selectedPill.background !== 'rgb(255, 255, 255)' || datos.selectedPill.ratio < 4.5) issues.push(`estado seleccionado fuera de guía o contraste AA: ${JSON.stringify(datos.selectedPill)}`);
  if (!datos.formula.trim()) issues.push('fórmula ausente');
  if (datos.fichaRows.length < 5) issues.push('faltan filas de la ficha de cálculo');
  if (datos.fichaRows.some((row) => row.dots !== 'dotted' || !row.font.includes('Pressura'))) issues.push('ficha sin puntos guía o Pressura');
  if (JSON.stringify(datos.hojaCopy) !== JSON.stringify(HOJA_ESPERADA)) issues.push('cambió el texto de Cuentas claras');
  if (meta.slug === 'empresas' && (datos.buyer !== 'general' || datos.genericNamesSector)) issues.push('el control general nombra un rubro o buyer incorrecto');
  if (datos.duplicateIds.length) issues.push(`IDs duplicados: ${datos.duplicateIds.join(',')}`);
  if (datos.remainingTemplateMarker) issues.push('marcador de plantilla sin reemplazar');
  if (datos.externalLinks.length) issues.push(`enlaces externos visibles: ${datos.externalLinks.join(',')}`);
  if (errores.length) issues.push(`consola: ${errores.join(' | ')}`);
  if (datos.messageExpected && datos.h1.trim().toLocaleLowerCase('es-CL') !== datos.messageExpected.trim().toLocaleLowerCase('es-CL')) issues.push(`mensaje no aplicado: ${datos.h1}`);
  if (issues.length) fallos.push(`${tipo}: ${issues.join('; ')}`);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  return { datos, errores };
}

async function testDiseño(browser) {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.mobile ? 2 : 1,
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      locale: 'es-CL',
    });
    await context.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
    const page = await context.newPage();
    for (const slug of SLUGS) {
      for (const modo of MODOS) {
        const { datos } = await navegar(context, page, ruta(slug, modo.query), { slug, viewport: viewport.id, variant: modo.id });
        if (modo.id === 'directo' && !datos.directFormVisible) fallos.push(`${slug} · ${viewport.id} · directo: botón de un paso no visible`);
        if (modo.id === 'base') {
          const salida = path.join(EVIDENCIA, `${slug}_${viewport.id}.png`);
          await page.screenshot({ path: salida, fullPage: false });
        }
        if ((slug === 'restaurantes' || slug === 'empresas') && (modo.id === 'inicio-progresivo' || modo.id === 'inicio-directo')) {
          const nombre = slug === 'empresas' ? `formulario_empresas_${modo.id}_${viewport.id}.png` : `formulario_${modo.id}_${viewport.id}.png`;
          await page.screenshot({ path: path.join(EVIDENCIA, nombre), fullPage: false });
        }
        if (slug === 'empresas' && modo.id === 'base') {
          await page.locator('#calculo').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(EVIDENCIA, `ficha_calculadora_${viewport.id}.png`), fullPage: false });
          await page.locator('.ld-hoja__grilla').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(EVIDENCIA, `ficha_cuentas_claras_${viewport.id}.png`), fullPage: false });
        }
      }
    }
    console.log(`DISEÑO ${viewport.id} PASS · ${SLUGS.length} compradores y ${MODOS.length} variantes`);
    await context.close();
  }

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.mobile ? 2 : 1, isMobile: viewport.mobile, hasTouch: viewport.mobile, locale: 'es-CL' });
    const page = await context.newPage();
    for (const slug of SLUGS) {
      for (const tension of ['continuidad', 'conveniencia', 'viabilidad', 'confianza', 'experiencia']) {
        await navegar(context, page, ruta(slug, `m=${tension}&media=static&motion=off`), { slug, viewport: viewport.id, variant: `m=${tension}` });
      }
    }
    await navegar(context, page, ruta('restaurantes', 'nav=contexto&media=static&motion=off'), { slug: 'restaurantes', viewport: viewport.id, variant: 'nav=contexto' });
    console.log(`MENSAJES ${viewport.id} PASS · ${SLUGS.length} compradores × 5 tensiones`);
    await context.close();
  }
}

async function testCalculadoras(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
  const page = await context.newPage();
  const casos = [
    { slug: 'eventos-catering', mode: 'eventos', range: 150, tazas: 600, kg: 5.4, formula: 'asistentes por evento' },
    { slug: 'conveniencia', mode: 'tazas', range: 50, tazas: 1500, kg: 13.5, formula: 'tazas al día' },
    { slug: 'panaderias', mode: 'tazas', range: 70, tazas: 1820, kg: 16.4, formula: 'tazas al día' },
    { slug: 'oficinas', mode: 'personas', range: 30, tazas: 1320, kg: 11.9, formula: 'personas × tazas por persona' },
    { slug: 'empresas', mode: 'tazas', range: 100, dias: 30, gramos: 10, initialTazas: 2080, initialKg: '18,7 kg', tazas: 3000, kg: 30, formula: 'tazas al día', generic: true },
  ];
  for (const caso of casos) {
    await page.goto(ruta(caso.slug, 'media=static&motion=off'), { waitUntil: 'networkidle' });
    const inicial = await page.evaluate(() => ({
      config: JSON.parse(document.querySelector('#ld-config').textContent),
      formula: document.querySelector('.ld-resultado .nm-nota')?.innerText || '',
      supuestos: Array.from(document.querySelectorAll('.ld-resultado .nm-nota')).map((el) => el.innerText).join(' '),
      rows: Object.fromEntries(['c-row-base', 'c-row-porpersona', 'c-row-dias', 'c-row-eventos', 'c-row-gramos', 'c-tazas', 'c-row-kg'].map((id) => [id, document.getElementById(id)?.textContent.trim() || null])),
      bodyText: document.body.innerText,
    }));
    assert.equal(inicial.config.calc.mode, caso.mode, `${caso.slug}: modo de cálculo incorrecto.`);
    assert.ok(inicial.formula.toLowerCase().includes(caso.formula), `${caso.slug}: fórmula visible incorrecta.`);
    assert.match(inicial.supuestos, /Supuestos:.*ejemplo/i, `${caso.slug}: falta rotular supuestos/valores de ejemplo.`);
    if (caso.generic) {
      assert.equal(inicial.config.buyer, 'general');
      assert.equal(inicial.rows['c-row-base'], '80 tazas');
      assert.equal(inicial.rows['c-row-dias'], '26 días');
      assert.equal(inicial.rows['c-row-gramos'], '9 g');
      assert.equal(inicial.rows['c-tazas'], caso.initialTazas.toLocaleString('es-CL'));
      assert.equal(inicial.rows['c-row-kg'], caso.initialKg);
      assert.equal(/restaurante|hotel|cafeter|oficin|evento|catering|conveniencia|panader/i.test(inicial.bodyText), false, 'El control genérico no debe nombrar rubros.');
    }
    await page.locator('#c-base').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, caso.range);
    if (caso.dias) await page.locator(`input[name="dias"][value="${caso.dias}"]`).check();
    if (caso.gramos) await page.fill('#c-gramos', String(caso.gramos));
    const resultado = await page.evaluate(() => ({
      tazas: document.querySelector('#c-tazas').textContent,
      kg: document.querySelector('#c-kg').textContent,
      rows: Object.fromEntries(['c-row-base', 'c-row-porpersona', 'c-row-dias', 'c-row-eventos', 'c-row-gramos', 'c-row-kg'].map((id) => [id, document.getElementById(id)?.textContent.trim() || null])),
      eventos: JSON.parse(sessionStorage.getItem('mc_landing_events_v1') || '[]').map((e) => e.event),
    }));
    const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
    assert.equal(num(resultado.tazas), caso.tazas, `${caso.slug}: tazas mensuales no coinciden con la fórmula.`);
    assert.equal(num(resultado.kg), caso.kg, `${caso.slug}: kg mensuales no coinciden con la fórmula.`);
    assert.ok(resultado.rows['c-row-base'], `${caso.slug}: falta fila del valor principal.`);
    assert.ok(resultado.rows['c-row-gramos'], `${caso.slug}: falta fila de gramos.`);
    assert.equal(resultado.rows['c-row-kg'], `${String(caso.kg.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))} kg`, `${caso.slug}: la fila de kg debe seguir el resultado grande.`);
    if (caso.mode === 'eventos') assert.equal(resultado.rows['c-row-eventos'], '4 eventos');
    if (caso.mode === 'personas') assert.equal(resultado.rows['c-row-porpersona'], '2 tazas');
    if (caso.slug === 'empresas') {
      assert.equal(resultado.rows['c-row-base'], '100 tazas');
      assert.equal(resultado.rows['c-row-dias'], '30 días');
      assert.equal(resultado.rows['c-row-gramos'], '10 g');
    }
    assert.ok(resultado.eventos.includes('calculator_used'), `${caso.slug}: falta calculator_used tras interactuar.`);
    console.log(`CALCULADORA ${caso.slug} PASS · ${resultado.tazas} tazas / ${resultado.kg} kg`);
    comprobaciones++;
  }
  await context.close();
}

async function testExperimentos(browser) {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.mobile ? 2 : 1, isMobile: viewport.mobile, hasTouch: viewport.mobile, locale: 'es-CL' });
    const page = await context.newPage();
    const errores = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', (e) => errores.push(String(e)));
    await page.goto(`${ORIGEN.replace(/\/$/, '')}/captacion/experimentos/index.html`, { waitUntil: 'networkidle' });
    const datos = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1: document.querySelector('h1')?.innerText || '',
      h1Visible: Boolean(document.querySelector('h1')?.getClientRects().length && getComputedStyle(document.querySelector('h1')).visibility !== 'hidden'),
      robots: document.querySelector('meta[name="robots"]')?.content?.trim().toLowerCase() || '',
      enlaces: Array.from(document.querySelectorAll('.exp-links a')).map((a) => {
        const r = a.getBoundingClientRect();
        const foreground = getComputedStyle(a).color;
        const background = getComputedStyle(document.body).backgroundColor;
        const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (value) => rgb(value).map((c) => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const x = luminance(foreground); const y = luminance(background);
        return { width: Math.round(r.width), height: Math.round(r.height), contrast: (Math.max(x, y) + .05) / (Math.min(x, y) + .05) };
      }),
      estados: Array.from(document.querySelectorAll('.exp-badge')).map((e) => e.innerText.trim().toLowerCase()),
      linksExternos: Array.from(document.querySelectorAll('a[href]')).filter((a) => {
        if (!a.getClientRects().length) return false;
        return new URL(a.href, location.href).origin !== location.origin;
      }).length,
    }));
    assert.equal(datos.scrollWidth, datos.width, `Experimentos ${viewport.id}: desborde horizontal.`);
    assert.equal(datos.h1.trim().toLowerCase(), 'registro de experimentos');
    assert.equal(datos.h1Visible, true, `Experimentos ${viewport.id}: H1 no visible.`);
    assert.equal(datos.robots, 'noindex,nofollow', `Experimentos ${viewport.id}: falta noindex,nofollow.`);
    assert.ok(datos.enlaces.every((link) => link.width >= 44 && link.height >= 44), `Experimentos ${viewport.id}: hay enlaces menores de 44px.`);
    assert.ok(datos.enlaces.every((link) => link.contrast >= 4.5), `Experimentos ${viewport.id}: contraste de enlaces bajo AA.`);
    assert.ok(datos.estados.length >= 9);
    assert.ok(datos.estados.every((estado) => estado === 'no iniciado'));
    assert.equal(datos.linksExternos, 0);
    const enlaceP02 = page.locator('#buyer a[href="../landing/empresas.html"]');
    assert.equal(await enlaceP02.count(), 1, 'P02 debe enlazar el control genérico desde el registro.');
    assert.match(await enlaceP02.textContent(), /Control genérico B2B/);
    assert.deepEqual(errores, []);
    await page.screenshot({ path: path.join(EVIDENCIA, `experimentos_${viewport.id}.png`), fullPage: false });
    comprobaciones++;
    console.log(`EXPERIMENTOS ${viewport.id} PASS · ${datos.estados.length} hipótesis en no iniciado`);
    await context.close();
  }
}

async function testA8Hallazgos(browser) {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  const casos = [
    { slug: 'cafeterias', modos: [{ id: 'base', query: 'motion=off' }, { id: 'inicio', query: 'f=inicio&motion=off' }], viewports: A8_VIEWPORTS },
    { slug: 'conveniencia', modos: [{ id: 'base', query: 'motion=off' }, { id: 'inicio', query: 'f=inicio&motion=off' }], viewports: A8_VIEWPORTS.slice(0, 2) },
  ];
  for (const caso of casos) {
    for (const viewport of caso.viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.mobile ? 2 : 1, isMobile: viewport.mobile, hasTouch: viewport.mobile, locale: 'es-CL' });
      const page = await context.newPage();
      for (const modo of caso.modos) {
        const { datos } = await navegar(context, page, ruta(caso.slug, modo.query), { slug: caso.slug, viewport: viewport.id, variant: `A8-${modo.id}`, requireCta: viewport.width !== 320 });
        assert.equal(datos.robots, 'noindex,nofollow', `${caso.slug} ${viewport.id}: robots.`);
        assert.equal(datos.h1Visible, true, `${caso.slug} ${viewport.id}: H1 visible.`);
        assert.ok(datos.touchTargets.every((target) => target.width >= 44 && target.height >= 44), `${caso.slug} ${viewport.id}: controles bajo 44px.`);
        assert.equal(datos.selectedPill?.background, 'rgb(255, 255, 255)', `${caso.slug} ${viewport.id}: la píldora seleccionada no usa blanco.`);
        assert.ok((datos.selectedPill?.ratio || 0) >= 4.5, `${caso.slug} ${viewport.id}: contraste menor de 4,5:1.`);
        if (modo.id === 'base') {
          await page.locator('#calculo').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(EVIDENCIA, `a8_${caso.slug}_${viewport.id}_calculo.png`), fullPage: false });
          await page.locator('#contacto').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(EVIDENCIA, `a8_${caso.slug}_${viewport.id}_formulario.png`), fullPage: false });
        } else {
          await page.locator('.ld-hero__form').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(EVIDENCIA, `a8_${caso.slug}_${viewport.id}_formulario_inicio.png`), fullPage: false });
        }
        comprobaciones++;
      }
      await context.close();
      console.log(`A8 CONTROLES ${caso.slug} ${viewport.id} PASS`);
    }
  }

  for (const viewport of A8_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.mobile ? 2 : 1, isMobile: viewport.mobile, hasTouch: viewport.mobile, locale: 'es-CL' });
    const page = await context.newPage();
    await page.goto(`${ORIGEN.replace(/\/$/, '')}/captacion/experimentos/index.html`, { waitUntil: 'networkidle' });
    const datos = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1Visible: Boolean(document.querySelector('h1')?.getClientRects().length && getComputedStyle(document.querySelector('h1')).visibility !== 'hidden'),
      robots: document.querySelector('meta[name="robots"]')?.content?.trim().toLowerCase() || '',
      links: Array.from(document.querySelectorAll('.exp-links a')).map((a) => { const r = a.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; }),
    }));
    assert.equal(datos.scrollWidth, datos.width, `Experimentos ${viewport.id}: desborde horizontal en el barrido A8.`);
    assert.equal(datos.h1Visible, true, `Experimentos ${viewport.id}: H1 no visible en el barrido A8.`);
    assert.equal(datos.robots, 'noindex,nofollow', `Experimentos ${viewport.id}: robots en el barrido A8.`);
    assert.ok(datos.links.length > 0 && datos.links.every((link) => link.width >= 44 && link.height >= 44), `Experimentos ${viewport.id}: enlace bajo 44px en el barrido A8.`);
    await page.locator('#ubicacion').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCIA, `a8_experimentos_${viewport.id}.png`), fullPage: false });
    comprobaciones++;
    await context.close();
    console.log(`A8 ENLACES ${viewport.id} PASS · links >=44px`);
  }
}

async function testMovimientoReducido(browser) {
  for (const slug of SLUGS) {
    const reduceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'es-CL' });
    const reducePage = await reduceContext.newPage();
    await reducePage.goto(ruta(slug), { waitUntil: 'networkidle' });
    const reduce = await reducePage.evaluate(() => ({
      paused: document.querySelector('[data-hero-video]').paused,
      hasSource: document.querySelector('[data-hero-video]').hasAttribute('src'),
      active: document.querySelector('[data-hero-video]').classList.contains('es-activo'),
      poster: Boolean(document.querySelector('.ld-hero__media img')?.getClientRects().length),
      controlHidden: document.querySelector('#ld-video-toggle').hidden,
      statusVisible: Boolean(document.querySelector('#ld-motion-status')?.getClientRects().length),
    }));
    assert.deepEqual(reduce, { paused: true, hasSource: false, active: false, poster: true, controlHidden: true, statusVisible: true }, `${slug}: prefers-reduced-motion debe dejar solo el póster.`);
    if (slug === 'cafeterias') await reducePage.screenshot({ path: path.join(EVIDENCIA, 'a8_motion_reduce_cafeterias_390.png'), fullPage: false });
    comprobaciones++;
    await reduceContext.close();

    const offContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
    const offPage = await offContext.newPage();
    await offPage.goto(ruta(slug, 'motion=off'), { waitUntil: 'networkidle' });
    const off = await offPage.evaluate(() => ({
      paused: document.querySelector('[data-hero-video]').paused,
      hasSource: document.querySelector('[data-hero-video]').hasAttribute('src'),
      active: document.querySelector('[data-hero-video]').classList.contains('es-activo'),
      poster: Boolean(document.querySelector('.ld-hero__media img')?.getClientRects().length),
      controlHidden: document.querySelector('#ld-video-toggle').hidden,
      statusVisible: Boolean(document.querySelector('#ld-motion-status')?.getClientRects().length),
    }));
    assert.deepEqual(off, { paused: true, hasSource: false, active: false, poster: true, controlHidden: true, statusVisible: true }, `${slug}: ?motion=off debe dejar solo el póster.`);
    comprobaciones++;
    await offContext.close();
    console.log(`A8 MOVIMIENTO ${slug} PASS · prefers-reduced-motion y ?motion=off`);
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
  const page = await context.newPage();
  await page.goto(ruta('cafeterias'), { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#ld-video-toggle').isVisible(), true, 'El control de video debe estar disponible cuando movimiento está permitido.');
  const controlVideo = await page.locator('#ld-video-toggle').boundingBox();
  assert.ok(controlVideo && controlVideo.width >= 44 && controlVideo.height >= 44, 'El control de video debe tener un área táctil mínima de 44px.');
  await page.screenshot({ path: path.join(EVIDENCIA, 'a8_motion_control_cafeterias_390.png'), fullPage: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => {
    const video = document.querySelector('[data-hero-video]');
    return video.paused && !video.hasAttribute('src') && !video.classList.contains('es-activo');
  });
  assert.equal(await page.locator('#ld-video-toggle').isVisible(), false, 'Al activar movimiento reducido no debe existir un control que reproduzca video.');
  assert.equal(await page.locator('#ld-motion-status').isVisible(), true);
  comprobaciones++;
  await context.close();
  console.log('A8 MOVIMIENTO DINÁMICO PASS · preferencia activada tras cargar; se restaura el póster');
}

async function testFormularioDirecto(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
  const page = await context.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(ruta('empresas', 'form=directo&media=static&motion=off'), { waitUntil: 'networkidle' });
  for (const [selector, value] of [['#f-nombre', 'Camila Prueba'], ['#f-correo', 'camila@prueba.cl'], ['#f-empresa', 'Organización de prueba'], ['#f-telefono', '+56 9 1234 5678']]) await page.fill(selector, value);
  let antesDeEnviar = await page.evaluate(() => ({ draft: localStorage.getItem('mc_landing_draft_v1'), lead: localStorage.getItem('mc_landing_lead_v1') }));
  assert.equal(antesDeEnviar.draft, null, 'El formulario directo no debe guardar borrador al escribir.');
  assert.equal(antesDeEnviar.lead, null, 'El formulario directo no debe crear lead al escribir.');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.inputValue('#f-nombre'), '', 'El formulario directo no debe restaurar datos no enviados.');
  await page.fill('#f-nombre', 'Camila Prueba');
  await page.fill('#f-correo', 'camila@prueba.cl');
  await page.fill('#f-empresa', 'Organización de prueba');
  await page.fill('#f-telefono', '+56 9 1234 5678');
  await page.click('[data-accion="directo"]');
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('mc_landing_events_v1') || '[]').some((e) => e.event === 'form_error'));
  assert.equal(await page.evaluate(() => localStorage.getItem('mc_landing_lead_v1')), null, 'Sin permiso de respuesta no debe crearse lead.');
  await page.check('#f-consent');
  await page.click('[data-accion="directo"]');
  await page.waitForSelector('#ld-exito:not([hidden])', { timeout: 5000 });
  const resultado = await page.evaluate(() => ({
    lead: JSON.parse(localStorage.getItem('mc_landing_lead_v1') || 'null'),
    draft: localStorage.getItem('mc_landing_draft_v1'),
    events: JSON.parse(sessionStorage.getItem('mc_landing_events_v1') || '[]').map((e) => e.event),
  }));
  assert.ok(resultado.lead && resultado.lead.id, 'El lead debe existir después de la confirmación.');
  assert.equal(resultado.lead.variant.form, 'directo');
  assert.equal(resultado.draft, null, 'El directo no crea borrador.');
  assert.equal(resultado.events.at(-1), 'lead_created', 'lead_created debe ser el evento posterior a la confirmación.');
  assert.equal(resultado.events.filter((e) => e === 'form_step_completed').length, 1, 'El directo completa un solo paso.');
  assert.ok(resultado.events.indexOf('form_step_completed') < resultado.events.indexOf('lead_created'));
  assert.deepEqual(errores, [], 'El formulario directo no debe producir errores de consola.');
  comprobaciones++;
  await page.screenshot({ path: path.join(EVIDENCIA, 'formulario_directo_confirmado_390.png'), fullPage: true });
  await context.close();
  console.log('FORM DIRECTO PASS', JSON.stringify({ events: resultado.events, leadAfterConfirmation: Boolean(resultado.lead), draft: resultado.draft }));
}

async function testFormularioProgresivo(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
  const page = await context.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(ruta('empresas', 'form=progresivo&media=static&motion=off'), { waitUntil: 'networkidle' });
  await page.fill('#f-nombre', 'Camila Prueba');
  await page.fill('#f-correo', 'camila@prueba.cl');
  await page.check('#f-consent');
  await page.click('[data-accion="guardar"]');
  await page.waitForFunction(() => Boolean(localStorage.getItem('mc_landing_draft_v1')));
  assert.equal(await page.evaluate(() => localStorage.getItem('mc_landing_lead_v1')), null, 'El envío del paso 1 no debe crear lead.');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.inputValue('#f-nombre'), 'Camila Prueba', 'El contacto enviado debe permitir retomar.');
  assert.equal(await page.locator('.ld-form__paso[data-paso="2"]').isVisible(), true);
  const volver = await page.locator('.ld-volver').boundingBox();
  assert.ok(volver && volver.width >= 44 && volver.height >= 44, 'El control para corregir datos debe tener un área táctil mínima de 44px.');
  await page.fill('#f-empresa', 'Organización de prueba');
  await page.fill('#f-telefono', '+56 9 1234 5678');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('#ld-exito:not([hidden])', { timeout: 5000 });
  const resultado = await page.evaluate(() => ({
    lead: JSON.parse(localStorage.getItem('mc_landing_lead_v1') || 'null'),
    draft: localStorage.getItem('mc_landing_draft_v1'),
    events: JSON.parse(sessionStorage.getItem('mc_landing_events_v1') || '[]').map((e) => e.event),
  }));
  assert.ok(resultado.lead && resultado.lead.id);
  assert.equal(resultado.lead.variant.form, 'progresivo');
  assert.equal(resultado.draft, null, 'Tras confirmar el lead, el borrador enviado se limpia.');
  assert.equal(resultado.events.filter((e) => e === 'form_step_completed').length, 2);
  assert.equal(resultado.events.at(-1), 'lead_created');
  assert.deepEqual(errores, [], 'El formulario progresivo no debe producir errores de consola.');
  comprobaciones++;
  await context.close();
  console.log('FORM PROGRESIVO PASS', JSON.stringify({ events: resultado.events, leadAfterConfirmation: Boolean(resultado.lead) }));
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    if (SOLO_FORMULARIOS) {
      await testFormularioDirecto(browser);
      await testFormularioProgresivo(browser);
    } else if (SOLO_MOVIMIENTO) {
      await testMovimientoReducido(browser);
    } else {
      await testDiseño(browser);
      await testCalculadoras(browser);
      await testExperimentos(browser);
      await testA8Hallazgos(browser);
      await testMovimientoReducido(browser);
      await testFormularioDirecto(browser);
      await testFormularioProgresivo(browser);
    }
    if (fallos.length) {
      console.error('FAILURES', JSON.stringify(fallos, null, 2));
      process.exitCode = 1;
    } else {
      console.log(`PASS · ${comprobaciones} recorridos/variantes sin desborde ni errores; capturas en ${EVIDENCIA}`);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
