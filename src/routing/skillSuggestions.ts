import {DEFAULT_ROUTER_MODEL} from './models';
import {BGE_MODEL_ID} from './bgeMatching';
import {eligibleTools,chooseRoute,validateRouteSelection,abstain,type Candidate,type RoutingDecision} from './policy';
export type SkillOffer={toolId:string;label:string;description:string;score:number};
export type SkillReview={status:'ready'|'abstained';offers:SkillOffer[];reason:string};
export type SkillChoice={toolId:string;sourceMessageId:string};
export const noSkills=(reason:string):SkillReview=>({status:'abstained',offers:[],reason});
const labels:Record<string,string>={COURSE_011:'Understand my study costs',COURSE_012:'Explore study and placement commitments',CORE_010:'Check the supporting evidence',CAREER_004:'Plan my next career step'};
export function skillMessage(toolId:string):string {
 const t=eligibleTools.find(t=>t.id===toolId);
 return t?`Help me explore ${t.name.toLowerCase()} in more detail, using our conversation so far. Explain what matters for my situation and what still needs checking.`:'';
}
/** Each section must have a clear match. Different sections may support different skills. */
export function selectSkillOffers(rankings:Candidate[][],modelId:string=DEFAULT_ROUTER_MODEL):SkillReview {
 const matches=new Map<string,SkillOffer>();
 for(const ranking of rankings){
  const d=chooseRoute(ranking,modelId,'suggestion');
  const unique=ranking.filter(c=>eligibleTools.some(t=>t.id===c.toolId)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1).sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.findIndex(x=>x.toolId===c.toolId)===i);
  // An optional menu can offer two strong related matches. Automatic topic routing still abstains.
  const choices=d.status==='selected'?[{toolId:d.toolId!,score:d.score!}]:
    modelId!==BGE_MODEL_ID&&unique.length>=3&&unique[1].score>=.60&&unique[1].score-unique[2].score>=.10?unique.slice(0,2):[];
  for(const c of choices){
   const t=eligibleTools.find(t=>t.id===c.toolId)!;
   if(matches.has(t.id)&&matches.get(t.id)!.score>=c.score)continue;
   matches.set(t.id,{toolId:t.id,label:labels[t.id]||t.name,description:t.purpose,score:c.score});
  }
 }
 const offers=[...matches.values()].sort((a,b)=>b.score-a.score).slice(0,3);
 return offers.length?{status:'ready',offers,reason:'minilm-response-review'}:noSkills('no-clear-match');
}
/** The user selects an allowlisted skill, not arbitrary browser-supplied prompt text. */
export function acceptSkillChoice(value:unknown,messages:{id:string;role:string;error?:unknown;streamStopped?:boolean;schemaValid?:boolean;semanticValid?:boolean}[],text:string,structured=false):RoutingDecision {
 const c=value as Partial<SkillChoice>|undefined;
 const last=messages.at(-1);
 if(structured||!c||!last||last.role!=='assistant'||last.error||last.streamStopped||last.schemaValid===false||last.semanticValid===false||last.id!==c.sourceMessageId)return abstain('stale-skill-offer');
 if(!eligibleTools.some(t=>t.id===c.toolId)||text!==skillMessage(c.toolId!))return abstain('invalid-skill-choice');
 return {status:'selected',toolId:c.toolId,reason:'user-selected-skill',version:'minilm-response-review-v1'};
}
/** Split by measured tokens, keeping every character. Never silently truncate model input. */
export function embeddingSections(text:string,fits:(s:string)=>boolean):string[]{
 if(!text.trim())return [];
 if(fits(text))return [text];
 if(text.length<2)throw Error('Unencodable section');
 let middle=Math.floor(text.length/2);
 const space=text.lastIndexOf(' ',middle);
 if(space>middle/2)middle=space+1;
 return [...embeddingSections(text.slice(0,middle),fits),...embeddingSections(text.slice(middle),fits)];
}
export function allowSkillReview(userText:string):boolean {
 return !/\b(stop|pause|cancel|no (?:more |extra )?(?:questions|suggestions|follow.up)|do not suggest|don[’']t suggest|suicid\w*|self.harm|emergency)\b/i.test(userText);
}

/** Keep attention on Gemini's active question. Offer skills after an answer
 * with no question, outside safety responses and active service intake. */
export function canReviewResponseSkills(response:any,userText:string):boolean {
 return !!response&&allowSkillReview(userText)&&
  response.interaction?.kind==='none'&&
  response.current_mode!=='S_SERVICE_HANDOFF'&&!response.service_trigger?.trigger_now&&
  !response.state?.safety_override_applied&&
  !/SAFETY|SECURITY|CRITICAL_CLARIFICATION/.test(response.response_intent||'')&&
  (response.content_blocks||[]).some((b:any)=>b.text?.trim()||b.items?.length||b.rows?.length);
}

/** Navigation menus offer tasks; intake/eligibility/preferences questions remain Quiz answers. */
export function isTopicMenu(interaction:any):boolean {
 return interaction?.kind==='question' && interaction.input_type==='single_select' &&
  /(?:which (?:aspect|topic|area)|what would you like to (?:explore|focus|learn)|focus on next|explore next)/i.test(interaction.question||'') &&
  Array.isArray(interaction.options)&&interaction.options.length>0;
}
export function selectedTopic(interaction:any,event:any):string {
 if(!isTopicMenu(interaction))return '';
 const selection=event?.userEvent?.interaction||event?.interaction;
 if(selection?.selected_option_ids?.length!==1||selection.self_input)return '';
 const option=interaction.options.find((o:any)=>o.id===selection.selected_option_ids[0]);
 return option?[option.label,option.description].filter(Boolean).join('. '):'';
}
export function acceptTopicRoute(value:any,interaction:any,event:any):RoutingDecision {
 if(!selectedTopic(interaction,event))return abstain('not-topic-selection');
 const decision=validateRouteSelection(value,'topic');
 if(decision.status!=='selected')return abstain('uncertain-topic');
 return {...decision,reason:'user-selected-topic',version:'minilm-topic-v2'};
}
/** Keep each heading and its explanation together; user context is joined with the response topic. */
export function suggestionText(response:any,userMessages:string[]):string {
 const topic=response.content_blocks?.find((b:any)=>b.title)?.title||'';
 const sections=userMessages.length?[`Conversation context. ${userMessages.join('. ')}. Current topic: ${topic}`]:[];
 for(const b of response.content_blocks||[]){
  const heading=b.title||topic;
  const items=(b.items||[]).map((i:any)=>[i.title,i.text,i.value].filter(Boolean).join('. '));
  if(b.text)sections.push([heading,b.text].filter(Boolean).join('. '));
  for(const item of items)sections.push([heading,item].filter(Boolean).join('. '));
  if(!b.text&&!items.length&&b.type!=='heading')sections.push(JSON.stringify(b));
 }
 for(const a of response.interaction?.recommended_actions||[])sections.push(`${a.label}. ${a.message}`);
 return sections.join('\n\n');
}
