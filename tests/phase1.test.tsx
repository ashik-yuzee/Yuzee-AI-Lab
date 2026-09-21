import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {serviceRegistry,serviceForIntent} from '../src/orchestration/serviceRegistry';
import {TRUSTED_SERVICE_ACTIONS} from '../src/orchestration/serviceActions';
import {sharedConversationContext} from '../src/orchestration/sharedContext';
import {objectiveContext,ObjectiveService} from '../src/objectives/service';
import {workspaceQuestionOwner,shouldDeferChatQuestion} from '../src/orchestration/questionOwner';
import {visibleWorkspaceId,setVisibleWorkspace} from '../src/orchestration/workspacePresence';
import {ContextDetails} from '../src/objectives/ContextDetails';
import schema from '../src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json';

const question={id:'q1',required:true,component:'short_answer',prompt:'What matters most?'};
const session:any={id:'workspace-1',conversationId:'c1',label:'Compare jobs',objectiveId:'COMPARE_JOBS',state:'ACTIVE',revision:2,updatedAt:100,context:{confirmed_facts:{},user_corrections:[]},answers:[{id:'answer1',question:'Minimum salary?',answer:'At least 60,000 in this fictional example',submittedAt:50}],plan:{ui:[question],result:{summary:'MODEL-INFERENCE-NOT-A-FACT'}}};
const conv={id:'c1',messages:[{id:'u1',role:'user',content:'I am comparing engineering and marketing; I can only study part-time.',createdAt:1},{id:'a1',role:'assistant',content:'Unverified claim about eligibility',structuredResponse:{interaction:{kind:'question',question:'Which work style interests you?'}}},{id:'u2',role:'user',content:'Practical',createdAt:2}]};

test('every semantic/product mapping fits the locked protocol and graduate work stays distinct',()=>{
 assert.deepEqual(serviceRegistry.protocol_ids,(schema as any).properties.service_trigger.properties.primary_requested_service.enum);
 for(const route of serviceRegistry.routes){assert.ok(serviceRegistry.protocol_ids.includes(route.protocol_id));assert.ok(serviceRegistry.products.some(p=>p.id===route.product_id&&p.protocol_ids.includes(route.protocol_id)));}
 assert.equal(serviceForIntent('entry_level_graduate_job')?.protocol_id,'JOB_MATCH_RMO');
 assert.equal(serviceForIntent('structured_graduate_program')?.protocol_id,'GRAD_PROGRAM_RMO');
 assert.equal(serviceForIntent('FRESH_GRAD_JOB_RMO'),null);
 assert.ok(Object.values(TRUSTED_SERVICE_ACTIONS).every(a=>!a.isConnectedInLab));
 assert.ok(Object.values(TRUSTED_SERVICE_ACTIONS).filter(a=>a.actionId!=='rmo_explore_courses').every(a=>a.requiresConfirmation));
});
test('new prompt has no rejected routing aliases and distinguishes explicit guidance from COMMIT',()=>{
 const p=fs.readFileSync('src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md','utf8');
 assert.doesNotMatch(p,/\b(EDUCATION_RMO|CAREER_PATHWAY_RMO|APPRENTICESHIP_TRAINEESHIP_RMO|FRESH_GRAD_JOB_RMO|JOB_RMO)\b/);
 assert.match(p,/EXPLICIT REQUEST: answer/);assert.match(p,/COMMIT actions still require/);
 assert.equal((p.match(/Hidden activity routing context \(state.activity_context\)/g)||[]).length,1);
 assert.match(p,/Never add points merely for a click/);
});
test('short replies retain their question while AI claims and foreign workspaces are excluded',()=>{
 const shared=sharedConversationContext(conv,[session,{...session,conversationId:'someone-else',answers:[{id:'private',question:'Secret?',answer:'PRIVATE',submittedAt:100}]}]);
 assert.equal(shared.contributions.find(e=>e.id==='chat:u2')?.question,'Which work style interests you?');
 assert.ok(shared.contributions.every(e=>e.evidence_status==='USER_REPORTED'&&e.scope==='CONVERSATION_ONLY'));
 assert.doesNotMatch(JSON.stringify(shared),/PRIVATE|MODEL-INFERENCE|Unverified claim/);
});
test('relevant early constraints survive a long conversation and bounded recall is disclosed',()=>{
 const messages=[...conv.messages,...Array.from({length:24},(_,i)=>({id:'u'+(i+3),role:'user',content:'Unrelated filler '+i,createdAt:i+3})),{id:'last',role:'user',content:'Compare engineering and marketing again',createdAt:99}];
 const c=objectiveContext({id:'c1',messages});
 assert.match(c.prior_context_text,/only study part-time/);assert.equal(c.context_limited,true);
 assert.equal(c.shared_context.contributions.length,16);
 assert.equal(c.shared_context.total_contributions,27);
 assert.deepEqual(c.confirmed_facts,{},'Historical context must not be blindly asserted as current objective facts');
});
test('saved pending answers and corrections are available even before a model retry succeeds',()=>{
 const s={...session,pendingAnswer:{id:'pending',question:'Which role?',answer:'Offer B',submittedAt:70},pendingCorrection:{text:'The minimum is now 65,000, not 60,000.',createdAt:80}};
 const shared=sharedConversationContext(conv,[s]);
 assert.ok(shared.contributions.some(e=>e.kind==='USER_CORRECTION'&&e.processing==='RESULT_PENDING'));
 assert.ok(shared.contributions.some(e=>e.value==='Offer B'&&e.processing==='RESULT_PENDING'));
 const next=objectiveContext(conv,[s]);assert.match(next.prior_context_text,/65,000/);assert.match(next.prior_context_text,/Minimum salary/);
 assert.notEqual(shared.revision,sharedConversationContext(conv,[session]).revision);
 assert.equal(shared.revision,sharedConversationContext(conv,[s]).revision);
});
test('an open workspace owns one question; close, completion, pending result and safety release it',()=>{
 const response={interaction:{kind:'question'},state:{safety_override_applied:false}};
 const open=workspaceQuestionOwner([session],session.id);
 assert.equal(open.question_owner,'WORKSPACE');assert.equal(shouldDeferChatQuestion(response,open),true);
 for(const owner of [workspaceQuestionOwner([session],null),workspaceQuestionOwner([{...session,state:'COMPLETE'}],session.id),workspaceQuestionOwner([{...session,pendingAnswer:{}}],session.id),workspaceQuestionOwner([session],'foreign')])assert.equal(shouldDeferChatQuestion(response,owner),false);
 assert.equal(shouldDeferChatQuestion({...response,state:{safety_override_applied:true}},open),false);
 assert.equal(shouldDeferChatQuestion({interaction:{kind:'handoff'}},open),false);
 assert.equal(shouldDeferChatQuestion({...response,service_trigger:{trigger_now:true}},open),false);
});
test('visible-workspace presence cannot bleed into another conversation',()=>{
 setVisibleWorkspace({conversationId:'c1',sessionId:'workspace-1'});
 assert.equal(visibleWorkspaceId('c1'),'workspace-1');assert.equal(visibleWorkspaceId('c2'),null);
 setVisibleWorkspace(null);assert.equal(visibleWorkspaceId('c1'),null);
});
test('context details survive a completed plan with no repeated user-information UI blocks',()=>{
 const s={...session,state:'COMPLETE',context:{...session.context,shared_context:sharedConversationContext(conv,[session])},plan:{ui:[]}};
 const html=renderToStaticMarkup(<ContextDetails session={s} onCorrect={()=>{}} onRetry={()=>{}} disabled={false}/>);
 assert.match(html,/Details I’m using · Edit/);assert.match(html,/Minimum salary/);assert.doesNotMatch(html,/<details[^>]*open/);
 assert.doesNotMatch(html,/Basis:|Known Math Preference|MODEL-INFERENCE/);
});

