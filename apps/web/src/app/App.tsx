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
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [path]);

  const page = path === '/explore' ? <ExplorerPage />
    : path === '/docs' ? <DocsPage />
      : path === '/developers' ? <DevelopersPage />
        : <HomePage />;
  return <AppShell path={path}>{page}</AppShell>;
}
