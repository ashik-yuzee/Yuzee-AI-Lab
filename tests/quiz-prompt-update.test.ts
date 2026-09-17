import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { QUIZ_PROMPT_FILENAME, QUIZ_PROMPT_PATH, QUIZ_PROMPT_VERSION } from '../src/prompts/quizPrompt';
import { YuzeeRequestAssembler } from '../src/services/YuzeeRequestAssembler';
import { SystemPromptCacheManager } from '../src/services/SystemPromptCacheManager';
import { eligibleTools, scopedInstruction, ROUTER_VERSION } from '../src/routing/policy';

const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const source = readFileSync(QUIZ_PROMPT_PATH, 'utf8');
assert.equal(hash(source), 'dae1a51322233fdf030558643a31bf0ff81cda54d3ed0eb6abff50b307a38890', 'Supplied v1.7 instructions must be preserved exactly');
assert.equal(readFileSync(`spring-backend/src/main/resources/yuzee/prompts/${QUIZ_PROMPT_FILENAME}`, 'utf8'), source);
const javaRegistry = readFileSync('spring-backend/src/main/java/com/yuzee/tokenlab/service/YuzeeProtocolRegistry.java', 'utf8');
assert.ok(javaRegistry.includes(`PROMPT_VERSION = "${QUIZ_PROMPT_VERSION}"`));
assert.ok(javaRegistry.includes(QUIZ_PROMPT_FILENAME));

const assembler = YuzeeRequestAssembler.getInstance();
const base = { model: 'gemini-3.7-flash', messageText: 'Explain what makes a course useful.', useStructuredOutput: true };
const ordinary = assembler.assembleRequest(base);
const overlays = readFileSync('src/prompts/clear-guidance.md', 'utf8') + '\n' + readFileSync('src/prompts/learning-depth.md', 'utf8');
assert.equal(ordinary.systemInstruction, source + '\n' + overlays);
assert.equal(ordinary.geminiConfig.systemInstruction, ordinary.systemInstruction);
assert.equal(ordinary.contents, base.messageText, 'Instructions must stay out of the user message');
assert.equal(ordinary.geminiConfig.responseMimeType, 'application/json');
assert.deepEqual(Object.keys(assembler.getSchemaJson().properties).sort(), [
  'schema_version', 'current_mode', 'response_intent', 'content_blocks', 'interaction',
  'service_trigger', 'rmo_readiness', 'state', 'followups',
].sort());
const info = assembler.getProtocolInfo();
assert.equal(info.promptVersion, '1.7');
assert.equal(info.schemaVersion, '1.3');
assert.equal(info.protocolVersion, '1.3');
assert.equal(info.promptHash, hash(ordinary.systemInstruction));
assert.equal(info.promptBytes, Buffer.byteLength(ordinary.systemInstruction));

// Every approved skill can still add its scoped guidance without replacing the quiz.
assert.equal(eligibleTools.length, 103);
for (const tool of eligibleTools) {
  const instruction = scopedInstruction({ status: 'selected', toolId: tool.id, score: .9, margin: .2, reason: 'clear-semantic-match', version: ROUTER_VERSION });
  assert.ok(instruction, tool.id);
  const request = assembler.assembleRequest({ ...base, microToolInstruction: instruction, useMultiTurn: true, keptTurns: [] });
  assert.equal(request.systemInstruction, ordinary.systemInstruction, tool.id);
  const contents = JSON.stringify(request.contents);
  assert.ok(contents.includes(tool.id), tool.id);
  assert.equal(contents.split(base.messageText).length - 1, 1, tool.id);
  assert.deepEqual(request.geminiConfig.responseSchema, ordinary.geminiConfig.responseSchema, tool.id);
}
const custom = assembler.assembleRequest({ ...base, systemPromptMode: 'custom', customSystemPrompt: 'Custom test instructions' });
assert.equal(custom.systemInstruction, 'Custom test instructions\n' + overlays, 'Keep explicit custom overrides');
assembler.reload();
assert.equal(assembler.getPromptHash(), info.promptHash, 'Reload must be deterministic');

// A valid but old prompt cache must never be returned after changing the default.
const old = readFileSync('src/protocol/v1.3/Yuzee_Main_Prompt_Gemini_JSON_ONLY_FINAL_v0.12.md', 'utf8') + '\n' + overlays;
assert.notEqual(hash(old), info.promptHash);
const created: any[] = [], deleted: string[] = [];
const provider: any = { caches: {
  create: async (request: any) => { created.push(request); return { name: `cachedContents/test-${created.length}` }; },
  delete: async ({ name }: { name: string }) => { deleted.push(name); },
} };
const cache = new SystemPromptCacheManager();
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
assert.equal(await cache.getCacheForModel(base.model, provider, old, hash(old)), null);
await settle();
assert.equal(await cache.getCacheForModel(base.model, provider, old, hash(old)), 'cachedContents/test-1');
assert.equal(await cache.getCacheForModel(base.model, provider, ordinary.systemInstruction, info.promptHash), null);
await settle();
assert.deepEqual(deleted, ['cachedContents/test-1']);
assert.equal(created[1].config.systemInstruction, ordinary.systemInstruction);
assert.ok(created[1].config.displayName.includes('v1.7'));
assert.equal(await cache.getCacheForModel(base.model, provider, ordinary.systemInstruction, info.promptHash), 'cachedContents/test-2');
console.log('PASS: exact v1.7 assets, both backend references, single system instruction, all 103 skill insertions, JSON v1.3, custom overrides, reload and stale-cache replacement.');
