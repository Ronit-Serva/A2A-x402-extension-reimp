# Browser walkthrough implementation plan

Status: **Implemented; API/integration verification passed. Rendered browser QA unavailable.**

Date: 2026-10-25

Implementation root: `Build/`. The `a2a-x402-local/` directory contains the original reference material; its `PROGRESS.md` points to the active `Build/PROGRESS.md`.

This document records the approved implementation scope. The original plan below is retained as the specification; actual implementation and verification outcomes are recorded in `PROGRESS.md` and `evidence/UI.md`. The user subsequently instructed: “continue with implementation.”

## 1. Objective

Build a local browser dashboard that lets someone operate and understand the existing A2A + x402 project from blockchain startup through delivery of the paid server response.

The central experience is a guided, manually advanced walkthrough. Each action must explain what will happen, execute the real project operation, and show the resulting evidence. A person should be able to identify:

- Which process is acting: client, server, facilitator, or blockchain.
- What data is exchanged and why.
- When a payment is merely requested, authorized, verified, submitted, and confirmed.
- When service computation actually starts.
- Where to inspect the transaction, token movement, receipt, and final result.
- How deployment configuration differs from current chain state.

The browser must show actual process output and protocol events. Animations and completed steps must follow observed execution rather than timers or prewritten success messages.

## 2. Existing baseline and constraints

The current project reports M0–M7 complete, including real local EIP-3009 settlement, a separate facilitator, paid A2A delivery, and recovery checks. The UI extends that implementation.

Existing roles and addresses:

| Component | Current interface | Responsibility |
| --- | --- | --- |
| Hardhat blockchain | `127.0.0.1:8545`, chain ID `31337` | Contracts, balances, authorization nonces, transaction receipts |
| Server agent | `127.0.0.1:4021` | A2A request handling, payment gate, statistics response |
| Facilitator | `127.0.0.1:4022` | Verify authorization and submit the token transfer using its gas signer |
| Client | CLI process | Read AgentCard, validate terms, sign payment, request service |
| Proposed dashboard | `127.0.0.1:4030` | Local process controls, manual walkthrough, evidence display |

Preserve these properties:

- The facilitator remains a separate process.
- Settlement uses actual contracts on the local chain.
- Only the client process reads the client private key; only the facilitator reads its gas-signing private key.
- Signature verification does not reserve funds. A transaction hash alone does not prove settlement.
- Pending or unknown settlement never unlocks service execution.
- Replay protection and durable application idempotency continue to work.
- A changed or restarted chain invalidates stale deployment metadata and active walkthroughs.
- Existing CLI commands remain usable independently of the UI.
- Source PDFs remain unchanged. No public deployment or remote hosting is included.

The original reference instructions said a UI was unnecessary for the initial prototype. The user's new request explicitly adds a UI to the scope.

## 3. Scope and bootstrap boundary

### Included

- Start and inspect the local blockchain from the browser.
- Compile contracts, deploy and seed the local fixture, and inspect its output.
- Start and inspect the facilitator and server independently.
- Read and explain the on-chain AgentCard.
- Manually advance the paid request through meaningful protocol boundaries.
- Stream process logs and structured execution events into the dashboard.
- Inspect current balances, transaction confirmation, payment receipt, and service response.
- Explain every field currently present in `deployments/local.json`.
- Show actionable errors for missing services, stale deployment data, and interrupted runs.
- Document browser and terminal workflows and record verification evidence.

### Required terminal bootstrap

A browser page cannot install Node.js or launch its own local backend before that backend exists. The documented starting point will therefore be:

1. Install the project's supported Node.js version and project dependencies using the existing setup instructions.
2. From `Build/`, run the proposed `npm run ui` command.
3. Open the printed localhost URL.

From that point, blockchain startup, compilation, deployment, service startup, and the paid walkthrough will be browser-controlled. The UI will report installed versions and missing prerequisites. It will not offer an arbitrary shell or silently install system software.

### Deferred

Public networks, real funds, hosted dashboards, browser wallet integration, user accounts, multi-user access, marketplaces, and automated dependency installation are outside this iteration.

