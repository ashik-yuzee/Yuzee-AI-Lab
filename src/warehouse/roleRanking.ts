import path from 'node:path';
import {loadEmbeddingModel} from '../routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../routing/models';
import {checkEmbeddingInput} from '../routing/tokenBudget';
import type {WarehouseExploration} from './types';
const config=routerModel(DEFAULT_ROUTER_MODEL);
let encoder:Promise<Awaited<ReturnType<typeof loadEmbeddingModel>>>|undefined;
const vectors=new Map<string,number[]>();
function model(){return encoder??=loadEmbeddingModel(config,{sourceDirectory:path.resolve('data/minilm-cache',config.id,config.revision),device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}}).catch(e=>{encoder=undefined;throw e;});}
/** Pinned BGE runs locally. No inference API, automatic download or user-data upload. */
export async function rankRoleCandidates(message:string,skillQueries:string[],roles:WarehouseExploration['roles'],signal:AbortSignal){
 const embed=await model();
 async function encode(text:string,cache=false){
  if(signal.aborted)throw signal.reason||Error('Aborted');
  while(text.length&&!checkEmbeddingInput(embed.tokenizer,text,512).fits)text=text.slice(0,Math.floor(text.length*.85));
  if(cache&&vectors.has(text))return vectors.get(text)!;
  const vector=Array.from((await embed(text,{pooling:'cls',normalize:true})).data as Float32Array);
  if(cache){if(vectors.size>=500)vectors.delete(vectors.keys().next().value!);vectors.set(text,vector);}return vector;
 }
 const q=await encode(`${message.slice(0,1800)}\nSkills being explored: ${skillQueries.join(', ')}`);
 const ranked=[];
 for(const role of roles){const v=await encode(`${role.title}. ${role.description}. Tasks: ${role.tasks.slice(0,3).join('; ')}`,true);ranked.push({id:role.id,score:v.reduce((sum,x,i)=>sum+x*q[i],0)});}
 ranked.sort((a,b)=>b.score-a.score);const best=ranked[0]?.score??0;
 // A conservative development filter, not confidence, suitability or a calibrated probability.
 return ranked.filter(r=>r.score>=.55&&r.score>=best-.06).slice(0,3).map(r=>r.id);
}
