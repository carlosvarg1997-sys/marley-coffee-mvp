/* Interacciones del prototipo. Solo los enlaces marcados traspasan atribución al portal. */
(() => {
  'use strict';
  const $ = (s, scope = document) => scope.querySelector(s);
  const $$ = (s, scope = document) => Array.from(scope.querySelectorAll(s));
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_id','utm_term','gclid','fbclid','li_fat_id',
    'mc_source','mc_session','mc_phase','mc_variant','mc_assignment','mc_order','mc_query_id','mc_surface','mc_entry_surface',
    'mc_first_click_ms','mc_first_click_surface','test','qa','journey','journey_started_at','return'];
  const safe = value => /^[A-Za-z0-9_.:-]{1,160}$/.test(value || '');
  const incoming = new URLSearchParams(location.search);
  $$('[data-attribution-handoff]').forEach(link => {
    const next = new URL(link.href, location.href);
    keys.forEach(key => { const value = incoming.get(key); if (safe(value)) next.searchParams.set(key, value); });
    const priorSurface = incoming.get('mc_entry_surface') || incoming.get('mc_surface');
    if (safe(priorSurface)) next.searchParams.set('mc_entry_surface', priorSurface);
    const surface = link.dataset.surface || document.body.dataset.surface || 'contenido';
    next.searchParams.set('mc_surface', surface);
    link.href = next.toString();
  });

  const tabs = $$('.ct-tab[role="tab"]');
  const selectTab = (tab, moveFocus = false) => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); selectTab(tabs[next], true);
    });
  });

  const format = value => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value);
  const number = (form, name) => Number(form.elements[name].value);
  const monthly = $('#ct-consumo');
  if (monthly) monthly.addEventListener('submit', event => {
    event.preventDefault();
    const cups = number(monthly, 'tazas'), days = number(monthly, 'dias'), grams = number(monthly, 'gramos');
    const out = $('#ct-consumo-resultado');
    if (![cups,days,grams].every(Number.isFinite) || cups <= 0 || days <= 0 || days > 31 || grams <= 0 || cups > 100000 || grams > 1000) {
      out.textContent = 'Revisa los datos: usa valores mayores que cero y entre 1 y 31 días al mes.'; return;
    }
    const kg = cups * days * grams / 1000;
    out.replaceChildren(document.createTextNode('Consumo orientativo: '));
    const value = document.createElement('strong'); value.textContent = format(kg) + ' kg de café al mes';
    out.append(value, document.createTextNode('. Ajusta el cálculo a tu receta y a la variación de tu negocio.'));
  });

  const stock = $('#ct-stock');
  if (stock) stock.addEventListener('submit', event => {
    event.preventDefault();
    const daily = number(stock, 'consumo'), days = number(stock, 'entrega'), reserve = number(stock, 'reserva');
    const out = $('#ct-stock-resultado');
    if (![daily,days,reserve].every(Number.isFinite) || daily <= 0 || days <= 0 || reserve < 0 || daily > 100000 || days > 365 || reserve > 100000) {
      out.textContent = 'Revisa los datos: consumo y días deben ser mayores que cero, y la reserva no puede ser negativa.'; return;
    }
    out.replaceChildren(document.createTextNode('Punto de reposición orientativo: '));
    const value = document.createElement('strong'); value.textContent = format(daily * days + reserve) + ' kg';
    out.append(value, document.createTextNode('. Revisa pedidos en camino y variación de demanda antes de pedir.'));
  });
})();
