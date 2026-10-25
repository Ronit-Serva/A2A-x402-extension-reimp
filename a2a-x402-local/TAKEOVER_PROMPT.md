Implement the A2A + x402 prototype in this folder.

Start by reading AGENTS.md, PROJECT.md, ARCHITECTURE.md, MILESTONES.md, DECISIONS.md, PROGRESS.md, and the supplied paper in sources/paper.pdf (especially Sections 4–5).

The user explicitly selected a separate facilitator process. The system has one local Ethereum node, one client, one server, and one facilitator. Use the project structure in PROJECT.md.

Implement milestones M0 through M7 sequentially. Verify each gate using actual execution before beginning its dependent milestone. If a check fails, fix it; do not mark it passed or substitute a mock. After a gate passes, update PROGRESS.md/evidence and proceed without asking for confirmation.

Resolve actual compatible SDK versions in M0 and pin them. Use official libraries for A2A, x402, signatures, and Ethereum interaction. Do not invent APIs or mix the paper's historical wire format with newer libraries. Explain documented adaptations.

The first service is a deterministic statistics calculation for 2 TestUSD. Client reads the known on-chain AgentCard, sends an A2A request, handles HTTP 402, signs authorization, and retries. Server calls separate facilitator verification/settlement, confirms the token transfer, then computes and returns the A2A result and payment receipt.

Keep the build local and compact. No real funds, public deployment, general marketplace, escrow, reputation, or LLM requirement. A CLI demonstration is sufficient.

Persist important decisions and evidence in Markdown so another session can resume. Never report an implementation, passing check, or recorded demo that does not exist. When finished, report the verified run commands, completed gates, paper deviations, and material limitations.