## 4. Dashboard design

Use a developer-console layout with readable typography, a neutral background, clear status indicators, and restrained color accents for the four actors. Text labels and icons must accompany color so status is understandable without color perception.

### Main layout

1. **Header:** project name, local-only environment, chain ID, dashboard connection status, current run identifier.
2. **Service strip:** node, deployment, facilitator, and server cards showing endpoint, readiness, process ownership, and start/stop controls where appropriate.
3. **Left workflow panel:** numbered setup and execution steps, prerequisites, current state, and the next manual action.
4. **Center execution panel:** interactive sequence diagram, selected-step explanation, and a plain-language account of the current operation.
5. **Right evidence panel:** request terms, public authorization details, transaction receipt, balance changes, and final service output as they become available.
6. **Bottom log console:** live process output, timestamps, source filters, search, pause autoscroll, and sanitized download.

On narrower screens, panels will stack without hiding the primary action. Long hashes and JSON will wrap or scroll inside their own containers. Controls must be keyboard accessible, focus visible, and errors announced without flooding assistive technology with every log line.

### Workflow states

Steps will distinguish `not ready`, `ready`, `running`, `waiting for you`, `complete`, `pending confirmation`, and `failed`. A failed prerequisite must explain how to recover. Completed historical steps must not imply that a service is still healthy.

Only an action that is safe for the current state is enabled. Repeated clicks must not spawn duplicate processes or submit duplicate payment operations.

## 5. Manual user journey

### A. Prepare the environment

| Step | Browser action | Actual operation | Evidence shown |
| --- | --- | --- | --- |
| 1 | Inspect prerequisites | Check runtime, installed dependencies, expected ports, and existing processes | Versions, availability, ownership, actionable failures |
| 2 | Start blockchain | Launch the existing local Hardhat node | Sanitized startup output, successful RPC response, chain ID |
| 3 | Compile contracts | Run the existing `npm run compile` implementation | Compiler output, exit status, artifact availability |
| 4 | Deploy and seed | Run the existing local fixture setup | Deployment transactions, addresses, seed balances, deployment anchor |
| 5 | Start facilitator | Launch the separate facilitator | Logs and successful health check |
| 6 | Start server agent | Launch the A2A server | Logs and successful health check |

The existing `m1:local` script also performs contract/payment checks and restores its fixture. Initially reuse it and label that behavior explicitly. Its historical payment test must be displayed separately from a subsequent paid client run. Do not imply the script only deploys contracts or that its payment hash belongs to the new walkthrough.

### B. Walk through the paid request

Provide an editable numbers input, defaulting to `[2, 4, 6]`, with the same validation rules as the server. Display the expected price from the validated AgentCard before signing.

| Step | Manual action or observed transition | Explanation and evidence |
| --- | --- | --- |
| 7 | Read AgentCard | Read contract state; display active status, service endpoint, capability, and payment terms |
| 8 | Send unpaid request | Send the actual A2A request and show the actual HTTP 402 challenge |
| 9 | Inspect and authorize | Compare challenge with card; show network, asset, recipient, amount, validity window, and nonce; sign inside the client process |
| 10 | Retry with payment | Retry the same request with the signed x402 payment payload; explain the payment header |
| 11 | Allow verification | Server calls facilitator verification; show its result and explain that no transfer is confirmed yet |
| 12 | Allow settlement | Server asks facilitator to settle; facilitator submits the transaction; show its hash and pending state |
| 13 | Observe confirmation | Read receipt and relevant events; show confirmed token movement and current balances |
| 14 | Allow service execution | After confirmed payment, let the server execute the requested statistics operation |
| 15 | Inspect final response | Show the returned A2A result, payment receipt, request correlation, and full execution timeline |

Submission and mining do not become artificial separate transactions. Once a transaction is submitted, it can confirm immediately on Hardhat. The dashboard must show this honestly; it must not pretend that a user can pause or undo an already submitted transaction.

An optional continuous-run mode can follow once manual stepping works. It would use the same instrumented execution path and automatically release checkpoints; it must not replace the manual experience.

## 6. Real manual stepping architecture

