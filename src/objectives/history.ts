import type {ObjectiveSession,ObjectiveAnswer} from './contract';
import {answerFact} from './contract';
export type AnswerReceipt={id:string;question:string;answer:unknown;submittedAt?:number;component?:any;input?:ObjectiveAnswer;localOnly?:boolean};
export function answerReceipt(plan:any,input:ObjectiveAnswer):AnswerReceipt{
 const fact=JSON.parse(answerFact(plan,input));
 return {id:input.component_id+'-'+Date.now(),...fact,submittedAt:Date.now(),component:plan.ui.find((c:any)=>c.id===input.component_id),input};
}
export function answerHistory(session:ObjectiveSession):AnswerReceipt[]{
 if(session.answers)return session.answers;
 // Older workspaces retained exact question/answer facts but no submission time.
 return Object.entries(session.context?.confirmed_facts||{}).filter(([k])=>/^answer_\d+$/.test(k)).map(([id,value])=>{try{return {id,...JSON.parse(String(value))};}catch{return {id,question:'Your earlier answer',answer:value};}});
}
export function answerText(value:unknown):string{
 if(Array.isArray(value))return value.map(answerText).join(' · ');
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${answerText(v)}`).join('\n');
 return value==null?'Not sure':String(value);
}
