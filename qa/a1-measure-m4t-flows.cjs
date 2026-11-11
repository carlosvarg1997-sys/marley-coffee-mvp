// Mide la ruta real A desde el lanzador y el acceso del moderador en C03.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'PRUEBA_CON_PERSONAS', 'RONDA_FINAL_E0_E9', 'evidencia', 'flujos');
const BASE = 'http://127.0.0.1:8877';
const LAUNCHER = `${BASE}/PRUEBA_CON_PERSONAS/RONDA_FINAL_E0_E9/inicio.html`;

async function answerInitial(page) {
  for (let i = 0; i < 80; i += 1) {
    const fields = page.locator('#question-fields');
    if (!(await fields.count())) break;
    const textarea = fields.locator('textarea');
    const radios = fields.locator('input[type="radio"]');
    const checks = fields.locator('input[type="checkbox"]');
    if (await textarea.count()) await textarea.fill('Respuesta ficticia de prueba.');
    else if (await radios.count()) await radios.first().check();
    else if (await checks.count()) await checks.first().check();
    await page.locator('.mc-question-actions .mc-btn--primary').click();
  }
  await page.getByRole('heading', { name: 'Comenzar recorrido', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Comenzar recorrido' }).click();
  await page.waitForFunction(() => !location.pathname.endsWith('/sesion.html'));
  await page.waitForFunction(() => document.body.getAttribute('data-current') === 'C01');
}

function area(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const launcher = await context.newPage();
  const pageErrors = [];
  launcher.on('pageerror', (e) => pageErrors.push(`launcher: ${e.message}`));
  await launcher.goto(LAUNCHER, { waitUntil: 'domcontentloaded' });
  await launcher.locator('#participant').selectOption('P2');
  const popup = launcher.waitForEvent('popup');
  await launcher.locator('[data-route="A"]').click();
  const person = await popup;
  person.on('pageerror', (e) => pageErrors.push(`participant: ${e.message}`));
  await person.waitForURL(/sesion\.html\?fase=inicial/);
  await person.locator('#consent-accepted').check();
  await person.getByRole('button', { name: 'Continuar a las preguntas iniciales' }).click();
  await person.locator('#question-fields').waitFor();
  await answerInitial(person);
  await person.getByRole('button', { name: 'Ir a Google' }).click();
  await person.locator('#query').fill('café para hotel');
  await person.locator('#search button[type="submit"]').click();
  await person.locator('#organic-title').click();
  await person.waitForURL(/captacion\/soluciones\/hoteles\.html/);
  await person.getByRole('link', { name: /IR AL PORTAL/i }).click();
  await person.waitForFunction(() => document.body.getAttribute('data-current') === 'C03');
  await person.locator('#m4FEmail').waitFor({ state: 'visible' });
  await person.waitForFunction(() => {
    const pill = document.querySelector('.m4t-pill[data-a1-inline="true"]');
    const menu = document.querySelector('#m4tMenu[data-a1-inline="true"]');
    return !!pill && !!menu;
  });

  const results = [];
  for (const width of [360, 390, 414]) {
    await person.setViewportSize({ width, height: width === 360 ? 800 : width === 414 ? 896 : 844 });
    await person.waitForTimeout(250);
    const measured = await person.evaluate(() => {
      const button = document.querySelector('#m4tMore');
      const chip = [...document.querySelectorAll('#m4Contact button')].find((el) => el.innerText.trim() === 'Otro correo');
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, top: r.top + scrollY, left: r.left + scrollX, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height };
      };
      const b = rect(button), c = rect(chip);
      const controls = [...document.querySelectorAll('#m4Contact button,#m4Contact input,#m4Contact select,#m4Contact textarea,#m4Contact label')]
        .filter((el) => el !== button && !button?.contains(el) && el.getClientRects().length)
        .map((el) => ({ name: (el.innerText || el.getAttribute('aria-label') || el.id || el.name || el.tagName).trim().slice(0, 80), ...rect(el) }));
      const overlaps = controls.map((item) => ({ name: item.name, area: Math.max(0, Math.min(b?.right ?? 0, item.right) - Math.max(b?.left ?? 0, item.left)) * Math.max(0, Math.min(b?.bottom ?? 0, item.bottom) - Math.max(b?.top ?? 0, item.top)) })).filter((item) => item.area > 0);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        more: b,
        otroCorreo: c,
        overlapWithOtroCorreoPx2: b && c ? Math.max(0, Math.min(b.right, c.right) - Math.max(b.left, c.left)) * Math.max(0, Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top)) : null,
        overlapsWithFormControls: overlaps,
        moreComputedPosition: getComputedStyle(button).position,
        menuHidden: document.querySelector('#m4tMenu')?.hidden ?? true,
        horizontalOverflowPx: document.documentElement.scrollWidth - innerWidth,
      };
    });
    if (!measured.more || measured.more.width < 44 || measured.more.height < 44) throw new Error(`M4T ${width}px: el botón no cumple 44×44 (${JSON.stringify(measured.more)})`);
    if (measured.overlapWithOtroCorreoPx2 !== 0 || measured.overlapsWithFormControls.length) throw new Error(`M4T ${width}px: se cruza con controles ${JSON.stringify(measured.overlapsWithFormControls)}`);
    if (measured.moreComputedPosition === 'fixed' || measured.horizontalOverflowPx > 0) throw new Error(`M4T ${width}px: botón fijo o desborde horizontal (${JSON.stringify(measured)})`);
    await person.locator('#m4tMore').scrollIntoViewIfNeeded();
    await person.screenshot({ path: path.join(OUT, `m4t-c03-${width}.jpg`), type: 'jpeg', quality: 52, animations: 'disabled' });
    results.push(measured);
  }

  await person.locator('#m4tMore').click();
  await person.locator('#m4tMenu').waitFor({ state: 'visible' });
  const menu = await person.locator('#m4tMenu').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const buttons = [...el.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => ({ text: b.innerText.trim(), height: b.getBoundingClientRect().height }));
    return { position: getComputedStyle(el).position, box: { x: r.x, y: r.y, width: r.width, height: r.height }, buttons };
  });
  if (menu.position === 'fixed' || menu.buttons.some((button) => button.height < 44)) throw new Error(`El menú del moderador no está en flujo o tiene objetivos menores a 44 px: ${JSON.stringify(menu)}`);
  await person.screenshot({ path: path.join(OUT, 'm4t-c03-menu-390.jpg'), type: 'jpeg', quality: 52, animations: 'disabled' });
  if (pageErrors.length) throw new Error(pageErrors.join(' | '));
  const report = { ruta: 'inicio.html → cuestionario inicial → A/Google → resultado orgánico → solución hoteles → portal C03', viewportMedidas: results, menuModerador: menu, pageErrors };
  fs.writeFileSync(path.join(OUT, 'm4t-medicion.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
