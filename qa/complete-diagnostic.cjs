// Responde el cuestionario usando sus controles, una pregunta por pantalla.
async function completeDiagnostic(page, { business = 'Restaurante', commune = 'Las Condes', stopAt, choose } = {}) {
  const form = page.locator('#r4Datos');
  for (let i = 0; i < 9; i++) {
    if (await page.evaluate(() => document.body.dataset.current !== 'C04')) return;
    await form.waitFor({ state: 'visible' });
    const heading = await form.locator('h1').innerText();
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
    await form.locator('[data-r4-next]:visible').click();
    if (!key && !isCommune) {
      await page.waitForFunction(() => document.body.dataset.current !== 'C04');
      return;
    }
    await page.waitForFunction(previous => document.body.dataset.current !== 'C04' || document.querySelector('#r4Datos h1')?.innerText !== previous, heading);
    if (await page.evaluate(() => document.body.dataset.current !== 'C04')) return;
  }
  throw new Error('El diagnóstico no terminó en 9 pasos');
}

module.exports = { completeDiagnostic };
