import React,{useEffect,useState} from 'react';
import {startWarmup,onRouterStatus,reviewResponseSkills} from '../services/MicroToolRouter';
import {skillMessage,allowSkillReview,type SkillChoice,type SkillReview} from '../routing/skillSuggestions';
import {Sparkles,ArrowRight} from 'lucide-react';
export function SkillSuggestions({sourceMessageId,reviewText,userText,completedToolId,onChoose}:{sourceMessageId:string;reviewText:string;userText:string;completedToolId?:string;onChoose:(message:string,choice:SkillChoice)=>Promise<boolean>}){
 const [review,setReview]=useState<SkillReview|null>(null);
 const [busy,setBusy]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let started=false;
  setReview(null);
  if(!allowSkillReview(userText))return;
  const unsubscribe=onRouterStatus(status=>{
   if(status==='unavailable')setReview({status:'abstained',offers:[],reason:'unavailable'});
   if(status==='ready'&&!started){
    started=true;
    (async()=>{
     let result=await reviewResponseSkills(reviewText,{signal:controller.signal});
     if(result.reason==='busy'&&!controller.signal.aborted){await new Promise(r=>setTimeout(r,500));result=await reviewResponseSkills(reviewText,{signal:controller.signal});}
     if(!controller.signal.aborted){const offers=result.offers.filter(o=>o.toolId!==completedToolId);setReview(offers.length?{...result,offers}:{...result,status:'abstained',offers});}
    })().catch(()=>{if(!controller.signal.aborted)setReview({status:'abstained',offers:[],reason:'unavailable'});});
   }
  });
  startWarmup();
  return ()=>{controller.abort();unsubscribe();};
 },[sourceMessageId,reviewText,userText,completedToolId,retry]);
 if(!allowSkillReview(userText))return null;
 if(review?.status==='abstained')return ['unavailable','not-ready','timeout','busy','inference-failed'].includes(review.reason)?
  <div className="mt-4 text-sm text-slate-500" role="status" data-skill-review-status={review.reason}>Extra guidance is temporarily unavailable. <button type="button" className="underline text-violet-700" onClick={()=>setRetry(n=>n+1)}>Retry suggestions</button></div>:
  <span hidden data-skill-review-status={review.reason}/>;
 return <section aria-label="Suggested guidance" data-skill-review-status={review?.reason||'loading'} className="mt-4 w-full"><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
  <div className="flex items-center gap-2 text-violet-800 font-semibold"><Sparkles size={18}/><h2>Explore this further</h2></div>
  {!review?<p role="status" className="mt-2 text-sm text-slate-600">Finding relevant ways to help…</p>:<>
   <p className="mt-1 mb-3 text-sm text-slate-600">Choose a topic for a closer look at what it means for you.</p>
   <div className={`grid grid-cols-1 ${review.offers.length>1?'sm:grid-cols-2':''} gap-2`}>
    {review.offers.map(offer=><button type="button" key={offer.toolId} disabled={busy} onClick={async()=>{setBusy(true);try{await onChoose(skillMessage(offer.toolId),{toolId:offer.toolId,sourceMessageId});}finally{setBusy(false);}}} className="text-left rounded-xl border border-violet-200 bg-white p-4 hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 disabled:opacity-50">
     <span className="flex justify-between gap-3 font-semibold text-violet-800">{offer.label}<ArrowRight size={18} className="shrink-0"/></span>
     <span className="block mt-1 text-sm leading-relaxed text-slate-600">{offer.description}</span>
    </button>)}
   </div>
  </>}
 </div></section>;
}
