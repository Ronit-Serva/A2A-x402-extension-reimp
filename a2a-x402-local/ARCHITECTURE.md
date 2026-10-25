# Architecture and payment contract

## Four running processes

1. Local Ethereum node: default RPC http://127.0.0.1:8545, chain ID 31337.
2. Facilitator: proposed http://127.0.0.1:4022; separate executable/process and gas-paying signer.
3. Service agent: proposed http://127.0.0.1:4021; A2A endpoint, payment gate, calculation handler.
4. Client: CLI process, own token-payment signer.

These ports are defaults; detect conflicts and record changes.
The server has no facilitator key and does not submit settlement transactions directly.
The client and facilitator connect through RPC; neither is a blockchain node.
TestUSD and AgentCard are contracts hosted by the one local node.

## On-chain contracts

TestUSD: ERC-20-compatible accounting plus EIP-3009 transferWithAuthorization, nonce consumption, validity checks, EIP-712 domain separation, and a restricted local-test mint.
Use maintained crypto libraries or a clearly attributed reference implementation.
Six decimals; uint amounts use base-unit integer strings/BigInt, never floating point.
Pin the token name/version/domain fields, deployed address, and chain ID consistently across signers and verifier.

AgentCard: store the complete small JSON card, owner, active status, owner-only updates, and owner-only ERC-20 withdrawals.
Advertise service endpoint, supported skill, payment extension, network, token, price, payTo.
Payment recipient is the AgentCard contract. ERC-20 credit updates token storage; it does not require a payable ETH receive hook on AgentCard.
Keep HTTP-served and on-chain cards derived from one configuration; validate identical effective terms.
Contract ownership protects edits, not truth of capability claims.

## Protocol profile: resolve and freeze in M0

Use a real A2A SDK and x402 EVM exact/EIP-3009 implementation.
Record exact SDK versions, A2A binding/method/card shape, card URL, extension declaration/activation behavior, x402 version, headers, and challenge/receipt formats.
The paper uses historical X-PAYMENT / X-PAYMENT-RESPONSE headers and /.well-known/agent.json. Do not paste those into current libraries without checking their matching specification.
Do not label a custom JSON HTTP handler A2A-compliant.
Use an extension URI under a project-controlled/example namespace, not an invented official A2A namespace.
Inspect whether the chosen exact-EVM implementation supports the intended settle-before-handler order. Add a small transparent adapter if necessary; document its wire compatibility and deviation. Never silently change ordering or pretend a custom adapter is standard.
Configure custom RPC/network eip155:31337 and explicit asset metadata. Do not rely on SDK mainnet token defaults or dollar-price parsers.
No hosted facilitator: it cannot reach the laptop's local RPC.

## Facilitator interface

Expose the selected SDK's /supported, /verify, and /settle contracts, plus a simple health endpoint.
Verify is read-only: check profile/network/asset/payTo/amount and authorization against the requirements.
Settle independently revalidates against the configured allowed profile, then submits and confirms the transfer.
Do not trust requirements merely because an arbitrary caller supplied them. Limit the local demo to the configured token, recipient, chain, and price.
Do not accept arbitrary calldata for the gas signer.
Use SDK wire types for standard endpoints. Any extra local reconciliation/status endpoint must be identified as a project-specific addition.
Verification may include read-only blockchain simulation; it must not submit a paid transaction.

## Transaction flow

1. Client reads card via configured RPC and known AgentCard contract address.
2. Validate card schema, active status, supported extension, endpoint, and payment terms.
3. Create stable logical request identity and validated input.
4. Send unpaid A2A request; server returns the selected x402 challenge without executing service.
5. Client compares challenge to card and budget, then signs transfer authorization locally.
6. Resend the same logical request with payment payload.
7. Server validates input before charging and calls facilitator /verify.
8. If valid, server calls /settle; facilitator rechecks, broadcasts once, waits for receipt, and reports outcome.
9. Only confirmed successful settlement unlocks computation.
10. Server returns A2A result plus the selected protocol's payment receipt containing transaction identity.
11. Client reads balances/receipt as demo evidence. Optional proactive payment is a later extension, not required for completion.

## Retry and failure semantics

Maintain persistent minimal local stores (e.g. SQLite or atomically written files with serialized access). Do not build a distributed service.
Facilitator key: network + asset + payer + authorization nonce. Cache/lock to coalesce concurrent identical settlements. Different requirements/payload under the same identity must conflict.
Persist transaction hash immediately after broadcast; track pending/unknown, confirmed, and definitive failure.
Known-hash timeout: requery existing transaction rather than charge with a new authorization.
If a crash occurs between broadcast and persistence, inspect authorization state and transfer/authorization logs; if outcome cannot be established, leave unknown and require reconciliation rather than auto-charge.
Server record: stable request identity + body hash + payer/payment association, settlement state, transaction hash, result.
A duplicate matching paid request returns its stored result/receipt without paying again. Changed input or conflicting association is rejected.
Bind cached-result access to the corresponding payment proof or authenticated payer. An unauthenticated caller supplying a request ID is insufficient.
EIP-3009 signs transfer terms, not inherently the A2A body. Document this boundary; do not claim cryptographic task binding merely because a server stores a body hash.
A reused authorization must never unlock a different logical request.
Do not mint or bypass signatures in tests presented as payment integration.
Invalid input must not charge. A service failure after settlement remains paid-but-undelivered; record it. No automatic refund claim.

## Logging and secrets

Log sanitized logical request IDs, verification status, tx hash, receipt status, gas used, balances, and service execution counter.
Never include private keys or full secret configuration in evidence. Local signing keys stay in ignored configuration.
Contracts/manifest/evidence may contain public addresses and chain metadata.
After chain reset, redeploy and namespace/reset service stores; reject stale manifest or mismatched bytecode/config rather than trusting reused addresses.

