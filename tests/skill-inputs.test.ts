import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleTools,scopedInstruction,abstain} from '../src/routing/policy';
import {skillInputContracts,skillInputInstruction} from '../src/routing/skillInputs';
import {continueSkillQuestion} from '../src/routing/skillContinuation';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
assert.equal(skillInputContracts.length,103);
assert.deepEqual(skillInputContracts.map(c=>c.id).sort(),eligibleTools.map(t=>t.id).sort());
assert.equal(new Set(skillInputContracts.map(c=>c.id)).size,103);
const assembler=YuzeeRequestAssembler.getInstance();
for(const c of skillInputContracts){
 assert.ok(['explain','scoped','personal'].includes(c.mode));
 for(const field of ['subject','needed_for_specific_answer','first_question','optional_details','evidence_rule','without_new_input'] as const)assert.ok(c[field]?.trim(),`${c.id} ${field}`);
 const instruction=scopedInstruction({status:'selected',toolId:c.id,reason:'user-selected-skill',version:'test'});
 assert.ok(instruction.includes(c.needed_for_specific_answer));
 assert.equal(instruction.split('SKILL INPUT CONTRACT v1').length-1,1);
 assert.ok(instruction.includes('NOT a mandatory intake form'));
 assert.ok(instruction.includes('Missing evidence is a source problem'));
 assert.ok(instruction.includes('interaction.kind=none'));
 const req=assembler.assembleRequest({model:'gemini-3.7-flash',messageText:'Explain this topic',microToolInstruction:instruction,useStructuredOutput:true});
 assert.ok(JSON.stringify(req).includes(c.needed_for_specific_answer),c.id+' lost in request');
}
assert.equal(skillInputInstruction('CORE_001'),'');assert.equal(skillInputInstruction('unknown'),'');assert.equal(scopedInstruction(abstain('ambiguous')),'');
const question={kind:'question',question_id:'q-fees',input_type:'text',question:'Are you checking domestic or international fees?',options:[],fields:[],allow_self_input:true};
const msg={id:'a1',role:'assistant',structuredResponse:{interaction:question,state:{},content_blocks:[]},telemetry:{routing:{status:'selected',toolId:'COURSE_011'},validation:{protocolAccepted:true}}};
const answer=(text='Domestic')=>({userEvent:{interaction:{question_id:'q-fees',self_input:text}}});
const decide=(messages:any[]=[msg],active:any=question,event:any=answer())=>continueSkillQuestion(messages,active,event);
assert.equal(decide().toolId,'COURSE_011');
assert.equal(decide().reason,'skill-question-continuation');
assert.ok(scopedInstruction(decide()).includes('Continue the previously selected skill'));
assert.equal(decide([msg],question,answer('I am not sure')).status,'selected');
const next={...msg,telemetry:{...msg.telemetry,routing:decide()}};
assert.equal(decide([next]).toolId,'COURSE_011');
for(const text of ['Stop','Actually, a different career','Instead show me courses','This is an emergency'])assert.equal(decide([msg],question,answer(text)).status,'abstained');
for(const event of [undefined,{},answer(' '),{interaction:{question_id:'old',self_input:'Domestic'}},{interaction:{question_id:'q-fees',selected_option_ids:['invented']}},{interaction:{question_id:'q-fees',action_id:'fake'}}])assert.equal(continueSkillQuestion([msg],question,event).status,'abstained');
for(const changed of [{...msg,error:'failed'},{...msg,streamStopped:true},{...msg,structuredResponse:undefined},{...msg,telemetry:{routing:{status:'selected',toolId:'CORE_001'}}},{...msg,telemetry:{routing:{status:'selected',toolId:'unknown'}}},{...msg,telemetry:{...msg.telemetry,validation:{protocolAccepted:false}}},{...msg,structuredResponse:{...msg.structuredResponse,state:{safety_override_applied:true}}},{...msg,structuredResponse:{...msg.structuredResponse,service_trigger:{trigger_now:true}}}])assert.equal(decide([changed]).status,'abstained');
assert.equal(decide([msg,{role:'user'}]).status,'abstained');
assert.equal(decide([msg],{...question,question_id:'other'}).status,'abstained');
const menu={...question,input_type:'single_select',question:'What would you like to explore next?',options:[{id:'fees',label:'Fees'}]};
assert.equal(decide([{...msg,structuredResponse:{...msg.structuredResponse,interaction:menu}}],menu,{interaction:{question_id:'q-fees',selected_option_ids:['fees']}}).status,'abstained');
// Actual component event envelope, including legacy compatibility form.
assert.equal(decide([msg],question,{type:'text_answer',interaction_id:'q-fees',value:'International'}).status,'selected');
const html=readFileSync('output/html/Yuzee-103-Skill-Input-Review.html','utf8');
assert.equal((html.match(/<tr data-mode=/g)||[]).length,103);
for(const c of skillInputContracts)assert.ok(html.includes(c.id));
const tsv=readFileSync('docs/plans/skill-input-review.tsv','utf8').trim().split('\n').slice(1).map(line=>line.split('\t'));
for(const [id,mode,subject,needed,questionText,optional] of tsv){const c=skillInputContracts.find(x=>x.id===id)!;assert.deepEqual([c.mode,c.subject,c.needed_for_specific_answer,c.first_question,c.optional_details],[mode,subject,needed,questionText,optional]);}
console.log('PASS: 103 input contracts reach request assembly; reviewed data/report agree; skill question continuation accepts current valid answers and rejects stale, missing, invalid, safety and changed-topic answers. These tests do not certify Gemini answer quality.');
