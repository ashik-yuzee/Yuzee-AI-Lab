# BGE readiness and test plan

17 September 2026. Status: audited candidate; no routing profile, Gemini prompt or model default changed by this assessment.

## Decision

Continue with BGE as the candidate skill router. The next improvement should target context, confusion between neighbouring skills and acceptance rules. Raising cosine scores or increasing the number of suggestions is not the objective. Increase correct, useful selections while controlling wrong selections and preserving ordinary Gemini counselling when the router abstains.

The supplied migration specification is a good direction, but parts describe future work rather than the current implementation. In particular, the current model selector is shared across skill, needs and pathway inference; browser per-case failure records were not saved; and the present calibration script overwrites profile v1. These need attention before a controlled default switch.

## Current evidence

| Recorded browser metric | BGE v1 result | Interpretation |
|---|---:|---|
| Correct accepted routes | 40/103 | 38.8% of skill requests received the intended skill |
| Wrong accepted routes | 1/103 | 1 of the 41 accepted routes was wrong |
| Accepted precision | 40/41 = 97.6% | Correctness when the router actually chooses |
| Abstentions | 62/103 | No skill selected; Gemini can still answer |
| Intended skill ranked first | 83/103 = 80.6% | Ranking is stronger than final acceptance |
| Unrelated cases activated | 0/24 | Good small-sample result, not proof of zero future errors |
| Useful suggestion excerpts | 8/24 | Separate opportunity to improve recommendations |
| Wrong browser suggestions | 0 | Native CPU did have one wrong suggestion |
| Warm median / p95 | 19.4 / 28.4 ms | Prior reference-machine results, not download or cold-start times |

These are the existing frozen, same-author synthetic results, not a new browser evaluation. One wrong route is 0.97% of all 103 requests but 2.44% of accepted routes. Do not call this 99% accepted accuracy.

The persisted native CPU run had 43 correct, zero wrong and 60 abstentions. Its first reported rejection reasons were: 26 ambiguous between skills, 18 below minimum similarity, 15 insufficient separation from background, and one correction/boundary guard. Multiple gates can fail at once. Of those 60 abstentions, 38 already ranked the intended skill first: 18 ambiguous, eight low-similarity, 11 background separation and one guard. These are candidates for investigation, not 38 guaranteed recoverable successes. The intended skill was in the CPU top three for 95/103 cases.

The browser summary contains only aggregates, so those CPU reason counts must not be presented as the explanation for the browser's 62 abstentions. Capture per-case browser rankings and every failed gate on the next run.

## Fresh checks completed for this assessment

- The actual pinned Xenova q8 BGE artifact produces a 384-value vector matching the normalised first-token representation. Norm: 0.9999999333; maximum difference from manual normalisation: 0.0000000259.
- The real BGE tokenizer accepts 512 total tokens and rejects 513, including special tokens. Dense punctuation can exceed the budget despite being below the character limit.
- All 217 current prototypes fit the BGE budget; the longest uses 85 tokens. These are 206 skill descriptions and 11 background descriptions.
- Three roughly 6,000-character response probes with the request at the beginning, middle and end retained every character across measured chunks. This verifies retention, not correct semantic matching or final suggestion quality.
- The same long texts are refused by the direct-route 1,800-character guard. Direct user routing and post-response chunking are different paths.
- Current guards reject short direct requests such as “compare them”, “show jobs” and “what about cost?” before embedding. “How can I stop feeling overwhelmed by course choices?” is also rejected by the broad stop-word guard. These are router outcomes, not failures of Gemini to answer.
- TypeScript checking passed. Frozen evaluation inputs and runtime profile hashes remain unchanged.

Reproduce: `node --import ./node_modules/tsx/dist/loader.mjs scripts/audit-bge-readiness.ts`. Output: `output/bge-readiness/audit.json`. This audit does not call Gemini, tune gates or repeat the full browser benchmark.

## Remaining work in priority order

### 1. Separate the routing flows before changing the default

The same worker/selected encoder currently builds skill, needs and pathway embeddings. Their index text and thresholds may remain unchanged while their scores change because the encoder changed. Introduce explicit per-flow model/profile ownership. Initially keep L6 for needs and pathway checks while evaluating BGE for skills; separately approve BGE topic matching and suggestions. Measure the extra download, memory and queue cost of two encoders instead of assuming this is free. Preserve a clear L6 rollback.

Current BGE needs results were 12/16 versus L6 11/16, but pathway results were 12/16 versus L6 14/16. Neither tiny set establishes superiority. Do not migrate these flows by implication.

### 2. Build a complete benchmark record

Save per-case predictions, top three skills, scores, all failed gates, resolved context, response source ID, selected profile, artifact/tokenizer hashes and flow. Include finite/L2 vector checks and a fixed 10-20-message browser/native parity suite. Compare ranking and final decisions; small numerical differences near thresholds need examination rather than a blanket tolerance that hides changed decisions.

