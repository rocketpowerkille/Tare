# Explorer workspace refinement

## Implemented

- Access-code-first authentication, with a collapsible developer/testnet setup guide.
- Four-step, explicitly self-reported Bazantic checklist. Copying a command does not mark a payment successful.
- Connection status tied to access-configuration and capabilities requests, with validation, retry and error states.
- Accepted sandbox session card with copyable session ID, network, issued timestamp and expiry.
- Partial position path rendered as soon as the primary response arrives, while partner checks are pending.
- Request timeline with distinct errors and unavailable/not-checked states. Primary response events include block numbers when returned.
- Source cards distinguish technical request errors from service unavailability and avoid implying missing evidence supports a conclusion.
- Prices identify the underlying asset instead of saying “per unit”; missing prices say “USD estimate unavailable.”
- Automatic discovery is unchanged. Manual check network selection is under Advanced options.
- Report section navigation, explicit top-level limitations wording and richer selectable path nodes.
- Existing copy controls, downloads, raw JSON, accessible text outline and reduced-motion support retained.

## Boundaries and assumptions

The existing code remains the authority for supported networks, operations, price adapters and evidence classifications. No API endpoint, payload, payment command, authentication rule or backend evidence methodology was changed. The homepage is unchanged.

There is no safe public demo-session issuer exposed to this UI, so no demo-login shortcut was added. Recorded examples remain available through the existing authorized workspace.

The access-options response describes gateway configuration, not live Bazantic gateway health. The connection tracker says this explicitly. Grant creation and gateway calls happen outside this browser tab, so their checklist states are user-confirmed, not remotely verified.

The accepted token exposes session claims, but not payment amount, asset or settlement receipt. The UI does not infer those values from the advertised price. The original Bazantic purchase response remains the payment receipt.

The analysis API does not stream individual vault-tracing steps. Those stages update when the primary response arrives. The early diagram is labeled as a partial response, not a final report.

No persistent report/link service is exposed. Existing JSON report downloads are retained; no fake share link or report ID was created. Capture digests remain the available reproducibility identifier.

## Validation

- `node --run verify`: passed, including 141 existing Node tests, builds and CLI replay/demo checks.
- `node --test tests/web-display.test.mjs`: 7 tests passed, including error versus unavailable progress states.
- Chrome browser suite: all four UI routes at 1440, 1024, 768, 390 and 320px, without page overflow.
- Three recorded examples, valid/invalid capture upload, downloads, keyboard node selection and address copying.
- Isolated fixtures for invalid/expired/blank credentials, accepted sandbox claims, delayed connection, service outage/retry, delayed partner response with partial diagram, Graph technical error, Chainlink timeout and pricing provenance.
- Setup checklist and clipboard success; raw JSON, limitations navigation, text outline and reduced-motion behavior.
- Screenshot review of access and report layouts. Screenshots remain under ignored `tmp/ui-review/`.

Browser fixtures are UI tests, not new live Graph, Chainlink or Bazantic acceptance. No paid call was made. No commit, deployment or environment-variable change was performed.

## Changed files

- `apps/web/src/components/BazanticAccessGuide.tsx`
- `apps/web/src/components/explorer/AccessPanel.tsx`
- `apps/web/src/components/explorer/ConnectionTimeline.tsx` (new)
- `apps/web/src/components/explorer/EvidenceSources.tsx`
- `apps/web/src/components/explorer/EvidenceTimeline.tsx`
- `apps/web/src/components/explorer/OperationForm.tsx`
- `apps/web/src/components/explorer/PositionDiagram.tsx`
- `apps/web/src/components/explorer/ReportView.tsx`
- `apps/web/src/components/explorer/SessionEvidence.tsx`
- `apps/web/src/components/explorer/ValueConversion.tsx`
- `apps/web/src/lib/comprehensive.ts`
- `apps/web/src/lib/progress.ts`
- `apps/web/src/pages/ExplorerPage.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/src/styles/access-workspace.css` (new)
- `scripts/verify-web-ui.mjs`
- `scripts/web-workspace-checks.mjs` (new)
- `tests/web-display.test.mjs`
- `docs/explorer-workspace-update.md` (new)
