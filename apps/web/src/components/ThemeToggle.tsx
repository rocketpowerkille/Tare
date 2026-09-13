import { useEffect, useState } from 'react';
import { Moon, Sun } from './Icons';

type Theme = 'light' | 'dark';
type Preference = Theme | 'system';

function preferenceFrom(value: string | null | undefined): Preference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function ThemeToggle() {
  const [preference, setPreference] = useState(() => preferenceFrom(document.documentElement.dataset.themePreference));
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const device = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() {
      const next = preference === 'system' ? (device.matches ? 'dark' : 'light') : preference;
      document.documentElement.dataset.theme = next;
      document.documentElement.dataset.themePreference = preference;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#111915' : '#f8f9f7');
      setTheme(next);
    }
    function sync(event: StorageEvent) {
      if (event.key === 'tare-theme' || event.key === null) setPreference(preferenceFrom(event.newValue));
    }
    apply();
    device.addEventListener('change', apply);
    window.addEventListener('storage', sync);
    return () => {
      device.removeEventListener('change', apply);
      window.removeEventListener('storage', sync);
    };
  }, [preference]);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try { localStorage.setItem('tare-theme', next); }
    catch { /* The toggle still works for this visit when storage is unavailable. */ }
  }

  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
