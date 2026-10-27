// Renders citations, margin notes and source lists into the static pages, then
// exports the downloadable editions (PDF, DOCX, Markdown, CSV) and the images.
//
//   node scripts/build.mjs            render pages + all exports
//   node scripts/build.mjs --pages    render pages and text exports only
//
// The PDF, DOCX and images need Playwright (Chromium) and pandoc installed
// locally. Vercel serves public/ as-is; it never runs this script.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ROOT, PUB, SITE_URL, PAGES, read, write, exists, readJson, loadSources, esc,
  citedIds, replaceBlock, textOf, threadPosts, xLength,
} from './lib.mjs';

const pagesOnly = process.argv.includes('--pages');
const { checked, list, byId } = loadSources();
const claims = readJson('data/claims.json');
const linkCheck = exists('data/link-check.json') ? readJson('data/link-check.json') : null;

const KIND_GROUP = { 'Primary law': 'law', Parliament: 'gov', Government: 'gov', 'Regulator (ASIC)': 'asic' };
const kindGroup = (s) => KIND_GROUP[s.kind] || 'company';

// ---------- page rendering ----------

const CITE = /<a class="cite" href="#src-([a-z0-9]+)"([^>]*)>[^<]*<\/a>/g;
const pinOf = (attrs) => (attrs.match(/data-pin="([^"]*)"/) || [])[1] || '';

function renderCites(html) {
  return html.replace(CITE, (_, id, attrs) => {
    const s = byId.get(id);
    if (!s) throw new Error(`Unknown source id in citation: ${id}`);
    const pin = pinOf(attrs);
    const title = pin ? `${s.short}, ${pin}` : s.short;
    return `<a class="cite" href="#src-${id}"${pin ? ` data-pin="${pin}"` : ''} title="${esc(title)}">[${s.n}]</a>`;
  });
}

// Margin notes: for each annotated row, list the sources cited in its body.
function renderNotes(html) {
  return html.replace(/(<div class="an-body">)([\s\S]*?)(<\/div>\s*<aside class="an-notes"[^>]*>)[\s\S]*?(<\/aside>)/g, (_, open, body, mid, close) => {
    const groups = new Map();
    for (const m of body.matchAll(CITE)) {
      const pin = pinOf(m[2]);
      if (!groups.has(m[1])) groups.set(m[1], []);
      for (const part of pin.split(/;\s*/).filter(Boolean)) if (!groups.get(m[1]).includes(part)) groups.get(m[1]).push(part);
    }
    const notes = [...groups].map(([id, pins]) => {
      const s = byId.get(id);
      return `<p class="mn"><a href="#src-${id}">[${s.n}]</a><span class="t">${esc(s.short)}</span>${pins.length ? `<span class="p">${esc(pins.join('; '))}</span>` : ''}</p>`;
    }).join('');
    return `${open}${body}${mid}${notes}${close}`;
  });
}

function sourceItem(s) {
  const alts = (s.alt || []).map((a) => ` · ${esc(a.label)}: <a href="${esc(a.url)}">${esc(a.url)}</a>`).join('');
  return `<li id="src-${s.id}"><span class="n">[${s.n}]</span><div>
  <div class="t">${esc(s.title)}</div>
  <div class="m"><span class="kind${s.kind === 'Primary law' ? ' law' : ''}">${esc(s.kind)}</span>${esc(s.publisher)} · ${esc(s.date)}</div>
  <div class="u"><a href="${esc(s.url)}">${esc(s.url)}</a>${alts}</div>
  <div class="s"><strong>Used for:</strong> ${esc(s.supports)}</div>
</div></li>`;
}

const sourcesList = (items) => `<ol class="sources">\n${items.map(sourceItem).join('\n')}\n</ol>`;

function claimsLedger() {
  const rows = claims.claims.map((c, i) => {
    const s = byId.get(c.src);
    if (!s) throw new Error(`Unknown source in claims.json: ${c.src}`);
    return `<tr data-kind-row="${kindGroup(s)}"><td class="src">${String(i + 1).padStart(2, '0')}</td><td>${esc(c.topic)}</td><td>${esc(c.claim)}</td><td class="src"><a href="#src-${s.id}">[${s.n}]</a> ${esc(s.short)}</td><td class="pin">${esc(c.pin)}</td><td class="q">"${esc(c.quote)}"</td></tr>`;
  });
  return `<div class="tablebox"><table class="ledger">
<thead><tr><th scope="col">#</th><th scope="col">Topic</th><th scope="col">Claim</th><th scope="col">Source</th><th scope="col">Pinpoint</th><th scope="col">Supporting wording</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>`;
}

