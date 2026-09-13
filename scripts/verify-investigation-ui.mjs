// Local mock Recipe execution only. This is not hosted or paid acceptance.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createApiServer } from '../dist/apps/api/src/server.js';
import { InvestigationStore } from '../dist/apps/api/src/investigation-store.js';
import { answerSections } from '../dist/packages/receipts/src/investigation.js';
import { ServiceError } from '../dist/packages/service/src/requests.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TARE_PLAYWRIGHT_MODULE || 'playwright');
const store = new InvestigationStore();
let calls = 0;
const server = createApiServer(undefined, undefined, { recipe: 'local-test-only', store, executor: {
  async execute(_handle, question) {
    calls++;
    if (question.includes('Source unavailable')) throw new ServiceError(402, 'payment', 'Payment required. No payment was authorized or retried.');
    const reference = question.match(/reference ([a-f0-9]{48})/)[1];
    const first = store.read(reference, 0);
    for (let page = 1; page < first.pages; page++) store.read(reference, page);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { output: { sections: answerSections.map(title => ({ title, text: 'Saved accounting evidence does not establish independent backing.', citations: ['current.limitations'] })) }, gateway: 'https://fixture.bazgateway.com', elapsedMs: 300, payment: 'not-requested' };
  },
} });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => assert.ok(!new URL(request.url()).hostname.endsWith('bazgateway.com'), 'Browser must never call Bazantic directly'));
  await page.goto(origin + '/explore');
  assert.equal(await page.getByRole('heading', { name: 'Ask about this report' }).count(), 0);
  await page.locator('#example').selectOption('steakhouse-usdc');
  await page.getByRole('button', { name: 'Replay example', exact: true }).click();
  await page.getByRole('heading', { name: 'Ask about this report' }).waitFor();
  const button = page.getByRole('button', { name: 'Ask with Bazantic', exact: true });
  assert.equal(await button.isDisabled(), true);
  assert.equal(calls, 0);
  await page.getByRole('checkbox', { name: /Send this report/ }).check();
  await button.focus(); await page.keyboard.press('Enter');
  await page.getByText('AI explanation based on Tare evidence', { exact: true }).waitFor();
  assert.equal(calls, 1);
  assert.equal(await page.locator('.assistant-answer h4').count(), 7);
  await button.click();
  await page.getByText('AI explanation based on Tare evidence', { exact: true }).waitFor();
  assert.equal(calls, 1, 'Same question/snapshot must not execute twice');
  await page.locator('.assistant-citations a').first().click();
  assert.equal(await page.locator('.assistant-facts').getAttribute('open'), '');
  await page.getByText('Full JSON report', { exact: true }).click();
  assert.ok(await page.getByRole('button', { name: 'Download report', exact: true }).isVisible());
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download capture', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'tare-capture.json');
  await page.locator('.explain-report > summary').click();
  await page.getByRole('button', { name: 'Copy explanation context', exact: true }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /saved-evidence/);
  await page.locator('.assistant-facts > summary').click();
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
    if (width === 1280 || width === 390) {
      await mkdir('tmp/ui-review', { recursive: true });
      await page.locator('.investigation-assistant').last().screenshot({ path: `tmp/ui-review/investigation-${width}.png` });
    }
  }
  await page.getByLabel('Your question', { exact: true }).fill('Source unavailable');
  await button.click();
  await page.getByText('Payment required. No payment was authorized or retried.', { exact: true }).waitFor();
  assert.equal(await page.locator('.assistant-answer h4').count(), 0);
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.deepEqual(errors, []);
  console.log('Investigation UI: consent, pinned context, cited answer, idempotency, missing-payment state, copy, downloads, keyboard and 4 responsive widths passed. Mock Recipe only.');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
