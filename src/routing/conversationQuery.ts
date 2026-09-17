export type RoutingHistory=readonly {role:string;content:string}[];
// Only explicit user subjects can resolve a reference. Assistant prose is never copied as fact.
const reset=/\b(?:new topic|different topic|forget that|instead|not that course|cancel|stop)\b/i;
const subject=/\b(?:Bachelor|Master|Diploma|Certificate|Graduate Certificate|Graduate Diploma)\b[^\n.!?;]{2,180}/gi;
export function resolveShortQuery(request:string,history:RoutingHistory):string|null {
 const s=request.trim();
 if(s.length>160||s.split(/\s+/).length>12||!history.length)return null;
 const intent=/^(?:what about (?:the )?costs?|(?:course )?(?:costs?|fees)|how much)[?.!\s]*$/i.test(s)?'Explain course tuition, funding and additional costs':
  /^(?:what jobs|what about jobs)[?.!\s]*$/i.test(s)?'Explain career outcomes and jobs after this course':
  /^(?:quality|course quality)[?.!\s]*$/i.test(s)?'Explain how to evaluate this course and provider quality':
  /^(?:compare (?:them|these|those)|compare (?:the )?two)[?.!\s]*$/i.test(s)?'Compare these two courses for the user':
  /^(?:does (?:that|this) qualify me)[?.!\s]*$/i.test(s)?'Explain eligibility and qualification requirements; identify missing evidence':
  /^(?:go deeper|tell me more|more details|explain (?:it|that|this)|why)[?.!\s]*$/i.test(s)?'Explain the current course topic in more detail, with examples':null;
 if(!intent)return null;
 const turns=history.filter(m=>m.role==='user').slice(-3).reverse();
 for(const turn of turns){
  const content=turn.content.replace(/^@oala\s*/i,'').trim();
  if(reset.test(content))return null;
  if(content.length>700)return null; // Do not truncate away a correction in a long turn.
  const matches=[...content.matchAll(subject)].map(m=>m[0].trim());
  if(!matches.length){if(content.split(/\s+/).length>=4)return null;continue;}
  // Each qualification marker counts as an object, even if joined by "and".
  const count=(content.match(/\b(?:Bachelor|Master|Diploma|Certificate)\b/gi)||[]).length;
  const comparing=intent.startsWith('Compare');
  if((comparing&&count!==2)||(!comparing&&count!==1))return null;
  return `${intent}.\nUser's request: ${s}\nUser-provided subject and constraints: ${content}`;
 }
 return null;
}
