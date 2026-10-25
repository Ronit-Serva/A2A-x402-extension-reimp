# Decisions and open implementation choices

## 2026-10-25 — M0 environment investigation

Observed Node v22.23.1 and npm 10.9.8; these are environment observations,
not a verified compatible toolchain selection. No SDK/compiler pins selected.
Terminal dependency host resolution fails and required packages are not cached.
Following the sequential-gate rule, stop dependent implementation until M0 can
execute. See evidence/M0.md. Paper Sections 4–5 read from the supplied PDF;
architectural reproduction and separate facilitator remain the working scope.

## Explicit user decisions
- Reimplement the supplied paper's extension with one client and one service agent.
- Use a local Ethereum development chain for test-token settlement.
- Use a separate facilitator process. This supersedes the earlier server-module default.

## Working defaults, chosen for a compact build
- Hardhat toolchain and one Hardhat node; Anvil only as a documented substitute.
- TypeScript applications; Solidity contracts.
- Statistics calculation without LLM; fixed 2 TestUSD price; token has 6 decimals.
- AgentCard contract receives payment and supports owner-only token withdrawal.
- Retrieve a known on-chain card first; no general registry/discovery implementation.
- Architectural reproduction using pinned compatible SDKs; document differences from arXiv v1.
- Explicit verification then confirmed settlement then service execution.
- Minimal persistent local stores for retries and recovery.
- Structure in PROJECT.md is the proposed concrete layout; prior conversation fixed components rather than file names.

## Resolve in M0
Record actual values and reasons; do not fill with guessed versions.
1. Node/package manager/Hardhat/Solidity versions.
2. A2A SDK version, binding, method names, card fields/path, extension activation.
3. x402 SDK and wire version; payment challenge and response header names.
4. Exact EVM EIP-3009 scheme configuration for eip155:31337 and custom token.
5. Official SDK support or documented adapter for explicit settle-before-handler flow.
6. EIP-712 token name/version/domain; token amount configuration bypassing implicit USD/mainnet defaults.
7. Request/settlement persistence and reconciliation strategy.
8. Attributions/licenses of borrowed reference code.

## Change log format
Decision ID; context; selected option; alternatives; consequences; source/version; gate affected.
Document technical adaptations and keep the requirement (separate facilitator and real settlement) intact.
If exact historical compatibility becomes essential, resolve it explicitly instead of mixing old headers with new SDK schemas.


## D001 — Installed toolchain pins (2026-10-25; M0 partial)

Node observed: v22.23.1; npm 10.9.8. Exact installed packages:
A2A SDK 1.3.0, x402 core/evm 2.28.0, viem 2.57.11,
OpenZeppelin contracts 5.6.1, Express 5.3.0, Hardhat 3.21.0,
solc 0.8.38, TypeScript 7.0.2, tsx 4.23.15,
@types/node 26.6.5, @types/express 5.0.6.
Manifest and lockfile belong to this project; parent user files preserved.
Successful offline install does not establish full runtime compatibility.

## D002 — Compiler and provisional protocol adaptation (M0 partial)

Use official installed solc-js standard JSON compilation, optimizer 200 runs,
EVM target cancun. It actually compiles Counter without downloads.
Hardhat's bundled subprocess compilation currently fails parsing empty output;
retain `compile:hardhat` as diagnostic only, not a verified build command.
Keep Hardhat as the intended single node; no Anvil substitution.

The installed A2A SDK implements 1.0: choose native JSONRPC SendMessage,
supportedInterfaces card shape and /.well-known/agent-card.json rather than
paper-era message/send and agent.json. SDK handlers/client must be used.
Extension URI will use an example namespace and explicit A2A-Extensions activation.
Exact EVM SDK exposes independent verify/settle operations for custom
`eip155:31337` and explicit domain metadata; use these before A2A execution in
a transparent adapter. This is source-inspected feasibility, not a passing
integration. Durable application/settlement stores and crash reconciliation
remain unimplemented; SDK pending memory alone does not meet the requirements.
Full profile and SDK execution remain M0 work after sandbox access is restored.

## D003 — User-selected project root

The user clarified that Build is the implementation root. All source, tooling,
manifest/lockfile, evidence and active progress live there. a2a-x402-local is
the instruction and source-PDF reference directory. This overrides references
to that directory as the implementation root in the handoff documents.

## D004 — Frozen wire and local-chain profile (2026-10-25; M0 PASS)

Use the installed A2A SDK 1.3.0 and A2A protocol 1.0: native JSON-RPC
`SendMessage`, the SDK card shape with `supportedInterfaces`, and
`/.well-known/agent-card.json`. Extension activation uses the SDK's
`A2A-Extensions` header. The payment extension URI is
`https://example.org/a2a/x402` (project placeholder namespace; replace if a
real namespace is selected).

