# BGE in Yuzee: tuning results and handover

17 September 2026 · Local implementation · Release bge-single-encoder-v2

**BGE-small is now the single embedding model in the local app.** Its routing rules have been calibrated, the input-needs and pathway checks have improved, and the app is running with the update. Gemini still writes the responses. This release is ready for local testing; independent production validation remains outstanding.

This is application calibration, **not training BGE’s neural-network weights**. The approved pretrained, quantized model is unchanged. We improved its examples, decision thresholds, context handling and execution. The 103 user-facing Gemini skill prompts and their depth/input contracts were preserved.

## What changed

- **One BGE encoder:** old saved L6/L12 selections migrate to BGE. Main-chat settings show BGE only. Historical model definitions remain available to offline comparison scripts; they are not fallback browser workers.
- **Five separate decisions:** skill routing, quiz-topic routing, follow-up suggestions, input needs and pathway relevance have separate profiles. One shared queue gives user requests priority over optional suggestion scans.
- **Stronger input-needs and pathway examples:** these tasks now have their own BGE descriptions and thresholds. A weak clarification match cannot encourage an unnecessary question.
- **Short follow-ups reuse explicit user context:** “what about cost?” can use a previously named qualification. The resolver looks at up to three recent user turns, respects topic changes and rejects ambiguous references. It does not treat assistant statements as confirmed user facts.
- **Long responses are scanned in chunks:** token checks occur before embedding. Oversized direct routing requests abstain; the full message can still go to Gemini. Nothing is silently cut off and then presented as a complete routing decision.
- **Cancellation and validation:** cancelled jobs stop between chunks; stale replies are ignored; optional timeouts do not destroy the encoder. Build checks verify the pinned files, tokenizer boundary, CLS pooling, normalization and 384-dimensional vectors.

## Measured browser results

These are fixed synthetic regression cases, not a claim about all future users. Correct abstention means deliberately making no embedding-based selection; Gemini’s normal conversation remains available.

| Check | Previous BGE baseline | This release | Meaning |
|---|---:|---:|---|
| Pathway decisions | 12/16 correct | **15/16 correct** | Improved relevance checks; one missed relevant request remains |
| Input-needs decisions | 12/16 correct | **13/16 correct** | Improved answer / research / clarification classification; three research requests abstain |
| Skill routing | 40 correct, 1 wrong, 62 abstain | **40 correct, 1 wrong, 62 abstain** | Previous coverage and error count preserved |
| Best-ranked skill before thresholds | 83/103 | **83/103** | Ranking quality is not the same as an accepted correct route |
| Useful follow-up suggestions | 8/24 responses | **8/24 responses** | Zero incorrect suggestions in this browser set; coverage remains limited |
| Unrelated requests | All 24 rejected | **All 24 rejected** | No selected route and no suggestion for these examples |
| Additional input-needs cases | New regression set | **15/18 correct** | Zero wrong accepted hints; three abstentions on in-scope requests |
| Additional pathway cases | New regression set | **15/16 correct** | Zero wrong accepted hints; one relevant request abstains |

Skill routing accepts 41 of 103 cases: 40 are correct (97.6% precision among accepted routes), but it only correctly routes 38.8% of the complete set. **Do not report 97.6% as overall routing accuracy.** Quiz-topic routing separately produced 41 correct selections, one wrong selection and 61 abstentions.

## How the conversation now works

1. The user sends a message. The input-needs check can advise answer, research or clarification; existing input contracts decide which information is actually missing. Structured quiz answers keep their controller.
2. Where the flow requests skill routing (including @Oala), BGE scores eligible skills. Quiz-topic selections use their own routing profile. If a clear, valid match exists, the server accepts the approved skill ID and includes that skill’s instructions with the user’s request and conversation context.
3. Gemini generates the answer using the main prompt and any approved skill instructions. BGE does not write the explanatory text or establish factual accuracy.
4. After Gemini replies, BGE can review that response for relevant follow-up skills. Existing UI rules hide suggestions when Gemini is asking a question. Clicking a skill follows its input contract: use known information, ask only for missing required information, then request the answer.
5. A separate BGE check assesses pathway relevance. The existing quiz-confidence policy still decides whether to generate automatically or suggest it: below 40 can auto-trigger when its other conditions pass; higher confidence uses a suggestion. Unknown confidence is not treated as low confidence. Saved pathways and the right-side drawer continue to use the existing flow.

The BGE similarity score is **not a probability**. A score of 0.70 does not mean “70% certain”, and it is separate from the quiz’s confidence score.

## Short and long text: what passed and what remains

| Scenario | Observed result |
|---|---|
| Named Bachelor of Nursing, followed by “what about cost?” | COURSE_011 selected; browser and server agreed; the live Gemini request included the approved skill |
| “quality”, “what jobs?” or “go deeper” after that course | Context resolved, but competing skills were too close; safely abstained rather than choosing an arbitrary skill |
| “compare them” with only one known course | Asked no embedding model to guess the missing comparison target; abstained for missing context |
| “what about that one?” | No unsupported reference was inferred; no automatic skill injection |
| Relevant cost topic at the start, middle or end of a long response | Relevant skill found in all three cases; 5 / 9 / 5 chunks over about 9,285 / 18,467 / 9,285 characters |
| Dense 600-character punctuation exceeding the token budget | Rejected before embedding; proves character count alone is insufficient |
| Direct routing messages above the 1,800-character limit | Abstained explicitly; no silent truncation |
| Suggestion scan interrupted by a user request | User routing completed before the optional scan; cancellation produced no stale reply and the next request worked |

The short-reference resolver currently recognizes explicit qualification names. It is not a complete general-purpose entity resolver for every career, provider or earlier conversation topic. Long-text checks are controlled synthetic examples, not proof that every PDF or mixed-intent document is handled correctly. Suggestion scans are bounded to 30,000 characters and 96 chunks.

