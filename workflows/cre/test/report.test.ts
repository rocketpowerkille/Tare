import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { decodeAbiParameters } from 'viem';
import { encodeExit, EXIT_ABI } from '../src/report.js';
import { testnetEvidence, privatePolicy } from '../../../tests/helpers/policy.js';

const authorization = {
  enabled: true, receiver: `0x${'3'.repeat(40)}`, shares: '100', minAssets: '95', nonce: '1', validUntil: '1400',
};

test('TypeScript exit encoding matches the golden payload decoded by Solidity', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../../contracts/test/fixtures/exit-report.json', import.meta.url), 'utf8'));
  assert.equal(encodeExit(testnetEvidence, privatePolicy, 1000, authorization), fixture.payload);
});

test('exit encoding rejects missing consent, expired terms and unavailable backing', () => {
  for (const changed of [{ enabled: false }, { receiver: `0x${'0'.repeat(40)}` }, { shares: '0' },
    { minAssets: '0' }, { nonce: '0' }, { validUntil: '1000' }]) {
    assert.throws(() => encodeExit(testnetEvidence, privatePolicy, 1000, { ...authorization, ...changed }));
  }
  assert.throws(() => encodeExit({ ...testnetEvidence, backingVerified: false }, privatePolicy, 1000, authorization));
});

test('exit encoding refreshes report expiry beneath a longer permit ceiling', () => {
  const encoded = encodeExit(testnetEvidence, privatePolicy, 1000, { ...authorization, validUntil: '5000' });
  assert.equal(decodeAbiParameters(EXIT_ABI, encoded)[7], 1600n);
});
