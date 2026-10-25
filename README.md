# A2A + x402 local prototype

M0–M7 pass. One client retrieves a known on-chain AgentCard, calls a real A2A
SDK statistics service, receives an x402 challenge, and signs a 2 TestUSD
payment. A separate facilitator settles it on Hardhat before the service
computes. [PROGRESS.md](PROGRESS.md) tracks the gates;
[evidence/M7-result.json](evidence/M7-result.json) records the clean reproduction.

The implementation root is **Build**. Supplied documents and PDFs are in
[a2a-x402-local/](a2a-x402-local/). Node 22.23.1 and npm 10.9.8 were used;
dependencies and the compiler are pinned in package.json/package-lock.json.

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
