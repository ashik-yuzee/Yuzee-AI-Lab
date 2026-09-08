/**
 * End-to-end mocked test: null active_security_penalty from Gemini must never
 * reach the stored content, the structured SSE payload, or the fallback parse path.
 *
 * Simulates the production path:
 *   Gemini raw JSON → JSON.parse → normaliseSecurityFields → computeNextSecurityState
 *   → applyServerSecurityState → fullAssistantText = JSON.stringify(parsedResponse)
 *   → structuredResponse stored / SSE emitted
 *
 * No external API calls, no network, no database.
 */

import assert from 'node:assert/strict';
import {
  normaliseSecurityFields,
  applyServerSecurityState,
  computeNextSecurityState,
} from '../../protocol/securityOverride';

// ─── Minimal valid Gemini response (mirrors makeMinimalResponse from schema.test.ts) ──

function makeGeminiRaw(overrides: Record<string, any> = {}): string {
  const base = {
    schema_version: '1.3',
    current_mode: 'Standard',
    response_intent: 'GENERAL_DELIVERY',
    content_blocks: [{ id: 'b1', type: 'text', level: 'none', variant: 'default', title: '', text: 'Hello', items: [], columns: [], rows: [] }],
    interaction: { kind: 'none', input_type: 'none', question_id: '', question: '', options: [], allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [] },
    service_trigger: { service_intent_detected: false, primary_requested_service: 'NONE', confidence: 'LOW', reason: '', trigger_now: false, needs_more_clarity: false, actions: [] },
    rmo_readiness: { readiness: 'NOT_READY', ready_to_generate: false, missing_inputs: [], verification_required: false },
    state: {
      active_response_mode: 'Standard', effective_response_mode: 'Standard', mode_source: 'default',
      safety_override_applied: false,
      user_confidence: { score: 50, band: 'medium', evidence_strength: 'moderate', trend: 'unknown', reason_codes: ['GOAL_CLEAR'] },
      progress: {
        explained: false, failed_attempts: 0, loop_count_same_issue: 0,
        security_breach_count: overrides.security_breach_count ?? null,
        active_security_penalty: overrides.active_security_penalty ?? null,
      },
    },
    followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
  };
  return JSON.stringify(base);
}

/**
 * Simulates the exact production code path from server.ts:
 *   parse → normalise → computeNextState → applyServerState → resync fullAssistantText
 *
 * Returns the final { fullAssistantText, parsedResponse, structuredContent } as the
 * frontend would receive and store them.
 */
function runServerPath(geminiRaw: string, prevBreachCount: number = 0): {
  fullAssistantText: string;
  parsedResponse: any;
  structuredContent: any; // what SSE "structured" event sends
} {
  let fullAssistantText = geminiRaw;
  let parsedResponse: any = null;
  let isJsonValid = false;

  try {
    parsedResponse = JSON.parse(fullAssistantText);
    isJsonValid = true;
  } catch {
    isJsonValid = false;
  }

  if (isJsonValid && parsedResponse !== null) {
    normaliseSecurityFields(parsedResponse);
    const { newBreachCount, newPenalty } = computeNextSecurityState(prevBreachCount);
    applyServerSecurityState(parsedResponse, newBreachCount, newPenalty);
    // THE FIX: resync raw text with normalized parsedResponse
    fullAssistantText = JSON.stringify(parsedResponse);
  }

  return {
    fullAssistantText,
    parsedResponse,
    // structuredContent = what the "structured" SSE event and structuredResponse field hold
    structuredContent: isJsonValid && parsedResponse !== null ? parsedResponse : undefined,
  };
}

/** The client-side fallback: parses msg.content when structuredResponse not yet set. */
function clientFallbackParse(content: string): any | null {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.schema_version === '1.3' && (parsed.content_blocks || parsed.blocks)) {
        return parsed;
      }
    } catch { /* not valid JSON */ }
  }
  return null;
}

// ─── Test 1: null → "" (the primary reported bug) ───────────────────────────

{
  const raw = makeGeminiRaw({ security_breach_count: null, active_security_penalty: null });
  const { fullAssistantText, structuredContent } = runServerPath(raw, 0);

  // The stored content string must not contain null for these fields
  const stored = JSON.parse(fullAssistantText);
  assert.strictEqual(stored.state.progress.security_breach_count, 0,
    'stored content: security_breach_count must be 0, not null');
  assert.strictEqual(stored.state.progress.active_security_penalty, '',
    'stored content: active_security_penalty must be "", not null');

  // The structured SSE event must have clean values
  assert.strictEqual(structuredContent.state.progress.security_breach_count, 0,
    'SSE structured: security_breach_count must be 0');
  assert.strictEqual(structuredContent.state.progress.active_security_penalty, '',
    'SSE structured: active_security_penalty must be ""');

  // The client fallback parse must also see clean values
  const fallback = clientFallbackParse(fullAssistantText);
  assert.notEqual(fallback, null, 'fallback parse must succeed');
  assert.strictEqual(fallback.state.progress.active_security_penalty, '',
    'client fallback: active_security_penalty must be ""');
  assert.notEqual(fallback.state.progress.active_security_penalty, null,
    'client fallback: active_security_penalty must NOT be null');

  console.log('PASS 1: null → "" in stored content, SSE structured, and client fallback');
}

