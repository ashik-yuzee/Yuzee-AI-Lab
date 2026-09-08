/**
 * Server-authoritative security state override.
 *
 * `security_breach_count` and `active_security_penalty` are APPLICATION state,
 * not model-generated content. The server tracks them in ConversationItem and
 * overwrites whatever Gemini generated BEFORE validation occurs.
 *
 * These functions are pure so they can be tested without importing server.ts.
 */

export type SecurityPenalty = '' | '10_min_timeout' | '24_hr_ban';

/** Derive the canonical penalty from the authoritative breach count. */
export function deriveSecurityPenalty(breachCount: number): SecurityPenalty {
  if (breachCount >= 3) return '24_hr_ban';
  if (breachCount >= 1) return '10_min_timeout';
  return '';
}

/**
 * Mutate parsedResponse in-place, replacing Gemini's security fields with
 * authoritative server values. No-op if state.progress is missing.
 */
export function applyServerSecurityState(
  parsedResponse: any,
  serverBreachCount: number,
  serverPenalty: SecurityPenalty
): void {
  if (!parsedResponse?.state?.progress) return;
  parsedResponse.state.progress.security_breach_count = serverBreachCount;
  parsedResponse.state.progress.active_security_penalty = serverPenalty;
}

/**
 * Compute the next server security state for this turn.
 *
 * IMPORTANT: `response_intent` is model-generated and MUST NOT be used to
 * increment breach count or create penalties. A Gemini misclassification of
 * any message as SAFETY_BOUNDARY would otherwise impose a penalty on a user.
 * Breach count must only be incremented by explicit authoritative server-side
 * security events (rate-limit violations, content-filter flags, etc.) — not by
 * model output. Pass those events via the optional `authoritativeBreachDelta`.
 *
 * Returns { newBreachCount, newPenalty } — caller must persist these on conv.
 */
export function computeNextSecurityState(
  prevBreachCount: number,
  authoritativeBreachDelta: number = 0,
): { newBreachCount: number; newPenalty: SecurityPenalty } {
  const newBreachCount = prevBreachCount + authoritativeBreachDelta;
  return { newBreachCount, newPenalty: deriveSecurityPenalty(newBreachCount) };
}

/**
 * Normalise the security fields inside a parsed response, coercing null or
 * unexpected types to the canonical empty-string form before applyServerSecurityState
 * writes the authoritative values. Guards against Gemini outputting null when the
 * responseSchema marks the field nullable (due to "" being stripped from the enum).
 */
export function normaliseSecurityFields(parsedResponse: any): void {
  const progress = parsedResponse?.state?.progress;
  if (!progress) return;
  if (typeof progress.security_breach_count !== 'number') {
    progress.security_breach_count = 0;
  }
  if (typeof progress.active_security_penalty !== 'string' || progress.active_security_penalty === null) {
    progress.active_security_penalty = '';
  }
}
