import { runPaid } from './run.js';
import { diagnostic } from '../../../packages/shared/src/diagnostics.js';
import { emit } from '../../../packages/shared/src/walkthrough.js';
try {
  console.log(JSON.stringify(await runPaid(process.argv[2] ? JSON.parse(process.argv[2]) : undefined, process.env.LOCAL_RUN_ID), null, 2));
} catch (error) {
  const message = diagnostic(error);
  emit('client', 'failure', process.env.LOCAL_RUN_ID, { message });
  console.error(`Client: ${message}`);
  if (process.env.LOCAL_DEBUG === '1') console.error(error);
  process.exitCode = 1;
} finally {
  if (process.connected) process.disconnect?.();
}
