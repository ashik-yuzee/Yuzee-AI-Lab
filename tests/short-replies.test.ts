import assert from 'node:assert/strict';
import fs from 'node:fs';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {shortReplyGuidance} from '../src/ux/shortReplyGuidance';
import {bypassCopy} from '../src/ux/bypassCopy';
const a=YuzeeRequestAssembler.getInstance();
for(const text of ['quality','cost','placements','practical','nursing','SQL','RPL','C','3','中文','جودة','qwerty','i am looking at the quality of the courses and trades'])assert.equal(a.classifyUserMessage(text),'career',text);
for(const text of ['quality','quality','yes','no','ok','great','hmm','nothing','?','👍','2027']){
 assert.equal(a.classifyUserMessage(text,{hasConversation:true}),'career',text);
 assert.equal(a.classifyUserMessage(text,{hasActiveQuestion:true}),'career',text);
}
assert.equal(a.classifyUserMessage('hello'),'greeting');
assert.equal(a.classifyUserMessage('thank you'),'farewell');
assert.equal(a.classifyUserMessage('tell me a joke'),'idle');
for(const text of ['', '!!!', '🙃'])assert.equal(a.classifyUserMessage(text),'rubbish');
for(const kind of ['greeting','farewell','idle','rubbish'] as const)assert.doesNotMatch(bypassCopy(kind),/suspicious|static|cat|sabotage|falling asleep|plain English|gibberish/i);
assert.match(bypassCopy('rubbish'),/course quality/);
const rules=fs.readFileSync('src/prompts/clear-guidance.md','utf8');
assert.match(rules,/Earlier assistant statements are not that evidence/);
assert.match(rules,/actual supervised practice/);
const request=a.assembleRequest({model:'gemini-3.7-flash',messageText:'quality',useStructuredOutput:true});
assert.match(request.systemInstruction,/SHORT REPLIES AND CONTINUITY/);
assert.match(request.systemInstruction,/EXPLAINING COURSE AND TRAINING QUALITY/);
assert.ok(a.getGeminiResponseSchema().properties.content_blocks);
assert.match(shortReplyGuidance('Quality?', [{role:'user',content:'quality'},{role:'assistant',content:'Earlier explanation'}]), /Re-explain/);
assert.equal(shortReplyGuidance('cost', [{role:'user',content:'quality'}]), '');
assert.equal(shortReplyGuidance('quality', [{role:'user',content:'quality'}], true), '');
assert.equal(shortReplyGuidance('3', [{role:'user',content:'3'}]), '');
console.log('PASS meaningful single words, acronyms, non-Latin text, contextual answers, respectful bypasses and assembled quality guidance.');
