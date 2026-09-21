# Activity routing upgrade — 18 September 2026

This update changes selection and presentation policy, not BGE weights or the 316 execution prompts. Workspace results remain on the right; no automatic result message is restored.

## Runtime

1. The existing Quiz Gemini request includes `src/prompts/activity-context.md`. Its existing `state` gains an optional `activity_context`: current goal, exact user quotes, tentative need, missing information, current question and constraints. Older protocol responses remain valid. No extra context-generation call is made in production.
2. Exact user quotes are checked against user messages before use. Other fields remain model interpretations and never become confirmed profile facts.
3. BGE searches the current user message independently from compact context. The retrieval context uses current goal and retained quotes, plus recent original user text for short replies. Tentative future needs and the next counselling question are available to the selector but excluded from embeddings after live tests showed potential distraction.
4. All 316 objectives have source-derived selection records with outcome, applicability, exclusions, input requirements and related-objective distinctions. Seven difficult/overlapping tools have manually authored development examples. Remaining example wording is source-derived, not independently validated against users. Exclusions are not positive embedding examples. The original index descriptions are retained alongside enrichment.
5. Each query retrieves up to 20 candidates. Reciprocal-rank fusion slightly prioritises the raw user lane. For reference replies such as “both, honestly”, up to 16 context candidates and four raw candidates are retained to avoid generic short-text matches crowding out the referent. Query provenance and source scores are saved in selection audit records.
6. Gemini receives bounded metadata for at most 20 candidates, original user context and advisory activity context. It receives no candidate execution prompts and selects SUGGEST, CLARIFY or NONE. CLARIFY abstains from execution; the main conversation handles clarification.
7. Policy `workspace-assist-v4-context` opens only a valid selected candidate with HIGH qualitative confidence, REQUIRED workspace need and similarity >=0.70. A lower-ranked candidate can open; rank-one and margin are no longer required. These are preview gates, not calibrated probabilities. Explicit opt-outs, deferral, safety/service intake, existing active sessions, stale source messages and duplicate prevention remain in effect.
8. One selected objective's execution prompt is loaded only when that objective starts.

## Evidence and limitations

The 23 new synthetic development cases were authored separately from catalogue examples. They are not an independent real-user benchmark, and development iterations used their results. Context in this ablation is authored fixture data.

| Retrieval experiment | Expected candidate first / 16 | Expected candidate in shortlist / 16 |
| --- | --- | --- |
| Old index, mixed input, top 8 | 5 | 12 |
| Separate queries alone, top 8 | 6 | 10 |
| Enriched index alone, mixed input, top 8 | 5 | 14 |
| Old index, mixed input, top 20 | 5 | 16 |
| Combined final retrieval | 11 | 16 |

The larger pool improved coverage more reliably than either isolated change. New metadata alone was not a universal improvement. First-pass reports are retained, including an initial skills-gap miss.

Live Gemini selection on the 23 authored-context cases matched 22 original labels. All seven no-action/ambiguous cases avoided execution. The remaining case selected SCHOOL_011 (Can I drop this subject?) for a request about dropping chemistry, rather than the prelabelled SCHOOL_003 (Subjects for My Course). This is plausibly a valid alternative, but the original score remains 22/23; no label was silently rewritten. Eight proposed automatic openings were all expected selections in that sample.

Four additional full main-Quiz Gemini calls generated activity context: interests, occupation comparison, a short contextual reply, and explicit opt-out. All four produced context. Final BGE retrieval covered all three positive cases. Final Gemini selection matched 3/4 expected outcomes: interests suggested, comparison auto-opened, opt-out skipped; “both, honestly” stayed in chat despite the relevant interest activity being retrieved. This needs further evaluation, not a forced match.

48 objective tests, protocol schema/request-shape tests and production build passed. Node CPU retrieval timings and provider timings are recorded separately; browser cold-index latency is not established by these numbers. No claim of production accuracy across all 316 is made.

## Files and reruns

- `src/objectives/selectionMetadata.json`: source-derived selection records; execute `node scripts/build-objective-selection.mjs` after workbook catalogue changes.
- `scripts/evaluate-objective-routing-v3.ts`: offline pinned q8 BGE ablations; `--live-context` uses saved genuine main-Quiz responses.
- `scripts/validate-activity-context-live.ts`: four synthetic full Quiz requests (billable).
- `scripts/validate-objective-selection-v3.ts`: selector checks (billable); `--live-context` checks the four generated contexts.
- `qa/objectives/routing-v3/`: raw context, retrieval results, selector audits, first-pass results and exact synthetic cases.

Before a production rollout, collect independently labelled user conversations, review valid alternative objectives, expand per-objective examples, evaluate multilingual inputs and unknown topics, and measure browser cold/warm latency and unwanted opening rates. Keep model-weight fine-tuning separate from these content and routing changes.

## Browser runtime check

The browser BGE worker completed the existing raw-query smoke set against the expanded index: 11/12 relevant cases ranked first and all 12 appeared in the top-20 candidate pool. This confirms browser loading and retrieval; it is separate from the dual-context evaluation above and does not validate no-action selection. The smoke page label was corrected from top-8 to top-20 to match the current pool size.
