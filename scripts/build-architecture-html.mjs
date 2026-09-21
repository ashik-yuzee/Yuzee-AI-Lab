// Renders docs/ARCHITECTURE.md into the house-style HTML doc.
// micromark + gfm are already present via react-markdown/remark-gfm — no new dependency.
// Usage: node scripts/build-architecture-html.mjs [--fragment <path>]
import { readFileSync, writeFileSync } from 'node:fs';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

const SRC = 'docs/ARCHITECTURE.md';
const OUT = 'docs/ARCHITECTURE.html';
// Browser tab / gallery name. The cover keeps the document's longer headline.
const DOC_NAME = 'Token Lab Architecture';

const slug = s => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const strip = s => s.replace(/<[^>]+>/g, '');

const body = micromark(readFileSync(SRC, 'utf8'), {
  extensions: [gfm()],
  htmlExtensions: [gfmHtml()],
})
  .replace(/<hr \/>\n?/g, '')
  .replace(/<table>/g, '<div class="table-wrap"><table>')
  .replace(/<\/table>/g, '</table></div>')
  .replace(/<pre>/g, '<div class="code-wrap"><pre>')
  .replace(/<\/pre>/g, '</pre></div>');

// Cover = everything before the first h2; the rest becomes one card per h2.
const firstH2 = body.indexOf('<h2>');
const head = body.slice(0, firstH2);
const title = strip(head.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? 'Architecture');
const lede = head.replace(/<h1>[\s\S]*?<\/h1>/, '').trim();

const sections = body.slice(firstH2).split(/(?=<h2>)/).map(chunk => {
  const raw = chunk.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? '';
  const text = strip(raw);
  const id = slug(text);
  const rest = chunk.replace(/<h2>[\s\S]*?<\/h2>/, '');
  // "12. Local semantic routing" -> number badge + name, so the ordinal is structure not prose.
  const [, num, name] = text.match(/^(\d+)\.\s*(.+)$/) ?? [, '', text];
  return { id, text, num, name, rest };
});

const toc = sections.map(s =>
  `<li><a href="#${s.id}"><span class="toc-num">${s.num || '·'}</span>${esc(s.name)}</a></li>`
).join('\n');

