import {objectiveProviderSchema} from '../src/objectives/providerSchema';
import Ajv from 'ajv';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ObjectiveService,contractBlockers} from '../src/objectives/service';
import {objectiveCatalogue,objectiveSelectionBoundary,objectiveShortlist,mergeObjectiveRanks} from '../src/objectives/routing';
import {validateObjectiveAnswer} from '../src/objectives/contract';
import {PrimitiveRenderer} from '../src/objectives/PrimitiveRenderer';
import {workspaceDisposition,resultReady,explicitWorkspaceRequest} from '../src/objectives/workspacePolicy';
import {answerHistory} from '../src/objectives/history';
import {EnteredAnswer} from '../src/objectives/ObjectiveHistory';
import {objectiveReviewContext} from '../src/objectives/handoff';
const settings={allow_unsure:true,min:null,max:null,min_label:null,max_label:null,buckets:[]};
const component=(type='short_answer')=>({id:'q1',component:type,purpose:'Understand your interests',prompt:'What do you enjoy doing?',required:true,options:[],content:[],columns:[],rows:[],settings:{...settings}});
function plan(input:any,complete=false){const c=component();return {objective_id:'DISCOVER_001',status:complete?'COMPLETE':'NEEDS_INPUT',stage:'UNDERSTAND',ui:complete?[]:[c],confirmed_inputs:input.confirmed_facts,derived_signals:[],unknowns:[],result:{summary:complete?'You enjoy practical activities. Explore these further with Oala.':'Tell us about activities you enjoy.',interest_themes:complete?[{label:'Practical activities',basis_activity_ids:[],confidence_label:'User reported'}]:[],unknowns:[],next_actions:[]},readiness:{enabled:false,name:null,score:null,dimensions:[],blockers:[]},next_actions:complete?[{id:'continue_chat',type:'CONTINUE_CHAT',label:'Discuss this with Oala'}]:[],handoff:{summary:'Explore practical interests, based on your answer.',confirmed_user_inputs:input.confirmed_facts,result:{summary:'Practical activities to explore.'},evidence_and_unknowns:[],recommended_next_action:'Discuss interests'}};}
const conv={id:'conversation-a',messages:[{id:'u1',role:'user',content:'I do not know which career would suit my interests.'},{id:'a1',role:'assistant',content:'We can explore activities you enjoy.'}]};
test('the explanation reviewer receives the same workspace facts and unknowns as the primary reply',()=>{const handoff={summary:'Offer B fits the stated priorities',confirmed_inputs:{answer_1:'Offer A 65000; Offer B 58000; salary floor 56000'},unknowns:['Progression'],source:'Self-reported synthetic scenario'};const reviewed=objectiveReviewContext('Continue',conv.messages,{content_blocks:[]},handoff);assert.deepEqual(reviewed.objectiveWorkspaceResult,handoff);assert.equal(objectiveReviewContext('Hi',[],{content_blocks:[]}).objectiveWorkspaceResult,undefined);});
test('316 unique metadata rows; only the two source-ambiguous contracts blocked',()=>{assert.equal(objectiveCatalogue.length,316);assert.equal(new Set(objectiveCatalogue.map(x=>x.tool_id)).size,316);assert.deepEqual(objectiveCatalogue.filter(o=>contractBlockers(o.tool_id).length).map(x=>x.tool_id),['GOAL_001','GOAL_004']);});
test('routing handles no-action messages and rejects invented IDs, scores and duplicates',()=>{assert.equal(objectiveSelectionBoundary('Thanks!'),'conversation');assert.equal(objectiveSelectionBoundary('Stop suggesting tools'),'declined');assert.equal(objectiveSelectionBoundary('I do not need another activity or to repeat those details.'),'declined');assert.equal(objectiveSelectionBoundary('a'.repeat(16001)),'input-limit');assert.deepEqual(objectiveShortlist([{id:'EVIL',score:1},{id:'DISCOVER_001',score:NaN},{id:'DISCOVER_004',score:.8},{id:'DISCOVER_004',score:.8}]),[{id:'DISCOVER_004',score:.8}]);assert.equal(mergeObjectiveRanks([[{id:'A',score:.6}],[{id:'A',score:.8}]])[0].score,.8);});
test('workspace loads ONE V2 prompt, accepts an answer, persists, prevents stale replay and scopes handoff',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;
 const service=new ObjectiveService(root,async request=>{calls++;assert.ok(request.system_instruction.includes('DISCOVER_001'));assert.ok(!request.system_instruction.includes('ID: EMP_SAFE_001'));const input=JSON.parse(request.input);return {output_text:JSON.stringify(plan(input,input.session.interaction_count>0))};});
 try{const first=await service.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);assert.equal(first.state,'ACTIVE');
 await assert.rejects(service.handoff(conv.id,first.id),/Finish/);
 await assert.rejects(service.advance(conv.id,first.id,{revision:0,answer:{}},new AbortController().signal),/changed/);
 const final=await service.advance(conv.id,first.id,{revision:1,answer:{component_id:'q1',value:'I enjoy repairing bikes'}},new AbortController().signal);
 assert.equal(final.state,'COMPLETE');assert.equal(final.interactionCount,1);assert.match(final.context.confirmed_facts.answer_1,/repairing bikes/);
 const handoff=await service.handoff(conv.id,final.id);assert.equal(handoff.status,'COMPLETE');assert.ok(handoff.confirmed_inputs.answer_1);
 await assert.rejects(service.get('other-conversation',final.id),/not found/);
 await assert.rejects(service.advance(conv.id,final.id,{revision:2,answer:{}},new AbortController().signal),/closed/);
 assert.equal((await new ObjectiveService(root).list(conv.id)).length,1);assert.equal(calls,2);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('invalid plans never become visible saved workspaces',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));const s=new ObjectiveService(root,async()=>({output_text:'{"ui":"<script>bad</script>"}'}));try{await assert.rejects(s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal),/checks/);assert.equal((await s.list(conv.id)).length,0);}finally{await fs.rm(root,{recursive:true,force:true});}});
