import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 3001, strictPort: true, proxy: { '/api/concept': 'http://127.0.0.1:3002' } },
  build: { outDir: '../build', emptyOutDir: true },
});
