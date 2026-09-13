import assert from 'node:assert/strict';

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
  await page.locator('.connection-timeline .stage-active').waitFor();
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
  assert.match(await page.locator('.source-cards').innerText(), /Technical error/);
  assert.match(await page.locator('.source-cards').innerText(), /Source unavailable/);
  await page.locator('.evidence-timeline > summary').click();
  assert.equal(await page.locator('.stage-error').count(), 1);
  await page.locator('.raw-report > summary').click();
  assert.equal(JSON.parse(await page.locator('.raw-report pre').innerText()).protocol, fixture.protocol);
  assert.match(await page.locator('.plain-summary').innerText(), /What this report does not establish/i);
  await page.locator('.report-sections').getByRole('link', { name: 'Limitations' }).click();
  assert.ok(new URL(page.url()).hash.endsWith('Limitations'));
  await fits('expanded report and raw JSON on mobile');
  console.log('Delayed connection, retry, blank credential, automatic network, partial path, source errors, raw JSON and reduced motion passed.');
}
