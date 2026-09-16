# Structured teaching implementation — 16 September 2026

> Current amendment: see [Counselling-Clarity-Update.md](Counselling-Clarity-Update.md). Fixed section counts and never-compress rules described in earlier work are superseded by flexible, task-appropriate teaching. All 103 snippets use the updated counselling guidance.


The original master prompt file and separate concept app are unchanged. Shared application guidance and a per-task teaching contract now expand substantive explanations without requiring an explicit request for more detail.

## Runtime

- `src/routing/learningContracts.json`: all 105 source IDs, required context, expected information, evidence rule and teaching profile. Two internal tasks do not generate lessons.
- `src/routing/learningProfiles.json`: 13 task-specific explanation structures. The skill structure groups the user's 13 dimensions into eight visible sections.
- `src/routing/learningDepth.ts`: appends the matching server-owned contract to a selected snippet. Original task-specific guidance is retained. This does not alter MiniLM index descriptions or thresholds.
- `src/prompts/learning-depth.md`: ordinary-chat and fallback guidance, assembled after the master and existing application rules. Brevity, closure, small activities and narrow corrections remain exceptions.
- `src/services/TeachingAnswerReview.ts` and `server.ts`: one additional bounded model call for explanations with at least 120 words or three titled blocks, excluding safety, closure and service intents. Structured output must be enabled. Review uses the current request and ten recent conversation messages, not independently retrieved sources. It can edit only content blocks, preserves state/actions/interaction, combines provider usage and withholds failed review results. Final canonical validation still runs. A lower-than-threshold answer can bypass this model review; it still receives shared guidance and schema validation.
- `ProtocolV13Renderer`: summary before section links, all content visible, unique per-turn anchors, semantic text-section headings and no duplicate Factor column where a matching explicit criteria column already supplies the exact same values.
- `streamProgress`: explicit review progress, no exposed private reasoning.

## Rebuilding guidance

After updating source mappings, run `python3 tmp/depth/build-contracts.py`. After editing profile definitions, run `python3 tmp/depth/build-guidance.py`. Restart the local server to reload prompt assets. These generators do not rewrite the original master prompt or CSV.

Run `npm run test:learning-depth`, `npm run test:routing`, `npm run test:routing-tokens`, `npm run test:oala`, `npm run test:ux`, `npm run test:output`, the main-chat streaming test and `npm run build` as relevant. The tokenizer test needs the local model cache. Live scripts in `tmp/depth` use the configured Gemini key and synthetic conversation data; they incur provider usage. Do not treat their schema-success status as a complete factual or learning-quality evaluation.

## Evidence and limits

The final initial-turn evaluation covers 18 scenarios plus a separate focused follow-up. The gallery renders recorded accepted responses with the same response component as the main app. It is a preview, not a set of verified real courses or job recommendations.

The review improves factual restraint but remains fallible. Per-tool source retrieval, stable long-term evidence references, strict semantic coverage enforcement, output-limit recovery and user comprehension testing remain necessary. Prompt coverage across every registry ID is not proof of reliable routing or correctness for every possible request. Longer explanations add a review call and additional latency/cost. Existing production-build bundle-size warnings remain.


## Individual tool review follow-up (16 September 2026)

All 103 user-facing snippets now also have individually authored decision logic, missing-data handling, scope boundaries and output priorities. See `Individual-Tool-Logic-Review.md` and `output/html/Yuzee-103-Tool-Logic-Review.html`. Shared depth coverage alone was not individual review; this follow-up updates the actual runtime snippets. Retrieval and full routing/content certification remain separate.
