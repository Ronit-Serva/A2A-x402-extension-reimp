import { runPaid } from './run.js';
console.log(JSON.stringify(await runPaid(process.argv[2] ? JSON.parse(process.argv[2]) : undefined), null, 2));
