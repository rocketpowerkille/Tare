import { useEffect, useState } from 'react';
import { Moon, Sun } from './Icons';

type Theme = 'light' | 'dark';

function themeFrom(value: string | null | undefined): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => themeFrom(document.documentElement.dataset.theme));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111915' : '#f8f9f7');
    function sync(event: StorageEvent) {
      if (event.key === 'tare-theme' || event.key === null) setTheme(themeFrom(event.newValue));
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [theme]);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('tare-theme', next); }
    catch { /* The toggle still works for this visit when storage is unavailable. */ }
  }

  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
