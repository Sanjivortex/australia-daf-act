// Renders citations and source lists into the static pages, then exports the
// downloadable editions (PDF, DOCX, Markdown, CSV) and the social card.
//
//   node scripts/build.mjs            render pages + all exports
//   node scripts/build.mjs --pages    render pages and text exports only
//
// The PDF, DOCX and card need Playwright (Chromium) and pandoc installed locally.
// Vercel serves public/ as-is; it never runs this script.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ROOT, PUB, SITE_URL, PAGES, read, write, exists, readJson, loadSources, esc,
  CITE_RE, citedIds, replaceBlock, textOf, threadPosts,
} from './lib.mjs';

const pagesOnly = process.argv.includes('--pages');
const { checked, list, byId } = loadSources();
const claims = readJson('data/claims.json');
const linkCheck = exists('data/link-check.json') ? readJson('data/link-check.json') : null;

// ---------- page rendering ----------

function renderCites(html) {
  return html.replace(CITE_RE, (_, id) => {
    const s = byId.get(id);
    if (!s) throw new Error(`Unknown source id in citation: ${id}`);
    return `<a class="cite" href="#src-${id}" title="${esc(s.title)}">[${s.n}]</a>`;
  });
}

function sourceItem(s) {
  const kindClass = s.kind === 'Primary law' ? 'kind kind-primary' : 'kind';
  const alts = (s.alt || [])
    .map((a) => ` · ${esc(a.label)}: <a href="${esc(a.url)}">${esc(a.url)}</a>`).join('');
  return `<li id="src-${s.id}"><span class="n">[${s.n}]</span><div>
  <div class="t">${esc(s.title)}</div>
  <div class="m"><span class="${kindClass}">${esc(s.kind)}</span>${esc(s.publisher)} · ${esc(s.date)}</div>
  <div class="u"><a href="${esc(s.url)}">${esc(s.url)}</a>${alts}</div>
  <div class="s"><strong>Used for:</strong> ${esc(s.supports)}</div>
</div></li>`;
}

const sourcesList = (items) => `<ol class="sources">\n${items.map(sourceItem).join('\n')}\n</ol>`;

function claimsTable() {
  const rows = claims.claims.map((c) => {
    const s = byId.get(c.src);
    if (!s) throw new Error(`Unknown source in claims.json: ${c.src}`);
    return `<tr><td>${esc(c.topic)}</td><td>${esc(c.claim)}</td><td><a href="#src-${s.id}">[${s.n}]</a></td><td>${esc(c.pin)}</td><td>“${esc(c.quote)}”</td></tr>`;
  });
  return `<div class="table-wrap"><table>
<thead><tr><th scope="col">Topic</th><th scope="col">Claim</th><th scope="col">Source</th><th scope="col">Pinpoint</th><th scope="col">Supporting wording</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>`;
}

function linkCheckTable() {
  if (!linkCheck) return '<p class="muted">Run <code>npm run check:links</code> to record link results.</p>';
  const rows = linkCheck.results.map((r) =>
    `<tr><td>${r.n ? `[${r.n}]` : ''}</td><td class="small"><a href="${esc(r.url)}">${esc(r.url)}</a></td><td>${r.ok ? '<span class="fit fit-yes">OK</span>' : '<span class="fit fit-unclear">Check</span>'} ${esc(String(r.status))}</td></tr>`);
  return `<p class="muted small">Automated check run on ${esc(linkCheck.checkedOn)} (HTTP status after redirects). ${linkCheck.results.filter((r) => r.ok).length} of ${linkCheck.results.length} links returned a success status.</p>
<div class="table-wrap"><table>
<thead><tr><th scope="col">#</th><th scope="col">URL</th><th scope="col">Result</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>`;
}

function renderPages() {
  const out = {};
  for (const page of PAGES) {
    let html = renderCites(read(`public/${page}`));
    if (page === 'summary.html') {
      const ids = citedIds(html);
      html = replaceBlock(html, 'SOURCES', sourcesList(list.filter((s) => ids.includes(s.id))));
    } else {
      html = replaceBlock(html, 'SOURCES', sourcesList(list));
    }
    if (page === 'sources.html') {
      html = replaceBlock(html, 'CLAIMS', claimsTable());
      html = replaceBlock(html, 'NOTVERIFIED', `<ul>\n${claims.not_verified.map((t) => `<li>${esc(t)}</li>`).join('\n')}\n</ul>`);
      html = replaceBlock(html, 'LINKCHECK', linkCheckTable());
    }
    write(`public/${page}`, html);
    out[page] = html;
  }
  return out;
}

