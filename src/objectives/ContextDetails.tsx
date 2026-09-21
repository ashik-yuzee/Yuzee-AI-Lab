import {answerText} from './history';
import React,{useState} from 'react';
import type {ObjectiveSession} from './contract';
export function ContextDetails({session,onCorrect,onRetry,disabled}:{session:ObjectiveSession;onCorrect:(text:string)=>unknown;onRetry:()=>unknown;disabled:boolean}){
 const [editing,setEditing]=useState(false),[text,setText]=useState('');
 const contributions=session.context.shared_context?.contributions||[];
 const details=contributions.length?contributions.filter((e:any)=>e.kind!=='USER_CORRECTION').map((e:any)=>`${e.question?e.question+' — ':''}${answerText(e.value)}${e.truncated?' …':''}`):[...new Set<string>((session.plan?.ui||[]).flatMap((c:any)=>c.content||[]).filter((n:any)=>n.source_status==='USER_CONFIRMED').map((n:any)=>n.detail).filter(Boolean))];
 const corrections=session.context.user_corrections||[];
 if(!details.length&&!corrections.length&&!session.pendingCorrection)return null;
 return <details className="objective-known-details" open={session.pendingCorrection?true:undefined}>
  <summary>Details I’m using · Edit</summary>
  {details.length>0&&<ul>{details.map((detail,i)=><li key={i}>{detail}</li>)}</ul>}
  {corrections.length>0&&<><p>Your corrections</p><ul>{corrections.map((c:any,i:number)=><li key={i}>{c.text}</li>)}</ul></>}
  {session.pendingCorrection?<div role="status"><p>Your correction is saved. The result has not been updated yet.</p><p>{session.pendingCorrection.text}</p><button disabled={disabled} onClick={()=>onRetry()}>Retry updating result</button></div>:editing?<form onSubmit={e=>{e.preventDefault();if(text.trim())onCorrect(text.trim());}}>
   <label className="objective-text-answer">What should I change?<textarea autoFocus rows={3} required maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="For example: I’m considering Mathematical Methods, not General Mathematics."/></label>
   <div className="objective-actions"><button className="objective-primary" disabled={disabled||!text.trim()} type="submit">Save correction</button><button type="button" disabled={disabled} onClick={()=>setEditing(false)}>Cancel</button></div>
  </form>:<button disabled={disabled} onClick={()=>setEditing(true)}>Edit details</button>}
  <p className="objective-muted">Corrections are saved with this conversation and used when relevant. Your earlier answers remain in its history.</p>
 </details>;
}
