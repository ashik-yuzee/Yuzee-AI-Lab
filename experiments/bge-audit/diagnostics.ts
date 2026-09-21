import {bgeMatchingIndex,BGE_MODEL_ID} from '../../src/routing/bgeMatching';
import {BGE_OUT_OF_SCOPE} from '../../src/routing/bgeDomain';
import {chooseRoute,routingSkipReason,abstain} from '../../src/routing/policy';
import calibration from '../../src/routing/bgeCalibration.json';
import {routerModel} from '../../src/routing/models';
import {bgeNeedScenarios,bgePathwayScenarios} from '../../src/routing/bgeTaskContent';

export const config=routerModel(BGE_MODEL_ID);
const vec=(out:any,j=0)=>Array.from(out.data.slice(j*384,(j+1)*384)) as number[];
export function tokens(tokenizer:any,text:string|string[]){
 const t=tokenizer(text,{padding:true,truncation:false});
 return Object.fromEntries(Object.entries(t).filter(([,v]:any)=>v?.data).map(([k,v]:any)=>[k,{dims:v.dims,data:Array.from(v.data,Number)}]));
}
export async function load(device:'cpu'|'wasm',source?:string){
 const start=performance.now(),marks:any={};const events:any[]=[];
 const lib=await import('@huggingface/transformers');marks.libraryImportMs=performance.now()-start;
 if(device==='wasm'){lib.env.allowLocalModels=false;lib.env.backends.onnx.wasm.numThreads=1;}
 else{lib.env.allowRemoteModels=false;lib.env.allowLocalModels=true;}
 const options={revision:config.revision,local_files_only:!!source,progress_callback:(p:any)=>{
  if(p.status!=='progress')events.push({atMs:performance.now()-start,status:p.status,file:p.file,name:p.name});
 }};
 const componentStart=performance.now();
 const [model,tokenizer]=await Promise.all([
  lib.AutoModel.from_pretrained(source||config.id,{...options,device,dtype:'q8',...(device==='cpu'?{session_options:{intraOpNumThreads:1,interOpNumThreads:1}}:{})}).then(m=>{marks.modelLoadAndSessionMs=performance.now()-componentStart;return m;}),
  lib.AutoTokenizer.from_pretrained(source||config.id,options).then(t=>{marks.tokenizerLoadMs=performance.now()-componentStart;return t;}),
 ]);
 const extractor=new lib.FeatureExtractionPipeline({task:'feature-extraction',model,tokenizer});
 marks.encoderReadyMs=performance.now()-start;
 return {extractor,marks,events};
}
export function rankAll(q:number[],vectors:number[][]){
 const max=new Map<string,{toolId:string;score:number;prototypeIndex:number}>();
 vectors.forEach((v,i)=>{const score=v.reduce((s,n,j)=>s+n*q[j],0),toolId=bgeMatchingIndex[i].toolId;
  if(!max.has(toolId)||score>max.get(toolId)!.score)max.set(toolId,{toolId,score,prototypeIndex:i});});
 return [...max.values()].sort((a,b)=>b.score-a.score);
}
export function decisionRecord(text:string,expected:string,q:number[],vectors:number[][]){
 const ranks=rankAll(q,vectors),skills=ranks.filter(x=>x.toolId!==BGE_OUT_OF_SCOPE),background=ranks.find(x=>x.toolId===BGE_OUT_OF_SCOPE)!;
 const [top1,top2]=skills,guard=routingSkipReason(text),decision=guard?abstain(guard):chooseRoute(ranks,BGE_MODEL_ID);
 const skillMargin=top1.score-top2.score,backgroundMargin=top1.score-background.score,g=calibration.route;
 const failedGates=[...(top1.score<g.score?['MINIMUM SCORE']:[]),...(skillMargin<g.margin?['SKILL AMBIGUITY']:[]),...(backgroundMargin<g.domainMargin?['BACKGROUND AMBIGUITY']:[]),...(guard?[guard==='needs-context'?'SHORT-CONTEXT FAILURE':'GUARD']:[])];
 return {text,expected,top1,top2,top5:skills.slice(0,5),skillMargin,background,backgroundMargin,failedGates,contextUsed:null,guardResponsible:guard,decision,top1Correct:top1.toolId===expected,descriptionReview:'Not independently adjudicated',genuineAmbiguityReview:'Not independently adjudicated'};
}
export async function run(extractor:any,cases:{text:string;expected:string}[],progress:(s:string)=>void){
 const index:any={},queries:any[]=[],timing:any={};
 for(const batchSize of [12,1]){
  const begin=performance.now(),vectors:number[][]=[],tokenBatches:any[]=[];
  for(let i=0;i<bgeMatchingIndex.length;i+=batchSize){
   progress(`Index batch size ${batchSize}: ${i}/${bgeMatchingIndex.length}`);
   const texts=bgeMatchingIndex.slice(i,i+batchSize).map(p=>p.text);
   tokenBatches.push({offset:i,...tokens(extractor.tokenizer,texts)});
   const out=await extractor(texts,{pooling:'cls',normalize:true});vectors.push(...texts.map((_,j)=>vec(out,j)));
  }
  timing['skillIndexBatch'+batchSize+'Ms']=performance.now()-begin;index[batchSize]={vectors,tokenBatches};
 }
 const auxStart=performance.now();
 for(const source of [bgeNeedScenarios,bgePathwayScenarios])for(let i=0;i<source.length;i+=12)await extractor(source.slice(i,i+12).map(p=>p.text),{pooling:'cls',normalize:true});
 timing.auxiliaryIndexesMs=performance.now()-auxStart;
 for(const c of cases){
  progress(`Query ${queries.length+1}/${cases.length}`);const started=performance.now();
  const input=tokens(extractor.tokenizer,c.text),out=await extractor(c.text,{pooling:'cls',normalize:true}),vector=vec(out);
  queries.push({...c,input,tokenCount:(input.input_ids as any).data.length,vector,ms:performance.now()-started,decisions:{batch12:decisionRecord(c.text,c.expected,vector,index[12].vectors),batch1:decisionRecord(c.text,c.expected,vector,index[1].vectors)}});
 }
 // Raw token output establishes that first-token pooling and L2 normalization agree.
 const sample=cases[0].text,raw=await extractor(sample,{pooling:'none',normalize:false});
 const first=Array.from(raw.data.slice(0,384)) as number[],norm=Math.hypot(...first),normalized=first.map(x=>x/norm);
 return {model:config,dtype:'q8',pooling:'cls',normalization:'L2',prototypes:bgeMatchingIndex,index,queries,timing,poolingCheck:{text:sample,rawFirstToken:first,normalized,maxAbsDifference:Math.max(...normalized.map((x,i)=>Math.abs(x-queries[0].vector[i])))}};
}
