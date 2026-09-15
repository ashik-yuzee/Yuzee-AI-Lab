import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Prepend `globalThis.global = globalThis` to onnxruntime-web UMD bundles so
// their global-detection code finds `global` in browser/worker scope.
const onnxGlobalFix: Plugin = {
  name: 'onnx-global-fix',
  transform(code, id) {
    if (id.includes('onnxruntime-web') || id.includes('ort-web')) {
      return { code: `globalThis.global = globalThis;\n${code}`, map: null };
    }
  },
};

export default defineConfig(() => {
  return {
    plugins: [onnxGlobalFix, react(), tailwindcss()],
    build: { outDir: 'dist/public', target: 'esnext' },
    optimizeDeps: { exclude: ['@xenova/transformers', '@huggingface/transformers', 'onnxruntime-web'] },
    worker: { format: 'es', plugins: () => [onnxGlobalFix] },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Force all onnxruntime-web imports to the nested ESM bundle (v1.26, proper ESM, no UMD).
        // Root onnxruntime-web@1.14.0 uses UMD (ort-web.min.js) which crashes in browser ESM context.
        'onnxruntime-web/webgpu': path.resolve(__dirname, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs'),
        'onnxruntime-web': path.resolve(__dirname, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**', '**/*.ndjson'] },
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
  };
});
