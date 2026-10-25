import crypto from 'node:crypto';
import express from 'express';
import { Message } from '@a2a-js/sdk';
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, type AgentExecutor } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { RequestMalformedError, TaskNotCancelableError } from '@a2a-js/sdk/errors';
import { deployment } from '../../../packages/shared/src/local.js';
import { readCard } from '../../../packages/shared/src/card.js';
import { numbersFromMessage, statistics } from '../../../packages/shared/src/statistics.js';
import { createPaymentGate } from './payment-gate.js';
import { assertDeployment } from '../../../packages/shared/src/local.js';

export async function createService(options: { unpaidHarness?: boolean } = {}) {
  const config = deployment();
  const card = await readCard(config);
  let executions = 0;
  let gate: ReturnType<typeof createPaymentGate> | undefined;
  const executor: AgentExecutor = {
    async execute(context, bus) {
      let numbers: number[];
      try { numbers = numbersFromMessage(context.userMessage); }
      catch (error) { throw new RequestMalformedError((error as Error).message); }
      executions++;
      if (!options.unpaidHarness) gate!.recordExecution(context.userMessage.messageId);
      if (gate?.shouldFail(context.userMessage.messageId)) throw new Error('Injected service exception after settlement');
      bus.publish(AgentEvent.message(Message.fromJSON({ messageId: crypto.randomUUID(), contextId: context.contextId, role: 'ROLE_AGENT', parts: [{ data: statistics(numbers), mediaType: 'application/json' }] })));
    },
    async cancelTask() { throw new TaskNotCancelableError('Statistics calls complete immediately'); },
  };
  const handler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);
  const sdkHandler = jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication });
  if (!options.unpaidHarness) gate = createPaymentGate(config, sdkHandler);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.get('/health', async (_req, res) => {
    try { await assertDeployment(config); res.json({ ok: true, anchor: config.anchor, executions: gate?.getExecutions() ?? executions, mode: options.unpaidHarness ? 'unpaid-test-harness' : 'payment-required' }); }
    catch (error) { res.status(503).json({ ok: false, error: (error as Error).message }); }
  });
  app.use('/.well-known/agent-card.json', agentCardHandler({ agentCardProvider: handler }));
  app.post('/', (req, res, next) => {
    if (req.body?.method === 'SendMessage') {
      try { numbersFromMessage(Message.fromJSON(req.body.params?.message ?? {})); }
      catch (error) { return res.status(400).json({ jsonrpc: '2.0', id: req.body.id ?? null, error: { code: -32602, message: (error as Error).message } }); }
    }
    return next();
  }, options.unpaidHarness ? sdkHandler : gate!.middleware);
  return { app, card, getExecutions: () => gate?.getExecutions() ?? executions };
}
