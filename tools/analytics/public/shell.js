(function initAnalyticsShell() {
  const STORAGE_KEY = 'tatvic-analytics-theme';
  const root = document.documentElement;
  const sidebar = document.getElementById('appSidebar');
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }
  }

  function setSidebar(open) {
    document.body.classList.toggle('sidebar-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) backdrop.hidden = !open;
  }

  applyTheme(preferredTheme());

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  toggle?.addEventListener('click', () => {
    setSidebar(!document.body.classList.contains('sidebar-open'));
  });
  backdrop?.addEventListener('click', () => setSidebar(false));

  sidebar?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 767px)').matches) setSidebar(false);
    });
  });
})();
