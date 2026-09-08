/**
 * Multi-turn Gemini content builder.
 *
 * Produces a proper Content[] array (user/model alternating roles) from the
 * same inputs that the current single-text assembler accepts.
 *
 * Wired into YuzeeRequestAssembler behind the `useMultiTurn` flag (default: false).
 * When false the assembler produces the existing single-text string unchanged.
 * The @google/genai SDK accepts both forms for generateContentStream.
 */

import { DialogueTurn, estimateTokens } from './TokenBudgetMemoryManager';

/** Minimal subset of the @google/genai Content type needed here. */
export interface Part {
  text: string;
}
export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

/**
 * Enhanced assistant message formatter for multi-turn history.
 *
 * Extends formatAssistantMessageForContext with:
 * - table/comparison block rows
 * - callout blocks
 * - question options alongside the question text
 * - `content` field alias (model sometimes outputs `content` instead of `text`)
 *
 * Output remains compact plain text — no JSON dumped into history.
 */
export function formatAssistantMessageRich(rawContent: string): string {
  if (!rawContent) return '';
  const trimmed = rawContent.trim();
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.schema_version !== '1.3' && parsed.schema_version !== '1.4') return trimmed;

    const blocks: any[] = parsed.content_blocks || parsed.blocks || [];
    const textParts: string[] = [];

    for (const block of blocks) {
      const blockText = block.text || block.content || '';

      if (block.type === 'heading' && block.title?.trim()) {
        const h = block.level === 'h3' ? '###' : '##';
        textParts.push(`${h} ${block.title.trim()}`);
      } else if (blockText.trim()) {
        textParts.push(blockText.trim());
      }

      if (block.type === 'callout' && blockText.trim()) {
        // Callout already captured above; add variant for context
        const variant = block.variant && block.variant !== 'default' ? ` [${block.variant}]` : '';
        if (variant) textParts[textParts.length - 1] += variant;
      }

      if (Array.isArray(block.items) && block.items.length > 0) {
        const itemLines = block.items
          .map((it: any) => {
            const label = it.title ? `**${it.title}**` : '';
            const body = it.text || it.content || '';
            const val = it.value ? ` [${it.value}]` : '';
            const st = it.status && it.status !== '' ? ` [${it.status}]` : '';
            return `- ${label}${label && body ? ': ' : ''}${body}${val}${st}`.trim();
          })
          .filter(Boolean);
        if (itemLines.length > 0) textParts.push(itemLines.join('\n'));
      }

      // Table/comparison: include criteria column as compact rows
      if ((block.type === 'table' || block.type === 'comparison') &&
          Array.isArray(block.columns) && Array.isArray(block.rows) && block.rows.length > 0) {
        const colLabels = block.columns.map((c: any) => c.label || c.key).join(' | ');
        textParts.push(`| ${colLabels} |`);
        for (const row of block.rows) {
          const criteria = row.criteria ? `${row.criteria}: ` : '';
          const cells = Array.isArray(row.cells)
            ? row.cells.map((c: any) => c.value || '').join(' | ')
            : '';
          if (criteria || cells) textParts.push(`| ${criteria}${cells} |`);
        }
      }
    }

    // Question and options
    const interaction = parsed.interaction;
    if (interaction?.question?.trim()) {
      let qLine = `Question asked: "${interaction.question.trim()}"`;
      if (Array.isArray(interaction.options) && interaction.options.length > 0) {
        const opts = interaction.options.map((o: any) => o.label || o.value).filter(Boolean);
        if (opts.length > 0) qLine += `\nOptions: ${opts.join(' | ')}`;
      }
      textParts.push(qLine);
    }

    const modeStr = parsed.current_mode || parsed.state?.active_response_mode || 'standard';
    const intentStr = parsed.response_intent || 'GUIDANCE';
    return `[Mode: ${modeStr} | Intent: ${intentStr}]\n${textParts.join('\n')}`;
  } catch {
    return trimmed;
  }
}

/**
 * Build proper Gemini multi-turn Content[].
 *
 * Rules:
 * - Contents array must alternate user/model and end with user.
 * - History turns without an assistant message are dropped from history
 *   (rejected/pending responses must not appear as model turns).
 * - Memory capsule and summary are prepended to the first user turn in history,
 *   or to the current turn when there is no history.
 * - Current turn is always the last element (user role).
 */
