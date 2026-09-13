import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openapi } from '../apps/api/src/openapi.js';
import { mcpOpenapi } from '../apps/api/src/openapi-mcp.js';
import { AnalyzeSchema, DiscoverSchema, ReplaySchema } from '../packages/service/src/requests.js';
import { parseCliArgs } from '../apps/cli/src/args.js';
import { help } from '../apps/cli/src/help.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path), 'utf8');

test('current workspace routes and session budget boundaries are documented', async () => {
  const reference = await read('docs/API_REFERENCE.md');
  const readme = await read('README.md');
  const routeRow = readme.split('\n').find(line => line.startsWith('| Web |'))!;
  for (const route of ['/explore', '/investigate', '/examples', '/docs', '/developers']) {
    assert.ok(reference.includes(`\`${route}\``));
    assert.ok(routeRow.includes(`\`${route}\``), `README route inventory omits ${route}`);
  }
  const guide = await read('apps/web/src/components/BazanticAccessGuide.tsx');
  assert.match(guide, /at most 10 session purchases/);
  assert.match(guide, /multiple analyses until it expires/);
  assert.match(guide, /no other calls consume its budget/);
  const docs = await read('apps/web/src/pages/DocsPage.tsx');
  assert.match(docs, /id="workspaces"/);
  assert.match(docs, /not a ten-analysis limit/);
  assert.match(docs, /Disconnect session/);
  const changes = await read('docs/CHANGE_INVESTIGATION.md');
  assert.match(changes, /In `\/investigate`, select \*\*Changes over time\*\*/);
});

test('CLI help advertises only options accepted by the root parser', () => {
  const previous = process.argv;
  try {
    for (const name of new Set([...help.matchAll(/--([a-z][a-z-]+)/g)].map(match => match[1]!))) {
      process.argv = ['node', 'tare', `--${name}`];
      try { parseCliArgs(); }
      catch (error) {
        // A recognized string option needs a value; an unknown advertised flag is a documentation defect.
        assert.equal((error as NodeJS.ErrnoException).code, 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE', `Undocumented parser option: --${name}`);
      }
    }
  } finally { process.argv = previous; }
});

test('operator documentation covers environment variables consumed by runtime and browser tools', async () => {
  const docs = (await readdir(resolve(root, 'docs'))).filter(name => name.endsWith('.md'));
  const content = [await read('.env.example'), await read('README.md'), ...await Promise.all(docs.map(name => read(`docs/${name}`)))].join('\n');
  for (const directory of ['apps/api/src', 'packages/service/src', 'scripts']) {
    const files = (await readdir(resolve(root, directory))).filter(name => /\.(ts|mjs)$/.test(name));
    for (const name of files) {
      const source = await read(`${directory}/${name}`);
      for (const match of source.matchAll(/\b(?:TARE_[A-Z0-9_]+|GRAPH_API_KEY|GRAPH_MARKET_API_TOKEN|SUBSTREAMS_API_TOKEN)\b/g)) {
        assert.ok(content.includes(match[0]), `${directory}/${name}: ${match[0]} has no operator documentation`);
      }
    }
  }
});

test('repository documentation relative links and Markdown anchors resolve', async () => {
  const docs = (await readdir(resolve(root, 'docs'))).filter(name => name.endsWith('.md')).map(name => `docs/${name}`);
  const files = ['README.md', ...docs, 'graph/subgraph/README.md', 'graph/integration/README.md',
    'fixtures/live/README.md', 'fixtures/recordings/README.md'];
  for (const file of files) {
    const content = await read(file);
    for (const match of content.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const href = match[1]!;
      if (/^[a-z]+:/i.test(href)) continue;
      const [path, anchor] = href.split('#');
      const target = path ? resolve(root, dirname(file), decodeURIComponent(path)) : resolve(root, file);
      await assert.doesNotReject(access(target), `${file}: ${href}`);
      if (anchor && target.endsWith('.md')) {
        const text = await readFile(target, 'utf8');
        const headings = [...text.matchAll(/^#+ (.+)$/gm)].map(item => item[1]!.trim().toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-'));
        assert.ok(headings.includes(decodeURIComponent(anchor)), `${file}: missing anchor ${href}`);
      }
    }
  }
});

test('API reference and website inventory cover the current HTTP routes and gateway tools', async () => {
  const reference = await read('docs/API_REFERENCE.md');
  const component = await read('apps/web/src/components/DeveloperEndpoints.tsx');
  const expected = Object.entries(openapi.paths).flatMap(([path, value]) => Object.keys(value)
    .filter(method => ['get', 'post'].includes(method)).map(method => `${method.toUpperCase()} ${path}`)).sort();
  const documented = [...reference.matchAll(/^\| (GET|POST) \| `([^`]+)`/gm)].map(match => `${match[1]} ${match[2]}`).sort();
  const displayed = [...component.matchAll(/\['(GET|POST)', '([^']+)'/g)].map(match => `${match[1]} ${match[2]}`).sort();
  assert.deepEqual(documented, expected);
  assert.deepEqual(displayed, expected);
  const integration = await read('docs/BAZANTIC_INTEGRATION.md');
  const developer = await read('apps/web/src/pages/DevelopersPage.tsx');
  for (const value of Object.values(mcpOpenapi.paths)) {
    const operation = 'post' in value ? value.post : value.get;
    assert.ok(reference.includes(`\`${operation.operationId}\``));
    assert.ok(integration.includes(`\`${operation.operationId}\``));
    assert.ok(developer.includes(`<code>${operation.operationId}</code>`));
  }
});

test('documentation describes runtime analysis variants and known shared-schema limitations', async () => {
  const reference = await read('docs/API_REFERENCE.md');
  const documented = [...reference.matchAll(/^\| `((?:resolve|verify|value)-[^`]+)` \|/gm)].map(match => match[1]).sort();
  assert.deepEqual(documented, AnalyzeSchema.options.map(option => option.shape.operation.value).sort());
  assert.equal(DiscoverSchema.safeParse({ owner: '0x' + '1'.repeat(40), vault: '0x' + '2'.repeat(40) }).success, false);
  assert.equal(ReplaySchema.safeParse({ operation: 'value-position', capture: {} }).success, false);
  assert.match(reference, /discovery `vault` hint is not accepted/);
  assert.match(reference, /runtime replay does not support it/);
  for (const file of ['README.md', 'apps/web/src/pages/DocsPage.tsx', 'apps/web/src/pages/DevelopersPage.tsx']) {
    assert.doesNotMatch(await read(file), /https:\/\/tare-api\.onrender\.com/);
  }
});
