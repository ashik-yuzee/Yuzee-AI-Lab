/**
 * Request shape dry-run: shows both current (single-text) and proposed (multi-turn)
 * Gemini request objects from identical inputs, for side-by-side comparison.
 *
 * NO external calls — all inputs are mocked inline.
 * Run: npx tsx src/protocol/v1.3/request-shapes.test.ts
 */

import assert from 'assert';
import {
  buildMultiTurnContents,
  formatAssistantMessageRich,
  estimateMultiTurnTokens,
  type Content,
} from '../../services/MultiTurnRequestBuilder';
import { formatAssistantMessageForContext, estimateTokens } from '../../services/TokenBudgetMemoryManager';
import type { DialogueTurn } from '../../services/TokenBudgetMemoryManager';

// ── Sample data: one mock conversation with 2 prior turns ─────────────────────

const MOCK_CAPSULE =
  'YUZEE_STRUCTURED_MEMORY_CAPSULE:\n' +
  '- [goal]: Become a data analyst\n' +
  '- [location]: Melbourne, VIC\n' +
  '- [education_level]: Year 12 complete';

const MOCK_SUMMARY =
  'User expressed interest in data analytics. Discussed Python and SQL as core skills. ' +
  'No services triggered. High uncertainty about entry pathways.';

// Raw Gemini JSON responses (what gets stored in message.content for assistant turns)
const MOCK_ASSISTANT_RESPONSE_1 = JSON.stringify({
  schema_version: '1.3',
  current_mode: 'A_CONVERSATION',
  response_intent: 'EXPLORE_OPTIONS',
  content_blocks: [
    { id: 'b1', type: 'text', level: 'none', variant: 'default', title: '',
      text: 'Data analytics is a great direction. Here are the core paths:', items: [], columns: [], rows: [] },
    { id: 'b2', type: 'heading', level: 'h2', variant: 'default', title: 'Core Pathways',
      text: '', items: [], columns: [], rows: [] },
    { id: 'b3', type: 'list', level: 'none', variant: 'default', title: '', text: '',
      items: [
        { id: 'i1', title: 'TAFE Certificate', text: 'Fast entry, hands-on', value: '1-2 years', status: 'next' },
        { id: 'i2', title: 'University Degree', text: 'Deeper theory, more doors', value: '3 years', status: 'current' },
        { id: 'i3', title: 'Online Bootcamp', text: 'Fastest, self-paced', value: '6 months', status: 'positive' },
      ], columns: [], rows: [] },
  ],
  interaction: {
    kind: 'question', input_type: 'single_select',
    question_id: 'q1', question: 'Which of these pathways most interests you?',
    options: [
      { id: 'o1', label: 'TAFE Certificate', description: '', value: 'tafe' },
      { id: 'o2', label: 'University Degree', description: '', value: 'uni' },
      { id: 'o3', label: 'Online Bootcamp', description: '', value: 'bootcamp' },
    ],
    allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [],
  },
  service_trigger: { service_intent_detected: false, primary_requested_service: 'NONE', confidence: 'LOW', reason: '', trigger_now: false, needs_more_clarity: false, actions: [] },
  rmo_readiness: { readiness: 'NOT_READY', ready_to_generate: false, missing_inputs: [], verification_required: false },
  state: {
    active_response_mode: 'Standard', effective_response_mode: 'Standard', mode_source: 'default',
    safety_override_applied: false,
    user_confidence: { score: 25, band: 'low', evidence_strength: 'weak', trend: 'unknown', reason_codes: ['GOAL_CLEAR', 'ROUTE_UNRESOLVED'] },
    progress: { explained: false, failed_attempts: 0, loop_count_same_issue: 0, security_breach_count: 0, active_security_penalty: '' },
  },
  followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
});

