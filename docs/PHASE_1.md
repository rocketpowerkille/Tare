# Phase one — offline CLI

The September 7 user direction supersedes the live-first sequencing in the original
implementation plan: finish the CLI first and defer all on-chain integration.

## Implementation order

1. Establish strict TypeScript, module boundaries, validation schemas, and deterministic fixtures.
2. Implement raw-integer proportional attribution, active-path cycle detection, traversal budgets, and partial results.
3. Add local watch-only wallet profiles with address/network validation. The user chose MetaMask and will configure their public address later.
4. Expose snapshot validation, resolution, demo, wallet, and receipt-export commands.
5. Test positive and negative paths, document accounting limits, and run the CLI demos. This is the phase boundary.

## Acceptance criteria

- Clean TypeScript build and meaningful deterministic tests pass.
- All four demo commands run without credentials or network access.
- Cycles and missing observations yield typed partial results.
- Shared descendants are not mistaken for cycles.
- Every attribution step records integer rounding.
- Complete and partial receipts are distinct validated types; neither claims independently verified backing.
- Wallet profiles can be added, listed, loaded, and removed locally.
- A wallet-bound resolution rejects owner or network mismatches.
- CLI reports partial results with exit code 2 and exports versioned JSON without clobbering files.
- No Graph client, RPC provider, signing path, deployment, or transaction is introduced.

Phase one does not require the user to supply a real address. The wallet workflow is
tested using a clearly synthetic identity, and no user profile is created by default.

## Subsequent work — deferred

After this milestone, revisit live-source feasibility, protocol allocation adapters,
block-pinned Graph/RPC reconciliation, and metric eligibility. These require a new
integration phase; the offline proportional allocation model must not be relabeled
as live ERC-4626 conversion. API, MCP, web, monitoring, and sponsor integrations
follow the verified resolver. See the original implementation plan for the broader roadmap.
