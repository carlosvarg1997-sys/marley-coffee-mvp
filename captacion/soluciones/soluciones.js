(() => {
  'use strict';
  const cta = document.querySelector('[data-sol-floating]');
  if (!cta) return;
  let frame = 0;

  const sourceParams = new URLSearchParams(location.search);
  const attributionKeys = Array.from(sourceParams.keys()).filter((key) => /^(utm_|mc_|gclid$|fbclid$|li_fat_id$|test$|qa$|journey$|return$)/.test(key));
  document.querySelectorAll('[data-sol-route]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = new URL(link.href, location.href);
      attributionKeys.forEach((key) => target.searchParams.set(key, sourceParams.get(key)));
      const sourceSurface = sourceParams.get('mc_entry_surface') || sourceParams.get('mc_surface');
      if (sourceSurface) target.searchParams.set('mc_entry_surface', sourceSurface);
      target.searchParams.set('mc_surface', link.dataset.surface || 'solucion');
      target.searchParams.set('mc_landing', location.pathname.split('/').pop().replace(/\.html$/, ''));
      if (link.dataset.screen) target.hash = link.dataset.screen;
      link.href = target.toString();
    });
  });

  const setHidden = (hidden) => {
    cta.dataset.solHidden = String(hidden);
    cta.setAttribute('aria-hidden', String(hidden));
    cta.tabIndex = hidden ? -1 : 0;
  };

  const update = () => {
    frame = 0;
    const button = cta.getBoundingClientRect();
    const sectionInView = Array.from(document.querySelectorAll('[data-offer-block], #propuesta')).some((section) => {
      const rect = section.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    const overlapsAction = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, summary, h1, h2, h3, p, li, label, output')).some((el) => {
      if (el === cta || el.closest('[hidden], [inert]')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > button.left && rect.left < button.right
        && rect.bottom > button.top && rect.top < button.bottom;
    });
    setHidden(sectionInView || overlapsAction);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  setHidden(true);
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
})();