Record routing, topic navigation and suggestions separately. Keep expected labels and accepted alternatives independently reviewed. A UI decision to hide suggestions during an active question is correct behaviour, not a model miss.

### 3. Add explicit context for short follow-ups

The current explicit @Oala route passes the latest message alone. Construct a compact input with latest user intent, resolved subject(s), relevant explicit constraints and latest question when relevant. Resolve “these” to the two courses in the current conversation; do not append unrelated history or treat earlier assistant guesses as user facts.

Check the original user request for stop/correction intent before context expansion. Otherwise adding context could accidentally bypass a real stop. When the reference is missing or ambiguous, abstain and let Gemini clarify. Handle literal uses such as “stop feeling overwhelmed” without treating them as a command to stop the conversation. Keep unaddressed free-text counselling and explicit skill-injection boundaries unless the product deliberately changes them.

### 4. Define separate long-input policies

For a long user message or pasted document, the final explicit question must control the task. Segment source material and retain boundaries/provenance; never choose the most frequent skill mentioned in a document as if it were the user's request. Decide whether the safe path is a compact context query or no skill with normal Gemini handling. Do not remove the size guard without designing this behaviour.

For long Gemini responses, evaluate heading-aware chunks with a repeated section title or small overlap. The current recursive word-boundary split preserves characters but can separate an explanation from its heading, negation or referent. Test topic at start/middle/end, split-spanning meaning, contradictory paragraphs, repeated boilerplate, quotations and multiple topics. Keep deduplication and the three-offer maximum.

Test the real limits too: 1,800/1,801 characters on direct routes, 30,000/30,001 characters on response review, and 96/97 chunks. Above-limit inputs should follow an explicit fallback; they must not silently lose the end of the text or stall chat.

### 5. Improve distinctions between neighbouring skills

Review each of the 103 BGE matching descriptions using object, requested action and intended result. Add diverse short/long positive examples and close negatives for ambiguous families. Maintain a balanced number of useful prototypes per skill: unlimited examples with max-score aggregation can favour heavily represented skills.

Priority families: course structure/units/specialisations/skills; skill gap/next skills/candidate readiness/gap plan; company roles/internal mobility/industry roles; RPL/credit transfer/entry/pathways; career progression/change/internal mobility. The observed Company Roles to Internal Mobility error belongs in permanent regression coverage.

Preserve the 103 Gemini mini-prompts and learning/input contracts. Change the matching layer, not the counselling skill content, to fix a routing error.

### 6. Run controlled experiments and version the candidate

