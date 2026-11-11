const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const base = process.argv[2] || 'http://127.0.0.1:8879/';
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(new URL('/index.html#R00', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp), null, { timeout: 10000 });
    await page.locator('#m4User').fill('paula.diaz');
    await page.locator('#m4Pass').fill('incorrecta');
    await page.locator('button[type="submit"]').click();
    await page.locator('[role="alert"]').waitFor({ state: 'visible' });
    const message = await page.locator('[role="alert"]').innerText();
    if (!/contraseña de prueba/i.test(message) || /demo|demostración/i.test(message)) throw new Error(`Mensaje de acceso inesperado: ${message}`);
    const file = path.join(root, 'EVIDENCIA_10NOV', 'A1_after_A8r3_p1_R00_390_error-prueba.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
    process.stdout.write(JSON.stringify({ status: 'PASS', file, message }) + '\n');
    await context.close();
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
