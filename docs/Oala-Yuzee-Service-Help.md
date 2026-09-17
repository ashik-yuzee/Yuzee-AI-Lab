# @Oala Yuzee service help

**Later update, 16 September:** a separate needs classifier now evaluates ordinary submitted text before Gemini. Explicit @Oala is still required for the 103-task mini-prompt injection. The older loading description below applies to the original integration. See [Turn-Needs-Preflight.md](Turn-Needs-Preflight.md) for the current split.

Implemented locally on 16 September 2026 in the main chat.

## How to use

Start a message with `@Oala`, or choose **Ask @Oala about Yuzee services** above the message box. Typing `@` offers Oala; Enter or Tab completes the mention, Escape dismisses the suggestion. Removing the mention keeps the question. The mention is per message; ordinary follow-up messages still use the existing counsellor and its conversation history.

Examples:

- `@Oala What is Yuzee?`
- `@Oala What services do you offer?`
- `@Oala I want to return to work, not study. Which service can help?`
- `@Oala Can my work experience count towards a qualification?`

## Behaviour

- The main prompt file is unchanged. A separate server-owned instruction scopes an addressed turn to Yuzee's education, career, skills and work purpose.
- Basic introductions and explicit full-catalogue questions use fixed wording and the 11-service product catalogue extracted from the existing main prompt. They do not need a Gemini generation call.
- Personal recommendations use Gemini with the service catalogue and actual connected-action status. MiniLM may suggest a relevant existing micro-prompt; its confidence guards and fallback behaviour remain.
- MiniLM inference requires an explicit current @Oala mention, regardless of the selected optimisation mode. Loading starts when the mention is entered. Normal chat does not start the router. Once loaded, the worker remains available, but ordinary messages do not run inference.
- Client-supplied prompts and arbitrary service IDs cannot replace the server catalogue. Similarity is a topic hint, not evidence of facts or permission to act.
- No known live application, matching or booking action is connected in this preview. Oala can explain and help prepare the next step, but cannot claim to submit or book it.
- User-entered location is requested only when relevant. Unknown fees, availability and eligibility need evidence rather than guesses.

## Checks completed

- 10 Oala integration checks and 24 MiniLM checks passed.
- 35 existing experience checks, local persistence checks and 85 output-display checks passed.
- Production build passed; the existing large-bundle warning remains.
- Nine initial synthetic Gemini cases covered an introduction, all services, return to work, a school student, RPL, unrelated requests, unknown prices, execution requests and closure. All returned accepted protocol data; content review found verbosity and an omitted price answer.
- Five follow-up live cases verified the shorter introduction, clearer unknown-price answer and more focused question. The AI full catalogue still added an unsupported flexibility claim; replacing the basic catalogue with exact product-owned descriptions removed that generation path.
- Final basic introduction and full catalogue both returned validated output and zero generated tokens.
- Browser checks verified the mention suggestion, keyboard selection, preserving a draft when adding/removing Oala, a streamed Gemini response in the main chat, and fitting the active composer on a 390px phone viewport. The normal viewport was restored.

## Limits

This is a tested local preview, not an exhaustive production evaluation. Personalised Gemini replies can still vary and require grounded data for current facts. The catalogue describes Yuzee's declared services; it does not establish current prices, partner coverage, service levels or operating availability. Those should come from a maintained, approved product data source before production use. The separate microtools concept was not changed.

## Evidence

- `../../outputs/Oala-Live-Checks.json`
- `../../outputs/Oala-Live-Recheck.json`
- `../../outputs/Oala-Basic-Final-Checks.json`
