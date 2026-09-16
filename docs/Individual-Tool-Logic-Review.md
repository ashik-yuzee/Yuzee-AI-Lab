# Individual review of all 103 user-facing tools

> Current amendment: see [Counselling-Clarity-Update.md](Counselling-Clarity-Update.md). Fixed section counts and never-compress rules described in earlier work are superseded by flexible, task-appropriate teaching. All 103 snippets use the updated counselling guidance.


Date: 16 September 2026. Scope: 105 registry entries, excluding internal `CORE_001` and `CORE_002`.

Previously, all user-facing tools received shared teaching-depth guidance. That was not the same as reviewing each original short task prompt. This change individually reviews and replaces all 103 user-facing `mini_prompt` values. It leaves the master prompt and short MiniLM index descriptions in place.

## What each review contains

Each ID has separately authored: a concrete weakness, decision method, missing-data behaviour, boundary against neighbouring tools, output priorities and a teaching situation. Original required/optional inputs, data dependencies and information requirements are retained. The previous runtime snippet is preserved alongside the replacement in the review JSON and HTML.

The review distinguishes missing evidence from negative evidence; self-report from demonstrated capability; topic relevance from eligibility; company hiring from internal skill deficiency; postings from actual hires; and course completion from assessed competence. These distinctions are task-specific, not just a shared request to make answers longer.

## Runtime integration

`src/routing/microtools.json` contains the revised snippets. The existing `scopedInstruction` function selects one server-owned snippet and appends the shared depth contract for that task. References to other IDs explain scope; they do not execute a tool chain. MiniLM receives the short `indexText` description, not the expanded snippet. The browser selection remains advisory and requires an explicit current `@Oala` invocation; corrections, stop, structured answers and ambiguous routing retain their existing fallback behaviour.

`INST_004` now uses the skill-map depth profile instead of the generic course profile. The contract generator includes that override so regeneration preserves it.

The content review also gained corrections identified in live answers: duplicate advertisements cannot prove their cause; formal assessment is not the only possible evidence of performance; unspecified course completion criteria cannot imply attendance or assessment; missing placement rules are questions to check rather than universal requirements; and unlike pay data must not be normalised using invented hours, legal classifications or entitlements.

## Authoring and regeneration

- `docs/plans/microtool-individual-reviews.txt`: individually authored source, one ID per row, seven pipe-delimited fields.
- `scripts/build-tool-reviews.py`: builds runtime snippets, review JSON, updated planning records and the searchable HTML report. It preserves the original before-prompt across repeated runs.
- `docs/plans/microtool-individual-review.json`: complete review and before/after audit.
- `output/html/Yuzee-103-Tool-Logic-Review.html`: user-facing searchable report.
- `output/html/Yuzee-Tool-Review-Validation.html`: recorded response checks and limits.

Run `python3 scripts/build-tool-reviews.py` after editing the individual review source. Run `node tmp/reports/create-trigger-report.mjs` to refresh the older wider report. Restart the local server to load new snippets or reviewer instructions. Run `npm run test:tool-reviews` to check integration, inventory, boundaries and report coverage. Refresh the validation gallery only from actual recorded results.

## Validation boundaries

All 103 IDs are checked for unique individually written reasoning, exact registry coverage, changed runtime snippets, inclusion in provider request assembly, unchanged separation from embedding text, ignored caller-supplied instructions, and invocation/stop/internal-tool boundaries. These are structural integration checks; they do not prove 103 correct model answers or semantic routing precision.

Ten synthetic live scenarios exercise course units, entry, cost, duplicate advertisements, curriculum evidence, readiness, beginner skill teaching, pay comparability, skill learning and placement matching. The controlled test supplies an allowlisted route selection; it does not test MiniLM's ranking. Original results and retests are retained separately in the workspace outputs folder. Six affected scenarios are retested after strengthening evidence rules. The validation gallery records outcomes and outstanding editorial limitations.

## Still required for release

Each data-dependent tool needs appropriate source retrieval with provenance, freshness, coverage and entity resolution. Retrieval gaps are documented per ID; this update does not connect those data sources. Full release evaluation still needs real routing paraphrases and nearest-neighbour negatives for every tool, source-backed content checks, multi-turn corrections, refusals/closure, long-output limits, and representative reader testing. Do not label all 103 production-ready on the basis of this review. The earlier 1,260+ planned cases have not been run.
