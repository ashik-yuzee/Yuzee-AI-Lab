from pathlib import Path
import json,collections,html
p=Path('output/prompt-pack-40/2026-09-20')
pack=json.loads(Path('qa/prompt-pack-40/cases.json').read_text())
runs=[json.loads(f.read_text()) for f in sorted((p/'results').glob('*.json'))]
judges={f.stem:json.loads(f.read_text()) for f in (p/'judgements').glob('*.json')}
overrides={
 'T03-baseline-r1':{'verdict':'FAIL','reason':'Assistant review: unsupported relative remote-job availability is used as a decision factor without location-specific evidence. The judge incorrectly awarded full credit.','quote':'Data analytics roles are more frequently remote'},
 'T07-baseline-r1':{'verdict':'FAIL','reason':'Assistant review: course topics marked not_established became asserted exclusions. Unknown is not absent. Adapter normalization may contribute by also placing unqualified topic strings in considerations; preserve and test this distinction at both layers.','quote':'Does not cover advanced statistics, Python'},
 **{f'T30-baseline-r{i}':{'verdict':'NOT FULLY TESTED','reason':'The baseline chat-only run did not submit the required panel event. Do not attribute missing panel constraints to the target model. Superseded for integration purposes by events/T30-panel-r1..r3; independent content defects remain available in raw outputs.','excludeCriticalFlags':True} for i in range(1,4)}
}
rows=[]
for r in runs:
 j=judges[r['id']];o=overrides.get(r['id']);rows.append({'id':r['id'],'caseId':r['caseId'],'variant':r['variant'],'repetition':r['repetition'],'verdict':o['verdict'] if o else j['verdict'],'automatedVerdict':j['verdict'],'observedTextScore':j['textScore'],'override':o,'missingStructuredTurns':[x['turn'] for x in r['records'] if not x.get('response')],'criticalFlags':[] if o and o.get('excludeCriticalFlags') else j['critical_failures']})