test('workspace rejects overlong summaries locally even if the provider ignores the constraint',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));const s=new ObjectiveService(root,async req=>{assert.equal(req.generation_config.temperature,1);assert.match(req.system_instruction,/Profile saving, web browsing, applications and external actions are NOT available/);const p=plan(JSON.parse(req.input),true);p.result.summary='Repeated text. '.repeat(60);return {output_text:JSON.stringify(p)};});try{await assert.rejects(s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal),/WORKSPACE_SCHEMA/);assert.equal((await s.list(conv.id)).length,0);}finally{await fs.rm(root,{recursive:true,force:true});}});
test('a counselling question allows selection and high-confidence automatic opening',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-question-'));let calls=0;
 const s=new ObjectiveService(root,async()=>{calls++;return {output_text:JSON.stringify({decision:'SUGGEST',objective_id:'DISCOVER_001',confidence:'HIGH',workspace_need:'REQUIRED',reason:'Explore the interests behind this choice.'})};});
 try{const result=await s.select({...conv,messages:[{id:'u1',role:'user',content:'Help me explore my interests and compare directions.'},{id:'a1',role:'assistant',content:JSON.stringify({interaction:{kind:'question',question:'Which tasks do you enjoy?'},content_blocks:[{text:'We can explore your interests.'}]})}]},{sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.85}]},new AbortController().signal,()=>true);assert.equal(calls,1);assert.equal(result.disposition,'AUTO_OPEN');}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('selector can reject an irrelevant BGE shortlist and never receives execution prompts',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));const s=new ObjectiveService(root,async req=>{const data=JSON.parse(req.input);assert.equal(data.candidates.length,1);assert.equal(data.candidates[0].qa_prompt_v2,undefined);return {output_text:JSON.stringify({confidence:'LOW',workspace_need:'NONE',decision:'NONE',objective_id:'',reason:'This is a recipe question, not a career activity.'})};});try{const result=await s.select({...conv,messages:[{id:'u1',role:'user',content:'How do I bake bread?'},conv.messages[1]]},{sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.8}]},new AbortController().signal,()=>true);assert.equal(result.decision,'NONE');}finally{await fs.rm(root,{recursive:true,force:true});}});
