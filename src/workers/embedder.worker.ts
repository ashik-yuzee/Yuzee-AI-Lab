import {bgeMatchingIndex,rankBge} from '../routing/bgeMatching';
import {loadEmbeddingModel} from '../routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../routing/models';
import {bgeNeedScenarios,bgePathwayScenarios} from '../routing/bgeTaskContent';
import {bgeQuery,type BgeTask} from '../routing/bgeProfiles';
import {bgeReadyContract,checkedBgeVector} from '../routing/bgeContract';
import {EmbeddingQueue,taskPriority} from '../routing/EmbeddingQueue';
import {embeddingSections} from '../routing/skillSuggestions';
import {checkEmbeddingInput} from '../routing/tokenBudget';
import type {Candidate} from '../routing/policy';
const model=routerModel(DEFAULT_ROUTER_MODEL);
let extractor:any;
let skillVectors:Float32Array[]=[];
let needVectors:Float32Array[]=[];
let pathwayVectors:Float32Array[]=[];
let initPromise:Promise<void>|null=null;
const cache=new Map<string,Float32Array>(); // Exact constructed query, bounded, memory only.
const queue=new EmbeddingQueue();
async function encode(text:string){
 const cached=cache.get(text);if(cached){cache.delete(text);cache.set(text,cached);return cached;}
 if(!checkEmbeddingInput(extractor.tokenizer,text,model.tokenBudget).fits)throw Error('token-budget');
 const q=checkedBgeVector((await extractor(text,{pooling:'cls',normalize:true})).data);
 cache.set(text,q);if(cache.size>64)cache.delete(cache.keys().next().value!);return q;
}
async function index(texts:string[]){
 const result:Float32Array[]=[];
 for(let i=0;i<texts.length;i+=12){
  const batch=texts.slice(i,i+12);
  if(batch.some(text=>!checkEmbeddingInput(extractor.tokenizer,text,512).fits))throw Error('Prototype exceeds token budget');
  const out=await extractor(batch,{pooling:'cls',normalize:true});
  if(out.dims.at(-1)!==384)throw Error('Unexpected embedding shape');
  result.push(...batch.map((_,j)=>checkedBgeVector(out.data.slice(j*384,(j+1)*384))));
 }
 return result;
}
async function initialize(id:unknown){
 if(id!==model.id)throw Error('Unsupported runtime encoder');
 const {env}=await import('@huggingface/transformers');env.allowLocalModels=false;
 if(env.backends.onnx.wasm)env.backends.onnx.wasm.numThreads=1;
 extractor=await loadEmbeddingModel(model,{device:'wasm',progress_callback:(p:any)=>{if(p.status==='progress')self.postMessage({type:'progress',label:'Preparing guidance'});}});
 skillVectors=await index(bgeMatchingIndex.map(p=>p.text));
 needVectors=await index(bgeNeedScenarios.map(p=>p.text));
 pathwayVectors=await index(bgePathwayScenarios.map(p=>p.text));
 self.postMessage({type:'ready',...bgeReadyContract});
}
const dot=(a:Float32Array,b:Float32Array)=>a.reduce((s,n,j)=>s+n*b[j],0);
self.onmessage=(event:MessageEvent)=>{
 const {type,id,text}=event.data||{};
 if(type==='init'){
  if(!initPromise)initPromise=initialize(event.data.modelId);
  initPromise.catch(()=>self.postMessage({type:'unavailable'}));return;
 }
 if(type==='cancel'){queue.cancel(id);return;}
 if(!(type in taskPriority)||typeof id!=='string'||typeof text!=='string')return;
 if(text.length>(type==='suggest'?30000:1800)){self.postMessage({type:'abstained',id,reason:'input-length'});return;}
 const enqueued=performance.now();
 async function* run():AsyncGenerator<void,void,unknown>{
  const began=performance.now();
  const reply=(result:any)=>{if(queue.has(id))self.postMessage({...result,id,timing:{queueMs:began-enqueued,workMs:performance.now()-began,totalMs:performance.now()-enqueued}});};
  try{
   if(!initPromise)throw Error('Not initialized');await initPromise;
   if(type==='suggest'){
    const sections=text.split(/\n\s*\n/).flatMap(part=>embeddingSections(part,s=>checkEmbeddingInput(extractor.tokenizer,bgeQuery(s,'suggestion'),512).fits));
    if(sections.length>96){reply({type:'abstained',reason:'token-budget'});return;}
    const rankings:Candidate[][]=[];
    for(const section of sections){
     if(!queue.has(id))return;
     const q=await encode(bgeQuery(section,'suggestion'));rankings.push(rankBge(q,skillVectors));yield;
    }
    reply({type:'suggest-result',rankings,chunks:sections.length});return;
   }
   const q=await encode(bgeQuery(text,type as BgeTask));if(!queue.has(id))return;
   if(type==='needs')reply({type:'needs-result',candidates:needVectors.map((v,i)=>({id:bgeNeedScenarios[i].id,score:dot(v,q)}))});
   else if(type==='pathway')reply({type:'pathway-result',candidates:pathwayVectors.map((v,i)=>({id:bgePathwayScenarios[i].id,score:dot(v,q)}))});
   else reply({type:'result',candidates:rankBge(q,skillVectors)});
  }catch(error){reply(error instanceof Error&&error.message==='token-budget'?{type:'abstained',reason:'token-budget'}:{type:'error'});}
 }
 if(!queue.enqueue(id,type,run()))self.postMessage({type:'abstained',id,reason:'busy'});
};
