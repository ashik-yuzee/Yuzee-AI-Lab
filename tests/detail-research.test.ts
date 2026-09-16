import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractEvidence, eligibleSource, parseDetailRequest, safeSourceUrl, validateAnswer } from '../src/research/contract';
import { DetailResearchService } from '../src/research/DetailResearchService';
import { researchDetails } from '../src/research/client';

let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
const request = { parentMessageId: 'm1', target: 'Example University — Course A', question: 'Can I study part-time?', studyYear: '2027', location: 'Melbourne' };
const search = { candidates: [{ finishReason: 'STOP', groundingMetadata: {
  groundingChunks: [{ web: { uri: 'https://example.edu/course-a', title: 'Course A' } }, { web: { uri: 'javascript:alert(1)' } }, { web: { uri: 'https://example.edu/course-a' } }],
  groundingSupports: [{ segment: { text: 'This course offers part-time study.' }, groundingChunkIndices: [0, 2] }, { segment: { text: 'Unsafe' }, groundingChunkIndices: [1] }],
  webSearchQueries: ['Course A part-time'],
} }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 } };
const extracted = extractEvidence(search);
const answer = { status: 'answered', summary: 'Part-time study is listed.', facts: [{ text: 'Part-time study is listed.', kind: 'source_backed', evidenceIds: ['e1'] }], gaps: [], nextQuestions: [{ kind: 'suggested_question', text: 'What is the weekly workload?' }] };
check('request retains only explicit scope', () => assert.deepEqual(parseDetailRequest({ ...request, hidden: 'ignore' }), request));
check('empty target requires clarification', () => assert.throws(() => parseDetailRequest({ ...request, target: ' ' })));
check('oversized question rejected', () => assert.throws(() => parseDetailRequest({ ...request, question: 'x'.repeat(1501) })));
check('source links reject unsafe schemes and private hosts', () => ['javascript:alert(1)', 'http://example.edu', 'https://127.0.0.1/x', 'https://user:pass@example.edu', 'https://host.local/x'].forEach(url => assert.equal(safeSourceUrl(url), false)));
check('source deduplication preserves citation mapping', () => { assert.equal(extracted.sources.length, 1); assert.deepEqual(extracted.evidence[0].sourceIds, ['s1']); });
check('unsupported passage is omitted', () => assert.equal(extracted.evidence.length, 1));
check('forums and commercial aggregators cannot become course evidence', () => { assert.equal(eligibleSource('https://reddit.com/course', 'reddit.com'), false); assert.equal(eligibleSource('https://augstudy.com/course', 'augstudy.com'), false); });
check('opaque grounding links need an eligible source hostname', () => { assert.equal(eligibleSource('https://vertexaisearch.cloud.google.com/redirect', 'deakin.edu.au'), true); assert.equal(eligibleSource('https://vertexaisearch.cloud.google.com/redirect', 'An Official University'), false); });
check('model source list without provider citations is not evidence', () => assert.equal(extractEvidence({ text: 'Sources: official.edu' }).evidence.length, 0));
check('valid source-backed answer accepted', () => assert.equal(validateAnswer(answer, extracted.evidence).status, 'answered'));
check('invented evidence reference rejected', () => assert.throws(() => validateAnswer({ ...answer, facts: [{ ...answer.facts[0], evidenceIds: ['fake'] }] }, extracted.evidence)));
check('answered cannot conceal gaps', () => assert.throws(() => validateAnswer({ ...answer, gaps: ['Year unknown'] }, extracted.evidence)));
check('partial must have an explicit gap', () => assert.throws(() => validateAnswer({ ...answer, status: 'partial' }, extracted.evidence)));
check('clarification must ask a question', () => assert.throws(() => validateAnswer({ ...answer, status: 'needs_clarification', nextQuestions: [] }, extracted.evidence)));
check('no-evidence state cannot carry facts', () => assert.throws(() => validateAnswer({ ...answer, status: 'no_evidence' }, extracted.evidence)));
check('unknown output keys rejected', () => assert.throws(() => validateAnswer({ ...answer, executableHtml: '<script/>' }, extracted.evidence)));
check('personal capacity guarantee rejected', () => assert.throws(() => validateAnswer({ ...answer, summary: 'You can only manage one unit.' }, extracted.evidence)));
check('all returned facts remain available beyond summary', () => assert.equal(validateAnswer({ ...answer, facts: Array.from({ length: 40 }, (_, i) => ({ ...answer.facts[0], text: `Finding ${i}` })) }, extracted.evidence).facts.length, 40));

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yuzee-details-'));
try {
  const file = path.join(directory, 'details.json');
  const calls: any[] = [];
  const fakeAi = { models: { generateContent: async (input: any) => { calls.push(input); return input.config.tools ? search : { candidates: [{ finishReason: 'STOP' }], text: JSON.stringify(answer) }; } } };
  const service = new DetailResearchService(() => fakeAi as any, file);
  const stages: string[] = [];
  const result = await service.research('c1', request, new AbortController().signal, stage => stages.push(stage));
  check('retrieval precedes specialist and save', () => assert.deepEqual(stages, ['searching', 'analysing', 'saving']));
  check('specialist gets retrieved evidence in same workflow', () => assert.equal(JSON.parse(calls[1].contents).evidence[0].id, 'e1'));
  check('research request never uses main prompt or full chat history', () => { assert.equal(calls.length, 2); assert.equal(JSON.parse(calls[0].contents).history, undefined); });
  check('usage separates research calls and queries', () => { assert.equal(result.usage.calls, 2); assert.equal(result.usage.searchQueries, 1); });
  assert.equal((await new DetailResearchService(() => fakeAi as any, file).list('c1')).length, 1); checks++; console.log('PASS saved research survives service restart');
  assert.equal((await service.list('other')).length, 0); checks++; console.log('PASS conversation scope isolation');
  await service.research('c1', { ...request, question: 'How long would it take?' }, new AbortController().signal, () => {});
  check('follow-up carries prior questions within same scope', () => assert.equal(JSON.parse(calls[2].contents).priorQuestions[0].question, request.question));
  await service.research('c1', { ...request, studyYear: '2028' }, new AbortController().signal, () => {});
  check('changed year does not inherit previous scope', () => assert.equal(JSON.parse(calls[4].contents).priorQuestions.length, 0));
  const callsBeforeCache = calls.length;
  const cached = await service.research('c1', request, new AbortController().signal, () => {});
  check('exact recent answer reopens without another provider call', () => { assert.equal(cached.id, result.id); assert.equal(calls.length, callsBeforeCache); });
  const fresh = await service.research('c1', { ...request, refresh: true }, new AbortController().signal, () => {});
  check('explicit refresh fetches a new version and preserves the old one', () => { assert.notEqual(fresh.id, result.id); assert.equal(calls.length, callsBeforeCache + 2); });
  let repairCalls = 0;
  const repairService = new DetailResearchService(() => ({ models: { generateContent: async (input: any) => {
    repairCalls++;
    if (input.config.tools) return search;
    return { candidates: [{ finishReason: 'STOP' }], text: JSON.stringify(repairCalls === 2 ? { ...answer, summary: 'You can only manage one unit.' } : answer) };
  } } }) as any, path.join(directory, 'repair.json'));
  const repaired = await repairService.research('c1', request, new AbortController().signal, () => {});
  check('one correction fixes rejected wording using the original evidence', () => { assert.equal(repairCalls, 3); assert.equal(repaired.summary, answer.summary); });
  check('clarification cannot be a question for the AI to answer', () => assert.throws(() => validateAnswer({ ...answer, status: 'needs_clarification' }, extracted.evidence)));
  let noEvidenceCalls = 0;
  const noEvidence = new DetailResearchService(() => ({ models: { generateContent: async () => { noEvidenceCalls++; return { text: 'Uncited claims', candidates: [{ finishReason: 'STOP' }] }; } } }) as any, path.join(directory, 'empty.json'));
  const missing = await noEvidence.research('c1', request, new AbortController().signal, () => {});
  check('no grounded evidence skips unsupported specialist answer', () => { assert.equal(noEvidenceCalls, 1); assert.equal(missing.status, 'no_evidence'); assert.deepEqual(missing.facts, []); });
  const abort = new AbortController(); abort.abort();
  await assert.rejects(service.research('cancelled', request, abort.signal, () => {}));
  assert.equal((await service.list('cancelled')).length, 0); checks++; console.log('PASS cancelled work is not saved');
  const broken = new DetailResearchService(() => ({ models: { generateContent: async (input: any) => input.config.tools ? search : { candidates: [{ finishReason: 'MAX_TOKENS' }], text: '{}' } } }) as any, path.join(directory, 'broken.json'));
  await assert.rejects(broken.research('c1', request, new AbortController().signal, () => {}));
  assert.equal((await broken.list('c1')).length, 0); checks++; console.log('PASS truncated specialist output never replaces saved data');
  await service.remove('c1'); assert.equal((await service.list('c1')).length, 0); checks++; console.log('PASS deleting conversation removes its details');

  const originalFetch = globalThis.fetch;
  try {
    const wire = new TextEncoder().encode(`data: ${JSON.stringify({ type: 'progress', stage: 'analysing' })}\n\ndata: ${JSON.stringify({ type: 'result', result: { ...result, summary: 'Étudier' } })}\n\n`);
    globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { for (const byte of wire) controller.enqueue(Uint8Array.of(byte)); controller.close(); } }));
    const parsed = await researchDetails('c1', request, new AbortController().signal, () => {});
    check('stream handles split events and multibyte text', () => assert.equal(parsed.summary, 'Étudier'));
    globalThis.fetch = async () => new Response('data: {"type":"progress","stage":"searching"}\n\n');
    await assert.rejects(researchDetails('c1', request, new AbortController().signal, () => {})); checks++; console.log('PASS dropped stream retains retryable failure');
  } finally { globalThis.fetch = originalFetch; }
} finally { await fs.rm(directory, { recursive: true, force: true }); }
console.log(`${checks} detail-research checks passed.`);
