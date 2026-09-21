import fs from 'node:fs/promises';
import path from 'node:path';
import {registry,byId,audit} from './registry.mjs';
const report=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const out=path.dirname(process.argv[2]);
const csv=(headers,rows)=>[headers,...rows].map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const categories={
 UNAPPROVED_EVIDENCE:['Source reference contract','A reference ID does not resolve to supplied source or input data. This alone is not proof that the underlying claim is false.','Give source and confirmed-input references explicit namespaces; validate every nested reference. Review claim entailment separately.'],
 UNBOUND_ACTION_BUTTON:['UI/action contract','A visible next-step button has no declared action to execute.','Bind action_handoff choices to declared approved intents, or use an answer-taking component when the choice is data.'],
 UNAPPROVED_ACTION:['Tool catalogue boundary','An action is outside the two nonexecuting intents enabled for this harness.','Agree the closed action catalogue and map legitimate requests to approved targets; never execute arbitrary generated IDs.'],
 TABLE_SHAPE:['Table contract','Row cells do not match declared columns.','Clarify the row-label convention in the typed table component and test the full objective suite. Do not drop cells silently.'],
 RESULT_CONTRACT:['Result completeness','A COMPLETE domain result omits required objective fields.','Use status-aware typed results and check whether the model can satisfy the contract without inventing data; then retest the whole objective.'],
 RESULT_SUMMARY_SIZE:['Model degeneration / result contract','The result summary contains excessive repetitive text.','Reproduce the exact archived request; inspect schema-constrained generation and result typing before changing counselling content.'],
 SEMANTIC_OBJECTIVE_SPECIFIC_LOGIC:['Objective output quality','The model evaluator flagged an objective contract failure.','Review against the exact V2 objective and typed result contract; retain the original response.'],
 CRITICAL_SEMANTIC:['Decision quality','The evaluator reported a critical concern.','Review the cited failure and block promotion until reproduced, resolved and regressed.']
};
const failed=report.results.filter(r=>r.status==='FAIL').flatMap(r=>r.failures.map(f=>{
 const c=categories[f.code]||['Needs review','See raw response and validation details.','Review the original case and classify before patching.'];
 return [r.objective_id,r.test_id,r.source_run_id,f.code,c[0],typeof f.detail==='string'?f.detail:JSON.stringify(f.detail),c[1],c[2],`All prepared cases for ${r.objective_id}, plus affected supplemental and shared-contract regressions`];
}));
await fs.writeFile(path.join(out,'failure-triage.csv'),csv(['objective_id','test_id','raw_run_id','failure_code','root_cause_area','finding','interpretation','next_fix','retest_scope'],failed));
const a=audit();
await fs.writeFile(path.join(out,'fixture-review.csv'),csv(['test_id','objective_id','source_row','scenario_type','user_prompt_unchanged','prior_context_as_supplied','expected_behavior_unchanged','preflight_flag'],a.fixture_issues.map(x=>{
 const t=registry.tests.find(t=>t.test_id===x.test_id);return [t.test_id,t.tool_id,t.source_row,t.scenario_type,t.user_prompt,t.prior_context,t.expected_behavior,x.issues.join('; ')];
})));
await fs.writeFile(path.join(out,'contract-review.json'),JSON.stringify(a.contract_annotations.map(x=>({...x,source_contract:byId.get(x.objective_id).qa_output_contract_v2})),null,2)+'\n');
const notes=[{
 test_id:'SUP-05',objective_id:'STUDY_005',reviewer:'Codex inspection, separate from the automated Gemini evaluator; not human certification',
 source_fact:'No workplace assessment is specified.',
 model_claim:'No workplace assessment is included.',
 locations:['result.summary','readiness.dimensions[1].reason','handoff.evidence_and_unknowns[0]'],
 issue:'Absence of information was promoted into a negative fact. The semantic evaluator did not flag this evidence error. This case already fails hard checks.',
 expected:'Say workplace assessment is not established by the supplied excerpt and must be checked. Do not claim its absence or score assessment transparency as confirmed.',
 next_test:'Add paired evidence cases: assessment explicitly absent versus assessment not mentioned. Require the evaluator to quote source and claim for this distinction.'
}];
await fs.writeFile(path.join(out,'additional-review-notes.json'),JSON.stringify(notes,null,2)+'\n');
console.log(JSON.stringify({triaged_failures:failed.length,fixture_rows:a.fixture_issues.length,contract_reviews:a.contract_annotations.length,additional_review_notes:notes.length}));
