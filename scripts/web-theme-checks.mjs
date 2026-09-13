import assert from 'node:assert/strict';

function contrast(first, second) {
  const luminance = hex => {
    const value = hex.trim().replace('#', '');
    const expanded = value.length === 3 ? [...value].map(channel => channel + channel).join('') : value;
    const channels = expanded.match(/../g).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

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
    for (const route of ['/', '/explore', '/investigate', '/examples', '/docs', '/developers']) {
      await page.goto(origin + route);
      await page.getByRole('button', { name: 'Switch to light mode' }).waitFor();
      assert.equal(await theme(), 'dark', 'Saved choice survives navigation');
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(17, 25, 21)');
      await fits(`dark ${route} at ${width}`);
      const toggle = await page.getByRole('button', { name: 'Switch to light mode' }).boundingBox();
      assert.ok(toggle && toggle.x >= 0 && toggle.x + toggle.width <= width, 'Theme toggle fits the viewport');
    }
  }
  await page.goto(origin + '/examples');
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

  const palette = await page.locator('html').evaluate(element => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['ink', 'ink-soft', 'muted', 'canvas', 'surface', 'surface-subtle', 'line-strong', 'green', 'green-bright', 'on-primary', 'blue', 'blue-soft', 'amber', 'amber-soft', 'red', 'red-soft', 'green-soft']
      .map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
  });
  assert.equal(palette.canvas, '#e8ebe7');
  assert.equal(palette.surface, '#f3f5f1');
  for (const background of ['canvas', 'surface', 'surface-subtle']) {
    for (const foreground of ['ink', 'ink-soft', 'muted']) {
      assert.ok(contrast(palette[foreground], palette[background]) >= 4.5, `${foreground} on ${background} must remain readable`);
    }
  }
  for (const color of ['green', 'blue', 'amber', 'red']) {
    assert.ok(contrast(palette[color], palette[`${color}-soft`]) >= 4.5, `${color} status contrast`);
  }
  assert.ok(contrast(palette['line-strong'], palette.surface) >= 3, 'Input boundaries remain visible');
  assert.ok(contrast(palette['on-primary'], palette.green) >= 4.5);
  assert.ok(contrast(palette['on-primary'], palette['green-bright']) >= 4.5);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/explore', '/investigate', '/examples', '/docs', '/developers']) {
      await page.goto(origin + route);
      await page.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(232, 235, 231)');
      await fits(`soft light ${route} at ${width}`);
      if (route === '/' && width === 1440) await page.screenshot({ path: 'tmp/ui-review/theme-light-home.png', fullPage: true });
    }
  }
  await page.goto(origin + '/examples');
  await page.locator('#example').waitFor();
  await page.getByRole('button', { name: 'Replay example', exact: true }).click();
  await page.locator('.report-view').waitFor();
  await fits('soft light report at 320px');
  await page.screenshot({ path: 'tmp/ui-review/theme-light-report-320.png', fullPage: true });

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
  console.log('Theme checks passed: unchanged dark default, soft light palette and contrast, all routes in both themes, mobile reports and disabled storage.');
}
