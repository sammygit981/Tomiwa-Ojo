(() => {
  const initHeader = (header) => {
    const menu = header.querySelector('[data-tisso-menu]');
    const openBtn = header.querySelector('[data-tisso-menu-open]');
    const closeBtn = header.querySelector('[data-tisso-menu-close]');

    if (!menu || !openBtn || !closeBtn) return;

    const open = () => {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      openBtn.classList.add('is-open');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      header.classList.add('is-menu-open');
    };

    const close = () => {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      openBtn.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      header.classList.remove('is-menu-open');
    };

    openBtn.addEventListener('click', () => {
      if (menu.classList.contains('is-open')) close();
      else open();
    });

    closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
    });
  };

  document.querySelectorAll('[data-tisso-header]').forEach(initHeader);
  document.addEventListener('shopify:section:load', (e) => {
    const header = e.target.querySelector('[data-tisso-header]');
    if (header) initHeader(header);
  });
})();
