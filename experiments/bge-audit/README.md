# Frozen BGE v2 audit

This folder is an isolated experiment. Nothing here is imported by the production chat. The live release remains `bge-single-encoder-v2`, with input-needs v3 and pathway v2 profiles. That input-needs profile number is not a new routing-engine release.

From the project root, with dependencies and pinned q8 model files already available:

```sh
node --import ./node_modules/tsx/dist/loader.mjs experiments/bge-audit/native.ts
node experiments/bge-audit/collector.mjs
```

The collector binds only to 127.0.0.1:3001, accepts a fixed list of synthetic diagnostic filenames and allows the localhost:3000 origin only. It does not accept arbitrary filesystem paths. Stop it when finished. The existing app server on localhost:3000 serves the test pages.

1. Open `/experiments/bge-audit/browser.html` and run the audit. This exports all 103 query vectors/token tensors plus every prototype vector/token batch for batch sizes 12 and 1. Node CPU and browser WASM use the same diagnostic code, model revision, q8 dtype, CLS pooling and normalization.
2. Run `experiments/bge-audit/analyze.ts` through the same Node/tsx invocation to produce all-case and missed-route diagnostics.
3. Run `context.test.ts` for the isolated entity resolver checks. `confusion-suite.json` is a synthetic, author-labelled development suite; it is not an independent release test.
4. `/experiments/bge-audit/extra.html` tests that candidate and the confusion suite using the saved browser-generated batch-12 index. The prototype manifest checks bytes, revision, browser identity and vector shape. This is a proof of reuse, not a persistent production cache implementation. The source index must come from the matching browser audit.
5. Run `verify.ts` to check every frozen runtime hash, all 103 original browser decisions, diagnostic completeness and absence of fabricated human labels.

The original live startup overlaps tokenizer and model loading. Audit timestamps distinguish library import, tokenizer completion, combined model/session loading, and index generation. They do not separately isolate all internal WASM initialization and ONNX session phases. Main-page JavaScript heap counters exclude worker/WASM memory and cannot certify mobile peak memory.

## Human review

`blind-human-review.jsonl` contains 131 shuffled, unlabelled synthetic requests. It omits the model predictions and the author's intended labels. A reviewer must decide whether to answer normally, select a skill, clarify, research, or abstain, then choose any applicable skill IDs and explain the choice. Two reviewers should label separately before seeing each other's answers. A third person should adjudicate disagreements. Actual independent review is pending.

Use `real-user-collection-template.json` to collect de-identified or consented genuine examples. Keep all examples from one conversation or paraphrase family in the same split. Assign development/calibration/test splits before candidate tuning. Existing regression cases and cases used to adjust candidates must not become the claimed untouched test set.

## Device validation

Use `device-matrix.json` as the test record. Fill hardware, OS/browser versions, execution provider, cache state, startup, latency percentiles, responsiveness, full process peak memory, cache persistence, background/resume and errors. Missing observations stay null. A desktop viewport or user-agent override does not count as an iPhone/Android hardware test.

Use a device-accessible test build for physical mobile devices; the localhost-only collector is intentionally not exposed on the network. Export device evidence through a reviewed local download or an approved test-data endpoint. Do not expose the live chat server or conversations simply to run this harness.

## v3 promotion remains gated

Do not activate the context candidate, change the live prototype batch size, reuse CPU vectors in browser indexes, lower global thresholds, train weights, or label this production-certified on the strength of these experiments alone. Finish independent labels, device runs, and targeted confusion fixes, then rerun frozen baselines and untouched evaluation. The exact operator/kernel contribution to CPU/WASM numeric variation remains unresolved even though tokenization and pooling have been ruled out and batch effects demonstrated.
