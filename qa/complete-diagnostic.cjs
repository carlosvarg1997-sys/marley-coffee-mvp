// Responde el cuestionario usando sus controles, una pregunta por pantalla.
async function completeDiagnostic(page, { business = 'Restaurante', commune = 'Las Condes', stopAt, choose } = {}) {
  const form = page.locator('#r4Datos');
  await form.waitFor({ state: 'visible' });
  for (let i = 0; i < 9; i++) {
    if (await page.evaluate(() => document.body.dataset.current !== 'C04')) return;
    await form.waitFor({ state: 'visible' });
    const step = await form.locator('.r5-q-progress > span').first().innerText();
    const action = await form.locator('[data-r4-next]').innerText();
    const options = form.locator('[data-a="answer"]');
    const key = await options.first().getAttribute('data-k', { timeout: 500 }).catch(() => null);
    if (key && key === stopAt) return;
    const communePicker = form.locator('#m5Comuna');
    const isCommune = await communePicker.isVisible();
    if (isCommune) await communePicker.selectOption({ label: commune });
    if (key) {
      const preferred = key === 'negocio' ? business : choose?.[key];
      const selected = options.filter({ hasText: preferred || /a^/ }).first();
      if (preferred && await selected.count()) await selected.click();
      else if (!await form.locator('[data-a="answer"][aria-pressed="true"]').count()) await options.first().click();
    }
    const name = form.locator('[name="name"]');
    if (await name.isVisible()) {
      if (!await name.inputValue()) await name.fill('Camila Rojas');
      const email = form.locator('[name="email"]');
      if (!await email.inputValue()) await email.fill('camila.rojas@example.com');
      await form.locator('[name="consent"]').check();
    }
    if (await page.evaluate(() => document.body.dataset.current !== 'C04')) return;
    // El cuestionario se vuelve a dibujar al responder: el botón puede quedar reemplazado a mitad
    // del clic. Se reintenta con la misma condición (no se relaja nada de lo que se comprueba).
    for (let intento = 0; ; intento++) {
      try {
        const next = form.locator('[data-r4-next]:visible');
        await next.scrollIntoViewIfNeeded({ timeout: 4000 });
        await next.click({ timeout: 4000 });
        break;
      } catch (error) {
        if (intento >= 2 || !/not attached|detached|not stable|Timeout/i.test(String(error.message))) throw error;
        await page.waitForTimeout(250);
      }
    }
    if (!key && !isCommune) {
      await page.waitForFunction(() => document.body.dataset.current !== 'C04');
      return;
    }
    await page.waitForFunction(({ step, action }) => {
      const form = document.querySelector('#r4Datos');
      return document.body.dataset.current !== 'C04' ||
        (form && (form.querySelector('.r5-q-progress > span')?.innerText !== step ||
          form.querySelector('[data-r4-next]')?.innerText !== action));
    }, { step, action });
    if (await page.evaluate(() => document.body.dataset.current !== 'C04')) return;
  }
  throw new Error('El diagnóstico no terminó en 9 pasos');
}

async function completePack(page) {
  await page.locator('#pack-resumen [data-pack-accion="aceptar"]').click();
  const contacto = page.locator('#pack-contacto');
  await page.locator('#pack-contacto, #cross-sell').first().waitFor({ state: 'visible' });
  if (await contacto.isVisible()) {
    await contacto.locator('[name="name"]').fill('Prueba de compra');
    await contacto.locator('[name="email"]').fill('compra@example.test');
    const commune = contacto.locator('[name="comuna"]');
    if (await commune.isVisible()) await commune.selectOption('Las Condes');
    await contacto.locator('[name="consent"]').check();
    await contacto.locator('[type="submit"]').click();
  }
  await page.locator('#cross-sell [data-cross="no-gracias"]').click();
}

module.exports = { completeDiagnostic, completePack };
