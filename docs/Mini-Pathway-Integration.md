# Mini Pathway beside the Quiz

Implemented locally on 16 September 2026. The supplied `Prompt-Mini-Pathway-JSON.md` is copied unchanged into `src/miniPathway/`. It runs in a separate Gemini request; it does not replace the Quiz master prompt or the existing whiteboard.

## Decision

The main Quiz provides `state.user_confidence.score`. This describes the user's decision confidence, not model accuracy, service classification confidence or MiniLM similarity. It is an estimate from the Quiz, not a psychometric measurement.

MiniLM first checks pathway relevance using a separate short-description index. The current acceptance gates are cosine similarity >= 0.48 and top category margin >= 0.06. The application then applies the score rule:

| Condition | Behaviour |
| --- | --- |
| Relevant and grounded score 0–39 | Generate Mini Pathway automatically and open it on the right. |
| Relevant and score 40–100 | Offer a Mini Pathway card under the response; generate only on click. |
| Relevant but score unknown (-1, unknown band or no evidence) | Optional offer; never treat unknown as low. |
| Not relevant, uncertain MiniLM match or model unavailable | No automatic run or fabricated suggestion. |
| Stop, no suggestions/pathway, safety, invalid response or service execution | No new pathway run. |
| Already attempted during the same low-confidence episode | Offer manual retry/update instead of repeated automatic generation. |
| Confidence recovers to >=40 or the Quiz marks NEW_TOPIC_RESET | A later relevant low-confidence turn may start a new episode. |

The default threshold 40 follows the supplied prompt's low band. Change the shared `MINI_PATHWAY_THRESHOLD` in `src/miniPathway/policy.ts` to change both client and server policy. The user was offered alternative thresholds; no alternative was supplied during this implementation.

## Generation and data

`GET/POST /api/conversations/:id/mini-pathway` uses the app's existing authentication. The POST accepts source message ID, automatic/manual mode, advisory MiniLM hint and optional user-entered location. It does not accept prompt text or a client-supplied Quiz confidence score.

The server checks the latest stored assistant response and its canonical JSON, recalculates the confidence policy and validates the MiniLM hint's shape and score range. Similarity remains an advisory browser result; it is not independently recomputed on the server.

Gemini receives:

- The supplied Mini Pathway prompt as its system instruction.
- A small trusted side-panel adapter and the canonical v1.3 schema.
- Up to 16 complete recent messages and the current Quiz response, treated as untrusted context rather than evidence.
- The main question, prior confidence metadata, user-entered location and an empty verified-action list.

Large selected history over 90,000 characters is declined rather than cut mid-message. Older messages outside the 16-message window are not sent. Missing earlier facts must remain unknown. The Gemini model follows the conversation's selected model; MiniLM remains `Xenova/all-MiniLM-L6-v2` q8 on browser WASM. No WebGPU merge was included.

No retrieval runs in this pathway call. It must distinguish conditional guidance from verified provider facts, fees, funding, licensing and outcomes. Source-dependent facts still need the existing research flow or another connected source. JSON validity is not factual verification.

## Display and interaction

The right-side panel supports loading stages, stop, error, manual retry, close and reopening a saved result. It is supplementary: the main Quiz keeps the only active question. The adapter requires B_DELIVERY, no active interaction, no service actions and no timed followups. These boundaries are checked again before displaying the result.

The prompt's `BLOCKED` readiness example conflicts with the current schema. The adapter explicitly makes the current schema authoritative and requires NOT_READY for this supplementary report. The supplied document itself is unchanged.

Tables retain their original row/column relationships. At report widths up to 760px, rows stack with each column label beside its cell content; expanding the panel restores full tables when space permits. Table introductions are promoted into text blocks because the shared renderer omits table.text. No cell values or milestones are removed. The saved original JSON is unchanged. Desktop layout docks on the right; narrow screens use a closable panel. Navigation is collapsed when the panel opens. The existing whiteboard and token inspector close to avoid competing side panels.

The main answer no longer shows the older heuristic “Build my pathway” whiteboard shortcut alongside the new MiniLM-controlled offer. The original whiteboard remains accessible through the Pathway button in the toolbar.

The panel's data is kept separate from the main transcript and active Quiz interaction. It does not itself submit answers or inject its generated statements into the main conversation as user facts. Users continue counselling through the main chat.

## Persistence and failure handling

