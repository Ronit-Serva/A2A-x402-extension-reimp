import type { RequestHandler } from 'express';
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import type { PaymentPayload, SettleResponse, VerifyResponse } from '@x402/core/types';
import { EXTENSION, requirements, readCard } from '../../../packages/shared/src/card.js';
import { digest, durable, statePath } from '../../../packages/shared/src/store.js';
import type { Deployment } from '../../../packages/shared/src/local.js';

interface RecordEntry { bodyHash: string; proofHash: string; authKey: string; payer: string; status: string; receipt?: SettleResponse; response?: Record<string, unknown>; executed?: boolean; fault?: string }
interface State { requests: Record<string, RecordEntry>; authorizations: Record<string, string>; logicalExecutions: number; physicalExecutions: number; trace: unknown[] }
export function createPaymentGate(config: Deployment, sdkHandler: RequestHandler) {
  const store = durable<State>(statePath(config, 'requests'), { requests: {}, authorizations: {}, logicalExecutions: 0, physicalExecutions: 0, trace: [] });
  const terms = requirements(config);
  let tail = Promise.resolve();
  const trace = (event: string, id: string, extra: unknown = {}) => { store.state.trace.push({ at: new Date().toISOString(), event, id, ...extra as object }); store.save(); };
  async function facilitator<T>(route: string, payload: PaymentPayload, fault?: string): Promise<T> {
    const response = await fetch(`http://127.0.0.1:4022/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(fault ? { 'x-local-fault': fault } : {}) }, body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: terms }), signal: AbortSignal.timeout(125_000) });
    const result = await response.json();
    if (!response.ok) throw new Error(`Facilitator ${route}: ${result.errorReason ?? result.invalidReason ?? response.status}`);
    return result;
  }
  const middleware: RequestHandler = (req, res) => {
    const operation = async () => {
      await readCard(config);
      const id = req.body?.params?.message?.messageId;
      if (req.body?.method !== 'SendMessage' || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return res.status(400).json({ error: 'Expected SendMessage with a stable messageId' });
      const message = req.body.params.message;
      if (message.taskId || message.contextId || message.referenceTaskIds?.length || req.body.params.configuration?.returnImmediately) return res.status(400).json({ error: 'Only standalone blocking statistics requests are supported' });
      if (req.header('a2a-version') !== '1.0' || !req.header('a2a-extensions')?.split(',').map(item => item.trim()).includes(EXTENSION)) return res.status(400).json({ error: 'A2A 1.0 and payment extension activation required' });
      const bodyHash = digest(req.body.params);
      const old = store.state.requests[id];
      if (old && old.bodyHash !== bodyHash) return res.status(409).json({ error: 'Request identity already has a different body' });
      const proof = req.header('payment-signature');
      const fault = process.env.LOCAL_FAULTS === '1' ? req.header('x-local-fault') : undefined;
      if (!proof) {
        trace('challenge', id);
        res.set('PAYMENT-REQUIRED', encodePaymentRequiredHeader({ x402Version: 2, resource: { url: 'http://127.0.0.1:4021', mimeType: 'application/json' }, accepts: [terms] }));
        return res.status(402).json({ error: 'Payment required' });
      }
      const payload = decodePaymentSignatureHeader(proof);
      const auth = payload.payload.authorization as { from?: string; nonce?: string } | undefined;
      if (!auth?.from || !auth.nonce) return res.status(400).json({ error: 'EIP-3009 proof required' });
      const authKey = `${terms.network}:${terms.asset}:${auth.from}:${auth.nonce}`.toLowerCase();
      const proofHash = digest(payload);
      if ((old && (old.proofHash !== proofHash || old.authKey !== authKey)) || (store.state.authorizations[authKey] && store.state.authorizations[authKey] !== id)) return res.status(409).json({ error: 'Payment association conflict' });
      if (old?.receipt?.success) res.set('PAYMENT-RESPONSE', encodePaymentResponseHeader(old.receipt));
      if (old?.status === 'completed') return res.json({ ...old.response, id: req.body.id });
      if (old?.status === 'paid-undelivered' || old?.status === 'failed') return res.status(409).json({ error: old.status, transaction: old.receipt?.transaction });
      let record = old;
      if (!record?.receipt?.success) {
        if (!record) {
          const verified = await facilitator<VerifyResponse>('verify', payload);
          if (!verified.isValid) return res.status(402).json({ error: verified.invalidReason });
          record = { bodyHash, proofHash, authKey, payer: auth.from, status: 'verified', fault: fault === 'service-exception' ? fault : undefined };
          store.state.requests[id] = record;
          store.state.authorizations[authKey] = id;
          trace('verified', id);
        }
        const receipt = await facilitator<SettleResponse>('settle', payload, fault === 'drop-facilitator-response' ? 'drop-settle-response' : fault === 'crash-before-hash-persistence' ? fault : undefined);
        record.receipt = receipt;
        record.status = receipt.success ? 'paid' : receipt.errorReason === 'settlement_pending' || receipt.errorReason === 'settlement_unknown' ? 'pending' : 'failed';
        trace(record.status, id, { transaction: receipt.transaction });
        if (!receipt.success) return res.status(record.status === 'pending' ? 202 : 402).json({ error: record.status, receipt });
      }
      if (fault === 'crash-after-settlement') process.exit(74);
      res.set('PAYMENT-RESPONSE', encodePaymentResponseHeader(record.receipt!));
      const originalJson = res.json.bind(res);
      res.json = (body: Record<string, unknown>) => {
        record!.response = body;
        const result = body.result as { task?: { status?: { state?: string } } } | undefined;
        record!.status = body.error || result?.task?.status?.state === 'TASK_STATE_FAILED' || res.statusCode >= 400 ? 'paid-undelivered' : 'completed';
        trace(record!.status, id);
        if (fault === 'drop-result-response') { res.destroy(); return res; }
        return originalJson(body);
      };
      await new Promise<void>((resolve, reject) => {
        res.once('finish', resolve); res.once('close', resolve);
        sdkHandler(req, res, error => error ? reject(error) : resolve());
      });
    };
    const current = tail.then(operation);
    tail = current.then(() => {}, () => {});
    void current.catch(error => { if (!res.headersSent) res.status(503).json({ error: (error as Error).message }); });
  };
  return {
    middleware,
    recordExecution(id: string) {
      const record = store.state.requests[id];
      if (!record?.receipt?.success) throw new Error('Confirmed settlement required');
      store.state.physicalExecutions++;
      if (!record.executed) { record.executed = true; store.state.logicalExecutions++; }
      trace('execution', id, { transaction: record.receipt.transaction });
    },
    getExecutions: () => store.state.logicalExecutions,
    shouldFail: (id: string) => store.state.requests[id]?.fault === 'service-exception',
    state: store.state,
  };
}
