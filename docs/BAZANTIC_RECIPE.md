# Bazantic Recipe — draft for later registration

Status: registration and execution deferred at the user's request. This is a
reviewable Recipe specification, not a Bazantic import file. Confirm the current
authoring format when account setup resumes. No gateway, payments or credentials
have been configured.

The [official ETHOnline sponsor requirements](https://ethglobal.com/events/ethonline2026/prizes)
describe Recipes that combine the entrant's API with another service, including
another sponsor's API. The proposed pairing is Tare plus The Graph.

## Purpose and inputs

Question: “What does this Ethereum USDC V1 position own, and does the indexed
share ledger agree at that same block?” Inputs are a public owner address, a
supported V1 vault and an optional block number. Use read-only operations only.

## Steps

1. Call Tare's `POST /api/analyze` with `operation: resolve-v1`. Retain the report
   and its digest. Stop with its findings if root evidence or confirmation is
   absent. Never infer verified backing from complete accounting.
2. Query the deployed Tare share-ledger subgraph through The Graph's service,
   using `capture.block.hash`, the normalized vault and owner from step one.
   Use the existing `TareShares` query from `packages/sources/src/the-graph.ts`;
   do not substitute Morpho's unpinned discovery API for this evidence.
3. Call Tare's `verify-shares` operation at the decimal block number from step
   one. This supplies the deterministic comparison; the language model must
   not implement share arithmetic. Require its RPC and Graph block hashes and
   deployment identity to agree with the independent Graph response from step
   two. If the block reorgs or either service is unavailable, report the gap.
4. Present the attributed loan exposures from step one, the Graph observation
   from step two and the cross-check status/findings from step three. Cite both
   sources and retain the report digests. The effective collateral metric stays
   unavailable because a share-ledger match does not verify lending backing.

## Later acceptance gates

- Configure the hosted Tare endpoint, authentication and quotas. The local
  loopback server cannot be called by Bazantic as deployed today.
- Register the API using its `/openapi.json` contract and bind The Graph service
  to the deployed, synced subgraph and expected manifest CID.
- Confirm Bazantic's actual Recipe authoring format and bind the above steps.
- Retain a real run in which both services materially affect the answer.
- Repeat with Graph failure, block-hash mismatch and changed share totals;
  the answer must expose the problem and must never invent a numerical metric.

Any gateway payment requirement needs separate setup; it is not part of these
read-only local interfaces. Account details and deployment keys will be requested
only when the user resumes configuration.
