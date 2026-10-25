# Browser iteration verification

Date: 2026-10-25

Implementation scope: [../iterate.md](../iterate.md). Launch instructions and the
manual workflow are in [../README.md](../README.md).

## Verified baseline

- `npm run ui` served the dashboard at `http://127.0.0.1:4030`.
- `npm run typecheck` passed after dashboard and instrumentation changes.
- `node --check apps/dashboard/public/app.js` passed.
- `node --import tsx scripts/ui-check.mjs` passed an initial real integration run.
  It started all services through dashboard controls, completed all seven manual
  checkpoints, observed a confirmed 2 TestUSD transfer before statistics execution,
  and checked the actual A2A result for `[2,4,6]`.
- A second run paused after confirmed payment and was cancelled. Reconciliation
  resent the same request/proof, produced no new signature, retained the transaction
  hash, and delivered the result with no additional transfer.
- Actual SSE output, same-origin mutation rejection, action allowlist, missing
  prerequisites, invalid input, duplicate checkpoint rejection, split-line secret
  redaction, and absence of generated signing keys in public output were checked.
- `npm run reproduce` passed the complete existing M0–M7 checks after payment-path
  instrumentation: contract execution, facilitator/card/SDK integration, replay and
  request conflicts, pending/mined settlement, dropped responses, no gas, server and
  facilitator crash recovery, service failure, chain reset, reused addresses, and
  final ordinary CLI result. See `M7-result.json` and `M6-result.json`.

## Final focused run

`npm run ui:check` **passed** and additionally verified the friendly port-4021 CLI error, a real
60-second checkpoint expiry before signing, and stale-deployment rejection after
actually restarting Hardhat. Its machine-readable report is `UI-result.json`.
The final paid manual run transferred 2,000,000 base units and returned statistics
with sum 12 and mean 4; its confirmed transaction was
`0xccdbb0f4a8b5a9b34d193f2ed2cabf7f952ff430e513fb68730602c718bcb3b8`.
Recovery of the second request retained transaction
`0x1f0a61697aadeceee489472076eb9694d86ff679d6933ee14640bfd53e4cc166`
and ended with 96/4 TestUSD across the two distinct paid requests.

A separate external-process check launched Hardhat outside the dashboard, observed
`ownership: external`, verified that the dashboard Stop request returned HTTP 409,
and confirmed the node still answered RPC. That externally owned test process was
then stopped by its test owner. The result was appended to `UI-result.json`.

Additional focused redaction checks passed for ANSI-decorated labels, secrets split
across chunks, and oversized lines whose trailing content must remain discarded.
Final `npm run check:artifacts` passed with 0600 signer files, no generated signer
keys in authored/public files, and the original paper hash unchanged.

The initial final-run cleanup attempted to stop server/facilitator processes that
the reset check had already stopped, producing harmless HTTP 409 messages. Its
cleanup now checks ownership/state before stopping. All integration-owned service
ports were free after the run; no extra payment run was needed for this change.
After stopping the dashboard, direct TCP checks confirmed all four ports (4030,
8545, 4022, 4021) were free.

The check owns its fixture and services through the dashboard and stops those
services afterward. The dashboard itself is stopped separately. Generated public
deployment metadata describes the test chain; a fresh manual node needs deployment
again. Saved UI receipts are historical evidence and are not presented as current
confirmation on a replacement chain.

## Verification limits

The browser tool reported no available browser or native application. The local
page and API were served successfully, but no rendered screenshot, responsive
viewport, download interaction, keyboard navigation, or screen-reader behavior was
verified. Those remain manual browser QA items. No visual QA pass is claimed.

The integration test exercises HTTP/API controls and real execution, rather than
automating browser clicks. It does not prove every visual control is wired correctly.
