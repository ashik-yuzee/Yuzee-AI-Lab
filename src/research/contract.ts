import Ajv from 'ajv';
import type { DetailAnswer, DetailRequest, DetailSource, Evidence } from './types';

const text = { type: 'string', minLength: 1, maxLength: 1600 };
export const answerSchema = {
  type: 'object', additionalProperties: false,
  required: ['status', 'summary', 'facts', 'gaps', 'nextQuestions'],
  properties: {
    status: { type: 'string', enum: ['answered', 'partial', 'needs_clarification', 'no_evidence'] },
    summary: text,
    facts: { type: 'array', maxItems: 100, items: {
      type: 'object', additionalProperties: false, required: ['text', 'kind', 'evidenceIds'],
      properties: { text, kind: { type: 'string', enum: ['source_backed', 'inference', 'benchmark'] },
        evidenceIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } } },
    } },
    gaps: { type: 'array', maxItems: 12, items: text },
    nextQuestions: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false,
      required: ['kind', 'text'], properties: { kind: { type: 'string', enum: ['ask_user', 'suggested_question'] }, text } } },
  },
};
const validate = new Ajv({ allErrors: true }).compile(answerSchema);

export function parseDetailRequest(body: any): DetailRequest {
  const limits = { parentMessageId: 150, target: 350, question: 1500, studyYear: 20, location: 150 };
  const result: any = {};
  if (!body || typeof body !== 'object') throw new Error('Enter the course or option and your question.');
  for (const [key, limit] of Object.entries(limits)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) throw new Error(`Please shorten ${key}.`);
    result[key] = value.trim();
  }
  if (!result.parentMessageId || !result.target || !result.question) throw new Error('Enter the course or option and your question.');
  if (body.refresh !== undefined) {
    if (typeof body.refresh !== 'boolean') throw new Error('Refresh must be a yes or no choice.');
    result.refresh = body.refresh;
  }
  return result;
}

export function safeSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) &&
      !url.hostname.endsWith('.local') && !url.hostname.endsWith('.internal');
  } catch { return false; }
}

export function eligibleSource(url: string, title: string, trustedDomains: string[] = []): boolean {
  const host = new URL(url).hostname.toLowerCase();
  // Google may return an opaque redirect plus a hostname as its source title.
  const labelledHost = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title.trim()) ? title.trim().toLowerCase() : '';
  const domain = host === 'vertexaisearch.cloud.google.com' ? labelledHost : host;
  return /\.(edu|gov)(\.[a-z]{2})?$|\.ac\.[a-z]{2}$/.test(domain) ||
    trustedDomains.some(trusted => domain === trusted || domain.endsWith(`.${trusted}`));
}

// Only citation segments supplied by the provider become eligible evidence.
// A model-written source list alone never establishes provenance.
export function extractEvidence(response: any, trustedDomains: string[] = []): { sources: DetailSource[]; evidence: Evidence[]; searchSuggestionsHtml: string } {
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const sources: DetailSource[] = [];
  const byIndex = new Map<number, string>();
  for (const [index, chunk] of (metadata?.groundingChunks || []).entries()) {
    if (!safeSourceUrl(chunk.web?.uri) || !eligibleSource(chunk.web.uri, chunk.web.title || '', trustedDomains)) continue;
    let source = sources.find(s => s.url === chunk.web.uri);
    if (!source) { source = { id: `s${sources.length + 1}`, title: chunk.web.title || 'Source', url: chunk.web.uri }; sources.push(source); }
    byIndex.set(index, source.id);
  }
  const evidence: Evidence[] = [];
  for (const support of metadata?.groundingSupports || []) {
    const text = support.segment?.text?.trim();
    // Do not detach an excluded source from a mixed-source claim and present it
    // as though the remaining institution independently supported all of it.
    if ((support.groundingChunkIndices || []).some((i: number) => !byIndex.has(i))) continue;
    const sourceIds = [...new Set<string>((support.groundingChunkIndices || []).map((i: number) => byIndex.get(i)).filter(Boolean))];
    if (text && sourceIds.length) evidence.push({ id: `e${evidence.length + 1}`, text, sourceIds });
  }
  return { sources, evidence, searchSuggestionsHtml: metadata?.searchEntryPoint?.renderedContent || '' };
}

export function validateAnswer(value: unknown, evidence: Evidence[]): DetailAnswer {
  if (!validate(value)) throw new Error('The detail answer was incomplete. Please try again.');
  const answer = value as DetailAnswer;
  if (/\byou (?:can|will) (?:only )?(?:manage|handle|cope)\b/i.test([answer.summary, ...answer.facts.map(f => f.text)].join(' '))) {
    throw new Error('The answer makes an unsupported guarantee about personal capacity. Use conditional planning and keep attendance/workload uncertainties explicit.');
  }
  const ids = new Set(evidence.map(e => e.id));
  if (answer.facts.some(f => f.evidenceIds.some(id => !ids.has(id)))) throw new Error('The answer cited evidence that was not retrieved.');
  if (answer.status === 'answered' && (!answer.facts.length || answer.gaps.length)) throw new Error('The answer did not resolve all its gaps.');
  if (answer.status === 'partial' && (!answer.facts.length || !answer.gaps.length)) throw new Error('The partial answer did not identify its gaps.');
  if (answer.status === 'needs_clarification' && !answer.nextQuestions.some(q => q.kind === 'ask_user')) throw new Error('The answer did not include the question it needs answered.');
  if (answer.status === 'no_evidence' && answer.facts.length) throw new Error('An answer without evidence cannot include factual findings.');
  return answer;
}
