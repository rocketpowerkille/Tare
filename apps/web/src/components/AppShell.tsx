import { BookOpen, Code2, FileSearch, FileClock, Menu, X } from './Icons';
import { useState } from 'react';
import { AppLink } from './AppLink';
import { BrandMark } from './BrandMark';

const items = [
  { href: '/explore', label: 'Explorer', icon: FileSearch },
  { href: '/explore#examples', label: 'Examples', icon: FileClock },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/developers', label: 'Developers', icon: Code2 },
];

export function AppShell({ path, children }: { path: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <AppLink href="/" className="brand" aria-label="Tare home">
          <BrandMark />
          <span>Tare</span>
        </AppLink>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {items.map(item => <NavItem key={item.href} {...item} active={path === item.href} />)}
        </nav>
        <div className="header-meta"><AppLink href="/explore" className="button primary">Run a check</AppLink></div>
        <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map(item => <NavItem key={item.href} {...item} active={path === item.href} close={() => setMenuOpen(false)} />)}
      </nav>}
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div><BrandMark size={24} /><strong>Tare</strong><span>Evidence before assumptions.</span></div>
        <div className="footer-links"><AppLink href="/docs">Documentation</AppLink><AppLink href="/developers">API and MCP</AppLink><a href="/openapi.json">OpenAPI</a><a href="https://github.com/rocketpowerkille/Tare">GitHub</a></div>
        <p>Read-only vault research. Ethereum · Base · Arbitrum · Base Sepolia testnet. Coverage varies by check. Not financial advice.</p>
      </footer>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active, close }: (typeof items)[number] & { active: boolean; close?: () => void }) {
  return <AppLink href={href} className={active ? 'nav-link active' : 'nav-link'} aria-current={active ? 'page' : undefined} onClick={close}>
    <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
  </AppLink>;
}
