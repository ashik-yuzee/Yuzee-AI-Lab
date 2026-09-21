# Yuzee experience flow review

20 September 2026 · Local development review

## Decision

Continue controlled preview testing. The counselling flow has improved, but the evidence checks are not strong enough for a broad release. Valid JSON and a correct activity selection do not prove the advice is correct. The school-subject workspace is the clearest remaining blocker.

## What was actually tested

Two live passes used 14 fictional journeys and 19 chat turns per pass through the real Node chat API, Gemini 3.7 Flash, current prompt and warehouse integration. The full retest is the reported cohort. A separate targeted school retest followed the final workspace prompt change. No saved personal conversation was sent to Gemini. The warehouse database was read, not altered; this review checked interpretation, locality mapping and existing source conflict flags, not independent provider verification.

All 316 objective descriptions were indexed for BGE retrieval. Seven turns had predefined acceptable activity IDs. Selection was called on the latest turn of each journey; historical turns were retrieval-only because the app rejects stale selections. Three workspaces were started, and browser checks covered saved activity retrieval, an “I’m not sure” submission, desktop layout and a 390 × 844 viewport. This is a development suite, not comprehensive testing of all 316 activities.

## Measured results

19/19 retest chat responses passed the application response contract. BGE found a predefined acceptable activity in the top 20 for 7/7 labelled turns; only 3/7 had one ranked first. Of 14 latest-turn selection calls, all respected predefined allowed dispositions: five selected activities matched their target set, and nine returned no activity. One of those nine was a labelled discovery turn where abstaining was allowed. This is not a 100% routing accuracy claim.

All three workspace starts passed their structural contracts. School-subject advice failed semantic review. Chat request completion took 7.7–22.9 seconds, median 13.4 seconds, including retrieval and local response handling. These are completion times, not time-to-first-token; selector and workspace calls add latency. 79 focused automated regression tests passed and the application build passed. BGE ran the pinned q8 model on CPU in this harness; browser WASM startup/performance was not benchmarked here.

## Prompt and architecture review

The generated v1.11 prompt retains v1.7 as its migration baseline and appends connected-context, warehouse, activity, clarity and learning instructions. The baseline file was preserved. The assembled prompt is approximately 214 KB: additional rules are accumulating, and “more rules” is not a reliable fix for conflicting priorities.

Keep three responsibilities distinct: Oala provides the conversation; BGE retrieves plausible activities; Gemini selects or abstains and executes one bounded objective. The application owns persistence, evidence rules and permission to act. The right side is a useful working surface, not a second counsellor asking another intake question. A main-chat prompt improvement does not automatically repair the separate workbook objective prompt.

The school retest proves this distinction: its workspace still produced “prerequisite coverage” and claims that combinations preserve degree entry. Source labels such as GENERAL_GUIDANCE do not make those assertions safe or verified. Its readiness score also reflected the generated plan rather than demonstrated prerequisite evidence. This requires an objective-level evidence contract and deterministic checks, followed by repeated live tests.

## Changes made and checked

1. Corrected same-name geographic hierarchy resolution: Ballarat SA2 is selected when the other exact matches are its ancestors. Different places sharing a name remain ambiguous.
2. Added handling for explicit conflicts already recorded in course intelligence. Identity and source information remain available; contradictory course details are withheld from the comparison projection. The original warehouse records remain unchanged.
3. Collapsed optional careers/skills/local supporting material in non-local, non-comparison activities so it no longer buries the actual task.
4. Improved comparison column widths and keyboard focus visibility to avoid broken words in narrow panels.
5. Strengthened prompt guidance on duplicate-record evidence, school prerequisites, licensing and asking one question. The duplicate-record exercise improved. School prerequisites still failed the targeted retest, so that change is not considered a completed fix.
6. Added repeatable scenario and routing harnesses with raw outputs and predefined expectations. Saved answer receipts remained available after a browser reload. A subsequent live Oala reply correctly said that “not sure” did not confirm a subject choice or career stream, and respected the request not to open another activity. Historical responses are not rewritten by prompt updates.

## Recommended conversational experience

