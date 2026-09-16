# Counselling clarity update

The supplied review requested deeper teaching at the point of confusion, not a longer audit report. This update changes all 103 user-facing snippets to a flexible counselling approach and adds individual refinements to the ten reviewed tools. The original master prompt remains unchanged.

## Changes

- The direct answer leads. Meaning, consequences, process, worked examples, application, limitations and practice are ingredients, not compulsory headings.
- `src/routing/counsellingStyle.json` is the shared policy for ordinary chat, selected-tool depth guidance and the content reviewer. Short checks and full lessons have different soft length targets; explicit short answers and narrow follow-ups take priority.
- Learning profiles are optional ingredients. Stand-alone skill lessons no longer require course-selection and course-completion sections.
- Costs use supplied amounts and named unknowns. No invented subsidy percentages or extra fees. Pay comparisons do not invent working hours or benefit assumptions.
- Plain source-relationship labels are text within the existing schema: Explicitly stated, Reasonably derived, Not enough information. These are not new status enums, proof of truth or independent verification. User reports remain attributed; calculations are derived from stated inputs.
- The final content reviewer may merge and shorten repetitive sections. The previous minimum-five-headings check is removed. Empty or malformed reviews remain rejected; interaction and service state cannot be edited by this step. The canonical response validator still checks the complete result. Semantic completeness cannot be certified by counting sections.
- The reviewer receives the approved selected task's server-owned guidance, so it can preserve its teaching requirements while correcting claims. Browser-supplied prompt text is never used.

## Ten specific refinements

1. Course units: consequences of errors and a three-row worked data example; inspect sources, record purpose and date conventions before deciding. Neither matching IDs nor different IDs alone settles identity or unwanted duplication.
2. Entry evidence: a shorter check, a plain definition of work sample, conceptual examples and provider-specific acceptance. Avoid repetitive tables and fictional admissions stories.
3. Course costs: quoted subtotal, unknowns and an exact next check; no invented funding scenarios.
4. Hard-to-fill roles: duplicate copies are not recruiting difficulty; evidence examples are not a universal definition.
5. Curriculum skills: ordinary names, explained inferences and required/elective distinctions without inferring individual competence.
6. Readiness: teach the difference between entering a record and checking it; a self-created exercise does not establish employer acceptance.
7. Prioritisation: five questions, worked choices, assumptions, possible alternative order and practice with a sample answer.
8. Pay: compare base rate, agreed hours and role scope; show a symbolic formula rather than invented contracts.
9. Clarification: a plain definition, clearly labelled weak versus better dialogue and practice followed by a sample answer. A bad refund promise may appear only as a mistake that is immediately corrected.
10. Placement: task fit, supervision, capacity, conditions and approval; shared reporting topics are only a potential connection.

## Verification and limits

New checks verify shared guidance reaches normal chat, all 103 selected tasks and the reviewer; ordinary evidence labels are valid schema text; concise rewrites preserve application state; and empty or state-changing reviews are rejected. Existing routing, teaching, output and token-budget checks remain applicable.

Two rounds of ten synthetic Gemini conversations plus two focused final rechecks are recorded separately in the workspace outputs folder. They test the existing main-chat endpoint using controlled tool selections, not MiniLM ranking or retrieved provider data. The first round exposed an overconfident duplicate-record example and a missing beginner definition; these informed the final review changes. Earlier response records remain preserved for comparison.

The HTML validation page shows actual recorded responses, previous wording and per-scenario observations. Do not infer that all 103 tasks are production-certified from ten scenarios. Source retrieval, wider routing/semantic evaluation and testing with intended readers remain necessary. Prompt instructions are guidance, not deterministic guarantees of word count or semantic completeness.

## Regeneration

After changing `learningProfiles.json` or `counsellingStyle.json`, run `python3 tmp/depth/build-guidance.py`. After changing individual reviews, run `python3 scripts/build-tool-reviews.py`. Restart the server after runtime/prompt changes. Build the current validation artifact with `tmp/depth/create-counselling-gallery.ts` only after the recorded final checks exist. The older gallery generator retains the historical examples.
