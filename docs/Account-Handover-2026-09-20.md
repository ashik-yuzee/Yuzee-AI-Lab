# Yuzee account handover

Prepared 20 September 2026 for the next account and engineer continuing this project.

This package captures the current working application, including uncommitted changes, prompts, BGE configuration, 316 objectives, warehouse adapters, UI work, test harnesses and saved evaluation evidence. Start with this document. Older reports describe earlier stages and sometimes say an integration is not implemented even though it now exists. The current source and the dated findings below take precedence.

**Current decision: continue development; do not call the system production validated.** The complete new 40-scenario baseline has run. It exposed missing structured replies, ignored user constraints and stale workspace results. The application builds, and 85 objective, shared-context and warehouse regression tests pass, but those checks do not erase the live failures.

## What the product must do

Oala should feel like a helpful career and education counsellor. Start with the person's immediate need, give a useful explanation and guide one sensible next step. Use local evidence to explain practical options. Do not turn a conversation such as “I'm from Horsham and unsure what to do” into a town description or a long statistics report.

The left side carries the conversation. The right side contains useful interactive activities, comparisons and pathways. Give a comparison immediately when enough information exists; optional personalisation must not block it. Ask necessary activity questions on the right, save answers and make them available to later conversation without a forced “send result to chat” message. Preserve answers and previous activities for retrieval and switching.

Use restrained purple accents, meaningful icons, clear spacing and genuine lists or comparison tables. Avoid excessive nested boxes, repeated numbering, internal enums, repeated known facts and visible evidence-debug labels. Keep “Details I’m using” collapsed and editable. The user wants progress and shimmer while a workspace is being prepared, a resizable drawer, clear saved-answer states and useful explanations rather than a generic questionnaire.

## What is currently implemented

| Area | Current state and limit |
|---|---|
| Main conversation | React/Vite client and Node/Express server; structured Gemini responses and streaming; prompt v1.11, response protocol v1.3. |
| Counselling prompt | Preserved v1.7 baseline; generated v1.11 adds connected context, activity context, evidence rules, comparison/local guidance and skills links. It still needs fixes identified in the new tests. |
| BGE | One runtime embedding model, BGE small English v1.5, q8, CLS pooling, normalized embeddings, 512-token budget. It retrieves candidates; it does not write counselling answers or independently decide consent. |
| Activities | 316 selection records and workbook-derived execution prompts. Gemini selects from BGE candidates, and application rules decide automatic opening, suggestion or none. Two ambiguous workbook contracts remain blocked: GOAL_001 and GOAL_004. |
| Right workspace | Reusable primitive renderer, saved sessions, questions/answers, corrections, course focus, saved role and skill exploration, automatic opening under policy and manual browsing for testing. |
| Shared context | Conversation-scoped user statements and saved workspace answers/corrections. Latest corrections are available to subsequent generation. Automatic refresh of already displayed workspace results after chat correction is still incomplete. |
| Warehouse | Bounded read-only SQLite-backed retrieval and derived index. Course/provider intelligence, qualifications, institutions, occupations, skills, industries and dated local/job evidence are connected through allowlisted projections. This is not an unrestricted vector RAG index of every warehouse record. |
| Scores | Similarity, evidence completeness, readiness and user confidence have distinct meanings. BGE similarity is not a calibrated probability of correct routing, suitability or getting hired. |
| External actions | The presence of an intent/action label is not proof of a connected application, enrolment or external-profile write. Objective actions remain bounded; no such external action was enabled during this handover. |
| Spring backend | Prompt resource is kept in sync, but Node warehouse/workspace integration must not be assumed implemented in Spring. |

## Current architecture

User message → main request assembly and scoped context → bounded warehouse retrieval when relevant → Gemini counselling response → schema and semantic validation → left-side rendering.

Current user intent and the response's compact activity context → BGE candidate retrieval → Gemini selector → application opening policy → one objective prompt plus global rules, relevant user context and evidence → strict JSON plan → deterministic validation → right workspace.

