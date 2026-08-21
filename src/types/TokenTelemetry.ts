/**
 * Yuzee Token Telemetry & Lifecycle Tracing Types
 */

export type TelemetrySource = 'provider' | 'countTokens' | 'estimate' | 'derived' | 'unavailable';

export interface TokenMeasurement<T = number> {
  value: T;
  source: TelemetrySource;
  exact: boolean;
}

export interface RequestTimeline {
  aiRequestId: string;
  requestReceivedAt: number;
  preProviderLatencyMs: number;
  providerRequestStartedAt: number;
  providerTtftMs: number | null; // Time to first chunk from Gemini
  providerGenerationDurationMs: number | null; // First chunk to stream complete
  providerCompletedAt: number;
  validationDurationMs: number;
  validationCompletedAt: number;
  uiDelayMs?: number;
  totalLatencyMs: number;
}

export interface RequestTrace {
  aiRequestId: string;
  promptHash: string;
  systemTokenCount: number;
  dynamicContextTokenCount: number;
  currentMessageTokenCount: number;
  historicalTurnsCount: number;
  schemaVersion: string;
  providerModel: string;
  appliedThinkingLevel: string;
  numericThinkingBudget?: number;
  maxOutputTokens?: number;
}

export interface TurnTokenUsage {
  currentUserTokens: number | null;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number | null;
  cachedTokens: number | null;
  toolTokens: number | null;
  totalTokens: number;
  uncachedInputTokens?: number | null;
  cacheHitPercentage?: number | null;
  sources: {
    inputTokens: TelemetrySource;
    outputTokens: TelemetrySource;
    thinkingTokens: TelemetrySource;
    cachedTokens: TelemetrySource;
    currentUserTokens: TelemetrySource;
  };
  timeline: RequestTimeline;
  requestTrace: RequestTrace;
}
