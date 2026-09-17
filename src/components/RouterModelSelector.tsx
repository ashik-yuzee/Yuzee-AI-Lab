import React,{useEffect,useId,useState} from 'react';
import {ROUTER_MODELS,routerModel} from '../routing/models';
import {getRouterModel,getRouterStatus,onRouterStatus,setRouterModel,startWarmup} from '../services/MicroToolRouter';
export function RouterModelSelector(){
 const id=useId();
 const [selected,setSelected]=useState(getRouterModel);
 const [status,setStatus]=useState(getRouterStatus);
 useEffect(()=>onRouterStatus(value=>{setStatus(value);setSelected(getRouterModel());}),[]);
 return <section className="space-y-2" aria-label="Routing model">
  <label htmlFor={id} className="block text-xs font-semibold text-slate-800">Routing model</label>
  <select id={id} value={selected} onChange={e=>setRouterModel(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">
   {ROUTER_MODELS.map(m=><option key={m.id} value={m.id}>{m.label} — {m.tokenBudget} tokens</option>)}
  </select>
  <p className="text-xs text-slate-600">{routerModel(selected).description}</p>
  <p className="text-xs text-slate-500">Chooses relevant skills and pathways. Gemini writes the answer. Changing models downloads it if needed and rebuilds the suggestion index.</p>
  <p className="text-xs text-slate-600" role="status">{status==='ready'?'Ready':status==='loading'?'Preparing selected model…':status==='unavailable'?'Model unavailable. Chat remains available.':'Loads when guidance starts.'}
   {status==='unavailable'&&<button type="button" className="ml-2 underline" onClick={startWarmup}>Retry</button>}
  </p>
 </section>;
}
