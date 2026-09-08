/**
 * Local schema + response-preservation tests — no API calls, mock JSON only.
 * Run: npx ts-node src/protocol/v1.3/schema.test.ts
 */

import assert from 'assert';
import Ajv from 'ajv';
import schemaJson from './Yuzee_Response_Schema_v1.3.json';
import { validateProtocolV13 } from '../validator';
import { formatAssistantMessageForContext } from '../../services/TokenBudgetMemoryManager';

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

console.log('\nAll tests passed.');
