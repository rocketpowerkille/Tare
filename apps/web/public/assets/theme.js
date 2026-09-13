// Apply the saved preference before the application renders, without inline scripts.
(() => {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('tare-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* Storage may be disabled; keep the dark default. */ }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111915' : '#f8f9f7');
})();
