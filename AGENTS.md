# Repository engineering conventions

- Keep changes focused and reviewable. Separate feature work from unrelated
  refactors; preserve in-progress user changes. Do not commit unless requested.
- Organize modules by responsibility. CLI handlers coordinate input and output;
  sources acquire evidence; adapters implement protocol rules; resolvers and
  verification compare or calculate; receipt modules format results.
- Review handwritten files approaching 200–250 lines for mixed responsibilities.
  Split at a useful boundary, not at an arbitrary line count. Keep cohesive schemas
  or algorithms together when splitting would obscure their meaning.
- Prefer readable functions and descriptive names. Do not compress multiple
  statements, complex conditions or nested async work into single lines to make
  files look smaller. Avoid speculative frameworks and trivial wrapper modules.
- Reuse existing argument parsing and test HTTP/CLI helpers. Keep pure comparison
  logic separate from acquisition so live runs, validation and replay share it.
- During refactors preserve CLI behavior, public exports, evidence formats,
  normalization order, integer rounding and failure semantics.
- Keep generated Graph bindings, WASM builds and dependencies out of Git. Retain
  lockfiles and original evidence fixtures for reproducibility; distinguish their
  line counts from handwritten code when reporting change size.
- Run `node --run verify` after behavioral or structural TypeScript changes. Run
  `node --run build:subgraph` when mappings, manifests, schemas or Graph tooling
  change. Existing tests should move with their responsibility, not be duplicated.
- Keep Graph deployment deferred until the user resumes that work. Never convert
  local mocks or replay results into claims of live source verification.