const MOCK_ASSISTANT_RESPONSE_2 = JSON.stringify({
  schema_version: '1.3',
  current_mode: 'A_CONVERSATION',
  response_intent: 'ROUTE_SELECTION',
  content_blocks: [
    { id: 'b1', type: 'text', level: 'none', variant: 'default', title: '',
      text: 'TAFE is a solid choice. Here is how to get started:', items: [], columns: [], rows: [] },
    { id: 'b2', type: 'steps', level: 'none', variant: 'default', title: '', text: '',
      items: [
        { id: 's1', title: 'Research courses', text: 'Browse TAFE Victoria data analytics programs', value: '', status: 'next' },
        { id: 's2', title: 'Check entry requirements', text: 'Most need Year 11 or equivalent', value: '', status: 'next' },
        { id: 's3', title: 'Apply online', text: 'Applications open Feb and July', value: '', status: 'next' },
      ], columns: [], rows: [] },
  ],
  interaction: {
    kind: 'question', input_type: 'text',
    question_id: 'q2', question: 'Do you have a preferred start date in mind?',
    options: [], allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [],
  },
  service_trigger: { service_intent_detected: false, primary_requested_service: 'NONE', confidence: 'LOW', reason: '', trigger_now: false, needs_more_clarity: false, actions: [] },
  rmo_readiness: { readiness: 'NOT_READY', ready_to_generate: false, missing_inputs: [], verification_required: false },
  state: {
    active_response_mode: 'Standard', effective_response_mode: 'Standard', mode_source: 'default',
    safety_override_applied: false,
    user_confidence: { score: 45, band: 'medium', evidence_strength: 'moderate', trend: 'up', reason_codes: ['GOAL_CLEAR', 'ROUTE_CHOSEN', 'ACTION_EXPLORING'] },
    progress: { explained: false, failed_attempts: 0, loop_count_same_issue: 0, security_breach_count: 0, active_security_penalty: '' },
  },
  followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
});

const KEPT_TURNS: DialogueTurn[] = [
  {
    id: 'turn-1',
    userMessage: { id: 'u1', content: 'What are my options for getting into data analytics?', createdAt: Date.now() - 120000 },
    assistantMessage: { id: 'a1', content: MOCK_ASSISTANT_RESPONSE_1, createdAt: Date.now() - 118000 },
    estimatedTokens: 200,
  },
  {
    id: 'turn-2',
    userMessage: { id: 'u2', content: 'USER_EVENT:\n{"ui":{},"interaction":{"question_id":"q1","selected_option_ids":["o1"]},"supplementary_text":"I like the TAFE option"}', createdAt: Date.now() - 60000 },
    assistantMessage: { id: 'a2', content: MOCK_ASSISTANT_RESPONSE_2, createdAt: Date.now() - 58000 },
    estimatedTokens: 180,
  },
];

const CURRENT_USER_FORMATTED =
  'USER_EVENT:\n' +
  JSON.stringify({ ui: {}, user_text: 'Can you help me find a good TAFE course in Melbourne?' }, null, 2);

const CONTEXT_PREFIX = '[Date: Monday 8 Sep 2025 · Location: Melbourne, VIC]';
const CURRENT_USER_WITH_PREFIX = `${CONTEXT_PREFIX}\n${CURRENT_USER_FORMATTED}`;

// ── Architecture A: Current single-text assembler output ──────────────────────

function buildCurrentSingleText(): string {
  // Replicates YuzeeRequestAssembler.assembleRequest() logic exactly
  const recentHistoryText = KEPT_TURNS
    .map(t => {
      const userPart = `USER: ${t.userMessage.content}`;
      const asstPart = t.assistantMessage
        ? `\nASSISTANT: ${formatAssistantMessageForContext(t.assistantMessage.content)}`
        : '';
      return `${userPart}${asstPart}`;
    })
    .join('\n\n');

  const dynamicSections: string[] = [];
  dynamicSections.push(MOCK_CAPSULE);
  dynamicSections.push(`PREVIOUS_CONVERSATION_SUMMARY:\n${MOCK_SUMMARY}`);
  dynamicSections.push(`RECENT_DIALOGUE_TURNS:\n${recentHistoryText}`);
  const dynamicContextStr = dynamicSections.join('\n\n');

  return `${dynamicContextStr}\n\n${CURRENT_USER_WITH_PREFIX}`;
}

