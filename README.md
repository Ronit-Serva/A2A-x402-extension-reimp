# A2A + x402 local prototype

M0–M7 pass. One client retrieves a known on-chain AgentCard, calls a real A2A
SDK statistics service, receives an x402 challenge, and signs a 2 TestUSD
payment. A separate facilitator settles it on Hardhat before the service
computes. [PROGRESS.md](PROGRESS.md) tracks the gates;
[evidence/M7-result.json](evidence/M7-result.json) records the clean reproduction.

The implementation root is **Build**. Supplied documents and PDFs are in
[a2a-x402-local/](a2a-x402-local/). Node 22.23.1 and npm 10.9.8 were used;
dependencies and the compiler are pinned in package.json/package-lock.json.

## Browser walkthrough

With dependencies installed, run from `Build/`:

```sh
npm run ui
```

Open **http://127.0.0.1:4030**. The dashboard provides the complete local workflow:

1. **Start blockchain** — launches Hardhat on port 8545 and checks chain ID 31337.
2. **Compile contracts** — runs the installed solc-js compiler.
3. **Deploy & seed fixture** — deploys the contracts, runs the existing fixture checks, and restores client/card balances to 100/0 TestUSD. The logs include these setup checks; they are separate from your paid walkthrough.
4. **Start facilitator**, then **Start server agent** — readiness is checked against the deployed block anchor.
5. Enter a JSON numbers array and click **Begin walkthrough**.
6. Advance **Read AgentCard → Send unpaid request → Sign authorization → Retry with payment → Verify payment → Settle 2 TestUSD → Execute & receive result**.

Each button releases a real process checkpoint. The sequence diagram follows the
supplied four-participant diagram. Click an arrow for its explanation and observed
event data. The evidence panel shows validated terms, public authorization fields,
live RPC balances, independently queried token events/receipt, and the actual A2A
response. The log console streams sanitized stdout/stderr and protocol events.
The configuration table explains every current `deployments/local.json` field.

Node.js and dependency installation still happen in your terminal before the local
dashboard can start. No browser wallet, remote service, or public network is needed.
The local backend uses the project's installed Express/TypeScript dependencies.

**Pauses expire after 60 seconds.** The signing authorization also has its own
finite validity window. Hardhat may confirm a submitted transaction immediately;
there is no artificial pause between submission and mining. Cancellation cannot
undo a transfer already submitted. If a run is interrupted, select it under
**Session runs**, inspect its receipt, and use **Reconcile same attempt**. This
resends the exact stored request and authorization, creating no fresh signature.
It may submit a still-valid attempt that had not reached settlement, or recover a
previously settled result. If the stored application outcome is definitively
`failed` or `paid-undelivered`, **Acknowledge recorded outcome** closes that run
without claiming a refund or successful delivery. Pending/unknown attempts cannot
be acknowledged as final. A fresh paid run is blocked while a submitted attempt
on the same deployment remains unresolved.

The latest 30 run summaries/events survive dashboard restart in ignored local
runtime storage. Raw proofs are retained only in ignored, mode-0600 client
attempt files for recovery; browser evidence exports omit signatures and keys.
Historical runs from another deployment stay labelled as historical and cannot
be reconciled against the new chain. A dashboard restart must use the same live
chain and matching deployment to recover an attempt.

Use **Stop** on service cards to stop dashboard-owned services. Stop the server
and facilitator before stopping/replacing the blockchain or redeploying. Ctrl+C
in the dashboard terminal stops its owned process groups. Processes started in
other terminals are detected as external and are never stopped by the dashboard.
For full manual stepping, stop external services in their original terminals and
start them through the dashboard. Restarting Hardhat loses its in-memory chain;
deploy/seed again and restart the dependent services.

The dashboard listens only on loopback. Ports 4030, 8545, 4022, and 4021 are fixed
for this local workflow. It exposes fixed actions, not an arbitrary command shell.

To run the dashboard integration check, leave `npm run ui` running, ensure the
other three service ports are free, and in a second terminal run:

```sh
npm run ui:check
```

This creates its own fixture through the dashboard API, performs real manual
payment/recovery checks, waits for one real 60-second checkpoint timeout, tests
node-reset rejection, and stops the services it started. Results are recorded in
`evidence/UI-result.json`. See [the implementation plan](iterate.md) and
[UI verification notes](evidence/UI.md). No browser renderer was available in the
implementation session; visual browser verification remains unperformed.

## Setup and full verification

This workspace's dependency install was verified using its existing npm cache:

```sh
npm ci --offline --cache /home/ronit/.npm --ignore-scripts --no-audit --no-fund --logs-dir /tmp/a2a-npm-logs
```