export function buildMultiTurnContents(params: {
  /** Pre-formatted capsule string from formatCareerContext(). Empty string when no capsule. */
  careerCapsule: string;
  /** Conversation summary text. Empty string when none. */
  summary: string;
  /** Kept dialogue turns from assembleMemory(), in chronological order. */
  keptTurns: DialogueTurn[];
  /** Formatted current user turn — output of formatUserEvent(), including context prefix. */
  currentUserInput: string;
  /** Whether to use the richer history formatter (true = enhanced; false = original compact). */
  richHistory?: boolean;
}): Content[] {
  const contents: Content[] = [];
  const { careerCapsule, summary, keptTurns, currentUserInput, richHistory = true } = params;

  // Build the context preamble (capsule + summary) to prepend to the first user turn
  const preambleParts: string[] = [];
  if (careerCapsule) preambleParts.push(careerCapsule);
  if (summary.trim()) preambleParts.push(`PREVIOUS_CONVERSATION_SUMMARY:\n${summary.trim()}`);
  const preamble = preambleParts.join('\n\n');

  // Filter to only complete turns (both user and assistant present)
  // Turns without assistant messages would break the required alternation
  const completeTurns = keptTurns.filter(t => t.assistantMessage != null);

  if (completeTurns.length === 0) {
    // No history — emit single user message with preamble + current input (same as today)
    const parts: string[] = [];
    if (preamble) parts.push(preamble);
    parts.push(`CURRENT_USER_INPUT:\n${currentUserInput}`);
    contents.push({ role: 'user', parts: [{ text: parts.join('\n\n') }] });
    return contents;
  }

  // First history turn: prepend preamble
  const firstTurn = completeTurns[0];
  const firstUserText = preamble
    ? `${preamble}\n\n${firstTurn.userMessage.content}`
    : firstTurn.userMessage.content;

  contents.push({ role: 'user', parts: [{ text: firstUserText }] });
  const formatter = richHistory ? formatAssistantMessageRich : (s: string) => s;
  contents.push({ role: 'model', parts: [{ text: formatter(firstTurn.assistantMessage!.content) }] });

  // Remaining history turns
  for (let i = 1; i < completeTurns.length; i++) {
    const turn = completeTurns[i];
    contents.push({ role: 'user', parts: [{ text: turn.userMessage.content }] });
    contents.push({ role: 'model', parts: [{ text: formatter(turn.assistantMessage!.content) }] });
  }

  // Current user turn (always last)
  contents.push({ role: 'user', parts: [{ text: currentUserInput }] });
  return contents;
}

/**
 * Estimate the total token count across a Content[] array.
 * Uses the same 4-chars-per-token approximation as estimateTokens().
 */
export function estimateMultiTurnTokens(contents: Content[]): number {
  let total = 0;
  for (const c of contents) {
    for (const p of c.parts) {
      const clean = (p.text || '').trim();
      if (clean.length > 0) {
        total += Math.max(1, Math.ceil(clean.length * 0.26 + clean.split(/\s+/).length * 0.15));
      }
    }
  }
  return total;
}

/** Unified token estimator for either architecture. */
export function estimateContentsTokens(contents: string | Content[]): number {
  if (typeof contents === 'string') return estimateTokens(contents);
  return estimateMultiTurnTokens(contents);
}

/** Print request shape to console without sending. */
export function debugRequestShape(req: {
  contents: string | Content[];
  systemInstruction: string;
  model: string;
}): void {
  const isMultiTurn = Array.isArray(req.contents);
  console.log('[DEBUG REQUEST SHAPE]');
  console.log('  model:', req.model);
  console.log('  mode:', isMultiTurn ? 'multi-turn' : 'single-text');
  console.log('  systemInstruction chars:', req.systemInstruction.length);
  if (isMultiTurn) {
    const c = req.contents as Content[];
    console.log('  contents: Content[] x' + c.length);
    c.forEach((part, i) => {
      const chars = part.parts.reduce((sum, p) => sum + p.text.length, 0);
      console.log(`    [${i}] role=${part.role} chars=${chars}`);
    });
  } else {
    console.log('  contents: string chars=' + (req.contents as string).length);
  }
  console.log('  estimated tokens:', estimateContentsTokens(req.contents));
}
