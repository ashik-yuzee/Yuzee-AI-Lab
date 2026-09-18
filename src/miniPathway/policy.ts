import {BGE_MODEL_ID} from '../routing/bgeMatching';
import {bgeProfiles,taskRanking} from '../routing/bgeProfiles';
import {acceptedResponse} from '../ux/responsePresentation';
import {allowSkillReview} from '../routing/skillSuggestions';

export const MINI_PATHWAY_THRESHOLD = 40;
export const MINI_PATHWAY_VERSION = 'mini-pathway-v2-report-contract';
export type PathwayHint = {status:'selected'|'abstained'; score?:number; margin?:number; reason:string;modelId?:string;profileVersion?:string;failedGates?:string[]};
export type PathwayDecision = {action:'automatic'|'offer'|'none'; reason:string; score:number|null};
export const pathwayScenarios = [
 {id:'pathway',text:'I am unsure which career or study direction to choose. Help me compare possible pathways and find a realistic next step.'},
 {id:'pathway',text:'I want to change career. Map how my current skills and experience could lead to a new role through study or work.'},
 {id:'pathway',text:'How do I become a nurse, engineer, teacher or designer? Explore the route from where I am now to my career goal.'},
 {id:'pathway',text:'I feel stuck choosing between university, an apprenticeship and work. Help me explore interests, values and career options.'},
 {id:'pathway',text:'My career direction is clear. Show the next stages, skills, experience and learning options in my career pathway.'},
 {id:'pathway',text:'I have chosen IT support because I enjoy diagnosing technical problems and explaining solutions to people. Outline a flexible plan for learning, practice and my first support job.'},
 {id:'pathway',text:'I have compared the work and am confident in my career choice. Show the next stages towards my first job, building on my strengths and keeping the plan flexible.'},
 {id:'pathway',text:'I want to move from my current job in retail into IT. I do not know the steps to take or which route is realistic.'},
 {id:'pathway',text:'I am returning to work after being away to raise children. Help me explore what is realistic and map the steps back into employment.'},
 {id:'pathway',text:'Plan the stages from my first coding course all the way through to landing my first software development job.'},
 {id:'other',text:'Explain a specific course fee, HECS repayment calculation, scholarship or entry requirement. I do not need a new career pathway.'},
 {id:'other',text:'Teach me a specific skill or explain a technical term with worked examples. I know my learning goal and do not need a pathway.'},
 {id:'other',text:'Hello, thanks, okay. Tell me about the weather or a recipe. Stop or cancel this conversation.'},
 {id:'other',text:'What does Yuzee offer? Explain the services, privacy policy, account or application status.'},
] as const;
export function choosePathwayHint(candidates:{id:string;score:number}[],modelId?:string):PathwayHint {
 if(modelId===BGE_MODEL_ID){
  const r=taskRanking(candidates,['pathway','other'],bgeProfiles.pathway);
  return {status:r.selected?'selected':'abstained',score:r.score,margin:r.margin,reason:r.selected?'pathway-relevant':r.id==='other'?'not-pathway':'uncertain',modelId,profileVersion:bgeProfiles.pathway.version,failedGates:r.failedGates};
 }
 const ranked=candidates.filter(c=>['pathway','other'].includes(c.id)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1)
  .sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
 if(ranked.length<2||ranked[0].id!=='pathway')return {status:'abstained',reason:'not-pathway'};
 const score=ranked[0].score,margin=score-ranked[1].score;
 return score>=.48&&margin>=.06?{status:'selected',score,margin,reason:'pathway-relevant'}:{status:'abstained',reason:'uncertain'};
}
export function validPathwayHint(h:any):h is PathwayHint {
 const bge=h?.modelId===BGE_MODEL_ID,gate=bge?bgeProfiles.pathway:{score:.48,margin:.06};
 if(h?.modelId&&(!bge||h.profileVersion!==bgeProfiles.pathway.version))return false;
 return h?.status==='selected'&&Number.isFinite(h.score)&&h.score>=gate.score&&h.score<=1&&Number.isFinite(h.margin)&&h.margin>=gate.margin&&h.margin<=2;
}
export function pathwayScore(response:any):number|null {
 const c=response?.state?.user_confidence;
 return Number.isInteger(c?.score)&&c.score>=0&&c.score<=100&&c.evidence_strength!=='none'&&c.band!=='unknown'?c.score:null;
}
export function pathwayBoundary(response:any,userText:string):boolean {
 return !allowSkillReview(userText)||/\b(?:no|without|don't|do not)\s+(?:a\s+)?(?:mini\s+)?pathway\b/i.test(userText)||
  response?.state?.safety_override_applied||response?.current_mode==='S_SERVICE_HANDOFF'||
  /SAFETY|SECURITY|CRITICAL_CLARIFICATION/.test(response?.response_intent||'')||response?.service_trigger?.trigger_now;
}
export function decideMiniPathway(response:unknown,userText:string,hint:PathwayHint,alreadyHelped=false):PathwayDecision {
 const r=acceptedResponse(response),score=pathwayScore(r);
 if(!r||pathwayBoundary(r,userText))return {action:'none',reason:'invalid-or-boundary',score};
 if(!validPathwayHint(hint))return {action:'none',reason:'no-relevant-match',score};
 // Unknown is not low; a relevant optional plan may still help without auto generation.
 return {action:score!==null&&score<MINI_PATHWAY_THRESHOLD&&!alreadyHelped?'automatic':'offer',score,
  reason:alreadyHelped?'already-helped':score===null?'confidence-unknown':score<MINI_PATHWAY_THRESHOLD?'low-decision-confidence':'optional-pathway'};
}
export type PathwaySource = {id:string;role:string;content:string;structuredResponse?:unknown;error?:unknown;streamStopped?:boolean;schemaValid?:boolean;semanticValid?:boolean};
export function currentPathwaySource(messages:PathwaySource[],sourceId:string){
 const last=messages.at(-1);
 if(!last||last.id!==sourceId||last.role!=='assistant'||last.error||last.streamStopped||last.schemaValid===false||last.semanticValid===false)return null;
 return acceptedResponse(last.structuredResponse||last.content);
}
export function alreadyHelpedInLowEpisode(messages:PathwaySource[],runs:{sourceMessageId:string}[]):boolean {
 let index=-1;messages.forEach((m,i)=>{if(runs.some(r=>r.sourceMessageId===m.id))index=i;});
 if(index<0)return false;
 return !messages.slice(index+1).some(m=>{
  if(m.role!=='assistant')return false;
  const r=acceptedResponse(m.structuredResponse||m.content);
  return (pathwayScore(r)??-1)>=MINI_PATHWAY_THRESHOLD||r?.state.user_confidence.reason_codes.includes('NEW_TOPIC_RESET');
 });
}
export function pathwayQuery(response:any,userText:string):string {
 // Short relevance query, not the entire report. Worker checks measured tokens before embedding.
 const title=response?.content_blocks?.find((b:any)=>b.title)?.title||'';
 return userText.trim().split(/\s+/).length>=5||!title?userText:`${userText}\nCurrent topic: ${String(title).slice(0,200)}`;
}
