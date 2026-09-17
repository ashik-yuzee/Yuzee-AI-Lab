import {useEffect,useRef,useState} from 'react';
import {listMiniPathways} from './client';
import {completedPathways,selectSavedPathway} from './history';
import type {MiniPathwayRun} from './service';

const storageKey=(conversationId:string)=>`yuzee-pathway-selection:${conversationId}`;
export function usePathwayHistory(conversationId:string|undefined,onRestore:()=>void){
 const [state,setState]=useState<{owner:string;runs:MiniPathwayRun[];selectedId:string|null}>({owner:'',runs:[],selectedId:null});
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const restore=useRef(onRestore);restore.current=onRestore;
 const current=useRef(conversationId);current.current=conversationId;
 const persist=(id:string)=>{if(conversationId)try{localStorage.setItem(storageKey(conversationId),id);}catch{/* Selection still works for this visit. */}};
 useEffect(()=>{
  const controller=new AbortController();setError('');
  if(!conversationId)return;
  setState({owner:conversationId,runs:[],selectedId:null});
  listMiniPathways(conversationId,controller.signal).then(saved=>{
   if(controller.signal.aborted||current.current!==conversationId)return;
   const runs=completedPathways(saved,conversationId);
   let preferred:string|null=null;try{preferred=localStorage.getItem(storageKey(conversationId));}catch{}
   const selected=selectSavedPathway(runs,preferred);
   // A newly completed run or explicit selection wins over this initial read.
   setState(previous=>previous.owner===conversationId&&previous.runs.length?{
    ...previous,runs:completedPathways([...runs,...previous.runs],conversationId),
   }:{owner:conversationId,runs,selectedId:selected?.id||null});
   if(runs.length)restore.current();
  }).catch(e=>{if(!controller.signal.aborted&&current.current===conversationId)setError('Saved pathways could not be loaded.');});
  return()=>controller.abort();
 },[conversationId,retry]);
 const runs=state.owner===conversationId?state.runs:[];
 const selected=selectSavedPathway(runs,state.selectedId);
 const select=(id:string)=>{if(!runs.some(r=>r.id===id))return;persist(id);setState(previous=>({...previous,selectedId:id}));};
 const remember=(run:MiniPathwayRun)=>{
  if(!conversationId||run.conversationId!==conversationId||current.current!==conversationId)return;
  persist(run.id);
  setState(previous=>({owner:conversationId,runs:completedPathways([...(previous.owner===conversationId?previous.runs:[]),run],conversationId),selectedId:run.id}));
 };
 return {runs,selected,select,remember,error,retry:()=>setRetry(n=>n+1)};
}
