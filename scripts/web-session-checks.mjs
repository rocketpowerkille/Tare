import assert from 'node:assert/strict';

// Isolated browser responses: exercises persistence, not real token validity.
export async function checkSession({ browser, origin, capabilities }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let token = 'fixture-access-code-not-a-real-credential';
  let status = 200;
  let received = '';
  await context.route('**/api/status', route => {
    received = route.request().headers().authorization ?? '';
    return route.fulfill(received === `Bearer ${token}` && status === 200
      ? { json: capabilities }
      : { status: status === 503 ? 503 : 401, json: { error: { message: 'Fixture access unavailable.' } } });
  });
  try {
    await page.goto(origin + '/explore');
    await page.locator('#access-token').fill(token);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.locator('#owner').waitFor();
    await page.reload();
    await page.locator('#owner').waitFor();
    assert.equal(received, `Bearer ${token}`);
    assert.equal(await page.locator('#access-token').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes(token));
    assert.equal(await page.evaluate(() => localStorage.getItem('tare-access-session')), null);

    assert.equal(await page.locator('.change-investigator').count(), 0, 'Explorer contains only the single-position workflow');
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    assert.deepEqual((await navigation.getByRole('link').allTextContents()).slice(0, 2), ['Explorer', 'Investigate']);
    await navigation.getByRole('link', { name: 'Investigate', exact: true }).click();
    await page.locator('.change-investigator').waitFor();
    assert.equal(await page.locator('#example').count(), 0);
    assert.equal(await navigation.getByRole('link', { name: 'Investigate', exact: true }).getAttribute('aria-current'), 'page');
    await page.reload();
    await page.locator('.change-investigator').waitFor();
    assert.equal(received, `Bearer ${token}`, 'Investigate restores the same accepted session');
    assert.equal(await page.locator('#access-token').count(), 0);
    const disconnect = page.getByRole('button', { name: 'Disconnect session', exact: true });
    await disconnect.focus();
    await page.keyboard.press('Enter');
    await page.locator('#access-token').waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('tare-access-session')), null);
    assert.equal(received, '', 'Disconnect reloads without sending the old permanent key');
    assert.equal(await page.locator('.change-investigator').count(), 0, 'Old authenticated workspace is removed');
    assert.equal(await disconnect.count(), 0);
    await page.reload();
    await page.locator('#access-token').waitFor();
    assert.equal(received, '', 'Refreshing after disconnect does not restore the credential');
    token = 'tare_sandbox_v1.Zml4dHVyZQ.fixture-signature';
    await page.locator('#access-token').fill(token);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.locator('.change-investigator').waitFor();
    assert.equal(received, `Bearer ${token}`, 'A different session can connect after disconnect');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Explorer', exact: true }).click();
    await page.locator('#owner').waitFor();

    status = 503;
    await page.reload();
    await page.getByRole('button', { name: 'Retry connection' }).waitFor();
    status = 200;
    await page.getByRole('button', { name: 'Retry connection' }).click();
    await page.locator('#owner').waitFor();
    assert.equal(received, `Bearer ${token}`, 'Temporary outages retain the accepted session');

    await page.getByRole('button', { name: 'Disconnect session', exact: true }).click();
    await page.locator('#access-token').waitFor();
    assert.equal(received, '', 'Explorer also disconnects a sandbox session');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('tare-access-session')), null);
    await page.locator('#access-token').fill(token);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.locator('#owner').waitFor();

    status = 401;
    await page.reload();
    await page.locator('#access-token').waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('tare-access-session')), null);
    await page.reload();
    await page.locator('#access-token').waitFor();
    assert.equal(received, '', 'Rejected credentials are not restored again');

    status = 200;
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
      Storage.prototype.getItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    });
    await page.locator('#access-token').fill(token);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.locator('#owner').waitFor();
    await page.getByRole('button', { name: 'Disconnect session', exact: true }).click();
    await page.locator('#access-token').waitFor();
    assert.equal(received, '', 'In-memory credentials are dropped when storage is disabled');
    console.log('Session persistence: refresh, revalidation, outage retry, rejection cleanup, keyboard disconnect, key switching and disabled storage passed. Fixtures only.');
  } finally { await context.close(); }
}
