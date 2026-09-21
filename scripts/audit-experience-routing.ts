/** Pinned BGE CPU retrieval + real app selector and three real workspace starts. */
import fs from 'node:fs/promises';
import {parse} from 'dotenv';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../src/routing/models';
import {objectiveIndex,fuseObjectiveMatches,objectiveSelectionBoundary,selectionMetadata} from '../src/objectives/routing';
import {activitySearchContext} from '../src/objectives/activityContext';
import {embeddingSections} from '../src/routing/skillSuggestions';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
const root=process.env.UX_AUDIT_ROOT||'output/experience-flow/2026-09-20';
const inventory=JSON.parse(await fs.readFile(root+'/scenarios.json','utf8'));
if(!process.argv.includes('--live'))throw Error('Use --live for synthetic selector/workspace tests.');
const conf=parse(await fs.readFile('.env')),base='http://localhost:3000';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:conf.ADMIN_USERNAME,password:conf.ADMIN_PASSWORD})});
if(!login.ok)throw Error('Local login failed');
const {token}=await login.json(),headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
let lastRequest=0;
async function post(id:string,op:string,body:any){
 // Respect the production 12/minute endpoint limit; throttling is part of the harness, not a product bypass.
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,5500-(Date.now()-lastRequest))));lastRequest=Date.now();
 const r=await fetch(`${base}/api/conversations/${id}/objectives/${op}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});const data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.error}`);return data;
}
env.allowRemoteModels=false;env.allowLocalModels=true;
const model=routerModel(DEFAULT_ROUTER_MODEL);
const embed=await loadEmbeddingModel(model,{sourceDirectory:`./data/minilm-cache/${model.id}/${model.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const cache=JSON.parse(await fs.readFile('qa/objectives/routing-v3/embedding-cache.json','utf8'));
async function encode(s:string){if(!cache[s])cache[s]=Array.from((await embed(s,{pooling:model.pooling,normalize:true})).data as Float32Array);return cache[s] as number[];}
console.log('Indexing',new Set(objectiveIndex.map(o=>o.id)).size,'objectives');
const vectors=[];for(const row of objectiveIndex)vectors.push(await encode(row.text));
async function rank(text:string){if(!text.trim())return [];const scores=new Map<string,number>();for(const t of embeddingSections(text,s=>checkEmbeddingInput(embed.tokenizer,s,model.tokenBudget).fits)){const q=await encode(t);vectors.forEach((v,i)=>{const id=objectiveIndex[i].id,score=v.reduce((n,x,j)=>n+x*q[j],0);scores.set(id,Math.max(scores.get(id)||-1,score));});}return [...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score).slice(0,20);}
const results:any[]=[];
for(const j of inventory.journeys){
 const journey=JSON.parse(await fs.readFile(root+'/'+j.id+'.json','utf8'));
 // Select only on the latest assistant turn: stale prior messages are intentionally rejected by the app.
 for(const [i,r] of journey.records.entries()){
  if(!r.response)continue;
  const start=Date.now(),context=activitySearchContext(r.response,r.history.filter((m:any)=>m.role==='user').map((m:any)=>m.content));
  const candidates=fuseObjectiveMatches(await rank(r.message),await rank(context),20,r.message);
  const row:any={id:r.id,journey:j.id,conversationId:journey.conversationId,message:r.message,expected:r.routes,allowed:r.allowed,context,boundary:objectiveSelectionBoundary(r.message),candidates:candidates.map(c=>({...c,label:selectionMetadata.find(m=>m.id===c.id)?.label})),retrievalMs:Date.now()-start,top1:r.routes.length?r.routes.includes(candidates[0]?.id):null,coverage:r.routes.length?candidates.some(c=>r.routes.includes(c.id)):null};
  if(i===journey.records.length-1){try{const t=Date.now();row.selection=await post(journey.conversationId,'select',{sourceMessageId:r.assistant.id,candidates});row.selectionMs=Date.now()-t;row.selectionAllowed=r.allowed.includes(row.selection.disposition)||r.allowed.includes(row.selection.decision);row.selectedExpected=!r.routes.length||r.routes.includes(row.selection.objective_id)||row.selection.disposition==='NONE'&&r.allowed.includes('NONE');}catch(e:any){row.error=e.message;}}
  else row.selectionSkipped='Historical turn; retrieval measured only. App refuses stale-turn selection.';
  results.push(row);await fs.writeFile(root+'/routing.json',JSON.stringify({model,scope:'Actual pinned q8 BGE on CPU using current index and fusion. Browser uses WASM; this measures selection quality, not browser startup latency. Selector uses current real Node endpoint. No calibration on these outputs.',results},null,2));
  console.log(r.id,'top1',row.top1,'covered',row.coverage,'selection',row.selection?.disposition,row.selection?.objective_id,row.error||'');
 }
}
await embed.dispose();
const workspaces=[];
for(const id of ['school-subjects','job-offers','typo-comparison']){
 const row=results.find(r=>r.journey===id&&r.selection?.objective_id);if(!row)continue;
 const run:any={journey:id,conversationId:row.conversationId,objectiveId:row.selection.objective_id,activation:row.selection.disposition==='AUTO_OPEN'?'automatic':'manual',started:new Date().toISOString()};
 try{const t=Date.now();run.session=await post(row.conversationId,'start',{objectiveId:run.objectiveId,activation:run.activation,sourceMessageId:row.selection.sourceMessageId,selectionId:row.selection.selectionId});run.ms=Date.now()-t;}catch(e:any){run.error=e.message;}
 workspaces.push(run);await fs.writeFile(root+'/workspaces.json',JSON.stringify(workspaces,null,2));console.log('workspace',id,run.session?.state||run.error);
}