Runs persist in ignored `data/mini-pathways.json`, with source ID, trigger mode, decision, MiniLM hint, prompt hash, model and token usage. Reopening a completed result uses the saved result. Only one generation may run per conversation. Cancelled/failed attempts prevent automatic retry loops. A new user message or conversation switch cancels the pending browser request; the server checks the source is still current before saving a completed response.

The generation has a 120-second request limit and a 24,000-token output budget. Incomplete provider output is rejected. Invalid, structurally incomplete or flagged unsupported-cost output gets at most one complete regeneration with specific validation feedback; it is never presented as complete. Token use is logged separately under `/api/mini-pathway`, including failed generation use, without charging cached reopening as another generation.

## Validation performed

- Build and type checks passed during implementation.
- `npm run test:mini-pathway`: threshold boundaries, unknown confidence, abstention, safety, active Quiz separation, cache, concurrency, stale source, cancellation, failed automatic retry suppression, topic reset, output rejection, persistence and comparison-value preservation.
- `npm run eval:mini-pathway`: 11 real MiniLM CPU/q8 cases passed, including uncertain career choice, career change, nursing, a confident IT route, fees, definitions, HELP, services, thanks and weather. This is targeted coverage, not universal routing validation.
- Existing skill-suggestion, routing and turn-needs regressions passed.
- Live Quiz test: conversation `conv-1789566875603-2oe43b`, response `msg-1789566882702-6h290t`: confidence 30, browser MiniLM similarity 0.6769, margin 0.3638, automatic Gemini report completed.
- Live follow-up: response `msg-1789567111893-2787pw`: confidence 70, optional card displayed, no automatic generation; clicking produced a second completed report with mode manual.
- Browser review: main Quiz retained one question; panel contained zero forms/inputs. At 390px viewport width, panel body scroll width equalled its client width (389px): no horizontal overflow. Saved report reopened without generation.

The confident IT test initially abstained. Two relevant descriptors were added and all 11 positive/negative scenarios rerun successfully. Thresholds were not loosened.

The previous CSV export covers the 103 skill snippets and their original routing rules. This new Mini Pathway is a separate prompt/module, not a 104th user-facing microtool in that registry. Use this document and the module files together when handing over this additional feature.


## Updated prompt and HTML reference — report depth

The 16 September update copies the supplied prompt unchanged, including **FORMAL REPORT DEPTH PARITY**. The previous adapter's compact-summary preference has been removed. The HTML reference supplies a report topology: orientation, route summary, separate chronological routes, accessibility and trade-offs, comparison, and a complete six-part experience playbook. The reference's trailing legacy JSON contains services/questions rather than the report itself; it is not the runtime data contract.

The runtime returns one canonical v1.3 JSON object. All report information is in `content_blocks`. It does not execute the reference HTML or retain HTML/JSON sentinel wrappers. Reference fees, placement statistics, accreditation outcomes and marketing conversion claims are not treated as verified data.

Stable block IDs make structural completeness reviewable:

| Block ID | Content |
| --- | --- |
| `overview` | First text block, empty title; plain-language orientation. |
| `route-summary` | Table, one row per useful route, each with a unique row ID. No mandatory third route if it is not useful. |
| `<route-row-id>-timeline` | Complete table or steps for that individual route, including material sub-steps. |
| `<route-row-id>-considerations` | Access needs, risks, trade-offs and mitigation for that route. |
| `route-comparison` | Time, costs, risks, foundational depth and flexibility; unsupported facts remain unknown. |
| `experience-playbook` | Six practical steps: experience target, evidence, preparation, readiness, experience goals, follow-on strategy. For an undecided learner, use exploratory activities. |

Additional headings, explanations, examples and blocks are permitted without an arbitrary count cap. The structural check confirms sections and route-linked blocks exist; it does not prove that every explanation is useful, accurate or exhaustive. Numeric currency claims and certain tuition/wage/job guarantees are rejected because this call fetches no supporting sources. Other claims still require source verification. Specific validation issues are provided in the single permitted regeneration and stored as `qualityIssues` for diagnosis.

The report version is `mini-pathway-v2-report-contract`. Old saved reports are retained and labelled as an earlier format; the user can choose **Update this pathway**. Reloading does not silently regenerate old reports. **Expand**, **Collapse**, Escape, close and reopening remain available. Section links help navigate a long report.

