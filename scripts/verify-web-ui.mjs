// Browser regression checks. Fixture-backed scenarios are NOT live integration acceptance.
// Set TARE_PLAYWRIGHT_MODULE to an installed Playwright package when not installed locally.
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { checkWorkspace } from './web-workspace-checks.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TARE_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TARE_UI_ORIGIN || 'http://127.0.0.1:4318';
const output = new URL('../tmp/ui-review/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.TARE_BROWSER_CHANNEL ? { channel: process.env.TARE_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function fits(label) {
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(dimensions.page <= dimensions.viewport + 1, `${label}: page overflows ${JSON.stringify(dimensions)}`);
}

try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/explore', '/docs', '/developers']) {
      await page.goto(origin + route);
      await page.locator('h1').waitFor();
      if (route === '/explore') await page.locator('#example').waitFor();
      await fits(`${route} at ${width}`);
      await page.screenshot({ path: new URL(`${route.slice(1) || 'home'}-${width}.png`, output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
    }
  }
  console.log('All four application routes fit at 1440, 1024, 768, 390 and 320px.');
  await page.goto(origin + '/');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Examples' }).click();
  await page.locator('#example').waitFor();
  assert.equal(new URL(page.url()).hash, '#examples');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const examples = await page.locator('#example option').evaluateAll(options => options.map(option => option.value));
  for (const id of examples) {
    await page.locator('#example').selectOption(id);
    await page.getByRole('button', { name: 'Replay example', exact: true }).click();
    await page.locator('.report-view').waitFor();
    assert.ok((await page.locator('.report-meta').innerText()).toLowerCase().includes('saved example'));
    await fits(`example ${id}`);
    await page.screenshot({ path: new URL(`report-${id}.png`, output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
  }
  await page.locator('#example').selectOption(examples[0]);
  await page.getByRole('button', { name: 'Replay example', exact: true }).click();
  await page.locator('.report-view').waitFor();
  const node = page.locator('.path-node').nth(1);
  if (await node.count()) {
    await node.focus();
    await page.keyboard.press('Enter');
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    await page.locator('.node-inspector details summary').click();
    await page.locator('.node-inspector pre').waitFor({ state: 'visible' });
  }
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report', exact: true }).click();
  assert.equal((await downloadEvent).suggestedFilename(), 'tare-report.json');
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.locator('.error-banner').waitFor();
  await page.locator('input[type=file]').setInputFiles(new URL('../fixtures/live/steakhouse-usdc.capture.json', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, ''));
  await page.locator('.activity-line').filter({ hasText: 'Your result is ready' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await fits('recorded report on mobile');
  await page.screenshot({ path: new URL('report-mobile.png', output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
  console.log(`Recorded examples (${examples.length}), keyboard node selection, downloads, valid and invalid replay passed.`);

  // Deterministic UI-only network fixtures exercise slow responses and failures.
  const capabilities = await (await fetch(origin + '/api/status')).json();
  const fixture = JSON.parse(await readFile(new URL('../fixtures/live/steakhouse-usdc.receipt.json', import.meta.url), 'utf8'));
  for (const key of Object.keys(capabilities.live)) capabilities.live[key] = true;
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  await page.route('**/api/discover', route => route.fulfill({ json: {
    source: 'morpho-graphql', scope: 'indexed-morpho-v1-and-v2', observedAt: '2026-09-09T05:35:09.475Z', blockAligned: false, complete: false, issues: ['limit'],
    positions: [
      { owner: fixture.owner, vault: fixture.vault.address, name: 'Steakhouse USDC', protocol: 'morpho', version: 'v1', chainId: 1, network: 'Ethereum', asset: { symbol: 'USDC' }, support: { status: 'supported', operation: 'resolve-v1', checkType: 'Vault shares and market exposure' } },
      { owner: fixture.owner, vault: '0x1111111111111111111111111111111111111111', name: 'Unsupported fixture vault', protocol: 'morpho', version: 'v2', chainId: 1, network: 'Ethereum', asset: { symbol: 'WETH' }, support: { status: 'unsupported', reason: 'No configured adapter' } },
    ],
  } }));
  let releasePosition;
  const positionGate = new Promise(resolve => { releasePosition = resolve; });
  await page.route('**/api/analyze', async route => {
    const input = route.request().postDataJSON();
    if (input.operation === 'verify-graph-composition') return route.fulfill({ status: 503, json: { error: { message: 'Fixture: indexed source unavailable.' } } });
    if (input.operation === 'value-position') return route.fulfill({ status: 503, json: { error: { message: 'Fixture: price unavailable.' } } });
    await positionGate;
    return route.fulfill({ json: fixture });
  });
  await page.goto(origin + '/explore');
  await page.locator('#owner').fill('invalid');
  await page.getByRole('button', { name: 'Find my vaults' }).click();
  await page.locator('.discovery-error').waitFor();
  await page.locator('#owner').fill(fixture.owner);
  await page.getByRole('button', { name: 'Find my vaults' }).click();
  await page.locator('.vault-option').first().waitFor();
  assert.equal(await page.locator('.vault-option.unsupported').isDisabled(), true);
  await page.locator('.vault-option').first().click();
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('.stage-active').first().waitFor();
  assert.match(await page.locator('.evidence-timeline').innerText(), /Trace details arrive together/);
  assert.equal(await page.locator('#owner').isDisabled(), true);
  releasePosition();
  await page.locator('.composed-report').waitFor();
  assert.match(await page.locator('.source-cards').innerText(), /Source unavailable/);
  assert.match(await page.locator('.value-conversion').innerText(), /USD estimate unavailable/);
  await fits('fixture-backed incomplete combined report');
  await page.screenshot({ path: new URL('combined-mobile.png', output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', route => {
    const input = route.request().postDataJSON();
    if (input.operation === 'verify-graph-composition') return route.fulfill({ json: {
      reportType: 'graph-product-composition', status: 'matched', capture: { block: { number: '25937755' } },
      checks: { tokenApiAmountRaw: fixture.vault.sharesRaw, rpcAmountRaw: fixture.vault.sharesRaw, checkedBlock: 25937755, tokenApiLastUpdateBlock: 25937754, accountingApplicable: true, accountingStatus: 'matched', accountingReads: 56 },
    } });
    if (input.operation === 'value-position') return route.fulfill({ json: {
      status: 'complete', price: { feed: '0x1111111111111111111111111111111111111111', decimals: 8, answerRaw: '100000000', updatedAt: '1', roundId: '2' }, value: { valueRaw: '2872844333980900', decimals: 8 },
    } });
    return route.fulfill({ json: fixture });
  });
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('.price-provenance').waitFor();
  assert.match(await page.locator('.value-conversion').innerText(), /Market-priced/i);
  assert.match(await page.locator('.source-caution').innerText(), /Do not treat these as a same-block comparison/);
  await page.getByRole('button', { name: 'Copy Wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Copy Wallet', exact: true }).getByRole('status').filter({ hasText: 'Copied' }).waitFor();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(`fixture-backed priced report at ${width}`);
    await page.screenshot({ path: new URL(`priced-report-${width}.png`, output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
  }
  await page.locator('.text-path > summary').click();
  await fits('expanded text outline at 320px');
  console.log('Fixture-backed pricing, block mismatch notice, copying and text outline passed.');
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', route => route.fulfill({ status: 401, json: { error: { message: 'Fixture: session expired.' } } }));
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('#access-token').waitFor();
  await page.locator('.activity-line').filter({ hasText: 'No result was produced' }).waitFor();
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ status: 401, json: { error: { message: 'Fixture: invalid access.' } } }));
  await page.locator('#access-token').fill('invalid-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.locator('.field-error').waitFor();
  console.log('Fixture-backed discovery, source outages, honest progress, expired and invalid access passed.');
  await page.route('**/api/access-options', route => route.fulfill({ json: { privateBeta: true, bazanticSandbox: { enabled: true, network: 'base-sepolia', gatewayUrl: 'https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com', sessionPath: '/api/bazantic/session', sessionSeconds: 900 } } }));
  await page.goto(origin + '/explore');
  await page.locator('.developer-access > summary').click();
  await page.locator('.bazantic-guide').waitFor();
  assert.match(await page.locator('.access-tracker [aria-current=step]').innerText(), /Prepare Bazantic/);
  await page.getByRole('checkbox', { name: '1. Prepare Bazantic' }).check();
  assert.match(await page.locator('.access-tracker [aria-current=step]').innerText(), /Create grant/);
  await page.getByRole('button', { name: 'Copy grant command', exact: true }).click();
  await page.getByRole('button', { name: 'Copy grant command', exact: true }).getByRole('status').filter({ hasText: 'Copied' }).waitFor();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(`sandbox instructions at ${width}`);
    await page.screenshot({ path: new URL(`access-${width}.png`, output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
  }
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  const claims = { sessionId: 'ui-test-only', network: 'base-sepolia', issuedAt: 1700000000, expiresAt: 1700000900 };
  const testToken = `tare_sandbox_v1.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture-only`;
  await page.locator('#access-token').fill(testToken);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.locator('.session-evidence').waitFor();
  await page.locator('.session-evidence summary').click();
  assert.match(await page.locator('.session-evidence').innerText(), /not included in this access token/);
  assert.ok(!(await page.locator('body').innerText()).includes(testToken));
  await fits('accepted session UI fixture at 320px');
  console.log('Sandbox guide and session evidence rendering passed using an isolated authorization fixture. No payment made.');
  await checkWorkspace({ page, origin, fixture, capabilities, fits });
  assert.deepEqual(errors, [], 'Uncaught browser exceptions');
  console.log('Web UI regression checks passed. Screenshots: tmp/ui-review');
} finally {
  await browser.close();
}