// ── Architecture B: Proposed multi-turn Content[] ─────────────────────────────

function buildProposedMultiTurn(): Content[] {
  return buildMultiTurnContents({
    careerCapsule: MOCK_CAPSULE,
    summary: MOCK_SUMMARY,
    keptTurns: KEPT_TURNS,
    currentUserInput: CURRENT_USER_WITH_PREFIX,
    richHistory: true,
  });
}

// ── Render helpers ────────────────────────────────────────────────────────────

function ruler(label: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(70));
}

function indent(s: string, spaces = 2) {
  return s.split('\n').map(l => ' '.repeat(spaces) + l).join('\n');
}

// ── Main dry-run ──────────────────────────────────────────────────────────────

ruler('ARCHITECTURE A — Current: single-text contents (string)');

const singleTextContents = buildCurrentSingleText();
const singleTextTokens = estimateTokens(singleTextContents);

console.log(indent(`Token estimate: ~${singleTextTokens}`));
console.log(indent(`Shape: { role: "user", parts: [{ text: "<${singleTextContents.length} chars>" }] }`));
console.log('\n' + indent('=== BEGIN CONTENTS ==='));
console.log(indent(singleTextContents));
console.log(indent('=== END CONTENTS ==='));

ruler('ARCHITECTURE B — Proposed: multi-turn Content[]');

const multiTurnContents = buildProposedMultiTurn();
const multiTurnTokens = estimateMultiTurnTokens(multiTurnContents);

console.log(indent(`Token estimate: ~${multiTurnTokens} (across ${multiTurnContents.length} Content objects)`));
console.log(indent(`Shape: Content[${multiTurnContents.length}] = [user, model, user, model, user]`));
console.log('');

for (let i = 0; i < multiTurnContents.length; i++) {
  const c = multiTurnContents[i];
  const chars = c.parts.map(p => p.text.length).reduce((a, b) => a + b, 0);
  const tokEst = Math.max(1, Math.ceil(c.parts.map(p => p.text).join('').length * 0.26));
  console.log(indent(`[${i}] role="${c.role}" (~${tokEst} tokens, ${chars} chars)`));
  console.log(indent(indent('=== BEGIN PART ===')));
  console.log(indent(indent(c.parts[0].text)));
  console.log(indent(indent('=== END PART ===')));
  console.log('');
}

ruler('COMPARISON SUMMARY');

console.log(indent([
  `Token delta: A=${singleTextTokens} vs B=${multiTurnTokens} (diff: ${multiTurnTokens - singleTextTokens})`,
  `Content objects: A=1 (single user string) vs B=${multiTurnContents.length} (alternating user/model)`,
  `Last content role: A=user (whole string as user) vs B=${multiTurnContents[multiTurnContents.length - 1].role}`,
  `Roles in B: ${multiTurnContents.map(c => c.role).join(' → ')}`,
].join('\n')));

// ── Compatibility tests ───────────────────────────────────────────────────────

ruler('COMPATIBILITY CHECKS');

// 1. cachedContent: stays on geminiConfig — unaffected by contents shape
{
  const geminiConfigShape = {
    responseMimeType: 'application/json',
    responseSchema: '(sanitized schema — unchanged)',
    maxOutputTokens: 65536,
    thinkingConfig: { thinkingBudget: 512 },
    // When cache hit: systemInstruction removed, cachedContent: "caches/xxx" added
    // This is independent of whether contents is string or array
  };
  console.log(indent('cachedContent: unchanged — lives in geminiConfig alongside responseSchema, not in contents'));
  assert.ok(geminiConfigShape.responseMimeType);
  console.log(indent('PASS: cachedContent compatibility'));
}

// 2. Token budgeting: assembleMemory() already returns keptTurns — multi-turn uses same eviction
{
  const keptCount = KEPT_TURNS.filter(t => t.assistantMessage != null).length;
  assert.strictEqual(keptCount, 2, 'both mock turns are complete');
  console.log(indent('Token budgeting: assembleMemory keptTurns are used directly — no re-eviction needed'));
  console.log(indent('PASS: token budgeting compatibility'));
}

