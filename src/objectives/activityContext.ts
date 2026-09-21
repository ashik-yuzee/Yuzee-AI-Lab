/** Model-authored routing hints are advisory. Only exact quotes are retained as user evidence. */
export type ActivityContext={current_goal:string;confirmed_facts:string[];possible_need:string;missing_information:string[];relevant_question:string;user_constraints:string[]};
const text=(v:unknown,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const list=(v:unknown)=>Array.isArray(v)?v.slice(0,4).map(x=>text(x,180)).filter(Boolean):[];
export function readActivityContext(response:any,userMessages:string[]):ActivityContext|null{
 const c=response?.state?.activity_context;if(!c||typeof c!=='object'||Array.isArray(c))return null;
 const facts=list(c.confirmed_facts).filter(q=>userMessages.some(m=>m.includes(q)));
 return {current_goal:text(c.current_goal),confirmed_facts:facts,possible_need:text(c.possible_need),missing_information:list(c.missing_information),relevant_question:text(c.relevant_question),user_constraints:list(c.user_constraints)};
}
export function activitySearchContext(response:any,userMessages:string[]):string{
 const c=readActivityContext(response,userMessages);
 if(!c)return userMessages.slice(-3,-1).join('\n').slice(-2400); // No assistant prose in fallback.
 // Future-help hypotheses and Gemini's next question can redirect retrieval away from the current request.
 const referenceContext=(userMessages.at(-1)||'').length<80?userMessages.slice(-3,-1).join('\n').slice(-1200):'';
 return [c.current_goal,c.confirmed_facts.join('. '),referenceContext].filter(Boolean).join('\n').slice(0,2400);
}
