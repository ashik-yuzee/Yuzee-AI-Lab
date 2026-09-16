/**
 * Routes messages to micro-tools using all-MiniLM-L6-v2 semantic embeddings.
 * Model runs in a Web Worker to avoid ONNX Runtime / Vite bundling conflicts.
 */
import rawTools from '../data/microtools.json';

export interface MicroTool {
  id: string; name: string; domain: string; purpose: string;
  use_when: string; trigger_examples: string; mini_prompt: string;
}

export interface RouteResult {
  tool: MicroTool;
  score: number;
}

// ---------- progress pub/sub ----------
type ProgressCb = (pct: number, label: string) => void;
const progressSubs: Set<ProgressCb> = new Set();

export function onLoadProgress(cb: ProgressCb): () => void {
  progressSubs.add(cb);
  if (modelReady) cb(100, 'Ready');
  return () => progressSubs.delete(cb);
}

function emit(pct: number, label: string) {
  for (const cb of progressSubs) cb(Math.max(-1, Math.min(100, pct)), label);
}

// ---------- state ----------
export let modelReady = false;
export let modelDevice: 'webgpu' | 'cpu' | null = null;
let worker: Worker | null = null;
let warmupStarted = false;
let routeIdCounter = 0;
const pendingRoutes = new Map<string, { resolve: (r: RouteResult) => void; reject: (e: Error) => void }>();

const tools = rawTools as MicroTool[];

// ---------- keyword pre-routing ----------
// Semantic embeddings can't reliably separate career-field queries from tech-domain queries.
// These rules short-circuit for patterns where embedding similarity is inherently ambiguous.
const KEYWORD_ROUTES: Array<{ patterns: RegExp[]; toolId: string }> = [
  {
    toolId: 'JOB_006',
    patterns: [
      /growing field/i,
      /worth getting into/i,
      /is\s+\w+\s+(a\s+)?(growing|good|worth(while)?)\s+(field|career|industry|profession)/i,
      /(career|field|profession|industry)\s+(in\s+demand|outlook|prospects|growing|worth)/i,
      /should\s+I\s+(get into|enter|pursue|go into)\s+\w/i,
      /job\s+(market|outlook|prospects|demand)\s+for/i,
    ],
  },
];

function tryKeywordRoute(text: string): RouteResult | null {
  for (const rule of KEYWORD_ROUTES) {
    if (rule.patterns.some(p => p.test(text))) {
      const tool = tools.find(t => t.id === rule.toolId);
      if (tool) return { tool, score: 0.85 };
    }
  }
  return null;
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/embedder.worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (e: MessageEvent) => {
    const { type, pct, label, id, tool, score, message } = e.data;
    if (type === 'progress') { emit(pct, label); return; }
    if (type === 'ready') { modelReady = true; modelDevice = e.data.device ?? null; return; }
    if (type === 'result') {
      pendingRoutes.get(id)?.resolve({ tool: tool as MicroTool, score: score as number });
      pendingRoutes.delete(id);
      return;
    }
    if (type === 'error') {
      pendingRoutes.get(id)?.reject(new Error(message as string));
      pendingRoutes.delete(id);
    }
  };

  worker.onerror = (e) => {
    emit(-1, 'Failed');
    for (const { reject } of pendingRoutes.values()) reject(new Error(e.message));
    pendingRoutes.clear();
    worker = null;
  };

  return worker;
}

/** Call at app startup to pre-warm the model before the first chat message. */
export async function startWarmup(): Promise<void> {
  if (warmupStarted) return;
  warmupStarted = true;
  getWorker(); // worker auto-inits on creation
}

export async function routeMessage(userMessage: string): Promise<RouteResult> {
  const kw = tryKeywordRoute(userMessage);
  if (kw) return kw;

  const w = getWorker();
  const id = String(routeIdCounter++);
  return new Promise((resolve, reject) => {
    pendingRoutes.set(id, { resolve, reject });
    w.postMessage({ type: 'route', id, text: userMessage });
  });
}

// Fallback: a dummy tool so callers never crash if worker fails before routing
export function getFallbackTool(): RouteResult {
  return { tool: tools[0], score: 0 };
}
