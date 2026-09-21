import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {normalizeCourse} from '../src/warehouse/normalize';import {WarehouseService,needsWarehouse} from '../src/warehouse/service';import {WarehouseCourses} from '../src/warehouse/WarehouseCourses';
import {workspaceDisposition} from '../src/objectives/workspacePolicy';
import {ObjectiveService} from '../src/objectives/service';import {sharedConversationContext} from '../src/orchestration/sharedContext';
import registry from '../qa/objectives/registry/workbook.json';
import {plannerSchema} from '../qa/objectives/schema.mjs';import {validateOutput} from '../qa/objectives/validate.mjs';

const row={id:1,course_name:'Certificate II in Plumbing',institution_name:'Sample College',national_code:'CPC20220',duration_text:'12 months',domestic_fee:0,international_fee:null,aqf_level:2,quality_scores_json:JSON.stringify({work_readiness_score:70,scoring_reason:'Foundation for further training.'}),work_readiness_score:70,canonical_url:'javascript:alert(1)',intelligence_json:JSON.stringify({verified_facts:{campuses:['Melbourne'],delivery_modes:['in_person'],entry_requirements:['Basic literacy'],intakes:'missing_or_not_verified'},skills:{technical_skills:['Safe tool use']},yuzee_outcome_layer:{student_outcome_headline:'Explore construction trades.',honest_weakness:'Further training is needed.'},assessment_model:{assessment_types:['practical_demonstration']}})};
const pack:any={status:'READY',queries:['plumbing'],courses:[normalizeCourse(row)],retrievedAt:new Date().toISOString(),sourcePolicy:'USER_APPROVED_CATALOGUE'};

