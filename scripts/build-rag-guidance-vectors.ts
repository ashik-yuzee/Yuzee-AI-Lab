/**
 * Builds src/rag/guidance/guidance-vectors.gemini.json: int8 Gemini embeddings of every guidance module key
 * and example, so serverless instances using EXP_RAG_EMBEDDER=gemini skip ~600 embeddings on cold start.
 * Re-run after editing the guidance manifest (stale files are ignored at runtime and rebuilt lazily).
 *   npm run build:rag-vectors
 */
import 'dotenv/config';
import fs from 'node:fs';
import {buildGeminiGuidanceVectors,GEMINI_VECTOR_FILE} from '../src/rag/guidance';

if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY is required');
const t=Date.now();
const payload=await buildGeminiGuidanceVectors();
fs.writeFileSync(GEMINI_VECTOR_FILE,JSON.stringify(payload));
console.log(`wrote ${GEMINI_VECTOR_FILE}: ${payload.passages.length} passages + ${payload.queries.length} queries (${payload.model}, ${payload.dimensions}d) in ${Date.now()-t} ms, ${(fs.statSync(GEMINI_VECTOR_FILE).size/1024).toFixed(0)} KB`);
