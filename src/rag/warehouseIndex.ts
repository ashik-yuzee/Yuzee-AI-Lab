/** Client for the forked EXP-RAG warehouse index worker. Absent index -> UNAVAILABLE, never an error to the user. */
import {fork,type ChildProcess} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import type {ChunkKind} from './warehouse/chunks';

export interface IndexHit{id:string;kind:ChunkKind;entity:string;title:string;text:string;meta:Record<string,any>;tokens:number;fused:number;dense:number|null;lexicalRank:number|null}
type State='STOPPED'|'LOADING'|'READY'|'UNAVAILABLE';

export class WarehouseIndex{
  private child?:ChildProcess;private state:State='STOPPED';private retryAt=0;private info:{count:number;meta:any}|null=null;
  private pending=new Map<string,{resolve:(h:IndexHit[])=>void;reject:(e:Error)=>void}>();
  constructor(private file=path.resolve(process.env.YUZEE_RAG_INDEX||'data/rag/warehouse-index.sqlite')){}
  status(){return {status:this.state,file:path.basename(this.file),chunks:this.info?.count??0,builtAt:this.info?.meta?.builtAt??null,model:this.info?.meta?.model??null,counts:this.info?.meta?.counts??null};}
  start(){
    // UNAVAILABLE is retried later: the index may be built after boot, or the worker may have crashed.
    if(this.child||(this.state==='UNAVAILABLE'&&Date.now()<this.retryAt))return;
    if(!fs.existsSync(this.file)){this.state='UNAVAILABLE';this.retryAt=Date.now()+300_000;return;}
    this.state='LOADING';
    const worker=fs.existsSync(path.resolve('dist/rag-index-worker.cjs'))&&process.env.NODE_ENV==='production'?path.resolve('dist/rag-index-worker.cjs'):path.resolve('src/rag/warehouse-index-worker.cjs');
    const child=this.child=fork(worker,[],{execArgv:['--no-warnings'],stdio:['ignore','ignore','ignore','ipc']});
    child.on('message',(m:any)=>{
      if(m.type==='ready'){this.state='READY';this.info={count:m.count,meta:m.meta};return;}
      if(m.type==='failed'){this.state='UNAVAILABLE';this.retryAt=Date.now()+300_000;return;}
      const p=m.id&&this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);
      m.error?p.reject(Error(m.error)):p.resolve(m.hits||[]);
    });
    const stopped=()=>{if(this.child!==child)return;this.child=undefined;this.state='UNAVAILABLE';this.retryAt=Math.max(this.retryAt,Date.now()+30_000);for(const p of this.pending.values())p.reject(Error('Index worker stopped.'));this.pending.clear();};
    child.on('error',stopped);child.on('exit',stopped);
    child.send({type:'init',file:this.file});
  }
  close(){const c=this.child;this.child=undefined;this.state='STOPPED';c?.kill();for(const p of this.pending.values())p.reject(Error('Index closed.'));this.pending.clear();}
  private request(message:Record<string,unknown>,signal?:AbortSignal,timeoutMs=2500):Promise<IndexHit[]>{
    this.start();
    if(this.state!=='READY'||!this.child)return Promise.resolve([]);
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const finish=(fn:()=>void)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);this.pending.delete(id);fn();};
      const abort=()=>finish(()=>reject(signal?.reason||Error('Aborted')));
      const timer=setTimeout(()=>finish(()=>reject(Error('Index search timed out.'))),timeoutMs);
      this.pending.set(id,{resolve:h=>finish(()=>resolve(h)),reject:e=>finish(()=>reject(e))});
      signal?.addEventListener('abort',abort,{once:true});
      this.child!.send({...message,id});
    });
  }
  search(q:{text:string;vector?:Float32Array;kinds?:ChunkKind[];limit?:number;weights?:{dense:number;lexical:number}},signal?:AbortSignal){
    const codes=/\b[A-Z]{3,5}\d{5}[A-Z]?\b/.test(q.text);
    const natural=q.text.trim().split(/\s+/).length>=4;
    const weights=q.weights??(codes?{dense:.5,lexical:1}:natural?{dense:1,lexical:.5}:{dense:1,lexical:1});
    return this.request({type:'search',text:q.text.slice(0,600),vector:q.vector?Array.from(q.vector):undefined,kinds:q.kinds,limit:q.limit??12,weights},signal);
  }
  byIds(ids:string[],signal?:AbortSignal){return ids.length?this.request({type:'ids',ids},signal):Promise.resolve([]);}
}
export const warehouseIndex=new WarehouseIndex();