Starting a client and animating its completed logs is insufficient for the requested manual experience. Introduce an opt-in walkthrough mode with explicit checkpoints at meaningful boundaries.

- Reuse the actual client, server payment gate, facilitator, SDKs, and contracts.
- Use a local control channel between the dashboard and processes it launches, with correlated run IDs and checkpoint IDs.
- Prefer child-process IPC where suitable; do not expose a general-purpose control endpoint on the payment services.
- Pause the client before unpaid submission, before signing, and before paid retry.
- Pause the server before facilitator verification, before settlement, and before service execution after confirmation.
- Continue to observe facilitator submission and confirmation without adding a fake confirmation gate.
- Release only the checkpoint associated with the active run and process. Reject duplicate or stale release requests.
- Keep normal CLI behavior unchanged when walkthrough mode is off.

During initial implementation, inspect existing SDK request timeouts and cancellation behavior. Set explicit, bounded walkthrough timeouts so intentional pauses work without leaving hung requests indefinitely. If transport behavior requires a different control mechanism, document the reason before changing protocol semantics.

Payment authorizations have a finite validity period. Show remaining validity while paused. If an authorization expires before submission, stop that attempt and guide the user through a fresh authorization after checking its recorded settlement state. Never silently extend a signed authorization or reuse an uncertain attempt as though it had failed.

Browser refresh should reconnect to the same backend session. Closing a browser must not be presented as cancelling a submitted transaction. On dashboard shutdown, release or terminate managed paused work in a controlled manner and preserve payment state for reconciliation. A run interrupted after payment may be paid but undelivered; the UI must expose that outcome accurately.

## 7. Sequence diagram based on the supplied image

Recreate the supplied diagram as an interactive, accessible diagram in the repository. Use the same four participants and message order:

1. Client → local blockchain: read AgentCard.
2. Client → server: request service.
3. Server → client: HTTP 402 payment required.
4. Client → client: check terms and sign authorization.
5. Client → server: retry request with payment.
6. Server → facilitator: verify payment.
7. Facilitator → server: authorization valid.
8. Server → facilitator: settle payment.
9. Facilitator → local blockchain: submit token transfer.
10. Local blockchain → facilitator: transfer confirmed.
11. Facilitator → server: settlement result and transaction details.
12. Server → client: service result and payment receipt.

Highlight a message only when a corresponding real execution event is observed. Selecting an arrow opens its explanation and associated sanitized data. Add explicit service-execution evidence between settlement and delivery even though the supplied diagram summarizes that internal server work.

Keep explanatory text beside the diagram: the AgentCard is stored on-chain; the server handles A2A requests; the client signs authorization; the facilitator pays transaction gas; the AgentCard contract receives the tokens. The application does not require the client to hold ETH for this payment.

Prefer SVG/HTML with a textual ordered-list equivalent so no external diagram service is required. Preserve the user's image as a reference asset if available and appropriate; the interactive version must remain usable without an absolute path to the user's Downloads directory.

## 8. Live logs and event model

Use Server-Sent Events for dashboard updates, with an initial snapshot and reconnect support. Maintain a bounded event buffer so browser refresh does not lose the current session. If older events have been evicted, state that explicitly.

Two complementary streams will be displayed:

- **Process logs:** sanitized stdout/stderr with process name, timestamp, severity when known, and run association.
- **Structured events:** emitted at actual code boundaries to drive workflow state, diagram highlighting, and evidence panels.

Proposed event fields:

```text
id, timestamp, source, type, runId?, requestId?, checkpointId?,
stage?, status?, message, data?
```

Structured events cover process startup/readiness/exit, deployment validation, card reads, challenge receipt, term validation, authorization creation, payment retry, verification, settlement submission, confirmation, execution, result delivery, and failures.

Do not infer payment success from a matching log string. Confirmation requires receipt and contract-event evidence. Distinguish the time an event occurred from the time the dashboard received it where needed; cross-process arrival order alone is not proof of causality.

Raw private keys must never enter the browser event stream. Hardhat prints development private keys at startup, so sanitize at ingestion before buffering, persistence, or SSE delivery. Handle chunk boundaries rather than assuming each stdout chunk is a complete line. Prefer allowlisted public fields for structured events. Render logs as text, never executable HTML.

