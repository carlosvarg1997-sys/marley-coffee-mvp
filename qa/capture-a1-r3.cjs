const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./playwright-system-chrome.cjs');

const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8879/';
const phase = process.argv[3] || 'before';
const evidenceDir = path.join(root, 'EVIDENCIA_10NOV');
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 1440, height: 900 },
];
const captures = [
  { point: 1, hashes: ['R00', 'R01', 'R02'], widths: [390, 1440] },
  { point: 2, hashes: ['C01', 'C03', 'C04', 'C05', 'C08'], widths: [360, 390, 414] },
  { point: 3, hashes: ['R00', 'R01'], widths: [390, 1440] },
  { point: 4, hashes: ['C10'], widths: [390, 1440] },
  { point: 8, hashes: ['C14', 'C15'], widths: [360, 390, 1440] },
];
const roleFor = (hash) => hash.startsWith('R') && hash !== 'R00' ? 'ventas' : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const summary = [];
  try {
    for (const batch of captures) {
      for (const width of batch.widths) {
        const viewport = viewports.find((item) => item.width === width);
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          page.on('pageerror', (error) => summary.push({ point: batch.point, width, type: 'pageerror', message: error.message }));
          page.on('console', (message) => { if (message.type() === 'error') summary.push({ point: batch.point, width, type: 'console', message: message.text() }); });
          await page.goto(new URL('/index.html', base).toString(), { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => Boolean(window.M4 && window.MarleyApp && window.M4D), null, { timeout: 10000 });
          await page.evaluate(() => window.M4?.loadExample?.());
          for (const hash of batch.hashes) {
            const role = roleFor(hash);
            await page.evaluate(({ hash, role }) => {
              if (window.M4?.setRole) window.M4.setRole(role);
              window.MarleyApp.go(hash, { evaluation: true });
            }, { hash, role });
            await page.waitForFunction((value) => document.body.dataset.current === value, hash, { timeout: 5000 });
            await sleep(150);
            if (hash === 'C08' && batch.point === 2) {
              const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
              for (const [stage, y] of [['inicio', 0], ['medio', Math.floor(max / 2)], ['final', max]]) {
                await page.evaluate((top) => window.scrollTo(0, top), y);
                await sleep(100);
                const file = `A1_${phase}_A8r3_p${batch.point}_${hash}_${width}_${stage}.png`;
                await page.screenshot({ path: path.join(evidenceDir, file) });
                summary.push({ point: batch.point, hash, width, stage, file, scrollY: await page.evaluate(() => scrollY) });
              }
              await page.evaluate(() => window.scrollTo(0, 0));
            } else {
              const file = `A1_${phase}_A8r3_p${batch.point}_${hash}_${width}.png`;
              await page.screenshot({ path: path.join(evidenceDir, file) });
              summary.push({ point: batch.point, hash, width, file });
            }
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