test('selector rejects a fabricated objective and ignores stale selection',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));const body={sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.8}]};try{const bad=new ObjectiveService(root,async()=>({output_text:JSON.stringify({confidence:'HIGH',workspace_need:'OPTIONAL',decision:'SUGGEST',objective_id:'EVIL',reason:'Invented'})}));await assert.rejects(bad.select(conv,body,new AbortController().signal,()=>true),/validated/);const stale=new ObjectiveService(root,async()=>({output_text:JSON.stringify({confidence:'HIGH',workspace_need:'OPTIONAL',decision:'SUGGEST',objective_id:'DISCOVER_001',reason:'Explore your interests'})}));assert.equal((await stale.select(conv,body,new AbortController().signal,()=>false)).decision,'NONE');}finally{await fs.rm(root,{recursive:true,force:true});}});
test('cancel persists a closed activity and cannot be handed back as a completed result',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;const s=new ObjectiveService(root,async req=>{calls++;return {output_text:JSON.stringify(plan(JSON.parse(req.input)))}});try{const first=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);const closed=await s.advance(conv.id,first.id,{revision:1,cancel:true},new AbortController().signal);assert.equal(closed.state,'CANCELLED');assert.equal(calls,1);await assert.rejects(s.handoff(conv.id,first.id));}finally{await fs.rm(root,{recursive:true,force:true});}});
test('duplicate start resumes the pending activity without another model call',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;const s=new ObjectiveService(root,async req=>{calls++;return {output_text:JSON.stringify(plan(JSON.parse(req.input)))}});try{const a=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);const b=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);assert.equal(a.id,b.id);assert.equal(calls,1);}finally{await fs.rm(root,{recursive:true,force:true});}});
test('one bounded correction revalidates the whole plan and never publishes the rejected draft',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;const s=new ObjectiveService(root,async req=>{calls++;const input=JSON.parse(req.input);const p=plan(input);if(calls===1)delete (p.result as any).next_actions;else{assert.equal(input.validation_retry.failures[0].code,'WORKSPACE_SCHEMA');assert.equal((await s.list(conv.id)).length,0);}return {output_text:JSON.stringify(p)};});try{const result=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);assert.equal(calls,2);assert.equal(result.revision,1);assert.equal((await s.list(conv.id)).length,1);}finally{await fs.rm(root,{recursive:true,force:true});}});
test('long answers use provider strings but changed confirmed answers are rejected locally',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;const s=new ObjectiveService(root,async req=>{calls++;const input=JSON.parse(req.input),p=plan(input);if(input.session.interaction_count){assert.deepEqual(req.response_format.schema.properties.confirmed_inputs.properties.answer_1,{type:'string'});p.confirmed_inputs={answer_1:'Changed by model'};p.handoff.confirmed_user_inputs=p.confirmed_inputs;}return {output_text:JSON.stringify(p)};});try{const first=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);await assert.rejects(s.advance(conv.id,first.id,{revision:1,answer:{component_id:'q1',value:'I enjoy repairing bikes. '.repeat(80)}},new AbortController().signal),/checks/);assert.equal(calls,3);assert.equal((await s.get(conv.id,first.id)).revision,1);assert.deepEqual((await s.get(conv.id,first.id)).context.confirmed_facts,{});}finally{await fs.rm(root,{recursive:true,force:true});}});
test('typed controls enforce complete ranking, buckets, options, range and unsure',()=>{
 const check=(c:any,a:any)=>validateObjectiveAnswer({ui:[c]},{component_id:c.id,...a});
 const c=component('single_choice');c.options=[{id:'a',label:'A',detail:''},{id:'b',label:'B',detail:''}] as any;
 assert.throws(()=>check(c,{value:'wrong'}));assert.equal(check(c,{value:'a'}).value,'a');
 c.component='ranking';assert.throws(()=>check(c,{value:['a']}));assert.deepEqual(check(c,{value:['b','a']}).value,['b','a']);
 c.component='card_sort';c.settings.buckets=['Like','Avoid'] as any;assert.throws(()=>check(c,{value:{a:'Like'}}));assert.ok(check(c,{value:{a:'Like',b:'Avoid'}}));
 c.component='spectrum';c.settings.min=0 as any;c.settings.max=10 as any;assert.throws(()=>check(c,{value:11}));assert.equal(check(c,{value:5}).value,5);assert.equal(check(c,{value:'',unsure:true}).value,null);
 c.settings.allow_unsure=false;assert.throws(()=>check(c,{value:'',unsure:true}));
 c.component='entity_picker';assert.equal(check(c,{value:'Offer A: support role; Offer B: trainee developer'}).value,'Offer A: support role; Offer B: trainee developer');assert.throws(()=>check(c,{value:''}));
});
const primitives=[...new Set(objectiveCatalogue.flatMap(o=>o.allowed_primitives))];
for(const type of primitives)test(`primitive ${type}: safe readable render`,()=>{const c=component(type);c.prompt='Example <script>never execute</script>';c.required=!['action_handoff','readiness_scorecard','evidence_panel','timeline','comparison_grid','tradeoff_matrix','hierarchy_explorer','pathway_builder','skill_matrix'].includes(type);c.options=[{id:'a',label:'First',detail:'Why this matters'},{id:'b',label:'Second',detail:''}] as any;c.settings.buckets=['Like','Avoid'] as any;c.settings.min=0 as any;c.settings.max=10 as any;c.settings.min_label='Lower' as any;c.settings.max_label='Higher' as any;const html=renderToStaticMarkup(<PrimitiveRenderer component={c} plan={{readiness:{enabled:false},ui:[c]}} onAnswer={()=>{}} disabled={false}/>);assert.ok(html.includes(`data-primitive="${type}"`));assert.ok(!html.includes('<script>'));});
test('automatic opening accepts lower-ranked relevant selections with independent need and confidence',()=>{
 const d={decision:'SUGGEST',objective_id:'DISCOVER_001',confidence:'HIGH',workspace_need:'REQUIRED'};
 const candidates=[{id:'DISCOVER_001',score:.81},{id:'DISCOVER_002',score:.70}];
 assert.equal(workspaceDisposition(d,candidates,false),'AUTO_OPEN');
 assert.equal(workspaceDisposition({...d,confidence:'MEDIUM'},candidates,false),'SUGGEST');
 assert.equal(workspaceDisposition({...d,workspace_need:'OPTIONAL'},candidates,false),'SUGGEST');
 assert.equal(workspaceDisposition(d,[{id:'DISCOVER_001',score:.69}],false),'SUGGEST');
 assert.equal(workspaceDisposition(d,[candidates[0],{id:'DISCOVER_002',score:.80}],false),'AUTO_OPEN');
 assert.equal(workspaceDisposition({...d,objective_id:'DISCOVER_002'},candidates,false),'AUTO_OPEN');
 assert.equal(workspaceDisposition(d,candidates,true),'NONE');
});
test('automatic starts require a fresh server-owned selection and do not reopen the same turn',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;
 const s=new ObjectiveService(root,async req=>{calls++;const i=JSON.parse(req.input);return {output_text:JSON.stringify(i.candidates?{decision:'SUGGEST',objective_id:'DISCOVER_001',reason:'Explore interests visually',confidence:'HIGH',workspace_need:'REQUIRED'}:plan(i))};});
 try{
  const selection=await s.select(conv,{sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.85},{id:'DISCOVER_002',score:.68}]},new AbortController().signal,()=>true);
  assert.equal(selection.disposition,'AUTO_OPEN');
  await assert.rejects(s.start(conv,{objectiveId:'DISCOVER_001',activation:'automatic',sourceMessageId:'a1',selectionId:'forged'},new AbortController().signal),/moved on/);
  const body={objectiveId:'DISCOVER_001',activation:'automatic',sourceMessageId:'a1',selectionId:(selection as any).selectionId};
  const opened=await s.start(conv,body,new AbortController().signal);assert.equal(opened.activation,'automatic');assert.equal(opened.routing.confidence,'HIGH');
  await assert.rejects(s.start(conv,body,new AbortController().signal),/moved on/);const afterReload=await s.select(conv,{sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.85}]},new AbortController().signal,()=>true);assert.equal(afterReload.disposition,'NONE');assert.equal(calls,2);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('dismissed optional suggestions stay dismissed after reload',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let calls=0;
 const model=async()=>{calls++;return {output_text:JSON.stringify({decision:'SUGGEST',objective_id:'DISCOVER_001',reason:'Explore interests',confidence:'MEDIUM',workspace_need:'OPTIONAL'})};};
 try{const s=new ObjectiveService(root,model),body={sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.8}]};await s.select(conv,body,new AbortController().signal,()=>true);await s.dismiss(conv.id,'a1');const again=await new ObjectiveService(root,model).select(conv,body,new AbortController().signal,()=>true);assert.equal(again.disposition,'NONE');assert.equal(calls,1);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('submitted answers survive generation failure, retry once without resubmission, and retain question history',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-test-'));let fail=true;
 const s=new ObjectiveService(root,async req=>{const input=JSON.parse(req.input);if(input.session.interaction_count&&fail)throw Error('Network unavailable');return {output_text:JSON.stringify(plan(input,input.session.interaction_count>0))};});
 try{
  const first=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);
  const body={revision:1,answer:{component_id:'q1',value:'Repairing bikes and building furniture'}};
  await assert.rejects(s.advance(conv.id,first.id,body,new AbortController().signal),/Network/);
  const pending=await new ObjectiveService(root).get(conv.id,first.id);assert.equal(pending.pendingAnswer?.answer,body.answer.value);assert.equal(pending.revision,1);assert.equal(resultReady(pending),false);
  await assert.rejects(s.advance(conv.id,first.id,body,new AbortController().signal),/already saved/);
  fail=false;const final=await s.advance(conv.id,first.id,{revision:1,retry:true},new AbortController().signal);
  assert.equal(final.pendingAnswer,undefined);assert.equal(final.interactionCount,1);assert.equal(answerHistory(final)[0].question,'What do you enjoy doing?');assert.equal(answerHistory(final)[0].answer,body.answer.value);assert.equal(resultReady(final),true);
  const sent=await s.markHandedOff(conv.id,final.id,'reply-1');const duplicate=await s.markHandedOff(conv.id,final.id,'reply-2');assert.equal(duplicate.handoffAt,sent.handoffAt);assert.equal(duplicate.handoffMessageId,'reply-1');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('legacy saved answers preserve full question and value without inventing a timestamp',()=>{const rows=answerHistory({context:{confirmed_facts:{answer_1:JSON.stringify({question:'Which offers?',answer:'A: 65000. B: 58000.'})}}} as any);assert.equal(rows[0].submittedAt,undefined);assert.equal(rows[0].question,'Which offers?');const html=renderToStaticMarkup(<EnteredAnswer entry={rows[0]}/>);assert.match(html,/Entered/);assert.match(html,/65000/);assert.ok(!html.includes('<textarea'));});

test('explicit activity requests may open a strongly matched shortlisted tool despite neighbouring BGE matches',()=>{
 const d={decision:'SUGGEST',objective_id:'JOB_DECIDE_004',confidence:'HIGH',workspace_need:'REQUIRED'};
 const shortlist=[{id:'EMP_COMPARE_001',score:.78},{id:'JOB_DECIDE_004',score:.77}];
 const text='Please compare my two job offers in the workspace now.';
 assert.equal(workspaceDisposition(d,shortlist,false,text,'Compare two job offers'),'AUTO_OPEN');
 assert.equal(workspaceDisposition({...d,confidence:'MEDIUM'},shortlist,false,text,'Compare two job offers'),'SUGGEST');
 assert.equal(explicitWorkspaceRequest('Compare two job offers in the workspace later','Compare two job offers'),false);
 assert.equal(workspaceDisposition(d,[{id:'JOB_DECIDE_004',score:.95}],false,'Please do not open the workspace now.','Compare two job offers'),'NONE');
 assert.equal(explicitWorkspaceRequest('Open a workspace now to compare my two courses','Compare two job offers'),false);
});

test('later chat review retains relevant saved workspace facts without assuming a new handoff',()=>{
 const saved=[{objective:'Compare offers',answers:{answer_1:'A: 65000, 45 minutes. B: 58000, 20 minutes.'}}];
 const context=objectiveReviewContext('How much travel time would this save?',[],{content_blocks:[]},null,saved);
 assert.deepEqual(context.savedWorkspaces,saved);assert.equal(context.objectiveWorkspaceResult,undefined);
});

test('an interaction-cap blocker with no remaining question can return to Oala instead of dead-ending',()=>{
 const s={state:'ACTIVE',plan:{status:'NEEDS_INPUT',ui:[],readiness:{blockers:['The remaining evidence is unavailable']}}} as any;
 assert.equal(resultReady(s),true);s.plan.ui=[component()];assert.equal(resultReady(s),false);
});

test('saved comparison renders aligned criteria without internal schema labels or empty priorities',async()=>{
 const {WorkspaceResult,activityTitle}=await import('../src/objectives/WorkspaceResult');
 const result={summary:'Compare the work involved.',job_comparison:{comparison_scope:'OCCUPATION_VS_OCCUPATION',user_priorities:[],jobs:[{occupation_or_vacancy:'Engineering',criteria:[{criterion:'Tasks',value_or_status:'Build systems',evidence_scope:'STABLE_CONCEPTUAL',unknowns:[]}]},{occupation_or_vacancy:'Marketing',criteria:[{criterion:'Skills',value_or_status:'Audience research',unknowns:[]}]}],tradeoffs:[]}};
 const html=renderToStaticMarkup(<WorkspaceResult result={result}/>);
 assert.equal(activityTitle({label:'Compare these jobs',plan:{result}}),'Engineering vs Marketing');
 assert.match(html,/<table>/);assert.match(html,/Build systems/);assert.match(html,/Audience research/);assert.match(html,/Not yet known/);
 for(const text of ['OCCUPATION_VS_OCCUPATION','STABLE_CONCEPTUAL','No details supplied','User Priorities'])assert.ok(!html.includes(text));
});
test('new workspace completion stays on the right without automatic handoff',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-local-result-'));
 const s=new ObjectiveService(root,async req=>({output_text:JSON.stringify(plan(JSON.parse(req.input),true))}));
 try{const result=await s.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);assert.equal(result.autoHandoff,false);assert.equal(result.handoffAt,undefined);}finally{await fs.rm(root,{recursive:true,force:true});}
});

