const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../qa/playwright-system-chrome.cjs');

const baseUrl = process.env.MARLEY_LOCAL_URL || 'http://127.0.0.1:8877';
const requestedEmails = process.argv.slice(2).length
  ? process.argv.slice(2).map((value) => value.trim()).filter(Boolean)
  : process.env.MARLEY_CAPTURE_EMAILS?.split(',').map((value) => value.trim()).filter(Boolean);
const emailIds = requestedEmails?.length
  ? requestedEmails
  : Array.from({ length: 12 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`);
const a8Viewports = [
  { width: 320, height: 640 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];
const root = __dirname;
const evidence = path.join(root, 'evidencia');
const errors = [];
const checks = [];
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

async function main() {
  mkdir(evidence);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  for (const id of emailIds) {
    for (const width of [390, 600]) {
      await page.setViewportSize({ width, height: 844 });
      const response = await page.goto(`${baseUrl}/captacion/correos/${id}.html`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) errors.push(`${id} ${width}: HTTP ${response?.status() ?? 'sin respuesta'}`);
      await page.locator('h1').waitFor({ state: 'visible' });
      const result = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        title: document.querySelector('h1')?.textContent?.trim(),
        ctaCount: document.querySelectorAll('a[href*="utm_campaign="]').length,
        imageOk: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
        externalStylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        heroStyle: (() => {
          const hero = document.querySelector('.email-hero-title');
          if (!hero) return null;
          const style = getComputedStyle(hero);
          return { fontSize: parseFloat(style.fontSize), fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontStretch: style.fontStretch, textTransform: style.textTransform };
        })(),
        factRows: document.querySelectorAll('.email-facts tr').length - 1,
        factCellsPerRow: [...document.querySelectorAll('.email-facts tr:not(:first-child)')].map((row) => row.children.length),
        highlightCount: document.querySelectorAll('.email-hero-highlight').length,
        highlightText: document.querySelector('.email-hero-highlight')?.textContent?.trim(),
        highlightStyle: (() => {
          const highlight = document.querySelector('.email-hero-highlight');
          if (!highlight) return null;
          const style = getComputedStyle(highlight);
          return { background: style.backgroundColor, color: style.color };
        })(),
        paragraphCount: document.querySelectorAll('.email-body > p').length,
        buttonBounds: (() => {
          const button = document.querySelector('a[href*="utm_campaign="]');
          if (!button) return null;
          const box = button.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width, height: box.height, visible: box.width > 0 && box.height > 0 };
        })(),
      }));
      if (result.scrollWidth > result.width) errors.push(`${id} ${width}: desborde ${result.scrollWidth}px`);
      if (result.ctaCount !== 1) errors.push(`${id} ${width}: cantidad de CTA con UTM ${result.ctaCount}`);
      if (!result.imageOk) errors.push(`${id} ${width}: logo no cargó`);
      if (result.externalStylesheets.length) errors.push(`${id} ${width}: CSS externo ${result.externalStylesheets.join(',')}`);
      const expectedHeroSize = width <= 480 ? 36 : 48;
      const condensed = ['condensed', '75%'].includes(result.heroStyle?.fontStretch);
      if (result.heroStyle?.fontSize !== expectedHeroSize || result.heroStyle?.fontWeight !== '700' || !condensed || result.heroStyle?.textTransform !== 'uppercase') errors.push(`${id} ${width}: tipografía de héroe inesperada ${JSON.stringify(result.heroStyle)}`);
      if (result.factRows < 3 || result.factRows > 4) errors.push(`${id} ${width}: cantidad de filas Cuentas claras ${result.factRows}`);
      if (result.factCellsPerRow.some((count) => count !== 2)) errors.push(`${id} ${width}: Cuentas claras no usa dos columnas ${JSON.stringify(result.factCellsPerRow)}`);
      if (result.highlightCount !== 1) errors.push(`${id} ${width}: palabras resaltadas ${result.highlightCount}`);
      if (result.highlightStyle?.background !== 'rgb(243, 201, 0)' || result.highlightStyle?.color !== 'rgb(23, 23, 23)') errors.push(`${id} ${width}: caja de palabra resaltada inesperada ${JSON.stringify(result.highlightStyle)}`);
      if (result.paragraphCount > 3) errors.push(`${id} ${width}: más de tres párrafos (${result.paragraphCount})`);
      if (!result.buttonBounds?.visible || result.buttonBounds.height < 48 || result.buttonBounds.left < 0 || result.buttonBounds.right > width) errors.push(`${id} ${width}: CTA bajo 48px o fuera del viewport`);
      await page.screenshot({ path: path.join(evidence, `${id}_${width}.png`), fullPage: true });
      checks.push(`${id}_${width}: ${result.title}; héroe=${result.heroStyle?.fontSize}px/${result.heroStyle?.fontStretch}; filas=${result.factRows}; CTA=${result.buttonBounds?.height}px; ancho=${result.width}; scroll=${result.scrollWidth}; logo=${result.imageOk}`);
    }
  }

  const thumbnailChecks = [];
  for (const id of emailIds) {
    await page.setViewportSize({ width: 320, height: 700 });
    const response = await page.goto(`${baseUrl}/captacion/correos/${id}.html`, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) errors.push(`${id} 320 miniatura: HTTP ${response?.status() ?? 'sin respuesta'}`);
    const result = await page.evaluate(() => {
      const hero = document.querySelector('.email-hero-title');
      const style = getComputedStyle(hero);
      const box = hero.getBoundingClientRect();
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
      const cta = document.querySelector('a[href*="utm_campaign="]')?.getBoundingClientRect();
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heroLines: Math.round(box.height / lineHeight),
        heroSize: parseFloat(style.fontSize),
        ctaRight: cta?.right ?? Infinity,
      };
    });
    if (result.scrollWidth > result.width) errors.push(`${id} 320 miniatura: desborde ${result.scrollWidth}px`);
    if (result.heroSize !== 36 || result.heroLines > 2) errors.push(`${id} 320 miniatura: titular pierde lectura (${result.heroLines} líneas a ${result.heroSize}px)`);
    if (result.ctaRight > 320) errors.push(`${id} 320 miniatura: CTA fuera del viewport`);
    thumbnailChecks.push(`${id}_320: hero=${result.heroLines} líneas; ancho=${result.width}; scroll=${result.scrollWidth}`);
  }

  const a8AuditChecks = [];
  for (const id of emailIds) {
    for (const viewport of a8Viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}/captacion/correos/${id}.html`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) errors.push(`${id} ${viewport.width}: HTTP ${response?.status() ?? 'sin respuesta'}`);
      const headers = response ? await response.allHeaders() : {};
      const result = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="robots"]')?.content?.toLowerCase() ?? '';
        const targets = [...document.querySelectorAll('a,button,select,input[type="checkbox"]')].map((element) => {
          const rect = element.getBoundingClientRect();
          return { tag: element.tagName.toLowerCase(), text: element.textContent?.trim(), width: rect.width, height: rect.height };
        });
        const h1 = document.querySelector('h1');
        const h1Rect = h1?.getBoundingClientRect();
        return {
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          robots: meta,
          visibleH1: !!h1 && !!h1Rect && h1Rect.width > 0 && h1Rect.height > 0 && getComputedStyle(h1).visibility !== 'hidden',
          smallTargets: targets.filter((target) => target.width < 44 || target.height < 44),
          videoCount: document.querySelectorAll('video').length,
          cssLinks: document.querySelectorAll('link[rel="stylesheet"]').length,
          creamBackgrounds: [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).backgroundColor === 'rgb(244, 241, 234)').length,
        };
      });
      if (!result.robots.includes('noindex') || !result.robots.includes('nofollow')) errors.push(`${id} ${viewport.width}: falta robots noindex,nofollow (${result.robots})`);
      if (/\bindex\b/i.test(headers['x-robots-tag'] ?? '') && !/\bnoindex\b/i.test(headers['x-robots-tag'] ?? '')) errors.push(`${id} ${viewport.width}: X-Robots-Tag contradice noindex`);
      if (!result.visibleH1) errors.push(`${id} ${viewport.width}: falta H1 visible`);
      if (result.scrollWidth > result.width) errors.push(`${id} ${viewport.width}: desborde A8 ${result.scrollWidth}px`);
      if (result.smallTargets.length) errors.push(`${id} ${viewport.width}: objetivos menores de 44px ${JSON.stringify(result.smallTargets)}`);
      if (result.videoCount) errors.push(`${id} ${viewport.width}: contiene video; no aplica al correo`);
      if (result.cssLinks) errors.push(`${id} ${viewport.width}: CSS externo ${result.cssLinks}`);
      if (result.creamBackgrounds) errors.push(`${id} ${viewport.width}: superficie hueso de fondo ${result.creamBackgrounds}`);
      a8AuditChecks.push(`${id}_${viewport.width}: robots=${result.robots}; targets=${result.smallTargets.length}; scroll=${result.scrollWidth}/${result.width}`);
    }
  }

  const supportPages = ['bandeja.html', 'fichas.html', 'PLANTILLA.html'];
  for (const filename of supportPages) {
    for (const viewport of a8Viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}/captacion/correos/${filename}`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) errors.push(`${filename} ${viewport.width}: HTTP ${response?.status() ?? 'sin respuesta'}`);
      const headers = response ? await response.allHeaders() : {};
      const result = await page.evaluate(() => {
        const robots = document.querySelector('meta[name="robots"]')?.content?.toLowerCase() ?? '';
        const h1 = document.querySelector('h1');
        const rect = h1?.getBoundingClientRect();
        const targets = [...document.querySelectorAll('a,button,select,input[type="checkbox"]')].map((element) => {
          const box = element.getBoundingClientRect();
          return { text: element.textContent?.trim(), width: box.width, height: box.height };
        }).filter((target) => target.width < 44 || target.height < 44);
        return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, robots, visibleH1: !!h1 && !!rect && rect.width > 0 && rect.height > 0, smallTargets: targets, creamBackgrounds: [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).backgroundColor === 'rgb(244, 241, 234)').length, yellowActions: [...document.querySelectorAll('.mail-card__actions .nm-btn')].filter((element) => getComputedStyle(element).backgroundColor === 'rgb(243, 201, 0)').length };
      });
      if (!result.robots.includes('noindex') || !result.robots.includes('nofollow')) errors.push(`${filename} ${viewport.width}: falta robots noindex,nofollow (${result.robots})`);
      if (/\bindex\b/i.test(headers['x-robots-tag'] ?? '') && !/\bnoindex\b/i.test(headers['x-robots-tag'] ?? '')) errors.push(`${filename} ${viewport.width}: X-Robots-Tag contradice noindex`);
      if (!result.visibleH1) errors.push(`${filename} ${viewport.width}: falta H1 visible`);
      if (result.scrollWidth > result.width) errors.push(`${filename} ${viewport.width}: desborde A8 ${result.scrollWidth}px`);
      if (result.smallTargets.length) errors.push(`${filename} ${viewport.width}: objetivos menores de 44px ${JSON.stringify(result.smallTargets)}`);
      if (result.creamBackgrounds) errors.push(`${filename} ${viewport.width}: superficie hueso de fondo ${result.creamBackgrounds}`);
      if (filename === 'bandeja.html' && result.yellowActions) errors.push(`bandeja ${viewport.width}: acciones amarillas competidoras ${result.yellowActions}`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  let response = await page.goto(`${baseUrl}/captacion/correos/bandeja.html`, { waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) errors.push(`bandeja 390: HTTP ${response?.status() ?? 'sin respuesta'}`);
  await page.locator('#mail-list').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(evidence, 'bandeja_390.png'), fullPage: true });
  const mobileInbox = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    cards: document.querySelectorAll('.mail-card').length,
    floatingDots: document.querySelectorAll('.mail-card__dots').length,
    fichas: [...document.querySelectorAll('.mail-card__sheet')].map((link) => link.getAttribute('href')),
    logoOk: document.images[0]?.complete && document.images[0]?.naturalWidth > 0,
  }));
  if (mobileInbox.scrollWidth > mobileInbox.width) errors.push(`bandeja 390: desborde ${mobileInbox.scrollWidth}px`);
  if (mobileInbox.cards !== 12) errors.push(`bandeja: cantidad de correos ${mobileInbox.cards}`);
  if (mobileInbox.floatingDots) errors.push(`bandeja: separadores flotantes ${mobileInbox.floatingDots}`);
  if (!mobileInbox.logoOk) errors.push('bandeja: logo no cargó');
  if (mobileInbox.fichas.length !== 12 || mobileInbox.fichas.some((href, index) => !href.includes(`E${String(index + 1).padStart(2, '0')}`))) errors.push('bandeja: falta enlace de ficha para uno o más correos');
  response = await page.goto(`${baseUrl}/captacion/correos/fichas.html`, { waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) errors.push(`fichas: HTTP ${response?.status() ?? 'sin respuesta'}`);
  const fichaView = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    cards: document.querySelectorAll('.ficha-card').length,
    facts: document.querySelectorAll('.ficha-facts').length,
  }));
  if (fichaView.scrollWidth > fichaView.width) errors.push(`fichas 390: desborde ${fichaView.scrollWidth}px`);
  if (fichaView.cards !== 12 || fichaView.facts !== 12) errors.push(`fichas: cards=${fichaView.cards}, tablas=${fichaView.facts}`);
  for (const id of Array.from({ length: 12 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`)) {
    await page.evaluate((wantedId) => { location.hash = `#${wantedId}`; }, id);
    const ficha = await page.evaluate((wantedId) => {
      const article = document.getElementById(wantedId);
      return { hash: location.hash, title: article?.querySelector('h2')?.textContent?.trim(), fields: article?.querySelectorAll('dl dt').length ?? 0 };
    }, id);
    if (ficha.hash !== `#${id}` || !ficha.title || ficha.fields < 9) errors.push(`ficha ${id}: el enlace no abrió la ficha completa`);
  }

  await page.goto(`${baseUrl}/captacion/correos/bandeja.html`, { waitUntil: 'domcontentloaded' });
  await page.selectOption('#filtro-etapa', 'interaccion');
  let visible = await page.locator('.mail-card:not([hidden])').count();
  if (visible !== 5) errors.push(`filtro etapa Interacción: ${visible} visibles, esperado 5`);
  await page.selectOption('#filtro-etapa', '');
  await page.selectOption('#filtro-base', 'marketing');
  visible = await page.locator('.mail-card:not([hidden])').count();
  if (visible !== 4) errors.push(`filtro base Marketing: ${visible} visibles, esperado 4`);
  await page.selectOption('#filtro-base', 'servicio');
  visible = await page.locator('.mail-card:not([hidden])').count();
  if (visible !== 2) errors.push(`filtro base Servicio: ${visible} visibles, esperado 2`);

  await page.setViewportSize({ width: 1440, height: 900 });
  response = await page.goto(`${baseUrl}/captacion/correos/bandeja.html`, { waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) errors.push(`bandeja 1440: HTTP ${response?.status() ?? 'sin respuesta'}`);
  await page.screenshot({ path: path.join(evidence, 'bandeja_1440.png'), fullPage: true });
  const desktopInbox = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (desktopInbox.scrollWidth > desktopInbox.width) errors.push(`bandeja 1440: desborde ${desktopInbox.scrollWidth}px`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/captacion/correos/E04.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('a[href*="baja=E04"]').click();
  await page.locator('#baja:not([hidden])').waitFor({ state: 'visible' });
  const unsubscribeText = await page.locator('#baja').textContent();
  if (!unsubscribeText?.includes('Baja simulada para E04')) errors.push('enlace de baja E04 no mostró su confirmación simulada');

  await browser.close();
  console.log(JSON.stringify({ screenshots: emailIds.length * 2 + 2, emailsCaptured: emailIds, checks, thumbnailChecks, a8AuditChecks, fichaView, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
