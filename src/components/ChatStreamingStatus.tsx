import React,{useEffect,useState} from 'react';
import {Sparkles,Square} from 'lucide-react';
import {ChatProgressPhase,chatProgressCopy} from '../ux/streamProgress';
export function ChatStreamingStatus({phase='waiting',startedAt,onStop}:{phase?:ChatProgressPhase;startedAt:number;onStop:()=>void}) {
  const [elapsed,setElapsed]=useState(()=>Math.max(0,Date.now()-startedAt));const [reduced,setReduced]=useState(false);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
  useEffect(()=>{const t=setInterval(()=>setElapsed(Math.max(0,Date.now()-startedAt)),1000);return()=>clearInterval(t);},[startedAt]);
  const copy=chatProgressCopy(phase,reduced?0:elapsed/3000,elapsed);
  return <div className="main-chat-progress"><span className="main-chat-progress-icon" aria-hidden="true"><Sparkles size={17}/></span><div className="main-chat-progress-copy"><div role="status" aria-live="polite" aria-atomic="true"><strong>{copy.title}<span aria-hidden="true">…</span></strong></div><p>{copy.subtext}</p></div><button type="button" onClick={onStop} aria-label="Stop response"><Square size={12}/>Stop</button></div>;
}
