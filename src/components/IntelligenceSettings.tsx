import React,{useEffect,useState} from 'react';
import {Network} from 'lucide-react';
import {loadFeatures,saveFeatures,type FeatureFlags,type RagEmbedderChoice} from '../services/featureFlags';
import {useTokenLab} from '../context/TokenLabContext';

type Status={graph?:string;forecasts?:string;currentForecastSeries?:number;forecastSeries?:number};
type Rag={defaultEmbedder?:'bge'|'gemini';embedders?:Record<'bge'|'gemini',{available:boolean;model:string}>};
const LABEL:Record<string,string>={READY:'Ready',HISTORICAL_ONLY:'Historical data only',NOT_CONFIGURED:'Not configured on this server',NOT_READY:'No published graph',UNAVAILABLE:'Unreachable',DISABLED:'Disabled on this server',ARTIFACT_MISMATCH:'Forecast and graph out of sync'};
const tone=(s?:string)=>s==='READY'?'text-emerald-700':s==='HISTORICAL_ONLY'?'text-amber-700':'text-slate-500';

function Switch({checked,onChange,label,disabled}:{checked:boolean;onChange:(v:boolean)=>void;label:string;disabled?:boolean}){
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={()=>onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-40 ${checked?'bg-violet-600':'bg-slate-300'}`}>
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked?'translate-x-4':'translate-x-0.5'}`}/>
  </button>;
}

/** Settings → Data intelligence: Neo4j graph and TimesFM forecast switches, and the EXP-RAG embedding provider. */
export function IntelligenceSettings(){
  const {chatLocked}=useTokenLab();
  const [flags,setFlags]=useState<FeatureFlags>(loadFeatures);
  const [status,setStatus]=useState<Status|null>(null);
  const [rag,setRag]=useState<Rag|null>(null);
  useEffect(()=>{
    fetch('/api/intelligence/status').then(r=>r.ok?r.json():null).then(setStatus).catch(()=>setStatus({}));
    fetch('/api/rag/status').then(r=>r.ok?r.json():null).then(setRag).catch(()=>setRag({}));
  },[]);
  const update=(patch:Partial<FeatureFlags>)=>{const next={...flags,...patch};setFlags(next);saveFeatures(next);};
  const embedders:Array<{id:RagEmbedderChoice;label:string}>=[{id:'default',label:`Server default${rag?.defaultEmbedder?` (${rag.defaultEmbedder==='gemini'?'Gemini':'BGE'})`:''}`},{id:'bge',label:'BGE (local)'},{id:'gemini',label:'Gemini'}];
  const chosen=flags.ragEmbedder==='default'?rag?.defaultEmbedder:flags.ragEmbedder;
  const chosenAvailable=chosen?rag?.embedders?.[chosen]?.available:undefined;
  const row=(title:string,desc:string,value:boolean,key:'graph'|'forecasts',s?:string)=>(
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-slate-500 mt-0.5">{desc}</p>
        <p className={`mt-0.5 ${value?tone(s):'text-slate-500'}`} role="status">{status===null?'Checking…':value?LABEL[s||'']||'Unknown':'Off for your chats'}</p>
      </div>
      <Switch checked={value} onChange={v=>update({[key]:v})} label={title} disabled={chatLocked}/>
    </div>
  );
  return <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Network className="w-3.5 h-3.5 text-slate-500"/>
      <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Data intelligence &amp; RAG</span>
    </div>
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 text-xs">
      {row('Neo4j relationship graph','Links courses to occupations, skills and regional demand.',flags.graph,'graph',status?.graph)}
      {row('TimesFM vacancy forecasts','State/national job-ad outlooks for outlook questions.',flags.forecasts,'forecasts',status?.forecasts)}
      <p className="text-[11px] text-slate-500">When a service is off or unreachable, chat continues without it.{chatLocked?' Fixed for the current conversation. Start a new conversation to change them.':''}</p>
      <div className="pt-2 border-t border-slate-200 space-y-1.5">
        <p className="font-medium text-slate-700" id="rag-embedder-label">EXP-RAG embeddings</p>
        <div className="flex items-center gap-1 bg-slate-200 rounded-lg p-0.5 w-fit" role="radiogroup" aria-labelledby="rag-embedder-label">
          {embedders.map(e=><button key={e.id} type="button" role="radio" aria-checked={flags.ragEmbedder===e.id} disabled={chatLocked} onClick={()=>update({ragEmbedder:e.id})}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${flags.ragEmbedder===e.id?'bg-white text-slate-900 shadow-xs':'text-slate-500 hover:text-slate-700'}`}>{e.label}</button>)}
        </div>
        <p className="text-slate-500">Used for guidance, evidence and memory retrieval. The warehouse catalogue index keeps its BGE vectors (keyword search without BGE).</p>
        {rag&&chosen&&chosenAvailable===false&&<p className="text-amber-700" role="status">{chosen==='gemini'?'Gemini embeddings need GEMINI_API_KEY on the server.':'BGE model files are not on this server.'} Retrieval falls back to keyword search.</p>}
      </div>
    </div>
  </div>;
}