test('activity hints preserve user evidence and keep old responses usable',async()=>{
 const {readActivityContext,activitySearchContext}=await import('../src/objectives/activityContext');
 const response={state:{activity_context:{current_goal:'Compare careers',confirmed_facts:['I enjoy coding','I am an expert'],possible_need:'Explore interests',missing_information:['Experience'],relevant_question:'What do you enjoy?',user_constraints:[]}}};
 assert.deepEqual(readActivityContext(response,['I enjoy coding and design.'])?.confirmed_facts,['I enjoy coding']);
 assert.equal(readActivityContext({},['Hello']),null);
 assert.equal(activitySearchContext({content_blocks:[{text:'Assistant content must not enter fallback'}]},['Previous goal','Current request']),'Previous goal');
 assert.ok(!activitySearchContext(response,['I enjoy coding']).includes('I am an expert'));
});
test('dual retrieval preserves raw-user matches and query provenance without embedding exclusions',async()=>{
 const {fuseObjectiveMatches,objectiveIndex,selectionMetadata}=await import('../src/objectives/routing');
 const rows=fuseObjectiveMatches([{id:'A',score:.7},{id:'B',score:.6}],[{id:'C',score:.9},{id:'B',score:.8}]);
 assert.deepEqual(rows.find(x=>x.id==='A')?.sources,['user']);assert.deepEqual(rows.find(x=>x.id==='B')?.sources,['user','context']);assert.equal(rows.find(x=>x.id==='C')?.contextScore,.9);
 assert.equal(selectionMetadata.length,316);assert.equal(new Set(selectionMetadata.map(x=>x.id)).size,316);
 for(const row of selectionMetadata){assert.ok(row.outcome&&row.exclusions&&row.distinction&&row.input_requirements);assert.ok(objectiveIndex.some(x=>x.id===row.id));assert.ok(!objectiveIndex.some(x=>x.text===row.exclusions));}
});
test('Gemini selector can clarify without starting an objective',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-clarify-'));
 const s=new ObjectiveService(root,async req=>{const input=JSON.parse(req.input);assert.equal(input.candidates[0].qa_prompt_v2,undefined);assert.ok(input.candidates[0].exclusions);return {output_text:JSON.stringify({decision:'CLARIFY',objective_id:'',confidence:'LOW',workspace_need:'NONE',reason:'The referenced option is unknown.'})};});
 try{const r=await s.select(conv,{sourceMessageId:'a1',candidates:[{id:'DISCOVER_001',score:.8}]},new AbortController().signal,()=>true);assert.equal(r.decision,'CLARIFY');assert.equal(r.disposition,'NONE');assert.equal((await s.list(conv.id)).length,0);}finally{await fs.rm(root,{recursive:true,force:true});}
});

 test('reference replies retain context candidates and future-course language is not a deferral',async()=>{
 const {fuseObjectiveMatches}=await import('../src/objectives/routing');
 const user=Array.from({length:20},(_,i)=>({id:'u'+i,score:.7})),context=Array.from({length:20},(_,i)=>({id:'c'+i,score:.7}));
 const merged=fuseObjectiveMatches(user,context,20,'both, honestly');assert.ok(merged.some(c=>c.id==='c12'));assert.ok(merged.some(c=>c.id==='u0'));assert.equal(merged.length,20);
 const d={decision:'SUGGEST',objective_id:'DISCOVER_001',confidence:'HIGH',workspace_need:'REQUIRED'};
 assert.equal(workspaceDisposition(d,[{id:'DISCOVER_001',score:.8}],false,'Will dropping chemistry affect the course I want later?'),'AUTO_OPEN');
 assert.equal(workspaceDisposition(d,[{id:'DISCOVER_001',score:.8}],false,'Compare those options later, not now'),'NONE');
 assert.equal(workspaceDisposition({...d,objective_id:'UNKNOWN'},[{id:'DISCOVER_001',score:.8}],false),'SUGGEST');
 });

