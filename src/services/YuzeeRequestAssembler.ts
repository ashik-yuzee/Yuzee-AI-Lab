/**
 * Yuzee Request Assembler & Protocol v1.3 Builder
 * Responsible for:
 * - Loading and verifying immutable Yuzee Production Prompt v0.12 and Response Schema v1.3
 * - Strict single-system-instruction enforcement (system instruction is NEVER copied into contents)
 * - Strict single-user-message enforcement
 * - Provider structured-output schema enforcement for Node.js @google/genai
 * - Request timeline tracing and metadata generation
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GenerateContentConfig } from '@google/genai';
import { UserEvent } from '../types/UserEvent';
import { estimateTokens } from './TokenBudgetMemoryManager';

export interface ProtocolInfo {
  promptVersion: string;
  protocolVersion: string;
  schemaVersion: string;
  promptHash: string;
  schemaHash: string;
  promptBytes: number;
  targetRuntime: string;
  configured: boolean;
  trustedServicesCount: number;
}

export interface AssembledGeminiRequest {
  aiRequestId: string;
  model: string;
  systemInstruction: string;
  contents: string;
  geminiConfig: GenerateContentConfig;
  appliedThinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  numericThinkingBudget: number;
  maxOutputTokens: number;
  dynamicContextTokenCount: number;
  currentMessageTokenCount: number;
  careerContext?: Record<string, string | undefined>;
  timeline: {
    aiRequestId: string;
    requestReceivedAt: number;
    preProviderLatencyMs: number;
  };
}

export class YuzeeRequestAssembler {
  private static instance: YuzeeRequestAssembler | null = null;
  private promptContent: string = '';
  private promptHash: string = '';
  private promptBytes: number = 0;
  private responseSchemaJson: any = null;
  private schemaHash: string = '';

  private constructor() {
    this.loadAuthoritativeAssets();
  }

  public static getInstance(): YuzeeRequestAssembler {
    if (!YuzeeRequestAssembler.instance) {
      YuzeeRequestAssembler.instance = new YuzeeRequestAssembler();
    }
    return YuzeeRequestAssembler.instance;
  }

  private loadAuthoritativeAssets(): void {
    const promptPath = path.resolve(process.cwd(), 'src/protocol/v1.3/Yuzee_Main_Prompt_Gemini_JSON_ONLY_FINAL_v0.12.md');
    const schemaPath = path.resolve(process.cwd(), 'src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json');

    if (fs.existsSync(promptPath)) {
      const buf = fs.readFileSync(promptPath);
      this.promptContent = buf.toString('utf-8');
      this.promptBytes = buf.length;
      this.promptHash = crypto.createHash('sha256').update(buf).digest('hex');
    } else {
      console.warn(`[YuzeeRequestAssembler] Prompt file not found at ${promptPath}`);
    }

    if (fs.existsSync(schemaPath)) {
      const buf = fs.readFileSync(schemaPath);
      this.responseSchemaJson = JSON.parse(buf.toString('utf-8'));
      this.schemaHash = crypto.createHash('sha256').update(buf).digest('hex');
    } else {
      console.warn(`[YuzeeRequestAssembler] Schema file not found at ${schemaPath}`);
    }
  }

  public getPromptContent(): string {
    return this.promptContent;
  }

  public getPromptHash(): string {
    return this.promptHash;
  }

  public getPromptBytes(): number {
    return this.promptBytes;
  }

  public getSchemaJson(): any {
    return this.responseSchemaJson;
  }

  public getSchemaHash(): string {
    return this.schemaHash;
  }

  public getProtocolInfo(isConfigured: boolean = false, trustedServicesCount: number = 4): ProtocolInfo {
    return {
      promptVersion: '0.12',
      protocolVersion: '1.3',
      schemaVersion: '1.3',
      promptHash: this.promptHash,
      schemaHash: this.schemaHash,
      promptBytes: this.promptBytes,
      targetRuntime: 'Node.js / Express / @google/genai',
      configured: isConfigured,
      trustedServicesCount,
    };
  }

  /**
   * Deterministic output budgets per response mode.
   * Flash Lite gets reduced caps: smaller model produces shorter responses, lower caps cut latency.
   */
  public resolveOutputBudget(mode: string = 'standard', model: string = ''): number {
    const isFlashLite = model.includes('flash-lite');
    switch (mode.toLowerCase()) {
      case 'quick':   return isFlashLite ? 512  : 1024;
      case 'standard': return isFlashLite ? 1024 : 2048;
      case 'explain':
      case 'explore':
      case 'decide':  return isFlashLite ? 1536 : 3072;
      case 'detail':  return isFlashLite ? 2048 : 4096;
      default:        return isFlashLite ? 1024 : 2048;
    }
  }

  /**
   * Deterministic thinking level resolution
   */
  public resolveThinkingConfig(
    modelId: string = 'gemini-3.6-flash',
    thinkingLevel: string = 'adaptive',
    userPrompt: string = ''
  ): {
    thinkingConfig?: { thinkingLevel?: string; thinkingBudget?: number };
    appliedThinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
    numericBudget: number;
  } {
    let appliedLevel: 'minimal' | 'low' | 'medium' | 'high' = 'medium';

    if (thinkingLevel === 'minimal') {
      appliedLevel = 'minimal';
    } else if (thinkingLevel === 'low') {
      appliedLevel = 'low';
    } else if (thinkingLevel === 'medium') {
      appliedLevel = 'medium';
    } else if (thinkingLevel === 'high') {
      appliedLevel = 'high';
    } else {
      // Adaptive deterministic local classifier (zero latency, no extra provider request)
      const lower = (userPrompt || '').toLowerCase();
      if (
        lower.includes('compare') ||
        lower.includes('pathway') ||
        lower.includes('trade-off') ||
        lower.includes('plan') ||
        lower.includes('roadmap') ||
        lower.includes('vs') ||
        lower.includes('architect') ||
        lower.includes('recommend') ||
        lower.includes('matrix')
      ) {
        appliedLevel = modelId.includes('flash-lite') ? 'low' : 'medium';
      } else if (
        lower.length < 35 ||
        lower.startsWith('what is') ||
        lower.startsWith('hi') ||
        lower.startsWith('hello') ||
        lower.startsWith('format') ||
        lower.startsWith('thank')
      ) {
        appliedLevel = 'minimal';
      } else {
        appliedLevel = modelId.includes('flash-lite') ? 'minimal' : 'low';
      }
    }

    // Model restrictions:
    // Gemini 3.5 Flash-Lite default is minimal
    // Gemini 3.7 Flash does not support minimal thinking level (only low, medium, high)
    if (modelId === 'gemini-3.7-flash' && appliedLevel === 'minimal') {
      appliedLevel = 'low';
    }

    const numericBudgetMap = {
      minimal: 0,
      low: 128,
      medium: 512,
      high: modelId.includes('flash-lite') ? 128 : 1024,
    };
    const numericBudget = numericBudgetMap[appliedLevel];

    return {
      // omit thinkingConfig entirely when budget=0; sending {thinkingBudget:0} causes INVALID_ARGUMENT on some models
      thinkingConfig: numericBudget > 0 ? { thinkingBudget: numericBudget } : undefined,
      appliedThinkingLevel: appliedLevel,
      numericBudget,
    };
  }

  /**
   * Normalizes response mode capitalization to exact Prompt v0.12 spec
   */
  public normalizeModeCapitalization(mode: string = 'Standard'): string {
    const m = (mode || 'Standard').trim().toLowerCase();
    switch (m) {
      case 'quick':
        return 'Quick';
      case 'explain':
        return 'Explain';
      case 'explore':
        return 'Explore';
      case 'detail':
        return 'Detail';
      case 'decide':
        return 'Decide';
      case 'standard':
      default:
        return 'Standard';
    }
  }

  /**
   * Format structured userEvent or raw text into model-facing input
   */
  public formatUserEvent(messageText: string, userEvent?: UserEvent, selectedMode: string = 'Standard'): string {
    const canonicalMode = this.normalizeModeCapitalization(
      userEvent?.ui?.selected_mode ||
      userEvent?.userEvent?.ui?.selected_mode ||
      selectedMode
    );

    const eventPayload: any = {
      ui: {
        selected_mode: canonicalMode,
      },
    };

    if (userEvent?.ui) {
      eventPayload.ui = { ...eventPayload.ui, ...userEvent.ui, selected_mode: canonicalMode };
    } else if (userEvent?.userEvent?.ui) {
      eventPayload.ui = { ...eventPayload.ui, ...userEvent.userEvent.ui, selected_mode: canonicalMode };
    }

    if (userEvent?.interaction) {
      eventPayload.interaction = userEvent.interaction;
    } else if (userEvent?.userEvent?.interaction) {
      eventPayload.interaction = userEvent.userEvent.interaction;
    } else if (userEvent?.type) {
      // Normalize legacy convenience payload
      eventPayload.interaction = {
        question_id: userEvent.interaction_id || 'active_question',
        selected_option_ids: userEvent.option_id ? [userEvent.option_id] : (userEvent.selected_option_ids || undefined),
        ranked_option_ids: userEvent.ranked_ids || userEvent.ranked_option_ids,
        fields: userEvent.fields,
        self_input: userEvent.value || userEvent.self_input,
        action_id: userEvent.action_id,
      };
    }

    if (messageText && messageText.trim().length > 0 && !eventPayload.interaction) {
      eventPayload.user_text = messageText.trim();
    } else if (messageText && messageText.trim().length > 0 && eventPayload.interaction) {
      // If user typed supplementary text alongside a structured interaction
      eventPayload.supplementary_text = messageText.trim();
    }

    return `USER_EVENT:\n${JSON.stringify(eventPayload, null, 2)}`;
  }

  public formatCareerContext(capsule: Record<string, string | undefined>): string {
    if (!capsule) return '';
    const entries = Object.entries(capsule).filter(([_, v]) => v && v.trim().length > 0);
    if (entries.length === 0) return '';
    return `YUZEE_STRUCTURED_MEMORY_CAPSULE:\n${entries.map(([k, v]) => `- [${k}]: ${v!.trim()}`).join('\n')}`;
  }

  /**
   * Assembles the complete Gemini request adhering to:
   * 1. System prompt in config.systemInstruction ONLY (never copied into contents)
   * 2. Current user message / UserEvent appended ONCE
   * 3. Response schema v1.3 provider-enforced
   * 4. Structured output JSON MIME type
   */
  public assembleRequest(params: {
    model: string;
    messageText: string;
    userEvent?: UserEvent;
    careerContext?: Record<string, string | undefined>;
    summaryText?: string;
    recentHistoryText?: string;
    responseMode?: string;
    thinkingLevel?: string;
    customSystemPrompt?: string;
    systemPromptMode?: string;
  }): AssembledGeminiRequest {
    const requestReceivedAt = Date.now();
    const aiRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Resolve System Instruction
    let systemInstruction = this.promptContent;
    if (params.systemPromptMode === 'custom' && params.customSystemPrompt && params.customSystemPrompt.trim().length > 0) {
      systemInstruction = params.customSystemPrompt.trim();
    }

    // 2. Format Dynamic Context (Capsule + Summary + Recent Turns)
    const careerStr = this.formatCareerContext(params.careerContext || {});
    const dynamicSections: string[] = [];

    if (careerStr) {
      dynamicSections.push(careerStr);
    }
    if (params.summaryText && params.summaryText.trim().length > 0) {
      dynamicSections.push(`PREVIOUS_CONVERSATION_SUMMARY:\n${params.summaryText.trim()}`);
    }
    if (params.recentHistoryText && params.recentHistoryText.trim().length > 0) {
      dynamicSections.push(`RECENT_DIALOGUE_TURNS:\n${params.recentHistoryText.trim()}`);
    }

    const dynamicContextStr = dynamicSections.join('\n\n');
    const dynamicContextTokenCount = estimateTokens(dynamicContextStr);

    // 3. Format Current User Input (UserEvent or Raw Text)
    const currentUserStr = this.formatUserEvent(params.messageText, params.userEvent, params.responseMode);
    const currentMessageTokenCount = estimateTokens(currentUserStr);

    // 4. Assembled Contents for Gemini
    // Ordering: Dynamic Context (Capsule/Summary/History) -> Current User Turn
    // NOTE: SYSTEM PROMPT IS EXCLUDED FROM CONTENTS (Sent in dedicated systemInstruction field)
    const contents = dynamicContextStr
      ? `${dynamicContextStr}\n\nCURRENT_USER_INPUT:\n${currentUserStr}`
      : `CURRENT_USER_INPUT:\n${currentUserStr}`;

    // 5. Config resolution
    const model = params.model || 'gemini-3.6-flash';
    const responseMode = params.responseMode || 'standard';
    const maxOutputTokens = this.resolveOutputBudget(responseMode, model);
    const { thinkingConfig, appliedThinkingLevel, numericBudget } = this.resolveThinkingConfig(
      model,
      params.thinkingLevel || 'adaptive',
      params.messageText
    );

    const geminiConfig: GenerateContentConfig = {
      systemInstruction,
      responseMimeType: 'application/json',
      maxOutputTokens,
      ...(thinkingConfig ? { thinkingConfig: thinkingConfig as any } : {}),
    };

    const preProviderLatencyMs = Date.now() - requestReceivedAt;

    return {
      aiRequestId,
      model,
      systemInstruction,
      contents,
      geminiConfig,
      appliedThinkingLevel,
      numericThinkingBudget: numericBudget,
      maxOutputTokens,
      dynamicContextTokenCount,
      currentMessageTokenCount,
      careerContext: params.careerContext,
      timeline: {
        aiRequestId,
        requestReceivedAt,
        preProviderLatencyMs,
      },
    };
  }
}
