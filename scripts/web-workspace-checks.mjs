import assert from 'node:assert/strict';

export async function checkEulerDiscovery({ page, origin, fixture, capabilities, fits }) {
  const eulerCapabilities = { ...capabilities, discoveryProtocols: ['morpho', 'euler'],
    networks: capabilities.networks.map(network => ({ ...network, erc4626: true })) };
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: eulerCapabilities }));
  await page.unroute('**/api/discover');
  await page.route('**/api/discover', route => route.fulfill({ json: {
    source: 'multi-protocol', complete: false, issues: ['euler-limit'], positions: [8453, 42161].map(chainId => ({
      owner: fixture.owner, vault: fixture.vault.address, chainId, name: `Euler fixture ${chainId}`, protocol: 'euler', version: 'erc4626',
      network: chainId === 8453 ? 'Base' : 'Arbitrum', asset: { symbol: 'USDC' },
      support: { status: 'supported', operation: 'resolve-erc4626', checkType: 'Supply accounting only' },
    })),
  } }));
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', route => route.fulfill({ status: 503, json: { error: { message: 'Fixture RPC unavailable.' } } }));
  await page.goto(origin + '/explore');
  await page.locator('#owner').fill(fixture.owner);
  await page.getByRole('button', { name: 'Find my vaults', exact: true }).click();
  for (const chainId of [8453, 42161]) {
    await page.getByRole('button', { name: new RegExp(`Euler fixture ${chainId}`) }).click();
    const request = page.waitForRequest(request => request.url().endsWith('/api/analyze'));
    await page.getByRole('button', { name: 'Run evidence check' }).click();
    const input = (await request).postDataJSON();
    assert.equal(input.operation, 'resolve-erc4626');
    assert.equal(input.chainId, chainId);
    await page.locator('.activity-line').filter({ hasText: 'No result was produced' }).waitFor();
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await fits('Euler multichain discovery');
  console.log('Euler candidates select Base/Arbitrum ERC-4626 requests; incomplete coverage and provider failures remain visible (fixtures only).');
}

// Isolated browser fixtures only. These are not live partner acceptance tests.
export async function checkWorkspace({ page, origin, fixture, capabilities, fits }) {
  await page.unroute('**/api/status');
  let releaseConnection;
  const connectionGate = new Promise(resolve => { releaseConnection = resolve; });
  await page.route('**/api/status', async route => {
    await connectionGate;
    return route.fulfill({ status: 401, json: { error: { message: 'Access required.' } } });
  });
  await page.goto(origin + '/explore');
  await page.locator('.connection-timeline .stage-active').filter({ hasText: 'Validating the access session' }).waitFor();
  assert.match(await page.locator('.connection-timeline').innerText(), /Validating the access session/);
  releaseConnection();
  await page.locator('#access-token').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Connect', exact: true }).isDisabled(), true);
  await page.locator('#access-token').fill('   ');
  assert.equal(await page.getByRole('button', { name: 'Connect', exact: true }).isDisabled(), true);
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ status: 503, json: { error: { message: 'Service temporarily unavailable.' } } }));
  await page.goto(origin + '/explore');
  await page.getByRole('button', { name: 'Retry connection' }).waitFor();
  assert.match(await page.locator('.connection-timeline .stage-error').innerText(), /could not be confirmed/);
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await page.locator('#owner').waitFor();

  await page.unroute('**/api/analyze');
  let releaseGraph;
  const graphGate = new Promise(resolve => { releaseGraph = resolve; });
  await page.route('**/api/analyze', async route => {
    const input = route.request().postDataJSON();
    if (input.operation === 'verify-graph-composition') {
      await graphGate;
      return route.fulfill({ status: 500, json: { error: { message: 'Fixture: unexpected source response.' } } });
    }
    if (input.operation === 'value-position') return route.fulfill({ status: 504, json: { error: { message: 'Fixture: price request timed out.' } } });
    return route.fulfill({ json: fixture });
  });
  await page.locator('#owner').fill(fixture.owner);
  await page.getByRole('button', { name: 'Find my vaults' }).click();
  await page.locator('.vault-option').first().click();
  assert.equal(await page.locator('#chain').isVisible(), false);
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('.partial-evidence .path-node').first().waitFor();
  assert.equal(await page.locator('.report-view').count(), 0);
  assert.match(await page.locator('.stage-active').innerText(), /The Graph/);
  assert.equal(await page.locator('.skeleton').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  await fits('partial position at mobile width');
  releaseGraph();
  await page.locator('.composed-report').waitFor();
  await page.getByRole('tab', { name: 'Source checks', exact: true }).click();
  assert.match(await page.locator('.source-cards').innerText(), /Technical error/);
  assert.match(await page.locator('.source-cards').innerText(), /Source unavailable/);
  await page.locator('.evidence-timeline > summary').click();
  assert.equal(await page.locator('.stage-error').count(), 1);
  await page.getByRole('tab', { name: 'Raw JSON', exact: true }).click();
  assert.equal(JSON.parse(await page.locator('.raw-report pre').innerText()).protocol, fixture.protocol);
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  assert.match(await page.locator('.plain-summary').innerText(), /What this report does not establish/i);
  const url = page.url();
  for (const name of ['Summary', 'Evidence path', 'Source checks', 'Ask about this report', 'Limitations', 'Raw JSON']) {
    await page.getByRole('tab', { name, exact: true }).click();
    assert.equal(await page.getByRole('tabpanel').count(), 1, 'Only the selected section is exposed');
    assert.equal(await page.getByRole('tabpanel', { name, exact: true }).isVisible(), true);
    assert.equal(page.url(), url, 'Tab changes do not navigate or change the URL');
    await fits(`report tab ${name}`);
  }
  await page.getByRole('tab', { name: 'Raw JSON', exact: true }).focus();
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('tab', { name: 'Summary', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('tab', { name: 'Evidence path', exact: true }).getAttribute('aria-selected'), 'true');
  await fits('expanded report and raw JSON on mobile');
  console.log('Delayed connection, retry, blank credential, automatic network, partial path, source errors, raw JSON and reduced motion passed.');
}
