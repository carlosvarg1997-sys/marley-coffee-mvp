// Verificación visual, enlaces, capturas y PDF del mapa de caminos.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const KIT = path.join(ROOT, 'PRUEBA_CON_PERSONAS', 'RONDA_FINAL_E0_E9');
const EVIDENCE = path.join(KIT, 'evidencia', 'flujos');
const BASE = 'http://127.0.0.1:8877';
const PAGE_URL = `${BASE}/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/flujos.html`;
const matrix = [];
const linkResults = new Map();

async function loaded(page) {
  await page.waitForFunction(() => document.querySelectorAll('#flow-root .flow-lane').length > 0, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#path-nav button').length === 8, null, { timeout: 10000 });
}

async function checkLayout(page, width, height, selected) {
  await page.setViewportSize({ width, height });
  const url = new URL(PAGE_URL);
  if (selected !== 'Todos') url.searchParams.set('camino', selected);
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await loaded(page);
  await page.evaluate(() => { document.querySelectorAll('img.node-thumb').forEach((img) => { img.loading = 'eager'; }); window.scrollTo(0, 0); });
  await page.waitForFunction(() => [...document.querySelectorAll('img.node-thumb')].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 20000 });
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    flowLanes: document.querySelectorAll('#flow-root .flow-lane').length,
    nodes: document.querySelectorAll('#flow-root .flow-node').length,
    brokenImages: [...document.querySelectorAll('img.node-thumb')].filter((img) => !img.naturalWidth).map((img) => img.src),
    tooSmallControls: [...document.querySelectorAll('.chip,.btn,.open-view')].filter((el) => {
      if (el.hidden) return false;
      const r = el.getBoundingClientRect();
      const min = innerWidth <= 1024 ? 44 : 24;
      return r.width < min || r.height < min;
    }).map((el) => ({ text: el.innerText.trim(), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })),
    startHidden: document.querySelector('#start-flow')?.hidden ?? false,
    nodesWithoutOpen: [...document.querySelectorAll('.flow-node')].filter((node) => !node.querySelector('.open-view')).length,
  }));
  if (result.scrollWidth > width || result.brokenImages.length || result.tooSmallControls.length || result.nodesWithoutOpen || selected === 'Todos' && !result.startHidden) {
    throw new Error(`Desborde, imagen rota o control pequeño en ${selected}/${width}: ${JSON.stringify(result)}`);
  }
  matrix.push({ selected, width, height, flowLanes: result.flowLanes, nodes: result.nodes, scrollWidth: result.scrollWidth, brokenImages: result.brokenImages.length });
  return result;
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const data = JSON.parse(fs.readFileSync(path.join(KIT, 'flujos.json'), 'utf8'));
  if (data.flows.length !== 7) throw new Error(`El manifiesto tiene ${data.flows.length} caminos, se esperaban 7.`);
  const externalFlows = data.flows.filter((flow) => flow.grupo === 'externo');
  const requiredJourneyStages = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'];
  if (externalFlows.length !== 4) throw new Error(`Se esperaban cuatro caminos externos, hay ${externalFlows.length}.`);
  for (const flow of externalFlows) {
    const missing = requiredJourneyStages.filter((stage) => !flow.nodes.some((node) => node.etapa === stage));
    const missingJourneyViews = ['E5', 'E6', 'E7', 'E8', 'E9'].filter((stage) => !flow.nodes.some((node) => node.tipo === 'vista' && node.etapa === stage && node.miniatura));
    const unavailable = flow.nodes.filter((node) => /no disponible|no se activa/i.test(`${node.titulo} ${node.notaReal || ''}`));
    if (missing.length || missingJourneyViews.length || unavailable.length) {
      throw new Error(`${flow.id}: recorrido E0–E9 incompleto; faltan etapas ${missing.join(',')}, vistas E5–E9 ${missingJourneyViews.join(',')}, notas pendientes ${unavailable.map((node) => node.id).join(',')}.`);
    }
  }
  const captureReportPath = path.join(EVIDENCE, 'captura-reporte.json');
  if (!fs.existsSync(captureReportPath)) throw new Error('Falta el reporte de los recorridos reales desde el lanzador.');
  const captureReport = JSON.parse(fs.readFileSync(captureReportPath, 'utf8'));
  const capturedJourneys = (captureReport.recorridosE0E9 || []).map((journey) => journey.flow).sort();
  if (JSON.stringify(capturedJourneys) !== JSON.stringify(['A', 'B-Google', 'B-LinkedIn', 'B-Meta'].sort())) throw new Error(`La captura no completó los cuatro caminos: ${JSON.stringify(capturedJourneys)}`);
  for (const journey of captureReport.recorridosE0E9) {
    if (!journey.enabled || journey.days !== 33 || !journey.origin || !journey.leadCreatedInCrm || !journey.crmVisible || !journey.crmOrigin || !['contract_signed', 'order_confirmed', 'repeat_order_confirmed', 'support_case_opened', 'csat_submitted', 'referral_sent'].every((event) => journey.events.includes(event))) {
      throw new Error(`${journey.flow}: el lead/origen no llegó completo a la cuenta: ${JSON.stringify(journey)}`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const screenshotSpecs = [
    ['Todos', 390, 844], ['A', 390, 844], ['Todos', 1440, 900], ['A', 1440, 900],
  ];
  for (const [selected, width, height] of screenshotSpecs) {
    await checkLayout(page, width, height, selected);
    await page.screenshot({ path: path.join(EVIDENCE, `flujos-${selected.toLowerCase()}-${width}.png`), fullPage: false, animations: 'disabled' });
  }
  for (const width of [360, 390, 768, 1440]) {
    const height = width === 360 ? 800 : width === 390 ? 844 : width === 768 ? 1024 : 900;
    await checkLayout(page, width, height, 'Todos');
    for (const flow of data.flows) await checkLayout(page, width, height, flow.id);
  }

  const uniqueUrls = new Set(data.flows.flatMap((flow) => flow.nodes.map((node) => node.url)));
  for (const route of uniqueUrls) {
    const target = new URL(route, PAGE_URL);
    const key = `${target.origin}${target.pathname}`;
    if (!linkResults.has(key)) {
      const response = await fetch(key, { redirect: 'follow' });
      linkResults.set(key, { route: target.pathname, status: response.status, ok: response.ok });
    }
  }
  const badLinks = [...linkResults.values()].filter((item) => !item.ok);
  if (badLinks.length) throw new Error(`Enlaces con respuesta no OK: ${JSON.stringify(badLinks)}`);

  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await loaded(page);
  const openLinks = await page.locator('.open-view').evaluateAll((els) => els.map((el) => ({ target: el.target, rel: el.rel, href: el.getAttribute('href') })));
  if (openLinks.length !== 105 || openLinks.some((link) => link.target !== '_blank' || !link.rel.includes('noopener') || !link.href.startsWith('abrir-vista.html?'))) {
    throw new Error(`Los 105 nodos deben tener su apertura en pestaña nueva con aviso: ${JSON.stringify(openLinks.filter((link) => link.target !== '_blank' || !link.rel.includes('noopener') || !link.href.startsWith('abrir-vista.html?')).slice(0, 5))}`);
  }
  await page.locator('[data-camino="B-Meta"]').click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get('camino') === 'B-Meta');
  await page.locator('[data-camino="Todos"]').click();
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('camino'));

  await page.goto(`${PAGE_URL}?camino=A`, { waitUntil: 'domcontentloaded' });
  await loaded(page);
  const directNode = page.locator('.flow-node').filter({ has: page.getByRole('heading', { name: 'Solución para hoteles', exact: true }) });
  const directPopup = page.waitForEvent('popup');
  await directNode.getByRole('link', { name: 'Abrir vista' }).click();
  const directHelper = await directPopup;
  await directHelper.waitForLoadState('domcontentloaded');
  await directHelper.getByText('Fuera del recorrido, esta vista muestra datos de ejemplo.', { exact: true }).waitFor();
  await directHelper.getByRole('link', { name: 'Abrir la vista' }).click();
  await directHelper.waitForURL(/captacion\/soluciones\/hoteles\.html/);
  await directHelper.close();

  await page.goto(`${PAGE_URL}?camino=C-Ventas`, { waitUntil: 'domcontentloaded' });
  await loaded(page);
  const contextual = page.locator('.flow-node').filter({ has: page.getByRole('heading', { name: 'Tarea 1 · Encuentra un prospecto que llegó desde búsqueda', exact: true }) });
  const contextualPopup = page.waitForEvent('popup');
  await contextual.getByRole('link', { name: 'Abrir vista' }).click();
  const contextualHelper = await contextualPopup;
  await contextualHelper.waitForLoadState('domcontentloaded');
  await contextualHelper.getByText('Esta vista requiere la sesión y los pasos anteriores. Se abre el inicio del camino para usar el estado correcto.', { exact: true }).waitFor();
  await contextualHelper.getByRole('link', { name: 'Abrir inicio del camino' }).click();
  await contextualHelper.waitForURL(/RONDA_FINAL_E0_E9\/inicio\.html/);
  await contextualHelper.close();

  await page.goto(`${PAGE_URL}?camino=A`, { waitUntil: 'domcontentloaded' });
  await loaded(page);
  await page.emulateMedia({ media: 'print' });
  const pdfPath = path.join(EVIDENCE, 'flujos-A4-prueba.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });

  if (pageErrors.length) throw new Error(`Errores JS en flujos.html: ${pageErrors.join(' | ')}`);
  const images = data.flows.flatMap((flow) => flow.nodes.filter((node) => node.miniatura).map((node) => ({ id: node.id, path: path.join(KIT, node.miniatura), bytes: fs.statSync(path.join(KIT, node.miniatura)).size })));
  const maxImage = Math.max(...images.map((item) => item.bytes));
  const totalBytes = images.reduce((sum, item) => sum + item.bytes, 0);
  if (maxImage > 120 * 1024 || totalBytes > 8 * 1024 * 1024) throw new Error(`Peso de miniaturas supera límite: ${maxImage} / ${totalBytes}`);
  const report = {
    pagina: PAGE_URL,
    responsive: matrix,
    enlacesUnicos: linkResults.size,
    enlacesConError: badLinks,
    abrirVista: { destinoDirecto: '200 + aviso de datos de ejemplo', conContexto: '200 + aviso y fallback al lanzador' },
    imagenes: { count: images.length, maxBytes: maxImage, totalBytes, maximoPorImagen: 120 * 1024, maximoTotal: 8 * 1024 * 1024 },
    pdf: { path: 'evidencia/flujos/flujos-A4-prueba.pdf', bytes: fs.statSync(pdfPath).size },
    pageErrors,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'enlaces-y-pesos.md'), [
    '# Informe de enlaces y pesos · flujos',
    '',
    `- Caminos: ${data.flows.length}; nodos: ${data.flows.reduce((sum, flow) => sum + flow.nodes.length, 0)}; vistas con miniatura: ${images.length}.`,
    `- Enlaces únicos comprobados por HTTP: ${linkResults.size}; errores: ${badLinks.length}.`,
    `- Miniaturas: máxima ${maxImage} B; total ${totalBytes} B (límite 122880 B cada una y 8388608 B total).`,
    `- PDF A4 horizontal: ${report.pdf.bytes} B.`,
    '',
    '| Ruta verificada | HTTP |',
    '| --- | ---: |',
    ...[...linkResults.values()].sort((a, b) => a.route.localeCompare(b.route)).map((item) => `| \`${item.route}\` | ${item.status} |`),
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(EVIDENCE, 'verificacion-flujos.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
