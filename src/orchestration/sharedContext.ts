import {createHash} from 'node:crypto';
import type {ObjectiveSession} from '../objectives/contract';
import {answerHistory} from '../objectives/history';

type Conversation={id:string;messages:Array<{id:string;role:string;content:string;createdAt?:number|string;structuredResponse?:any;objectiveTransfer?:unknown}>};
export interface UserContribution {
 id:string; kind:'CHAT_STATEMENT'|'WORKSPACE_ANSWER'|'USER_CORRECTION'; source_id:string;
 scope:'CONVERSATION_ONLY'; evidence_status:'USER_REPORTED'; question:string|null;
 value:unknown; at:number|string|null; processing:'SAVED'|'RESULT_PENDING';
}
const terms=(text:string)=>new Set(text.toLowerCase().match(/[a-z]{4,}/g)||[]);
const overlap=(a:Set<string>,b:string)=>[...terms(b)].filter(w=>a.has(w)).length;

/** A versioned read model of durable conversation/workspace records, not a second fact database.
 * No model inference is promoted to a confirmed fact. Full records stay at their source.
 */
export function sharedConversationContext(conv:Conversation,sessions:ObjectiveSession[]=[],query?:string) {
 const events:UserContribution[]=[];
 let question:string|null=null;
 for(const m of conv.messages){
  if(m.role==='assistant'){
   let p=m.structuredResponse;try{p??=JSON.parse(m.content);}catch{}
   question=p?.interaction?.kind==='question'?p.interaction.question:null;
  }else if(m.role==='user'&&!m.objectiveTransfer){
   events.push({id:'chat:'+m.id,kind:'CHAT_STATEMENT',source_id:m.id,scope:'CONVERSATION_ONLY',evidence_status:'USER_REPORTED',question,value:m.content,at:m.createdAt??null,processing:'SAVED'});
   question=null;
  }
 }
 for(const s of sessions.filter(s=>s.conversationId===conv.id)){
  for(const r of [...answerHistory(s),...(s.pendingAnswer?[s.pendingAnswer]:[])]){
   events.push({id:`workspace:${s.id}:${r.id}`,kind:'WORKSPACE_ANSWER',source_id:s.id,scope:'CONVERSATION_ONLY',evidence_status:'USER_REPORTED',question:r.question,value:r.answer,at:r.submittedAt??null,processing:r===s.pendingAnswer?'RESULT_PENDING':'SAVED'});
  }
  for(const [i,r] of [...(s.context.user_corrections||[]),...(s.pendingCorrection?[s.pendingCorrection]:[])].entries()){
   events.push({id:`correction:${s.id}:${i}`,kind:'USER_CORRECTION',source_id:s.id,scope:'CONVERSATION_ONLY',evidence_status:'USER_REPORTED',question:null,value:r.text,at:r.createdAt??null,processing:r===s.pendingCorrection?'RESULT_PENDING':'SAVED'});
  }
 }
 const current=query??[...conv.messages].reverse().find(m=>m.role==='user'&&!m.objectiveTransfer)?.content??'';
 const vocabulary=terms(current);
 // Preserve latest chat turns, relevant older answers and corrections. This is a bounded
 // recall baseline; it deliberately makes no claim to be semantic long-term memory.
 const newestChat=events.filter(e=>e.kind==='CHAT_STATEMENT').slice(-4).map(e=>e.id);
 const ranked=events.map((e,index)=>({e,index,score:(newestChat.includes(e.id)?100:0)+(e.kind==='USER_CORRECTION'?90:0)+overlap(vocabulary,JSON.stringify([e.question,e.value]))*3+(e.kind==='WORKSPACE_ANSWER'?5:0)+index/Math.max(events.length,1)})).sort((a,b)=>b.score-a.score).slice(0,16);
 const selected=ranked.sort((a,b)=>{
  const left=a.e.at?new Date(a.e.at).getTime():NaN,right=b.e.at?new Date(b.e.at).getTime():NaN;
  return Number.isFinite(left)&&Number.isFinite(right)?left-right:a.index-b.index;
 }).map(({e})=>{
  const raw=typeof e.value==='string'?e.value:JSON.stringify(e.value);
  return {...e,value:raw.length>1600?raw.slice(0,1600):e.value,truncated:raw.length>1600};
 });
 return {version:'1.0',revision:createHash('sha256').update(JSON.stringify(events)).digest('hex').slice(0,16),conversation_id:conv.id,
  save_scope:'CONVERSATION_ONLY',contributions:selected,total_contributions:events.length,
  context_limited:selected.length<events.length||selected.some(e=>e.truncated),
  evidence_notice:'User statements are self-reported, not verified. Corrections are scoped to their source and topic; newer explicit corrections take precedence. Absent details remain unknown.'};
}

/** Keep legacy objective evidence references working without making model summaries facts. */
export function objectiveRecallText(snapshot:ReturnType<typeof sharedConversationContext>,latestUserId?:string) {
 return snapshot.contributions.filter(e=>e.id!=='chat:'+latestUserId).map(e=>JSON.stringify(e)).join('\n');
}
