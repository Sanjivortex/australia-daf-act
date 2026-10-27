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
const idx = html['index.html'];

// 1. Sources are well formed, and the law rests on official sources.
for (const s of list) {
  check(/^https:\/\//.test(s.url), `source ${s.id} uses https`);
  for (const a of s.alt || []) check(/^https:\/\//.test(a.url), `source ${s.id} alt link uses https`);
  check(Boolean(s.short && s.title && s.publisher && s.date && s.kind && s.supports), `source ${s.id} has short name, title, publisher, date, kind and use`);
}
const official = list.filter((s) => ['Primary law', 'Parliament', 'Government', 'Regulator (ASIC)'].includes(s.kind));
check(official.length >= 9, `at least 9 primary or official sources (found ${official.length})`);

// 2. Every citation resolves and is rendered; every source is used in the guide.
for (const page of PAGES) {
  for (const m of html[page].matchAll(/<a class="cite" href="#src-([a-z0-9]+)"[^>]*>([^<]*)<\/a>/g)) {
    const s = byId.get(m[1]);
    check(Boolean(s), `${page}: citation #src-${m[1]} points to a listed source`);
    if (s) check(m[2] === `[${s.n}]`, `${page}: citation to ${m[1]} is rendered as [${s.n}] (run npm run render)`);
  }
  check((html[page].match(/<!-- SOURCES:START -->/g) || []).length === 1, `${page}: exactly one rendered source list`);
  const block = blockContent(html[page], 'SOURCES') || '';
  for (const id of citedIds(html[page])) check(block.includes(`id="src-${id}"`), `${page}: source list includes cited source ${id}`);
}
const guideIds = citedIds(idx);
for (const s of list) check(guideIds.includes(s.id), `source ${s.id} is cited in the guide`);
for (const s of list) check(idx.includes(esc(s.supports)), `source ${s.id}: rendered description matches data/sources.json`);
for (const c of claims.claims) check(byId.has(c.src), `claim "${c.claim.slice(0, 40)}..." uses a listed source`);

// 3. Margin notes are filled wherever a passage cites a source.
for (const m of idx.matchAll(/<div class="an-body">([\s\S]*?)<\/div>\s*<aside class="an-notes"[^>]*>([\s\S]*?)<\/aside>/g)) {
  const ids = citedIds(m[1]);
  if (ids.length) check(ids.every((id) => m[2].includes(`href="#src-${id}"`)), `margin notes list every source cited in the passage (${ids.join(', ')})`);
}

// 4. The "not legal advice" statement opens every page and download.
for (const page of PAGES) {
  const before = textOf(html[page].split('<main')[0]);
  check(/not legal advice/i.test(before), `${page}: "not legal advice" statement appears before the main content`);
  const firstSection = html[page].slice(html[page].indexOf('</header>'));
  check(/^\s*<\/header>\s*<section class="notice"/.test(firstSection), `${page}: the notice is the first section after the top bar`);
}
check(/not legal (or financial )?advice/i.test(read('public/downloads/community-summary.md')), 'community-summary.md carries the not-legal-advice statement');

// 5. Dates: ASIC's latest commencement date is used; 9 April 2027 only in the date note or source notes.
check(idx.includes('8 April 2027') && idx.includes('7 October 2027'), 'guide states 8 April 2027 and 7 October 2027');
const note = blockContent(idx, 'DATENOTE') || '';
const nineOutside = idx.replace(note, '').replace(blockContent(idx, 'SOURCES') || '', '').match(/9 April 2027/g) || [];
check(note.includes('9 April 2027') && nineOutside.length === 0, '"9 April 2027" appears only in the date note and source descriptions');
for (const [label, re] of [['$10 million', /\$10 million/], ['$5,000', /\$5,000/], ['8 April 2026', /8 April 2026/], ['27 November 2026', /27 November 2026/]]) {
  check(re.test(idx), `guide states ${label}`);
}

// 6. X thread posts fit in 280 characters and carry their own sources.
const posts = threadPosts(html['summary.html']);
check(posts.length === 10, `share kit has a 10-post thread (found ${posts.length})`);
for (const p of posts) check(xLength(p.text) <= 280, `post ${p.n} is ${xLength(p.text)} characters (limit 280)`);
for (const p of posts) check(html['summary.html'].includes(`<b>${xLength(p.text)}/280</b>`), `post ${p.n} meter shows the rendered length`);

// 7. Redbelly DAO Task Board brand rules: no em or en dashes, no emoji, no filler verbs.
const brandFiles = [
  ...PAGES.map((p) => [`public/${p}`, texts[p]]),
  ...['public/downloads/community-summary.md', 'public/downloads/sources.md', 'README.md', 'VERIFICATION.md', 'data/sources.json', 'data/claims.json']
    .filter(exists).map((f) => [f, read(f)]),
  ...fs.readdirSync(path.join(ROOT, 'scripts/cards')).map((f) => [`scripts/cards/${f}`, read(`scripts/cards/${f}`)]),
];
for (const [file, text] of brandFiles) {
  check(!/[–—]/.test(text), `${file}: no em or en dashes`);
  check(!/\p{Extended_Pictographic}/u.test(text.replace(/[©®™]/g, '')), `${file}: no emoji`);
  check(!/\b(elevate|seamless(ly)?|unleash|revolutioni[sz]e)\b/i.test(text), `${file}: no filler verbs`);
}
const css = read('public/assets/css/site.css');
check(read('public/assets/css/dao-tokens.css').includes('--brand: #EF5350'), 'DAO kit tokens are present');
for (const page of PAGES) {
  check(html[page].indexOf('dao-tokens.css') !== -1 && html[page].indexOf('dao-tokens.css') < html[page].indexOf('site.css'), `${page}: loads the DAO kit tokens before the site styles`);
  check(/dao-logo-on-dark/.test(html[page]) && /dao-logo-on-light/.test(html[page]), `${page}: uses both DAO logo variants`);
  check(/family=Be\+Vietnam\+Pro/.test(html[page]) && /JetBrains\+Mono/.test(html[page]), `${page}: loads Be Vietnam Pro and JetBrains Mono`);
}
check(!/redbelly-(horizontal|isotype)/.test(Object.values(html).join('')), 'no Redbelly Network corporate logo on DAO material');
check(!/border-radius:\s*999/.test(css), 'no pill shapes outside the token for status dots');

// 8. Banned content: personal credit, price talk, unsupported compliance claims.
const allPageText = Object.values(texts).join('\n');
const creditPatterns = [/\b(made|created|written|prepared|designed|built|authored|compiled) by\s+(me|us|the author|@|[A-Z][a-z]+\s[A-Z][a-z]+)/, /\bmade with\b/i, /\bauthor:/i, /(^|\s)@[A-Za-z0-9_]{2,}/m];
for (const re of creditPatterns) check(!re.test(allPageText), `no personal credit matching ${re}`);
const pricePatterns = [/\bprice (target|prediction|action)\b/i, /\bto the moon\b/i, /\bbuy (now|the dip)\b/i, /\bguaranteed\b/i, /\breturns? of\b/i, /\bprofit\b/i, /\b\d+x\b/, /\bRBNT (price|value)\b/i, /\bundervalued\b/i, /\bbullish\b/i];
for (const re of pricePatterns) check(!re.test(allPageText), `no price talk or return promises matching ${re}`);
const claimRe = /\b(redbelly( network)?|tokeniser|(an|any|the|every) issuer|issuers)\b[^.]{0,40}\b(is|are|has been|have been)\s+(now\s+)?(fully\s+)?(licensed|compliant|exempt|approved|authorised|regulated)\b/i;
const negation = /\b(not|no|nothing|never|neither|nor|whether|does not|do not)\b/i;
for (const s of allPageText.split(/(?<=[.!?])\s+|\n+/)) {
  if (claimRe.test(s)) check(negation.test(s), `no unsupported compliance claim: "${s.trim().slice(0, 90)}"`);
}

// 9. Law, company statements and analysis are labelled apart.
for (const k of ['law', 'claim', 'view']) check(idx.includes(`data-k="${k}"`), `guide uses the ${k} label`);

// 10. Internal links resolve to files.
for (const page of PAGES) {
  for (const m of html[page].matchAll(/(?:href|src)="([^"#:][^"]*)"/g)) {
    const href = m[1].split('#')[0];
    if (!href || /^https?:/.test(href)) continue;
    const file = path.join(PUB, href === './' ? 'index.html' : href);
    check(fs.existsSync(file) || fs.existsSync(`${file}.html`), `${page}: internal link ${href} resolves`);
  }
}

// 11. Downloads exist and the PDF/DOCX were exported from the current guide.
for (const f of ['australia-daf-act-explainer.pdf', 'australia-daf-act-explainer.docx', 'community-summary.md', 'sources.md', 'sources.csv', 'cards/daf-act-dates.png', 'cards/daf-act-licensing-line.png', 'cards/daf-act-issuer-questions.png']) {
  check(exists(`public/downloads/${f}`) && fs.statSync(path.join(PUB, 'downloads', f)).size > 500, `download ${f} exists`);
}
if (exists('data/build-manifest.json')) {
  const hash = crypto.createHash('sha256').update(idx).digest('hex');
  check(readJson('data/build-manifest.json').indexSha256 === hash, 'PDF and DOCX were exported from the current guide (run npm run render if not)');
} else {
  check(false, 'build manifest exists (run npm run render)');
}

for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\n${passes.length} checks passed, ${failures.length} failed.`);
process.exit(failures.length ? 1 : 0);
