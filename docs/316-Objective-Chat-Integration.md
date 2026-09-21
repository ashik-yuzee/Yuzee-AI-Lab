> Workspace behaviour update: see [316-Workspace-Conversation-Flow.md](316-Workspace-Conversation-Flow.md). The current preview supports gated automatic opening, saved answer history attached to the original chat response, and automatic result handoff. The earlier live-validation notes below remain historical.

# 316-objective chat integration — experimental preview

18 September 2026. This is an opt-in local integration, not a production validation sign-off.

## Try it

Open http://localhost:3000/ and enable **316 activities · Test mode** above the chat. Use **Browse activities**, optionally add the question to focus on, and select an objective. After an eligible Oala response, BGE can retrieve candidates and Gemini can recommend one activity below the response. Suggestions are hidden while Oala asks a question. The catalogue remains available for an explicit user choice.

Credits were restored on 18 September. Live Gemini execution, selector decisions and the job-offer workspace handoff have now been exercised. These are development checks, not a sign-off on all 316 objectives. Earlier failures and corrective attempts remain in the QA records. No model substitution or fake live answer is used.

## What is connected

- 316 selection entries compiled from the pinned final workbook registry. `scripts/sync-objective-catalogue.mjs --check` prevents metadata drift.
- BGE uses the existing pinned q8 BGE-small-en-v1.5 encoder, CLS pooling, L2 normalization, 384 dimensions and checked 512-token inputs. No additional embedding model and no changed model weights.
- The 316 index is prepared lazily in the shared worker. Three views per objective: its question label, purpose, and serve-when guidance. Long queries are chunked; a separate final-sentence view keeps a late request from disappearing inside a background chunk. Optional work yields to ordinary chat routing.
- At most eight distinct candidate records go to a separate Gemini selection call. They contain selection metadata, not execution prompts. A retrieval score is not a confidence probability. Gemini returns SUGGEST or NONE. Unclear or off-topic requests can return NONE; Oala remains responsible for conversational clarification.
- The user selects an activity before execution. The backend then loads Global Rules + exactly one objective's V2 prompt + bounded context + its exact confirmed answers. No 316-prompt dump.
- The right-side workspace supports opening, closing, expansion, pointer/keyboard resizing, a searchable catalogue, switching among saved activities, answering, stopping a request, ending an activity and returning a compact result to Oala.
- The application validates JSON, objective identity, permitted primitives, action IDs, evidence references, readiness structure, counters and the current question before showing or accepting data.
- Answers are saved only after an accepted plan. Invalid output never replaces the previous plan. The planner allows one bounded Gemini correction for a rejected output. Both attempts are recorded and the full validation runs again; no invalid draft is rendered. The combined planning deadline is 60 seconds. Provider/credit failures do not trigger this correction. An explicit retry uses the same accepted state.
- Handoff IDs are looked up in the owning conversation on the server. Oala receives the validated workspace summary, confirmed answers, unknowns and inference limits, not arbitrary client-provided result JSON.

Turning test mode off restores the existing 103-skill suggestions and mini-pathway experience. Test mode temporarily replaces those optional suggestions/drawer to prevent competing activities. The ordinary Quiz prompt is unchanged.

## Current component transport

All 20 names have a reusable renderer. Choice, multi-select, range, ranking, grouping and text controls accept typed answers. Tables scroll horizontally; timelines use one numbering sequence; evidence labels distinguish user statements, inference, general guidance, sourced claims and unknowns. A question with no supplied entity options accepts a name/link for later verification; it does not fabricate an entity.

This first transport is intentionally simpler than the eventual product: constraint/profile edits and editable matrices/builders accept a plain-language correction. Hierarchies show supplied branches in disclosure sections rather than an arbitrary recursive tree. No profile write or entity search is implied. Interactive rich builders, recursive hierarchy contracts and live entity sources still need product contracts and testing.

GOAL_001 and GOAL_004 are disabled because the source output DSL has unresolved annotations. They must be corrected/versioned at the source before enabling execution. Other entries are executable in preview, not individually certified.

## Evidence and live tools

The new runtime has no approved live-data connector or external action executor. It starts with `approved_evidence: []`, labels this limitation in the planner instruction, and preserves NEEDS_RESEARCH. The existing research feature is not automatically treated as evidence for the new engine. Only `continue_chat` and the non-executing `research_required` intent are bound. No applications, emails, purchases, reminders or profile updates are performed.

Validation checks references and structure; it cannot establish that every natural-language claim is true. Earlier harness failures involving inference versus unknown evidence are still open and are not cleared by this integration.

## State and limits

- Server state: `data/objective-preview/<hashed-conversation-id>/<session-id>.json` plus private audit records. Excluded from Git. Do not include in a handover without reviewing/redacting user content.
- Conversation-scoped session ID, revision, objective ID, interaction count, status and answers; up to 30 workspaces per test conversation. Existing active objectives resume rather than duplicate.
- Closed activities reject new answers. Replayed/stale answers reject on revision mismatch. Exactly one answer-taking component per step and the workbook interaction cap apply.
- Context is currently a bounded recent user window (latest user text up to 12,000 characters and three earlier user messages up to 1,800 each). It is not a full long-conversation memory engine. Context limiting is flagged; older details may require confirmation. Persistent profile facts and approved evidence retrieval are future integrations.
- Selection uses the latest user message plus bounded visible-response/recent-discussion text. Very long inputs can abstain rather than silently exceed the encoder budget. Stop/social phrases skip the selection call.
- The local app uses its existing shared admin authentication. These conversation checks are not a production multi-tenant security assessment.
- Workspace model usage is recorded in private raw response audits; it is not yet included in the existing chat telemetry pill.

## Tests and outcomes

