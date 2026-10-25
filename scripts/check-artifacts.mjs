import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const secrets = ['client', 'facilitator'].map(role => {
  const file = `runtime/${role}-key.json`;
  assert.equal(fs.statSync(file).mode & 0o077, 0, `${role} key permissions must exclude group/other access`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).privateKey;
});
const roots = ['apps', 'packages', 'scripts', 'contracts', 'evidence', 'deployments', 'README.md', 'DECISIONS.md', 'PROGRESS.md', '.env.example'];
let checked = 0;
function inspect(file) {
  if (fs.statSync(file).isDirectory()) return fs.readdirSync(file).forEach(name => inspect(path.join(file, name)));
  const bytes = fs.readFileSync(file);
  for (const secret of secrets) assert(!bytes.includes(Buffer.from(secret)), `Private key leaked into ${file}`);
  checked++;
}
roots.forEach(inspect);
const paper = crypto.createHash('sha256').update(fs.readFileSync('a2a-x402-local/sources/paper.pdf')).digest('hex');
assert.equal(paper, '0fc98c4d1fefa81cc355372f2fff0d5a3fa733dbe29cba712937c7a5d3797519');
const report = { passed: true, authoredFilesChecked: checked, signerKeyPermissions: '0600', signerKeysFoundOutsideRuntime: false, originalPaperSha256: paper };
fs.writeFileSync('evidence/M7-hygiene.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
