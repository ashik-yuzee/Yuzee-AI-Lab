# Conversation and streaming review — 16 September 2026

## Decision and implementation

Keep the current application and main prompt intact. Add compact progress and conversational replies to the separate concept at http://127.0.0.1:3001/.

The concept now supports both a scripted sample conversation and an optional real Gemini conversation. Live mode receives the latest message, the sample card title/summary and up to three recent completed exchanges. It has no search tool, provider feed, live fees or job data. The 22 micro-tool adapters remain fixtures. This is a live counselling/streaming test, not the completed micro-prompt/data integration.

The UI shows one short progress title and one line of supporting text, with Stop. Titles rotate approximately every three seconds within the actual known phase. It does not display an expanding reasoning panel, a percentage, imaginary search actions or promises about remaining time. Reduced-motion preference disables title rotation and staged answer reveal.

## What the existing application actually receives

The existing server calls `generateContentStream`, emits a `start` event, emits a `status: generating` event for the first chunk, forwards answer deltas, then validates the complete JSON before sending structured content. Its frontend stream parser does not handle that `status` event. The chat renderer hides raw JSON and uses a static generating label plus several shimmer bars. The assembled request does not opt into thought summaries.

The installed Gemini SDK’s `.text` accessor excludes thought parts. Thought summaries, when requested and provided, are accessed separately through `candidates[0].content.parts` with `thought: true`. Google documents incremental summaries and the `includeThoughts` option; it does not define guaranteed `title` and `subtext` fields for them. [Google’s Generate Content thinking documentation](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

We therefore should not make the frontend depend on a provider-written heading. The new adapter detects the presence of summary parts, discards their text and signatures, and emits a reviewed progress phase. Titles/subtext are application copy, not quotations of Gemini’s thoughts. No extra model call generates loading labels. Without a summary, the generic waiting state remains valid until answer text arrives.

Visual compactness and provider reasoning effort are separate settings. The isolated live adapter requests `low` thinking for its configured Gemini model and `includeThoughts: true`. It does not alter the main application’s thinking configuration or claim to eliminate model reasoning. Live tests used the existing `gemini-3.7-flash` configuration successfully.

## Stream contract

Every event carries a request ID and increasing sequence number. The live server emits:

| Event / phase | Trigger | User sees |
|---|---|---|
| progress / waiting | Request accepted and provider request started | Getting your answer ready / Waiting for a response |
| progress / thinking | Optional Gemini thought summary part received | Considering your question / Working on a useful answer |
| progress / receiving | Non-thought answer text received | Your answer is coming through / Receiving your answer |
| progress / checking | Generation finished; parse and schema checks running | Checking the response |
| answer | Complete JSON validated, with a normal STOP finish reason | Buffered answer ready for display |
| done | Answer event successfully completed | Compact reply revealed in readable sections |
| error | Provider error, deadline, invalid output or incomplete finish | Clear retry message; question retained |

No partial JSON or provider thought text appears in an answer. A connection closing without a validated answer plus `done` is a failure. Duplicate events and events belonging to another request are ignored; unknown event shapes fail closed. Stop cancels the fetch; switching the journey or reference answer also cancels stale conversation work. Local sample streams test the same compact status presentation, but do not pretend to contact Gemini.

The completed reply has five fields: acknowledgement, answer, uncertainty, question and up to three suggested replies. Shape checks run on the server and client. This is not a claim of factual verification: the model can still misstate something, and source-based domain checks are required before real recommendations.

## Counselling problems found in the saved Gemini output

Reviewed the saved synthetic course-research conversation `detail-live-1789448684893` (the existing “Explore more — course research demo”). Its latest two responses repeated much of the same checklist. They described a one-unit load as fitting a 12-hour weekly window based on a general 10-hour benchmark, despite unresolved scheduled attendance and peak workload. They also used an ambiguous “per year or trimester” pace. These are review findings about the saved response; no current university or benefits rules were verified in this task.

The improved response structure is:

1. Acknowledge the user’s stated constraint briefly.
2. Answer the immediate question in two or three short sentences.
3. Separate the most important unknown into “Still to check”.
4. Ask one useful question, with short possible replies and free text.
5. Preserve the previous exchange so the person can see what was understood.

For example:

> You have about 12 hours a week available for study. A smaller starting load may be worth exploring, but a general hours-per-unit guide cannot tell us whether this particular course will fit. We would need its scheduled classes and busiest assessment weeks. Do you know whether attendance happens at fixed times?

This is a proposed wording example, not verified advice about a particular course.

## What was tested live

Two real Gemini turns were exercised in the browser: a synthetic person with three work days and 12 study hours, followed by “I need to check the provider’s schedule.” The first response compared the stated hours with the provider’s total commitment and asked one attendance question. The second followed the answer but introduced “your non-working days”. This exposed a remaining availability assumption. The isolated prompt was tightened and an explicit rejection check added for that phrasing in the answer. A further live check after this change is recorded in the final verification below.

The prototype does not establish course suitability, eligibility, workload, hiring demand or skill readiness. It never invokes the current application’s main prompt or sends its full saved conversation to this adapter.

## Frontend improvements

- User messages and Yuzee replies have distinct, readable shapes and clear source labels (sample or Gemini).
- The answer is revealed by section after validation, rather than displaying broken JSON or slowly typing every letter.
- The current question sits beside its suggested replies; free text is always available.
- Earlier exchanges collapse after two, with a way to reopen them.
- The message stays available after stop/error. Enter sends, Shift+Enter adds a line; input composition is respected.
- The progress row uses consistent space, neutral copy and a Stop button. After 12 seconds it acknowledges that the response is taking longer.
- No raw thought text, hidden confidence score or backend routing labels appear in the conversation.
- Phone layouts stack replies and keep the message input at 16px.

## Boundaries and next work

This local adapter is loopback-only with origin checks, short bounded requests, concurrency/rate limits, a server deadline and no conversation persistence. Credentials stay in the repository’s ignored environment file. For shared deployment it still needs real authentication, ownership checks, durable request handling, observability and a deliberate privacy/storage policy.

Real provider retrieval remains the next separate integration. Progress labels such as “Checking current course information” should only appear once an actual retrieval request starts. A model summary mentioning “search” is not evidence that a search happened. Do not treat JSON validation as evidence verification.

The latest conversation implementation is covered by 24 new stream/counselling checks, in addition to the 31 existing concept checks. The new checks cover thought exclusion, missing summary parts, fragmented SSE, invalid output, duplicate/stale events, unfinished streams, cancellation and sample counselling constraints. Build and browser results are recorded in the final verification below.

## Final verification

- 24 new streaming/counselling tests and all 31 existing concept tests passed.
- TypeScript check and the isolated production build passed.
- Three live Gemini requests completed in the browser, including the post-fix retest. That final answer used the stated 12 hours, asked about fixed versus self-paced study, and did not assume non-working days were free.
- Browser checks covered reply-button continuation, visibly rotating slow-response titles, Stop with the question preserved, no-summary completion, invalid output hidden with a retry action, and successful retry.
- At requested 390 × 844 viewport, document content measured 375px wide (no horizontal overflow); chat text and inputs remained readable and reply options stacked.
- The existing chat/server/main prompt were inspected but not changed. The new live endpoint is exclusively `/api/concept/chat` on the separate concept adapter.

The generated acknowledgement can still sound like a restatement of the user’s message. This is a copy/usability refinement to test with people, not a reason to expand the waiting panel. Further live content evaluation remains necessary before describing the counsellor as reliably accurate across all scenarios or ages.
