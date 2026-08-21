/**
 * Yuzee AI Token Lab - Types & Domain Models
 */

import { ModelCapabilityInfo } from "./data/models";
import {
  YuzeeResponseV13,
  YuzeeContentBlock,
  YuzeeItem,
  YuzeeInteraction,
  YuzeeOption,
  YuzeeField,
  YuzeeService,
  YuzeeState,
  UserConfidenceState,
  ServiceAction,
  YuzeeFollowups,
  FollowupTrigger,
} from "./protocol/v1.3/Yuzee_Response_Protocol_v1.3";
import {
  UserEvent,
  UserEventPayload,
  UserEventInteraction,
  UserEventUI,
} from "./types/UserEvent";
import {
  ProtocolValidationResult,
  TrustedServiceAction,
  ProtocolInfo,
} from "./types/ProtocolViewModel";
import {
  RequestTimeline,
  RequestTrace,
  TurnTokenUsage,
  TelemetrySource,
} from "./types/TokenTelemetry";

export type {
  YuzeeResponseV13,
  UserEvent,
  UserEventPayload,
  UserEventInteraction,
  UserEventUI,
  YuzeeContentBlock,
  YuzeeItem,
  YuzeeInteraction,
  YuzeeOption,
  YuzeeField,
  YuzeeService,
  YuzeeState,
  UserConfidenceState,
  ServiceAction,
  YuzeeFollowups,
  FollowupTrigger,
  ProtocolValidationResult,
  TrustedServiceAction,
  ProtocolInfo,
  RequestTimeline,
  RequestTrace,
  TurnTokenUsage,
  TelemetrySource,
};

export type ModelId = string;

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high' | 'adaptive';

export type OptimizationMode = 'AUTO' | 'SAVE_TOKENS' | 'FULL_CONTEXT' | 'ADVANCED';

export type OptimizationStrategy = 
  | 'BASELINE'         // Baseline / Full History (High token usage)
  | 'SLIDING_WINDOW'   // Turn-safe Sliding Window
  | 'SUMMARY_RECENT'   // Incremental Summary + Recent Turns
  | 'ADAPTIVE_HYBRID'; // Token-budget Prioritized Adaptive Hybrid (Default)

export type PresetMode = 'MAX_QUALITY' | 'BALANCED' | 'MAX_SAVINGS' | 'ADVANCED';

export type ResponseMode = 'quick' | 'standard' | 'explain' | 'explore' | 'detail' | 'decide';

export type QualityFeedbackType = 
  | 'good' 
  | 'context_missing' 
  | 'too_verbose' 
  | 'too_short' 
  | 'incorrect' 
  | 'other';

export type ModelCapability = ModelCapabilityInfo;

export interface TokenUsageMetrics {
  currentUserTokens: number | null;     // Tokens in what user just typed
  inputTokens: number;                  // Total prompt tokens sent to Gemini
  outputTokens: number;                 // Visible completion tokens
  thinkingTokens: number | null;        // Hidden reasoning/thinking tokens
  cachedTokens: number | null;          // Tokens read from implicit/explicit cache
  toolTokens: number | null;            // Tokens for tool declarations/use
  totalTokens: number;                  // Total tokens for this turn
  uncachedInputTokens?: number | null;
  cacheHitPercentage?: number | null;
  latencyMs?: number;
  timeToFirstTokenMs?: number | null;
}

export interface ContextSectionDetail {
  name: string;
  description: string;
  tokens: number;
  preview: string;
}

export interface ExcludedSectionDetail {
  name: string;
  reason: string;
  tokens: number;
  preview: string;
}

export interface ContextBreakdown {
  systemInstructionTokens: number;
  careerContextTokens: number;
  summaryTokens: number;
  recentTurnsTokens: number;
  currentMessageTokens: number;
  totalAssembledTokens: number;
  removedTokens: number;
  includedSections: ContextSectionDetail[];
  excludedSections: ExcludedSectionDetail[];
}

export interface CompactionMetrics {
  compactionEventId?: string;
  sourceTurnsRange?: string;
  sourceTokens: number;
  summaryTokens: number;
  tokensRemoved: number;
  compactionInputTokens: number;
  compactionOutputTokens: number;
  compactionTotalCost: number;
  estimatedNetSavingsPerTurn: number;
  estimatedBreakEvenTurns: number;
  timestamp: number;
}

export interface StructuredMemoryCapsule {
  facts?: string;         // Verified user background, education, current role
  goals?: string;         // Target job role, target salary, desired milestones
  constraints?: string;   // Time budget, financial budget, location/remote
  decisions?: string;     // Confirmed roadmap choices, chosen certs/courses
  openThreads?: string;   // Unresolved questions, pending decisions
}

