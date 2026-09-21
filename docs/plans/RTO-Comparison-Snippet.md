# RTO comparisons using Yuzee course intelligence

19 September 2026 · Local Node preview · Quiz prompt v1.11

## What changed

The reusable `rto_course_comparison` snippet now connects the existing Course Comparison activity (STUDY_004) to provider-scoped warehouse retrieval. The same instruction is used by the main conversation, workspace execution and generated standalone quiz prompt. The 316-objective workbook execution contracts remain unchanged; selection examples were expanded for same-qualification RTO comparisons.

This addresses a real distinction in the supplied data: national qualification content often overlaps substantially, while useful decisions concern the recorded learning experience, provider support and the learner's needs. Yuzee-created intelligence is used directly. Sparse provider websites do not block an informative comparison or trigger an unnecessary website research step.

## What the user sees

1. A concise explanation of the shared qualification and main recorded differences.
2. A single provider comparison table, with course choices in its headers and a “Why it matters” disclosure for each criterion.
3. Shared and missing information collapsed by default, plus an option to show the full comparison.
4. Expandable national qualification units, with elective options distinguished from provider-delivered electives.
5. Detailed course learning, progression, strengths, limitations and Yuzee quality analysis still available below.

The workspace avoids repeating the model-generated comparison table and the basic course table. Selecting courses retains the existing save/recall flow. The title uses the qualification code when available and changes to the selected provider when exploring one course.

Selecting one course retrieves that exact saved course and changes the current model task to explaining its learning, practical work, quality analysis and progression. The earlier alternatives remain available in the workspace, but are not mixed into the current model retrieval. This prevents a broad construction query or the original comparison instruction from overriding the learner's latest choice.

## How the snippet retrieves and interprets data

| Layer | Data | How it is used |
|---|---|---|
| Shared qualification | National code, qualification units, core/elective labels | Explain the common baseline once. An elective pool is not a provider's chosen delivery plan. |
| Course record | Duration, delivery, locations, fees | Compare recorded conditions while preserving unknowns and course scope. |
| Provider record | Legal name, RTO code, provider type, base, recorded support | Resolve the requested institution and explain relevant support. General locations do not establish course delivery. |
| Yuzee intelligence | Attendance, practical experience, assessment, RPL/credit, suitability, progression, limitations and quality rationale | Explain learning and trade-offs, attributing analysis appropriately. |
| User context | Existing goals, location, constraints and saved course choices | Explain the practical implications without requiring another questionnaire. |

The application owns SQL, provider IDs, reference IDs and the comparison rows. Gemini plans bounded lookup phrases and explains the records. BGE helps shortlist the existing activity. No model weights were changed.

Named providers are kept separate in the query plan. A provider-only comparison does not fetch arbitrary courses. When a course is named, results are filtered to the resolved institution ID. Duplicate legal names remain ambiguous unless exactly one record offers the requested course; this resolves the tested ATEC duplicate registration without merging different registrations. A missing requested provider/course is not replaced by another provider.

Scores and wording differences do not establish a superior RTO. A qualification-wide weakness is not a unique provider weakness. Missing fees do not mean free. Similar records can justify an honest “no material difference established” result, followed by a useful explanation of which delivery or support preference would matter.

## Validation

- 22 warehouse checks and 52 objective checks passed; production build passed.
- Fixture cases cover identical course analysis, different qualifications, real zero versus missing fees, provider identity, duplicate names, ambiguity, national electives, private-field exclusion and read-only source access.
- Live source comparison returned the requested CPC20120 offerings at ATEC and Skill Hire WA, with 21 national unit records. These are national content records, not a claim that either provider delivers all 21 units.
- Live Gemini lookup retained both named providers. Objective execution produced valid COMPLETE output with no compulsory follow-up question and no chosen winner.
- Main-chat browser test automatically opened the Course Comparison activity and displayed the connected comparison. BGE shortlisted the correct existing activity at rank 2; the Gemini selector chose it.
- Browser acceptance tested course selection, saved state and switching between the two providers. The final output focused on Skill Hire's exact CPC20120 course; both original alternatives remained available, with no unrelated construction qualifications added. The focused response passed the objective validator. The table was visually checked with both provider columns visible.

Saved fictional test evidence: `output/rto-comparison`. Reproducible runner: `scripts/test-rto-comparison.ts --live` (uses API credits).

## Boundaries

These are focused development tests, not measured user satisfaction or proof of all-provider routing accuracy. Name aliases may still need expansion; unresolved names remain visible. The comparison groups identical text deterministically, not by claiming that differently worded analysis establishes a difference. Generated interpretations still require semantic QA, particularly around inferred delivery, funding eligibility and outcome claims. Existing browser BGE cold-start latency and large build bundles remain.

The source warehouse is unchanged. The local index was extended with institution IDs for scoped retrieval. This is implemented in the Node preview; matching prompt content alone does not provide Spring backend retrieval parity.
