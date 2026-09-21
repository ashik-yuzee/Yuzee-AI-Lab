import React,{useEffect,useState} from 'react';
import {Sparkles,ArrowRight} from 'lucide-react';
import {onRouterStatus,startWarmup,retrieveObjectives} from '../services/MicroToolRouter';
import {objectiveSelectionBoundary,fuseObjectiveMatches} from './routing';
import {objectiveApi,useObjectives} from './ObjectiveContext';
export function ObjectiveToolbar(){const o=useObjectives();return <div className="objective-toolbar"><label><input type="checkbox" checked={o.enabled} onChange={e=>o.setEnabled(e.target.checked)}/> 316 activities <span>Test mode</span></label>{o.enabled&&<><button disabled={!o.conversationId} onClick={o.browse}>Browse (testing)</button>{o.sessions.length>0&&<button onClick={()=>{o.setCatalogueOpen(false);o.reveal();}}>Saved activities ({o.sessions.length})</button>}</>}</div>;}
export function ObjectiveSuggestions({sourceMessageId,userText,reviewText}:{sourceMessageId:string;userText:string;reviewText:string}){
 const {enabled,conversationId,catalogue,start,busy,sessions}=useObjectives();
 const [offer,setOffer]=useState<any>(null),[status,setStatus]=useState('');
 useEffect(()=>{
  setOffer(null);setStatus('');if(!enabled||!conversationId||objectiveSelectionBoundary(userText))return;
  const abort=new AbortController();let begun=false;
  setStatus('Checking whether an activity could help…');
  const timer=setTimeout(()=>{abort.abort();setStatus('Suggestions are unavailable. You can browse activities.');},125000);
  const unsubscribe=onRouterStatus(state=>{
   if(state==='unavailable'){clearTimeout(timer);setStatus('Suggestions are unavailable. You can browse activities.');}
   if(state!=='ready'||begun||abort.signal.aborted)return;begun=true;
   (async()=>{
    const [userCandidates,contextCandidates]=await Promise.all([retrieveObjectives(userText,abort.signal),reviewText.trim()?retrieveObjectives(reviewText,abort.signal):Promise.resolve([])]);
    const candidates=fuseObjectiveMatches(userCandidates,contextCandidates,20,userText);
    if(abort.signal.aborted)return;
    if(!candidates.length){setStatus('');return;}
    const decision=await objectiveApi(conversationId,'select',{sourceMessageId,candidates},abort.signal);
    if(!abort.signal.aborted){setStatus('');if(decision.disposition==='AUTO_OPEN'){setOffer(null);await start(decision.objective_id,undefined,decision);}else setOffer(decision.decision==='SUGGEST'&&decision.disposition!=='NONE'?decision:null);}
   })().catch(()=>{if(!abort.signal.aborted)setStatus('Suggestions are unavailable. You can browse activities.');}).finally(()=>clearTimeout(timer));
  });startWarmup();
  return()=>{clearTimeout(timer);abort.abort();unsubscribe();};
 },[enabled,conversationId,sourceMessageId,userText,reviewText]);
 if(!enabled||sessions.some(s=>s.sourceMessageId===sourceMessageId))return null;
 const item=catalogue.find(x=>x.tool_id===offer?.objective_id);
 return item?<div className="objective-offer"><Sparkles size={20}/><div><small>Explore this further</small><button disabled={busy} onClick={()=>start(item.tool_id)}>{item.button_label}<ArrowRight size={18}/></button><p>{offer.reason}</p></div><button className="objective-dismiss" aria-label="Dismiss activity suggestion" onClick={()=>{setOffer(null);void objectiveApi(conversationId!,'dismiss',{sourceMessageId}).catch(()=>{});}}>×</button></div>:status?<p className="objective-status" role="status">{status}</p>:null;
}
