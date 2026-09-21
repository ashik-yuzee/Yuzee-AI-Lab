import fs from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
const root='output/bge-audit/';
const a=JSON.parse(await fs.readFile(root+'analysis.json','utf8')),extra=JSON.parse(await fs.readFile(root+'browser-extra.json','utf8')),cases=JSON.parse(await fs.readFile(root+'all-103-browser-cases.json','utf8'));
const f=(x:number)=>x.toFixed(4),ms=(x:number)=>x.toFixed(1);
const rows=a.disagreements.map((r:any)=>`| ${r.expected} | ${Object.values(r.variants).map((v:any)=>`${v.decision.status==='selected'?v.decision.toolId:'Abstain'} (${f(v.top1.score)} / ${f(v.skillMargin)})`).join(' | ')} |`).join('\n');
const md=`# BGE v2 audit: findings and next steps

18 September 2026 · Current production-facing local release remains bge-single-encoder-v2

**The current release is frozen. No v3 release has been activated.** All 131 frozen runtime files still match their recorded hashes, and all 103 browser routing decisions reproduce the prior baseline exactly. Model weights, live thresholds and the 103 Gemini skill prompts are unchanged.

The audit has identified the main coverage bottleneck and startup cost. It also documents the four CPU/browser disagreements at token, vector and decision level. Some numeric differences still require lower-level runtime investigation. Physical-device validation and independent human labels remain outstanding.

## Results at a glance

| Work | Result |
|---|---|
| Freeze current release | 131 runtime files verified unchanged |
| Export all browser cases | 103 complete records, including vectors, token IDs, top five scores and every failed gate |
| Correct first-ranked skill but no route | 43 cases identified and grouped |
| Four CPU/browser differences | Same tokens; batch-dependent and runtime-dependent vector changes before pooling |
| Expanded entity context | Isolated candidate covers 9 entity types; 20 resolver tests passed |
| New confusion suite | 28 synthetic cases: 15 correct decisions, 1 wrong accepted route, 12 missed in-scope requests |
| Startup diagnosis | About 12.8 seconds rebuilding the skill index; encoder ready in about 0.4 seconds |
| Prototype reuse experiment | Skill-router readiness ${ms(extra.cacheExperiment.readyMs)} ms with the exact browser index reused |
| Independent labels | 131 blinded requests prepared; no human labels fabricated or completed |
| Device certification | In-app Chromium measured; remaining device matrix explicitly not run |

## Why BGE declines correct first-ranked skills

BGE still ranks the intended skill first in 83 of 103 cases, while selecting 40 correctly, selecting one incorrectly and abstaining in 62. Of the 43 correct-first-ranked cases that abstain:

| Failed check | Cases |
|---|---:|
| Separation from the next skill is too small | 38 |
| Separation from the background examples is too small | 20 |
| Absolute similarity is below the minimum | 9 |
| A guard prevents routing | 1 |

Counts overlap because a case can fail more than one check. The largest opportunity is distinguishing related skills. A single global threshold reduction would also admit more questionable matches.

Every exported case includes expected ID, top two IDs and scores, top five scores, skill margin, background score and margin, all failed gates, context used, responsible guard, tokens and embedding. These baseline cases are single-turn requests, so context used is explicitly null. “Bad description” and “genuinely ambiguous” remain unadjudicated review categories: a score alone cannot prove either explanation.

One guard issue is visible in the RPL family: a positive request to credit prior learning uses alternative wording that the broad correction/boundary guard rejects. That needs a targeted intent distinction, together with negative tests for genuine requests to stop. It has not been patched in the frozen release.

## The four runtime disagreements

Each cell shows the selected ID or abstention, followed by top similarity / skill margin. Thresholds are unchanged: minimum 0.65, skill margin 0.04, background margin 0.12.

| Expected skill | Native, individual prototypes | Native, batches of 12 | Browser, individual prototypes | Browser, batches of 12 |
|---|---|---|---|---|
${rows}

What the controlled comparisons establish:

- Query token IDs, token counts, token-type IDs and attention masks match across runtimes. Prototype token tensors match when the batch arrangement matches.
- CLS pooling and L2 normalization agree with the raw first-token output to below 0.0000001 in the pooling check. Pooling is not the source of these differences.
- Native and browser query vectors differ by up to ${f(a.parity.queryMaxAbsDifference)} in an element. Batched prototype vectors differ by up to ${f(a.parity.prototypeBatch12MaxAbsDifference)}. These are differences produced by inference before pooling, not different tokenization rules.
- Batch composition matters in both runtimes. COURSE_004 and COMP_005 cross the native skill-margin boundary when the index switches from individual descriptions to batches of 12. Changing browser batching also changes decisions, but does not remove the incorrect company-role route.
- Runtime variation remains even with matching batching. COMP_002’s wrong leading skill clears the 0.65 browser cutoff but stays below it natively. COMP_010 crosses the 0.04 margin boundary.
- The installed engines are also different builds: ONNX Runtime native 1.24.3 and web 1.26.0-dev.20260416-b7804b056c. **The exact operator/kernel contribution is not yet isolated.** It would be inaccurate to attribute everything to one specific rounding operation or to claim parity is solved.

The next parity experiment should align runtime versions where supported, capture intermediate quantized operator output or ONNX profiling for the affected inputs, and compare optimized/unoptimized execution with the same token tensors. No tolerance or acceptance threshold was loosened to conceal the differences. Browser output remains the deployed reference.

## Startup: where the 14 seconds go

| Measured stage, existing caches | Time |
|---|---:|
| Worker creation / entry | ${ms(a.startup.workerCreationMs)} ms |
| Transformers library import | ${ms(a.startup.libraryImportMs)} ms |
| Model loading and ONNX session, combined | ${ms(a.startup.modelLoadAndSessionMs)} ms |
| Tokenizer completion from concurrent component start | ${ms(a.startup.tokenizerLoadMs)} ms |
| Encoder ready, including import | ${ms(a.startup.encoderReadyMs)} ms |
| Skill index construction, batches of 12 | ${ms(a.startup.skillIndexMs)} ms |
| Needs and pathway indexes | ${ms(a.startup.auxiliaryIndexMs)} ms |

Tokenizer and model loading overlap, so their times must not be added. The observed v2 critical path is about ${(a.startup.estimatedCurrentCriticalPathMs/1000).toFixed(2)} seconds. The public loader does not expose every internal WASM/session phase separately; the combined model/session measurement is labelled accordingly. This was not a cleared-cache network download test.

An isolated experiment loaded the exact browser-generated skill index and verified its SHA-256, model revision, browser identity and vector dimensions. Index loading took ${ms(extra.cacheExperiment.indexLoadMs)} ms; skill-router readiness took ${ms(extra.cacheExperiment.readyMs)} ms. This demonstrates the potential of reuse. **It excludes rebuilding auxiliary needs/pathway indexes and is not a completed production persistent-cache implementation.**

A future cache needs invalidation keys for model revision and bytes, tokenizer, prototype text/order, batch size, pooling, normalization, embedding runtime and execution provider. It also needs corruption, storage-quota, eviction, offline and cancellation tests. Reusing a native-generated index in the browser is not approved by these results.

## Entity context candidate

The isolated resolver recognises COURSE, JOB, CAREER, SKILL, COMPANY, INSTITUTION, INDUSTRY, PATHWAY and QUALIFICATION. It only uses explicit user turns, keeps provenance and rejects unsupported references. “What about that one?” still abstains. Unknown company names without an explicit company cue also abstain; the initial named-company allowlist is intentionally small.

Nine positive entity examples and eleven ambiguity, correction, negation, length and provenance checks passed. Resolving an entity does not itself mean the router will choose a skill:

| Conversation | Browser candidate outcome |
|---|---|
| Deloitte → “What roles do they hire?” | COMP_002 selected correctly |
| Learn Python → “What jobs use it?” | SKILL_011 selected correctly |
| Named course or qualification → “What about cost?” | COURSE_011 selected correctly in both examples |
| Cybersecurity analyst roles → “What skills do I need?” | JOB_004 ranked first; margin too small, so abstained |
| Deakin University → courses | INST_002 ranked first; background/skill separation insufficient |
| Accounting career → levels | CAREER_002 ranked first; margin too small |
| Construction industry → skills | Competing job/industry skills; abstained |
| Retail-to-IT pathway → next step | Ambiguous skill match; abstained |

There were four correct skill selections and no wrong accepted selections across the eight examples with a proposed skill label. The pathway example has no proposed single-skill label. This is synthetic development evidence, not broad accuracy certification. The candidate is not connected to the live chat.

## Confusion and hard-negative suite

The 28 additional cases target company roles versus internal mobility, course structure/units/majors/skills, company hiring versus market demand, train-versus-hire versus training plans, occupation versus industry demand, company versus industry skills, and skill learning versus microcredentials. They also include mixed tasks, genuine boundaries and misleading education/work keywords in unrelated questions.

Results: **15 correct decisions, one wrong accepted route, and 12 missed in-scope requests.** Twenty-one cases abstained in total, including nine intended abstentions. The wrong route again maps an external applicant’s Australia Post job-family question to internal mobility. This is a concrete description/confusion target for the next candidate. Some scenarios have more than one allowed label; all labels are provisional and require independent review.

## Independent labels and real devices

The blinded review file contains 131 shuffled synthetic requests, with separate blank fields for two reviewers and adjudication. Model predictions and intended labels are omitted. This is **prepared review material, not an independently labelled dataset**. A separate collection template defines genuine user examples, provenance, de-identification, conversation/paraphrase grouping and split assignment. The requested minimum design is ten varied examples per skill plus unrelated and ambiguous examples.

Only in-app Chromium on this Mac has been measured. Chrome macOS control could not proceed because a separate browser connector was unavailable and native computer-control permissions were pending. Safari macOS, Windows Chrome/Edge, Android Chrome/WebView, iPhone Safari, iOS WKWebView/Capacitor and low-memory hardware are explicitly not run.

The device matrix includes execution provider, startup, p50/p95/p99, responsiveness, full process peak memory, cache persistence and background/resume. Missing measurements remain null. Main-page JavaScript heap readings are recorded but do not measure worker/WASM peak memory. Viewport emulation is not accepted as a physical-device result.

The official [ONNX Runtime support table](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) lists WASM support across Safari/iOS, but platform support does not certify Yuzee’s performance there. The official [performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html) supports measuring execution and profiling it; the existing worker keeps heavy inference off the UI thread. [BGE’s model guidance](https://huggingface.co/BAAI/bge-small-en-v1.5) treats thresholds as application-dependent rather than universal probabilities.

## Conditions before v3

1. Finish the independent labelling and genuine-user collection; lock untouched evaluation before further tuning.
2. Resolve the company-role/internal-mobility confusion and the positive-RPL guard failure on development data, then test nearby positives and negatives.
3. Complete lower-level runtime attribution and specify a reproducible browser/index contract. Do not substitute native scores for browser results.
4. Validate context expansion across multiple turns, corrections, multiple subjects and mixed requests. Improve descriptions before considering lower global thresholds.
5. Implement and test prototype reuse as a separate candidate, including cache invalidation and auxiliary indexes.
6. Complete physical-device, cold download, offline, memory and resume checks. Compare browser coverage, wrong routes, unnecessary questions and useful suggestions separately.
7. Only then approve a named v3 release. No weight training or replacement embedding model is introduced in this cycle.

## Files and reproduction

The audit package includes full token/vector diagnostics, the four-way comparison, all 103 case records, the 43 missed-route records, candidate code/tests, hard-negative cases, blinded review material and the device matrix. It contains no API keys or personal chat logs. Earlier v2 reports remain historical records.

Run the instructions in experiments/bge-audit/README.md. The final verifier checks frozen runtime hashes and exact reproduction of all 103 routing decisions. The synthetic diagnostic collector is localhost-only and should be stopped after testing.
`;
await fs.writeFile('docs/BGE-V2-Audit-and-Next-Steps.md',md);
const body=renderToStaticMarkup(React.createElement(ReactMarkdown,{remarkPlugins:[remarkGfm]},md));
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const caseRows=cases.map((r:any)=>`<tr data-kind="${r.top1Correct&&r.decision.status==='abstained'?'missed':r.decision.status==='selected'&&r.decision.toolId!==r.expected?'wrong':'other'}"><td>${esc(r.expected)}</td><td>${esc(r.text)}<details><summary>Full decision details</summary><p>Top five: ${r.top5.map((v:any)=>esc(v.toolId)+' '+f(v.score)).join('; ')}</p><p>Context: none (single-turn case). Guard: ${esc(r.guardResponsible||'none')}. Token count: ${r.tokenCount}. Description quality and genuine ambiguity: not independently adjudicated.</p></details></td><td>${esc(r.top1.toolId)}<br>${f(r.top1.score)}</td><td>${esc(r.top2.toolId)}<br>${f(r.top2.score)}</td><td>${f(r.skillMargin)}</td><td>${f(r.background.score)}<br>Gap ${f(r.backgroundMargin)}</td><td>${esc(r.decision.toolId||'Abstain')}<br>${esc(r.failedGates.join('; ')||'No failed gate')}</td></tr>`).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yuzee · BGE v2 audit</title><style>body{font:16px/1.7 system-ui,-apple-system,sans-serif;color:#272439;background:#f8f7fb;margin:0}main{max-width:1160px;margin:auto;background:#fff;padding:44px}h1{font-size:34px;line-height:1.25;color:#251536}h2{font-size:23px;margin-top:42px;color:#4b2878}p{margin:15px 0}li{margin:9px 0}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.55;display:block;overflow-x:auto;margin:22px 0}td,th{padding:12px;border-bottom:1px solid #e5deee;vertical-align:top;text-align:left}th{background:#f3eefa;color:#492476}a{color:#6636ac}input,select{padding:12px;border:1px solid #cbbadd;border-radius:6px;font:inherit;max-width:100%}label{display:inline-block;margin:0 14px 12px 0}summary{cursor:pointer;color:#643aa0}details{font-size:13px;margin-top:8px}.wide td:nth-child(2){min-width:250px}.downloads{padding:18px 0;border-top:1px solid #ded4eb;border-bottom:1px solid #ded4eb}@media(max-width:650px){main{padding:24px 18px}h1{font-size:28px}}@media print{main{padding:0}input,select{display:none}tr{break-inside:avoid}}</style></head><body><main>${body}<div class="downloads"><a href="../bge-audit/Yuzee-BGE-V2-Audit-Package.zip" download>Download audit package</a> · <a href="../bge-audit/all-103-browser-cases.json" download>103 full case records</a> · <a href="../bge-audit/blind-human-review.jsonl" download>Blinded human review file</a> · <a href="../bge-audit/device-matrix.json" download>Device matrix</a></div><h2>Inspect the 103 browser cases</h2><p>Filter the recorded cases below. Full vectors and token tensors are in the JSON export.</p><label>Show <select id="filter"><option value="all">All 103 cases</option><option value="missed">Correct first, but abstained (43)</option><option value="wrong">Wrong accepted route (1)</option></select></label><label>Find <input id="search" type="search" placeholder="Skill ID, request or failed gate"></label><p id="count">103 cases shown</p><table class="wide"><thead><tr><th>Expected</th><th>Request</th><th>First skill / score</th><th>Second skill / score</th><th>Skill gap</th><th>Background</th><th>Decision / failed checks</th></tr></thead><tbody id="cases">${caseRows}</tbody></table><script>const run=()=>{const k=document.querySelector('#filter').value,q=document.querySelector('#search').value.toLowerCase();let count=0;document.querySelectorAll('#cases tr').forEach(r=>{r.hidden=!((k==='all'||r.dataset.kind===k)&&r.textContent.toLowerCase().includes(q));if(!r.hidden)count++;});document.querySelector('#count').textContent=count+' cases shown';};document.querySelector('#filter').onchange=run;document.querySelector('#search').oninput=run;</script></main></body></html>`;
await fs.writeFile('output/html/Yuzee-BGE-V2-Audit-and-Next-Steps.html',html);
console.log('Wrote audit report with filterable 103-case table.');
