import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import crypto from 'node:crypto';
import artifact from '../src/routing/bgeArtifact.json';

const root = `data/minilm-cache/${artifact.modelId}/${artifact.revision}`;
const base = `https://huggingface.co/${artifact.modelId}/resolve/${artifact.revision}`;

async function get(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const req = https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const loc = res.headers.location!;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        get(next).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

const files = Object.keys(artifact.sha256);
for (const file of files) {
  const dest = `${root}/${file}`;
  const dir = path.dirname(dest);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(dest);
    const data = await fs.readFile(dest);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (hash === (artifact.sha256 as Record<string, string>)[file]) {
      console.log(`  already ok: ${file}`);
      continue;
    }
    console.log(`  hash mismatch, re-downloading: ${file}`);
  } catch { /* file missing */ }
  console.log(`  downloading: ${file}`);
  const data = await get(`${base}/${file}`);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const expected = (artifact.sha256 as Record<string, string>)[file];
  if (hash !== expected) throw new Error(`SHA-256 mismatch for ${file}: got ${hash}, expected ${expected}`);
  await fs.writeFile(dest, data);
  console.log(`  saved (${(data.length / 1024 / 1024).toFixed(1)} MB): ${file}`);
}
console.log('Done — model files verified.');
