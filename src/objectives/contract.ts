export type ObjectiveAnswer={component_id:string;value:unknown;unsure?:boolean};
export type ObjectiveSession={id:string;conversationId:string;objectiveId:string;label:string;sourceMessageId:string;revision:number;interactionCount:number;state:'ACTIVE'|'COMPLETE'|'CANCELLED';createdAt:number;updatedAt:number;plan:any;context:any;answers?:import('./history').AnswerReceipt[];pendingAnswer?:import('./history').AnswerReceipt;pendingCorrection?:{text:string;createdAt:number;explorationChoices?:import('../warehouse/types').ExplorationChoice};activation?:'manual'|'automatic';routing?:any;autoHandoff?:boolean;handoffAt?:number;handoffMessageId?:string};
const equalKeys=(a:string[],b:string[])=>a.length===b.length&&a.every(x=>b.includes(x));
export function validateObjectiveAnswer(plan:any,answer:ObjectiveAnswer){
 const c=plan.ui.find((x:any)=>x.required&&x.component!=='action_handoff');
 if(!c||!answer||answer.component_id!==c.id)throw Error('This question has changed. Reload the workspace.');
 if(Object.keys(answer).some(k=>!['component_id','value','unsure'].includes(k)))throw Error('Unexpected answer fields.');
 if(answer.unsure===true){if(!c.settings.allow_unsure)throw Error('Please answer the current question.');return {component_id:c.id,value:null,unsure:true};}
 const v=answer.value,ids=c.options.map((x:any)=>x.id);
 if(['single_choice','yes_no_unsure'].includes(c.component)){
  if(typeof v!=='string'||!ids.includes(v))throw Error('Choose one of the available options.');
 }else if(c.component==='multi_select'||c.component==='ranking'){
  if(!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='string'||!ids.includes(x))||new Set(v).size!==v.length)throw Error('Choose valid options.');
  if(c.component==='ranking'&&!equalKeys(v,ids))throw Error('Rank every option once.');
 }else if(c.component==='spectrum'){
  if(typeof v!=='number'||!Number.isFinite(v)||v<c.settings.min||v>c.settings.max)throw Error('Choose a value within the range.');
 }else if(c.component==='card_sort'){
  if(!v||typeof v!=='object'||Array.isArray(v)||!equalKeys(Object.keys(v),ids)||Object.values(v).some(x=>!c.settings.buckets.includes(x)))throw Error('Place each card into a group.');
 }else if(typeof v!=='string'||!v.trim()||v.length>4000)throw Error('Add an answer of up to 4,000 characters.');
 return {component_id:c.id,value:v};
}
export function answerFact(plan:any,answer:ObjectiveAnswer){
 const c=plan.ui.find((x:any)=>x.id===answer.component_id);
 const label=(v:unknown)=>typeof v==='string'?(c.options.find((o:any)=>o.id===v)?.label||v):v;
 return JSON.stringify({question:c.prompt||c.purpose,answer:answer.unsure?'Not sure':Array.isArray(answer.value)?answer.value.map(label):label(answer.value)});
}
