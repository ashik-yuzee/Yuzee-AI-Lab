import { Injectable } from '@angular/core';
import { ChatService, StructuredResponse } from './chat.service';

@Injectable({ providedIn: 'root' })
export class StreamingService {
  private abortController: AbortController | null = null;

  constructor(private chat: ChatService) {}

  /** Send a message and stream the response via SSE / ReadableStream. */
  async send(
    userText: string,
    conversationId: string,
    groupId: string,
    options: { model?: string; mode?: string; mentions?: string[] } = {}
  ): Promise<void> {
    this.abortController = new AbortController();
    this.chat.startStreaming(groupId);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: userText,
          model: options.model ?? this.chat.snapshot.model,
          mode: options.mode ?? this.chat.snapshot.mode,
          mentions: options.mentions ?? [],
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(err);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let raw = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (event.type === 'status') {
              this.chat.setStreamingStatus(event.message ?? '');
            } else if (event.type === 'chunk') {
              raw += event.text ?? '';
              this.chat.appendStreamChunk(event.text ?? '');
            } else if (event.type === 'done') {
              const parsed = tryParseProtocol(raw);
              this.chat.finaliseAssistantMessage(groupId, raw, parsed, {
                model: event.model,
                promptTokens: event.prompt_tokens,
                completionTokens: event.completion_tokens,
                durationMs: event.duration_ms,
              });
              return;
            }
          } catch {
            // non-JSON line — skip
          }
        }
      }

      // Stream ended without a done event
      const parsed = tryParseProtocol(raw);
      this.chat.finaliseAssistantMessage(groupId, raw, parsed);

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.chat.stopStreaming();
      } else {
        this.chat.setError(err?.message ?? 'Network error');
      }
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

/**
 * Try to parse a Protocol v1.3 JSON blob from the raw response string.
 * The response might be wrapped in ```json``` fences.
 */
function tryParseProtocol(raw: string): StructuredResponse | null {
  const trimmed = raw.trim();
  // Strip markdown code fence
  const inner = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(inner);
    if (parsed?.version && parsed?.output_sections) return parsed as StructuredResponse;
    return null;
  } catch {
    return null;
  }
}
