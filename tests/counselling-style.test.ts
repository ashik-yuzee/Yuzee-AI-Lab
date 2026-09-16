import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeResponse} from '../src/ux/fixtures';
import {validateProtocol} from '../src/protocol/validator';
import {applyReviewedBlocks,TEACHING_REVIEW_INSTRUCTION} from '../src/services/TeachingAnswerReview';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {eligibleTools,scopedInstruction,ROUTER_VERSION} from '../src/routing/policy';
import style from '../src/routing/counsellingStyle.json';
const request=YuzeeRequestAssembler.getInstance().assembleRequest({model:'gemini-3.7-flash',messageText:'Explain this simply',useStructuredOutput:true});
assert.ok(request.systemInstruction.includes(style.instruction),'ordinary chat lost the flexible counselling policy');
assert.ok(TEACHING_REVIEW_INSTRUCTION.includes(style.instruction),'reviewer uses a conflicting style policy');
assert.ok(!request.systemInstruction.includes('must cover all 13 dimensions through the eight grouped sections'));
assert.ok(!TEACHING_REVIEW_INSTRUCTION.includes('Do not compress the answer'));
for(const t of eligibleTools){
 const prompt=scopedInstruction({status:'selected',toolId:t.id,score:.7,margin:.2,reason:'clear-semantic-match',version:ROUTER_VERSION});
 assert.ok(prompt.includes(style.instruction),t.id+' missed flexible teaching');
 assert.ok(prompt.includes('never require every section'),t.id+' missed individual snippet update');
}
// Three display labels must work as ordinary copy, without new protocol enums or fields.
const base=makeResponse();
const response=structuredClone(base);
response.content_blocks=[{...base.content_blocks[0],type:'text',title:'',text:'Explicitly stated: Unit A is required. Reasonably derived: understanding customer comments may be relevant. Not enough information: how it is practised or assessed.'}];
assert.equal(validateProtocol(response).protocolAccepted,true);
const long=structuredClone(base);long.content_blocks=Array.from({length:8},(_,i)=>({...response.content_blocks[0],id:'block-'+i,title:'Old section '+i}));
const condensed=applyReviewedBlocks(long,JSON.stringify({content_blocks:response.content_blocks}));
assert.equal(validateProtocol(condensed).protocolAccepted,true);
assert.deepEqual(condensed.interaction,long.interaction);
assert.deepEqual(condensed.service_trigger,long.service_trigger);
assert.throws(()=>applyReviewedBlocks(long,JSON.stringify({content_blocks:[{...response.content_blocks[0],text:'',items:[],rows:[]}]})));
assert.throws(()=>applyReviewedBlocks(long,JSON.stringify({content_blocks:response.content_blocks,service_trigger:{execute:true}})));
assert.ok(readFileSync('src/prompts/learning-depth.md','utf8').includes('NOT required sections'));
console.log('PASS: flexible guidance reaches ordinary chat, 103 selected tasks and reviewer; evidence labels render in the existing schema; concise rewrites preserve interaction/service state; empty and state-changing reviews rejected.');