function linkCheckTable() {
  if (!linkCheck) return '<p class="muted">Run <code>npm run check:links</code> to record link results.</p>';
  const ok = linkCheck.results.filter((r) => r.ok).length;
  const rows = linkCheck.results.map((r) =>
    `<tr><td class="src">[${r.n}]</td><td class="pin"><a href="${esc(r.url)}">${esc(r.url)}</a></td><td><span class="status ${r.ok ? 'ok' : 'open'}">${esc(String(r.status))}</span></td></tr>`);
  return `<p class="muted">Automated check on ${esc(linkCheck.checkedOn)}: ${ok} of ${linkCheck.results.length} links returned a success status after redirects.</p>
<div class="tablebox"><table class="ledger">
<thead><tr><th scope="col">#</th><th scope="col">URL</th><th scope="col">Result</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>`;
}

function renderMeters(html) {
  const posts = new Map(threadPosts(html).map((p) => [p.n, p]));
  return html.replace(/<span class="meter" data-post="(\d+)"><i style="--fill:[^"]*"><\/i><b>[^<]*<\/b><\/span>/g, (_, n) => {
    const p = posts.get(Number(n));
    if (!p) throw new Error(`No post ${n} for meter`);
    const len = xLength(p.text);
    return `<span class="meter" data-post="${n}"><i style="--fill:${Math.min(100, Math.round((len / 280) * 100))}%"></i><b>${len}/280</b></span>`;
  });
}

function renderPages() {
  const out = {};
  for (const page of PAGES) {
    let html = renderCites(read(`public/${page}`));
    html = renderNotes(html);
    const ids = citedIds(html);
    if (page === 'summary.html') {
      html = renderMeters(html);
      html = replaceBlock(html, 'SOURCES', sourcesList(list.filter((s) => ids.includes(s.id))));
    } else {
      html = replaceBlock(html, 'SOURCES', sourcesList(list));
    }
    if (page === 'sources.html') {
      html = replaceBlock(html, 'CLAIMS', claimsLedger());
      html = replaceBlock(html, 'NOTVERIFIED', `<ul class="marks">\n${claims.not_verified.map((t) => `<li>${esc(t)}</li>`).join('\n')}\n</ul>`);
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
    '# Sources: Australia\'s Digital Assets Framework Act field guide',
    '',
    `Checked ${checked}. Numbers match the citations in the guide.`,
    '',
    ...list.flatMap((s) => [
      `${s.n}. **${s.title}**. ${s.publisher}, ${s.date}. ${s.kind}.  `,
      `   <${s.url}>${(s.alt || []).map((a) => `  \n   ${a.label}: <${a.url}>`).join('')}  `,
      `   Used for: ${s.supports}`,
      '',
    ]),
    '## Claim ledger',
    '',
    '| # | Topic | Claim | Source | Pinpoint | Supporting wording |',
    '|---|---|---|---|---|---|',
    ...claims.claims.map((c, i) => `| ${i + 1} | ${c.topic} | ${c.claim.replace(/\|/g, '\\|')} | [${byId.get(c.src).n}] ${byId.get(c.src).short} | ${c.pin} | "${c.quote.replace(/\|/g, '\\|')}" |`),
    '',
  ].join('\n');
  write('public/downloads/sources.md', md);

  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    ['number', 'id', 'short_name', 'kind', 'title', 'publisher', 'date', 'url', 'used_for'].join(','),
    ...list.map((s) => [s.n, s.id, s.short, s.kind, s.title, s.publisher, s.date, s.url, s.supports].map(cell).join(',')),
  ].join('\n') + '\n';
  write('public/downloads/sources.csv', csv);
}

