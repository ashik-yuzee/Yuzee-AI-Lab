# Connected course workspace — Phase 2

## Scope and decision

The owner approved the warehouse as the course data source and instructed us to proceed without re-auditing course validity. This connection uses those records directly, including drafts. There is no publication or verification gate on this local catalogue connection. Tests concern software behavior, field mapping, retrieval, persistence and presentation; they do not audit the truth of the courses.

The connection covers courses and the provider information attached to those courses. Job/company feeds, a global institution search, external applications and reusable profile writes are not enabled by this change. BGE continues to retrieve activity candidates among the 316 objectives; it has not been retrained, and this release does not claim a new 316-objective routing accuracy.

## What is implemented

1. A server-owned course retrieval service reads the existing SQLite warehouse in read-only mode. A compact local full-text index contains course IDs, names, provider names and codes. It avoids the slow dashboard list endpoint and runs outside the chat event loop.
2. A small Gemini request resolves the current course lookup using the latest message and bounded conversation context. It can decline lookup, resolve short follow-ups, use saved course IDs, or request up to three separate search phrases. Names and qualification codes are searched as identifiers rather than embedding the entire conversation.
3. Up to four matching records are loaded by exact ID and normalized into a bounded course data pack. Short qualification tokens such as II and III are exact matches. Provider terms are retained; the lookup does not silently drop an unmatched provider to produce a misleading result.
4. The main chat receives the course pack, and its explanation reviewer receives the same data. The selected objective also receives retrieved course information and evidence references, alongside its own prompt and existing saved user context.
5. The right-side workspace shows an aligned course comparison, expandable learning/outcome/quality details, and controls to select up to three courses to explore or compare. The typography follows the current application and uses restrained purple accents.
6. Selecting courses persists a scoped user choice before generating an updated result. Failed generation keeps that choice for retry. Reloaded activities retain the selection and course data. Focusing one course keeps earlier alternatives available within the same activity; switching to an unrelated course topic replaces the set. The next chat turn receives the saved choice without a send-to-chat step.
7. For a clear course comparison, actual returned alternatives plus a high-confidence, required-workspace selector decision can open the shortlisted `STUDY_004` activity even when BGE similarity is below the generic threshold. Existing active-workspace, no-workspace, no-activity and current-turn protections remain. Other objectives retain the generic similarity gate.

## Prompt changes

Version **1.9** is the active standalone prompt. Versions 1.7 and 1.8 remain available. Protocol v1.3 and all 316 source objective prompts remain in place. The objective transport is now v0.2.4: source-bearing result objects receive an `evidence_refs` field when the workbook DSL declares `source_status` without a place for references. This resolves the previously impossible course-comparison validation contract; unknown or invented references still fail.

The prompt now describes the available course catalogue capability rather than saying warehouse retrieval is disconnected. It tells Gemini to use returned records without requesting a fresh audit, preserve provider/course distinctions, explain existing quality scores, and use the workspace for detailed comparisons. Runtime instructions still distinguish unavailable data from an actual returned result.

Stored course quality/readiness scores describe the course and its intended outcome. They are not the learner's confidence, personal suitability, admission eligibility or probability of employment. Clicking/selecting does not add confidence points. Existing user confidence can be reconsidered from what the user says, not from the existence of a course score.

Empty fee, intake or other fields remain “not supplied”; zero stays zero. Missing data is not turned into a new fact. The raw warehouse field named `aqf_level` may contain another classification code, so the normalized AQF label uses the explicit 1–10 framework level from the intelligence record when present. This is field mapping, not a new data validation exercise.

## Implementation boundaries

