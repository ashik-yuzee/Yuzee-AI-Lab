/** Offline candidate. Deliberately NOT imported by the live v2 router. */
import {routingSkipReason} from '../../src/routing/policy';
export type EntityType='COURSE'|'JOB'|'CAREER'|'SKILL'|'COMPANY'|'INSTITUTION'|'INDUSTRY'|'PATHWAY'|'QUALIFICATION';
type Turn={role:string;content:string};
type Entity={type:EntityType;label:string;evidence:string;userTurnIndex:number};
const namedCompanies=['Deloitte','Australia Post','Woolworths','Telstra'];
const intentPatterns:[RegExp,string][]=[
 [/^(?:what )?skills (?:do i need|are needed|required)[?.!\s]*$/i,'required skills'],
 [/^what roles (?:do they hire|are available)[?.!\s]*$/i,'available roles'],
 [/^what jobs (?:use it|can i get|does it lead to)[?.!\s]*$/i,'related jobs'],
 [/^(?:what about (?:the )?costs?|how much|fees)[?.!\s]*$/i,'costs and funding'],
 [/^what courses (?:do they offer|are available)[?.!\s]*$/i,'available courses'],
 [/^what (?:are the )?levels[?.!\s]*$/i,'levels and progression'],
 [/^what (?:is the )?next step[?.!\s]*$/i,'next steps'],
 [/^(?:go deeper|tell me more|more details|quality)[?.!\s]*$/i,'explanation with examples and limitations'],
 [/^compare (?:them|these|those|the two)[?.!\s]*$/i,'comparison'],
];
function entities(text:string,userTurnIndex:number):Entity[]{
 const out:Entity[]=[];
 const add=(type:EntityType,label:string)=>out.push({type,label:label.trim(),evidence:text,userTurnIndex});
 if(text.length>700||/\b(?:and|or|versus|vs)\b|[,;]/i.test(text))return []; // Multi-object free text needs structured selection.
 if(/\b(?:Bachelor|Master|Diploma|Certificate)\b/i.test(text))add('QUALIFICATION',text);
 else if(/\b(?:course|unit|subject)\b/i.test(text))add('COURSE',text);
 else if(/\bpathway\b|\broute from\b/i.test(text))add('PATHWAY',text);
 else if(/\b(?:University|TAFE|College|Institute|Polytechnic)\b/i.test(text))add('INSTITUTION',text);
 else if(/\bindustry\b|\bsector\b/i.test(text))add('INDUSTRY',text);
 else if(/\bcareer (?:in|as)\b|\bcareer\s*[.!?]*$/i.test(text))add('CAREER',text);
 else if(/\b(?:role|roles|job|vacancy)\b/i.test(text))add('JOB',text);
 else if(/^(?:i (?:want to|would like to|am trying to) learn|tell me about (?:the )?skill)\s+/i.test(text))add('SKILL',text);
 else if(/\bcompany\b|\bemployer\b/i.test(text)||namedCompanies.some(n=>new RegExp('\\b'+n+'\\b','i').test(text)))add('COMPANY',text);
 return out;
}
export function resolveCandidate(request:string,history:readonly Turn[]){
 const rawGuard=routingSkipReason(request);
 if(rawGuard&&rawGuard!=='needs-context')return {status:'abstained',reason:rawGuard} as const;
 const task=intentPatterns.find(([p])=>p.test(request.trim()))?.[1];
 if(!task)return {status:'abstained',reason:'unresolved-follow-up'} as const;
 if(task==='comparison')return {status:'abstained',reason:'multiple-objects-require-explicit-selection'} as const;
 const recent=history.map((m,i)=>({...m,i})).filter(m=>m.role==='user').slice(-3).reverse();
 for(const turn of recent){
  const s=turn.content.replace(/^@oala\s*/i,'').trim();
  if(/\b(?:actually|instead|new topic|different topic|forget|cancel|stop|not interested|do not|don't)\b/i.test(s))return {status:'abstained',reason:'context-reset-or-negation'} as const;
  const es=entities(s,turn.i);
  if(es.length===1){const entity=es[0];return {status:'resolved',entity,task,query:`Explain ${task} for the user's ${entity.type.toLowerCase()}.\nUser-provided context: ${entity.evidence}\nCurrent request: ${request}`} as const;}
  // Do not skip a substantive unknown subject to resurrect an older subject.
  if(s.split(/\s+/).length>=4)return {status:'abstained',reason:'unknown-or-multiple-subjects'} as const;
 }
 return {status:'abstained',reason:'no-user-subject'} as const;
}
