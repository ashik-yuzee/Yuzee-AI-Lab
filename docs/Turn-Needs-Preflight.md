> Update: post-response MiniLM skill suggestions now supplement this preflight. See [Post-Response-Skill-Suggestions.md](Post-Response-Skill-Suggestions.md). Selecting an offered skill explicitly activates its registered prompt without @Oala.

# Contextual research and pre-response assessment

Implemented in the main Quiz chat on 16 September 2026. This supersedes earlier handover statements that only explicitly addressed text is evaluated by MiniLM. The 103-skill injection boundary still requires a current @Oala mention; the new needs assessment is separate.

## The three paths

| User need | Expected response | Research UI |
|---|---|---|
| Explain a concept, learn a skill, understand Yuzee | Useful direct explanation in the main chat | None |
| Check fees with no course identified | One relevant clarification through the existing Quiz interaction | None until scope is supplied |
| Check fees, attendance or other official details for an identified course | Explain known information and gaps; offer an explicit lookup | Compact topic-specific action, initially closed |
| Assess fit around work/family without available study time | Ask for available study time, using retained context | No generic research form |
| Calculate a total from supplied amounts | Use the supplied numbers | None |
| User corrects, stops or changes topic | Respect that direction | No forced research |
| Multiple questions or options | Main counsellor handles the complete request | No silently narrowed single-course lookup |

## How it runs

Every submitted free-text message attempts a short MiniLM scenario classification before the Gemini request. Nine compact prototype descriptions cover three categories: answer, clarify and research. Maximum similarity within each category is compared with the other categories. The provisional acceptance threshold is 0.50 with a 0.08 margin; these are conservative POC settings, not a calibrated probability.

The browser may append an explicitly resolved, user-stated course to a follow-up query. It does not send the full transcript to the embedding model. The existing 256-token guard prevents silent truncation; cold loading, timeout, uncertainty and cancellation fall back without blocking the counsellor. A ready needs-classification request waits at most one second. An addressed @Oala skill classification may additionally take its existing bounded wait.

The server reconstructs the decision from the actual input, limited prior user context, validated interaction and allowlisted classifier hint. A similarity match alone cannot establish missing facts or show a research panel for an unrelated request. Browser-supplied instructions and action titles are not trusted. Corrections and stopping take priority. Assistant claims are not copied into research scope as user-confirmed facts.

The resulting server-owned guidance is included alongside the current input before Gemini generation, without changing the master prompt or canonical response schema. The final answer still comes from Gemini. The decision and classifier status are sent in the start event and persisted as separate message/telemetry metadata.

Structured Quiz events retain their existing controller. After server validation, an explicit course answer to a pending research clarification can unlock the lookup. General Quiz selections do not inject a skill or start research.

## Frontend behaviour

The previous unconditional MoreDetails component is removed. A completed accepted answer renders a research action only if its server assessment allows it and includes an explicit target. It uses a specific title such as Check course fees. The original question, course, known year and entered location are carried into the form. The user reviews or edits these details and explicitly starts the search. No source retrieval has happened merely because the panel appears.

General follow-ups remain in the main composer. The research form no longer begins with What would you like to know? It says Review your question. Saved research results and the existing scoped retrieval/validation flow remain unchanged.

## Verification and limits

Run `npm run test:needs`. It covers 26 scenario/integration assertions plus worker cold fallback, semantic responses, token guard, cancellation and timeout. Existing routing, Oala, research, output, UX, counselling and build checks also apply. The tokenizer suite now verifies all needs prototypes as well as the 103 tool descriptors.

`tmp/needs/evaluate.ts` evaluates ten synthetic queries with the cached actual q8 MiniLM model on CPU. All ten final rule-guarded paths matched expectations; the classifier selected a category for eight and abstained on two. This is a small development set, not an independent accuracy benchmark or proof of browser-WASM equivalence.

Scope extraction intentionally recognises a limited set of explicit course/provider patterns, or a labelled Course: input. It is not a universal entity resolver. Missing/ambiguous targets stay with the counsellor. Broad career, job-market and multi-provider research flows need additional reviewed contracts before expansion. The legacy 103-task router is still distinct from this assessment and is not an autonomous task executor.

The classifier does not verify facts. Gemini can still ask an unnecessary question or make a poorly grounded claim, especially where broader prompt rules conflict; semantic review and wider user testing remain necessary. Existing historical replies without assessment metadata do not gain a new research invitation automatically. The original handover ZIP is a historical snapshot; use the refreshed package for this change.
