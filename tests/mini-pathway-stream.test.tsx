import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PathwayBlockStream,type PathwayDraftEvent} from '../src/miniPathway/streamBlocks';
import {MiniPathwayService} from '../src/miniPathway/service';
import {generateMiniPathway} from '../src/miniPathway/client';
import {MiniPathwayStreaming} from '../src/components/MiniPathwayStreaming';
import {pathwayFixture,pathwayReportFixture} from './mini-pathway-fixture';
import {choosePathwayHint} from '../src/miniPathway/policy';

const report=pathwayReportFixture();
report.content_blocks[0].text='Braces {inside}, a quoted "content_blocks": [{fake}], a slash \\ and emoji 🧭 remain text.';
const json=JSON.stringify(report);
for(const size of [1,2,7,97,1024]){
 const reader=new PathwayBlockStream(),seen=[];
 for(let i=0;i<json.length;i+=size)seen.push(...reader.push(json.slice(i,i+size)));
 assert.deepEqual(seen,report.content_blocks);
}
const incomplete=new PathwayBlockStream();
assert.equal(incomplete.push('{"content_blocks":[{"id":"partial","text":"hello').length,0);
const invalid=new PathwayBlockStream();
assert.equal(invalid.push('{"content_blocks":[{"id":"x"}]}').length,0);
const outside=new PathwayBlockStream();
assert.equal(outside.push(JSON.stringify({other:{content_blocks:report.content_blocks}})).length,0);
const duplicate=new PathwayBlockStream();
assert.equal(duplicate.push(JSON.stringify({content_blocks:[report.content_blocks[0],report.content_blocks[0]]})).length,1);

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yuzee-stream-'));
const hint=choosePathwayHint([{id:'pathway',score:.8},{id:'other',score:.2}]);
const conv={id:'stream-test',model:'test-gemini',messages:[{id:'u1',role:'user',content:'Help me choose a career pathway.'},{id:'a1',role:'assistant',content:JSON.stringify(pathwayFixture())}]};
const request={sourceMessageId:'a1',mode:'automatic',hint,location:''};
const events:PathwayDraftEvent[]=[];
let finished=false;
const ai:any={models:{generateContentStream:async function*(){
 yield {candidates:[{content:{parts:[{thought:true,text:'PRIVATE_REASONING_MUST_NOT_APPEAR'}]}}]};
 for(let i=0;i<json.length;i+=80){
  yield {candidates:[{content:{parts:[{text:json.slice(i,i+80)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20}};
  if(i>2000)assert.ok(events.some(e=>e.type==='block'),'Blocks must arrive before generation finishes');
 }
 yield {candidates:[{finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200,thoughtsTokenCount:10}};
 finished=true;
}}};
const service=new MiniPathwayService(()=>ai,path.join(dir,'runs.json'));
const result=await service.generate(conv,request,new AbortController().signal,()=>{},()=>true,event=>{assert.equal(finished,false);events.push(event);});
assert.equal(result.status,'complete');assert.equal(events[0].type,'reset');
assert.equal(events.filter(e=>e.type==='block').length,report.content_blocks.length);
assert.ok(!JSON.stringify(events).includes('PRIVATE_REASONING'));
assert.deepEqual(result.usage,{inputTokens:100,outputTokens:200,thinkingTokens:10});

let attempts=0;const retryEvents:PathwayDraftEvent[]=[];
const repair=new MiniPathwayService(()=>({models:{generateContentStream:async function*(){
 const r=pathwayReportFixture();if(attempts++===0)r.content_blocks=r.content_blocks.filter((b:any)=>b.id!=='route-summary-r1-timeline');
 yield {candidates:[{content:{parts:[{text:JSON.stringify(r)}]},finishReason:'STOP'}]};
}}} as any),path.join(dir,'retry.json'));
await repair.generate(conv,request,new AbortController().signal,()=>{},()=>true,e=>retryEvents.push(e));
assert.equal(retryEvents.filter(e=>e.type==='reset').length,2,'Discard the old draft before retrying');
const controller=new AbortController(),cancelEvents:PathwayDraftEvent[]=[];
await assert.rejects(new MiniPathwayService(()=>ai,path.join(dir,'cancel.json')).generate(conv,request,controller.signal,()=>{},()=>true,e=>{cancelEvents.push(e);if(e.type==='block')controller.abort();}),/stopped/);
assert.equal(cancelEvents.filter(e=>e.type==='block').length,1);

// Exercise the actual client with split SSE frames and split UTF-8 characters.
const originalFetch=globalThis.fetch;
const encoded=new TextEncoder().encode([...events,{type:'result',result}].map(e=>`data: ${JSON.stringify(e)}\n\n`).join(''));
globalThis.fetch=async()=>new Response(new ReadableStream({start(c){for(let i=0;i<encoded.length;i+=13)c.enqueue(encoded.slice(i,i+13));c.close();}}));
try{
 const received:PathwayDraftEvent[]=[];
 assert.equal((await generateMiniPathway(conv.id,request as any,new AbortController().signal,()=>{},e=>received.push(e))).status,'complete');
 assert.deepEqual(received,events);
 globalThis.fetch=async()=>new Response('data: {"type":"progress","stage":"Waiting"}\n\n');
 await assert.rejects(generateMiniPathway(conv.id,request as any,new AbortController().signal,()=>{}),/stopped before finishing/);
 globalThis.fetch=async()=>new Response('data: {"type":"error","error":"Connection interrupted"}\n\n');
 await assert.rejects(generateMiniPathway(conv.id,request as any,new AbortController().signal,()=>{}),/Connection interrupted/);
}finally{globalThis.fetch=originalFetch;await fs.rm(dir,{recursive:true,force:true});}
const html=renderToStaticMarkup(<MiniPathwayStreaming stage="Your pathway is taking shape" blocks={report.content_blocks.slice(0,2)} source={pathwayFixture()} onStop={()=>{}}/>);
assert.ok(html.includes('Draft ·'));assert.ok(html.includes('aria-busy="true"'));assert.ok(html.includes('mini-pathway-skeleton'));
assert.ok(html.includes('Pathway summary'));assert.ok(html.includes('>Stop<'));assert.ok(!html.includes('PRIVATE_REASONING'));
console.log('PASS streaming: complete blocks across arbitrary chunks, thought isolation, provisional display, repair reset, cancellation, cumulative usage, split SSE/UTF-8, disconnect and error handling.');
