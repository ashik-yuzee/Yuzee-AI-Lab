/**
 * EXP-RAG embeddings. Two providers:
 *  - bge (fallback without GEMINI_API_KEY): the pinned, locally downloaded Xenova/bge-small-en-v1.5 used by routing
 *    (no inference API, no user-data upload). Absent model files → lexical retrieval.
 *  - gemini (default when GEMINI_API_KEY is set): Gemini Embedding via the Gemini API. Works on hosts without the BGE files
 *    (e.g. Vercel). Guidance, evidence and memory recall switch to it; the prebuilt warehouse
 *    index keeps its BGE vectors and is searched lexically when BGE is unavailable.
 * Vectors from different providers are never compared: every cache and index is keyed by provider.
 */
import path from 'node:path';
import fs from 'node:fs';
import {GoogleGenAI} from '@google/genai';
import {loadEmbeddingModel} from '../routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../routing/models';

export type EmbedProvider='bge'|'gemini';
const config=routerModel(DEFAULT_ROUTER_MODEL);
export const EMBEDDING_MODEL={id:config.id,revision:config.revision,dimensions:384,pooling:'cls' as const};
export const GEMINI_EMBEDDING={model:process.env.EXP_RAG_GEMINI_EMBED_MODEL||'gemini-embedding-2',dimensions:768};
/** BGE v1.5 retrieval instruction for short queries (passages are embedded without it). */
export const QUERY_INSTRUCTION='Represent this sentence for searching relevant passages: ';
const directory=path.resolve('data/minilm-cache',config.id,config.revision);

type Encoder=Awaited<ReturnType<typeof loadEmbeddingModel>>;
const encoders=new Map<number,Promise<Encoder>>();
const failure:Record<EmbedProvider,string|null>={bge:null,gemini:null};

/** Request choice, else EXP_RAG_EMBEDDER, else Gemini when an API key is configured, else local BGE. */
export function resolveProvider(requested?:unknown):EmbedProvider{
  const v=requested==='gemini'||requested==='bge'?requested:process.env.EXP_RAG_EMBEDDER;
  if(v==='gemini'||v==='bge')return v;
  return process.env.GEMINI_API_KEY?'gemini':'bge';
}
/** EXP_RAG_DENSE=off forces lexical-only retrieval for every provider. */
export function embedderAvailable(provider:EmbedProvider='bge'){
  if(process.env.EXP_RAG_DENSE==='off')return false;
  if(provider==='gemini')return !!process.env.GEMINI_API_KEY;
  return !failure.bge&&fs.existsSync(path.join(directory,'onnx/model_quantized.onnx'));
}
export function embedderStatus(provider:EmbedProvider='bge'){
  return provider==='gemini'
    ?{provider,model:GEMINI_EMBEDDING.model,dimensions:GEMINI_EMBEDDING.dimensions,available:embedderAvailable('gemini'),failure:failure.gemini}
    :{provider,model:config.id,revision:config.revision,available:embedderAvailable('bge'),failure:failure.bge};
}

function encoder(threads:number){
  let e=encoders.get(threads);
  if(!e){
    e=loadEmbeddingModel(config,{sourceDirectory:directory,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:threads,interOpNumThreads:1}})
      .catch(err=>{encoders.delete(threads);failure.bge=String(err?.message||err).slice(0,200);throw err;});
    encoders.set(threads,e);
  }
  return e;
}

let gemini:GoogleGenAI|null=null;
const normalise=(v:number[])=>{const out=Float32Array.from(v);let n=0;for(const x of out)n+=x*x;n=Math.sqrt(n)||1;for(let i=0;i<out.length;i++)out[i]/=n;return out;};
/** Truncated (768-d) Gemini embeddings are not unit length, so they are normalised here. Failures are transient (not sticky). */
async function embedGemini(texts:string[],kind:'query'|'passage',batch:number):Promise<Float32Array[]>{
  gemini??=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const out:Float32Array[]=[];
  try{
    for(let i=0;i<texts.length;i+=batch){
      const slice=texts.slice(i,i+batch);
      const r=await gemini.models.embedContent({model:GEMINI_EMBEDDING.model,contents:slice.map(t=>({role:'user',parts:[{text:t.slice(0,8000)}]})),
        config:{taskType:kind==='query'?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT',outputDimensionality:GEMINI_EMBEDDING.dimensions,abortSignal:AbortSignal.timeout(8000)}});
      if(r.embeddings?.length!==slice.length)throw Error(`Gemini returned ${r.embeddings?.length??0} embeddings for ${slice.length} inputs`);
      for(const e of r.embeddings)out.push(normalise(e.values||[]));
    }
    failure.gemini=null;
    return out;
  }catch(err:any){failure.gemini=String(err?.message||err).slice(0,200);throw err;}
}

/** L2-normalised embeddings. BGE queries get the BGE retrieval instruction; Gemini uses task types. */
export async function embed(texts:string[],kind:'query'|'passage',options:{threads?:number;batch?:number;provider?:EmbedProvider}={}):Promise<Float32Array[]>{
  if(!texts.length)return [];
  if(options.provider==='gemini')return embedGemini(texts,kind,Math.min(options.batch??100,100));
  const e=await encoder(options.threads??2);
  const batch=options.batch??32;const out:Float32Array[]=[];
  for(let i=0;i<texts.length;i+=batch){
    const slice=texts.slice(i,i+batch).map(t=>(kind==='query'?QUERY_INSTRUCTION:'')+t.slice(0,4000));
    const tensor=await e(slice,{pooling:'cls',normalize:true});
    const data=tensor.data as Float32Array,dim=tensor.dims.at(-1)!;
    for(let j=0;j<slice.length;j++)out.push(data.slice(j*dim,(j+1)*dim));
  }
  return out;
}
