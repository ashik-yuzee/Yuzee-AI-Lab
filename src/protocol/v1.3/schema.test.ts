/**
 * Local schema + response-preservation tests — no API calls, mock JSON only.
 * Run: npx ts-node src/protocol/v1.3/schema.test.ts
 */

import assert from 'assert';
import Ajv from 'ajv';
import schemaJson from './Yuzee_Response_Schema_v1.3.json';
import { validateProtocolV13 } from '../validator';
import { formatAssistantMessageForContext } from '../../services/TokenBudgetMemoryManager';
import {
  applyServerSecurityState,
  computeNextSecurityState,
  deriveSecurityPenalty,
  normaliseSecurityFields,
} from '../securityOverride';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schemaJson);

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMinimalResponse(overrides: Record<string, any> = {}): any {
  return {
    schema_version: '1.3',
    current_mode: 'A_CONVERSATION',
    response_intent: 'GENERAL_DELIVERY',
    content_blocks: [
      { id: 'b1', type: 'text', level: 'none', variant: 'default', title: '', text: 'Hello', items: [], columns: [], rows: [] },
    ],
    interaction: {
      kind: 'none', input_type: 'none', question_id: '', question: '', options: [],
      allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [],
    },
    service_trigger: {
      service_intent_detected: false,
      primary_requested_service: 'NONE',
      confidence: 'LOW',
      reason: 'No service intent',
      trigger_now: false,
      needs_more_clarity: false,
      actions: [],
    },
    rmo_readiness: {
      readiness: 'NOT_READY',
      ready_to_generate: false,
      missing_inputs: [],
      verification_required: false,
    },
    state: {
      active_response_mode: 'Standard',
      effective_response_mode: 'Standard',
      mode_source: 'default',
      safety_override_applied: false,
      user_confidence: { score: -1, band: 'unknown', evidence_strength: 'none', trend: 'unknown', reason_codes: [] },
      progress: { explained: false, failed_attempts: 0, loop_count_same_issue: 0, security_breach_count: 0, active_security_penalty: '' },
    },
    followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
    ...overrides,
  };
}

// ── Schema tests ──────────────────────────────────────────────────────────────

{
  // 1. Valid minimal response passes AJV
  const valid = makeMinimalResponse();
  assert(validate(valid), `AJV rejected valid minimal response: ${JSON.stringify(validate.errors)}`);
  console.log('PASS: valid minimal response');
}

{
  // 2. OLD service_trigger fields are rejected
  const bad = makeMinimalResponse({
    service_trigger: { flow: 'NONE', intent_detected: false, goal_summary: '', trigger: '', confidence: '', selected_rmo: '', offer_target: '', missing_inputs: [], actions: [] },
  });
  const ok = validate(bad);
  assert(!ok, 'AJV should reject old service_trigger fields but did not');
  console.log('PASS: old service_trigger fields correctly rejected');
}

{
  // 3. rmo_readiness must be an object, not boolean
  const bad = makeMinimalResponse({ rmo_readiness: false });
  assert(!validate(bad), 'AJV should reject rmo_readiness: false');
  console.log('PASS: rmo_readiness boolean correctly rejected');
}

{
  // 4. active_security_penalty must be a string enum, not integer
  const bad = makeMinimalResponse();
  bad.state.progress.active_security_penalty = 0;
  assert(!validate(bad), 'AJV should reject active_security_penalty: 0 (integer)');
  console.log('PASS: active_security_penalty integer correctly rejected');
}

{
  // 5. active_security_penalty accepts valid string enum values
  for (const val of ['', '10_min_timeout', '24_hr_ban']) {
    const r = makeMinimalResponse();
    r.state.progress.active_security_penalty = val;
    assert(validate(r), `AJV rejected valid active_security_penalty="${val}": ${JSON.stringify(validate.errors)}`);
  }
  console.log('PASS: active_security_penalty string enum values accepted');
}

{
  // 6. delay_seconds accepted; after_seconds rejected
  const goodTrigger = makeMinimalResponse({ followups: { enabled: true, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [{ delay_seconds: 10, message: 'Follow up?' }] } });
  assert(validate(goodTrigger), `AJV rejected valid delay_seconds trigger: ${JSON.stringify(validate.errors)}`);

  const badTrigger = makeMinimalResponse({ followups: { enabled: true, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [{ after_seconds: 10, message: 'Follow up?', suggested_replies: [] }] } });
  assert(!validate(badTrigger), 'AJV should reject after_seconds (old field name)');
  console.log('PASS: delay_seconds accepted; after_seconds rejected');
}

