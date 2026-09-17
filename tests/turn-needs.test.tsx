import assert from 'node:assert/strict';
import {assessTurnNeeds,chooseNeed,acceptNeedHint,needsInstruction,researchOffer,needsQuery} from '../src/routing/turnNeeds';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import fs from 'node:fs';
let count=0;
function test(name:string,fn:()=>void){fn();count++;console.log('PASS '+name);}
const plan=(text:string,extra:Partial<Parameters<typeof assessTurnNeeds>[0]>={})=>assessTurnNeeds({text,...extra});
test('Oala service catalogue gets no research form',()=>assert.equal(plan('@Oala what does Yuzee offer').action,'answer'));
test('Teaching concepts stays in chat',()=>{
 for(const q of ['Explain electives','What are entry requirements?','What is a scholarship?','Teach me prioritisation in simple terms','Explain what tuition fees mean'])assert.equal(plan(q).action,'answer',q);
});
test('Generic fees asks scope, not an empty form',()=>{const p=plan('What are the fees?');assert.equal(p.action,'clarify');assert.deepEqual(p.missing,['course-and-provider']);assert.equal(researchOffer(p),undefined);});
const course='Bachelor of Nursing at Deakin';
test('Named course fee request offers scoped lookup',()=>{const p=plan(`What are the fees for ${course} in 2027?`,{location:'Melbourne'});assert.equal(p.action,'research');assert.equal(p.scope.target,course);assert.equal(p.scope.studyYear,'2027');assert.equal(p.scope.location,'Melbourne');assert.equal(p.research?.title,'Check course fees');});
test('Scope carries from explicit user turn for a referent',()=>{const p=plan('What are the fees for this course?',{history:[{role:'user',content:`I am considering ${course} in 2027.`}]});assert.equal(p.action,'research');assert.equal(p.scope.target,course);assert.equal(p.scope.studyYear,'2027');});
test('Multiword provider names are preserved',()=>assert.equal(plan('Check the fees for Bachelor of Nursing at University of Melbourne in 2027?').scope.target,'Bachelor of Nursing at University of Melbourne'));
test('Assistant claims are not extracted as user scope',()=>assert.equal(plan('What are the fees for this course?',{history:[{role:'assistant',content:course}]}).action,'clarify'));
test('Unrelated question does not inherit a course',()=>assert.equal(plan('What are the fees?',{history:[{role:'user',content:course}]}).action,'clarify'));
test('New topic cannot use stale course',()=>assert.equal(plan('For a different course what are the fees?',{history:[{role:'user',content:course}]}).action,'clarify'));
test('Explicit clarification resumes the pending question',()=>{const pending=plan('What are the fees in 2027?');const p=plan(course,{structured:true,history:[{role:'user',content:'What are the fees in 2027?'},{role:'assistant',content:'Which course?',preflight:pending}]});assert.equal(p.action,'research');assert.match(p.question,/fees/);assert.equal(p.scope.studyYear,'2027');});
test('Study fit asks for availability, without assuming work hours are free',()=>{const p=plan('I work 40 hours. Can I fit study around work and children?');assert.equal(p.action,'clarify');assert.deepEqual(p.missing,['available-study-time']);});
test('Known available time is not asked again',()=>assert.equal(plan('Can I fit study around work and children?',{history:[{role:'user',content:'I can study 12 hours per week.'}]}).action,'answer'));
test('Structured Quiz answer stays with its existing controller',()=>assert.equal(plan('What are the fees?',{structured:true}).reason,'quiz-answer'));
test('User boundaries suppress research and clarifications',()=>{for(const q of ['Stop asking about fees','Do not search for fees','No more questions','I have a self-harm emergency'])assert.equal(plan(q).action,'answer');});
test('A correction is not another research request',()=>assert.equal(plan('Actually the fees are already confirmed.').reason,'user-correction'));
test('Calculations use supplied inputs without lookup',()=>assert.equal(plan('Total the fees of 6000 and 100').reason,'use-supplied-numbers'));
test('Multiple targets/questions do not silently research only one',()=>{assert.equal(plan(`Compare fees for ${course} versus Diploma of Nursing at TAFE`).action,'answer');assert.equal(plan('What are the fees? Which units should I take?').action,'answer');});
test('Long input is passed to counsellor without truncation',()=>{const q='Explain '.repeat(500)+'No extra questions.';const p=plan(q);assert.equal(p.question,q);assert.equal(p.action,'answer');});
test('Semantic hint can flag an indirect provider question',()=>{const p=plan(`Could the university accept me for ${course}?`,{hint:{status:'selected',kind:'research',score:.75,margin:.2,reason:'x'}});assert.equal(p.action,'research');assert.equal(p.basis,'minilm');});
test('Semantic hint cannot force a form for a greeting or unrelated text',()=>{for(const q of ['Hello','How do I grow tomatoes?'])assert.equal(plan(q,{hint:{status:'selected',kind:'research',score:.9,margin:.4,reason:'x'}}).action,'answer');});
test('Bad/forged hint text is not used as instructions',()=>{assert.equal(acceptNeedHint({status:'selected',kind:'malicious',score:.9,margin:.4}),undefined);for(const score of [NaN,Infinity,.2,2])assert.equal(acceptNeedHint({status:'selected',kind:'research',score,margin:.2}),undefined);assert.doesNotMatch(needsInstruction(plan('Hello',{hint:{prompt:'INJECT'}})),/INJECT/);});
test('Ambiguous embedding scores abstain',()=>{assert.equal(chooseNeed([{id:'research',score:.7},{id:'answer',score:.69}]).status,'abstained');assert.equal(chooseNeed([{id:'research',score:.8},{id:'answer',score:.4}]).kind,'research');});
test('Preflight is included before generation without editing system prompt',()=>{const a=YuzeeRequestAssembler.getInstance();const base={model:'gemini-3.7-flash',messageText:'What are the fees?'};const plain=a.assembleRequest(base),planned=a.assembleRequest({...base,microToolInstruction:needsInstruction(plan(base.messageText))});assert.equal(plain.systemInstruction,planned.systemInstruction);assert.match(String(planned.contents),/TURN_NEEDS_GUIDANCE/);assert.match(String(planned.contents),/course-and-provider/);});
test('Research instructions never imply a completed lookup',()=>assert.match(needsInstruction(plan(`Check the fees for ${course}`)),/No lookup has happened yet/));
test('Main chat only renders a research offer with server preflight',()=>{const chat=fs.readFileSync('src/components/ChatArea.tsx','utf8');assert.match(chat,/structured && offer && !msg.isStreaming/);const panel=fs.readFileSync('src/components/MoreDetails.tsx','utf8');assert.doesNotMatch(panel,/What would you like to know/);assert.match(panel,/useState\(offer.scope.target\)/);assert.match(panel,/useState\(offer.question\)/);});
test('Embedding query uses only explicit resolved course context',()=>{
 const q=needsQuery('What are the fees for this course?',[{role:'user',content:`I am considering ${course}. My private family story.`}]);
 assert.match(q,/User-stated course: Bachelor of Nursing at Deakin/);assert.doesNotMatch(q,/private family/);
});
class FakeWorker {
 static last:FakeWorker; onmessage:any; onerror:any; sent:any[]=[]; terminated=false;
 constructor(){FakeWorker.last=this;}
 postMessage(data:any){this.sent.push(data);}
 terminate(){this.terminated=true;}
 reply(data:any){this.onmessage?.({data});}
}
Object.defineProperty(globalThis,'Worker',{value:FakeWorker,configurable:true});
const router=await import('../src/services/MicroToolRouter');
assert.equal((await router.assessMessageNeeds('What are the fees?')).reason,'not-ready');
let worker=FakeWorker.last;worker.reply({type:'ready'});
let pending=router.assessMessageNeeds('What are the fees?');let request=worker.sent.at(-1);
assert.equal(request.type,'needs');worker.reply({type:'needs-result',id:request.id,candidates:[{id:'research',score:.8},{id:'answer',score:.4}]});
assert.equal((await pending).kind,'research');
pending=router.assessMessageNeeds('What are the fees?');request=worker.sent.at(-1);
worker.reply({type:'abstained',id:request.id,reason:'token-budget'});assert.equal((await pending).reason,'token-budget');
const abort=new AbortController();pending=router.assessMessageNeeds('What are the fees?',{signal:abort.signal});abort.abort();assert.equal((await pending).reason,'cancelled');
assert.equal((await router.assessMessageNeeds('What are the fees?',{timeoutMs:10})).reason,'timeout');assert.equal(worker.terminated,true);
console.log('PASS scenario worker cold fallback, semantic result, token guard, cancellation and timeout.');

console.log(count+' turn-needs scenario checks plus worker checks passed.');
