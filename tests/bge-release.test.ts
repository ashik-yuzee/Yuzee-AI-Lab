import assert from 'node:assert/strict';
import {routingInput,routingSkipReason,acceptClientRoute,chooseRoute,scopedInstruction} from '../src/routing/policy';
import {chooseNeed,acceptNeedHint,assessTurnNeeds} from '../src/routing/turnNeeds';
import {choosePathwayHint,validPathwayHint} from '../src/miniPathway/policy';
import {bgeProfiles,taskRanking} from '../src/routing/bgeProfiles';
import {BGE_MODEL_ID} from '../src/routing/bgeMatching';
import {EmbeddingQueue} from '../src/routing/EmbeddingQueue';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
const course={role:'user',content:'I am considering the Bachelor of Nursing at Deakin University. I have 12 hours a week available.'};
for(const text of ['what about cost?','what jobs?','quality','go deeper','does that qualify me?']){
 const q=routingInput(text,[course]);assert.equal(q.resolved,true,text);assert.match(q.text,/Deakin/);assert.match(q.text,/12 hours/);
 assert.equal(routingInput(text,[]).skip,'needs-context',text);
 assert.equal(routingInput(text,[{...course,role:'assistant'}]).skip,'needs-context',text);
}
for(const text of ['what about that one?','what about the second one?','compare them'])assert.equal(routingInput(text,[course]).skip,'needs-context');
const pair={role:'user',content:'I am considering the Bachelor of Nursing at Deakin and the Bachelor of Nursing at Monash.'};
assert.equal(routingInput('compare them',[pair]).resolved,true);
assert.equal(routingInput('compare them',[{...pair,content:pair.content+' Also the Bachelor of Nursing at La Trobe.'}]).skip,'needs-context');
assert.equal(routingInput('what about cost?',[course,{role:'user',content:'New topic: I want to be a chef.'}]).skip,'needs-context');
assert.equal(routingInput('what about cost?',[course,{role:'user',content:'Tell me about accounting careers.'}]).skip,'needs-context');
assert.equal(routingInput('what about cost?',[course],true).skip,'structured-answer');
assert.equal(routingSkipReason('How can I stop feeling overwhelmed by course choices?'),null);
assert.equal(routingSkipReason('Please stop suggesting courses.'),'correction-or-boundary');
const route=chooseRoute([{toolId:'COURSE_011',score:.8},{toolId:'COURSE_012',score:.6},{toolId:'__OUT_OF_SCOPE__',score:.3}]);
assert.equal(acceptClientRoute(route,'AUTO','@Oala what about cost?',false,[course]).toolId,'COURSE_011');
assert.equal(acceptClientRoute(route,'AUTO','@Oala what about cost?',false,[]).status,'abstained');
assert.equal(acceptClientRoute({...route,modelId:'Xenova/all-MiniLM-L6-v2'},'AUTO','@Oala explain tuition fees please').reason,'unknown-model');
const need=chooseNeed([{id:'research',score:.7},{id:'answer',score:.65},{id:'other',score:.2}],BGE_MODEL_ID);
assert.equal(need.profileVersion,bgeProfiles.needs.version);assert.equal(acceptNeedHint(need)?.kind,'research');
assert.equal(acceptNeedHint({...need,profileVersion:'forged'}),undefined);
assert.equal(assessTurnNeeds({text:'What is an elective?',hint:need}).action,'answer');
assert.equal(assessTurnNeeds({text:'Can I fit study around work?',history:[course],hint:chooseNeed([{id:'clarify',score:.8},{id:'answer',score:.4}],BGE_MODEL_ID)}).action,'answer');
assert.equal(chooseNeed([{id:'clarify',score:.56},{id:'research',score:.53},{id:'answer',score:.4}],BGE_MODEL_ID).status,'abstained');
assert.equal(acceptNeedHint({...need,kind:'clarify',score:.56,margin:.03}),undefined);
const path=choosePathwayHint([{id:'pathway',score:.8},{id:'other',score:.6}],BGE_MODEL_ID);assert.equal(validPathwayHint(path),true);assert.equal(validPathwayHint({...path,profileVersion:'forged'}),false);
assert.deepEqual(taskRanking([{id:'pathway',score:.5},{id:'other',score:.49}],['pathway','other'],bgeProfiles.pathway).failedGates,['min-similarity','top2-margin']);
const order:string[]=[],queue=new EmbeddingQueue();let release!:()=>void;
async function* slow(){order.push('optional-first');await new Promise<void>(r=>release=r);yield;order.push('optional-last');}
async function* quick(name:string){order.push(name);}
queue.enqueue('optional','suggest',slow());
queue.enqueue('topic','topic',quick('topic'));queue.enqueue('route','route',quick('route'));queue.enqueue('needs','needs',quick('needs'));queue.enqueue('path','pathway',quick('path'));queue.enqueue('cancelled','route',quick('cancelled'));queue.cancel('cancelled');release();
await new Promise(r=>setTimeout(r,40));assert.deepEqual(order,['optional-first','route','needs','path','topic','optional-last']);
const assembler=YuzeeRequestAssembler.getInstance();const cfg={model:'gemini-3.7-flash',messageText:'@Oala what about cost?',useStructuredOutput:true};
const a=assembler.assembleRequest(cfg),b=assembler.assembleRequest({...cfg,microToolInstruction:scopedInstruction(route)});
assert.equal(a.systemInstruction,b.systemInstruction);assert.ok(JSON.stringify(b).includes('COURSE_011'));assert.ok(JSON.stringify(b).includes('what about cost?'));
console.log('PASS short-context provenance, ambiguity/reset/stop boundaries, server agreement, BGE profile validation, known-input reuse, queue priority/cancel and Gemini request assembly.');
