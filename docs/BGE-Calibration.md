# BGE skill calibration v1

BGE-small is integrated as an optional, calibrated skills router. L6 stays the global default. This local browser is switched to BGE for user testing. Needs and mini-pathway relevance retain their previous classifiers and thresholds; this is not a claim that BGE is best for those flows.

## Runtime

- `src/routing/bgeSkillContent.json`: 103 authored descriptions, one per eligible skill.
- `bgeMatching.ts`: combines each new description with the existing catalogue prototype; max similarity per unique skill. Background competitors from `bgeDomain.ts` are retained in every ranking.
- `bgeCalibration.json`: frozen profile `bge-calibrated-v1`. Route/topic: score .65, skill margin .04, background margin .12. Suggestion: score .65, skill margin .05, background margin .12. Values are cosine cutoffs, not calibrated probabilities.
- Actual worker builds the BGE index only for BGE, using pinned q8 weights, CLS pooling and a measured 512-token budget. L6/L12 retain existing indexes and policies. Needs/pathway indexes are unchanged.
- `MicroToolRouter` passes the selected model and request purpose into selection. Worker replacement cancels pending work and stale worker events remain ignored.
- Server-side `validateRouteSelection` validates the allowlisted model, flow, profile version, ID and score bounds. Client thresholds and client prompt content are never authoritative. Missing background evidence causes BGE abstention.
- Suggestions remain inline below the response, hidden when Gemini has an active question. BGE does not use the legacy two-close-matches fallback. Maximum three unique offers across sections.
- Only the existing server-owned `mini_prompt`, learning-depth instruction and input contract are injected on selection. The master prompt and canonical response JSON contract are unchanged. A match does not establish factual accuracy or trigger a research request by itself.

## Evaluation

Development: previous 103 skill questions, 16 response excerpts and 44 boundary/negative questions. Grid search maximises correct acceptance subject to >=95% accepted precision and zero accepted negatives. Development examples were already seen and are explicitly not held-out evidence.

Frozen evaluation: 103 new skill requests, 24 new assistant excerpts and 24 negative/vague/unsuitable requests. Same-author synthetic data; no independent human validation. Input hashes recorded before the first evaluation. No profile or content retuning after evaluation.

Native CPU (correct / wrong / abstained):
- L6 baseline: 15 / 2 / 86.
- L12 baseline: 14 / 2 / 87.
- BGE baseline: 16 / 1 / 86.
- BGE calibrated: 43 / 0 / 60.

Browser production worker:
- L6: 19 / 3 / 81; top match correct 53/103.
- BGE calibrated: 40 / 1 / 62; top match correct 83/103.
- Each found useful suggestions in 8/24 excerpts, with zero wrong offers. All 24 negative cases rejected for both routes and suggestions.
- Browser median/p95: L6 10/14.8 ms, BGE 19.4/28.4 ms. These are mixed warm worker requests, not cold-load timing.
- 620 worker requests across both models, including topic selections, input-needs and pathway checks. Shared server validator agrees with all decisions; separate live HTTP check confirms server integration.
- Unchanged pathway checks: L6 14/16, BGE 12/16. Needs classification: L6 11/16, BGE 12/16. Do not claim those flows are calibrated.

Known failures: browser BGE maps company job families to internal mobility; CPU BGE maps an enrolment sequencing excerpt to RPL. Sixty-two browser skill cases still abstain. Shared stop/correction/context guards may suppress some legitimate task phrasings. Preserve these as regression cases and use newly labelled examples for future tuning rather than fitting this held-out set.

One synthetic live chat selected COURSE_003 via BGE, passed server profile validation and produced valid Gemini response JSON (explanation, comparison, pathway note and a question). This is not a factual audit. Nineteen automated test suites and production build pass.

## Reproduction

- `npm run test:bge`: deterministic guards, server/flow checks and UI eligibility.
- `npm run calibrate:bge`: development calibration; intentionally updates the BGE profile from development data only.
- `npm run eval:bge`: native CPU evaluation using cached pinned model directories; refuses changed frozen input hashes.
- `/tmp/model-comparison/bge-browser.html`: actual browser-worker evaluator; click Run browser validation. Do not edit files during a run, because Vite may reload it.
- `output/html/Yuzee-BGE-Calibration.html`: readable report and full 103-description search.

New profile or content changes require a new untouched evaluation set. Browser and native CPU rankings can differ; use browser evidence for the browser product.

## CSV handover

Project and Dropbox registry copies are byte-identical. Existing prompts, learning-depth instructions and 103 input contracts were preserved. Added `bge_matching_version` and `bge_matching_text`; updated six integration rules. 105 TOOL records (103 eligible), 57 RULE records, 36 columns. Backups retained. The app reads code/JSON, not CSV at runtime; exports do not provide background cloud synchronisation.
