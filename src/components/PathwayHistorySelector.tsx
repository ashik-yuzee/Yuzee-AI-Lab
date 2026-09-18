import React,{useState,useRef,useEffect} from 'react';
import {ChevronDown,Clock} from 'lucide-react';
import type {MiniPathwayRun} from '../miniPathway/service';
import {pathwayContext,pathwayDate} from '../miniPathway/history';

export function PathwayHistorySelector({runs,selectedId,messages,loading,onSelect}:{runs:MiniPathwayRun[];selectedId?:string;messages:{id:string;serverMessageId?:string;role:string;content:string}[];loading:boolean;onSelect:(id:string)=>void}){
 if(!runs.length)return null;
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 const selected=runs.find(r=>r.id===selectedId);
 const ordered=[...runs].reverse();

 useEffect(()=>{
  if(!open)return;
  const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
  document.addEventListener('mousedown',handler);
  return()=>document.removeEventListener('mousedown',handler);
 },[open]);

 useEffect(()=>{setOpen(false);},[loading]);

 const label=loading?'Building a new pathway…':selected?`Pathway ${runs.indexOf(selected)+1} · ${pathwayDate(selected.createdAt)}`:'Select a pathway';
 const sublabel=loading?'Your saved pathways will remain available here.':selected?pathwayContext(selected,messages):'';

 return <div className="mini-pathway-history" ref={ref}>
  <span className="mini-pathway-history-label"><Clock size={11}/>Saved pathways <b>{runs.length}</b></span>
  <button
   type="button"
   className={`mini-pathway-history-trigger${open?' mini-pathway-history-trigger--open':''}`}
   disabled={loading||runs.length===1}
   aria-haspopup="listbox"
   aria-expanded={open}
   onClick={()=>runs.length>1&&setOpen(v=>!v)}
  >
   <span className="mini-pathway-history-trigger-text">
    <strong>{label}</strong>
    {sublabel&&<small>{sublabel}</small>}
   </span>
   {runs.length>1&&<ChevronDown size={15} className="mini-pathway-history-chevron"/>}
  </button>
  {open&&<ul className="mini-pathway-history-list" role="listbox">
   {ordered.map(run=>{
    const idx=runs.indexOf(run)+1;
    const isSelected=run.id===selectedId;
    return <li key={run.id} role="option" aria-selected={isSelected}>
     <button type="button" className={isSelected?'mini-pathway-history-option--selected':''} onClick={()=>{onSelect(run.id);setOpen(false);}}>
      <span className="mini-pathway-history-option-title">Pathway {idx} · {pathwayDate(run.createdAt)}</span>
      <span className="mini-pathway-history-option-ctx">{pathwayContext(run,messages)}</span>
     </button>
    </li>;
   })}
  </ul>}
 </div>;
}
