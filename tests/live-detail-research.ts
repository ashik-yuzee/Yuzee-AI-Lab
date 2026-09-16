import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';
import { validateProtocol } from '../src/protocol/validator';
import { makeResponse } from '../src/ux/fixtures';
const env = parse(await fs.readFile('.env'));
const base = 'http://localhost:3000';
const login = await fetch(base+'/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD}) });
const { token } = await login.json();
const headers = { 'Content-Type':'application/json', Authorization:'Bearer '+token };
const post = (url:string,body:any) => fetch(base+url, {method:'POST',headers,body:JSON.stringify(body)});
const id = 'detail-live-'+Date.now();
const fixture = makeResponse();
fixture.content_blocks = [{ id:'intro',type:'text',title:'',text:'This is a synthetic interaction test. Open “Ask for more information” to research the Deakin Bachelor of Computer Science S306. Course details below will be retrieved from public sources.',level:'none',variant:'default',columns:[],rows:[],items:[] }];
assert.equal(validateProtocol(fixture).protocolAccepted, true);
const created = await post('/api/conversations/restore', {id,title:'More information — live course research (test)',messages:[{id:'research-demo-user',role:'user',content:'Help me explore the Deakin Bachelor of Computer Science S306.',createdAt:Date.now()-1},{id:'research-demo-answer',role:'assistant',content:JSON.stringify(fixture),structuredResponse:fixture,createdAt:Date.now()}]});
assert.equal(created.status,200);
const request = {parentMessageId:'research-demo-answer',target:'Deakin University Bachelor of Computer Science S306',question:'Is part-time study available for this course? Please distinguish study duration from weekly workload.',studyYear:'2026',location:'Melbourne, Australia'};
const checks:any[]=[];
const unauthorised=await fetch(base+`/api/conversations/${id}/details`);assert.equal(unauthorised.status,401);checks.push({name:'Research requires sign-in',pass:true});
for(const [name, body] of [['Missing course scope',{...request,target:''}],['Wrong answer reference',{...request,parentMessageId:'unknown'}]] as const){const r=await post(`/api/conversations/${id}/details`,body);assert.equal(r.status,400);checks.push({name,pass:true});}
const results:any[]=[];
for(const question of [request.question, 'What does that mean for studying while working three days a week? Do not assume which days classes run.']) {
 const r=await post(`/api/conversations/${id}/details`,{...request,question}); assert.equal(r.status,200);
 const raw=await r.text();
 const events=raw.split('\n\n').filter(v=>v.startsWith('data: ')).map(v=>JSON.parse(v.slice(6)));
 const failure=events.find(e=>e.type==='error');
 if(failure){console.log(JSON.stringify({failure:failure.error}));await fs.writeFile('../outputs/Live-Detail-Research-Tests.json',JSON.stringify({conversationId:id,checks,results,failure},null,2));process.exit(1);}
 const result=events.find(e=>e.type==='result')?.result;assert.ok(result);
 assert.ok(result.evidence.length);assert.ok(result.facts.length);assert.ok(result.facts.every((f:any)=>f.evidenceIds.every((eid:string)=>result.evidence.some((e:any)=>e.id===eid))));
 results.push(result);console.log(JSON.stringify({question,status:result.status,summary:result.summary,gaps:result.gaps,sources:result.sources.map((s:any)=>s.title),usage:result.usage}));
}
const saved=await(await fetch(base+`/api/conversations/${id}/details`,{headers})).json();assert.equal(saved.length,2);checks.push({name:'Two live questions saved with linked evidence',pass:true});
await fs.writeFile('../outputs/Live-Detail-Research-Tests.json',JSON.stringify({testedAt:new Date().toISOString(),conversationId:id,checks,results},null,2));
