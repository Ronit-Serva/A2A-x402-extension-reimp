# Decisions and open implementation choices

Reference snapshot: active implementation decisions now live in
[../DECISIONS.md](../DECISIONS.md). The user selected Build as the project root.

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
