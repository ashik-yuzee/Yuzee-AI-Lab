import React,{useEffect,useState} from 'react';
import { Square, Sparkles } from 'lucide-react';
import { Progress, progressCopy } from '../shared/stream';
export function StreamingStatus({progress,onStop,startedAt}:{progress:Progress;onStop:()=>void;startedAt:number}) {
  const [now,setNow]=useState(Date.now());
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const elapsed=Math.max(0,now-startedAt),copy=progressCopy(progress,reduced?0:Math.floor(elapsed/3000),elapsed);
  return <div className="stream-status"><span className="stream-orbit" aria-hidden="true"><Sparkles size={17}/></span><div className="stream-copy"><div role="status" aria-live="polite" aria-atomic="true"><strong key={copy.title}>{copy.title}<span className="stream-dots" aria-hidden="true">…</span></strong></div><p>{copy.subtext}</p></div><button type="button" aria-label="Stop response" className="stop-stream" onClick={onStop}><Square size={12}/>Stop</button></div>;
}