function exportSummary(summaryHtml) {
  const posts = threadPosts(summaryHtml);
  const para = summaryHtml.match(/<div id="para-text" class="prose">([\s\S]*?)<\/div>/)[1];
  const paragraphs = [...para.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
  const ids = citedIds(summaryHtml);
  const md = [
    '# Australia\'s Digital Assets Framework Act: share kit',
    '',
    '> General information only, not legal or financial advice. This summary does not say that Redbelly Network, Tokeniser or any issuer is licensed, exempt or compliant. Lines that start "Our read" are analysis, not law.',
    '',
    '## X thread',
    '',
    'Each post is in its own block, ready to paste. Images for posts 04, 05 and 06 are in `downloads/cards/`.',
    '',
    ...posts.flatMap((p) => [`**${String(p.n).padStart(2, '0')}/${posts.length}** (${xLength(p.text)}/280)`, '', '```text', p.text, '```', '']),
    '## Paragraph version',
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    '## Sources',
    '',
    ...list.filter((s) => ids.includes(s.id)).map((s) => `${s.n}. ${s.title}. ${s.publisher}, ${s.date}. <${s.url}>`),
    '',
    `Full guide: ${SITE_URL}/`,
    '',
    `Last verified ${checked}.`,
    '',
  ].join('\n');
  write('public/downloads/community-summary.md', md);
}

function exportVerification() {
  const lines = [
    '# Verification record',
    '',
    `Every factual claim in the guide and the share kit, with its source and the supporting wording. Sources checked ${checked}.`,
    '',
    'How to re-run the checks:',
    '',
    '```sh',
    'npm run check        # offline: citations, notes, sources, disclaimer, dates, X post length, brand voice, banned phrasing',
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
        ...linkCheck.results.map((r) => `| ${r.n} | ${r.url} | ${r.status}${r.ok ? '' : ' (check by hand)'} |`)].join('\n')
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
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
  const server = await serve(PUB);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // PDF edition of the guide, in the kit's light theme
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(absolutiseLinks, SITE_URL);
    await page.pdf({
      path: path.join(PUB, 'downloads/australia-daf-act-explainer.pdf'),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7.5px;font-family:Arial,sans-serif;color:#596975;padding:0 13mm;display:flex;justify-content:space-between;"><span>Australia's Digital Assets Framework Act: What It Means for Tokeniser. General information only, not legal advice. Last verified ${checked}.</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '13mm', bottom: '15mm', left: '13mm', right: '13mm' },
    });

    // Clean HTML for the Word edition
    await page.emulateMedia({ media: 'screen' });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(absolutiseLinks, SITE_URL);
    const docHtml = await page.evaluate(() => {
      const q = (s) => Array.from(document.querySelectorAll(s));
      q('script, .topbar, .chapters, .actions, button, svg, .skip, .foot, .ribbon, .ribbon-key, .tabs, .fields, .verdict .out, .an-notes, .print-only, img').forEach((el) => el.remove());
      q('.an > .k').forEach((el) => { const p = document.createElement('p'); const b = document.createElement('strong'); b.textContent = `[${el.textContent.trim()}]`; p.appendChild(b); el.replaceWith(p); });
      q('.status').forEach((el) => { const b = document.createElement('strong'); b.textContent = `Fit: ${el.textContent.trim()}. `; el.replaceWith(b); });
      q('.case[hidden]').forEach((el) => el.removeAttribute('hidden'));
      q('.notice .mark').forEach((el) => el.remove());
      q('.tagline').forEach((el) => { el.textContent = Array.from(el.children).map((c) => c.textContent.trim()).join(' | '); });
      q('figcaption b, .ribbon-band .top .caps, .readkey b').forEach((el) => { el.textContent = `${el.textContent.trim()}. `; });
      q('.ribbon-list .d').forEach((el) => { el.textContent = `${el.textContent.trim()}: `; });
      q('.when td.d').forEach((el) => { el.textContent = el.textContent.trim(); });
      const parts = ['#not-legal-advice', '.hero', '.ribbon-band', 'main'].map((s) => document.querySelector(s).innerHTML);
      return `<!doctype html><html><head><meta charset="utf-8"><title>Australia's Digital Assets Framework Act: What It Means for Tokeniser</title></head><body>${parts.join('')}</body></html>`;
    });
    const tmp = path.join(ROOT, '.build');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'explainer-docx.html'), docHtml);
    execFileSync('pandoc', [
      path.join(tmp, 'explainer-docx.html'), '-f', 'html', '-t', 'docx',
      '--reference-doc', path.join(ROOT, 'scripts/reference.docx'),
      '-o', path.join(PUB, 'downloads/australia-daf-act-explainer.docx'),
    ]);

    // Share-kit images (1600 x 900) and the Open Graph card (1200 x 630)
    const css = fs.readFileSync(path.join(ROOT, 'scripts/cards/card.css'), 'utf8');
    fs.mkdirSync(path.join(PUB, 'downloads/cards'), { recursive: true });
    const cards = [
      ['daf-act-dates', 1600, 900, 'downloads/cards/daf-act-dates.png'],
      ['daf-act-licensing-line', 1600, 900, 'downloads/cards/daf-act-licensing-line.png'],
      ['daf-act-issuer-questions', 1600, 900, 'downloads/cards/daf-act-issuer-questions.png'],
      ['og-card', 1200, 630, 'assets/og-card.png'],
    ];
    for (const [name, w, h, out] of cards) {
      const tpl = fs.readFileSync(path.join(ROOT, `scripts/cards/${name}.html`), 'utf8').replace('/*CARD_CSS*/', css);
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(tpl.replace('<head>', `<head><base href="${base}/">`), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(PUB, out) });
    }
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
console.log(`Rendered ${PAGES.length} pages with ${list.length} sources and ${claims.claims.length} claim checks${pagesOnly ? '' : '; exported PDF, DOCX and images'}.`);
