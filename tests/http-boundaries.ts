import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import {experienceFixtures} from '../src/ux/fixtures';
const env=parse(await fs.readFile('.env'));
const base='http://localhost:3000';
const {token}=await(await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})})).json();
const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
const post=(url:string,body:any)=>fetch(base+url,{method:'POST',headers,body:JSON.stringify(body)});
const fixture=experienceFixtures.find(f=>f.id==='location')!.response;
const id='ux-boundary-'+Date.now();
const restored=await(await post('/api/conversations/restore',{id,title:'UX boundary and restore test (synthetic)',messages:[{id:'test-user',role:'user',content:'Prepare a draft.',createdAt:Date.now()-1},{id:'test-asst',role:'assistant',content:JSON.stringify(fixture),structuredResponse:fixture,createdAt:Date.now()}]})).json();
assert.equal(restored.activeInteraction.question_id,fixture.interaction.question_id);
const checks:any[]=[{name:'Restored history recovers accepted question',pass:true}];
for(const [name,interaction] of [
 ['Empty required fields',{question_id:fixture.interaction.question_id,fields:{}}],
 ['Outdated question',{question_id:'previous-question',fields:{location:'Geelong',residency:'Domestic'}}],
 ['Undeclared field',{question_id:fixture.interaction.question_id,fields:{location:'Geelong',residency:'Domestic',passport:'synthetic'}}]
] as const){const res=await post(`/api/conversations/${id}/messages`,{message:'Synthetic validation check',userEvent:{userEvent:{interaction}}});assert.equal(res.status,400);checks.push({name,pass:true,httpStatus:res.status});}
const unconnected=await(await post(`/api/conversations/${id}/actions/rmo_explore_courses/execute`,{})).json();assert.equal(unconnected.executed,false);checks.push({name:'Disconnected action never reports execution',pass:true});
const forged=await post(`/api/conversations/${id}/actions/invented-action/execute`,{});assert.equal(forged.status,400);checks.push({name:'Unknown service action rejected',pass:true});
const convs=await(await fetch(base+'/api/conversations',{headers})).json();
const local=JSON.parse(await fs.readFile('data/conversations.json','utf8'));
assert.ok(convs.every((c:any)=>local.some((l:any)=>l.id===c.id)));
checks.push({name:'All current conversations are persisted',pass:true,count:convs.length});
await fs.writeFile('../outputs/HTTP-Boundary-Test-Results.json',JSON.stringify({testedAt:new Date().toISOString(),synthetic:true,providerCalls:0,checks},null,2));
console.log(JSON.stringify(checks));