test('a fresh activity after server restart receives a previous activity answer and correction',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuzee-shared-context-'));
 const requests:any[]=[];
 const model=async(req:any)=>{
  const input=JSON.parse(req.input);requests.push(input);if(input.validation_retry)throw Error(JSON.stringify(input.validation_retry.failures));
  const complete=input.session.interaction_count>0;
  const result={summary:'Explore practical interests.',interest_themes:[],unknowns:[],next_actions:[]};
  return {output_text:JSON.stringify({objective_id:'DISCOVER_001',status:complete?'COMPLETE':'NEEDS_INPUT',stage:'UNDERSTAND',ui:complete?[]:[{...question,purpose:'Learn about your interests',options:[],content:[],columns:[],rows:[],settings:{allow_unsure:true,min:null,max:null,min_label:null,max_label:null,buckets:[]}}],confirmed_inputs:input.confirmed_facts,derived_signals:[],unknowns:[],result,readiness:{enabled:false,name:null,score:null,dimensions:[],blockers:[]},next_actions:[],handoff:{summary:result.summary,confirmed_user_inputs:input.confirmed_facts,result:{summary:result.summary},evidence_and_unknowns:[],recommended_next_action:'Discuss interests'}})};
 };
 try{
  const signal=new AbortController().signal;
  const original=new ObjectiveService(root,model);
  const first=await original.start(conv,{objectiveId:'DISCOVER_001'},signal);
  const answered=await original.advance(conv.id,first.id,{revision:first.revision,answer:{component_id:'q1',value:'Repairing bicycles on weekends'}},signal,conv);
  await original.correct(conv.id,answered.id,{revision:answered.revision,correction:'I now prefer repairing electronics, not bicycles.'},signal,conv);
  const restarted=new ObjectiveService(root,model);
  await restarted.start(conv,{objectiveId:'DISCOVER_001'},signal);
  assert.match(requests.at(-1).prior_context_text,/Repairing bicycles/);
  assert.match(requests.at(-1).prior_context_text,/now prefer repairing electronics/);
  assert.equal((await restarted.list(conv.id)).length,2);
  assert.equal((await restarted.list('other-conversation')).length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
