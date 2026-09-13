import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { DevelopersPage } from '../pages/DevelopersPage';
import { DocsPage } from '../pages/DocsPage';
import { ExplorerPage } from '../pages/ExplorerPage';
import { HomePage } from '../pages/HomePage';

const routeMetadata: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Tare | Vault evidence, made clear',
    description: 'Read-only evidence for understanding nested DeFi vault positions.',
  },
  '/explore': {
    title: 'Explore | Tare',
    description: 'Run a guided Tare evidence check or replay a recorded example.',
  },
  '/investigate': {
    title: 'Investigate | Tare',
    description: 'Investigate wallet positions and compare evidence between two blocks.',
  },
  '/docs': {
    title: 'Learn | Tare',
    description: 'A beginner-friendly guide to Tare, vault evidence, and report labels.',
  },
  '/developers': {
    title: 'Developers | Tare',
    description: 'Use Tare through HTTP, MCP, OpenAPI, or the command line.',
  },
};

export function App() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, '') || '/');
  useEffect(() => {
    const update = () => setPath(window.location.pathname.replace(/\/$/, '') || '/');
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    const metadata = routeMetadata[path] ?? routeMetadata['/'];
    document.title = metadata.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description);
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
    else requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
  }, [path]);

  const page = path === '/explore' || path === '/investigate' ? <ExplorerPage mode={path === '/investigate' ? 'investigate' : 'explore'} />
    : path === '/docs' ? <DocsPage />
      : path === '/developers' ? <DevelopersPage />
        : <HomePage />;
  return <AppShell path={path}>{page}</AppShell>;
}