Begin with the person’s immediate uncertainty or decision. Give one useful explanation, observation or comparison, then ask one easy question only when it moves that decision forward. A person saying they live in Horsham does not need a geography introduction. Local evidence should enter when it helps them judge a realistic option.

For “I’m not sure”, lower the effort: use a recent everyday example, offer a small experiment, or allow a pause. For “compare these”, show the comparison immediately and make refinement optional. For “what jobs are here?”, provide scoped, dated evidence and explain what it means. For “I want to learn X”, teach or practise X without redirecting to a career questionnaire.

Automatically open the right side for a clear request with a useful ready result. Suggest it when the benefit is plausible but the user has not asked to begin. Show nothing for closure, tool opt-out or ordinary explanations. Preserve the ability to close and reopen; do not reopen a dismissed activity repeatedly.

Use brief prose and properly separated lists on the left. Use aligned comparison tables, short actionable options and clearly labelled editable answers on the right. Keep supporting data collapsed. Save changes visibly, retain the original question/answer receipt, and let Oala use the latest correction on the next relevant message without copying the full result into chat. Only one surface should own the current question.

These recommendations reflect conversational design judgment, not access to private ChatGPT satisfaction data. GOV.UK recommends asking one thing at a time and avoiding repeated information requests: https://design-system.service.gov.uk/patterns/question-pages/ . Microsoft’s human–AI guidance supports clear capability boundaries, contextual relevance and correction: https://www.microsoft.com/en-us/research/articles/how-to-build-effective-human-ai-interaction-considerations-for-machine-learning-and-software-engineering/ .

## Example of the intended Horsham opening

Illustrative copy, not a new claim about the model or local vacancies:

“We can work through that without choosing a career today. To start, think of something you have done recently—at home, school or work—that you did not mind doing. It might be fixing something, helping someone, or organising a task. Was there one small thing that felt satisfying?”

After the shelf example: “Working out how to fix it might be the useful clue. We can explore practical work without committing to a trade. Was it solving the problem, using the tools, or seeing the finished result that you liked?”

Only after that preference becomes clearer should the system connect suitable tasks to returned local roles, learning opportunities or low-commitment ways to try them.

## Release checks and next work

P0 — School evidence: change SCHOOL_001’s prerequisite fields so unsupported requirements remain unknown. Only accept verified prerequisite claims with a named course, source reference and applicable intake. Reject unsupported guarantees rather than relying on a disclaimer. Re-run initial, unsure, correction and completed-plan turns. Do not use its current output as verified enrolment guidance.

P0 — Provider comparison: resolve the source-flagged conflict with the warehouse owner; explain the conflict in plain language and avoid equating a shared qualification code with identical teaching, quality or outcomes. Test different providers, missing records and one-course focus.

P1 — Routing coverage: test every objective with independently written paraphrases, close neighbours, long distractors, negation, corrected goals and no-activity cases. Freeze a held-out set before calibration. Measure shortlist recall separately from final selection, unwanted openings and abstentions. Some current matches appear near the shortlist boundary.

P1 — Interaction continuity: extend browser journeys across right-side answer → save → reload → left-side follow-up → correction → new activity. Include interruption, failed request and retry. This review verified receipt persistence and one live unsure-answer recall; correction, interruption and recovery combinations still need broader coverage.

P1 — Prompt consolidation: define a short shared priority contract, move objective-specific instructions into their objective, and retrieve only relevant evidence. Preserve the counselling behaviours proven useful in v1.7. Do this with regression checks rather than another large appended instruction block.

P1 — Latency and access: test slow networks, keyboard-only navigation, screen readers and narrow screens with real users. The preview still exposes test controls and telemetry; production visibility remains a separate release task.

## How to measure satisfaction honestly

Use a six-dimension review rubric: understanding of the person, usefulness of the next step, evidence fidelity, activity relevance, interaction effort, and continuity/control. Grade each 0 (failed), 1 (partial) or 2 (meets the scenario). Keep per-scenario reasons; a critical evidence or unauthorised-action failure blocks release regardless of total. Do not convert this development rubric into a claimed satisfaction percentage.

