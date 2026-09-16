import {eligibleTools,indexText,MODEL_ID,type Candidate} from '../routing/policy';
import {checkEmbeddingInput} from '../routing/tokenBudget';
let extractor:any;
let vectors:Float32Array[]=[];
let initPromise:Promise<void>|null=null;
async function initialize(modelId:string){
 console.info('[MiniLM] Loading runtime');
 const {pipeline,env}=await import('@huggingface/transformers');
 env.allowLocalModels=false;
 if(env.backends.onnx.wasm)env.backends.onnx.wasm.numThreads=1;
 console.info('[MiniLM] Loading model',modelId);
 extractor=await pipeline('feature-extraction',modelId,{dtype:'q8',device:'wasm',progress_callback:(p:any)=>{
  if(p.status==='progress')self.postMessage({type:'progress',label:'Preparing guidance'});
 }});
 console.info('[MiniLM] Building tool index');
 // Small batches keep initial indexing responsive and bound peak memory.
 for(let i=0;i<eligibleTools.length;i+=12){
  const batch=eligibleTools.slice(i,i+12);
  const texts=batch.map(indexText);
  // A changed catalogue must never silently index only a prefix of a tool description.
  if(texts.some(text=>!checkEmbeddingInput(extractor.tokenizer,text).fits))throw Error('Routing catalogue exceeds token budget');
  const out=await extractor(texts,{pooling:'mean',normalize:true});
  const dim=out.dims.at(-1);
  vectors.push(...batch.map((_,j)=>(out.data as Float32Array).slice(j*dim,(j+1)*dim)));
 }
 console.info('[MiniLM] Ready');
 self.postMessage({type:'ready'});
}
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent)=>{
 const {type,id,text,modelId}=event.data||{};
 if(type==='init'){
  if(!initPromise)initPromise=initialize(modelId||MODEL_ID);
  initPromise.catch((error)=>{console.warn('[MiniLM] Initialization failed:',error instanceof Error?error.message:'Runtime unavailable');self.postMessage({type:'unavailable'});});return;
 }
 if(type!=='route'||typeof text!=='string'||text.length>1800)return;
 queue=queue.then(async()=>{
  try{
   if(!initPromise)throw Error('Not initialized');
   await initPromise;
   if(!checkEmbeddingInput(extractor.tokenizer,text).fits){
    self.postMessage({type:'abstained',id,reason:'token-budget'});return;
   }
   const out=await extractor(text,{pooling:'mean',normalize:true});
   const q=out.data as Float32Array;
   const candidates:Candidate[]=vectors.map((v,i)=>({toolId:eligibleTools[i].id,score:v.reduce((sum,n,j)=>sum+n*q[j],0)}));
   candidates.sort((a,b)=>b.score-a.score);
   self.postMessage({type:'result',id,candidates:candidates.slice(0,3)});
  }catch{self.postMessage({type:'error',id});}
 });
};
