import assert from 'node:assert/strict';
import {ROUTER_MODELS,DEFAULT_ROUTER_MODEL,routerModel} from '../src/routing/models';
import {bgeReadyContract} from '../src/routing/bgeContract';
class FakeWorker{static all:FakeWorker[]=[];onmessage:any;onerror:any;sent:any[]=[];terminated=false;constructor(){FakeWorker.all.push(this);}postMessage(d:any){this.sent.push(d);}terminate(){this.terminated=true;}reply(d:any){this.onmessage({data:d});}}
Object.defineProperty(globalThis,'Worker',{value:FakeWorker,configurable:true});
const storage=new Map<string,string>([['oala-router-model',ROUTER_MODELS[0].id]]);Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
const r=await import('../src/services/MicroToolRouter');
assert.equal(r.getRouterModel(),ROUTER_MODELS[2].id);assert.equal(storage.get('oala-router-model'),DEFAULT_ROUTER_MODEL);
assert.equal(routerModel('unknown').id,DEFAULT_ROUTER_MODEL);
for(const m of [ROUTER_MODELS[0].id,ROUTER_MODELS[1].id,'unknown'])assert.equal(r.setRouterModel(m),false);
r.startWarmup();let w=FakeWorker.all.at(-1)!;assert.equal(w.sent[0].modelId,DEFAULT_ROUTER_MODEL);
w.reply({type:'ready',...bgeReadyContract,dimensions:768});assert.equal(r.getRouterStatus(),'unavailable');assert.equal(w.terminated,true);
r.startWarmup();w=FakeWorker.all.at(-1)!;w.reply({type:'ready',...bgeReadyContract});assert.equal(r.getRouterStatus(),'ready');const count=FakeWorker.all.length;
const controller=new AbortController();const optional=r.reviewResponseSkills('Tuition fees and support',{signal:controller.signal});const opt=w.sent.at(-1);
const direct=r.routeMessage('Explain tuition costs for this course');const dir=w.sent.at(-1);assert.equal(dir.type,'route'); // Not rejected as busy behind suggestions.
const needs=r.assessMessageNeeds('Check fees for this degree');const need=w.sent.at(-1);
const pathway=r.reviewMiniPathway('Plan my career change');const path=w.sent.at(-1);
assert.equal(FakeWorker.all.length,count); // All four flows share the encoder.
controller.abort();assert.equal((await optional).reason,'cancelled');assert.deepEqual(w.sent.at(-1),{type:'cancel',id:opt.id});
w.reply({type:'suggest-result',id:opt.id,rankings:[]});
w.reply({type:'result',id:dir.id,candidates:[{toolId:'COURSE_011',score:.8},{toolId:'COURSE_012',score:.4},{toolId:'__OUT_OF_SCOPE__',score:.2}]});assert.equal((await direct).toolId,'COURSE_011');
w.reply({type:'needs-result',id:need.id,candidates:[{id:'research',score:.8},{id:'answer',score:.4}]});assert.equal((await needs).kind,'research');
w.reply({type:'pathway-result',id:path.id,candidates:[{id:'pathway',score:.8},{id:'other',score:.4}]});assert.equal((await pathway).status,'selected');
assert.equal((await r.reviewResponseSkills('Tuition fees',{timeoutMs:5})).reason,'timeout');assert.equal(r.getRouterStatus(),'ready');assert.equal(w.terminated,false);
const hanging=r.routeMessage('Explain tuition costs for this degree');w.reply({type:'unavailable'});assert.equal((await hanging).reason,'unavailable');r.startWarmup();const next=FakeWorker.all.at(-1)!;w.reply({type:'ready',...bgeReadyContract});assert.equal(r.getRouterStatus(),'loading');next.reply({type:'unavailable'});
assert.ok(FakeWorker.all.every(x=>x.sent[0].modelId===DEFAULT_ROUTER_MODEL));
console.log('PASS single BGE migration, artifact handshake, four shared flows, no legacy fallback, cancellation, optional timeout, failure cleanup and stale worker isolation.');
