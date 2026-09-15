// One-time script: parse CSV → src/data/microtools.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve('C:/Users/Reyan/Downloads/yuzee_microtools_prompt_registry.csv');
const outPath = path.resolve(__dirname, '../src/data/microtools.json');

const raw = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');

// Parse CSV with quoted field support
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(raw);
const headers = rows[0];
const col = (name) => headers.indexOf(name);

const tools = rows.slice(1)
  .filter(r => r[col('record_type')] === 'TOOL' && r[col('mini_prompt')]?.trim())
  .map(r => ({
    id: r[col('id')],
    name: r[col('name')],
    domain: r[col('domain')],
    purpose: r[col('purpose')],
    use_when: r[col('use_when')],
    trigger_examples: r[col('trigger_examples')],
    mini_prompt: r[col('mini_prompt')],
  }));

fs.writeFileSync(outPath, JSON.stringify(tools, null, 2));
console.log(`✓ Written ${tools.length} tools to src/data/microtools.json`);
