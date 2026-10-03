import os from 'node:os';
import path from 'node:path';

/** Writable runtime state (conversation fallback store, stats, logs, previews). Serverless hosts only allow
 * writes under the temp dir, so Vercel uses it; state there is per-instance (use DATABASE_URL for durability).
 * Read-only assets (model files, warehouse indexes) stay under ./data. */
export const STATE_DIR=process.env.YUZEE_STATE_DIR||(process.env.VERCEL?path.join(os.tmpdir(),'yuzee-state'):path.resolve('data'));
export const statePath=(...parts:string[])=>path.join(STATE_DIR,...parts);
