import {BGE_MODEL_ID,bgeMatchingIndex,rankBge} from '../routing/bgeMatching';
import {loadEmbeddingModel} from '../routing/loadEmbeddingModel';
import {routerModel} from '../routing/models';
import {pathwayScenarios} from '../miniPathway/policy';
import {suggestionIndex,rankSuggestions} from '../routing/suggestionIndex';
import {embeddingSections} from '../routing/skillSuggestions';
import {needScenarios} from '../routing/turnNeeds';
import {eligibleTools,indexText,type Candidate} from '../routing/policy';
import {checkEmbeddingInput} from '../routing/tokenBudget';
let extractor:any;
let model=routerModel(undefined);
let vectors:Float32Array[]=[];
let suggestionVectors:Float32Array[]=[];
let bgeVectors:Float32Array[]=[];
let needVectors:Float32Array[]=[];
let pathwayVectors:Float32Array[]=[];
let initPromise:Promise<void>|null=null;
async function initialize(modelId:unknown){
 model=routerModel(modelId);
 console.info('[MiniLM] Loading runtime');
 const {env}=await import('@huggingface/transformers');
 env.allowLocalModels=false;
 if(env.backends.onnx.wasm)env.backends.onnx.wasm.numThreads=1;
 console.info('[MiniLM] Loading model');
 extractor=await loadEmbeddingModel(model,{device:'wasm',progress_callback:(p:any)=>{
  if(p.status==='progress')self.postMessage({type:'progress',label:'Preparing guidance'});
 }});
 console.info('[MiniLM] Building tool index');
 // Small batches keep initial indexing responsive and bound peak memory.
 if(model.id===BGE_MODEL_ID){
  for(let i=0;i<bgeMatchingIndex.length;i+=12){
   const batch=bgeMatchingIndex.slice(i,i+12);
   if(batch.some(s=>!checkEmbeddingInput(extractor.tokenizer,s.text,model.tokenBudget).fits))throw Error('BGE index exceeds token budget');
   const out=await extractor(batch.map(s=>s.text),{pooling:model.pooling,normalize:true});const dim=out.dims.at(-1);
   bgeVectors.push(...batch.map((_,j)=>(out.data as Float32Array).slice(j*dim,(j+1)*dim)));
  }
 }else{
 for(let i=0;i<eligibleTools.length;i+=12){
  const batch=eligibleTools.slice(i,i+12);
  const texts=batch.map(indexText);
  // A changed catalogue must never silently index only a prefix of a tool description.
  if(texts.some(text=>!checkEmbeddingInput(extractor.tokenizer,text,model.tokenBudget).fits))throw Error('Routing catalogue exceeds token budget');
  const out=await extractor(texts,{pooling:model.pooling,normalize:true});
  const dim=out.dims.at(-1);
  vectors.push(...batch.map((_,j)=>(out.data as Float32Array).slice(j*dim,(j+1)*dim)));
 }
 for(let i=0;i<suggestionIndex.length;i+=12){
  const batch=suggestionIndex.slice(i,i+12);
  if(batch.some(s=>!checkEmbeddingInput(extractor.tokenizer,s.text,model.tokenBudget).fits))throw Error('Suggestion index exceeds token budget');
  const out=await extractor(batch.map(s=>s.text),{pooling:model.pooling,normalize:true});const dim=out.dims.at(-1);
  suggestionVectors.push(...batch.map((_,j)=>(out.data as Float32Array).slice(j*dim,(j+1)*dim)));
 }
 }
 const needTexts=needScenarios.map(s=>s.text);
 if(needTexts.some(text=>!checkEmbeddingInput(extractor.tokenizer,text,model.tokenBudget).fits))throw Error('Scenario index exceeds token budget');
 const needs=await extractor(needTexts,{pooling:model.pooling,normalize:true});
 const dimension=needs.dims.at(-1);
 needVectors=needScenarios.map((_,i)=>(needs.data as Float32Array).slice(i*dimension,(i+1)*dimension));
 const pathwayTexts=pathwayScenarios.map(s=>s.text);
 if(pathwayTexts.some(text=>!checkEmbeddingInput(extractor.tokenizer,text,model.tokenBudget).fits))throw Error('Pathway index exceeds token budget');
 const pathways=await extractor(pathwayTexts,{pooling:model.pooling,normalize:true});
 const pathwayDim=pathways.dims.at(-1);
 pathwayVectors=pathwayScenarios.map((_,i)=>(pathways.data as Float32Array).slice(i*pathwayDim,(i+1)*pathwayDim));
 console.info('[MiniLM] Ready');
 self.postMessage({type:'ready',modelId:model.id,revision:model.revision,tokenBudget:model.tokenBudget,pooling:model.pooling});
}
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent)=>{
 const {type,id,text}=event.data||{};
 if(type==='init'){
  if(!initPromise)initPromise=initialize(event.data?.modelId);
  initPromise.catch((error)=>{console.warn('[MiniLM] Initialization failed:',error instanceof Error?error.message:'Runtime unavailable');self.postMessage({type:'unavailable'});});return;
 }
 if(!['route','needs','suggest','topic','pathway'].includes(type)||typeof text!=='string'||text.length>(type==='suggest'?30000:1800))return;
 queue=queue.then(async()=>{
  try{
   if(!initPromise)throw Error('Not initialized');
   await initPromise;
   if(type==='suggest'){
    const sections=text.split(/\n\s*\n/).flatMap(part=>embeddingSections(part,s=>checkEmbeddingInput(extractor.tokenizer,s,model.tokenBudget).fits));
    if(sections.length>96){self.postMessage({type:'abstained',id,reason:'token-budget'});return;}
    const rankings:Candidate[][]=[];
    for(const section of sections){
     const out=await extractor(section,{pooling:model.pooling,normalize:true});
     const q=out.data as Float32Array;
     rankings.push(model.id===BGE_MODEL_ID?rankBge(q,bgeVectors):rankSuggestions(q,suggestionVectors));
    }
    self.postMessage({type:'suggest-result',id,rankings});return;
   }
   if(!checkEmbeddingInput(extractor.tokenizer,text,model.tokenBudget).fits){
    self.postMessage({type:'abstained',id,reason:'token-budget'});return;
   }
   const out=await extractor(text,{pooling:model.pooling,normalize:true});
   const q=out.data as Float32Array;
   if(type==='pathway'){
    self.postMessage({type:'pathway-result',id,candidates:pathwayVectors.map((v,i)=>({id:pathwayScenarios[i].id,score:v.reduce((sum,n,j)=>sum+n*q[j],0)}))});return;
   }
   if(type==='topic'){self.postMessage({type:'result',id,candidates:model.id===BGE_MODEL_ID?rankBge(q,bgeVectors):rankSuggestions(q,suggestionVectors)});return;}
   if(type==='needs'){
    const candidates=needVectors.map((v,i)=>({id:needScenarios[i].id,score:v.reduce((sum,n,j)=>sum+n*q[j],0)})).sort((a,b)=>b.score-a.score);
    self.postMessage({type:'needs-result',id,candidates});return;
   }
   if(model.id===BGE_MODEL_ID){self.postMessage({type:'result',id,candidates:rankBge(q,bgeVectors)});return;}
   const candidates:Candidate[]=vectors.map((v,i)=>({toolId:eligibleTools[i].id,score:v.reduce((sum,n,j)=>sum+n*q[j],0)}));
   candidates.sort((a,b)=>b.score-a.score);
   self.postMessage({type:'result',id,candidates:candidates.slice(0,3)});
  }catch{self.postMessage({type:'error',id});}
 });
};
