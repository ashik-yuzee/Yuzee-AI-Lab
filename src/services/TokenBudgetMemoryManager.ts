/**
 * Yuzee Token Budget Memory Manager (Node.js Reference Implementation)
 * Enforces true token-based context budgeting, whole-turn atomic eviction,
 * and strict separation between full conversation transcripts and provider context.
 */

import crypto from 'crypto';
import { TelemetrySource } from '../types/TokenTelemetry';

export interface DialogueTurn {
  id: string;
  userMessage: { id: string; content: string; createdAt: number };
  assistantMessage?: { id: string; content: string; createdAt: number };
  estimatedTokens: number;
}

export interface CompactionMetrics {
  compactionEventId: string;
  sourceTurnsRange: string;
  sourceTokens: number;
  summaryTokens: number;
  tokensRemoved: number;
  compactionInputTokens: number;
  compactionOutputTokens: number;
  compactionTotalCost: number;
  estimatedNetSavingsPerTurn: number;
  estimatedBreakEvenTurns: number;
  timestamp: number;
  isSimulated: boolean;
}

export interface ExcludedItem {
  name: string;
  reason: string;
  tokens: number;
  preview: string;
}

export interface MemoryAssemblyResult {
  summaryText: string;
  keptTurns: DialogueTurn[];
  recentHistoryText: string;
  recentTurnsCount: number;
  removedTokens: number;
  compactionMetrics: CompactionMetrics | null;
  excludedItems: ExcludedItem[];
}

export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  const clean = text.trim();
  if (clean.length === 0) return 0;
  // Robust character + whitespace tokenization approximation (~4 chars per token)
  return Math.max(1, Math.ceil(clean.length * 0.26 + clean.split(/\s+/).length * 0.15));
}

export interface CachedTokenEntry {
  count: number;
  source: TelemetrySource;
  model: string;
  hash: string;
}

// Bounded LRU Caches strictly separated by authenticity
const exactTokenCache = new Map<string, CachedTokenEntry>();
const estimateTokenCache = new Map<string, CachedTokenEntry>();
const MAX_CACHE_SIZE = 500;

export function getTokenCacheKey(model: string, text: string): string {
  const hash = crypto.createHash('sha256').update(`${model}::${text}`).digest('hex');
  return `${model}::${hash}`;
}

export function getCachedTokenCount(model: string, text: string): CachedTokenEntry | null {
  const key = getTokenCacheKey(model, text);
  // Priority 1: Exact provider countTokens
  if (exactTokenCache.has(key)) {
    return exactTokenCache.get(key)!;
  }
  // Priority 2: Estimate cache (retains source: 'estimate' forever)
  if (estimateTokenCache.has(key)) {
    return estimateTokenCache.get(key)!;
  }
  return null;
}

export function setExactCachedTokenCount(model: string, text: string, count: number): void {
  const key = getTokenCacheKey(model, text);
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  if (exactTokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = exactTokenCache.keys().next().value;
    if (firstKey) exactTokenCache.delete(firstKey);
  }
  exactTokenCache.set(key, {
    count,
    source: 'countTokens',
    model,
    hash,
  });
}

export function setEstimatedCachedTokenCount(model: string, text: string, count: number): void {
  const key = getTokenCacheKey(model, text);
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  if (estimateTokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = estimateTokenCache.keys().next().value;
    if (firstKey) estimateTokenCache.delete(firstKey);
  }
  estimateTokenCache.set(key, {
    count,
    source: 'estimate',
    model,
    hash,
  });
}

/**
 * Formats an assistant message for model context history.
 * If the message contains raw Protocol v1.3 JSON, extracts the semantic content
 * (guidance, steps, tables, question) into a compact format to avoid token bloat.
 */
