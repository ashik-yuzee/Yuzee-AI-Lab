import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../src/routing/models';
import {objectiveIndex,fuseObjectiveMatches,objectiveSelectionBoundary,selectionMetadata} from '../src/objectives/routing';
import {activitySearchContext} from '../src/objectives/activityContext';
import {ObjectiveService} from '../src/objectives/service';
import {embeddingSections} from '../src/routing/skillSuggestions';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
dotenv.config({quiet:true});env.allowRemoteModels=false;env.allowLocalModels=true;
const root='output/ux-audit',model=routerModel(DEFAULT_ROUTER_MODEL);
const embed=await loadEmbeddingModel(model,{sourceDirectory:`./data/minilm-cache/${model.id}/${model.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const cache=JSON.parse(await fs.readFile('qa/objectives/routing-v3/embedding-cache.json','utf8'));
async function encode(s:string){if(!cache[s])cache[s]=Array.from((await embed(s,{pooling:'cls',normalize:true})).data as Float32Array);return cache[s] as number[];}
const vectors=[];for(const r of objectiveIndex)vectors.push(await encode(r.text));
async function rank(text:string){const scores=new Map<string,number>();if(!text.trim())return [];for(const t of embeddingSections(text,s=>checkEmbeddingInput(embed.tokenizer,s,512).fits)){const q=await encode(t);vectors.forEach((v,i)=>{const id=objectiveIndex[i].id,score=v.reduce((n,x,j)=>n+x*q[j],0);scores.set(id,Math.max(scores.get(id)||-1,score));});}return [...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score).slice(0,20);}
const ids=process.argv.includes('--auto')?['EX-AUTO-A','EX-AUTO-B']:['HS-01-A2','UE-02-A2','UE-03-A2','RE-01-A2','EM-04-A2','AX-03-A2','AX-06-A2','AX-01-A','EX-QUALITY-A','EX-COMPARE-A','EX-OPTOUT-A','HS-03-A'];
const service=new ObjectiveService(root+'/routing-runs'),results=[];
for(const id of ids){const r=JSON.parse(await fs.readFile(root+'/live/'+id+'.json','utf8'));const messages=[...(r.history||[]).map((m:any,i:number)=>({...m,id:'h'+i,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)})),{id:'u',role:'user',content:r.message},{id:'a',role:'assistant',content:JSON.stringify(r.response),structuredResponse:r.response}];const context=activitySearchContext(r.response,messages.filter(m=>m.role==='user').map(m=>m.content));const start=Date.now();const candidates=fuseObjectiveMatches(await rank(r.message),await rank(context),20,r.message);const entry:any={id,message:r.message,context,boundary:objectiveSelectionBoundary(r.message),candidates:candidates.map(c=>({...c,label:selectionMetadata.find(m=>m.id===c.id)?.label})),retrievalMs:Date.now()-start};
 try{const t=Date.now();entry.selection=await service.select({id:'ux-audit-'+id,messages},{sourceMessageId:'a',candidates},new AbortController().signal,()=>true);entry.selectionMs=Date.now()-t;}catch(e:any){entry.error=String(e.message);}
 results.push(entry);await fs.writeFile(root+(process.argv.includes('--auto')?'/routing-auto.json':'/routing.json'),JSON.stringify({model,scope:'Synthetic diagnostic selections with actual BGE retrieval and current Gemini selector; not held-out accuracy and no objective execution.',results},null,2));console.log(id,entry.selection?.disposition,entry.selection?.objective_id,entry.selection?.selectedRank,entry.error||'');
}
await embed.dispose();
