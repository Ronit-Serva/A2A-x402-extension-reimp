# Reference map

## Primary research
- sources/paper.pdf: user-supplied arXiv:2507.19550v1 (24 July 2025).
- https://arxiv.org/abs/2507.19550v1
- Sections 4.1 and 5.2: on-chain AgentCard and ownership/payment metadata.
- Sections 4.2–4.3 and 5.3: x402/A2A interaction and payment flow.
- Section 5.1: TypeScript/Express/ethers and local Hardhat prototype.
- sources/learn-article.pdf: user's motivation and research draft. Do not treat its proposed escrow/reputation tiers as requirements for this reproduction.

## Official implementation references
- https://github.com/x402-foundation/x402 — maintained reference repository and examples.
- https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
- https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- https://a2a-protocol.org/latest/topics/extensions/
- https://a2a-protocol.org/latest/specification/
- https://eips.ethereum.org/EIPS/eip-3009
- https://eips.ethereum.org/EIPS/eip-712
- https://eips.ethereum.org/EIPS/eip-20
- https://hardhat.org/docs
- https://www.getfoundry.sh/anvil/index.html
- https://ethereum.org/developers/docs/smart-contracts/deploying/
- https://ethereum.org/developers/docs/gas/

These web references are moving targets. Inspect current source and pin a compatible release/commit before implementation. Record the exact inspected example path and protocol behavior in DECISIONS.md.
The paper's AgentCard/header examples are historical; do not assume they match the selected current SDK.

## What to explain in the final write-up
- Why a token contract is needed and why its balance ledger differs from native ETH.
- Why an authorization signature does not itself settle a payment.
- Why the facilitator has a gas-paying key, while the client authorizes token spending.
- Why one local node is enough for execution testing but does not demonstrate distributed trust.
- Where card ownership, service quality, task binding, and payment-delivery atomicity stop.
- How an HTTP timeout is reconciled using chain evidence without requesting another charge.

