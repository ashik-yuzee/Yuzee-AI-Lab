# Short-reply clarity update — 17 September 2026

## Reported failure
In the plumbing-provider conversation, typing “quality” twice returned the same “suspicious static” joke. This was a local server bypass, not a MiniLM/BGE response or a Gemini answer. The classifier treated unfamiliar single words as rubbish before Gemini could interpret the conversation.

## Changes
- Meaningful single words, acronyms, numbers and non-Latin text now reach Gemini. Nonempty replies in an ongoing conversation and structured answers retain conversational context rather than entering social/rubbish shortcuts.
- Removed dismissive random jokes. Fresh empty/symbol-only input receives a respectful clarification.
- Added shared guidance to explain course quality through practice, feedback, assessment and support, with examples and useful comparison questions. Provider rankings, campus details and numeric quality benchmarks require evidence.
- A repeated short follow-up gets a focused request to explain more simply, with a definition, a few useful checks and an example. It does not select a skill or assume a provider is better.
- Substantive protocol answers now receive the explanation review in Vanilla mode as well as constrained JSON mode. Table cells count towards review eligibility. The review may improve explanation blocks but cannot change interaction, service actions or state.

## Validation
Focused short-reply and teaching-review tests passed, including table-heavy responses. Production build passed. Earlier regression checks for counselling, routing, Oala, needs and BGE also passed during this change.

Four real Gemini requests in synthetic conversations checked: a provider comparison, contextual “quality”, repeated “quality”, and fresh “quality”. All returned accepted protocol JSON and were not mock/local replies. The final repetition refinement was tested with an additional real request in the synthetic comparison conversation: four readable blocks explained quality, three checks and a practical example, followed by one relevant question. Fresh “quality” produced one brief text block and a choice of course, provider or workplace quality.

Evidence: `output/short-replies/main-flow-live-results.json` and `output/short-replies/repeated-quality-live-results.json`. Earlier diagnostic runs are preserved separately. Those earlier runs exposed unsupported claims and the skipped review; they are not final passing evidence.

## Practical limits
These are sampled generation tests, not a guarantee that every future answer is accurate. No current Box Hill or Swinburne course details were independently verified. The checks deliberately use evaluation guidance rather than ranking providers. Additional explanation review can add response time. Existing saved chat replies are unchanged; subsequent messages use the fix. The 103 skill definitions and CSV were not changed for this shared conversation-handling fix.