const cards = sections.map(s => `<section class="section" id="${s.id}">
<h2 class="section-title">${s.num ? `<span class="sec-num">${s.num}</span>` : ''}<span>${esc(s.name)}</span><a class="anchor" href="#${s.id}" aria-label="Link to this section">#</a></h2>
${s.rest.trim()}
</section>`).join('\n\n');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const STYLE = `
:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --sky: #0284c7;
  --sky-bright: #0ea5e9;
  --navy: #0c2d6b;
  --emerald: #059669;
  --amber: #b45309;
  --red: #dc2626;
  --code-bg: #f1f5f9;
  --code-text: #0f172a;
  --shadow: 0 1px 2px rgba(15, 23, 42, .04), 0 8px 24px -16px rgba(15, 23, 42, .18);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1220;
    --surface: #131c2e;
    --surface-2: #0f1828;
    --border: #273449;
    --border-strong: #3a4a63;
    --text: #e6edf6;
    --text-secondary: #9fb0c6;
    --text-muted: #6b7f99;
    --sky: #38bdf8;
    --sky-bright: #7dd3fc;
    --navy: #bfdbfe;
    --emerald: #34d399;
    --amber: #fbbf24;
    --red: #f87171;
    --code-bg: #0b1424;
    --code-text: #d7e3f2;
    --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px -16px rgba(0, 0, 0, .6);
  }
}

:root[data-theme="dark"] {
  --bg: #0b1220;
  --surface: #131c2e;
  --surface-2: #0f1828;
  --border: #273449;
  --border-strong: #3a4a63;
  --text: #e6edf6;
  --text-secondary: #9fb0c6;
  --text-muted: #6b7f99;
  --sky: #38bdf8;
  --sky-bright: #7dd3fc;
  --navy: #bfdbfe;
  --emerald: #34d399;
  --amber: #fbbf24;
  --red: #f87171;
  --code-bg: #0b1424;
  --code-text: #d7e3f2;
  --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px -16px rgba(0, 0, 0, .6);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
code, pre, .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }

.wrap { max-width: 980px; margin: 0 auto; padding-block: 40px 96px; padding-left: 20px; padding-right: 20px; }

/* Cover */
.cover {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 44px 40px 34px;
  margin-bottom: 28px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.cover::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, var(--sky-bright) 0%, #6366f1 55%, var(--emerald) 100%);
}
.cover-eyebrow {
  font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
  color: var(--sky); margin-bottom: 14px;
}
.cover h1 {
  font-size: clamp(26px, 4.6vw, 34px); font-weight: 800; line-height: 1.18;
  letter-spacing: -.02em; margin: 0 0 12px; text-wrap: balance;
}
.cover p { color: var(--text-secondary); max-width: 64ch; margin: 0 0 10px; }
.cover p:last-of-type { margin-bottom: 0; }
.cover code { background: var(--code-bg); }

.cover-meta {
  display: flex; flex-wrap: wrap; gap: 28px;
  border-top: 1px solid var(--border); margin-top: 24px; padding-top: 18px;
}
.cover-meta div { font-size: 12.5px; color: var(--text); font-variant-numeric: tabular-nums; }
.cover-meta strong {
  display: block; font-size: 10.5px; font-weight: 600; letter-spacing: .09em;
  text-transform: uppercase; color: var(--text-muted); margin-bottom: 3px;
}

/* Contents */
.toc {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 24px 28px; margin-bottom: 28px; box-shadow: var(--shadow);
}
.toc h2 {
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--text-muted); margin: 0 0 14px;
}
.toc ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 36px; }
.toc li { break-inside: avoid; margin-bottom: 3px; }
.toc a {
  display: flex; gap: 10px; align-items: baseline; padding: 3px 0;
  font-size: 13.5px; color: var(--text); text-decoration: none; border-radius: 4px;
}
.toc a:hover { color: var(--sky); }
.toc-num {
  flex: none; width: 1.6em; text-align: right;
  font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text-muted);
}

/* Sections */
.section {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 30px 34px; margin-bottom: 20px; scroll-margin-top: 20px;
  box-shadow: var(--shadow);
}
.section-title {
  display: flex; align-items: baseline; gap: 12px;
  font-size: 19px; font-weight: 700; letter-spacing: -.01em;
  margin: 0 0 20px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
  text-wrap: balance;
}
.sec-num {
  flex: none; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500;
  color: var(--sky); background: color-mix(in srgb, var(--sky) 11%, transparent);
  border-radius: 6px; padding: 2px 8px;
}
.anchor {
  margin-left: auto; color: var(--text-muted); text-decoration: none;
  font-size: 14px; opacity: 0; transition: opacity .12s;
}
.section:hover .anchor, .anchor:focus-visible { opacity: 1; }

h3 { font-size: 15.5px; font-weight: 700; margin: 26px 0 10px; letter-spacing: -.005em; }
h4 {
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-secondary); margin: 20px 0 8px;
}
.section > :first-child { margin-top: 0; }
p { margin: 0 0 12px; }
ul, ol { margin: 0 0 14px; padding-left: 22px; }
li { margin-bottom: 5px; }
li > ul, li > ol { margin-top: 5px; margin-bottom: 4px; }
strong { font-weight: 650; }
a { color: var(--sky); }

/* Code */
code {
  font-size: .875em; background: var(--code-bg); color: var(--code-text);
  padding: .12em .38em; border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.code-wrap { overflow-x: auto; margin: 0 0 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--code-bg); }
pre { margin: 0; padding: 16px 18px; }
pre code {
  background: none; border: none; padding: 0; font-size: 12.5px; line-height: 1.62;
  white-space: pre; color: var(--code-text);
}

/* Tables */
.table-wrap {
  overflow-x: auto; margin: 0 0 18px;
  border: 1px solid var(--border); border-radius: 10px;
}
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  background: var(--surface-2); text-align: left; font-weight: 650;
  font-size: 10.5px; letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-secondary); padding: 10px 14px;
  border-bottom: 1px solid var(--border-strong); white-space: nowrap;
}
td { padding: 9px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: var(--surface-2); }
td code { white-space: nowrap; }

/* The ordered list in "Invariants" is the rule set — give it weight. */
[id$="invariants-do-not-break-these"] ol { counter-reset: inv; list-style: none; padding-left: 0; }
[id$="invariants-do-not-break-these"] ol > li {
  counter-increment: inv; position: relative;
  padding: 10px 14px 10px 46px; margin-bottom: 6px;
  border-left: 2px solid var(--amber); border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--amber) 7%, transparent);
}
[id$="invariants-do-not-break-these"] ol > li::before {
  content: counter(inv); position: absolute; left: 14px; top: 10px;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--amber);
}

footer {
  margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--border);
  font-size: 12px; color: var(--text-muted);
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
footer a { color: var(--text-muted); }

:where(a, summary):focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; border-radius: 3px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; scroll-behavior: auto !important; } }
html { scroll-behavior: smooth; }

@media (max-width: 720px) {
  .wrap { padding-block: 24px 64px; }
  .cover { padding: 30px 22px 26px; }
  .section { padding: 24px 20px; border-radius: 10px; }
  .toc { padding: 20px; }
  .toc ul { columns: 1; }
  .cover-meta { gap: 18px; }
}
`;

const CONTENT = `<div class="wrap">
<header class="cover">
<p class="cover-eyebrow">Developer documentation</p>
<h1>${esc(title)}</h1>
${lede}
<div class="cover-meta">
<div><strong>Backend</strong>Node · Express · @google/genai</div>
<div><strong>Frontend</strong>React 19 · Vite · Tailwind v4</div>
<div><strong>Protocol</strong>Yuzee Response v1.3</div>
<div><strong>Sections</strong>${sections.length}</div>
</div>
</header>

<nav class="toc" aria-label="Contents">
<h2>Contents</h2>
<ul>
${toc}
</ul>
</nav>

${cards}

<footer>
<span>Generated from <code>docs/ARCHITECTURE.md</code> — edit the markdown, then run <code>node scripts/build-architecture-html.mjs</code>.</span>
<a href="#">Back to top</a>
</footer>
</div>`;

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">';

writeFileSync(OUT, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${DOC_NAME}</title>
<meta name="description" content="Architecture, request lifecycle, API surface and invariants for the Yuzee AI Token Lab.">
${FONTS}
<style>${STYLE}</style>
</head>
<body>
${CONTENT}
</body>
</html>
`);
console.log(`${OUT} — ${sections.length} sections`);

// Artifact publishes are wrapped in their own skeleton, so emit a fragment on request.
const fragmentAt = process.argv.indexOf('--fragment');
if (fragmentAt > -1 && process.argv[fragmentAt + 1]) {
  writeFileSync(process.argv[fragmentAt + 1], `<title>${DOC_NAME}</title>
${FONTS}
<style>${STYLE}</style>
${CONTENT}
`);
  console.log(`${process.argv[fragmentAt + 1]} — fragment`);
}