Compare one conceptual change at a time: current input versus resolved context; current matching text versus revised prototypes; query prefix versus no prefix; current chunking versus heading-aware chunks. Keep skill descriptions unprefixed. BAAI recommends deciding the query-instruction choice on downstream performance, and cautions against treating absolute similarity values as universal relevance thresholds. [BGE model card](https://huggingface.co/BAAI/bge-small-en-v1.5/blob/main/README.md)

Only then search gates on development/calibration data. The current grid ends at 0.65 similarity and 0.12 background margin, both selected v1 values, so expand the tested range in both directions when justified. Lowering every threshold is not a valid strategy. The current fitter targets 95% accepted precision and copies route gates to topic matching; both need stronger, independently measured targets.

Write candidate profiles and results to new versioned files. The current `calibrate:bge` command writes `bge-calibrated-v1` over the runtime profile; do not use it unchanged for migration experiments. Preserve v1 and the original frozen corpus. The existing evaluation lock intentionally rejects changed input hashes; give a new candidate an explicit evaluation record instead of disabling the check.

If context, descriptions and gates plateau, evaluate a bounded top-three reranker or a small supervised intent head as a separate experiment. Fine-tuning the encoder is later work requiring reviewed examples, close negatives, export/quantisation checks and untouched evaluation. Neither guarantees better results or acceptable browser cost.

## Test matrix

| Test group | Inputs and variations | What must be checked |
|---|---|---|
| Very short | 1-3 words: quality, fees, compare them, why? | Paired with valid, missing and ambiguous context; never invent a referent |
| Short natural language | 4-15 words, abbreviations, misspellings, informal grammar | Intended skill survives realistic phrasing; evaluate learner language rather than only catalogue terms |
| Medium | 16-100 words, personal constraints and two related concerns | Relevant task and explicit facts retained; multi-intent handled without arbitrary narrowing |
| Long user messages | 100-400 words and 1,800-character boundaries | Explicit question governs selection; over-limit fallback; quoted instructions treated as data |
| Embedding boundaries | 255/256/257 and 511/512/513 measured tokens | Model-specific budgets, special tokens and dense punctuation; no silent truncation |
| Long output/documents | 1,000-5,000 words; intent at start/middle/end | Separate direct routing from response review; semantic context survives chunking |
| Maximum response review | 30,000/30,001 characters; 96/97 chunks | Predictable fallback, queue responsiveness and no incomplete misleading offers |
| Conversation state | Pronouns, goal changes, corrections, older facts, multiple active courses | Correct subject; stale facts replaced; no cross-conversation leakage |
| Closely related skills | Positive, subtle positive and close-negative pairs for each family | Company role catalogue must not become internal mobility, for example |
| Multiple tasks | Fees plus course comparison plus entry requirements | Keep full request with Gemini or an explicitly designed planner; no silent single-task substitution |
| No-skill and boundaries | Greetings, unrelated topics, stop requests, unsafe requests, no-context fragments | Correct abstention; ordinary chat remains usable |
| Suggestions | Short/long completed answers, active questions, duplicates and irrelevant sections | Useful optional offers, no wrong offers, max three, valid source message and active-question suppression |
| Runtime | Cold download, warm cache, refresh, switch, cancellation, worker error, network failure | Chat continues; stale workers cannot update current state; bounded waiting |
| Devices and language | Actual supported browsers, low-memory device, multilingual/mixed-language text | Explicit support boundaries; do not claim this English model provides multilingual coverage |
| End to end | Request to chosen skill to Gemini to validated output | Correct instruction/context; clear teaching; necessary questions only; no invented factual claims |

## Data and measurement plan

Use three clearly separated roles: development data for improving descriptors/context and fitting thresholds; the current frozen corpus as permanent regression; and newly collected, independently labelled final evaluation. If a final-evaluation failure informs a change, move that case into regression and use fresh final evaluation. Split by conversation, author/template and source document so paraphrases or chunks from the same example cannot leak across splits.

Recommended development coverage is 10-15 varied examples for each of the 103 skills, with clear positives and neighbouring-skill negatives. Add dedicated short/context/long-response sets and at least 300 diverse negative cases. These quantities are a proposed coverage plan, not a guarantee or a completed dataset. Have a domain reviewer check labels, ambiguous cases and acceptable alternatives rather than treating BGE predictions or one AI's labels as truth.

Use an independently reviewed 500-1,000-message initial final set where feasible, with enough accepted decisions to measure precision. Keep natural traffic proportions as well as a balanced per-skill diagnostic set. Hundreds of duplicate paraphrases do not substitute for independent conversations. Start with a smaller pilot to validate the test harness, then expand before making production claims.

Report correct accepted, wrong accepted, abstained, accepted precision, activation coverage, correct coverage, top-one/top-three ranking, false activations, per-skill confusion, all rejection reasons and confidence intervals. Report macro/per-family results so a gain in frequent course questions cannot hide poor performance elsewhere. Measure suggestion relevance and useful response coverage independently of automatic routing.

## Proposed release gates

1. Preserve at least the old browser baseline: 40 correct, no more than one wrong, top-one at least 83/103, all 24 old negatives rejected, at least 8/24 useful suggestions and no wrong offers on that regression set. Retain the CPU wrong-suggestion case too. These are minimum non-regression gates, not production certification.
2. Aim for at least 99% accepted precision on the independent evaluation while improving correct coverage, with uncertainty reported. Do not promise a particular coverage percentage before testing. Zero observed negative activations is a test gate, not a guarantee of zero real-world risk.
3. Sample sizes matter: zero errors in 24 independent negative cases still permits an approximately 11.7% one-sided 95% upper error bound. Roughly 300 independent zero-error cases are needed to bring that bound near 1%. Similarly, 300 total messages are not 300 accepted routing decisions.
4. All current 20 npm suites, relevant new tests, browser integration and build must pass. Connect catalogue integrity checks to CI/build verification; the current build command only type-checks and bundles.
5. Evaluate representative Gemini answers under the same model/settings and source context, comparing intended skill versus no-skill or wrong-skill behaviour. Review correctness, clarity, practical depth, helpful examples and unnecessary questions. Expand to all skills before claiming all-103 quality certification.
6. Record cold download, initialisation, index build, warm p50/p95/p99, queue wait, first useful result, memory and UI responsiveness on the same devices. Establish device-specific budgets before tuning. Existing inference medians are not a cold-start promise. [ONNX Runtime performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html)
7. Roll out locally, then in a controlled comparison/shadow mode where resource costs permit, then a small opt-in cohort. Retain model/profile rollback and independently controlled flows. No production telemetry should automatically train the model or redefine correct labels.

## Suggested next implementation batch

First add per-flow model ownership, versioned benchmark/profile output, complete browser failure export and the short-context test harness. Reproduce v1 on the browser. Then improve context and the most confused skill families using development data, choose one v2 candidate and run the full regression plus untouched evaluation. This provides an attributable before/after result instead of several simultaneous changes with no clear cause.

Current recommendation: keep BGE as an optional candidate while completing this work. This audit added only the reproducible assessment script and reports. It did not claim an increased routing score, change runtime gates or switch the default.