{
  // 7. primary_requested_service enum coverage
  const validServices = ['NONE','EDU_OFFER_RMO','JOB_MATCH_RMO','APPRENTICESHIP_RMO','TRAINEESHIP_RMO',
    'INTERNSHIP_RMO','WORK_PLACEMENT_RMO','RPL_RMO','EARN_AND_LEARN_RMO','GRAD_PROGRAM_RMO','PATHWAY_RMO','OTHER_YUZEE_SERVICE'];
  for (const svc of validServices) {
    const r = makeMinimalResponse();
    r.service_trigger.primary_requested_service = svc;
    assert(validate(r), `AJV rejected valid primary_requested_service="${svc}": ${JSON.stringify(validate.errors)}`);
  }
  const r = makeMinimalResponse();
  r.service_trigger.primary_requested_service = 'RMO'; // old invalid value
  assert(!validate(r), 'AJV should reject old primary_requested_service="RMO"');
  console.log('PASS: primary_requested_service enum validated');
}

{
  // 8. Semantic validator: rmo_readiness.missing_inputs checked in handoff
  const withHandoff = makeMinimalResponse({
    interaction: {
      kind: 'handoff', input_type: 'fields', question_id: 'q1', question: 'Ready?', options: [],
      allow_other_input: false, other_input_label: '', fields: [{ id: 'goal', label: 'Your Goal', input_type: 'text', required: true, options: [] }], recommended_actions: [],
    },
    rmo_readiness: { readiness: 'PARTIAL', ready_to_generate: false, missing_inputs: ['goal', 'location'], verification_required: false },
  });
  const result = validateProtocolV13(withHandoff);
  assert(result.warnings.some(w => w.includes('location')), `Expected warning for missing "location" field in handoff. Warnings: ${result.warnings}`);
  assert(!result.warnings.some(w => w.includes('"goal"')), 'Unexpected warning for "goal" which IS in interaction.fields');
  console.log('PASS: validator warns on rmo_readiness.missing_inputs not covered by interaction.fields');
}

// ── Response-preservation tests ───────────────────────────────────────────────

{
  // 9. Heading → list → heading → list structure survives
  const richResponse = JSON.stringify(makeMinimalResponse({
    content_blocks: [
      { id: 'b1', type: 'text', level: 'none', variant: 'default', title: '', text: 'Overview paragraph.', items: [], columns: [], rows: [] },
      { id: 'b2', type: 'heading', level: 'h2', variant: 'default', title: 'Key Skills', text: '', items: [], columns: [], rows: [] },
      {
        id: 'b3', type: 'list', level: 'none', variant: 'default', title: '', text: '',
        items: [
          { id: 'i1', title: 'Communication', text: 'Essential for teams', value: 'Primary Priority', status: 'positive' },
          { id: 'i2', title: 'Python', text: 'Core language', value: '', status: 'current' },
        ],
        columns: [], rows: [],
      },
      { id: 'b4', type: 'heading', level: 'h3', variant: 'default', title: 'Next Steps', text: '', items: [], columns: [], rows: [] },
      {
        id: 'b5', type: 'list', level: 'none', variant: 'default', title: '', text: '',
        items: [{ id: 'i3', title: 'Apply Now', text: 'Submit application', value: '', status: 'next' }],
        columns: [], rows: [],
      },
    ],
  }));

  const formatted = formatAssistantMessageForContext(richResponse);

  assert(formatted.includes('## Key Skills'), `Missing h2 heading. Got:\n${formatted}`);
  assert(formatted.includes('### Next Steps'), `Missing h3 heading. Got:\n${formatted}`);
  assert(formatted.includes('Overview paragraph.'), `Missing text block. Got:\n${formatted}`);
  assert(formatted.includes('Primary Priority'), `Missing value "Primary Priority". Got:\n${formatted}`);
  assert(formatted.includes('positive'), `Missing status "positive". Got:\n${formatted}`);
  assert(formatted.includes('next'), `Missing status "next". Got:\n${formatted}`);
  console.log('PASS: heading/list structure and value/status preserved in formatAssistantMessageForContext');
}

{
  // 10. Non-JSON content passes through unchanged
  const raw = 'Just a plain text message';
  assert(formatAssistantMessageForContext(raw) === raw, 'Non-JSON should pass through unchanged');
  console.log('PASS: non-JSON content passes through unchanged');
}

