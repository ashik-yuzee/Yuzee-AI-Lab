import fs from 'node:fs/promises';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel} from '../src/routing/models';
import {BGE_MODEL_ID} from '../src/routing/bgeMatching';
import {bgeNeedScenarios,bgePathwayScenarios} from '../src/routing/bgeTaskContent';
import {bgeProfiles,bgeQuery,taskRanking,rankNeeds} from '../src/routing/bgeProfiles';
import {needs,pathways} from '../tests/fixtures/router-model-extra';
import {needEvaluation,pathwayEvaluation} from '../tests/fixtures/bge-task-evaluation';
env.allowRemoteModels=false;env.allowLocalModels=true;
const m=routerModel(BGE_MODEL_ID),e=await loadEmbeddingModel(m,{sourceDirectory:`./data/minilm-cache/${m.id}/${m.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const encode=async(text:string)=>(await e(text,{pooling:'cls',normalize:true})).data as Float32Array;
const results:any={profile:bgeProfiles};
for(const task of ['needs','pathway'] as const){
 const index=task==='needs'?bgeNeedScenarios:bgePathwayScenarios,vectors=[];for(const p of index)vectors.push(await encode(p.text));
 const regression=task==='needs'?needs:pathways.map(([text,yes])=>[text,yes?'pathway':'other']);
 for(const [name,data]of [['regression',regression],['newEvaluation',task==='needs'?needEvaluation:pathwayEvaluation]] as const){
 const rows=[];for(const [text,expected]of data){const q=await encode(bgeQuery(text as string,task));const ranks=vectors.map((v,i)=>({id:index[i].id,score:v.reduce((s,n,j)=>s+n*q[j],0)}));const r=task==='needs'?rankNeeds(ranks):taskRanking(ranks,[...new Set(index.map(x=>x.id))],bgeProfiles[task]);
 rows.push({text,expected,...r,pass:(r.selected?r.id:'other')===expected});}
 const summary={correct:rows.filter(r=>r.pass).length,total:rows.length,wrongAccepted:rows.filter(r=>r.selected&&!r.pass).length};results[task+'-'+name]={summary,rows};console.log(task,name,summary);console.log(rows.filter(r=>!r.pass));}
}
await fs.writeFile('output/bge-v2/tasks-native.json',JSON.stringify(results,null,2));await e.dispose();