With ports 8545, 4022 and 4021 free, run:

```sh
npm run reproduce
```

This starts its own loopback node and separate services, compiles contracts,
typechecks TypeScript, runs M1–M6 checks, restarts the node to test stale-state
rejection, redeploys, and runs the final demo. It saves sanitized evidence and
stops every process it started. Its generated manifest describes that test
chain; start a new manual session with deployment/seed again.

## Run the demo manually

Run every command from Build. Start Hardhat in terminal 1:

```sh
npm run node
```

In terminal 2, compile, check types, and deploy/seed the local fixture:

```sh
npm run compile
npm run typecheck
npm run m1:local
```

`m1:local` also runs the token authorization checks and restores client=100
TestUSD/card=0. It generates distinct client and facilitator keys under ignored
`runtime/`, mode 0600, and public metadata in `deployments/local.json`.

Start the separate facilitator in terminal 3:

```sh
npm run facilitator
```

Start the paid A2A server in terminal 4:

```sh
npm run server
```

Run the client from terminal 2:

```sh
npm run client
```

If you see **Server agent unavailable at http://127.0.0.1:4021**, the server has
not started or is no longer listening. Start `npm run server` after the node,
deployment, and facilitator are ready. `npm run client` runs the client only;
it does not start those dependencies. `LOCAL_DEBUG=1 npm run client` includes
the underlying stack trace when needed.

For [2,4,6], the result is count=3, sum=12, min=2, max=6, mean=4. One new call
changes client/card balances from 100/0 to 98/2 TestUSD and returns a confirmed
transaction receipt. Further new calls each cost 2 TestUSD. A repeated matching
paid request retrieves its stored result without another payment.

Stop the server, facilitator and node with Ctrl+C in their terminals. Restarting
Hardhat discards chain state: rerun `m1:local` before starting services. Stored
records are retained under their deployment block-hash namespace; stale
manifests are rejected even when addresses and bytecode are reused.

## Checks and evidence

| Gate | Command | Evidence |
| --- | --- | --- |
| M0 tooling/profile | compile, typecheck, loopback and chain-ID checks | [M0](evidence/M0.md) |
| M1 actual contract/token execution | `npm run m1:local` | [M1](evidence/M1.md) |
| M2 separate facilitator | `npm run m2:check` | [M2](evidence/M2.md) |
| M3 card and owner permissions | `npm run m3:check` | [M3](evidence/M3.md) |
| M4 official SDK messaging | `npm run m4:check` | [M4](evidence/M4.md) |
| M5 paid A2A | `npm run m5:check` | [M5](evidence/M5.md) |
| M6 retries, faults, restarts | `npm run m6:check`, then actual node restart and `npm run m6:reset-check` | [M6](evidence/M6.md) |
| M7 complete orchestration | `npm run reproduce` | [M7](evidence/M7.md) |

The reproduction script manages the prerequisites and ordering for these
checks. M2/M5 expect a 100/0 fixture and running services; M4 starts its own
temporary unpaid harness; M6 owns its facilitator/server and injects controlled
faults. Normal server mode always requires payment. Input is limited to 1–1000
finite numbers with magnitude at most 1e12.

## Protocol and limitations

A2A SDK 1.3.0 uses protocol 1.0, native JSON-RPC `SendMessage`,
`/.well-known/agent-card.json`, and `A2A-Extensions` activation. x402 core/evm
2.28.0 uses v2 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`
headers, exact/EIP-3009 on `eip155:31337`, and an explicit TestUSD domain. The
service adapter settles through the facilitator before invoking the SDK handler.

TestUSD has 6 decimals and no dollar backing. Its token ledger is distinct from
native ETH: the client signs token spending with zero ETH; the facilitator pays
transaction gas using its own key. The service reads neither signing key.
Hardhat and its unlocked owner account are trusted local development tools.

This retrieves a card at a known address; it does not provide an open discovery
registry or service-quality guarantees. One local node demonstrates execution,
not distributed consensus or real value. EIP-3009 does not sign the A2A body;
durable application records enforce request/payment association. Deterministic
computation may physically repeat across an arbitrary crash before result
persistence. A service exception after settlement remains paid-undelivered;
there is no automatic refund. Pending/unknown settlement never unlocks service.

The official solc-js compile command passes. `compile:hardhat` is retained as a
diagnostic for the installed Hardhat compiler-subprocess issue. See
[DECISIONS.md](DECISIONS.md), [paper comparison](PAPER_COMPARISON.md), and the
[recording walkthrough](WALKTHROUGH.md). No recorded video is claimed.
