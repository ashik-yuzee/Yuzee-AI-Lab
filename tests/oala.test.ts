import {oalaBasicAnswer} from '../src/oala/basicResponses';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseOalaMention,addressOala,isOalaSuggestion} from '../src/oala/invocation';
import {readYuzeeServices,buildOalaInstruction} from '../src/oala/knowledge';
import {acceptClientRoute,ROUTER_VERSION} from '../src/routing/policy';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {TRUSTED_SERVICE_ACTIONS} from '../src/protocol/validator';
let checks=0;
function test(name:string,run:()=>void){run();checks++;console.log('PASS:',name);}
test('Explicit mentions support case, whitespace and punctuation',()=>{
 for(const text of ['@Oala help me',' @oala: help me','@ Oala help me','@OALA, help me'])assert.deepEqual(parseOalaMention(text),{active:true,message:'help me'});
 assert.deepEqual(parseOalaMention('@Oala'),{active:true,message:''});
});
test('Email addresses, quoted mentions and similar names do not activate',()=>{
 for(const text of ['mail@oala.com','@Oala.com','@Oalalala help','"@Oala help"','What does @Oala mean?','hello','@Oala/anything',null,{}])assert.equal(parseOalaMention(text).active,false);
});
test('Mention selection completes typed prefixes and preserves drafts',()=>{
 for(const text of ['@','@o','@oa','@oal']){assert.ok(isOalaSuggestion(text));assert.equal(addressOala(text),'@Oala ');}
 assert.equal(addressOala('Help me find a course'),'@Oala Help me find a course');
 assert.equal(addressOala('@Oala help'),'@Oala help');
 assert.equal(addressOala('@someone wrote this'),'@Oala @someone wrote this');
 assert.equal(isOalaSuggestion('@Oala help'),false);
});
test('Every mode requires an explicit current mention, even legacy preview',()=>{
 const route={status:'selected',toolId:'COURSE_010',score:.62,margin:.12,version:ROUTER_VERSION};
 for(const mode of ['AUTO','MICRO_PROMPT','SAVE_TOKENS','CUSTOM']){
  assert.equal(acceptClientRoute(route,mode,'What prerequisites must I meet for this course?').reason,'not-addressed');
  assert.equal(acceptClientRoute(route,mode,'@Oala What prerequisites must I meet for this course?').status,'selected');
 }
});
test('Mention does not bypass correction, uncertainty or structured-answer guards',()=>{
 assert.equal(acceptClientRoute(null,'AUTO','@Oala Do not compare courses').reason,'correction-or-boundary');
 assert.equal(acceptClientRoute(null,'AUTO','@Oala Tell me more').reason,'needs-context');
 assert.equal(acceptClientRoute(null,'AUTO','@Oala Focus on study',true).reason,'structured-answer');
});
const assembler=YuzeeRequestAssembler.getInstance();
const source=fs.readFileSync('src/protocol/v1.3/Yuzee_Main_Prompt_Gemini_JSON_ONLY_FINAL_v0.12.md','utf8');
const catalogue=readYuzeeServices(source);
test('Knowledge uses all 11 product-owned services exactly once',()=>{
 assert.equal(catalogue.length,11);assert.equal(new Set(catalogue.map(s=>s.id)).size,11);
 for(const service of catalogue){assert.ok(service.name&&service.benefit&&service.delivery);assert.ok(source.includes(service.delivery));}
 assert.ok(catalogue.some(s=>s.id==='general_yuzee_support'));assert.ok(catalogue.some(s=>s.id==='rpl'));
});
test('Missing catalogue fails closed without adding an invented service',()=>{
 assert.deepEqual(readYuzeeServices('unrelated | not | a | service | entry'),[]);
 assert.match(buildOalaInstruction([]),/Catalogue unavailable. Do not invent services/);
});
test('Preview capabilities come from the runtime action registry',()=>{
 const connected=Object.values(TRUSTED_SERVICE_ACTIONS).filter(a=>a.enabled&&a.isConnectedInLab).map(a=>a.actionId);
 assert.deepEqual(connected,[]);
 const instruction=buildOalaInstruction(catalogue,connected);
 assert.match(instruction,/NONE\. In this preview/);assert.match(instruction,/service_trigger.trigger_now=false/);
 assert.match(instruction,/Prices, delivery times/);
});
test('Oala scope is server-owned and separate from immutable main prompt',()=>{
 const config={model:'gemini-3.7-flash',messageText:'@Oala What is Yuzee?',useStructuredOutput:true};
 const normal=assembler.assembleRequest(config);
 const oala=assembler.assembleRequest({...config,oalaInstruction:buildOalaInstruction(catalogue)});
 assert.ok(oala.systemInstruction.startsWith(normal.systemInstruction));
 assert.equal((oala.systemInstruction.match(/OALA_YUZEE_SERVICE_HELP —/g)||[]).length,1);
 assert.doesNotMatch(String(oala.contents),/PRODUCT CATALOGUE/);
 assert.equal((String(oala.contents).match(/@Oala What is Yuzee\?/g)||[]).length,1);
 assert.ok(oala.geminiConfig.responseSchema);
 const next=assembler.assembleRequest({...config,messageText:'Tell me more'});
 assert.equal(next.systemInstruction,normal.systemInstruction);
});
test('Basic FAQs use exact catalogue descriptions and do not claim live matching',()=>{
 for(const text of ['@Oala','@Oala What is Yuzee?','@Oala What is Yuzee and how can you help me? Keep it simple.'])assert.ok(oalaBasicAnswer(text,catalogue)?.text.includes('AI guidance assistant'));
 const answer=oalaBasicAnswer('@Oala What services does Yuzee provide? Please show all of them and explain how each helps.',catalogue)!;
 assert.deepEqual(answer.services,catalogue);assert.match(answer.text,/not connected/);
 for(const text of ['What is Yuzee?','@Oala What services do you provide for my disabled child?','@Oala What is Yuzee? Also write a recipe.','@Oala Which service is best for me?'])assert.equal(oalaBasicAnswer(text,catalogue),null);
});
console.log(`${checks} Oala checks passed.`);
