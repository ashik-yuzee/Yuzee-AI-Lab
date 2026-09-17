# Gemini response → MiniLM skill suggestions

Implemented 16 September 2026 in the main Quiz chat. This supersedes the old Gemini-only “Continue with” tray. The separate research panel and pre-generation needs check remain available.

## Flow

1. Gemini produces its normal canonical response. The master prompt and response schema are unchanged.
2. After a valid, complete response with no pending interaction, the browser gives MiniLM the visible response, the latest three user messages, and Gemini's optional follow-up ideas. Hidden model state is excluded. These are matching inputs, not verified facts.
3. MiniLM embeds sections and compares them with the 103 eligible skill descriptions. Each section needs cosine similarity ≥0.48 and a ≥0.06 gap to its runner-up. Up to three distinct skills become cards. Labels and descriptions come from the registered catalogue, not generated instructions. These are similarity thresholds, not probabilities.
4. No clear match, unavailable model, excessive input or timeout means no cards. The normal message box remains usable. Cards are suppressed during streaming, after invalid/stopped replies, while a Quiz question needs an answer, and for stop/no-suggestion requests. A skill that just ran is not offered immediately again.
5. Selecting a card sends its skill ID and source response ID with a standard visible follow-up request. It does not require typing @Oala. The server checks the latest response ID, allowlist, exact generated request text and ordinary-message boundary. A stale/invalid selection is rejected.
6. The server injects only its own registered mini-prompt and learning guidance into Gemini's next request. Existing conversation memory is included by the existing assembler. Routing metadata records `user-selected-skill`. Gemini writes the next answer.

## Limits and evidence

MiniLM selects relevant topics; it does not verify facts, assess counselling correctness or generate the final response. Matching a topic cannot prove a learning gap remains. These are optional deeper explorations, not claims that an external service or lookup has run. Provider fees, eligibility and current rules still need appropriate evidence. The separate explicit research flow remains responsible for source lookup.

The full matching input is bounded to 30,000 characters and 96 embedding sections. Every section is measured with the actual tokenizer and kept within 256 tokens; long paragraphs are recursively split without silently dropping their end. Exceeding the overall bounds abstains rather than evaluating only a prefix. Browser initialization is asynchronous, with a 120-second model warmup timeout and 20-second review timeout. The answer remains readable during review.

The current context window for suggestions is the latest three user messages plus the current displayed answer; this is not full-conversation semantic memory. Skill suggestions are transient and recomputed when reopening the latest eligible response. Selected skill provenance is persisted in normal response routing metadata. The 103 catalogue skills have not all been independently benchmarked for post-response matching.

## Validation

- `npm run test:skill-suggestions`: clear/ambiguous ranks, duplicates, internal/unknown IDs, explicit server-side injection, stale/corrupt selections, stopped replies, complete chunking, boundaries, worker lifecycle.
- Existing needs, routing, Oala and actual tokenizer regression suites.
- Cached q8 CPU MiniLM examples: funding selects COURSE_011; vague/unrelated text abstains. Placement and course-structure examples abstained at the conservative thresholds despite plausible top matches. This is a small development check, not a universal accuracy result.
- Actual browser WASM: synthetic funding response produced the cost card; selecting it produced `user-selected-skill: COURSE_011` through the shared acceptance function.

Main files: `src/routing/skillSuggestions.ts`, `src/workers/embedder.worker.ts`, `src/services/MicroToolRouter.ts`, `src/components/SkillSuggestions.tsx`, `src/components/ChatArea.tsx`, `src/context/TokenLabContext.tsx`, `server.ts`.

The previously delivered v2 ZIP and PDF predate this change and do not contain it.

Main-chat end-to-end verification also passed: a synthetic Gemini tuition/funding response produced the cost card through browser MiniLM. Clicking it produced a second Gemini answer with persisted routing `{status: selected, toolId: COURSE_011, reason: user-selected-skill}`. The answer explained cost categories and missing details, then requested course scope; skill cards correctly stayed hidden while that clarification was pending. Test conversation: `conv-1789554221098-3yrovp`. Final build, UX/persistence and output-review regressions passed.

## Matching upgrade and financial evidence guard (16 September, later update)

The recommendation index now has two descriptors per eligible skill (base routing description and output priorities), plus focused HECS, placement, entry, structure and graduate-transition examples. All 103 skills remain indexed. Original free-text @Oala routing retains its original index. Recommendation matching preserves headings with their explanations and combines short user answers with the response topic.

Optional cards can show two strong related matches when both score at least 0.60 and the second is separated from the third by at least 0.10. This does not weaken automatic topic selection: that still needs the normal 0.48 score and 0.06 margin. The three-card cap and uncertain/unavailable fallback remain.

A validated single-select navigation menu such as “Which aspect ... focus on next?” now sends the selected option label and description to MiniLM's richer index. On a clear match, the server accepts only a registered skill and records `user-selected-topic`. Ordinary intake questions such as residency or study load remain Quiz answers. Menu detection currently uses a bounded set of navigation wording patterns, not universal intent understanding.

HELP repayment requests retrieve a bounded extract from the official Department of Education page, with a 10-second timeout and 15-minute cache. The source URL and retrieval status are recorded in telemetry. The extract supports a dated 2025–26 lower-band example; it is not a complete repayment schedule or evidence for future-year rates. Higher-income calculations require the full ATO schedule. If retrieval fails, Gemini is instructed to explain the concept without rates or eligibility conclusions. A targeted output gate withholds the known obsolete 1%-to-10% claim even when the richer teaching reviewer is disabled. Historical replies containing that claim show a notice and a correction action. This is targeted HELP protection, not comprehensive verification of all financial, provider or salary claims.

Verified outcomes:
- Replaying the latest actual reply in the browser now displays cost, career progression and placement/study cards; it previously displayed none.
- 10/10 focused CPU MiniLM cases passed, including all three requested menu topics, placement budgeting, graduate transition, course structure, and four unrelated/vague negatives.
- Every descriptor for all 103 skills fits the actual 256-token budget.
- Live Quiz selection: `conv-1789555722989-ig6b92`, response `msg-1789555775457-zoac95`, selected COURSE_011, reason `user-selected-topic`, score 0.879, margin 0.455, browser routing latency 14ms, Gemini response protocol accepted.
- Existing conversation received a correction: `conv-1789554221098-3yrovp`, response `msg-1789555677542-gxhpt1`. Official source retrieval succeeded and Gemini distinguished the dated marginal system from the old tiers. The source handling was subsequently narrowed to avoid treating the government overview as a complete higher-income tax schedule.
- Needs, routing, Oala, skill selection, topic/evidence, UX/persistence and output regression suites passed. These checks do not constitute an independent accuracy benchmark across all 103 skills.