counts=dict(collections.Counter(r['verdict'] for r in rows));routing=[json.loads(f.read_text()) for f in (p/'integration/routing').glob('*.json')]
summary={'definitions':40,'baselineExecutions':141,'baselineChatTurns':sum(len(r['records']) for r in runs),'supplementalChatTurns':9,'baselineStructuredFailures':sum(len(r['missingStructuredTurns']) for r in rows),'reviewedVerdicts':counts,'automatedVerdicts':dict(collections.Counter(j['verdict'] for j in judges.values())),'releaseVerdict':'FAIL — not ready for production acceptance','routingScope':'40 first-repetition final-turn selections. No independently labelled routing gold set; this is not all-316 routing accuracy.','routingDispositions':dict(collections.Counter(r.get('selection',{}).get('disposition') for r in routing)),'workspaceStarts':sum('workspace' in r for r in routing),'workspaceErrors':sum('error' in r for r in routing),'regressionTests':85,'grader':'Gemini 3.7 Flash, separate evaluator instructions, followed by limited assistant review. Same model family as target; independent human counselling/engineering calibration remains outstanding.','rows':rows}
(p/'review-overrides.json').write_text(json.dumps(overrides,indent=2));(p/'summary.json').write_text(json.dumps(summary,indent=2))
intro=f'''# Yuzee 40 Scenario Full Test Results

20 September 2026. Release decision: **FAIL — not ready for production acceptance.**

Completed all 40 definitions with three repetitions and the specified T25, T27, T37 and T39 variants: **141 executions, 261 baseline chat turns**. Additional real application checks generated **9 chat turns**, tested three right-panel correction cycles, stale revision rejection and foreign-workspace rejection. The production prompt was not changed during this baseline.

Reviewed run outcomes: **{counts.get('PASS',0)} PASS, {counts.get('FAIL',0)} FAIL, {counts.get('NOT FULLY TESTED',0)} NOT FULLY TESTED**. These are development evaluation labels, not customer satisfaction percentages or independently certified accuracy. A family fails if any required run fails; integration evidence still missing cannot be counted as a pass.

## What needs fixing first

1. **Structured replies disappear.** Nine of 261 baseline turns failed the current validator because `rmo_readiness.verification_required` was an array instead of a boolean. A follow-up succeeding does not undo the failed turn. A further occurrence happened in one of three right-panel follow-ups.
2. **Supplied profile constraints are ignored.** T39 variants put budget, study capacity and skills into the application's actual user-facts channel. Outbound traces confirm they reached Gemini. Replies still repeatedly say these facts were not supplied. Fix context assembly and prompt priority, then test counterfactual responsiveness again.
3. **Partial skills become confirmed eligibility.** T05 repeatedly treats spreadsheet totals/filtering as proof of all sorting/formula prerequisites. T28's follow-up also calls IT entry eligible without establishing laptop access. Do not turn a relevant foundation into confirmed admission readiness.
4. **A chat correction leaves a saved workspace stale.** In the real T28 application check, chat used the revised skill facts, but the saved workspace stayed at the old revision with its earlier comparison. Add explicit invalidation or regeneration tied to the shared context revision.
5. **Unknowns become negative facts.** Examples say a course does not cover topics that the fixture only marks as not established, and equate non-AQF with non-accredited. Preserve unknown labels through normalization and generation.

## What worked in the observed checks

- The corrected BGE/selector run made 40 decisions: {summary['routingDispositions']}. All {summary['workspaceStarts']} selected workspaces started successfully. This does not establish routing accuracy: there were no independently labelled correct-tool expectations for this pack, and selection was measured on the final turn only.
- All three real right-panel corrections saved revision 2. Subsequent model inputs contained the saved constraints. Two follow-ups displayed a useful neither-course-fits comparison; the third generated the correct constraints but failed protocol validation.
- All three stale revision requests were rejected. All three attempts to edit another conversation's workspace were rejected. These checks do not establish tenant isolation for a future multi-user deployment.
- All 85 existing objective, shared-context and warehouse regression tests passed. These deterministic checks use mocks/fixtures and do not negate live semantic failures.
- All 261 baseline turns were passed through a renderer review script; accepted structured replies rendered without a server-rendering exception. Invalid responses were marked explicitly rather than scored as usable UI.

## Limits and test corrections

The first workspace run was invalidated: the fictional adapter omitted the production `warehouse_` evidence-ID prefix, causing duplicate references on repeated retrieval. The adapter was corrected and all 40 routing checks rerun in an independent test server. Original evidence is retained in `routing`; use `integration/routing` for the corrected results. This is not a demonstrated production duplicate-ID failure.

The chat-only T30 baseline omitted the required workspace event. Those three outcomes are NOT FULLY TESTED, not evidence that Gemini ignored nonexistent answers. They are supplemented by the real saved-panel tests. The first judge was too lenient; its outputs remain in `judgements-initial-untrusted`. The second judge's labels plus explicit assistant overrides are retained separately. Independent product/counsellor and engineering human calibration has not occurred.

T11's rendered provider labels and fees can be inspected, but a conversational column swap is not proof of a stable course-ID binding in an interactive whiteboard. T31's baseline changes retrieved fixtures; it does not execute a real replace-right-course control. T32's stale-server-revision rejection does not simulate the full requested client response-order race. T24 uses an adapter timeout result rather than a real network timeout. T26/T36/T37 run with external writes unavailable. T38 excludes foreign records in the adapter and additionally checks conversation-scoped workspace access; a real two-tenant datastore test remains required.

This is a fictional-evidence evaluation, not fresh verification of real course, salary or local-demand data. Three repetitions are too few to establish a rare-failure rate. The 3,140-case objective execution suite is a different test and was not rerun here. No production deployment or prompt fix is claimed.

## Reproduction and evidence

Sources: `qa/prompt-pack-40/cases.json` and `README.md`. Scripts: `scripts/prompt-pack-40/`. Run inventory and version hashes: `manifest.json`, `runs.json`. Actual target replies: `results/`. Outbound input evidence: `traces/`. Judgements: `judgements/`. Final labels: `summary.json`, `review-overrides.json`. Real workspace checks: `integration/events/`. Deterministic checks: `regression-tests.tap`. UI snapshots: `output/html/Yuzee-Prompt-Pack-40-Rendered-Responses.html`.

Run the preparation script before starting the isolated fixture server; use the commands in the account handover. Live execution and grading require the receiving account's configured Gemini key. Existing result files are resumable and skipped; archive the result directory before a fresh full run. Never send the grader's expected answers to the target. Treat these development scenarios as exposed; create a new independently authored holdout before claiming improved generalisation.

## Scenario results

| Scenario | Executions | Pass | Fail | Not fully tested |
|---|---:|---:|---:|---:|
'''
for c in pack['cases']:
 rr=[r for r in rows if r['caseId']==c['id']];co=collections.Counter(r['verdict'] for r in rr);intro+=f"| {c['id']} {c['title']} | {len(rr)} | {co['PASS']} | {co['FAIL']} | {co['NOT FULLY TESTED']} |\n"
(p/'RESULTS.md').write_text(intro)
blocks=[]
for paragraph in intro.split('\n\n'):
 if paragraph.startswith('# '):blocks.append('<h1>'+html.escape(paragraph[2:])+'</h1>')
 elif paragraph.startswith('## '):blocks.append('<h2>'+html.escape(paragraph[3:])+'</h2>')
 else:blocks.append('<div class="prose">'+html.escape(paragraph)+'</div>')
Path('output/html/Yuzee-Prompt-Pack-40-Results.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yuzee full prompt test results</title><style>body{font:16px/1.7 system-ui;background:#faf9fc;color:#253047;margin:0}main{max-width:1050px;margin:auto;padding:36px 24px}h1{font-size:32px}h2{margin-top:36px;font-size:23px}.prose{white-space:pre-wrap;overflow-wrap:anywhere;margin:18px 0}a{color:#7044bc}</style><main>'+''.join(blocks)+'<p><a href="Yuzee-Prompt-Pack-40-Rendered-Responses.html">Inspect actual rendered answers</a></p></main></html>')
print(json.dumps({k:v for k,v in summary.items() if k!='rows'},indent=2))
