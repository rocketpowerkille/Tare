import assert from 'node:assert/strict';

// Local UI checks only. Do not execute the displayed CLI commands or pay for access.
export async function checkDocs({ page, origin, fits }) {
  await page.goto(origin + '/docs');
  assert.equal(await page.locator('#workspaces a[href="/explore"]').count(), 1);
  assert.equal(await page.locator('#workspaces a[href="/investigate"]').count(), 1);
  assert.equal(await page.locator('#workspaces a[href="/examples"]').count(), 1);
  assert.match(await page.locator('#access').innerText(), /not a ten-analysis limit/);
  for (const link of await page.locator('.docs-nav a').all()) {
    const href = await link.getAttribute('href');
    assert.equal(await page.locator(href).count(), 1, `Missing documentation section ${href}`);
  }
  await page.locator('.docs-nav a[href="#assistant"]').click();
  assert.match(await page.locator('#assistant').innerText(), /not a factual correctness audit/);
  assert.match(await page.locator('#assistant').innerText(), /10 minutes/);
  await page.locator('#faq details').filter({ hasText: 'What does Chainlink price per unit mean?' }).locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#faq details[open]').count(), 1);

  await page.goto(origin + '/developers');
  const spec = await (await page.request.get(origin + '/openapi.json')).json();
  const expected = Object.entries(spec.paths).flatMap(([path, methods]) => Object.keys(methods)
    .filter(method => ['get', 'post'].includes(method)).map(method => `${method.toUpperCase()} ${path}`)).sort();
  const rows = await page.locator('.endpoint-row:not(.endpoint-head)').evaluateAll(elements => elements
    .map(element => [...element.querySelectorAll('code')].map(code => code.textContent).join(' ')).sort());
  assert.deepEqual(rows, expected);
  await page.locator('.code-block').first().getByRole('button').click();
  const command = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(command, /https:\/\/tare.visk404.dev\/api\/agent-example/);
  assert.match(command, /"id": "steakhouse-usdc"/);
  await page.getByRole('button', { name: 'Copy install command', exact: true }).click();
  assert.match(await page.locator('.bazantic-guide').innerText(), /at most 10 session purchases/);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'npm i -g @bazantic/cli@latest');
  await page.getByRole('button', { name: 'Copy login command', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'baz login');
  await page.getByRole('button', { name: 'Copy token-only command', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /node --input-type=module/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(`developer setup expanded at ${width}`);
  }
  for (const path of ['/openapi.json', '/openapi-mcp.json', '/openapi-mcp-v2.json', '/openapi-mcp-v3.json', '/openapi-graph.json']) {
    const response = await page.request.get(origin + path);
    assert.equal(response.status(), 200);
    assert.ok((await response.json()).paths);
  }
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied in fixture'); }; });
  await page.locator('.code-block').first().getByRole('button').click();
  await page.locator('.code-block').first().getByRole('alert').waitFor();
  assert.match(await page.locator('.code-block').first().getByRole('alert').innerText(), /Select and copy/);
  console.log('Documentation sections, endpoint inventory, examples, shared setup commands and expanded mobile layout passed. No external calls made.');
}
