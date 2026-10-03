import React,{useState,useRef,useEffect} from 'react';
import {Check,History,Loader2} from 'lucide-react';
import type {MiniPathwayRun} from '../miniPathway/service';
import {pathwayContext,pathwayDate} from '../miniPathway/history';

/** Saved-pathways popover in the panel title row (Yuzee mobile staging design): History icon trigger,
 * newest first, "Latest" pill, check on the selected row; empty and error states with retry. */
export function PathwayHistorySelector({runs,selectedId,messages,loading,error,onRetry,onSelect,initialOpen=false}:{runs:MiniPathwayRun[];selectedId?:string;messages:{id:string;serverMessageId?:string;role:string;content:string}[];loading:boolean;error?:string;onRetry?:()=>void;onSelect:(id:string)=>void;initialOpen?:boolean}){
 const [open,setOpen]=useState(initialOpen);
 const ref=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const ordered=[...runs].reverse();

 useEffect(()=>{
  if(!open)return;
  const outside=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
  // Escape closes the popover only; the panel's own Escape handler must not also fire.
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('mousedown',outside);window.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('mousedown',outside);window.removeEventListener('keydown',escape,true);};
 },[open]);
 useEffect(()=>{if(loading)setOpen(false);},[loading]);

 return <div className="mph-menu" ref={ref}>
  <button ref={trigger} type="button" className={`mph-trigger${open?' mph-trigger--open':''}`} title="Saved pathways"
   aria-label={loading?'Building a new pathway':`Saved pathways (${runs.length})`} aria-haspopup="listbox" aria-expanded={open} disabled={loading}
   onClick={()=>setOpen(v=>!v)}>
   {loading?<Loader2 size={18} className="mph-spin" aria-hidden="true"/>:<History size={18} aria-hidden="true"/>}
  </button>
  {open&&(runs.length?<ul className="mph-list" role="listbox" aria-label="Saved pathways">
   {ordered.map((run,i)=>{
    const isSelected=run.id===selectedId;
    return <li key={run.id} role="option" aria-selected={isSelected}>
     <button type="button" className={`mph-option${isSelected?' mph-option--selected':''}`} onClick={()=>{onSelect(run.id);setOpen(false);trigger.current?.focus();}}>
      <span className="mph-option-title">Pathway {runs.indexOf(run)+1}{i===0&&<em>Latest</em>}<span className="mph-meta">{pathwayDate(run.createdAt)}</span></span>
      <span className="mph-option-ctx">{pathwayContext(run,messages)}</span>
      {isSelected&&<Check size={15} className="mph-check" aria-hidden="true"/>}
     </button>
    </li>;
   })}
  </ul>:<div className="mph-list mph-empty" role="status">
   {error?<><p>Saved pathways could not be loaded.</p>{onRetry&&<button type="button" onClick={onRetry}>Try again</button>}</>:<p>No saved pathways yet. Your pathways will appear here.</p>}
  </div>)}
 </div>;
}
