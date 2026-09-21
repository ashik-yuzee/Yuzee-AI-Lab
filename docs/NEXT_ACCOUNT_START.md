# Continue Yuzee from this handover

Read `START_HERE.md` at the package root and `project/Yuzee-AI-Lab/output/prompt-pack-40/2026-09-20/RESULTS.md` before editing. Work from the included source snapshot, including its uncommitted changes. Do not apply WORKING_TREE.patch on top of it.

We are building Oala as a natural career/education counsellor, with an interactive right workspace, saved answers, BGE activity retrieval, 316 bounded Gemini objectives and warehouse-backed course/provider/skill/job/local guidance. The left side should guide the person; the right side should help them explore and compare. Avoid a statistics dump, repetitive forms, internal metadata and excessive boxes. Explicit requests should receive useful results without optional questions blocking them.

Current Node prompt is v1.11, generated from preserved v1.7 and source snippets. Response protocol is v1.3. BGE-small-en-v1.5 is the single runtime embedding model; Gemini writes/selects/plans. Similarity is not a probability of suitability. The warehouse is a separate read-only SQLite source; restore its path and this account's private API configuration before claiming live warehouse integration.

The 40-scenario pack finished: 141 executions, 261 baseline turns, plus 9 supplemental chat turns. Reviewed labels: 82 pass, 28 fail, 31 not fully tested. Build and 85 deterministic regressions passed. These are not release certification or customer satisfaction metrics.

Prioritize: (1) invalid verification_required arrays dropping structured replies; (2) supplied profile constraints ignored in T39; (3) chat corrections leaving the saved workspace stale in T28; (4) partial skill claims promoted into full prerequisites; (5) unknown evidence turned into exclusions. Preserve actual traces and keep adapter/test failures separate from product failures. The initial duplicate-evidence routing failure came from the test adapter and was corrected; all 14 selected workspaces started in the corrected routing run.

The real right-panel save test succeeded at persistence and context transfer in three runs; two chat replies rendered correctly and one failed schema validation. Full browser ordering, course replacement and multi-tenant tests remain incomplete. The 3,140 workbook cases are a separate suite, not completed by this 40-case run.

Do not erase evidence, reset the working tree, change the schema merely to hide bad output, enable external applications/profile writes implicitly, or claim the model is fully reliable. Fix reproduced failures, rerun affected scenarios, then use independently authored holdouts and human product/counselling review. Ask the user for priorities if needed; the handover itself is not blanket authorization for paid calls or production deployment in a new account.
