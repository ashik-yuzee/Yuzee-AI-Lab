import React,{useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';

const LABEL:Record<string,string>={minimal:'Minimal',low:'Low',medium:'Medium',high:'High',adaptive:'Auto'};

/** Composer thinking-effort control (ChatGPT-style): a quiet text trigger that opens a popover with a stepped slider.
 * A native range input sits under the visuals, so keyboard (arrows, Home/End) and screen readers work. */
export function ThinkingEffortControl({levels,value,disabled,onChange}:{levels:string[];value:string;disabled?:boolean;onChange:(level:string)=>void}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const id=useId();
  const index=Math.max(0,levels.indexOf(value)>=0?levels.indexOf(value):levels.indexOf('medium'));
  const current=levels[index]??value;
  const position=levels.length>1?index/(levels.length-1):0; // 0..1 along the track
  useEffect(()=>{
    if(!open)return;
    const outside=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus();}};
    document.addEventListener('mousedown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',escape,true);};
  },[open]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  return <div className="thinking-effort" ref={root}>
    <button ref={trigger} type="button" className={`thinking-effort-trigger${open?' is-open':''}`} disabled={disabled}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-label={`Thinking effort: ${LABEL[current]||current}`}
      title="Thinking effort for your next message" onClick={()=>setOpen(v=>!v)}>
      <span>{LABEL[current]||current}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open&&<div className="thinking-effort-popover" id={id} role="dialog" aria-label="Thinking effort">
      <p className="thinking-effort-title">{LABEL[current]||current}<ChevronRight size={13} aria-hidden="true"/></p>
      <div className="thinking-effort-slider" style={{'--p':position} as React.CSSProperties}>
        <input type="range" min={0} max={Math.max(0,levels.length-1)} step={1} value={index} autoFocus
          aria-label="Thinking effort" aria-valuetext={LABEL[current]||current}
          onChange={e=>onChange(levels[Number(e.target.value)])}/>
        <span className="thinking-effort-fill" aria-hidden="true"/>
        <span className="thinking-effort-dot is-start" aria-hidden="true"/><span className="thinking-effort-dot is-end" aria-hidden="true"/>
        <span className="thinking-effort-knob" aria-hidden="true"/>
      </div>
    </div>}
  </div>;
}
