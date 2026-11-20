// Los bancos R6 comprueban los controles del CRM anterior, que sigue embebido
// para compatibilidad. El CRM que monta la página se prueba con verify-crm-v2.
async function useLegacyCrm(context) {
  await context.route(/\/crm\/crm-v2\.js(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: '/* Banco del contrato R6: la vista legacy toma el control. */',
  }));
}

module.exports = { useLegacyCrm };
