import React from 'react';
import type {MiniPathwayRun} from '../miniPathway/service';
import {pathwayContext,pathwayDate} from '../miniPathway/history';

export function PathwayHistorySelector({runs,selectedId,messages,loading,onSelect}:{runs:MiniPathwayRun[];selectedId?:string;messages:{id:string;serverMessageId?:string;role:string;content:string}[];loading:boolean;onSelect:(id:string)=>void}){
 if(!runs.length)return null;
 const selected=runs.find(r=>r.id===selectedId);
 return <div className="mini-pathway-history">
  <label htmlFor="saved-pathway-select">Saved pathways <span>({runs.length})</span></label>
  <select id="saved-pathway-select" value={loading?'':selectedId||''} disabled={loading} onChange={e=>onSelect(e.target.value)}>
   {loading&&<option value="">Building a new pathway…</option>}
   {[...runs].reverse().map(run=><option key={run.id} value={run.id}>Pathway {runs.indexOf(run)+1} · {pathwayDate(run.createdAt)} · {pathwayContext(run,messages)}</option>)}
  </select>
  <p>{loading?'Your saved pathways will remain available here.':selected?`Based on: ${pathwayContext(selected,messages)}`:''}</p>
 </div>;
}