export function formatAssistantMessageForContext(rawContent: string): string {
  if (!rawContent) return '';
  const trimmed = rawContent.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.schema_version === '1.3' && (parsed.content_blocks || parsed.blocks)) {
        const blocks = parsed.content_blocks || parsed.blocks || [];
        const textParts: string[] = [];

        for (const block of blocks) {
          if (block.text && block.text.trim()) {
            textParts.push(block.text.trim());
          }
          if (block.items && Array.isArray(block.items) && block.items.length > 0) {
            const itemTexts = block.items
              .map((it: any) => `- ${it.title ? `**${it.title}**: ` : ''}${it.text || it.value || ''}`)
              .filter(Boolean);
            if (itemTexts.length > 0) {
              textParts.push(itemTexts.join('\n'));
            }
          }
        }

        const question = parsed.interaction?.question;
        if (question && typeof question === 'string' && question.trim()) {
          textParts.push(`Question asked: "${question.trim()}"`);
        }

        const modeStr = parsed.current_mode || parsed.state?.active_response_mode || 'standard';
        const intentStr = parsed.response_intent || 'GUIDANCE';
        const summary = textParts.join('\n');

        return `[Mode: ${modeStr} | Intent: ${intentStr}]\n${summary}`;
      }
    } catch {
      // Fallback to raw content if JSON parsing fails
    }
  }
  return trimmed;
}

/**
 * Group raw flat messages into atomic dialogue turns (User + Assistant pair)
 * Rejects unaccepted/failed assistant responses from entering model context.
 */
export function groupIntoTurns(
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt?: number;
    protocolAccepted?: boolean;
    schemaValid?: boolean;
    telemetry?: any;
  }>
): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  let currentTurn: Partial<DialogueTurn> | null = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (currentTurn && currentTurn.userMessage) {
        // Unclosed turn (e.g. consecutive user messages)
        turns.push({
          id: currentTurn.id || `turn-${turns.length + 1}`,
          userMessage: currentTurn.userMessage,
          assistantMessage: currentTurn.assistantMessage,
          estimatedTokens: estimateTokens(currentTurn.userMessage.content) + estimateTokens(currentTurn.assistantMessage?.content || ''),
        });
      }
      currentTurn = {
        id: `turn-${turns.length + 1}`,
        userMessage: { id: msg.id, content: msg.content, createdAt: msg.createdAt || Date.now() },
      };
    } else if (msg.role === 'assistant' && currentTurn) {
      // Check if this assistant response was rejected by validation
      const isAccepted = msg.protocolAccepted !== false &&
        msg.schemaValid !== false &&
        (msg.telemetry?.validation?.protocolAccepted !== false);

      if (isAccepted) {
        const compactContent = formatAssistantMessageForContext(msg.content);
        currentTurn.assistantMessage = {
          id: msg.id,
          content: compactContent,
          createdAt: msg.createdAt || Date.now(),
        };
        turns.push({
          id: currentTurn.id || `turn-${turns.length + 1}`,
          userMessage: currentTurn.userMessage!,
          assistantMessage: currentTurn.assistantMessage,
          estimatedTokens: estimateTokens(currentTurn.userMessage!.content) + estimateTokens(compactContent),
        });
      } else {
        // Rejected response: do not add assistant message to model history turn
        turns.push({
          id: currentTurn.id || `turn-${turns.length + 1}`,
          userMessage: currentTurn.userMessage!,
          estimatedTokens: estimateTokens(currentTurn.userMessage!.content),
        });
      }
      currentTurn = null;
    }
  }

  // Trailing incomplete turn
  if (currentTurn && currentTurn.userMessage) {
    turns.push({
      id: currentTurn.id || `turn-${turns.length + 1}`,
      userMessage: currentTurn.userMessage,
      assistantMessage: currentTurn.assistantMessage,
      estimatedTokens: estimateTokens(currentTurn.userMessage.content) + estimateTokens(currentTurn.assistantMessage?.content || ''),
    });
  }

  return turns;
}

