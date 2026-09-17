> Follow-up: [BGE calibration](BGE-Calibration.md) records model-specific skill matching and a separate frozen evaluation. This document is the earlier baseline.

# Routing model comparison — 17 September 2026

Model switching from upstream commit 496e0f7 was selectively integrated into the current local worker. The full upstream worker was not copied because it omits the local post-response suggestions, needs and mini-pathway relevance operations.

- Settings and Lab share RouterModelSelector and subscribe to router status. The selection persists under oala-router-model; disabled browser storage falls back to memory.
- models.ts allowlists pinned L6, L12 and BGE-small revisions. L6 stays default.
- Each switch terminates the previous worker, settles pending requests across all four flows and builds fresh indexes. No embeddings are reused between models.
- MiniLM uses mean pooling and a 256-token application budget. BGE uses CLS pooling and 512 tokens. All vectors are normalised, quantised q8 and browser WASM single-threaded. No automatic retrieval query prefix is added for this semantic classification workload.
- Current score thresholds remain unchanged. Different models require separate calibration before a default switch.
- Gemini still generates answers. No paid Gemini test calls were needed for this encoder comparison.

Results: output/html/Yuzee-Routing-Model-Comparison.html and output/model-comparison/*.json.

825 synthetic browser cases: per model 103 skill routes, 103 topic selections, 20 boundary cases, 16 needs, 16 pathway, 16 suggestion and one token-limit case. A separate Node CPU run also tests lossless long-response chunking. Node CPU timing is not browser timing. Browser startup numbers have mixed cache/download conditions and should not be compared as cold download performance.

Browser exact skill selections: L6 correct 36, wrong 4, abstained 63; L12 correct 28, wrong 1, abstained 74; BGE correct 18, wrong 1, abstained 84. Median browser request times were 9.8, 18.6 and 18.9 ms respectively. L6 and L12 each provided a relevant suggestion in 8/16 examples; BGE in 2/16. These figures are from one synthetic run, with overlapping task definitions scored strictly. They do not certify Gemini output quality or establish a universal best model.

Verification commands: npm run test:router-models; npm run eval:router-models; npm run build. All 17 pre-existing test suites also passed. Browser harness: tmp/model-comparison/browser.html, which runs the actual production worker. The CPU benchmark uses downloaded pinned revision folders so it can run without network metadata lookup. The browser may need network access for first download and library metadata discovery.

Recommendation: keep L6 as operational default. L12 is the lower-error, lower-coverage alternative. BGE has longer input capacity and promising top-rank accuracy, but needs its own calibration and out-of-domain checks before replacing L6.
