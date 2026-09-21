import Ajv from 'ajv';
import {isDeepStrictEqual} from 'node:util';
import {plannerSchema,compileResult,readinessAllowed} from './schema.mjs';
const ajv=new Ajv({allErrors:true,strict:false,allowUnionTypes:true});
// Matrices/builders may capture edits. required, not visual family, identifies
// the primary question. A final action handoff is a next-step control.
const isQuestion=c=>c.required&&c.component!=='action_handoff';
export function validateOutput(raw,o,context) {
  const failures=[];let parsed;
  const fail=(code,detail)=>failures.push({code,detail});
  try{parsed=JSON.parse(raw);}catch{ return {passed:false,failures:[{code:'JSON_PARSE',detail:'Not one complete JSON value'}],parsed:null};}
  const schema=ajv.compile(plannerSchema(o,context));
  if(!schema(parsed)) return {passed:false,parsed,failures:[{code:'JSON_SCHEMA',detail:structuredClone(schema.errors)}]};
  const asking=parsed.ui.filter(isQuestion);
  if(asking.length>1)fail('MULTIPLE_PRIMARY_QUESTIONS','One answer-taking component per turn');
  if(context.session.interaction_count+asking.length>o.max_interactions)fail('INTERACTION_CAP',o.max_interactions);
  if(parsed.status==='COMPLETE'&&asking.length)fail('STOP_CONDITION','Complete answer asks another required question');
  if(parsed.status==='NEEDS_INPUT'&&!asking.length&&context.session.interaction_count<o.max_interactions)fail('MISSING_INPUT_CONTROL','Needs input without a primary control');
  const ids=parsed.ui.map(c=>c.id);
  if(new Set(ids).size!==ids.length||ids.some(id=>!id.trim()))fail('COMPONENT_ID','Nonempty unique IDs required');
  for(const c of parsed.ui){
    if(['single_choice','multi_select','yes_no_unsure','ranking','card_sort'].includes(c.component)&&c.required&&c.options.length<2)fail('OPTIONS_MISSING',c.id);
    if(new Set(c.options.map(x=>x.id)).size!==c.options.length)fail('OPTION_ID',c.id);
    if(c.component==='spectrum'&&(c.settings.min===null||c.settings.max===null||c.settings.min>=c.settings.max||!c.settings.min_label||!c.settings.max_label))fail('SPECTRUM_ANCHORS',c.id);
    if(c.component==='card_sort'&&c.required&&c.settings.buckets.length<2)fail('SORT_BUCKETS',c.id);
    if(c.rows.some(r=>r.cells.length!==c.columns.length))fail('TABLE_SHAPE',c.id);
    // A handoff button must resolve to a declared action, not a second implicit
    // tool catalogue hidden in UI option IDs. Ordinary answer choices are data.
    if(c.component==='action_handoff')for(const option of c.options){
      if(!parsed.next_actions.some(a=>a.id===option.id))fail('UNBOUND_ACTION_BUTTON',`${c.id}.${option.id}`);
    }
  }
  // Evidence notes also occur in nested objective-specific result fields.
  // Checking just ui.content would allow an invented source into Oala's result.
  const inputRefs=new Set(Object.keys(context.confirmed_facts||{}).flatMap(k=>[k,`confirmed_facts.${k}`]));
  if(context.user_message)inputRefs.add('user_message');
  if(context.prior_context_text)inputRefs.add('prior_context_text');
  const sourceRefs=new Set(context.approved_evidence.map(e=>e.id));
  function checkEvidence(value,path='$'){
    if(!value||typeof value!=='object')return;
    if(value.source_status==='SOURCED_CURRENT_FACT'&&(!Array.isArray(value.evidence_refs)||!value.evidence_refs.length||value.evidence_refs.some(ref=>!sourceRefs.has(ref))))fail('UNAPPROVED_EVIDENCE',path);
    else if(Array.isArray(value.evidence_refs)&&value.evidence_refs.some(ref=>!sourceRefs.has(ref)&&!inputRefs.has(ref)))fail('UNAPPROVED_EVIDENCE',path);
    for(const [key,item]of Object.entries(value))checkEvidence(item,`${path}.${key}`);
  }
  checkEvidence(parsed);
  const r=parsed.readiness;
  if(!r.enabled&&(r.name!==null||r.score!==null||r.dimensions.length))fail('DISABLED_READINESS','Disabled readiness has score/name/dimensions');
  if(r.enabled&&(!readinessAllowed(o)||!r.name||r.score===null||!r.dimensions.length))fail('READINESS_POLICY',o.qa_readiness_policy_v2);
  if(parsed.ui.some(c=>c.component==='readiness_scorecard')&&!r.enabled)fail('READINESS_COMPONENT','Scorecard when readiness disabled');
  for(const a of parsed.next_actions){
    if(!((a.type==='RESEARCH'&&a.id==='research_required')||(a.type==='CONTINUE_CHAT'&&a.id==='continue_chat')))fail('UNAPPROVED_ACTION',a.id);
    if(/https?:|javascript:|\/api\//i.test(a.id+' '+a.label))fail('ENDPOINT_ACTION','No endpoint/URL action targets');
  }
  const serial=JSON.stringify(parsed);
  if(/<(?:script|iframe|style|button|form|div)\b|javascript:|on(?:click|load)\s*=/i.test(serial))fail('EXECUTABLE_MARKUP','Markup/action code forbidden');
  if(!parsed.handoff.summary.trim()||parsed.handoff.summary.length>1600)fail('HANDOFF_SIZE','Meaningful compact handoff required');
  if((parsed.result.summary||'').length>2000)fail('RESULT_SUMMARY_SIZE','Compact planner summary exceeds 2000 characters; details belong in structured result fields');
  if(!isDeepStrictEqual(parsed.confirmed_inputs,parsed.handoff.confirmed_user_inputs))fail('HANDOFF_FACT_MISMATCH','Handoff must preserve confirmed inputs');
  const hasContent=x=>x!==null&&x!==''&&(Array.isArray(x)?x.length>0:typeof x==='object'?Object.values(x).some(hasContent):true);
  const noDomainPayload=Object.entries(parsed.result).filter(([k])=>!['summary','unknowns','next_actions'].includes(k)).every(([,v])=>!hasContent(v));
  const noAction=parsed.status==='COMPLETE'&&noDomainPayload&&!r.enabled&&asking.length===0;
  if(parsed.status==='COMPLETE'&&!noAction){
    for(const key of compileResult(o.qa_output_contract_v2).completionKeys)if(!(key in parsed.result))fail('RESULT_CONTRACT',`Missing result.${key}`);
  }
  return {passed:failures.length===0,failures,parsed,no_action:noAction};
}

// The application owns the counter and accepted answers; output cannot reset it.
export function advanceSession(session,plan,answer){
  const c=plan.ui.find(isQuestion);
  if(!c||answer.component_id!==c.id)throw Error('Answer does not match pending component');
  if(session.completion_status==='COMPLETE')throw Error('Objective is closed');
  if(c.options.length&&Array.isArray(answer.option_ids)&&answer.option_ids.some(id=>!c.options.some(o=>o.id===id)))throw Error('Unknown option');
  return {...session,interaction_count:session.interaction_count+1,temporary_answers:{...session.temporary_answers,[c.id]:answer},completion_status:'IN_PROGRESS'};
}