User workspace input → authenticated conversation-scoped save → revised workspace plan → shared context available to the next ordinary chat turn. Saved history remains separate from current facts. The current implementation does not yet reliably invalidate every older display when facts change.

Never send all 316 execution prompts or an entire warehouse to Gemini. Retrieve the small set needed for the current task. Provider text is data, not authority to change instructions, choose a promoted course or perform an external action.

## Source of truth and file map

All paths below are relative to `project/Yuzee-AI-Lab` in the ZIP.

| Responsibility | Main files |
|---|---|
| Server and API | `server.ts` |
| Request assembly | `src/services/YuzeeRequestAssembler.ts`, `src/services/SystemPromptCacheManager.ts` |
| Prompt baseline | `src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.7.md` |
| Current prompt | `src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md` |
| Prompt generation | `scripts/build-quiz-prompt.ts`, `src/prompts/`, warehouse comparison/local guidance snippets |
| Wire schema and validation | `src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json`, `src/protocol/validator.ts` |
| Chat presentation | `src/components/ProtocolV13Renderer.tsx`, `ProtocolInteraction.tsx`, `ChatArea.tsx`, `src/ux/` |
| Mini pathways | `src/miniPathway/`, `MiniPathwayExperience.tsx`, `PathwayHistorySelector.tsx` |
| BGE implementation | `src/routing/`, `src/workers/`, `src/services/MicroToolRouter.ts` |
| 316 objective source | `qa/objectives/source/Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx` |
| Compiled objective registry | `qa/objectives/registry/workbook.json`, `src/objectives/catalogue.json`, `selectionMetadata.json` |
| Objective routing and execution | `src/objectives/routing.ts`, `activityContext.ts`, `service.ts`, `workspacePolicy.ts` |
| Workspace UI and persistence | `src/objectives/ObjectiveContext.tsx`, `ObjectiveWorkspace.tsx`, `PrimitiveRenderer.tsx`, `history.ts` |
| Shared context | `src/orchestration/sharedContext.ts`, `workspacePresence.ts` |
| Warehouse | `src/warehouse/service.ts`, `catalogue-worker.cjs`, `normalize.ts`, `types.ts`, `linked-data.cjs`, `opportunities.cjs`, `provider-data.cjs` |
| 103 historical skills | `src/routing/microtools.json`, skill input/content contracts, `output/csv/` and associated scripts/reports |
| Current full test | `qa/prompt-pack-40/`, `scripts/prompt-pack-40/`, `output/prompt-pack-40/2026-09-20/` |

Edit prompt source snippets or the versioned generator, then regenerate and check both runtime resources. Do not edit only the generated v1.11 file. The workbook remains the objective specification; keep generated metadata and hashes synchronized. Existing tests deliberately prevent silent contract drift.

## Latest test results

The supplied 40 definitions were run three times, with additional conflict, commission, explicit-action and counterfactual variants. This produced **141 executions and 261 baseline chat turns**, plus **9 supplemental chat turns** using real application workspace events.

After the automated evaluator and limited assistant review: **82 PASS, 28 FAIL, 31 NOT FULLY TESTED**. These are evaluation labels, not a satisfaction rating. An independent product/counsellor and engineering human review is still needed. The same Gemini model family was used for execution and semantic judging; that limits independence.

Nine baseline turns did not produce an accepted structured reply: `rmo_readiness.verification_required` was an array where the schema requires a boolean. A further instance occurred in a supplemental panel follow-up. All 15 T39 counterfactual runs should be reviewed together: the supplied profile constraints reached the model but were repeatedly ignored. T05 repeatedly promoted partial Excel experience into confirmed course prerequisites.

The corrected routing check covered the final turn of each of 40 first-repetition cases: 26 NONE, 8 SUGGEST and 6 AUTO_OPEN. All 14 selected workspaces started. There is no independently labelled expected-tool set for this pack, so this is **not 100% BGE routing accuracy**, nor proof across all 316 objectives.

