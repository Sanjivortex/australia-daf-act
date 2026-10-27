// Online check: requests every source link and records the HTTP status in
// data/link-check.json (shown on the Sources page after npm run render).
// Uses curl so that proxy and certificate settings from the environment apply.
import { execFileSync } from 'node:child_process';
import { write, loadSources } from './lib.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const { list } = loadSources();
const targets = list.flatMap((s) => [{ n: s.n, id: s.id, url: s.url }, ...(s.alt || []).map((a) => ({ n: s.n, id: s.id, url: a.url }))]);

const results = targets.map((t) => {
  let status = 'error';
  try {
    status = execFileSync('curl', ['-sS', '-L', '-o', '/dev/null', '-w', '%{http_code}', '-A', UA, '--max-time', '45', t.url], { encoding: 'utf8' }).trim();
  } catch (e) {
    status = `error: ${String(e.stderr || e.message).trim().split('\n')[0]}`;
  }
  const ok = /^2\d\d$/.test(status);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${status} [${t.n}] ${t.url}`);
  return { ...t, status, ok };
});

const now = new Date();
const checkedOn = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Hong_Kong' });
write('data/link-check.json', JSON.stringify({ checkedOn, results }, null, 2) + '\n');
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} links OK.`);
process.exit(bad.length ? 1 : 0);