`npm run test:mini-pathway` now also renders a complete synthetic report with the reference's structure: three routes, twelve milestones and sub-steps, five tables, and six playbook steps. It asserts every table cell and label survives rendering, the original JSON is unchanged, no extra form appears, and missing timelines/playbook parts and unsupported money claims are detected.


### Live validation of the update

A completed Gemini report (`a023554a-5e63-4361-b2e8-668135c7f5c1`) for the existing IT-support test conversation passed schema, interaction-boundary and report-structure checks: three routes, five stages per route, three consideration items per route, a five-row comparison and six playbook items. Usage: 14,653 input tokens, 5,398 output tokens, 479 thinking tokens. Earlier test generations exposed compact/missing-route detail and unsupported cost claims; these prompted the dedicated report review and specific repair feedback.

Browser verification confirmed 32 table cells in both expanded and 390px views, zero panel forms/inputs, and no body overflow (expanded 1100/1100px; phone 389/389px). Expand/collapse and section links worked. These are structural/UI checks, not factual verification: the live response still contains unverified planning ranges and provider/employment assumptions, so the display explicitly states no source lookup occurred.


### Resizable drawer

The Mini Pathway drawer has a draggable left-edge separator. Drag left to widen and right to narrow; double-click resets the default width. The separator also supports Left/Right arrows (20px, or 80px with Shift), Home (minimum) and End (maximum). Width preference is saved locally and restored after closing or expanding/collapsing. Desktop sizing leaves at least 360px for the chat; narrow-screen overlays stay inside the viewport. The minimum width is 320px unless the viewport is smaller. Pointer capture supports dragging beyond the handle and resets on release/cancel.

Browser checks: dragged 440→660→500px, expanded and restored 500px, used keyboard resize, checked 320px minimum with no body overflow, and double-clicked back to default. Type checking and production build passed.
# Progressive pathway display — 17 September 2026

The right-hand drawer now uses Gemini `generateContentStream`. Its existing SSE connection sends progress, draft-reset, completed-block and final-result events. A subtle shimmer is visible immediately; complete, structurally valid content blocks appear in sequence as they arrive. Each new section fades in and the report grows naturally. There is no forced scrolling or artificial percentage. The existing expand and resize controls remain available.

The in-progress report is labelled **Draft**. The parser does not repair truncated JSON or forward thought summaries/signatures. A block must be a complete top-level `content_blocks` object matching the canonical block schema before it can appear. This is structural validation, not factual verification. The final report still goes through the existing protocol, side-panel action boundaries and report quality checks before it is saved as complete. A repair attempt clears the earlier draft. Stop, close, an error, or a conversation/source change clears the unfinished display; interrupted output is not presented as a completed report. Reduced-motion settings disable the shimmer and entrance animations.

Verification: `test:mini-pathway-stream` covers arbitrary JSON/SSE/UTF-8 chunk boundaries, nested tables, escaped strings, incomplete/malformed objects, duplicate IDs, thought isolation, progress before completion, cumulative usage, repair resets, cancellation, missing final results and transport errors. Existing Mini Pathway checks and the production build also pass. The browser interaction preview uses synthetic replay data with the production display components; it is not a live Gemini evaluation.

Preview: `output/html/Yuzee-Pathway-Streaming-Preview.html`. Rebuild it after UI edits with `node --import ./node_modules/tsx/dist/loader.mjs tmp/build-stream-preview.ts` after a production build.
# Saved pathways per conversation — 17 September 2026

Completed pathways are loaded independently of the latest Quiz response, MiniLM readiness, or whether Gemini is asking a question. Returning to a conversation with saved pathways opens the right-hand panel. Closing it leaves a persistent **Saved pathways** button in the main header. The selector lists every completed report in that conversation with its sequence number, creation date/time and originating user-message context. Earlier format versions remain available and are labelled. Failed and running attempts are not listed as completed reports.

Selection is remembered per conversation in browser storage, with the latest completed report as the fallback. Switching or reopening reads saved content and does not call Gemini. A successful new generation adds/selects its report without replacing the older reports. During generation the selector is disabled; stopping or failing preserves the saved collection and offers a way back. New generation continues to use the existing relevance/confidence and safety rules. Saved navigation remains visible even when ordinary skill suggestions are hidden for an active Gemini question.

Validation: `test:mini-pathway-history`, existing pathway and streaming tests, and production build. Browser checks cover opening existing saved reports, selecting an earlier report, closing/reopening the panel, and keeping the workspace fixed while navigating.
