// Offline checks for the deliverable. Exits non-zero on any failure.
// Run with: npm run check
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ROOT, PUB, PAGES, read, exists, readJson, loadSources, citedIds, blockContent, esc,
  textOf, xLength, threadPosts,
} from './lib.mjs';

const failures = [];
const passes = [];
const check = (ok, msg) => (ok ? passes : failures).push(msg);

const { list, byId } = loadSources();
const claims = readJson('data/claims.json');
const html = Object.fromEntries(PAGES.map((p) => [p, read(`public/${p}`)]));
const texts = Object.fromEntries(PAGES.map((p) => [p, textOf(html[p].replace(/<script[\s\S]*?<\/script>/g, ''))]));

// 1. Sources are well formed.
for (const s of list) {
  check(/^https:\/\//.test(s.url), `source ${s.id} uses https`);
  for (const a of s.alt || []) check(/^https:\/\//.test(a.url), `source ${s.id} alt link uses https`);
  check(Boolean(s.title && s.publisher && s.date && s.kind && s.supports), `source ${s.id} has title, publisher, date, kind and use`);
}
const primary = list.filter((s) => ['Primary law', 'Parliament', 'Government', 'Regulator (ASIC)'].includes(s.kind));
check(primary.length >= 8, `at least 8 primary or official sources (found ${primary.length})`);

// 2. Every citation resolves, and every source is used in the explainer.
for (const page of PAGES) {
  for (const m of html[page].matchAll(/<a class="cite" href="#src-([a-z0-9]+)"[^>]*>([^<]*)<\/a>/g)) {
    const s = byId.get(m[1]);
    check(Boolean(s), `${page}: citation #src-${m[1]} points to a listed source`);
    if (s) check(m[2] === `[${s.n}]`, `${page}: citation to ${m[1]} is rendered as [${s.n}] (run npm run render)`);
  }
}
const explainerIds = citedIds(html['index.html']);
for (const s of list) check(explainerIds.includes(s.id), `source ${s.id} is cited in the explainer`);
for (const page of PAGES) {
  const block = blockContent(html[page], 'SOURCES') || '';
  for (const id of citedIds(html[page])) check(block.includes(`id="src-${id}"`), `${page}: source list includes cited source ${id}`);
}
for (const c of claims.claims) check(byId.has(c.src), `claim "${c.claim.slice(0, 40)}..." uses a listed source`);
for (const page of PAGES) {
  check((html[page].match(/<!-- SOURCES:START -->/g) || []).length === 1, `${page}: exactly one rendered source list`);
}
for (const s of list) check(html['index.html'].includes(esc(s.supports)), `source ${s.id}: rendered description matches data/sources.json`);

// 3. The "not legal advice" statement opens every page and every download.
for (const page of PAGES) {
  const before = html[page].split('<main')[0];
  check(/not legal advice/i.test(textOf(before)), `${page}: "not legal advice" statement appears before the main content`);
}
for (const f of ['public/downloads/community-summary.md', 'public/downloads/sources.md']) {
  if (exists(f)) check(/not legal (or financial )?advice/i.test(read(f)) || f.endsWith('sources.md'), `${f}: carries the not-legal-advice statement`);
}

// 4. Dates: the explainer uses ASIC's latest commencement date; 9 April 2027 only appears in the date note.
const idx = html['index.html'];
check(idx.includes('8 April 2027'), 'explainer states the 8 April 2027 commencement date');
check(idx.includes('7 October 2027'), 'explainer states the 7 October 2027 transition deadline');
const note = idx.match(/<div class="callout" id="date-note">[\s\S]*?<\/div>/)?.[0] || '';
const nineOutside = idx.replace(note, '').replace(blockContent(idx, 'SOURCES') || '', '').match(/9 April 2027/g) || [];
check(note.includes('9 April 2027') && nineOutside.length === 0, '"9 April 2027" appears only inside the date note (and the source descriptions)');
for (const [label, re] of [['$10 million', /\$10 million/], ['$5,000', /\$5,000/], ['8 April 2026', /8 April 2026/], ['27 November 2026', /27 November 2026/]]) {
  check(re.test(idx), `explainer states ${label}`);
}

// 5. X thread posts fit in 280 characters.
const posts = threadPosts(html['summary.html']);
check(posts.length >= 5, `summary has an X thread (found ${posts.length} posts)`);
for (const p of posts) check(xLength(p.text) <= 280, `post ${p.n} is ${xLength(p.text)} characters (limit 280)`);

// 6. Banned content: personal credit, price talk, unsupported compliance claims.
const allText = Object.values(texts).join('\n') + '\n' +
  ['public/downloads/community-summary.md', 'public/downloads/sources.md', 'README.md'].filter(exists).map(read).join('\n');
const deliverableText = Object.values(texts).join('\n');
const creditPatterns = [/\b(made|created|written|prepared|designed|built|authored|compiled) by\s+(me|us|the author|@|[A-Z][a-z]+\s[A-Z][a-z]+)/, /\bmade with\b/i, /\bauthor:/i, /(^|\s)@[A-Za-z0-9_]{2,}/m];
for (const re of creditPatterns) check(!re.test(deliverableText), `no personal credit or tool attribution matching ${re}`);
const pricePatterns = [/\bprice (target|prediction|action)\b/i, /\bto the moon\b/i, /\bbuy (now|the dip)\b/i, /\bguaranteed\b/i, /\breturns? of\b/i, /\bprofit\b/i, /\b\d+x\b/, /\bRBNT (price|value)\b/i, /\bundervalued\b/i, /\bbullish\b/i];
for (const re of pricePatterns) check(!re.test(deliverableText), `no price talk or return promises matching ${re}`);
const sentences = deliverableText.split(/(?<=[.!?])\s+|\n+/);
const claimRe = /\b(redbelly( network)?|tokeniser|(an|any|the|every) issuer|issuers)\b[^.]{0,40}\b(is|are|has been|have been)\s+(now\s+)?(fully\s+)?(licensed|compliant|exempt|approved|authorised|regulated)\b/i;
const negation = /\b(not|no|nothing|never|neither|nor|whether|does not|do not)\b/i;
for (const s of sentences) {
  if (claimRe.test(s)) check(negation.test(s), `no unsupported compliance claim: "${s.trim().slice(0, 90)}"`);
}
check(!/\bis compliant\b/i.test(allText.replace(/[^.]*\b(not|whether|nothing)\b[^.]*\bis compliant\b[^.]*\./gi, '')), 'no bare "is compliant" statement');

// 7. Labels separate law from analysis.
for (const label of ['label-law', 'label-claim', 'label-analysis']) check(idx.includes(label), `explainer uses the ${label} label`);

// 8. Internal links resolve to files.
for (const page of PAGES) {
  for (const m of html[page].matchAll(/href="([^"#:][^"]*)"/g)) {
    const href = m[1].split('#')[0];
    if (!href || /^https?:/.test(href)) continue;
    const rel = href === './' ? 'index.html' : href;
    const file = path.join(PUB, rel);
    check(fs.existsSync(file) || fs.existsSync(`${file}.html`), `${page}: internal link ${href} resolves`);
  }
}

// 9. Downloads exist and the PDF/DOCX were built from the current explainer.
for (const f of ['australia-daf-act-explainer.pdf', 'australia-daf-act-explainer.docx', 'community-summary.md', 'sources.md', 'sources.csv']) {
  check(exists(`public/downloads/${f}`) && fs.statSync(path.join(PUB, 'downloads', f)).size > 500, `download ${f} exists`);
}
if (exists('data/build-manifest.json')) {
  const manifest = readJson('data/build-manifest.json');
  const hash = crypto.createHash('sha256').update(idx).digest('hex');
  check(manifest.indexSha256 === hash, 'PDF and DOCX were exported from the current explainer (run npm run render if not)');
} else {
  check(false, 'build manifest exists (run npm run render)');
}

for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\n${passes.length} checks passed, ${failures.length} failed.`);
process.exit(failures.length ? 1 : 0);
