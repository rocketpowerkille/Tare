# Tare interface redesign

The redesign changes presentation and client-side progress observation. API routes,
request bodies, report formats, calculations, payment settlement and access checks
remain unchanged. Graph deployment and the CRE workflow are not modified.

## Evidence boundaries

- Progress changes on actual request starts and responses. Position tracing is one
  API response, so its internal steps are never simulated with timers.
- Graph composition can use a different block from the primary position. Both
  blocks are displayed, with an explicit warning when they differ.
- Shares are shown in raw units when share decimals are not supplied. Derived asset
  quotes and market-priced values have separate labels. Display formatting uses
  strings, not floating-point conversion, and marks truncated values with ≈.
- USD presentation requires returned price provenance. An accepted session is only
  authorization evidence. Settlement receipts are not recoverable from session
  tokens, and the UI says so.
- Evidence IDs are existing capture digests. No new report persistence or public
  permalink endpoint was added. Existing JSON and capture downloads remain available.
- The position diagram uses returned V1, nested V2 and ERC-4626 evidence only.
  Unresolved adapters, zero allocations and missing backing remain explicit.

## Validation

Run `node --run verify` for the existing build, API, resolver and replay tests.
Run `node --run test:web` for presentation and timeline regression tests.

For browser regression tests, start the local application with `node --run serve`.
Run `node --run test:web:browser` with Playwright installed. The optional
`TARE_PLAYWRIGHT_MODULE` environment variable can point to an existing Playwright
package. `TARE_BROWSER_CHANNEL=chrome` uses installed Chrome; omit it for Playwright's
Chromium. `TARE_UI_ORIGIN` defaults to `http://127.0.0.1:4318`.

The browser suite checks four application routes at five viewport widths, recorded
examples, input validation, keyboard node selection, copy controls, downloads,
capture replay, source outages, pricing, different-block warnings and expired or
invalid access. Its simulated discovery, pricing and authentication responses are
UI fixtures, not live provider or payment acceptance. Screenshots are generated in
the ignored `tmp/ui-review` directory.

No mainnet transaction, new payment, deployment or commit is part of this redesign.
