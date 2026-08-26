/**
 * Yuzee AI Token Lab - Unified Model Registry
 * Single source of truth for Gemini model capabilities, statuses, and thinking mechanisms.
 */

export interface ModelCapabilityInfo {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  family: 'flash' | 'flash-lite' | 'legacy';
  categoryGroup: 'Current' | 'Flash-Lite' | 'Legacy comparison' | 'Retired';
  status: 'current' | 'stable' | 'legacy' | 'retired';
  available: boolean;
  selectable: boolean;
  freeTierEligible: boolean;
  supportsThinking: boolean;
  thinkingMechanism: 'level' | 'budget' | 'none'; // Gemini 3.x uses level, Gemini 2.5 uses budget
  supportedThinkingLevels: ('minimal' | 'low' | 'medium' | 'high')[];
  defaultThinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  supportsCaching: boolean;
  supportsInteractionsApi: boolean;
  isRecommended?: boolean;
  isDefault?: boolean;
  replacementModel?: string;
  badge?: string;
  // Approximate USD per million tokens (based on Gemini Flash tier pricing patterns)
  inputPricePerMToken?: number;
  outputPricePerMToken?: number;
  cachedReadPricePerMToken?: number;
}

export const GEMINI_MODELS: ModelCapabilityInfo[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    shortDescription: 'Newest, most capable Flash model for complex reasoning and multi-step tasks.',
    longDescription: 'Newest and most capable current Flash model. Strong for complex reasoning, coding and multi-step execution.',
    family: 'flash',
    categoryGroup: 'Current',
    status: 'current',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'level',
    supportedThinkingLevels: ['low', 'medium', 'high'], // Note: 'minimal' is NOT supported by 3.7
    defaultThinkingLevel: 'medium',
    supportsCaching: true,
    supportsInteractionsApi: true,
    badge: 'Latest',
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.40,
    cachedReadPricePerMToken: 0.025,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    shortDescription: 'Fast, high-quality general model with balanced intelligence and token efficiency.',
    longDescription: 'Fast, high-quality general Flash model with a strong balance between capability and token efficiency.',
    family: 'flash',
    categoryGroup: 'Current',
    status: 'stable',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'level',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'medium',
    supportsCaching: true,
    supportsInteractionsApi: true,
    isRecommended: true,
    badge: 'Recommended',
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.40,
    cachedReadPricePerMToken: 0.025,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    shortDescription: 'Balanced Flash model — strong quality with full thinking support. Default.',
    longDescription: 'High-capability Flash model with a strong balance between quality and cost. Default model for new conversations.',
    family: 'flash',
    categoryGroup: 'Current',
    status: 'stable',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'level',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'medium',
    supportsCaching: true,
    supportsInteractionsApi: true,
    isDefault: true,
    badge: 'Default',
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.40,
    cachedReadPricePerMToken: 0.025,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    shortDescription: 'Fast and efficient Flash-Lite model for lower-latency and high-throughput workloads.',
    longDescription: 'Fast and efficient Flash-Lite model intended for lower-latency and high-throughput workloads.',
    family: 'flash-lite',
    categoryGroup: 'Flash-Lite',
    status: 'stable',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'level',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'minimal',
    supportsCaching: true,
    supportsInteractionsApi: true,
    badge: 'Fast',
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.30,
    cachedReadPricePerMToken: 0.019,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    shortDescription: 'Earlier Flash-Lite generation useful as an efficiency and migration baseline.',
    longDescription: 'Earlier Flash-Lite generation useful as an efficiency and migration baseline.',
    family: 'flash-lite',
    categoryGroup: 'Flash-Lite',
    status: 'stable',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'level',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'low',
    supportsCaching: true,
    supportsInteractionsApi: true,
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.30,
    cachedReadPricePerMToken: 0.019,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    shortDescription: 'Legacy hybrid-reasoning model for comparing older thinking-budget behavior.',
    longDescription: 'Legacy hybrid-reasoning Flash model. Useful for comparing token usage against Gemini 3.x.',
    family: 'legacy',
    categoryGroup: 'Legacy comparison',
    status: 'legacy',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'budget', // Uses numeric thinkingBudget
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'low',
    supportsCaching: true,
    supportsInteractionsApi: false,
    badge: 'Legacy',
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.30,
    cachedReadPricePerMToken: 0.019,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    shortDescription: 'Legacy lightweight Gemini 2.5 model useful as an older efficiency baseline.',
    longDescription: 'Legacy lightweight Gemini 2.5 model useful as an older efficiency baseline.',
    family: 'legacy',
    categoryGroup: 'Legacy comparison',
    status: 'legacy',
    available: true,
    selectable: true,
    freeTierEligible: true,
    supportsThinking: true,
    thinkingMechanism: 'budget', // Uses numeric thinkingBudget
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'minimal',
    supportsCaching: true,
    supportsInteractionsApi: false,
    badge: 'Legacy',
    inputPricePerMToken: 0.038,
    outputPricePerMToken: 0.15,
    cachedReadPricePerMToken: 0.010,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    shortDescription: 'Retired. No longer callable. Replacement: Gemini 3.6 Flash.',
    longDescription: 'Retired model generation. Displayed for historical comparison only; not callable.',
    family: 'legacy',
    categoryGroup: 'Retired',
    status: 'retired',
    available: false,
    selectable: false,
    freeTierEligible: false,
    supportsThinking: false,
    thinkingMechanism: 'none',
    supportedThinkingLevels: [],
    defaultThinkingLevel: 'low',
    supportsCaching: false,
    supportsInteractionsApi: false,
    replacementModel: 'gemini-3.6-flash',
    badge: 'Retired',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    shortDescription: 'Retired. No longer callable. Replacement: Gemini 3.5 Flash-Lite.',
    longDescription: 'Retired model generation. Displayed for historical comparison only; not callable.',
    family: 'legacy',
    categoryGroup: 'Retired',
    status: 'retired',
    available: false,
    selectable: false,
    freeTierEligible: false,
    supportsThinking: false,
    thinkingMechanism: 'none',
    supportedThinkingLevels: [],
    defaultThinkingLevel: 'minimal',
    supportsCaching: false,
    supportsInteractionsApi: false,
    replacementModel: 'gemini-3.5-flash-lite',
    badge: 'Retired',
  },
];