- 34 deterministic runtime/control tests passed, including one-prompt requests, persisted answer flow, stale revisions, cross-conversation results, invalid JSON, cancellation, duplicate starts, safe component rendering, typed control bounds, selector rejection and stale decisions. Model responses are injected test doubles for these state tests.
- Existing 61 harness checks passed. Existing BGE release, skill suggestions and mini-pathway regression suites passed. Type checking and the production build passed.
- Real browser BGE retrieval: 12 positive synthetic scenarios + four no-action/ambiguous scenarios. Labels were authored for this smoke set, not reviewed by independent counsellors. Initial single-view index: 6/12 expected top-1, 7/12 expected in top-5. Revised multi-view index: 7/12 expected top-1, 8/12 expected in top-5 and top-8. Long-tail request improved to expected top-1.
- Remaining retrieval misses: broad activity interests, data-analyst skill gap, school caring responsibilities and a heavily misspelled request. Recipe and ambiguous messages can still receive embedding candidates; those are not safe execution decisions. The Gemini selector must reject them. A later nine-case selector smoke run is recorded below. General real-user rejection accuracy remains unmeasured.
- Browser catalogue/search/resize/expand/error-state checks and local interactive primitive checks are separate from live model correctness.
- Before credits were restored, three synthetic execution cases (STUDY_005, EMP_SAFE_001, PROFILE_005), plus an interest activity from the main UI, were blocked by HTTP 429. The follow-up below records the later live results separately.

The earlier 108-case objective execution report remains historical evidence, separate from this integration. The full 3,140-case acceptance suite and independent 316 routing evaluation are not complete.

## Reproduce and next gates

1. With credits restored, run `node --import ./node_modules/tsx/dist/loader.mjs scripts/objective-live-smoke.ts`. Raw requests/responses are written to the integration folder. Do not change expected outcomes to make failures pass.
2. Test main chat -> eligible response -> BGE shortlist -> Gemini SUGGEST/NONE -> one workspace -> user answers -> complete -> handoff -> continued Oala reply. Also test switching conversations, interruption and page reload.
3. Open `/concepts/objective-routing/index.html` for browser BGE checks, and `/concepts/objective-gallery/index.html` for the sample-data control preview. The gallery is not a Gemini response.
4. Extend independently labelled tests across all 316: paraphrases, typos, short references with context, long text with the request at different positions, changed decisions, unrelated messages, sensitive situations, resolved objectives and multi-intent requests. Freeze a grouped holdout before further calibration. Measure correct suggestions, harmful/wrong suggestions, abstention and top-k recall separately.
5. Repair the two source contracts and fixture gaps; finish objective semantic QA. Add approved evidence and action adapters with their own authorization rules. Do not promote the preview on the strength of these smoke numbers.

Useful code: `src/objectives/`, `src/workers/embedder.worker.ts`, `src/services/MicroToolRouter.ts`, `server.ts`, `tests/objectives.test.tsx`. Use the current npm build and existing regression scripts. The new npm `test:objectives` command runs the local checks only.


## Live follow-up after credits were restored — 18 September

The final three-case execution smoke run passed structural validation (STUDY_005, EMP_SAFE_001, PROFILE_005). This does not clear semantic QA: the course output still suggests practice depth unsupported by a hypothetical syllabus, and the safety output can label general guidance as user-confirmed or imply a lookup with “not found” wording. The profile output correctly stays a self-reported conversation draft.

Nine selector scenarios were checked using observed BGE candidates and synthetic assistant replies: three positive scenarios selected the expected objective; recipe, ambiguous reference, thanks, stop and active-question cases returned NONE (three were local bypasses). The ninth case was a retrieval miss: DISCOVER_001 was absent, and Gemini abstained. Eight of nine exact expectations were met; this is not a production accuracy estimate.

The real chat offered Compare two job offers after an overview. The side workspace opened, requested details and generated a complete comparison using a 65,000 / 58,000 AUD salary scenario, a 56,000 AUD floor and user-specified training/travel priorities. During debugging the long answer was resumed through the same service with scripts/objective-live-advance.ts. One correction preserved the exact answer after a model echo mismatch. The final browser handoff showed Oala using the supplied numbers and unknowns, without asking for them again. Reopening and switching saved activities also worked. Earlier rejected attempts remain visible in the synthetic test conversation.

Fixes made in this round:

- Use Gemini 3's recommended temperature 1.0 instead of 0. Google warns that lower settings can loop or degrade performance: https://ai.google.dev/gemini-api/docs/gemini-3#temperature . Model weights and the pinned workbook prompts are unchanged.
- Require complete transport keys, bound evidence-reference IDs, limit summaries locally and describe unavailable actions explicitly.
- Send long confirmed answers as provider string fields. Keep exact const checks on the server. Using the whole long answer as a provider enum produced HTTP 400 in this test.
- Add an explicit OBJECTIVE_OPENED / ANSWER_ACCEPTED event so an earlier “overview only” chat request does not stall an explicitly opened activity.
- Allow free-text entity details alongside options.
- Allow at most one fully validated correction, preserving raw failed output and the prior accepted state. Never count a repaired result as a first-attempt pass.
- Include the saved result in BOTH the primary Oala request and its explanation-review request. Handoffs use strict Quiz JSON formatting even when ordinary chat is in Vanilla mode. Returning a result does not authorize an application, acceptance, profile write or other action.

Validation summary: qa/objectives/integration/2026-09-18-live-validation.json. Raw runs are stored under the timestamped integration folders; main-chat provider and validation audits remain private in data/objective-preview. Current build, 34 runtime tests, 61 harness checks and teaching/skill/pathway regressions pass. Full 3,140-case execution and independent routing qualification remain outstanding.
