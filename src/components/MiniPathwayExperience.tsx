import {PathwayColourGuide} from "./PathwayLearningCues";
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Map,ArrowRight,X,Maximize2,Minimize2} from 'lucide-react';
import {useTokenLab} from '../context/TokenLabContext';
import {acceptedResponse} from '../ux/responsePresentation';
import {onRouterStatus,startWarmup,reviewMiniPathway} from '../services/MicroToolRouter';
import {MINI_PATHWAY_VERSION,validPathwayHint,alreadyHelpedInLowEpisode,decideMiniPathway,pathwayBoundary,pathwayQuery,type PathwayHint,type PathwayDecision} from '../miniPathway/policy';
import {generateMiniPathway,listMiniPathways} from '../miniPathway/client';
import {ProtocolV13Renderer} from './ProtocolV13Renderer';
import './mini-pathway.css';
import {useDrawerResize} from '../miniPathway/useDrawerResize';
import {miniPathwayPanelResponse} from '../miniPathway/presentation';
import {MiniPathwayStreaming} from './MiniPathwayStreaming';
import type {YuzeeContentBlock} from '../types';
import {usePathwayHistory} from '../miniPathway/usePathwayHistory';
import {PathwayHistorySelector} from './PathwayHistorySelector';

function waitForRouter(signal:AbortSignal):Promise<boolean>{
 return new Promise(resolve=>{
  let unsubscribe=()=>{};
  const done=(ready:boolean)=>{clearTimeout(timer);unsubscribe();signal.removeEventListener('abort',cancel);resolve(ready);};
  const cancel=()=>done(false),timer=setTimeout(cancel,125000);
  signal.addEventListener('abort',cancel,{once:true});
  unsubscribe=onRouterStatus(status=>{if(status==='ready')queueMicrotask(()=>done(true));if(status==='unavailable')queueMicrotask(()=>done(false));});
  if(signal.aborted)cancel();else startWarmup();
 });
}

