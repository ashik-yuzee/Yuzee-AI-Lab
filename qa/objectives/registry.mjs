import fs from 'node:fs';
import {compileResult,readinessAllowed,VERSION} from './schema.mjs';
export const registry=JSON.parse(fs.readFileSync(new URL('./registry/workbook.json',import.meta.url),'utf8'));
export const byId=new Map(registry.objectives.map(o=>[o.tool_id,o]));
export const SMOKE=['DISCOVER_001','DISCOVER_004','PROFILE_005','SCHOOL_003','STUDY_005','SKILL_SIDE_001','IND_DISCOVER_001','EMP_REALITY_004','EMP_COMPARE_001','EMP_SAFE_001'];
export function fixtureIssues(t) {
  const issues=[];
  if(['KNOWN_CONTEXT','CONTRADICTORY','ALREADY_RESOLVED','STOP_TEST'].includes(t.scenario_type))
    issues.push('MISSING_CONCRETE_STATE_OR_EVIDENCE');
  if(t.scenario_type==='OFF_TOPIC'&&/here is an unrelated request/.test(t.user_prompt))issues.push('NO_ACTUAL_OFF_TOPIC_REQUEST');
  if(t.scenario_type==='HAPPY_PATH'&&/enough context/.test(t.user_prompt)&&/^(None)?$/.test(t.prior_context||''))issues.push('CLAIMED_CONTEXT_NOT_SUPPLIED');
  return issues;
}
export function caseContext(t, fixture) {
  return {user_message:t.user_prompt,prior_context_text:t.prior_context||'',confirmed_facts:{},approved_evidence:[],
    session:{objective_id:t.tool_id,interaction_count:0,confirmed_answers:{},temporary_answers:{},completion_status:'NOT_STARTED'},...fixture};
}
export function audit() {
  const issues=registry.tests.map(t=>({test_id:t.test_id,objective_id:t.tool_id,issues:fixtureIssues(t)})).filter(x=>x.issues.length);
  const contracts=registry.objectives.map(o=>({objective_id:o.tool_id,source_row:o.source_row,readiness_allowed:readinessAllowed(o),...compileResult(o.qa_output_contract_v2)}));
  return {version:VERSION,source_sha256:registry.source_sha256,objectives:registry.objectives.length,tests:registry.tests.length,
    primitive_count:registry.primitives.length,fixture_issues:issues,contract_annotations:contracts.filter(x=>x.warnings.length).map(({schema,...x})=>x),
    blockers:['Prepared cases contain absent profile/evidence/state fixtures; do not score these as model-only failures.',
      'Workbook tests mention ABSTAIN but envelope excludes it; harness uses documented no-action COMPLETE.',
      'Workbook UI payloads and result leaf types are prose, not a fully typed renderer contract; v0.1 transport must be reviewed.',
      'Read/research tool catalogue is not supplied; no backend operations are executed.',
      'Single-turn prepared cases do not prove multi-turn workspace behaviour or BGE objective selection.']};
}
