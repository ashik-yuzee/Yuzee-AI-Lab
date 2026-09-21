# 316-objective validation harness

This is an isolated Phase A harness. Nothing in `src/`, `server.ts`, the main quiz prompt, the 103-skill registry or the BGE model is imported or changed by these scripts. The workbook's V2 prompts are copied byte-for-byte into a traceable registry. No production objective renderer is enabled.

## Source and implementation map

- Source: `Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx`, `Objective Prompts`, 316 rows; `Gemini Test Cases`, 3,140 rows. Workbook and per-prompt SHA-256 values are saved with every run. Batch31 is historical reference; the final CSV is a cross-check, not a second runtime source.
- Existing application: React/Vite frontend and Node Gemini adapter in `server.ts`; `YuzeeRequestAssembler.ts` owns main-conversation instructions; `MicroToolRouter.ts`/BGE select current skills; `MiniPathwayExperience.tsx` renders the current right workspace. Do not replace these with 316 pages or assume this harness is connected to them.
- Harness: `compile_workbook.py` reads Excel without authoring it, `registry.mjs` exposes definitions and fixture preflight, `schema.mjs` defines the draft closed wire contract, `validate.mjs` performs deterministic checks, `runner.mjs` invokes Gemini Interactions, `report.mjs` writes results.
- Official endpoint: `https://generativelanguage.googleapis.com/v1beta/interactions`. Exact model `gemini-3.7-flash`; no model fallback. Existing environment key is read privately. No keys or authentication headers are archived.
- Official API references checked 18 September 2026: https://ai.google.dev/api/interactions-api and https://ai.google.dev/gemini-api/docs/structured-output .

## Execution

Run from the project root. Node dependencies already supplied by the project's lockfile: `ajv` and `dotenv`. Workbook reading needs Python `openpyxl`. No production server is needed.

```text
python3 qa/objectives/compile_workbook.py /path/to/FINAL.xlsx --out qa/objectives/registry/workbook.json
node qa/objectives/harness.test.mjs
node qa/objectives/runner.mjs --test DISCOVER_001-T01 --judge
node qa/objectives/runner.mjs --objective DISCOVER_001 --judge
node qa/objectives/runner.mjs --batch 1 --judge
node qa/objectives/runner.mjs --smoke --supplemental --judge --concurrency 4
node qa/objectives/runner.mjs --failures /path/to/reports/results.json --judge
node qa/objectives/runner.mjs --all --judge
```

`--all` is deliberately gated by fixture/contract preflight. It does not send 3,140 unscoreable tests just to produce a misleading percentage. Any resolved fixture must have an explicit version, retain the original user prompt and expectation, and be archived with the run. `--supplemental` is a distinct concrete synthetic suite, not a silent replacement for workbook cases.

Each planner request contains the workbook Global Rules once, one V2 objective, the documented transport contract and only that case's context/evidence/session. Test expectations and the QA rubric are sent to the separate evaluator, not to the planner. The evaluator is another call to Gemini 3.7 Flash; its judgments are not independent human validation. Temperature 0 and a fixed seed improve repeatability but do not guarantee identical cloud outputs.

## Contract decisions and unresolved issues

The workbook's “Standard output schema” is a conceptual example, not executable JSON Schema. It leaves result objects and most primitive payloads untyped. This harness's **v0.2 transport, v0.2.3 local checks** closes those shapes so the model can be tested. This is a proposed contract, not a claim that the workbook already specified every leaf type.

1. All nested objects reject unknown properties. Result field names and nesting are compiled from `qa_output_contract_v2`. Explicit enum annotations are retained. Untyped leaves allow only scalar JSON values; untyped list items allow scalar values or a closed labelled evidence note. Unknown structured objects may be null. Full renderer typing for all 20 primitives remains a separate gate.
2. Ambiguous contract annotations block the affected objective before a paid call. `GOAL_001` declares an enum without values. `GOAL_004` attaches shared item properties after its array groups; a reviewed schema mapping is required. No silent best-guess schema is used for their official execution.
3. Test expectations mention ABSTAIN, while the canonical statuses do not. A no-action COMPLETE with no questions, no score and only a summary closes an irrelevant objective without manufacturing a result. The semantic evaluator verifies whether this exit is appropriate. Do not add an unapproved status.
4. The workbook has no closed backend tool or navigation catalogue. Only two nonexecuting intents are permitted here: `RESEARCH/research_required` and `CONTINUE_CHAT/continue_chat`. Other action types remain in the canonical enum but are rejected until named targets are approved. No API, profile write or navigation is executed.
5. Confirmation fields can only echo explicitly supplied `confirmed_facts`. Free-text claims remain in the exact input for interpretation; they are not silently promoted into persisted profile facts. A future extraction/confirmation layer needs its own tests.
6. Readiness policy is prose. Explicitly disabled cases are applied in code and nuanced semantics are reviewed separately. A ban on career-fit/scam probability is not a ban on a separately defined evidence-completeness score; this distinction corrected false positives in the first validators. Scores must have dimensions; disabled scores are null. The next contract revision should replace prose permission detection with reviewed per-objective typed permissions, named dimensions and rules.
7. Max interactions is cumulative application state, not a model-reported counter. Unit tests cover over-cap requests and state advancement. Prepared single-turn cases do not prove a browser session or every multi-turn flow.
8. Missing test fixtures are tracked separately. Descriptions such as “profile contains two confirmed signals” are not those signals. Without an actual prior result, current source or conflict, a context-reuse/stop expectation cannot receive an official acceptance pass.