export class TokenBudgetMemoryManager {
  /**
   * Assembles dynamic memory adhering strictly to dynamic context token budget and whole-turn eviction.
   * ADAPTIVE_HYBRID: Immutable System Prompt + Trusted Semantic State (Capsule) + Token-Budget Recent Whole Turns + Current Turn.
   * NO fake synthetic summary prose is injected into model context.
   */
  public assembleMemory(
    historicalMessages: Array<{ id: string; role: string; content: string; createdAt?: number }>,
    dynamicBudgetTokens: number = 2000,
    recentTurnsToKeep: number = 4,
    strategy: string = 'ADAPTIVE_HYBRID',
    existingSummary: string = ''
  ): MemoryAssemblyResult {
    const excludedItems: ExcludedItem[] = [];
    const summaryText = existingSummary || '';
    let removedTokens = 0;
    let compactionMetrics: CompactionMetrics | null = null;

    const turns = groupIntoTurns(historicalMessages);

    if (turns.length === 0) {
      return {
        summaryText,
        keptTurns: [],
        recentHistoryText: '',
        recentTurnsCount: 0,
        removedTokens: 0,
        compactionMetrics: null,
        excludedItems: [],
      };
    }

    if (strategy === 'BASELINE') {
      // Baseline: Keep all historical turns without eviction
      const recentHistoryText = turns
        .map((t) => {
          const userPart = `USER: ${t.userMessage.content}`;
          const asstPart = t.assistantMessage ? `\nASSISTANT: ${t.assistantMessage.content}` : '';
          return `${userPart}${asstPart}`;
        })
        .join('\n\n');

      return {
        summaryText: '',
        keptTurns: turns,
        recentHistoryText,
        recentTurnsCount: turns.length,
        removedTokens: 0,
        compactionMetrics: null,
        excludedItems: [],
      };
    }

    // Determine turns to retain within dynamic budget & recentTurns limit
    const maxTurnsByCount = Math.max(1, recentTurnsToKeep);
    const keptTurns: DialogueTurn[] = [];
    const evictedTurns: DialogueTurn[] = [];

    // Traverse turns from newest to oldest
    let accumulatedTokens = estimateTokens(summaryText);

    for (let i = turns.length - 1; i >= 0; i--) {
      const turn = turns[i];
      const turnTokens = turn.estimatedTokens;

      if (keptTurns.length < maxTurnsByCount && (accumulatedTokens + turnTokens) <= dynamicBudgetTokens) {
        keptTurns.unshift(turn);
        accumulatedTokens += turnTokens;
      } else {
        evictedTurns.unshift(turn);
      }
    }

    // Process evicted turns
    for (const evicted of evictedTurns) {
      removedTokens += evicted.estimatedTokens;
      excludedItems.push({
        name: `Evicted Turn (${evicted.id})`,
        reason: `Exceeded dynamic budget (${dynamicBudgetTokens} tokens) or turn limit (${maxTurnsByCount} turns)`,
        tokens: evicted.estimatedTokens,
        preview: evicted.userMessage.content.slice(0, 65),
      });
    }

    // Track simulated compaction metrics for diagnostic purposes without injecting fake summary prose
    if (evictedTurns.length > 0) {
      const evictedContent = evictedTurns
        .map((t) => `User: ${t.userMessage.content}\nAsst: ${t.assistantMessage?.content || ''}`)
        .join('\n');
      const sourceTokens = estimateTokens(evictedContent);
      const simulatedSummaryTokens = Math.max(20, Math.round(sourceTokens * 0.2));
      const tokensRemoved = Math.max(0, sourceTokens - simulatedSummaryTokens);
      const compCost = sourceTokens + simulatedSummaryTokens + 20;
      const netSavingsPerTurn = Math.max(1, tokensRemoved);
      const breakEvenTurns = Math.round((compCost / netSavingsPerTurn) * 10) / 10;

      compactionMetrics = {
        compactionEventId: `cmp-${Date.now()}`,
        sourceTurnsRange: `Turns 1 to ${evictedTurns.length}`,
        sourceTokens,
        summaryTokens: simulatedSummaryTokens,
        tokensRemoved,
        compactionInputTokens: sourceTokens + 20,
        compactionOutputTokens: simulatedSummaryTokens,
        compactionTotalCost: compCost,
        estimatedNetSavingsPerTurn: netSavingsPerTurn,
        estimatedBreakEvenTurns: breakEvenTurns,
        timestamp: Date.now(),
        isSimulated: true, // Explicitly marked as Simulated Compaction Model
      };
    }

    const recentHistoryText = keptTurns
      .map((t) => {
        const userPart = `USER: ${t.userMessage.content}`;
        const asstPart = t.assistantMessage ? `\nASSISTANT: ${t.assistantMessage.content}` : '';
        return `${userPart}${asstPart}`;
      })
      .join('\n\n');

    return {
      summaryText, // No fake summary text injected
      keptTurns,
      recentHistoryText,
      recentTurnsCount: keptTurns.length,
      removedTokens,
      compactionMetrics,
      excludedItems,
    };
  }
}