Three real T30 panel corrections saved revision 2 and passed the saved constraints into the next chat request. Two follow-ups rendered an appropriate constraint comparison; the third failed protocol validation. Three stale-revision edits and three foreign-conversation workspace edits were rejected. T28 confirmed an existing saved comparison did not refresh when the user corrected their skills in chat.

The initial routing attempt had a test-adapter evidence-ID bug. It was corrected and rerun without changing production code; use `integration/routing` for those results. Chat-only T30 baseline runs lacked the required panel event and must not be called model failures. Original traces, initial untrusted grades and review overrides are preserved so the next engineer can audit these distinctions.

Current `npm run build` passed, with bundle-size warnings. All 85 selected deterministic regression tests passed. Remaining full integration gaps include the client response-order race, a real replace-only-right-course action, stable whiteboard identity under swaps, real network timeout recovery and multi-tenant isolation. The separate 3,140-case workbook suite has not been completed or rerun as part of this pack.

Read `output/prompt-pack-40/2026-09-20/RESULTS.md` and `summary.json` before making changes. Browse `output/html/Yuzee-Prompt-Pack-40-Results.html` and the companion rendered-response report after starting the app. Historical milestone reports are in `docs/`, `output/` and `outputs/`.

## Priorities for the next account

1. Reproduce the boolean-versus-array response failure. Align the provider schema, generated prompt examples and output contract; ensure a rejected answer has a clear recoverable user state. Do not weaken validation to hide the defect.
2. Fix profile and workspace-context precedence. Use a clearly scoped structured input, preserve source and revision, and require constraint-based reasoning. Rerun T39 variants and the real T30 panel test; trace the exact model input.
3. Make changes to user facts invalidate or update affected saved comparisons and skill cards. Preserve historical answers while marking old conclusions stale. Test T28 and the controlled T32 client/server race.
4. Separate self-reported foundation, unknown ability, learning topics and mandatory prerequisites. Prevent unsupported eligibility claims. Rerun T05–T09, T17–T21 and T34.
5. Preserve evidence meaning through adapters: unknown versus absent, non-AQF versus accreditation, provider-specific versus national requirements, local versus regional signals, historical adverts versus available jobs. Investigate both normalization and prompt reasoning before blaming BGE.
6. Add reviewed routing labels for natural user journeys, including no-action, changed goal, negation, typos, long context and ambiguous follow-ups. Measure retrieval recall separately from final selection and usefulness. Keep a truly unseen holdout.
7. Finish interactive acceptance testing on narrow and wide screens, accessibility, course replacement, history retrieval and interrupted generation. Then run independent counselling/product review and user usability sessions.

## Restore on another account or computer

Extract the archive. Keep the `project/Yuzee-AI-Lab` folder structure. This is a working-tree snapshot; there is no Git history in the ZIP. `GIT_STATE.txt`, `WORKING_TREE.patch` and file hashes identify the source state. Use the source snapshot directly; do not apply the patch on top of it.

Use Node with the SQLite APIs required by the worker; this snapshot was built and tested with Node v26.0.0. Install dependencies from the included lockfile. The package does not contain node_modules or platform-specific runtime dependencies.

```sh
cd project/Yuzee-AI-Lab
npm ci
cp ../../CONFIGURATION.example.env .env
# Fill in this account's Gemini key and explicit admin/auth settings locally.
# Leave DATABASE_URL empty unless a new database is intentionally configured.
npm run build
npm start
```

