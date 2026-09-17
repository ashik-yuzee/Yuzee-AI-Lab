import type {RoutingHistory} from '../routing/conversationQuery';
import {validBgeReady} from '../routing/bgeContract';
import {RUNTIME_ROUTER_MODELS,ROUTER_MODEL_KEY,DEFAULT_ROUTER_MODEL,routerModel,type RouterModelId} from '../routing/models';
import {choosePathwayHint,type PathwayHint} from '../miniPathway/policy';
import {selectSkillOffers,noSkills,type SkillReview} from '../routing/skillSuggestions';
import {chooseNeed,type NeedHint} from '../routing/turnNeeds';
import {abstain,chooseRoute,routingInput,type RoutingDecision,type RoutingFlow} from '../routing/policy';
export type RouterStatus='idle'|'loading'|'ready'|'unavailable';
let status:RouterStatus='idle';
let selectedModel:RouterModelId=DEFAULT_ROUTER_MODEL;
// Migrate saved L6/L12 choices without loading a legacy model.
try{localStorage.setItem(ROUTER_MODEL_KEY,DEFAULT_ROUTER_MODEL);}catch{/* Storage can be disabled. */}
export const getRouterModel=()=>selectedModel;
export function setRouterModel(id:string):boolean {
 if(!RUNTIME_ROUTER_MODELS.some(m=>m.id===id))return false;
 if(selectedModel===id&&(status==='loading'||status==='ready'))return true;
 selectedModel=id as RouterModelId;
 try{localStorage.setItem(ROUTER_MODEL_KEY,id);}catch{/* The in-memory choice still works. */}
 unavailable();startWarmup();return true;
}
let worker:Worker|null=null;
let warmupTimer:ReturnType<typeof setTimeout>|undefined;
let nextId=0;
const listeners=new Set<(status:RouterStatus)=>void>();
const suggestPending=new Map<string,{finish:(review:SkillReview)=>void}>();
const needPending=new Map<string,{finish:(hint:NeedHint)=>void}>();
const pending=new Map<string,{flow:RoutingFlow;finish:(decision:RoutingDecision)=>void}>();
const pathwayPending=new Map<string,{finish:(hint:PathwayHint)=>void}>();
export const getRouterStatus=()=>status;
export function onRouterStatus(callback:(status:RouterStatus)=>void){listeners.add(callback);callback(status);return()=>{listeners.delete(callback);};}
function setStatus(value:RouterStatus){status=value;listeners.forEach(cb=>cb(value));}
function unavailable(){
 clearTimeout(warmupTimer);worker?.terminate();worker=null;setStatus('unavailable');
 for(const {finish} of [...suggestPending.values()])finish(noSkills('unavailable'));
 for(const {finish} of [...pending.values()])finish(abstain('unavailable'));
 for(const {finish} of [...needPending.values()])finish({status:'abstained',reason:'unavailable'});
 for(const {finish} of [...pathwayPending.values()])finish({status:'abstained',reason:'unavailable'});
}
export function startWarmup(){
 if(status==='loading'||status==='ready')return;
 if(typeof Worker==='undefined'){setStatus('unavailable');return;}
 setStatus('loading');
 try{
  worker=new Worker(new URL('../workers/embedder.worker.ts',import.meta.url),{type:'module'});
  const source=worker;
  worker.onmessage=event=>{
   if(worker!==source)return;
   const m=event.data;
   if(m?.type==='ready'){if(!validBgeReady(m)){unavailable();return;}clearTimeout(warmupTimer);setStatus('ready');}
   else if(m?.type==='pathway-result')pathwayPending.get(m.id)?.finish(choosePathwayHint(Array.isArray(m.candidates)?m.candidates:[],selectedModel));
   else if(pathwayPending.has(m?.id)&&['abstained','error'].includes(m?.type))pathwayPending.get(m.id)?.finish({status:'abstained',reason:m.type==='error'?'inference-failed':'token-budget'});
   else if(m?.type==='unavailable')unavailable();
   else if(m?.type==='suggest-result')suggestPending.get(m.id)?.finish(selectSkillOffers(Array.isArray(m.rankings)?m.rankings:[],selectedModel));
   else if(suggestPending.has(m?.id)&&['abstained','error'].includes(m?.type))suggestPending.get(m.id)?.finish(noSkills(m.type==='error'?'inference-failed':'token-budget'));
   else if(m?.type==='needs-result')needPending.get(m.id)?.finish(chooseNeed(Array.isArray(m.candidates)?m.candidates:[],selectedModel));
   else if(needPending.has(m?.id)&&['abstained','error'].includes(m?.type))needPending.get(m.id)?.finish({status:'abstained',reason:m.type==='error'?'inference-failed':'token-budget'});
   else if(m?.type==='abstained')pending.get(m.id)?.finish(abstain(['token-budget','busy','input-length'].includes(m.reason)?m.reason:'inference-failed'));
   else if(m?.type==='result')pending.get(m.id)?.finish(chooseRoute(Array.isArray(m.candidates)?m.candidates:[],selectedModel,pending.get(m.id)?.flow||'route'));
   else if(m?.type==='error')pending.get(m.id)?.finish(abstain('inference-failed'));
  };
  worker.onerror=()=>{if(worker===source)unavailable();};
  warmupTimer=setTimeout(unavailable,120000);
  worker.postMessage({type:'init',modelId:selectedModel});
 }catch{unavailable();}
}
/** Never delay chat for a cold model. Ready inference has a short bounded wait and cancellation. */
export function routeMessage(text:string,{signal,structuredAnswer=false,timeoutMs=1500,topic=false,history=[]}:{signal?:AbortSignal;structuredAnswer?:boolean;timeoutMs?:number;topic?:boolean;history?:RoutingHistory}={}):Promise<RoutingDecision>{
 if(signal?.aborted)return Promise.resolve(abstain('cancelled'));
 const input=routingInput(text,history,structuredAnswer);if(input.skip)return Promise.resolve(abstain(input.skip));
 if(status!=='ready'||!worker){if(status==='idle')startWarmup();return Promise.resolve(abstain('not-ready'));}
 const id=String(++nextId),started=performance.now();
 return new Promise(resolve=>{
  const onAbort=()=>{worker?.postMessage({type:'cancel',id});finish(abstain('cancelled'));};
  const timer=setTimeout(()=>{finish(abstain('timeout'));unavailable();},timeoutMs);
  const finish=(result:RoutingDecision)=>{
   if(!pending.has(id))return;
   clearTimeout(timer);signal?.removeEventListener('abort',onAbort);pending.delete(id);
   resolve({...result,latencyMs:Math.round(performance.now()-started)});
  };
  pending.set(id,{finish,flow:topic?'topic':'route'});signal?.addEventListener('abort',onAbort,{once:true});
  try{worker!.postMessage({type:topic?'topic':'route',id,text:input.text});}catch{finish(abstain('unavailable'));unavailable();}
 });
}