// ---------- text exports ----------

function exportSources() {
  const md = [
    '# Sources: Australia\'s Digital Assets Framework Act explainer',
    '',
    `Checked ${checked}. Numbers match the citations in the explainer.`,
    '',
    ...list.flatMap((s) => [
      `${s.n}. **${s.title}**. ${s.publisher}, ${s.date}. ${s.kind}.  `,
      `   <${s.url}>${(s.alt || []).map((a) => `  \n   ${a.label}: <${a.url}>`).join('')}  `,
      `   Used for: ${s.supports}`,
      '',
    ]),
    '## Claim-by-claim checks',
    '',
    '| Topic | Claim | Source | Pinpoint | Supporting wording |',
    '|---|---|---|---|---|',
    ...claims.claims.map((c) => `| ${c.topic} | ${c.claim.replace(/\|/g, '\\|')} | [${byId.get(c.src).n}] | ${c.pin} | "${c.quote.replace(/\|/g, '\\|')}" |`),
    '',
  ].join('\n');
  write('public/downloads/sources.md', md);

  const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    ['number', 'id', 'kind', 'title', 'publisher', 'date', 'url', 'used_for'].join(','),
    ...list.map((s) => [s.n, s.id, s.kind, s.title, s.publisher, s.date, s.url, s.supports].map(csvCell).join(',')),
  ].join('\n') + '\n';
  write('public/downloads/sources.csv', csv);
}

function exportSummary(summaryHtml) {
  const posts = threadPosts(summaryHtml);
  const para = summaryHtml.match(/<div id="para-text">([\s\S]*?)<\/div>/)[1];
  const paragraphs = [...para.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
  const ids = citedIds(summaryHtml);
  const md = [
    '# Australia\'s Digital Assets Framework Act: community summary',
    '',
    '> General information only, not legal or financial advice. This summary does not say that Redbelly Network, Tokeniser or any issuer is licensed, exempt or compliant. Lines starting "Our read" are analysis, not law.',
    '',
    '## X thread',
    '',
    'Each post is in its own block, ready to paste.',
    '',
    ...posts.flatMap((p) => [`**${p.n}/${posts.length}**`, '', '```text', p.text, '```', '']),
    '## Paragraph version',
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    '## Sources',
    '',
    ...list.filter((s) => ids.includes(s.id)).map((s) => `${s.n}. ${s.title}. ${s.publisher}, ${s.date}. <${s.url}>`),
    '',
    `Full explainer: ${SITE_URL}/`,
    '',
  ].join('\n');
  write('public/downloads/community-summary.md', md);
}

function exportVerification() {
  const lines = [
    '# Verification record',
    '',
    `Every factual claim in the explainer and the community summary, with its source and the supporting wording. Sources checked ${checked}.`,
    '',
    'How to re-run the checks:',
    '',
    '```sh',
    'npm run check        # offline: citations, sources, disclaimer, dates, X post lengths, banned phrasing',
    'npm run check:links  # online: HTTP status of every source link',
    '```',
    '',
    '## Claims',
    '',
    '| # | Topic | Claim | Source | Pinpoint | Supporting wording |',
    '|---|---|---|---|---|---|',
    ...claims.claims.map((c, i) => {
      const s = byId.get(c.src);
      return `| ${i + 1} | ${c.topic} | ${c.claim.replace(/\|/g, '\\|')} | [${s.n}](${s.url}) | ${c.pin} | "${c.quote.replace(/\|/g, '\\|')}" |`;
    }),
    '',
    '## Not checked',
    '',
    ...claims.not_verified.map((t) => `- ${t}`),
    '',
    '## Link check',
    '',
    linkCheck
      ? [`Run on ${linkCheck.checkedOn}: ${linkCheck.results.filter((r) => r.ok).length} of ${linkCheck.results.length} links returned a success status.`, '',
        '| # | URL | Status |', '|---|---|---|',
        ...linkCheck.results.map((r) => `| ${r.n || ''} | ${r.url} | ${r.status}${r.ok ? '' : ' (check manually)'} |`)].join('\n')
      : 'Not yet run.',
    '',
  ];
  write('VERIFICATION.md', lines.join('\n'));
}

// ---------- browser exports ----------

function serve(dir) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.md': 'text/markdown', '.csv': 'text/csv' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p);
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file += '.html';
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Links that are relative on the site must point at the live site in exports.
function absolutiseLinks(siteUrl) {
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^(https?:|mailto:|#)/.test(href)) return;
    a.setAttribute('href', `${siteUrl}/${href.replace(/^\.\//, '')}`);
  });
}

