import assert from 'node:assert/strict';
import {ROUTER_MODELS,routerModel} from '../src/routing/models';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
class FakeWorker{static last:FakeWorker;onmessage:any;onerror:any;sent:any[]=[];terminated=false;constructor(){FakeWorker.last=this;}postMessage(d:any){this.sent.push(d);}terminate(){this.terminated=true;}reply(d:any){this.onmessage({data:d});}}
Object.defineProperty(globalThis,'Worker',{value:FakeWorker,configurable:true});
const map=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>map.get(k),setItem:(k:string,v:string)=>map.set(k,v)},configurable:true});
const r=await import('../src/services/MicroToolRouter');
assert.equal(routerModel('untrusted-model').id,ROUTER_MODELS[0].id);
assert.equal(r.setRouterModel('untrusted-model'),false);
for(const m of ROUTER_MODELS){
 assert.equal(r.setRouterModel(m.id),true);let worker=FakeWorker.last;assert.equal(worker.sent[0].modelId,m.id);worker.reply({type:'ready'});assert.equal(r.getRouterStatus(),'ready');assert.equal(r.getRouterModel(),m.id);
 const p=r.routeMessage('Explain the tuition fees for this course');const req=worker.sent.at(-1);worker.reply({type:'result',id:req.id,candidates:[{toolId:'COURSE_011',score:.8},{toolId:'CORE_010',score:.3},{toolId:'__OUT_OF_SCOPE__',score:.2}]});assert.equal((await p).toolId,'COURSE_011');
 for(const [fn,type] of [[r.assessMessageNeeds,'needs'],[r.reviewResponseSkills,'suggest'],[r.reviewMiniPathway,'pathway']] as const){
  const pending=fn('Explain this study choice');assert.equal(worker.sent.at(-1).type,type);const next=ROUTER_MODELS.find(x=>x.id!==m.id)!;r.setRouterModel(next.id);assert.equal((await pending).reason,'unavailable');assert.equal(worker.terminated,true);worker.reply({type:'ready'});assert.equal(r.getRouterStatus(),'loading');r.setRouterModel(m.id);worker=FakeWorker.last;worker.reply({type:'ready'});
 }
 const route=r.routeMessage('Explain the fees for this course please');r.setRouterModel(ROUTER_MODELS.find(x=>x.id!==m.id)!.id);assert.equal((await route).reason,'unavailable');
}
const tokenizer=()=>({input_ids:{dims:[1,322]}});
assert.equal(checkEmbeddingInput(tokenizer,'',routerModel(ROUTER_MODELS[1].id).tokenBudget).fits,false);
assert.equal(checkEmbeddingInput(tokenizer,'',routerModel(ROUTER_MODELS[2].id).tokenBudget).fits,true);
assert.equal(ROUTER_MODELS[2].pooling,'cls');
FakeWorker.last.reply({type:'unavailable'});
console.log('PASS all three selected models, allowlist, pending work cleanup across four flows, stale worker isolation, model-specific token budgets and BGE pooling.');
