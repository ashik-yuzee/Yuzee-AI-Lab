import {setVisibleWorkspace} from '../orchestration/workspacePresence';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {useTokenLab} from '../context/TokenLabContext';
import type {ObjectiveAnswer,ObjectiveSession} from './contract';
import {objectiveCatalogue} from './routing';
import {answerReceipt} from './history';
import {workspaceResultMessage} from './workspacePolicy';
export async function objectiveApi(conversationId:string,operation:string,body?:any,signal?:AbortSignal){
 const response=await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/objectives${operation?'/'+operation:''}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('yuzee_auth')||''}`},body:body?JSON.stringify(body):undefined,signal});
 const data=await response.json();if(!response.ok)throw Error(data.error||'The workspace could not be loaded.');return data;
}
const draftKey=(conv:string,id:string)=>`yuzee-workspace-draft:${conv}:${id}`;
function restoreDrafts(conv:string,items:ObjectiveSession[]):ObjectiveSession[]{
 return items.map(s=>{const key=draftKey(conv,s.id);try{const draft=JSON.parse(sessionStorage.getItem(key)||'null');if(!draft)return s;if(s.pendingAnswer||s.revision>draft.revision||s.state!=='ACTIVE'){sessionStorage.removeItem(key);return s;}return {...s,pendingAnswer:{...draft.receipt,localOnly:true}};}catch{return s;}});
}
const Context=createContext<any>(null);
export const useObjectives=()=>useContext(Context) as ReturnType<typeof useObjectiveState>;
function useObjectiveState(){
 const {currentConversation:conv,setSidebarOpen,setWhiteboardOpen,setTokenInspectorOpen,isWhiteboardOpen,isTokenInspectorOpen,sendMessage,isStreaming}=useTokenLab();
 const [enabled,setEnabledState]=useState(()=>localStorage.getItem('yuzee-objective-preview')==='true');
 const [open,setOpen]=useState(false),[sessions,setSessions]=useState<ObjectiveSession[]>([]),[selectedId,setSelectedId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[catalogueOpen,setCatalogueOpen]=useState(false);
 const [transferring,setTransferring]=useState(''),[transferErrors,setTransferErrors]=useState<Record<string,string>>({});
 const transferLock=useRef(false);
 const active=useRef<AbortController|null>(null),conversation=useRef(conv?.id),current=useRef(conv);conversation.current=conv?.id;current.current=conv;
 const selected=sessions.find(s=>s.id===selectedId);
 useEffect(()=>{
  setVisibleWorkspace(enabled&&open&&selected&&conv?.id?{conversationId:conv.id,sessionId:selected.id}:null);
  return()=>setVisibleWorkspace(null);
 },[enabled,open,selected?.id,conv?.id]);
 const put=(session:ObjectiveSession)=>setSessions(prev=>[session,...prev.filter(s=>s.id!==session.id)]);
 const setEnabled=(value:boolean)=>{localStorage.setItem('yuzee-objective-preview',String(value));setEnabledState(value);if(!value){active.current?.abort();setBusy(false);setOpen(false);}};
 const reveal=()=>{setSidebarOpen(false);setWhiteboardOpen(false);setTokenInspectorOpen(false);setOpen(true);};
 const showSession=(id:string)=>{setSelectedId(id);setCatalogueOpen(false);reveal();};
 useEffect(()=>{if(isWhiteboardOpen||isTokenInspectorOpen)setOpen(false);},[isWhiteboardOpen,isTokenInspectorOpen]);
 useEffect(()=>{
  setSessions([]);setSelectedId('');setOpen(false);setError('');setBusy(false);setTransferErrors({});active.current?.abort();active.current=null;
  if(!conv||!enabled)return;
  const abort=new AbortController();objectiveApi(conv.id,'',undefined,abort.signal).then(data=>{if(!abort.signal.aborted){setSessions(restoreDrafts(conv.id,data));setSelectedId(data[0]?.id||'');}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
  return()=>{abort.abort();active.current?.abort();};
 },[conv?.id,enabled]);
 const run=async(operation:string,body:any)=>{
  if(!conv||active.current)return;
  const id=conv.id,controller=new AbortController();active.current=controller;setBusy(true);setError('');reveal();
  if(operation==='answer'&&body.answer&&selected){const receipt=answerReceipt(selected.plan,body.answer);sessionStorage.setItem(draftKey(id,selected.id),JSON.stringify({revision:selected.revision,receipt}));put({...selected,pendingAnswer:{...receipt,localOnly:true}});}
  try{const session=await objectiveApi(id,operation,body,controller.signal);if(!controller.signal.aborted&&conversation.current===id){put(session);setSelectedId(session.id);setCatalogueOpen(false);}}
  catch(e){if(!controller.signal.aborted&&conversation.current===id)setError(e instanceof Error?e.message:'Please try again.');}
  finally{if(active.current===controller){active.current=null;setBusy(false);}if(conversation.current===id){try{const saved=await objectiveApi(id,'');if(conversation.current===id)setSessions(restoreDrafts(id,saved));}catch{}}}
 };
 const start=(objectiveId:string,goal?:string,selection?:any)=>run('start',{objectiveId,goal,...(selection?{activation:'automatic',selectionId:selection.selectionId,sourceMessageId:selection.sourceMessageId}:{})});
 const answer=(value:ObjectiveAnswer)=>selected&&run('answer',{sessionId:selected.id,revision:selected.revision,answer:value});
 const retry=()=>selected&&run('answer',{sessionId:selected.id,revision:selected.revision,...(selected.pendingAnswer?.localOnly?{answer:selected.pendingAnswer.input}:{retry:true})});
 const correct=(correction:string)=>selected&&run('correct',{sessionId:selected.id,revision:selected.revision,correction});
 const saveExploration=(explorationChoices:import('../warehouse/types').ExplorationChoice)=>selected&&run('correct',{sessionId:selected.id,revision:selected.revision,explorationChoices});
 const focusCourses=(courseIds:string[])=>selected&&run('course-focus',{sessionId:selected.id,revision:selected.revision,courseIds});
 const retryCorrection=()=>selected&&run('correct',{sessionId:selected.id,revision:selected.revision,retry:true});
 const cancel=()=>selected&&run('answer',{sessionId:selected.id,revision:selected.revision,cancel:true});
 const stop=()=>{active.current?.abort();active.current=null;setBusy(false);setError('Stopped. Submitted answers stay saved; you can retry when ready.');};
 const useResult=async(session:ObjectiveSession|undefined=selected)=>{
  if(!session||session.handoffAt||isStreaming||busy||transferLock.current||conversation.current!==session.conversationId)return;
  const id=session.conversationId;transferLock.current=true;setTransferring(session.id);setTransferErrors(prev=>({...prev,[session.id]:''}));
  try{
   const accepted=await sendMessage({message:workspaceResultMessage(session),userQuestionAnswers:[],objectiveResultId:session.id,objectiveResultRevision:session.revision,objectiveTransfer:{sessionId:session.id,label:session.label,revision:session.revision}});
   if(conversation.current===id){if(accepted){const saved=await objectiveApi(id,'');if(conversation.current===id)setSessions(restoreDrafts(id,saved));}else setTransferErrors(prev=>({...prev,[session.id]:'Oala could not finish the reply. Your result is saved.'}));}
  }catch{if(conversation.current===id)setTransferErrors(prev=>({...prev,[session.id]:'Your result is saved. Retry sending it to Oala.'}));}
  finally{transferLock.current=false;setTransferring('');}
 };
 const browse=()=>{setCatalogueOpen(true);reveal();};
 return {enabled,setEnabled,open,setOpen,sessions,selectedId,setSelectedId,selected,busy,error,setError,catalogueOpen,setCatalogueOpen,start,answer,retry,correct,saveExploration,focusCourses,retryCorrection,cancel,stop,useResult,browse,reveal,showSession,transferring,transferErrors,conversationId:conv?.id,isStreaming,catalogue:objectiveCatalogue};
}
export function ObjectiveProvider({children}:{children:React.ReactNode}){const value=useObjectiveState();return <Context.Provider value={value}>{children}</Context.Provider>;}