export function getModelInfo(modelId: string): ModelCapabilityInfo | undefined {
  return GEMINI_MODELS.find((m) => m.id === modelId);
}

export function calcTurnCost(
  modelId: string,
  usage: {
    uncachedInputTokens?: number | null;
    inputTokens: number;
    outputTokens: number;
    thinkingTokens?: number | null;
    cachedTokens?: number | null;
  }
): number | null {
  const model = getModelInfo(modelId);
  if (!model?.inputPricePerMToken) return null;
  const uncachedInput = usage.uncachedInputTokens ?? (usage.inputTokens - (usage.cachedTokens ?? 0));
  const outputTotal = usage.outputTokens + (usage.thinkingTokens ?? 0);
  const cached = usage.cachedTokens ?? 0;
  return (
    (Math.max(0, uncachedInput) / 1_000_000) * model.inputPricePerMToken +
    (outputTotal / 1_000_000) * model.outputPricePerMToken! +
    (cached / 1_000_000) * (model.cachedReadPricePerMToken ?? 0)
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.00001) return '~<$0.00001';
  if (usd < 0.01) return `~$${usd.toFixed(5)}`;
  return `~$${usd.toFixed(4)}`;
}

export function getValidThinkingLevel(modelId: string, currentLevel: string): 'minimal' | 'low' | 'medium' | 'high' {
  const info = getModelInfo(modelId);
  if (!info || !info.supportsThinking) return 'low';
  if (currentLevel === 'adaptive') return 'medium';
  if (info.supportedThinkingLevels.includes(currentLevel as any)) {
    return currentLevel as any;
  }
  return info.defaultThinkingLevel;
}
