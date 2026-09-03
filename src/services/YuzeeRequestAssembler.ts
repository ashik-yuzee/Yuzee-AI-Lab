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
import { GEMINI_MODELS } from '../data/models';

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
      try {
        const buf = fs.readFileSync(schemaPath);
        this.responseSchemaJson = JSON.parse(buf.toString('utf-8'));
        this.schemaHash = crypto.createHash('sha256').update(buf).digest('hex');
      } catch (e) {
        console.warn(`[YuzeeRequestAssembler] Schema file could not be parsed at ${schemaPath}:`, e);
      }
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
      promptVersion: '1.6',
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
  public resolveOutputBudget(mode: string = 'standard', _model: string = ''): number {
    // Protocol v1.3 JSON has a fixed minimum schema size regardless of model — no flash-lite discount
    switch (mode.toLowerCase()) {
      case 'quick':   return 2048;
      case 'standard': return 6144;
      case 'explain':
      case 'explore':
      case 'decide':  return 8192;
      case 'detail':  return 8192;
      default:        return 6144;
    }
  }

  /**
   * Deterministic thinking level resolution
   */
  public resolveThinkingConfig(
    modelId: string = 'gemini-3.5-flash-lite',
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
      const isFlashLite = modelId.includes('flash-lite');
      if (
        lower.includes('compare') ||
        lower.includes('pathway') ||
        lower.includes('trade-off') ||
        lower.includes('plan') ||
        lower.includes('roadmap') ||
        lower.includes('vs') ||
        lower.includes('architect') ||
        lower.includes('recommend') ||
        lower.includes('matrix') ||
        lower.includes('trade off') ||
        lower.includes('pros and cons') ||
        lower.includes('which is better') ||
        lower.includes('difference between')
      ) {
        appliedLevel = isFlashLite ? 'low' : 'medium';
      } else if (
        lower.includes('how to') ||
        lower.includes('how do') ||
        lower.includes('how can') ||
        lower.includes('help me') ||
        lower.includes('guide me') ||
        lower.includes('explain') ||
        lower.includes('should i') ||
        lower.includes('career') ||
        lower.includes('certif') ||
        lower.includes('skill') ||
        lower.includes('course') ||
        lower.includes('study') ||
        lower.includes('learn') ||
        lower.includes('job') ||
        lower.includes('role') ||
        lower.includes('salary') ||
        lower.includes('interview') ||
        lower.includes('prepare') ||
        lower.includes('resume') ||
        lower.includes('cv') ||
        lower.includes('portfolio') ||
        lower.includes('next step') ||
        lower.includes('start') ||
        lower.includes('begin') ||
        lower.includes('advice') ||
        lower.includes('suggest') ||
        lower.includes('want to become') ||
        lower.includes('want to be') ||
        lower.includes('want to get into') ||
        lower.includes('looking for') ||
        lower.includes('looking to') ||
        lower.includes('interested in') ||
        lower.includes('thinking about') ||
        lower.includes('switching to') ||
        lower.includes('switch to') ||
        lower.includes('transition') ||
        lower.includes('developer') ||
        lower.includes('engineer') ||
        lower.includes('programmer') ||
        lower.includes('analyst') ||
        lower.includes('data science') ||
        lower.includes('machine learning') ||
        lower.includes('software') ||
        lower.includes('tech') ||
        lower.includes('coding') ||
        lower.includes('junior') ||
        lower.includes('senior') ||
        lower.includes('entry level') ||
        lower.includes('i am') ||
        lower.includes("i'm") ||
        lower.includes('my goal') ||
        lower.includes('my career')
      ) {
        // General guidance/career/intent prompts — upgrade to low (flash-lite) or medium (pro)
        appliedLevel = isFlashLite ? 'low' : 'medium';
      } else if (
        lower.startsWith('what is ') ||
        lower.startsWith('hi ') ||
        lower === 'hi' ||
        lower.startsWith('hello') ||
        lower.startsWith('format') ||
        lower.startsWith('thank') ||
        lower.startsWith('ok') ||
        lower.startsWith('great') ||
        lower.startsWith('got it') ||
        (lower.length < 20 && !lower.includes('?'))
      ) {
        appliedLevel = 'minimal';
      } else {
        appliedLevel = isFlashLite ? 'minimal' : 'low';
      }
    }

    // Model restrictions:
    // Gemini 3.5 Flash-Lite default is minimal
    // Gemini 3.7 Flash does not support minimal thinking level (only low, medium, high)
    // Use the model registry to check supported levels rather than hardcoding model IDs
    const modelInfo = GEMINI_MODELS.find(m => m.id === modelId);
    if (modelInfo && !modelInfo.supportedThinkingLevels.includes(appliedLevel as any)) {
      appliedLevel = modelInfo.supportedThinkingLevels[0] ?? 'low';
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
   * Classifies a user message into a bypass category or 'career' for normal routing.
   * Only matches with high confidence — any ambiguity falls through to 'career'.
   * Returns:
   *   'greeting'  — pure social opener, no career content
   *   'farewell'  — closing/thanks, no career content
   *   'career'    — send to Gemini
   */
  public classifyUserMessage(text: string): 'greeting' | 'farewell' | 'rubbish' | 'idle' | 'career' {
    const t = text.trim().toLowerCase().replace(/[!?.,']+$/, '').trim();

    // Rubbish detection — check before greeting/farewell so "aaaa" doesn't slip through
    if (this._isRubbish(t)) return 'rubbish';

    const greetingPatterns = [
      /^(hi|hey|hello|howdy|hiya|sup|yo)(\s+(there|oala|yuzee|bot|ai|friend))?$/,
      /^good\s+(morning|afternoon|evening|day)(\s+(oala|yuzee))?$/,
      /^how are you(\s+(doing|going|today))?$/,
      /^(are you there|you there|you working|is this working|test|testing|hello\?)$/,
      /^what('s| is) up(\s+with you)?$/,
    ];

    const farewellPatterns = [
      /^(bye|goodbye|see you|see ya|cya|ttyl|later|take care)(\s+(later|soon|then|now))?$/,
      /^(thanks|thank you|thx|ty|cheers|great|awesome|perfect|got it|ok|okay|cool|nice|sounds good)(\s+(for (that|everything|your help|the help)))?$/,
      /^(that('s| is) (great|helpful|perfect|all|enough)|no (more )?questions?|i('m| am) (done|good|all set|all good))$/,
    ];

    const idlePatterns = [
      // Laughter / reactions
      /^(lo+l+o*|lmao|lmfao|rofl|ha(ha)+|he(he)+|hah|lel|lulz|xd|😂|🤣|omg|omfg|wtf|smh|fml)$/,
      // Indifference
      /^(meh|whatever|whatevs|idc|i don'?t care|boring|ugh|bleh|mmmh?|hmm+)$/,
      // I'm bored
      /^i('m| am) bored(\s+(rn|right now|today|tbh))?$/,
      // Compliments to the bot
      /^you('re| are) (funny|hilarious|great|amazing|cool|nice|smart|the best)$/,
      /^(nice one|good one|haha nice|that('s| is) funny|made me (laugh|smile))$/,
      // Non-career questions to deflect
      /^(what('s| is) the (time|weather|date|temp(erature)?)|what day is it)$/,
      /^(tell me a joke|say something funny|make me laugh|entertain me)$/,
      /^(sing( me a song)?|dance|do a trick|flip a coin|roll (a )?d(ice|6|20))$/,
      /^(what('s| is) (your (name|age|favourite|favorite|hobby|hobbies))|do you (like|love|hate|eat|sleep|dream))$/,
      /^(are you (a robot|an ai|sentient|alive|human|real)|who (made|built|created) you)$/,
      /^(how old are you|where are you from|what are you|who are you)$/,
      // Just vibes
      /^(nothing|never ?mind|no ?thing|just (browsing|looking|chilling|vibing|kidding|joking)|jk|nm|nvm|nevermind)$/,
    ];

    if (greetingPatterns.some(p => p.test(t))) return 'greeting';
    if (farewellPatterns.some(p => p.test(t))) return 'farewell';
    if (idlePatterns.some(p => p.test(t))) return 'idle';
    return 'career';
  }

  private _isRubbish(t: string): boolean {
    if (!t || t.length < 2) return true;

    // Pure symbol/emoji noise with no letters
    if (/^[^a-z0-9]+$/i.test(t)) return true;

    // Same character repeated 5+ times ("aaaaaaa", "!!!!!!!")
    if (/(.)\1{4,}/.test(t)) return true;

    // Keyboard row mash — 5+ consecutive chars from the same row
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (const row of rows) {
      for (let i = 0; i <= row.length - 5; i++) {
        if (t.includes(row.slice(i, i + 5))) return true;
        // Also check reverse
        const rev = row.slice(i, i + 5).split('').reverse().join('');
        if (t.includes(rev)) return true;
      }
    }

    // Every "word" has no vowels AND is longer than 2 chars (filters SQL, AWS, etc.)
    const words = t.split(/\s+/).filter(w => w.length > 2 && /^[a-z]+$/.test(w));
    if (words.length > 0 && words.every(w => !/[aeiou]/.test(w))) return true;

    return false;
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
    const model = params.model || 'gemini-3.5-flash-lite';
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