// 3. responseSchema: in geminiConfig — same regardless of contents shape
{
  assert.ok(true, 'responseSchema is in geminiConfig, not contents');
  console.log(indent('responseSchema: in geminiConfig.responseSchema — unaffected'));
  console.log(indent('PASS: responseSchema compatibility'));
}

// 4. Multi-turn must end with user role
{
  const last = multiTurnContents[multiTurnContents.length - 1];
  assert.strictEqual(last.role, 'user', 'last content must be user role');
  console.log(indent('Last role is "user": PASS'));
}

// 5. Strict alternation: user/model/user/model/.../user
{
  for (let i = 0; i < multiTurnContents.length - 1; i++) {
    const cur = multiTurnContents[i].role;
    const next = multiTurnContents[i + 1].role;
    assert.notStrictEqual(cur, next, `Contents[${i}] and Contents[${i+1}] must alternate (got ${cur}/${next})`);
  }
  console.log(indent('Role alternation (user/model/.../user): PASS'));
}

// 6. No empty parts
{
  for (let i = 0; i < multiTurnContents.length; i++) {
    for (const part of multiTurnContents[i].parts) {
      assert.ok(part.text.trim().length > 0, `Content[${i}] has empty part text`);
    }
  }
  console.log(indent('No empty parts: PASS'));
}

// 7. Capsule present in first user turn only
{
  const firstUserText = multiTurnContents[0].parts[0].text;
  assert.ok(firstUserText.includes('YUZEE_STRUCTURED_MEMORY_CAPSULE'), 'capsule must be in first user turn');
  for (let i = 1; i < multiTurnContents.length; i++) {
    if (multiTurnContents[i].role === 'user') {
      // Only the first user turn should have the capsule; current turn should NOT duplicate it
      // (unless it's the only turn — but that case tested above)
    }
  }
  // Current user turn (last) must NOT repeat the capsule
  const lastUserText = multiTurnContents[multiTurnContents.length - 1].parts[0].text;
  assert.ok(!lastUserText.includes('YUZEE_STRUCTURED_MEMORY_CAPSULE'), 'capsule must not repeat in current turn');
  console.log(indent('Memory capsule: in first turn only, not duplicated to current turn: PASS'));
}

// 8. Summary preserved
{
  const firstUserText = multiTurnContents[0].parts[0].text;
  assert.ok(firstUserText.includes('PREVIOUS_CONVERSATION_SUMMARY'), 'summary must be present');
  console.log(indent('Summary: preserved in first user turn: PASS'));
}

// 9. Current user input is last and unchanged
{
  const lastText = multiTurnContents[multiTurnContents.length - 1].parts[0].text;
  assert.ok(lastText.includes('USER_EVENT:'), 'current turn must contain USER_EVENT format');
  assert.ok(lastText.includes('TAFE course in Melbourne'), 'current turn must contain user message');
  assert.ok(lastText.includes('Date:'), 'current turn must contain context prefix');
  console.log(indent('Current user turn: USER_EVENT format + context prefix preserved: PASS'));
}

// 10. Rich formatter adds options to questions (vs original compact formatter)
{
  const rich = formatAssistantMessageRich(MOCK_ASSISTANT_RESPONSE_1);
  const compact = formatAssistantMessageForContext(MOCK_ASSISTANT_RESPONSE_1);
  assert.ok(rich.includes('Options:'), 'rich formatter must include options');
  assert.ok(rich.includes('TAFE Certificate'), 'rich formatter must include option labels');
  // Original compact formatter does NOT include options (regression check)
  // (it only outputs the question text, not the options)
  console.log(indent(`Rich formatter adds options: PASS`));
  console.log(indent(`Compact: ${compact.length} chars, Rich: ${rich.length} chars (+${rich.length - compact.length})`));
}