Full payment signatures can be replay-sensitive while valid. Show explanatory public authorization fields by default and omit signatures from exported evidence. Do not read key files to implement redaction or status reporting.

## 9. Configuration and chain evidence

Provide both a readable field guide and a raw public JSON view for `deployments/local.json`.

| Field | Meaning and UI treatment |
| --- | --- |
| `chainId` | Expected local chain identifier; compare with live RPC |
| `rpcUrl` | Local blockchain endpoint; show connectivity separately |
| `counter` | Auxiliary contract used by the fixture's basic execution check |
| `token` | TestUSD contract address used for payment |
| `agentCard` | Contract containing AgentCard metadata and receiving payment |
| `owner` | Deployment/administration account; explain its contract-management role |
| `client` | Public address of the payer; signing key remains in the client process |
| `facilitator` | Public gas-paying settlement signer; signing key remains in the facilitator process |
| `fixtureClientBalance` | Client token balance snapshot after fixture restoration |
| `fixtureCardBalance` | Recipient token balance snapshot after fixture restoration |
| `settledClientBalance` | Client balance snapshot during the fixture's settlement check |
| `settledCardBalance` | Recipient balance snapshot during that settlement check |
| `paymentTxHash` | Historical fixture settlement transaction, not necessarily the latest client payment |
| `receiptStatus` | Status recorded for that fixture transaction |
| `anchor.blockNumber` | Block chosen to identify the deployed fixture instance |
| `anchor.blockHash` | Expected hash at that block; detects a reset/replaced chain even when addresses repeat |
| `tokenDomain.name` | Token name used in the authorization signing domain |
| `tokenDomain.version` | Signing-domain version |
| `tokenDomain.decimals` | Token display precision; six decimals means `2000000` base units = 2 TestUSD |
| `codeHashes.token` | Expected runtime bytecode hash of the token contract |
| `codeHashes.agentCard` | Expected runtime bytecode hash of the AgentCard contract |

Place historical snapshots and live RPC balances in separately labelled sections. Display both base units and human-readable token amounts. Show facilitator ETH as gas funding and client ETH separately from TestUSD.

For each current run, show the request/message ID, relevant public payment terms, transaction hash, block number, receipt status, token Transfer event, authorization-use evidence, before/after balances, and final service response. Missing evidence remains missing; do not fill it using `evidence/demo.json` from an older run.

Read deployment identity and live state using the existing shared validation helpers. A failed anchor or code-hash check must disable new paid runs and explain that services need a fresh matching deployment.

## 10. Local backend and process lifecycle

Proposed backend responsibilities:

- Serve the dashboard assets from the local application.
- Expose a sanitized status snapshot and event stream.
- Execute a fixed allowlist of setup/process actions.
- Start a walkthrough, release a specific checkpoint, and expose its public evidence.
- Track spawned process ownership and stop only owned processes.
- Read public deployment metadata and query the local chain.

Use process spawning with argument arrays and a fixed project working directory, without shell interpolation. Numbers input must be parsed and validated as data. Do not accept arbitrary commands, file paths, RPC URLs, or executable names from the browser.

Possible API shape, subject to implementation review:

```text
GET  /api/status
GET  /api/events
GET  /api/deployment
GET  /api/runs/:id
POST /api/actions/:action
POST /api/runs
POST /api/runs/:id/continue
POST /api/runs/:id/cancel
POST /api/processes/:name/stop
```

Bind to `127.0.0.1`. Protect mutation routes with same-origin checks, host validation, a local-session token/custom header, strict JSON validation, and body limits. Do not enable permissive CORS. These controls keep unrelated websites from issuing local process commands through a visitor's browser.

Service readiness requires successful health/RPC checks, not merely a PID or an open port. Existing externally started services should be reported as external and never stopped by the dashboard. If they lack walkthrough control support, explain which steps are observable only and how to restart them under dashboard ownership for full stepping.