test('mapping preserves real zero and missing values, course scores and source boundaries',()=>{
 const c=normalizeCourse(row);assert.equal(c.fees.domestic,'0');assert.equal(c.fees.international,null);assert.equal(c.source.url,null);assert.equal(c.quality[0].value,70);assert.equal(c.quality.length,1);assert.deepEqual(c.skills,['Safe tool use']);assert.equal(c.assessments[0],'practical demonstration');assert.doesNotMatch(JSON.stringify(c),/missing_or_not_verified/);
 assert.equal(normalizeCourse({...row,aqf_level:521}).level,null);
 assert.equal(normalizeCourse({...row,aqf_level:521,intelligence_json:JSON.stringify({classification:{framework_level:2}})}).level,'2');
 assert.equal(normalizeCourse({...row,quality_scores_json:'bad json',work_readiness_score:1000}).quality.length,0);
});
test('source-flagged contradictions cannot become course delivery or personal-fit facts',()=>{
 const bad=normalizeCourse({...row,quality_scores_json:JSON.stringify({scoring_reason:'A critical conflict in the source data about apprenticeship vs pre-apprenticeship.'})});
 assert.equal(bad.name,row.course_name);assert.ok(bad.evidenceIssues?.length);
 assert.equal(bad.duration,null);assert.deepEqual(bad.locations,[]);assert.deepEqual(bad.bestFor,[]);assert.deepEqual(bad.intelligence,[]);assert.deepEqual(bad.quality,[]);
 assert.equal(normalizeCourse({...row,quality_scores_json:JSON.stringify({scoring_reason:'No critical conflict was found.'})}).duration,'12 months');
 assert.equal(normalizeCourse({...row,quality_scores_json:JSON.stringify({scoring_reason:'Low score due to missing details.'})}).duration,'12 months');
});
test('course lookup intent respects closures and no-search requests',()=>{
 assert.equal(needsWarehouse('Compare nursing courses'),true);assert.equal(needsWarehouse('What does a plumber do in Ringwood?'),true);assert.equal(needsWarehouse('What about quality?','Compare plumbing courses'),true);assert.equal(needsWarehouse('Thanks','nursing course'),false);assert.equal(needsWarehouse("Don't search courses, just explain"),false);assert.equal(needsWarehouse('I have two job offers'),true);
});
test('course comparison can carry required catalogue references at every source-bearing level',()=>{
 const objective=registry.objectives.find(o=>o.tool_id==='STUDY_004')!;
 const context={user_message:'Compare these courses',confirmed_facts:{},approved_evidence:[{id:'warehouse_course_1'}],session:{interaction_count:0}};
 const schema=plannerSchema(objective,context);
 const dimensionSchema=schema.properties.result.properties.comparison_dimensions.items.anyOf[0];
 assert.deepEqual(dimensionSchema.properties.evidence_refs,{type:'array',items:{type:'string'}});
 const result={summary:'Sample comparison.',courses:[],comparison_dimensions:[{criterion:'Learning',course_values:['Safe tool use'],source_status:'SOURCED_CURRENT_FACT',evidence_refs:['warehouse_course_1']}],user_priorities:[],tradeoffs:[],unknowns:[],next_actions:[]};
 const plan={objective_id:'STUDY_004',status:'COMPLETE',stage:'UNDERSTAND',ui:[],confirmed_inputs:{},derived_signals:[],unknowns:[],result,readiness:{enabled:false,name:null,score:null,dimensions:[],blockers:[]},next_actions:[],handoff:{summary:result.summary,confirmed_user_inputs:{},result:{summary:result.summary},evidence_and_unknowns:[],recommended_next_action:'Compare options'}};
 assert.equal(validateOutput(JSON.stringify(plan),objective,context).passed,true);
 result.comparison_dimensions[0].evidence_refs=[];
 assert.ok(validateOutput(JSON.stringify(plan),objective,context).failures.some((f:any)=>f.code==='UNAPPROVED_EVIDENCE'));
 result.comparison_dimensions[0].evidence_refs=['made_up'];
 assert.ok(validateOutput(JSON.stringify(plan),objective,context).failures.some((f:any)=>f.code==='UNAPPROVED_EVIDENCE'));
});
test('workspace displays interactive course controls without raw fields or invented fees',()=>{
 const html=renderToStaticMarkup(<WarehouseCourses pack={pack} onFocus={()=>{}}/>);
 for(const text of ['Course comparison','checkbox','Learning, outcomes and quality','Course quality indicators','70/100','Explore selected course','Further training is needed'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/javascript:|missing_or_not_verified|intelligence_json|published|draft/);assert.match(html,/These describe the course/);
 const saved=renderToStaticMarkup(<WarehouseCourses pack={pack} selectedIds={['1']} onFocus={()=>{}}/>);assert.match(saved,/Saved to this conversation/);
});

test('worker searches draft courses without modifying source; exact provider and two-query coverage',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'warehouse-search-')),source=path.join(root,'source.sqlite'),index=path.join(root,'search.sqlite');
 const fields=fs.readFileSync('src/warehouse/catalogue-worker.cjs','utf8').match(/const fields=`([^`]+)`/)![1].split(',');const db=new DatabaseSync(source);
 db.exec('CREATE TABLE live_courses ('+fields.map(k=>k==='id'?'id INTEGER PRIMARY KEY':k+' TEXT').join(',')+',published INTEGER,private_contact TEXT)');
 const write=db.prepare('INSERT INTO live_courses(id,course_name,institution_name,national_code,published,private_contact,intelligence_json) VALUES(?,?,?,?,?,?,?)');
 write.run(1,'Certificate II in Plumbing','Sample College','CPC20220',0,'SECRET','{}');write.run(2,'Bachelor of Nursing','Sample University','BN',0,'SECRET','{}');write.run(3,'Certificate II in Plumbing','Another College','CPC20220',0,'SECRET','{}');write.run(4,'Certificate III in Plumbing','Sample College','CPC32420',0,'SECRET','{}');db.close();
 const original=fs.readFileSync(source);const w=new WarehouseService({source,index});
 try{
  w.start();const start=Date.now();while(w.status().status==='PREPARING'&&Date.now()-start<15000)await new Promise(r=>setTimeout(r,20));assert.equal(w.status().status,'READY');
  const results=await w.lookup(['Certificate II plumbing Sample','nursing']);assert.equal(results.status,'READY');assert.deepEqual(results.courses.map(c=>c.id).sort(),['1','2']);assert.doesNotMatch(JSON.stringify(results),/SECRET/);
  assert.equal((await w.lookup(['plumbing NonexistentProvider'])).status,'NO_MATCH');
  assert.equal((await w.lookup(['" OR SELECT * FROM live_courses; --'])).status,'NO_MATCH');
  assert.deepEqual(fs.readFileSync(source),original);
  w.setPlanner(async()=>({steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({action:'COURSES',queries:['nursing'],reuse_selected:false})}]}]}));
  const changed=await w.retrieve({message:'Show nursing courses instead',selectedCourseIds:['1']});assert.deepEqual(changed.courses.map(c=>c.id),['2']);
  w.setPlanner(async()=>({output_text:JSON.stringify({action:'NONE',queries:[],reuse_selected:false})}));assert.equal((await w.retrieve({message:'Explain courses generally'})).status,'NOT_NEEDED');
  w.setPlanner(async()=>({output_text:'malformed'}));assert.equal((await w.retrieve({message:'Compare courses'})).status,'UNAVAILABLE');
  const abort=new AbortController();abort.abort();await assert.rejects(w.lookup(['nursing'],[],abort.signal));
 }finally{w.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('selected course stays saved after model failure, retry and reload; unknown IDs rejected',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'warehouse-selection-'));const requests:any[]=[];let fail=false;
 const model=async(req:any)=>{if(fail)throw Error('Fictional provider failure');const input=JSON.parse(req.input);requests.push(input);const result={summary:'Explore this course.',interest_themes:[],unknowns:[],next_actions:[]};return {output_text:JSON.stringify({objective_id:'DISCOVER_001',status:'COMPLETE',stage:'UNDERSTAND',ui:[],confirmed_inputs:input.confirmed_facts,derived_signals:[],unknowns:[],result,readiness:{enabled:false,name:null,score:null,dimensions:[],blockers:[]},next_actions:[],handoff:{summary:result.summary,confirmed_user_inputs:input.confirmed_facts,result:{summary:result.summary},evidence_and_unknowns:[],recommended_next_action:'Explore course options'}})};};
 const conv={id:'fictional-course-test',messages:[{id:'u1',role:'user',content:'Explore plumbing courses'}]},signal=new AbortController().signal;
 try{
  const alternatives={...pack,courses:[...pack.courses,normalizeCourse({...row,id:2,institution_name:'Another College'})]};
  const svc=new ObjectiveService(root,model,async(input)=>structuredClone(input.selectedCourseIds?.length?pack:alternatives));const s=await svc.start(conv,{objectiveId:'DISCOVER_001'},signal);
  assert.equal(requests[0].approved_evidence[0].id,'warehouse_course_1');assert.equal(s.context.warehouse_data.courses[0].id,'1');
  await assert.rejects(svc.focusCourses(conv.id,s.id,{revision:s.revision,courseIds:['999']},signal,conv),/Choose courses/);
  fail=true;await assert.rejects(svc.focusCourses(conv.id,s.id,{revision:s.revision,courseIds:['1']},signal,conv));
  const pending=await svc.get(conv.id,s.id);assert.match(pending.pendingCorrection!.text,/Certificate II in Plumbing/);assert.deepEqual((pending.pendingCorrection as any).courseIds,['1']);
  fail=false;const next=await svc.correct(conv.id,s.id,{revision:s.revision,retry:true},signal,conv);
  assert.deepEqual(next.context.selected_course_ids,['1']);assert.equal(next.pendingCorrection,undefined);
  assert.deepEqual(next.context.warehouse_data.courses.map((c:any)=>c.id),['1','2'],'previous alternatives remain available for changing the choice');
  assert.deepEqual(requests.at(-1).warehouse_data.courses.map((c:any)=>c.id),['1'],'the model receives only the current retrieval, not saved alternatives');
  assert.match(requests.at(-1).user_message,/now focusing only/,'current selection supersedes the original question in the model request');
  assert.ok(!requests.at(-1).approved_evidence.some((e:any)=>e.id==='warehouse_course_2'),'evidence paths match the focused model context');
  const reloaded=await new ObjectiveService(root,model).get(conv.id,s.id);assert.deepEqual(reloaded.context.selected_course_ids,['1']);assert.match(JSON.stringify(sharedConversationContext(conv,[reloaded])),/exploration choice, not an enrolment decision/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

 test('explicit catalogue comparison can open below the generic similarity gate, with independent intent checks',()=>{
 const d={decision:'SUGGEST',objective_id:'STUDY_004',confidence:'HIGH',workspace_need:'REQUIRED'},c:any=[{id:'STUDY_004',score:.685}];
 assert.equal(workspaceDisposition(d,c,false,'Compare these courses','',true),'AUTO_OPEN');
 assert.equal(workspaceDisposition(d,c,false,'Compare these courses','',false),'SUGGEST');
 assert.equal(workspaceDisposition(d,c,false,'Compare these courses but stay in chat','',true),'NONE');
 assert.equal(workspaceDisposition({...d,confidence:'LOW'},c,false,'Compare these courses','',true),'SUGGEST');
 assert.equal(workspaceDisposition(d,c,true,'Compare these courses','',true),'NONE');
 assert.equal(workspaceDisposition(d,[],false,'Compare these courses','',true),'SUGGEST');
 });

test('role and skill choices survive failure and retry and are available in subsequent chat recall',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'skills-save-'));let fail=false;const requests:any[]=[];
 const model=async(req:any)=>{if(fail)throw Error('Fictional interruption');const input=JSON.parse(req.input);requests.push(input);const result={summary:'Explore relevant work.',interest_themes:[],unknowns:[],next_actions:[]};return {output_text:JSON.stringify({objective_id:'DISCOVER_001',status:'COMPLETE',stage:'UNDERSTAND',ui:[],confirmed_inputs:input.confirmed_facts,derived_signals:[],unknowns:[],result,readiness:{enabled:false,name:null,score:null,dimensions:[],blockers:[]},next_actions:[],handoff:{summary:result.summary,confirmed_user_inputs:input.confirmed_facts,result:{summary:result.summary},evidence_and_unknowns:[],recommended_next_action:'Explore work'}})};};
 const exploration={roles:[{id:'role:support',title:'Support specialist',evidenceId:'warehouse_role_support'}],skills:[{id:'skill:listening',name:'Active Listening'}],jobs:[],learning:[],observedSkills:[]};
 const inputPack:any={...pack,courses:[],connected:{careers:[],providers:[],industries:[],signals:[],exploration}};
 const conv={id:'fictional-skills-save',messages:[{id:'u1',role:'user',content:'I want to explore work using my skills.'}]},signal=new AbortController().signal;
 try{
  const svc=new ObjectiveService(root,model,async()=>structuredClone(inputPack));const s=await svc.start(conv,{objectiveId:'DISCOVER_001'},signal);
  await assert.rejects(svc.correct(conv.id,s.id,{revision:s.revision,explorationChoices:{roleIds:['invented'],skills:[]}},signal),/Choose a role/);
  fail=true;await assert.rejects(svc.correct(conv.id,s.id,{revision:s.revision,explorationChoices:{roleIds:['role:support'],skills:[{id:'skill:listening',state:'HAVE'}]}},signal));
  const pending=await svc.get(conv.id,s.id);assert.equal(pending.pendingCorrection?.explorationChoices?.skills[0].state,'HAVE');assert.match(pending.pendingCorrection!.text,/I say I have experience using: Active Listening/);
  fail=false;const next=await svc.correct(conv.id,s.id,{revision:s.revision,retry:true},signal,conv);const reload=await new ObjectiveService(root,model).get(conv.id,s.id);assert.deepEqual(reload.context.exploration_choices,next.context.exploration_choices);assert.equal(next.pendingCorrection,undefined);
  assert.match(JSON.stringify(sharedConversationContext(conv,[reload])),/not verified competence/);assert.equal(requests.at(-1).exploration_choices.skills[0].state,'HAVE');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('an explicit workspace request is honoured below the proactive similarity cutoff, with selector and opt-out checks',()=>{
 const d={decision:'SUGGEST',objective_id:'JOB_DISCOVER_002',confidence:'HIGH',workspace_need:'REQUIRED'},c:any=[{id:'JOB_DISCOVER_002',score:.685}];
 assert.equal(workspaceDisposition(d,c,false,'Map my skills to work. Open the workspace so I can mark my skills.'),'AUTO_OPEN');
 assert.equal(workspaceDisposition(d,c,false,'What jobs use these skills?'),'SUGGEST');
 assert.equal(workspaceDisposition({...d,confidence:'LOW'},c,false,'Open the workspace'),'SUGGEST');
 assert.equal(workspaceDisposition({...d,workspace_need:'NONE'},c,false,'Open the workspace'),'SUGGEST');
 assert.equal(workspaceDisposition(d,[],false,'Open the workspace'),'SUGGEST');
 assert.equal(workspaceDisposition(d,c,true,'Open the workspace'),'NONE');
 assert.equal(workspaceDisposition(d,c,false,"Don't open the workspace"),'NONE');
});