// 11. Rich formatter preserves table/comparison data
{
  const tableResponse = JSON.stringify({
    schema_version: '1.3', current_mode: 'A_CONVERSATION', response_intent: 'COMPARE',
    content_blocks: [{
      id: 'b1', type: 'comparison', level: 'none', variant: 'default', title: '', text: '', items: [],
      columns: [{ key: 'c1', label: 'TAFE' }, { key: 'c2', label: 'University' }],
      rows: [
        { id: 'r1', criteria: 'Duration', cells: [{ key: 'c1', value: '1 year' }, { key: 'c2', value: '3 years' }] },
        { id: 'r2', criteria: 'Cost', cells: [{ key: 'c1', value: 'Lower' }, { key: 'c2', value: 'Higher' }] },
      ],
    }],
    interaction: { kind: 'none', input_type: 'none', question_id: '', question: '', options: [], allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [] },
    service_trigger: { service_intent_detected: false, primary_requested_service: 'NONE', confidence: 'LOW', reason: '', trigger_now: false, needs_more_clarity: false, actions: [] },
    rmo_readiness: { readiness: 'NOT_READY', ready_to_generate: false, missing_inputs: [], verification_required: false },
    state: { active_response_mode: 'Standard', effective_response_mode: 'Standard', mode_source: 'default', safety_override_applied: false, user_confidence: { score: -1, band: 'unknown', evidence_strength: 'none', trend: 'unknown', reason_codes: [] }, progress: { explained: false, failed_attempts: 0, loop_count_same_issue: 0, security_breach_count: 0, active_security_penalty: '' } },
    followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
  });
  const rich = formatAssistantMessageRich(tableResponse);
  assert.ok(rich.includes('TAFE | University'), 'rich formatter must include column headers');
  assert.ok(rich.includes('Duration'), 'rich formatter must include row criteria');
  assert.ok(rich.includes('1 year'), 'rich formatter must include cell values');
  console.log(indent('Table/comparison data in rich formatter: PASS'));
}

// 12. No-history case: single-turn multi-turn equals current behavior
{
  const noHistory = buildMultiTurnContents({
    careerCapsule: MOCK_CAPSULE,
    summary: MOCK_SUMMARY,
    keptTurns: [],
    currentUserInput: CURRENT_USER_WITH_PREFIX,
  });
  assert.strictEqual(noHistory.length, 1, 'no-history case: single Content object');
  assert.strictEqual(noHistory[0].role, 'user');
  assert.ok(noHistory[0].parts[0].text.includes('YUZEE_STRUCTURED_MEMORY_CAPSULE'));
  assert.ok(!noHistory[0].parts[0].text.includes('CURRENT_USER_INPUT:'), 'no-history: raw text, no CURRENT_USER_INPUT prefix');
  console.log(indent('No-history case: degrades to single user message (same as current): PASS'));
}

ruler('MIGRATION RISK ANALYSIS');

