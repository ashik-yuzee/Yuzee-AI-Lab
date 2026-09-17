# Quiz prompt v1.7 update

Updated 18 September 2026. The app now uses the supplied `1-Quiz-AI-v1.7 finalL counsellor & Training.md` as its default quiz instruction. This is a prompt update; the response protocol remains v1.3.

## Source and active configuration

- Active source: `src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.7.md`.
- Shared Node/frontend identity: `src/prompts/quizPrompt.ts`.
- Spring resource: `spring-backend/src/main/resources/yuzee/prompts/Yuzee_Quiz_Counsellor_Training_v1.7.md`.
- Supplied source SHA-256: `dae1a51322233fdf030558643a31bf0ff81cda54d3ed0eb6abff50b307a38890`.
- Effective Node instruction SHA-256: `1bea75a39a4d7c25bf85935e0e4054556334116fc2ddb9c3bbaf1dcba05bb33b`. This includes the existing clear-guidance and learning-depth application rules, so it deliberately differs from the source hash.
- The supplied source and the Spring copy are byte-identical. The Dropbox original was not changed.

The prior prompt is retained as `Yuzee_Main_Prompt_Gemini_JSON_ONLY_FINAL_v0.12.md` for reference/rollback. Its filename was historical; the preceding runtime identified it as v1.6. The active loader no longer uses it. Version labels in the lab, protocol metadata, token breakdown and cache display name now identify v1.7. Explicit custom prompt overrides still work.

## Behaviour introduced by the supplied prompt

- Human counselling explanations and open-text discovery questions, rather than automatically turning explanatory categories into selection menus.
- Location, provider, residency and intake questions only when relevant to the current decision or requested service.
- Substantive guidance during exploration, with limits on repeated questioning.
- Internal understanding/confidence checks and scoped readiness decisions; internal-only fields are not added to the response JSON.
- More explicit separation between broad guidance, verified provider details and service readiness.

The supplied prompt replaced the previous source in full. Removed modules were not silently reintroduced. Existing application presentation rules, the 103 skill instructions, BGE routing, needs checks, service guards and pathway controls remain in place.

## Validation

Passed:

- `npm run test:quiz-prompt`: exact source copies; correct backend paths and version; one system instruction; all 103 scoped skill insertions; unchanged nine-key JSON envelope; explicit custom overrides; deterministic reload; rejection/replacement of a cache with the previous prompt hash.
- Oala catalogue and routing tests, counselling style, learning depth, teaching review, turn-needs scenarios, skill input contracts, BGE release integration and protocol v1.3 schema tests.
- `npm run build`, including the pinned BGE model contract and TypeScript checks. Existing bundle-size/import-splitting warnings remain.
- Three real Gemini turns through the local main-chat message endpoint: early undecided learner exploration, a follow-up about enjoying computer troubleshooting, and a course-quality explanation with an illustrative comparison. All three responses passed schema and semantic validation with no warnings, no premature intake fields and no unsolicited service execution. The first two used text questions; the completed course-quality answer did not require a question.
- Runtime metadata confirms v1.7 and default prompt mode. The server was restarted on port 3000.

Live evidence: `output/quiz-v1.7/live-check.json`. The synthetic conversation is titled “Quiz v1.7 verification (synthetic)”. These three cases are a smoke test, not exhaustive proof of every counselling scenario.

Spring's resource and registry references were checked, but the Java backend was not built or run because Maven was unavailable in this environment.

## Relationship to the BGE audit

All 27 existing routing/worker/MicroToolRouter files covered by the frozen v2 manifest retain their hashes. No embedding model, routing profile, threshold or skill catalogue changed in this update. The earlier BGE audit records remain historical and were not rewritten; their full application-source snapshot naturally predates this authorised quiz-prompt update.

## Use and rollback

Refresh the local app to see the v1.7 lab label. Future default-mode turns use v1.7, including turns in existing conversations. Previously generated answers remain unchanged. A fresh conversation is useful for evaluating the new counselling style without earlier responses influencing it.

For rollback, restore the previous prompt path and version in the shared quiz identity and Spring registry, then restart the relevant backend. Changing the effective prompt hash invalidates the old Node prompt cache. Do not roll back unrelated BGE, skill or pathway changes.
