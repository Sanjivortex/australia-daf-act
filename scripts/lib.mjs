// Shared helpers for the build and check scripts. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUB = path.join(ROOT, 'public');
export const SITE_URL = 'https://australia-daf-act.vercel.app';
export const PAGES = ['index.html', 'summary.html', 'sources.html'];

export const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
export const write = (rel, text) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
export const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
export const readJson = (rel) => JSON.parse(read(rel));

export function loadSources() {
  const data = readJson('data/sources.json');
  const byId = new Map();
  data.sources.forEach((s, i) => {
    if (byId.has(s.id)) throw new Error(`Duplicate source id: ${s.id}`);
    byId.set(s.id, { ...s, n: i + 1 });
  });
  return { checked: data.checked, list: [...byId.values()], byId };
}

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CITE_RE = /<a class="cite" href="#src-([a-z0-9]+)"[^>]*>[^<]*<\/a>/g;

export function citedIds(html) {
  const ids = [];
  for (const m of html.matchAll(CITE_RE)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

export function replaceBlock(html, name, inner) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(html)) throw new Error(`Missing ${name} markers`);
  // A function replacer, so "$" in the inserted text (e.g. "$10 million") is literal.
  return html.replace(re, (_, start, end) => `${start}\n${inner}\n${end}`);
}

export function blockContent(html, name) {
  const m = html.match(new RegExp(`<!-- ${name}:START -->([\\s\\S]*?)<!-- ${name}:END -->`));
  return m ? m[1] : null;
}

// Plain text of an HTML fragment, for exports and checks.
export function textOf(html) {
  return html
    .replace(/<a class="cite"[^>]*>[^<]*<\/a>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|li|h[1-6]|tr|div|td|th)>/g, '$&\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// X counts any URL as 23 characters and most emoji as 2.
export function xLength(text) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  let rest = text;
  for (const u of urls) rest = rest.replace(u, '');
  let n = urls.length * 23;
  for (const ch of rest) n += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1;
  return n;
}

export function threadPosts(summaryHtml) {
  return [...summaryHtml.matchAll(/<p id="post-(\d+)">([\s\S]*?)<\/p>/g)]
    .map((m) => ({ n: Number(m[1]), text: textOf(m[2]) }));
}