// ─── Test 2: Gemini returns 10_min_timeout + no server penalty → "" ──────────

{
  const raw = makeGeminiRaw({ security_breach_count: 2, active_security_penalty: '10_min_timeout' });
  const { fullAssistantText, structuredContent } = runServerPath(raw, 0);

  const stored = JSON.parse(fullAssistantText);
  assert.strictEqual(stored.state.progress.active_security_penalty, '',
    '10_min_timeout with no server penalty → "" in stored content');
  assert.strictEqual(structuredContent.state.progress.active_security_penalty, '',
    '10_min_timeout with no server penalty → "" in SSE structured');

  console.log('PASS 2: Gemini 10_min_timeout + no server penalty → "" everywhere');
}

// ─── Test 3: Gemini returns 24_hr_ban + no server penalty → "" ───────────────

{
  const raw = makeGeminiRaw({ security_breach_count: 5, active_security_penalty: '24_hr_ban' });
  const { fullAssistantText, structuredContent } = runServerPath(raw, 0);

  const stored = JSON.parse(fullAssistantText);
  assert.strictEqual(stored.state.progress.active_security_penalty, '',
    '24_hr_ban with no server penalty → "" in stored content');
  assert.strictEqual(structuredContent.state.progress.active_security_penalty, '',
    '24_hr_ban with no server penalty → "" in SSE structured');

  console.log('PASS 3: Gemini 24_hr_ban + no server penalty → "" everywhere');
}

// ─── Test 4: null → "" with explicit invariant check ─────────────────────────

{
  const raw = makeGeminiRaw({ security_breach_count: null, active_security_penalty: null });
  const { fullAssistantText, structuredContent } = runServerPath(raw, 0);

  const stored = JSON.parse(fullAssistantText);
  const count = stored.state.progress.security_breach_count;
  const penalty = stored.state.progress.active_security_penalty;

  // Core invariant: count=0 → penalty=""
  assert.strictEqual(count, 0);
  if (count === 0) {
    assert.strictEqual(penalty, '', 'invariant: breach_count=0 → penalty=""');
  }

  const sseCount = structuredContent.state.progress.security_breach_count;
  const ssePenalty = structuredContent.state.progress.active_security_penalty;
  assert.strictEqual(sseCount, 0);
  if (sseCount === 0) {
    assert.strictEqual(ssePenalty, '', 'SSE invariant: breach_count=0 → penalty=""');
  }

  console.log('PASS 4: invariant breach_count=0 → penalty="" holds in all outputs');
}

// ─── Test 5: null does NOT appear anywhere in final output ────────────────────

{
  const cases = [
    makeGeminiRaw({ security_breach_count: null, active_security_penalty: null }),
    makeGeminiRaw({ security_breach_count: 0, active_security_penalty: null }),
    makeGeminiRaw({ security_breach_count: null, active_security_penalty: '10_min_timeout' }),
  ];

  for (const raw of cases) {
    const { fullAssistantText, structuredContent } = runServerPath(raw, 0);

    // The stored content string must not contain `"active_security_penalty":null`
    assert.ok(
      !fullAssistantText.includes('"active_security_penalty":null') &&
      !fullAssistantText.includes('"active_security_penalty": null'),
      `stored content must not contain null: ${fullAssistantText.slice(0, 200)}`
    );

    // The SSE payload must not have null
    assert.notStrictEqual(structuredContent.state.progress.active_security_penalty, null,
      'SSE structured must not have null active_security_penalty');
  }

  console.log('PASS 5: null does not appear in stored content or SSE payload for any Gemini null variant');
}

// ─── Test 6: client fallback never sees null ──────────────────────────────────

{
  const raw = makeGeminiRaw({ security_breach_count: null, active_security_penalty: null });
  const { fullAssistantText } = runServerPath(raw, 0);

  // Even without structuredResponse being set (streaming window), the fallback parse is clean
  const fallback = clientFallbackParse(fullAssistantText);
  assert.notEqual(fallback, null);
  assert.strictEqual(fallback.state.progress.active_security_penalty, '');
  assert.notStrictEqual(fallback.state.progress.active_security_penalty, null);

  console.log('PASS 6: client fallback parse (streaming window) sees "" not null');
}

console.log('\n✓ All 6 security-null-fix tests passed — null cannot reach any output path.');
