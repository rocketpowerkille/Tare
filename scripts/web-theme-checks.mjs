import assert from 'node:assert/strict';

export async function checkTheme({ page, origin, fits }) {
  const theme = () => page.locator('html').getAttribute('data-theme');
  await page.goto(origin);
  await page.evaluate(() => localStorage.removeItem('tare-theme'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.getByRole('button', { name: 'Switch to light mode' }).waitFor();
  assert.equal(await theme(), 'dark', 'New visitors get dark mode even on a light device');

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('tare-theme')), 'dark');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/explore', '/docs', '/developers']) {
      await page.goto(origin + route);
      await page.getByRole('button', { name: 'Switch to light mode' }).waitFor();
      assert.equal(await theme(), 'dark', 'Saved choice survives navigation');
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(17, 25, 21)');
      await fits(`dark ${route} at ${width}`);
      const toggle = await page.getByRole('button', { name: 'Switch to light mode' }).boundingBox();
      assert.ok(toggle && toggle.x >= 0 && toggle.x + toggle.width <= width, 'Theme toggle fits the viewport');
    }
  }
  await page.goto(origin + '/explore');
  await page.locator('#example').waitFor();
  await page.getByRole('button', { name: 'Replay example', exact: true }).click();
  await page.locator('.report-view').waitFor();
  await fits('dark recorded report at 320px');
  await page.screenshot({ path: 'tmp/ui-review/theme-dark-report-320.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin);
  await page.screenshot({ path: 'tmp/ui-review/theme-dark-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
  assert.equal(await theme(), 'light', 'Explicit light choice overrides a dark device');

  const isolated = await page.context().browser().newContext({ colorScheme: 'light' });
  try {
    await isolated.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    });
    const blocked = await isolated.newPage();
    await blocked.goto(origin);
    await blocked.getByRole('button', { name: 'Switch to light mode' }).click();
    await blocked.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
    assert.equal(await blocked.locator('html').getAttribute('data-theme'), 'light', 'Toggle works without storage');
  } finally {
    await isolated.close();
  }
  console.log('Theme checks passed: dark default, saved light preference, all routes, mobile reports and disabled storage.');
}