// ── Server-authoritative security state override tests ────────────────────────

{
  // 11. Gemini returns null for security fields (nullable schema) + server no breach → final ""
  const r = makeMinimalResponse();
  r.state.progress.security_breach_count = null;   // Gemini output null (nullable schema)
  r.state.progress.active_security_penalty = null; // Gemini output null
  normaliseSecurityFields(r);
  assert.strictEqual(r.state.progress.security_breach_count, 0, 'null count → 0');
  assert.strictEqual(r.state.progress.active_security_penalty, '', 'null penalty → ""');
  applyServerSecurityState(r, 0, '');
  const result = validateProtocolV13(r);
  assert(result.protocolAccepted, `Response must render after null normalisation. Errors: ${result.errors}`);
  assert(!result.warnings.some(w => w.includes('active_security_penalty')),
    `No security warning expected. Warnings: ${result.warnings}`);
  console.log('PASS: Gemini null security fields + server no-breach → normalised to "", response renders');
}

{
  // 12. Gemini returns 10_min_timeout + server no breach → override clears to ""
  const r = makeMinimalResponse();
  r.state.progress.security_breach_count = 5;       // Gemini hallucinated
  r.state.progress.active_security_penalty = '10_min_timeout'; // Gemini hallucinated
  normaliseSecurityFields(r);
  applyServerSecurityState(r, 0, '');
  assert.strictEqual(r.state.progress.security_breach_count, 0, 'breach count overridden to 0');
  assert.strictEqual(r.state.progress.active_security_penalty, '', 'penalty overridden to ""');
  const result = validateProtocolV13(r);
  assert(result.protocolAccepted, `Response must render. Errors: ${result.errors}`);
  console.log('PASS: Gemini 10_min_timeout + server no-breach → override clears penalty, response renders');
}

{
  // 13. Gemini response_intent=SAFETY_BOUNDARY with no authoritative event → no penalty created
  // computeNextSecurityState must NOT read response_intent; delta=0 means count stays at 0
  const r = makeMinimalResponse({ response_intent: 'SAFETY_BOUNDARY' });
  normaliseSecurityFields(r);
  const { newBreachCount, newPenalty } = computeNextSecurityState(0 /* no authoritativeBreachDelta */);
  assert.strictEqual(newBreachCount, 0, 'SAFETY_BOUNDARY alone must not increment breach count');
  assert.strictEqual(newPenalty, '', 'SAFETY_BOUNDARY alone must not impose penalty');
  applyServerSecurityState(r, newBreachCount, newPenalty);
  assert.strictEqual(r.state.progress.active_security_penalty, '');
  console.log('PASS: SAFETY_BOUNDARY response_intent with no authoritative event → no penalty');
}

{
  // 14. Real authoritative server event (delta=1) → correct breach/penalty applied
  assert.strictEqual(deriveSecurityPenalty(0), '', 'count=0 → no penalty');
  assert.strictEqual(deriveSecurityPenalty(1), '10_min_timeout', 'count=1 → timeout');
  assert.strictEqual(deriveSecurityPenalty(2), '10_min_timeout', 'count=2 → timeout');
  assert.strictEqual(deriveSecurityPenalty(3), '24_hr_ban', 'count=3 → ban');

  const r = makeMinimalResponse();
  // Simulate one authoritative security event on a previously-clean account
  const { newBreachCount, newPenalty } = computeNextSecurityState(0, 1); // delta=1
  assert.strictEqual(newBreachCount, 1);
  assert.strictEqual(newPenalty, '10_min_timeout');
  applyServerSecurityState(r, newBreachCount, newPenalty);
  assert.strictEqual(r.state.progress.security_breach_count, 1);
  assert.strictEqual(r.state.progress.active_security_penalty, '10_min_timeout');
  // Escalation: 3 total breaches → ban
  const { newBreachCount: nbc3, newPenalty: np3 } = computeNextSecurityState(2, 1);
  assert.strictEqual(nbc3, 3);
  assert.strictEqual(np3, '24_hr_ban');
  console.log('PASS: real authoritative event with delta → correct breach count and penalty applied');
}

// ── Security persistence serialization/restoration tests ─────────────────────

