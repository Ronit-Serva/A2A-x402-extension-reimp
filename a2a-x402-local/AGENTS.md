# Instructions for Codex

## Mission and scope

Implement the prototype described in PROJECT.md and ARCHITECTURE.md.
The user explicitly selected a **separate facilitator**. Do not collapse it into the service agent.
Read sources/paper.pdf Sections 4–5 and REFERENCES.md. Architectural reproduction is the working default; verify and pin compatible library versions in M0. Document adaptations.

## Start and resume

1. Read PROJECT.md, ARCHITECTURE.md, MILESTONES.md, DECISIONS.md, and PROGRESS.md.
2. Inspect existing code, git status, runtime versions, lockfiles, and applicable parent instructions before edits.
3. Start at the first incomplete gate. Preserve earlier work and user changes.
4. If source PDFs cannot be read, use the source URL in REFERENCES.md; document exactly which version was read.
5. Use installed tools and official SDK examples. Inspect real APIs rather than inventing package names, configuration, or wire formats.

## Sequential gates

Work M0 through M7 in order. Stay on the current milestone until its mandatory checks pass.
Record commands, outcomes, evidence paths, and relevant versions in PROGRESS.md and evidence/Mx.md.
Do not mark later milestones complete merely because code exists.
Fix failing checks and continue autonomously. Do not request user approval between ordinary milestones.
If an external blocker prevents progress, record it and stop dependent work; do not label a mock or skipped test as passing.
After a gate passes, proceed to the next milestone without waiting for confirmation.
Keep work proportional to the prototype. Gates may be tested through CLI and integration scripts; a web UI is unnecessary.

## Truthfulness and verification

Use actual contract execution for settlement. Never replace blockchain checks with hardcoded success.
Separate on-chain nonce enforcement from application-level idempotency.
Signature verification does not reserve funds; a transaction hash is not confirmation.
A timeout is pending/unknown until reconciled, not proof of failure.
Do not claim a local chain proves distributed consensus, real value, open discovery, or service quality.
Only rerun/broaden checks when changes affect them. Include meaningful integration and negative tests for funds and permissions.
Check clean restart behavior and matching chain/contract metadata after local resets.

## Continuity

Update PROGRESS.md after each milestone and before stopping/context compaction.
Update DECISIONS.md for dependency pins, wire versions, adapters, and departures from the paper.
Keep README.md synchronized with runnable commands as they become real.
Never document a command as verified unless run successfully.
Do not leave important decisions only in chat. Explain unfamiliar mechanisms briefly for a blockchain beginner.

## Development boundaries

Local development accounts and test funds only. Bind services to loopback by default.
Do not log/commit private keys or copy keys into documentation. Use ignored local configuration.
Client signer belongs only to the client. Facilitator gas signer belongs only to the facilitator.
Do not add public deployment, escrow, reputation, LLM infrastructure, or a general marketplace.
Do not modify the source PDFs.
Use standard crypto/token libraries; do not implement signature primitives yourself.
Follow the environment's git policy. Do not push or publish unless requested.

