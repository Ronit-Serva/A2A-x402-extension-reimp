import fs from 'node:fs';
import { decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { artifact, assertDeployment, deployment } from '../../../packages/shared/src/local.js';
import { readCard, EXTENSION, requirements } from '../../../packages/shared/src/card.js';
import { canonical } from '../../../packages/shared/src/store.js';
import { emit } from '../../../packages/shared/src/walkthrough.js';

// Re-send the exact stored SDK request and proof. Never create a new signature.
export async function resumePaid(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid stored request ID');
  const stored = JSON.parse(fs.readFileSync(`runtime/walkthrough-${id}.json`, 'utf8'));
  const config = deployment();
  const chain = await assertDeployment(config);
  const card = await readCard(config);
  if (stored.anchor.blockHash !== config.anchor.blockHash || canonical(stored.payload.accepted) !== canonical(requirements(config)) || JSON.parse(stored.body).params.message.messageId !== id) throw new Error('Stored attempt does not match the current deployment/request. Do not resubmit it.');
  const token = { address: config.token, abi: artifact('TestUSD').abi };
  const balances = async () => ({ client: String(await chain.readContract({ ...token, functionName: 'balanceOf', args: [config.client] })), card: String(await chain.readContract({ ...token, functionName: 'balanceOf', args: [config.agentCard] })) });
  const before = await balances();
  emit('client', 'reconciling', id, { message: 'Resending the same request and authorization; no new signature is created.' });
  const response = await fetch(card.supportedInterfaces[0].url, { method: 'POST', headers: { 'content-type': 'application/json', 'a2a-version': '1.0', 'a2a-extensions': EXTENSION, 'payment-signature': encodePaymentSignatureHeader(stored.payload) }, body: stored.body, signal: AbortSignal.timeout(240_000) });
  const result = await response.json();
  if (!response.ok || response.status === 202) throw new Error(`Stored attempt: HTTP ${response.status}: ${JSON.stringify(result)}`);
  const header = response.headers.get('payment-response');
  const output = { requestId: id, result: result.result, receipt: header ? decodePaymentResponseHeader(header) : undefined, challenges: 0, signatures: 0, before, after: await balances(), recovered: true };
  emit('client', 'result', id, output);
  return output;
}
