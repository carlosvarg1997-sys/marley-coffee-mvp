'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');

const base = new URL(process.argv[2] || 'http://127.0.0.1:8910/');
const evidence = path.resolve(process.argv[3] || '../marley-final-26nov-evidencia/recuperacion');
const channel = process.argv[4] || 'chrome';
const origin = base.origin;
const ready = '.cmp-home-maquina';

async function capture(page, name) {
  await page.screenshot({ path: path.join(evidence, name + '.jpg'), type: 'jpeg', quality: 80, animations: 'disabled', timeout: 20000 });
}

async function check(browser, width, height) {
  const mobile = width < 768;
  const viewport = { width, height };
  const key = channel + '-' + width + 'x' + height;
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  try {
    await page.goto(new URL('index.html#C02', base).href, { waitUntil: 'domcontentloaded' });
    await page.locator(ready).first().waitFor();
    await page.waitForLoadState('load');
    const initial = await page.evaluate(localOrigin => {
      const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
        .filter(item => new URL(item.name).origin === localOrigin);
      return {
        bytes: entries.reduce((sum, item) => sum + item.transferSize, 0),
        media: entries.filter(item => /\.mp4(?:$|\?)/.test(item.name)).map(item => item.name),
        video: document.querySelectorAll('.ux-hero video').length
      };
    }, origin);
    if (width === 390) assert.ok(initial.bytes <= 2500000, JSON.stringify(initial));
    assert.equal(initial.video, 0);
    assert.deepEqual(initial.media, []);
    await capture(page, key + '-c02-poster');

    const hero = page.locator('.ux-hero');
    const rect = await hero.boundingBox();
    if (mobile) await page.touchscreen.tap(Math.round(rect.x + rect.width / 2), Math.round(rect.y + 55));
    else await page.mouse.click(Math.round(rect.x + rect.width / 2), Math.round(rect.y + 55));
    await page.waitForFunction(() => {
      const video = document.querySelector('.ux-hero video');
      return video && video.currentTime > 0.15 && !video.paused;
    }, null, { timeout: 14000 });
    const film = await hero.locator('video').evaluate(video => ({
      source: video.currentSrc,
      preload: video.preload,
      inline: video.playsInline,
      muted: video.muted,
      loop: video.loop,
      visible: video.getBoundingClientRect().height > 150
    }));
    assert.deepEqual({ ...film, source: '' }, { source: '', preload: 'none', inline: true, muted: true, loop: false, visible: true });
    const file = new URL(film.source);
    const response = await page.request.head(file.href);
    assert.ok(Number(response.headers()['content-length']) > 0 && Number(response.headers()['content-length']) <= 4000000);
    await capture(page, key + '-c02-video');

    await page.locator('.mc-machine-clip summary').click();
    await page.locator('.mc-machine-scene').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.mc-machine-scene .m5-cam')?.classList.contains('is-ready'), null, { timeout: 14000 });
    await capture(page, key + '-c02-escena');
    await page.locator('#condiciones [data-cierra-tarea="T1"]').click();
    await page.locator('#r4-titulo').waitFor();
    const guide = await page.locator('.r3-step-guide li b').evaluateAll(labels =>
      labels.map(label => ({
        title: label.textContent,
        height: label.offsetHeight,
        fits: label.scrollWidth <= label.clientWidth
      })));
    assert.ok(guide.length >= 3 && guide.every(label => label.height < 22 && label.fits), JSON.stringify(guide));
    await capture(page, key + '-c04-pasos');
    const scenes = [];
    for (const [route, selector] of [['C03', '.m5-split-media'], ['C08', '.m5-stage-media']]) {
      await page.evaluate(id => window.MarleyApp.go(id, { evaluation: true }), route);
      await page.locator('body[data-current="' + route + '"] ' + selector + ' .m5-film').first().scrollIntoViewIfNeeded();
      await page.waitForFunction(medium => {
        const video = document.querySelector(medium + ' video');
        return video && video.currentTime > .1 && !video.loop;
      }, selector, { timeout: 14000 });
      await capture(page, key + '-' + route.toLowerCase() + '-escena');
      scenes.push(route);
    }
    await page.evaluate(() => window.MarleyApp.go('C10', { evaluation: true }));
    await page.locator('body[data-current="C10"] h1').first().waitFor();
    await capture(page, key + '-c10');
    return { width, height, initial, film, guide, scenes };
  } finally { await page.close(); }
}

async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ channel });
  try {
    const checks = [];
    for (const [width, height] of [[390, 844], [360, 640], [1280, 551]]) checks.push(await check(browser, width, height));
    const still = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await still.goto(new URL('index.html#C02', base).href, { waitUntil: 'domcontentloaded' });
    await still.locator(ready).first().waitFor();
    await still.touchscreen.tap(190, 180);
    const reduced = await still.evaluate(() => ({
      videos: document.querySelectorAll('.ux-hero video').length,
      animation: getComputedStyle(document.querySelector('.ux-hero h1')).animationName
    }));
    assert.deepEqual(reduced, { videos: 0, animation: 'none' });
    await still.close();
    fs.writeFileSync(path.join(evidence, 'comprobaciones-' + channel + '.json'), JSON.stringify({ checks, reduced }, null, 2));
    console.log('PASS', channel, checks.map(({ width, height }) => width + 'x' + height).join(', '));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