test('known context is collapsed below the question, without raw evidence reference labels',()=>{
 const c=component();c.content=[{label:'Known preference',detail:'Synthetic preference',source_status:'USER_CONFIRMED',evidence_refs:['prior_context_text']} ] as any;
 const html=renderToStaticMarkup(<PrimitiveRenderer component={c} plan={{}} onAnswer={()=>{}} disabled={false}/>);
 assert.ok(html.includes('Details I’m using'));assert.ok(!html.includes('Basis:'));assert.ok(!html.includes('prior context text'));assert.ok(html.indexOf('<form')<html.indexOf('<details'));assert.ok(!html.includes('<details open'));
});

test('provider reference simplification retains exact local evidence validation',()=>{
 const refs={type:'object',properties:{evidence_refs:{type:'array',items:{type:'string',enum:['answer_1']}}},required:['evidence_refs']};
 const schema={type:'object',properties:{result:{anyOf:[refs,{type:'string'}]}}};
 const provider=objectiveProviderSchema(schema);
 assert.deepEqual(provider.properties.result.anyOf[0].properties.evidence_refs.items,{type:'string'});
 assert.deepEqual(refs.properties.evidence_refs.items.enum,['answer_1']);
 const valid=new Ajv().compile(schema);assert.equal(valid({result:{evidence_refs:['invented_source']}}),false);assert.equal(valid({result:{evidence_refs:['answer_1']}}),true);
});