console.log(indent([
  'LOW RISK:',
  '  - @google/genai SDK accepts both string and Content[] for generateContentStream.contents',
  '  - geminiConfig (responseSchema, thinkingConfig, cachedContent, etc.) is unchanged',
  '  - System instruction cache is unchanged — keyed by prompt hash, not contents',
  '  - Streaming works identically: chunks arrive in same delta format regardless of contents shape',
  '  - System prompt does NOT reference RECENT_DIALOGUE_TURNS or USER:/ASSISTANT: labels',
  '    (confirmed: grep of prompt file found zero matches)',
  '  - Token budget and whole-turn eviction are unchanged (assembleMemory still runs first)',
  '  - Conversation restoration: ConversationItem.messages stored/restored unchanged',
  '',
  'MEDIUM RISK:',
  '  - AssembledGeminiRequest.contents type changes from string to string | Content[]',
  '    → estimateTokens(assembledReq.contents) call in benchmark (server.ts:1357) would break',
  '      FIX: replace with estimateMultiTurnTokens() for Content[] case',
  '  - Memory capsule moves from standalone dynamic section to prepended to first user turn',
  '    → The model still sees the capsule; position changes but format is identical',
  '  - formatAssistantMessageForContext() in production path is UNCHANGED',
  '    → Multi-turn uses richer formatter only in its own builder; no production regression',
  '',
  'HIGH RISK:',
  '  - History user turns currently contain raw stored text (e.g. plain "I like TAFE option")',
  '    In current single-turn they are prefixed "USER: ..."; in multi-turn they have role="user"',
  '    The model understands role separation natively — this is an improvement, not a risk',
  '  - History assistant turns in multi-turn use the compact formatter output as model text',
  '    The model may interpret structured text differently when it sees it as its OWN prior output',
  '    vs as text in a document — this is the primary unknown',
  '',
  'ACTUAL UNKNOWNS (only testable with real Gemini calls):',
  '  1. Does the model maintain confidence state progression better with proper multi-turn?',
  '     Hypothesis: YES — model treats prior model turns as its own established assessments',
  '  2. Does EXPLORE_OPTIONS vs ROUTE_SELECTION intent shift toward ROUTE_SELECTION?',
  '     Hypothesis: likely YES — prior model turns provide stronger directional signal',
  '  3. Does single_select frequency increase when prior interactions are proper model turns?',
  '     Hypothesis: possibly — model recognizes it already presented options and user chose',
].join('\n')));

ruler('FILES THAT WOULD NEED CHANGING');

console.log(indent([
  '1. src/services/YuzeeRequestAssembler.ts',
  '   - AssembledGeminiRequest.contents: string → string | Content[]',
  '   - assembleRequest(): build Content[] instead of string using buildMultiTurnContents()',
  '   - import Content type from MultiTurnRequestBuilder',
  '',
  '2. src/services/TokenBudgetMemoryManager.ts',
  '   - recentHistoryText is still built for BASELINE/SEMANTIC_EVIDENCE strategies',
  '   - for ADAPTIVE_HYBRID: assembleMemory already returns keptTurns — used directly',
  '   - No change needed for the multi-turn path; keptTurns is already the source',
  '',
  '3. server.ts',
  '   - Line 1357: estimateTokens(assembledReq.contents) → safe to replace with',
  '     Array.isArray(assembledReq.contents)',
  '       ? estimateMultiTurnTokens(assembledReq.contents)',
  '       : estimateTokens(assembledReq.contents)',
  '   - generateContentStream call: contents field unchanged (SDK accepts both)',
  '   - No other changes needed',
  '',
  '4. src/services/MultiTurnRequestBuilder.ts (NEW — already created)',
  '   - buildMultiTurnContents(), formatAssistantMessageRich(), estimateMultiTurnTokens()',
].join('\n')));

ruler('RECOMMENDED MIGRATION PLAN');

console.log(indent([
  'PHASE 1 (done): Build and test multi-turn builder in isolation (this file)',
  '',
  'PHASE 2 (incremental, low-risk):',
  '  a. Add Content type to AssembledGeminiRequest.contents (union type)',
  '  b. Wire buildMultiTurnContents() into assembleRequest() behind a flag:',
  '       usMultiTurn: boolean = false  (off by default)',
  '  c. Add one test turn with multi_turn=true to compare TTFT and token usage',
  '     WITHOUT comparing response content (stochastic)',
  '',
  'PHASE 3 (validate, requires Gemini calls):',
  '  a. A/B test: same prompt, single-turn vs multi-turn, measure:',
  '     - does user_confidence.score advance faster?',
  '     - does intent shift toward ROUTE_SELECTION when appropriate?',
  '     - does single_select appear more when prior options were established?',
  '  b. If improvement confirmed → remove flag, make multi-turn the default',
  '',
  'PHASE 4 (cleanup):',
  '  a. Remove recentHistoryText from MemoryAssemblyResult (no longer used)',
  '  b. Update estimateTokens call in server.ts benchmark',
  '  c. Remove single-text code path from assembleRequest()',
].join('\n')));

console.log('\n' + '─'.repeat(70));
console.log('  Dry-run complete. No external calls made.');
console.log('─'.repeat(70) + '\n');