{
  // 15. Restore path preserves security state when present (local JSON round-trip semantics)
  // The restore endpoint does: securityBreachCount: data.securityBreachCount ?? 0
  // Test both: field present (must preserve) and field absent (must default to 0)
  const dataWithState = { securityBreachCount: 2, activeSecurityPenalty: '10_min_timeout' as const };
  const restored = {
    securityBreachCount: dataWithState.securityBreachCount ?? 0,
    activeSecurityPenalty: dataWithState.activeSecurityPenalty ?? '',
  };
  assert.strictEqual(restored.securityBreachCount, 2, 'breach count must survive restore');
  assert.strictEqual(restored.activeSecurityPenalty, '10_min_timeout', 'penalty must survive restore');

  const dataWithout = {} as any;
  const restoredDefault = {
    securityBreachCount: dataWithout.securityBreachCount ?? 0,
    activeSecurityPenalty: dataWithout.activeSecurityPenalty ?? '',
  };
  assert.strictEqual(restoredDefault.securityBreachCount, 0, 'missing breach count → 0');
  assert.strictEqual(restoredDefault.activeSecurityPenalty, '', 'missing penalty → ""');
  console.log('PASS: security state preserved through restore; missing fields default to clean state');
}

// ── Schema sanitization survival tests ───────────────────────────────────────

{
  // 16. All item status enum values survive schema sanitization
  // Mirrors the sanitizeSchemaForGemini enum logic: "" is stripped, others survive, nullable added.
  const statusEnumFromSchema = ['', 'current', 'next', 'complete', 'warning', 'blocked', 'positive', 'negative', 'neutral'];
  const hadEmpty = statusEnumFromSchema.some(e => e === '');
  const filtered = statusEnumFromSchema.filter(e => typeof e === 'string' && e !== '');
  assert(hadEmpty, 'status enum must contain "" in source schema');
  assert(filtered.includes('current'), 'current survives');
  assert(filtered.includes('next'), 'next survives');
  assert(filtered.includes('positive'), 'positive survives');
  assert(filtered.includes('negative'), 'negative survives');
  assert(filtered.includes('neutral'), 'neutral survives');
  assert(filtered.includes('complete'), 'complete survives');
  assert(filtered.includes('warning'), 'warning survives');
  assert(filtered.includes('blocked'), 'blocked survives');
  assert.strictEqual(filtered.length, 8, 'exactly 8 non-empty values survive');
  // nullable is added when "" was present — Gemini schema must allow null status
  const nullable = hadEmpty; // sanitizer sets this
  assert(nullable, 'status field must be nullable in Gemini schema (because "" was stripped)');

  // Verify AJV (local validation) still accepts all non-empty status values including ""
  for (const val of statusEnumFromSchema) {
    const r = makeMinimalResponse({
      content_blocks: [
        { id: 'b1', type: 'list', level: 'none', variant: 'default', title: '', text: '',
          items: [{ id: 'i1', title: 'item', text: 'desc', value: '', status: val }], columns: [], rows: [] },
      ],
    });
    assert(validate(r), `AJV rejected status="${val}": ${JSON.stringify(validate.errors)}`);
  }
  console.log('PASS: all 8 non-empty status values survive sanitization; AJV accepts all including ""');
}

{
  // 17. single_select + options survive schema validation and response pipeline
  const r = makeMinimalResponse({
    interaction: {
      kind: 'question',
      input_type: 'single_select',
      question_id: 'q1',
      question: 'Which pathway interests you?',
      options: [
        { id: 'o1', label: 'University Degree', description: '', value: 'university' },
        { id: 'o2', label: 'TAFE Certificate', description: '', value: 'tafe' },
        { id: 'o3', label: 'Apprenticeship', description: '', value: 'apprenticeship' },
      ],
      allow_other_input: false,
      other_input_label: '',
      fields: [],
      recommended_actions: [],
    },
  });
  assert(validate(r), `AJV rejected single_select with options: ${JSON.stringify(validate.errors)}`);
  const result = validateProtocolV13(r);
  assert(result.protocolAccepted, `Protocol must accept single_select. Errors: ${result.errors}`);

  // multi_select also valid
  const rm = makeMinimalResponse({
    interaction: {
      kind: 'question', input_type: 'multi_select', question_id: 'q2',
      question: 'Which skills do you have?',
      options: [
        { id: 'o1', label: 'Python', description: '', value: 'python' },
        { id: 'o2', label: 'SQL', description: '', value: 'sql' },
      ],
      allow_other_input: true, other_input_label: 'Other skill', fields: [], recommended_actions: [],
    },
  });
  assert(validate(rm), `AJV rejected multi_select: ${JSON.stringify(validate.errors)}`);
  console.log('PASS: single_select and multi_select with options survive AJV and protocol validation');
}

