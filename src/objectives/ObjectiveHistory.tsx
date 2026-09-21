import {activityTitle} from './WorkspaceResult';
import React from 'react';
import {CheckCircle2,BookOpen,ArrowUpRight} from 'lucide-react';
import {answerHistory,answerText,type AnswerReceipt} from './history';
import type {ObjectiveSession} from './contract';
import {useObjectives} from './ObjectiveContext';
export function EnteredAnswer({entry,pending=false}:{entry:AnswerReceipt;pending?:boolean}){
 return <details className="objective-entered"><summary><CheckCircle2 size={17}/><span>{entry.question}</span><small>{pending?(entry.localOnly?'Entered · on this device':'Entered · saved'):'Entered'}</small></summary><div className="objective-answer-value">{answerText(entry.answer)}</div>{entry.submittedAt&&<time dateTime={new Date(entry.submittedAt).toISOString()}>{new Date(entry.submittedAt).toLocaleString()}</time>}</details>;
}
export function AnswerHistory({session}:{session:ObjectiveSession}){
 const answers=answerHistory(session);if(!answers.length&&!session.pendingAnswer)return null;
 return <section className="objective-answer-history" aria-label="Saved answers"><h3>Your answers</h3>{answers.map(a=><EnteredAnswer key={a.id} entry={a}/>)}{session.pendingAnswer&&<EnteredAnswer entry={session.pendingAnswer} pending/>}</section>;
}
export function ObjectiveHistory({sourceMessageId}:{sourceMessageId:string}){
 const o=useObjectives();const sessions=o.sessions.filter(s=>s.sourceMessageId===sourceMessageId);if(!o.enabled||!sessions.length)return null;
 return <div className="objective-chat-history">{sessions.map(s=><section key={s.id} className="objective-chat-receipt"><div><BookOpen size={19}/><strong>{activityTitle(s)}</strong><span>{s.state==='COMPLETE'?'Complete':s.state==='CANCELLED'?'Closed':'In progress'}</span></div><AnswerHistory session={s}/><button onClick={()=>o.showSession(s.id)}>View saved activity <ArrowUpRight size={16}/></button></section>)}</div>;
}
