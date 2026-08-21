// Vercel serverless function entry point.
// We load the pre-compiled CJS bundle rather than importing server.ts directly because
// @vercel/node transpiles but does NOT bundle transitive imports, leaving extensionless
// ESM paths ('../server', './src/services/...') unresolvable at Node.js runtime.
// The 'npm run build' step produces dist/server.cjs before this function is invoked.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { app } = require('../dist/server.cjs');
export default app;
