import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {registry,byId} from './registry.mjs';
import {plannerSchema,WIRE_INSTRUCTION,VERSION} from './schema.mjs';
import {validateOutput} from './validate.mjs';
import {geminiSchema} from './api.mjs';
import {writeReports} from './report.mjs';
const [preparedFile,suppFile]=process.argv.slice(2);
const a=JSON.parse(await fs.readFile(preparedFile,'utf8')),b=JSON.parse(await fs.readFile(suppFile,'utf8'));
const prepared=a.results.filter(r=>r.suite==='prepared'),supp=b.results.filter(r=>r.suite==='supplemental');
assert.equal(prepared.length,96);assert.equal(supp.length,12);
// Compatibility patch only affects nonempty confirmed-fact schemas. Verify the
// prepared run requests are unchanged before carrying those results forward.
for(const r of prepared){
 const raw=JSON.parse(await fs.readFile(path.resolve(path.dirname(preparedFile),'..',r.objective_id,`${r.test_id}-attempt1.json`),'utf8'));
 const o=byId.get(r.objective_id);
 assert.deepEqual(raw.raw_request.response_format.schema,geminiSchema(plannerSchema(o,r.input_context)));
 assert.equal(raw.raw_request.system_instruction,registry.global_rules['Global system prompt']+'\n\n'+o.qa_prompt_v2+'\n\n'+WIRE_INSTRUCTION);
}
const run_id='phase-a-smoke-2026-09-18';const out=path.resolve('qa/objectives/reports',run_id);
const metadata={run_id,created:new Date().toISOString(),version:'v0.2 prepared + v0.2.1 supplemental',model:'gemini-3.7-flash',api:'Interactions',
  source_run_ids:[a.run_id,b.run_id],workbook_sha256:registry.source_sha256,test_count:108,prepared_request_equivalence_checks:96,
  archive_note:`Combined prepared/supplemental runs, not one execution. Original failed pilot, aborted runs and attempts remain unchanged. Archived model output rechecked under ${VERSION}; checks include readiness semantics, nested evidence references and handoff action binding.`,validation_version:VERSION,production_modified:false};
const results=[...prepared.map(r=>({...r,source_run_id:a.run_id})),...supp.map(r=>({...r,source_run_id:b.run_id}))].map(r=>{
 const v=validateOutput(JSON.stringify(r.parsed),byId.get(r.objective_id),r.input_context);
 const semantic=r.failures.filter(f=>f.code.startsWith('SEMANTIC_')||f.code==='CRITICAL_SEMANTIC');
 const failures=[...v.failures,...semantic];
 const status=!v.passed?'FAIL':r.fixture_issues.length?'FIXTURE_BLOCKED':!r.evaluator?.valid?'NEEDS_SEMANTIC_REVIEW':failures.length?'FAIL':r.evaluator.parsed.criteria.some(c=>c.verdict==='NOT_ASSESSABLE')?'NEEDS_HUMAN_REVIEW':'PASS';
 return {...r,original_status:r.status,original_hard_pass:r.hard_pass,original_failures:r.failures,status,hard_pass:v.passed,first_attempt_pass:r.attempts===1?v.passed:r.first_attempt_pass,failures,validation_version:VERSION};
});
await writeReports(out,metadata,results,registry);console.log(path.join(out,'reports/results.json'));
