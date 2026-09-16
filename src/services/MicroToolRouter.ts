import {abstain,chooseRoute,routingSkipReason,type RoutingDecision,MODEL_ID,ROUTER_MODEL_KEY} from '../routing/policy';
export type RouterStatus='idle'|'loading'|'ready'|'unavailable';
let status:RouterStatus='idle';
let worker:Worker|null=null;
let warmupTimer:ReturnType<typeof setTimeout>|undefined;
let nextId=0;
const listeners=new Set<(status:RouterStatus)=>void>();
const pending=new Map<string,{finish:(decision:RoutingDecision)=>void}>();
export const getRouterStatus=()=>status;
export function onRouterStatus(callback:(status:RouterStatus)=>void){listeners.add(callback);callback(status);return()=>{listeners.delete(callback);};}
function setStatus(value:RouterStatus){status=value;listeners.forEach(cb=>cb(value));}
function unavailable(){
 clearTimeout(warmupTimer);worker?.terminate();worker=null;setStatus('unavailable');
 for(const {finish} of [...pending.values()])finish(abstain('unavailable'));
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
   if(m?.type==='ready'){clearTimeout(warmupTimer);setStatus('ready');}
   else if(m?.type==='unavailable')unavailable();
   else if(m?.type==='abstained'&&m.reason==='token-budget')pending.get(m.id)?.finish(abstain('token-budget'));
   else if(m?.type==='result')pending.get(m.id)?.finish(chooseRoute(Array.isArray(m.candidates)?m.candidates:[]));
   else if(m?.type==='error')pending.get(m.id)?.finish(abstain('inference-failed'));
  };
  worker.onerror=()=>{if(worker===source)unavailable();};
  warmupTimer=setTimeout(unavailable,120000);
  const modelId=localStorage.getItem(ROUTER_MODEL_KEY)||MODEL_ID;
  worker.postMessage({type:'init',modelId});
 }catch{unavailable();}
}
export function setRouterModel(id:string){
 localStorage.setItem(ROUTER_MODEL_KEY,id);
 if(status==='loading'||status==='ready')unavailable();
 startWarmup();
}
/** Never delay chat for a cold model. Ready inference has a short bounded wait and cancellation. */
export function routeMessage(text:string,{signal,structuredAnswer=false,timeoutMs=1500}:{signal?:AbortSignal;structuredAnswer?:boolean;timeoutMs?:number}={}):Promise<RoutingDecision>{
 if(signal?.aborted)return Promise.resolve(abstain('cancelled'));
 const skip=routingSkipReason(text,structuredAnswer);if(skip)return Promise.resolve(abstain(skip));
 if(status!=='ready'||!worker){if(status==='idle')startWarmup();return Promise.resolve(abstain('not-ready'));}
 if(pending.size>0)return Promise.resolve(abstain('busy'));
 const id=String(++nextId),started=performance.now();
 return new Promise(resolve=>{
  const onAbort=()=>finish(abstain('cancelled'));
  const timer=setTimeout(()=>{finish(abstain('timeout'));unavailable();},timeoutMs);
  const finish=(result:RoutingDecision)=>{
   if(!pending.has(id))return;
   clearTimeout(timer);signal?.removeEventListener('abort',onAbort);pending.delete(id);
   resolve({...result,latencyMs:Math.round(performance.now()-started)});
  };
  pending.set(id,{finish});signal?.addEventListener('abort',onAbort,{once:true});
  try{worker!.postMessage({type:'route',id,text});}catch{finish(abstain('unavailable'));unavailable();}
 });
}
