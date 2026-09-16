import type { DetailRequest, DetailResult } from './types';

export async function researchDetails(conversationId: string, request: DetailRequest, signal: AbortSignal,
  onProgress: (stage: string) => void): Promise<DetailResult> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/details`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'This search could not start. Please try again.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This search could not start.');
  const decoder = new TextDecoder();
  let buffer = '';
  let result: DetailResult | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === 'progress') onProgress(event.stage);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'result') result = event.result;
      }
    }
  } finally { reader.releaseLock(); }
  if (!result) throw new Error('The connection ended before the answer arrived. Your question has been kept.');
  return result;
}
