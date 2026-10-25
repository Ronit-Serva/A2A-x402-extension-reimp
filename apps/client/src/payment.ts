import type { AgentCard } from '@a2a-js/sdk';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import type { LocalAccount } from 'viem';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types';
import { requirements } from '../../../packages/shared/src/card.js';
import type { Deployment } from '../../../packages/shared/src/local.js';
import { canonical } from '../../../packages/shared/src/store.js';

export function checkChallenge(challenge: PaymentRequired, card: AgentCard, config: Deployment, budget = 2_000_000n) {
  const terms = requirements(config);
  if (challenge.x402Version !== 2 || challenge.resource.url !== card.supportedInterfaces[0].url || challenge.accepts.length !== 1
    || canonical(challenge.accepts[0]) !== canonical(terms) || BigInt(challenge.accepts[0].amount) > budget) throw new Error('Challenge differs from on-chain card or budget');
  return terms;
}
export function paidFetch(card: AgentCard, config: Deployment, account: LocalAccount, fetchImpl: typeof fetch = fetch) {
  const scheme = new ExactEvmScheme(toClientEvmSigner(account));
  const state: { signatures: number; challenges: number; receipt?: SettleResponse; payload?: PaymentPayload; requestBody?: string } = { signatures: 0, challenges: 0 };
  const fetchPayment: typeof fetch = async (input, init) => {
    let response = await fetchImpl(input, init);
    if (response.status === 402 && response.headers.get('payment-required')) {
      state.challenges++;
      const terms = checkChallenge(decodePaymentRequiredHeader(response.headers.get('payment-required')!), card, config);
      const created = await scheme.createPaymentPayload(2, terms);
      const payload: PaymentPayload = { x402Version: 2, accepted: terms, payload: created.payload };
      state.signatures++;
      state.payload = payload;
      state.requestBody = String(init?.body);
      const headers = new Headers(init?.headers);
      headers.set('PAYMENT-SIGNATURE', encodePaymentSignatureHeader(payload));
      response = await fetchImpl(input, { ...init, headers });
    }
    const receipt = response.headers.get('payment-response');
    if (receipt) state.receipt = decodePaymentResponseHeader(receipt);
    return response;
  };
  return { fetchPayment, state };
}