Run moderated sessions with 12–18 participants spanning students, uncertain local residents, career changers, returning workers and people with accessibility needs. Ask them to use their own wording. Observe whether they can explain the advice, identify the next step, correct a detail and reopen saved work without coaching. After each journey ask “Did this help you decide what to do next?” and an effort rating. Measure unwanted activity openings, repeat questions, abandonment and completion, alongside response latency.

Then use a consented pilot to measure actual helpfulness ratings, repeat use and voluntary referrals. Tool usage alone is not success: a clear answer with no activity can be the best outcome. No CSAT, NPS, retention or word-of-mouth result has been established by this synthetic review.

## Evidence and reproducibility

Scenario definitions: qa/experience/scenarios.json. Main runners: scripts/audit-experience-flow.ts and scripts/audit-experience-routing.ts. Baseline outputs: output/experience-flow/2026-09-20/. Full retest: output/experience-flow/2026-09-20/retest/. Targeted school retest: output/experience-flow/2026-09-20/school-final/. Saved-answer continuation: output/experience-flow/2026-09-20/continuity.json. Summary metrics: output/experience-flow/2026-09-20/review-metrics.json.

Use distinct UX_AUDIT_ROOT folders per run; UX_SCENARIOS filters the chat suite. Both runners require --live and use configured credentials without printing them. The selector harness is paced to respect the local endpoint limit. Synthetic conversations are clearly titled “UX review · … · fictional”. Raw development files contain prompts and should remain inside the development environment.

## Scenario results

| Person / need | Review | Findings |
|---|---|---|
| Local resident without a direction — Find a manageable starting point | Pass in sample | 114-word opening; one manageable question. “I don’t know” reduces pressure. Shelf repair becomes a clue, not proof of trade readiness. Latest turn correctly permits no activity. |
| School student choosing subjects — Understand options without closing doors | Fail: evidence | Correct activity retrieved and suggested, but workspace claims combinations satisfy university prerequisites without named course evidence. Added instruction did not fix this in the targeted retest. |
| Parent returning after a break — Find work compatible with availability | Pass with refinement | Corrected availability replaces school hours with evenings. Practical income focus retained. Check question load across longer exchanges. |
| Experienced worker changing direction — Connect actual tasks to possible jobs | Pass in sample | Connects reported retail tasks to other roles. JOB_DISCOVER_002 suggested; user statements remain evidence of reported experience, not a skills certification. |
| Learner comparing training providers — Understand useful provider differences | Partial | STUDY_004 opens automatically. Contradictory source fields are withheld. Main answer still overstates identical foundational content from a shared qualification code; source conflict needs clearer explanation. |
| Job seeker with two fictional offers — Compare trade-offs immediately | Pass in sample | JOB_DECIDE_004 opens automatically; comparison retains provided pay, hours, commuting and training details without making the user re-enter them. |
| Resident asking about local demand — Interpret jobs and future outlook | Pass after mapping fix | Ballarat now resolves correctly despite same-name geographic ancestors. Latest locality and regional/date labels retained. Counts describe returned records, not independently verified complete local vacancy totals. |
| Employed learner with a specific goal — Understand and practise a skill | Pass with refinement | Useful duplicate-highlighting exercise, fictional example.com data and manual review. Candidate matches are not identity proof. At 340 words, could reveal the example progressively. |
| Learner with stated access needs — Plan workable learning | Partial | Captions, three-hour budget and enjoyment respected; no career intake. Ends with two different questions joined by “or”; simplify to one. |
| Reader who wants a simple explanation — Understand paid work with training | Pass in sample | 94-word apprenticeship explanation; no activity opened after explicit request not to use tools. |
| User maintaining control — Pause automatic activity suggestions | Pass in sample | Opt-out respected. Closure is brief and does not open a new activity. |
| User using a short unclear phrase — Resolve meaning without dismissal | Pass in sample | “quality” gets clarification rather than the earlier dismissive response. No forced activity. |
| User typing informally — Compare named career fields | Pass in sample | JOB_COMPARE_001 opens automatically and compares engineering/marketing before asking for personal priorities. Relevant activity was not BGE’s first choice. |
| User ready for an external action — Know what can actually be done | Pass in sample | Does not claim an appointment was booked. No unsupported external action executed. |