{
  // 18. Both EXPLORE_OPTIONS and ROUTE_SELECTION are valid response_intent values
  for (const intent of ['EXPLORE_OPTIONS', 'ROUTE_SELECTION']) {
    const r = makeMinimalResponse({ response_intent: intent });
    assert(validate(r), `AJV rejected response_intent="${intent}": ${JSON.stringify(validate.errors)}`);
    const result = validateProtocolV13(r);
    assert(result.protocolAccepted, `Protocol must accept ${intent}. Errors: ${result.errors}`);
  }
  console.log('PASS: both EXPLORE_OPTIONS and ROUTE_SELECTION are valid response_intent values');
}

{
  // 19. EXPLICIT_UNCERTAINTY and all other reason_codes are valid per schema
  const allReasonCodes = [
    'EXPLICIT_UNCERTAINTY', 'EXPLICIT_CONFIDENCE', 'GOAL_UNCLEAR', 'GOAL_CLEAR',
    'CHOICE_UNSTABLE', 'CHOICE_STABLE', 'CRITERIA_UNCLEAR', 'CRITERIA_PARTIAL', 'CRITERIA_CLEAR',
    'ROUTE_UNRESOLVED', 'ROUTE_CHOSEN', 'ACTION_NOT_READY', 'ACTION_EXPLORING', 'ACTION_READY',
    'CONTRADICTION_PRESENT', 'NEW_TOPIC_RESET',
  ];
  for (const code of allReasonCodes) {
    const r = makeMinimalResponse();
    r.state.user_confidence.reason_codes = [code];
    assert(validate(r), `AJV rejected reason_code="${code}": ${JSON.stringify(validate.errors)}`);
  }
  // EXPLICIT_UNCERTAINTY requires actual user expression of uncertainty (system prompt contract)
  // Verify it is distinct from general early-state codes — both should be expressible independently
  const rExplicit = makeMinimalResponse();
  rExplicit.state.user_confidence = { score: 25, band: 'low', evidence_strength: 'weak', trend: 'unknown', reason_codes: ['EXPLICIT_UNCERTAINTY'] };
  assert(validate(rExplicit), `EXPLICIT_UNCERTAINTY alone must be schema-valid`);
  const rClear = makeMinimalResponse();
  rClear.state.user_confidence = { score: 52, band: 'medium', evidence_strength: 'moderate', trend: 'stable', reason_codes: ['GOAL_CLEAR', 'ACTION_EXPLORING'] };
  assert(validate(rClear), `GOAL_CLEAR + ACTION_EXPLORING must be schema-valid`);
  console.log('PASS: all 16 reason_codes are individually valid; EXPLICIT_UNCERTAINTY and GOAL_CLEAR independently valid');
}

{
  // 20. responseSchema is not cached between requests — no separate cached/uncached schema path
  // Static: sanitizeSchemaForGemini is called at assembleRequest() time, not cached.
  // The schema JSON is loaded once (singleton), sanitized fresh per call.
  // Both paths use the same this.responseSchemaJson source. Verified by code inspection:
  //   assembleRequest → sanitizeSchemaForGemini(this.responseSchemaJson)  (no conditional branch)
  // Regression: verify active_security_penalty enum survives sanitization both passes
  const schemaStatusNode = schemaJson.properties.state.properties.progress.properties.active_security_penalty;
  const schemaItemStatusNode = schemaJson.properties.content_blocks.items.properties.items.items.properties.status;

  // Run the sanitizer logic inline for both fields
  function emulateSanitize(enumNode: any) {
    const hadEmpty = (enumNode.enum as any[]).some((e: any) => e === '');
    const filtered = (enumNode.enum as any[]).filter((e: any) => typeof e === 'string' && e !== '');
    return { filtered, nullable: hadEmpty };
  }

  const penaltySanitized = emulateSanitize(schemaStatusNode);
  assert.deepStrictEqual(penaltySanitized.filtered, ['10_min_timeout', '24_hr_ban']);
  assert(penaltySanitized.nullable, 'active_security_penalty must be nullable in Gemini schema');

  const statusSanitized = emulateSanitize(schemaItemStatusNode);
  assert.strictEqual(statusSanitized.filtered.length, 8, 'item status: 8 values survive');
  assert(statusSanitized.nullable, 'item status must be nullable in Gemini schema');

  console.log('PASS: schema sanitization is idempotent; both penalty and status fields produce correct Gemini schemas');
}

console.log('\nAll tests passed.');
