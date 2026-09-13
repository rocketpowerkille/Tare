import assert from 'node:assert/strict';

// Synthetic browser responses, never live provider acceptance.
export async function checkMultichainValuation({ page, origin, fixture, capabilities, fits }) {
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  await page.unroute('**/api/discover');
  const asset = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  await page.route('**/api/discover', route => route.fulfill({ json: { source: 'multi-protocol', issues: [], positions: [{
    owner: fixture.owner, vault: fixture.vault.address, chainId: 8453, name: 'Base ERC-4626 fixture',
    protocol: 'euler', version: 'erc4626', network: 'Base', asset: { symbol: 'USDC' },
    support: { status: 'supported', operation: 'resolve-erc4626', checkType: 'Supply accounting only' },
  }] } }));
  const block = { number: '0x64', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x20000' };
  const primary = { schemaVersion: 1, protocol: 'erc4626', sourceMode: 'live-rpc', chainId: 8453,
    owner: fixture.owner, kind: 'complete', status: 'complete', scope: 'erc4626-share-conversion',
    verification: 'onchain-accounting-only', capture: { block, blockConfirmed: true, capturedAt: '2026-09-13T00:00:00.000Z' },
    position: { vault: fixture.vault.address, vaultName: 'Base ERC-4626 fixture', asset, assetSymbol: 'USDC',
      decimals: 6, sharesRaw: '999197', assetsRaw: '1018718', totalSupplyRaw: '600005217544', totalAssetsRaw: '611727535043' },
    metric: { kind: 'unavailable', reasons: ['No independent backing evidence'] }, findings: [],
    limitations: ['Conversion is not proof of backing or redeemability. Euler downstream allocations are not traced.'] };
  let failPrice = false;
  let priceCalls = 0;
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', route => {
    const request = route.request().postDataJSON();
    if (request.operation === 'resolve-erc4626') return route.fulfill({ json: primary });
    assert.equal(request.operation, 'value-position', 'No Graph comparison is invented for Base Euler');
    assert.deepEqual(request, { operation: 'value-position', chainId: 8453, asset, amountRaw: '1018718',
      assetDecimals: 6, blockNumber: '100', blockHash: block.hash });
    priceCalls++;
    if (failPrice) return route.fulfill({ status: 503, json: { error: { message: 'Fixture: stale Chainlink price.' } } });
    return route.fulfill({ json: { reportType: 'chainlink-position-valuation', sourceMode: 'live-rpc', status: 'complete',
      chainId: 8453, asset, assetSymbol: 'USDC', capture: { block, confirmed: true },
      price: { feed: '0x7e860098f58bbfc8648a4311b374b1d669a2bc6b', chainId: 8453, answerRaw: '99999999',
        decimals: 8, updatedAt: '131071', roundId: '2', blockHash: block.hash },
      value: { valueRaw: '101871798', decimals: 8, currency: 'USD' },
      sequencer: { status: 'up', gracePeriodSeconds: 3600, feed: '0xbcf85224fc0756b9fa45aa7892530b47e10b6433' },
      limitations: ['Reference price is not backing evidence.'] } });
  });
  await page.goto(origin + '/explore');
  await page.locator('#owner').fill(fixture.owner);
  await page.getByRole('button', { name: 'Find my vaults', exact: true }).click();
  await page.getByRole('button', { name: /Base ERC-4626 fixture/ }).click();
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.locator('.composed-report').waitFor();
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  await page.locator('.price-provenance').waitFor();
  assert.match(await page.locator('.value-conversion').innerText(), /Market-priced/i);
  await page.getByRole('tab', { name: 'Source checks', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.source-cards').innerText(), /3600-second recovery grace passed/);
  assert.match(await page.locator('.source-cards').innerText(), /not.*backing/i);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(`Base price and sequencer source card ${width}`);
  }
  await page.getByRole('tab', { name: 'Raw JSON', exact: true }).click();
  assert.equal(JSON.parse(await page.locator('.raw-report pre').innerText()).protocol, 'erc4626');
  failPrice = true;
  await page.getByRole('button', { name: 'Run evidence check' }).click();
  await page.getByRole('tab', { name: 'Source checks', exact: true }).click();
  await page.locator('.source-cards').getByText('Fixture: stale Chainlink price.', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  assert.match(await page.locator('.value-conversion').innerText(), /USD estimate unavailable/);
  assert.equal(await page.locator('.price-provenance').count(), 0, 'Previous successful estimate must not survive a failed run');
  assert.equal(priceCalls, 2, 'No automatic price retry');
  console.log('Base ERC-4626 pricing pins identity; sequencer scope, unavailable estimate, keyboard and mobile layouts passed (fixtures only).');
}
