// Apply the saved preference before the application renders, without inline scripts.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('tare-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* Storage may be disabled; follow the device preference. */ }
  const theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111915' : '#f8f9f7');
})();
