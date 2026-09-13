import test from 'node:test';
import assert from 'node:assert/strict';
import { EulerDiscovery, EULER_API } from '../packages/sources/src/euler.js';
import { TareService, configFromEnv } from '../packages/service/src/index.js';
import { withServer, json } from './helpers/http.js';

const owner = `0x${'11'.repeat(20)}`;
const vault = `0x${'22'.repeat(20)}`;
const asset = `0x${'33'.repeat(20)}`;
const timestamp = '2026-09-13T00:00:00.000Z';
const position = (chainId: number) => ({ chainId, account: owner, vault, vaultType: 'evk', asset,
  shares: '100000000000000000001', assets: '250', borrowed: null });
const metadata = (chainId: number) => ({ chainId, address: vault, name: 'Fixture Euler vault', type: 'evk', deprecated: false,
  asset: { address: asset, symbol: 'USDC', decimals: 6 } });
const page = (data: unknown[], hasMore = false) => ({ data, meta: { timestamp, hasMore, offset: 0, limit: 100 } });

test('Euler discovers direct supply positions on three chains without converting raw units or unknown debt', async () => {
  await withServer((_body, response, request) => {
    const url = new URL(request.url!, 'http://fixture');
    if (url.pathname.includes('/accounts/')) {
      assert.equal(url.searchParams.get('chainId'), '1,8453,42161');
      assert.equal(url.searchParams.get('forceFresh'), null);
      return json(response, page([1, 8453, 42161].map(position)));
    }
    json(response, { [vault]: metadata(Number(url.searchParams.get('chainId'))), countryCode: 'XX', is_vpn: 'false' });
  }, async url => {
    const result = await new EulerDiscovery(url, url + '/metadata').positions(owner);
    assert.deepEqual(result.positions.map(item => item.chainId), [1, 8453, 42161]);
    assert.equal(result.positions[0]?.reportedSharesRaw, '100000000000000000001');
    assert.equal(result.positions[0]?.reportedBorrowedRaw, null);
    assert.deepEqual(result.issues, []);
  });
});

test('Euler reports bounded, missing, deprecated and subaccount coverage instead of an empty complete wallet', async () => {
  let mode = 'missing';
  await withServer((_body, response, request) => {
    if (request.url!.includes('/accounts/')) return json(response, page([
      position(1), { ...position(8453), account: `0x${'44'.repeat(20)}` },
      { ...position(42161), vaultType: 'securitize' },
    ], true));
    json(response, { [vault]: mode === 'missing' ? null : { ...metadata(1), deprecated: true } });
  }, async url => {
    const discovery = new EulerDiscovery(url, url + '/metadata');
    const missing = await discovery.positions(owner);
    assert.equal(missing.positions.length, 0);
    for (const issue of ['euler-limit', 'euler-subaccount-omitted', 'euler-vault-type-unsupported', 'euler-metadata-unavailable']) {
      assert.ok(missing.issues.includes(issue));
    }
    mode = 'deprecated';
    assert.ok((await discovery.positions(owner)).issues.includes('euler-deprecated-vault-omitted'));
  });
});

test('Euler rejects malformed amounts, pagination and cross-chain metadata; it never trusts display labels alone', async () => {
  let body: unknown = page([{ ...position(1), shares: 100 }]);
  await withServer((_body, response, request) => json(response, request.url!.includes('/accounts/') ? body : { [vault]: metadata(8453) }), async url => {
    const source = new EulerDiscovery(url, url + '/metadata');
    await assert.rejects(source.positions(owner), /schema changed/);
    body = { data: [position(1)], meta: { timestamp } };
    await assert.rejects(source.positions(owner), /schema changed/);
    body = page([position(1)]);
    const result = await source.positions(owner);
    assert.equal(result.positions.length, 0);
    assert.ok(result.issues.includes('euler-metadata-unavailable'));
  });
});

test('service routes Euler candidates by chain, marks missing RPCs and keeps source outages partial', async () => {
  let unavailable = false;
  await withServer((_body, response, request) => {
    if (request.method === 'POST') return json(response, { data: { userByAddress: null } });
    if (request.url!.includes('/accounts/')) {
      if (unavailable) { response.writeHead(503); response.end(); return; }
      return json(response, page([1, 8453, 42161].map(position)));
    }
    const chain = Number(new URL(request.url!, 'http://fixture').searchParams.get('chainId'));
    json(response, { [vault]: metadata(chain) });
  }, async url => {
    const service = new TareService({ morphoUrl: url, eulerUrl: url, eulerMetadataUrl: url + '/metadata', baseMainnetRpcUrl: url, arbitrumRpcUrl: url });
    const result = await service.run('discover', { owner, maxPositions: 2 }) as {
      positions: Array<{ chainId: number; support: { status: string; operation?: string } }>; complete: boolean; issues: string[];
    };
    assert.equal(result.positions.length, 2);
    assert.equal(result.complete, false);
    assert.ok(result.issues.includes('limit'));
    assert.equal(result.positions[0]?.support.status, 'unsupported');
    assert.equal(result.positions[1]?.chainId, 8453);
    assert.equal(result.positions[1]?.support.operation, 'resolve-erc4626');
    unavailable = true;
    const failed = await service.run('discover', { owner }) as { complete: boolean; issues: string[] };
    assert.equal(failed.complete, false);
    assert.ok(failed.issues.includes('euler-unavailable'));
  });
  assert.equal(configFromEnv({}).eulerUrl, EULER_API);
  assert.equal(configFromEnv({ TARE_EULER_DISCOVERY: 'false' }).eulerUrl, undefined);
  assert.throws(() => configFromEnv({ TARE_EULER_DISCOVERY: 'maybe' }), /true or false/);
});