async function browserExports() {
  const require = createRequire(import.meta.url);
  let chromium;
  try { ({ chromium } = require('playwright')); } catch {
    ({ chromium } = await import('playwright'));
  }
  const server = await serve(PUB);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // PDF edition of the explainer
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    await page.evaluate(absolutiseLinks, SITE_URL);
    await page.pdf({
      path: path.join(PUB, 'downloads/australia-daf-act-explainer.pdf'),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7.5px;font-family:Arial,sans-serif;color:#5b6670;padding:0 15mm;display:flex;justify-content:space-between;"><span>Australia's Digital Assets Framework Act: What It Means for Tokeniser · General information only, not legal advice · Sources checked ${checked}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });

    // Clean HTML for the Word edition
    await page.emulateMedia({ media: 'screen', colorScheme: 'light' });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(absolutiseLinks, SITE_URL);
    const docHtml = await page.evaluate(() => {
      const q = (s) => Array.from(document.querySelectorAll(s));
      q('script, .site-header, .toc, .actions, button, svg, .skip-link, .site-footer').forEach((el) => el.remove());
      q('.label').forEach((el) => { const b = document.createElement('strong'); b.textContent = `[${el.textContent.trim()}]`; el.replaceWith(b); });
      q('.fit').forEach((el) => { const b = document.createElement('strong'); b.textContent = `${el.textContent.trim()}. `; el.replaceWith(b); });
      q('td[data-th]').forEach((el) => el.removeAttribute('data-th'));
      q('.section-num, .eyebrow').forEach((el) => el.remove());
      q('.timeline .when').forEach((el) => { const b = document.createElement('strong'); b.textContent = `${el.textContent.trim()}: `; el.replaceWith(b); });
      q('.steps li').forEach((li, i) => { const p = li.querySelector('.q'); if (p) p.textContent = `Q${i + 1}. ${p.textContent}`; });
      const hero = document.querySelector('.hero .inner');
      const disc = document.querySelector('.disclaimer .box > div:last-child');
      const main = document.querySelector('main');
      return `<!doctype html><html><head><meta charset="utf-8"><title>Australia's Digital Assets Framework Act: What It Means for Tokeniser</title></head><body>${hero.innerHTML}${disc.innerHTML}${main.innerHTML}</body></html>`;
    });
    const tmp = path.join(ROOT, '.build');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'explainer-docx.html'), docHtml);
    execFileSync('pandoc', [
      path.join(tmp, 'explainer-docx.html'), '-f', 'html', '-t', 'docx',
      '--reference-doc', path.join(ROOT, 'scripts/reference.docx'),
      '-o', path.join(PUB, 'downloads/australia-daf-act-explainer.docx'),
    ]);

    // Social card
    const card = fs.readFileSync(path.join(ROOT, 'scripts/og-card.html'), 'utf8');
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(card.replace('<head>', `<head><base href="${base}/">`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(PUB, 'assets/og-card.png') });
  } finally {
    await browser.close();
    server.close();
  }
}

// ---------- run ----------

const rendered = renderPages();
exportSources();
exportSummary(rendered['summary.html']);
exportVerification();
if (!pagesOnly) {
  await browserExports();
  const hash = crypto.createHash('sha256').update(rendered['index.html']).digest('hex');
  write('data/build-manifest.json', JSON.stringify({ indexSha256: hash, sourcesChecked: checked }, null, 2) + '\n');
}
console.log(`Rendered ${PAGES.length} pages with ${list.length} sources and ${claims.claims.length} claim checks${pagesOnly ? '' : '; exported PDF, DOCX and social card'}.`);