## Results and retries

Raw requests, responses, parsed JSON, timestamps, source hashes, usage, evaluator output and every attempt are written with exclusive file creation into a unique run directory. No raw run is overwritten. An API timeout/429/5xx or malformed JSON is retried once with the identical request. A schema or semantic failure is not auto-repaired or hidden by a revised prompt. Auth/model/schema request errors stop the batch. All selected and actually executed counts remain visible.

Hard failures, semantic failures, fixture gaps, unassessable results and transport errors remain distinct. First-attempt performance is reported separately from final output. All objectives remain `NOT_PRODUCTION_VALIDATED` in Phase A. A passing schema or a single successful test cannot change that status.

## Next integration gates

1. Resolve and version the missing fixtures and ambiguous contracts; verify actual typed payloads for every primitive.
2. Finish smoke diagnosis, then execute the complete prepared suite without prompt edits mid-objective. Preserve all failures.
3. Patch only reproduced problems, rerun every case for affected objectives and all affected global regressions. Human-review decision-critical outcomes and same-model evaluator disagreements.
4. Validate objective **selection** separately using compact metadata; do not load the 316 prompts into BGE/Gemini as one instruction.
5. Add a planner endpoint separate from the quiz request assembler. Check objective/session ownership and use a version-pinned approved registry.
6. Add a workspace state machine storing confirmed/temporary answers, inference, unknowns, source refs, interaction count and lifecycle. Keep UI click history out of Oala. Resume/cancel/change objective must be explicit and isolated.
7. Integrate 20 typed reusable React primitives with keyboard/mobile/resize/streaming/error tests. Validate the complete plan before rendering; do not stream partially parsed actions.
8. Supply approved read/research adapters and freshness/source policies; missing integrations return NEEDS_RESEARCH. External writes require application authorization and explicit user action.
9. On completion pass a compact semantic handoff to Oala, preserving source status and unknowns. Log objective/prompt/schema/model versions, latency, abstention, questions, completion and failures without unnecessary private data.

Workbook results must be applied by test ID and objective ID, preserving original and V2 prompts, existing sheets, static QA and historical run files. Newly added run notes must distinguish partial smoke execution from the full 3,140-case acceptance suite.

## Smoke execution record

- Initial one-objective pilot: 8 prepared cases.
- v0.1 broad run: 47 of 108 selected cases completed before the first API schema rejection. Empty entity search and editable matrices were incorrectly rejected by the initial harness, and repeated domain data in the handoff made a nested schema fail at the API. These were harness defects, not objective prompt defects.
- v0.2 broad run: all 96 prepared cases completed, plus 5 supplemental cases before a supplied-context schema rejection stopped scheduling. Untyped `const` representations were replaced by typed singleton enums for the Gemini schema subset. Exact values are still checked with the original JSON Schema `const` locally.
- v0.2.1 supplemental run: all 12 concrete cases completed. A large repeated summary was caught by semantic QA; local v0.2.2 also bounds planner summaries to 2,000 characters. Detail belongs in structured result fields.
- Combined report: 96 prepared + 12 supplemental, each with its original run ID. The 96 prepared request schemas and system instructions were checked for exact equivalence after the API compatibility patch. All archived responses were revalidated with v0.2.2, retaining original verdicts and failures alongside corrected ones. This is not a claim that every case was generated under a single configuration.
- v0.2.3 checks also resolve nested source references and ensure handoff buttons bind to declared actions. Actual confirmed input IDs are valid inference references but cannot become external current sources. These checks found additional integration defects in the same saved outputs; no extra model calls or altered V2 prompts were used for revalidation. The earlier v0.2.2 derived report is retained alongside the raw runs.
- Outcome: 98/108 hard checks pass; 49 case passes, 46 fixture-blocked, 3 needing review and 10 failures. All 316 objectives remain NOT_PRODUCTION_VALIDATED. There are 61 passing local harness checks.
- Additional Codex inspection found that SUP-05 changed an unspecified workplace assessment into a claim that no assessment exists. The automated evaluator missed this. It is documented in `additional-review-notes.json`; this already-failing case needs source-entailment regression, not just schema repair.

The final workbook update touches QA result fields for ten objectives, their 96 prepared test rows and two summary metrics/notes. Twelve supplemental cases stay in the separate report; they are not inserted into or counted as the prepared 3,140. All ten sheets, original/V2 prompt text, merges, panes and existing filters are preserved. The artifact exporter normalises empty cells to empty strings in some locations; the workbook has no formulas and no nonempty values outside the authorised update were changed. Native filters omitted during export were restored from the original unchanged definitions.

The workbook and matching CSV were written back to the original Dropbox locations with original byte-for-byte copies in `backups/316-before-gemini-smoke-2026-09-18`. `writeback.py` refuses to overwrite unrelated concurrent edits. QA columns combine hard checks with evaluator verdicts; a failed source or table check cannot be hidden behind a semantic PASS. Raw responses and V2 prompt versions remain unchanged.

`triage.mjs` exports per-failure next fixes, all preflight fixture-review rows, the two ambiguous output contracts and the separately recorded evidence concern. The full-run gate is currently closed. This is a checkpoint for the initial ten-objective harness phase, not a completed 316-objective migration.
