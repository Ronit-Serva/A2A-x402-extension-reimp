# Recording walkthrough

This is a script for a recording; no video has been produced.

1. Show README and the four-process architecture: node, facilitator, service,
   client. Explain that TestUSD has no real value.
2. Start a fresh node, compile and run `npm run m1:local`. Show only public
   deployment metadata. Avoid recording Hardhat's startup private-key listing
   or files under runtime/.
3. Start `npm run facilitator` and `npm run server` in separate terminals.
4. Run `npm run client`. Show the [2,4,6] result and balances 100/0→98/2.
   Explain that the client signs tokens, while the facilitator pays ETH gas.
5. Show the confirmed receipt hash and `evidence/M5-result.json` trace:
   challenge → verified → paid → execution → completed.
6. Show `evidence/M6-result.json`: duplicates charge once, pending does not
   execute, and lost responses/restarts reconcile the original transaction.
7. Explain known-address card retrieval, application body association, local
   chain limits and paid-but-undelivered exceptions. End by showing M7's clean
   reproduction result.

For an automated demonstration, stop manual processes and run
`npm run reproduce`. It owns its processes and stops them when finished.