test('workspace suppresses duplicate detail sections and internal confirmed-fact labels',()=>{
 const c=component('evidence_panel');c.required=false;c.content=[{label:'Known Math Preference',detail:'General Mathematics',source_status:'USER_CONFIRMED',evidence_refs:['user_message']}] as any;
 assert.equal(renderToStaticMarkup(<PrimitiveRenderer hideKnown component={c} plan={{}} onAnswer={()=>{}} disabled={false}/>),'');
 const html=renderToStaticMarkup(<PrimitiveRenderer component={c} plan={{}} onAnswer={()=>{}} disabled={false}/>);assert.ok(!html.includes('Known Math Preference'));assert.ok(!html.includes('You shared'));assert.ok(html.includes('General Mathematics'));
});
test('corrections persist on failure, retry once saved, retain history and reject stale edits',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'objective-correct-'));let fail=false;
 const service=new ObjectiveService(root,async request=>{if(fail)throw Error('temporary failure');const input=JSON.parse(request.input);return {output_text:JSON.stringify(plan(input))};});
 try{
  const first=await service.start(conv,{objectiveId:'DISCOVER_001'},new AbortController().signal);
  fail=true;await assert.rejects(service.correct(conv.id,first.id,{revision:1,correction:'I prefer outdoor tasks.'},new AbortController().signal));
  const pending=await service.get(conv.id,first.id);assert.equal(pending.pendingCorrection?.text,'I prefer outdoor tasks.');assert.equal(pending.revision,1);assert.deepEqual(pending.plan,first.plan);
  fail=false;const next=await service.correct(conv.id,first.id,{revision:1,retry:true},new AbortController().signal);
  assert.equal(next.revision,2);assert.equal(next.context.confirmed_facts.correction_1,'I prefer outdoor tasks.');assert.equal(next.context.user_message,first.context.user_message);assert.equal(next.context.user_corrections.length,1);assert.equal(next.pendingCorrection,undefined);assert.deepEqual(next.answers,first.answers);
  await assert.rejects(service.correct(conv.id,first.id,{revision:1,correction:'stale'},new AbortController().signal));
  await assert.rejects(service.correct(conv.id,first.id,{revision:2,correction:' '},new AbortController().signal));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
