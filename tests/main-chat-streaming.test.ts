import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { splitGeminiStreamChunk,parseChatProgress,chatProgressCopy } from '../src/ux/streamProgress';
import { ProtocolInteraction } from '../src/components/ProtocolInteraction';
import { experienceFixtures } from '../src/ux/fixtures';
import { streamChatMessage } from '../src/services/api';
let count=0;async function test(name:string,fn:()=>unknown){await fn();count++;console.log('PASS:',name);}
await test('Gemini thought text and signatures never enter the answer stream',()=>{const x=splitGeminiStreamChunk({candidates:[{content:{parts:[{thought:true,text:'PRIVATE_SUMMARY',thoughtSignature:'OPAQUE'},{text:'{"a":1}'}]},finishReason:'STOP'}]});assert.equal(x.hasThoughtSummary,true);assert.equal(x.text,'{"a":1}');assert.ok(!JSON.stringify(x).includes('PRIVATE_SUMMARY'));assert.ok(!JSON.stringify(x).includes('OPAQUE'));});
await test('Gemini stream works without thought summaries',()=>{assert.equal(splitGeminiStreamChunk({candidates:[{content:{parts:[{text:'answer'}]}}]}).text,'answer');assert.equal(splitGeminiStreamChunk({}).hasThoughtSummary,false);});
await test('Only known phases accepted including legacy status',()=>{assert.deepEqual(parseChatProgress({state:'generating'}),{phase:'receiving'});assert.equal(parseChatProgress({phase:'constructor'}),null);assert.equal(parseChatProgress({phase:'searched the web'}),null);});
await test('Waiting copy rotates without pretending to retrieve data',()=>{assert.notEqual(chatProgressCopy('waiting',0,0).title,chatProgressCopy('waiting',1,4000).title);assert.ok(chatProgressCopy('waiting',1,13000).subtext.includes('taking longer'));});
await test('Choice form has no blank own-answer box until requested',()=>{const q=experienceFixtures.find(f=>f.id==='single')!.response.interaction;const html=renderToStaticMarkup(React.createElement(ProtocolInteraction,{interaction:q,onInteract:()=>{}}));assert.ok(html.includes('Write my own answer'));assert.ok(!html.includes('<textarea'));assert.match(html,/<button type="submit" disabled=""/);assert.ok(html.includes('Your next step'));});
await test('Text questions still expose an immediate answer field',()=>{const q=experienceFixtures.find(f=>f.id==='text')!.response.interaction;assert.ok(renderToStaticMarkup(React.createElement(ProtocolInteraction,{interaction:q,onInteract:()=>{}})).includes('<textarea'));});
const originalFetch=globalThis.fetch;
await test('Main stream dispatches progress across network chunk boundaries',async()=>{
 const phases:string[]=[],text:string[]=[];
 const payload='event: status\ndata: {"phase":"thinking"}\n\nevent: delta\ndata: "{\\"hello\\":true}"\n\nevent: status\ndata: {"phase":"checking"}\n\nevent: done\ndata: {}\n\n';
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){for(const ch of payload)c.enqueue(new TextEncoder().encode(ch));c.close();}}));
 await new Promise<void>((resolve,reject)=>streamChatMessage('test',{}, {onStatus:p=>phases.push(p.phase),onDelta:t=>text.push(t),onDone:resolve,onError:reject}));
 assert.deepEqual(phases,['thinking','checking']);assert.deepEqual(text,['{"hello":true}']);
});
await test('An already-stopped request cannot deliver late progress or completion',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 globalThis.fetch=async(_url,opts)=>{assert.equal(opts?.signal?.aborted,true);throw new DOMException('Stopped','AbortError');};
 streamChatMessage('test',{}, {onStatus:()=>{called=true;},onDone:()=>{called=true;},onError:()=>{called=true;}},controller.signal);
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(called,false);
});
globalThis.fetch=originalFetch;
console.log(`${count} main-chat checks passed.`);