Serialize setup mutations. Prevent deployment while a paid run is active. Reject ambiguous port conflicts. Track process exits and clean up owned descendants on shutdown. Stopping or restarting the blockchain must clearly explain that its in-memory state is lost; do not silently redeploy in response.

## 11. Fix the reported CLI error

The reported `ECONNREFUSED 127.0.0.1:4021` means the client could not connect to the server endpoint. `npm run client` currently expects the required services to already be running.

Improve the CLI entry point and connection error handling to print a concise message with the affected component, endpoint, and corrective command. Preserve a nonzero exit code. Offer detailed diagnostics through an explicit debug mode rather than an unhandled stack trace by default.

Handle these conditions distinctly:

- Node unavailable: start `npm run node` and deploy if the chain is fresh.
- Deployment missing or stale: compile/deploy and restart dependent services as needed.
- Server unavailable at port 4021: start `npm run server` after its prerequisites.
- Facilitator unavailable at port 4022: start `npm run facilitator`; surface the server's payment error accurately.
- Connection dropped after submission: inspect/reconcile the current payment attempt before suggesting a new paid request.

Readiness checks improve guidance but cannot guarantee a service remains available during a request. Retain request-time error handling. Never turn an uncertain settlement into a generic “retry payment” instruction.

## 12. Proposed file changes

Exact boundaries may be adjusted after inspecting the implementation, but the intended ownership is:

| Path | Proposed work |
| --- | --- |
| `apps/dashboard/src/` | Local HTTP backend, process manager, status/readiness checks, run/checkpoint coordination, event stream |
| `apps/dashboard/public/` | Dashboard HTML, CSS, JavaScript, accessible sequence diagram and explanations |
| `packages/shared/src/` | Small opt-in event/checkpoint helpers and shared public event types |
| `apps/client/src/index.ts` | Friendly CLI error reporting and walkthrough entry behavior |
| `apps/client/src/run.ts` | Real card/request/result events and manual checkpoints |
| `apps/client/src/payment.ts` | Challenge, validation, signing, and retry events/checkpoints |
| `apps/server/src/payment-gate.ts` | Payment lifecycle events and controlled walkthrough pauses |
| `apps/server/src/service.ts` | Service-execution/result evidence where appropriate |
| `scripts/facilitator.mjs` | Verification, submission, reconciliation, and confirmation events |
| `package.json` | Add the dashboard launch command and focused verification command if needed |
| `README.md` | Browser startup, manual walkthrough, CLI troubleshooting, evidence locations |
| `PROGRESS.md`, `DECISIONS.md`, `evidence/` | Record UI work separately from completed M0–M7 and document actual verification |

Prefer the installed Express stack and browser-native rendering/SSE initially. Avoid adding a frontend framework or UI dependency unless it materially improves the implementation. Do not change SDK versions as part of this work without a demonstrated need.

Keep CLI output compatible with existing scripts. In particular, structured walkthrough telemetry must be opt-in or use a separate channel so scripts that parse the final client JSON continue to work.

## 13. Implementation phases and completion gates

### Phase 1 — Confirm integration points

Read the relevant architecture/decision documents and current client, payment gate, facilitator, deployment, and reproduction code. Identify exact event boundaries, existing timeouts, process startup behavior, and public evidence sources.

Completion: document the concrete checkpoint strategy and any necessary adaptations; preserve the existing baseline.

### Phase 2 — Backend and browser-controlled setup

Implement dashboard serving, process ownership, prerequisite checks, fixed setup actions, readiness reporting, sanitized log streaming, and public deployment inspection.

Completion: a user can start the node, compile/deploy, and start both services from the browser, with truthful readiness and logs.

### Phase 3 — Manual protocol execution and CLI diagnostics

Add opt-in checkpoints/events to the existing execution path. Implement run correlation, continuation/cancellation rules, expiry handling, and friendly connection diagnostics.

Completion: a real request can pause and resume at the documented boundaries; the ordinary CLI retains its behavior; no service computation occurs before confirmed payment.

### Phase 4 — Educational dashboard

Implement the workflow panel, service cards, interactive sequence diagram, terms/authorization views, configuration guide, transaction evidence, balances, and final response panel.

