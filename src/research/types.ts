export interface DetailRequest {
  parentMessageId: string;
  target: string;
  question: string;
  studyYear: string;
  location: string;
  refresh?: boolean;
}
export interface Evidence {
  id: string;
  text: string;
  sourceIds: string[];
}
export interface DetailSource { id: string; title: string; url: string }
export interface DetailAnswer {
  status: 'answered' | 'partial' | 'needs_clarification' | 'no_evidence';
  summary: string;
  facts: { text: string; kind: 'source_backed' | 'inference' | 'benchmark'; evidenceIds: string[] }[];
  gaps: string[];
  nextQuestions: { kind: 'ask_user' | 'suggested_question'; text: string }[];
}
export interface DetailResult extends DetailAnswer {
  policyVersion: string;
  id: string;
  conversationId: string;
  request: DetailRequest;
  retrievedAt: string;
  sources: DetailSource[];
  evidence: Evidence[];
  searchSuggestionsHtml: string;
  usage: { inputTokens: number; outputTokens: number; searchQueries: number; calls: number };
}