## Error found during testing and fixed

“Find the deadline for applying to the Master of Education at Griffith University” weakly matched clarification in the browser: 0.5502 similarity, with only 0.0229 separation from the next class. That could cause an unnecessary question.

The final input-needs profile requires at least **0.60 similarity and 0.04 separation for clarification**. Answer/research keep 0.55 and 0.01. The fresh browser run now abstains on this example. This prevents the wrong clarification hint; it does not yet recover the correct research classification.

## Evidence and practical limits

- **21 automated test suites passed.** The affected release and needs tests, plus the production build, passed again after the final clarification change. The final recorded release checks also passed.
- **Three real Gemini turns passed** protocol/schema/semantic validation using a synthetic conversation, including an accepted cost skill and an ambiguous follow-up that received no skill injection. Provider usage confirmed these were not mock responses. This verifies integration, not the factual correctness of every generated claim.
- **360 browser worker requests** ran through the actual shared worker. Mixed-workload warm latency was about 16.4 ms median, 29.9 ms at the 95th percentile and 55.6 ms at the 99th percentile on this computer. Queue priority and cancellation passed. The first worker initialization took 14.0 seconds with model assets already cached; this is not a cold-network download test.
- **Browser/native parity remains incomplete.** CPU and browser produced four different skill-routing decisions with the same pinned artifacts. Native selected 43 correct / 0 wrong; browser selected 40 correct / 1 wrong. Native also produced one incorrect suggestion that did not appear in the browser run. Do not substitute the native score for deployed browser performance.
- **Known browser routing error:** an Australia Post job-family comparison selected COMP_012 rather than the expected COMP_002. Skill routing was preserved instead of lowering thresholds to inflate coverage.
- **Independent testing is still required.** Additional task cases were authored before fitting, but a browser failure informed the final clarification rule. Those cases are now regression tests, not untouched independent evaluation. All current labels are from synthetic, single-author datasets.

## Next improvement cycle

1. Collect an independent, human-reviewed set covering all 103 skills. Start with at least ten varied requests per skill, plus unrelated and deliberately ambiguous requests. Keep families of near-duplicate wording in one split so they cannot leak between training and evaluation.
2. Include one-word messages, spelling mistakes, short follow-ups, changes of course, corrections, multiple courses, family/work constraints, uncertainty, cancellations, and requests with more than one intent. Test relevant information at the start, middle and end of long text and around the tokenizer limit.
3. Improve skill descriptions and hard negatives on the development split, then calibrate in the browser runtime. Report wrong selections, useful coverage, unnecessary questions and missed suggestions separately for every skill and task. Do not lower thresholds solely to increase the number of selections.
4. Resolve the four browser/native differences and test Safari/Chromium, low-memory devices, slow first downloads, offline startup, multiple tabs and interrupted requests. Use real end-to-end conversations to verify input collection, source fetching, response depth and display.
5. If those steps still leave confusing skill pairs, train BGE weights using reviewed positive pairs and hard negatives. Export, quantize, rebuild every embedding index and recalibrate all five tasks before comparing against the frozen baseline on a genuinely untouched set. Weight training has not been done in this release.

## Developer reference

| Profile | Similarity / separation / domain separation | Query instruction |
|---|---|---|
| Skill route v1 | 0.65 / 0.04 / 0.12 | Raw query |
| Quiz topic v1 | 0.65 / 0.04 / 0.12 | Raw query |
| Suggestion v1 | 0.65 / 0.05 / 0.12 | Raw query |
| Input needs v3 | 0.55 / 0.01; clarification 0.60 / 0.04 | BGE retrieval query prefix |
| Pathway v2 | 0.70 / 0.08 | Raw query |

The development experiment compared raw queries with the BGE retrieval instruction. We retained raw inputs for skill/pathway routing and enabled the instruction only for input needs. This application-specific choice was measured; it is not a claim that one prefix is best for every use of BGE. See the [official BGE model documentation](https://huggingface.co/BAAI/bge-small-en-v1.5).

Pinned model: Xenova/bge-small-en-v1.5, revision ea104dacec62c0de699686887e3f920caeb4f3e3, q8, CLS pooling, L2 normalization, 384 dimensions, 512-token budget. File hashes are in src/routing/bgeArtifact.json. The build requires the approved model/tokenizer files in data/minilm-cache at that revision; a clean checkout must obtain these files before the build gate can pass. Dependencies are installed with npm ci. No API key is included in this report.

Reproduce from the project root:

```sh
npm run tune:bge
npm run eval:bge-tasks
npm run test:bge-release
npm run test:router-models
npm run test:needs
npm run build
node --import ./node_modules/tsx/dist/loader.mjs scripts/verify-bge-release.ts
```

With the local server running, open /tmp/model-comparison/bge-v2-browser.html and choose “Run BGE validation”. The harness uses synthetic input only and makes no Gemini calls. The recorded live smoke test is separate and incurs provider usage when repeated.

Evidence files under output/bge-v2:

- browser-final-checks.json — fresh final browser summary, concurrency and clarification regression.
- browser-results.json — earlier detailed browser rankings before the final clarification guard; retained as historical evidence, not relabelled as a final run.
- clarification-guard-validation.json — reclassification of those recorded vectors with the final rule; the fresh browser run confirmed its counts.
- tasks-native.json and runtime-differences.json — native checks and browser/native discrepancies.
- development.json — tuning experiments; test-suites.json — automated suite records.
- live-integration.json — three real Gemini integration checks; release-manifest.json — final implementation fingerprints.

Frozen v1 calibration and its evaluation lock remain intact. Earlier handover ZIPs are historical snapshots and have not been silently replaced with this release.