Completion: the page explains each actual operation and lets the user relate diagram arrows to real logs and evidence.

### Phase 5 — Recovery, verification, and documentation

Exercise success and relevant failure paths, verify process cleanup and secret redaction, inspect the rendered UI, and update setup/walkthrough/evidence documentation.

Completion: all applicable acceptance criteria below have recorded outcomes. Any environment limitation or unverified check is explicitly reported rather than called successful.

## 14. Verification plan

Use focused tests and real integration runs where the change affects behavior. Reuse existing payment/recovery checks instead of replacing them with UI-only assertions.

### Successful manual run

- Start from no dashboard-owned services and perform setup through browser controls.
- Confirm the AgentCard and price come from the current validated deployment.
- Send an unpaid request and observe HTTP 402 with no service execution.
- Pause before signing and before paid retry; confirm no payment occurs early.
- Verify authorization; confirm verification alone does not move tokens.
- Submit settlement; inspect the actual receipt and contract events.
- Confirm one 2 TestUSD transfer and one service execution for the request.
- For `[2, 4, 6]`, inspect count `3`, sum `12`, min `2`, max `6`, mean `4`.
- Compare displayed balances and transaction evidence with direct RPC/contract reads.

### Failure and lifecycle checks

- Missing node, facilitator, or server produces actionable diagnostics.
- Invalid input is rejected before payment.
- Duplicate start/continue clicks do not duplicate processes or payment.
- Browser refresh reconnects without replaying actions.
- Expired authorization does not silently settle or execute.
- An interrupted or delayed settlement stays pending/unknown until reconciled.
- Blockchain restart invalidates stale deployment and run state.
- An externally managed service is never stopped by dashboard cleanup.
- Dashboard shutdown cleans up only owned processes and reports interrupted runs accurately.
- The timeline distinguishes payment confirmation, service failure, and response delivery failure.

### Local controls and UI checks

- Streamed logs and exported evidence contain no private keys or raw signatures.
- Log redaction handles secret-bearing lines split across process-output chunks.
- Untrusted origins, arbitrary actions, and malformed inputs cannot invoke process control.
- Log content is rendered as text and cannot inject page markup.
- Long logs remain bounded; disconnect/reconnect states are visible.
- Keyboard navigation, narrow viewport layout, long hashes, empty states, and error states remain usable.

### Regression checks

Run TypeScript checking, relevant existing payment/recovery checks, and artifact scanning. Because checkpoint instrumentation touches payment execution, run the existing full reproduction after focused checks if needed to establish that ordinary CLI settlement and recovery remain intact. Record exact commands and results; never label a planned command as verified.

## 15. Acceptance criteria

The iteration is complete when:

1. A documented local launch command opens a usable dashboard.
2. After terminal bootstrap, users can perform blockchain startup, compilation, deployment, facilitator startup, and server startup through browser controls.
3. Users can manually advance meaningful stages of a real paid request through the final server response.
4. The four-party diagram follows the supplied reference and highlights observed execution.
5. Live logs and correlated events explain what each process is doing.
6. The dashboard explains every existing `local.json` field and clearly separates snapshots from live state.
7. Settlement evidence includes actual receipt/events and balance changes; service results are the real A2A response.
8. Missing-service errors, including the reported port-4021 refusal, provide useful corrective instructions.
9. Existing CLI operation, signer isolation, replay protection, durable recovery, and settlement-before-execution remain intact.
10. Documentation and recorded verification match the delivered behavior.

## 16. Approval boundary

The user approved implementation after this plan was written. Proceed through the implementation phases without requesting permission for ordinary workspace file edits. Bring back only material scope changes or unresolved choices that would alter the approved behavior.

Implementation choices: use native HTML/CSS/SVG and Express with no new dependencies; use child-process IPC for manual checkpoints; bound each pause to 60 seconds and walkthrough HTTP requests to 240 seconds. Continuous-run mode is deferred because it was optional; the delivered workflow prioritizes manual advancement. A persisted same-proof recovery path handles interruptions. Browser-rendered QA is unavailable in this session and is explicitly recorded as unverified rather than inferred from API checks.