Open `http://localhost:3000`. Configure `GEMINI_API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `AUTH_SECRET` privately. The source contains development defaults; never use them for a public deployment. `.env` is intentionally absent from the archive. A clean account needs its own API access and credits. Model availability must be checked against that account before live tests.

The pinned BGE cache is included for offline CPU evaluation: `data/minilm-cache/Xenova/bge-small-en-v1.5/ea104dacec62c0de699686887e3f920caeb4f3e3`. Browser model caches are separate and may download the same pinned artifact on first use. L6 and L12 caches are historical and omitted; their model IDs and revisions remain in source for reproduction.

For deterministic checks:

```sh
node --import tsx --test tests/objectives.test.tsx tests/phase1.test.tsx tests/warehouse*.test.tsx
npm run check:quiz-prompt
npm run check:bge-contract
npm run check:objectives
```

For a fresh paid 40-case run, archive the existing `output/prompt-pack-40/2026-09-20` directory first, recreate that empty directory, then run `node scripts/prompt-pack-40/prepare.mjs`. In separate terminals run the isolated server (`node scripts/prompt-pack-40/start.mjs`), target runner (`node --import tsx scripts/prompt-pack-40/run.ts --live`) and judge (`node --import tsx scripts/prompt-pack-40/judge.ts --live`). Preparation uses fictional data; it does not access the warehouse. Scripts resume and skip finished result files. Do not rerun blindly over the packaged evidence. The recorded initial baseline used the older adapter ID convention; new preparation includes its correction.

Routing and event checks use the additional `prepare-integration.mjs`, `routing.ts` and `integration.ts` scripts. Read their environment/port settings before running: the supplemental server uses port 3012 and a separate root. Stop only these isolated servers after use. Remove their temporary `runtime/src` symlinks before running the broad TypeScript build, which otherwise discovers the duplicated source tree. The packaging excludes those temporary runtimes.

## Warehouse and data transfer boundary

The chat's current warehouse connection reads the SQLite file configured by `YUZEE_WAREHOUSE_DB`, defaulting to `~/.yuzee-monitor/training_gov.db`. The derived search index is rebuilt in `data/warehouse`. The separate warehouse dashboard normally uses port 8090; the chat uses 3000. Do not run the old command that kills every process on port 3000.

The original separate warehouse project is at `/Users/freshfuturesaustralia/My Drive/06 Backend Development/yuzee-monitor/training-gov-db`. The user's historical RAG files are in the Google Drive `06 Backend Development/01 Databases/RAG` folder. These are external dependencies, not files inside the chat repository.

**The source warehouse database and separate dashboard project are not included.** Their contents include a broader data boundary than this chat handover. For a different computer, transfer an approved database snapshot through a private channel, preserve its access controls and set `YUZEE_WAREHOUSE_DB` to its new absolute path. For another account on this same computer, ensure the receiving process has read permission. The app can start without it, but warehouse-backed answers cannot be validated until it is connected.

The packaged test fixtures are fictional and are not a substitute for the warehouse. National training records, provider intelligence, occupational mappings and local observations have different scopes. Source facts, generated intelligence and user self-report must remain distinguishable. Do not equate national registration, a unit title or an enrichment timestamp with verified provider delivery, assessed user competence or current job availability.

## Package contents and omissions

Included: current source and uncommitted changes; all prompt versions and generation rules; 103-skill assets; 316 workbook/CSV/registry and selection metadata; schema/validators; UI and warehouse adapters; tests and scripts; evaluation outputs and historical documents; pinned BGE artifact; dependency lockfiles; handover guide; next-account continuation brief; per-file hashes and ZIP checksum.

Omitted: actual `.env` credentials, personal conversation and workspace stores, private runtime logs, source warehouse database, derived warehouse index, node_modules, build output, Git internal history, temporary audit servers, obsolete nested handover archives and historical L6/L12 model caches. See `PACKAGE-MANIFEST.json` for the exact inclusion/exclusion policy. Prior handover narrative documents are retained as historical references rather than duplicate source snapshots.

Importing this ZIP does not transfer ChatGPT/Codex account memory, app connections, credentials, permissions, API balances or browser caches. Give the next account `NEXT_ACCOUNT_START.md` and this guide first, then provide the project folder. No production release or external action is implied by this transfer.
