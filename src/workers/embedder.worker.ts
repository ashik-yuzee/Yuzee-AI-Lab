import rawTools from '../data/microtools.json';

interface MicroTool {
  id: string; name: string; domain: string; purpose: string;
  use_when: string; trigger_examples: string; mini_prompt: string;
}

const tools = rawTools as MicroTool[];
const MODEL = 'Xenova/all-MiniLM-L6-v2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;
let toolEmbeddings: Float32Array[] | null = null;

const fileSizes = new Map<string, number>();
const fileLoaded = new Map<string, number>();

function calcPct() {
  const total = Array.from(fileSizes.values()).reduce((a, b) => a + b, 0);
  const loaded = Array.from(fileLoaded.values()).reduce((a, b) => a + b, 0);
  return total > 0 ? (loaded / total) * 82 : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function progressCallback(data: any) {
  if (data.status === 'initiate') {
    fileSizes.set(data.file, 0); fileLoaded.set(data.file, 0);
  } else if (data.status === 'progress' && data.total > 0) {
    fileSizes.set(data.file, data.total);
    fileLoaded.set(data.file, data.loaded ?? 0);
    self.postMessage({ type: 'progress', pct: calcPct(), label: 'Downloading model…' });
  } else if (data.status === 'done') {
    if (fileSizes.has(data.file)) fileLoaded.set(data.file, fileSizes.get(data.file)!);
    self.postMessage({ type: 'progress', pct: calcPct(), label: 'Downloading model…' });
  }
}

async function probeWebGPU(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (self as any).navigator?.gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

async function init() {
  self.postMessage({ type: 'progress', pct: 2, label: 'Detecting hardware…' });

  const { pipeline: xPipeline, cos_sim: xCosSim } = await import('@huggingface/transformers');

  // Prefer WebGPU for GPU-accelerated inference; fall back to CPU with quantized weights
  const hasWebGPU = await probeWebGPU();
  const device = hasWebGPU ? 'webgpu' : 'cpu';
  const dtype  = 'q8'; // quantized int8 on both paths — same 22 MB download either way

  self.postMessage({
    type: 'progress',
    pct: 5,
    label: hasWebGPU ? 'GPU detected — loading model…' : 'Loading model…',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embedder = await xPipeline('feature-extraction', MODEL, {
    device,
    dtype,
    progress_callback: progressCallback,
  } as any);

  self.postMessage({ type: 'progress', pct: 85, label: 'Building tool index…' });

  const texts = tools.map(t => `${t.name}. ${t.use_when} ${t.purpose}`);
  const out = await embedder(texts, { pooling: 'mean', normalize: true });
  const dim = (out.dims as number[])[out.dims.length - 1];
  toolEmbeddings = tools.map((_: MicroTool, i: number) =>
    (out.data as Float32Array).slice(i * dim, (i + 1) * dim)
  );

  self.postMessage({ type: 'progress', pct: 100, label: hasWebGPU ? 'Ready · GPU' : 'Ready · CPU' });
  self.postMessage({ type: 'ready', device });

  return xCosSim;
}

let cosSim: ((a: Float32Array, b: Float32Array) => number) | null = null;
const initPromise = init()
  .then(cs => { cosSim = cs as unknown as (a: Float32Array, b: Float32Array) => number; })
  .catch(() => {
    self.postMessage({ type: 'progress', pct: -1, label: 'Failed' });
  });

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type !== 'route') return;
  const { id, text } = e.data;
  try {
    await initPromise;
    const qOut = await embedder!(text, { pooling: 'mean', normalize: true });
    let bestIdx = 0, bestScore = -1;
    for (let i = 0; i < toolEmbeddings!.length; i++) {
      const s = cosSim!(qOut.data as Float32Array, toolEmbeddings![i]);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    self.postMessage({ type: 'result', id, tool: tools[bestIdx], score: bestScore });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'route failed';
    self.postMessage({ type: 'error', id, message: msg });
  }
};