export interface CareerContextCapsule {
  facts?: string;
  goals?: string;
  constraints?: string;
  decisions?: string;
  openThreads?: string;
  goal?: string;
  currentStage?: string;
  targetRole?: string;
  education?: string;
  keySkills?: string;
  location?: string;
  timeline?: string;
  preferences?: string;
  openQuestions?: string;
}

export interface LifecycleTraceStep {
  step: number;
  name: string;
  status: 'completed' | 'skipped' | 'optimized';
  tokensIn?: number;
  tokensOut?: number;
  tokensDelta?: number;
  details: string;
  timestamp: number;
}

export interface LifecycleTrace {
  turnId: string;
  timestamp: number;
  steps: LifecycleTraceStep[];
  totalProcessingTimeMs: number;
  netTokensSaved: number;
}

export interface MessageTelemetry {
  usage: TokenUsageMetrics;
  contextMetrics: ContextBreakdown;
  compactionMetrics?: CompactionMetrics | null;
  lifecycleTrace?: LifecycleTrace;
  timeline?: {
    aiRequestId?: string;
    requestReceivedAt?: number;
    preProviderLatencyMs?: number;
    conversationLoadMs?: number;
    userEventValidationMs?: number;
    memoryAssemblyMs?: number;
    requestAssemblyMs?: number;
    providerTtftMs?: number | null;
    providerGenMs?: number | null;
    validationDurationMs?: number;
    totalLatencyMs?: number;
  };
  model: string;
  thinkingLevel: ThinkingLevel;
  appliedThinkingLevel?: string;
  optimizationMode?: OptimizationMode;
  optimizationStrategy: OptimizationStrategy;
  preset: PresetMode;
  responseMode: ResponseMode;
  recentTurnsCount: number;
  hasSummary: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredResponse?: YuzeeResponseV13;
  schemaValid?: boolean;
  semanticValid?: boolean;
  validationErrors?: string[];
  protocolVersion?: string;
  telemetry?: MessageTelemetry;
  feedback?: {
    type: QualityFeedbackType;
    comment?: string;
    timestamp: number;
  };
  createdAt: number;
  isStreaming?: boolean;
  error?: string;
  errorCode?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: ModelId;
  mode: OptimizationMode;
  strategy: OptimizationStrategy;
  preset: PresetMode;
  responseMode: ResponseMode;
  thinkingLevel: ThinkingLevel;
  contextBudget: number;
  recentTurnsToKeep: number;
  careerContext: CareerContextCapsule;
  summary: string;
  summaryVersion: number;
  systemPromptMode: 'default' | 'compact' | 'custom';
  customSystemPrompt?: string;
  useInteractionsApi?: boolean;
  useFlashLiteUtility?: boolean;
  previousInteractionId?: string;
  messages: ChatMessage[];
  compactionHistory: CompactionMetrics[];
}

export interface SessionCumulativeStats {
  userFacingChatCalls: number;
  totalUserInputTokens: number;
  totalModelInputTokens: number;
  totalModelOutputTokens: number;
  totalThinkingTokens: number;
  totalCachedTokens: number;
  totalUserFacingTokens: number;

  compactionCalls: number;
  compactionInputTokens: number;
  compactionOutputTokens: number;
  compactionTotalTokens: number;

  trueTotalConsumption: number;
  
  baselineEstimatedTokens: number;
  tokensSaved: number;
  netSavingsPercentage: number;
  cacheHitRatio: number;
  averageTokensPerTurn: number;
  averageOutputPerTurn: number;
  averageThinkingPerTurn: number;
}

export interface BenchmarkResult {
  strategy: OptimizationStrategy;
  label: string;
  model: string;
  mode?: 'live' | 'estimated';
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number;
  latencyMs: number;
  ttftMs?: number | null;
  generationMs?: number | null;
  compactionCost: number;
  responsePreview: string;
  retainedContextTokens: number;
  schemaValid?: boolean;
  notes: string;
}

export interface CapabilitiesResponse {
  configured: boolean;
  availableModels: string[];
  modelsList: ModelCapability[];
  defaultModel: string;
  supportsThinking: boolean;
  supportsCachedTokens: boolean;
  supportsInteractionsApi: boolean;
  supportsExplicitCache: boolean;
  geminiApiKeyPresent: boolean;
  runtime: 'spring-boot' | 'preview-adapter';
}
