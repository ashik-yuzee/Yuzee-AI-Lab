import React,{useEffect,useMemo,useState} from 'react';
import {draftBlocks} from '../ux/streamingDraft';
import {ProtocolV13Renderer} from './ProtocolV13Renderer';
import type {YuzeeResponseV13} from '../types';
import {Sparkles,Square} from 'lucide-react';
import {ChatProgressPhase,chatProgressCopy} from '../ux/streamProgress';
export function ChatStreamingStatus({phase='waiting',startedAt,onStop}:{phase?:ChatProgressPhase;startedAt:number;onStop:()=>void}) {
  const [elapsed,setElapsed]=useState(()=>Math.max(0,Date.now()-startedAt));const [reduced,setReduced]=useState(false);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
  useEffect(()=>{const t=setInterval(()=>setElapsed(Math.max(0,Date.now()-startedAt)),1000);return()=>clearInterval(t);},[startedAt]);
  const copy=chatProgressCopy(phase,reduced?0:elapsed/3000,elapsed);
  return <div className="main-chat-progress"><span className="main-chat-progress-icon" aria-hidden="true"><Sparkles size={17}/></span><div className="main-chat-progress-copy"><div role="status" aria-live="polite" aria-atomic="true"><strong>{copy.title}<span aria-hidden="true">…</span></strong></div><p>{copy.subtext}</p></div><button type="button" onClick={onStop} aria-label="Stop response"><Square size={12}/>Stop</button></div>;
}

/** The answer as it is generated: visible blocks recovered from the streaming JSON, rendered like the final answer.
 * The accepted (validated, reviewed) response replaces it when the turn completes. */
export function ChatStreamingDraft({content}:{content:string}){
  const blocks=useMemo(()=>draftBlocks(content||''),[content]);
  if(!blocks.length)return null;
  const draft={schema_version:'1.3',current_mode:'A_CONVERSATION',response_intent:'GENERAL_DELIVERY',content_blocks:blocks,
    interaction:{kind:'none',question:'',options:[],fields:[],recommended_actions:[]}} as unknown as YuzeeResponseV13;
  return <div className="main-chat-draft" aria-busy="true" aria-label="Answer being written"><DraftBoundary key={blocks.length}><ProtocolV13Renderer data={draft} readOnly hideRecommendedActions/></DraftBoundary></div>;
}

/** A partial block that the renderer cannot handle yet must not take down the chat; the next delta retries. */
class DraftBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){/* draft only: the accepted answer renders separately */}
  render(){return this.state.failed?null:this.props.children;}
}