/** Pre-generation needs classification is independent of explicit @Oala skill injection. */
export function assessMessageNeeds(text:string,{signal,timeoutMs=1000}:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<NeedHint>{
 const fallback=(reason:string):NeedHint=>({status:'abstained',reason});
 if(signal?.aborted)return Promise.resolve(fallback('cancelled'));
 if(!text.trim()||text.length>1800)return Promise.resolve(fallback('input-length'));
 if(status!=='ready'||!worker){if(status==='idle')startWarmup();return Promise.resolve(fallback('not-ready'));}
 const id='needs-'+String(++nextId);
 return new Promise(resolve=>{
  const onAbort=()=>{worker?.postMessage({type:'cancel',id});finish(fallback('cancelled'));};
  const timer=setTimeout(()=>{finish(fallback('timeout'));unavailable();},timeoutMs);
  const finish=(hint:NeedHint)=>{if(!needPending.has(id))return;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);needPending.delete(id);resolve(hint);};
  needPending.set(id,{finish});signal?.addEventListener('abort',onAbort,{once:true});
  try{worker!.postMessage({type:'needs',id,text});}catch{finish(fallback('unavailable'));unavailable();}
 });
}

/** Runs after Gemini completes. This ranks topics, not factual correctness. */
export function reviewResponseSkills(text:string,{signal,timeoutMs=20000}:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<SkillReview>{
 if(signal?.aborted)return Promise.resolve(noSkills('cancelled'));
 if(!text.trim()||text.length>30000)return Promise.resolve(noSkills('input-length'));
 if(status!=='ready'||!worker)return Promise.resolve(noSkills('not-ready'));
 if(suggestPending.size)return Promise.resolve(noSkills('busy'));
 const id='suggest-'+String(++nextId);
 return new Promise(resolve=>{
  const onAbort=()=>{worker?.postMessage({type:'cancel',id});finish(noSkills('cancelled'));};
  const timer=setTimeout(()=>{worker?.postMessage({type:'cancel',id});finish(noSkills('timeout'));},timeoutMs);
  const finish=(result:SkillReview)=>{if(!suggestPending.has(id))return;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);suggestPending.delete(id);resolve(result);};
  suggestPending.set(id,{finish});signal?.addEventListener('abort',onAbort,{once:true});
  try{worker!.postMessage({type:'suggest',id,text});}catch{finish(noSkills('unavailable'));unavailable();}
 });
}

/** Dedicated pathway relevance check. It queues behind an existing worker job without changing skill routing. */
export function reviewMiniPathway(text:string,{signal,timeoutMs=25000}:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<PathwayHint>{
 const fallback=(reason:string):PathwayHint=>({status:'abstained',reason});
 if(signal?.aborted)return Promise.resolve(fallback('cancelled'));
 if(!text.trim()||text.length>1800)return Promise.resolve(fallback('input-length'));
 if(status!=='ready'||!worker)return Promise.resolve(fallback('not-ready'));
 if(pathwayPending.size)return Promise.resolve(fallback('busy'));
 const id='pathway-'+String(++nextId);
 return new Promise(resolve=>{
  const onAbort=()=>{worker?.postMessage({type:'cancel',id});finish(fallback('cancelled'));};
  const timer=setTimeout(()=>{worker?.postMessage({type:'cancel',id});finish(fallback('timeout'));},timeoutMs);
  const finish=(hint:PathwayHint)=>{if(!pathwayPending.has(id))return;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);pathwayPending.delete(id);resolve(hint);};
  pathwayPending.set(id,{finish});signal?.addEventListener('abort',onAbort,{once:true});
  try{worker!.postMessage({type:'pathway',id,text});}catch{finish(fallback('unavailable'));}
 });
}