export function MiniPathwayExperience(){
 const {currentConversation:conv,isStreaming,userLocation,setWhiteboardOpen,setTokenInspectorOpen,setSidebarOpen}=useTokenLab();
 const last=conv?.messages.at(-1),sourceId=last?.serverMessageId||last?.id||'';
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const [historyTarget,setHistoryTarget]=useState<HTMLElement|null>(null);
 const [decision,setDecision]=useState<PathwayDecision|null>(null);
 const [hint,setHint]=useState<PathwayHint|null>(null);
 const [open,setOpen]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const drawer=useDrawerResize(open,expanded);
 const [loading,setLoading]=useState(false),[stage,setStage]=useState('Preparing your mini pathway'),[error,setError]=useState('');
 const [draftBlocks,setDraftBlocks]=useState<YuzeeContentBlock[]>([]);
 const active=useRef<AbortController|null>(null),panel=useRef<HTMLElement|null>(null),opener=useRef<HTMLButtonElement|null>(null);
 const key=useRef('');key.current=`${conv?.id}:${sourceId}`;
 const reveal=()=>{setSidebarOpen(false);setWhiteboardOpen(false);setTokenInspectorOpen(false);setOpen(true);};
 const history=usePathwayHistory(conv?.id,reveal);
 const run=history.selected;
 const close=()=>{active.current?.abort();setDraftBlocks([]);setLoading(false);setOpen(false);setExpanded(false);opener.current?.focus();};
 const generate=async(mode:'automatic'|'manual',selection:PathwayHint,parentSignal?:AbortSignal)=>{
  if(!conv)return;
  const requestKey=key.current,controller=new AbortController();active.current?.abort();active.current=controller;
  const abort=()=>controller.abort();parentSignal?.addEventListener('abort',abort,{once:true});
  if(parentSignal?.aborted)controller.abort();
  setError('');setLoading(true);setDraftBlocks([]);setStage('Preparing your mini pathway');reveal();
  try{
   const current=()=>!controller.signal.aborted&&key.current===requestKey;
   const result=await generateMiniPathway(conv.id,{sourceMessageId:sourceId,mode,hint:selection,location:userLocation},controller.signal,
    stage=>{if(current())setStage(stage);},
    event=>{if(current())setDraftBlocks(previous=>event.type==='reset'?[]:previous.some(b=>b.id===event.block.id)?previous:[...previous,event.block]);});
   if(!controller.signal.aborted&&key.current===requestKey){history.remember(result);setDecision(d=>d?{...d,action:'offer'}:d);}
  }catch(e){if(!controller.signal.aborted&&key.current===requestKey)setError(e instanceof Error?e.message:'The mini pathway could not be prepared.');}
  finally{parentSignal?.removeEventListener('abort',abort);if(active.current===controller){active.current=null;setDraftBlocks([]);setLoading(false);}}
 };
 useEffect(()=>{setOpen(false);setExpanded(false);setError('');setHistoryTarget(document.getElementById('saved-pathways-control'));return()=>active.current?.abort();},[conv?.id]);
 useEffect(()=>{document.getElementById('mini-pathway-body')?.scrollTo({top:0});},[run?.id]);
 useEffect(()=>{
  const controller=new AbortController();let alive=true;
  setTarget(document.getElementById('mini-pathway-offer'));setDecision(null);setHint(null);setError('');
  active.current?.abort();setLoading(false);setDraftBlocks([]);
  const response=last?.role==='assistant'&&!last.error&&!last.streamStopped&&last.schemaValid!==false&&last.semanticValid!==false?acceptedResponse(last.structuredResponse||last.content):null;
  const userText=[...(conv?.messages||[])].reverse().find(m=>m.role==='user')?.content||'';
  if(!conv||isStreaming||last?.isStreaming||!response||pathwayBoundary(response,userText))return()=>controller.abort();
  const requestKey=key.current;
  (async()=>{
   // Read previous attempts before deciding: failure or refresh must not cause an automatic loop.
   const saved=await listMiniPathways(conv.id,controller.signal);
   if(!alive)return;
   const current=[...saved].reverse().find(r=>r.sourceMessageId===sourceId);
   if(current?.status==='complete'){if(validPathwayHint(current.hint))setHint(current.hint);setDecision({action:'offer',reason:'saved',score:null});return;}
   if(current?.status==='error'&&validPathwayHint(current.hint)){
    // A retry for the exact same source already has a saved relevance decision.
    setHint(current.hint);setDecision(decideMiniPathway(response,userText,current.hint,true));
    setError(current.error||'The previous pathway stopped. You can try again.');return;
   }
   if(!await waitForRouter(controller.signal)||!alive)return;
   let selection=await reviewMiniPathway(pathwayQuery(response,userText),{signal:controller.signal});
   if(selection.reason==='busy'&&alive){await new Promise(r=>setTimeout(r,400));selection=await reviewMiniPathway(pathwayQuery(response,userText),{signal:controller.signal});}
   if(!alive||key.current!==requestKey)return;
   const messages=conv.messages.map(m=>({...m,id:m.serverMessageId||m.id}));
   const plan=decideMiniPathway(response,userText,selection,alreadyHelpedInLowEpisode(messages,saved));
   setHint(selection);setDecision(plan);
   if(current?.status==='error')setError(current.error||'The previous pathway stopped. You can try again.');
   if(plan.action==='automatic')await generate('automatic',selection,controller.signal);
  })().catch(e=>{if(alive&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Mini pathway is unavailable.');});
  return()=>{alive=false;controller.abort();};
 },[conv?.id,sourceId,isStreaming]);
 useEffect(()=>{
  if(!open)return;
  const resize=()=>{if(window.innerWidth<1200)setSidebarOpen(false);};resize();
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(expanded)setExpanded(false);else close();}};
  window.addEventListener('keydown',escape);window.addEventListener('resize',resize);
  return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('resize',resize);};
 },[open,expanded]);
 const stale=!!run&&run.sourceMessageId!==sourceId;
 const available=!!decision&&decision.action!=='none';
 const currentSaved=[...history.runs].reverse().find(r=>r.sourceMessageId===sourceId);
 const chooseSaved=(id:string)=>{history.select(id);setError('');};
 const card=available&&target&&!isStreaming?createPortal(<button ref={opener} type="button" className="mini-pathway-offer" disabled={loading} onClick={()=>{if(currentSaved){chooseSaved(currentSaved.id);reveal();}else if(hint)void generate('manual',hint);}}>
  <Map size={21}/><span><strong>{loading?'Preparing your mini pathway…':currentSaved?'Open your mini pathway':'Explore a mini pathway'}</strong><small>See possible routes, trade-offs and a practical next step.</small></span><ArrowRight size={19}/>
 </button>,target):null;
 const savedControl=historyTarget&&(history.runs.length>0||history.error||loading)?createPortal(<button type="button" className="mini-pathway-saved-control" aria-label={`Open saved pathways (${history.runs.length})`} aria-expanded={open} aria-controls="mini-pathway-panel" onClick={()=>{setError('');reveal();}}><Map size={17}/><span>Saved pathways</span><b>{history.runs.length}</b></button>,historyTarget):null;
 return <>{card}{savedControl}{open&&<aside id="mini-pathway-panel" ref={panel} className={`mini-pathway-panel${expanded?' mini-pathway-panel--expanded':''}${drawer.resizing?' mini-pathway-panel--resizing':''}`} style={expanded?undefined:{width:drawer.width}} aria-label="Mini pathway">
  {!expanded&&<div className="mini-pathway-resize-handle" {...drawer.separatorProps}><span aria-hidden="true"/></div>}
  <header><div className="mini-pathway-heading"><span className="mini-pathway-heading-icon" aria-hidden="true"><Map size={23}/></span><div><span className="mini-pathway-kicker">YOUR POSSIBILITIES</span><h2>Mini pathway</h2></div></div><div className="mini-pathway-header-actions">
   <button type="button" className="mini-pathway-expand" aria-label={expanded?'Restore mini pathway to side panel':'Expand mini pathway'} aria-expanded={expanded} aria-controls="mini-pathway-body" title={expanded?'Return to the side panel (Esc)':'Expand across the screen'} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}<span>{expanded?'Collapse':'Expand'}</span></button>
   <button type="button" aria-label="Close mini pathway" onClick={close}><X size={22}/></button>
  </div></header>
  <PathwayHistorySelector runs={history.runs} selectedId={run?.id} messages={conv?.messages||[]} loading={loading} onSelect={chooseSaved}/>
  <div id="mini-pathway-body" className="mini-pathway-body">
   <PathwayColourGuide/>
   {history.error&&<div className="mini-pathway-notice" role="alert"><p>{history.error}</p><button type="button" onClick={history.retry}>Reload saved pathways</button></div>}
   {!loading&&available&&hint&&!isStreaming&&!currentSaved&&history.runs.length>0&&<button type="button" className="mini-pathway-create" onClick={()=>void generate('manual',hint)}>Create a pathway from the latest answer <ArrowRight size={15}/></button>}
   {loading?<MiniPathwayStreaming stage={stage} blocks={draftBlocks} source={acceptedResponse(last?.structuredResponse||last?.content||'')} onStop={()=>{active.current?.abort();setDraftBlocks([]);setLoading(false);setError('Stopped. You can try again when you are ready.');}}/>:
    error?<div role="alert" className="mini-pathway-notice"><p>{error}</p>{hint&&!isStreaming&&<button type="button" onClick={()=>void generate('manual',hint)}>Try again</button>}{run&&<button type="button" onClick={()=>setError('')}>Return to saved pathway</button>}</div>:
    run?.response?<><p className="mini-pathway-caption">{stale?'Saved from an earlier answer. You can keep this open while continuing your conversation.':'Options to explore, not a decision made for you. Continue answering in the main chat.'}</p>{run.version!==MINI_PATHWAY_VERSION&&<div className="mini-pathway-version-note"><p>This saved pathway uses an earlier report format.</p>{hint&&!stale&&!isStreaming&&<button type="button" onClick={()=>void generate('manual',hint)}>Update this pathway</button>}</div>}<div className="mini-pathway-report"><ProtocolV13Renderer data={miniPathwayPanelResponse(run.response)} readOnly hideRecommendedActions pathwayLearningCues/></div><p className="mini-pathway-caption">Generated by Gemini from this conversation. No source lookup was performed; check course details, time estimates and eligibility before relying on them.</p></>:
    <p className="mini-pathway-caption">Continue in the chat. You can open a mini pathway when it is relevant.</p>}
  </div>
 </aside>}</>;
}
