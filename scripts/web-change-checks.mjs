import assert from 'node:assert/strict';

// UI-only fixtures. No provider or Bazantic execution is performed.
export async function checkChanges({ page, origin, fixture, capabilities, fits }) {
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ json: capabilities }));
  await page.route('**/api/investigation/options', route => route.fulfill({ json: { enabled: false } }));
  const previous = structuredClone(fixture);
  previous.capture.block.number = '20'; previous.capture.block.hash = `0x${'1'.repeat(64)}`;
  const current = structuredClone(previous);
  current.capture.block.number = '21'; current.capture.block.hash = `0x${'2'.repeat(64)}`;
  current.vault.sharesRaw = (BigInt(previous.vault.sharesRaw) + 1n).toString();
  current.markets.reverse();
  const calls = [];
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', route => {
    const input = route.request().postDataJSON(); calls.push(input);
    if (input.operation === 'verify-accounting') return route.fulfill({ status: 503, json: { error: { message: 'Fixture indexed history unavailable.' } } });
    return route.fulfill({ json: input.blockNumber === '20' ? previous : current });
  });
  await page.goto(origin + '/investigate');
  const panel = page.locator('.change-investigator');
  const tools = page.getByRole('tablist', { name: 'Choose an investigation' });
  await page.getByLabel('Public wallet address', { exact: true }).fill(previous.owner);
  assert.equal(await panel.isVisible(), false, 'Only the selected investigation is visible');
  assert.equal(calls.length, 0, 'Opening the workspace must not acquire evidence');
  await tools.getByRole('tab', { name: /Wallet overview/ }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tools.getByRole('tab', { name: /Changes over time/ }).getAttribute('aria-selected'), 'true');
  await page.getByLabel('Change investigation wallet', { exact: true }).fill(previous.owner);
  await page.getByLabel('Change investigation vault', { exact: true }).fill(previous.vault.address);
  await page.getByLabel('Previous block', { exact: true }).fill('22');
  await page.getByLabel('Current block', { exact: true }).fill('21');
  await page.getByRole('button', { name: 'Compare pinned blocks', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: 'must be earlier' }).waitFor();
  assert.equal(calls.length, 0);
  await page.getByLabel('Previous block', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Compare pinned blocks', exact: true }).click();
  await panel.locator('.change-report').waitFor();
  assert.deepEqual(calls.map(call => [call.operation, call.blockNumber]), [['resolve-v1', '20'], ['verify-accounting', '20'], ['resolve-v1', '21'], ['verify-accounting', '21']]);
  assert.match(await panel.locator('.change-report').innerText(), /1 changed field/);
  assert.match(await panel.locator('.change-progress').innerText(), /unavailable/);
  const detail = panel.locator('.change-timeline summary').first();
  await detail.focus(); await page.keyboard.press('Enter');
  assert.match(await panel.locator('.change-timeline').innerText(), /vault share raw units/);
  assert.match(await panel.locator('.change-timeline').innerText(), /Δ 1 raw/);
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download comparison', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'tare-position-changes.json');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel.locator('.change-report').screenshot({ path: new URL('../tmp/ui-review/changes-desktop.png', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '') });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await fits(`change investigator ${width}`);
  }
  await page.getByLabel('Evidence input', { exact: true }).selectOption('saved');
  const file = value => ({ name: 'report.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.getByLabel('Previous saved report', { exact: true }).setInputFiles(file({ invalid: true }));
  await panel.getByRole('alert').waitFor();
  await page.getByLabel('Previous saved report', { exact: true }).setInputFiles(file(previous));
  await page.getByLabel('Current saved report', { exact: true }).setInputFiles(file(current));
  await panel.locator('.change-report').waitFor();
  assert.equal(calls.length, 4, 'Saved reports must not trigger acquisition');
  assert.match(await panel.innerText(), /No new blockchain requests/);
  assert.match(await panel.locator('.change-report').innerText(), /Original source mode \(as reported\)/);
  await fits('saved comparison at 320px');

  const second = structuredClone(previous);
  second.vault.address = `0x${'7'.repeat(40)}`; second.capture.vault = second.vault.address;
  await page.route('**/api/investigation/wallet', route => route.fulfill({ json: {
    reportType: 'wallet-investigation', owner: previous.owner, results: [previous, second].map(report => ({ vault: report.vault.address, report, status: 'complete' })),
  } }));
  const wallet = page.locator('.wallet-investigation');
  await tools.getByRole('tab', { name: /Wallet overview/ }).click();
  assert.equal(await page.getByLabel('Public wallet address', { exact: true }).inputValue(), previous.owner, 'Switching tools preserves input');
  await page.getByRole('button', { name: 'Investigate wallet', exact: true }).click();
  await wallet.locator('.exposure-overlap').waitFor();
  await wallet.locator('.exposure-overlap > details > summary').first().focus(); await page.keyboard.press('Enter');
  assert.match(await wallet.locator('.exposure-overlap').innerText(), /Derived total/);
  assert.match(await wallet.locator('.exposure-overlap').innerText(), /dependencies, not holdings/);
  await fits('expanded exposure overlap at 320px');
  await wallet.locator('.exposure-overlap').screenshot({ path: new URL('../tmp/ui-review/overlap-mobile.png', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '') });
  await tools.getByRole('tab', { name: /Changes over time/ }).click();
  await panel.locator('.change-report').waitFor();
  assert.equal(await wallet.isVisible(), false);
  await tools.getByRole('tab', { name: /Changes over time/ }).focus();
  await page.keyboard.press('Home');
  await wallet.locator('.exposure-overlap').waitFor();
  assert.equal(calls.length, 4, 'Switching tools preserves reports without new acquisition');
  await page.unroute('**/api/investigation/options');
  await page.unroute('**/api/investigation/wallet');
  console.log('Bounded changes: pinned requests, validation, missing Graph, raw deltas, uploads, downloads, overlap, keyboard and responsive checks passed (fixtures only).');
}
