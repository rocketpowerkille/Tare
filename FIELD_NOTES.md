# Field notes

## 2026-09-09 — phase two

- Baseline: 18 tests and all four legacy demos passed before implementation.
- No new dependencies or live endpoints were required.
- Schema 2 lives alongside schema 1; legacy IDs are not migrated into invented
  contract identities.
- The earlier receipts ignore issue was already fixed: `/receipts/` ignores root
  exports while `packages/receipts/` remains tracked.
- Restored scope and field-notes documents referenced by the README.
- New adapter recordings are explicitly synthetic; no real protocol recording was
  available within this phase. None of their addresses or block data are live claims.
- No real wallet profile was created or changed. Tests use temporary public-address
  profiles only.
- Final local validation: strict TypeScript build, 35 tests and all 10 demo cases
  pass. CI uses the same verify script; remote CI was not run in this task.
