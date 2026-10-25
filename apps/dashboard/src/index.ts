import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import express, { type Response } from 'express';
import { decodeEventLog } from 'viem';
import { artifact, assertDeployment, deployment } from '../../../packages/shared/src/local.js';
import { diagnostic } from '../../../packages/shared/src/diagnostics.js';
import { lineReader, sanitize } from './events.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
process.chdir(root);
const port = 4030;
const origin = `http://127.0.0.1:${port}`;
const sessionToken = crypto.randomBytes(24).toString('hex');
const sessionId = crypto.randomUUID();
const allowed = ['node', 'compile', 'deploy', 'facilitator', 'server', 'client'] as const;
type Name = typeof allowed[number];
type Managed = { child: ChildProcess; state: string; code?: number | null; startedAt: string };
type Event = { id: number; timestamp: string; source: string; type: string; runId?: string; data?: any };
type Run = { id: string; status: string; startedAt: string; numbers: number[]; deploymentAnchor: string; checkpoint?: any; events: Event[]; result?: any; transaction?: string; error?: string; submitted?: boolean; resolved?: boolean };
const processes = new Map<Name, Managed>();
const listeners = new Set<Response>();
const events: Event[] = [];
const runs = new Map<string, Run>();
const historyPath = 'runtime/dashboard-runs.json';
try {
  const history: Run[] = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  for (const run of history.slice(-30)) {
    if (['waiting', 'running'].includes(run.status)) { run.status = 'interrupted — inspect payment'; run.error = 'Dashboard session ended during this attempt. Restore matching services and reconcile the same attempt.'; }
    run.checkpoint = undefined;
    runs.set(run.id, run);
  }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Dashboard history could not be read; existing payment stores were preserved.'); }
function saveRuns() {
  fs.mkdirSync('runtime', { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${historyPath}.tmp`, json([...runs.values()].slice(-30)), { mode: 0o600 });
  fs.renameSync(`${historyPath}.tmp`, historyPath);
}
let sequence = 0;
let busy = false;
let activeId: string | undefined;
let snapshot: any = { loading: true, processes: {}, deployment: { valid: false }, runtime: { node: process.version }, sessionId };
const json = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
function publish(source: string, type: string, data?: unknown, runId?: string, timestamp = new Date().toISOString()) {
  const event: Event = { id: ++sequence, timestamp, source, type, runId, data: sanitize(data) };
  events.push(event);
  if (events.length > 1500) events.shift();
  const run = runId ? runs.get(runId) : undefined;
  if (run) {
    if (run.events.length < 500) run.events.push(event);
    if (type === 'checkpoint') { run.checkpoint = { ...event.data, source }; run.status = 'waiting'; }
    if (type === 'paid-retry' || type === 'submitted' || type === 'paid' || type === 'reconciling') run.submitted = true;
    if (event.data?.transaction) run.transaction = event.data.transaction;
    if (type === 'result') { run.result = event.data; run.status = 'complete'; run.checkpoint = undefined; }
    if (type === 'failure') { run.error = event.data?.message; run.status = run.submitted ? 'interrupted — inspect payment' : 'failed'; run.checkpoint = undefined; }
    saveRuns();
  }
  for (const response of listeners) {
    if (response.writableLength > 512_000) { response.end(); listeners.delete(response); continue; }
    response.write(`id: ${event.id}\ndata: ${json(event)}\n\n`);
  }
  return event;
}
async function occupied(portNumber: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: portNumber });
    const finish = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.setTimeout(500, () => finish(true));
  });
}
async function health(url: string) {
  try { const res = await fetch(url, { signal: AbortSignal.timeout(1200) }); const data = await res.json(); return { ready: res.ok && data.ok === true, data }; }
  catch { return { ready: false, data: undefined }; }
}
async function refresh() {
  const [facilitator, server, nodePort, facilitatorPort, serverPort] = await Promise.all([
    health('http://127.0.0.1:4022/health'), health('http://127.0.0.1:4021/health'), occupied(8545), occupied(4022), occupied(4021),
  ]);
  let nodeReady = false;
  if (nodePort) {
    try {
      const res = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: json({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(1200) });
      nodeReady = (await res.json()).result === '0x7a69';
    } catch { /* A listener is not necessarily the expected local node. */ }
  }
  let manifest: any;
  let deployed: any = { valid: false, error: nodeReady ? 'Deploy the local fixture.' : 'Start the local blockchain.' };
  try { manifest = deployment(); } catch { /* Public manifest does not exist yet. */ }
  if (manifest && nodeReady) {
    try {
      const chain = await assertDeployment(manifest);
      const token = { address: manifest.token, abi: artifact('TestUSD').abi };
      const [client, card, gas, clientEth, block] = await Promise.all([
        chain.readContract({ ...token, functionName: 'balanceOf', args: [manifest.client] }),
        chain.readContract({ ...token, functionName: 'balanceOf', args: [manifest.agentCard] }),
        chain.getBalance({ address: manifest.facilitator }), chain.getBalance({ address: manifest.client }), chain.getBlockNumber(),
      ]);
      deployed = { valid: true, manifest, balances: { client: String(client), card: String(card), facilitatorEth: String(gas), clientEth: String(clientEth) }, block: String(block), checkedAt: new Date().toISOString() };
    } catch (error) { deployed = { valid: false, manifest, error: diagnostic(error) }; }
  } else if (manifest) deployed.manifest = manifest;
  const serviceInfo = (name: Name, ready: boolean, inUse: boolean, detail?: any) => {
    const managed = processes.get(name);
    return { ready, occupied: inUse, ownership: managed?.state === 'running' ? 'dashboard' : inUse ? 'external' : 'none', state: managed?.state ?? 'stopped', pid: managed?.state === 'running' ? managed.child.pid : undefined, code: managed?.code, detail };
  };
  const matches = (value: any) => deployed.valid && value?.anchor?.blockHash === manifest?.anchor?.blockHash;
  snapshot = {
    sessionId, runtime: { node: process.version, dependencies: fs.existsSync('node_modules/@a2a-js/sdk/package.json'), compiled: fs.existsSync('artifacts/contracts/TestUSD.sol/TestUSD.json') },
    processes: { node: serviceInfo('node', nodeReady, nodePort), facilitator: serviceInfo('facilitator', facilitator.ready && matches(facilitator.data), facilitatorPort, facilitator.data), server: serviceInfo('server', server.ready && matches(server.data), serverPort, server.data), compile: serviceInfo('compile', false, false), deploy: serviceInfo('deploy', false, false) },
    deployment: deployed, busy, activeRun: activeId ? runs.get(activeId) : undefined, runs: [...runs.values()].slice(-30).map(({ events: _events, ...run }) => run),
  };
}
const isRunning = (name: Name) => processes.get(name)?.state === 'running';
function launch(name: Name, args: string[], env: Record<string, string> = {}, runId?: string) {
  if (isRunning(name)) throw new Error(`${name} is already running`);
  const child = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, LOCAL_FAULTS: '0', LOCAL_WALKTHROUGH: '1', LOCAL_RUN_ID: '', LOCAL_RESUME_ID: '', ...env } });
  const managed: Managed = { child, state: 'running', startedAt: new Date().toISOString() };
  processes.set(name, managed);
  for (const [stream, output] of [['stdout', child.stdout], ['stderr', child.stderr]] as const) {
    const reader = lineReader(line => publish(name, 'log', { stream, message: line }, runId));
    output!.on('data', chunk => reader.write(chunk)); output!.on('end', () => reader.end());
  }
  child.on('message', (message: any) => {
    if (message?.kind === 'event') publish(name, message.type, message.data, message.runId ?? runId, message.timestamp);
  });
  child.on('error', error => {
    managed.state = 'failed';
    if (name === 'compile' || name === 'deploy') busy = false;
    if (runId) activeId = undefined;
    publish(name, 'failure', { message: diagnostic(error) }, runId);
  });
  child.on('exit', (code, signal) => {
    managed.state = code === 0 ? 'complete' : signal === 'SIGTERM' ? 'stopped' : 'failed'; managed.code = code;
    if (name === 'compile' || name === 'deploy') busy = false;
    if (runId) {
      const run = runs.get(runId)!;
      if (run.status !== 'complete' && !run.error) { run.status = run.submitted ? 'interrupted — inspect payment' : 'failed'; run.error = `Client exited (${signal ?? code}). Inspect stored request and receipt before retrying.`; }
      run.checkpoint = undefined;
      processes.get('server')?.child.send?.({ kind: 'cancel', runId }, () => {});
      activeId = undefined;
    }
    publish(name, 'process-exit', { code, signal }, runId);
    void refresh();
  });
  publish(name, 'process-start', { pid: child.pid }, runId);
  return child;
}
function send(name: Name, message: any) {
  const child = processes.get(name)?.child;
  if (!child?.connected) throw new Error(`${name} is not controlled by this dashboard`);
  child.send(message);
}
function stop(name: Name) {
  const managed = processes.get(name);
  if (!managed || managed.state !== 'running' || !managed.child.pid) throw new Error(`No dashboard-owned ${name} process to stop`);
  process.kill(-managed.child.pid, 'SIGTERM');
}
async function action(name: string) {
  await refresh();
  if (activeId || busy) throw new Error('Finish or cancel the active operation first.');
  if (name === 'node') {
    if (snapshot.processes.node.occupied) throw new Error('Port 8545 is already occupied. Inspect the existing node; the dashboard will not replace it.');
    launch('node', ['node_modules/hardhat/dist/src/cli.js', 'node', '--hostname', '127.0.0.1']);
  } else if (name === 'compile') {
    busy = true;
    launch('compile', ['scripts/compile.mjs']);
  } else if (name === 'deploy') {
    if (!snapshot.processes.node.ready) throw new Error('Start the local blockchain first.');
    if (snapshot.processes.server.occupied || snapshot.processes.facilitator.occupied) throw new Error('Stop the server and facilitator before replacing deployment metadata. Stop externally owned services in their terminals.');
    if (!snapshot.runtime.compiled) throw new Error('Compile the contracts first.');
    busy = true;
    launch('deploy', ['scripts/m1-local.mjs']);
  } else if (name === 'facilitator' || name === 'server') {
    if (!snapshot.deployment.valid) throw new Error(snapshot.deployment.error);
    if (snapshot.processes[name].occupied) throw new Error(`${name} port is occupied; stop it in its original terminal for full browser control.`);
    if (name === 'server' && !snapshot.processes.facilitator.ready) throw new Error('Start the facilitator first.');
    launch(name, ['--import', 'tsx', name === 'server' ? 'apps/server/src/index.ts' : 'scripts/facilitator.mjs']);
  } else throw new Error('Unknown action');
}
async function evidence(run: Run) {
  const manifest = deployment();
  if (manifest.anchor.blockHash !== run.deploymentAnchor) return { requestId: run.id, status: 'Historical run belongs to a different deployment; its receipt has not been revalidated on this chain.' };
  const chain = await assertDeployment(manifest);
  let record: any;
  try { record = JSON.parse(fs.readFileSync(`runtime/${manifest.anchor.blockHash}/requests.json`, 'utf8')).requests[run.id]; } catch { /* No paid request recorded yet. */ }
  const hash = run.transaction ?? record?.receipt?.transaction ?? run.result?.receipt?.transaction;
  if (!hash) return { requestId: run.id, applicationStatus: record?.status, status: record?.status ?? 'No settlement transaction observed', transaction: null };
  try {
    const receipt = await chain.getTransactionReceipt({ hash });
    const contractEvents = receipt.logs.filter(log => log.address.toLowerCase() === manifest.token.toLowerCase()).flatMap(log => {
      try { const decoded = decodeEventLog({ abi: artifact('TestUSD').abi, data: log.data, topics: log.topics }); return [{ event: decoded.eventName, args: decoded.args }]; } catch { return []; }
    });
    return sanitize({ requestId: run.id, applicationStatus: record?.status, receipt: { transactionHash: hash, status: receipt.status, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, gasUsed: receipt.gasUsed }, events: contractEvents });
  } catch { return { requestId: run.id, transaction: hash, status: 'pending or unavailable; no confirmation established' }; }
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return res.status(403).json({ error: 'Invalid local host' });
  if (req.method !== 'GET' && (req.headers.origin !== origin && req.headers.origin !== `http://localhost:${port}` || req.headers['x-dashboard-token'] !== sessionToken)) return res.status(403).json({ error: 'Use this dashboard session from its local browser page.' });
  next();
});
app.use(express.json({ limit: '32kb', strict: true }));
app.get('/api/status', (_req, res) => res.json({ ...snapshot, sessionToken }));
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive' }); res.flushHeaders();
  const after = Number(req.headers['last-event-id'] ?? 0);
  res.write(`event: session\ndata: ${json({ sessionId, oldestId: events[0]?.id, historyTruncated: events.length > 0 && (after ? after < events[0].id - 1 : events[0].id > 1) })}\n\n`);
  for (const event of events) if (event.id > after) res.write(`id: ${event.id}\ndata: ${json(event)}\n\n`);
  listeners.add(res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
  req.on('close', () => { clearInterval(heartbeat); listeners.delete(res); });
});
let mutationTail = Promise.resolve();
const route = (operation: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    const task = req.method === 'GET' ? operation(req) : mutationTail.then(() => operation(req));
    if (req.method !== 'GET') mutationTail = task.then(() => {}, () => {});
    res.json(await task);
  } catch (error) { res.status(409).json({ error: diagnostic(error) }); }
};
app.post('/api/actions/:action', route(async req => { await action(req.params.action); return { ok: true }; }));
app.post('/api/processes/:name/stop', route(async req => {
  if (!['node', 'server', 'facilitator'].includes(req.params.name)) throw new Error('Unknown process');
  if (activeId || busy) throw new Error('Finish or cancel the active operation first.');
  if (req.params.name === 'node' && (isRunning('server') || isRunning('facilitator'))) throw new Error('Stop the server and facilitator before the blockchain. Restarting the node loses its in-memory chain.');
  stop(req.params.name); return { ok: true };
}));
app.post('/api/runs', route(async req => {
  if (activeId || busy) throw new Error('A run or setup operation is active.');
  await refresh();
  if ([...runs.values()].some(run => run.submitted && run.status !== 'complete' && !run.resolved && run.deploymentAnchor === snapshot.deployment.manifest?.anchor.blockHash)) throw new Error('An interrupted payment attempt needs reconciliation. Select it and use Reconcile same attempt before starting a new paid run.');
  const numbers = req.body?.numbers;
  if (!Array.isArray(numbers) || numbers.length < 1 || numbers.length > 1000 || !numbers.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12)) throw new Error('Enter 1–1000 finite numbers with magnitude at most 1e12.');
  if (!snapshot.deployment.valid || !snapshot.processes.server.ready || !snapshot.processes.facilitator.ready) throw new Error('Deploy a valid fixture and start both services first.');
  if (snapshot.processes.server.ownership !== 'dashboard' || snapshot.processes.facilitator.ownership !== 'dashboard') throw new Error('For manual checkpoints, stop externally started services in their terminals and start them here.');
  if (BigInt(snapshot.deployment.balances.client) < 2_000_000n) throw new Error('Client has less than 2 TestUSD. Stop the services and deploy a fresh fixture.');
  const id = crypto.randomUUID();
  const run: Run = { id, status: 'running', startedAt: new Date().toISOString(), numbers, events: [], deploymentAnchor: snapshot.deployment.manifest.anchor.blockHash };
  runs.set(id, run); activeId = id;
  if (runs.size > 30) { const oldest = [...runs.values()].find(item => item.id !== id && (item.status === 'complete' || !item.submitted || item.deploymentAnchor !== run.deploymentAnchor)); if (oldest) runs.delete(oldest.id); }
  send('server', { kind: 'arm', runId: id });
  launch('client', ['--import', 'tsx', 'apps/client/src/index.ts', json(numbers)], { LOCAL_RUN_ID: id }, id);
  return run;
}));
app.post('/api/runs/:id/reconcile', route(async req => {
  if (activeId || busy) throw new Error('Finish the active operation first.');
  const run = runs.get(req.params.id);
  if (!run || run.status === 'complete' || run.resolved) throw new Error('Select an interrupted attempt.');
  await refresh();
  if (!snapshot.deployment.valid || snapshot.deployment.manifest.anchor.blockHash !== run.deploymentAnchor || !snapshot.processes.server.ready || !snapshot.processes.facilitator.ready || snapshot.processes.server.ownership !== 'dashboard') throw new Error('Restore matching deployment and dashboard-owned services before reconciliation.');
  if (!fs.existsSync(`runtime/walkthrough-${run.id}.json`)) throw new Error('This attempt never created an authorization. Start a new walkthrough.');
  run.error = undefined; run.status = 'running'; activeId = run.id;
  send('server', { kind: 'arm', runId: run.id });
  launch('client', ['--import', 'tsx', 'apps/client/src/index.ts'], { LOCAL_RUN_ID: run.id, LOCAL_RESUME_ID: run.id }, run.id);
  return { ok: true };
}));
app.post('/api/runs/:id/close', route(async req => {
  if (activeId || busy) throw new Error('Finish the active operation first.');
  const run = runs.get(req.params.id);
  if (!run) throw new Error('Unknown run');
  if (run.deploymentAnchor !== deployment().anchor.blockHash) throw new Error('This run belongs to a different deployment.');
  const observed = await evidence(run);
  if (!['failed', 'paid-undelivered', 'completed'].includes(observed.applicationStatus)) throw new Error('There is no definitive stored outcome to acknowledge. Pending or unknown payment must be reconciled.');
  run.resolved = true; run.status = `closed — ${observed.applicationStatus}`;
  publish('dashboard', 'outcome-acknowledged', observed, run.id);
  return { ok: true };
}));
app.get('/api/runs/:id', route(async req => {
  const run = runs.get(req.params.id); if (!run) throw new Error('Unknown run');
  let observed;
  try { observed = await evidence(run); }
  catch (error) { observed = { status: `Live evidence unavailable: ${diagnostic(error)}` }; }
  return { ...run, evidence: observed };
}));
app.post('/api/runs/:id/continue', route(async req => {
  const run = runs.get(req.params.id);
  if (!run || activeId !== run.id || !run.checkpoint || run.checkpoint.checkpointId !== req.body?.checkpointId) throw new Error('This checkpoint is no longer active.');
  if (Date.now() >= run.checkpoint.expiresAt) throw new Error('Checkpoint expired. Inspect this run before starting another.');
  const point = run.checkpoint;
  run.checkpoint = undefined; run.status = 'running';
  send(point.source, { kind: 'continue', runId: run.id, checkpointId: point.checkpointId });
  publish('dashboard', 'continued', { stage: point.stage }, run.id);
  return { ok: true };
}));
app.post('/api/runs/:id/cancel', route(async req => {
  const run = runs.get(req.params.id);
  if (!run || activeId !== run.id) throw new Error('No active run');
  send('server', { kind: 'cancel', runId: run.id });
  send('client', { kind: 'cancel', runId: run.id });
  run.status = run.submitted ? 'interrupted — inspect payment' : 'cancelled'; run.checkpoint = undefined;
  run.error = 'Cancelled. A submitted transaction cannot be cancelled here. Inspect the receipt and stored application status.';
  saveRuns();
  stop('client');
  return { ok: true };
}));
app.use(express.static(path.join(root, 'apps/dashboard/public')));
app.use((error: Error, _req: any, res: any, _next: any) => res.status(400).json({ error: diagnostic(error) }));
await refresh();
const httpServer = app.listen(port, '127.0.0.1', () => console.log(`A2A payment lab: ${origin}\nStart the blockchain and advance each step in your browser. Ctrl+C stops dashboard-owned processes.`));
httpServer.on('error', error => { console.error(diagnostic(error)); clearInterval(refreshTimer); process.exitCode = 1; });
const refreshTimer = setInterval(() => { if (!busyRefresh) { busyRefresh = true; void refresh().finally(() => { busyRefresh = false; }); } }, 2000);
let busyRefresh = false;
let closing = false;
function shutdown() {
  if (closing) return; closing = true; clearInterval(refreshTimer);
  for (const [name, managed] of processes) if (managed.state === 'running') { try { stop(name); } catch { /* Child exited concurrently. */ } }
  for (const listener of listeners) listener.end();
  httpServer.close();
  setTimeout(() => {
    for (const managed of processes.values()) if (managed.state === 'running' && managed.child.pid) { try { process.kill(-managed.child.pid, 'SIGKILL'); } catch {} }
    process.exit(0);
  }, 2000).unref();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