| Layer | Implementation |
|---|---|
| Source | `~/.yuzee-monitor/training_gov.db`, read-only; override with `YUZEE_WAREHOUSE_DB` |
| Derived search index | `data/warehouse/catalogue.sqlite`; rebuildable and ignored by Git |
| Worker | `src/warehouse/catalogue-worker.cjs`; copied into `dist/` by the build |
| Retrieval and normalization | `src/warehouse/service.ts`, `normalize.ts`, `types.ts` |
| Workspace presentation | `src/warehouse/WarehouseCourses.tsx` and `warehouse.css` |
| Objective integration | `src/objectives/service.ts`, `ObjectiveContext.tsx`, `ObjectiveWorkspace.tsx` |
| Main chat integration | `server.ts`; same evidence supplied to generation and explanation review |
| Prompt module | `src/prompts/warehouse-data.md`; assembled into v1.9 |
| Connection status | Authenticated `GET /api/warehouse/status` |

The catalogue index is checked against the source file fingerprint at worker startup and rebuilt when it differs. Exact-ID record reads come from the warehouse itself. If new course names or records are imported while the process is running, restart the chat to rebuild the index. The local database must be mounted/configured on another deployment; the database path or a development authentication bypass must not be exposed to the browser.

Search is full-text retrieval with Gemini query planning, not a vector index of every course. This is a working first connection, not the full planned multi-domain RAG platform. Course quality data and user answers remain separate. No raw database execution, private user/contact records or warehouse writes are passed to the model.

## Functional tests

The regression suite covers zero/missing values, unsafe source links, quality score presentation, qualification-level mapping, short follow-ups and no-search requests, exact II/III matching, provider specificity, multi-query coverage, source-file immutability, topic changes, invalid model query responses, cancellation, saved selections after a failed response, retry, reload, cross-workspace course-ID rejection, and explicit course-comparison opening.

A fictional live conversation confirmed catalogue-backed chat, automatic opening of the correct course-comparison objective, a populated comparison, expandable quality indicators, a saved course choice, reload/reopen persistence, and a chat follow-up that correctly identified the selected Box Hill course without the user repeating its name. A later right-side correction focused the result on that single course and completed on its first model attempt. The test found and fixed the missing source-reference field, exact II/III matching, and the course-comparison opening threshold interaction. Saved selections and failure/retry/reload behavior also have regression coverage. A passing integration test is not a new claim of 100% model accuracy or user satisfaction.

## How to try it

In the main chat, enable the existing **316 activities** preview and ask:

> Compare Certificate II in Plumbing at Box Hill Institute and Swinburne University of Technology. Explain what I would learn and the course quality.

Use the course controls on the right to choose what to explore. Expand “Learning, outcomes and quality” to inspect the stored indicators and their explanations. Then send a follow-up in chat. The choice should be carried across without copying or submitting the result again.

The next expansion is broader typed retrieval for institutions, jobs and companies, followed by semantic retrieval evaluation on unseen course requests. The current connection must not be described as those additional feeds already being live.

## Deployment notes

The running Node chat uses prompt v1.9. A matching prompt copy is included in the Spring resources, but the new retrieval service is connected to the Node runtime only; Spring requires an equivalent adapter before claiming the same warehouse connection.

The standalone v1.9 prompt is also saved in the original Dropbox Final folder as `1-Quiz-AI-v1.9 counsellor & Training.md`. Older prompt files were preserved.

## Completion results — 19 September 2026

- Warehouse regression tests: **7/7 passed**.
- Objective regression tests: **52/52 passed**.
- Shared-context regression tests: **9/9 passed**.
- Prompt/cache checks and production build: **passed**. Existing bundle-size warnings remain.
- Three live workspace revisions completed. The first two required the existing single formatting-repair retry; the final refinement passed on its first attempt after adding an explicit table example. This is functional acceptance, not a statistically measured routing or satisfaction score.
- Browser inspection covered the narrow panel, expanded view, selectable course row, purple quality indicators, saved state and reopening the activity.
- Course data was read from the approved warehouse; the source records were not modified or re-audited.

Machine-readable acceptance results: `output/phase2/acceptance-results.json`. The final normalized pair and workspace plan are in `output/phase2/course-search-final.json` and `output/phase2/live-workspace-final.json`. Earlier development search output in this folder is historical, not the final acceptance dataset.
