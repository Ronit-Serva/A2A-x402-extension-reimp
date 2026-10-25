import type { AgentCard } from '@a2a-js/sdk';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import type { LocalAccount } from 'viem';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types';
import { requirements } from '../../../packages/shared/src/card.js';
import type { Deployment } from '../../../packages/shared/src/local.js';
import { canonical } from '../../../packages/shared/src/store.js';
import fs from 'node:fs';
import { checkpoint, emit, walkthroughEnabled } from '../../../packages/shared/src/walkthrough.js';

export function checkChallenge(challenge: PaymentRequired, card: AgentCard, config: Deployment, budget = 2_000_000n) {
  const terms = requirements(config);
  if (challenge.x402Version !== 2 || challenge.resource.url !== card.supportedInterfaces[0].url || challenge.accepts.length !== 1
    || canonical(challenge.accepts[0]) !== canonical(terms) || BigInt(challenge.accepts[0].amount) > budget) throw new Error('Challenge differs from on-chain card or budget');
  return terms;
}
export function paidFetch(card: AgentCard, config: Deployment, account: LocalAccount, fetchImpl: typeof fetch = fetch, runId?: string) {
  const scheme = new ExactEvmScheme(toClientEvmSigner(account));
  const state: { signatures: number; challenges: number; receipt?: SettleResponse; payload?: PaymentPayload; requestBody?: string } = { signatures: 0, challenges: 0 };
  const fetchPayment: typeof fetch = async (input, init) => {
    if (walkthroughEnabled) init = { ...init, signal: AbortSignal.any([AbortSignal.timeout(240_000), ...(init?.signal ? [init.signal] : [])]) };
    emit('client', 'unpaid-request', runId, { endpoint: String(input), body: init?.body });
    let response = await fetchImpl(input, init);
    if (response.status === 402 && response.headers.get('payment-required')) {
      state.challenges++;
      const challenge = decodePaymentRequiredHeader(response.headers.get('payment-required')!);
      emit('client', 'challenge', runId, { status: response.status, challenge });
      const terms = checkChallenge(challenge, card, config);
      emit('client', 'terms-validated', runId, terms);
      await checkpoint('client', 'authorize', runId ?? '', terms);
      const created = await scheme.createPaymentPayload(2, terms);
      const payload: PaymentPayload = { x402Version: 2, accepted: terms, payload: created.payload };
      state.signatures++;
      state.payload = payload;
      state.requestBody = String(init?.body);
      if (walkthroughEnabled) {
        // Persist the proof in ignored local runtime before submission so interrupted
        // runs can be reconciled without creating a fresh authorization.
        fs.writeFileSync(`runtime/walkthrough-${runId}.json`, JSON.stringify({ requestId: runId, anchor: config.anchor, body: state.requestBody, payload }), { mode: 0o600 });
      }
      emit('client', 'authorized', runId, { authorization: payload.payload.authorization });
      await checkpoint('client', 'paid-retry', runId ?? '', { authorization: payload.payload.authorization });
      const authorization = payload.payload.authorization as { validBefore?: string };
      if (authorization.validBefore && Number(authorization.validBefore) * 1000 <= Date.now()) throw new Error('Authorization expired before submission. This attempt was not submitted; begin a new walkthrough.');
      const headers = new Headers(init?.headers);
      headers.set('PAYMENT-SIGNATURE', encodePaymentSignatureHeader(payload));
      emit('client', 'paid-retry', runId, { endpoint: String(input) });
      response = await fetchImpl(input, { ...init, headers, ...(walkthroughEnabled ? { signal: AbortSignal.timeout(240_000) } : {}) });
    }
    const receipt = response.headers.get('payment-response');
    if (receipt) state.receipt = decodePaymentResponseHeader(receipt);
    return response;
  };
  return { fetchPayment, state };
}
