import assert from 'node:assert/strict';

// Authored responses: UI routing and scope checks, not live vault evidence.
export async function checkV2Accounting({ page, origin, fixture, capabilities, fits }) {
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  await page.unroute('**/api/discover');
  await page.route('**/api/discover', route => route.fulfill({ json: { source: 'morpho-graphql', issues: [], positions: [{
    owner: fixture.owner, vault: fixture.vault.address, chainId: 1, name: 'V2 WETH fixture',
    protocol: 'morpho', version: 'v2', network: 'Ethereum', asset: { symbol: 'WETH' },
    support: { status: 'supported', operation: 'resolve-erc4626',
      checkType: 'Accounting only: wallet shares and asset conversion quote. V2 strategy allocations are not traced.' },
  }] } }));
  await page.unroute('**/api/analyze');
  const calls = [];
  await page.route('**/api/analyze', route => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: { message: 'Fixture RPC unavailable.' } } });
  });
  await page.goto(origin + '/explore');
  await page.locator('#owner').fill(fixture.owner);
  await page.getByRole('button', { name: 'Find my vaults', exact: true }).click();
  const candidate = page.getByRole('button', { name: /V2 WETH fixture/ });
  assert.match(await candidate.innerText(), /Accounting only/);
  assert.match(await candidate.innerText(), /not traced/);
  await candidate.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('.activity-line').filter({ hasText: 'No result was produced' }).waitFor();
  assert.deepEqual(calls, [{ operation: 'resolve-erc4626', chainId: 1, owner: fixture.owner, vault: fixture.vault.address }]);
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(`V2 accounting-only discovery ${width}`);
  }
  console.log('V2 accounting-only selection, keyboard, RPC failure scope and responsive layout passed (fixtures only).');
}
