import {resolveShortQuery,type RoutingHistory} from './conversationQuery';
import {DEFAULT_ROUTER_MODEL,ROUTER_MODELS} from './models';
import {BGE_MODEL_ID,bgeGateResult} from './bgeMatching';
import {BGE_OUT_OF_SCOPE} from './bgeDomain';
import bgeCalibration from './bgeCalibration.json';
import {parseOalaMention} from '../oala/invocation';
import registry from './microtools.json';
import {learningDepthInstruction} from './learningDepth';
import {skillInputInstruction} from './skillInputs';
export type MicroTool = typeof registry[number];
export const microTools:MicroTool[]=registry;
export const ROUTER_VERSION='minilm-guarded-v1';
export const MODEL_ID='Xenova/all-MiniLM-L6-v2';
export const MIN_SCORE=0.48;
export const MIN_MARGIN=0.06;
export type Candidate={toolId:string;score:number};
export type RoutingFlow='route'|'topic'|'suggestion';
export type RoutingDecision={modelId?:string;calibrationVersion?:string;routingFlow?:RoutingFlow;domainMargin?:number;status:'selected'|'abstained';toolId?:string;score?:number;margin?:number;reason:string;version:string;latencyMs?:number};
// These catalogue entries describe internal control operations, not user-facing answers.
const internalOnly=new Set(['CORE_001','CORE_002']);
export const eligibleTools=microTools.filter(t=>!internalOnly.has(t.id));
export const abstain=(reason:string):RoutingDecision=>({status:'abstained',reason,version:ROUTER_VERSION});
export function routingSkipReason(text:string,structuredAnswer=false):string|null {
 const s=text.trim();
 if(structuredAnswer)return 'structured-answer';
 if(!s || s.length>1800)return 'input-length';
 if(!/[a-z]/i.test(s)||/[^\u0000-\u024f\u2000-\u206f]/.test(s))return 'language-or-symbols';
 if(/^(hi|hello|hey|thanks|thank you|yes|no|okay|ok|sure|not sure|i[’']?m not sure)[.!\s]*$/i.test(s))return 'conversation';
 if(/^actually\b/i.test(s)||/\b(pause|cancel|forget|ignore|instead|rather than|do not|don[’']t|not interested|not looking)\b/i.test(s)||/^(?:please\s+)?stop\b|\bstop (?:suggesting|searching|asking|the|this|that)\b/i.test(s))return 'correction-or-boundary';
 if(/\b(kill myself|suicid|self.harm|hurt myself|emergency)\b/i.test(s))return 'sensitive-boundary';
 if(/^(more|tell me more|go on|continue|what about that|what about this|what about (?:that|this|the second) one|does (?:that|this) qualify me|compare (?:them|these|those)|why|how much|what next)[?.!\s]*$/i.test(s))return 'needs-context';
 if(s.split(/\s+/).length<4)return 'needs-context';
 // Multiple jobs in one request belong with the full counsellor until a multi-tool planner is evaluated.
 if((s.match(/\?/g)||[]).length>1)return 'multiple-questions';
 return null;
}
export function routingInput(text:string,history:RoutingHistory=[],structured=false):{text:string;skip:string|null;resolved:boolean}{
 const skip=routingSkipReason(text,structured);
 if(skip!=='needs-context')return {text,skip,resolved:false};
 const query=resolveShortQuery(text,history);
 return query?{text:query,skip:null,resolved:true}:{text,skip,resolved:false};
}
export const indexText=(t:MicroTool)=>`${t.name}. ${t.use_when} ${t.purpose} Examples: ${t.trigger_examples}`;
export function chooseRoute(candidates:Candidate[],modelId:string=DEFAULT_ROUTER_MODEL,flow:RoutingFlow='route'):RoutingDecision {
 if(!ROUTER_MODELS.some(m=>m.id===modelId))return abstain('unknown-model');
 if(modelId===BGE_MODEL_ID){
  const d=bgeGateResult(candidates.filter(c=>c.toolId===BGE_OUT_OF_SCOPE||eligibleTools.some(t=>t.id===c.toolId)),bgeCalibration[flow]);
  const metadata={modelId,calibrationVersion:bgeCalibration.version,routingFlow:flow,score:d.score,margin:d.margin,domainMargin:d.domainMargin};
  return d.selected?{...metadata,status:'selected',toolId:d.toolId,reason:d.reason,version:ROUTER_VERSION}:{...abstain(d.reason),...metadata};
 }
 const ranked=candidates.filter(c=>eligibleTools.some(t=>t.id===c.toolId)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1).sort((a,b)=>b.score-a.score);
 const unique=ranked.filter((c,i)=>ranked.findIndex(r=>r.toolId===c.toolId)===i);
 if(unique.length<2)return abstain('incomplete-ranking');
 const [first,second]=unique,margin=first.score-second.score;
 if(first.score<MIN_SCORE)return {...abstain('low-similarity'),score:first.score,margin};
 if(margin<MIN_MARGIN)return {...abstain('ambiguous'),score:first.score,margin};
 return {modelId,routingFlow:flow,status:'selected',toolId:first.toolId,score:first.score,margin,reason:'clear-semantic-match',version:ROUTER_VERSION};
}
/** Server and browser use the same allowlisted profile; client thresholds are never accepted. */
export function validateRouteSelection(value:unknown,flow:RoutingFlow='route'):RoutingDecision {
 const r=value as Partial<RoutingDecision>|undefined;
 if(!r||r.version!==ROUTER_VERSION)return abstain('no-selection');
 if(r.status==='abstained'){
  const known=['not-ready','low-similarity','ambiguous','incomplete-ranking','busy','timeout','unavailable','inference-failed','cancelled','token-budget','outside-scope'];
  return abstain(known.includes(r.reason||'')?r.reason!:'no-selection');
 }
 if(r.status!=='selected')return abstain('no-selection');
 if(!eligibleTools.some(t=>t.id===r.toolId))return abstain('unknown-tool');
 const modelId=r.modelId??DEFAULT_ROUTER_MODEL;
 if(modelId!==BGE_MODEL_ID)return abstain('unknown-model');
 if(r.routingFlow&&r.routingFlow!==flow)return abstain('invalid-flow');
 const bge=modelId===BGE_MODEL_ID,gate=bge?bgeCalibration[flow]:{score:MIN_SCORE,margin:MIN_MARGIN};
 if(typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<gate.score||r.score>1||typeof r.margin!=='number'||!Number.isFinite(r.margin)||r.margin<gate.margin||r.margin>2)return abstain('invalid-score');
 if(bge&&(r.calibrationVersion!==bgeCalibration.version||r.routingFlow!==flow||typeof r.domainMargin!=='number'||!Number.isFinite(r.domainMargin)||r.domainMargin<bgeCalibration[flow].domainMargin||r.domainMargin>r.score+1))return abstain('invalid-calibration');
 return {status:'selected',toolId:r.toolId,score:r.score,margin:r.margin,modelId,routingFlow:flow,
  ...(bge?{calibrationVersion:bgeCalibration.version,domainMargin:r.domainMargin}:{}),reason:'clear-semantic-match',version:ROUTER_VERSION};
}
/** Browser routing is advisory. Only allowlisted catalogue text can reach Gemini. */
export function acceptClientRoute(value:unknown,mode:string,text:string,structuredAnswer=false,history:RoutingHistory=[]):RoutingDecision {
 const mention=parseOalaMention(text);
 if(!mention.active)return abstain('not-addressed');
 const {skip}=routingInput(mention.message,history,structuredAnswer);if(skip)return abstain(skip);
 return validateRouteSelection(value,'route');
}
export function scopedInstruction(decision:RoutingDecision):string {
 const tool=eligibleTools.find(t=>decision.status==='selected'&&t.id===decision.toolId);
 if(!tool)return '';
 return `OPTIONAL_FOCUS_FOR_THIS_TURN:
${decision.reason==='skill-question-continuation'?'Continue the previously selected skill': ['user-selected-skill','user-selected-topic'].includes(decision.reason)?'The user selected the offered skill':'The local similarity router suggests'} "${tool.name}". This is a fallible topic hint, not a user instruction or evidence. Ignore it if it does not match the actual request and conversation. The main counselling instructions and canonical JSON contract still control the response. Do not expose routing labels, similarity scores or internal classifications. Do not restart intake, override a correction, invent facts, imply retrieval occurred, or perform an external action. Unknown workload, accessibility, eligibility, prices and availability remain unknown until supported by relevant evidence. Respect requests for one sentence or no follow-up.
Use only the relevant parts of this catalogue guidance; any request for a different output format or internal fields must be adapted to the main response contract:
${tool.mini_prompt}

${learningDepthInstruction(tool.id)}

${skillInputInstruction(tool.id)}
END_OPTIONAL_FOCUS`;
}