Use x402 protocol v2 with `@x402/core` and `@x402/evm` 2.28.0, scheme `exact`,
network `eip155:31337`, and EIP-3009 `transferWithAuthorization`. The current
header names in the installed core source are `PAYMENT-REQUIRED` for the
challenge, `PAYMENT-SIGNATURE` for the request payload, and `PAYMENT-RESPONSE`
for the settlement receipt. The SDK retains compatibility fallbacks for
`X-PAYMENT` and `X-PAYMENT-RESPONSE`; this project will emit the v2 names.
The facilitator exposes SDK-compatible `/supported`, `/verify`, and `/settle`
routes. The service adapter calls verify and then settle before invoking the
A2A handler; this is the explicit settle-before-handler integration and not a
claim that the historical paper headers are current x402 v2.

`TestUSD` uses EIP-712 domain name `TestUSD`, version `1`, the deployed token
address, and chain ID 31337. Payment requirements must specify the exact token
address and 2,000,000 base units; dollar-string pricing and default mainnet
assets are not used. The inspected `ExactEvmScheme` exposes independent
`verify` and `settle`, and `toFacilitatorEvmSigner` accepts viem clients;
`@x402/evm` README/declarations confirm CAIP-2 custom EVM network support and
EIP-3009. Source paths and installed versions are recorded in evidence/M0.md.

## D005 — TestUSD and M1 fixture (2026-10-25; M1 PASS)

`TestUSD` uses OpenZeppelin ERC20/Ownable/EIP712/ECDSA, 6 decimals, restricted
owner minting, and EIP-3009 transfer/receive/cancel operations. `AgentCard`
is already present as the M1 payment recipient so the real authorization
settles to a contract; M3 card-schema retrieval and permission gates remain
pending. The M1 script writes the generated client signer to ignored
`runtime/client-key.json`, emits public addresses to `deployments/local.json`,
and restores client=100,000,000 and card=0 after its positive and negative
settlement checks.

## D006 — Separate facilitator runtime and idempotency (2026-10-25; M2 PASS)

The facilitator is `scripts/facilitator.mjs`, a distinct Express process that
uses the installed `x402Facilitator` and EVM `ExactEvmScheme`. It obtains the
configured Hardhat facilitator address from the deployment manifest and signs
through the loopback RPC. The service process does not receive this signer.
Routes expose `/health`, SDK-shaped `/supported`, `/verify`, and `/settle`.
Both verify and settle enforce the local profile; settle calls verify before
the SDK's own settlement revalidation.

Settlement calls serialize on `(chain, token, payer, EIP-3009 nonce)`. The
stable payload/requirements fingerprint rejects conflicts; confirmed, pending,
and failed responses persist atomically under ignored
`runtime/facilitator-settlements.json`. This handles duplicate in-process calls
and ordinary completed retries. Broadcast-to-persistence crash recovery and
stale-chain generations remain explicitly incomplete for M6.

## D007 — Confirmed paid A2A and durable request association (M3–M6 PASS)

The shared typed card reader validates the installed A2A 1.0 card fields and
the exact local extension/payment profile. The HTTP card comes from the same
on-chain JSON. The SDK owns native JSON-RPC serialization, request handling,
extension activation, executor event delivery and client transport.

The transparent service adapter validates input before payment, serializes
requests, associates stable message ID/body hash with the specific payer/nonce
and signed proof, and stores the protocol receipt/result before sending it.
Only a matching proof can access a cached result. EIP-3009 itself does not
cryptographically bind the body; this is application association.

The facilitator persists intent before broadcast and the hash immediately
after submission. Known-hash retries inspect the existing receipt. A crash in
the broadcast/hash-write gap reconciles AuthorizationUsed and Transfer events;
ambiguous evidence remains unknown. Durable state uses atomic replacement and
file fsync, scoped to a seeded-block hash anchor. Every request rechecks the
deployment; block/code mismatches reject stale state even when local contract
addresses are reused. These decisions supersede D006's incomplete-recovery
notes. Fault hooks require LOCAL_FAULTS=1 and are exercised only by M6.

## D008 — Final signer isolation and clean reproduction (M7 PASS)

M1 generates distinct client and facilitator keys in ignored runtime files,
mode 0600. The owner funds the facilitator with local test ETH and mints the
client's TestUSD. The facilitator loads only its own key and signs locally;
the client loads only its own key; the service loads neither. This supersedes
D006's initial use of an unlocked Hardhat facilitator account. The Hardhat
owner remains a trusted local fixture administrator.

The complete M0–M7 reproduction passed again after this signer change. Node
restart replaces unsupported hardhat_reset for the installed Hardhat 3.21.0.
The reproduction script owns/tears down its node and services, retains public
evidence and namespaces old runtime records. Physical deterministic computation
may repeat across an arbitrary crash before persistence; there is one logical
stored result, with no general claim about arbitrary external side effects.
