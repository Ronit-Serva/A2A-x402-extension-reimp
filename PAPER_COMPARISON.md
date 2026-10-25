# Comparison with the supplied paper

Source: supplied arXiv:2507.19550v1 PDF, Sections 4–5. Architectural reproduction
was selected; the source PDF is unchanged.

| Mechanism | Local implementation |
| --- | --- |
| Ledger-anchored identity/card | AgentCard stores full A2A JSON, active status and owner; client reads it through RPC using a known bootstrap address. |
| Agent messaging | Installed official A2A TypeScript SDK handlers and client perform native protocol 1.0 `SendMessage`. |
| Micropayment challenge | x402 v2 headers and SDK payload types replace the paper's historical X-PAYMENT wire profile. |
| Client authorization | TestUSD EIP-712/EIP-3009 transfer authorization; client has no native ETH. |
| Separate facilitator | Independent executable verifies and settles with its own generated local gas signer. |
| Payment recipient | AgentCard contract receives ERC-20 tokens; only its owner can withdraw. |
| Service | Deterministic statistics instead of LLM infrastructure, fixed price 2 TestUSD. |
| Delivery order | Transparent service adapter validates, calls verify/settle, confirms the receipt, then invokes the A2A SDK handler. |
| Retry behavior | Durable authorization/request records, transaction-hash reconciliation and chain logs cover tested loss/crash cases. |

The current SDK uses `/.well-known/agent-card.json`, `supportedInterfaces`,
`A2A-Extensions`, and v2 PAYMENT-* headers. Dependency versions, exact source
paths, and the adaptation are pinned in DECISIONS.md. TestUSD combines
OpenZeppelin ERC20/Ownable/EIP712/ECDSA with the EIP-3009 message/nonce/validity
rules; signature primitives come from OpenZeppelin. No third-party source was
copied into the project or modified in node_modules.

A token contract supplies the token balance ledger and enforces spending
authorization. Signing authorizes a transfer; only confirmed contract execution
changes balances. The facilitator supplies native ETH gas independently of the
client's token balance. Authorization does not reserve funds, so a verified
payment can still fail at settlement.

Ownership restricts card edits and withdrawals; it does not make capability
claims truthful. EIP-3009 signs token terms, while body association is an
application record. Local chain execution does not establish decentralized
trust, general discovery, payment/delivery atomicity, escrow, reputation, or
service quality. A paid exception is recorded without an automatic refund.

Implementation references and licenses: the supplied
[reference map](a2a-x402-local/REFERENCES.md), OpenZeppelin contracts 5.6.1 (MIT),
A2A SDK 1.3.0 (Apache-2.0), x402 core/evm 2.28.0 (Apache-2.0), viem 2.57.11
(MIT), and solc 0.8.38. Installed package sources/metadata were inspected.
