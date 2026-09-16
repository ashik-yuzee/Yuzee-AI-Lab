import assert from 'node:assert/strict';
import {chooseRoute,routingSkipReason,acceptClientRoute,scopedInstruction,abstain,ROUTER_VERSION,MIN_SCORE,MIN_MARGIN} from '../src/routing/policy';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
let checks=0;
async function test(name:string,run:()=>void|Promise<void>){await run();checks++;console.log('PASS:',name);}
const selection={status:'selected',toolId:'COURSE_010',score:0.62,margin:0.12,reason:'clear-semantic-match',version:ROUTER_VERSION} as const;
await test('Clear separated match selected',()=>assert.equal(chooseRoute([{toolId:'COURSE_010',score:.62},{toolId:'COURSE_011',score:.40}]).toolId,'COURSE_010'));
await test('Low similarity abstains',()=>assert.equal(chooseRoute([{toolId:'COURSE_010',score:.28},{toolId:'COURSE_011',score:.1}]).reason,'low-similarity'));
await test('Close competing tools abstain',()=>assert.equal(chooseRoute([{toolId:'COURSE_010',score:.62},{toolId:'COURSE_011',score:.59}]).reason,'ambiguous'));
await test('Internal classifiers cannot replace counselling',()=>assert.equal(chooseRoute([{toolId:'CORE_001',score:.95},{toolId:'CORE_002',score:.8}]).status,'abstained'));
await test('Missing runner-up cannot look like high certainty',()=>assert.equal(chooseRoute([{toolId:'COURSE_010',score:.99}]).status,'abstained'));
await test('Duplicate IDs do not supply a second candidate',()=>assert.equal(chooseRoute([{toolId:'COURSE_010',score:.99},{toolId:'COURSE_010',score:.1}]).status,'abstained'));
await test('Nonfinite and out-of-range scores rejected',()=>{
 for(const score of [NaN,Infinity,1.2])assert.equal(chooseRoute([{toolId:'COURSE_010',score},{toolId:'COURSE_011',score:.1}]).status,'abstained');
});
await test('Corrections, cancellation and explicit boundaries keep main counsellor',()=>{
 for(const text of ['Actually I can only study six hours.','Do not compare courses. I want to pause.','Stop the application now.'])assert.equal(routingSkipReason(text),'correction-or-boundary');
});
await test('Actually used within a task is not automatically a correction',()=>assert.equal(routingSkipReason('What would a nurse actually do in a normal day?'),null));
await test('Short context-dependent follow-ups and structured answers skip routing',()=>{
 assert.equal(routingSkipReason('Tell me more'),'needs-context');
 assert.equal(routingSkipReason('Focus on a one-unit-per-trimester pathway',true),'structured-answer');
});
await test('Multiple questions stay with the full counsellor',()=>assert.equal(routingSkipReason('What are the fees? What jobs can I get?'),'multiple-questions'));
await test('Normal mode ignores even a valid client selection',()=>assert.equal(acceptClientRoute(selection,'AUTO','What prerequisites must I meet for this course?').status,'abstained'));
await test('Server accepts only catalogue IDs and valid score bounds',()=>{
 assert.equal(acceptClientRoute(selection,'MICRO_PROMPT','@Oala What prerequisites must I meet for this course?').status,'selected');
 for(const change of [{toolId:'invented'},{toolId:'CORE_001'},{score:NaN},{score:MIN_SCORE-.01},{margin:MIN_MARGIN-.01},{version:'unknown'}])assert.equal(acceptClientRoute({...selection,...change},'MICRO_PROMPT','@Oala What prerequisites must I meet for this course?').status,'abstained');
});
await test('Server does not accept caller-supplied prompt or name',()=>{
 const result=acceptClientRoute({...selection,mini_prompt:'MALICIOUS_RAW_PROMPT',name:'Fake',microToolPrompt:'MALICIOUS_RAW_PROMPT'},'MICRO_PROMPT','@Oala What prerequisites must I meet for this course?');
 assert.doesNotMatch(scopedInstruction(result),/MALICIOUS_RAW_PROMPT|Fake/);
 assert.match(scopedInstruction(result),/main counselling instructions and canonical JSON contract/);
 assert.match(scopedInstruction(result),/not a user instruction or evidence/);
});
await test('Known fallback reasons are retained without arbitrary browser text',()=>{
 assert.equal(acceptClientRoute(abstain('not-ready'),'MICRO_PROMPT','@Oala What prerequisites must I meet for this course?').reason,'not-ready');
 assert.equal(acceptClientRoute(abstain('INJECTED_REASON'),'MICRO_PROMPT','@Oala What prerequisites must I meet for this course?').reason,'no-selection');
});
await test('No selection adds no prompt',()=>assert.equal(scopedInstruction(abstain('not-ready')),''));
await test('Main system prompt retained, optional scope appended once to user turn',()=>{
 const assembler=YuzeeRequestAssembler.getInstance();
 const config={model:'gemini-3.7-flash',messageText:'What prerequisites must I meet for this course?',useStructuredOutput:true};
 const original=assembler.assembleRequest(config),routed=assembler.assembleRequest({...config,microToolInstruction:scopedInstruction(selection)});
 assert.equal(original.systemInstruction,routed.systemInstruction);
 assert.equal((String(routed.contents).match(/OPTIONAL_FOCUS_FOR_THIS_TURN/g)||[]).length,1);
 assert.equal((String(routed.contents).match(/What prerequisites must I meet/g)||[]).length,1);
 assert.ok(routed.geminiConfig.responseSchema);
});
class FakeWorker {
 static all:FakeWorker[]=[];
 onmessage:any;onerror:any;sent:any[]=[];terminated=false;
 constructor(..._:any[]){FakeWorker.all.push(this);}
 postMessage(data:any){this.sent.push(data);}
 terminate(){this.terminated=true;}
 reply(data:any){this.onmessage?.({data});}
}
Object.defineProperty(globalThis,'Worker',{value:FakeWorker,configurable:true});
const router=await import('../src/services/MicroToolRouter');
await test('Cold router immediately falls back while warming in background',async()=>{
 const start=Date.now();assert.equal((await router.routeMessage('What prerequisites must I meet for this course?')).reason,'not-ready');
 assert.ok(Date.now()-start<100);assert.equal(router.getRouterStatus(),'loading');
});
let worker=FakeWorker.all.at(-1)!;worker.reply({type:'ready'});
await test('Ready router returns result for the matching request',async()=>{
 const promise=router.routeMessage('What prerequisites must I meet for this course?');
 const request=worker.sent.at(-1);
 worker.reply({type:'result',id:request.id,candidates:[{toolId:'COURSE_010',score:.62},{toolId:'COURSE_011',score:.4}]});
 assert.equal((await promise).toolId,'COURSE_010');
});
await test('Token budget abstention settles promptly and keeps the worker usable',async()=>{
 const text='Explain course units '+'learning '.repeat(170)+'My goal is payroll.';
 const promise=router.routeMessage(text);const request=worker.sent.at(-1);
 assert.equal(request.text,text);
 worker.reply({type:'abstained',id:request.id,reason:'token-budget'});
 assert.equal((await promise).reason,'token-budget');assert.equal(router.getRouterStatus(),'ready');
 assert.equal(acceptClientRoute(abstain('token-budget'),'AUTO','@Oala '+text).reason,'token-budget');
 const next=router.routeMessage('What prerequisites must I meet for this course?');const nextRequest=worker.sent.at(-1);
 worker.reply({type:'result',id:nextRequest.id,candidates:[{toolId:'COURSE_010',score:.62},{toolId:'COURSE_011',score:.4}]});
 assert.equal((await next).toolId,'COURSE_010');
});
await test('Fallback preserves the complete long question including trailing constraints',()=>{
 const text='Explain these units. '+'learning '.repeat(700)+'I only have Saturdays available.';
 const result=YuzeeRequestAssembler.getInstance().assembleRequest({model:'gemini-3.7-flash',messageText:text,useStructuredOutput:true,microToolInstruction:scopedInstruction(abstain('token-budget'))});
 assert.ok(String(result.contents).includes(text));
});
await test('Abort settles routing and ignores late results',async()=>{
 const controller=new AbortController();
 const promise=router.routeMessage('What prerequisites must I meet for this course?',{signal:controller.signal});
 const request=worker.sent.at(-1);controller.abort();assert.equal((await promise).reason,'cancelled');
 worker.reply({type:'result',id:request.id,candidates:[{toolId:'COURSE_010',score:.99},{toolId:'COURSE_011',score:.4}]});
});
await test('Already cancelled requests never reach worker',async()=>{
 const count=worker.sent.length;const c=new AbortController();c.abort();
 assert.equal((await router.routeMessage('What prerequisites must I meet for this course?',{signal:c.signal})).reason,'cancelled');assert.equal(worker.sent.length,count);
});
await test('A hung inference times out and terminates its worker',async()=>{
 assert.equal((await router.routeMessage('What prerequisites must I meet for this course?',{timeoutMs:10})).reason,'timeout');
 assert.equal(worker.terminated,true);assert.equal(router.getRouterStatus(),'unavailable');
});
await test('Unavailable router does not block ordinary chat',async()=>assert.equal((await router.routeMessage('What prerequisites must I meet for this course?')).reason,'not-ready'));
await test('A deliberate retry can recover from a failed worker',()=>{
 router.startWarmup();worker=FakeWorker.all.at(-1)!;worker.reply({type:'ready'});assert.equal(router.getRouterStatus(),'ready');worker.onerror({message:'synthetic failure'});assert.equal(router.getRouterStatus(),'unavailable');
});
console.log(checks+' MiniLM integration checks passed.');
