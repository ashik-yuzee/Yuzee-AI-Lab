# 316-objective workspace and conversation flow

Updated 18 September 2026. Opt-in preview; not a production routing-accuracy sign-off.

The design reference is `Yuzee_Codex_Design_Scenarios_and_Workspace_Concept.html`. The conversation remains primary. The right workspace supports one useful task at a time and uses the existing approved primitives. The testing catalogue remains available, but users do not need to browse it to receive relevant help.

## When an activity opens

BGE embeds selection metadata and retrieves up to 20 candidates through separate user/context searches. It does not generate answers or execute a prompt. Gemini checks the current intent, objective exclusions and whether a workspace adds value. The application applies the opening policy and, if permitted, loads one objective prompt for Gemini.

| Situation | Behaviour |
| --- | --- |
| Simple explanation, social message or irrelevant request | Stay in chat; no forced activity. |
| Oala asks a counselling question | Review activities immediately after the response completes; a relevant high-confidence activity can open alongside the question. |
| Oala has a safety response or service intake | Keep attention on that response; no competing automatic activity. |
| Useful optional activity or uncertain match | Offer a clickable suggestion under the response. |
| Clear need, high contextual confidence, a relevant shortlisted BGE match | Open the right workspace automatically. |
| User explicitly requests the named task in a workspace now | A strongly matched shortlisted objective may open after high-confidence context validation, even when neighbouring BGE matches are close. |
| Activity already in progress | Preserve it; do not start another automatic activity. Manual browsing remains available for testing. |
| Dismissed or previously opened suggestion | Do not repeatedly reopen it from the same chat turn. |

The current policy is `workspace-assist-v4-context`: selected similarity ≥ 0.70 and Gemini HIGH + REQUIRED. The selected activity may be lower ranked; no top-two margin is required. Explicit deferrals do not qualify, while phrases such as “a course I want later” do not mean defer the workspace. These are preview operating rules, not calibrated probabilities. See `316-Activity-Routing-Upgrade.md` for validation and known limitations.

Routing similarity, qualitative selector confidence, Quiz user-confidence state and objective readiness remain separate. The original Quiz score is recorded without rewriting it. None of these values represents a probability of admission, hiring or success.

## Submitted answers

1. A user answers the current question and selects **Save answer**.
2. The exact answer and original question are retained. While the request is unacknowledged, the browser keeps a draft labelled **Entered · on this device**.
3. The server saves the submitted answer before calling Gemini. A failed call leaves the answer available for retry.
4. Only a fully validated new plan advances the activity. Failed drafts do not replace the accepted plan or confirmed facts.
5. Previous questions collapse into **Entered** records. Opening a record shows its full answer and submission time where known.
6. A saved-activity record under the originating Oala response provides the same question/answer history and a link to reopen the right workspace.

Older saved workspaces recover their question/answer history from stored confirmed facts. Their submission times are not invented. History stays scoped to its conversation; it is not written into a reusable user profile. Unsaved input recovery uses this browser tab's session storage, not cross-device storage.

## Keeping results in the workspace

Results stay on the right. Completion does not queue a chat message or trigger another Gemini counselling response, including for previously saved sessions with autoHandoff enabled. The compact record under the originating chat response retains the title, status, entered-answer history and reopen link, without repeating the result summary.

Relevant saved workspace information remains available as context when the user next sends a chat message. Up to three recent workspaces and three recent confirmed-answer records per workspace are included, with a context-limited indicator. Full history remains in the saved workspace. The previous explicit handoff API remains for compatibility but has no automatic UI trigger or generic transfer button.

## Answer before refinement

For known comparison options, the runtime prompt requires useful comparison output before asking for preferences. Broad fields can be compared broadly with scope explained. Specific qualifications, priorities and location are not prerequisites for understanding general differences. Ask only when details materially affect the next answer; complete without questions when the request is satisfied.

The renderer places the comparison ahead of input. Saved job-comparison domain data is projected into aligned criterion rows; internal scope enums and empty fields are omitted. Option names form the task title in the workspace and saved list. Required follow-up inputs remain available below the answer and retain the same validation and saved-answer history.

Validation: 44 local objective tests passed; build passed. An isolated live Gemini JOB_COMPARE_001 test returned COMPLETE, a four-row comparison_grid and a two-row tradeoff_matrix with no required question and autoHandoff false. This verifies one representative scenario, not all 316 objectives. Existing generated answers are preserved rather than regenerated.

## Design behaviour

| Scenario | Presentation | Meaning of the next step |
| --- | --- | --- |
| Discovery | Short exploratory choices, emerging themes | Notice preferences without imposing a career verdict. |
| Comparison | Aligned table, explicit priorities and trade-offs | Let the user decide; no hidden winner score. |
| Pathway | Ordered stages with explanations | Understand the route and requirements. |
| Skills/evidence | Evidence notes and matrices | Keep self-report, inference and unknowns distinct. |
| Multiple requested entities | Text entry for all required names/details | Do not force one radio choice when both offers are needed. |
| Needs current evidence | Neutral unknowns and remaining checks | Explain missing evidence; no invented live search. |
| Completed | Compact result and saved answer history | Return meaningful context to Oala once. |

This update improves shared behaviour; it does not claim every illustrated layout, multi-intent queue, inline correction or live connector in the design reference has been implemented. Live data, profile saving, independent 316-objective routing validation and broader semantic QA remain open work.

## Validation recorded for this update

- 42 local tests passed; the production build passed. Checks cover routing gates, explicit versus optional opening, stale/forged automatic-start requests, dismissed suggestions, saved answers after provider failure, retry without duplicate submission, legacy history, bounded correction, exact confirmed facts, and duplicate handoff markers.
- Live browser scenario: `conv-1789729952921-k0uno4`, objective `JOB_DECIDE_004`, workspace `04a06674-7e4f-4009-9cfe-4d3c27e6db27`.
- BGE shortlisted the correct objective in third place. Gemini selected it with HIGH confidence and REQUIRED workspace need. The explicit request rule opened it automatically.
- The user entered both fictional offers in one field. The first generated comparison failed TABLE_SHAPE checks; its single corrective attempt passed. No manual request replay was needed in this scenario.
- Oala automatically received the completed result and retained AUD 65,000 versus AUD 58,000, the AUD 56,000 floor, training and commute differences, and unknown progression. It did not ask for those inputs again or claim an offer had been accepted.
- Reopening the saved activity showed the original question, full entered answer and submission time. Server restart retained one workspace, one answer and one accepted handoff.

The underlying response still uses some user-confirmed labels for interpreted comparisons and an ACTUAL_OFFER domain enum for the explicitly fictional sample. This remains a semantic QA issue; the flow passing does not certify every evidence label. The full 316-objective quality and routing programme remains required.

A later browser chat question reused the entered details and correctly calculated 450 − 80 = 370 minutes (6 hours 10 minutes) of weekly travel saved, without requesting the inputs again. Explicit requests such as “I do not need another activity” now bypass activity checking immediately.
